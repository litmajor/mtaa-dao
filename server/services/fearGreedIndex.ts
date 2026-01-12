/**
 * Fear & Greed Index Service
 * Comprehensive market sentiment analysis with creative visualizations
 */

import { logger } from '../utils/logger';
import NodeCache from 'node-cache';
import pLimit from 'p-limit';

const limiter = pLimit(3);
const fearGreedCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

export interface FearGreedMetrics {
  volatility: number;
  momentum: number;
  marketTrend: number;
  dominance: number;
  volume: number;
}

export interface FearGreedIndex {
  score: number; // 0-100
  classification: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
  metrics: FearGreedMetrics;
  description: string;
  emoji: string;
  color: string;
  timestamp: number;
  lastUpdated: string;
}

export interface MarketChangeMetrics {
  period: '1d' | '7d' | '30d' | '90d' | '180d';
  marketCap: number;
  marketCapChange: number;
  marketCapChangePercent: number;
  volume24h: number;
  volumeChange: number;
  volumeChangePercent: number;
  timestamp: number;
}

export interface BtcDominanceData {
  dominancePercent: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  price: number;
  timestamp: number;
}

export interface MarketSentimentResponse {
  fearGreedIndex: FearGreedIndex;
  marketChanges: MarketChangeMetrics[];
  btcDominance: BtcDominanceData;
  timestamp: number;
}

/**
 * Calculate volatility score (0-100)
 * Higher volatility = more fear
 */
function calculateVolatilityScore(volatilityPercent: number): number {
  // Normalize volatility (0% = 100, 5%+ = 0)
  if (volatilityPercent <= 0) return 100;
  if (volatilityPercent >= 5) return 0;
  return 100 - (volatilityPercent / 5) * 100;
}

/**
 * Calculate momentum score (0-100)
 * Positive momentum = greed, negative = fear
 */
function calculateMomentumScore(priceChange24h: number, priceChange7d: number): number {
  // Average recent price movements
  const avgChange = (priceChange24h + priceChange7d) / 2;

  // Range: -20% = 0, 0% = 50, +20% = 100
  if (avgChange <= -20) return 0;
  if (avgChange >= 20) return 100;
  return 50 + (avgChange / 20) * 50;
}

/**
 * Calculate market trend score (0-100)
 * Based on gainers vs losers ratio
 */
function calculateMarketTrendScore(gainersPercent: number): number {
  // If 50% of coins are up, it's neutral
  // If 70%+ are up, it's greed
  // If 30% or less are up, it's fear
  if (gainersPercent <= 30) return 0;
  if (gainersPercent >= 70) return 100;
  return ((gainersPercent - 30) / 40) * 100;
}

/**
 * Calculate dominance score (0-100)
 * BTC dominance > 50% = greed (concentration), < 30% = fear (fragmentation)
 */
function calculateDominanceScore(btcDominance: number): number {
  if (btcDominance >= 55) return 100; // Extreme greed (too concentrated)
  if (btcDominance <= 25) return 0; // Extreme fear (too fragmented)
  // Linear between 25-55%
  return ((btcDominance - 25) / 30) * 100;
}

/**
 * Calculate volume score (0-100)
 * High volume = high conviction
 */
function calculateVolumeScore(volume24h: number, avgVolume: number): number {
  const ratio = volume24h / avgVolume;
  // ratio < 0.5 = low volume (fear), ratio > 2 = high volume (greed)
  if (ratio <= 0.5) return 20;
  if (ratio >= 2) return 100;
  return 20 + (ratio - 0.5) / 1.5 * 80;
}

/**
 * Calculate overall Fear & Greed Index (0-100)
 * Weighted average of all metrics
 */
function calculateFearGreedScore(metrics: FearGreedMetrics): number {
  const weights = {
    volatility: 0.25,
    momentum: 0.35,
    marketTrend: 0.25,
    dominance: 0.10,
    volume: 0.05
  };

  const score =
    metrics.volatility * weights.volatility +
    metrics.momentum * weights.momentum +
    metrics.marketTrend * weights.marketTrend +
    metrics.dominance * weights.dominance +
    metrics.volume * weights.volume;

  return Math.round(score);
}

/**
 * Classify Fear & Greed Index score
 */
