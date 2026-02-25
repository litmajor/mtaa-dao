/**
 * Account Routes - Phase 1
 * REST API endpoints for account management
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  createAccount,
  getAccount,
  getUserAccounts,
  getAccountByNumber,
  updateAccount,
  closeAccount,
  createAccountTransaction,
  getAccountTransactions,
  getAccountTransactionsByDateRange,
  createAccountSettings,
  getAccountSettings,
  generateAccountStatement,
  checkTransactionLimits,
  logAccountAccess,
  getAccountAccessLogs,
  verifyAccount,
  setAccountBlock,
  getDaoAccounts,
} from "../services/account-service";
import { authenticateToken } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();

// Request validation schemas
const createAccountSchema = z.object({
  userId: z.string().min(1),
  daoId: z.string().uuid().optional(),
  accountType: z.enum(["personal", "dao", "collective", "joint"]),
  accountName: z.string().min(1).max(255),
  currency: z.string().default("KES"),
  dailyLimit: z.string().transform(Number).optional(),
  monthlyLimit: z.string().transform(Number).optional(),
  primaryWalletId: z.string().uuid().optional(),
});

const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  transactionType: z.enum([
    "deposit",
    "withdrawal",
    "transfer",
    "fee",
    "interest",
    "adjustment",
  ]),
  amount: z.string().transform(Number),
  currency: z.string(),
  description: z.string().optional(),
  reference: z.string().optional(),
  fromAccountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().optional(),
  fromUserId: z.string().optional(),
  toUserId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
});

const createTransactionSettingsSchema = z.object({
  accountId: z.string().uuid(),
  autoDepositEnabled: z.boolean().optional(),
  autoWithdrawalEnabled: z.boolean().optional(),
  autoWithdrawalAmount: z.string().transform(Number).optional(),
  autoWithdrawalFrequency: z
    .enum(["weekly", "monthly", "quarterly"])
    .optional(),
  notifyOnDeposit: z.boolean().optional(),
  notifyOnWithdrawal: z.boolean().optional(),
  notifyOnLowBalance: z.boolean().optional(),
  lowBalanceThreshold: z.string().transform(Number).optional(),
  requirePinForTransactions: z.boolean().optional(),
  requireTwoFactorForLargeTransactions: z.boolean().optional(),
  largeTransactionThreshold: z.string().transform(Number).optional(),
});

// ==================== ACCOUNT ENDPOINTS ====================

/**
 * POST /api/accounts
 * Create a new account
 */
