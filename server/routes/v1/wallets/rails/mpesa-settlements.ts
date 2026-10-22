import express from 'express';
import type { Request, Response } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../../../db';
import { paymentTransactions, users } from '@shared/schema';
import { deposits } from '@shared/transactionFlowSchema';
import { authenticate } from '../../../../auth';

const router = express.Router();

router.get('/settlements/pending', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });

  try {
    const [user] = await db
      .select({ roles: users.roles, isSuperUser: users.isSuperUser })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const roles = String(user?.roles || '').split(',').map((role) => role.trim().toLowerCase());
    if (!user || (!user.isSuperUser && !roles.some((role) => ['admin', 'super_admin'].includes(role)))) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Administrator access is required' });
    }

    const requestedLimit = Number(req.query.limit ?? 50);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
      return res.status(400).json({ code: 'INVALID_LIMIT', message: 'limit must be an integer between 1 and 100' });
    }

    const [paymentRows, depositRows] = await Promise.all([
      db
        .select({
          id: paymentTransactions.id,
          userId: paymentTransactions.userId,
          reference: paymentTransactions.reference,
          amount: paymentTransactions.amount,
          currency: paymentTransactions.currency,
          createdAt: paymentTransactions.createdAt,
          purpose: sql<string | null>`${paymentTransactions.metadata}->>'purpose'`,
          receipt: sql<string | null>`COALESCE(
            ${paymentTransactions.metadata}->>'mpesaReceipt',
            ${paymentTransactions.metadata}->>'mpesaReceiptNumber'
          )`,
          reviewReasons: sql<string[] | null>`${paymentTransactions.metadata}->'settlementReviewReasons'`,
          source: sql<string>`'payment_transaction'`,
        })
        .from(paymentTransactions)
        .where(and(
          eq(paymentTransactions.provider, 'mpesa'),
          eq(paymentTransactions.type, 'deposit'),
          eq(paymentTransactions.status, 'completed'),
          sql`${paymentTransactions.metadata}->>'settlementStatus' = 'pending_review'`,
        ))
        .orderBy(desc(paymentTransactions.createdAt))
        .limit(requestedLimit),
      db
        .select({
          id: deposits.id,
          userId: deposits.userId,
          reference: deposits.externalReference,
          amount: deposits.amount,
          currency: deposits.currency,
          createdAt: deposits.createdAt,
          purpose: sql<string | null>`NULL`,
          receipt: sql<string | null>`${deposits.metadata}::jsonb->>'mpesaReceiptNumber'`,
          reviewReasons: sql<string[] | null>`${deposits.metadata}::jsonb->'settlementReviewReasons'`,
          source: sql<string>`'deposit'`,
        })
        .from(deposits)
        .where(and(
          eq(deposits.status, 'completed'),
          sql`LOWER(${deposits.source}) LIKE '%mpesa%'`,
          sql`${deposits.metadata}::jsonb->>'settlementStatus' = 'pending_review'`,
        ))
        .orderBy(desc(deposits.createdAt))
        .limit(requestedLimit),
    ]);

    const settlements = [...paymentRows, ...depositRows]
      .sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0))
      .slice(0, requestedLimit);
    return res.json({ success: true, settlements });
  } catch (error) {
    console.error('Failed to fetch pending M-Pesa settlements:', error);
    return res.status(500).json({ code: 'SETTLEMENT_QUEUE_FAILED', message: 'Failed to fetch pending settlements' });
  }
});

router.get('/settlements/metrics', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });

  try {
    const [user] = await db
      .select({ roles: users.roles, isSuperUser: users.isSuperUser })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const roles = String(user?.roles || '').split(',').map((role) => role.trim().toLowerCase());
    if (!user || (!user.isSuperUser && !roles.some((role) => ['admin', 'super_admin'].includes(role)))) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Administrator access is required' });
    }

    const [paymentStats, depositStats] = await Promise.all([
      db
        .select({
          pendingCount: sql<number>`count(*) FILTER (WHERE ${paymentTransactions.metadata}->>'settlementStatus' = 'pending_review')`,
          oldestPendingAt: sql<Date | null>`min(${paymentTransactions.createdAt}) FILTER (WHERE ${paymentTransactions.metadata}->>'settlementStatus' = 'pending_review')`,
          autoApproved24h: sql<number>`count(*) FILTER (
            WHERE ${paymentTransactions.metadata}->>'settlementStatus' = 'auto_approved'
              AND ${paymentTransactions.createdAt} >= now() - interval '24 hours'
          )`,
          pendingReview24h: sql<number>`count(*) FILTER (
            WHERE ${paymentTransactions.metadata}->>'settlementStatus' = 'pending_review'
              AND ${paymentTransactions.createdAt} >= now() - interval '24 hours'
          )`,
        })
        .from(paymentTransactions)
        .where(and(
          eq(paymentTransactions.provider, 'mpesa'),
          eq(paymentTransactions.type, 'deposit'),
          eq(paymentTransactions.status, 'completed'),
        )),
      db
        .select({
          pendingCount: sql<number>`count(*) FILTER (WHERE ${deposits.metadata}::jsonb->>'settlementStatus' = 'pending_review')`,
          oldestPendingAt: sql<Date | null>`min(${deposits.createdAt}) FILTER (WHERE ${deposits.metadata}::jsonb->>'settlementStatus' = 'pending_review')`,
          autoApproved24h: sql<number>`count(*) FILTER (
            WHERE ${deposits.metadata}::jsonb->>'settlementStatus' = 'auto_approved'
              AND ${deposits.createdAt} >= now() - interval '24 hours'
          )`,
          pendingReview24h: sql<number>`count(*) FILTER (
            WHERE ${deposits.metadata}::jsonb->>'settlementStatus' = 'pending_review'
              AND ${deposits.createdAt} >= now() - interval '24 hours'
          )`,
        })
        .from(deposits)
        .where(and(
          eq(deposits.status, 'completed'),
          sql`LOWER(${deposits.source}) LIKE '%mpesa%'`,
        )),
    ]);

    const autoApproved24h = Number(paymentStats[0]?.autoApproved24h || 0) +
      Number(depositStats[0]?.autoApproved24h || 0);
    const pendingReview24h = Number(paymentStats[0]?.pendingReview24h || 0) +
      Number(depositStats[0]?.pendingReview24h || 0);
    const oldestTimes = [paymentStats[0]?.oldestPendingAt, depositStats[0]?.oldestPendingAt]
      .filter((value): value is Date => value instanceof Date)
      .map((value) => value.getTime());
    const oldestPendingAt = oldestTimes.length
      ? new Date(Math.min(...oldestTimes)).toISOString()
      : null;
    const reviewedPayments24h = autoApproved24h + pendingReview24h;

    return res.json({
      success: true,
      metrics: {
        pendingCount: Number(paymentStats[0]?.pendingCount || 0) + Number(depositStats[0]?.pendingCount || 0),
        oldestPendingAt,
        oldestPendingAgeSeconds: oldestPendingAt
          ? Math.max(0, Math.floor((Date.now() - new Date(oldestPendingAt).getTime()) / 1000))
          : null,
        autoApproved24h,
        pendingReview24h,
        autoApprovalRatePercent: reviewedPayments24h
          ? Math.round((autoApproved24h / reviewedPayments24h) * 10000) / 100
          : null,
      },
    });
  } catch (error) {
    console.error('Failed to fetch M-Pesa settlement metrics:', error);
    return res.status(500).json({ code: 'SETTLEMENT_METRICS_FAILED', message: 'Failed to fetch settlement metrics' });
  }
});

export default router;
