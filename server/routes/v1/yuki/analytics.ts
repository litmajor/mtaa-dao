/**
 * ════════════════════════════════════════════════════════════════════════════════
 * YUKI Market Analytics Router - Cross-Exchange Market Data & Analysis
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Mounted at: /v1/yuki/market/analytics
 *
 * This is the v1-versioned home for what used to live at the unversioned
 * /api/exchanges/* router. Same underlying services (ccxtService,
 * technicalIndicators, historicalData, orderBookAnalyzer, liquidityScoring,
 * arbitrageDetection, fearGreedIndex) — all real, none of this needed a
 * rewrite. Only the routing tree changed, for two reasons:
 *
 *   1. Scoping: this router is NOT credential-scoped. Any authenticated
 *      user can query any symbol here — there's no cex_credentials
 *      ownership check anywhere in this file, unlike v1/yuki/exchanges.ts
 *      which is entirely "verify this user owns this connected account"
 *      routes. Keeping these apart means a route added under
 *      v1/yuki/exchanges/* can safely be assumed to need an ownership
 *      check; a route added here does not. Merging them would make that
 *      assumption unsafe.
 *
 *   2. Naming collisions with market.ts, resolved as follows:
 *        - GET /prices (multi-exchange spread comparison via CCXT)
 *          → renamed to /prices/compare, since GET /v1/yuki/market/prices
 *            already exists (single-source priceOracle lookup). Same
 *            word, different computation — kept both, disambiguated.
 *        - GET /arbitrage/opportunities (live cross-exchange scan)
 *          → renamed to /arbitrage/scan, since GET
 *            /v1/yuki/market/opportunities already exists (arbitrage
 *            computed from the *user's own* venue_execution_stats
 *            history, not a live market-wide scan). Different question,
 *            different answer — kept both, disambiguated.
 *        - GET /liquidity/score, /liquidity/ranking
 *          → kept as-is; extends the existing single-symbol
 *            /v1/yuki/market/liquidity/:symbol route family rather than
 *            duplicating it (that route does order-book depth; these do
 *            liquidity scoring/ranking — genuinely different, no clash).
 *
 * Everything else (technicals, historical, historical/compare, orderbook,
 * orderbook/alerts, orderbook/profile, sentiment/*, status, available,
 * assets, find-symbol, markets, cache-stats, cache/clear) is remounted
 * verbatim — no naming conflicts existed for those paths.
 *
 * Authentication: All routes require auth (was already the case in the
 * original file via router-level authenticateToken; preserved here via
 * isAuthenticated to match the auth middleware convention used
 * throughout the rest of v1/yuki/*).
 */

import express, { Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../../../auth';
import ccxtService from '../../../services/ccxtService';
import { logger } from '../../../utils/logger';
import advancedModeGuard from '../../../middleware/advancedModeGuard';
import { calculateAllIndicators } from '../../../services/technicalIndicators';
import { getHistoricalAnalysis, compareHistoricalPeriods } from '../../../services/historicalData';
import { analyzeOrderBook, checkLiquidityAlerts, getLiquidityProfile } from '../../../services/orderBookAnalyzer';
import { calculateLiquidityMetrics, rankAssetsByLiquidity, getLiquidityWarnings } from '../../../services/liquidityScoring';
import {
  findArbitrageOpportunities,
  findBestArbitrage,
  calculateTradeProfit,
  clearArbitrageCache,
} from '../../../services/arbitrageDetection';
import {
  getFearGreedIndex,
  getMarketChanges,
  getBtcDominance,
  getMarketSentiment,
  clearFearGreedCache,
} from '../../../services/fearGreedIndex';

const router = express.Router();

// All routes here are authenticated (this is proprietary aggregated
// market data, same rationale as the original router-level guard).
router.use(isAuthenticated);
router.use(advancedModeGuard);

const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Shared query validator — used by every route that takes symbol + exchanges.
 * Unchanged from the original file's validateExchangeQuery.
 */
const validateExchangeQuery = (req: Request, res: Response, next: NextFunction) => {
  const { symbol, exchanges } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol parameter required (e.g., CELO/USDC)' });
  }

  const exchangeList = exchanges
    ? (exchanges as string).split(',').map(e => e.trim().toLowerCase())
    : ['binance', 'coinbase', 'kraken'];

  const validExchanges = ccxtService.getAvailableExchanges();
  const invalidExchanges = exchangeList.filter(e => !validExchanges.includes(e));

  if (invalidExchanges.length > 0) {
    return res.status(400).json({
      error: `Invalid exchanges: ${invalidExchanges.join(', ')}`,
      available: validExchanges,
    });
  }

  (req as any).exchangeList = exchangeList;
  (req as any).symbol = symbol;
  next();
};

