/**
 * Withdrawal Routes
 * API endpoints for withdrawal management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { requirePINVerification, checkAmountThreshold } from '../middleware/pin-verification';
import {
  initiateOffRampWithdrawal,
  initiateExternalWithdrawal,
  initiateMicroWithdrawal,
  processWithdrawal,
  failWithdrawal,
  cancelWithdrawal,
  getWithdrawal,
  getUserWithdrawalHistory,
  getPendingWithdrawals,
  getPendingMicroWithdrawals,
  getUserTotalWithdrawn,
  estimateWithdrawalFee,
} from '../services/withdrawal-service';
import { getAccount } from '../services/account-service';

const router = Router();

// Validation schemas
const initiateOffRampWithdrawalSchema = z.object({
  fromAccountId: z.string().uuid('Invalid account ID'),
  provider: z.enum(['stripe', 'kotanipay', 'mpesa']),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string().optional().default('USDC'),
  destinationIdentifier: z.string(),
  metadata: z.record(z.any()).optional(),
});

const initiateExternalWithdrawalSchema = z.object({
  fromAccountId: z.string().uuid('Invalid account ID'),
  toAddress: z.string(),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string().optional().default('USDC'),
});

const initiateMicroWithdrawalSchema = z.object({
  fromAccountId: z.string().uuid('Invalid account ID'),
  toAddress: z.string(),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string().optional().default('USDC'),
});

const processWithdrawalSchema = z.object({
  withdrawalId: z.string().uuid('Invalid withdrawal ID'),
  transactionHash: z.string(),
  feeAmount: z.string().optional(),
});

const cancelWithdrawalSchema = z.object({
  withdrawalId: z.string().uuid('Invalid withdrawal ID'),
  reason: z.string().optional(),
});

const feePreviewSchema = z.object({
  destination: z.enum(['offramp_stripe', 'offramp_kotanipay', 'offramp_mpesa', 'external_wallet', 'micro_withdrawal', 'internal_transfer']),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
});

/**
 * GET /api/withdrawals/methods
 * List available withdrawal destinations
 */
