import { cacheService } from './cacheService';
import { ccxtService } from './ccxtService';
import { logger } from '../utils/logger';

/**
 * Market Analytics Service
 * Tracks spread trends, depth trends, and provides market microstructure insights
 */

export interface SpreadAnalysis {
  symbol: string;
  exchange: string;
  timestamp: number;
  currentSpread: number;                 // Percentage
  spreadTrend: 'widening' | 'stable' | 'tightening';
  spreadHistory: Array<{ timestamp: number; spread: number }>;
  averageSpread: number;
  spreadVolatility: number;              // Standard deviation
  tightestSpread: number;
  widestSpread: number;
}

export interface DepthAnalysis {
  symbol: string;
  exchange: string;
  timestamp: number;
  bidDepth: {
    level1: number;                      // Volume within 0.5%
    level2: number;                      // Volume within 1%
    level5: number;                      // Volume within 5%
    level10: number;                     // Volume within 10%
    total: number;
  };
  askDepth: {
    level1: number;
    level2: number;
    level5: number;
    level10: number;
    total: number;
  };
  depthTrend: 'improving' | 'stable' | 'degrading';
  depthImbalance: number;                // bid depth / ask depth ratio
  liquidityHealth: number;               // 0-100 score
}

export interface LiquidityTrend {
  symbol: string;
  exchange: string;
  timeWindow: string;
  trend: 'improving' | 'stable' | 'degrading';
  liquidityScore: number;                // 0-100
  averageDailyVolume: number;
  volumeTrend: 'increasing' | 'stable' | 'decreasing';
  volumeIMbalance: {
    buyVolume: number;
    sellVolume: number;
    ratio: number;                       // buy/sell
  };
  recommendations: string[];
}

export interface MarketMicrostructure {
  symbol: string;
  exchange: string;
  timestamp: number;
  orderFlowImbalance: number;           // -100 to 100 (sell pressure to buy pressure)
  priceImpactEstimate: number;          // Estimated slippage for $1M order
  effectiveSpread: number;              // Including market impact
  resilienceIndicator: number;          // How quickly market recovers from large trades
  microstructureQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

class MarketAnalyticsService {
  private static instance: MarketAnalyticsService;

  private constructor() {}

  static getInstance(): MarketAnalyticsService {
    if (!MarketAnalyticsService.instance) {
      MarketAnalyticsService.instance = new MarketAnalyticsService();
    }
    return MarketAnalyticsService.instance;
  }

  /**
   * Analyze spread trends for a trading pair
   */
  async analyzeSpreadTrends(
    symbol: string,
    exchange: string = 'binance',
    timeWindow: number = 3600000 // 1 hour in milliseconds
  ): Promise<SpreadAnalysis> {
    const cacheKey = `spread-trend:${symbol}:${exchange}`;
    
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached as SpreadAnalysis;
    }

    try {
      const orderBook = await ccxtService.fetchOrderBook(exchange, symbol, 50);

      if (!orderBook || orderBook.bids.length === 0 || orderBook.asks.length === 0) {
        return this.createEmptySpreadAnalysis(symbol, exchange);
      }

      const bid = orderBook.bids[0][0];
      const ask = orderBook.asks[0][0];
      const midPrice = (bid + ask) / 2;
      const currentSpread = ((ask - bid) / midPrice) * 100;

      // Get historical spread data from cache or Redis
      const spreadHistory = await this.getSpreadHistory(symbol, exchange, timeWindow);

      // Calculate spread statistics
      const spreads = spreadHistory.map(h => h.spread);
      const averageSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
      const spreadVariances = spreads.map(s => Math.pow(s - averageSpread, 2));
      const spreadVolatility = Math.sqrt(spreadVariances.reduce((a, b) => a + b, 0) / spreads.length);

      // Determine trend
      const recentSpreads = spreads.slice(-5);
      const olderSpreads = spreads.slice(0, 5);
      const recentAvg = recentSpreads.reduce((a, b) => a + b, 0) / recentSpreads.length;
      const olderAvg = olderSpreads.reduce((a, b) => a + b, 0) / olderSpreads.length;

      const spreadTrend =
        recentAvg > olderAvg * 1.1 ? 'widening' :
        recentAvg < olderAvg * 0.9 ? 'tightening' :
        'stable';

      // Store current spread in history for future analysis
      spreadHistory.push({ timestamp: Date.now(), spread: currentSpread });
      await cacheService.set(`spread-history:${symbol}:${exchange}`, spreadHistory, 86400); // 24h TTL

      const analysis: SpreadAnalysis = {
        symbol,
        exchange,
        timestamp: Date.now(),
        currentSpread,
        spreadTrend,
        spreadHistory,
        averageSpread,
        spreadVolatility,
        tightestSpread: Math.min(...spreads),
        widestSpread: Math.max(...spreads)
      };

      // Cache for 30 minutes
      await cacheService.set(cacheKey, analysis, 1800);

      return analysis;
    } catch (error) {
      logger.error('Error analyzing spread trends:', { symbol, exchange, error });
      return this.createEmptySpreadAnalysis(symbol, exchange);
    }
  }

