/**
 * Asset Discovery Service
 * 
 * Detects new assets, tracks discovery events, analyzes trends
 * Maintains a universe of all discovered assets across exchanges
 * 
 * Key responsibilities:
 * - Track new asset discoveries
 * - Analyze volume trends
 * - Calculate discovery metrics
 * - Maintain historical snapshots
 * - Detect trending assets
 */

import {
  NormalizedAsset,
  DiscoveryEvent,
  AssetStats,
  AssetQueryFilters,
  AssetSnapshot,
  VolumeTrend,
  AssetCategory,
} from '../types/assetTypes';
import { logger } from '../utils/logger';

interface InternalAssetStore {
  assets: Map<string, NormalizedAsset>;
  previousSnapshot?: AssetSnapshot;
  discoveryEvents: DiscoveryEvent[];
  lastUpdate: Date;
}

export class AssetDiscoveryService {
  private static store: InternalAssetStore = {
    assets: new Map(),
    discoveryEvents: [],
    lastUpdate: new Date(),
  };

  private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  private static lastCacheTime = 0;

  /**
   * Register an asset in the discovery system
   */
  static registerAsset(asset: NormalizedAsset): void {
    const id = asset.id;

    // Check if this is a new asset
    const existing = this.store.assets.get(id);
    const isNew = !existing;

    // Update store
    this.store.assets.set(id, asset);

    // Record discovery event if new
    if (isNew) {
      const primaryExchange = asset.primaryExchange || (asset.exchanges.length > 0 ? asset.exchanges[0].exchange : 'unknown');

      this.store.discoveryEvents.push({
        symbol: asset.symbol,
        discoveredAt: new Date(),
        discoveredOn: primaryExchange,
        firstVolume: asset.totalVolume24h,
        initialPrice: asset.bestBid > 0 ? asset.bestBid : undefined,
        category: asset.category,
        category_confidence: 75,
        sources: asset.exchanges.map((e) => e.exchange),
      });

      logger.info(`📊 NEW ASSET DISCOVERED: ${asset.symbol} on ${primaryExchange}`);
    }

    this.store.lastUpdate = new Date();
  }

  /**
   * Register multiple assets
   */
  static registerAssets(assets: NormalizedAsset[]): void {
    assets.forEach((asset) => this.registerAsset(asset));
  }

  /**
   * Get all discovered assets
   */
  static getAllAssets(): NormalizedAsset[] {
    return Array.from(this.store.assets.values());
  }

