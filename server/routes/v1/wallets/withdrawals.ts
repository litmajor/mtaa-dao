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
 * - /initiate creates a withdrawal intent in DB (status: pending_2fa)
 * - /verify-2fa validates the OTP and transitions to pending_pin
 * - /complete validates PIN and transitions to processing (uses FOR UPDATE lock)
 * - Skipping any step is not possible — each step checks the prior status
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../../../auth';
import { validateRequest } from '../../../middleware/validation';
import { createRateLimiter } from '../../../middleware/rateLimiting';
import { twoFAService } from '../../../services/two-fa-service';
import { pinService } from '../../../services/pin-service';
import { kycService } from '../../../services/kycService';
import { db } from '../../../storage';
import { walletTransactions } from '../../../../shared/schema';
import { and, eq, inArray, desc, count, gte, sum, sql } from 'drizzle-orm';

const router = express.Router({ mergeParams: true });

const DEFAULT_WITHDRAWAL_LIMITS = {
  currency: 'USD',
  stripe: {
    minWithdrawal: 10,
    perTransaction: 2500,
    daily: 5000,
    monthly: 25000,
  },
  kotanipay: {
    minWithdrawal: 5,
    perTransaction: 1000,
    daily: 2000,
    monthly: 10000,
  },
  mpesa: {
    minWithdrawal: 1,
    perTransaction: 1500,
    daily: 3500,
    monthly: 15000,
  },
  bank_transfer: {
    minWithdrawal: 20,
    perTransaction: 5000,
    daily: 15000,
    monthly: 50000,
  },
};

async function getDynamicWithdrawalLimits(userId?: string) {
  const tier = userId ? await kycService.getCurrentTier(userId) : null;
  const capDaily = tier?.dailyLimit ?? 100;
  const capMonthly = tier?.monthlyLimit ?? 500;

  const applyTierCaps = (limits: { minWithdrawal: number; perTransaction: number; daily: number; monthly: number }) => ({
    minWithdrawal: limits.minWithdrawal,
    perTransaction: Math.min(limits.perTransaction, capDaily),
    daily: Math.min(limits.daily, capDaily),
    monthly: Math.min(limits.monthly, capMonthly),
  });

  return {
    currency: 'USD',
    kycTier: tier?.tier ?? 'none',
    kycDailyLimit: capDaily,
    kycMonthlyLimit: capMonthly,
    stripe: applyTierCaps(DEFAULT_WITHDRAWAL_LIMITS.stripe),
    kotanipay: applyTierCaps(DEFAULT_WITHDRAWAL_LIMITS.kotanipay),
    mpesa: applyTierCaps(DEFAULT_WITHDRAWAL_LIMITS.mpesa),
    bank_transfer: applyTierCaps(DEFAULT_WITHDRAWAL_LIMITS.bank_transfer),
  };
}

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
  withdrawalId: z.string().uuid('Invalid withdrawal ID'),
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
// WITHDRAWAL INTENT EXPIRY (5 minutes)
// ════════════════════════════════════════════════════════════════════════════════
const WITHDRAWAL_INTENT_TTL_MS = 5 * 60 * 1000;

