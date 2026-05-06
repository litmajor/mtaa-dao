/**
 * Smart Order Router Service
 * 
 * Compares DEX vs CEX prices and recommends optimal execution venue
 * Features:
 * - Price comparison across DEX and multiple CEX
 * - Order splitting for large orders
 * - Slippage and fee calculation
 * - Best execution recommendation
 */

import { ccxtService } from './ccxtService';
import { dexService } from './dexIntegrationService';
import { tokenService } from './tokenService';
import { logger } from '../utils/logger';
import NodeCache from 'node-cache';

/**
 * Type Definitions
 */
export interface VenueOption {
  venue: 'dex' | 'cex';
  exchange?: string; // Name if CEX
  price: number;
  totalCost: number;
  slippage?: number;
  gasCost?: number;
  fee?: number;
  totalWithCosts: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface RoutingResult {
  symbol: string;
  amount: number;
  side: 'buy' | 'sell';
  recommendations: VenueOption[];
  recommended: 'dex' | 'cex';
  recommendedVenue?: string;
  savings: number;
  savingsPercent: number;
  timestamp: number;
}

export interface OrderSplit {
  venue: 'dex' | 'cex';
  exchange?: string;
  amount: number;
  price: number;
  cost: number;
  percentage: number;
}

export interface SplitRoutingResult {
  symbol: string;
  totalAmount: number;
  splits: OrderSplit[];
  totalCost: number;
  averagePrice: number;
  recommendation: string;
}

export interface ExecutionRecord {
  exchange: string;
  symbol: string;
  expectedPrice: number;
  actualPrice: number;
  slippage: number;
  fillTime: number; // milliseconds
  accuracy: number; // 0-100
  success: boolean;
  liquidityDepth?: number;
  orderSize: number;
  timestamp?: Date;
}

export interface ConfidenceScore {
  venue: 'dex' | 'cex';
  exchange?: string;
  successRate: number; // 0-1
  accuracy: number; // 0-100
  calculatedScore?: number; // 0-100 real-time calculated
  trustScore?: number; // 0-100 adaptive trust score
  lastUpdated?: Date;
}

export interface ExecutionStats {
  totalExecutions: number;
  successRate: number;
  averageSlippage: number;
  averageFillTime: number;
  averageAccuracy: number;
  slippageVariance: number;
  latencyVariance: number;
  failureRate: number;
}

// Performance memory layer - tracks detailed metrics for self-correction
export interface PerformanceMemory {
  exchange: string;
  symbol?: string;
  avgSlippage: number;
  slippageVariance: number;
  avgLatency: number;
  latencyVariance: number;
  fillRate: number;
  failureRate: number;
  liquidityDepth: number;
  lastExecutionTime?: Date;
  executionCount: number;
  trustScore: number; // 0-100, decays with prediction errors
}

// Execution scoring model
export interface ExecutionScore {
  venue: 'dex' | 'cex';
  exchange?: string;
  baseCost: number;
  slippageRisk: number; // Cost increase from volatility
  failureRisk: number; // Probability cost if order fails
  latencyRisk: number; // Penalty for slow execution
  volatilityRisk: number; // Cost from market movement
  totalScore: number; // Final comparable score
  confidence: number; // 0-100
  riskMultiplier: number; // Used to adjust expected cost
}

// Trading intent - enables strategy-aware routing
export interface TradingIntent {
  goal: 'accumulate' | 'execute' | 'stealth' | 'cheap'; // accumulation, market execution, hidden, cost-only
  urgency: 'low' | 'medium' | 'high'; // Time sensitivity
  sensitivity: 'price' | 'timing' | 'volume'; // Primary constraint
  maxSlippage?: number; // Upper bound
  maxWaitTime?: number; // Milliseconds
  minLiquidity?: number; // Minimum acceptable depth
}

export interface LimitOrder {
  id?: string;
  userId: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'pending' | 'filled' | 'canceled' | 'expired';
  filledAmount?: number;
  filledPrice?: number;
  orderId?: string;
  createdAt?: Date;
  expiresAt?: Date;
  filledAt?: Date;
}

class OrderRouter {
  private routingCache = new NodeCache({ stdTTL: 30 }); // 30-second cache for routing decisions
  private executionHistory = new Map<string, ExecutionRecord[]>(); // Track execution history for learning
  private performanceMemory = new Map<string, PerformanceMemory>(); // Real-time performance tracking
  private confidenceScores = new Map<string, ConfidenceScore>(); // Confidence scores by venue/symbol

