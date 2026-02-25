import { cacheService } from './cacheService';
import { ccxtService } from './ccxtService';
import { ohlcvService } from './ohlcvService';
import { logger } from '../utils/logger';

/**
 * Volatility Metrics Service
 * Calculates historical and real-time volatility metrics for risk analysis
 * Supports multiple time windows: 1h, 4h, 24h, 7d
 */

export interface VolatilityMetrics {
  symbol: string;
  timestamp: number;
  period: '1h' | '4h' | '24h' | '7d';
  volatility: number;                    // Percentage
  historicalVolatility: number;          // Standard deviation
  volatilityTrend: 'increasing' | 'stable' | 'decreasing';
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  priceRange: { min: number; max: number };
  averagePrice: number;
  volatilityIndex: number;               // 0-100 score
}

export interface RiskAnalysis {
  symbol: string;
  riskLevel: string;
  riskScore: number;                     // 0-100
  factors: {
    volatilityFactor: number;            // 0-40
    liquidityFactor: number;             // 0-30
    spreadFactor: number;                // 0-20
    correlationFactor: number;           // 0-10
  };
  recommendations: string[];
  maxRecommendedOrderSize: number;       // In base currency
  optimalExecutionTime: string;
}

export interface VolatilityTrend {
  symbol: string;
  currentVolatility: number;
  averageVolatility: number;
  lastWeekTrend: 'increasing' | 'stable' | 'decreasing';
  volatilityComparison: {
    vs24hAverage: number;                // Percentage difference
    vs7dAverage: number;
    vs30dAverage: number;
  };
  extremeEvents: Array<{
    timestamp: number;
    priceChange: number;                 // Percentage
    volatility: number;
    duration: number;                    // Milliseconds
  }>;
}

class VolatilityMetricsService {
  private static instance: VolatilityMetricsService;

  private constructor() {}

  static getInstance(): VolatilityMetricsService {
    if (!VolatilityMetricsService.instance) {
      VolatilityMetricsService.instance = new VolatilityMetricsService();
    }
    return VolatilityMetricsService.instance;
  }

  /**
   * Calculate volatility for a symbol over specified period
   * Uses standard deviation of logarithmic returns
   */
  async calculateVolatility(
    symbol: string,
    period: '1h' | '4h' | '24h' | '7d' = '24h',
    exchange: string = 'binance'
  ): Promise<VolatilityMetrics> {
    const cacheKey = `volatility:${symbol}:${period}:${exchange}`;
    
    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached as VolatilityMetrics;
    }

