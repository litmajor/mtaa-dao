/**
 * Order Book Analysis Service
 * Analyzes order book depth, liquidity, and trading pressure
 */

import ccxtService from './ccxtService';
import { logger } from '../utils/logger';
import pLimit from 'p-limit';

export interface OrderBookLevel {
  price: number;
  amount: number;
  cumulative: number;
  cumulativePercent: number;
}

export interface OrderBookMetrics {
  symbol: string;
  exchange: string;
  timestamp: number;
  mid: number;
  spread: number;
  spreadPercent: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bidWalls: Array<{ price: number; amount: number }>;
  askWalls: Array<{ price: number; amount: number }>;
  analysis: {
    totalBidVolume: number;
    totalAskVolume: number;
    volumeImbalance: number; // -100 to 100 (negative = more sells)
    bidAskRatio: number;
    liquidityScore: number; // 0-100
    bidDepth1pct: number; // Volume at 1% from mid
    askDepth1pct: number;
    bidDepth5pct: number; // Volume at 5% from mid
    askDepth5pct: number;
    pressure: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  };
}

const limiter = pLimit(3);

/**
 * Fetch order book from CCXT exchange
 */
async function fetchOrderBookFromExchange(
  exchange: string,
  symbol: string,
  limit: number
): Promise<any> {
  return limiter(async () => {
    try {
      const exchangeObj = (ccxtService as any).exchanges?.get(exchange);
      if (!exchangeObj) {
        throw new Error(`Exchange ${exchange} not initialized`);
      }

      const formattedSymbol = await (ccxtService as any).formatSymbolForExchange(exchange, symbol);
      if (!formattedSymbol) {
        throw new Error(`Could not format symbol ${symbol} for ${exchange}`);
      }

      const orderBook = await exchangeObj.fetchOrderBook(formattedSymbol, limit);
      return orderBook;
    } catch (error: any) {
      logger.error(`Failed to fetch order book from ${exchange}: ${error.message}`);
      throw error;
    }
  });
}

/**
 * Detect order book walls (large single orders)
 */
function detectWalls(levels: Array<[number, number]>, topN: number = 3): Array<{ price: number; amount: number }> {
  if (levels.length === 0) return [];

  // Sort by amount (descending) and take top N
  const sorted = [...levels]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  return sorted.map(([price, amount]) => ({
    price,
    amount
  }));
}

/**
 * Calculate cumulative volume from order book levels
 */
function calculateCumulativeVolume(
  levels: Array<[number, number]>,
  totalVolume: number
): OrderBookLevel[] {
  let cumulative = 0;

  return levels.map(([price, amount]) => {
    cumulative += amount;
    return {
      price,
      amount,
      cumulative,
      cumulativePercent: (cumulative / totalVolume) * 100
    };
  });
}

