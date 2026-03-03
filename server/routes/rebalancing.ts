/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REBALANCING API ROUTES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * API endpoints for strategy rebalancing execution:
 * • Trigger rebalancing with allocation changes
 * • View rebalancing history and status
 * • Estimate rebalancing costs
 * • Cancel pending rebalances
 */

import express, { Request, Response } from 'express';
import { Logger } from '../utils/logger';
import { dexRoutingExecution } from '../services/dexRoutingExecution';
import { db } from '../db';
import { authenticate } from '../auth';
import { strategiesTable, strategyRebalancesTable } from '../db/schema/strategies';
import { eq } from 'drizzle-orm';

const logger = Logger.getLogger();
const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════════

// All rebalancing operations require authentication
router.use(authenticate);

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/rebalancing/trigger
// ════════════════════════════════════════════════════════════════════════════════

router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { strategyId, orders, chain = 'ethereum', maxSlippagePercent = 0.5 } = req.body;

    if (!strategyId || !orders || orders.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: strategyId, orders',
      });
    }

    // Validate orders format
    for (const order of orders) {
      if (!order.asset || !order.action || !order.amount || !order.amountUsd) {
        return res.status(400).json({
          error: 'Invalid order format. Required: asset, action, amount, amountUsd',
        });
      }
    }

    logger.info(`[RebalancingAPI] Triggering rebalance for strategy: ${strategyId}`);

    // Execute rebalancing
    const rebalanceId = await dexRoutingExecution.executeRebalance({
      strategyId,
      orders,
      chain,
      maxSlippagePercent,
    });

    return res.status(200).json({
      success: true,
      rebalanceId,
      status: 'pending',
      orders: orders.length,
      estimatedImpact: 'pending',
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error triggering rebalance:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Rebalancing failed',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/rebalancing/:rebalanceId
// ════════════════════════════════════════════════════════════════════════════════

router.get('/:rebalanceId', async (req: Request, res: Response) => {
  try {
    const { rebalanceId } = req.params;

    // Get from database first
    const dbResult = await db.select().from(strategyRebalancesTable).where(eq(strategyRebalancesTable.id, rebalanceId));

    if (dbResult.length > 0) {
      return res.status(200).json({
        success: true,
        rebalance: {
          id: dbResult[0].id,
          strategyId: dbResult[0].strategyId,
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
      });
    }

    // Check active memory
    const execution = dexRoutingExecution.getExecutionStatus(rebalanceId);

    if (!execution) {
      return res.status(404).json({
        error: 'Rebalance not found',
      });
    }

    return res.status(200).json({
      success: true,
      rebalance: {
        id: execution.rebalanceId,
        strategyId: execution.strategyId,
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
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error fetching rebalance status:', error);
    return res.status(500).json({
      error: 'Failed to fetch rebalance status',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/rebalancing/strategy/:strategyId/history
// ════════════════════════════════════════════════════════════════════════════════

router.get('/strategy/:strategyId/history', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const rebalances = await db
      .select()
      .from(strategyRebalancesTable)
      .where(eq(strategyRebalancesTable.strategyId, strategyId))
      .limit(Number(limit))
      .offset(Number(offset));

    return res.status(200).json({
      success: true,
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
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error fetching rebalance history:', error);
    return res.status(500).json({
      error: 'Failed to fetch rebalance history',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/rebalancing/:rebalanceId/cancel
// ════════════════════════════════════════════════════════════════════════════════

router.post('/:rebalanceId/cancel', async (req: Request, res: Response) => {
  try {
    const { rebalanceId } = req.params;

    const success = await dexRoutingExecution.cancelRebalance(rebalanceId);

    if (!success) {
      return res.status(400).json({
        error: 'Cannot cancel rebalance - already executing or completed',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Rebalance cancelled',
      rebalanceId,
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error cancelling rebalance:', error);
    return res.status(500).json({
      error: 'Failed to cancel rebalance',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/rebalancing/estimate
// ════════════════════════════════════════════════════════════════════════════════

router.post('/estimate', async (req: Request, res: Response) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({
        error: 'orders array is required',
      });
    }

    const estimate = dexRoutingExecution.estimateRebalanceCost(orders);

    return res.status(200).json({
      success: true,
      estimate: {
        gasEstimateUsd: estimate.estimatedGasUsd,
        slippageEstimateUsd: estimate.estimatedSlippageUsd,
        totalCostUsd: estimate.totalCostUsd,
        impactPercent: estimate.impactPercent,
        orders: orders.length,
      },
    });
  } catch (error) {
    logger.error('[RebalancingAPI] Error estimating costs:', error);
    return res.status(500).json({
      error: 'Failed to estimate rebalancing costs',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// NEW RESTful ENDPOINTS (RECOMMENDED)
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/rebalancing/active - List active rebalancing executions
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
// DEPRECATED ENDPOINTS (Keep for 6 months, then remove)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use GET /api/rebalancing/active instead
 * Sunset: 2026-09-01
 */
// GET /api/rebalancing/active/list - List active rebalancing executions
router.get('/active/list', async (req: Request, res: Response) => {
  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', '</api/rebalancing/active>; rel="successor-version"');
  res.setHeader('Warning', '299 - "GET /api/rebalancing/active/list is deprecated. Use GET /api/rebalancing/active instead"');

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

export default router;