// ════════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL OPERATIONS (8 endpoints)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /withdrawals/initiate
 * Initiate a withdrawal (requires 2FA)
 * 
 * FIX : Now persists a withdrawal intent record in the DB with status
 * 'pending_2fa'. The record binds the validated amount, destination, and
 * provider so that /complete cannot be called with arbitrary values.
 * 
 * Flow:
 * 1. User calls this endpoint with withdrawal details
 * 2. System creates withdrawal record (status: pending_2fa)
 * 3. System generates OTP and sends via 2FA method
 * 4. User calls /verify-2fa with withdrawalId + OTP code → status: pending_pin
 * 5. User calls /complete with withdrawalId + PIN → status: processing
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

      // FIX (C3): Persist a withdrawal intent record so the 2FA step is bound
      // to a specific withdrawal. The record starts in 'pending_2fa' status.
      const [withdrawalRecord] = await db.insert(walletTransactions).values({
        fromUserId: userId,
        toUserId: destination || null,
        walletAddress: fromAccountId,
        amount: amount,
        currency: currency || 'USDC',
        type: 'withdrawal',
        status: 'pending_2fa',
        description: `Withdrawal via ${provider}`,
        metadata: {
          provider,
          fromAccountId,
          destination,
          initiatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + WITHDRAWAL_INTENT_TTL_MS).toISOString(),
          ...(metadata || {}),
        },
      }).returning();

      // Generate OTP for 2FA verification
      const otpResult = await twoFAService.createWithdrawalOTP(userId);

      if (!otpResult.success) {
        // Rollback: mark as failed if OTP generation fails
        await db.update(walletTransactions)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(walletTransactions.id, withdrawalRecord.id));
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

      // Return withdrawal ID and OTP ID for next step
      res.status(202).json({
        success: true,
        data: {
          withdrawalId: withdrawalRecord.id,
          otpId: otpResult.otpId,
          message: 'OTP sent to your configured 2FA method. Verify with the code to complete withdrawal.',
          nextStep: 'POST /withdrawals/verify-2fa',
          expiresIn: WITHDRAWAL_INTENT_TTL_MS / 1000,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /withdrawals/verify-2fa
 * Verify 2FA code and transition withdrawal to pending_pin
 * 
 * FIX (C3): The verification result is now bound server-side to the
 * withdrawal record. The status transitions from 'pending_2fa' to
 * 'pending_pin'. The verification token is no longer returned to the
 * client — server state is the single source of truth.
 */
router.post(
  '/verify-2fa',
  isAuthenticated,
  authenticatedLimiter,
  validateRequest(verify2FASchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
      const { withdrawalId, otpId, code, useBackupCode } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID not found',
        });
      }

      if (!withdrawalId || !otpId || !code) {
        return res.status(400).json({
          success: false,
          error: 'withdrawalId, OTP ID and code are required',
        });
      }

      // Verify the withdrawal belongs to this user AND is in the
      // correct state (pending_2fa). Prevents replay / out-of-order calls.
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

      if (withdrawal.status !== 'pending_2fa') {
        return res.status(400).json({
          success: false,
          error: `Withdrawal is in '${withdrawal.status}' state, expected 'pending_2fa'`,
        });
      }

      // Check expiry
      const meta = withdrawal.metadata as any;
      if (meta?.expiresAt && new Date(meta.expiresAt) < new Date()) {
        await db.update(walletTransactions)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(walletTransactions.id, withdrawalId));
        return res.status(410).json({
          success: false,
          error: 'Withdrawal intent has expired. Please initiate a new withdrawal.',
        });
      }

      let verifyResult;

      if (useBackupCode) {
        verifyResult = await twoFAService.verifyBackupCode(userId, code);
      } else {
        verifyResult = await twoFAService.verifyWithdrawalOTP(userId, otpId, code);
      }

      if (!verifyResult.success) {
        return res.status(400).json(verifyResult);
      }

      // Transition to 'pending_pin' — server-side state is the gate.
      await db.update(walletTransactions)
        .set({
          status: 'pending_pin',
          updatedAt: new Date(),
        })
        .where(eq(walletTransactions.id, withdrawalId));

      res.json({
        success: true,
        data: {
          withdrawalId,
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
 * 
 * This requires the withdrawal to be in 'pending_pin' status,
 * proving that 2FA was completed server-side. Uses atomic UPDATE ... WHERE
 * to prevent TOCTOU race conditions on status transitions.
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

      // This requires the withdrawal to be in 'pending_pin' status,
      // proving that 2FA was completed server-side.
      const result = await db.execute(sql`
        UPDATE wallet_transactions
        SET status = 'processing', updated_at = NOW()
        WHERE id = ${withdrawalId}
          AND from_user_id = ${userId}
          AND status = 'pending_pin'
        RETURNING id, amount, currency, status
      `);

      const rows = (result as any).rows || [];
      if (!rows.length) {
        const [existing] = await db.select().from(walletTransactions)
          .where(and(
            eq(walletTransactions.id, withdrawalId),
            eq(walletTransactions.fromUserId, userId)
          ))
          .limit(1);

        if (!existing) {
          return res.status(404).json({
            success: false,
            error: 'Withdrawal not found',
          });
        }

        return res.status(400).json({
          success: false,
          error: `Withdrawal is in '${existing.status}' state. 2FA verification must be completed first.`,
        });
      }

      const updated = rows[0];

      res.json({
        success: true,
        data: {
          withdrawalId: updated.id,
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
          userId,
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
      const limits = await getDynamicWithdrawalLimits(userId);

      res.json({
        success: true,
        data: {
          limits,
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