  constructor() {
    logger.info('✅ Order Router Service initialized (v2: Adaptive Intelligence)');
    this.initializeConfidenceScores();
    this.initializePerformanceMemory();
  }

  /**
   * Initialize confidence scores with baseline
   */
  private initializeConfidenceScores(): void {
    this.confidenceScores.set('binance_default', {
      venue: 'cex',
      exchange: 'binance',
      successRate: 0.95,
      accuracy: 98,
      trustScore: 85,
    });
    this.confidenceScores.set('coinbase_default', {
      venue: 'cex',
      exchange: 'coinbase',
      successRate: 0.93,
      accuracy: 96,
      trustScore: 82,
    });
    this.confidenceScores.set('kraken_default', {
      venue: 'cex',
      exchange: 'kraken',
      successRate: 0.94,
      accuracy: 97,
      trustScore: 84,
    });
    this.confidenceScores.set('dex_default', {
      venue: 'dex',
      successRate: 0.85,
      accuracy: 88,
      trustScore: 75,
    });
  }

  /**
   * Initialize performance memory for each known exchange
   */
  private initializePerformanceMemory(): void {
    const exchanges = ['binance', 'coinbase', 'kraken', 'dex'];
    exchanges.forEach((exchange) => {
      this.performanceMemory.set(exchange, {
        exchange,
        avgSlippage: exchange === 'dex' ? 1.4 : 0.2,
        slippageVariance: exchange === 'dex' ? 0.8 : 0.05,
        avgLatency: exchange === 'dex' ? 2000 : 150,
        latencyVariance: exchange === 'dex' ? 1000 : 50,
        fillRate: exchange === 'dex' ? 0.92 : 0.97,
        failureRate: exchange === 'dex' ? 0.08 : 0.03,
        liquidityDepth: exchange === 'dex' ? 50000 : 500000,
        executionCount: 0,
        trustScore: 80,
      });
    });
  }

  /**
   * Calculate REAL confidence from actual performance metrics
   * confidence = 0.4*liquidity + 0.3*fillRate + 0.2*latency + 0.1*volatility
   */
  private calculateConfidenceScore(memory: PerformanceMemory): number {
    // Normalize each component to 0-100
    const liquidityScore = Math.min((memory.liquidityDepth / 500000) * 100, 100); // Cap at 500k depth
    const fillRateScore = memory.fillRate * 100;
    const latencyScore = Math.max(100 - (memory.avgLatency / 50), 0); // 5000ms = 0, 0ms = 100
    const volatilityScore = Math.max(100 - memory.slippageVariance * 1000, 0); // Lower variance = higher score

    // Weighted formula
    const confidence = 0.4 * liquidityScore + 0.3 * fillRateScore + 0.2 * latencyScore + 0.1 * volatilityScore;

    return Math.min(Math.max(confidence, 0), 100);
  }

  /**
   * Get confidence score (now CALCULATED, not static)
   */
  getConfidenceScore(exchange: string, symbol?: string): ConfidenceScore {
    let memory = this.performanceMemory.get(exchange);
    
    // If no memory exists, create default memory entry and compute from it
    if (!memory) {
      const isDex = exchange === 'dex' || exchange.toLowerCase().includes('dex');
      const defaultMemory: PerformanceMemory = {
        exchange,
        avgSlippage: isDex ? 1.4 : 0.2,
        slippageVariance: isDex ? 0.8 : 0.05,
        avgLatency: isDex ? 2000 : 150,
        latencyVariance: isDex ? 1000 : 50,
        fillRate: isDex ? 0.92 : 0.97,
        failureRate: isDex ? 0.08 : 0.03,
        liquidityDepth: isDex ? 50000 : 500000,
        executionCount: 0,
        trustScore: 80,
      };
      memory = defaultMemory;
    }

    // ALWAYS compute, never hardcode
    const calculatedScore = this.calculateConfidenceScore(memory);
    const riskMultiplier = this.calculateRiskMultiplier(memory);

    return {
      venue: memory.exchange === 'dex' || memory.exchange.toLowerCase().includes('dex') ? 'dex' : 'cex',
      exchange: memory.exchange,
      successRate: memory.fillRate,
      accuracy: (calculatedScore * 0.6 + memory.fillRate * 40), // Blend calculated + observed
      calculatedScore,
      trustScore: memory.trustScore,
      lastUpdated: memory.lastExecutionTime,
    };
  }

