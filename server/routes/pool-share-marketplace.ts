/**
 * Pool Share Marketplace (Production)
 *
 * Secondary market for investment-pool shares with:
 * • Authentication + DAO membership
 * • Seller available-share checks (invested − withdrawn − already listed)
 * • Shares escrowed on list (status locked inventory)
 * • Atomic buy with FOR UPDATE (no oversell)
 * • Trade + listing update in one transaction
 * • Cancel listing releases escrow
 * • Atomic USDC wallet-ledger settlement
 * • Share-position transfer recorded in the pool investment ledger
 */

import { Router, type Response } from 'express';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { rateLimitPerUser } from '../middleware/rateLimit';
import {
  investmentPools,
  daoMemberships,
  poolInvestments,
  poolWithdrawals,
} from '../../shared/schema';
import {
  poolShareListings,
  poolShareTrades,
} from '../../shared/pool-marketplace-schema';
import { accounts, accountTransactions } from '../../shared/accountSchema';

const router = Router();

router.use(authenticateToken as any);

// ─────────────────────────────────────────────────────────────
// Types / helpers
// ─────────────────────────────────────────────────────────────

function userIdOf(req: any): string | null {
  return req.user?.id ?? req.user?.claims?.id ?? null;
}

function positiveNumber(n: unknown, field: string): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`INVALID_${field}`);
  }
  return v;
}

function idempotencyKeyOf(req: any): string | null {
  const value = req.get?.('Idempotency-Key') ?? req.headers?.['idempotency-key'];
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key.length >= 8 && key.length <= 200 ? key : null;
}

/**
 * Available shares = completed investments − completed withdrawals − active listings.
 * "Active listings" are escrowed and cannot be double-listed.
 */
async function getAvailableSharesToList(
  poolId: string,
  userId: string,
  tx: typeof db | any = db
): Promise<number> {
  const inv = await tx
    .select({ shares: poolInvestments.sharesMinted })
    .from(poolInvestments)
    .where(
      and(
        eq(poolInvestments.poolId, poolId),
        eq(poolInvestments.userId, userId),
        eq(poolInvestments.status, 'completed')
      )
    );

  const wd = await tx
    .select({ shares: poolWithdrawals.sharesBurned })
    .from(poolWithdrawals)
    .where(
      and(
        eq(poolWithdrawals.poolId, poolId),
        eq(poolWithdrawals.userId, userId),
        eq(poolWithdrawals.status, 'completed')
      )
    );

  const listed = await tx
    .select({ shares: poolShareListings.sharesRemaining })
    .from(poolShareListings)
    .where(
      and(
        eq(poolShareListings.poolId, poolId),
        eq(poolShareListings.sellerId, userId),
        eq(poolShareListings.status, 'active')
      )
    );

  const invested = inv.reduce((s: number, r: any) => s + Number(r.shares), 0);
  const withdrawn = wd.reduce((s: number, r: any) => s + Number(r.shares), 0);
  const escrowed = listed.reduce(
    (s: number, r: any) => s + Number(r.shares ?? 0),
    0
  );

  return Math.max(0, invested - withdrawn - escrowed);
}

async function assertPoolMember(
  poolId: string,
  userId: string,
  tx: typeof db | any = db
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const [pool] = await tx
    .select()
    .from(investmentPools)
    .where(eq(investmentPools.id, poolId))
    .limit(1);

  if (!pool) return { ok: false, status: 404, error: 'Pool not found' };
  if (!pool.daoId) return { ok: true };

  const [m] = await tx
    .select()
    .from(daoMemberships)
    .where(
      and(
        eq(daoMemberships.daoId, pool.daoId),
        eq(daoMemberships.userId, userId)
      )
    )
    .limit(1);

  if (!m) {
    return { ok: false, status: 403, error: 'Not a member of this pool\'s DAO' };
  }
  return { ok: true };
}

/**
 * Transfer USDC between the buyer and seller wallet accounts in the same
 * transaction as the marketplace trade and ownership updates.
 */
