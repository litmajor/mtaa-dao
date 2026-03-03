/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONSOLIDATED STRATEGIES API ROUTER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * UNIFIED ENDPOINT FOR ALL STRATEGY OPERATIONS
 * 
 * This router consolidates endpoints from:
 * - strategy.ts (Strategy Dashboard)
 * - strategyDeployment.ts (Freqtrade Integration)
 * 
 * Core Endpoints:
 * ├── Strategy Management
 * │   ├── POST   /api/strategies                    → Create new strategy
 * │   ├── GET    /api/strategies/:strategyId        → Get strategy details
 * │   ├── PUT    /api/strategies/:strategyId        → Update strategy
 * │   ├── DELETE /api/strategies/:strategyId        → Deactivate strategy
 * │
 * ├── User Interactions
 * │   ├── GET    /api/strategies/my/created         → User's deployed strategies
 * │   ├── GET    /api/strategies/my/followed        → User's copied strategies
 * │   ├── POST   /api/strategies/:strategyId/follow → Copy strategy
 * │   └── DELETE /api/strategies/:strategyId/follow → Stop copying
 * │
 * ├── Performance & Analytics
 * │   ├── GET    /api/strategies/:strategyId/performance → Metrics
 * │   ├── GET    /api/strategies/:strategyId/backtest   → Backtest results
 * │   ├── POST   /api/strategies/:strategyId/backtest   → Run backtest
 * │   └── GET    /api/strategies/rankings/:metric       → Leaderboards
 * │
 * ├── Operations
 * │   ├── POST   /api/strategies/:strategyId/rebalance → Manual rebalance
 * │   ├── POST   /api/strategies/:strategyId/deploy    → Deploy to Freqtrade
 * │   └── POST   /api/strategies/:strategyId/optimize  → Parameter optimization
 * │
 * └── Discovery
 *     ├── GET    /api/strategies                  → List all strategies
 *     └── GET    /api/strategies/search           → Search & filter
 * 
 * BACKWARDS COMPATIBILITY:
 * - Old endpoints in /api/strategy (singular) are deprecated
 * - Old endpoints in /api/strategies with /create are deprecated
 * - Will be removed in v2.0 with 6-month deprecation notice
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, NextFunction } from 'express';
import { strategyDashboardService } from '../services/strategyDashboardService';
import { strategyFreqtradeIntegration } from '../services/strategyFreqtradeIntegration';
import { Logger } from '../utils/logger';
import { db } from '../db';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { jobQueueService } from '../services/jobQueueService';
import { strategiesTable, strategyFollowersTable } from '../db/schema/strategies';
import { eq } from 'drizzle-orm';

const logger = Logger.getLogger();
const router = express.Router();

/**
 * Helper: Verify strategy ownership or DAO admin access
 */
async function verifyStrategyAccess(strategyId: string, userId: string, requiredAdmin = false): Promise<{ allowed: boolean; error?: string; strategy?: any }> {
  try {
    const strategy = await strategyDashboardService.getStrategyDetails(strategyId);
    if (!strategy) {
      return { allowed: false, error: 'Strategy not found' };
    }

    // Check ownership
    if (strategy.creator === userId) {
      return { allowed: true, strategy };
    }

    return { allowed: false, error: 'Unauthorized: You do not have access to this strategy' };
  } catch (e) {
    return { allowed: false, error: 'Error verifying access' };
  }
}


/**
 * Middleware: Require authentication for sensitive operations
 */
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId || req.query.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: User ID required'
    });
  }
  (req as any).userId = userId;
  next();
}

/**
 * Middleware: Add deprecation headers (for deprecated endpoints)
 */
