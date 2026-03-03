/**
 * ⚠️  DEPRECATED - CONSOLIDATED INTO strategiesConsolidated.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * THIS FILE IS DEPRECATED (Sunset: 2026-09-01)
 * 
 * All endpoints from this file have been consolidated into:
 * 👉 server/routes/strategiesConsolidated.ts
 * 
 * ENDPOINTS CONSOLIDATED:
 * • Strategy creation with backtesting
 * • Strategy deployment to Freqtrade
 * • Performance metrics retrieval
 * • Parameter optimization
 * • User following/follower management
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * This file will be DELETED on or after 2026-09-01.
 * Please use /api/strategies/* instead of /api/strategies/*
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response } from 'express';
import { Logger } from '../utils/logger';
import { strategyFreqtradeIntegration } from '../services/strategyFreqtradeIntegration';
import { strategyDashboardService } from '../services/strategyDashboardService';
import { db } from '../db';
import { strategiesTable, strategyFollowersTable } from '../db/schema/strategies';
import { eq } from 'drizzle-orm';

const logger = Logger.getLogger();
const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/strategies/create
// ════════════════════════════════════════════════════════════════════════════════

router.post('/create', async (req: Request, res: Response) => {
  try {
    const {
      creatorId,
      name,
      description,
      allocations, // [{ asset: "ETH", weight: 0.4 }, { asset: "USDC", weight: 0.3 }]
      freqtradeStrategyCode,
      backtestRequest,
      riskLevel = 'medium',
    } = req.body;

    if (!creatorId || !name) {
      return res.status(400).json({
        error: 'Missing required fields: creatorId, name',
      });
    }

    if (!allocations || allocations.length === 0) {
      return res.status(400).json({
        error: 'allocations array is required',
      });
    }

    logger.info(`[StrategyAPI] Creating strategy: ${name} by ${creatorId}`);

    // Create strategy with optional Freqtrade integration
    const strategyId = await strategyFreqtradeIntegration.createStrategyWithFreqtrade({
      creatorId,
      name,
      description,
      allocations,
      freqtradeStrategyCode,
      backtestRequest: backtestRequest
        ? {
            strategyId: `temp_${Date.now()}`, // Will be replaced
            strategyCode: freqtradeStrategyCode,
            pair: backtestRequest.pair || 'BTC/USDT',
            timeframe: backtestRequest.timeframe || '1h',
            timerange: backtestRequest.timerange || '20230101-20231231',
            stakeAmount: backtestRequest.stakeAmount || 100,
            enableOptimization: backtestRequest.enableOptimization || false,
          }
        : undefined,
    });

    if (!strategyId) {
      return res.status(500).json({
        error: 'Failed to create strategy',
      });
    }

    return res.status(201).json({
      success: true,
      strategyId,
      name,
      status: 'active',
      backtestedAt: backtestRequest ? new Date() : null,
      allocations,
    });
  } catch (error) {
    logger.error('[StrategyAPI] Error creating strategy:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Strategy creation failed',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/strategies/:strategyId/backtest
// ════════════════════════════════════════════════════════════════════════════════

router.post('/:strategyId/backtest', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const { pair = 'BTC/USDT', timeframe = '1h', timerange = '20230101-20231231', stakeAmount = 100 } = req.body;

    logger.info(`[StrategyAPI] Starting backtest for strategy: ${strategyId}`);

    // Queue backtest
    const statusId = await strategyFreqtradeIntegration.queueBacktest({
      strategyId,
      pair,
      timeframe,
      timerange,
      stakeAmount,
      enableOptimization: false,
    });

    return res.status(200).json({
      success: true,
      statusId,
      strategyId,
      status: 'pending',
      pair,
      timeframe,
      timerange,
    });
  } catch (error) {
    logger.error('[StrategyAPI] Error queuing backtest:', error);
    return res.status(500).json({
      error: 'Failed to queue backtest',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/strategies/:strategyId/backtest/:statusId
// ════════════════════════════════════════════════════════════════════════════════

router.get('/:strategyId/backtest/:statusId', async (req: Request, res: Response) => {
  try {
    const { statusId } = req.params;

    const result = strategyFreqtradeIntegration.getBacktestStatus(statusId);

    if (!result) {
      return res.status(404).json({
        error: 'Backtest not found',
      });
    }

    return res.status(200).json({
      success: true,
      statusId: result.statusId,
      status: result.status,
      metrics: result.metrics,
      requestedAt: new Date(result.requestedAt),
      completedAt: result.completedAt ? new Date(result.completedAt) : null,
      durationMs: result.durationMs,
    });
  } catch (error) {
    logger.error('[StrategyAPI] Error fetching backtest status:', error);
    return res.status(500).json({
      error: 'Failed to fetch backtest status',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/strategies/:strategyId
// ════════════════════════════════════════════════════════════════════════════════

router.get('/:strategyId', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const strategies = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId));

    if (strategies.length === 0) {
      return res.status(404).json({
        error: 'Strategy not found',
      });
    }

    const strategy = strategies[0];

    return res.status(200).json({
      success: true,
      strategy: {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        creatorId: strategy.creatorId,
        status: strategy.isActive ? 'active' : 'inactive',
        targetAllocations: strategy.targetAllocations,
        rebalanceFrequency: strategy.rebalanceFrequency,
        riskLevel: strategy.riskLevel,
        freqtradeStrategyId: strategy.freqtradeStrategyId,
        backtestResults: strategy.backtestResults,
        performance: {
          ytdReturn: strategy.ytdReturnPercent,
          sharpeRatio: strategy.sharpeRatio,
          maxDrawdown: strategy.maxDrawdownPercent,
          volatility: strategy.volatilityPercent,
        },
        totalFollowers: strategy.totalFollowers,
        assetsUnderManagement: strategy.assetsUnderManagement,
        createdAt: strategy.createdAt,
        updatedAt: strategy.updatedAt,
      },
    });
  } catch (error) {
    logger.error('[StrategyAPI] Error fetching strategy:', error);
    return res.status(500).json({
      error: 'Failed to fetch strategy',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/strategies?sortBy=sharpe|return|followers&limit=20
// ════════════════════════════════════════════════════════════════════════════════

router.get('/', async (req: Request, res: Response) => {
  try {
    const { sortBy = 'sharpe', limit = 20 } = req.query;

    let metric: 'sharpe' | 'return' | 'drawdown' = 'sharpe';

    if (sortBy === 'return') {
      metric = 'return';
    } else if (sortBy === 'followers') {
      metric = 'return'; // Can extend this
    }

    const strategies = await strategyFreqtradeIntegration.getStrategiesByPerformance(metric, Number(limit));

    return res.status(200).json({
      success: true,
      total: strategies.length,
      strategies: strategies.map((s) => ({
        id: s.id,
        name: s.name,
        creator: s.creatorId,
        sharpeRatio: s.sharpeRatio,
        ytdReturn: s.ytdReturnPercent,
        totalFollowers: s.totalFollowers,
        aum: s.assetsUnderManagement,
      })),
    });
  } catch (error) {
    logger.error('[StrategyAPI] Error fetching strategies:', error);
    return res.status(500).json({
      error: 'Failed to fetch strategies',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/strategies/:strategyId/optimize
// ════════════════════════════════════════════════════════════════════════════════

router.post('/:strategyId/optimize', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const { timeframe, timerange, trials = 50 } = req.body;

    logger.info(`[StrategyAPI] Starting optimization for strategy: ${strategyId}`);

    const statusId = await strategyFreqtradeIntegration.optimizeStrategyParameters(strategyId, {
      timeframe,
      timerange,
      trials,
    });

    return res.status(200).json({
      success: true,
      statusId,
      strategyId,
      status: 'pending',
      trials,
      message: `Optimization queued with ${trials} trials`,
    });
  } catch (error) {
    logger.error('[StrategyAPI] Error optimizing strategy:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Optimization failed',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/strategies/:strategyId/follow
// ════════════════════════════════════════════════════════════════════════════════

router.post('/:strategyId/follow', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const { followerId, investedAmountUsd, autoRebalance = true, maxSlippagePercent = 0.5 } = req.body;

    if (!followerId || !investedAmountUsd) {
      return res.status(400).json({
        error: 'Missing required fields: followerId, investedAmountUsd',
      });
    }

    logger.info(`[StrategyAPI] User ${followerId} following strategy ${strategyId} with ${investedAmountUsd} USD`);

    // Add follower to database
    const followId = `follow_${strategyId}_${followerId}_${Date.now()}`;

    await db.insert(strategyFollowersTable).values({
      id: followId,
      strategyId,
      followerId,
      investedAmountUsd: String(investedAmountUsd),
      currentValueUsd: String(investedAmountUsd),
      returnUsd: '0',
      returnPercent: '0',
      autoRebalance,
      maxSlippagePercent: String(maxSlippagePercent),
      followedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      followerId,
      strategyId,
      investedAmount: investedAmountUsd,
      status: 'active',
      autoRebalance,
    });
  } catch (error) {
    logger.error('[StrategyAPI] Error following strategy:', error);
    return res.status(500).json({
      error: 'Failed to follow strategy',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/strategies/:strategyId/followers
// ════════════════════════════════════════════════════════════════════════════════

router.get('/:strategyId/followers', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const followers = await db
      .select()
      .from(strategyFollowersTable)
      .where(eq(strategyFollowersTable.strategyId, strategyId));

    return res.status(200).json({
      success: true,
      strategyId,
      totalFollowers: followers.length,
      followers: followers.map((f) => ({
        followerId: f.followerId,
        investedAmount: f.investedAmountUsd,
        currentValue: f.currentValueUsd,
        return: { usd: f.returnUsd, percent: f.returnPercent },
        autoRebalance: f.autoRebalance,
        followedAt: f.followedAt,
      })),
    });
  } catch (error) {
    logger.error('[StrategyAPI] Error fetching followers:', error);
    return res.status(500).json({
      error: 'Failed to fetch followers',
    });
  }
});

export default router;
