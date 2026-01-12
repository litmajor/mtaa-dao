/**
 * Arbitrage Detection Service
 * Identifies profitable trading opportunities across exchanges
 */

import ccxtService from './ccxtService';
import { analyzeOrderBook, OrderBookMetrics } from './orderBookAnalyzer';
import { logger } from '../utils/logger';
import pLimit from 'p-limit';
import NodeCache from 'node-cache';

const limiter = pLimit(5);
const arbitrageCache = new NodeCache({ stdTTL: 60 }); // 1 minute (volatile data)

export interface ArbitrageOpportunity {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPercent: number;
  profitPerUnit: number;
  profitPercent: number;
  buyFee: number;
  sellFee: number;
  netProfit: number;
  netProfitPercent: number;
  volume: number;
  volumeScore: 'excellent' | 'good' | 'fair' | 'poor';
  risk: 'low' | 'medium' | 'high' | 'very_high';
  timestamp: number;
}

export interface ExchangePair {
  exchange: string;
  symbol: string;
  bidPrice: number;
  askPrice: number;
  lastPrice: number;
  volume: number;
  timestamp: number;
}

/**
 * Get exchange trading fees
 */
function getExchangeFees(exchange: string): { maker: number; taker: number } {
  const fees: Record<string, { maker: number; taker: number }> = {
    binance: { maker: 0.001, taker: 0.001 }, // 0.1%
    coinbase: { maker: 0.004, taker: 0.006 }, // 0.4% / 0.6%
    kraken: { maker: 0.0016, taker: 0.0026 }, // 0.16% / 0.26%
    bybit: { maker: 0.0001, taker: 0.0001 }, // 0.01%
    kucoin: { maker: 0.001, taker: 0.001 }, // 0.1%
    okx: { maker: 0.0002, taker: 0.0005 } // 0.02% / 0.05%
  };

  return fees[exchange] || { maker: 0.0025, taker: 0.0025 }; // Default 0.25%
}

/**
 * Determine arbitrage risk level
 */
function assessRisk(
  spreadPercent: number,
  volumeScore: string,
  liquidityScore: number
): 'low' | 'medium' | 'high' | 'very_high' {
  // Risk increases with: wider spread, lower volume, poor liquidity
  if (spreadPercent > 2.0 || liquidityScore < 30) return 'very_high';
  if (spreadPercent > 1.0 || liquidityScore < 50 || volumeScore === 'poor') return 'high';
  if (spreadPercent > 0.5 || liquidityScore < 65 || volumeScore === 'fair') return 'medium';
  return 'low';
}

/**
 * Score volume availability (0-100)
 */
function scoreVolume(volume: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (volume > 100000) return 'excellent';
  if (volume > 10000) return 'good';
  if (volume > 1000) return 'fair';
  return 'poor';
}

/**
 * Fetch prices from multiple exchanges
 */
async function fetchPricesMultiExchange(
  symbol: string,
  exchanges: string[]
): Promise<ExchangePair[]> {
  const pricePromises = exchanges.map((exchange) =>
    limiter(async () => {
      try {
        const ticker = await ccxtService.getTickerFromExchange(exchange, symbol);
        if (!ticker) return null;

        // Get order book for bid/ask
        const orderBook = await analyzeOrderBook(symbol, exchange, 20).catch(() => null);

        return {
          exchange,
          symbol,
          bidPrice: orderBook?.bids[0]?.price || ticker.last,
          askPrice: orderBook?.asks[0]?.price || ticker.last,
          lastPrice: ticker.last,
          volume: 0, // Quote volume not available in CachedPrice
          timestamp: Date.now()
        };
      } catch (error: any) {
        logger.warn(`Failed to fetch prices from ${exchange}: ${error.message}`);
        return null;
      }
    })
  );

  const results = await Promise.all(pricePromises);
  return results.filter((r): r is ExchangePair => r !== null);
}

/**
 * Find all arbitrage opportunities
 */