async function settleMarketplacePayment(input: {
  buyerId: string;
  sellerId: string;
  poolId: string;
  totalAmount: number;
  tradeId?: string;
  tx: any;
}): Promise<void> {
  const { buyerId, sellerId, totalAmount, tradeId, tx } = input;
  const settledAmount = Number(totalAmount.toFixed(2));
  if (!Number.isFinite(settledAmount) || settledAmount <= 0 || !tradeId) {
    throw new Error('INVALID_PAYMENT_AMOUNT');
  }

  const wallets = await tx
    .select()
    .from(accounts)
    .where(
      and(
        inArray(accounts.userId, [buyerId, sellerId]),
        eq(accounts.accountType, 'wallet'),
        eq(accounts.currency, 'USDC'),
        eq(accounts.status, 'active')
      )
    )
    .orderBy(asc(accounts.id))
    .for('update');
  const buyerAccount = wallets
    .filter((account: any) => account.userId === buyerId)
    .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const sellerAccount = wallets
    .filter((account: any) => account.userId === sellerId)
    .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!buyerAccount || !sellerAccount) {
    throw new Error('PAYMENT_RAIL_NOT_CONFIGURED');
  }
  if (buyerAccount.isBlocked || sellerAccount.isBlocked) {
    throw new Error('PAYMENT_ACCOUNT_BLOCKED');
  }

  const amount = settledAmount.toFixed(2);
  const now = new Date();
  const debit = await tx.execute(sql`
    UPDATE accounts
    SET balance = CAST(balance AS NUMERIC) - CAST(${amount} AS NUMERIC),
        total_withdrawn = CAST(total_withdrawn AS NUMERIC) + CAST(${amount} AS NUMERIC),
        total_transactions = total_transactions + 1,
        last_activity_at = ${now},
        updated_at = ${now}
    WHERE id = ${buyerAccount.id}
      AND status = 'active'
      AND is_blocked IS NOT TRUE
      AND CAST(balance AS NUMERIC) >= CAST(${amount} AS NUMERIC)
    RETURNING balance,
      CAST(balance AS NUMERIC) + CAST(${amount} AS NUMERIC) AS balance_before
  `);
  if (!debit.rows.length) {
    throw new Error('INSUFFICIENT_FUNDS');
  }

  const credit = await tx.execute(sql`
    UPDATE accounts
    SET balance = CAST(balance AS NUMERIC) + CAST(${amount} AS NUMERIC),
        total_deposited = CAST(total_deposited AS NUMERIC) + CAST(${amount} AS NUMERIC),
        total_transactions = total_transactions + 1,
        last_activity_at = ${now},
        updated_at = ${now}
    WHERE id = ${sellerAccount.id}
      AND status = 'active'
      AND is_blocked IS NOT TRUE
    RETURNING balance,
      CAST(balance AS NUMERIC) - CAST(${amount} AS NUMERIC) AS balance_before
  `);
  if (!credit.rows.length) {
    throw new Error('PAYMENT_CREDIT_FAILED');
  }

  const reference = `POOL-MARKET-${tradeId}`;
  await tx.insert(accountTransactions).values([
    {
      accountId: buyerAccount.id,
      transactionType: 'transfer',
      amount,
      currency: 'USDC',
      description: 'Pool share marketplace purchase',
      reference: `${reference}-BUY`,
      fromAccountId: buyerAccount.id,
      toAccountId: sellerAccount.id,
      toUserId: sellerId,
      status: 'completed',
      balanceBefore: String(debit.rows[0].balance_before),
      balanceAfter: String(debit.rows[0].balance),
      metadata: JSON.stringify({ tradeId, poolId: input.poolId, side: 'buyer' }),
      createdAt: now,
      updatedAt: now,
    },
    {
      accountId: sellerAccount.id,
      transactionType: 'transfer',
      amount,
      currency: 'USDC',
      description: 'Pool share marketplace sale',
      reference: `${reference}-SELL`,
      fromAccountId: buyerAccount.id,
      toAccountId: sellerAccount.id,
      fromUserId: buyerId,
      status: 'completed',
      balanceBefore: String(credit.rows[0].balance_before),
      balanceAfter: String(credit.rows[0].balance),
      metadata: JSON.stringify({ tradeId, poolId: input.poolId, side: 'seller' }),
      createdAt: now,
      updatedAt: now,
    },
  ]);

  logger.info('Marketplace payment settled from USDC wallet ledger', {
    buyerId,
    sellerId,
    poolId: input.poolId,
    tradeId,
    totalAmount: settledAmount,
  });
}