  /**
   * Non-linear slippage model: slippage ∝ (orderSize / liquidityDepth)^2
   * Markets are NOT linear - large orders explode in slippage
   */
  private calculateNonLinearSlippage(
    orderSize: number,
    liquidityDepth: number,
    baseSlippage: number
  ): number {
    const ratio = orderSize / liquidityDepth;
    const quadraticPenalty = Math.pow(ratio, 2); // Exponential penalty
    return baseSlippage * (1 + quadraticPenalty * 100); // Scale up quadratic effect
  }

  /**
   * Calculate risk multiplier based on exchange performance
   * riskMultiplier = 1 + (failureRate + slippageVariance + latencyVariance)
   */
  private calculateRiskMultiplier(memory: PerformanceMemory): number {
    const failureComponent = memory.failureRate * 0.5;
    const slippageComponent = Math.min(memory.slippageVariance / 100, 0.2); // Cap at 20%
    const latencyComponent = Math.min(memory.latencyVariance / 10000, 0.1); // Cap at 10%
    return Math.max(1, 1 + failureComponent + slippageComponent + latencyComponent);
  }

  /**
   * Calculate execution score (multi-factor assessment, not just cost)
   * THIS is the breakthrough - routes based on real risk, not just price(figured this shit out at 1am)
   */
  private async calculateExecutionScore(
    venue: string,
    exchange: string | undefined,
    totalWithCosts: number,
    baseCost: number
  ): Promise<ExecutionScore> {
    const memory = this.performanceMemory.get(exchange || venue);
    if (!memory) {
      // Fallback score
      return {
        venue: venue as 'dex' | 'cex',
        exchange,
        baseCost,
        slippageRisk: 0,
        failureRisk: 0,
        latencyRisk: 0,
        volatilityRisk: 0,
        totalScore: baseCost,
        confidence: 50,
        riskMultiplier: 1.1,
      };
    }

    const riskMultiplier = this.calculateRiskMultiplier(memory);
    const confidence = this.calculateConfidenceScore(memory);

    // Calculate risk components (in cost terms)
    const slippageRisk = memory.slippageVariance * baseCost * 0.5; // Slippage variance as % of cost
    const failureRisk = memory.failureRate * baseCost * 10; // Failure probability premium
    const latencyRisk = (memory.avgLatency / 1000) * (baseCost * 0.001); // Latency in milliseconds
    const volatilityRisk = memory.avgSlippage * baseCost * 0.1; // Base slippage as % risk

    const totalScore = baseCost * riskMultiplier + slippageRisk + failureRisk + latencyRisk + volatilityRisk;

    return {
      venue: venue as 'dex' | 'cex',
      exchange,
      baseCost,
      slippageRisk,
      failureRisk,
      latencyRisk,
      volatilityRisk,
      totalScore,
      confidence,
      riskMultiplier,
    };
  }

  /**
   * Record execution result and UPDATE performance memory (self-correcting)
   */
  recordExecution(record: ExecutionRecord): void {
    const key = `${record.exchange}-${record.symbol}`;
    if (!this.executionHistory.has(key)) {
      this.executionHistory.set(key, []);
    }
    this.executionHistory.get(key)!.push(record);

    // Update performance memory (THIS IS THE SELF-CORRECTION)
    this.updatePerformanceMemory(record);
    this.updateConfidenceFromExecution(record);
  }

