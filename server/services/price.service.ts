/**
 * Price Service - Fetch and Cache Asset Prices
 * 
 * Fetches current prices for treasury assets from:
 * 1. Local database (assetPriceHistory table - cached prices)
 * 2. Coingecko API (real-time fallback)
 * 3. Hardcoded defaults (last resort)
 */

import { db } from '../db';
import { assetPriceHistory } from '../../shared/schema';
import { desc, sql } from 'drizzle-orm';

interface PriceData {
  symbol: string;
  chain?: string;
  priceUsd: number;
  timestamp: Date;
  source: 'cache' | 'coingecko' | 'fallback';
}

// Coingecko token IDs mapping (symbol -> coingecko id)
const COINGECKO_IDS: Record<string, string> = {
  'CELO': 'celo',
  'ETH': 'ethereum',
  'USDC': 'usd-coin',
  'cUSD': 'celo-dollar',
  'USDT': 'tether',
  'DAI': 'dai',
  'BTC': 'bitcoin',
  'wETH': 'ethereum',
  'wBTC': 'bitcoin',
  'aUSDC': 'usd-coin',
  'aDAI': 'dai',
};

// Default fallback prices
const FALLBACK_PRICES: Record<string, number> = {
  'CELO': 0.75,
  'cUSD': 1.0,
  'USDC': 1.0,
  'cEUR': 1.08,
  'USDT': 1.0,
  'DAI': 1.0,
  'ETH': 2500,
  'BTC': 42000,
  'wETH': 2500,
  'wBTC': 42000,
  'aUSDC': 1.0,
  'aDAI': 1.0,
};

/**
 * Get price for a single asset
 * Uses cache first, then real-time API if needed
 */
export async function getAssetPrice(
  symbol: string,
  chain?: string
): Promise<PriceData> {
  // Try cache first (last 1 hour)
  const cachedPrice = await getCachedPrice(symbol);
  if (cachedPrice && isRecent(cachedPrice.timestamp, 3600)) {
    return { ...cachedPrice, source: 'cache' };
  }

  // Try Coingecko API
  try {
    const coingeckoPrice = await fetchFromCoingecko(symbol);
    if (coingeckoPrice) {
      // Store in cache for future use
      await storePriceInCache(symbol, coingeckoPrice);
      return { symbol, priceUsd: coingeckoPrice, timestamp: new Date(), source: 'coingecko' };
    }
  } catch (error) {
    console.warn(`Failed to fetch Coingecko price for ${symbol}:`, error);
  }

  // Fallback to hardcoded defaults
  const price = FALLBACK_PRICES[symbol] || 1;
  return {
    symbol,
    chain,
    priceUsd: price,
    timestamp: new Date(),
    source: 'fallback',
  };
}

/**
 * Get prices for multiple assets at once
 */
export async function getAssetPrices(
  symbols: string[],
  chains?: Record<string, string>
): Promise<Record<string, PriceData>> {
  const prices: Record<string, PriceData> = {};

  // Fetch all prices in parallel
  const pricePromises = symbols.map(symbol =>
    getAssetPrice(symbol, chains?.[symbol])
      .then(price => {
        prices[symbol] = price;
      })
      .catch(error => {
        console.warn(`Error fetching price for ${symbol}:`, error);
        prices[symbol] = {
          symbol,
          chain: chains?.[symbol],
          priceUsd: FALLBACK_PRICES[symbol] || 1,
          timestamp: new Date(),
          source: 'fallback',
        };
      })
  );

  await Promise.all(pricePromises);
  return prices;
}

/**
 * Get historical prices for a symbol over a time range
 */
export async function getPriceHistory(
  symbol: string,
  days: number = 30
): Promise<any[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  try {
    const history = await db
      .select({
        price: assetPriceHistory.priceUsd,
        timestamp: assetPriceHistory.recordedAt,
        marketCap: assetPriceHistory.marketCap,
        volume24h: assetPriceHistory.volume24h,
        change24h: assetPriceHistory.priceChange24h,
      })
      .from(assetPriceHistory)
      .where(
        sql`asset_symbol = ${symbol} AND recorded_at >= ${cutoffDate}`
      )
      .orderBy(desc(assetPriceHistory.recordedAt));

    return history;
  } catch (error) {
    console.error(`Error fetching price history for ${symbol}:`, error);
    return [];
  }
}

/**
 * Get cached price from database
 */
async function getCachedPrice(symbol: string): Promise<PriceData | null> {
  try {
    const result = await db
      .select({
        priceUsd: assetPriceHistory.priceUsd,
        recordedAt: assetPriceHistory.recordedAt,
      })
      .from(assetPriceHistory)
      .where(sql`asset_symbol = ${symbol}`)
      .orderBy(desc(assetPriceHistory.recordedAt))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      symbol,
      priceUsd: parseFloat(result[0].priceUsd.toString()),
      timestamp: result[0].recordedAt || new Date(),
    } as PriceData;
  } catch (error) {
    console.warn(`Error getting cached price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Store price in cache for future use
 */
async function storePriceInCache(
  symbol: string,
  price: number
): Promise<void> {
  try {
    await db.insert(assetPriceHistory).values({
      assetSymbol: symbol,
      priceUsd: price.toString(),
      recordedAt: new Date(),
    });
  } catch (error) {
    console.error(`Error storing price for ${symbol}:`, error);
  }
}

/**
 * Fetch price from Coingecko API
 */
async function fetchFromCoingecko(symbol: string): Promise<number | null> {
  const coingeckoId = COINGECKO_IDS[symbol];
  if (!coingeckoId) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data[coingeckoId]?.usd || null;
  } catch (error) {
    console.error(`Error fetching from Coingecko for ${symbol}:`, error);
    return null;
  }
}

/**
 * Check if a timestamp is recent
 */
function isRecent(timestamp: Date, secondsThreshold: number = 3600): boolean {
  const now = new Date();
  const diff = (now.getTime() - timestamp.getTime()) / 1000;
  return diff < secondsThreshold;
}

/**
 * Get price data object for API responses
 * Format: { 'SYMBOL-CHAIN': price }
 */
export async function getPriceDataObjectForTreasury(
  assets: Array<{ symbol: string; chain: string }>
): Promise<Record<string, number>> {
  const prices = await getAssetPrices(
    [...new Set(assets.map(a => a.symbol))],
    Object.fromEntries(assets.map(a => [a.symbol, a.chain]))
  );

  const result: Record<string, number> = {};
  for (const asset of assets) {
    const key = `${asset.symbol}-${asset.chain}`;
    result[key] = prices[asset.symbol]?.priceUsd || FALLBACK_PRICES[asset.symbol] || 1;
  }

  return result;
}
