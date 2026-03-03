/**
 * Deposit Routes
 * API endpoints for deposit management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { authenticate } from '../auth';
import { validateRequest } from '../middleware/validation';
import {
  initiateOffRampDeposit,
  completeDeposit,
  failDeposit,
  cancelDeposit,
  getDeposit,
  getUserDepositHistory,
  getPendingDeposits,
  getDepositByExternalReference,
  updateDepositExternalReference,
  getUserTotalDeposited,
} from '../services/deposit-service';
import { getAccount } from '../services/account-service';

const router = Router();

// ════════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════════

// All deposit operations require authentication
router.use(authenticate);

// Validation schemas
const initiateOffRampDepositSchema = z.object({
  toAccountId: z.string().uuid('Invalid account ID'),
  provider: z.enum(['stripe', 'kotanipay', 'mpesa']),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string().optional().default('USDC'),
  metadata: z.record(z.any()).optional(),
});

const completeDepositSchema = z.object({
  depositId: z.string().uuid('Invalid deposit ID'),
  transactionHash: z.string(),
  feeAmount: z.string().optional(),
});

const cancelDepositSchema = z.object({
  depositId: z.string().uuid('Invalid deposit ID'),
  reason: z.string().optional(),
});

/**
 * GET /api/deposits/methods
 * List available deposit methods
 */
router.get('/methods', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: {
        methods: [
          {
            id: 'stripe',
            name: 'Stripe',
            type: 'offramp',
            currencies: ['USD', 'EUR', 'GBP'],
            description: 'Credit/Debit cards worldwide',
          },
          {
            id: 'kotanipay',
            name: 'Kotanipay',
            type: 'offramp',
            currencies: ['USD', 'KES'],
            description: 'East Africa payment method',
          },
          {
            id: 'mpesa',
            name: 'M-Pesa',
            type: 'offramp',
            currencies: ['KES'],
            description: 'Mobile money (Kenya)',
          },
          {
            id: 'external_wallet',
            name: 'External Wallet',
            type: 'transfer',
            currencies: ['USDC', 'USDT', 'ETH'],
            description: 'Send crypto from any wallet',
          },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/deposits/offramp/initiate
 * Initiate an off-ramp deposit
 */
router.post(
  '/offramp/initiate',
  authenticateToken,
  validateRequest(initiateOffRampDepositSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { toAccountId, provider, amount, currency, metadata } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) throw new Error('User ID not found');

      // Verify account belongs to user
      const account = await getAccount(toAccountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Account not found or does not belong to user',
        });
      }

      const deposit = await initiateOffRampDeposit(
        userId,
        toAccountId,
        provider,
        amount,
        currency,
        metadata
      );

      res.status(201).json({
        success: true,
        data: deposit,
        message: 'Deposit initiated. Awaiting payment confirmation.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/deposits/complete
 * Complete a deposit (webhook or admin)
 */
router.post(
  '/complete',
  validateRequest(completeDepositSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { depositId, transactionHash, feeAmount } = req.body;

      const deposit = await completeDeposit(depositId, transactionHash, feeAmount);

      res.json({
        success: true,
        data: deposit,
        message: 'Deposit completed. Balance updated.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/deposits/:depositId/cancel
 * Cancel a pending deposit
 */
router.post(
  '/:depositId/cancel',
  authenticateToken,
  validateRequest(cancelDepositSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { depositId } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user?.id;

      // Verify deposit belongs to user
      const deposit = await getDeposit(depositId);
      if (!deposit || deposit.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Deposit not found or does not belong to user',
        });
      }

      const cancelled = await cancelDeposit(depositId, reason);

      res.json({
        success: true,
        data: cancelled,
        message: 'Deposit cancelled.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/deposits/:depositId
 * Get deposit details
 */
router.get('/:depositId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { depositId } = req.params;
    const userId = (req as any).user?.id;

    const deposit = await getDeposit(depositId);

    if (!deposit || deposit.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Deposit not found',
      });
    }

    res.json({
      success: true,
      data: deposit,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/deposits/history
 * Get user's deposit history
 */
router.get(
  '/user/history',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const deposits = await getUserDepositHistory(userId, limit, offset);

      res.json({
        success: true,
        data: deposits,
        count: deposits.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/deposits/pending
 * Get user's pending deposits
 */
router.get('/user/pending', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;

    const deposits = await getPendingDeposits(userId);

    res.json({
      success: true,
      data: deposits,
      count: deposits.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/deposits/total-deposited
 * Get user's total deposited amount
 */
router.get(
  '/user/total-deposited',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      const total = await getUserTotalDeposited(userId);

      res.json({
        success: true,
        data: { totalDeposited: total },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/deposits/webhook
 * Provider webhook endpoint (Stripe, Kotanipay, M-Pesa)
 * This is where payment providers notify us of completion
 */
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { depositId, transactionHash, status, externalReference, feeAmount } = req.body;

    if (!depositId || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: depositId, status',
      });
    }

    if (externalReference) {
      await updateDepositExternalReference(depositId, externalReference);
    }

    if (status === 'completed') {
      await completeDeposit(depositId, transactionHash || '', feeAmount);
    } else if (status === 'failed') {
      await failDeposit(depositId, 'Provider payment failed');
    }

    res.json({
      success: true,
      message: 'Webhook processed',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
