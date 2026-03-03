/**
 * ⚠️  DEPRECATED - CONSOLIDATED INTO strategiesConsolidated.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * THIS FILE IS DEPRECATED (Sunset: 2026-09-01)
 * 
 * All endpoints from this file have been consolidated into:
 * 👉 server/routes/strategiesConsolidated.ts
 * 
 * API PATH MIGRATION:
 * OLD Path: /api/strategy/*
 * NEW Path: /api/strategies/*
 * 
 * Examples:
 * - POST /api/strategy/create          → POST /api/strategies
 * - GET  /api/strategy/:id             → GET  /api/strategies/:id
 * - POST /api/strategy/:id/follow      → POST /api/strategies/:id/follow
 * - GET  /api/strategy/leaderboard/:m  → GET  /api/strategies/rankings/:m
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * This file will be DELETED on or after 2026-09-01.
 * Please update your API calls to use /api/strategies instead of /api/strategy
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response } from 'express';
import { strategyDashboardService } from '../services/strategyDashboardService';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();
const router = express.Router();

// Middleware to extract user ID
function extractUserId(req: any): string {
  return req.user?.id || req.query.userId || 'test-user';
}

// ════════════════════════════════════════════════════════════════════════════════
// NEW RESTful ENDPOINT (RECOMMENDED)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/strategy
 * Deploy a new strategy
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    const {
      name,
      description,
      allocations,
      rebalanceFrequencyDays = 7,
      tags = [],
      riskLevel = 'medium',
    } = req.body;

    logger.info(`[Strategy] Creating strategy "${name}" by ${userId}`);

    if (!name || !allocations || allocations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Strategy name and allocations are required',
      });
    }

    const strategy = await strategyDashboardService.createStrategy({
      creatorId: userId,
      name,
      description,
      allocations,
      rebalanceFrequencyDays,
      tags,
      riskLevel,
    });

    res.json({
      success: true,
      message: 'Strategy created successfully',
      data: strategy,
    });
  } catch (error) {
    logger.error('[Strategy] Create strategy error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// DEPRECATED ENDPOINT (Keep for 6 months, then remove)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use POST /api/strategy instead
 * Sunset: 2026-09-01
 * 
 * POST /api/strategy/create
 * Deploy a new strategy
 */