/**
 * Ownership transfer hook — credit buyer / debit seller pool share position.
 * Prefer dedicated share_balances table; until then, record synthetic
 * investment + withdrawal legs so primary available-share math stays consistent.
 */
async function transferShareOwnership(input: {
  poolId: string;
  sellerId: string;
  buyerId: string;
  shares: number;
  pricePerShare: number;
  tx: any;
}): Promise<void> {
  const { poolId, sellerId, buyerId, shares, pricePerShare, tx } = input;
  const notional = shares * pricePerShare;

  // Seller: burn shares from their economic position (withdrawal-equivalent)
  await tx.insert(poolWithdrawals).values({
    poolId,
    userId: sellerId,
    sharesBurned: shares.toFixed(8),
    withdrawalValueUsd: notional.toFixed(2),
    sharePriceAtWithdrawal: pricePerShare.toFixed(8),
    feeCharged: '0',
    netAmount: notional.toFixed(2),
    status: 'completed',
  });

  // Buyer: mint position (investment-equivalent at trade price)
  await tx.insert(poolInvestments).values({
    poolId,
    userId: buyerId,
    investmentAmountUsd: notional.toFixed(2),
    sharesMinted: shares.toFixed(8),
    sharePriceAtInvestment: pricePerShare.toFixed(8),
    paymentToken: 'MARKETPLACE',
    status: 'completed',
  });

  // Note: pool TVL/supply unchanged — pure transfer between holders.
}

// ─────────────────────────────────────────────────────────────
// List shares for sale (escrow)
// ─────────────────────────────────────────────────────────────