    try {
      // Determine timeframe for OHLCV call
      const timeframeMap = {
        '1h': '1h',
        '4h': '4h',
        '24h': '1d',
        '7d': '1w'
      };

      const timeframe = timeframeMap[period];
      const limit = {
        '1h': 60,      // 60 candles = 1 hour worth of 1-min data
        '4h': 240,     // 240 min candles
        '24h': 24,     // 24 hourly candles
        '7d': 7        // 7 daily candles
      }[period];

      // Fetch OHLCV data from unified OHLCV service
      const ohlcvResponse = await ohlcvService.getCandles(symbol, timeframe, limit, exchange);

      if (!ohlcvResponse || ohlcvResponse.status === 'error' || !ohlcvResponse.data || ohlcvResponse.data.length < 2) {
        logger.warn(`No OHLCV data for ${symbol}/${timeframe}: ${ohlcvResponse?.error || 'empty response'}`);
        return this.createEmptyVolatilityMetrics(symbol, period);
      }

      // Extract closing prices from OHLCV candles
      const closingPrices = ohlcvResponse.data.map(candle => candle.close);

      // Calculate log returns
      const logReturns: number[] = [];
      for (let i = 1; i < closingPrices.length; i++) {
        const logReturn = Math.log(closingPrices[i] / closingPrices[i - 1]);
        logReturns.push(logReturn);
      }

      // Calculate standard deviation (volatility)
      const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
      const squaredDiffs = logReturns.map(r => Math.pow(r - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / logReturns.length;
      const historicalVolatility = Math.sqrt(variance) * 100; // Convert to percentage

      // Get trend over period
      const firstPrice = closingPrices[0];
      const lastPrice = closingPrices[closingPrices.length - 1];
      const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
      
      const volatilityTrend =
        historicalVolatility > mean * 1.2 ? 'increasing' :
        historicalVolatility < mean * 0.8 ? 'decreasing' :
        'stable';

      // Determine risk level
      const riskLevel = this.calculateRiskLevel(historicalVolatility);

      // Calculate volatility index (0-100 scale)
      const volatilityIndex = Math.min(historicalVolatility * 2, 100);

      const metrics: VolatilityMetrics = {
        symbol,
        timestamp: Date.now(),
        period,
        volatility: historicalVolatility,
        historicalVolatility,
        volatilityTrend,
        riskLevel,
        priceRange: {
          min: Math.min(...closingPrices),
          max: Math.max(...closingPrices)
        },
        averagePrice: closingPrices.reduce((a, b) => a + b, 0) / closingPrices.length,
        volatilityIndex
      };

      // Cache with TTL (1 hour for 24h data, 4 hours for 7d data)
      const ttl = period === '7d' ? 14400 : 3600;
      await cacheService.set(cacheKey, metrics, ttl);

      return metrics;
    } catch (error) {
      logger.error('Error calculating volatility:', { symbol, period, error });
      return this.createEmptyVolatilityMetrics(symbol, period);
    }
  }

  /**
   * Analyze risk based on volatility and market conditions
   */
  async analyzeRisk(
    symbol: string,
    desiredOrderSize: number,
    exchange: string = 'binance'
  ): Promise<RiskAnalysis> {
    const cacheKey = `risk:${symbol}:${desiredOrderSize}`;
    
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached as RiskAnalysis;
    }

    try {
      // Get volatility metrics
      const volatility = await this.calculateVolatility(symbol, '24h', exchange);
      
      // Get order book for liquidity assessment
      const orderBook = await ccxtService.fetchOrderBook(exchange, symbol, 50);
      
      // Calculate factors
      const volatilityFactor = Math.min(volatility.volatilityIndex * 0.4, 40);
      
      // Liquidity factor: based on order book depth
      const totalBidVolume = orderBook.bids.reduce((sum, bid) => sum + (bid[0] * bid[1]), 0);
      const liquidityFactor = Math.max(0, Math.min(30, 30 - (desiredOrderSize / totalBidVolume) * 100));
      
      // Spread factor: impact of bid-ask spread
      if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
        const bid = orderBook.bids[0][0];
        const ask = orderBook.asks[0][0];
        const spread = ((ask - bid) / bid) * 100;
        var spreadFactor = Math.min(spread * 10, 20);
      } else {
        var spreadFactor = 20;
      }
      
      // Correlation factor (simplified - in production, use actual correlation data)
      const correlationFactor = 5; // Base correlation risk
      
      const riskScore = volatilityFactor + liquidityFactor + spreadFactor + correlationFactor;

      // Calculate maximum recommended order size (80% of available liquidity at low impact)
      const maxOrderSize = totalBidVolume * 0.8;

      // Determine optimal execution time (low volatility periods)
      const optimalTime = this.determineOptimalExecutionTime(volatility);

      // Generate recommendations
      const recommendations = this.generateRiskRecommendations(
        volatility,
        riskScore,
        desiredOrderSize,
        maxOrderSize
      );

      const analysis: RiskAnalysis = {
        symbol,
        riskLevel: volatility.riskLevel,
        riskScore: Math.min(riskScore, 100),
        factors: {
          volatilityFactor,
          liquidityFactor,
          spreadFactor,
          correlationFactor
        },
        recommendations,
        maxRecommendedOrderSize: maxOrderSize,
        optimalExecutionTime: optimalTime
      };

      // Cache for 30 minutes
      await cacheService.set(cacheKey, analysis, 1800);

      return analysis;
    } catch (error) {
      logger.error('Error analyzing risk:', { symbol, error });
      return {
        symbol,
        riskLevel: 'high',
        riskScore: 75,
        factors: { volatilityFactor: 30, liquidityFactor: 25, spreadFactor: 15, correlationFactor: 5 },
        recommendations: ['Unable to analyze risk - default high caution recommended'],
        maxRecommendedOrderSize: 0,
        optimalExecutionTime: 'Unable to determine'
      };
    }
  }

  /**
   * Get volatility trends over time
   */
  async getVolatilityTrends(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<VolatilityTrend> {
    const cacheKey = `vol-trend:${symbol}`;
    
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached as VolatilityTrend;
    }

    try {
      const vol1h = await this.calculateVolatility(symbol, '1h', exchange);
      const vol4h = await this.calculateVolatility(symbol, '4h', exchange);
      const vol24h = await this.calculateVolatility(symbol, '24h', exchange);
      const vol7d = await this.calculateVolatility(symbol, '7d', exchange);

      const currentVolatility = vol24h.volatility;
      const averageVolatility = (vol1h.volatility + vol4h.volatility + vol24h.volatility + vol7d.volatility) / 4;

      const trend =
        currentVolatility > averageVolatility * 1.3 ? 'increasing' :
        currentVolatility < averageVolatility * 0.7 ? 'decreasing' :
        'stable';

      // Calculate extreme events (volatility spikes)
      const extremeEvents = this.detectExtremeEvents(vol1h, vol4h, vol24h);

      const volatilityTrend: VolatilityTrend = {
        symbol,
        currentVolatility,
        averageVolatility,
        lastWeekTrend: vol7d.volatilityTrend,
        volatilityComparison: {
          vs24hAverage: ((currentVolatility - vol24h.volatility) / vol24h.volatility) * 100,
          vs7dAverage: ((currentVolatility - vol7d.volatility) / vol7d.volatility) * 100,
          vs30dAverage: 0 // Placeholder; implement with historical data
        },
        extremeEvents
      };

      // Cache for 2 hours
      await cacheService.set(cacheKey, volatilityTrend, 7200);

      return volatilityTrend;
    } catch (error) {
      logger.error('Error getting volatility trends:', { symbol, error });
      return {
        symbol,
        currentVolatility: 0,
        averageVolatility: 0,
        lastWeekTrend: 'stable',
        volatilityComparison: { vs24hAverage: 0, vs7dAverage: 0, vs30dAverage: 0 },
        extremeEvents: []
      };
    }
  }

  /**
   * Volatility-adjusted slippage estimation
   */
  async estimateSlippageWithVolatility(
    symbol: string,
    orderSize: number,
    exchange: string = 'binance'
  ): Promise<{
    baseSlippage: number;
    volatilityAdjustment: number;
    totalEstimatedSlippage: number;
    confidence: number;
  }> {
    try {
      const volatility = await this.calculateVolatility(symbol, '24h', exchange);
      const orderBook = await ccxtService.fetchOrderBook(exchange, symbol, 50);

      // Base slippage from order book depth
      const baseSlippage = this.calculateBaseSlippage(orderBook, orderSize);

      // Volatility adjustment: higher volatility = higher slippage risk
      const volatilityAdjustment = volatility.volatility * 0.5; // 50% of volatility adds to slippage

      // Confidence: how sure we are about this estimate
      const confidence = Math.max(0, 100 - (volatility.volatilityIndex * 0.5));

      return {
        baseSlippage,
        volatilityAdjustment,
        totalEstimatedSlippage: baseSlippage + volatilityAdjustment,
        confidence
      };
    } catch (error) {
      logger.error('Error estimating slippage with volatility:', { symbol, error });
      return {
        baseSlippage: 0.5,
        volatilityAdjustment: 0.2,
        totalEstimatedSlippage: 0.7,
        confidence: 30
      };
    }
  }

  // ============ Private Helper Methods ============

  private calculateRiskLevel(volatility: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (volatility < 1) return 'low';
    if (volatility < 3) return 'medium';
    if (volatility < 8) return 'high';
    return 'extreme';
  }

  private determineOptimalExecutionTime(metrics: VolatilityMetrics): string {
    if (metrics.riskLevel === 'low') {
      return 'Anytime (low volatility)';
    }
    if (metrics.riskLevel === 'medium') {
      return 'During standard market hours (08:00-17:00 UTC)';
    }
    if (metrics.riskLevel === 'high') {
      return 'Wait for volatility decline or execute in small batches';
    }
    return 'Do not execute - extreme volatility detected';
  }

  private generateRiskRecommendations(
    volatility: VolatilityMetrics,
    riskScore: number,
    desiredSize: number,
    maxSize: number
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore > 80) {
      recommendations.push('HIGH RISK: Consider reducing order size or waiting for more stable market');
    }

    if (volatility.volatilityIndex > 60) {
      recommendations.push(`Consider splitting order into 3-5 smaller batches to reduce market impact`);
    }

    if (desiredSize > maxSize * 0.8) {
      recommendations.push(`Order size is 80%+ of recommended max (${maxSize.toFixed(2)}). Consider reducing.`);
    }

    if (volatility.riskLevel === 'extreme') {
      recommendations.push('Extreme volatility detected. Use limit orders instead of market orders.');
    }

    if (riskScore < 40) {
      recommendations.push('Market conditions favorable. Safe to execute full order size.');
    }

    return recommendations;
  }

  private calculateBaseSlippage(orderBook: any, orderSize: number): number {
    let cumulativeVolume = 0;
    let cumulativeCost = 0;
    let slippagePercentage = 0;

    for (const [price, volume] of orderBook.asks) {
      if (cumulativeVolume >= orderSize) break;

      const volumeAtPrice = Math.min(volume, orderSize - cumulativeVolume);
      cumulativeCost += price * volumeAtPrice;
      cumulativeVolume += volumeAtPrice;
    }

    if (cumulativeVolume > 0) {
      const averagePrice = cumulativeCost / cumulativeVolume;
      const spreadPrice = (orderBook.asks[0][0] + orderBook.bids[0][0]) / 2;
      slippagePercentage = ((averagePrice - spreadPrice) / spreadPrice) * 100;
    }

    return Math.max(slippagePercentage, 0);
  }

  private detectExtremeEvents(
    vol1h: VolatilityMetrics,
    vol4h: VolatilityMetrics,
    vol24h: VolatilityMetrics
  ): Array<{ timestamp: number; priceChange: number; volatility: number; duration: number }> {
    const events = [];

    // Detect volatility spikes (1h volatility > 1.5x average)
    const avgVolatility = (vol1h.volatility + vol4h.volatility + vol24h.volatility) / 3;
    
    if (vol1h.volatility > avgVolatility * 1.5) {
      events.push({
        timestamp: vol1h.timestamp,
        priceChange: 0, // Placeholder
        volatility: vol1h.volatility,
        duration: 3600000 // 1 hour in milliseconds
      });
    }

    if (vol4h.volatility > avgVolatility * 1.3) {
      events.push({
        timestamp: vol4h.timestamp,
        priceChange: 0,
        volatility: vol4h.volatility,
        duration: 14400000 // 4 hours
      });
    }

    return events;
  }

  private createEmptyVolatilityMetrics(symbol: string, period: '1h' | '4h' | '24h' | '7d'): VolatilityMetrics {
    return {
      symbol,
      timestamp: Date.now(),
      period,
      volatility: 0,
      historicalVolatility: 0,
      volatilityTrend: 'stable',
      riskLevel: 'medium',
      priceRange: { min: 0, max: 0 },
      averagePrice: 0,
      volatilityIndex: 50
    };
  }
}

export const volatilityMetricsService = VolatilityMetricsService.getInstance();