function addDeprecationHeaders(deprecationDate: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', deprecationDate);
    res.setHeader('Warning', `299 - "This endpoint is deprecated. Use consolidated endpoints at /api/strategies instead"`);
    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGY MANAGEMENT - Core CRUD Operations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/strategies
 * List all strategies with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { skip = 0, limit = 20, riskLevel, tags, sortBy = 'createdAt' } = req.query;

    const filters: any = {};
    if (riskLevel) filters.riskLevel = riskLevel;
    if (tags) filters.tags = { contains: tags };

    const strategies = await strategyDashboardService.listStrategies({
      skip: parseInt(skip as string),
      limit: parseInt(limit as string),
      filters,
      sortBy: sortBy as string
    });

    res.json({
      success: true,
      data: strategies
    });
  } catch (error) {
    logger.error('[Strategies] List error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list strategies'
    });
  }
});

/**
 * POST /api/strategies
 * Create a new strategy (RESTful)
 */
router.post('/', [requireAuth, rateLimitPerUser('strategy-create', 10, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      name,
      description,
      allocations,
      rebalanceFrequencyDays = 7,
      tags = [],
      riskLevel = 'medium',
      freqtradeStrategyCode,
      backtestRequest
    } = req.body;

    if (!name || !allocations || allocations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Strategy name and allocations are required'
      });
    }

    logger.info(`[Strategies] Creating strategy "${name}" by ${userId}`);

    // If Freqtrade integration requested, use specialized handler
    let strategy;
    if (freqtradeStrategyCode) {
      const strategyId = await strategyFreqtradeIntegration.createStrategyWithFreqtrade({
        creatorId: userId,
        name,
        description,
        allocations,
        freqtradeStrategyCode,
        backtestRequest: backtestRequest ? {
          strategyId: `temp_${Date.now()}`,
          strategyCode: freqtradeStrategyCode,
          pair: backtestRequest.pair || 'BTC/USDT',
          timeframe: backtestRequest.timeframe || '1h',
          timerange: backtestRequest.timerange || '20230101-20231231',
          stakeAmount: backtestRequest.stakeAmount || 100,
          enableOptimization: backtestRequest.enableOptimization || false
        } : undefined
      });
      strategy = { id: strategyId, ...req.body };
    } else {
      // Regular strategy creation
      strategy = await strategyDashboardService.createStrategy({
        creatorId: userId,
        name,
        description,
        allocations,
        rebalanceFrequencyDays,
        tags,
        riskLevel
      });
    }

    res.status(201).json({
      success: true,
      message: 'Strategy created successfully',
      data: strategy
    });
  } catch (error) {
    logger.error('[Strategies] Create error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create strategy'
    });
  }
});

/**
 * GET /api/strategies/:strategyId
 * Get strategy details (public for discovery, but user can see additional details if owner or DAO member)
 */
router.get('/:strategyId', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const userId = (req as any).userId;

    const strategy = await strategyDashboardService.getStrategyDetails(strategyId);

    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found'
      });
    }

    // If user is authenticated, check if they're owner  for additional details
    let isOwner = false;
    if (userId) {
      isOwner = strategy.creator === userId;
    }

    res.json({
      success: true,
      data: strategy,
      userContext: userId ? { isOwner } : null
    });
  } catch (error) {
    logger.error('[Strategies] Get details error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get strategy'
    });
  }
});

/**
 * PUT /api/strategies/:strategyId
 * Update strategy
 */
router.put('/:strategyId', [requireAuth, rateLimitPerUser('strategy-update', 30, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;
    const { name, description, allocations, rebalanceFrequencyDays, tags, riskLevel } = req.body;

    // Verify ownership
    const strategy = await strategyDashboardService.getStrategyDetails(strategyId);
    if (!strategy || strategy.creator !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You can only update your own strategies'
      });
    }

    const updated = await strategyDashboardService.updateStrategy(strategyId, {
      name,
      description,
      tags,
      riskLevel
    });

    res.json({
      success: true,
      message: 'Strategy updated successfully',
      data: updated
    });
  } catch (error) {
    logger.error('[Strategies] Update error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update strategy'
    });
  }
});

/**
 * DELETE /api/strategies/:strategyId
 * Deactivate strategy
 */