router.post(
  '/:poolId/list-shares',
  [rateLimitPerUser('pool-list-shares', 20, '10min')],
  async (req: any, res: Response) => {
    try {
      const userId = userIdOf(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { poolId } = req.params;
      let shares: number;
      let pricePerShare: number;
      try {
        shares = Number(positiveNumber(req.body.shares, 'shares').toFixed(8));
        pricePerShare = Number(positiveNumber(req.body.pricePerShare, 'pricePerShare').toFixed(8));
        if (shares <= 0 || pricePerShare <= 0) throw new Error('ROUNDS_TO_ZERO');
      } catch {
        return res.status(400).json({ error: 'shares and pricePerShare must be positive numbers' });
      }

      const member = await assertPoolMember(poolId, userId);
      if (!member.ok) {
        return res.status(member.status).json({ error: member.error });
      }

      const listing = await db.transaction(async (tx) => {
        const [pool] = await tx
          .select({ id: investmentPools.id })
          .from(investmentPools)
          .where(eq(investmentPools.id, poolId))
          .for('update')
          .limit(1);
        if (!pool) throw new Error('POOL_NOT_FOUND');

        const lockedMember = await assertPoolMember(poolId, userId, tx);
        if (!lockedMember.ok) throw new Error(`MEMBER:${lockedMember.status}`);

        const available = await getAvailableSharesToList(poolId, userId, tx);
        if (shares > available + 1e-8) {
          throw new Error(`INSUFFICIENT_SHARES:${available}`);
        }

        const [row] = await tx
          .insert(poolShareListings)
          .values({
            poolId,
            sellerId: userId,
            shares: shares.toFixed(8),
            sharesRemaining: shares.toFixed(8),
            pricePerShare: pricePerShare.toFixed(8),
            status: 'active',
          })
          .returning();

        return row;
      });

      logger.info('Shares listed', { userId, poolId, shares, pricePerShare });
      res.status(201).json({ listing });
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.startsWith('INSUFFICIENT_SHARES:')) {
        return res.status(400).json({
          error: `Insufficient unencumbered shares. Available: ${msg.split(':')[1]}`,
        });
      }
      if (msg === 'POOL_NOT_FOUND') return res.status(404).json({ error: 'Pool not found' });
      if (msg.startsWith('MEMBER:')) {
        return res.status(Number(msg.split(':')[1]) === 404 ? 404 : 403).json({
          error: Number(msg.split(':')[1]) === 404 ? 'Pool not found' : 'Not a member of this pool\'s DAO',
        });
      }
      logger.error('Error listing shares', { error });
      res.status(500).json({ error: 'Failed to list shares' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Cancel listing (release escrow)
// ─────────────────────────────────────────────────────────────

router.post(
  '/listings/:listingId/cancel',
  [rateLimitPerUser('pool-cancel-listing', 30, '10min')],
  async (req: any, res: Response) => {
    try {
      const userId = userIdOf(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { listingId } = req.params;

      const updated = await db.transaction(async (tx) => {
        const [preliminary] = await tx
          .select({ poolId: poolShareListings.poolId })
          .from(poolShareListings)
          .where(eq(poolShareListings.id, listingId))
          .limit(1);
        if (!preliminary?.poolId) throw new Error('NOT_FOUND');

        const [pool] = await tx
          .select({ id: investmentPools.id })
          .from(investmentPools)
          .where(eq(investmentPools.id, preliminary.poolId))
          .for('update')
          .limit(1);
        if (!pool) throw new Error('NOT_FOUND');

        const member = await assertPoolMember(preliminary.poolId, userId, tx);
        if (!member.ok) throw new Error(`MEMBER:${member.status}`);

        const [listing] = await tx
          .select()
          .from(poolShareListings)
          .where(eq(poolShareListings.id, listingId))
          .for('update')
          .limit(1);
        if (!listing) throw new Error('NOT_FOUND');
        if (listing.sellerId !== userId) {
          throw new Error('FORBIDDEN');
        }
        if (listing.status !== 'active') {
          throw new Error('NOT_ACTIVE');
        }

        const [row] = await tx
          .update(poolShareListings)
          .set({
            status: 'cancelled',
            sharesRemaining: '0',
          })
          .where(eq(poolShareListings.id, listingId))
          .returning();

        return row;
      });

      res.json({ listing: updated, message: 'Listing cancelled; shares released' });
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg === 'NOT_FOUND') return res.status(404).json({ error: 'Listing not found' });
      if (msg === 'FORBIDDEN') return res.status(403).json({ error: 'Not your listing' });
      if (msg === 'NOT_ACTIVE') return res.status(400).json({ error: 'Listing not active' });
      if (msg.startsWith('MEMBER:')) {
        return res.status(Number(msg.split(':')[1]) === 404 ? 404 : 403).json({
          error: Number(msg.split(':')[1]) === 404 ? 'Pool not found' : 'Not a member of this pool\'s DAO',
        });
      }
      logger.error('Error cancelling listing', { error });
      res.status(500).json({ error: 'Failed to cancel listing' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Buy (atomic)
// ─────────────────────────────────────────────────────────────

router.post(
  '/listings/:listingId/buy',
  [rateLimitPerUser('pool-buy-shares', 30, '10min')],
  async (req: any, res: Response) => {
    try {
      const buyerId = userIdOf(req);
      if (!buyerId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      let sharesRequested: number;
      try {
        sharesRequested = Number(positiveNumber(req.body.shares, 'shares').toFixed(8));
        if (sharesRequested <= 0) throw new Error('ROUNDS_TO_ZERO');
      } catch {
        return res.status(400).json({ error: 'shares must be a positive number' });
      }

      const idempotencyKey = idempotencyKeyOf(req);
      if (!idempotencyKey) {
        return res.status(400).json({
          error: 'A valid Idempotency-Key header (8-200 characters) is required',
        });
      }

      const outcome = await db.transaction(async (tx) => {
        const [priorTrade] = await tx
          .select()
          .from(poolShareTrades)
          .where(eq(poolShareTrades.idempotencyKey, idempotencyKey))
          .limit(1);
        if (priorTrade) {
          const member = await assertPoolMember(priorTrade.poolId!, buyerId, tx);
          if (!member.ok) throw new Error(`MEMBER:${member.status}`);
          const sameRequest =
            priorTrade.buyerId === buyerId &&
            priorTrade.listingId === req.params.listingId &&
            Math.abs(Number(priorTrade.shares) - sharesRequested) < 1e-8;
          if (!sameRequest) throw new Error('IDEMPOTENCY_CONFLICT');
          const [currentListing] = await tx
            .select({ sharesRemaining: poolShareListings.sharesRemaining })
            .from(poolShareListings)
            .where(eq(poolShareListings.id, priorTrade.listingId!))
            .limit(1);
          return {
            trade: priorTrade,
            totalCost: Number(priorTrade.totalAmount),
            remaining: Number(currentListing?.sharesRemaining ?? 0),
            replayed: true,
          };
        }

        const [preliminary] = await tx
          .select({ poolId: poolShareListings.poolId })
          .from(poolShareListings)
          .where(eq(poolShareListings.id, req.params.listingId))
          .limit(1);
        if (!preliminary?.poolId) throw new Error('NOT_FOUND');

        const [pool] = await tx
          .select({ id: investmentPools.id })
          .from(investmentPools)
          .where(eq(investmentPools.id, preliminary.poolId))
          .for('update')
          .limit(1);
        if (!pool) throw new Error('NOT_FOUND');

        const member = await assertPoolMember(preliminary.poolId, buyerId, tx);
        if (!member.ok) throw new Error(`MEMBER:${member.status}`);

        const [concurrentPriorTrade] = await tx
          .select()
          .from(poolShareTrades)
          .where(eq(poolShareTrades.idempotencyKey, idempotencyKey))
          .limit(1);
        if (concurrentPriorTrade) {
          const sameRequest =
            concurrentPriorTrade.buyerId === buyerId &&
            concurrentPriorTrade.listingId === req.params.listingId &&
            Math.abs(Number(concurrentPriorTrade.shares) - sharesRequested) < 1e-8;
          if (!sameRequest) throw new Error('IDEMPOTENCY_CONFLICT');
          const [currentListing] = await tx
            .select({ sharesRemaining: poolShareListings.sharesRemaining })
            .from(poolShareListings)
            .where(eq(poolShareListings.id, concurrentPriorTrade.listingId!))
            .limit(1);
          return {
            trade: concurrentPriorTrade,
            totalCost: Number(concurrentPriorTrade.totalAmount),
            remaining: Number(currentListing?.sharesRemaining ?? 0),
            replayed: true,
          };
        }

        const [listing] = await tx
          .select()
          .from(poolShareListings)
          .where(eq(poolShareListings.id, req.params.listingId))
          .for('update')
          .limit(1);
        if (!listing) throw new Error('NOT_FOUND');

        const sellerId = listing.sellerId!;
        const poolId = listing.poolId!;
        const pricePerShare = Number(listing.pricePerShare);
        const remaining = Number(listing.sharesRemaining ?? listing.shares);

        const sellerMember = await assertPoolMember(poolId, sellerId, tx);
        if (!sellerMember.ok) throw new Error('SELLER_NOT_MEMBER');
        if (listing.status !== 'active') throw new Error('NOT_ACTIVE');
        if (sellerId === buyerId) throw new Error('SELF_TRADE');
        if (sharesRequested > remaining + 1e-8) {
          throw new Error(`INSUFFICIENT_LISTING:${remaining}`);
        }

        const totalCost = Math.round(sharesRequested * pricePerShare * 100) / 100;
        if (!Number.isFinite(totalCost) || totalCost <= 0) {
          throw new Error('INVALID_PAYMENT_AMOUNT');
        }

        const [trade] = await tx
          .insert(poolShareTrades)
          .values({
            listingId: req.params.listingId,
            buyerId,
            sellerId,
            poolId,
            shares: sharesRequested.toFixed(8),
            pricePerShare: pricePerShare.toFixed(8),
            totalAmount: totalCost.toFixed(2),
            status: 'pending',
            idempotencyKey,
          })
          .returning();

        await settleMarketplacePayment({
          buyerId,
          sellerId,
          poolId,
          totalAmount: totalCost,
          tradeId: trade.id,
          tx,
        });

        await transferShareOwnership({
          poolId,
          sellerId,
          buyerId,
          shares: sharesRequested,
          pricePerShare,
          tx,
        });

        const newRemaining = Math.max(0, Number((remaining - sharesRequested).toFixed(8)));
        const newStatus = newRemaining <= 0 ? 'sold' : 'active';

        await tx
          .update(poolShareListings)
          .set({
            sharesRemaining: newRemaining.toFixed(8),
            status: newStatus,
          })
          .where(eq(poolShareListings.id, req.params.listingId));

        const [completedTrade] = await tx
          .update(poolShareTrades)
          .set({ status: 'completed' })
          .where(eq(poolShareTrades.id, trade.id))
          .returning();

        return { trade: completedTrade, totalCost, remaining: newRemaining, replayed: false };
      });

      logger.info('Marketplace trade executed', {
        buyerId,
        listingId: req.params.listingId,
        shares: sharesRequested,
      });

      res.status(outcome.replayed ? 200 : 201).json(outcome);
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (
        error?.code === '23505' &&
        error?.constraint === 'pool_share_trades_idempotency_uq'
      ) {
        return res.status(409).json({
          error: 'This Idempotency-Key is already being used; retry with the same request',
        });
      }
      if (msg === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Listing not found' });
      }
      if (msg === 'NOT_ACTIVE') {
        return res.status(400).json({ error: 'Listing not active' });
      }
      if (msg === 'SELF_TRADE') {
        return res.status(400).json({ error: 'Cannot buy your own listing' });
      }
      if (msg.startsWith('INSUFFICIENT_LISTING:')) {
        return res.status(400).json({
          error: `Only ${msg.split(':')[1]} shares remain on this listing`,
        });
      }
      if (msg.startsWith('MEMBER:')) {
        return res.status(Number(msg.split(':')[1]) === 404 ? 404 : 403).json({
          error: Number(msg.split(':')[1]) === 404 ? 'Pool not found' : 'Not a member of this pool\'s DAO',
        });
      }
      if (msg === 'IDEMPOTENCY_CONFLICT') {
        return res.status(409).json({ error: 'Idempotency-Key was already used for a different request' });
      }
      if (msg === 'SELLER_NOT_MEMBER') {
        return res.status(409).json({ error: 'Seller is no longer a member of this pool\'s DAO' });
      }
      if (msg === 'INSUFFICIENT_FUNDS') {
        return res.status(402).json({ error: 'Insufficient USDC wallet balance' });
      }
      if (msg === 'PAYMENT_ACCOUNT_BLOCKED') {
        return res.status(403).json({ error: 'A settlement wallet is blocked' });
      }
      if (msg === 'PAYMENT_RAIL_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'Payment settlement not configured' });
      }
      logger.error('Error buying shares', { error });
      res.status(500).json({ error: 'Failed to buy shares' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Marketplace browse
// ─────────────────────────────────────────────────────────────

router.get('/:poolId/marketplace', async (req: any, res: Response) => {
  try {
    const userId = userIdOf(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { poolId } = req.params;
    const member = await assertPoolMember(poolId, userId);
    if (!member.ok) {
      return res.status(member.status).json({ error: member.error });
    }

    const listings = await db
      .select()
      .from(poolShareListings)
      .where(
        and(
          eq(poolShareListings.poolId, poolId),
          eq(poolShareListings.status, 'active')
        )
      )
      .orderBy(desc(poolShareListings.createdAt));

    res.json({ listings });
  } catch (error) {
    logger.error('Error fetching marketplace', { error });
    res.status(500).json({ error: 'Failed to fetch marketplace' });
  }
});

/** Seller’s available shares (helper for UI) */
router.get('/:poolId/my-available-shares', async (req: any, res: Response) => {
  try {
    const userId = userIdOf(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const member = await assertPoolMember(req.params.poolId, userId);
    if (!member.ok) {
      return res.status(member.status).json({ error: member.error });
    }
    const available = await getAvailableSharesToList(req.params.poolId, userId);
    res.json({ availableShares: available });
  } catch (error) {
    logger.error('Error computing available shares', { error });
    res.status(500).json({ error: 'Failed to compute available shares' });
  }
});

export default router;