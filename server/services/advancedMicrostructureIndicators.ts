import { cacheService } from './cacheService';
import { ccxtService } from './ccxtService';
import { logger } from '../utils/logger';

// Advanced microstructure types
interface OrderFlowImbalance {
  symbol: string;
  timestamp: number;
  buyVolume: number;
  sellVolume: number;
  imbalance: number; // -100 to +100
  imbalanceRatio: number;
  trend: 'buying' | 'balanced' | 'selling';
  strength: 'weak' | 'moderate' | 'strong';
}

interface VolatilityOfVolatility {
  symbol: string;
  timestamp: number;
  currentVolatility: number;
  volatilityOfVolatility: number; // vol of vol
  volatilityRegime: 'low' | 'normal' | 'high' | 'extreme';
  skew: number; // measure of asymmetry
  kurtosis: number; // measure of tail risk
}

interface OrderBookToxicity {
  symbol: string;
  timestamp: number;
  toxicity: number; // 0-100
  adverseSelectionIndicator: number; // 0-100
  inventoryRiskIndicator: number; // 0-100
  informationAsymmetry: number; // 0-100
  assessment: 'healthy' | 'moderate' | 'toxic' | 'severely_toxic';
  recommendation: string;
}

interface PriceImpactAnalysis {
  symbol: string;
  timestamp: number;
  shortTermImpact: number; // %, immediate
  mediumTermImpact: number; // %, 1 min
  longTermImpact: number; // %, 5 min
  recoveryTime: number; // ms
  resilience: number; // 0-100
  liquidityDepth: number; // USD in order book
}

interface MarketMicrostructureIndicators {
  symbol: string;
  timestamp: number;
  orderFlowImbalance: OrderFlowImbalance;
  volatilityOfVolatility: VolatilityOfVolatility;
  orderBookToxicity: OrderBookToxicity;
  priceImpact: PriceImpactAnalysis;
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
}

interface AdvancedMicrostructureAlert {
  symbol: string;
  type: 'imbalance' | 'toxicity' | 'volatility' | 'impact' | 'cascade';
  severity: 'info' | 'warning' | 'alert' | 'critical';
  message: string;
  timestamp: number;
  actionable: boolean;
}

/**
 * Advanced Market Microstructure Indicators Service
 * Provides real-time order flow analysis, toxicity detection, and market quality assessment
 */
class AdvancedMicrostructureIndicators {
  private historicalVolatility: Map<string, number[]> = new Map();
  private historicalImbalance: Map<string, number[]> = new Map();
  private alerts: Map<string, AdvancedMicrostructureAlert[]> = new Map();
  private static instance: AdvancedMicrostructureIndicators;

  private constructor() {}

  static getInstance(): AdvancedMicrostructureIndicators {
    if (!AdvancedMicrostructureIndicators.instance) {
      AdvancedMicrostructureIndicators.instance = new AdvancedMicrostructureIndicators();
    }
    return AdvancedMicrostructureIndicators.instance;
  }

