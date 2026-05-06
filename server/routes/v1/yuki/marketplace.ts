/**
 * YUKI Marketplace Router - Strategy Marketplace
 * 
 * Routes for discovering, publishing, and copying trading strategies:
 * - GET /v1/yuki/marketplace/strategies         - List published strategies
 * - POST /v1/yuki/marketplace/strategies/publish - Publish personal strategy
 * - GET /v1/yuki/marketplace/strategies/:id     - Strategy details
 * - POST /v1/yuki/marketplace/strategies/:id/copy - Clone strategy to personal library
 * 
 * Authentication: Optional for discovery, required for publishing/copying
 * Rate Limiting: 60 req/min per user
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../../../auth';
import { logger } from '../../../utils/logger';
import { pool } from '../../../db';
import { redis } from '../../../services/redis';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// Schemas
// ════════════════════════════════════════════════════════════════════════════════

const publishStrategySchema = z.object({
  strategyId: z.string().min(1, 'Strategy ID required'),
  title: z.string().min(5, 'Title must be at least 5 chars').max(100),
  description: z.string().min(20, 'Description must be at least 20 chars').max(500),
  category: z.enum(['arbitrage', 'momentum', 'mean_reversion', 'grid', 'dca', 'other']),
  tags: z.array(z.string()).max(5, 'Max 5 tags'),
  isPublic: z.boolean().default(true),
  pricing: z.object({
    isFree: z.boolean().default(true),
    monthlyUSD: z.number().min(0).optional(),
  }),
  riskLevel: z.enum(['low', 'medium', 'high']),
  minCapital: z.number().positive().optional(),
});

const listStrategiesSchema = z.object({
  category: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  sortBy: z.enum(['popularity', 'recent', 'rating', 'returns']).default('popularity'),
  skip: z.string().optional().default('0'),
  limit: z.string().optional().default('20'),
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/marketplace/strategies - List published strategies
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Discover published strategies from community marketplace
 * Shows strategy metadata, author, ratings, and performance metrics
 */