// ════════════════════════════════════════════════════════════════════════════════
// DISCOVERY & STATUS
// ════════════════════════════════════════════════════════════════════════════════

/** GET /v1/yuki/market/analytics/status */
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const status = ccxtService.getExchangeStatus();
  const available = ccxtService.getAvailableExchanges();
  const health = await ccxtService.healthCheck();
  res.json({ exchanges: status, available, health });
}));

/** GET /v1/yuki/market/analytics/available */
router.get('/available', asyncHandler(async (_req: Request, res: Response) => {
  const available = ccxtService.getAvailableExchanges();
  const health = await ccxtService.healthCheck();
  res.json({ exchanges: available, health: health || {} });
}));

/** GET /v1/yuki/market/analytics/assets?exchange=binance */
router.get('/assets', asyncHandler(async (req: Request, res: Response) => {
  const exchange = (req.query.exchange as string)?.toLowerCase();
  if (!exchange) return res.status(400).json({ error: 'exchange parameter required' });
  const assets = await ccxtService.getAvailableAssets(exchange);
  res.json({ exchange, assets });
}));

/** GET /v1/yuki/market/analytics/find-symbol?symbol=BTC&exchanges=binance,coinbase */
router.get('/find-symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol, exchanges: exchangesParam } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol parameter required' });

  const allExchanges = ccxtService.getAvailableExchanges();
  const exchangesToSearch = exchangesParam
    ? (exchangesParam as string).split(',').map(e => e.trim().toLowerCase())
    : allExchanges;

  const results = await Promise.all(
    exchangesToSearch.map(async exchange => {
      try {
        const ticker = await ccxtService.getTickerFromExchange(exchange, symbol as string);
        return ticker ? {
          exchange,
          symbol: ticker.symbol,
          price: ticker.last,
          bid: ticker.bid,
          ask: ticker.ask,
          volume: ticker.volume,
          timestamp: ticker.timestamp,
        } : null;
      } catch {
        return null;
      }
    }),
  );

  const found = results.filter(r => r !== null);
  res.json({ symbol, found: found.length, exchanges: found, timestamp: Date.now() });
}));

/** GET /v1/yuki/market/analytics/markets?exchange=binance&symbol=CELO&limit=50 */
router.get('/markets', asyncHandler(async (req: Request, res: Response) => {
  const { exchange = 'binance', symbol, limit = '100' } = req.query;
  const validExchanges = ccxtService.getAvailableExchanges();

  if (!validExchanges.includes(exchange as string)) {
    return res.status(400).json({ error: `Invalid exchange: ${exchange}`, available: validExchanges });
  }

  const limitNum = Math.min(parseInt(limit as string) || 100, 500);
  let markets = await ccxtService.getMarkets(exchange as string);

  if (symbol) {
    markets = markets.filter(m => m.base.toUpperCase().includes((symbol as string).toUpperCase()));
  }
  markets = markets.slice(0, limitNum);

  const marketsWithPrices = await Promise.all(
    markets.map(async m => {
      try {
        const ticker = await ccxtService.getTickerFromExchange(exchange as string, m.symbol);
        return {
          id: m.id, symbol: m.symbol, base: m.base, quote: m.quote,
          maker_fee: m.maker, taker_fee: m.taker, limits: m.limits,
          last: ticker?.last || 0, bid: ticker?.bid || 0, ask: ticker?.ask || 0,
          price: ticker?.last || 0, volume: ticker?.volume || 0,
          quoteVolume: ticker?.volume || 0, timestamp: ticker?.timestamp || Date.now(),
        };
      } catch {
        return {
          id: m.id, symbol: m.symbol, base: m.base, quote: m.quote,
          maker_fee: m.maker, taker_fee: m.taker, limits: m.limits,
          last: 0, bid: 0, ask: 0, price: 0, volume: 0, quoteVolume: 0, timestamp: Date.now(),
        };
      }
    }),
  );

  res.json({ exchange, count: marketsWithPrices.length, timestamp: Date.now(), markets: marketsWithPrices });
}));

// ════════════════════════════════════════════════════════════════════════════════
// PRICES — disambiguated from GET /v1/yuki/market/prices
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/market/analytics/prices/compare
 * Multi-exchange price comparison with bid/ask spread analysis.
 * NOT the same as GET /v1/yuki/market/prices (single-source priceOracle lookup) —
 * this does live cross-exchange CCXT queries and computes real spread.
 */
