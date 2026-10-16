/**
 * Investment Pools Router (Production)
 *
 * Fixes vs prior version
 * ─────────────────────────────────────────────────────────────
 * • Static routes registered before /:id (templates, prices)
 * • Invest/withdraw in a DB transaction with row lock (FOR UPDATE)
 * • Membership (or admin) on all pool-scoped mutations + sensitive reads
 * • GET / filtered to pools the user can access
 * • Optional Idempotency-Key for invest/withdraw
 * • Display prices vs valuation-aware NAV snapshot (explicit fields)
 * • Safer numeric handling + input caps
 */

import { Router, type Response } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { jobQueueService } from '../services/jobQueueService';
import {
  investmentPools,
  poolAssets,
  poolInvestments,
  poolWithdrawals,
  poolPerformance,
  portfolioTemplates,
  templateAssetAllocations,
  rebalancingSettings,
  daoMemberships,
} from '../../shared/schema';
import { priceOracle } from '../services/priceOracle';
import { performanceTrackingService } from '../services/performanceTrackingService';
import { rebalancingService } from '../services/rebalancingService';
import { triggerManualSnapshot } from '../jobs/investmentPoolsAutomation';
import { investmentPoolPricingService } from '../services/investmentPoolPricingService';
import { investmentPoolService } from '../services/investmentPoolService';

const router = Router();

router.use(authenticateToken as any);

const MAX_DAYS = 365;
const MAX_INVEST_USD = 10_000_000;

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function userIdOf(req: any): string | null {
  return req.user?.id ?? req.user?.claims?.id ?? null;
}

async function verifyPoolDaoMembership(
  poolId: string,
  userId: string
): Promise<{ verified: boolean; pool?: typeof investmentPools.$inferSelect; error?: string }> {
  try {
    const [pool] = await db
      .select()
      .from(investmentPools)
      .where(eq(investmentPools.id, poolId))
      .limit(1);

    if (!pool) return { verified: false, error: 'Pool not found' };

    // No DAO → treat as personal/admin pool; still require auth (caller checks userId)
    if (!pool.daoId) return { verified: true, pool };

    const [membership] = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, pool.daoId),
          eq(daoMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      return {
        verified: false,
        error: 'User is not a member of the DAO that owns this pool',
      };
    }

    return { verified: true, pool };
  } catch (error) {
    logger.error('verifyPoolDaoMembership failed', { error });
    return { verified: false, error: 'Failed to verify membership' };
  }
}

/** Require membership; 403/404 as appropriate */
async function requirePoolAccess(
  req: any,
  res: Response,
  poolId: string
): Promise<typeof investmentPools.$inferSelect | null> {
  const userId = userIdOf(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const check = await verifyPoolDaoMembership(poolId, userId);
  if (!check.verified || !check.pool) {
    res.status(check.error === 'Pool not found' ? 404 : 403).json({
      error: check.error || 'Unauthorized',
    });
    return null;
  }
  return check.pool;
}

function parseDays(raw: unknown, fallback = 30): number {
  const n = parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, MAX_DAYS);
}

/**
 * Idempotency: if header present and a completed investment with same key exists, return it.
 * Requires optional column pool_investments.idempotency_key (unique per pool+user).
 */
