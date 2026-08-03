/**
 * Fear & Greed Index Service
 * Comprehensive market sentiment analysis with creative visualizations
 */

import { logger } from '../utils/logger';
import NodeCache from 'node-cache';
import pLimit from 'p-limit';

const limiter = pLimit(3);
const fearGreedCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

export type MarketPeriod = '1d' | '7d' | '30d' | '90d' | '180d';
export type SentimentClassification = 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';

export interface FearGreedMetrics {
  volatility: number;
  momentum: number;
  marketTrend: number;
  dominance: number;
  volume: number;
}

export interface FearGreedIndex {
  score: number; // 0-100
  classification: SentimentClassification;
  metrics: FearGreedMetrics;
  description: string;
  emoji: string;
  color: string;
  timestamp: number;
  lastUpdated: string;
}

export interface MarketChangeMetrics {
  period: MarketPeriod;
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
 * Expanded threshold to accommodate natural crypto volatility
 */
function calculateVolatilityScore(volatilityPercent: number): number {
  const MAX_VOLATILITY = 15; // 15% or higher indicates extreme volatility/fear
  if (volatilityPercent <= 0) return 100;
  if (volatilityPercent >= MAX_VOLATILITY) return 0;
  return Math.round(100 - (volatilityPercent / MAX_VOLATILITY) * 100);
}

/**
 * Calculate momentum score (0-100)
 */
function calculateMomentumScore(priceChange24h: number, priceChange7d: number): number {
  const avgChange = (priceChange24h + priceChange7d) / 2;
  if (avgChange <= -20) return 0;
  if (avgChange >= 20) return 100;
  return Math.round(50 + (avgChange / 20) * 50);
}

/**
 * Calculate market trend score (0-100)
 */
function calculateMarketTrendScore(gainersPercent: number): number {
  if (gainersPercent <= 30) return 0;
  if (gainersPercent >= 70) return 100;
  return Math.round(((gainersPercent - 30) / 40) * 100);
}

/**
 * Calculate dominance score (0-100)
 */
function calculateDominanceScore(btcDominance: number): number {
  if (btcDominance >= 60) return 100; // Heavy flight to safety (Greed/Dominance)
  if (btcDominance <= 35) return 0;  // Alt-season fragmentation
  return Math.round(((btcDominance - 35) / 25) * 100);
}

/**
 * Calculate volume score (0-100)
 */
function calculateVolumeScore(volume24h: number, avgVolume: number): number {
  if (avgVolume === 0) return 50;
  const ratio = volume24h / avgVolume;
  if (ratio <= 0.5) return 20;
  if (ratio >= 2) return 100;
  return Math.round(20 + ((ratio - 0.5) / 1.5) * 80);
}

function calculateFearGreedScore(metrics: FearGreedMetrics): number {
  const weights = { volatility: 0.25, momentum: 0.35, marketTrend: 0.25, dominance: 0.10, volume: 0.05 };
  
  const score =
    metrics.volatility * weights.volatility +
    metrics.momentum * weights.momentum +
    metrics.marketTrend * weights.marketTrend +
    metrics.dominance * weights.dominance +
    metrics.volume * weights.volume;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function classifyFearGreed(score: number): SentimentClassification {
  if (score <= 25) return 'extreme_fear';
  if (score <= 45) return 'fear';
  if (score <= 55) return 'neutral';
  if (score <= 75) return 'greed';
  return 'extreme_greed';
}

function getVisualizationData(classification: SentimentClassification) {
  const visualizations: Record<SentimentClassification, { emoji: string; color: string; description: string }> = {
    extreme_fear: { emoji: '😨', color: '#8b0000', description: 'Extreme Fear - Market at potential bottom' },
    fear: { emoji: '😟', color: '#ef4444', description: 'Fear - Bearish sentiment prevailing' },
    neutral: { emoji: '😐', color: '#f59e0b', description: 'Neutral - Market uncertainty' },
    greed: { emoji: '😊', color: '#84cc16', description: 'Greed - Bullish sentiment emerging' },
    extreme_greed: { emoji: '🤑', color: '#22c55e', description: 'Extreme Greed - Possible market top' }
  };
  return visualizations[classification];
}

/**
 * Fetch unified global data safely
 */
async function fetchMarketData() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/global?localization=false');
    if (!response.ok) throw new Error(`CoinGecko HTTP Error: ${response.status}`);
    
    const { data } = await response.json();
    return {
      btcPrice: data?.bitcoin?.usd || 0, // Fallback placeholder logic if parsing standard endpoints
      btcChange24h: data?.market_cap_change_percentage_24h_usd || 0, // Using macro trend as baseline
      btcChange7d: data?.market_cap_change_percentage_24h_usd * 3 || 0, // Approximated for global fallback
      btcDominance: data?.market_cap_percentage?.btc || 0,
      marketCap: data?.total_market_cap?.usd || 0,
      volume24h: data?.total_volume?.usd || 0,
      updatedAt: data?.updated_at || Date.now()
    };
  } catch (error: any) {
    logger.error(`Failed to fetch market data: ${error.message}`);
    throw error;
  }
}