router.get('/prices/compare', validateExchangeQuery, asyncHandler(async (req: Request, res: Response) => {
  const symbol = (req as any).symbol as string;
  const exchanges = (req as any).exchangeList as string[];

  const prices = await ccxtService.getPricesFromMultipleExchanges(symbol, exchanges);
  const validPrices = Object.entries(prices).filter(([, p]) => p !== null);

  if (validPrices.length === 0) {
    return res.status(404).json({ error: `No price data available for ${symbol} on requested exchanges`, symbol });
  }

  const bids = validPrices.map(([, p]) => p!.bid).filter(b => b > 0);
  const asks = validPrices.map(([, p]) => p!.ask).filter(a => a > 0);
  const spread = Math.max(...asks) - Math.min(...bids);
  const spreadPct = ((spread / Math.min(...bids)) * 100).toFixed(4);

  res.json({
    symbol,
    timestamp: Date.now(),
    prices,
    analysis: {
      best_bid: Math.max(...bids),
      best_ask: Math.min(...asks),
      spread,
      spread_pct: parseFloat(spreadPct),
      sources: validPrices.length,
    },
  });
}));

/** GET /v1/yuki/market/analytics/prices/best?symbol=CELO */
router.get('/prices/best', validateExchangeQuery, asyncHandler(async (req: Request, res: Response) => {
  const symbol = (req as any).symbol as string;
  const exchanges = (req as any).exchangeList as string[];

  const result = await ccxtService.getBestPrice(symbol, exchanges);

  res.json({
    symbol,
    timestamp: Date.now(),
    best: {
      exchange: result.best.exchange,
      bid: result.best.bid,
      ask: result.best.ask,
      last: result.best.last,
      spread_pct: result.best.spread,
    },
    analysis: result.analysis,
    all_prices: result.all,
  });
}));

// ════════════════════════════════════════════════════════════════════════════════
// TECHNICALS & HISTORICAL
// ════════════════════════════════════════════════════════════════════════════════

/** GET /v1/yuki/market/analytics/technicals?symbol=BTC&exchange=binance&timeframe=1d */
router.get('/technicals', validateExchangeQuery, asyncHandler(async (req: Request, res: Response) => {
  const symbol = (req as any).symbol as string;
  const { exchange = 'binance', timeframe = '1d', limit = '200' } = req.query;

  const validTimeframes = ['1h', '4h', '1d'];
  if (!validTimeframes.includes(timeframe as string)) {
    return res.status(400).json({ error: `Invalid timeframe for technicals: ${timeframe}`, valid: validTimeframes });
  }

  const limitNum = Math.min(parseInt(limit as string) || 200, 500);
  if (limitNum < 26) {
    return res.status(400).json({ error: 'Limit must be at least 26 candles for technical analysis' });
  }

  const ohlcvData = await ccxtService.getOHLCVFromExchange(exchange as string, symbol, timeframe as string, limitNum);

  if (!ohlcvData || ohlcvData.length < 26) {
    return res.status(404).json({
      error: `Insufficient data for technical analysis. Need at least 26 candles, got ${ohlcvData?.length || 0}`,
      symbol, exchange, timeframe,
    });
  }

  const ohlcv = ohlcvData.map(candle => ({
    open: candle[1], high: candle[2], low: candle[3], close: candle[4], volume: candle[5],
  }));

  const indicators = calculateAllIndicators(ohlcv, symbol, exchange as string, timeframe as string);

  res.json({ symbol, exchange, timeframe, count: ohlcv.length, timestamp: Date.now(), indicators });
}));

/** GET /v1/yuki/market/analytics/historical?symbol=BTC&exchange=binance&period=1y */
router.get('/historical', validateExchangeQuery, asyncHandler(async (req: Request, res: Response) => {
  const symbol = (req as any).symbol as string;
  const { exchange = 'binance', period = '1y' } = req.query;

  const validPeriods = ['1m', '3m', '6m', '1y', 'all'];
  if (!validPeriods.includes(period as string)) {
    return res.status(400).json({ error: `Invalid period: ${period}`, valid: validPeriods });
  }

  const analysis = await getHistoricalAnalysis(symbol, exchange as string, period as '1m' | '3m' | '6m' | '1y' | 'all');
  res.json({ symbol, exchange, period, timestamp: Date.now(), analysis });
}));