function classifyFearGreed(
  score: number
): 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed' {
  if (score <= 25) return 'extreme_fear';
  if (score <= 45) return 'fear';
  if (score <= 55) return 'neutral';
  if (score <= 75) return 'greed';
  return 'extreme_greed';
}

/**
 * Get visualization data for Fear & Greed Index
 */
function getVisualizationData(
  score: number,
  classification: string
): { emoji: string; color: string; description: string } {
  const visualizations: Record<
    string,
    { emoji: string; color: string; description: string }
  > = {
    extreme_fear: {
      emoji: '😨',
      color: '#8b0000', // Dark red
      description: 'Extreme Fear - Market at potential bottom'
    },
    fear: {
      emoji: '😟',
      color: '#ef4444', // Red
      description: 'Fear - Bearish sentiment prevailing'
    },
    neutral: {
      emoji: '😐',
      color: '#f59e0b', // Amber
      description: 'Neutral - Market uncertainty'
    },
    greed: {
      emoji: '😊',
      color: '#84cc16', // Lime
      description: 'Greed - Bullish sentiment emerging'
    },
    extreme_greed: {
      emoji: '🤑',
      color: '#22c55e', // Green
      description: 'Extreme Greed - Possible market top'
    }
  };

  return visualizations[classification] || visualizations.neutral;
}

/**
 * Fetch market data from CoinGecko
 */
async function fetchMarketData(): Promise<{
  btcPrice: number;
  btcChange24h: number;
  btcChange7d: number;
  btcDominance: number;
  ethPrice: number;
  marketCap: number;
  marketCapChange24h: number;
  volume24h: number;
}> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/global?localization=false'
    );

    if (!response.ok) throw new Error('Failed to fetch global data');

    const data = await response.json();

    return {
      btcPrice: data.data?.bitcoin?.usd || 0,
      btcChange24h: data.data?.bitcoin?.usd_24h_change || 0,
      btcChange7d: data.data?.bitcoin?.usd_7d_change || 0,
      btcDominance: data.data?.btc_market_cap_percentage || 0,
      ethPrice: data.data?.ethereum?.usd || 0,
      marketCap: data.data?.total_market_cap?.usd || 0,
      marketCapChange24h: data.data?.market_cap_change_percentage_24h_usd || 0,
      volume24h: data.data?.total_volume?.usd || 0
    };
  } catch (error: any) {
    logger.error(`Failed to fetch market data: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch historical market data for change calculations
 */
async function fetchHistoricalMarketData(
  period: 'max' | '365d' | '180d' | '90d' | '30d' | '7d'
): Promise<Array<[number, number]>> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/global/market_cap_chart/usd?days=${period}`
    );

    if (!response.ok) throw new Error('Failed to fetch historical market cap');

    const data = await response.json();
    return data.market_caps || [];
  } catch (error: any) {
    logger.error(`Failed to fetch historical data: ${error.message}`);
    return [];
  }
}

/**
 * Calculate market change percentage
 */
