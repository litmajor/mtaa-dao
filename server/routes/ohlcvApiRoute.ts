/**
 * OHLCV API Route Handlers
 *
 * GET  /api/ohlcv        - Query financial candlestick data
 * POST /api/ohlcv/clear  - Bust cache for a specific symbol (Admin)
 */

import type { Request, Response } from 'express';
import { ohlcvService } from '../services/ohlcvService';
import { logger } from '../utils/logger';

const VALID_TIMEFRAMES = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);
const MIN_LIMIT = 1;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// Standard helper for error payloads
function sendErrorResponse(
  res: Response, 
  statusCode: number, 
  symbol: string, 
  timeframe: string, 
  errorMessage: string
): void {
  res.status(statusCode).json({
    status: 'error',
    symbol,
    pair: symbol,
    timeframe,
    total_candles: 0,
    from: 0,
    to: 0,
    data: [],
    error: errorMessage,
  });
}

export async function getOHLCVHandler(req: Request, res: Response): Promise<void> {
  const { symbol, timeframe = '1h', limit = '100', source = 'auto' } = req.query;

  // ── Validation: Symbol ──
  if (!symbol || typeof symbol !== 'string') {
    sendErrorResponse(res, 400, '', String(timeframe), 'Missing required query parameter: symbol');
    return;
  }

  // ── Validation: Timeframe ──
  const tf = String(timeframe);
  if (!VALID_TIMEFRAMES.has(tf)) {
    sendErrorResponse(
      res, 
      400, 
      symbol, 
      tf, 
      `Invalid timeframe: ${tf}. Supported: ${[...VALID_TIMEFRAMES].join(', ')}`
    );
    return;
  }

  // ── Validation & Clamping: Limit ──
  const rawLimit = parseInt(String(limit), 10);
  const lim = Math.max(
    MIN_LIMIT, 
    Math.min(isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT)
  );

  const src = String(source);

  // ── Fetch ──
  try {
    logger.info(`[API] OHLCV request: ${symbol} / ${tf} / ${lim} / source=${src}`);
    const result = await ohlcvService.getCandles(symbol, tf, lim, src);

    res.setHeader('Content-Type', 'application/json');
    res.status(result.status === 'success' ? 200 : 503).json(result);
  } catch (error) {
    logger.error(`[API] OHLCV handler error for ${symbol}:`, error);
    sendErrorResponse(
      res, 
      500, 
      symbol, 
      tf, 
      `Internal server error: ${(error as Error).message}`
    );
  }
}

/**
 * POST /api/ohlcv/clear
 * Admin endpoint to bust cache for a symbol.
 */
export async function clearOHLCVCacheHandler(req: Request, res: Response): Promise<void> {
  const { symbol } = req.body;

  if (!symbol || typeof symbol !== 'string') {
    res.status(400).json({ status: 'error', error: 'Missing symbol in body' });
    return;
  }

  try {
    if (typeof ohlcvService.clearCache === 'function') {
      await ohlcvService.clearCache(symbol);
    } else {
      throw new Error('Cache clearing is not supported by the current service configuration');
    }

    res.json({ status: 'success', message: `Cache cleared for ${symbol}` });
  } catch (error) {
    logger.error(`[API] Cache clear error for ${symbol}:`, error);
    res.status(500).json({ status: 'error', error: (error as Error).message });
  }
}