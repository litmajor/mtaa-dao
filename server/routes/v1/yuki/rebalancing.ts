/**
 * ════════════════════════════════════════════════════════════════════════════════
 * YUKI REBALANCING Router - Portfolio Rebalancing
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * 6 endpoints for strategy rebalancing execution, monitoring, and estimation
 */

import express, { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { dexRoutingExecution } from '../../../services/dexRoutingExecution';
import { db } from '../../../db';
import { authenticate } from '../../../auth';
import { strategiesTable, strategyRebalancesTable } from '../../../db/schema/strategies';
import { eq } from 'drizzle-orm';
import { priceOracle } from '../../../services/priceOracle';

const router = express.Router();

// All rebalancing operations require authentication
router.use(authenticate);

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/rebalancing/trigger
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Trigger a rebalancing execution
 * Body: { strategyId, orders, chain?, maxSlippagePercent? }
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { strategyId, orders, chain = 'ethereum', maxSlippagePercent = 0.5 } = req.body;

    if (!strategyId || !orders || orders.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: strategyId, orders',
      });
    }

    for (const order of orders) {
      if (!order.asset || !order.action || !order.amount || !order.amountUsd) {
        return res.status(400).json({
          error: 'Invalid order format. Required: asset, action, amount, amountUsd',
        });
      }
    }

    // Validate strategy exists in database
    const strategyRecord = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, strategyId))
      .limit(1);

    if (strategyRecord.length === 0) {
      return res.status(404).json({
        error: `Strategy ${strategyId} not found`,
      });
    }

    logger.info(`[RebalancingAPI] Triggering rebalance for strategy: ${strategyId}`);

    // Get current prices for all assets in orders
    let assetPrices: Record<string, number> = {};
    try {
      const assets = Array.from(new Set((orders as any[]).map((o: any) => o.asset as string)));
      const prices = await priceOracle.getPrices(assets);
      assets.forEach((asset: string) => {
        const price = prices.get(asset);
        assetPrices[asset] = price?.priceUsd || 0;
      });
      logger.info(`💰 Asset prices fetched: ${Object.keys(assetPrices).join(', ')}`);
    } catch (e) {
      logger.warn('Price oracle unavailable, proceeding with DEX prices', e);
    }

    const rebalanceId = await dexRoutingExecution.executeRebalance({
      strategyId,
      orders,
      chain,
      maxSlippagePercent,
    });

    return res.status(200).json({
      success: true,
      rebalanceId,
      strategyId,
      strategyName: strategyRecord[0].name,
      status: 'pending',
      orders: orders.length,
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
router.get('/estimate', async (req: Request, res: Response) => {
  try {
    const { orders } = req.query;

    if (!orders || typeof orders !== 'string') {
      return res.status(400).json({
        error: 'orders parameter is required as JSON string',
      });
    }

    const parsedOrders = JSON.parse(orders as string);
    if (!Array.isArray(parsedOrders)) {
      return res.status(400).json({
        error: 'orders must be an array',
      });
    }

    // Get real prices for accurate USD estimation
    let priceData: Record<string, number> = {};
    try {
      const assets = Array.from(new Set((parsedOrders as any[]).map((o: any) => o.asset as string)));
      const prices = await priceOracle.getPrices(assets);
      assets.forEach((asset: string) => {
        const price = prices.get(asset);
        priceData[asset] = price?.priceUsd || 0;
      });
    } catch (e) {
      logger.warn('Price oracle unavailable for estimate, using fallback', e);
    }

    const estimate = dexRoutingExecution.estimateRebalanceCost(parsedOrders);

    return res.status(200).json({
      success: true,
      estimate: {
        gasEstimateUsd: estimate.estimatedGasUsd,
        slippageEstimateUsd: estimate.estimatedSlippageUsd,
        totalCostUsd: estimate.totalCostUsd,
        impactPercent: estimate.impactPercent,
        orders: parsedOrders.length,
      },
      assetPrices: Object.keys(priceData).length > 0 ? priceData : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error estimating costs:', error);
    return res.status(500).json({
      error: 'Failed to estimate rebalancing costs',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/rebalancing/active
// ════════════════════════════════════════════════════════════════════════════════

/**
 * List active rebalancing executions
 * DEDUPLICATED: Removed /active/list endpoint (was identical)
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const active = dexRoutingExecution.getActiveExecutions();

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
    return res.status(500).json({
      error: 'Failed to fetch active executions',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/rebalancing/:id
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get rebalancing status by ID
 * Params: { id: rebalanceId }
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Query database for rebalance record
    const dbResult = await db
      .select()
      .from(strategyRebalancesTable)
      .where(eq(strategyRebalancesTable.id, id))
      .limit(1);

    if (dbResult.length > 0) {
      // Fetch strategy details
      const strategy = await db
        .select()
        .from(strategiesTable)
        .where(eq(strategiesTable.id, dbResult[0].strategyId))
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
      return res.status(404).json({
        error: 'Rebalance not found',
      });
    }

    // Fetch strategy details
    const strategy = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, execution.strategyId))
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
    return res.status(500).json({
      error: 'Failed to fetch rebalance status',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// DELETE /v1/yuki/rebalancing/:id
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Cancel a rebalancing execution
 * FROM: POST /:id/cancel
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await dexRoutingExecution.cancelRebalance(id);

    if (!success) {
      return res.status(400).json({
        error: 'Cannot cancel rebalance - already executing or completed',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Rebalance cancelled',
      rebalanceId: id,
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error cancelling rebalance:', error);
    return res.status(500).json({
      error: 'Failed to cancel rebalance',
    });
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
router.get('/strategy/:strategyId/history', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Validate strategy exists in database
    const strategyRecord = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, strategyId))
      .limit(1);

    if (strategyRecord.length === 0) {
      return res.status(404).json({
        error: `Strategy ${strategyId} not found`,
      });
    }

    // Query rebalance history with proper drizzle-orm syntax
    const rebalances = await db
      .select()
      .from(strategyRebalancesTable)
      .where(eq(strategyRebalancesTable.strategyId, strategyId))
      .limit(Number(limit) || 20)
      .offset(Number(offset) || 0);

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
    return res.status(500).json({
      error: 'Failed to fetch rebalance history',
    });
  }
});

export default router;