router.get('/strategies', async (req: Request, res: Response) => {
  try {
    const query = listStrategiesSchema.parse(req.query);
    const skip = parseInt(query.skip);
    const limit = Math.min(parseInt(query.limit), 100); // Cap at 100

    logger.info('[MARKETPLACE] Listing published strategies', {
      category: query.category,
      riskLevel: query.riskLevel,
      skip,
      limit,
    });

    // Build query
    let whereClause = 'WHERE is_published = true AND is_public = true';
    const params: any[] = [];

    if (query.category) {
      whereClause += ` AND category = $${params.length + 1}`;
      params.push(query.category);
    }

    if (query.riskLevel) {
      whereClause += ` AND risk_level = $${params.length + 1}`;
      params.push(query.riskLevel);
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM marketplace_strategies ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get strategies with pagination
    const sortMapping: Record<string, string> = {
      popularity: 'copy_count DESC',
      recent: 'published_at DESC',
      rating: 'avg_rating DESC',
      returns: 'avg_return DESC',
    };

    const result = await pool.query(
      `SELECT 
        id, title, description, author_id, category, tags,
        risk_level, min_capital, avg_rating, copy_count, avg_return,
        published_at, updated_at, author_name, author_avatar
       FROM marketplace_strategies 
       ${whereClause}
       ORDER BY ${sortMapping[query.sortBy]}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, skip]
    );

    const strategies = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      author: {
        id: row.author_id,
        name: row.author_name,
        avatar: row.author_avatar,
      },
      category: row.category,
      tags: row.tags || [],
      riskLevel: row.risk_level,
      minCapital: row.min_capital,
      stats: {
        rating: parseFloat(row.avg_rating.toFixed(2)) || 0,
        copies: row.copy_count || 0,
        avgReturn: parseFloat(row.avg_return.toFixed(2)) || 0,
      },
      publishedAt: row.published_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    }));

    return res.json({
      success: true,
      data: {
        strategies,
        pagination: {
          skip,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      });
    }

    logger.error('[MARKETPLACE] Failed to list strategies', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list marketplace strategies',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/marketplace/strategies/publish - Publish strategy
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Publish personal strategy to public marketplace
 * Other users can discover, rate, and copy the strategy
 */
router.post('/strategies/publish', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = publishStrategySchema.parse(req.body);
    const userId = (req as any).user?.id;

    logger.info('[MARKETPLACE] Publishing strategy', {
      userId,
      strategyId: params.strategyId,
    });

    // Verify ownership of strategy
    const stratResult = await pool.query(
      `SELECT id, user_id, returns FROM strategies WHERE id = $1`,
      [params.strategyId]
    );

    if (stratResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found',
      });
    }

    if (stratResult.rows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only publish own strategies',
      });
    }

    // Get user info
    const userResult = await pool.query(`SELECT username, avatar_url FROM users WHERE id = $1`, [userId]);
    const userInfo = userResult.rows[0];

    // Create marketplace entry
    const marketplaceId = `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const insertResult = await pool.query(
      `INSERT INTO marketplace_strategies (
        id, strategy_id, author_id, author_name, author_avatar,
        title, description, category, tags, risk_level, min_capital,
        is_public, pricing, is_published, published_at, avg_return
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW(), $14)
       RETURNING id, published_at`,
      [
        marketplaceId,
        params.strategyId,
        userId,
        userInfo?.username || 'Guest',
        userInfo?.avatar_url || null,
        params.title,
        params.description,
        params.category,
        JSON.stringify(params.tags),
        params.riskLevel,
        params.minCapital || null,
        params.isPublic,
        JSON.stringify(params.pricing),
        stratResult.rows[0].returns || 0,
      ]
    );

    const marketplaceStrategyId = insertResult.rows[0].id;

    // Invalidate marketplace listing cache (strategies list will refresh)
    try {
      const listCacheKeys = ['marketplace_strategies_list', `marketplace_category_${params.category}`, `marketplace_risk_${params.riskLevel}`];
      for (const key of listCacheKeys) {
        await redis.del(key);
        logger.debug('[MARKETPLACE] Invalidated cache', { key });
      }
    } catch (cacheErr) {
      logger.warn('[MARKETPLACE] Failed to invalidate cache (non-blocking)', { error: cacheErr });
    }

    return res.status(201).json({
      success: true,
      data: {
        marketplaceId: marketplaceStrategyId,
        title: params.title,
        publishedAt: insertResult.rows[0].published_at?.toISOString(),
        url: `/v1/yuki/marketplace/strategies/${marketplaceStrategyId}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors,
      });
    }

    logger.error('[MARKETPLACE] Failed to publish strategy', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to publish strategy',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/marketplace/strategies/:id - Strategy details
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get full details for a marketplace strategy including performance metrics
 */
router.get('/strategies/:id', async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

    logger.info('[MARKETPLACE] Fetching strategy details', { strategyId: id });

    // Check Redis cache first (5-minute TTL for strategy details)
    const cacheKey = `marketplace_strategy:${id}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug('[MARKETPLACE] Cache hit for strategy details', { strategyId: id });
        return res.json({
          success: true,
          data: JSON.parse(cached),
          _cached: true, // Indicate this is from cache
        });
      }
    } catch (cacheErr) {
      logger.warn('[MARKETPLACE] Redis cache miss (degraded, using DB)', { error: cacheErr });
    }

    // ⚡ OPTIMIZED FOR SCALE: Query uses denormalized fields instead of live aggregation
    // rating_count is updated async via marketplace_stats_updater service
    // This prevents expensive COUNT(DISTINCT) scans on millions of ratings
    const result = await pool.query(
      `SELECT 
        m.id, m.title, m.description, m.category, m.tags,
        m.author_id, m.author_name, m.author_avatar,
        m.risk_level, m.min_capital, m.pricing,
        m.avg_rating, m.copy_count, m.avg_return, m.rating_count,
        m.published_at, m.updated_at,
        s.total_trades, s.win_rate, s.max_drawdown, s.returns
       FROM marketplace_strategies m
       LEFT JOIN strategies s ON m.strategy_id = s.id
       WHERE m.id = $1 AND m.is_published = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or not published',
      });
    }

    const row = result.rows[0];
    const pricing = typeof row.pricing === 'string' ? JSON.parse(row.pricing) : row.pricing;

    const strategyData = {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
      author: {
        id: row.author_id,
        name: row.author_name,
        avatar: row.author_avatar,
      },
      riskLevel: row.risk_level,
      minCapital: row.min_capital,
      pricing,
      stats: {
        rating: parseFloat(row.avg_rating.toFixed(2)) || 0,
        ratingCount: row.rating_count || 0,  // ⚡ Now denormalized, not calculated
        copies: row.copy_count || 0,
        avgReturn: parseFloat(row.avg_return.toFixed(2)) || 0,
        totalTrades: row.total_trades || 0,
        winRate: parseFloat((row.win_rate * 100).toFixed(2)) || 0,
        maxDrawdown: parseFloat((row.max_drawdown * 100).toFixed(2)) || 0,
      },
      publishedAt: row.published_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    };

    // Update cache for 5 minutes (strategy details don't change frequently)
    try {
      await redis.setex(cacheKey, 300, JSON.stringify(strategyData));
      logger.debug('[MARKETPLACE] Updated cache for strategy details', { strategyId: id });
    } catch (cacheErr) {
      logger.warn('[MARKETPLACE] Failed to cache strategy (non-blocking)', { error: cacheErr });
    }

    return res.json({
      success: true,
      data: strategyData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strategy ID format',
        details: error.errors,
      });
    }

    logger.error('[MARKETPLACE] Failed to fetch strategy details', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch strategy details',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/marketplace/strategies/:id/copy - Copy strategy
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Clone a marketplace strategy to personal library
 * Creates a copy with settings customizable before deployment
 */
router.post('/strategies/:id/copy', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const userId = (req as any).user?.id;

    logger.info('[MARKETPLACE] Copying strategy', { marketplaceId: id, userId });

    // Fetch marketplace strategy
    const mktResult = await pool.query(
      `SELECT id, strategy_id, title FROM marketplace_strategies WHERE id = $1 AND is_published = true`,
      [id]
    );

    if (mktResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or not published',
      });
    }

    const mktStrat = mktResult.rows[0];

    // Fetch original strategy
    const origResult = await pool.query(
      `SELECT * FROM strategies WHERE id = $1`,
      [mktStrat.strategy_id]
    );

    if (origResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Source strategy not found',
      });
    }

    const origStrat = origResult.rows[0];

    // Create copy in user's account
    const copyId = `strat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const copiedResult = await pool.query(
      `INSERT INTO strategies (
        id, user_id, name, description, 
        parameters, returns, total_trades, win_rate,
        max_drawdown, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, NOW(), NOW())
       RETURNING id, created_at`,
      [
        copyId,
        userId,
        `${origStrat.name} (Copy from ${mktStrat.title})`,
        origStrat.description,
        origStrat.parameters,
      ]
    );

    // Record the copy in marketplace
    await pool.query(
      `UPDATE marketplace_strategies SET copy_count = COALESCE(copy_count, 0) + 1 
       WHERE id = $1`,
      [id]
    );

    return res.status(201).json({
      success: true,
      data: {
        strategyId: copiedResult.rows[0].id,
        name: `Copy of ${mktStrat.title}`,
        createdAt: copiedResult.rows[0].created_at?.toISOString(),
        message: 'Strategy copied to personal library. Customize parameters before deployment.',
        nextStep: `/v1/yuki/strategies/${copiedResult.rows[0].id}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors,
      });
    }

    logger.error('[MARKETPLACE] Failed to copy strategy', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to copy strategy',
    });
  }
});

export default router;