function calculateChangePercent(
  currentValue: number,
  previousValue: number
): number {
  if (previousValue === 0) return 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

/**
 * Get Fear & Greed Index
 */
export async function getFearGreedIndex(): Promise<FearGreedIndex> {
  const cacheKey = 'fearGreedIndex';
  const cached = fearGreedCache.get<FearGreedIndex>(cacheKey);
  if (cached) return cached;

  try {
    logger.debug('Calculating Fear & Greed Index');

    const marketData = await fetchMarketData();

    // Calculate individual metrics
    const metrics: FearGreedMetrics = {
      volatility: calculateVolatilityScore(Math.abs(marketData.btcChange24h)),
      momentum: calculateMomentumScore(
        marketData.btcChange24h,
        marketData.btcChange7d
      ),
      marketTrend: calculateMarketTrendScore(55), // Placeholder: would need top 100 gainers data
      dominance: calculateDominanceScore(marketData.btcDominance),
      volume: calculateVolumeScore(marketData.volume24h, marketData.volume24h * 0.8) // Estimated avg
    };

    // Calculate overall score
    const score = calculateFearGreedScore(metrics);
    const classification = classifyFearGreed(score);
    const visualization = getVisualizationData(score, classification);

    const fearGreedIndex: FearGreedIndex = {
      score,
      classification,
      metrics,
      description: visualization.description,
      emoji: visualization.emoji,
      color: visualization.color,
      timestamp: Date.now(),
      lastUpdated: new Date().toISOString()
    };

    fearGreedCache.set(cacheKey, fearGreedIndex);
    return fearGreedIndex;
  } catch (error: any) {
    logger.error(`Fear & Greed Index calculation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get market changes for multiple periods
 */
export async function getMarketChanges(): Promise<MarketChangeMetrics[]> {
  const cacheKey = 'marketChanges';
  const cached = fearGreedCache.get<MarketChangeMetrics[]>(cacheKey);
  if (cached) return cached;

  try {
    logger.debug('Fetching market changes');

    const periods: Array<'1d' | '7d' | '30d' | '90d' | '180d'> = [
      '1d',
      '7d',
      '30d',
      '90d',
      '180d'
    ];
    const changes: MarketChangeMetrics[] = [];

    const currentData = await fetchMarketData();

    // Fetch historical data for each period
    const historicalPromises = periods.map((period) => {
      const coinGeckoPeriod = period === '1d' ? '1' : period.replace('d', '');
      return limiter(() => fetchHistoricalMarketData(coinGeckoPeriod as any));
    });

    const historicalResults = await Promise.all(historicalPromises);

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const historical = historicalResults[i];

      if (historical.length < 2) continue;

      const oldestMarketCap = historical[0][1];
      const newestMarketCap = historical[historical.length - 1][1];

      const marketCapChange = newestMarketCap - oldestMarketCap;
      const marketCapChangePercent = calculateChangePercent(
        newestMarketCap,
        oldestMarketCap
      );

      // Volume is more difficult to get historical data for, so we estimate
      const volumeChange = currentData.volume24h * (marketCapChangePercent / 100);
      const volumeChangePercent = marketCapChangePercent; // Simplified

      changes.push({
        period,
        marketCap: Math.round(newestMarketCap),
        marketCapChange: Math.round(marketCapChange),
        marketCapChangePercent: Math.round(marketCapChangePercent * 100) / 100,
        volume24h: Math.round(currentData.volume24h),
        volumeChange: Math.round(volumeChange),
        volumeChangePercent: Math.round(volumeChangePercent * 100) / 100,
        timestamp: Date.now()
      });
    }

    fearGreedCache.set(cacheKey, changes);
    return changes;
  } catch (error: any) {
    logger.error(`Market changes fetch failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get BTC Dominance data
 */
export async function getBtcDominance(): Promise<BtcDominanceData> {
  const cacheKey = 'btcDominance';
  const cached = fearGreedCache.get<BtcDominanceData>(cacheKey);
  if (cached) return cached;

  try {
    logger.debug('Fetching BTC dominance');

    const marketData = await fetchMarketData();

    // Fetch historical dominance (7d and 24h changes)
    const sevenDaysAgo = await limiter(() =>
      fetchHistoricalMarketData('7d')
    );

    let change7d = 0;
    if (sevenDaysAgo.length > 0) {
      // Note: This is simplified - actual dominance history would need specific API
      change7d = 0; // Placeholder
    }

    const btcDominance: BtcDominanceData = {
      dominancePercent: Math.round(marketData.btcDominance * 100) / 100,
      change24h: Math.round(marketData.btcChange24h * 100) / 100,
      change7d: change7d,
      marketCap: Math.round(marketData.btcPrice * 21000000), // Approximate total BTC value
      price: Math.round(marketData.btcPrice * 100) / 100,
      timestamp: Date.now()
    };

    fearGreedCache.set(cacheKey, btcDominance);
    return btcDominance;
  } catch (error: any) {
    logger.error(`BTC dominance fetch failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get complete market sentiment response
 */
export async function getMarketSentiment(): Promise<MarketSentimentResponse> {
  try {
    logger.debug('Fetching complete market sentiment');

    const [fearGreedIndex, marketChanges, btcDominance] = await Promise.all([
      getFearGreedIndex(),
      getMarketChanges(),
      getBtcDominance()
    ]);

    return {
      fearGreedIndex,
      marketChanges,
      btcDominance,
      timestamp: Date.now()
    };
  } catch (error: any) {
    logger.error(`Market sentiment fetch failed: ${error.message}`);
    throw error;
  }
}

/**
 * Clear fear & greed cache
 */
export function clearFearGreedCache(): void {
  fearGreedCache.flushAll();
  logger.info('Fear & Greed cache cleared');
}
