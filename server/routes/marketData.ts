/**
 * Enhanced Market Data Routes
 * 
 * Provides standardized market data endpoints with:
 * - Order book depth analysis
 * - Optimal routing with alternatives
 * - Execution quality metrics
 * - Liquidity depth analytics
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ccxtService } from '../services/ccxtService';
import { SmartRouter } from '../services/smartRouter';
import { createApiResponse, createApiError, ApiErrorCode } from '../types/ApiResponse';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/market/orderbook/:symbol
 * 
 * Get current order book for a trading pair with analytics
 * 
 * Query params:
 * - limit: number (default: 20) - Depth to return (top 20 bids/asks)
 * - exchange: string (optional) - Specific exchange (default: best spread)
 * 
 * Returns: Order book with bid/ask levels and analytics
 */
router.get('/orderbook/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    let exchange = (req.query.exchange as string) || 'binance';

    if (limit < 1 || limit > 100) {
      return res.status(400).json(
        createApiError(
          ApiErrorCode.INVALID_PARAMETER,
          'Limit must be between 1 and 100',
          400,
          { suggestion: 'Use limit between 1-100' }
        )
      );
    }

    // Get order book from exchange
    let orderBook: any = null;
    try {
      orderBook = await ccxtService.fetchOrderBook(exchange, symbol, limit);
    } catch (error) {
      logger.warn(`Failed to fetch order book from ${exchange}, trying alternatives...`);
      // Fallback to other exchanges
      for (const fallbackExchange of ['coinbase', 'kraken', 'gate.io']) {
        try {
          orderBook = await ccxtService.fetchOrderBook(fallbackExchange, symbol, limit);
          exchange = fallbackExchange;
          break;
        } catch (e) {
          continue;
        }
      }
    }

    if (!orderBook) {
      return res.status(404).json(
        createApiError(
          ApiErrorCode.NOT_FOUND,
          `Order book not available for ${symbol}`,
          404,
          { suggestion: `Try querying with limit parameter or a different symbol` }
        )
      );
    }

    // Calculate analytics
    const topBid = orderBook.bids?.[0] || [0, 0];
    const topAsk = orderBook.asks?.[0] || [0, 0];
    const spreadAmount = topAsk[0] - topBid[0];
    const spreadPct = topBid[0] > 0 ? (spreadAmount / topBid[0]) * 100 : 0;

    // Calculate bid/ask imbalance
    const totalBidQty = orderBook.bids?.reduce((sum: number, [, qty]: [number, number]) => sum + qty, 0) || 0;
    const totalAskQty = orderBook.asks?.reduce((sum: number, [, qty]: [number, number]) => sum + qty, 0) || 0;
    const bidAskImbalance = totalBidQty > 0 ? totalAskQty / totalBidQty : 1;

    // Calculate total liquidity at different price levels
    let liquidityAtTopLevel = 0;
    let liquidityAt1Pct = 0;
    let liquidityAt5Pct = 0;

    const targetPrice = (topBid[0] + topAsk[0]) / 2;

    for (const [price, qty] of orderBook.bids || []) {
      if (price >= targetPrice * 0.99) liquidityAtTopLevel += qty;
      if (price >= targetPrice * 0.95) liquidityAt1Pct += qty;
      if (price >= targetPrice * 0.95) liquidityAt5Pct += qty;
    }

    for (const [price, qty] of orderBook.asks || []) {
      if (price <= targetPrice * 1.01) liquidityAtTopLevel += qty;
      if (price <= targetPrice * 1.05) liquidityAt1Pct += qty;
      if (price <= targetPrice * 1.05) liquidityAt5Pct += qty;
    }

    const data = {
      symbol,
      exchange,
      timestamp: orderBook.timestamp || Date.now(),
      bids: orderBook.bids?.slice(0, limit) || [],
      asks: orderBook.asks?.slice(0, limit) || [],
      analytics: {
        spread: {
          amount: spreadAmount,
          percent: parseFloat(spreadPct.toFixed(4)),
        },
        liquidityMetrics: {
          totalBidQuantity: parseFloat(totalBidQty.toFixed(8)),
          totalAskQuantity: parseFloat(totalAskQty.toFixed(8)),
          bidAskImbalance: parseFloat(bidAskImbalance.toFixed(4)),
          imbalanceDirection: bidAskImbalance > 1 ? 'bullish' : 'bearish',
        },
        depth: {
          liquidityAtTopLevel: parseFloat(liquidityAtTopLevel.toFixed(8)),
          liquidityAt1Pct: parseFloat(liquidityAt1Pct.toFixed(8)),
          liquidityAt5Pct: parseFloat(liquidityAt5Pct.toFixed(8)),
        },
        topOfBook: {
          bestBid: topBid[0],
          bestBidQty: topBid[1],
          bestAsk: topAsk[0],
          bestAskQty: topAsk[1],
          midPrice: (topBid[0] + topAsk[0]) / 2,
        },
      },
    };

    res.json(createApiResponse(data, { dataSource: exchange }));
  } catch (error: any) {
    logger.error('Error fetching order book:', error);
    res.status(500).json(
      createApiError(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch order book',
        500,
        { details: { error: error.message } }
      )
    );
  }
});