  /**
   * Update performance memory from actual execution (self-learning)
   */
  private updatePerformanceMemory(record: ExecutionRecord): void {
    const memory = this.performanceMemory.get(record.exchange) || {
      exchange: record.exchange,
      avgSlippage: 0,
      slippageVariance: 0,
      avgLatency: 0,
      latencyVariance: 0,
      fillRate: 0,
      failureRate: 0,
      liquidityDepth: record.liquidityDepth || 100000,
      executionCount: 0,
      trustScore: 80,
    };

    const count = memory.executionCount + 1;
    const alpha = 0.2; // Weight for new data (EMA smoothing)

    // Update averages with exponential moving average
    memory.avgSlippage = alpha * record.slippage + (1 - alpha) * memory.avgSlippage;
    memory.avgLatency = alpha * record.fillTime + (1 - alpha) * memory.avgLatency;

    // Update variance (simplified)
    const slippageDev = Math.abs(record.slippage - memory.avgSlippage);
    const latencyDev = Math.abs(record.fillTime - memory.avgLatency);
    memory.slippageVariance = alpha * slippageDev + (1 - alpha) * memory.slippageVariance;
    memory.latencyVariance = alpha * latencyDev + (1 - alpha) * memory.latencyVariance;

    // Update success metrics
    const successThreshold = 0.05; // 5% slippage = failure
    const isSuccess = record.slippage < successThreshold && record.success;
    const newFillRate = (memory.fillRate * (count - 1) + (isSuccess ? 1 : 0)) / count;
    memory.fillRate = Math.min(newFillRate, 0.99); // Cap at 99%
    memory.failureRate = 1 - memory.fillRate;

    memory.executionCount = count;
    memory.lastExecutionTime = record.timestamp || new Date();

    // Adjust trust score based on prediction accuracy
    if (record.accuracy > 90) {
      memory.trustScore = Math.min(memory.trustScore + 1, 100);
    } else if (record.accuracy < 70) {
      memory.trustScore = Math.max(memory.trustScore - 3, 40); // Can't go below 40
    }

    this.performanceMemory.set(record.exchange, memory);

    logger.info(`[SELF-CORRECT] ${record.exchange}: slippage=${memory.avgSlippage.toFixed(3)}%, fillRate=${(memory.fillRate * 100).toFixed(1)}%, trustScore=${memory.trustScore.toFixed(0)}`);
  }

  /**
   * Update confidence scores from execution results
   */
  private updateConfidenceFromExecution(record: ExecutionRecord): void {
    const scoreKey = `${record.exchange}_${record.symbol || 'default'}`;
    const fallbackKey = `${record.exchange}_default`;

    const history = this.executionHistory.get(`${record.exchange}-${record.symbol}`) || [];

    if (history.length > 0) {
      const successCount = history.filter((h) => h.success).length;
      const successRate = successCount / history.length;
      const avgAccuracy = history.reduce((sum, h) => sum + h.accuracy, 0) / history.length;

      const currentScore = this.confidenceScores.get(scoreKey) || this.confidenceScores.get(fallbackKey) || {
        venue: record.exchange === 'dex' ? 'dex' : 'cex',
        exchange: record.exchange,
        successRate: 0.9,
        accuracy: 90,
        trustScore: 75,
      };

      // Update with exponential moving average
      const alpha = 0.3;
      currentScore.successRate = alpha * successRate + (1 - alpha) * currentScore.successRate;
      currentScore.accuracy = alpha * avgAccuracy + (1 - alpha) * currentScore.accuracy;

      this.confidenceScores.set(fallbackKey, currentScore);
    }
  }

  /**
   * Get execution statistics for analysis
   */
  getExecutionStats(exchange: string, symbol: string): ExecutionStats | null {
    const history = this.executionHistory.get(`${exchange}-${symbol}`);
    if (!history || history.length === 0) return null;

    const successCount = history.filter((h) => h.success).length;
    const avgSlippage = history.reduce((sum, h) => sum + h.slippage, 0) / history.length;
    const avgFillTime = history.reduce((sum, h) => sum + h.fillTime, 0) / history.length;
    const avgAccuracy = history.reduce((sum, h) => sum + h.accuracy, 0) / history.length;

    // Calculate variance
    const slippageVariance = Math.sqrt(history.reduce((sum, h) => sum + Math.pow(h.slippage - avgSlippage, 2), 0) / history.length);
    const latencyVariance = Math.sqrt(history.reduce((sum, h) => sum + Math.pow(h.fillTime - avgFillTime, 2), 0) / history.length);

    return {
      totalExecutions: history.length,
      successRate: successCount / history.length,
      averageSlippage: avgSlippage,
      averageFillTime: avgFillTime,
      averageAccuracy: avgAccuracy,
      slippageVariance,
      latencyVariance,
      failureRate: 1 - successCount / history.length,
    };
  }

