/**
 * Withdrawals Router - V1 Canonical Endpoint
 * Base path: /api/v1/wallets/withdrawals
 * 
 * On-ramp withdrawal operations with 2FA and PIN verification
 * 
 * Endpoints (9):
 * POST   /api/v1/wallets/withdrawals/initiate          Initiate withdrawal (requires 2FA, rate limited)
 * POST   /api/v1/wallets/withdrawals/verify-2fa        Verify 2FA code (rate limited)
 * POST   /api/v1/wallets/withdrawals/complete          Complete with PIN verification (rate limited)
 * GET    /api/v1/wallets/withdrawals/status/:txId      Get withdrawal status
 * GET    /api/v1/wallets/withdrawals/limits            Get withdrawal limits (rate limited)
 * GET    /api/v1/wallets/withdrawals/stable-assets     List stable-asset withdrawal methods
 * GET    /api/v1/wallets/withdrawals/history           User's withdrawal history (rate limited)
 * GET    /api/v1/wallets/withdrawals/summary           Withdrawal summary stats (rate limited)
 * POST   /api/v1/wallets/withdrawals/webhook           Provider webhook (no auth)
 * 
 * 2FA & PIN Requirement:
 * - All withdrawal initiations require 2FA verification
 * - PIN verification required to complete withdrawal
 * - 2FA middleware applied at /initiate endpoint
 */

import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../../../auth';
import { validateRequest } from '../../../middleware/validation';
import { createRateLimiter } from '../../../middleware/rateLimiting';
import { twoFAService } from '../../../services/two-fa-service';
import { pinService } from '../../../services/pin-service';
import { db } from '../../../storage';
import { walletTransactions } from '../../../../shared/schema';
import { and, eq, inArray, desc, count, gte, sum } from 'drizzle-orm';

const router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ════════════════════════════════════════════════════════════════════════════════

// Authenticated operations: Standard user rate limiting
const authenticatedLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50,
  keyGenerator: (req: any) => `withdraw:${req.user?.id}:${req.user?.claims?.sub}`,
});