/**
 * GET /api/v1/market/optimal-routes/:symbol
 * 
 * Get optimal trading routes with all alternatives
 * 
 * Query params:
 * - amount: number (required) - Amount to trade
 * - userVolume30d: number (optional) - 30-day volume for fee tier
 * - isMaker: boolean (optional) - Whether placing limit order
 * 
 * Returns: Best route + all alternatives with full cost breakdown
 */
router.get('/optimal-routes/:symbol', [authenticateToken as any], async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const amount = parseFloat(req.query.amount as string);
    const userVolume30d = parseFloat(req.query.userVolume30d as string) || 0;
    const isMaker = (req.query.isMaker as string)?.toLowerCase() === 'true' || false;

    if (!amount || amount <= 0) {
      return res.status(400).json(
        createApiError(
          ApiErrorCode.INVALID_PARAMETER,
          'Amount must be a positive number',
          400,
          { suggestion: 'Provide amount parameter as a positive number' }
        )
      );
    }

    const smartRouter = SmartRouter.getInstance();
    const optimalRoute = await smartRouter.calculateOptimalRoute(
      symbol,
      amount,
      isMaker,
      userVolume30d
    );

    // Format response
    const data = {
      tradingPair: optimalRoute.tradingPair,
      amount: optimalRoute.amount,
      bestRoute: {
        exchange: optimalRoute.bestExchange,
        basePrice: optimalRoute.bestPrice,
        totalCost: optimalRoute.totalCost,
        netPrice: optimalRoute.netPrice,
        savings: optimalRoute.savings,
        breakdown: optimalRoute.costBreakdown,
        profitability: optimalRoute.netPrice < optimalRoute.bestPrice ? 'improved-execution' : 'standard',
      },
      alternatives: optimalRoute.alternatives.map((alt) => ({
        exchange: alt.exchange,
        basePrice: alt.basePrice,
        totalCost: alt.totalCost,
        netPrice: alt.netPrice,
        slippage: {
          percent: parseFloat((alt.slippageCalculation.slippagePercent * 100).toFixed(4)),
          amount: alt.slippageCalculation.slippageAmount,
        },
        fees: {
          maker: alt.makerFee,
          taker: alt.takerFee,
          total: alt.makerFee + alt.takerFee,
        },
        costVsBest: parseFloat((alt.totalCost - optimalRoute.totalCost).toFixed(8)),
      })),
      summary: {
        totalAlternatives: optimalRoute.alternatives.length,
        costSpread: {
          min: Math.min(...optimalRoute.alternatives.map((a) => a.totalCost)),
          max: Math.max(...optimalRoute.alternatives.map((a) => a.totalCost)),
          range: Math.max(...optimalRoute.alternatives.map((a) => a.totalCost)) -
            Math.min(...optimalRoute.alternatives.map((a) => a.totalCost)),
        },
        recommendedRoute: optimalRoute.bestExchange,
        potentialSavings: optimalRoute.savings,
      },
      timestamp: optimalRoute.timestamp,
    };

    res.json(createApiResponse(data));
  } catch (error: any) {
    logger.error('Error calculating optimal routes:', error);
    res.status(500).json(
      createApiError(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to calculate optimal routes',
        500,
        { details: { error: error.message } }
      )
    );
  }
});

/**
 * GET /api/v1/market/liquidity-depth/:symbol
 * 
 * Get detailed liquidity analysis across price levels
 * 
 * Query params:
 * - exchange: string (optional)
 * - priceRanges: '1,5,10' (optional) - % ranges to analyze
 * 
 * Returns: Liquidity metrics at different price levels
 */