  /**
   * Analyze order book depth trends
   */
  async analyzeDepthTrends(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<DepthAnalysis> {
    const cacheKey = `depth-trend:${symbol}:${exchange}`;
    
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached as DepthAnalysis;
    }

    try {
      const orderBook = await ccxtService.fetchOrderBook(exchange, symbol, 100);

      if (!orderBook || orderBook.bids.length === 0 || orderBook.asks.length === 0) {
        return this.createEmptyDepthAnalysis(symbol, exchange);
      }

      // Calculate depth at different levels
      const bidDepth = this.calculateDepthLevels(orderBook.bids);
      const askDepth = this.calculateDepthLevels(orderBook.asks);

      // Calculate depth imbalance
      const depthImbalance = bidDepth.total > 0 && askDepth.total > 0 
        ? bidDepth.total / askDepth.total
        : 1;

      // Get historical depth data
      const depthHistory = await this.getDepthHistory(symbol, exchange);
      
      // Determine trend
      const recentDepth = depthHistory.slice(-5);
      const olderDepth = depthHistory.slice(0, 5);
      
      const recentAvgImbalance = recentDepth.length > 0
        ? recentDepth.reduce((sum, d) => sum + d.imbalance, 0) / recentDepth.length
        : 1;
      
      const olderAvgImbalance = olderDepth.length > 0
        ? olderDepth.reduce((sum, d) => sum + d.imbalance, 0) / olderDepth.length
        : 1;

      const depthTrend =
        recentAvgImbalance > olderAvgImbalance * 1.1 ? 'improving' :
        recentAvgImbalance < olderAvgImbalance * 0.9 ? 'degrading' :
        'stable';

      // Calculate liquidity health score (0-100)
      const liquidityHealth = this.calculateLiquidityHealth(bidDepth, askDepth, depthImbalance);

      // Store current depth for history
      depthHistory.push({
        timestamp: Date.now(),
        bidTotal: bidDepth.total,
        askTotal: askDepth.total,
        imbalance: depthImbalance
      });
      await cacheService.set(`depth-history:${symbol}:${exchange}`, depthHistory, 86400);

      const analysis: DepthAnalysis = {
        symbol,
        exchange,
        timestamp: Date.now(),
        bidDepth,
        askDepth,
        depthTrend,
        depthImbalance,
        liquidityHealth
      };

      // Cache for 30 minutes
      await cacheService.set(cacheKey, analysis, 1800);

      return analysis;
    } catch (error) {
      logger.error('Error analyzing depth trends:', { symbol, exchange, error });
      return this.createEmptyDepthAnalysis(symbol, exchange);
    }
  }