  /**
   * Analyze real-time order flow imbalance
   */
  async analyzeOrderFlowImbalance(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<OrderFlowImbalance> {
    const cacheKey = `order-flow-imbalance:${symbol}:${exchange}`;
    const cached = await cacheService.get<OrderFlowImbalance>(cacheKey);
    if (cached) return cached;

    try {
      const trades = await ccxtService.fetchTrades(symbol, exchange, 100);

      // Calculate buy vs sell volume
      const buyVolume = trades
        .filter((t: any) => t.side === 'buy')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const sellVolume = trades
        .filter((t: any) => t.side === 'sell')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const totalVolume = buyVolume + sellVolume;
      const imbalance = ((buyVolume - sellVolume) / totalVolume) * 100;
      const imbalanceRatio = sellVolume > 0 ? buyVolume / sellVolume : 1;

      // Determine trend
      let trend: 'buying' | 'balanced' | 'selling';
      if (imbalance > 10) trend = 'buying';
      else if (imbalance < -10) trend = 'selling';
      else trend = 'balanced';

      // Assess strength
      let strength: 'weak' | 'moderate' | 'strong';
      if (Math.abs(imbalance) < 5) strength = 'weak';
      else if (Math.abs(imbalance) < 20) strength = 'moderate';
      else strength = 'strong';

      const result: OrderFlowImbalance = {
        symbol,
        timestamp: Date.now(),
        buyVolume,
        sellVolume,
        imbalance,
        imbalanceRatio,
        trend,
        strength
      };

      // Track historical data
      this.trackHistoricalImbalance(symbol, imbalance);

      await cacheService.set<OrderFlowImbalance>(cacheKey, result, 300); // 5 min TTL
      return result;
    } catch (error) {
      logger.error('Failed to analyze order flow imbalance', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Calculate volatility of volatility (vol of vol)
   */
  async calculateVolatilityOfVolatility(
    symbol: string,
    exchange: string = 'binance',
    periods: number = 24
  ): Promise<VolatilityOfVolatility> {
    const cacheKey = `vol-of-vol:${symbol}:${exchange}`;
    const cached = await cacheService.get<VolatilityOfVolatility>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch OHLCV data
      const ohlcv = await ccxtService.fetchOHLCV(symbol, exchange, '1h', periods);

      // Calculate returns and volatilities
      const returns = [];
      const volatilities = [];

      for (let i = 1; i < ohlcv.length; i++) {
        const ret = Math.log(ohlcv[i][4] / ohlcv[i - 1][4]); // log close return
        returns.push(ret);

        // Calculate rolling IV
        if (i >= 5) {
          const windowReturns = returns.slice(-5);
          const mean = windowReturns.reduce((a, b) => a + b) / windowReturns.length;
          const variance = windowReturns.reduce((a, b) => a + Math.pow(b - mean, 2)) / windowReturns.length;
          const volatility = Math.sqrt(variance);
          volatilities.push(volatility);
        }
      }

      // Calculate vol of vol
      const meanVol = volatilities.reduce((a, b) => a + b) / volatilities.length;
      const volOfVolVariance = volatilities.reduce((a, b) => a + Math.pow(b - meanVol, 2)) / volatilities.length;
      const volOfVol = Math.sqrt(volOfVolVariance);

      // Calculate skew (3rd moment)
      const skew = this.calculateSkew(returns);

      // Calculate kurtosis (4th moment)
      const kurtosis = this.calculateKurtosis(returns);

      // Determine volatility regime
      const currentVol = Math.sqrt(
        returns.reduce((a, b) => a + Math.pow(b, 2)) / returns.length
      );

      let regime: 'low' | 'normal' | 'high' | 'extreme';
      if (currentVol < meanVol * 0.5) regime = 'low';
      else if (currentVol < meanVol) regime = 'normal';
      else if (currentVol < meanVol * 1.5) regime = 'high';
      else regime = 'extreme';

      const result: VolatilityOfVolatility = {
        symbol,
        timestamp: Date.now(),
        currentVolatility: currentVol * 100, // as %
        volatilityOfVolatility: volOfVol * 100,
        volatilityRegime: regime,
        skew: skew * 100,
        kurtosis: kurtosis * 100
      };

      // Track historical volatility
      this.trackHistoricalVolatility(symbol, currentVol * 100);

      await cacheService.set<VolatilityOfVolatility>(cacheKey, result, 3600); // 1 hour TTL
      return result;
    } catch (error) {
      logger.error('Failed to calculate volatility of volatility', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Detect order book toxicity
   */
  async detectOrderBookToxicity(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<OrderBookToxicity> {
    const cacheKey = `order-book-toxicity:${symbol}:${exchange}`;
    const cached = await cacheService.get<OrderBookToxicity>(cacheKey);
    if (cached) return cached;

    try {
      const [orderBook, trades, currentTicker] = await Promise.all([
        ccxtService.fetchOrderBook(symbol, exchange, 50),
        ccxtService.fetchTrades(symbol, exchange, 50),
        ccxtService.fetchTicker(symbol, exchange)
      ]);

      // Calculate adverse selection indicator
      const spreadBps = ((currentTicker.ask - currentTicker.bid) / currentTicker.mid) * 10000;
      const adverseSelectionIndicator = Math.min(100, spreadBps / 2); // Normalize to 0-100

      // Calculate inventory risk indicator
      const bidDepth = this.calculateDepth(orderBook.bids, 100000); // USD at bid side
      const askDepth = this.calculateDepth(orderBook.asks, 100000); // USD at ask side
      const imbalancedepth = Math.abs(bidDepth - askDepth) / (bidDepth + askDepth);
      const inventoryRiskIndicator = imbalancedepth * 100; // 0-100

      // Calculate information asymmetry
      const recentTrades = trades.slice(-20);
      const buyTrades = recentTrades.filter((t: any) => t.side === 'buy').length;
      const informationAsymmetry = Math.abs(buyTrades - 10) * 10; // 0-100

      // Calculate overall toxicity
      const toxicity = Math.round(
        (adverseSelectionIndicator * 0.4 +
          inventoryRiskIndicator * 0.35 +
          informationAsymmetry * 0.25) *
          0.75
      );

      // Assess toxicity
      let assessment: 'healthy' | 'moderate' | 'toxic' | 'severely_toxic';
      if (toxicity < 25) assessment = 'healthy';
      else if (toxicity < 50) assessment = 'moderate';
      else if (toxicity < 75) assessment = 'toxic';
      else assessment = 'severely_toxic';

      const recommendation =
        assessment === 'healthy'
          ? '✅ Order book health: excellent'
          : assessment === 'moderate'
          ? '📊 Moderate toxicity - execute with caution'
          : assessment === 'toxic'
          ? '⚠️ High toxicity - consider smaller orders'
          : '🚨 Severe toxicity - avoid large trades';

      const result: OrderBookToxicity = {
        symbol,
        timestamp: Date.now(),
        toxicity,
        adverseSelectionIndicator,
        inventoryRiskIndicator,
        informationAsymmetry,
        assessment,
        recommendation
      };

      await cacheService.set<OrderBookToxicity>(cacheKey, result, 300); // 5 min TTL
      return result;
    } catch (error) {
      logger.error('Failed to detect order book toxicity', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Analyze price impact dynamics
   */
  async analyzePriceImpact(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<PriceImpactAnalysis> {
    const cacheKey = `price-impact:${symbol}:${exchange}`;
    const cached = await cacheService.get<PriceImpactAnalysis>(cacheKey);
    if (cached) return cached;

    try {
      const [orderBook, trades, ticker] = await Promise.all([
        ccxtService.fetchOrderBook(symbol, exchange, 100),
        ccxtService.fetchTrades(symbol, exchange, 100),
        ccxtService.fetchTicker(symbol, exchange)
      ]);

      // Calculate immediate impact
      const mid = ticker.mid;
      const bidWAP = this.calculateWeightedAveragePrice(orderBook.bids);
      const askWAP = this.calculateWeightedAveragePrice(orderBook.asks);
      const shortTermImpact = Math.abs(askWAP - mid) / mid * 100; // %

      // Calculate medium-term impact (1 min based on recent trades)
      const mediumTermTrades = trades.filter((t: any) => Date.now() - t.timestamp < 60000);
      const mediumTermImpact = this.calculatePriceRecovery(mediumTermTrades, 'medium') * 100;

      // Calculate long-term impact (5 min)
      const longTermTrades = trades.filter((t: any) => Date.now() - t.timestamp < 300000);
      const longTermImpact = this.calculatePriceRecovery(longTermTrades, 'long') * 100;

      // Calculate recovery time
      const recoveryTime = this.estimateRecoveryTime(trades);

      // Calculate resilience (0-100, higher = more resilient)
      const resilience = Math.max(0, 100 - (shortTermImpact + mediumTermImpact) * 10);

      // Calculate liquidity depth
      const liquidityDepth = this.calculateDepth(orderBook.asks, 1000000);

      const result: PriceImpactAnalysis = {
        symbol,
        timestamp: Date.now(),
        shortTermImpact,
        mediumTermImpact,
        longTermImpact,
        recoveryTime,
        resilience,
        liquidityDepth
      };

      await cacheService.set<PriceImpactAnalysis>(cacheKey, result, 300); // 5 min TTL
      return result;
    } catch (error) {
      logger.error('Failed to analyze price impact', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Get comprehensive market microstructure indicators
   */
  async getComprehensiveMicrostructure(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<MarketMicrostructureIndicators> {
    try {
      const [orderFlow, volOfVol, toxicity, priceImpact] = await Promise.all([
        this.analyzeOrderFlowImbalance(symbol, exchange),
        this.calculateVolatilityOfVolatility(symbol, exchange),
        this.detectOrderBookToxicity(symbol, exchange),
        this.analyzePriceImpact(symbol, exchange)
      ]);

      // Calculate overall quality
      const qualityScore = Math.round(
        (100 - toxicity.toxicity) * 0.4 + // Lower toxicity is better
          priceImpact.resilience * 0.3 + // Higher resilience is better
          (100 - Math.abs(orderFlow.imbalance)) * 0.3 // Balanced flow is better
      );

      let overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
      if (qualityScore >= 80) overallQuality = 'excellent';
      else if (qualityScore >= 60) overallQuality = 'good';
      else if (qualityScore >= 40) overallQuality = 'fair';
      else overallQuality = 'poor';

      const recommendations = this.generateMicrostructureRecommendations(
        orderFlow,
        volOfVol,
        toxicity,
        priceImpact
      );

      return {
        symbol,
        timestamp: Date.now(),
        orderFlowImbalance: orderFlow,
        volatilityOfVolatility: volOfVol,
        orderBookToxicity: toxicity,
        priceImpact,
        overallQuality,
        recommendations
      };
    } catch (error) {
      logger.error('Failed to get comprehensive microstructure', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Generate trading alerts based on microstructure signals
   */
  async generateMicrostructureAlerts(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<AdvancedMicrostructureAlert[]> {
    try {
      const indicators = await this.getComprehensiveMicrostructure(symbol, exchange);
      const alerts: AdvancedMicrostructureAlert[] = [];

      // Check for extreme order flow imbalance
      if (Math.abs(indicators.orderFlowImbalance.imbalance) > 40) {
        alerts.push({
          symbol,
          type: 'imbalance',
          severity: Math.abs(indicators.orderFlowImbalance.imbalance) > 60 ? 'critical' : 'alert',
          message: `Extreme ${indicators.orderFlowImbalance.trend} - ${Math.abs(indicators.orderFlowImbalance.imbalance).toFixed(1)}% imbalance`,
          timestamp: Date.now(),
          actionable: true
        });
      }

      // Check for high toxicity
      if (indicators.orderBookToxicity.toxicity > 70) {
        alerts.push({
          symbol,
          type: 'toxicity',
          severity: indicators.orderBookToxicity.toxicity > 85 ? 'critical' : 'alert',
          message: `Order book toxicity high: ${indicators.orderBookToxicity.assessment}`,
          timestamp: Date.now(),
          actionable: true
        });
      }

      // Check for extreme volatility regime
      if (indicators.volatilityOfVolatility.volatilityRegime === 'extreme') {
        alerts.push({
          symbol,
          type: 'volatility',
          severity: 'critical',
          message: 'Extreme volatility regime detected - sharp price moves likely',
          timestamp: Date.now(),
          actionable: true
        });
      }

      // Check for high price impact
      if (indicators.priceImpact.shortTermImpact > 0.5) {
        alerts.push({
          symbol,
          type: 'impact',
          severity: indicators.priceImpact.shortTermImpact > 1.0 ? 'critical' : 'warning',
          message: `High price impact: ${indicators.priceImpact.shortTermImpact.toFixed(2)}%`,
          timestamp: Date.now(),
          actionable: true
        });
      }

      // Store alerts
      this.alerts.set(symbol, alerts);
      return alerts;
    } catch (error) {
      logger.error('Failed to generate microstructure alerts', { symbol, exchange, error });
      throw error;
    }
  }

  // Helper methods

  private trackHistoricalVolatility(symbol: string, volatility: number): void {
    if (!this.historicalVolatility.has(symbol)) {
      this.historicalVolatility.set(symbol, []);
    }
    const history = this.historicalVolatility.get(symbol)!;
    history.push(volatility);
    if (history.length > 1000) history.shift(); // Keep last 1000
  }

  private trackHistoricalImbalance(symbol: string, imbalance: number): void {
    if (!this.historicalImbalance.has(symbol)) {
      this.historicalImbalance.set(symbol, []);
    }
    const history = this.historicalImbalance.get(symbol)!;
    history.push(imbalance);
    if (history.length > 1000) history.shift(); // Keep last 1000
  }

  private calculateSkew(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const n = returns.length;
    const m3 = returns.reduce((a, b) => a + Math.pow(b - mean, 3)) / n;
    const m2 = returns.reduce((a, b) => a + Math.pow(b - mean, 2)) / n;
    const sd = Math.sqrt(m2);
    return m3 / Math.pow(sd, 3);
  }

  private calculateKurtosis(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const n = returns.length;
    const m4 = returns.reduce((a, b) => a + Math.pow(b - mean, 4)) / n;
    const m2 = returns.reduce((a, b) => a + Math.pow(b - mean, 2)) / n;
    return m4 / Math.pow(m2, 2) - 3;
  }

  private calculateDepth(orderBook: any[], targetUSD: number): number {
    let accumulated = 0;
    for (const [price, volume] of orderBook) {
      accumulated += price * volume;
      if (accumulated >= targetUSD) return price;
    }
    return orderBook[orderBook.length - 1]?.[0] || 0;
  }

  private calculateWeightedAveragePrice(orderBook: any[]): number {
    let totalCost = 0;
    let totalVolume = 0;
    for (const [price, volume] of orderBook) {
      totalCost += price * volume;
      totalVolume += volume;
    }
    return totalCost / totalVolume;
  }

  private calculatePriceRecovery(trades: any[], period: 'medium' | 'long'): number {
    if (trades.length < 2) return 0;
    const startPrice = trades[0].price;
    const endPrice = trades[trades.length - 1].price;
    return Math.abs(endPrice - startPrice) / startPrice;
  }

  private estimateRecoveryTime(trades: any[]): number {
    if (trades.length < 2) return 0;
    const timeSpan = trades[trades.length - 1].timestamp - trades[0].timestamp;
    return Math.round(timeSpan / trades.length);
  }

  private generateMicrostructureRecommendations(
    orderFlow: OrderFlowImbalance,
    volOfVol: VolatilityOfVolatility,
    toxicity: OrderBookToxicity,
    priceImpact: PriceImpactAnalysis
  ): string[] {
    const recommendations: string[] = [];

    if (orderFlow.strength === 'strong') {
      recommendations.push(
        `Strong ${orderFlow.trend} pressure - follow the flow`
      );
    }

    if (volOfVol.volatilityRegime === 'extreme') {
      recommendations.push('Extreme volatility regime - reduce position size');
    }

    if (toxicity.assessment === 'healthy') {
      recommendations.push('Excellent order book health - good time to trade');
    } else if (toxicity.assessment === 'severely_toxic') {
      recommendations.push('Avoid large trades - market structure deteriorated');
    }

    if (priceImpact.resilience < 30) {
      recommendations.push('Low market resilience - expect delayed recovery');
    }

    return recommendations;
  }
}

export const advancedMicrostructureIndicators =
  AdvancedMicrostructureIndicators.getInstance();

export type {
  OrderFlowImbalance,
  VolatilityOfVolatility,
  OrderBookToxicity,
  PriceImpactAnalysis,
  MarketMicrostructureIndicators,
  AdvancedMicrostructureAlert
};
