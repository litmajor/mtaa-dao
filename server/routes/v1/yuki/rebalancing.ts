/**
 * ════════════════════════════════════════════════════════════════════════════════
 * YUKI REBALANCING Router - Strategy Rebalancing Execution
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 6 endpoints for strategy rebalancing execution, monitoring, and estimation.
 *
 * ⚠️ AUTHORIZATION TODO: `authenticate` confirms the caller is logged in, but
 * nothing here checks the caller owns/is authorized for `strategyId`. Every
 * route that touches a strategyId or rebalance id needs an ownership check
 * added at the marked TODOs — right now any authenticated user can trigger,
 * cancel, or read another user's strategy execution history by ID.
 *
 * ⚠️ RISK GATE: /trigger now runs each order through the shared
 * assessSwapRisk() gate (same logic pool-based rebalancing uses) before
 * calling dexRoutingExecution.executeRebalance. Previously this path
 * executed blind.
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { logger } from '../../../utils/logger';
import { dexRoutingExecution } from '../../../services/dexRoutingExecution';
import { db } from '../../../db';
import { authenticate } from '../../../auth';
import { advancedModeGuard } from '../../../middleware/advancedModeGuard';
import { assessSwapRisk } from '../../../services/swapRiskGate';
import { strategiesTable, strategyRebalancesTable } from '../../../db/schema/strategies';
import { and, eq } from 'drizzle-orm';
import { priceOracle } from '../../../services/priceOracle';

const router = express.Router();

// All rebalancing operations require authentication
router.use(authenticate);

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ════════════════════════════════════════════════════════════════════════════════

const SUPPORTED_CHAINS = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'celo'];
const ORDER_ACTIONS = ['buy', 'sell'] as const;
const MAX_ORDERS_PER_REQUEST = 50;
const MAX_SLIPPAGE_PERCENT = 10; // hard ceiling regardless of caller input

type AuthenticatedRequest = Request & { user?: { id?: string } };

type RebalanceAction = typeof ORDER_ACTIONS[number];

type RebalanceOrder = {
  asset: string;
  action: RebalanceAction;
  amount: number;
  amountUsd: number;
  maxSlippagePercent: number;
  targetPrice?: number;
  deadline?: number;
  gasPrice?: number;
  [key: string]: unknown;
};

function getAuthenticatedUserId(req: Request): string | null {
  return ((req as AuthenticatedRequest).user?.id ?? null);
}

async function assertOwnsStrategy(req: Request, strategyId: string): Promise<boolean> {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return false;

  const strategyRecord = await db
    .select()
    .from(strategiesTable)
    .where(and(eq(strategiesTable.id, strategyId), eq(strategiesTable.creatorId, userId)))
    .limit(1);

  return strategyRecord.length > 0;
}

async function assertOwnsRebalance(req: Request, rebalanceId: string): Promise<boolean> {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return false;

  const rebalanceRecord = await db
    .select({ strategyId: strategyRebalancesTable.strategyId })
    .from(strategyRebalancesTable)
    .where(eq(strategyRebalancesTable.id, rebalanceId))
    .limit(1);

  if (rebalanceRecord.length === 0) {
    return false;
  }

  return await assertOwnsStrategy(req, rebalanceRecord[0].strategyId);
}

function validateChain(chain: unknown, res: Response): string | null {
  const c = String(chain ?? 'ethereum').toLowerCase();
  if (!SUPPORTED_CHAINS.includes(c)) {
    res.status(400).json({ error: `Unsupported chain: ${chain}`, supported: SUPPORTED_CHAINS });
    return null;
  }
  return c;
}

function validateOrders(orders: unknown, res: Response): RebalanceOrder[] | null {
  if (!Array.isArray(orders) || orders.length === 0) {
    res.status(400).json({ error: 'orders must be a non-empty array' });
    return null;
  }

  if (orders.length > MAX_ORDERS_PER_REQUEST) {
    res.status(400).json({ error: `orders exceeds max of ${MAX_ORDERS_PER_REQUEST}` });
    return null;
  }

  const validatedOrders: RebalanceOrder[] = [];

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    if (typeof order !== 'object' || order === null) {
      res.status(400).json({ error: `Invalid order at index ${i}: order must be an object` });
      return null;
    }

    const asset = (order as { asset?: unknown }).asset;
    const action = (order as { action?: unknown }).action;
    const amount = (order as { amount?: unknown }).amount;
    const amountUsd = (order as { amountUsd?: unknown }).amountUsd;
    const maxSlippagePercent = Number((order as { maxSlippagePercent?: unknown }).maxSlippagePercent ?? 0.5);

    if (typeof asset !== 'string' || !asset.trim()) {
      res.status(400).json({ error: `Invalid order at index ${i}: asset is required` });
      return null;
    }

    if (!ORDER_ACTIONS.includes(action as RebalanceAction)) {
      res.status(400).json({ error: `Invalid order at index ${i}: action must be one of ${ORDER_ACTIONS.join(', ')}` });
      return null;
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: `Invalid order at index ${i}: amount must be a positive number` });
      return null;
    }

    if (typeof amountUsd !== 'number' || !Number.isFinite(amountUsd) || amountUsd <= 0) {
      res.status(400).json({ error: `Invalid order at index ${i}: amountUsd must be a positive number` });
      return null;
    }

    if (!Number.isFinite(maxSlippagePercent) || maxSlippagePercent <= 0 || maxSlippagePercent > MAX_SLIPPAGE_PERCENT) {
      res.status(400).json({ error: `Invalid order at index ${i}: maxSlippagePercent must be between 0 and ${MAX_SLIPPAGE_PERCENT}` });
      return null;
    }

    validatedOrders.push({
      asset: asset.trim(),
      action: action as RebalanceAction,
      amount,
      amountUsd,
      maxSlippagePercent,
    });
  }

  return validatedOrders;
}

function validateSlippage(maxSlippagePercent: unknown, res: Response): number | null {
  const s = Number(maxSlippagePercent ?? 0.5);
  if (!Number.isFinite(s) || s <= 0 || s > MAX_SLIPPAGE_PERCENT) {
    res.status(400).json({ error: `maxSlippagePercent must be between 0 and ${MAX_SLIPPAGE_PERCENT}` });
    return null;
  }
  return s;
}



// ════════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ════════════════════════════════════════════════════════════════════════════════

const triggerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many rebalance trigger requests'
});

const estimateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many estimate requests'
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many requests'
});

const cancelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many cancel requests'
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/rebalancing/trigger
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Trigger a rebalancing execution
 * Body: { strategyId, orders, chain?, maxSlippagePercent? }
 *
 * Gated behind advancedModeGuard (executes real swaps with slippage
 * exposure, same category as bridge/swap + bridge/transfer) and the shared
 * risk gate (blocks per-order if microstructure signals are toxic/illiquid).
 */