  /**
   * Compare DEX vs CEX prices with REAL risk-adjusted scoring (not fake confidence)
   * Now sorts by EXECUTION SCORE, not just cost
   */
  async comparePrices(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell' = 'buy',
    exchanges: string[] = ['binance', 'coinbase', 'kraken'],
    intent?: TradingIntent
  ): Promise<RoutingResult> {
    const cacheKey = `routing:${symbol}:${amount}:${side}:${intent?.goal || 'default'}`;
    const cached = this.routingCache.get<RoutingResult>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const recommendations: VenueOption[] = [];
      const executionScores: ExecutionScore[] = [];

      // Get DEX price
      const dexOption = await this.getDEXPrice(symbol, amount, side, intent);
      if (dexOption) {
        recommendations.push(dexOption);
        const dexScore = await this.calculateExecutionScore('dex', undefined, dexOption.totalWithCosts, dexOption.totalCost);
        executionScores.push(dexScore);
      }

      // Get CEX prices
      const cexOptions = await this.getCEXPrices(symbol, amount, side, exchanges, intent);
      recommendations.push(...cexOptions);
      for (const option of cexOptions) {
        const cexScore = await this.calculateExecutionScore('cex', option.exchange, option.totalWithCosts, option.totalCost);
        executionScores.push(cexScore);
      }

      // NOW SORT BY EXECUTION SCORE (risk-adjusted), not just cost
      recommendations.sort((a, b) => {
        const scoreA = executionScores.find((s) => s.exchange === a.exchange);
        const scoreB = executionScores.find((s) => s.exchange === b.exchange);
        const costA = scoreA?.totalScore || a.totalWithCosts;
        const costB = scoreB?.totalScore || b.totalWithCosts;
        return side === 'buy' ? costA - costB : costB - costA;
      });

      // Determine best option
      const recommended = recommendations[0];
      const secondBest = recommendations[1] || recommendations[0];

      // Calculate savings (now based on execution score)
      let savings = 0;
      let savingsPercent = 0;

      const bestScore = executionScores.find((s) => s.exchange === recommended.exchange);
      const secondScore = executionScores.find((s) => s.exchange === secondBest.exchange);

      if (recommendations.length > 1 && bestScore && secondScore) {
        savings = Math.abs(secondScore.totalScore -bestScore.totalScore);
        savingsPercent = (savings / secondScore.totalScore) * 100;
      }

      const result: RoutingResult = {
        symbol,
        amount,
        side,
        recommendations,
        recommended: recommended.venue,
        recommendedVenue: recommended.exchange,
        savings,
        savingsPercent,
        timestamp: Date.now(),
      };

      this.routingCache.set(cacheKey, result);
      return result;
    } catch (error: any) {
      logger.error(`Error comparing prices for ${symbol}:`, error);
      throw new Error(`Failed to compare prices: ${error.message}`);
    }
  }

