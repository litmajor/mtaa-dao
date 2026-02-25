import { cacheService } from './cacheService';
import { ccxtService } from './ccxtService';
import { logger } from '../utils/logger';

// Futures market types
interface FundingRate {
  symbol: string;
  currentRate: number;
  nextTime: number;
  predictedRate: number;
  rateChange24h: number;
  historicalRates: Array<{ timestamp: number; rate: number }>;
  trend: 'bullish' | 'neutral' | 'bearish';
}

interface LiquidationData {
  symbol: string;
  totalLiquidations24h: number;
  bullishLiquidations: number;
  bearishLiquidations: number;
  largestLiquidation: number;
  avgLiquidationSize: number;
  liquidationCascade: boolean;
  cascadeSeverity: 'low' | 'medium' | 'high' | 'extreme';
  recentLiquidations: Array<{
    timestamp: number;
    price: number;
    amount: number;
    side: 'long' | 'short';
  }>;
}

interface OpenInterest {
  symbol: string;
  totalOpenInterest: number;
  longOpenInterest: number;
  shortOpenInterest: number;
  longShortRatio: number;
  openInterestTrend: 'increasing' | 'stable' | 'decreasing';
  openInterestChange24h: number;
  historicalOI: Array<{ timestamp: number; oi: number }>;
}

interface FundingRatePrediction {
  symbol: string;
  currentRate: number;
  predictedRate24h: number;
  predictedRate7d: number;
  confidence: number; // 0-100
  factors: {
    openInterestFactor: number;
    liquidationFactor: number;
    marketSentimentFactor: number;
    volatilityFactor: number;
  };
  recommendations: string[];
}

interface LiquidationRisk {
  symbol: string;
  symbol_price: number;
  liquidationLevel: number;
  percentToLiquidation: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  liquidationCascadeRisk: boolean;
  recommendation: string;
}

interface FuturesMarketHealth {
  symbol: string;
  fundingRateHealth: number; // 0-100
  liquidationRiskHealth: number; // 0-100
  openInterestHealth: number; // 0-100
  overallHealth: number; // 0-100
  assessment: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  recommendations: string[];
}

/**
 * Futures Market Support Service
 * Tracks funding rates, liquidations, open interest, and futures-specific metrics
 */
class FuturesMarketSupport {
  private fundingRateCache: Map<string, FundingRate> = new Map();
  private liquidationCache: Map<string, LiquidationData> = new Map();
  private openInterestCache: Map<string, OpenInterest> = new Map();
  private static instance: FuturesMarketSupport;

  private constructor() {}

  static getInstance(): FuturesMarketSupport {
    if (!FuturesMarketSupport.instance) {
      FuturesMarketSupport.instance = new FuturesMarketSupport();
    }
    return FuturesMarketSupport.instance;
  }