router.delete('/:strategyId', [requireAuth, rateLimitPerUser('strategy-delete', 10, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;

    // Verify ownership
    const strategy = await strategyDashboardService.getStrategyDetails(strategyId);
    if (!strategy || strategy.creator !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You can only delete your own strategies'
      });
    }

    await strategyDashboardService.deactivateStrategy(strategyId);

    res.json({
      success: true,
      message: 'Strategy deactivated successfully'
    });
  } catch (error) {
    logger.error('[Strategies] Delete error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete strategy'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER INTERACTIONS - My Strategies & Following
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/strategies/my/created
 * Get user's created strategies
 */
router.get('/my/created', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const strategies = await strategyDashboardService.getUserCreatedStrategies(userId);

    res.json({
      success: true,
      data: strategies
    });
  } catch (error) {
    logger.error('[Strategies] My created error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch created strategies'
    });
  }
});

/**
 * GET /api/strategies/my/followed
 * Get user's followed strategies
 */
router.get('/my/followed', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const strategies = await strategyDashboardService.getUserFollowedStrategies(userId);

    res.json({
      success: true,
      data: strategies
    });
  } catch (error) {
    logger.error('[Strategies] My followed error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch followed strategies'
    });
  }
});

/**
 * POST /api/strategies/:strategyId/follow
 * User copies/follows a strategy
 */
router.post('/:strategyId/follow', [requireAuth, rateLimitPerUser('strategy-follow', 30, '5min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;
    const { investAmount = 100 } = req.body;

    const result = await strategyDashboardService.followStrategy(strategyId, userId, investAmount);

    res.status(201).json({
      success: true,
      message: 'Strategy followed successfully',
      data: result
    });
  } catch (error) {
    logger.error('[Strategies] Follow error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to follow strategy'
    });
  }
});

/**
 * DELETE /api/strategies/:strategyId/follow
 * User stops following a strategy
 */
router.delete('/:strategyId/follow', [requireAuth, rateLimitPerUser('strategy-unfollow', 30, '5min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;

    await strategyDashboardService.unfollowStrategy(userId, strategyId);

    res.json({
      success: true,
      message: 'Strategy unfollowed successfully'
    });
  } catch (error) {
    logger.error('[Strategies] Unfollow error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unfollow strategy'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE & ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/strategies/:strategyId/performance
 * Get strategy performance metrics
 */
router.get('/:strategyId/performance', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const performance = await strategyDashboardService.getStrategyPerformance(strategyId);

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error('[Strategies] Performance error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get performance metrics'
    });
  }
});

/**
 * GET /api/strategies/:strategyId/backtest
 * Get backtest results
 */
router.get('/:strategyId/backtest', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const results = await strategyFreqtradeIntegration.getStrategyBacktestResults(strategyId);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('[Strategies] Get backtest error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get backtest results'
    });
  }
});

/**
 * POST /api/strategies/:strategyId/backtest
 * Queue backtest job (returns immediately with job ID)
 */
router.post('/:strategyId/backtest', [requireAuth, rateLimitPerUser('strategy-backtest', 20, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;
    const {
      pair = 'BTC/USDT',
      timeframe = '1h',
      timerange = '20230101-20231231',
      stakeAmount = 100,
      enableOptimization = false
    } = req.body;

    // Queue backtest job
    const jobId = await jobQueueService.queueJob('strategy-backtest', {
      userId,
      strategyId,
      pair,
      timeframe,
      timerange,
      stakeAmount,
      enableOptimization
    }, {
      priority: 6,
      timeout: 1800000 // 30 minute timeout for backtest
    });

    res.status(202).json({
      success: true,
      message: 'Backtest queued',
      jobId,
      statusUrl: `/api/strategies/${strategyId}/backtest-status/${jobId}`
    });
  } catch (error) {
    logger.error('[Strategies] Backtest queue error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue backtest'
    });
  }
});

/**
 * GET /api/strategies/rankings/:metric
 * Get leaderboard of top strategies
 */