  /**
   * Get DEX price with non-linear slippage calculation
   */
  private async getDEXPrice(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell',
    intent?: TradingIntent
  ): Promise<VenueOption | null> {
    try {
      const quote = await dexService.getSwapQuote(
        side === 'buy' ? 'cUSD' : symbol,
        side === 'buy' ? symbol : 'cUSD',
        amount,
        'ubeswap'
      );

      if (!quote) {
        return null;
      }

      const price = quote.exchangeRate;
      const memory = this.performanceMemory.get('dex');
      const baseSlippage = (quote.priceImpact / 100) * (amount * price);

      // CRITICAL: Non-linear slippage calculation
      const nonLinearSlippage = this.calculateNonLinearSlippage(
        amount,
        memory?.liquidityDepth || 50000,
        quote.priceImpact / 100
      ) * (amount * price);

      const gasCost = quote.estimatedGas || 2;
      const totalCost = amount * price + nonLinearSlippage + gasCost;

      // Intent-aware filtering
      if (intent?.maxSlippage && nonLinearSlippage / (amount * price) > intent.maxSlippage) {
        return null; // Reject if violates intent constraint
      }

      // Get calculated confidence
      const dexConfidence = this.getConfidenceScore('dex', symbol);
      const confidenceLevel: 'high' | 'medium' | 'low' =
        dexConfidence.calculatedScore! >= 80 ? 'high' : dexConfidence.calculatedScore! >= 60 ? 'medium' : 'low';

      return {
        venue: 'dex',
        price,
        totalCost: amount * price,
        slippage: nonLinearSlippage,
        gasCost,
        totalWithCosts: totalCost,
        confidence: confidenceLevel,
        reasoning: `Ubeswap DEX: ${quote.priceImpact.toFixed(2)}% impact → ${(nonLinearSlippage / (amount * price) * 100).toFixed(3)}% actual slippage (confidence: ${dexConfidence.calculatedScore?.toFixed(0)}%, memory: ${dexConfidence.successRate * 100}% fill)`,
      };
    } catch (error: any) {
      logger.warn(`Could not get DEX price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get CEX prices with learned confidence (now CALCULATED)
   */
  private async getCEXPrices(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell',
    exchanges: string[],
    intent?: TradingIntent
  ): Promise<VenueOption[]> {
    const options: VenueOption[] = [];

    try {
      const prices = await ccxtService.getPricesFromMultipleExchanges(symbol, exchanges);

      for (const [exchange, priceData] of Object.entries(prices)) {
        if (!priceData) continue;

        // Select bid (sell) or ask (buy) price
        const price = side === 'buy' ? priceData.ask : priceData.bid;

        // Calculate fee (0.1% taker fee typical)
        const takerFee = 0.001;
        const feeAmount = amount * price * takerFee;
        const totalCost = amount * price + feeAmount;

        // Intent-aware filtering
        if (intent?.maxSlippage && feeAmount / (amount * price) > intent.maxSlippage) {
          continue; // Reject if violates intent
        }

        // Get CALCULATED confidence (not static)
        const exchangeConfidence = this.getConfidenceScore(exchange, symbol);
        const confidenceLevel: 'high' | 'medium' | 'low' =
          exchangeConfidence.calculatedScore! >= 80 ? 'high' : exchangeConfidence.calculatedScore! >= 60 ? 'medium' : 'low';

        options.push({
          venue: 'cex',
          exchange,
          price,
          totalCost: amount * price,
          fee: feeAmount,
          totalWithCosts: totalCost,
          confidence: confidenceLevel,
          reasoning: `${exchange}: 0.1% fee (confidence: ${exchangeConfidence.calculatedScore?.toFixed(0)}%, ${(exchangeConfidence.successRate * 100).toFixed(0)}% fill, trust: ${exchangeConfidence.trustScore || 80})`,
        });
      }

      return options;
    } catch (error: any) {
      logger.warn(`Could not get CEX prices:`, error.message);
      return [];
    }
  }

  /**
   * Find the best execution venue (now uses execution scores, not just price)
   */
  async findBestExecutionVenue(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell' = 'buy',
    intent?: TradingIntent
  ): Promise<VenueOption | null> {
    try {
      const routing = await this.comparePrices(symbol, amount, side, undefined, intent);
      return routing.recommendations[0] || null;
    } catch (error: any) {
      logger.error('Error finding best execution venue:', error);
      return null;
    }
  }

  /**
   * CONTINUOUS OPTIMIZATION: Split order across venues to minimize total cost
   * Instead of greedy (DEX first, then CEX), solves: minimize cost across ALL venues
   * 
   * This is the breakthrough - tests every possible split ratio and picks optimal
   */
  async splitOrder(
    symbol: string,
    totalAmount: number,
    side: 'buy' | 'sell' = 'buy',
    intent?: TradingIntent
  ): Promise<SplitRoutingResult> {
    try {
      const routing = await this.comparePrices(symbol, totalAmount, side, undefined, intent);

      // Get venue options
      const dexOption = routing.recommendations.find((r) => r.venue === 'dex');
      const cexOptions = routing.recommendations.filter((r) => r.venue === 'cex');

      if (cexOptions.length === 0 || !dexOption) {
        // Fallback: single venue
        const best = routing.recommendations[0];
        return {
          symbol,
          totalAmount,
          splits: [
            {
              venue: best.venue,
              exchange: best.exchange,
              amount: totalAmount,
              price: best.price,
              cost: best.totalWithCosts,
              percentage: 100,
            },
          ],
          totalCost: best.totalWithCosts,
          averagePrice: best.price,
          recommendation: `Single venue: ${best.venue === 'dex' ? 'DEX' : best.exchange}`,
        };
      }

      // CONTINUOUS OPTIMIZATION: Test all split ratios
      let bestSplitCost = Infinity;
      let bestSplit: Array<{ venue: 'dex' | 'cex'; exchange?: string; amount: number }> = [];

      // Test 11 different split ratios (0%, 10%, 20%, ..., 100% to DEX)
      for (let dexPercent = 0; dexPercent <= 10; dexPercent++) {
        const ratio = dexPercent / 10;
        const dexAmount = totalAmount * ratio;
        const cexAmount = totalAmount * (1 - ratio);

        // Calculate cost for this split
        let splitCost = 0;

        if (dexAmount > 0 && dexOption) {
          // DEX cost with non-linear slippage scaling
          const dexSlippage = this.calculateNonLinearSlippage(
            dexAmount,
            this.performanceMemory.get('dex')?.liquidityDepth || 50000,
            dexOption.slippage ? dexOption.slippage / (totalAmount * dexOption.price) : 0.014
          );
          splitCost += dexAmount * dexOption.price + dexSlippage + (dexOption.gasCost || 0);
        }

        if (cexAmount > 0 && cexOptions.length > 0) {
          // Use best CEX for this portion
          const bestCex = cexOptions[0];
          splitCost += cexAmount * bestCex.price + (bestCex.fee || 0);
        }

        // Track best split
        if (splitCost < bestSplitCost) {
          bestSplitCost = splitCost;
          bestSplit = [];
          if (dexAmount > 0) {
            bestSplit.push({ venue: 'dex', amount: dexAmount });
          }
          if (cexAmount > 0) {
            bestSplit.push({ venue: 'cex', exchange: cexOptions[0].exchange, amount: cexAmount });
          }
        }
      }

      // Convert optimized split to result format
      const splits: OrderSplit[] = bestSplit.map((split) => {
        const option = split.venue === 'dex' ? dexOption : cexOptions.find((o) => o.exchange === split.exchange);
        if (!option) throw new Error('Split venue not found');

        return {
          venue: split.venue,
          exchange: split.exchange,
          amount: split.amount,
          price: option.price,
          cost: split.amount * option.price + (split.venue === 'dex' ? option.gasCost || 0 : option.fee || 0),
          percentage: (split.amount / totalAmount) * 100,
        };
      });

      const totalCost = splits.reduce((sum, split) => sum + split.cost, 0);
      const averagePrice = totalCost / totalAmount;

      const recommendation =
        splits.length === 1
          ? `Optimized: 100% on ${splits[0].venue === 'dex' ? 'DEX' : splits[0].exchange}`
          : `Optimized: ${splits.map((s) => `${s.percentage.toFixed(0)}% on ${s.venue === 'dex' ? 'DEX' : s.exchange}`).join(', ')}`;

      logger.info(`[OPTIMIZATION] Split result: ${recommendation} (cost: $${totalCost.toFixed(2)})`);

      return {
        symbol,
        totalAmount,
        splits,
        totalCost,
        averagePrice,
        recommendation,
      };
    } catch (error: any) {
      logger.error('Error splitting order:', error);
      throw error;
    }
  }

  /**
   * SIMULATE EXECUTION - Pre-trade intelligence engine
   * Returns: expectedSlippage, bestSplit, confidence, worstCase, latencyEstimate
   */
  async simulateExecution(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell' = 'buy',
    intent?: TradingIntent
  ): Promise<{
    expectedSlippage: number;
    expectedSlippagePercent: number;
    bestSplit: SplitRoutingResult;
    confidence: number;
    worstCase: { slippage: number; cost: number };
    bestCase: { slippage: number; cost: number };
    latencyEstimate: number; // milliseconds
    recommendation: string;
  }> {
    try {
      const split = await this.splitOrder(symbol, amount, side, intent);
      const basePrice = split.splits[0].price; // First venue price as baseline

      // Calculate expected slippage across splits
      let totalExpectedSlippage = 0;
      let maxLatency = 0;

      for (const splitItem of split.splits) {
        const memory = this.performanceMemory.get(splitItem.exchange || splitItem.venue);
        if (memory) {
          totalExpectedSlippage += memory.avgSlippage;
          maxLatency = Math.max(maxLatency, memory.avgLatency);
        }
      }

      const avgSlippage = totalExpectedSlippage / split.splits.length;
      const slippagePercent = (avgSlippage / (basePrice * amount)) * 100;

      // Calculate confidence from venue performance
      let totalConfidence = 0;
      for (const splitItemConfidence of split.splits) {
        const confidence = this.getConfidenceScore(splitItemConfidence.exchange || splitItemConfidence.venue, symbol);
        totalConfidence += confidence.calculatedScore || 75;
      }
      const avgConfidence = totalConfidence / split.splits.length;

      // Worst case: all slippage doubled + latency miss
      const worstSlippage = avgSlippage * 2;
      const worstCost = split.totalCost + worstSlippage + (split.splits.length > 1 ? 5 : 0); // Extra $5 for split overhead

      // Best case: 50% of expected slippage
      const bestSlippage = avgSlippage * 0.5;
      const bestCost = split.totalCost - bestSlippage * 0.5;

      const recommendation =
        avgConfidence >= 80
          ? `High confidence: Execute split immediately (${(avgConfidence).toFixed(0)}% expected accuracy)`
          : avgConfidence >= 60
            ? `Medium confidence: Monitor before executing (${(avgConfidence).toFixed(0)}% accuracy, ${slippagePercent.toFixed(2)}% slippage expected)`
            : `Low confidence: Consider alternative venues or wait for better conditions`;

      return {
        expectedSlippage: avgSlippage,
        expectedSlippagePercent: slippagePercent,
        bestSplit: split,
        confidence: avgConfidence,
        worstCase: { slippage: worstSlippage, cost: worstCost },
        bestCase: { slippage: bestSlippage, cost: bestCost },
        latencyEstimate: maxLatency,
        recommendation,
      };
    } catch (error: any) {
      logger.error('Error simulating execution:', error);
      throw error;
    }
  }

  /**
   * Execute optimal swap (simplified - actual execution handled by DEX/CEX services)
   */
  async executeOptimalSwap(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell' = 'buy',
    userPreferences?: {
      preferredVenue?: 'dex' | 'cex';
      preferredExchange?: string;
      maxSlippage?: number;
    }
  ): Promise<any> {
    try {
      const routing = await this.comparePrices(symbol, amount, side);

      // Respect user preference if specified
      let selectedVenue = routing.recommendations[0];
      if (userPreferences?.preferredVenue) {
        selectedVenue =
          routing.recommendations.find(
            r =>
              r.venue === userPreferences.preferredVenue &&
              (userPreferences.preferredVenue === 'cex'
                ? r.exchange === userPreferences.preferredExchange
                : true)
          ) || selectedVenue;
      }

      logger.info(`Executing optimal swap on ${selectedVenue.venue} (${selectedVenue.exchange || 'DEX'})`);

      return {
        venue: selectedVenue.venue,
        exchange: selectedVenue.exchange,
        symbol,
        amount,
        side,
        estimatedPrice: selectedVenue.price,
        estimatedCost: selectedVenue.totalWithCosts,
        reasoning: selectedVenue.reasoning
      };
    } catch (error: any) {
      logger.error('Error executing optimal swap:', error);
      throw error;
    }
  }

  /**
   * Place a persistent limit order on CEX
   */
  async placeLimitOrder(
    userId: string,
    exchange: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number,
    expiresInDays: number = 7
  ): Promise<LimitOrder> {
    try {
      const ccxtOrderResult = await ccxtService.placeLimitOrder(
        exchange,
        symbol,
        side,
        amount,
        price
      );

      const limitOrder: LimitOrder = {
        userId,
        exchange,
        symbol,
        side,
        amount,
        price,
        status: 'pending',
        orderId: ccxtOrderResult.orderId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      };

      logger.info(`Placed limit order: ${exchange} ${side} ${amount} ${symbol} @ ${price}`);
      return limitOrder;
    } catch (error: any) {
      logger.error('Error placing limit order:', error);
      throw error;
    }
  }

  /**
   * Check and update limit order status
   */
  async checkLimitOrderStatus(exchange: string, orderId: string, symbol?: string): Promise<any> {
    try {
      const status = await ccxtService.checkOrderStatus(exchange, orderId, symbol);
      return status;
    } catch (error: any) {
      logger.error('Error checking order status:', error);
      throw error;
    }
  }

  /**
   * Cancel a limit order
   */
  async cancelLimitOrder(exchange: string, orderId: string, symbol?: string): Promise<boolean> {
    try {
      const success = await ccxtService.cancelOrder(exchange, orderId, symbol);
      logger.info(`Cancelled order: ${exchange} ${orderId}`);
      return success;
    } catch (error: any) {
      logger.error('Error canceling order:', error);
      throw error;
    }
  }

  /**
   * Clear routing cache
   */
  clearCache(): void {
    this.routingCache.flushAll();
    logger.info('Order routing cache cleared');
  }
}

export const orderRouter = new OrderRouter();