// Webhook rate limiter: Protect webhook endpoint from abuse
// IP-based limiting for public endpoints
const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyGenerator: (req: any) => req.ip, // Rate limit by IP
});

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const initiateWithdrawalSchema = z.object({
  fromAccountId: z.string().uuid('Invalid account ID'),
  provider: z.enum(['stripe', 'kotanipay', 'mpesa', 'bank_transfer']),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string().optional().default('USDC'),
  destination: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const verify2FASchema = z.object({
  otpId: z.string(),
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  useBackupCode: z.boolean().optional(),
});

const completeWithdrawalSchema = z.object({
  withdrawalId: z.string().uuid('Invalid withdrawal ID'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
  transactionHash: z.string().optional(),
  feeAmount: z.string().optional(),
});

// ════════════════════════════════════════════════════════════════════════════════
// 2FA MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Middleware: Ensure 2FA is enabled before withdrawal
 * Called at /withdrawals/initiate
 */
async function require2FA(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found',
      });
    }

    // Check if 2FA is enabled
    const is2FAEnabled = await twoFAService.is2FAEnabled(userId);

    if (!is2FAEnabled) {
      return res.status(403).json({
        success: false,
        error: '2FA is required for withdrawals but not enabled',
        hint: 'Enable 2FA at /v1/wallets/withdrawals/setup',
      });
    }

    // Store for use in handler
    (req as any).userId = userId;
    next();
  } catch (error) {
    next(error);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL OPERATIONS (8 endpoints)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /withdrawals/initiate
 * Initiate a withdrawal (requires 2FA)
 * 
 * Flow:
 * 1. User calls this endpoint with withdrawal details
 * 2. System generates OTP and sends via 2FA method
 * 3. User receives OTP in email/SMS/authenticator
 * 4. User calls /verify-2fa with OTP code
 * 5. User calls /complete with PIN to finalize withdrawal
 */
router.post(
  '/initiate',
  isAuthenticated,
  authenticatedLimiter,
  require2FA,
  validateRequest(initiateWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { fromAccountId, provider, amount, currency, destination, metadata } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID not found',
        });
      }

      // Generate OTP for 2FA verification
      const otpResult = await twoFAService.createWithdrawalOTP(userId);

      if (!otpResult.success) {
        return res.status(400).json(otpResult);
      }

      // Get 2FA config to determine delivery method
      const config = await twoFAService.get2FAConfig(userId);

      // Send OTP via configured method
      if (config?.config?.method) {
        const sendResult = await twoFAService.send2FAOTP(
          userId,
          otpResult.otpId!,
          config.config.method as any,
          destination || ''
        );

        if (!sendResult.success) {
          console.warn('Could not send 2FA OTP:', sendResult.error);
        }
      }

      // Return OTP ID for next step (user will verify with this ID + code)
      res.status(202).json({
        success: true,
        data: {
          otpId: otpResult.otpId,
          message: 'OTP sent to your configured 2FA method. Verify with the code to complete withdrawal.',
          nextStep: 'POST /withdrawals/verify-2fa',
          expiresIn: 300, // 5 minutes
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /withdrawals/verify-2fa
 * Verify 2FA code and prepare for PIN verification
 */
router.post(
  '/verify-2fa',
  isAuthenticated,
  authenticatedLimiter,
  validateRequest(verify2FASchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
      const { otpId, code, useBackupCode } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID not found',
        });
      }

      if (!otpId || !code) {
        return res.status(400).json({
          success: false,
          error: 'OTP ID and code are required',
        });
      }

      let verifyResult;

      if (useBackupCode) {
        // Verify backup code instead
        verifyResult = await twoFAService.verifyBackupCode(userId, code);
      } else {
        // Verify regular OTP
        verifyResult = await twoFAService.verifyWithdrawalOTP(userId, otpId, code);
      }

      if (!verifyResult.success) {
        return res.status(400).json(verifyResult);
      }

      // Generate verification token for withdrawal creation
      const verificationToken = `withdrawal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      res.json({
        success: true,
        data: {
          verificationToken,
          message: '2FA verified. Provide PIN to complete withdrawal.',
          nextStep: 'POST /withdrawals/complete',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /withdrawals/complete
 * Complete withdrawal with PIN verification
 * Uses completeWithdrawalSchema to validate withdrawalId
 */
router.post(
  '/complete',
  isAuthenticated,
  authenticatedLimiter,
  validateRequest(completeWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
      const { withdrawalId } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID not found',
        });
      }

      // Verify PIN with pinService
      const pinValid = await pinService.verifyPINForTransaction(userId, req.body.pin || '', 'withdrawal');
      if (!pinValid.success) {
        return res.status(401).json({
          success: false,
          error: 'Invalid PIN',
        });
      }

      // Retrieve withdrawal record to verify user owns it
      const [withdrawal] = await db.select().from(walletTransactions)
        .where(and(
          eq(walletTransactions.id, withdrawalId),
          eq(walletTransactions.fromUserId, userId)
        ))
        .limit(1);

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          error: 'Withdrawal not found',
        });
      }

      if (withdrawal.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'Withdrawal already processed',
        });
      }

      // Update withdrawal to 'processing' status
      await db.update(walletTransactions)
        .set({
          status: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(walletTransactions.id, withdrawalId));

      res.json({
        success: true,
        data: {
          withdrawalId,
          status: 'processing',
          message: 'Withdrawal processing. You will be notified when complete.',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /withdrawals/status/:txId
 * Get withdrawal status
 */
router.get(
  '/status/:txId',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { txId } = req.params;
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

      // Retrieve withdrawal status from database
      const withdrawal = await db.select()
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.id, txId),
          eq(walletTransactions.fromUserId, userId || '')
        ))
        .limit(1);

      if (!withdrawal || withdrawal.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Withdrawal not found'
        });
      }

      const tx = withdrawal[0];
      res.json({
        success: true,
        data: {
          withdrawalId: tx.id,
          status: tx.status,
          amount: tx.amount,
          currency: tx.currency,
          provider: (tx as any).provider || 'stripe',
          createdAt: tx.createdAt,
          completedAt: (tx as any).completedAt || null,
          userId, // For auth verification
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /withdrawals/limits
 * Get withdrawal limits for user (rate limited)
 */
router.get(
  '/limits',
  isAuthenticated,
  authenticatedLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

      res.json({
        success: true,
        data: {
          limits: {
            stripe: {
              daily: '5000',
              monthly: '25000',
              perTransaction: '2500',
              minWithdrawal: '10',
            },
            kotanipay: {
              daily: '2500',
              monthly: '12500',
              perTransaction: '1250',
              minWithdrawal: '5',
            },
            mpesa: {
              daily: '500',
              monthly: '5000',
              perTransaction: '250',
              minWithdrawal: '1',
            },
            bank_transfer: {
              daily: '10000',
              monthly: '50000',
              perTransaction: '5000',
              minWithdrawal: '50',
            },
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /withdrawals/stable-assets
 * DEPRECATED: Use /v1/wallets/inflows/stable-assets instead
 * Kept for backward compatibility
 */
router.get(
  '/stable-assets',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: {
          assets: [
            { symbol: 'USDC', name: 'USD Coin', decimal: 6 },
            { symbol: 'USDT', name: 'Tether', decimal: 6 },
            { symbol: 'DAI', name: 'DAI', decimal: 18 },
          ],
          note: 'Use /v1/wallets/inflows/stable-assets for canonical endpoint',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /withdrawals/history
 * Get user's withdrawal history (rate limited)
 */
router.get(
  '/history',
  isAuthenticated,
  authenticatedLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      // Retrieve withdrawal history from database
      const withdrawals = await db.select()
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.fromUserId, userId || ''),
          inArray(walletTransactions.type, ['withdrawal', 'micro-withdrawal'])
        ))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      const totalCount = await db.select({ count: count() })
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.fromUserId, userId || ''),
          inArray(walletTransactions.type, ['withdrawal', 'micro-withdrawal'])
        ));

      res.json({
        success: true,
        data: withdrawals.map(w => ({
          id: w.id,
          amount: w.amount,
          currency: w.currency,
          status: w.status,
          type: w.type,
          recipient: w.toUserId,
          createdAt: w.createdAt,
          completedAt: (w as any).completedAt || null
        })),
        count: totalCount[0]?.count || 0,
        pagination: { limit, offset },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /withdrawals/summary
 * Get withdrawal summary stats (rate limited)
 */
router.get(
  '/summary',
  isAuthenticated,
  authenticatedLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

      // Calculate withdrawal summary from database
      const completed = await db.select({ total: sum(walletTransactions.amount) })
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.fromUserId, userId || ''),
          inArray(walletTransactions.type, ['withdrawal', 'micro-withdrawal']),
          eq(walletTransactions.status, 'completed')
        ));

      const pending = await db.select({ count: count() })
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.fromUserId, userId || ''),
          inArray(walletTransactions.type, ['withdrawal', 'micro-withdrawal']),
          eq(walletTransactions.status, 'pending')
        ));

      const lastWithdrawal = await db.select()
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.fromUserId, userId || ''),
          inArray(walletTransactions.type, ['withdrawal', 'micro-withdrawal'])
        ))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(1);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthlyTotal = await db.select({ total: sum(walletTransactions.amount) })
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.fromUserId, userId || ''),
          inArray(walletTransactions.type, ['withdrawal', 'micro-withdrawal']),
          eq(walletTransactions.status, 'completed'),
          gte(walletTransactions.createdAt, monthStart)
        ));

      res.json({
        success: true,
        data: {
          totalWithdrawn: completed[0]?.total || '0',
          pendingCount: pending[0]?.count || 0,
          lastWithdrawalAt: lastWithdrawal[0]?.createdAt || null,
          monthlyWithdrawn: monthlyTotal[0]?.total || '0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /withdrawals/webhook
 * Provider webhook endpoint (Stripe, Kotanipay, M-Pesa, Bank Transfer)
 * Public endpoint: No auth required (providers need access)
 * Rate limited by IP to prevent abuse
 */
router.post(
  '/webhook',
  webhookLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { withdrawalId, transactionHash, status, externalReference, feeAmount } = req.body;

      if (!withdrawalId || !status) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: withdrawalId, status',
        });
      }

      // Process withdrawal status update from provider webhook
      const withdrawal = await db.select()
        .from(walletTransactions)
        .where(eq(walletTransactions.id, withdrawalId))
        .limit(1);

      if (!withdrawal || withdrawal.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Withdrawal not found'
        });
      }

      // Update withdrawal record with new status
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (externalReference) {
        updateData.externalReference = externalReference;
      }

      if (status === 'completed') {
        updateData.completedAt = new Date();
      }

      if (feeAmount) {
        updateData.fee = feeAmount;
      }

      await db.update(walletTransactions)
        .set(updateData)
        .where(eq(walletTransactions.id, withdrawalId));

      // Log webhook receipt
      console.log(`[Withdrawal Webhook] ID: ${withdrawalId}, Status: ${status}, Reference: ${externalReference}`);

      res.json({
        success: true,
        message: 'Webhook processed',
        withdrawalId,
        status
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
