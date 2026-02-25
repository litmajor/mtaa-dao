/**
 * Asset Discovery API Routes
 * 
 * Endpoints for discovering, searching, and analyzing assets
 * Leverages normalization and intelligence services
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import AssetDiscoveryService from '../services/assetDiscovery';
import AssetIntelligenceService from '../services/assetIntelligence';
import AssetNormalizationService from '../services/assetNormalization';
import ArbitrageDetectionService from '../services/arbitrageDetector';
import ccxtService from '../services/ccxtService';
import { logger } from '../utils/logger';
import {
  NormalizedAsset,
  AssetQueryFilters,
  RawMarketData,
} from '../types/assetTypes';

const router: Router = express.Router();

/**
 * Helper: Async handler
 */
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * POST /api/discover/sync
 * Synchronize all assets from exchanges
 * Runs normalization and discovery on all markets
 */
router.post(
  '/sync',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('🔄 Starting asset discovery sync...');
      const startTime = Date.now();

      const exchanges = ccxtService.getAvailableExchanges();
      let totalAssetsProcessed = 0;
      let totalNormalized = 0;
      const errors: string[] = [];

      // Process each exchange
      for (const exchange of exchanges) {
        try {
          logger.info(`  Processing ${exchange}...`);
          const markets = await ccxtService.getMarkets(exchange);

          // Normalize each market
          for (const market of markets) {
            try {
              const rawData: RawMarketData = {
                exchange,
                symbol: market.symbol,
                id: market.id,
                base: market.base || (market as any).baseId,
                quote: market.quote || (market as any).quoteId,
                baseId: (market as any).baseId || market.base,
                quoteId: (market as any).quoteId || market.quote,
                active: (market as any).active !== false,
                maker: (market as any).maker,
                taker: (market as any).taker,
                limits: (market as any).limits,
                precision: (market as any).precision,
                info: (market as any).info,
              };

              // Try to get ticker data
              try {
                const ticker = await ccxtService.getTickerFromExchange(exchange, market.symbol);
                rawData.last = ticker?.last;
                rawData.bid = ticker?.bid;
                rawData.ask = ticker?.ask;
                rawData.volume = ticker?.volume;
                rawData.quoteVolume = (ticker as any)?.quoteVolume;
                rawData.timestamp = ticker?.timestamp;
              } catch (tickerError) {
                logger.debug(`Could not fetch ticker for ${market.symbol} on ${exchange}`);
              }

              // Normalize
              const result = AssetNormalizationService.normalizeAsset(rawData);
              if (result.success && result.asset) {
                // Enrich with intelligence
                const enriched = AssetIntelligenceService.enrichAsset(result.asset);

                // Register in discovery service
                AssetDiscoveryService.registerAsset(enriched);
                totalNormalized++;
              } else if (result.errors.length > 0) {
                logger.debug(`Normalization failed for ${market.symbol}: ${result.errors.join(', ')}`);
              }

              totalAssetsProcessed++;
            } catch (error) {
              logger.debug(`Error processing market: ${error instanceof Error ? error.message : 'Unknown'}`);
            }
          }
        } catch (error) {
          const msg = `Failed to process exchange ${exchange}: ${error instanceof Error ? error.message : 'Unknown'}`;
          logger.warn(msg);
          errors.push(msg);
        }
      }

      // Take snapshot
      const snapshot = AssetDiscoveryService.takeSnapshot();
      const duration = Date.now() - startTime;

      logger.info(`✅ Discovery sync complete in ${duration}ms`);
      logger.info(`   Total processed: ${totalAssetsProcessed}, Normalized: ${totalNormalized}`);

      res.json({
        success: true,
        duration,
        processed: totalAssetsProcessed,
        normalized: totalNormalized,
        errors,
        snapshot,
      });
    } catch (error: any) {
      logger.error(`Discovery sync failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to sync assets',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/discover/assets
 * Get all discovered assets with optional filters
 * Query params:
 *  - category: DeFi, Layer1, Stablecoin, etc.
 *  - exchange: binance, coinbase, etc.
 *  - minVolume: Minimum 24h volume
 *  - minLiquidity: Minimum liquidity score (1-100)
 *  - isNew: true/false
 *  - search: Search term
 *  - limit: Max results (default: 100)
 *  - offset: Pagination offset (default: 0)
 */
router.get(
  '/assets',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const filters: AssetQueryFilters = {
        category: req.query.category as any,
        exchange: req.query.exchange as any,
        minVolume: req.query.minVolume ? parseFloat(req.query.minVolume as string) : undefined,
        minLiquidity: req.query.minLiquidity ? parseFloat(req.query.minLiquidity as string) : undefined,
        isNew: req.query.isNew ? req.query.isNew === 'true' : undefined,
        blockchains: req.query.blockchains as any,
        search: req.query.search as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const assets = AssetDiscoveryService.searchAssets(filters);

      res.json({
        success: true,
        count: assets.length,
        filters,
        assets: assets.map((asset) => ({
          ...asset,
          intelligenceScore: AssetIntelligenceService.calculateIntelligenceScore(asset),
          insights: AssetIntelligenceService.generateInsights(asset),
        })),
      });
    } catch (error: any) {
      logger.error(`Asset search failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to search assets',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/discover/asset/:symbol
 * Get detailed information about a specific asset
 */
router.get(
  '/asset/:symbol',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const asset = AssetDiscoveryService.getAsset(symbol);

      if (!asset) {
        return res.status(404).json({
          success: false,
          error: `Asset not found: ${symbol}`,
        });
      }

      const enriched = AssetIntelligenceService.enrichAsset(asset);

      res.json({
        success: true,
        asset: {
          ...enriched,
          intelligenceScore: AssetIntelligenceService.calculateIntelligenceScore(enriched),
          insights: AssetIntelligenceService.generateInsights(enriched),
          tradingRating: {
            trading: AssetIntelligenceService.rateForUseCase(enriched, 'trading'),
            lending: AssetIntelligenceService.rateForUseCase(enriched, 'lending'),
            yield: AssetIntelligenceService.rateForUseCase(enriched, 'yield'),
            arbitrage: AssetIntelligenceService.rateForUseCase(enriched, 'arbitrage'),
            longTermHold: AssetIntelligenceService.rateForUseCase(enriched, 'long-term-hold'),
          },
        },
      });
    } catch (error: any) {
      logger.error(`Asset detail fetch failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch asset details',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/discover/category/:category
 * Get all assets in a category
 */
router.get(
  '/category/:category',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { category } = req.params;
      const assets = AssetDiscoveryService.getAssetsByCategory(category as any);

      res.json({
        success: true,
        category,
        count: assets.length,
        assets: assets
          .sort((a, b) => b.liquidityScore - a.liquidityScore)
          .slice(0, 100)
          .map((asset) => ({
            symbol: asset.symbol,
            name: asset.name,
            liquidityScore: asset.liquidityScore,
            exchangeCount: asset.exchangeCount,
            volume24h: asset.totalVolume24h,
            category: asset.category,
            blockchains: asset.blockchains,
          })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch category assets',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/discover/new
 * Get newly discovered assets
 * Query params:
 *  - days: Days to look back (default: 7)
 */
router.get(
  '/new',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const newAssets = AssetDiscoveryService.getNewAssets(days);

      res.json({
        success: true,
        days,
        count: newAssets.length,
        newAssets: newAssets.map((asset) => ({
          symbol: asset.symbol,
          name: asset.name,
          discoveredDate: asset.discoveredDate,
          discoveredOn: asset.primaryExchange,
          volume24h: asset.totalVolume24h,
          category: asset.category,
          liquidityScore: asset.liquidityScore,
          exchanges: asset.exchanges.length,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch new assets',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/discover/trending
 * Get trending assets by volume change
 */
router.get(
  '/trending',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const trending = AssetDiscoveryService.getTrendingAssets(limit);

      res.json({
        success: true,
        count: trending.length,
        trendingAssets: trending.map((asset) => ({
          symbol: asset.symbol,
          name: asset.name,
          volumeChange24h: asset.volumeTrend.change24h,
          currentVolume: asset.totalVolume24h,
          liquidityScore: asset.liquidityScore,
          category: asset.category,
          exchanges: asset.exchangeCount,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trending assets',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/discover/statistics
 * Get comprehensive discovery statistics
 */
router.get(
  '/statistics',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const stats = AssetDiscoveryService.getAssetStats();
      const categoryStats = AssetDiscoveryService.getCategoryStats();

      res.json({
        success: true,
        stats,
        categoryStats,
        storeStats: AssetDiscoveryService.getStoreStats(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/discover/exchange/:exchange
 * Get assets available on a specific exchange
 */
router.get(
  '/exchange/:exchange',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { exchange } = req.params;
      const assets = AssetDiscoveryService.getAssetsByExchange(exchange);
      const exclusive = AssetDiscoveryService.getExchangeExclusive(exchange);

      res.json({
        success: true,
        exchange,
        totalAssets: assets.length,
        exclusiveAssets: exclusive.length,
        topLiquid: assets
          .sort((a, b) => b.liquidityScore - a.liquidityScore)
          .slice(0, 20)
          .map((a) => ({
            symbol: a.symbol,
            liquidityScore: a.liquidityScore,
            volume: a.totalVolume24h,
          })),
        exclusiveList: exclusive.map((a) => ({
          symbol: a.symbol,
          category: a.category,
          volume: a.totalVolume24h,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch exchange assets',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/discover/compare
 * Compare two assets
 * Query params:
 *  - asset1: First symbol
 *  - asset2: Second symbol
 */
router.get(
  '/compare',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { asset1, asset2 } = req.query;

      if (!asset1 || !asset2) {
        return res.status(400).json({
          error: 'asset1 and asset2 parameters required',
        });
      }

      const a1 = AssetDiscoveryService.getAsset(asset1 as string);
      const a2 = AssetDiscoveryService.getAsset(asset2 as string);

      if (!a1 || !a2) {
        return res.status(404).json({
          error: 'One or both assets not found',
        });
      }

      const comparison = AssetIntelligenceService.compareAssets(a1, a2);

      res.json({
        success: true,
        comparison,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to compare assets',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/discover/multichain
 * Get assets available on multiple blockchains
 */
router.get(
  '/multichain',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const multichain = AssetDiscoveryService.getMultiChainAssets();

      res.json({
        success: true,
        count: multichain.length,
        assets: multichain
          .sort((a, b) => (b.blockchains?.length || 0) - (a.blockchains?.length || 0))
          .slice(0, 100)
          .map((asset) => ({
            symbol: asset.symbol,
            name: asset.name,
            blockchains: asset.blockchains,
            blockchainCount: asset.blockchains?.length,
            exchangeCount: asset.exchangeCount,
            liquidityScore: asset.liquidityScore,
          })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch multichain assets',
        details: error.message,
      });
    }
  })
);

/**
 * Error handler
 */
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Discovery API error: ${error.message}`);
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
});

/**
 * GET /api/discover/arbitrage
 * Find arbitrage opportunities across exchanges
 * 
 * Query parameters:
 *   - minProfit: minimum profit percentage (default 0.05%)
 *   - maxRisk: filter by risk level (low, medium, high, critical)
 *   - minConfidence: minimum confidence score 0-100 (default 50)
 *   - category: filter by asset category
 *   - limit: max opportunities to return (default 50)
 *   - sortBy: profit, confidence, volume, risk (default: profit)
 */
router.get(
  '/arbitrage',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const {
        minProfit = 0.05,
        maxRisk = 'high',
        minConfidence = 50,
        category,
        limit = 50,
        sortBy = 'profit'
      } = req.query;

      const allAssets = AssetDiscoveryService.getAllAssets();
      let opportunities: any[] = [];

      // Detect opportunities in each asset
      for (const asset of allAssets) {
        // Filter by category if specified
        if (category && asset.category !== category) {
          continue;
        }

        const assetOpportunities = ArbitrageDetectionService.detectOpportunitiesInAsset(asset);
        opportunities.push(...assetOpportunities);
      }

      // Filter by criteria
      opportunities = opportunities.filter(opp => {
        const profitThreshold = parseFloat(minProfit as string) || 0.05;
        const riskLevels = ['low', 'medium', 'high', 'critical'];
        const maxRiskIndex = riskLevels.indexOf(maxRisk as string) || 2;
        const riskIndex = riskLevels.indexOf(opp.executionRisk);
        const confidenceThreshold = parseInt(minConfidence as string) || 50;

        return (
          opp.estimatedNetProfitPercentage >= profitThreshold &&
          riskIndex <= maxRiskIndex &&
          opp.confidenceScore >= confidenceThreshold
        );
      });

      // Sort
      const sortByStr = sortBy as string;
      if (sortByStr === 'confidence') {
        opportunities.sort((a, b) => b.confidenceScore - a.confidenceScore);
      } else if (sortByStr === 'volume') {
        opportunities.sort((a, b) => b.recommendedVolume - a.recommendedVolume);
      } else if (sortByStr === 'risk') {
        const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
        opportunities.sort((a, b) => (riskOrder[a.executionRisk] ?? 0) - (riskOrder[b.executionRisk] ?? 0));
      } else {
        // Default: profit
        opportunities.sort((a, b) => b.estimatedNetProfitPercentage - a.estimatedNetProfitPercentage);
      }

      // Limit results
      opportunities = opportunities.slice(0, parseInt(limit as string) || 50);

      // Calculate statistics
      const stats = ArbitrageDetectionService.calculateStats(opportunities);

      res.json({
        success: true,
        count: opportunities.length,
        stats,
        opportunities: opportunities.map(opp => ({
          symbol: opp.symbol,
          buyExchange: opp.buyExchange,
          buyPrice: opp.buyPrice.toFixed(2),
          sellExchange: opp.sellExchange,
          sellPrice: opp.sellPrice.toFixed(2),
          priceGap: opp.priceGap.toFixed(2),
          priceGapPercentage: opp.priceGapPercentage.toFixed(4),
          grossProfit: opp.grossProfit.toFixed(2),
          grossProfitPercentage: opp.grossProfitPercentage.toFixed(4),
          estimatedFees: opp.estimatedFees.toFixed(2),
          estimatedSlippage: opp.estimatedSlippage.toFixed(2),
          estimatedNetProfit: opp.estimatedNetProfit.toFixed(2),
          estimatedNetProfitPercentage: opp.estimatedNetProfitPercentage.toFixed(4),
          executionRisk: opp.executionRisk,
          riskFactors: opp.riskFactors,
          minCapacity: opp.minCapacity.toFixed(2),
          maxCapacity: opp.maxCapacity.toFixed(2),
          recommendedVolume: opp.recommendedVolume.toFixed(2),
          confidenceScore: opp.confidenceScore.toFixed(0),
          timeWindowMinutes: opp.timeWindowMinutes,
          score: opp.score.toFixed(0),
          recommendation: opp.recommendation,
          reasoning: opp.reasoning
        }))
      });
    } catch (error: any) {
      logger.error(`Arbitrage detection error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);

/**
 * GET /api/discover/arbitrage/:symbol
 * Get arbitrage opportunities for a specific asset
 */
router.get(
  '/arbitrage/:symbol',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const asset = AssetDiscoveryService.getAsset(symbol);

      if (!asset) {
        return res.status(404).json({
          success: false,
          error: `Asset ${symbol} not found`
        });
      }

      const opportunities = ArbitrageDetectionService.detectOpportunitiesInAsset(asset);
      const stats = ArbitrageDetectionService.calculateStats(opportunities);

      res.json({
        success: true,
        symbol,
        count: opportunities.length,
        stats,
        opportunities: opportunities.map(opp => ({
          buyExchange: opp.buyExchange,
          buyPrice: opp.buyPrice.toFixed(2),
          sellExchange: opp.sellExchange,
          sellPrice: opp.sellPrice.toFixed(2),
          priceGapPercentage: opp.priceGapPercentage.toFixed(4),
          estimatedNetProfitPercentage: opp.estimatedNetProfitPercentage.toFixed(4),
          executionRisk: opp.executionRisk,
          confidenceScore: opp.confidenceScore.toFixed(0),
          recommendation: opp.recommendation,
          reasoning: opp.reasoning
        }))
      });
    } catch (error: any) {
      logger.error(`Arbitrage detection error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);

export default router;
