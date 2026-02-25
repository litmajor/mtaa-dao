/**
 * Arbitrage Detection Service
 * 
 * Identifies and scores arbitrage opportunities across multiple exchanges
 * - Price discrepancies between exchanges
 * - Risk assessment and execution analysis
 * - Profitability calculation considering slippage and fees
 */

import { NormalizedAsset, ExchangePresence } from '../types/assetTypes';
import { logger } from '../utils/logger';

export interface ArbitrageOpportunity {
  // Asset information
  symbol: string;
  assetId: string;
  
  // Buy/Sell exchanges
  buyExchange: string;
  buyPrice: number;
  buyVolume: number;
  buySpread: number;
  
  sellExchange: string;
  sellPrice: number;
  sellVolume: number;
  sellSpread: number;
  
  // Profitability
  priceGap: number;                  // Absolute price difference
  priceGapPercentage: number;        // Gap as percentage of buy price
  grossProfit: number;               // Before fees/slippage
  grossProfitPercentage: number;
  
  // Risk-adjusted profitability
  estimatedFees: number;             // Estimated trading fees (buy + sell)
  estimatedSlippage: number;         // Expected slippage from order volume
  estimatedNetProfit: number;        // After fees and slippage
  estimatedNetProfitPercentage: number;
  
  // Execution metrics
  executionRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  minCapacity: number;               // Maximum profitable volume before slippage eats gains
  maxCapacity: number;               // Maximum volume available
  recommendedVolume: number;         // Recommended execution volume
  
  // Timing & confidence
  discoveredAt: Date;
  confidenceScore: number;           // 0-100 confidence in opportunity
  timeWindowMinutes: number;         // Estimated time to execute (min/max)
  
  // Analysis
  score: number;                     // 0-100 overall opportunity score
  recommendation: 'strong_buy' | 'buy' | 'weak' | 'skip';
  reasoning: string[];
}

export interface ArbitrageStats {
  totalAssets: number;
  opportunitiesFound: number;
  strongOpportunities: number;        // Score > 75
  averageProfit: number;
  maxProfit: number;
  minProfit: number;
  profitableCount: number;
  unprofitableCount: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export class ArbitrageDetectionService {
  private static readonly MIN_PRICE_GAP_PERCENTAGE = 0.1;  // 0.1% minimum to consider
  private static readonly MAKER_FEE = 0.001;               // 0.1% maker fee (typical)
  private static readonly TAKER_FEE = 0.001;               // 0.1% taker fee (typical)
  private static readonly SLIPPAGE_FACTOR = 0.002;         // 0.2% average slippage
  private static readonly HIGH_LIQUIDITY_THRESHOLD = 100000;
  private static readonly MEDIUM_LIQUIDITY_THRESHOLD = 10000;

  /**
   * Detect arbitrage opportunities in a single asset
   */
  static detectOpportunitiesInAsset(asset: NormalizedAsset): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    if (!asset.exchanges || asset.exchanges.length < 2) {
      return opportunities;
    }

    // For each pair of exchanges
    for (let i = 0; i < asset.exchanges.length; i++) {
      for (let j = i + 1; j < asset.exchanges.length; j++) {
        const exchange1 = asset.exchanges[i];
        const exchange2 = asset.exchanges[j];

        // Check both directions (buy on 1, sell on 2) and (buy on 2, sell on 1)
        const opp1 = this.evaluateArbitrage(asset, exchange1, exchange2);
        const opp2 = this.evaluateArbitrage(asset, exchange2, exchange1);

        if (opp1) opportunities.push(opp1);
        if (opp2) opportunities.push(opp2);
      }
    }

    return opportunities.sort((a, b) => b.score - a.score);
  }

