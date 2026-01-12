/**
 * CCXT Exchange Routes
 * 
 * API endpoints for cryptocurrency exchange data and trading
 * Phase 1: Read-only endpoints (prices, OHLCV, market info)
 * Phase 2+: Trading endpoints (orders, balance management)
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import ccxtService from '../services/ccxtService';
import { logger } from '../utils/logger';
import { calculateAllIndicators } from '../services/technicalIndicators';
import { getHistoricalAnalysis, compareHistoricalPeriods } from '../services/historicalData';
import { analyzeOrderBook, checkLiquidityAlerts, getLiquidityProfile } from '../services/orderBookAnalyzer';
import { calculateLiquidityMetrics, rankAssetsByLiquidity, getLiquidityWarnings } from '../services/liquidityScoring';
import { findArbitrageOpportunities, findBestArbitrage, findProfitableSymbols, calculateTradeProfit, clearArbitrageCache } from '../services/arbitrageDetection';
import { getFearGreedIndex, getMarketChanges, getBtcDominance, getMarketSentiment, clearFearGreedCache } from '../services/fearGreedIndex';

const router: Router = express.Router();

/**
 * Middleware: Error handler wrapper
 */
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Middleware: Validate query parameters
 */
const validateExchangeQuery = (req: Request, res: Response, next: NextFunction) => {
  const { symbol, exchanges } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol parameter required (e.g., CELO/USDC)' });
  }

  // Parse exchanges parameter
  const exchangeList = exchanges
    ? (exchanges as string).split(',').map((e) => e.trim().toLowerCase())
    : ['binance', 'coinbase', 'kraken'];

  // Validate exchanges
  const validExchanges = ccxtService.getAvailableExchanges();
  const invalidExchanges = exchangeList.filter((e) => !validExchanges.includes(e));

  if (invalidExchanges.length > 0) {
    return res.status(400).json({
      error: `Invalid exchanges: ${invalidExchanges.join(', ')}`,
      available: validExchanges
    });
  }

  // Store validated data in request
  (req as any).exchangeList = exchangeList;
  (req as any).symbol = symbol;
  next();
};

/**
 * ==========================================
 * PUBLIC ENDPOINTS (No auth required)
 * ==========================================
 */

/**
 * GET /api/exchanges/status
 * Get connection status of all exchanges
 * 
 * @returns Exchange connection status
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    const status = ccxtService.getExchangeStatus();
    const available = ccxtService.getAvailableExchanges();
    const health = await ccxtService.healthCheck();

    res.json({
      exchanges: status,
      available,
      health
    });
  } catch (error: any) {
    logger.error(`Status check failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to check status' });
  }
}));

/**
 * GET /api/exchanges/available
 * Get list of available exchanges (simplified)
 * 
 * @returns List of available exchange names
 */
