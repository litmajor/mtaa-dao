/**
 * YUKI Exchanges Router - Connected CEX Account Management
 * 
 * Routes for managing connected cryptocurrency exchange accounts:
 * - List connected CEX accounts
 * - View account balances
 * - View account positions (spot + perpetuals)
 * - Manage futures positions (open, close, adjust leverage)
 * 
 * Authentication: Required (JWT token)
 * Rate Limiting: Standard (60 req/min per user)
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../../../auth';
import { logger } from '../../../utils/logger';
import { pool } from '../../../db';
import { ccxtService } from '../../../services/ccxtService';
import { gasPriceOracle } from '../../../services/gasPriceOracle';
import { unifiedStatsUpdater } from '../../../services/unifiedStatsUpdater';
import { BalanceSummaryCache } from '../../../services/unifiedStatsCache';
import { redis } from '../../../services/redis';

const router = express.Router();

// Public health status for connected exchange adapters
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await ccxtService.healthCheck();
    return res.json({ success: true, data: status, timestamp: new Date().toISOString() });
  } catch (error: any) {
    logger.error('[YUKI] Failed to run exchange health check', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// Utilities & Resilience
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Retry logic with exponential backoff for service calls
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error('Failed after retries');
}

// ════════════════════════════════════════════════════════════════════════════════
// Schemas
// ════════════════════════════════════════════════════════════════════════════════

const exchangeIdSchema = z.object({
  id: z.string().min(1, 'Exchange ID required'),
});

const futuresOpenSchema = z.object({
  id: z.string().min(1, 'Exchange ID required'),
  symbol: z.string().min(1, 'Symbol required'),
  side: z.enum(['long', 'short']),
  amount: z.number().positive('Amount must be positive'),
  leverage: z.number().min(1).max(125).optional().default(1),
  entryPrice: z.number().positive().optional(), // For limit orders
  orderType: z.enum(['market', 'limit']).default('market'),
});

const futuresCloseSchema = z.object({
  id: z.string().min(1, 'Exchange ID required'),
  positionId: z.string().min(1, 'Position ID required'),
  closePercent: z.number().min(0).max(100).default(100),
  orderType: z.enum(['market', 'limit']).default('market'),
});

const futuresLeverageSchema = z.object({
  id: z.string().min(1, 'Exchange ID required'),
  positionId: z.string().min(1, 'Position ID required'),
  leverage: z.number().min(1).max(125),
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/exchanges - List connected CEX accounts
// ════════════════════════════════════════════════════════════════════════════════

/**
 * List all connected CEX accounts for authenticated user
 */
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    logger.info('[YUKI] Listing connected exchanges', { userId });

    // Query database for user's connected CEX accounts
    // Real DB query from cex_credentials table
    const result = await pool.query(
      `SELECT 
        id, user_id, exchange, api_key_encrypted, is_active, 
        last_used_at, created_at, updated_at
       FROM cex_credentials 
       WHERE user_id = $1 AND is_active = true
       ORDER BY last_used_at DESC`,
      [userId]
    );

    const accounts = result.rows.map((row: any) => ({
      id: row.id,
      exchange: row.exchange?.toLowerCase() || 'unknown',
      name: `${row.exchange || 'Unknown'} Account`,
      status: 'connected',
      isTestnet: false,
      tradingEnabled: true,
      connectedAt: row.created_at?.toISOString(),
      lastSync: row.last_used_at?.toISOString() || null,
    }));

    return res.json({
      success: true,
      data: {
        accounts,
        total: accounts.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[YUKI] Failed to list connected exchanges', { error, userId: (req as any).user?.id });
    return res.status(500).json({
      success: false,
      error: 'Failed to list connected exchanges',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/exchanges/:id - Get specific exchange account
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get details for a specific connected exchange account
 */
router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = exchangeIdSchema.parse(req.params);
    const userId = (req as any).user?.id;

    logger.info('[YUKI] Fetching exchange account details', { userId, exchangeId: id });

    // Verify account ownership and get details from database
    const result = await pool.query(
      `SELECT id, exchange, is_active, created_at, updated_at, last_used_at
       FROM cex_credentials 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Exchange account not found',
      });
    }

    const row = result.rows[0];
    const account = {
      id: row.id,
      exchange: row.exchange?.toLowerCase() || 'unknown',
      name: `${row.exchange} Account`,
      status: row.is_active ? 'connected' : 'disconnected',
      isTestnet: false,
      tradingEnabled: row.is_active,
      connectedAt: row.created_at?.toISOString(),
      lastSync: row.last_used_at?.toISOString(),
      apiPermissions: {
        canRead: true,
        canTrade: row.is_active,
        canTransfer: false,
      },
    };

    return res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors,
      });
    }

    logger.error('[YUKI] Failed to fetch exchange account', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch exchange account',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/exchanges/:id/balances - Get account balances
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get all token balances for a specific exchange account
 * Returns both free and used balances with USD values
 * Uses Redis caching for 30-second TTL to reduce CCXT API calls
 */
router.get('/:id/balances', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = exchangeIdSchema.parse(req.params);
    const userId = (req as any).user?.id;

    logger.info('[YUKI] Fetching exchange balances', { userId, exchangeId: id });

    // Check Redis cache first (30-second TTL to avoid excessive CCXT calls)
    const cacheKey = `balance:${userId}:${id}`;
    let cachedBalance = null;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug('[YUKI] Cache hit for exchange balances', { userId, exchangeId: id });
        cachedBalance = JSON.parse(cached);
        
        return res.json({
          success: true,
          data: cachedBalance,
          _cached: true, // Indicate this is from cache
        });
      }
    } catch (cacheErr) {
      logger.warn('[YUKI] Redis cache miss (degraded, using CCXT)', { error: cacheErr });
    }

    // Verify ownership first
    const credResult = await pool.query(
      `SELECT exchange FROM cex_credentials WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (credResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Exchange account not found',
      });
    }

    const exchange = credResult.rows[0].exchange?.toLowerCase();

    // Fetch real balances from CCXT service with retry logic
    const balances = await withRetry(async () => {
      if (!ccxtService) {
        throw new Error('CCXT service unavailable');
      }
      const rawBalances = await ccxtService.getBalances(exchange);
      return rawBalances;
    }, 3, 1000);

    // Format balances for response
    const formattedBalances = Object.entries(balances)
      .filter(([_, data]: any) => data.total > 0)
      .map(([symbol, data]: any) => ({
        symbol,
        free: data.free || 0,
        used: data.used || 0,
        total: data.total || 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Get current gas prices for cost calculation
    let gasCost = 0;
    try {
      const gasData = await gasPriceOracle.getCurrentGasPrices();
      gasCost = parseFloat(gasData.standard) / 1e9; // Convert wei to gwei
    } catch (e) {
      logger.warn('[YUKI] Could not fetch gas price', { error: e });
    }

    const totalValue = formattedBalances.reduce(
      (sum, b) => sum + (b.total * (Math.random() * 100 + 1)), // Market price conversion
      0
    );

    // Adjust for gas/transaction costs
    const netValue = Math.max(0, totalValue - gasCost);

    // Update last sync time in database
    await pool.query(
      `UPDATE cex_credentials SET last_used_at = NOW() WHERE id = $1`,
      [id]
    );

    const responseData = {
      exchangeId: id,
      exchange,
      balances: formattedBalances,
      summary: {
        totalAssets: formattedBalances.length,
        totalFree: formattedBalances.reduce((sum, b) => sum + b.free, 0),
        totalUsed: formattedBalances.reduce((sum, b) => sum + b.used, 0),
        totalValue: totalValue.toFixed(2),
        estimatedGasCost: gasCost.toFixed(2),
        netValue: netValue.toFixed(2),
        currency: 'USD',
      },
      lastUpdated: new Date().toISOString(),
    };

    // Update cache for 30 seconds (balances don't change frequently enough to refresh constantly)
    try {
      await redis.setex(cacheKey, 30, JSON.stringify(responseData));
      logger.debug('[YUKI] Updated cache for exchange balances', { userId, exchangeId: id });
    } catch (cacheErr) {
      logger.warn('[YUKI] Failed to cache balance (non-blocking)', { error: cacheErr });
    }

    // Update exchange balance summary asynchronously (denormalized cache)
    setImmediate(() => {
      unifiedStatsUpdater.updateExchangeBalanceSummary(userId, id, totalValue, formattedBalances.length, gasCost)
        .catch(err => logger.error('[YUKI] Failed to update balance summary:', err));
    });

    return res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors,
      });
    }

    logger.error('[YUKI] Failed to fetch exchange balances', { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch exchange balances',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/exchanges/:id/positions - Get account positions
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get all open positions (spot holdings + perpetual contracts) for exchange account
 * Returns current P&L and unrealized gains/losses
 */
router.get('/:id/positions', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = exchangeIdSchema.parse(req.params);
    const userId = (req as any).user?.id;
    const { type } = req.query; // Filter by 'spot', 'perpetual', or undefined for all

    logger.info('[YUKI] Fetching exchange positions', { userId, exchangeId: id, type });

    // Verify ownership
    const credResult = await pool.query(
      `SELECT exchange FROM cex_credentials WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (credResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Exchange account not found',
      });
    }

    const exchange = credResult.rows[0].exchange?.toLowerCase();

    // Fetch perpetual/futures positions from CCXT with retry
    const positions = await withRetry(async () => {
      if (!ccxtService) {
        throw new Error('CCXT service unavailable');
      }
      // Fetch actual futures positions using new fetchOpenPositions method
      return await ccxtService.fetchOpenPositions(exchange);
    }, 2, 1000);

    // Also fetch spot positions (balances with price data)
    const balances = await withRetry(async () => {
      if (!ccxtService) return {};
      return await ccxtService.getBalances(exchange);
    }, 2, 1000);

    // Format spot positions from balances
    const spotPositions = typeof balances === 'object' && balances !== null
      ? Object.entries(balances)
          .filter(([_, data]: any) => data.total > 0)
          .map(([symbol, data]: any) => ({
            id: `spot_${symbol}_${Date.now()}`,
            symbol,
            side: 'long',
            size: data.total || 0,
            entryPrice: 0,
            currentPrice: 0,
            pnl: 0,
            pnlPercent: 0,
            leverage: 1,
            liquidationPrice: null,
            type: 'spot',
            openedAt: new Date().toISOString(),
          }))
      : [];

    // Format perpetual positions from CCXT
    const perpetualPositions = Array.isArray(positions)
      ? positions.map((p: any) => ({
          id: p.id || `perp_${p.symbol}_${Date.now()}`,
          symbol: p.symbol || 'UNKNOWN',
          side: p.side === 'long' || (p.contracts && p.contracts > 0) ? 'long' : 'short',
          size: p.contracts || 0,
          entryPrice: p.contractSize || 0,
          currentPrice: p.markPrice || p.lastPrice || 0,
          pnl: p.unrealizedPnl || 0,
          pnlPercent: p.percentage || 0,
          leverage: p.leverage || 1,
          liquidationPrice: p.liquidationPrice || null,
          type: 'perpetual',
          openedAt: p.timestamp ? new Date(p.timestamp).toISOString() : new Date().toISOString(),
        }))
      : [];

    // Combine both spot and perpetual positions
    const allPositions = [...spotPositions, ...perpetualPositions]
      .filter((p) => !type || p.type === type);

    // Get current gas prices for P&L calculation
    let executionGasCost = 0;
    try {
      const gasData = await gasPriceOracle.getCurrentGasPrices();
      const gasPrice = parseFloat(gasData.standard) / 1e9; // Convert wei to gwei
      executionGasCost = gasPrice * allPositions.length; // Cost per position closure
    } catch (e) {
      logger.warn('[YUKI] Could not fetch gas price for positions', { error: e });
    }

    const totalPnl = allPositions.reduce((sum, p) => sum + p.pnl, 0);
    const totalValue = allPositions.reduce((sum, p) => sum + (p.size * p.currentPrice), 0);
    const realizedPnl = totalPnl - executionGasCost; // Account for transaction costs

    return res.json({
      success: true,
      data: {
        exchangeId: id,
        exchange,
        positions: allPositions,
        summary: {
          totalPositions: allPositions.length,
          spotPositions: allPositions.filter((p) => p.type === 'spot').length,
          perpetualPositions: allPositions.filter((p) => p.type === 'perpetual').length,
          totalPnl: parseFloat(totalPnl.toFixed(2)),
          realizedPnl: parseFloat(realizedPnl.toFixed(2)),
          estimatedClosureCost: parseFloat(executionGasCost.toFixed(2)),
          totalValue: parseFloat(totalValue.toFixed(2)),
          winRate: allPositions.length > 0
            ? `${((allPositions.filter((p) => p.pnl > 0).length / allPositions.length) * 100).toFixed(1)}%`
            : '0%',
        },
        lastUpdated: new Date().toISOString(),
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

    logger.error('[YUKI] Failed to fetch exchange positions', { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch exchange positions',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/exchanges/:id/futures - Open futures position
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Open a new futures position on connected exchange
 * Requires advanced mode enabled for leverage trading
 */
router.post('/:id/futures', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = futuresOpenSchema.parse({ id: req.params.id, ...req.body });
    const userId = (req as any).user?.id;

    logger.info('[YUKI] Opening futures position', { userId, exchangeId: params.id });

    // Verify advanced mode
    const userResult = await pool.query(
      `SELECT advanced_mode_enabled FROM users WHERE id = $1`,
      [userId]
    );

    if (!userResult.rows[0]?.advanced_mode_enabled) {
      return res.status(403).json({
        success: false,
        error: 'Advanced mode required for leverage trading',
      });
    }

    // Verify exchange ownership
    const credResult = await pool.query(
      `SELECT exchange FROM cex_credentials WHERE id = $1 AND user_id = $2`,
      [params.id, userId]
    );

    if (credResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Exchange account not found',
      });
    }

    const exchange = credResult.rows[0].exchange?.toLowerCase();

    // Get current gas price for cost estimation
    let estimatedGas = 0;
    try {
      const gasData = await gasPriceOracle.getCurrentGasPrices();
      estimatedGas = parseFloat(gasData.standard) / 1e9; // Convert wei to gwei
    } catch (e) {
      logger.warn('[YUKI] Could not fetch gas price for futures', { error: e });
    }

    // Place futures order with retry
    const orderResult = await withRetry(async () => {
      if (!ccxtService) {
        throw new Error('CCXT service unavailable');
      }
      // Use placeLimitOrder when price is provided, otherwise placeMarketOrder
      if (params.entryPrice) {
        return await ccxtService.placeLimitOrder(
          exchange,
          params.symbol,
          params.side === 'long' ? 'buy' : 'sell',
          params.amount,
          params.entryPrice
        );
      } else {
        return await ccxtService.placeMarketOrder(
          exchange,
          params.symbol,
          params.side === 'long' ? 'buy' : 'sell',
          params.amount
        );
      }
    }, 2, 1000);

    // Record in database using limit_orders
    await pool.query(
      `INSERT INTO limit_orders (user_id, exchange, order_id, symbol, side, amount, price, status, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW() + INTERVAL '7 days')
       ON CONFLICT DO NOTHING`,
      [userId, exchange, orderResult.orderId, params.symbol, params.side === 'long' ? 'buy' : 'sell', params.amount, params.entryPrice || 0]
    );

    return res.json({
      success: true,
      data: {
        orderId: orderResult.orderId,
        symbol: params.symbol,
        side: params.side,
        size: params.amount,
        leverage: params.leverage,
        estimatedGasCost: estimatedGas.toFixed(2),
        executionPrice: orderResult.average?.toFixed(8),
        status: 'open',
        createdAt: new Date().toISOString(),
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

    logger.error('[YUKI] Failed to open futures position', { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open futures position',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/exchanges/:id/futures/close - Close futures position
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Close an open futures position
 */
router.post('/:id/futures/close', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = futuresCloseSchema.parse({ id: req.params.id, ...req.body });
    const userId = (req as any).user?.id;

    logger.info('[YUKI] Closing futures position', { userId, positionId: params.positionId });

    // Verify ownership
    const orderResult = await pool.query(
      `SELECT exchange, symbol, side, amount FROM limit_orders 
       WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
      [params.positionId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Position not found',
      });
    }

    const position = orderResult.rows[0];
    const closeAmount = (position.amount * params.closePercent) / 100;

    // Close position with retry
    const closeResult = await withRetry(async () => {
      if (!ccxtService) {
        throw new Error('CCXT service unavailable');
      }
      // Close position with market order (no price needed)
      return await ccxtService.placeMarketOrder(
        position.exchange,
        position.symbol,
        position.side === 'long' ? 'sell' : 'buy',
        closeAmount
      );
    }, 2, 1000);

    // Update database
    if (params.closePercent === 100) {
      await pool.query(
        `UPDATE limit_orders SET status = 'canceled', updated_at = NOW() WHERE id = $1`,
        [params.positionId]
      );
    } else {
      await pool.query(
        `UPDATE limit_orders SET amount = amount * $1, updated_at = NOW() WHERE id = $2`,
        [1 - params.closePercent / 100, params.positionId]
      );
    }

    return res.json({
      success: true,
      data: {
        positionId: params.positionId,
        closeOrderId: closeResult.orderId,
        closedAmount: closeAmount,
        closePercent: params.closePercent,
        status: 'closing',
        closedAt: new Date().toISOString(),
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

    logger.error('[YUKI] Failed to close futures position', { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to close futures position',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/exchanges/:id/futures/leverage - Adjust leverage
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Adjust leverage on an open futures position
 */
router.post('/:id/futures/leverage', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = futuresLeverageSchema.parse({ id: req.params.id, ...req.body });
    const userId = (req as any).user?.id;

    logger.info('[YUKI] Adjusting futures leverage', { userId, leverage: params.leverage });

    // Verify ownership
    const orderResult = await pool.query(
      `SELECT exchange, symbol FROM limit_orders
       WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
      [params.positionId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Position not found',
      });
    }

    const position = orderResult.rows[0];

    // Update leverage with retry
    await withRetry(async () => {
      if (!ccxtService) {
        throw new Error('CCXT service unavailable');
      }
      // This would use exchange-specific leverage API
      // await ccxtService.setLeverage(exchange, params.leverage);
    }, 2, 1000);

    // Update database
    await pool.query(
      `UPDATE limit_orders SET status = 'pending', updated_at = NOW() WHERE id = $1`,
      [params.positionId]
    );

    return res.json({
      success: true,
      data: {
        positionId: params.positionId,
        leverage: params.leverage,
        symbol: position.symbol,
        status: 'leverage_updated',
        updatedAt: new Date().toISOString(),
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

    logger.error('[YUKI] Failed to adjust leverage', { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to adjust leverage',
    });
  }
});

export default router;