  /**
   * Evaluate arbitrage from buyExchange to sellExchange
   */
  private static evaluateArbitrage(
    asset: NormalizedAsset,
    buyExchange: ExchangePresence,
    sellExchange: ExchangePresence
  ): ArbitrageOpportunity | null {
    // Validate data
    if (!buyExchange.ask || !sellExchange.bid) {
      return null;
    }

    const buyPrice = buyExchange.ask;
    const sellPrice = sellExchange.bid;
    const priceGap = sellPrice - buyPrice;
    const priceGapPercentage = (priceGap / buyPrice) * 100;

    // Filter out unprofitable opportunities upfront
    if (priceGapPercentage < this.MIN_PRICE_GAP_PERCENTAGE) {
      return null;
    }

    // Calculate fees (assuming maker/taker mix)
    const buyFee = buyPrice * this.TAKER_FEE;  // Buy as taker
    const sellFee = sellPrice * this.MAKER_FEE;  // Sell as maker
    const totalFees = buyFee + sellFee;
    const totalFeePercentage = (totalFees / buyPrice) * 100;

    // Gross profit (before slippage)
    const grossProfit = priceGap - totalFees;
    const grossProfitPercentage = (grossProfit / buyPrice) * 100;

    // Estimate slippage based on volume and liquidity
    const buyVolume = buyExchange.volume24h || 0;
    const sellVolume = sellExchange.volume24h || 0;
    const estimatedSlippage = this.estimateSlippage(buyVolume, sellVolume, buyPrice, priceGap);

    // Net profit (after fees and slippage)
    const estimatedNetProfit = grossProfit - estimatedSlippage;
    const estimatedNetProfitPercentage = (estimatedNetProfit / buyPrice) * 100;

    // Determine capacity and risk
    const { minCapacity, maxCapacity, recommendedVolume, executionRisk, riskFactors } =
      this.calculateCapacityAndRisk(buyVolume, sellVolume, grossProfit, estimatedSlippage);

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(
      priceGapPercentage,
      buyVolume,
      sellVolume,
      executionRisk
    );

    // Overall opportunity score
    const score = this.calculateOpportunityScore(
      estimatedNetProfitPercentage,
      confidenceScore,
      executionRisk,
      recommendedVolume
    );

    // Generate recommendation
    const { recommendation, reasoning } = this.generateRecommendation(
      score,
      estimatedNetProfitPercentage,
      executionRisk,
      minCapacity,
      maxCapacity
    );

    return {
      symbol: asset.symbol,
      assetId: asset.id,
      buyExchange: buyExchange.exchange,
      buyPrice,
      buyVolume,
      buySpread: buyExchange.spread || 0,
      sellExchange: sellExchange.exchange,
      sellPrice,
      sellVolume,
      sellSpread: sellExchange.spread || 0,
      priceGap,
      priceGapPercentage,
      grossProfit,
      grossProfitPercentage,
      estimatedFees: totalFees,
      estimatedSlippage,
      estimatedNetProfit,
      estimatedNetProfitPercentage,
      executionRisk,
      riskFactors,
      minCapacity,
      maxCapacity,
      recommendedVolume,
      discoveredAt: new Date(),
      confidenceScore,
      timeWindowMinutes: this.estimateExecutionTime(buyVolume, sellVolume),
      score,
      recommendation,
      reasoning,
    };
  }

  /**
   * Estimate slippage based on volumes and price gap
   */
  private static estimateSlippage(buyVolume: number, sellVolume: number, price: number, gap: number): number {
    // Minimum liquidity check
    const minLiquidityCheck = Math.min(buyVolume, sellVolume);

    // Base slippage
    let slippagePercentage = this.SLIPPAGE_FACTOR;

    // Liquidity penalty
    if (minLiquidityCheck < this.MEDIUM_LIQUIDITY_THRESHOLD) {
      slippagePercentage += 0.005;  // +0.5% for medium liquidity
    }
    if (minLiquidityCheck < 1000) {
      slippagePercentage += 0.01;   // +1% for low liquidity
    }

    // Volume imbalance penalty
    const volumeRatio = Math.min(buyVolume, sellVolume) / Math.max(buyVolume, sellVolume);
    if (volumeRatio < 0.5) {
      slippagePercentage += 0.005;  // +0.5% for imbalanced volumes
    }

    return price * slippagePercentage;
  }