export async function findArbitrageOpportunities(
  symbol: string,
  exchanges: string[] = ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'],
  minProfitPercent: number = 0.5 // Minimum 0.5% profit threshold
): Promise<ArbitrageOpportunity[]> {
  const cacheKey = `arbitrage:${symbol}:${exchanges.join(',')}`;
  const cached = arbitrageCache.get<ArbitrageOpportunity[]>(cacheKey);
  if (cached) return cached;

  try {
    logger.debug(`Finding arbitrage opportunities for ${symbol}`);

    // Fetch prices from all exchanges
    const prices = await fetchPricesMultiExchange(symbol, exchanges);

    if (prices.length < 2) {
      logger.warn(`Insufficient price data for ${symbol}`);
      return [];
    }

    const opportunities: ArbitrageOpportunity[] = [];

    // Compare all exchange pairs
    for (let i = 0; i < prices.length; i++) {
      for (let j = 0; j < prices.length; j++) {
        if (i === j) continue;

        const buyExchangeData = prices[i];
        const sellExchangeData = prices[j];

        // Calculate arbitrage metrics
        const buyPrice = buyExchangeData.askPrice; // Buy at ask price
        const sellPrice = sellExchangeData.bidPrice; // Sell at bid price
        const spread = sellPrice - buyPrice;
        const spreadPercent = (spread / buyPrice) * 100;

        const buyFeeRate = getExchangeFees(buyExchangeData.exchange).taker;
        const sellFeeRate = getExchangeFees(sellExchangeData.exchange).taker;

        const buyFee = buyPrice * buyFeeRate;
        const sellFee = sellPrice * sellFeeRate;

        const grossProfit = spread;
        const netProfit = grossProfit - buyFee - sellFee;
        const netProfitPercent = (netProfit / buyPrice) * 100;

        // Only include if profitable
        if (netProfitPercent < minProfitPercent) continue;

        const minVolume = Math.min(buyExchangeData.volume, sellExchangeData.volume);
        const volumeScore = scoreVolume(minVolume);

        // Average liquidity score (simplified)
        const averageLiquidityScore = 70; // TODO: integrate with liquidity scoring

        const risk = assessRisk(spreadPercent, volumeScore, averageLiquidityScore);

        const opportunity: ArbitrageOpportunity = {
          symbol,
          buyExchange: buyExchangeData.exchange,
          sellExchange: sellExchangeData.exchange,
          buyPrice: Math.round(buyPrice * 10000) / 10000,
          sellPrice: Math.round(sellPrice * 10000) / 10000,
          spread: Math.round(spread * 10000) / 10000,
          spreadPercent: Math.round(spreadPercent * 10000) / 10000,
          profitPerUnit: Math.round(grossProfit * 10000) / 10000,
          profitPercent: Math.round((grossProfit / buyPrice) * 100 * 100) / 100,
          buyFee: Math.round(buyFee * 10000) / 10000,
          sellFee: Math.round(sellFee * 10000) / 10000,
          netProfit: Math.round(netProfit * 10000) / 10000,
          netProfitPercent: Math.round(netProfitPercent * 100) / 100,
          volume: Math.floor(minVolume),
          volumeScore,
          risk,
          timestamp: Date.now()
        };

        opportunities.push(opportunity);
      }
    }

    // Sort by net profit percent (highest first)
    opportunities.sort((a, b) => b.netProfitPercent - a.netProfitPercent);

    arbitrageCache.set(cacheKey, opportunities);
    return opportunities;
  } catch (error: any) {
    logger.error(`Arbitrage detection failed: ${error.message}`);
    throw error;
  }
}

/**
 * Find best arbitrage opportunity for a symbol
 */
export async function findBestArbitrage(
  symbol: string,
  exchanges?: string[]
): Promise<ArbitrageOpportunity | null> {
  const opportunities = await findArbitrageOpportunities(symbol, exchanges, 0.1);
  return opportunities.length > 0 ? opportunities[0] : null;
}

/**
 * Find profitable symbols with arbitrage opportunities
 */
export async function findProfitableSymbols(
  symbols: string[],
  exchanges: string[] = ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'],
  minProfitPercent: number = 1.0 // Minimum 1% profit threshold
): Promise<Array<{ symbol: string; bestOpportunity: ArbitrageOpportunity }>> {
  try {
    logger.debug(`Scanning ${symbols.length} symbols for arbitrage opportunities`);

    const symbolPromises = symbols.map((symbol) =>
      limiter(async () => {
        try {
          const bestOpportunity = await findBestArbitrage(symbol, exchanges);
          if (bestOpportunity && bestOpportunity.netProfitPercent >= minProfitPercent) {
            return { symbol, bestOpportunity };
          }
          return null;
        } catch (error) {
          logger.warn(`Failed to analyze ${symbol}`);
          return null;
        }
      })
    );

    const results = await Promise.all(symbolPromises);
    return results.filter(
      (r): r is { symbol: string; bestOpportunity: ArbitrageOpportunity } => r !== null
    );
  } catch (error: any) {
    logger.error(`Profitable symbol scan failed: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate potential profit for a trade
 */
export function calculateTradeProfit(
  opportunity: ArbitrageOpportunity,
  tradeAmount: number
): {
  buyAmount: number;
  buyTotal: number;
  sellTotal: number;
  fees: number;
  netProfit: number;
  roi: number;
} {
  const buyAmount = tradeAmount / opportunity.buyPrice;
  const buyTotal = tradeAmount;
  const sellTotal = buyAmount * opportunity.sellPrice;
  const fees = buyTotal * getExchangeFees(opportunity.buyExchange).taker +
               sellTotal * getExchangeFees(opportunity.sellExchange).taker;
  const netProfit = sellTotal - buyTotal - fees;
  const roi = (netProfit / buyTotal) * 100;

  return {
    buyAmount: Math.round(buyAmount * 100000000) / 100000000, // 8 decimals
    buyTotal: Math.round(buyTotal * 100) / 100,
    sellTotal: Math.round(sellTotal * 100) / 100,
    fees: Math.round(fees * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    roi: Math.round(roi * 100) / 100
  };
}

/**
 * Clear arbitrage cache
 */
export function clearArbitrageCache(): void {
  arbitrageCache.flushAll();
  logger.info('Arbitrage cache cleared');
}