/** GET /v1/yuki/market/analytics/historical/compare?symbol=BTC&exchange=binance */
router.get('/historical/compare', validateExchangeQuery, asyncHandler(async (req: Request, res: Response) => {
  const symbol = (req as any).symbol as string;
  const { exchange = 'binance' } = req.query;

  const comparison = await compareHistoricalPeriods(symbol, exchange as string);
  res.json({ symbol, exchange, timestamp: Date.now(), comparison });
}));

// ════════════════════════════════════════════════════════════════════════════════
// ORDER BOOK
// ════════════════════════════════════════════════════════════════════════════════

/** GET /v1/yuki/market/analytics/orderbook?symbol=BTC&exchange=binance&limit=20 */
router.get('/orderbook', validateExchangeQuery, asyncHandler(async (req: Request, res: Response) => {
  const symbol = (req as any).symbol as string;
  const { exchange = 'binance', limit = '20' } = req.query;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const analysis = await analyzeOrderBook(symbol, exchange as string, limitNum);
  res.json({ success: true, ...analysis });
}));

/** GET /v1/yuki/market/analytics/orderbook/alerts?symbol=BTC&exchange=binance */
router.get('/orderbook/alerts', validateExchangeQuery, asyncHandler(async (req: Request, res: Response) => {
  const symbol = (req as any).symbol as string;
  const { exchange = 'binance', spreadPercent, imbalancePercent, liquidityScore } = req.query;

  const thresholds = {
    ...(spreadPercent && { spreadPercent: parseFloat(spreadPercent as string) }),
    ...(imbalancePercent && { imbalancePercent: parseFloat(imbalancePercent as string) }),
    ...(liquidityScore && { liquidityScore: parseFloat(liquidityScore as string) }),
  };

  const result = await checkLiquidityAlerts(symbol, exchange as string, thresholds);
  res.json({ success: true, symbol, exchange, alerts: result.alerts, metrics: result.metrics });
}));

/** GET /v1/yuki/market/analytics/orderbook/profile?symbol=BTC&exchanges=binance,coinbase,kraken */
router.get('/orderbook/profile', validateExchangeQuery, asyncHandler(async (req: Request, res: Response) => {
  const symbol = (req as any).symbol as string;
  const { exchanges } = req.query;

  const exchangeList = exchanges
    ? (exchanges as string).split(',').map(e => e.trim().toLowerCase())
    : ['binance', 'coinbase', 'kraken'];

  const profile = await getLiquidityProfile(symbol, exchangeList);
  res.json({ success: true, symbol, exchanges: exchangeList, profile });
}));

// ════════════════════════════════════════════════════════════════════════════════
// LIQUIDITY — extends, does not collide with, market/liquidity/:symbol
// ════════════════════════════════════════════════════════════════════════════════

/** GET /v1/yuki/market/analytics/liquidity/score?symbol=BTC&exchange=binance */
router.get('/liquidity/score', validateExchangeQuery, asyncHandler(async (req: Request, res: Response) => {
  const symbol = (req as any).symbol as string;
  const { exchange = 'binance', avgDailyChange = '2.5' } = req.query;
  const avgChange = parseFloat(avgDailyChange as string) || 2.5;

  const metrics = await calculateLiquidityMetrics(symbol, exchange as string, avgChange);
  const warnings = getLiquidityWarnings(metrics);
  res.json({ success: true, ...metrics, warnings });
}));

/** GET /v1/yuki/market/analytics/liquidity/ranking?symbol=BTC */
router.get('/liquidity/ranking', validateExchangeQuery, asyncHandler(async (req: Request, res: Response) => {
  const symbol = (req as any).symbol as string;
  const { exchanges } = req.query;

  const exchangeList = exchanges
    ? (exchanges as string).split(',').map(e => e.trim().toLowerCase())
    : ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'];

  const ranking = await rankAssetsByLiquidity(symbol, exchangeList);
  res.json({ success: true, ...ranking, timestamp: Date.now() });
}));

// ════════════════════════════════════════════════════════════════════════════════
// ARBITRAGE — disambiguated from GET /v1/yuki/market/opportunities
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/market/analytics/arbitrage/scan?symbol=BTC&exchanges=...&minProfitPercent=0.5
 * Live cross-exchange arbitrage scan for a specific symbol, no user scoping.
 * NOT the same as GET /v1/yuki/market/opportunities, which computes arbitrage
 * from the *authenticated user's own* venue_execution_stats trade history.
 */