  /**
   * Calculate capacity, risk, and recommended volume
   */
  private static calculateCapacityAndRisk(
    buyVolume: number,
    sellVolume: number,
    grossProfit: number,
    slippage: number
  ): {
    minCapacity: number;
    maxCapacity: number;
    recommendedVolume: number;
    executionRisk: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: string[];
  } {
    const minCapacity = Math.max(buyVolume, sellVolume) * 0.01;  // 1% of larger volume
    const maxCapacity = Math.min(buyVolume, sellVolume) * 0.05;  // 5% of smaller volume
    const recommendedVolume = maxCapacity * 0.5;                  // Conservative: half of max

    const riskFactors: string[] = [];
    let riskScore = 0;

    // Check liquidity
    if (buyVolume < this.MEDIUM_LIQUIDITY_THRESHOLD || sellVolume < this.MEDIUM_LIQUIDITY_THRESHOLD) {
      riskFactors.push('Low liquidity on one exchange');
      riskScore += 20;
    }

    // Check volume imbalance
    const volumeRatio = Math.min(buyVolume, sellVolume) / Math.max(buyVolume, sellVolume);
    if (volumeRatio < 0.3) {
      riskFactors.push('Large volume imbalance between exchanges');
      riskScore += 15;
    }

    // Check slippage impact
    if (slippage > grossProfit * 0.5) {
      riskFactors.push('Slippage may consume 50%+ of profit');
      riskScore += 25;
    }

    // Determine overall risk
    let executionRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (riskScore >= 60) {
      executionRisk = 'critical';
    } else if (riskScore >= 40) {
      executionRisk = 'high';
    } else if (riskScore >= 20) {
      executionRisk = 'medium';
    }

    return {
      minCapacity,
      maxCapacity,
      recommendedVolume,
      executionRisk,
      riskFactors,
    };
  }