router.get('/available', asyncHandler(async (req: Request, res: Response) => {
  try {
    const available = ccxtService.getAvailableExchanges();
    const health = await ccxtService.healthCheck();

    res.json({
      exchanges: available,
      health: health || {}
    });
  } catch (error: any) {
    logger.error(`Available exchanges fetch failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch available exchanges' });
  }
}));

/**
 * GET /api/exchanges/prices
 * Get current prices from multiple exchanges
 * 
 * Query params:
 * - symbol: Trading pair (CELO/USDC, CELO, etc)
 * - exchanges: Comma-separated list (binance,coinbase,kraken)
 * 
 * @example GET /api/exchanges/prices?symbol=CELO&exchanges=binance,coinbase
 * @returns Prices from requested exchanges
 */
router.get(
  '/prices',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const exchanges = (req as any).exchangeList as string[];

    logger.debug(`Fetching prices for ${symbol} from [${exchanges.join(', ')}]`);

    try {
      const prices = await ccxtService.getPricesFromMultipleExchanges(symbol, exchanges);

      // Calculate analysis
      const validPrices = Object.entries(prices).filter(([, p]) => p !== null);

      if (validPrices.length === 0) {
        return res.status(404).json({
          error: `No price data available for ${symbol} on requested exchanges`,
          symbol
        });
      }

      const bids = validPrices.map(([, p]) => p!.bid).filter((b) => b > 0);
      const asks = validPrices.map(([, p]) => p!.ask).filter((a) => a > 0);

      const spread = Math.max(...asks) - Math.min(...bids);
      const spreadPct = ((spread / Math.min(...bids)) * 100).toFixed(4);

      res.json({
        symbol,
        timestamp: Date.now(),
        prices,
        analysis: {
          best_bid: Math.max(...bids),
          best_ask: Math.min(...asks),
          spread: spread,
          spread_pct: parseFloat(spreadPct),
          sources: validPrices.length
        }
      });
    } catch (error: any) {
      logger.error(`Price fetch failed: ${error.message}`);
      res.status(500).json({
        error: 'Failed to fetch prices',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/best-price
 * Get best (tightest spread) price across exchanges
 * 
 * @example GET /api/exchanges/best-price?symbol=CELO
 * @returns Best price with spread analysis
 */
router.get(
  '/best-price',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const exchanges = (req as any).exchangeList as string[];

    try {
      const result = await ccxtService.getBestPrice(symbol, exchanges);

      res.json({
        symbol,
        timestamp: Date.now(),
        best: {
          exchange: result.best.exchange,
          bid: result.best.bid,
          ask: result.best.ask,
          last: result.best.last,
          spread_pct: result.best.spread
        },
        analysis: result.analysis,
        all_prices: result.all
      });
    } catch (error: any) {
      logger.error(`Best price query failed: ${error.message}`);
      res.status(500).json({
        error: 'Failed to get best price',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/ohlcv
 * Get OHLCV (candle) data from exchange
 * 
 * Query params:
 * - symbol: Trading pair (CELO/USDC, CELO, etc)
 * - exchange: Exchange name (default: binance)
 * - timeframe: Candle period (1m, 5m, 15m, 1h, 4h, 1d) (default: 1h)
 * - limit: Number of candles (default: 24)
 * 
 * @example GET /api/exchanges/ohlcv?symbol=CELO&timeframe=1h&limit=24
 * @returns OHLCV candle data: [[timestamp, open, high, low, close, volume], ...]
 */
router.get(
  '/ohlcv',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const { exchange = 'binance', timeframe = '1h', limit = '24' } = req.query;

    // Validate timeframe
    const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];
    if (!validTimeframes.includes(timeframe as string)) {
      return res.status(400).json({
        error: `Invalid timeframe: ${timeframe}`,
        valid: validTimeframes
      });
    }

    // Validate limit
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 500) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 500'
      });
    }

    try {
      const data = await ccxtService.getOHLCVFromExchange(
        exchange as string,
        symbol,
        timeframe as string,
        limitNum
      );

      if (!data || data.length === 0) {
        return res.status(404).json({
          error: `No OHLCV data found for ${symbol} on ${exchange}`
        });
      }

      res.json({
        symbol,
        exchange,
        timeframe,
        count: data.length,
        timestamp: Date.now(),
        data: data.map((candle) => ({
          timestamp: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5]
        }))
      });
    } catch (error: any) {
      logger.error(`OHLCV fetch failed: ${error.message}`);
      res.status(500).json({
        error: 'Failed to fetch OHLCV data',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/markets
 * Get available markets from exchange with price and volume data
 * 
 * Query params:
 * - exchange: Exchange name (default: binance)
 * - symbol: Filter by base symbol (optional)
 * - limit: Maximum number of markets to return (default: 100)
 * 
 * @example GET /api/exchanges/markets?exchange=binance&symbol=CELO&limit=50
 * @returns Array of market information with current price and volume
 */
router.get('/markets', asyncHandler(async (req: Request, res: Response) => {
  const { exchange = 'binance', symbol, limit = '100' } = req.query;

  // Validate exchange
  const validExchanges = ccxtService.getAvailableExchanges();
  if (!validExchanges.includes(exchange as string)) {
    return res.status(400).json({
      error: `Invalid exchange: ${exchange}`,
      available: validExchanges
    });
  }

  // Validate limit
  const limitNum = Math.min(parseInt(limit as string) || 100, 500);

  try {
    let markets = await ccxtService.getMarkets(exchange as string);

    // Filter by symbol if provided
    if (symbol) {
      markets = markets.filter((m) =>
        m.base.toUpperCase().includes((symbol as string).toUpperCase())
      );
    }

    // Limit results
    markets = markets.slice(0, limitNum);

    // Fetch ticker data for each market in parallel
    const marketsWithPrices = await Promise.all(
      markets.map(async (m) => {
        try {
          const ticker = await ccxtService.getTickerFromExchange(exchange as string, m.symbol);
          return {
            id: m.id,
            symbol: m.symbol,
            base: m.base,
            quote: m.quote,
            maker_fee: m.maker,
            taker_fee: m.taker,
            limits: m.limits,
            // Price and volume data
            last: ticker?.last || 0,
            bid: ticker?.bid || 0,
            ask: ticker?.ask || 0,
            price: ticker?.last || 0,
            volume: ticker?.volume || 0,
            quoteVolume: ticker?.volume || 0,
            timestamp: ticker?.timestamp || Date.now()
          };
        } catch (error) {
          // Return market without price data if ticker fetch fails
          return {
            id: m.id,
            symbol: m.symbol,
            base: m.base,
            quote: m.quote,
            maker_fee: m.maker,
            taker_fee: m.taker,
            limits: m.limits,
            last: 0,
            bid: 0,
            ask: 0,
            price: 0,
            volume: 0,
            quoteVolume: 0,
            timestamp: Date.now()
          };
        }
      })
    );

    res.json({
      exchange,
      count: marketsWithPrices.length,
      timestamp: Date.now(),
      markets: marketsWithPrices
    });
  } catch (error: any) {
    logger.error(`Markets fetch failed: ${error.message}`);
    res.status(500).json({
      error: 'Failed to fetch markets',
      details: error.message
    });
  }
}));

/**
 * GET /api/exchanges/assets
 * List all available assets/symbols for a given exchange (dynamic discovery + overrides)
 * Query: exchange=binance
 */
router.get(
  '/assets',
  asyncHandler(async (req: Request, res: Response) => {
    const exchange = (req.query.exchange as string)?.toLowerCase();
    if (!exchange) {
      return res.status(400).json({ error: 'exchange parameter required' });
    }
    try {
      const assets = await ccxtService.getAvailableAssets(exchange);
      res.json({ exchange, assets });
    } catch (error: any) {
      logger.error(`Asset discovery failed: ${error.message}`);
      res.status(500).json({ error: 'Failed to fetch assets', details: error.message });
    }
  })
);

/**
 * GET /api/exchanges/find-symbol
 * Find which exchanges carry a specific symbol
 * Query params:
 * - symbol: Symbol or pair to find (e.g., BTC, BTC/USDT)
 * - exchanges: Comma-separated list of exchanges to search (optional, default: all)
 * 
 * @example GET /api/exchanges/find-symbol?symbol=BTC&exchanges=binance,coinbase,kraken
 * @returns Array of exchanges that have this symbol with pricing info
 */
router.get(
  '/find-symbol',
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol, exchanges: exchangesParam } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'symbol parameter required' });
    }

    const allExchanges = ccxtService.getAvailableExchanges();
    const exchangesToSearch = exchangesParam 
      ? (exchangesParam as string).split(',').map(e => e.trim().toLowerCase())
      : allExchanges;

    try {
      const results = await Promise.all(
        exchangesToSearch.map(async (exchange) => {
          try {
            const ticker = await ccxtService.getTickerFromExchange(exchange, symbol as string);
            if (ticker) {
              return {
                exchange,
                symbol: ticker.symbol,
                price: ticker.last,
                bid: ticker.bid,
                ask: ticker.ask,
                volume: ticker.volume,
                timestamp: ticker.timestamp
              };
            }
            return null;
          } catch (error) {
            return null;
          }
        })
      );

      const found = results.filter(r => r !== null);

      res.json({
        symbol,
        found: found.length,
        exchanges: found,
        timestamp: Date.now()
      });
    } catch (error: any) {
      logger.error(`Find symbol failed: ${error.message}`);
      res.status(500).json({
        error: 'Failed to search for symbol',
        details: error.message
      });
    }
  })
);

/**
 * ==========================================
 * PRIVATE ENDPOINTS (Require auth)
 * ==========================================
 */

/**
 * POST /api/exchanges/order/validate
 * Validate an order before placement
 * 
 * Body:
 * {
 *   exchange: string (binance, coinbase, etc)
 *   symbol: string (CELO/USDC)
 *   side: 'buy' | 'sell'
 *   amount: number
 *   price?: number (for limit orders)
 * }
 * 
 * @returns Validation result with any errors
 */
router.post(
  '/order/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const { exchange, symbol, side, amount, price } = req.body;

    // Validate required fields
    if (!exchange || !symbol || !side || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: exchange, symbol, side, amount'
      });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be "buy" or "sell"' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    try {
      const validation = await ccxtService.validateOrder(exchange, symbol, side, amount, price);

      res.json({
        valid: validation.valid,
        errors: validation.errors,
        market: validation.market
          ? {
              symbol: validation.market.symbol,
              base: validation.market.base,
              quote: validation.market.quote,
              maker_fee: validation.market.maker,
              taker_fee: validation.market.taker,
              limits: validation.market.limits
            }
          : null
      });
    } catch (error: any) {
      logger.error(`Order validation failed: ${error.message}`);
      res.status(500).json({
        error: 'Failed to validate order',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/cache-stats
 * Get cache statistics (for monitoring)
 * 
 * @returns Cache statistics
 */
router.get('/cache-stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = ccxtService.getCacheStats();

  res.json({
    timestamp: Date.now(),
    cache: stats
  });
}));

/**
 * GET /api/exchanges/technicals
 * Get technical indicators (RSI, MACD, Bollinger Bands, Moving Averages)
 * 
 * Query params:
 * - symbol: Trading pair (CELO/USDC, CELO, etc) (required)
 * - exchange: Exchange name (default: binance)
 * - timeframe: Candle period for analysis (1h, 4h, 1d) (default: 1d)
 * - limit: Number of candles for calculation (default: 200)
 * 
 * @example GET /api/exchanges/technicals?symbol=BTC&exchange=binance&timeframe=1d
 * @returns Technical indicators with signals
 */
router.get(
  '/technicals',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const { exchange = 'binance', timeframe = '1d', limit = '200' } = req.query;

    // Validate timeframe
    const validTimeframes = ['1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe as string)) {
      return res.status(400).json({
        error: `Invalid timeframe for technicals: ${timeframe}`,
        valid: validTimeframes
      });
    }

    // Validate limit
    const limitNum = Math.min(parseInt(limit as string) || 200, 500);
    if (limitNum < 26) {
      return res.status(400).json({
        error: 'Limit must be at least 26 candles for technical analysis'
      });
    }

    try {
      // Fetch OHLCV data
      const ohlcvData = await ccxtService.getOHLCVFromExchange(
        exchange as string,
        symbol,
        timeframe as string,
        limitNum
      );

      if (!ohlcvData || ohlcvData.length < 26) {
        return res.status(404).json({
          error: `Insufficient data for technical analysis. Need at least 26 candles, got ${ohlcvData?.length || 0}`,
          symbol,
          exchange,
          timeframe
        });
      }

      // Convert CCXT format [timestamp, o, h, l, c, v] to object format
      const ohlcv = ohlcvData.map((candle) => ({
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      }));

      // Calculate all technical indicators
      const indicators = calculateAllIndicators(
        ohlcv,
        symbol,
        exchange as string,
        timeframe as string
      );

      res.json({
        symbol,
        exchange,
        timeframe,
        count: ohlcv.length,
        timestamp: Date.now(),
        indicators
      });
    } catch (error: any) {
      logger.error(`Technical indicators calculation failed: ${error.message}`);
      res.status(500).json({
        error: 'Failed to calculate technical indicators',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/historical
 * Get historical OHLCV data and analysis for a specific period
 * 
 * Query params:
 * - symbol: Trading pair (required) (e.g., BTC/USDT, BTC)
 * - exchange: Exchange name (default: binance)
 * - period: Time period (1m, 3m, 6m, 1y, all) (default: 1y)
 * 
 * @example GET /api/exchanges/historical?symbol=BTC&exchange=binance&period=1y
 * @returns Historical data with analysis and statistics
 */
router.get(
  '/historical',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const { exchange = 'binance', period = '1y' } = req.query;

    // Validate period
    const validPeriods = ['1m', '3m', '6m', '1y', 'all'];
    if (!validPeriods.includes(period as string)) {
      return res.status(400).json({
        error: `Invalid period: ${period}`,
        valid: validPeriods
      });
    }

    try {
      const analysis = await getHistoricalAnalysis(
        symbol,
        exchange as string,
        period as '1m' | '3m' | '6m' | '1y' | 'all'
      );

      res.json({
        symbol,
        exchange,
        period,
        timestamp: Date.now(),
        analysis
      });
    } catch (error: any) {
      logger.error(`Historical data fetch failed: ${error.message}`);
      res.status(500).json({
        error: 'Failed to fetch historical data',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/historical/compare
 * Compare historical performance across multiple periods
 * 
 * Query params:
 * - symbol: Trading pair (required)
 * - exchange: Exchange name (default: binance)
 * 
 * @example GET /api/exchanges/historical/compare?symbol=BTC&exchange=binance
 * @returns Historical analysis for 1m, 3m, 6m, and 1y periods with comparison
 */
router.get(
  '/historical/compare',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const { exchange = 'binance' } = req.query;

    try {
      const comparison = await compareHistoricalPeriods(symbol, exchange as string);

      res.json({
        symbol,
        exchange,
        timestamp: Date.now(),
        comparison
      });
    } catch (error: any) {
      logger.error(`Historical comparison failed: ${error.message}`);
      res.status(500).json({
        error: 'Failed to compare historical periods',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/orderbook
 * Get order book depth analysis for a trading pair
 * 
 * Query parameters:
 * - symbol: Trading pair (required)
 * - exchange: Exchange name (default: binance)
 * - limit: Number of order book levels (default: 20, max: 100)
 * 
 * @example GET /api/exchanges/orderbook?symbol=BTC&exchange=binance&limit=20
 * @returns Order book analysis with liquidity metrics, walls, and pressure indicators
 */
router.get(
  '/orderbook',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const { exchange = 'binance', limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);

    try {
      const analysis = await analyzeOrderBook(symbol, exchange as string, limitNum);

      res.json({
        success: true,
        ...analysis
      });
    } catch (error: any) {
      logger.error(`Order book analysis failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze order book',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/orderbook/alerts
 * Check for significant order book imbalances and liquidity issues
 * 
 * Query parameters:
 * - symbol: Trading pair (required)
 * - exchange: Exchange name (default: binance)
 * - spreadPercent: Alert threshold for spread % (default: 1.0)
 * - imbalancePercent: Alert threshold for imbalance % (default: 40)
 * - liquidityScore: Alert threshold for low liquidity (default: 30)
 * 
 * @example GET /api/exchanges/orderbook/alerts?symbol=BTC&exchange=binance
 * @returns Alerts array and current metrics
 */
router.get(
  '/orderbook/alerts',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const { exchange = 'binance', spreadPercent, imbalancePercent, liquidityScore } = req.query;

    const thresholds = {
      ...(spreadPercent && { spreadPercent: parseFloat(spreadPercent as string) }),
      ...(imbalancePercent && { imbalancePercent: parseFloat(imbalancePercent as string) }),
      ...(liquidityScore && { liquidityScore: parseFloat(liquidityScore as string) })
    };

    try {
      const result = await checkLiquidityAlerts(symbol, exchange as string, thresholds);

      res.json({
        success: true,
        symbol,
        exchange,
        alerts: result.alerts,
        metrics: result.metrics
      });
    } catch (error: any) {
      logger.error(`Liquidity alert check failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to check liquidity alerts',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/orderbook/profile
 * Get liquidity profile across multiple exchanges
 * 
 * Query parameters:
 * - symbol: Trading pair (required)
 * - exchanges: Comma-separated list of exchanges (default: binance,coinbase,kraken)
 * 
 * @example GET /api/exchanges/orderbook/profile?symbol=BTC&exchanges=binance,coinbase,kraken
 * @returns Liquidity ratings and metrics for each exchange
 */
router.get(
  '/orderbook/profile',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const { exchanges } = req.query;

    const exchangeList = exchanges
      ? (exchanges as string).split(',').map((e) => e.trim().toLowerCase())
      : ['binance', 'coinbase', 'kraken'];

    try {
      const profile = await getLiquidityProfile(symbol, exchangeList);

      res.json({
        success: true,
        symbol,
        exchanges: exchangeList,
        profile
      });
    } catch (error: any) {
      logger.error(`Liquidity profile fetch failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get liquidity profile',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/liquidity/score
 * Calculate comprehensive liquidity score for a trading pair on an exchange
 * 
 * Query parameters:
 * - symbol: Trading pair (required)
 * - exchange: Exchange name (default: binance)
 * - avgDailyChange: Average daily price change % (default: 2.5)
 * 
 * @example GET /api/exchanges/liquidity/score?symbol=BTC&exchange=binance
 * @returns Liquidity metrics with 6 components (spread, depth, volume, stability, imbalance, volatility)
 */
router.get(
  '/liquidity/score',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const { exchange = 'binance', avgDailyChange = '2.5' } = req.query;
    const avgChange = parseFloat(avgDailyChange as string) || 2.5;

    try {
      const metrics = await calculateLiquidityMetrics(symbol, exchange as string, avgChange);
      const warnings = getLiquidityWarnings(metrics);

      res.json({
        success: true,
        ...metrics,
        warnings
      });
    } catch (error: any) {
      logger.error(`Liquidity score calculation failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate liquidity score',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/liquidity/ranking
 * Rank asset by liquidity across multiple exchanges
 * 
 * Query parameters:
 * - symbol: Trading pair (required)
 * - exchanges: Comma-separated list of exchanges (default: binance,coinbase,kraken,bybit,kucoin,okx)
 * 
 * @example GET /api/exchanges/liquidity/ranking?symbol=BTC
 * @returns Ranked list of exchanges with liquidity scores
 */
router.get(
  '/liquidity/ranking',
  validateExchangeQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const symbol = (req as any).symbol as string;
    const { exchanges } = req.query;

    const exchangeList = exchanges
      ? (exchanges as string).split(',').map((e) => e.trim().toLowerCase())
      : ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'];

    try {
      const ranking = await rankAssetsByLiquidity(symbol, exchangeList);

      res.json({
        success: true,
        ...ranking,
        timestamp: Date.now()
      });
    } catch (error: any) {
      logger.error(`Liquidity ranking failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to rank assets by liquidity',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/arbitrage/opportunities
 * Find arbitrage opportunities across exchanges
 * 
 * Query parameters:
 * - symbol: Trading pair (required)
 * - exchanges: Comma-separated list of exchanges (default: binance,coinbase,kraken,bybit,kucoin,okx)
 * - minProfitPercent: Minimum profit threshold (default: 0.5)
 * 
 * @returns Array of arbitrage opportunities sorted by profit
 */
router.get(
  '/arbitrage/opportunities',
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol, exchanges, minProfitPercent } = req.query;

    if (!symbol) {
      res.status(400).json({
        success: false,
        error: 'Symbol is required'
      });
      return;
    }

    try {
      const exchangeList = exchanges
        ? (exchanges as string).split(',').map((e) => e.trim())
        : ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'];

      const minProfit = minProfitPercent ? parseFloat(minProfitPercent as string) : 0.5;

      const opportunities = await findArbitrageOpportunities(
        symbol as string,
        exchangeList,
        minProfit
      );

      res.json({
        success: true,
        symbol,
        exchanges: exchangeList,
        minProfitPercent: minProfit,
        opportunitiesFound: opportunities.length,
        opportunities
      });
    } catch (error: any) {
      logger.error(`Arbitrage opportunities fetch failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to find arbitrage opportunities',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/arbitrage/best
 * Find the best (most profitable) arbitrage opportunity for a symbol
 * 
 * Query parameters:
 * - symbol: Trading pair (required)
 * - exchanges: Comma-separated list of exchanges (default: all)
 * 
 * @returns Best arbitrage opportunity or null
 */
router.get(
  '/arbitrage/best',
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol, exchanges } = req.query;

    if (!symbol) {
      res.status(400).json({
        success: false,
        error: 'Symbol is required'
      });
      return;
    }

    try {
      const exchangeList = exchanges
        ? (exchanges as string).split(',').map((e) => e.trim())
        : undefined;

      const bestOpportunity = await findBestArbitrage(symbol as string, exchangeList);

      res.json({
        success: true,
        symbol,
        bestOpportunity
      });
    } catch (error: any) {
      logger.error(`Best arbitrage fetch failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to find best arbitrage opportunity',
        details: error.message
      });
    }
  })
);

/**
 * POST /api/exchanges/arbitrage/calculate
 * Calculate profit for a potential arbitrage trade
 * 
 * Body:
 * - opportunity: ArbitrageOpportunity object
 * - tradeAmount: Amount in quote currency (default: 1000)
 * 
 * @returns Trade profit calculation
 */
router.post(
  '/arbitrage/calculate',
  asyncHandler(async (req: Request, res: Response) => {
    const { opportunity, tradeAmount } = req.body;

    if (!opportunity) {
      res.status(400).json({
        success: false,
        error: 'Arbitrage opportunity is required'
      });
      return;
    }

    try {
      const amount = tradeAmount || 1000;
      const profit = calculateTradeProfit(opportunity, amount);

      res.json({
        success: true,
        tradeAmount: amount,
        profit
      });
    } catch (error: any) {
      logger.error(`Trade profit calculation failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate trade profit',
        details: error.message
      });
    }
  })
);

/**
 * POST /api/exchanges/cache/clear
 * Clear all caches (admin only)
 * 
 * @returns Confirmation
 */
/**
 * GET /api/exchanges/sentiment/fear-greed
 * Get Fear & Greed Index with comprehensive metrics
 * 
 * @returns Fear & Greed Index score (0-100) with classification
 */
router.get(
  '/sentiment/fear-greed',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const fearGreedIndex = await getFearGreedIndex();

      res.json({
        success: true,
        fearGreedIndex
      });
    } catch (error: any) {
      logger.error(`Fear & Greed Index fetch failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Fear & Greed Index',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/sentiment/market-changes
 * Get market cap and volume changes over multiple periods
 * 
 * @returns Market changes for 1d, 7d, 30d, 90d, 180d
 */
router.get(
  '/sentiment/market-changes',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const marketChanges = await getMarketChanges();

      res.json({
        success: true,
        periods: marketChanges.length,
        marketChanges
      });
    } catch (error: any) {
      logger.error(`Market changes fetch failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch market changes',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/sentiment/btc-dominance
 * Get Bitcoin dominance and price change data
 * 
 * @returns BTC dominance percentage, price, and changes
 */
router.get(
  '/sentiment/btc-dominance',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const btcDominance = await getBtcDominance();

      res.json({
        success: true,
        btcDominance
      });
    } catch (error: any) {
      logger.error(`BTC dominance fetch failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch BTC dominance',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/exchanges/sentiment/complete
 * Get complete market sentiment (Fear & Greed + Market Changes + BTC Dominance)
 * 
 * @returns Comprehensive market sentiment response
 */
router.get(
  '/sentiment/complete',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const sentiment = await getMarketSentiment();

      res.json({
        success: true,
        sentiment
      });
    } catch (error: any) {
      logger.error(`Market sentiment fetch failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch market sentiment',
        details: error.message
      });
    }
  })
);

router.post('/cache/clear', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Add authentication check
  ccxtService.clearCaches();
  clearArbitrageCache();
  clearFearGreedCache();

  res.json({
    message: 'Caches cleared',
    timestamp: Date.now()
  });
}));

/**
 * Error handling middleware
 */
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Route error: ${error.message}`);
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    timestamp: Date.now()
  });
});

export default router;