router.get('/rankings/:metric', async (req: Request, res: Response) => {
  try {
    const { metric } = req.params;
    const { limit = 20 } = req.query;

    const rankings = await strategyDashboardService.getStrategyRankings(
      metric as string,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: rankings
    });
  } catch (error) {
    logger.error('[Strategies] Rankings error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get rankings'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OPERATIONS - Execution, Rebalancing, Deployment
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/strategies/:strategyId/rebalance
 * Manually trigger rebalancing
 */
router.post('/:strategyId/rebalance', [requireAuth, rateLimitPerUser('strategy-rebalance', 10, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;

    const result = await strategyDashboardService.rebalanceStrategy(strategyId);

    res.json({
      success: true,
      message: 'Rebalancing triggered successfully',
      data: result
    });
  } catch (error) {
    logger.error('[Strategies] Rebalance error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rebalance strategy'
    });
  }
});

/**
 * POST /api/strategies/:strategyId/deploy
 * Deploy strategy to Freqtrade
 */
router.post('/:strategyId/deploy', [requireAuth, rateLimitPerUser('strategy-deploy', 10, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;
    const { dryRun = false } = req.body;

    const result = await strategyFreqtradeIntegration.deployStrategy(
      strategyId,
      userId,
      dryRun
    );

    res.json({
      success: true,
      message: 'Strategy deployed successfully',
      data: result
    });
  } catch (error) {
    logger.error('[Strategies] Deploy error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deploy strategy'
    });
  }
});

/**
 * POST /api/strategies/:strategyId/optimize
 * Queue optimization job (returns immediately with job ID)
 */
router.post('/:strategyId/optimize', [requireAuth, rateLimitPerUser('strategy-optimize', 10, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;
    const { parameters, optimizer = 'hyperopt' } = req.body;

    // Queue optimization job
    const jobId = await jobQueueService.queueJob('strategy-optimize', {
      userId,
      strategyId,
      optimizationParams: parameters,
      optimizer
    }, {
      priority: 5,
      timeout: 3600000 // 60 minute timeout for optimization
    });

    res.status(202).json({
      success: true,
      message: 'Optimization queued',
      jobId,
      statusUrl: `/api/strategies/${strategyId}/optimize-status/${jobId}`
    });
  } catch (error) {
    logger.error('[Strategies] Optimize queue error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue optimization'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DISCOVERY & SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/strategies/search
 * Search and filter strategies
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const {
      q,
      riskLevel,
      tags,
      minReturn,
      maxDrawdown,
      sortBy = 'popularity'
    } = req.query;

    const results = await strategyDashboardService.searchStrategies({
      query: q as string,
      filters: {
        riskLevel: riskLevel as string,
        tags: tags ? (tags as string).split(',') : undefined,
        minReturn: minReturn ? parseFloat(minReturn as string) : undefined,
        maxDrawdown: maxDrawdown ? parseFloat(maxDrawdown as string) : undefined
      },
      sortBy: sortBy as string
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('[Strategies] Search error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search strategies'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEPRECATED ENDPOINTS - For backwards compatibility
// ═══════════════════════════════════════════════════════════════════════════════

const DEPRECATION_DATE = 'Wed, 01 Sep 2026 00:00:00 GMT';

/**
 * @deprecated Use POST /api/strategies instead
 * POST /api/strategies/create
 */
router.post('/create', addDeprecationHeaders(DEPRECATION_DATE), requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { name, description, allocations, rebalanceFrequencyDays = 7, tags = [], riskLevel = 'medium' } = req.body;

    const strategy = await strategyDashboardService.createStrategy({
      creatorId: userId,
      name,
      description,
      allocations,
      rebalanceFrequencyDays,
      tags,
      riskLevel
    });

    res.status(201).json({
      success: true,
      message: 'Strategy created successfully',
      data: strategy
    });
  } catch (error) {
    logger.error('[Strategies] Create (deprecated) error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create strategy'
    });
  }
});

export default router;