  /**
   * Get current funding rate with historical data
   */
  async getFundingRate(symbol: string, exchange: string = 'binance'): Promise<FundingRate> {
    const cacheKey = `funding-rate:${symbol}:${exchange}`;
    const cached = await cacheService.get<FundingRate>(cacheKey);
    if (cached) return cached;

    try {
      // Get current funding rate from exchange
      const fundingRate = await ccxtService.fetchFundingRate(symbol, exchange);
      const currentRate = fundingRate.fundingRate || 0;

      // Get historical rates (mock for now, would use real data)
      const historicalRates = this.generateHistoricalRates(currentRate);

      // Calculate 24h change
      const rateChange24h = currentRate - (historicalRates[0]?.rate || currentRate);

      // Predict next funding rate
      const predictedRate = this.predictFundingRate(currentRate, historicalRates);

      // Determine trend
      const trend =
        predictedRate > currentRate * 1.1
          ? 'bullish'
          : predictedRate < currentRate * 0.9
          ? 'bearish'
          : 'neutral';

      const result: FundingRate = {
        symbol,
        currentRate: currentRate * 100, // Convert to basis points
        nextTime: fundingRate.fundingTimestamp || Date.now() + 8 * 60 * 60 * 1000,
        predictedRate: predictedRate * 100,
        rateChange24h: rateChange24h * 100,
        historicalRates: historicalRates.map(r => ({
          timestamp: r.timestamp,
          rate: r.rate * 100
        })),
        trend
      };

      await cacheService.set<FundingRate>(cacheKey, result, 3600); // 1 hour TTL
      return result;
    } catch (error) {
      logger.error('Failed to fetch funding rate', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Get liquidation data and cascade detection
   */
  async getLiquidationData(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<LiquidationData> {
    const cacheKey = `liquidations:${symbol}:${exchange}`;
    const cached = await cacheService.get<LiquidationData>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch liquidation data
      const liquidations = await ccxtService.fetchLiquidations(symbol, exchange);

      // Calculate statistics
      const bullish = liquidations.filter((l: any) => l.side === 'long').length;
      const bearish = liquidations.filter((l: any) => l.side === 'short').length;
      const totalSize = liquidations.reduce((sum: number, l: any) => sum + l.amount, 0);
      const avgSize = liquidations.length > 0 ? totalSize / liquidations.length : 0;
      const largestSize = Math.max(...liquidations.map((l: any) => l.amount), 0);

      // Detect liquidation cascade
      const cascade = this.detectLiquidationCascade(liquidations);
      const cascadeSeverity = this.calculateCascadeSeverity(liquidations, cascade);

      // Get recent liquidations (last 100)
      const recentLiquidations = liquidations
        .slice(-100)
        .map((l: any) => ({
          timestamp: l.timestamp,
          price: l.price,
          amount: l.amount,
          side: l.side === 'buy' ? 'short' : 'long'
        }));

      const result: LiquidationData = {
        symbol,
        totalLiquidations24h: liquidations.length,
        bullishLiquidations: bullish,
        bearishLiquidations: bearish,
        largestLiquidation: largestSize,
        avgLiquidationSize: avgSize,
        liquidationCascade: cascade,
        cascadeSeverity,
        recentLiquidations
      };

      await cacheService.set<LiquidationData>(cacheKey, result, 1800); // 30 min TTL
      return result;
    } catch (error) {
      logger.error('Failed to fetch liquidation data', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Get open interest data
   */
  async getOpenInterest(symbol: string, exchange: string = 'binance'): Promise<OpenInterest> {
    const cacheKey = `open-interest:${symbol}:${exchange}`;
    const cached = await cacheService.get<OpenInterest>(cacheKey);
    if (cached) return cached;

    try {
      const oiData = await ccxtService.fetchOpenInterest(symbol, exchange);

      // Historical OI (mock data)
      const historicalOI = this.generateHistoricalOI(oiData.openInterest);

      // Calculate trend
      const prevOI = historicalOI[historicalOI.length - 1]?.oi || oiData.openInterest;
      const trend =
        oiData.openInterest > prevOI * 1.05
          ? 'increasing'
          : oiData.openInterest < prevOI * 0.95
          ? 'decreasing'
          : 'stable';

      const result: OpenInterest = {
        symbol,
        totalOpenInterest: oiData.openInterest,
        longOpenInterest: oiData.longOpenInterest || oiData.openInterest * 0.5,
        shortOpenInterest: oiData.shortOpenInterest || oiData.openInterest * 0.5,
        longShortRatio:
          oiData.shortOpenInterest > 0
            ? (oiData.longOpenInterest || oiData.openInterest * 0.5) /
              (oiData.shortOpenInterest || oiData.openInterest * 0.5)
            : 1,
        openInterestTrend: trend,
        openInterestChange24h: ((oiData.openInterest - prevOI) / prevOI) * 100,
        historicalOI
      };

      await cacheService.set<OpenInterest>(cacheKey, result, 3600); // 1 hour TTL
      return result;
    } catch (error) {
      logger.error('Failed to fetch open interest', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Predict funding rate based on historical data
   */
  async predictFundingRate(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<FundingRatePrediction> {
    try {
      const fundingRate = await this.getFundingRate(symbol, exchange);
      const openInterest = await this.getOpenInterest(symbol, exchange);
      const liquidations = await this.getLiquidationData(symbol, exchange);

      // Calculate prediction factors
      const oiFactor = (openInterest.openInterestChange24h / 100) * 0.3; // -1 to +1
      const liquidationFactor =
        ((liquidations.bulldishLiquidations - liquidations.bearishLiquidations) /
          liquidations.totalLiquidations24h) *
        0.2; // -1 to +1
      const sentimentFactor = (openInterest.longShortRatio - 1) * 0.3; // -1 to +1
      const volatilityFactor = (Math.random() - 0.5) * 0.2; // Random for now

      const totalFactor = oiFactor + liquidationFactor + sentimentFactor + volatilityFactor;
      const predictedRate24h = fundingRate.currentRate * (1 + totalFactor * 0.1);
      const predictedRate7d = fundingRate.currentRate * (1 + totalFactor * 0.05);

      const confidence = Math.min(100, Math.max(0, 70 - Math.abs(totalFactor) * 30));

      return {
        symbol,
        currentRate: fundingRate.currentRate,
        predictedRate24h,
        predictedRate7d,
        confidence,
        factors: {
          openInterestFactor: oiFactor,
          liquidationFactor,
          marketSentimentFactor: sentimentFactor,
          volatilityFactor
        },
        recommendations: this.generateFundingRateRecommendations(
          fundingRate.currentRate,
          predictedRate24h,
          confidence
        )
      };
    } catch (error) {
      logger.error('Failed to predict funding rate', { symbol, error });
      throw error;
    }
  }

  /**
   * Detect liquidation risk for a position
   */
  async detectLiquidationRisk(
    symbol: string,
    entryPrice: number,
    leverage: number = 1,
    exchange: string = 'binance'
  ): Promise<LiquidationRisk> {
    try {
      const ticker = await ccxtService.fetchTicker(symbol, exchange);
      const currentPrice = ticker.last;

      // Calculate liquidation price (assuming 5% maintenance margin)
      const liquidationPrice = entryPrice / (1 + leverage * 0.05);
      const percentToLiquidation = ((currentPrice - liquidationPrice) / currentPrice) * 100;

      // Assess risk level
      const riskLevel =
        percentToLiquidation < 2
          ? 'critical'
          : percentToLiquidation < 5
          ? 'high'
          : percentToLiquidation < 10
          ? 'medium'
          : 'low';

      // Check for cascade risk
      const liquidations = await this.getLiquidationData(symbol, exchange);
      const cascadeRisk = liquidations.liquidationCascade && liquidations.cascadeSeverity === 'high';

      return {
        symbol,
        symbol_price: currentPrice,
        liquidationLevel: liquidationPrice,
        percentToLiquidation,
        riskLevel,
        liquidationCascadeRisk: cascadeRisk,
        recommendation:
          riskLevel === 'critical'
            ? '🚨 CLOSE POSITION IMMEDIATELY - liquidation imminent'
            : riskLevel === 'high'
            ? '⚠️ HIGH RISK - consider reducing leverage or taking profit'
            : riskLevel === 'medium'
            ? '📊 Monitor closely - potential liquidation risk'
            : '✅ Safe margin level'
      };
    } catch (error) {
      logger.error('Failed to detect liquidation risk', { symbol, entryPrice, error });
      throw error;
    }
  }

  /**
   * Get overall futures market health
   */
  async getFuturesMarketHealth(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<FuturesMarketHealth> {
    try {
      const [fundingRate, liquidations, openInterest] = await Promise.all([
        this.getFundingRate(symbol, exchange),
        this.getLiquidationData(symbol, exchange),
        this.getOpenInterest(symbol, exchange)
      ]);

      // Calculate component health scores
      const fundingRateHealth = Math.max(
        0,
        100 - Math.abs(fundingRate.currentRate) * 100
      );

      const liquidationRiskHealth = Math.max(
        0,
        100 - (liquidations.totalLiquidations24h / 10) - (liquidations.cascadeSeverity === 'extreme' ? 50 : 0)
      );

      const openInterestHealth = Math.max(
        0,
        100 - Math.abs(openInterest.openInterestChange24h) * 5
      );

      const overallHealth = Math.round(
        (fundingRateHealth * 0.4 + liquidationRiskHealth * 0.35 + openInterestHealth * 0.25) *
          0.75
      );

      const assessment =
        overallHealth >= 75
          ? 'Excellent'
          : overallHealth >= 50
          ? 'Good'
          : overallHealth >= 25
          ? 'Fair'
          : 'Poor';

      return {
        symbol,
        fundingRateHealth,
        liquidationRiskHealth,
        openInterestHealth,
        overallHealth,
        assessment,
        recommendations: this.generateFuturesHealthRecommendations(
          fundingRate,
          liquidations,
          openInterest
        )
      };
    } catch (error) {
      logger.error('Failed to get futures market health', { symbol, exchange, error });
      throw error;
    }
  }

  // Helper methods

  private generateHistoricalRates(
    currentRate: number
  ): Array<{ timestamp: number; rate: number }> {
    const rates = [];
    for (let i = 8; i >= 0; i--) {
      rates.push({
        timestamp: Date.now() - i * 8 * 60 * 60 * 1000,
        rate: currentRate * (1 + (Math.random() - 0.5) * 0.2)
      });
    }
    return rates;
  }

  private generateHistoricalOI(
    currentOI: number
  ): Array<{ timestamp: number; oi: number }> {
    const oi = [];
    for (let i = 24; i >= 0; i--) {
      oi.push({
        timestamp: Date.now() - i * 60 * 60 * 1000,
        oi: currentOI * (1 + (Math.random() - 0.5) * 0.1)
      });
    }
    return oi;
  }

  private predictFundingRate(
    currentRate: number,
    historicalRates: Array<{ timestamp: number; rate: number }>
  ): number {
    if (historicalRates.length < 2) return currentRate;
    const trend = historicalRates[historicalRates.length - 1].rate - historicalRates[0].rate;
    return currentRate + trend * 0.5;
  }

  private detectLiquidationCascade(liquidations: any[]): boolean {
    // Cascade detected if many liquidations in short period
    const last10mins = liquidations.filter(
      l => Date.now() - l.timestamp < 10 * 60 * 1000
    );
    return last10mins.length > 5;
  }

  private calculateCascadeSeverity(
    liquidations: any[],
    cascade: boolean
  ): 'low' | 'medium' | 'high' | 'extreme' {
    if (!cascade) return 'low';

    const totalSize = liquidations.reduce((sum: number, l: any) => sum + l.amount, 0);
    const avgSize = totalSize / liquidations.length;
    const largestSize = Math.max(...liquidations.map((l: any) => l.amount));

    if (largestSize > avgSize * 100) return 'extreme';
    if (largestSize > avgSize * 50) return 'high';
    if (largestSize > avgSize * 20) return 'medium';
    return 'low';
  }

  private generateFundingRateRecommendations(
    current: number,
    predicted: number,
    confidence: number
  ): string[] {
    const recommendations: string[] = [];

    if (current > 0.05) {
      recommendations.push('High positive funding - good opportunity for shorts');
    } else if (current < -0.05) {
      recommendations.push('High negative funding - good opportunity for longs');
    }

    if (predicted > current * 1.2 && confidence > 70) {
      recommendations.push('Funding rate expected to increase - consider hedging');
    } else if (predicted < current * 0.8 && confidence > 70) {
      recommendations.push('Funding rate expected to decrease - reduce hedging');
    }

    if (confidence < 50) {
      recommendations.push('Low prediction confidence - monitor closely');
    }

    return recommendations;
  }

  private generateFuturesHealthRecommendations(
    fundingRate: FundingRate,
    liquidations: LiquidationData,
    openInterest: OpenInterest
  ): string[] {
    const recommendations: string[] = [];

    if (liquidations.cascadeSeverity === 'extreme') {
      recommendations.push('🚨 LIQUIDATION CRISIS - extreme volatility risk');
    } else if (liquidations.cascadeSeverity === 'high') {
      recommendations.push('⚠️ HIGH LIQUIDATION ACTIVITY - reduce leverage');
    }

    if (fundingRate.trend === 'bullish') {
      recommendations.push('Bullish funding rate trend - favorable for longs');
    } else if (fundingRate.trend === 'bearish') {
      recommendations.push('Bearish funding rate trend - favorable for shorts');
    }

    if (openInterest.openInterestChange24h > 20) {
      recommendations.push('Rapid OI increase - may indicate trend formation');
    } else if (openInterest.openInterestChange24h < -20) {
      recommendations.push('OI declining - potentially reversal warning');
    }

    return recommendations;
  }
}

export const futuresMarketSupport = FuturesMarketSupport.getInstance();

export type {
  FundingRate,
  LiquidationData,
  OpenInterest,
  FundingRatePrediction,
  LiquidationRisk,
  FuturesMarketHealth
};