  /**
   * Analyze liquidity trends over time
   */
  async analyzeLiquidityTrends(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<LiquidityTrend> {
    const cacheKey = `liquidity-trend:${symbol}:${exchange}`;
    
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached as LiquidityTrend;
    }

    try {
      // Get recent trades for volume analysis
      const trades = await ccxtService.fetchTrades(exchange, symbol, 100);
      
      if (!trades || trades.length === 0) {
        return this.createEmptyLiquidityTrend(symbol, exchange);
      }

      // Calculate volume metrics
      const buyVolume = trades
        .filter(t => t.side === 'buy')
        .reduce((sum, t) => sum + (t.amount * t.price), 0);
      
      const sellVolume = trades
        .filter(t => t.side === 'sell')
        .reduce((sum, t) => sum + (t.amount * t.price), 0);

      const totalVolume = buyVolume + sellVolume;
      const volumeRatio = sellVolume > 0 ? buyVolume / sellVolume : 1;

      // Get depth analysis
      const depthAnalysis = await this.analyzeDepthTrends(symbol, exchange);

      // Get historical liquidity data
      const liquidityHistory = await this.getLiquidityHistory(symbol, exchange);

      // Determine trend
      const recentLiquidity = liquidityHistory.slice(-5);
      const olderLiquidity = liquidityHistory.slice(0, 5);

      const recentAvgLiquidity = recentLiquidity.length > 0
        ? recentLiquidity.reduce((sum, l) => sum + l.score, 0) / recentLiquidity.length
        : 50;

      const olderAvgLiquidity = olderLiquidity.length > 0
        ? olderLiquidity.reduce((sum, l) => sum + l.score, 0) / olderLiquidity.length
        : 50;

      const liquidityTrend =
        recentAvgLiquidity > olderAvgLiquidity * 1.1 ? 'improving' :
        recentAvgLiquidity < olderAvgLiquidity * 0.9 ? 'degrading' :
        'stable';

      // Volume trend
      const averageVolume = liquidityHistory.length > 0
        ? liquidityHistory.reduce((sum, l) => sum + l.volume, 0) / liquidityHistory.length
        : totalVolume;

      const volumeTrend =
        totalVolume > averageVolume * 1.2 ? 'increasing' :
        totalVolume < averageVolume * 0.8 ? 'decreasing' :
        'stable';

      // Generate recommendations
      const recommendations = this.generateLiquidityRecommendations(
        depthAnalysis,
        liquidityTrend,
        volumeTrend,
        volumeRatio
      );

      // Store in history
      liquidityHistory.push({
        timestamp: Date.now(),
        score: depthAnalysis.liquidityHealth,
        volume: totalVolume
      });
      await cacheService.set(`liquidity-history:${symbol}:${exchange}`, liquidityHistory, 86400);

      const trend: LiquidityTrend = {
        symbol,
        exchange,
        timeWindow: '24h',
        trend: liquidityTrend,
        liquidityScore: depthAnalysis.liquidityHealth,
        averageDailyVolume: averageVolume,
        volumeTrend,
        volumeIMbalance: {
          buyVolume,
          sellVolume,
          ratio: volumeRatio
        },
        recommendations
      };

      // Cache for 2 hours
      await cacheService.set(cacheKey, trend, 7200);

      return trend;
    } catch (error) {
      logger.error('Error analyzing liquidity trends:', { symbol, exchange, error });
      return this.createEmptyLiquidityTrend(symbol, exchange);
    }
  }

  /**
   * Analyze market microstructure for quality assessment
   */
  async analyzeMarketMicrostructure(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<MarketMicrostructure> {
    const cacheKey = `microstructure:${symbol}:${exchange}`;
    
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached as MarketMicrostructure;
    }

    try {
      const orderBook = await ccxtService.fetchOrderBook(exchange, symbol, 100);
      const trades = await ccxtService.fetchTrades(exchange, symbol, 100);

      if (!orderBook || !trades || orderBook.bids.length === 0) {
        return this.createEmptyMicrostructure(symbol, exchange);
      }

      // Calculate order flow imbalance
      const buyCount = trades.filter(t => t.side === 'buy').length;
      const sellCount = trades.filter(t => t.side === 'sell').length;
      const totalTrades = buyCount + sellCount;
      const orderFlowImbalance = totalTrades > 0 
        ? ((buyCount - sellCount) / totalTrades) * 100 
        : 0;

      // Calculate price impact for $1M order
      const priceImpactEstimate = this.estimatePriceImpact(orderBook, 1000000);

      // Calculate effective spread (including market impact)
      const bid = orderBook.bids[0][0];
      const ask = orderBook.asks[0][0];
      const midPrice = (bid + ask) / 2;
      const spreadPercentage = ((ask - bid) / midPrice) * 100;
      const effectiveSpread = spreadPercentage + priceImpactEstimate;

      // Resilience indicator: based on bid-ask recovery after large trades
      const resilienceIndicator = this.calculateResilienceIndicator(orderBook, trades);

      // Determine microstructure quality
      const quality = this.assessMicrostructureQuality(
        effectiveSpread,
        priceImpactEstimate,
        resilienceIndicator
      );

      const microstructure: MarketMicrostructure = {
        symbol,
        exchange,
        timestamp: Date.now(),
        orderFlowImbalance,
        priceImpactEstimate,
        effectiveSpread,
        resilienceIndicator,
        microstructureQuality: quality
      };

      // Cache for 1 hour
      await cacheService.set(cacheKey, microstructure, 3600);

      return microstructure;
    } catch (error) {
      logger.error('Error analyzing market microstructure:', { symbol, exchange, error });
      return this.createEmptyMicrostructure(symbol, exchange);
    }
  }

