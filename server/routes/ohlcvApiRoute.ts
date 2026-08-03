/**
 * OHLCV API Route
 *
 * GET /api/ohlcv
 *
 * Query params:
 *   • symbol    (required)  e.g. 'BTC/USDT', 'CELO/cUSD'
 *   • timeframe (optional)  default '1h'
 *   • limit     (optional)  default 100, max 500
 *   • source    (optional)  'auto' | 'cex' | 'dex' | 'binance' | 'kraken' | 'coinbase' | 'kucoin'
 *
 * Response: OHLCVResponse JSON
 */

import { Request, Response } from 'express';
import { ohlcvService } from '../services/ohlcvService';
import { logger } from '../utils/logger';

const VALID_TIMEFRAMES = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);
const MAX_LIMIT = 500;

export async function getOHLCVHandler(req: Request, res: Response): Promise<void> {
  const { symbol, timeframe = '1h', limit = '100', source = 'auto' } = req.query;

  // ── Validation ──
  if (!symbol || typeof symbol !== 'string') {
    res.status(400).json({
      status: 'error',
      symbol: symbol || '',
      pair: symbol || '',
      timeframe: String(timeframe),
      total_candles: 0,
      from: 0,
      to: 0,
      data: [],
      error: 'Missing required query parameter: symbol',
    });
    return;
  }

  const tf = String(timeframe);
  if (!VALID_TIMEFRAMES.has(tf)) {
    res.status(400).json({
      status: 'error',
      symbol,
      pair: symbol,
      timeframe: tf,
      total_candles: 0,
      from: 0,
      to: 0,
      data: [],
      error: `Invalid timeframe: ${tf}. Supported: ${[...VALID_TIMEFRAMES].join(', ')}`,
    });
    return;
  }

  const lim = Math.min(parseInt(String(limit), 10) || 100, MAX_LIMIT);
  const src = String(source);

  // ── Fetch ──
  try {
    logger.info(`[API] OHLCV request: ${symbol} / ${tf} / ${lim} / source=${src}`);
    const result = await ohlcvService.getCandles(symbol, tf, lim, src);

    // Add CORS headers for frontend
    res.setHeader('Content-Type', 'application/json');
    res.status(result.status === 'success' ? 200 : 503).json(result);
  } catch (error) {
    logger.error(`[API] OHLCV handler error for ${symbol}:`, error);
    res.status(500).json({
      status: 'error',
      symbol,
      pair: symbol,
      timeframe: tf,
      total_candles: 0,
      from: 0,
      to: 0,
      data: [],
      error: `Internal server error: ${(error as Error).message}`,
    });
  }
}

/**
 * Optional: POST /api/ohlcv/clear
 * Admin endpoint to bust cache for a symbol.
 */
export async function clearOHLCVCacheHandler(req: Request, res: Response): Promise<void> {
  const { symbol } = req.body;
  if (!symbol || typeof symbol !== 'string') {
    res.status(400).json({ status: 'error', error: 'Missing symbol in body' });
    return;
  }

  try {
    await (ohlcvService as any).clearCacheForSymbol
      ? await (ohlcvService as any).clearCacheForSymbol(symbol)
      : await (ohlcvService as any).clearCache?.(symbol);
    res.json({ status: 'success', message: `Cache cleared for ${symbol}` });
  } catch (error) {
    res.status(500).json({ status: 'error', error: (error as Error).message });
  }
}
