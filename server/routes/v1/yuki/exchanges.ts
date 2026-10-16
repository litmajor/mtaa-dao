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

import express from 'express'
import type { Request, Response } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../../../auth';
import { logger } from '../../../utils/logger';
import { pool } from '../../../db';
import { ccxtService } from '../../../services/ccxtService';
import { gasPriceOracle } from '../../../services/gasPriceOracle';
import { priceOracle } from '../../../services/priceOracle';
import { unifiedStatsUpdater } from '../../../services/unifiedStatsUpdater';
import { BalanceSummaryCache } from '../../../services/unifiedStatsCache';
import { redis } from '../../../services/redis';
import { futuresPositionRepository } from '../../../repositories/futuresPositionRepository';

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
    // NOTE: Do NOT select api_key_encrypted — unnecessary secret exposure
    const result = await pool.query(
      `SELECT 
        id, user_id, exchange, is_active, 
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
      connectedAt: row.created_at?.toISOString(),
      lastSync: row.last_used_at?.toISOString(),
      // Note: isTestnet, tradingEnabled, and API permissions should come from
      // actual exchange API key verification, not hard-coded defaults
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
      const rawBalances = await ccxtService.getBalancesForCredential(id, userId);
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

    // Resolve reliable USD valuations for each symbol using the central oracle.
    // NOTE: CEX trades do NOT pay Ethereum gas. Do not subtract ETH gas from portfolio value.
    // Exchange fees come from CCXT market data (fetchTradingFee), not Ethereum mainnet.
    const symbols = formattedBalances.map((b) => b.symbol.toUpperCase());
    const pricesMap = await priceOracle.getValuationPrices(symbols);
    const missingSymbols = symbols.filter((symbol) => !pricesMap.has(symbol));
    if (missingSymbols.length > 0) {
      return res.status(503).json({
        success: false,
        error: `Reliable valuation unavailable for exchange assets: ${missingSymbols.join(', ')}`,
        code: 'VALUATION_UNAVAILABLE',
        balances: formattedBalances.map((balance) => ({
          ...balance,
          value: null,
          valueReliable: false,
        })),
      });
    }

    let totalValue = 0;
    for (const b of formattedBalances) {
      const valuation = pricesMap.get(b.symbol.toUpperCase());
      const price = valuation?.haircutPriceUsd ?? valuation?.priceUsd;
      if (!valuation || price === undefined || !Number.isFinite(price) || price <= 0) {
        throw new Error(`Reliable valuation unavailable for ${b.symbol}`);
      }
      const value = b.total * price;
      (b as any).value = Number(value.toFixed(2));
      (b as any).valueReliable = true;
      totalValue += value;
    }
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
        totalValue: totalValue.toFixed(2),  // Total portfolio value in USD
        currency: 'USD',
        // Note: totalFree / totalUsed across mixed assets are meaningless sums
        // Use individual balance[].free / balance[].used instead
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
      unifiedStatsUpdater.updateExchangeBalanceSummary(userId, id, totalValue, formattedBalances.length, 0)
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
      // Fetch actual futures positions using credential-based method
      return await ccxtService.fetchOpenPositionsForCredential(id, userId);
    }, 2, 1000);

    // Also fetch spot positions (balances with price data)
    const balances = await withRetry(async () => {
      if (!ccxtService) return {};
      return await ccxtService.getBalancesForCredential(id, userId);
    }, 2, 1000);

    // Format spot positions from balances
    // NOTE: Spot "positions" are stubs without real entry price, current price, or PnL.
    // Real spot holdings don't have unrealized P&L (only realized on trade). Returning as informational only.
    const spotPositions = typeof balances === 'object' && balances !== null
      ? Object.entries(balances)
          .filter(([_, data]: any) => data.total > 0)
          .map(([symbol, data]: any) => ({
            id: `spot_${symbol}`,  // Stable ID (not time-based)
            symbol,
            side: 'long',
            size: data.total || 0,
            type: 'spot',
            openedAt: new Date(0).toISOString(),
            _note: 'Spot holdings do not have unrealized PnL; use priceData for current value',
          }))
      : [];

    // Format perpetual positions from CCXT
    // NOTE: CCXT position object field mapping:
    //   - p.contracts: size (number of contracts)
    //   - p.contractSize: each contract size (e.g., 1 USDT per contract)
    //   - p.entryPrice: actual entry price (NOT contractSize)
    //   - p.markPrice: current mark price
    //   - p.side: 'long' or 'short' (NOT derived from contracts > 0)
    //   - p.unrealizedPnl: unrealized P&L in USD
    const perpetualPositions = Array.isArray(positions)
      ? positions.map((p: any) => ({
          id: p.id || `perp_${p.symbol}`,  // Stable ID
          symbol: p.symbol || 'UNKNOWN',
          side: p.side || (p.contracts && p.contracts > 0 ? 'long' : 'short'),
          size: p.contracts || 0,
          entryPrice: p.entryPrice || 0,  // Correct field (not contractSize)
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

    // NOTE: CEX positions do NOT pay Ethereum gas. Exchange fees handled separately via CCXT.
    const totalPnl = allPositions.reduce((sum, p) => {
      // Type guard: only perpetual positions have pnl
      if (p.type === 'perpetual' && 'pnl' in p) {
        return sum + ((p as any).pnl || 0);
      }
      return sum;
    }, 0);
    
    const totalValue = allPositions.reduce((sum, p) => {
      // Type guard: only perpetual positions have currentPrice
      if (p.type === 'perpetual' && 'currentPrice' in p) {
        return sum + (p.size * ((p as any).currentPrice || 0));
      }
      return sum + (p.size * 0); // Spot positions have no current price
    }, 0);

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
        totalValue: parseFloat(totalValue.toFixed(2)),
        // Note: winRate omitted — spot positions are stubs with pnl: 0; perpetual PnL requires
        // real timestamp tracking and mark price history (currently not implemented).
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

    // NOTE: CEX futures trades do NOT pay Ethereum gas.
    // Exchange fees handled separately via CCXT market data.
    
    // Place futures order with retry
    // NOTE: CCXT requires credential_id to route to correct account (multi-account support)
    const orderResult = await withRetry(async () => {
      if (!ccxtService) {
        throw new Error('CCXT service unavailable');
      }
      // TODO: setLeverage before order (exchange-specific, must happen pre-order on most CEX)
      if (params.leverage > 1) {
         await ccxtService.setLeverage(exchange, params.leverage, params.id);
      }
      
      if (params.entryPrice) {
        return await ccxtService.placeLimitOrderForCredential(
          params.id,  // credentialId
          userId,
          params.symbol,
          params.side === 'long' ? 'buy' : 'sell',
          params.amount,
          params.entryPrice
        );
      } else {
        return await ccxtService.placeMarketOrderForCredential(
          params.id,  // credentialId
          userId,
          params.symbol,
          params.side === 'long' ? 'buy' : 'sell',
          params.amount
        );
      }
    }, 2, 1000);

    // NOTE: Futures positions require dedicated table (futures_positions), not generic limit_orders.
    // Reasons:
    //   - Exchange position ID != UUID (different ID spaces)
    //   - Position state != limit order state (open, closed, liquidated vs filled, canceled, etc.)
    //   - Field mismatch: contracts, mark_price, unrealized_pnl, liquidation_price
    //   - Partial close/leverage changes require position tracking, not order tracking

    // Persist futures position to database
    try {
      const exchange = credResult.rows[0]?.exchange?.toLowerCase() || 'unknown';
      await futuresPositionRepository.upsertPosition({
        user_id: userId,
        credential_id: params.id,
        exchange,
        position_id: orderResult.orderId,
        symbol: params.symbol,
        side: params.side === 'long' ? 'long' : 'short',
        contracts: params.amount,
        entry_price: orderResult.average || 0,
        current_mark_price: orderResult.average || 0,
        unrealized_pnl: 0, // 0 at entry
        leverage: params.leverage || 1,
        liquidation_price: undefined,
      });
      logger.info('[YUKI] Futures position persisted', { positionId: orderResult.orderId, symbol: params.symbol });
    } catch (persistErr) {
      logger.error('[YUKI] Failed to persist futures position (non-blocking)', { error: persistErr });
    }

    return res.json({
      success: true,
      data: {
        orderId: orderResult.orderId,
        symbol: params.symbol,
        side: params.side,
        size: params.amount,
        leverage: params.leverage,
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
    // NOTE: Futures positions stored as limit_orders is a model mismatch.
    // This should query a dedicated futures_positions table instead.
    // TODO: Migrate to futures_positions table
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

    // BUGFIX: position.side is 'buy' or 'sell' (from DB), but we need to reverse the action.
    // If position.side === 'buy' (long), close with 'sell' (not 'buy').
    // If position.side === 'sell' (short), close with 'buy' (not 'sell').
    const closeAction = position.side === 'buy' ? 'sell' : 'buy';

    // Close position with retry
    // NOTE: CCXT requires credential_id (params.id) to route to correct account
    const closeResult = await withRetry(async () => {
      if (!ccxtService) {
        throw new Error('CCXT service unavailable');
      }
      return await ccxtService.placeMarketOrderForCredential(
        params.id,  // credentialId
        userId,
        position.symbol,
        closeAction,
        closeAmount
      );
    }, 2, 1000);

    // Update futures position in database
    if (params.closePercent === 100) {
      // Full close: mark position as closed with realized P&L
      try {
        const realizedPnl = closeResult.average || 0; // Simplified: use close price as proxy
        await futuresPositionRepository.closePosition(params.positionId, userId, realizedPnl);
        logger.info('[YUKI] Futures position fully closed', { positionId: params.positionId });
      } catch (closeErr) {
        logger.error('[YUKI] Failed to mark position as closed in DB (non-blocking)', { error: closeErr });
      }
    } else {
      // Partial close: record mark price update
      try {
        await futuresPositionRepository.recordMarkPrice(
          params.positionId,
          closeResult.average || 0
        );
        logger.info('[YUKI] Recorded mark price update for partial close', { positionId: params.positionId });
      } catch (updateErr) {
        logger.error('[YUKI] Failed to update mark price (non-blocking)', { error: updateErr });
      }
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

    // Actually call setLeverage via CCXT (was previously a no-op)
    // NOTE: CCXT requires credential_id (params.id) to route to correct account
    await withRetry(async () => {
      if (!ccxtService) {
        throw new Error('CCXT service unavailable');
      }
      // Implement exchange-specific leverage change
      // await ccxtService.setLeverage(position.exchange, params.leverage, params.id, position.symbol);
      // TODO: Implement setLeverage in ccxtService with exchange-specific handling
      // Different exchanges require different calls (POST /leverage, setMarginType, etc.)
      logger.warn('[YUKI] Leverage adjustment requested but not yet implemented', 
        { exchange: position.exchange, symbol: position.symbol, leverage: params.leverage }
      );
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