  // ============ Private Helper Methods ============

  private async getSpreadHistory(
    symbol: string,
    exchange: string,
    timeWindow: number
  ): Promise<Array<{ timestamp: number; spread: number }>> {
    const cacheKey = `spread-history:${symbol}:${exchange}`;
    const history = await cacheService.get(cacheKey);
    
    if (history && Array.isArray(history)) {
      const cutoffTime = Date.now() - timeWindow;
      return history.filter(h => h.timestamp > cutoffTime);
    }
    
    return [];
  }

  private async getDepthHistory(
    symbol: string,
    exchange: string
  ): Promise<Array<{ timestamp: number; bidTotal: number; askTotal: number; imbalance: number }>> {
    const cacheKey = `depth-history:${symbol}:${exchange}`;
    const history = await cacheService.get(cacheKey);
    
    return history && Array.isArray(history) ? history : [];
  }

  private async getLiquidityHistory(
    symbol: string,
    exchange: string
  ): Promise<Array<{ timestamp: number; score: number; volume: number }>> {
    const cacheKey = `liquidity-history:${symbol}:${exchange}`;
    const history = await cacheService.get(cacheKey);
    
    return history && Array.isArray(history) ? history : [];
  }

  private calculateDepthLevels(orders: Array<[number, number]>): {
    level1: number;
    level2: number;
    level5: number;
    level10: number;
    total: number;
  } {
    if (orders.length === 0) {
      return { level1: 0, level2: 0, level5: 0, level10: 0, total: 0 };
    }

    const referencePrice = orders[0][0];
    let level1 = 0, level2 = 0, level5 = 0, level10 = 0, total = 0;

    for (const [price, volume] of orders) {
      const deviation = Math.abs((price - referencePrice) / referencePrice) * 100;
      const volumeValue = price * volume;

      total += volumeValue;
      if (deviation <= 0.5) level1 += volumeValue;
      if (deviation <= 1) level2 += volumeValue;
      if (deviation <= 5) level5 += volumeValue;
      if (deviation <= 10) level10 += volumeValue;
    }

    return { level1, level2, level5, level10, total };
  }