router.post(
  "/",
  validateRequest(createAccountSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await createAccount(req.body);

      // Log the action
      await logAccountAccess({
        accountId: account.id,
        userId: req.user?.id,
        action: "create_account",
        resourceType: "account",
        status: "success",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json({
        success: true,
        data: account,
        message: "Account created successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/accounts/:id
 * Get account by ID
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await getAccount(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Log access
    await logAccountAccess({
      accountId: account.id,
      userId: req.user?.id,
      action: "view_account",
      resourceType: "account",
      status: "success",
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts/number/:accountNumber
 * Get account by account number
 */
router.get(
  "/number/:accountNumber",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccountByNumber(req.params.accountNumber);

      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      res.json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/accounts/user/:userId
 * Get all accounts for a user
 */
router.get(
  "/user/:userId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify user is requesting their own accounts or is admin
      if (req.user?.id !== req.params.userId && !req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const accounts_list = await getUserAccounts(req.params.userId);

      res.json({
        success: true,
        data: accounts_list,
        count: accounts_list.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/accounts/:id
 * Update account
 */
router.put(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      // Verify authorization
      if (account.userId !== req.user?.id && !req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const updated = await updateAccount(req.params.id, req.body);

      // Log update
      await logAccountAccess({
        accountId: account.id,
        userId: req.user?.id,
        action: "update_account",
        resourceType: "account",
        status: "success",
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: updated,
        message: "Account updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/accounts/:id/verify
 * Verify account
 */
router.post(
  "/:id/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await verifyAccount(req.params.id);

      await logAccountAccess({
        accountId: account.id,
        userId: req.user?.id,
        action: "verify_account",
        resourceType: "account",
        status: "success",
      });

      res.json({
        success: true,
        data: account,
        message: "Account verified successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/accounts/:id/block
 * Block account
 */
router.post(
  "/:id/block",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Only admins can block accounts",
        });
      }

      const account = await setAccountBlock(req.params.id, true);

      await logAccountAccess({
        accountId: account.id,
        userId: req.user?.id,
        action: "block_account",
        resourceType: "account",
        status: "success",
      });

      res.json({
        success: true,
        data: account,
        message: "Account blocked",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/accounts/:id/unblock
 * Unblock account
 */
router.post(
  "/:id/unblock",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Only admins can unblock accounts",
        });
      }

      const account = await setAccountBlock(req.params.id, false);

      await logAccountAccess({
        accountId: account.id,
        userId: req.user?.id,
        action: "unblock_account",
        resourceType: "account",
        status: "success",
      });

      res.json({
        success: true,
        data: account,
        message: "Account unblocked",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/accounts/:id/close
 * Close account
 */
router.post(
  "/:id/close",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      if (account.userId !== req.user?.id && !req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const closed = await closeAccount(req.params.id, req.body.reason);

      await logAccountAccess({
        accountId: account.id,
        userId: req.user?.id,
        action: "close_account",
        resourceType: "account",
        status: "success",
      });

      res.json({
        success: true,
        data: closed,
        message: "Account closed",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== TRANSACTION ENDPOINTS ====================

/**
 * POST /api/accounts/:id/transactions
 * Create transaction
 */
router.post(
  "/:id/transactions",
  validateRequest(createTransactionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      if (account.userId !== req.user?.id && !req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      // Check limits
      const limitCheck = await checkTransactionLimits(
        req.params.id,
        req.body.amount
      );
      if (!limitCheck.allowed) {
        return res.status(400).json({
          success: false,
          message: limitCheck.reason,
        });
      }

      const transaction = await createAccountTransaction({
        ...req.body,
        accountId: req.params.id,
        fromUserId: req.user?.id,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: transaction,
        message: "Transaction created successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/accounts/:id/transactions
 * Get account transactions
 */
router.get(
  "/:id/transactions",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      if (account.userId !== req.user?.id && !req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const transactions = await getAccountTransactions(
        req.params.id,
        limit,
        offset
      );

      res.json({
        success: true,
        data: transactions,
        pagination: { limit, offset, count: transactions.length },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/accounts/:id/transactions/range
 * Get transactions by date range
 */
router.get(
  "/:id/transactions/range",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      if (account.userId !== req.user?.id && !req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date range",
        });
      }

      const transactions = await getAccountTransactionsByDateRange(
        req.params.id,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: transactions,
        count: transactions.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== SETTINGS ENDPOINTS ====================

/**
 * GET /api/accounts/:id/settings
 * Get account settings
 */
router.get(
  "/:id/settings",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      if (account.userId !== req.user?.id && !req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const settings = await getAccountSettings(req.params.id);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/accounts/:id/settings
 * Update account settings
 */
router.put(
  "/:id/settings",
  validateRequest(createTransactionSettingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      if (account.userId !== req.user?.id && !req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const settings = await createAccountSettings(req.body);

      res.json({
        success: true,
        data: settings,
        message: "Settings updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== STATEMENT ENDPOINTS ====================

/**
 * POST /api/accounts/:id/statements
 * Generate account statement
 */
router.post(
  "/:id/statements",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      if (account.userId !== req.user?.id && !req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { periodStart, periodEnd, statementPeriod } = req.body;

      const statement = await generateAccountStatement(
        req.params.id,
        new Date(periodStart),
        new Date(periodEnd),
        statementPeriod
      );

      res.status(201).json({
        success: true,
        data: statement,
        message: "Statement generated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== ACCESS LOGS ENDPOINTS ====================

/**
 * GET /api/accounts/:id/access-logs
 * Get account access logs
 */
router.get(
  "/:id/access-logs",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      if (account.userId !== req.user?.id && !req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const logs = await getAccountAccessLogs(req.params.id, limit);

      res.json({
        success: true,
        data: logs,
        count: logs.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== DAO ACCOUNTS ENDPOINTS ====================

/**
 * GET /api/accounts/dao/:daoId
 * Get all accounts for a DAO
 */
router.get(
  "/dao/:daoId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const daoAccounts = await getDaoAccounts(req.params.daoId);

      res.json({
        success: true,
        data: daoAccounts,
        count: daoAccounts.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
