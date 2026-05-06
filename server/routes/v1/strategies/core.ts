/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 STRATEGIES - CORE CRUD OPERATIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * RESTful Core Resource Operations:
 * - GET    /v1/strategies              → List all strategies (with filtering)
 * - POST   /v1/strategies              → Create new strategy
 * - GET    /v1/strategies/:strategyId  → Get strategy details
 * - PUT    /v1/strategies/:strategyId  → Update strategy metadata
 * - DELETE /v1/strategies/:strategyId  → Deactivate strategy
 * 
 * Composed into index.ts for full router mount.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response } from 'express';
import { strategyDashboardService } from '../../../services/strategyDashboardService';
import { strategyFreqtradeIntegration } from '../../../services/strategyFreqtradeIntegration';
import { Logger } from '../../../utils/logger';
import { rateLimitPerUser } from '../../../middleware/rateLimit';

const logger = Logger.getLogger();
const router = express.Router();

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
// CORE CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/strategies
 * List all strategies with optional filtering and pagination
 * 
 * Query Parameters:
 *   - skip: number (default: 0)
 *   - limit: number (default: 20)
 *   - riskLevel: string (low|medium|high)
 *   - tags: string (comma-separated tags)
 *   - sortBy: string (createdAt|updatedAt|performance) (default: createdAt)
 * 
 * @swagger
 * /v1/strategies:
 *   get:
 *     tags:
 *       - Strategies
 *     summary: List all strategies
 *     description: Retrieve all available strategies with optional filtering and pagination
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of strategies to skip
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of strategies to return
 *       - in: query
 *         name: riskLevel
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by risk level
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tags to filter by
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, performance]
 *           default: createdAt
 *         description: Field to sort by
 *     responses:
 *       200:
 *         description: Strategies retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
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
    logger.error('[Strategies:Core] List error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list strategies'
    });
  }
});

/**
 * POST /v1/strategies
 * Create a new strategy (RESTful - no /create suffix)
 * 
 * Request Body:
 *   - name: string (required)
 *   - description?: string
 *   - allocations: Array<{asset: string; percentage: number}> (required)
 *   - rebalanceFrequencyDays?: number (default: 7)
 *   - tags?: string[] (default: [])
 *   - riskLevel?: 'low'|'medium'|'high' (default: 'medium')
 *   - freqtradeStrategyCode?: string (optional - for Freqtrade integration)
 *   - backtestRequest?: object (optional - for immediate backtest)
 * 
 * @swagger
 * /v1/strategies:
 *   post:
 *     tags:
 *       - Strategies
 *     summary: Create a new strategy
 *     description: Create a new trading strategy with allocations and optional Freqtrade integration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - allocations
 *             properties:
 *               name:
 *                 type: string
 *                 description: Strategy name
 *               description:
 *                 type: string
 *               allocations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     asset:
 *                       type: string
 *                     percentage:
 *                       type: number
 *               rebalanceFrequencyDays:
 *                 type: integer
 *                 default: 7
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               riskLevel:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *               freqtradeStrategyCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Strategy created successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
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

    logger.info(`[Strategies:Core] Creating strategy "${name}" by ${userId}`);

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
    logger.error('[Strategies:Core] Create error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create strategy'
    });
  }
});

/**
 * GET /v1/strategies/:strategyId
 * Get strategy details (public for discovery, but user sees additional context if owner)
 * 
 * Response includes user context if authenticated (isOwner flag)
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

    // If user is authenticated, check if they're owner for additional details
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
    logger.error('[Strategies:Core] Get details error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get strategy'
    });
  }
});

/**
 * PUT /v1/strategies/:strategyId
 * Update strategy metadata
 * 
 * Request Body (all optional):
 *   - name?: string
 *   - description?: string
 *   - allocations?: Array (triggers rebalance verification)
 *   - rebalanceFrequencyDays?: number
 *   - tags?: string[]
 *   - riskLevel?: string
 * 
 * Only strategy creator can update
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
    logger.error('[Strategies:Core] Update error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update strategy'
    });
  }
});

/**
 * DELETE /v1/strategies/:strategyId
 * Deactivate strategy (soft delete, preserves history for analytics)
 * 
 * Only strategy creator can delete
 * Returns 204 No Content on success
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
    logger.error('[Strategies:Core] Delete error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete strategy'
    });
  }
});

export default router;