router.get('/methods', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: {
        destinations: [
          {
            id: 'offramp_stripe',
            name: 'Stripe',
            type: 'offramp',
            currencies: ['USDC', 'USDT'],
            description: 'Convert to fiat (bank transfer)',
            feePercent: 2.5,
          },
          {
            id: 'offramp_kotanipay',
            name: 'Kotanipay',
            type: 'offramp',
            currencies: ['USDC', 'USDT'],
            description: 'East Africa payment method',
            feePercent: 2.5,
          },
          {
            id: 'offramp_mpesa',
            name: 'M-Pesa',
            type: 'offramp',
            currencies: ['USDC', 'USDT'],
            description: 'Mobile money (Kenya)',
            feePercent: 2.5,
          },
          {
            id: 'external_wallet',
            name: 'External Wallet',
            type: 'transfer',
            currencies: ['USDC', 'USDT', 'ETH', 'CELO'],
            description: 'Send to any crypto wallet',
            feePercent: 1,
          },
          {
            id: 'micro_withdrawal',
            name: 'Micro-Withdrawal',
            type: 'batch',
            currencies: ['USDC', 'USDT'],
            description: 'Batched for small amounts (< $10)',
            feePercent: 0.5,
            maxAmount: '10',
            minAmount: '0.50',
          },
          {
            id: 'internal_transfer',
            name: 'Internal Transfer',
            type: 'internal',
            currencies: ['USDC', 'USDT', 'ETH', 'CELO'],
            description: 'Move to another account',
            feePercent: 0,
          },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/withdrawals/preview
 * Preview withdrawal fees and net amount
 */
router.post(
  '/preview',
  authenticateToken,
  validateRequest(feePreviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { destination, amount } = req.body;

      const preview = estimateWithdrawalFee(destination as any, amount);

      res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/withdrawals/offramp
 * Initiate off-ramp withdrawal
 * Requires: PIN verification for security
 */
router.post(
  '/offramp',
  authenticateToken,
  requirePINVerification,
  checkAmountThreshold('10000'), // Require PIN for amounts > $10k
  validateRequest(initiateOffRampWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromAccountId, provider, amount, currency, destinationIdentifier, metadata } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) throw new Error('User ID not found');

      // Verify account belongs to user
      const account = await getAccountById(fromAccountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Account not found or does not belong to user',
        });
      }

      const withdrawal = await initiateOffRampWithdrawal(
        userId,
        fromAccountId,
        provider as 'stripe' | 'kotanipay' | 'mpesa',
        amount,
        currency,
        destinationIdentifier,
        metadata
      );

      res.status(201).json({
        success: true,
        data: withdrawal,
        message: 'Off-ramp withdrawal initiated.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/withdrawals/external
 * Initiate external wallet withdrawal
 * Requires: PIN verification for security
 */
router.post(
  '/external',
  authenticateToken,
  requirePINVerification,
  checkAmountThreshold('5000'), // Require PIN for amounts > $5k
  validateRequest(initiateExternalWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromAccountId, toAddress, amount, currency } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) throw new Error('User ID not found');

      // Verify account belongs to user
      const account = await getAccountById(fromAccountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Account not found or does not belong to user',
        });
      }

      const withdrawal = await initiateExternalWithdrawal(userId, fromAccountId, toAddress, amount, currency);

      res.status(201).json({
        success: true,
        data: withdrawal,
        message: 'External withdrawal initiated.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/withdrawals/micro
 * Initiate micro-withdrawal
 * Requires: PIN verification for security
 */
router.post(
  '/micro',
  authenticateToken,
  requirePINVerification,
  checkAmountThreshold('1000'), // Require PIN for amounts > $1k
  validateRequest(initiateMicroWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromAccountId, toAddress, amount, currency } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) throw new Error('User ID not found');

      // Verify account belongs to user
      const account = await getAccountById(fromAccountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Account not found or does not belong to user',
        });
      }

      const withdrawal = await initiateMicroWithdrawal(userId, fromAccountId, toAddress, amount, currency);

      res.status(201).json({
        success: true,
        data: withdrawal,
        message: 'Micro-withdrawal request created. Will be batched with others.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/withdrawals/:withdrawalId/process
 * Process a withdrawal (admin/webhook)
 */
router.post(
  '/:withdrawalId/process',
  validateRequest(processWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { withdrawalId, transactionHash, feeAmount } = req.body;

      const withdrawal = await processWithdrawal(withdrawalId, transactionHash, feeAmount);

      res.json({
        success: true,
        data: withdrawal,
        message: 'Withdrawal processed.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/withdrawals/:withdrawalId/cancel
 * Cancel pending withdrawal
 */
router.post(
  '/:withdrawalId/cancel',
  authenticateToken,
  validateRequest(cancelWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { withdrawalId } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user?.id;

      // Verify withdrawal belongs to user
      const withdrawal = await getWithdrawal(withdrawalId);
      if (!withdrawal || withdrawal.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Withdrawal not found',
        });
      }

      const cancelled = await cancelWithdrawal(withdrawalId, reason);

      res.json({
        success: true,
        data: cancelled,
        message: 'Withdrawal cancelled.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/withdrawals/:withdrawalId
 * Get withdrawal details
 */
router.get('/:withdrawalId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { withdrawalId } = req.params;
    const userId = (req as any).user?.id;

    const withdrawal = await getWithdrawal(withdrawalId);

    if (!withdrawal || withdrawal.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Withdrawal not found',
      });
    }

    res.json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/withdrawals/history
 * Get user's withdrawal history
 */
router.get(
  '/user/history',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const withdrawals = await getUserWithdrawalHistory(userId, limit, offset);

      res.json({
        success: true,
        data: withdrawals,
        count: withdrawals.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/withdrawals/pending
 * Get user's pending withdrawals
 */
router.get(
  '/user/pending',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      const withdrawals = await getPendingWithdrawals(userId);

      res.json({
        success: true,
        data: withdrawals,
        count: withdrawals.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/withdrawals/micro/pending
 * Get pending micro-withdrawals
 */
router.get(
  '/micro/pending',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      const microWithdrawals = await getPendingMicroWithdrawals(userId);

      res.json({
        success: true,
        data: microWithdrawals,
        count: microWithdrawals.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/withdrawals/total-withdrawn
 * Get user's total withdrawn amount
 */
router.get(
  '/user/total-withdrawn',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      const total = await getUserTotalWithdrawn(userId);

      res.json({
        success: true,
        data: { totalWithdrawn: total },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
