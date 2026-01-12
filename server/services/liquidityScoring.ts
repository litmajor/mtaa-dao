/**
 * Liquidity Scoring Service
 * Comprehensive liquidity analysis and scoring system
 */

import ccxtService from './ccxtService';
import { analyzeOrderBook, OrderBookMetrics } from './orderBookAnalyzer';
import { logger } from '../utils/logger';
import pLimit from 'p-limit';
import NodeCache from 'node-cache';

const limiter = pLimit(3);
const liquidityCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

export interface LiquidityComponent {
  score: number; // 0-100
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  details: string;
}

export interface LiquidityMetrics {
  symbol: string;
  exchange: string;
  timestamp: number;
  overall: LiquidityComponent;
  spread: LiquidityComponent;
  depth: LiquidityComponent;
  volume: LiquidityComponent;
  stability: LiquidityComponent;
  imbalance: LiquidityComponent;
  volatility: LiquidityComponent;
}

export interface AssetLiquidityRanking {
  symbol: string;
  exchanges: Array<{
    exchange: string;
    score: number;
    rating: string;
  }>;
  bestExchange: { exchange: string; score: number };
  averageScore: number;
  rank: number;
}

/**
 * Get rating label from score
 */
function getRatingLabel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/**
 * Calculate spread component score
 * Lower spread = higher score (100 = <0.01%, 0 = >1%)
 */
function calculateSpreadScore(spreadPercent: number): LiquidityComponent {
  let score = 100;
  if (spreadPercent > 1.0) score = 0;
  else if (spreadPercent > 0.5) score = Math.max(0, 100 - (spreadPercent - 0.5) * 200);
  else if (spreadPercent > 0.1) score = Math.max(20, 100 - spreadPercent * 800);
  else score = 100;

  const details =
    spreadPercent < 0.05
      ? 'Extremely tight spread'
      : spreadPercent < 0.1
      ? 'Very tight spread'
      : spreadPercent < 0.5
      ? 'Good spread'
      : spreadPercent < 1.0
      ? 'Wide spread'
      : 'Very wide spread';

  return {
    score: Math.round(score),
    rating: getRatingLabel(score),
    details
  };
}

/**
 * Calculate depth component score
 * How much volume is available at nearby price levels
 */
function calculateDepthScore(bidDepth1pct: number, askDepth1pct: number): LiquidityComponent {
  const avgDepth1pct = (bidDepth1pct + askDepth1pct) / 2;

  // Scoring based on volume at 1% from mid:
  // <10K = poor, 10-100K = fair, 100K-1M = good, >1M = excellent
  let score = 0;
  if (avgDepth1pct > 1000000) score = 100;
  else if (avgDepth1pct > 100000) score = 80 + (avgDepth1pct - 100000) / (900000) * 20;
  else if (avgDepth1pct > 10000) score = 40 + (avgDepth1pct - 10000) / 90000 * 40;
  else if (avgDepth1pct > 1000) score = 20 + (avgDepth1pct - 1000) / 9000 * 20;
  else score = Math.min(20, (avgDepth1pct / 1000) * 20);

  const details =
    avgDepth1pct > 1000000
      ? 'Excellent depth'
      : avgDepth1pct > 100000
      ? 'Good depth'
      : avgDepth1pct > 10000
      ? 'Fair depth'
      : 'Shallow depth';

  return {
    score: Math.round(score),
    rating: getRatingLabel(score),
    details
  };
}

/**
 * Calculate volume component score
 */
function calculateVolumeScore(totalBidVolume: number, totalAskVolume: number): LiquidityComponent {
  const totalVolume = totalBidVolume + totalAskVolume;

  // Scoring: <1K = poor, 1K-10K = fair, 10K-100K = good, >100K = excellent
  let score = 0;
  if (totalVolume > 100000) score = 100;
  else if (totalVolume > 10000) score = 70 + (totalVolume - 10000) / (90000) * 30;
  else if (totalVolume > 1000) score = 40 + (totalVolume - 1000) / 9000 * 30;
  else if (totalVolume > 100) score = 20 + (totalVolume - 100) / 900 * 20;
  else score = (totalVolume / 100) * 20;

  const details =
    totalVolume > 100000
      ? 'Excellent order book volume'
      : totalVolume > 10000
      ? 'Good order book volume'
      : totalVolume > 1000
      ? 'Fair order book volume'
      : 'Low order book volume';

  return {
    score: Math.round(score),
    rating: getRatingLabel(score),
    details
  };
}

/**
 * Calculate stability score (based on bid/ask ratio consistency)
 */
function calculateStabilityScore(bidAskRatio: number): LiquidityComponent {
  // Perfect ratio = 1.0
  // Deviation penalizes score
  const deviation = Math.abs(bidAskRatio - 1.0);
  let score = 100 - deviation * 50;
  score = Math.max(0, Math.min(100, score));

  const details =
    deviation < 0.1
      ? 'Balanced bid/ask'
      : deviation < 0.3
      ? 'Good balance'
      : deviation < 0.6
      ? 'Slight imbalance'
      : 'Large imbalance';

  return {
    score: Math.round(score),
    rating: getRatingLabel(score),
    details
  };
}

/**
 * Calculate imbalance score
 * Perfect = 0% imbalance (score=100)
 * Warning = >30% imbalance (score<50)
 */
function calculateImbalanceScore(volumeImbalance: number): LiquidityComponent {
  const absImbalance = Math.abs(volumeImbalance);
  let score = 100 - absImbalance;
  score = Math.max(0, Math.min(100, score));

  const direction = volumeImbalance > 0 ? 'Buy' : 'Sell';
  const details =
    absImbalance < 10
      ? 'Well balanced'
      : absImbalance < 20
      ? 'Slightly biased'
      : absImbalance < 40
      ? `Moderate ${direction} pressure`
      : `Strong ${direction} pressure`;

  return {
    score: Math.round(score),
    rating: getRatingLabel(score),
    details
  };
}