  private calculateLiquidityHealth(
    bidDepth: any,
    askDepth: any,
    imbalance: number
  ): number {
    let score = 50; // Base score

    // Depth score: more depth = higher score
    if (bidDepth.level5 > 0 && askDepth.level5 > 0) {
      score += 25;
    } else if (bidDepth.level2 > 0 && askDepth.level2 > 0) {
      score += 15;
    }

    // Imbalance score: balanced = higher score
    if (imbalance >= 0.8 && imbalance <= 1.2) {
      score += 25;
    } else if (imbalance >= 0.5 && imbalance <= 2) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  private estimatePriceImpact(orderBook: any, orderValue: number): number {
    let cumulativeVolume = 0;
    let cumulativeCost = 0;

    for (const [price, volume] of orderBook.asks) {
      const volumeAtPrice = Math.min(price * volume, orderValue - cumulativeCost);
      const volumeInUnits = volumeAtPrice / price;
      cumulativeCost += volumeAtPrice;
      cumulativeVolume += volumeInUnits;

      if (cumulativeCost >= orderValue) break;
    }

    if (cumulativeVolume > 0) {
      const averagePrice = cumulativeCost / cumulativeVolume;
      const midPrice = (orderBook.bids[0][0] + orderBook.asks[0][0]) / 2;
      return ((averagePrice - midPrice) / midPrice) * 100;
    }

    return 0.5; // Default estimate
  }

  private calculateResilienceIndicator(orderBook: any, trades: any[]): number {
    // Simplified: based on bid-ask spread and recent trade frequency
    const spread = ((orderBook.asks[0][0] - orderBook.bids[0][0]) / orderBook.bids[0][0]) * 100;
    const tradeFrequency = trades.length; // Recent trades

    // Lower spread + higher frequency = higher resilience
    const score = Math.max(0, 100 - (spread * 50) - (tradeFrequency / 2));
    return Math.min(score, 100);
  }

  private assessMicrostructureQuality(
    effectiveSpread: number,
    priceImpact: number,
    resilience: number
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    const quality = (100 - effectiveSpread * 100) * 0.4 + (100 - priceImpact * 100) * 0.3 + resilience * 0.3;

    if (quality >= 80) return 'excellent';
    if (quality >= 60) return 'good';
    if (quality >= 40) return 'fair';
    return 'poor';
  }

  private generateLiquidityRecommendations(
    depth: DepthAnalysis,
    trend: string,
    volumeTrend: string,
    volumeRatio: number
  ): string[] {
    const recommendations: string[] = [];

    if (trend === 'improving') {
      recommendations.push('Liquidity improving - good time for large orders');
    } else if (trend === 'degrading') {
      recommendations.push('Liquidity degrading - consider splitting orders or waiting');
    }

    if (volumeTrend === 'increasing' && volumeRatio > 1.5) {
      recommendations.push('Strong buy pressure - consider selling at resistance levels');
    } else if (volumeTrend === 'increasing' && volumeRatio < 0.67) {
      recommendations.push('Strong sell pressure - consider buying at support levels');
    }

    if (depth.liquidityHealth < 40) {
      recommendations.push('LOW LIQUIDITY: Use limit orders only, avoid market orders');
    }

    return recommendations.length > 0 ? recommendations : ['Market conditions neutral'];
  }

  // Empty/fallback objects

  private createEmptySpreadAnalysis(symbol: string, exchange: string): SpreadAnalysis {
    return {
      symbol,
      exchange,
      timestamp: Date.now(),
      currentSpread: 0,
      spreadTrend: 'stable',
      spreadHistory: [],
      averageSpread: 0,
      spreadVolatility: 0,
      tightestSpread: 0,
      widestSpread: 0
    };
  }

  private createEmptyDepthAnalysis(symbol: string, exchange: string): DepthAnalysis {
    return {
      symbol,
      exchange,
      timestamp: Date.now(),
      bidDepth: { level1: 0, level2: 0, level5: 0, level10: 0, total: 0 },
      askDepth: { level1: 0, level2: 0, level5: 0, level10: 0, total: 0 },
      depthTrend: 'stable',
      depthImbalance: 1,
      liquidityHealth: 50
    };
  }

  private createEmptyLiquidityTrend(symbol: string, exchange: string): LiquidityTrend {
    return {
      symbol,
      exchange,
      timeWindow: '24h',
      trend: 'stable',
      liquidityScore: 50,
      averageDailyVolume: 0,
      volumeTrend: 'stable',
      volumeIMbalance: { buyVolume: 0, sellVolume: 0, ratio: 1 },
      recommendations: ['Insufficient data']
    };
  }

  private createEmptyMicrostructure(symbol: string, exchange: string): MarketMicrostructure {
    return {
      symbol,
      exchange,
      timestamp: Date.now(),
      orderFlowImbalance: 0,
      priceImpactEstimate: 0.5,
      effectiveSpread: 0.2,
      resilienceIndicator: 50,
      microstructureQuality: 'fair'
    };
  }
}

export const marketAnalyticsService = MarketAnalyticsService.getInstance();