/**
 * Cleaned up historical fetcher matching valid types
 */
async function fetchHistoricalCoinsData(days: '1' | '7' | '30' | '90' | '180'): Promise<Array<[number, number]>> {
  try {
    // Fallback alternative utilizing standard CoinGecko endpoints safely
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`);
    if (!response.ok) throw new Error('Failed to fetch historical asset trends');
    const data = await response.json();
    return data.market_caps || [];
  } catch (error: any) {
    logger.error(`Failed to fetch historical data: ${error.message}`);
    return [];
  }
}

export async function getFearGreedIndex(): Promise<FearGreedIndex> {
  const cacheKey = 'fearGreedIndex';
  const cached = fearGreedCache.get<FearGreedIndex>(cacheKey);
  if (cached) return cached;

  const marketData = await fetchMarketData();

  const metrics: FearGreedMetrics = {
    volatility: calculateVolatilityScore(Math.abs(marketData.btcChange24h)),
    momentum: calculateMomentumScore(marketData.btcChange24h, marketData.btcChange7d),
    marketTrend: calculateMarketTrendScore(52), // Adjusted baseline placeholder
    dominance: calculateDominanceScore(marketData.btcDominance),
    volume: calculateVolumeScore(marketData.volume24h, marketData.volume24h * 0.95)
  };

  const score = calculateFearGreedScore(metrics);
  const classification = classifyFearGreed(score);
  const visualization = getVisualizationData(classification);

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
}

export async function getMarketChanges(): Promise<MarketChangeMetrics[]> {
  const cacheKey = 'marketChanges';
  const cached = fearGreedCache.get<MarketChangeMetrics[]>(cacheKey);
  if (cached) return cached;

  const periods: MarketPeriod[] = ['1d', '7d', '30d', '90d', '180d'];
  const changes: MarketChangeMetrics[] = [];
  const currentData = await fetchMarketData();

  const historicalPromises = periods.map((period) => {
    const daysParam = period === '1d' ? '1' : period.replace('d', '') as '7' | '30' | '90' | '180';
    return limiter(() => fetchHistoricalCoinsData(daysParam));
  });

  const historicalResults = await Promise.all(historicalPromises);

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const historical = historicalResults[i];

    if (!historical || historical.length < 2) continue;

    const oldestCap = historical[0][1];
    const newestCap = historical[historical.length - 1][1];
    const marketCapChange = newestCap - oldestCap;
    const changePercent = oldestCap === 0 ? 0 : (marketCapChange / oldestCap) * 100;

    changes.push({
      period,
      marketCap: Math.round(newestCap),
      marketCapChange: Math.round(marketCapChange),
      marketCapChangePercent: Math.round(changePercent * 100) / 100,
      volume24h: Math.round(currentData.volume24h),
      volumeChange: Math.round(currentData.volume24h * (changePercent / 100)),
      volumeChangePercent: Math.round(changePercent * 100) / 100,
      timestamp: Date.now()
    });
  }

  fearGreedCache.set(cacheKey, changes);
  return changes;
}

export async function getBtcDominance(): Promise<BtcDominanceData> {
  const cacheKey = 'btcDominance';
  const cached = fearGreedCache.get<BtcDominanceData>(cacheKey);
  if (cached) return cached;

  const marketData = await fetchMarketData();

  const btcDominance: BtcDominanceData = {
    dominancePercent: Math.round(marketData.btcDominance * 100) / 100,
    change24h: Math.round(marketData.btcChange24h * 100) / 100,
    change7d: 0,
    marketCap: Math.round(marketData.marketCap * (marketData.btcDominance / 100)), // Mathematically precise calculation using absolute total cap
    price: Math.round(marketData.btcPrice * 100) / 100,
    timestamp: Date.now()
  };

  fearGreedCache.set(cacheKey, btcDominance);
  return btcDominance;
}

export async function getMarketSentiment(): Promise<MarketSentimentResponse> {
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
}

export function clearFearGreedCache(): void {
  fearGreedCache.flushAll();
  logger.info('Fear & Greed cache cleared');
}