router.get('/liquidity-depth/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    let exchange = (req.query.exchange as string) || 'binance';
    const priceRangesStr = (req.query.priceRanges as string) || '0.5,1,2,5,10';
    const priceRanges = priceRangesStr.split(',').map((r) => parseFloat(r)).filter((r) => !isNaN(r));

    // Get order book
    let orderBook: any = null;
    try {
      orderBook = await ccxtService.fetchOrderBook(exchange, symbol, 100);
    } catch (error) {
      return res.status(404).json(
        createApiError(
          ApiErrorCode.NOT_FOUND,
          `Order book not available for ${symbol}`,
          404
        )
      );
    }

    const topBid = orderBook.bids?.[0]?.[0] || 0;
    const topAsk = orderBook.asks?.[0]?.[0] || 0;
    const midPrice = (topBid + topAsk) / 2;

    // Calculate liquidity at each price range
    const liquidity = priceRanges.map((range) => {
      const lowerBound = midPrice * (1 - range / 100);
      const upperBound = midPrice * (1 + range / 100);

      const bidLiquidity = (orderBook.bids || [])
        .filter(([price]: [number, number]) => price >= lowerBound)
        .reduce((sum: number, [, qty]: [number, number]) => sum + qty, 0);

      const askLiquidity = (orderBook.asks || [])
        .filter(([price]: [number, number]) => price <= upperBound)
        .reduce((sum: number, [, qty]: [number, number]) => sum + qty, 0);

      return {
        rangePercent: range,
        lowerBound,
        upperBound,
        bidLiquidity: parseFloat(bidLiquidity.toFixed(8)),
        askLiquidity: parseFloat(askLiquidity.toFixed(8)),
        totalLiquidity: parseFloat((bidLiquidity + askLiquidity).toFixed(8)),
      };
    });

    const data = {
      symbol,
      exchange,
      midPrice,
      timestamp: orderBook.timestamp || Date.now(),
      liquidityAnalysis: liquidity,
      interpretation: {
        bestLiquidity: liquidity.reduce((best, curr) =>
          curr.totalLiquidity > best.totalLiquidity ? curr : best
        ),
        warning: liquidity[0]?.totalLiquidity < 100 ? 'Low liquidity - large trades may have high slippage' : undefined,
      },
    };

    res.json(createApiResponse(data, { dataSource: exchange }));
  } catch (error: any) {
    logger.error('Error calculating liquidity depth:', error);
    res.status(500).json(
      createApiError(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to calculate liquidity depth',
        500
      )
    );
  }
});

/**
 * GET /api/v1/market/spread-analysis/:symbol
 * 
 * Compare spreads and execution quality across multiple exchanges
 * 
 * Returns: Spread comparison and execution metrics
 */
router.get('/spread-analysis/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchanges = ['binance', 'coinbase', 'kraken', 'gate.io'];

    const spreadData = await Promise.allSettled(
      exchanges.map(async (ex) => {
        try {
          const book = await ccxtService.fetchOrderBook(ex, symbol, 10);
          const topBid = book.bids?.[0]?.[0] || 0;
          const topAsk = book.asks?.[0]?.[0] || 0;
          const spread = topAsk - topBid;
          const spreadPct = topBid > 0 ? (spread / topBid) * 100 : 0;

          return {
            exchange: ex,
            bestBid: topBid,
            bestAsk: topAsk,
            spread,
            spreadPct: parseFloat(spreadPct.toFixed(4)),
            timestamp: book.timestamp || Date.now(),
          };
        } catch (error) {
          return null;
        }
      })
    );

    const validSpreads = spreadData
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => (r as any).value)
      .filter((v) => v !== null);

    if (validSpreads.length === 0) {
      return res.status(404).json(
        createApiError(ApiErrorCode.NOT_FOUND, `No spread data available for ${symbol}`)
      );
    }

    // Find best and worst
    const bySpread = [...validSpreads].sort((a, b) => a.spreadPct - b.spreadPct);

    const data = {
      symbol,
      analysis: validSpreads,
      ranking: {
        tightestSpread: bySpread[0],
        widestSpread: bySpread[bySpread.length - 1],
        averageSpread: parseFloat(
          (validSpreads.reduce((sum, s) => sum + s.spreadPct, 0) / validSpreads.length).toFixed(4)
        ),
      },
      timestamp: Date.now(),
    };

    res.json(createApiResponse(data));
  } catch (error: any) {
    logger.error('Error analyzing spreads:', error);
    res.status(500).json(
      createApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to analyze spreads', 500)
    );
  }
});

export default router;
