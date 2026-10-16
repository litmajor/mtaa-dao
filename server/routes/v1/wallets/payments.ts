/**
 * Payments Router - Complete Implementation (17 Endpoints)
 * 
 * Handles all payment-related operations including:
 * - Single/batch payments
 * - Recurring payments 
 * - Bill splitting
 * - Voucher management
 * - Payment history and receipts
 * - Fee estimation and retries
 * 
 * Routes:
 * POST   /payments                    Create payment
 * GET    /payments                    List payments
 * GET    /payments/:paymentId         Get payment details
 * POST   /payments/:paymentId/cancel  Cancel payment
 * 
 * Recurring payments (4):
 * POST   /payments/recurring          Create recurring payment
 * GET    /payments/recurring          List recurring
 * PUT    /payments/recurring/:id      Update recurring
 * DELETE /payments/recurring/:id      Delete recurring
 * 
 * Bill splitting (2):
 * POST   /payments/split              Create split payment
 * GET    /payments/split              List splits
 * 
 * Vouchers (3):
 * GET    /payments/vouchers           List vouchers
 * POST   /payments/vouchers/:id/redeem Redeem voucher
 * POST   /payments/vouchers/:id/validate Validate voucher
 * 
 * History & Receipts (2):
 * GET    /payments/history            Get payment history
 * GET    /payments/:paymentId/receipt Get payment receipt
 * 
 * Operations (2):
 * POST   /payments/estimate           Estimate payment fees
 * POST   /payments/:paymentId/retry   Retry failed payment
 * 
 * Rate limiting:
 * - Standard payments: 50/hour (paymentLimiter)
 * - Recurring operations: 10/hour (recurringLimiter) 
 */

import express, { type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, gt, gte, lte, or } from 'drizzle-orm';
import { isAuthenticated } from '../../../auth';
import { createRateLimiter } from '../../../middleware/rateLimiting';
import { db } from '../../../db';
import { paymentTransactions, users, vouchers, walletTransactions } from '../../../../shared/schema';
import { accounts } from '../../../../shared/accountSchema';
import { PaymentExecutionService, P2PTransferExecutionHandler } from '../../../services/paymentExecutionService';
import { ReversibilityService } from '../../../services/reversibilityService';
import { notificationService } from '../../../notificationService';
import {
  cancelRecurringPaymentWithDAO,
  createMultiRecipientRecurringPayment,
  getCreatedRecurringPayments,
} from '../../../services/recurringPaymentService';
import billSplitRouter from '../../bill-split';

const router = express.Router({ mergeParams: true });

// Rate limiters
const paymentLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50,
  keyGenerator: (req: any) => `payment:${req.user?.id}:${req.params.walletId || 'global'}`,
});

const recurringLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  keyGenerator: (req: any) => `recurring:${req.user?.id}`,
});

const voucherLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20,
  keyGenerator: (req: any) => `voucher:${req.user?.id}`,
});

// Canonical bill-split implementation owns the /payments/split endpoints.
// Auth and split-specific limits are enforced
// inside this router as well as by the parent V1 wallet mount.
router.use('/payments/split', billSplitRouter);

const getUserId = (req: Request): string | null => {
  const user = req.user as { id?: string | number; claims?: { id?: string | number; sub?: string | number } } | undefined;
  const id = user?.claims?.id ?? user?.claims?.sub ?? user?.id;
  return id === undefined || id === null || id === '' ? null : String(id);
};

