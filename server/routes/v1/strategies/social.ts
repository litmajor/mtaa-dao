/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 STRATEGIES - SOCIAL SUB-ROUTER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Strategy Discovery & Social Features:
 * - Collection-level routes:
 *   - GET    /v1/strategies/mine                      → User's created + followed
 *   - GET    /v1/strategies/search                    → Full-text search & filter
 *   - GET    /v1/strategies/rankings/:metric          → Leaderboards
 * 
 * - Resource-level social features (nested under :strategyId):
 *   - POST   /v1/strategies/:strategyId/follow        → Copy/follow strategy
 *   - DELETE /v1/strategies/:strategyId/follow        → Stop following
 *   - GET    /v1/strategies/:strategyId/followers     → Get follower list
 * 
 * Composed into index.ts for full router mount.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response } from 'express';
import { strategyDashboardService } from '../../../services/strategyDashboardService';
import { Logger } from '../../../utils/logger';
import { rateLimitPerUser } from '../../../middleware/rateLimit';

const logger = Logger.getLogger();
const router = express.Router({ mergeParams: true });

/**
 * Middleware: Require authentication for write operations
 */
function requireAuth(req: Request, res: Response, next: Function) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTION-LEVEL SOCIAL ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/strategies/mine
 * Get user's strategies (created & followed)
 * 
 * Query Parameters:
 *   - filter?: 'created'|'followed'|'all' (default: 'all')
 * 
 * Examples:
 *   - GET /v1/strategies/mine?filter=created  → User's deployed strategies
 *   - GET /v1/strategies/mine?filter=followed → User's copied strategies
 *   - GET /v1/strategies/mine                 → All user's strategies
 */
router.get('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { filter = 'all' } = req.query;

    let strategies;

    if (filter === 'created') {
      strategies = await strategyDashboardService.getUserCreatedStrategies(userId);
    } else if (filter === 'followed') {
      strategies = await strategyDashboardService.getUserFollowedStrategies(userId);
    } else {
      // Combine both for 'all'
      const [created, followed] = await Promise.all([
        strategyDashboardService.getUserCreatedStrategies(userId),
        strategyDashboardService.getUserFollowedStrategies(userId)
      ]);
      strategies = [...created, ...followed];
    }

    res.json({
      success: true,
      filter: filter || 'all',
      count: strategies.length,
      data: strategies
    });
  } catch (error) {
    logger.error('[Strategies:Social] Get mine error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user strategies'
    });
  }
});

/**
 * GET /v1/strategies/search
 * Search and filter strategies with full-text and faceted search
 * 
 * Query Parameters:
 *   - q?: string                    (search query)
 *   - riskLevel?: string            (low|medium|high)
 *   - tags?: string                 (comma-separated)
 *   - minReturn?: number            (minimum ROI %)
 *   - maxDrawdown?: number          (maximum drawdown %)
 *   - sortBy?: string               (default: 'popularity' - popularity|returns|sharpe|winRate)
 * 
 * Examples:
 *   - GET /v1/strategies/search?q=momentum&riskLevel=medium
 *   - GET /v1/strategies/search?tags=crypto,ai&minReturn=10
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
    logger.error('[Strategies:Social] Search error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search strategies'
    });
  }
});

/**
 * GET /v1/strategies/rankings/:metric
 * Get leaderboard of top strategies
 * 
 * Path Parameters:
 *   - metric: 'returns'|'sharpe'|'winRate'|'followers'|'popularity'
 * 
 * Query Parameters:
 *   - limit?: number (default: 20, max: 100)
 * 
 * Examples:
 *   - GET /v1/strategies/rankings/returns?limit=10
 *   - GET /v1/strategies/rankings/followers
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
      metric,
      data: rankings
    });
  } catch (error) {
    logger.error('[Strategies:Social] Rankings error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get rankings'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE-LEVEL SOCIAL FEATURES (nested under :strategyId)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /v1/strategies/:strategyId/follow
 * Copy/follow a strategy
 * 
 * Request Body:
 *   - investAmount?: number (default: 100 - initial allocation)
 * 
 * Returns (201 Created):
 *   - followId: string
 *   - strategyId: string
 *   - createdAt: ISO datetime
 */
router.post('/', [requireAuth, rateLimitPerUser('strategy-follow', 30, '5min')], async (req: Request, res: Response) => {
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
    logger.error('[Strategies:Social] Follow error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to follow strategy'
    });
  }
});

/**
 * DELETE /v1/strategies/:strategyId/follow
 * Stop following a strategy (unsubscribe)
 * 
 * Returns (200 OK):
 *   - success: true
 */
router.delete('/', [requireAuth, rateLimitPerUser('strategy-unfollow', 30, '5min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;

    await strategyDashboardService.unfollowStrategy(userId, strategyId);

    res.json({
      success: true,
      message: 'Strategy unfollowed successfully'
    });
  } catch (error) {
    logger.error('[Strategies:Social] Unfollow error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unfollow strategy'
    });
  }
});

/**
 * GET /v1/strategies/:strategyId/followers
 * Get list of users following this strategy
 * 
 * Query Parameters:
 *   - skip?: number (default: 0)
 *   - limit?: number (default: 20)
 * 
 * Returns:
 *   - followers: Array<{userId, followedAt, investAmount}>
 *   - total: number (total follower count)
 */
router.get('/followers', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const { skip = 0, limit = 20 } = req.query;

    const result = await strategyDashboardService.getStrategyFollowers(
      strategyId,
      parseInt(skip as string),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: result.followers,
      total: result.total
    });
  } catch (error) {
    logger.error('[Strategies:Social] Get followers error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get followers'
    });
  }
});

export default router;