router.post('/create', async (req: Request, res: Response) => {
  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', '</api/strategy>; rel="successor-version"');
  res.setHeader('Warning', '299 - "POST /api/strategy/create is deprecated. Use POST /api/strategy instead"');

  try {
    const userId = extractUserId(req);
    const {
      name,
      description,
      allocations,
      rebalanceFrequencyDays = 7,
      tags = [],
      riskLevel = 'medium',
    } = req.body;

    logger.info(`[Strategy] Creating strategy "${name}" by ${userId}`);

    if (!name || !allocations || allocations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Strategy name and allocations are required',
      });
    }

    const strategy = await strategyDashboardService.createStrategy({
      creatorId: userId,
      name,
      description,
      allocations,
      rebalanceFrequencyDays,
      tags,
      riskLevel,
    });

    res.json({
      success: true,
      message: 'Strategy created successfully',
      data: strategy,
    });
  } catch (error) {
    logger.error('[Strategy] Create strategy error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/strategy/:strategyId
 * Get strategy details
 */
router.get('/:strategyId', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const strategy = await strategyDashboardService.getStrategy(strategyId);

    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found',
      });
    }

    res.json({
      success: true,
      data: strategy,
    });
  } catch (error) {
    logger.error('[Strategy] Get strategy error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/strategy/:strategyId/follow
 * User copies (follows) a strategy
 */
router.post('/:strategyId/follow', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    const { strategyId } = req.params;
    const { investAmount, maxSlippage = 0.5, autoRebalance = true } = req.body;

    logger.info(`[Strategy] User ${userId} following strategy ${strategyId}`);

    if (!investAmount || investAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid invest amount is required',
      });
    }

    const follower = await strategyDashboardService.followStrategy(
      strategyId,
      userId,
      investAmount,
      {
        maxSlippage,
        autoRebalance,
      }
    );

    res.json({
      success: true,
      message: 'Strategy followed successfully',
      data: follower,
    });
  } catch (error) {
    logger.error('[Strategy] Follow strategy error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/strategy/:strategyId/unfollow
 * User stops following a strategy
 */
router.post('/:strategyId/unfollow', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    const { strategyId } = req.params;

    logger.info(`[Strategy] User ${userId} unfollowing strategy ${strategyId}`);

    await strategyDashboardService.unfollowStrategy(strategyId, userId);

    res.json({
      success: true,
      message: 'Strategy unfollowed successfully',
    });
  } catch (error) {
    logger.error('[Strategy] Unfollow strategy error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/strategy/:strategyId/rebalance
 * Trigger rebalancing for a strategy
 */
router.post('/:strategyId/rebalance', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    const { strategyId } = req.params;

    logger.info(`[Strategy] Rebalancing strategy ${strategyId}`);

    // Check if user is creator of this strategy
    const strategy = await strategyDashboardService.getStrategy(strategyId);
    if (strategy?.creator !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only strategy creator can trigger rebalancing',
      });
    }

    const rebalance = await strategyDashboardService.triggerRebalance(strategyId);

    res.json({
      success: true,
      message: 'Rebalancing triggered',
      data: rebalance,
    });
  } catch (error) {
    logger.error('[Strategy] Rebalance error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/strategy/:strategyId/performance
 * Strategy performance metrics
 */
router.get('/:strategyId/performance', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const performance = await strategyDashboardService.getStrategyPerformance(strategyId);

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    logger.error('[Strategy] Performance endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/strategy/leaderboard/:metric
 * Strategy leaderboard (AUM, followers, return, Sharpe)
 */
router.get('/leaderboard/:metric', async (req: Request, res: Response) => {
  try {
    const { metric } = req.params;
    const { limit = 10 } = req.query;

    const validMetrics = ['aum', 'followers', 'return', 'sharpe'];
    if (!validMetrics.includes(metric.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid metric. Valid options: ${validMetrics.join(', ')}`,
      });
    }

    const leaderboard = await strategyDashboardService.getStrategyLeaderboard(
      metric.toLowerCase(),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      metric,
      data: leaderboard,
    });
  } catch (error) {
    logger.error('[Strategy] Leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/strategy/my-strategies
 * User's followed/copied strategies
 */
router.get('/my/followed', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);

    logger.debug(`[Strategy] Loading followed strategies for ${userId}`);

    const strategies = await strategyDashboardService.getUserFollowedStrategies(userId);

    res.json({
      success: true,
      data: strategies,
      count: strategies.length,
    });
  } catch (error) {
    logger.error('[Strategy] Followed strategies error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/strategy/created
 * User's created strategies
 */
router.get('/my/created', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);

    logger.debug(`[Strategy] Loading created strategies for ${userId}`);

    const strategies = await strategyDashboardService.getUserCreatedStrategies(userId);

    res.json({
      success: true,
      data: strategies,
      count: strategies.length,
    });
  } catch (error) {
    logger.error('[Strategy] Created strategies error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/strategy/search
 * Search strategies
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { query = '', tags = [], minAPY = 0, maxRisk = 100 } = req.query;

    logger.debug(`[Strategy] Searching strategies: query="${query}"`);

    const results = await strategyDashboardService.searchStrategies(
      query as string,
      Array.isArray(tags) ? (tags as string[]) : [(tags as string)].filter(Boolean),
      {
        minAPY: parseFloat(minAPY as string),
        maxRisk: parseFloat(maxRisk as string),
      }
    );

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    logger.error('[Strategy] Search error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/strategy/trending
 * Trending strategies
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = await strategyDashboardService.getStrategyLeaderboard(
      'followers',
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: leaderboard,
      count: leaderboard.length,
    });
  } catch (error) {
    logger.error('[Strategy] Trending error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// NEW RESTful ENDPOINT (RECOMMENDED)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/strategy/:strategyId/rules
 * Add a rule to a strategy (non-destructive action)
 */
router.post('/:strategyId/rules', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const userId = extractUserId(req);
    const { name, condition, action, priority = 100, isActive = true } = req.body;

    logger.info(`[Strategy] Adding rule to strategy ${strategyId}`);

    if (!name || !condition || !action) {
      return res.status(400).json({
        success: false,
        error: 'Rule name, condition, and action are required',
      });
    }

    const rule = await strategyDashboardService.addStrategyRule({
      strategyId,
      name,
      condition,
      action,
      priority,
      isActive,
      createdBy: userId,
    });

    res.json({
      success: true,
      message: 'Rule added to strategy successfully',
      data: rule,
    });
  } catch (error) {
    logger.error('[Strategy] Add rule error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// DEPRECATED ENDPOINT (Keep for 6 months, then remove)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use POST /api/strategy/:strategyId/rules instead
 * Sunset: 2026-09-01
 */
// POST /api/strategy/:strategyId/add - Add something to a strategy (legacy)
router.post('/:strategyId/add', async (req: Request, res: Response) => {
  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', '</api/strategy/:strategyId/rules>; rel="successor-version"');
  res.setHeader('Warning', '299 - "POST /api/strategy/:strategyId/add is deprecated. Use POST /api/strategy/:strategyId/rules instead"');

  try {
    const { strategyId } = req.params;
    const userId = extractUserId(req);
    const { name, condition, action, priority = 100, isActive = true } = req.body;

    logger.info(`[Strategy] Adding rule to strategy ${strategyId}`);

    if (!name || !condition || !action) {
      return res.status(400).json({
        success: false,
        error: 'Rule name, condition, and action are required',
      });
    }

    const rule = await strategyDashboardService.addStrategyRule({
      strategyId,
      name,
      condition,
      action,
      priority,
      isActive,
      createdBy: userId,
    });

    res.json({
      success: true,
      message: 'Rule added to strategy successfully',
      data: rule,
    });
  } catch (error) {
    logger.error('[Strategy] Add rule error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