/**
 * Calculate volatility score
 * Lower volatility = more predictable = higher score
 */
function calculateVolatilityScore(averageDailyChange: number): LiquidityComponent {
  // Scoring: <1% = excellent, 1-2% = good, 2-5% = fair, >5% = poor
  let score = 0;
  if (averageDailyChange < 1) score = 100;
  else if (averageDailyChange < 2) score = 80 + (2 - averageDailyChange) * 20;
  else if (averageDailyChange < 5) score = 50 + (5 - averageDailyChange) * 10;
  else if (averageDailyChange < 10) score = 20 + (10 - averageDailyChange) * 3;
  else score = Math.max(0, 20 - (averageDailyChange - 10));

  const details =
    averageDailyChange < 1
      ? 'Very stable'
      : averageDailyChange < 2
      ? 'Stable'
      : averageDailyChange < 5
      ? 'Moderate volatility'
      : 'High volatility';

  return {
    score: Math.round(score),
    rating: getRatingLabel(score),
    details
  };
}

/**
 * Calculate comprehensive liquidity metrics
 */
export async function calculateLiquidityMetrics(
  symbol: string,
  exchange: string,
  averageDailyChange: number = 2.5
): Promise<LiquidityMetrics> {
  const cacheKey = `liquidity:${exchange}:${symbol}`;
  const cached = liquidityCache.get<LiquidityMetrics>(cacheKey);
  if (cached) return cached;

  try {
    // Get order book analysis
    const orderBook = await analyzeOrderBook(symbol, exchange, 50);

    // Calculate individual components
    const spread = calculateSpreadScore(orderBook.spreadPercent);
    const depth = calculateDepthScore(
      orderBook.analysis.bidDepth1pct,
      orderBook.analysis.askDepth1pct
    );
    const volume = calculateVolumeScore(
      orderBook.analysis.totalBidVolume,
      orderBook.analysis.totalAskVolume
    );
    const stability = calculateStabilityScore(orderBook.analysis.bidAskRatio);
    const imbalance = calculateImbalanceScore(orderBook.analysis.volumeImbalance);
    const volatility = calculateVolatilityScore(averageDailyChange);

    // Calculate overall score (weighted average)
    // Weights: spread (25%), depth (25%), volume (20%), stability (10%), imbalance (10%), volatility (10%)
    const overall =
      spread.score * 0.25 +
      depth.score * 0.25 +
      volume.score * 0.2 +
      stability.score * 0.1 +
      imbalance.score * 0.1 +
      volatility.score * 0.1;

    const metrics: LiquidityMetrics = {
      symbol,
      exchange,
      timestamp: Date.now(),
      overall: {
        score: Math.round(overall),
        rating: getRatingLabel(overall),
        details: `Overall liquidity assessment based on ${6} metrics`
      },
      spread,
      depth,
      volume,
      stability,
      imbalance,
      volatility
    };

    liquidityCache.set(cacheKey, metrics);
    return metrics;
  } catch (error: any) {
    logger.error(`Liquidity calculation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Rank assets by liquidity across exchanges
 */
export async function rankAssetsByLiquidity(
  symbol: string,
  exchanges: string[] = ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx']
): Promise<AssetLiquidityRanking> {
  try {
    const metricsPromises = exchanges.map((exchange) =>
      limiter(() =>
        calculateLiquidityMetrics(symbol, exchange).catch((error) => {
          logger.warn(`Failed to get liquidity for ${symbol} on ${exchange}`);
          return null;
        })
      )
    );

    const results = await Promise.all(metricsPromises);
    const validMetrics = results.filter(
      (m): m is LiquidityMetrics => m !== null
    );

    if (validMetrics.length === 0) {
      throw new Error(`No liquidity data available for ${symbol}`);
    }

    // Sort by overall score
    const sortedMetrics = validMetrics.sort(
      (a, b) => b.overall.score - a.overall.score
    );

    const ranking: AssetLiquidityRanking = {
      symbol,
      exchanges: sortedMetrics.map((m) => ({
        exchange: m.exchange,
        score: m.overall.score,
        rating: m.overall.rating
      })),
      bestExchange: {
        exchange: sortedMetrics[0].exchange,
        score: sortedMetrics[0].overall.score
      },
      averageScore:
        Math.round(
          validMetrics.reduce((sum, m) => sum + m.overall.score, 0) / validMetrics.length
        ),
      rank: validMetrics.length
    };

    return ranking;
  } catch (error: any) {
    logger.error(`Liquidity ranking failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get liquidity health warnings
 */
export function getLiquidityWarnings(metrics: LiquidityMetrics): string[] {
  const warnings: string[] = [];

  if (metrics.overall.score < 50) {
    warnings.push(
      `⚠️ Poor overall liquidity: ${metrics.overall.score}/100`
    );
  }

  if (metrics.spread.score < 40) {
    warnings.push(
      `📊 Wide spread: ${metrics.spread.details}`
    );
  }

  if (metrics.depth.score < 40) {
    warnings.push(
      `📉 Shallow depth: ${metrics.depth.details}`
    );
  }

  if (metrics.imbalance.score < 30) {
    warnings.push(
      `⚡ Strong buy/sell pressure: ${metrics.imbalance.details}`
    );
  }

  if (metrics.volatility.score < 30) {
    warnings.push(
      `📈 High volatility: ${metrics.volatility.details}`
    );
  }

  return warnings;
}

/**
 * Clear liquidity cache
 */
export function clearLiquidityCache(): void {
  liquidityCache.flushAll();
  logger.info('Liquidity cache cleared');
}