  /**
   * Get asset by symbol
   */
  static getAsset(symbol: string): NormalizedAsset | undefined {
    return this.store.assets.get(symbol.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  }

  /**
   * Search assets by filters
   */
  static searchAssets(filters: AssetQueryFilters): NormalizedAsset[] {
    let results = Array.from(this.store.assets.values());

    // Filter by category
    if (filters.category) {
      const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
      results = results.filter((a) => categories.includes(a.category!));
    }

    // Filter by exchange presence
    if (filters.exchange) {
      const exchanges = Array.isArray(filters.exchange) ? filters.exchange : [filters.exchange];
      results = results.filter((a) => a.exchanges.some((e) => exchanges.includes(e.exchange)));
    }

    // Filter by minimum volume
    if (filters.minVolume !== undefined) {
      results = results.filter((a) => a.totalVolume24h >= filters.minVolume!);
    }

    // Filter by maximum spread
    if (filters.maxSpread !== undefined) {
      results = results.filter((a) => a.bestSpread <= filters.maxSpread!);
    }

    // Filter by minimum liquidity score
    if (filters.minLiquidity !== undefined) {
      results = results.filter((a) => a.liquidityScore >= filters.minLiquidity!);
    }

    // Filter by new status
    if (filters.isNew !== undefined) {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      results = results.filter((a) => filters.isNew ? a.discoveredDate > cutoff : a.discoveredDate <= cutoff);
    }

    // Filter by blockchains
    if (filters.blockchains) {
      const blockchains = Array.isArray(filters.blockchains) ? filters.blockchains : [filters.blockchains];
      results = results.filter((a) => a.blockchains && a.blockchains.some((b) => blockchains.includes(b)));
    }

    // Filter by search term
    if (filters.search) {
      const term = filters.search.toLowerCase();
      results = results.filter(
        (a) =>
          a.symbol.toLowerCase().includes(term) ||
          a.name?.toLowerCase().includes(term) ||
          a.tags.some((t) => t.toLowerCase().includes(term))
      );
    }

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get assets by category
   */
  static getAssetsByCategory(category: AssetCategory): NormalizedAsset[] {
    return Array.from(this.store.assets.values()).filter((a) => a.category === category);
  }

  /**
   * Get assets by exchange
   */
  static getAssetsByExchange(exchange: string): NormalizedAsset[] {
    return Array.from(this.store.assets.values()).filter((a) =>
      a.exchanges.some((e) => e.exchange.toLowerCase() === exchange.toLowerCase())
    );
  }

  /**
   * Get new assets discovered in last N days
   */
  static getNewAssets(days: number = 7): NormalizedAsset[] {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return Array.from(this.store.assets.values())
      .filter((a) => a.discoveredDate > cutoff)
      .sort((a, b) => b.discoveredDate.getTime() - a.discoveredDate.getTime());
  }

  /**
   * Get trending assets by volume change
   */
  static getTrendingAssets(limit: number = 50): NormalizedAsset[] {
    return Array.from(this.store.assets.values())
      .filter((a) => a.volumeTrend.change24h !== undefined)
      .sort((a, b) => (b.volumeTrend.change24h || 0) - (a.volumeTrend.change24h || 0))
      .slice(0, limit);
  }

  /**
   * Get most liquid assets
   */
  static getMostLiquidAssets(limit: number = 50): NormalizedAsset[] {
    return Array.from(this.store.assets.values())
      .sort((a, b) => b.liquidityScore - a.liquidityScore)
      .slice(0, limit);
  }

  /**
   * Get exchange-exclusive assets
   */
  static getExchangeExclusive(exchange: string): NormalizedAsset[] {
    return Array.from(this.store.assets.values()).filter(
      (a) => a.exchangeCount === 1 && a.exchanges[0].exchange.toLowerCase() === exchange.toLowerCase()
    );
  }

  /**
   * Get assets with multi-chain presence
   */
  static getMultiChainAssets(): NormalizedAsset[] {
    return Array.from(this.store.assets.values()).filter((a) => a.isMultiChain);
  }

  /**
   * Get comprehensive asset statistics
   */
  static getAssetStats(): AssetStats {
    const assets = this.getAllAssets();

    const stats: AssetStats = {
      totalAssets: assets.length,
      assetsByCategory: {} as Record<AssetCategory, number>,
      assetsByExchange: {},
      newAssetsThisWeek: this.getNewAssets(7).length,
      newAssetsToday: this.getNewAssets(1).length,
      mostLiquidAssets: this.getMostLiquidAssets(10),
      trendingAssets: this.getTrendingAssets(10),
      newListings: this.getLatestDiscoveryEvents(20),
    };

    // Count by category
    const categories: Set<AssetCategory> = new Set();
    assets.forEach((a) => {
      if (a.category) {
        categories.add(a.category);
        stats.assetsByCategory[a.category] = (stats.assetsByCategory[a.category] || 0) + 1;
      }
    });

    // Count by exchange
    const exchanges: Set<string> = new Set();
    assets.forEach((a) => {
      a.exchanges.forEach((e) => {
        exchanges.add(e.exchange);
        stats.assetsByExchange[e.exchange] = (stats.assetsByExchange[e.exchange] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * Get latest discovery events
   */
  static getLatestDiscoveryEvents(limit: number = 100): DiscoveryEvent[] {
    return this.store.discoveryEvents
      .sort((a, b) => b.discoveredAt.getTime() - a.discoveredAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get discovery events for a specific time range
   */
  static getDiscoveryEventsByRange(startDate: Date, endDate: Date): DiscoveryEvent[] {
    return this.store.discoveryEvents.filter(
      (event) => event.discoveredAt >= startDate && event.discoveredAt <= endDate
    );
  }

  /**
   * Analyze volume trends for an asset
   */
  static analyzeVolumeTrend(asset: NormalizedAsset, historicalVolumes?: number[]): VolumeTrend {
    const current = asset.totalVolume24h;

    // Default historical analysis (would use database in production)
    const average7d = current * 0.95; // Placeholder
    const average30d = current * 0.90; // Placeholder

    const change24h = ((current - average7d) / average7d) * 100;
    const change7d = ((average7d - average30d) / average30d) * 100;
    const change30d = 0; // Would calculate from historical data

    const trend = change24h > 10 ? 'increasing' : change24h < -10 ? 'decreasing' : 'stable';

    return {
      current,
      average7d,
      average30d,
      change24h,
      change7d,
      change30d,
      trend,
      volatility: 15, // Placeholder
    };
  }

  /**
   * Get assets that appeared exclusively on an exchange
   */
  static getExchangeFirstListings(exchange: string, days: number = 7): NormalizedAsset[] {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return Array.from(this.store.assets.values()).filter((asset) => {
      // Asset must be new
      if (asset.discoveredDate <= cutoff) return false;

      // Asset must exist on this exchange
      const hasExchange = asset.exchanges.some((e) => e.exchange.toLowerCase() === exchange.toLowerCase());
      if (!hasExchange) return false;

      // This should be the primary exchange (most volume)
      const primaryEx = asset.exchanges.reduce((prev, curr) =>
        curr.volume24h > prev.volume24h ? curr : prev
      );

      return primaryEx.exchange.toLowerCase() === exchange.toLowerCase();
    });
  }

  /**
   * Get summary statistics by category
   */
  static getCategoryStats(): Record<AssetCategory, { count: number; totalVolume: number; avgLiquidity: number }> {
    const stats: Record<string, { count: number; totalVolume: number; avgLiquidity: number }> = {};

    Array.from(this.store.assets.values()).forEach((asset) => {
      if (!asset.category) return;

      if (!stats[asset.category]) {
        stats[asset.category] = { count: 0, totalVolume: 0, avgLiquidity: 0 };
      }

      stats[asset.category].count++;
      stats[asset.category].totalVolume += asset.totalVolume24h;
      stats[asset.category].avgLiquidity += asset.liquidityScore;
    });

    // Calculate averages
    Object.values(stats).forEach((stat) => {
      if (stat.count > 0) {
        stat.avgLiquidity = stat.avgLiquidity / stat.count;
      }
    });

    return stats as Record<AssetCategory, any>;
  }

  /**
   * Take snapshot of current state (for historical tracking)
   */
  static takeSnapshot(): AssetSnapshot {
    const assets = this.getAllAssets();
    const categories: Record<AssetCategory, number> = {} as any;

    assets.forEach((a) => {
      if (a.category) {
        categories[a.category] = (categories[a.category] || 0) + 1;
      }
    });

    const snapshot: AssetSnapshot = {
      timestamp: new Date(),
      totalAssets: assets.length,
      assetsByCategory: categories,
      newAssetsCount: this.getNewAssets(1).length,
      totalVolume: assets.reduce((sum, a) => sum + a.totalVolume24h, 0),
      averageLiquidity: assets.length > 0 ? assets.reduce((sum, a) => sum + a.liquidityScore, 0) / assets.length : 0,
    };

    this.store.previousSnapshot = snapshot;
    return snapshot;
  }

  /**
   * Clear all discovery data (for testing)
   */
  static clear(): void {
    this.store = {
      assets: new Map(),
      discoveryEvents: [],
      lastUpdate: new Date(),
    };
    logger.info('Asset discovery store cleared');
  }

  /**
   * Get store statistics
   */
  static getStoreStats() {
    return {
      totalAssets: this.store.assets.size,
      totalDiscoveryEvents: this.store.discoveryEvents.length,
      lastUpdate: this.store.lastUpdate,
      cacheAge: Date.now() - this.store.lastUpdate.getTime(),
    };
  }
}

export default AssetDiscoveryService;