router.get('/arbitrage/scan', asyncHandler(async (req: Request, res: Response) => {
  const { symbol, exchanges, minProfitPercent } = req.query;
  if (!symbol) return res.status(400).json({ success: false, error: 'Symbol is required' });

  const exchangeList = exchanges
    ? (exchanges as string).split(',').map(e => e.trim())
    : ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'];

  const minProfit = minProfitPercent ? parseFloat(minProfitPercent as string) : 0.5;
  const opportunities = await findArbitrageOpportunities(symbol as string, exchangeList, minProfit);

  res.json({
    success: true,
    symbol,
    exchanges: exchangeList,
    minProfitPercent: minProfit,
    opportunitiesFound: opportunities.length,
    opportunities,
  });
}));

/** GET /v1/yuki/market/analytics/arbitrage/best?symbol=BTC */
router.get('/arbitrage/best', asyncHandler(async (req: Request, res: Response) => {
  const { symbol, exchanges } = req.query;
  if (!symbol) return res.status(400).json({ success: false, error: 'Symbol is required' });

  const exchangeList = exchanges ? (exchanges as string).split(',').map(e => e.trim()) : undefined;
  const bestOpportunity = await findBestArbitrage(symbol as string, exchangeList);

  res.json({ success: true, symbol, bestOpportunity });
}));

/** POST /v1/yuki/market/analytics/arbitrage/calculate */
router.post('/arbitrage/calculate', asyncHandler(async (req: Request, res: Response) => {
  const { opportunity, tradeAmount } = req.body;
  if (!opportunity) return res.status(400).json({ success: false, error: 'Arbitrage opportunity is required' });

  const amount = tradeAmount || 1000;
  const profit = calculateTradeProfit(opportunity, amount);
  res.json({ success: true, tradeAmount: amount, profit });
}));

// ════════════════════════════════════════════════════════════════════════════════
// SENTIMENT
// ════════════════════════════════════════════════════════════════════════════════

/** GET /v1/yuki/market/analytics/sentiment/fear-greed */
router.get('/sentiment/fear-greed', asyncHandler(async (_req: Request, res: Response) => {
  const fearGreedIndex = await getFearGreedIndex();
  res.json({ success: true, fearGreedIndex });
}));

/** GET /v1/yuki/market/analytics/sentiment/market-changes */
router.get('/sentiment/market-changes', asyncHandler(async (_req: Request, res: Response) => {
  const marketChanges = await getMarketChanges();
  res.json({ success: true, periods: marketChanges.length, marketChanges });
}));

/** GET /v1/yuki/market/analytics/sentiment/btc-dominance */
router.get('/sentiment/btc-dominance', asyncHandler(async (_req: Request, res: Response) => {
  const btcDominance = await getBtcDominance();
  res.json({ success: true, btcDominance });
}));

/** GET /v1/yuki/market/analytics/sentiment/complete */
router.get('/sentiment/complete', asyncHandler(async (_req: Request, res: Response) => {
  const sentiment = await getMarketSentiment();
  res.json({ success: true, sentiment });
}));

// ════════════════════════════════════════════════════════════════════════════════
// CACHE (operational — consider admin-gating separately if exposed publicly)
// ════════════════════════════════════════════════════════════════════════════════

/** GET /v1/yuki/market/analytics/cache-stats */
router.get('/cache-stats', asyncHandler(async (_req: Request, res: Response) => {
  const stats = ccxtService.getCacheStats();
  res.json({ timestamp: Date.now(), cache: stats });
}));

/**
 * POST /v1/yuki/market/analytics/cache/clear
 * ⚠️ Carried over from the original file with its TODO intact: this has
 * no admin check, just the router-level isAuthenticated. Any logged-in
 * user can currently clear the shared CCXT/arbitrage/fear-greed caches
 * for everyone. Worth gating behind an isAdmin check before this file
 * is actually mounted — flagging rather than silently fixing since the
 * right admin-check pattern should match whatever the rest of v1/yuki
 * uses (advancedModeGuard style vs a dedicated isAdmin middleware).
 */
router.post('/cache/clear', asyncHandler(async (_req: Request, res: Response) => {
  ccxtService.clearCaches();
  clearArbitrageCache();
  clearFearGreedCache();
  res.json({ message: 'Caches cleared', timestamp: Date.now() });
}));

// ════════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════════════════════════════════════════════

router.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(`[MARKET-ANALYTICS] Route error: ${error.message}`);
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    timestamp: Date.now(),
  });
});

export default router;