router.post('/trigger', triggerLimiter, advancedModeGuard, async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.body;
    if (!strategyId || typeof strategyId !== 'string') {
      return res.status(400).json({ error: 'strategyId is required' });
    }

    const orders = validateOrders(req.body.orders, res);
    if (!orders) return;

    const chain = validateChain(req.body.chain, res);
    if (!chain) return;

    const maxSlippagePercent = validateSlippage(req.body.maxSlippagePercent, res);
    if (maxSlippagePercent === null) return;

    // Validate strategy exists in database
    const strategyRecord = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, strategyId))
      .limit(1);

    if (strategyRecord.length === 0) {
      return res.status(404).json({ error: `Strategy ${strategyId} not found` });
    }

    const authorized = await assertOwnsStrategy(req, strategyId);
    if (!authorized) {
      return res.status(403).json({ error: 'Not authorized for this strategy' });
    }

    // Risk-gate every order before touching the strategy's actual capital.
    // A rebalance being scheduled doesn't mean this instant is a safe time
    // to execute it — same principle as pool-based rebalancing.
    const blockedOrders: Array<{ asset: string; action: RebalanceAction; reason?: string }> = [];
    const safeOrders: RebalanceOrder[] = [];

    for (const order of orders) {
      // Order direction determines which side of the pair we're acquiring —
      // risk-gate on the asset actually being bought/sold into.
      const risk = await assessSwapRisk('USD', order.asset);
      if (!risk.safe) {
        blockedOrders.push({ asset: order.asset, action: order.action, reason: risk.reason });
        logger.warn(`⛔ Order blocked for strategy ${strategyId}: ${order.action} ${order.asset} — ${risk.reason}`);
        continue;
      }
      safeOrders.push(order);
    }

    if (safeOrders.length === 0) {
      return res.status(409).json({
        error: 'All orders blocked by risk gate',
        blockedOrders,
      });
    }

    logger.info(`[RebalancingAPI] Triggering rebalance for strategy: ${strategyId} (${safeOrders.length}/${orders.length} orders passed risk gate)`);

    // Get current prices for all assets in orders
    const assets = Array.from(new Set(safeOrders.map((o: RebalanceOrder) => o.asset)));
    const prices = await priceOracle.getValuationPrices(assets);
    const assetPrices: Record<string, number> = {};
    for (const asset of assets) {
      const valuation = prices.get(asset.toUpperCase());
      const price = valuation?.haircutPriceUsd ?? valuation?.priceUsd;
      if (!valuation || price === undefined || !Number.isFinite(price) || price <= 0) {
        return res.status(503).json({
          error: `Reliable valuation unavailable for ${asset}; rebalance was not started`,
        });
      }
      assetPrices[asset] = price;
    }
    logger.info(`💰 Asset valuations fetched: ${Object.keys(assetPrices).join(', ')}`);

    const rebalanceId = await dexRoutingExecution.executeRebalance({
      strategyId,
      orders: safeOrders,
      chain,
      maxSlippagePercent,
    });

    return res.status(200).json({
      success: true,
      rebalanceId,
      strategyId,
      strategyName: strategyRecord[0].name,
      status: 'pending',
      orders: safeOrders.length,
      ordersBlocked: blockedOrders.length,
      blockedOrders: blockedOrders.length > 0 ? blockedOrders : undefined,
      chain,
      assetPrices: Object.keys(assetPrices).length > 0 ? assetPrices : undefined,
      estimatedImpact: 'pending',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error triggering rebalance:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Rebalancing failed',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/rebalancing/estimate
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Estimate rebalancing costs
 * Query: { orders: JSON array }
 * Uses real prices from priceOracle for accurate cost estimation
 */
router.get('/estimate', estimateLimiter, async (req: Request, res: Response) => {
  try {
    const { orders } = req.query;

    if (!orders || typeof orders !== 'string') {
      return res.status(400).json({ error: 'orders parameter is required as JSON string' });
    }

    // Cap raw payload size before parsing — unbounded JSON via query string
    // is a DoS surface.
    if (orders.length > 20_000) {
      return res.status(400).json({ error: 'orders payload too large' });
    }

    let parsedOrders: unknown;
    try {
      parsedOrders = JSON.parse(orders);
    } catch {
      return res.status(400).json({ error: 'orders must be valid JSON' });
    }

    const validOrders = validateOrders(parsedOrders, res);
    if (!validOrders) return;

    // Get real prices for accurate USD estimation
    let priceData: Record<string, number> = {};
    try {
      const assets = Array.from(new Set(validOrders.map((o: RebalanceOrder) => o.asset)));
      const prices = await priceOracle.getPrices(assets);
      assets.forEach((asset: string) => {
        const price = prices.get(asset);
        priceData[asset] = price?.priceUsd || 0;
      });
    } catch (e) {
      const warnMeta: Record<string, unknown> = {
        error: e instanceof Error ? e.message : String(e),
      };
      logger.warn('Price oracle unavailable for estimate, using fallback', warnMeta);
    }

    const estimate = dexRoutingExecution.estimateRebalanceCost(validOrders);

    return res.status(200).json({
      success: true,
      estimate: {
        gasEstimateUsd: estimate.estimatedGasUsd,
        slippageEstimateUsd: estimate.estimatedSlippageUsd,
        totalCostUsd: estimate.totalCostUsd,
        impactPercent: estimate.impactPercent,
        orders: validOrders.length,
      },
      assetPrices: Object.keys(priceData).length > 0 ? priceData : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error estimating costs:', error);
    return res.status(500).json({ error: 'Failed to estimate rebalancing costs' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/rebalancing/active
// ════════════════════════════════════════════════════════════════════════════════

/**
 * List active rebalancing executions
 *
 * TODO: this currently returns ALL active executions system-wide, not just
 * the caller's own. Same ownership gap as the rest of this router — filter
 * by the caller's strategies once assertOwnsStrategy is wired.
 */
router.get('/active', readLimiter, async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const ownedStrategies = await db
      .select({ id: strategiesTable.id })
      .from(strategiesTable)
      .where(eq(strategiesTable.creatorId, userId));

    const ownedStrategyIds = new Set(ownedStrategies.map((strategy) => strategy.id));
    const active = dexRoutingExecution.getActiveExecutions().filter((execution) =>
      ownedStrategyIds.has(execution.strategyId)
    );

    return res.status(200).json({
      success: true,
      count: active.length,
      executions: active.map((e) => ({
        rebalanceId: e.rebalanceId,
        strategyId: e.strategyId,
        status: e.status,
        triggeredAt: new Date(e.triggeredAt),
        transactionCount: e.transactions.length,
      })),
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error fetching active executions:', error);
    return res.status(500).json({ error: 'Failed to fetch active executions' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/rebalancing/:id
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get rebalancing status by ID
 * Params: { id: rebalanceId }
 */
router.get('/:id', readLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const dbResult = await db
      .select()
      .from(strategyRebalancesTable)
      .where(eq(strategyRebalancesTable.id, id))
      .limit(1);

    if (dbResult.length > 0) {
      const strategyId = dbResult[0].strategyId;
      const authorized = await assertOwnsStrategy(req, strategyId);
      if (!authorized) {
        return res.status(404).json({ error: 'Rebalance not found' });
      }

      const strategy = await db
        .select()
        .from(strategiesTable)
        .where(and(eq(strategiesTable.id, strategyId), eq(strategiesTable.creatorId, getAuthenticatedUserId(req) ?? '')))
        .limit(1);

      return res.status(200).json({
        success: true,
        rebalance: {
          id: dbResult[0].id,
          strategyId: dbResult[0].strategyId,
          strategyName: strategy.length > 0 ? strategy[0].name : undefined,
          status: dbResult[0].status,
          triggeredAt: dbResult[0].triggeredAt,
          executedAt: dbResult[0].executedAt,
          completedAt: dbResult[0].completedAt,
          transactions: dbResult[0].transactions,
          successfulTransactions: dbResult[0].successfulTransactions,
          failedTransactions: dbResult[0].failedTransactions,
          totalGasCostUsd: dbResult[0].totalGasCostUsd,
          totalSlippage: dbResult[0].totalSlippage,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const execution = dexRoutingExecution.getExecutionStatus(id);

    if (!execution) {
      return res.status(404).json({ error: 'Rebalance not found' });
    }

    const isOwned = await assertOwnsStrategy(req, execution.strategyId);
    if (!isOwned) {
      return res.status(404).json({ error: 'Rebalance not found' });
    }

    const strategy = await db
      .select()
      .from(strategiesTable)
      .where(and(eq(strategiesTable.id, execution.strategyId), eq(strategiesTable.creatorId, getAuthenticatedUserId(req) ?? '')))
      .limit(1);

    return res.status(200).json({
      success: true,
      rebalance: {
        id: execution.rebalanceId,
        strategyId: execution.strategyId,
        strategyName: strategy.length > 0 ? strategy[0].name : undefined,
        status: execution.status,
        triggeredAt: new Date(execution.triggeredAt),
        executedAt: execution.executionStartedAt ? new Date(execution.executionStartedAt) : null,
        completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
        transactionCount: execution.transactions.length,
        successfulTransactions: execution.successfulTransactions,
        failedTransactions: execution.failedTransactions,
        totalGasCostUsd: execution.totalGasCostUsd,
        totalSlippage: execution.totalSlippage,
        transactions: execution.transactions,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error fetching rebalance status:', error);
    return res.status(500).json({ error: 'Failed to fetch rebalance status' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// DELETE /v1/yuki/rebalancing/:id
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Cancel a rebalancing execution
 */
router.delete('/:id', cancelLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rebalanceRecord = await db
      .select({ strategyId: strategyRebalancesTable.strategyId })
      .from(strategyRebalancesTable)
      .where(eq(strategyRebalancesTable.id, id))
      .limit(1);

    if (rebalanceRecord.length === 0) {
      return res.status(404).json({ error: 'Rebalance not found' });
    }

    if (!(await assertOwnsStrategy(req, rebalanceRecord[0].strategyId))) {
      return res.status(404).json({ error: 'Rebalance not found' });
    }

    const success = await dexRoutingExecution.cancelRebalance(id);

    if (!success) {
      return res.status(400).json({ error: 'Cannot cancel rebalance - already executing or completed' });
    }

    return res.status(200).json({
      success: true,
      message: 'Rebalance cancelled',
      rebalanceId: id,
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error cancelling rebalance:', error);
    return res.status(500).json({ error: 'Failed to cancel rebalance' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/rebalancing/strategy/:strategyId/history
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get rebalancing history for a strategy
 * Params: { strategyId }
 * Query: { limit?, offset? }
 */
router.get('/strategy/:strategyId/history', readLimiter, async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const strategyRecord = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, strategyId))
      .limit(1);

    if (strategyRecord.length === 0) {
      return res.status(404).json({ error: `Strategy ${strategyId} not found` });
    }

    const authorized = await assertOwnsStrategy(req, strategyId);
    if (!authorized) {
      return res.status(404).json({ error: `Strategy ${strategyId} not found` });
    }

    const rebalances = await db
      .select()
      .from(strategyRebalancesTable)
      .where(eq(strategyRebalancesTable.strategyId, strategyId))
      .limit(limit)
      .offset(offset);

    return res.status(200).json({
      success: true,
      strategy: {
        id: strategyRecord[0].id,
        name: strategyRecord[0].name,
        type: strategyRecord[0].riskLevel,
      },
      total: rebalances.length,
      rebalances: rebalances.map((r) => ({
        id: r.id,
        status: r.status,
        triggeredAt: r.triggeredAt,
        completedAt: r.completedAt,
        successfulTransactions: r.successfulTransactions,
        failedTransactions: r.failedTransactions,
        totalGasCostUsd: r.totalGasCostUsd,
        totalSlippage: r.totalSlippage,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error fetching rebalance history:', error);
    return res.status(500).json({ error: 'Failed to fetch rebalance history' });
  }
});

export default router;