export async function analyzeOrderBook(
  symbol: string,
  exchange: string,
  limit: number = 20
): Promise<OrderBookMetrics> {
  try {
    logger.debug(`Analyzing order book: ${symbol} on ${exchange}`);

    // Fetch order book from exchange
    const orderBook = await fetchOrderBookFromExchange(exchange, symbol, limit);

    if (!orderBook || !orderBook.bids || !orderBook.asks) {
      throw new Error(`No order book data for ${symbol}`);
    }

    const bids = orderBook.bids as Array<[number, number]>;
    const asks = orderBook.asks as Array<[number, number]>;

    // Calculate metrics
    const bestBid = bids.length > 0 ? bids[0][0] : 0;
    const bestAsk = asks.length > 0 ? asks[0][0] : 0;
    const mid = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    const spreadPercent = (spread / mid) * 100;

    // Calculate total volumes
    const totalBidVolume = bids.reduce((sum, [, amount]) => sum + amount, 0);
    const totalAskVolume = asks.reduce((sum, [, amount]) => sum + amount, 0);
    const totalVolume = totalBidVolume + totalAskVolume;

    // Calculate imbalance (-100 = all sells, +100 = all buys)
    const volumeImbalance = ((totalBidVolume - totalAskVolume) / totalVolume) * 100;
    const bidAskRatio = totalAskVolume > 0 ? totalBidVolume / totalAskVolume : 1;

    // Calculate depth at specific percentages from mid
    const bidDepth1pct = calculateDepthAtPercent(bids, mid, 1, 'below');
    const askDepth1pct = calculateDepthAtPercent(asks, mid, 1, 'above');
    const bidDepth5pct = calculateDepthAtPercent(bids, mid, 5, 'below');
    const askDepth5pct = calculateDepthAtPercent(asks, mid, 5, 'above');

    // Calculate liquidity score (0-100)
    // Based on: spread (40%), depth (40%), imbalance (20%)
    const spreadScore = Math.max(0, 100 - spreadPercent * 100);
    const depthScore = Math.min(100, (bidDepth1pct + askDepth1pct) / 2);
    const imbalanceScore = 100 - Math.abs(volumeImbalance);
    const liquidityScore = spreadScore * 0.4 + depthScore * 0.4 + imbalanceScore * 0.2;

    // Determine trading pressure
    let pressure: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' = 'neutral';
    if (volumeImbalance > 30 && bidDepth1pct > askDepth1pct) {
      pressure = 'strong_buy';
    } else if (volumeImbalance > 10) {
      pressure = 'buy';
    } else if (volumeImbalance < -30 && askDepth1pct > bidDepth1pct) {
      pressure = 'strong_sell';
    } else if (volumeImbalance < -10) {
      pressure = 'sell';
    }

    // Calculate cumulative volumes for chart
    const bidsCumulative = calculateCumulativeVolume(bids, totalBidVolume);
    const asksCumulative = calculateCumulativeVolume(asks, totalAskVolume);

    // Detect major walls
    const bidWalls = detectWalls(bids, 3);
    const askWalls = detectWalls(asks, 3);

    return {
      symbol,
      exchange,
      timestamp: Date.now(),
      mid,
      spread,
      spreadPercent: Math.round(spreadPercent * 10000) / 10000,
      bids: bidsCumulative.slice(0, limit),
      asks: asksCumulative.slice(0, limit),
      bidWalls,
      askWalls,
      analysis: {
        totalBidVolume: Math.round(totalBidVolume * 100) / 100,
        totalAskVolume: Math.round(totalAskVolume * 100) / 100,
        volumeImbalance: Math.round(volumeImbalance * 100) / 100,
        bidAskRatio: Math.round(bidAskRatio * 100) / 100,
        liquidityScore: Math.round(liquidityScore * 100) / 100,
        bidDepth1pct,
        askDepth1pct,
        bidDepth5pct,
        askDepth5pct,
        pressure
      }
    };
  } catch (error: any) {
    logger.error(`Order book analysis failed: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate volume at specific price distance from mid
 */
function calculateDepthAtPercent(
  levels: Array<[number, number]>,
  mid: number,
  percent: number,
  direction: 'above' | 'below'
): number {
  const targetDistance = mid * (percent / 100);
  let volume = 0;

  for (const [price, amount] of levels) {
    const distance = Math.abs(price - mid);
    if (distance <= targetDistance) {
      volume += amount;
    } else {
      break;
    }
  }

  return Math.round(volume * 100) / 100;
}

/**
 * Monitor order book for significant changes
 * Returns true if major imbalance detected
 */
export async function checkLiquidityAlerts(
  symbol: string,
  exchange: string,
  thresholds: {
    spreadPercent?: number;
    imbalancePercent?: number;
    liquidityScore?: number;
  } = {}
): Promise<{
  alerts: string[];
  metrics: OrderBookMetrics;
}> {
  const defaults = {
    spreadPercent: 1.0, // Alert if spread > 1%
    imbalancePercent: 40, // Alert if imbalance > 40%
    liquidityScore: 30 // Alert if score < 30
  };

  const mergedThresholds = { ...defaults, ...thresholds };

  try {
    const metrics = await analyzeOrderBook(symbol, exchange);
    const alerts: string[] = [];

    // Check spread
    if (metrics.spreadPercent > mergedThresholds.spreadPercent!) {
      alerts.push(
        `⚠️ High spread: ${metrics.spreadPercent.toFixed(4)}% (threshold: ${mergedThresholds.spreadPercent}%)`
      );
    }

    // Check imbalance
    if (Math.abs(metrics.analysis.volumeImbalance) > mergedThresholds.imbalancePercent!) {
      const direction = metrics.analysis.volumeImbalance > 0 ? 'Buy' : 'Sell';
      alerts.push(
        `🚨 Strong ${direction} pressure: ${Math.abs(metrics.analysis.volumeImbalance).toFixed(2)}% (threshold: ${mergedThresholds.imbalancePercent}%)`
      );
    }

    // Check liquidity score
    if (metrics.analysis.liquidityScore < mergedThresholds.liquidityScore!) {
      alerts.push(
        `📉 Poor liquidity: Score ${metrics.analysis.liquidityScore.toFixed(2)} (threshold: ${mergedThresholds.liquidityScore})`
      );
    }

    return { alerts, metrics };
  } catch (error: any) {
    logger.error(`Liquidity alert check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get liquidity profile for a symbol across multiple timeframes
 */
export async function getLiquidityProfile(
  symbol: string,
  exchanges: string[] = ['binance', 'coinbase', 'kraken']
): Promise<
  Array<{
    exchange: string;
    metrics: OrderBookMetrics;
    rating: string;
  }>
> {
  try {
    const results = await Promise.all(
      exchanges.map(async (exchange) => {
        try {
          const metrics = await analyzeOrderBook(symbol, exchange);
          const rating =
            metrics.analysis.liquidityScore > 80
              ? 'Excellent'
              : metrics.analysis.liquidityScore > 60
              ? 'Good'
              : metrics.analysis.liquidityScore > 40
              ? 'Fair'
              : 'Poor';

          return { exchange, metrics, rating };
        } catch (error) {
          logger.warn(`Failed to get liquidity for ${exchange}: ${error}`);
          return null;
        }
      })
    );

    return results.filter((r) => r !== null) as Array<{
      exchange: string;
      metrics: OrderBookMetrics;
      rating: string;
    }>;
  } catch (error: any) {
    logger.error(`Liquidity profile fetch failed: ${error.message}`);
    throw error;
  }
}