const parsePositiveAmount = (value: unknown, maxFractionDigits = 18): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const amount = String(value).trim();
  if (!new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${maxFractionDigits}})?$`).test(amount)) return null;
  return Number(amount) > 0 ? amount : null;
};

const parsePage = (value: unknown, fallback: number, maximum: number): number | null => {
  const parsed = value === undefined ? fallback : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
};

const toUnits = (value: string, scale: number): bigint => {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * (10n ** BigInt(scale)) + BigInt(fraction.padEnd(scale, '0'));
};

const fromUnits = (value: bigint, scale: number): string => {
  const digits = value.toString().padStart(scale + 1, '0');
  if (scale === 0) return digits;
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return fraction ? `${digits.slice(0, -scale)}.${fraction}` : digits.slice(0, -scale);
};

const getPaymentByOwner = async (paymentId: string, userId: string) => {
  const [payment] = await db.select().from(paymentTransactions).where(and(
    eq(paymentTransactions.id, paymentId),
    eq(paymentTransactions.userId, userId),
    eq(paymentTransactions.provider, 'wallet'),
    eq(paymentTransactions.type, 'wallet_transfer')
  )).limit(1);
  return payment ?? null;
};

// ============================================================================
// CORE PAYMENT OPERATIONS (4 endpoints)
// ============================================================================

/**
 * POST /payments - Create payment
 * Creates a new payment transaction from wallet
 * 
 * Body:
 *   - walletId?: string (inferred from route params if available)
 *   - recipient: string (address or identifier)
 *   - amount: string (decimal amount)
 *   - currency?: string (default: CELO)
 *   - metadata?: Record<string, any> (custom fields)
 */
router.post('/payments', isAuthenticated, paymentLimiter, async (req: Request, res: Response) => {
  try {
    const { recipient, currency = 'CELO', metadata } = req.body;
    const amount = parsePositiveAmount(req.body.amount, 8);
    const userId = getUserId(req);

    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (typeof recipient !== 'string' || !recipient.trim() || !amount) {
      return res.status(400).json({ success: false, error: 'recipient and a positive decimal amount (up to 8 places) are required' });
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) > 9_999_999_999.99999999) {
      return res.status(400).json({ success: false, error: 'amount exceeds supported wallet ledger precision/range' });
    }
    if (typeof currency !== 'string' || !/^[A-Za-z0-9_-]{2,20}$/.test(currency)) {
      return res.status(400).json({ success: false, error: 'currency must be a valid token or currency code' });
    }
    if (metadata !== undefined && (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata))) {
      return res.status(400).json({ success: false, error: 'metadata must be an object' });
    }

    const recipientUser = await db.query.users.findFirst({
      where: or(eq(users.id, recipient.trim()), eq(users.username, recipient.trim()), eq(users.walletAddress, recipient.trim())),
      columns: { id: true, username: true, walletAddress: true },
    });
    if (recipientUser?.id === userId) return res.status(400).json({ success: false, error: 'Cannot transfer to the same user' });
    let senderAccount: typeof accounts.$inferSelect | undefined;
    let recipientAccount: typeof accounts.$inferSelect | undefined;
    if (recipientUser) {
      [senderAccount] = await db.select().from(accounts).where(and(
        eq(accounts.userId, userId), eq(accounts.accountType, 'wallet'), eq(accounts.currency, currency.toUpperCase()), eq(accounts.status, 'active')
      )).limit(1);
      [recipientAccount] = await db.select().from(accounts).where(and(
        eq(accounts.userId, recipientUser.id), eq(accounts.accountType, 'wallet'), eq(accounts.currency, currency.toUpperCase()), eq(accounts.status, 'active')
      )).limit(1);
      if (!senderAccount || !recipientAccount) {
        return res.status(409).json({ success: false, error: 'An active sender and recipient wallet account in the requested currency is required' });
      }
    }
    const [payment] = await db.insert(paymentTransactions).values({
      userId,
      reference: `wallet_${randomUUID()}`,
      type: 'wallet_transfer',
      amount,
      currency: currency.toUpperCase(),
      provider: 'wallet',
      status: 'pending',
      metadata: {
        ...(metadata ?? {}),
        recipient: recipient.trim(),
        walletId: req.params.walletId ?? null,
        executionState: 'awaiting_wallet_authorization',
      },
    }).returning();
    if (!recipientUser) {
      return res.status(202).json({
        success: true,
        data: payment,
        message: 'Payment intent persisted, but external wallet transfers require a configured signer and are not broadcast by this API.',
      });
    }
    const executionService = new PaymentExecutionService(new ReversibilityService(db as any));
    const handler = new P2PTransferExecutionHandler(executionService);
    const action = await handler.execute({
      userId,
      recipientId: recipientUser.id,
      amount: Number(amount),
      memo: typeof metadata?.memo === 'string' ? metadata.memo : '',
      simulation: {
        riskLevel: 'MEDIUM',
        reversibilityWindow: { recommendedGracePeriodHours: 24 },
        summary: `Wallet payment of ${amount} ${currency.toUpperCase()} to ${recipientUser.username ?? recipientUser.id}`,
        beforeState: {},
        afterState: {},
        warnings: [],
        riskFactors: ['Payment requires approval before ledger settlement'],
        impactedEntities: [userId, recipientUser.id],
      } as any,
    });
    const [linkedPayment] = await db.update(paymentTransactions).set({
      metadata: { ...(payment.metadata as Record<string, unknown>), executionState: action.status, reversibleActionId: action.id, recipientUserId: recipientUser.id },
      updatedAt: new Date(),
    }).where(eq(paymentTransactions.id, payment.id)).returning();
    await Promise.all([
      notificationService.sendNotification(userId, {
        type: 'payment_pending', title: 'Payment awaiting approval',
        message: `${amount} ${currency.toUpperCase()} payment to ${recipientUser.username ?? recipientUser.id} was created and requires approval.`,
        priority: 'medium', metadata: { paymentId: payment.id, actionId: action.id, amount, currency },
      }),
      notificationService.sendNotification(recipientUser.id, {
        type: 'payment_pending', title: 'Incoming payment pending',
        message: `An incoming payment of ${amount} ${currency.toUpperCase()} is awaiting approval.`,
        priority: 'low', metadata: { paymentId: payment.id, actionId: action.id, amount, currency },
      }),
    ]);

    return res.status(202).json({
      success: true,
      data: linkedPayment,
      action,
      message: 'Payment intent and approval-gated ledger action persisted. Settlement occurs only after approval.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /payments - List payments
 * Retrieves all payments for the authenticated user
 * 
 * Query:
 *   - status?: 'pending' | 'completed' | 'failed'
 *   - skip?: number
 *   - limit?: number
 */
router.get('/payments', isAuthenticated, paymentLimiter, async (req: Request, res: Response) => {
  try {
    const { status, skip = 0, limit = 20 } = req.query;
    const userId = getUserId(req);
    const offset = parsePage(skip, 0, 1_000_000);
    const pageSize = parsePage(limit, 20, 100);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (offset === null || pageSize === null || pageSize < 1) {
      return res.status(400).json({ success: false, error: 'skip and limit must be valid non-negative integers; limit is at most 100' });
    }
    if (status !== undefined && (typeof status !== 'string' || !['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status))) {
      return res.status(400).json({ success: false, error: 'invalid payment status filter' });
    }
    const filters = [
      eq(paymentTransactions.userId, userId),
      eq(paymentTransactions.provider, 'wallet'),
      eq(paymentTransactions.type, 'wallet_transfer'),
      ...(status ? [eq(paymentTransactions.status, status)] : []),
    ];
    const [payments, [total]] = await Promise.all([
      db.select().from(paymentTransactions).where(and(...filters)).orderBy(desc(paymentTransactions.createdAt)).limit(pageSize).offset(offset),
      db.select({ value: count() }).from(paymentTransactions).where(and(...filters)),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        payments,
        total: total.value,
        skip: offset,
        limit: pageSize,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /payments/:paymentId - Get payment details
 * Retrieves full details of a specific payment
 */
router.get('/payments/:paymentId', isAuthenticated, paymentLimiter, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const payment = await getPaymentByOwner(paymentId, userId);
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });
    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /payments/:paymentId/cancel - Cancel payment
 * Cancels a pending payment (only if status permits)
 */
router.post('/payments/:paymentId/cancel', isAuthenticated, paymentLimiter, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const existing = await getPaymentByOwner(paymentId, userId);
    if (!existing) return res.status(404).json({ success: false, error: 'Payment not found' });
    if (existing.status !== 'pending') return res.status(409).json({ success: false, error: `Payment cannot be cancelled from status ${existing.status}` });
    const paymentMetadata = existing.metadata && typeof existing.metadata === 'object'
      ? existing.metadata as Record<string, unknown>
      : {};
    if (typeof paymentMetadata.reversibleActionId === 'string') {
      const executionService = new PaymentExecutionService(new ReversibilityService(db as any));
      await executionService.cancelUnexecutedAction(paymentMetadata.reversibleActionId, userId);
    }
    const [payment] = await db.update(paymentTransactions)
      .set({ status: 'cancelled', updatedAt: new Date(), version: paymentTransactions.version })
      .where(and(
        eq(paymentTransactions.id, paymentId),
        eq(paymentTransactions.userId, userId),
        eq(paymentTransactions.provider, 'wallet'),
        eq(paymentTransactions.type, 'wallet_transfer'),
        eq(paymentTransactions.status, 'pending')
      ))
      .returning();
    if (!payment) return res.status(409).json({ success: false, error: 'Payment changed while cancellation was being processed' });
    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// RECURRING PAYMENTS (4 endpoints)
// ============================================================================

/**
 * POST /payments/recurring - Create recurring payment
 * Sets up a scheduled recurring payment
 * 
 * Body:
 *   - recipient: string
 *   - amount: string
 *   - frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
 *   - startDate?: string (ISO date, defaults to now)
 *   - endDate?: string (ISO date, optional)
 */
router.post('/payments/recurring', isAuthenticated, recurringLimiter, async (req: Request, res: Response) => {
  try {
    const { recipient, amount, frequency, startDate, endDate } = req.body;
    const userId = getUserId(req);
    const validAmount = parsePositiveAmount(amount, 2);
    const allowedFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
    const startsAt = startDate === undefined ? new Date() : new Date(startDate);
    const endsAt = endDate === undefined ? undefined : new Date(endDate);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (typeof recipient !== 'string' || !recipient.trim() || !validAmount || !allowedFrequencies.includes(frequency)) {
      return res.status(400).json({ success: false, error: 'recipient, positive amount (up to 2 decimals), and a supported frequency are required' });
    }
    if (!Number.isFinite(startsAt.getTime()) || (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt))) {
      return res.status(400).json({ success: false, error: 'startDate/endDate must be valid dates and endDate must follow startDate' });
    }
    const payment = await createMultiRecipientRecurringPayment({
      creatorId: userId,
      amount: validAmount,
      currency: typeof req.body.currency === 'string' ? req.body.currency.toUpperCase() : 'CELO',
      frequency,
      startDate: startsAt,
      endDate: endsAt,
      description: typeof req.body.description === 'string' ? req.body.description : 'Recurring wallet payment',
      autoExecute: true,
    }, [{ walletAddress: recipient.trim() }]);
    return res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /payments/recurring - List recurring payments
 * Retrieves all recurring payments for the user
 */
router.get('/payments/recurring', isAuthenticated, recurringLimiter, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const recurring = await getCreatedRecurringPayments(userId);
    return res.status(200).json({
      success: true,
      data: {
        recurring,
        total: recurring.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * PUT /payments/recurring/:id - Update recurring payment
 * Modifies a recurring payment configuration
 */
router.put('/payments/recurring/:id', isAuthenticated, recurringLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const [current] = await db.select().from(walletTransactions).where(and(
      eq(walletTransactions.id, id),
      eq(walletTransactions.fromUserId, userId),
      eq(walletTransactions.type, 'recurring')
    )).limit(1);
    if (!current) return res.status(404).json({ success: false, error: 'Recurring payment not found' });
    if (!['pending', 'paused'].includes(current.status ?? '')) {
      return res.status(409).json({ success: false, error: `Recurring payment cannot be updated from status ${current.status}` });
    }
    const amount = req.body.amount === undefined ? current.amount : parsePositiveAmount(req.body.amount, 2);
    const frequency = req.body.frequency ?? (current.metadata as Record<string, unknown> | null)?.frequency;
    if (!amount || !['daily', 'weekly', 'monthly', 'yearly'].includes(String(frequency))) {
      return res.status(400).json({ success: false, error: 'amount or frequency is invalid' });
    }
    const metadata = current.metadata && typeof current.metadata === 'object'
      ? current.metadata as Record<string, unknown>
      : {};
    const endDate = req.body.endDate === undefined ? metadata.endDate : req.body.endDate;
    const parsedEndDate = endDate ? new Date(String(endDate)) : null;
    if (parsedEndDate && (!Number.isFinite(parsedEndDate.getTime()) || parsedEndDate <= new Date(current.createdAt ?? Date.now()))) {
      return res.status(400).json({ success: false, error: 'endDate must be a valid date after the schedule start' });
    }
    const [updated] = await db.update(walletTransactions).set({
      amount: String(amount),
      updatedAt: new Date(),
      metadata: { ...metadata, frequency, ...(parsedEndDate ? { endDate: parsedEndDate.toISOString() } : { endDate: null }) },
    }).where(and(eq(walletTransactions.id, id), eq(walletTransactions.fromUserId, userId), eq(walletTransactions.type, 'recurring'))).returning();
    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * DELETE /payments/recurring/:id - Delete recurring payment
 * Removes a recurring payment schedule
 */
router.delete('/payments/recurring/:id', isAuthenticated, recurringLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const [current] = await db.select().from(walletTransactions).where(and(
      eq(walletTransactions.id, id),
      eq(walletTransactions.fromUserId, userId),
      eq(walletTransactions.type, 'recurring')
    )).limit(1);
    if (!current) return res.status(404).json({ success: false, error: 'Recurring payment not found' });
    if (!['pending', 'paused'].includes(current.status ?? '')) {
      return res.status(409).json({ success: false, error: `Recurring payment cannot be cancelled from status ${current.status}` });
    }
    await cancelRecurringPaymentWithDAO(id);
    const [cancelled] = await db.select().from(walletTransactions).where(eq(walletTransactions.id, id)).limit(1);
    return res.status(200).json({
      success: true,
      data: cancelled,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// BILL SPLITTING (2 endpoints)
// ============================================================================

// ============================================================================
// VOUCHER OPERATIONS (3 endpoints)
// ============================================================================

/**
 * GET /payments/vouchers - List available vouchers
 * Retrieves all vouchers available to the user
 */
router.get('/payments/vouchers', isAuthenticated, voucherLimiter, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const now = new Date();
    const available = await db.select().from(vouchers).where(and(
      eq(vouchers.status, 'active'),
      gt(vouchers.expiryDate, now),
      or(eq(vouchers.createdBy, userId), eq(vouchers.redeemedBy, userId))
    ));
    return res.status(200).json({
      success: true,
      data: {
        vouchers: available,
        total: available.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /payments/vouchers/:id/redeem - Redeem voucher
 * Applies a voucher to a payment
 */
router.post('/payments/vouchers/:id/redeem', isAuthenticated, voucherLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const now = new Date();
    const [voucher] = await db.update(vouchers).set({
      status: 'redeemed',
      redeemedBy: userId,
      redeemedAt: now,
    }).where(and(
      eq(vouchers.id, id),
      eq(vouchers.status, 'active'),
      gt(vouchers.expiryDate, now)
    )).returning();
    if (!voucher) {
      const [existing] = await db.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
      return existing
        ? res.status(409).json({ success: false, error: existing.status === 'active' ? 'Voucher is expired' : `Voucher is ${existing.status}` })
        : res.status(404).json({ success: false, error: 'Voucher not found' });
    }
    return res.status(200).json({
      success: true,
      data: voucher,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /payments/vouchers/:id/validate - Validate voucher
 * Checks if a voucher is valid and applicable
 */
router.post('/payments/vouchers/:id/validate', isAuthenticated, voucherLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const amount = req.body.amount === undefined ? null : parsePositiveAmount(req.body.amount);
    const currency = typeof req.body.currency === 'string' ? req.body.currency.toUpperCase() : null;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (req.body.amount !== undefined && !amount) return res.status(400).json({ success: false, error: 'amount must be a positive decimal amount' });
    const [voucher] = await db.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
    if (!voucher) return res.status(404).json({ success: false, error: 'Voucher not found' });
    const isValid = voucher.status === 'active' && voucher.expiryDate > new Date();
    const currencyMatches = !currency || currency === voucher.token.toUpperCase();
    const applicable = isValid && currencyMatches && (amount === null || Number(amount) >= Number(voucher.amount));
    return res.status(200).json({
      success: true,
      data: {
        voucherId: id,
        isValid,
        applicable,
        amount: voucher.amount,
        currency: voucher.token,
        reason: !isValid ? `Voucher is ${voucher.status === 'active' ? 'expired' : voucher.status}`
          : !currencyMatches ? 'Currency does not match voucher token'
            : !applicable ? 'Payment amount is less than voucher value' : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// HISTORY & RECEIPTS (2 endpoints)
// ============================================================================

/**
 * GET /payments/history - Get payment history
 * Retrieves paginated payment history for the user
 * 
 * Query:
 *   - skip?: number
 *   - limit?: number
 *   - from?: ISO date
 *   - to?: ISO date
 */
router.get('/payments/history', isAuthenticated, paymentLimiter, async (req: Request, res: Response) => {
  try {
    const { skip = 0, limit = 50, from, to, status } = req.query;
    const userId = getUserId(req);
    const offset = parsePage(skip, 0, 1_000_000);
    const pageSize = parsePage(limit, 50, 100);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (offset === null || pageSize === null || pageSize < 1) return res.status(400).json({ success: false, error: 'skip/limit must be valid; limit is at most 100' });
    if (status !== undefined && (typeof status !== 'string' || !['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status))) {
      return res.status(400).json({ success: false, error: 'invalid payment status filter' });
    }
    const fromDate = from === undefined ? null : new Date(String(from));
    const toDate = to === undefined ? null : new Date(String(to));
    if ((fromDate && !Number.isFinite(fromDate.getTime())) || (toDate && !Number.isFinite(toDate.getTime())) || (fromDate && toDate && fromDate > toDate)) {
      return res.status(400).json({ success: false, error: 'from/to must be valid dates and from must not be after to' });
    }
    const filters = [
      eq(paymentTransactions.userId, userId),
      eq(paymentTransactions.provider, 'wallet'),
      eq(paymentTransactions.type, 'wallet_transfer'),
      ...(status ? [eq(paymentTransactions.status, status)] : []),
      ...(fromDate ? [gte(paymentTransactions.createdAt, fromDate)] : []),
      ...(toDate ? [lte(paymentTransactions.createdAt, toDate)] : []),
    ];
    const [history, [total]] = await Promise.all([
      db.select().from(paymentTransactions).where(and(...filters)).orderBy(desc(paymentTransactions.createdAt)).limit(pageSize).offset(offset),
      db.select({ value: count() }).from(paymentTransactions).where(and(...filters)),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        history,
        total: total.value,
        skip: offset,
        limit: pageSize,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /payments/:paymentId/receipt - Get payment receipt
 * Downloads or retrieves receipt for a completed payment
 */
router.get('/payments/:paymentId/receipt', isAuthenticated, paymentLimiter, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const payment = await getPaymentByOwner(paymentId, userId);
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });
    if (payment.status !== 'completed') return res.status(409).json({ success: false, error: 'A receipt is available only after payment completion' });
    return res.status(200).json({
      success: true,
      data: { receiptNumber: payment.reference, generatedAt: new Date().toISOString(), payment },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// OPERATIONS (2 endpoints)
// ============================================================================

/**
 * POST /payments/estimate - Estimate payment fees
 * Calculates estimated fees for a payment
 * 
 * Body:
 *   - amount: string
 *   - recipient: string
 *   - currency?: string
 */
router.post('/payments/estimate', isAuthenticated, paymentLimiter, async (req: Request, res: Response) => {
  try {
    const amount = parsePositiveAmount(req.body.amount);
    const { recipient, currency = 'CELO' } = req.body;
    if (!amount || typeof recipient !== 'string' || !recipient.trim()) {
      return res.status(400).json({ success: false, error: 'positive amount and recipient required' });
    }
    const feeBps = Number(process.env.PAYMENT_FEE_BPS);
    const flatFee = process.env.PAYMENT_FEE_FLAT ?? '0';
    const validFlatFee = parsePositiveAmount(flatFee) ?? (flatFee === '0' ? '0' : null);
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000 || validFlatFee === null) {
      return res.status(503).json({ success: false, error: 'Payment fee policy is not configured; no estimate is available' });
    }
    const normalizedFlat = parsePositiveAmount(validFlatFee) ?? '0';
    const scale = Math.max(amount.split('.')[1]?.length ?? 0, normalizedFlat.split('.')[1]?.length ?? 0);
    const amountUnits = toUnits(amount, scale);
    const flatUnits = toUnits(normalizedFlat, scale);
    const percentageUnits = (amountUnits * BigInt(feeBps) + 9_999n) / 10_000n;
    const fee = fromUnits(percentageUnits + flatUnits, scale);
    const total = fromUnits(amountUnits + percentageUnits + flatUnits, scale);
    return res.status(200).json({
      success: true,
      data: {
        amount,
        recipient: recipient.trim(),
        currency: typeof currency === 'string' ? currency.toUpperCase() : 'CELO',
        estimatedFee: fee,
        total,
        feePolicy: { basisPoints: feeBps, flatFee: normalizedFlat },
        note: 'Fee estimate uses configured policy only and excludes network gas fees.',
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /payments/:paymentId/retry - Retry failed payment
 * Retries a previously failed payment attempt
 */
router.post('/payments/:paymentId/retry', isAuthenticated, paymentLimiter, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const payment = await getPaymentByOwner(paymentId, userId);
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });
    if (payment.status !== 'failed') return res.status(409).json({ success: false, error: `Only failed payments can be retried; current status is ${payment.status}` });
    return res.status(409).json({
      success: false,
      code: 'WALLET_EXECUTOR_UNAVAILABLE',
      error: 'Retry cannot be safely dispatched because this API has no wallet signer/execution adapter. No payment state was changed.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;