  /**
   * Calculate confidence in the arbitrage opportunity
   */
  private static calculateConfidenceScore(
    priceGap: number,
    buyVolume: number,
    sellVolume: number,
    executionRisk: string
  ): number {
    let score = 50;  // Base score

    // Price gap confidence (higher gap = more stable)
    if (priceGap > 0.5) score += 25;
    else if (priceGap > 0.25) score += 15;
    else if (priceGap > 0.1) score += 8;

    // Liquidity confidence
    const minLiquidity = Math.min(buyVolume, sellVolume);
    if (minLiquidity > this.HIGH_LIQUIDITY_THRESHOLD) score += 20;
    else if (minLiquidity > this.MEDIUM_LIQUIDITY_THRESHOLD) score += 10;

    // Risk adjustment
    if (executionRisk === 'low') score += 10;
    else if (executionRisk === 'critical') score -= 25;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate overall opportunity score (0-100)
   */
  private static calculateOpportunityScore(
    profitPercentage: number,
    confidenceScore: number,
    executionRisk: string,
    recommendedVolume: number
  ): number {
    let score = 0;

    // Profitability component (0-40 points)
    if (profitPercentage > 1.0) score += 40;
    else if (profitPercentage > 0.5) score += 30;
    else if (profitPercentage > 0.2) score += 15;
    else if (profitPercentage > 0.05) score += 5;

    // Confidence component (0-30 points)
    score += (confidenceScore / 100) * 30;

    // Risk adjustment (0-30 points)
    if (executionRisk === 'low') score += 30;
    else if (executionRisk === 'medium') score += 15;
    else if (executionRisk === 'high') score += 5;
    // critical = 0 bonus

    // Volume component (bonus for larger capacity)
    if (recommendedVolume > 10000) score += 5;
    else if (recommendedVolume > 1000) score += 3;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Estimate execution time in minutes
   */
  private static estimateExecutionTime(buyVolume: number, sellVolume: number): number {
    const minVolume = Math.min(buyVolume, sellVolume);

    if (minVolume > this.HIGH_LIQUIDITY_THRESHOLD) {
      return 5;  // Quick execution
    } else if (minVolume > this.MEDIUM_LIQUIDITY_THRESHOLD) {
      return 15;
    } else {
      return 60;  // May need to split orders
    }
  }

  /**
   * Generate recommendation and reasoning
   */
  private static generateRecommendation(
    score: number,
    profitPercentage: number,
    executionRisk: string,
    minCapacity: number,
    maxCapacity: number
  ): { recommendation: 'strong_buy' | 'buy' | 'weak' | 'skip'; reasoning: string[] } {
    const reasoning: string[] = [];

    if (score >= 75 && profitPercentage > 0.2 && executionRisk !== 'critical') {
      reasoning.push(`✅ Strong opportunity: ${profitPercentage.toFixed(3)}% profit potential`);
      reasoning.push(`✅ High confidence score: ${score.toFixed(0)}/100`);
      reasoning.push(`✅ Acceptable risk level: ${executionRisk}`);
      return { recommendation: 'strong_buy', reasoning };
    }

    if (score >= 50 && profitPercentage > 0.1 && executionRisk !== 'high' && executionRisk !== 'critical') {
      reasoning.push(`✅ Reasonable opportunity: ${profitPercentage.toFixed(3)}% profit potential`);
      reasoning.push(`✅ Moderate confidence: ${score.toFixed(0)}/100`);
      reasoning.push(`⚠️ Execute conservatively (smaller volume)`);
      return { recommendation: 'buy', reasoning };
    }

    if (score >= 30 && profitPercentage > 0.05) {
      reasoning.push(`⚠️ Weak opportunity: ${profitPercentage.toFixed(3)}% profit potential`);
      reasoning.push(`⚠️ Higher risk: ${executionRisk}`);
      reasoning.push(`⚠️ Only viable for very large volumes`);
      return { recommendation: 'weak', reasoning };
    }

    reasoning.push(`❌ Skip: Score ${score.toFixed(0)}/100, profit ${profitPercentage.toFixed(3)}%`);
    reasoning.push(`❌ Risk level: ${executionRisk}`);
    if (profitPercentage < 0.05) {
      reasoning.push(`❌ Profit margin too thin after fees/slippage`);
    }

    return { recommendation: 'skip', reasoning };
  }

  /**
   * Calculate overall arbitrage statistics
   */
  static calculateStats(opportunities: ArbitrageOpportunity[]): ArbitrageStats {
    const strongOpportunities = opportunities.filter(o => o.score > 75).length;
    const profitable = opportunities.filter(o => o.estimatedNetProfit > 0);
    const unprofitable = opportunities.filter(o => o.estimatedNetProfit <= 0);

    const profits = profitable.map(o => o.estimatedNetProfitPercentage);
    const avgProfit = profits.length > 0 ? profits.reduce((a, b) => a + b) / profits.length : 0;
    const maxProfit = profits.length > 0 ? Math.max(...profits) : 0;
    const minProfit = profits.length > 0 ? Math.min(...profits) : 0;

    const riskDistribution = {
      low: opportunities.filter(o => o.executionRisk === 'low').length,
      medium: opportunities.filter(o => o.executionRisk === 'medium').length,
      high: opportunities.filter(o => o.executionRisk === 'high').length,
      critical: opportunities.filter(o => o.executionRisk === 'critical').length,
    };

    // Get unique assets (each pair might have multiple directions)
    const uniqueAssets = new Set(opportunities.map(o => o.assetId)).size;

    return {
      totalAssets: uniqueAssets,
      opportunitiesFound: opportunities.length,
      strongOpportunities,
      averageProfit: avgProfit,
      maxProfit,
      minProfit,
      profitableCount: profitable.length,
      unprofitableCount: unprofitable.length,
      riskDistribution,
    };
  }
}

export default ArbitrageDetectionService;
