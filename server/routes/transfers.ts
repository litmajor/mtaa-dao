/**
 * Internal Transfers Routes
 * API endpoints for account-to-account transfers
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { requirePINVerification, checkAmountThreshold } from '../middleware/pin-verification';
import {
  transferBetweenAccounts,
  getTransferHistory,
  getAccountTransfers,
  validateTransferPath,
  getTotalTransferred,
  getTransferStatistics,
} from '../services/transfer-service';

const router = Router();

// Validation schemas
const createTransferSchema = z.object({
  fromAccountId: z.string().uuid('Invalid from account ID'),
  toAccountId: z.string().uuid('Invalid to account ID'),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  reason: z
    .enum(['trading', 'savings', 'profit_lock', 'rebalance', 'manual'])
    .optional()
    .default('manual'),
});

const validatePathSchema = z.object({
  fromType: z.string().min(1),
  toType: z.string().min(1),
});

/**
 * POST /api/transfers
 * Create a transfer between user's own accounts
 * Requires: PIN verification for security
 */
router.post(
  '/',
  authenticateToken,
  requirePINVerification,
  checkAmountThreshold('5000'), // Require PIN for amounts > $5k
  validateRequest(createTransferSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromAccountId, toAccountId, amount, reason } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const transfer = await transferBetweenAccounts(
        userId,
        fromAccountId,
        toAccountId,
        amount,
        reason
      );

      res.status(201).json({
        success: true,
        data: transfer,
        message: 'Transfer completed successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transfers/history
 * Get user's transfer history (all transfers)
 */
router.get('/history', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offsetVal = parseInt(req.query.offset as string) || 0;

    const transfers = await getTransferHistory(userId, limit, offsetVal);

    res.json({
      success: true,
      data: transfers,
      count: transfers.length,
      limit,
      offset: offsetVal,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/transfers/account/:accountId
 * Get transfers for specific account
 */
router.get(
  '/account/:accountId',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accountId } = req.params;
      const userId = (req as any).user?.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offsetVal = parseInt(req.query.offset as string) || 0;

      const transfers = await getAccountTransfers(userId, accountId, limit, offsetVal);

      res.json({
        success: true,
        data: transfers,
        count: transfers.length,
        accountId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transfers/validate-path
 * Validate if a transfer path is allowed
 */
router.post(
  '/validate-path',
  validateRequest(validatePathSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromType, toType } = req.body;

      const validation = validateTransferPath(fromType, toType);

      res.json({
        success: validation.valid,
        valid: validation.valid,
        fromType,
        toType,
        ...(validation.error && { error: validation.error }),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transfers/total/:fromAccountId/:toAccountId
 * Get total transferred between two accounts
 */
router.get(
  '/total/:fromAccountId/:toAccountId',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromAccountId, toAccountId } = req.params;
      const userId = (req as any).user?.id;

      const total = await getTotalTransferred(userId, fromAccountId, toAccountId);

      res.json({
        success: true,
        data: {
          fromAccountId,
          toAccountId,
          totalTransferred: total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transfers/statistics
 * Get transfer statistics for user
 */
router.get('/statistics', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;

    const stats = await getTransferStatistics(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