async function findIdempotentInvestment(
  poolId: string,
  userId: string,
  key: string | undefined
) {
  if (!key) return null;
  try {
    const rows = await db.execute(sql`
      SELECT * FROM pool_investments
      WHERE pool_id = ${poolId}
        AND user_id = ${userId}
        AND idempotency_key = ${key}
        AND status = 'completed'
      LIMIT 1
    `);
    return (rows.rows?.[0] as any) ?? null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// STATIC ROUTES (must be before /:id)
// ═══════════════════════════════════════════════════════════════

/** GET /api/investment-pools/prices/current */
router.get('/prices/current', async (req, res) => {
  try {
    const { symbols = 'BTC,ETH,SOL,BNB,CELO,USDC' } = req.query;
    const symbolArray = String(symbols)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 50);

    // Display path — not for share minting
    const prices = await priceOracle.getPrices(symbolArray);
    const priceData: Record<string, unknown> = {};
    prices.forEach((data, symbol) => {
      priceData[symbol] = data;
    });

    res.json({ prices: priceData, priceType: 'display' });
  } catch (error) {
    logger.error('Error fetching prices', { error });
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

/** GET /api/investment-pools/templates */
router.get('/templates', async (_req, res) => {
  try {
    const templates = await db
      .select()
      .from(portfolioTemplates)
      .where(eq(portfolioTemplates.isActive, true));

    const ids = templates.map((t) => t.id);
    const allAlloc =
      ids.length === 0
        ? []
        : await db
            .select()
            .from(templateAssetAllocations)
            .where(inArray(templateAssetAllocations.templateId, ids));

    const byTemplate = new Map<string, typeof allAlloc>();
    for (const a of allAlloc) {
      const list = byTemplate.get(a.templateId) || [];
      list.push(a);
      byTemplate.set(a.templateId, list);
    }

    res.json({
      templates: templates.map((t) => ({
        ...t,
        allocations: byTemplate.get(t.id) || [],
      })),
    });
  } catch (error) {
    logger.error('Error fetching templates', { error });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/** GET /api/investment-pools — pools visible to this user */
router.get('/', async (req: any, res) => {
  try {
    const userId = userIdOf(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // DAOs the user belongs to
    const memberships = await db
      .select({ daoId: daoMemberships.daoId })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    const daoIds = memberships.map((m) => m.daoId);

    const pools = await db
      .select({
        id: investmentPools.id,
        daoId: investmentPools.daoId,
        name: investmentPools.name,
        symbol: investmentPools.symbol,
        description: investmentPools.description,
        totalValueLocked: investmentPools.totalValueLocked,
        shareTokenSupply: investmentPools.shareTokenSupply,
        sharePrice: investmentPools.sharePrice,
        performanceFee: investmentPools.performanceFee,
        minimumInvestment: investmentPools.minimumInvestment,
        isActive: investmentPools.isActive,
        createdAt: investmentPools.createdAt,
        createdBy: investmentPools.createdBy,
      })
      .from(investmentPools)
      .where(eq(investmentPools.isActive, true))
      .orderBy(desc(investmentPools.createdAt));

    const visible = pools.filter(
      (p) =>
        !p.daoId ||
        daoIds.includes(p.daoId) ||
        p.createdBy === userId
    );

    res.json({ pools: visible });
  } catch (error) {
    logger.error('Error fetching investment pools', { error });
    res.status(500).json({ error: 'Failed to fetch investment pools' });
  }
});

/** POST /api/investment-pools — create */
const createPoolHandler = async (req: any, res: any) => {
  try {
    const userId = userIdOf(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      name,
      symbol,
      description,
      templateId,
      minimumInvestment,
      performanceFee,
      autoRebalance,
      daoId,
    } = req.body;

    if (!name || !symbol) {
      return res.status(400).json({ error: 'Name and symbol are required' });
    }

    if (daoId) {
      const [membership] = await db
        .select()
        .from(daoMemberships)
        .where(
          and(
            eq(daoMemberships.daoId, daoId),
            eq(daoMemberships.userId, userId)
          )
        )
        .limit(1);
      if (!membership) {
        return res.status(403).json({ error: 'Not a member of target DAO' });
      }
    }

    const [pool] = await db
      .insert(investmentPools)
      .values({
        name: String(name).slice(0, 120),
        symbol: String(symbol).toUpperCase().slice(0, 32),
        description,
        daoId: daoId || null,
        minimumInvestment: minimumInvestment?.toString() || '10.00',
        performanceFee: performanceFee ?? 200,
        totalValueLocked: '0',
        shareTokenSupply: '0',
        sharePrice: '1',
        isActive: true,
        createdBy: userId,
      })
      .returning();

    if (templateId) {
      const allocations = await db
        .select()
        .from(templateAssetAllocations)
        .where(eq(templateAssetAllocations.templateId, templateId));

      for (const allocation of allocations) {
        await db.insert(poolAssets).values({
          poolId: pool.id,
          assetSymbol: allocation.assetSymbol,
          assetName: allocation.assetSymbol,
          targetAllocation: allocation.targetAllocation,
          isActive: true,
        });
      }
    }

    if (autoRebalance) {
      await db.insert(rebalancingSettings).values({
        poolId: pool.id,
        autoRebalanceEnabled: true,
        rebalanceFrequency: 'weekly',
        rebalanceThreshold: 500,
      });
    }

    logger.info('Pool created', { poolId: pool.id, userId });
    return res.status(201).json({
      pool,
      message: 'Investment pool created successfully',
    });
  } catch (error) {
    logger.error('Error creating pool', { error });
    return res.status(500).json({ error: 'Failed to create pool' });
  }
};

router.post(
  '/',
  rateLimitPerUser('pool-create', 5, '10min'),
  createPoolHandler
);

/**
 * @deprecated Use POST /api/investment-pools
 */
router.post('/create', async (req, res) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', '</api/investment-pools>; rel="successor-version"');
  res.setHeader(
    'Warning',
    '299 - "POST /api/investment-pools/create is deprecated. Use POST /api/investment-pools instead"'
  );
  return createPoolHandler(req, res);
});

// ═══════════════════════════════════════════════════════════════
// POOL-SCOPED ROUTES
// ═══════════════════════════════════════════════════════════════

router.get('/:id', async (req: any, res) => {
  try {
    const pool = await requirePoolAccess(req, res, req.params.id);
    if (!pool) return;

    const assets = await db
      .select()
      .from(poolAssets)
      .where(eq(poolAssets.poolId, pool.id));

    const assetSymbols = assets.map((a) => a.assetSymbol);
    const prices = assetSymbols.length
      ? await priceOracle.getPrices(assetSymbols)
      : new Map();

    // Optional valuation marks for allowlisted assets (NAV hint — not share price)
    const valuationHints: Record<string, number | null> = {};
    for (const sym of assetSymbols) {
      if (priceOracle.isValuationAllowlisted?.(sym)) {
        const v = await priceOracle.getValuationPrice(sym);
        valuationHints[sym] = v ? v.haircutPriceUsd ?? v.priceUsd : null;
      }
    }

    const assetsWithPrices = assets.map((asset) => {
      const priceData = prices.get(asset.assetSymbol);
      return {
        ...asset,
        currentPriceUsd: priceData?.priceUsd || 0,
        valuationPriceUsd: valuationHints[asset.assetSymbol] ?? null,
        priceChange24h: priceData?.priceChange24h || 0,
        marketCap: priceData?.marketCap || 0,
      };
    });

    const [investorCount] = await db
      .select({
        count: sql<number>`count(DISTINCT ${poolInvestments.userId})::int`,
      })
      .from(poolInvestments)
      .where(eq(poolInvestments.poolId, pool.id));

    res.json({
      pool,
      assets: assetsWithPrices,
      investorCount: investorCount?.count ?? 0,
      note: 'sharePrice is accounting TVL/supply; valuationPriceUsd is mark hint only',
    });
  } catch (error) {
    logger.error('Error fetching pool details', { error });
    res.status(500).json({ error: 'Failed to fetch pool details' });
  }
});

router.get('/:id/assets', async (req: any, res) => {
  try {
    const pool = await requirePoolAccess(req, res, req.params.id);
    if (!pool) return;
    const assets = await investmentPoolService.getPoolAssets(pool.id);
    res.json({ assets });
  } catch (error) {
    logger.error('Error fetching pool assets', { error });
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

router.get('/:id/composition', async (req: any, res) => {
  try {
    const pool = await requirePoolAccess(req, res, req.params.id);
    if (!pool) return;
    const composition = await investmentPoolService.getPortfolioComposition(
      pool.id
    );
    const validation = await investmentPoolService.validatePoolConfiguration(
      pool.id
    );
    res.json({ composition, validation });
  } catch (error) {
    logger.error('Error fetching composition', { error });
    res.status(500).json({ error: 'Failed to fetch composition' });
  }
});

router.post(
  '/:id/assets',
  [rateLimitPerUser('pool-add-asset', 10, '5min')],
  async (req: any, res: Response) => {
    try {
      const pool = await requirePoolAccess(req, res, req.params.id);
      if (!pool) return;
      const userId = userIdOf(req)!;

      const { assetSymbol, targetAllocation, tokenAddress, network } = req.body;
      if (!assetSymbol || targetAllocation === undefined) {
        return res.status(400).json({
          error: 'assetSymbol and targetAllocation are required',
        });
      }
      if (targetAllocation < 0 || targetAllocation > 10000) {
        return res.status(400).json({
          error:
            'targetAllocation must be between 0 and 10000 basis points (0-100%)',
        });
      }

      const result = await investmentPoolService.addAssetToPool(
        pool.id,
        String(assetSymbol).toUpperCase(),
        targetAllocation,
        userId,
        tokenAddress,
        network
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json({
        success: true,
        asset: result.asset,
        message: `Asset ${assetSymbol} added with ${(targetAllocation / 100).toFixed(2)}% allocation`,
      });
    } catch (error) {
      logger.error('Error adding asset', { error });
      res.status(500).json({ error: 'Failed to add asset' });
    }
  }
);

router.patch(
  '/:id/assets/:assetSymbol',
  [rateLimitPerUser('pool-update-asset', 20, '5min')],
  async (req: any, res: Response) => {
    try {
      const pool = await requirePoolAccess(req, res, req.params.id);
      if (!pool) return;
      const userId = userIdOf(req)!;
      const { targetAllocation } = req.body;

      if (typeof targetAllocation !== 'number') {
        return res
          .status(400)
          .json({ error: 'targetAllocation is required and must be a number' });
      }
      if (targetAllocation < 0 || targetAllocation > 10000) {
        return res.status(400).json({
          error: 'targetAllocation must be between 0 and 10000 basis points',
        });
      }

      const result = await investmentPoolService.updateAssetAllocation(
        pool.id,
        req.params.assetSymbol.toUpperCase(),
        targetAllocation,
        userId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        asset: result.asset,
        message: `Allocation updated to ${(targetAllocation / 100).toFixed(2)}%`,
      });
    } catch (error) {
      logger.error('Error updating allocation', { error });
      res.status(500).json({ error: 'Failed to update allocation' });
    }
  }
);

router.delete(
  '/:id/assets/:assetSymbol',
  [rateLimitPerUser('pool-remove-asset', 10, '5min')],
  async (req: any, res: Response) => {
    try {
      const pool = await requirePoolAccess(req, res, req.params.id);
      if (!pool) return;
      const userId = userIdOf(req)!;

      const result = await investmentPoolService.removeAssetFromPool(
        pool.id,
        req.params.assetSymbol.toUpperCase(),
        userId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, message: 'Asset removed from pool' });
    } catch (error) {
      logger.error('Error removing asset', { error });
      res.status(500).json({ error: 'Failed to remove asset' });
    }
  }
);

router.get('/:id/performance', async (req: any, res) => {
  try {
    const pool = await requirePoolAccess(req, res, req.params.id);
    if (!pool) return;

    const daysInt = parseDays(req.query.days, 30);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysInt);

    const performance = await db
      .select()
      .from(poolPerformance)
      .where(
        and(
          eq(poolPerformance.poolId, pool.id),
          sql`${poolPerformance.snapshotAt} >= ${startDate}`
        )
      )
      .orderBy(poolPerformance.snapshotAt);

    res.json({ performance });
  } catch (error) {
    logger.error('Error fetching performance', { error });
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// ─── INVEST (transactional) ──────────────────────────────────

router.post(
  '/:id/invest',
  [rateLimitPerUser('pool-invest', 20, '5min')],
  async (req: any, res: any) => {
    try {
      const userId = userIdOf(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const poolId = req.params.id;
      const access = await requirePoolAccess(req, res, poolId);
      if (!access) return;

      const amountUsd = Number(req.body.amountUsd);
      const paymentToken = String(req.body.paymentToken || 'cUSD');
      const idempotencyKey =
        (req.get('Idempotency-Key') as string | undefined) ||
        req.body.idempotencyKey;

      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        return res.status(400).json({ error: 'Invalid investment amount' });
      }
      if (amountUsd > MAX_INVEST_USD) {
        return res.status(400).json({ error: 'Amount exceeds maximum' });
      }

      const existing = await findIdempotentInvestment(
        poolId,
        userId,
        idempotencyKey
      );
      if (existing) {
        return res.json({
          investment: existing,
          idempotent: true,
          sharesMinted: Number(existing.shares_minted ?? existing.sharesMinted),
        });
      }

      const feeCalculation =
        await investmentPoolPricingService.calculateInvestmentFees(
          poolId,
          amountUsd
        );

      const result = await db.transaction(async (tx) => {
        // Lock pool row
        const locked = await tx.execute(sql`
          SELECT id, is_active, minimum_investment, total_value_locked,
                 share_token_supply, share_price
          FROM investment_pools
          WHERE id = ${poolId}
          FOR UPDATE
        `);
        const row = locked.rows?.[0] as any;
        if (!row) throw new Error('POOL_NOT_FOUND');
        if (!row.is_active) throw new Error('POOL_INACTIVE');

        const minInv = Number(row.minimum_investment);
        if (amountUsd < minInv) throw new Error('BELOW_MINIMUM');

        const currentSupply = Number(row.share_token_supply);
        const currentTVL = Number(row.total_value_locked);
        const sharePriceAtInvestment = Number(row.share_price) || 1;

        const sharesMinted =
          currentSupply === 0 || currentTVL === 0
            ? amountUsd
            : (amountUsd * currentSupply) / currentTVL;

        const newTVL = currentTVL + amountUsd;
        const newSupply = currentSupply + sharesMinted;
        const newSharePrice = newSupply > 0 ? newTVL / newSupply : 1;

        const insertCols: Record<string, unknown> = {
          poolId,
          userId,
          investmentAmountUsd: amountUsd.toFixed(8),
          sharesMinted: sharesMinted.toFixed(12),
          sharePriceAtInvestment: sharePriceAtInvestment.toFixed(12),
          paymentToken,
          status: 'completed',
        };

        // Optional idempotency column
        if (idempotencyKey) {
          (insertCols as any).idempotencyKey = idempotencyKey;
        }

        const [investment] = await tx
          .insert(poolInvestments)
          .values(insertCols as any)
          .returning();

        await tx
          .update(investmentPools)
          .set({
            totalValueLocked: newTVL.toFixed(8),
            shareTokenSupply: newSupply.toFixed(12),
            sharePrice: newSharePrice.toFixed(12),
          })
          .where(eq(investmentPools.id, poolId));

        return {
          investment,
          sharesMinted,
          newSharePrice,
          totalShares: newSupply,
        };
      });

      await investmentPoolPricingService.recordPoolRevenue(poolId, 'investment', {
        platformFee: feeCalculation.platformFee,
        tier: feeCalculation.tier,
      });

      logger.info('Investment completed', { userId, poolId, amountUsd });
      res.status(201).json(result);
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg === 'POOL_INACTIVE') {
        return res.status(400).json({ error: 'Pool is not active' });
      }
      if (msg === 'BELOW_MINIMUM') {
        return res.status(400).json({ error: 'Below minimum investment' });
      }
      if (msg === 'POOL_NOT_FOUND') {
        return res.status(404).json({ error: 'Pool not found' });
      }
      logger.error('Error processing investment', { error });
      res.status(500).json({ error: 'Failed to process investment' });
    }
  }
);

// ─── WITHDRAW (transactional) ────────────────────────────────

router.post(
  '/:id/withdraw',
  [rateLimitPerUser('pool-withdraw', 20, '5min')],
  async (req: any, res: any) => {
    try {
      const userId = userIdOf(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const poolId = req.params.id;
      const access = await requirePoolAccess(req, res, poolId);
      if (!access) return;

      const shares = Number(req.body.shares);
      if (!Number.isFinite(shares) || shares <= 0) {
        return res.status(400).json({ error: 'Invalid share amount' });
      }

      const result = await db.transaction(async (tx) => {
        const locked = await tx.execute(sql`
          SELECT id, total_value_locked, share_token_supply, share_price
          FROM investment_pools
          WHERE id = ${poolId}
          FOR UPDATE
        `);
        const row = locked.rows?.[0] as any;
        if (!row) throw new Error('POOL_NOT_FOUND');

        const invRows = await tx
          .select({
            investmentAmountUsd: poolInvestments.investmentAmountUsd,
            sharesMinted: poolInvestments.sharesMinted,
          })
          .from(poolInvestments)
          .where(
            and(
              eq(poolInvestments.poolId, poolId),
              eq(poolInvestments.userId, userId),
              eq(poolInvestments.status, 'completed')
            )
          );

        const wdRows = await tx
          .select({ shares: poolWithdrawals.sharesBurned })
          .from(poolWithdrawals)
          .where(
            and(
              eq(poolWithdrawals.poolId, poolId),
              eq(poolWithdrawals.userId, userId),
              eq(poolWithdrawals.status, 'completed')
            )
          );

        const totalInvestedShares = invRows.reduce(
          (s, i) => s + Number(i.sharesMinted),
          0
        );
        const totalWithdrawnShares = wdRows.reduce(
          (s, w) => s + Number(w.shares),
          0
        );
        const availableShares = totalInvestedShares - totalWithdrawnShares;

        if (shares > availableShares + 1e-12) {
          throw new Error(`INSUFFICIENT:${availableShares}`);
        }

        const currentTVL = Number(row.total_value_locked);
        const currentSupply = Number(row.share_token_supply);
        const sharePriceAtWithdrawal = Number(row.share_price) || 1;
        const withdrawalValue = shares * sharePriceAtWithdrawal;

        const userTotalInvested = invRows.reduce(
          (s, i) => s + Number(i.investmentAmountUsd),
          0
        );
        const avgCostBasis =
          totalInvestedShares > 0 ? userTotalInvested / totalInvestedShares : 0;
        const initialInvestment = shares * avgCostBasis;

        // Fees outside lock would be better with pure function; keep call but after lock held briefly
        return {
          currentTVL,
          currentSupply,
          sharePriceAtWithdrawal,
          withdrawalValue,
          initialInvestment,
          availableShares,
        };
      });

      // Fee calc outside long lock (uses pool id only)
      const feeCalculation =
        await investmentPoolPricingService.calculateWithdrawalFees(
          poolId,
          result.withdrawalValue,
          result.initialInvestment
        );

      const final = await db.transaction(async (tx) => {
        const locked = await tx.execute(sql`
          SELECT id, total_value_locked, share_token_supply, share_price
          FROM investment_pools
          WHERE id = ${poolId}
          FOR UPDATE
        `);
        const row = locked.rows?.[0] as any;
        if (!row) throw new Error('POOL_NOT_FOUND');

        // Re-check shares under lock
        const invRows = await tx
          .select({ sharesMinted: poolInvestments.sharesMinted })
          .from(poolInvestments)
          .where(
            and(
              eq(poolInvestments.poolId, poolId),
              eq(poolInvestments.userId, userId),
              eq(poolInvestments.status, 'completed')
            )
          );
        const wdRows = await tx
          .select({ shares: poolWithdrawals.sharesBurned })
          .from(poolWithdrawals)
          .where(
            and(
              eq(poolWithdrawals.poolId, poolId),
              eq(poolWithdrawals.userId, userId),
              eq(poolWithdrawals.status, 'completed')
            )
          );
        const available =
          invRows.reduce((s, i) => s + Number(i.sharesMinted), 0) -
          wdRows.reduce((s, w) => s + Number(w.shares), 0);
        if (shares > available + 1e-12) {
          throw new Error(`INSUFFICIENT:${available}`);
        }

        const currentTVL = Number(row.total_value_locked);
        const currentSupply = Number(row.share_token_supply);
        const sharePrice = Number(row.share_price) || 1;
        const withdrawalValue = shares * sharePrice;
        const netAmount = feeCalculation.netAmount;

        const [withdrawal] = await tx
          .insert(poolWithdrawals)
          .values({
            poolId,
            userId,
            sharesBurned: shares.toFixed(12),
            withdrawalValueUsd: withdrawalValue.toFixed(8),
            sharePriceAtWithdrawal: sharePrice.toFixed(12),
            feeCharged: feeCalculation.totalFees.toFixed(8),
            netAmount: netAmount.toFixed(8),
            status: 'completed',
          })
          .returning();

        const newTVL = Math.max(0, currentTVL - withdrawalValue);
        const newSupply = Math.max(0, currentSupply - shares);
        const newSharePrice = newSupply > 0 ? newTVL / newSupply : 1;

        await tx
          .update(investmentPools)
          .set({
            totalValueLocked: newTVL.toFixed(8),
            shareTokenSupply: newSupply.toFixed(12),
            sharePrice: newSharePrice.toFixed(12),
          })
          .where(eq(investmentPools.id, poolId));

        return {
          withdrawal,
          netAmount,
          feeCharged: feeCalculation.totalFees,
          remainingShares: available - shares,
        };
      });

      await investmentPoolPricingService.recordPoolRevenue(poolId, 'withdrawal', {
        platformFee: feeCalculation.platformFee,
        performanceFee: feeCalculation.performanceFee,
        tier: feeCalculation.tier,
      });

      logger.info('Withdrawal completed', { userId, poolId, shares });
      res.json(final);
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.startsWith('INSUFFICIENT:')) {
        return res.status(400).json({
          error: `Insufficient shares. Available: ${msg.split(':')[1]}`,
        });
      }
      logger.error('Error processing withdrawal', { error });
      res.status(500).json({ error: 'Failed to process withdrawal' });
    }
  }
);

router.get('/:id/my-investment', async (req: any, res) => {
  try {
    const pool = await requirePoolAccess(req, res, req.params.id);
    if (!pool) return;
    const userId = userIdOf(req)!;

    const investments = await db
      .select()
      .from(poolInvestments)
      .where(
        and(
          eq(poolInvestments.poolId, pool.id),
          eq(poolInvestments.userId, userId)
        )
      )
      .orderBy(desc(poolInvestments.investedAt));

    const withdrawals = await db
      .select()
      .from(poolWithdrawals)
      .where(
        and(
          eq(poolWithdrawals.poolId, pool.id),
          eq(poolWithdrawals.userId, userId)
        )
      )
      .orderBy(desc(poolWithdrawals.withdrawnAt));

    const totalInvested = investments.reduce(
      (s, i) => s + Number(i.investmentAmountUsd),
      0
    );
    const totalShares = investments.reduce(
      (s, i) => s + Number(i.sharesMinted),
      0
    );
    const sharesWithdrawn = withdrawals.reduce(
      (s, w) => s + Number(w.sharesBurned),
      0
    );
    const currentShares = totalShares - sharesWithdrawn;
    const currentValue = currentShares * Number(pool.sharePrice);
    const totalReturn = currentValue - totalInvested;
    const returnPercentage =
      totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

    res.json({
      investments,
      withdrawals,
      summary: {
        totalInvested,
        currentShares,
        currentValue,
        totalReturn,
        returnPercentage,
      },
    });
  } catch (error) {
    logger.error('Error fetching user investment', { error });
    res.status(500).json({ error: 'Failed to fetch investment data' });
  }
});

router.get('/:id/analytics', async (req: any, res) => {
  try {
    const pool = await requirePoolAccess(req, res, req.params.id);
    if (!pool) return;
    const analytics = await performanceTrackingService.getPoolAnalytics(
      pool.id
    );
    if (!analytics) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    res.json(analytics);
  } catch (error) {
    logger.error('Error fetching analytics', { error });
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/:id/rebalancing-status', async (req: any, res) => {
  try {
    const pool = await requirePoolAccess(req, res, req.params.id);
    if (!pool) return;
    const status = await rebalancingService.getRebalancingStatus(pool.id);
    res.json(status);
  } catch (error) {
    logger.error('Error fetching rebalancing status', { error });
    res.status(500).json({ error: 'Failed to fetch rebalancing status' });
  }
});

router.post(
  '/:id/trigger-rebalance',
  [rateLimitPerUser('pool-rebalance', 5, '10min')],
  async (req: any, res: any) => {
    try {
      const pool = await requirePoolAccess(req, res, req.params.id);
      if (!pool) return;
      const userId = userIdOf(req)!;

      const jobId = await jobQueueService.queueJob(
        'pool-rebalance',
        {
          poolId: pool.id,
          userId,
          force: req.body?.force || false,
        },
        { priority: 7, timeout: 300_000 }
      );

      res.status(202).json({
        success: true,
        message: 'Rebalancing initiated',
        jobId,
        statusUrl: `/api/investment-pools/${pool.id}/rebalance-status/${jobId}`,
      });
    } catch (error) {
      logger.error('Error triggering rebalance', { error });
      res.status(500).json({ error: 'Failed to trigger rebalance' });
    }
  }
);

router.post('/:id/trigger-snapshot', async (req: any, res) => {
  try {
    const pool = await requirePoolAccess(req, res, req.params.id);
    if (!pool) return;
    await triggerManualSnapshot(pool.id);
    res.json({ success: true, message: 'Performance snapshot recorded' });
  } catch (error) {
    logger.error('Error triggering snapshot', { error });
    res.status(500).json({ error: 'Failed to trigger snapshot' });
  }
});

router.get('/:id/performance-chart', async (req: any, res) => {
  try {
    const pool = await requirePoolAccess(req, res, req.params.id);
    if (!pool) return;

    const daysInt = parseDays(req.query.days, 30);
    const history = await performanceTrackingService.getPerformanceHistory(
      pool.id,
      daysInt
    );

    const chartData = history.map((snapshot: any) => ({
      date: snapshot.snapshotAt,
      tvl: Number(snapshot.tvl),
      sharePrice: Number(snapshot.sharePrice),
      return: Number(snapshot.totalReturnPercentage),
      btc: Number(snapshot.btcPrice),
      eth: Number(snapshot.ethPrice),
      sol: Number(snapshot.solPrice),
      bnb: Number(snapshot.bnbPrice),
      xrp: Number(snapshot.xrpPrice),
      ltc: Number(snapshot.ltcPrice),
    }));

    res.json({ data: chartData });
  } catch (error) {
    logger.error('Error fetching performance chart', { error });
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

export default router;