/**
 * @file advancedAnalyticsService.ts
 * @description Advanced financial analytics for DAOs and members
 * @notice Provides burn rate, runway forecasting, correlation analysis, and risk metrics
 */

import { db } from '../db';
import { vaultTransactions, walletTransactions, daos, vaults } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import axios from 'axios';

// ==================== REAL DATA SOURCES ====================

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const DEFILLAMA_API = 'https://coins.llama.fi';
const GRAPH_API = 'https://api.thegraph.com/subgraphs/name';

// ==================== TYPES ====================

interface BurnRateMetrics {
  daoId: string;
  period: number;  // days
  dailyBurnRate: number;  // USD/day
  weeklyBurnRate: number;  // USD/week
  monthlyBurnRate: number;  // USD/month
  averageTransactionSize: number;
  transactionCount: number;
  trend: 'ACCELERATING' | 'STABLE' | 'DECELERATING';
}

interface RunwayForecast {
  daoId: string;
  currentBalance: number;  // USD
  dailyBurnRate: number;  // USD/day
  runwayMonths: number;  // Months until 0
  runwayDays: number;    // Days until 0
  projectedEmptyDate: Date;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendations: string[];
}

interface PortfolioCorrelation {
  vaultId: string;
  correlations: Map<string, number>;  // asset -> correlation coefficient
  diversificationScore: number;  // 0-100 (higher = better diversified)
  systemicRisk: number;  // 0-1 (higher = more market correlated)
  idiosyncratiRisk: number;  // 0-1 (higher = more unique risk)
}

interface RiskMetrics {
  vaultId: string;
  valueAtRisk95: number;  // 95% confidence level
  valueAtRisk99: number;  // 99% confidence level
  volatility: number;  // Daily volatility %
  sharpeRatio: number;
  sortinoRatio: number;  // Downside capture ratio
  maxDrawdown: number;  // Greatest peak-to-trough decline
  recoveryTime: number;  // Days to recover from max drawdown
}

interface PerformanceAnalysis {
  vaultId: string;
  period: {days: number};
  totalReturn: number;  // %
  annualizedReturn: number;  // %
  cumulativeReturn: number;  // $
  bestDay: number;  // %
  worstDay: number;  // %
  winRate: number;  // % of days positive
}

// ==================== SERVICE ====================

export class AdvancedAnalyticsService {

  // ==================== BURN RATE ANALYSIS ====================

  /**
   * Calculate burn rate for a DAO
   */
  async calculateBurnRate(
    daoId: string,
    days: number = 30
  ): Promise<BurnRateMetrics> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Get all transactions in period
      const transactions = await db.execute(sql`
        SELECT amount, created_at, type FROM vault_transactions
        WHERE dao_id = ${daoId}
        AND created_at >= ${cutoffDate}
        AND type IN ('withdrawal', 'fee')
      `);

      if (transactions.length === 0) {
        return {
          daoId,
          period: days,
          dailyBurnRate: 0,
          weeklyBurnRate: 0,
          monthlyBurnRate: 0,
          averageTransactionSize: 0,
          transactionCount: 0,
          trend: 'STABLE',
        };
      }

      // Calculate burn (outflows only)
      let totalBurned = 0;
      for (const txn of transactions) {
        if (txn.type === 'withdrawal' || txn.type === 'fee') {
          totalBurned += txn.amount;
        }
      }

      // Calculate daily rate
      const dailyBurnRate = totalBurned / days;
      const weeklyBurnRate = dailyBurnRate * 7;
      const monthlyBurnRate = dailyBurnRate * 30;
      const averageTransactionSize = totalBurned / transactions.length;

      // Determine trend (compare first half vs second half)
      const midpoint = Math.floor(transactions.length / 2);
      const firstHalf = transactions.slice(0, midpoint).reduce((sum, t) => sum + (t.type === 'fee' || t.type === 'withdrawal' ? t.amount : 0), 0);
      const secondHalf = transactions.slice(midpoint).reduce((sum, t) => sum + (t.type === 'fee' || t.type === 'withdrawal' ? t.amount : 0), 0);
      const trend = firstHalf > secondHalf ? 'DECELERATING' : firstHalf < secondHalf ? 'ACCELERATING' : 'STABLE';

      return {
        daoId,
        period: days,
        dailyBurnRate,
        weeklyBurnRate,
        monthlyBurnRate,
        averageTransactionSize,
        transactionCount: transactions.length,
        trend,
      };
    } catch (error) {
      console.error('❌ Error calculating burn rate:', error);
      throw error;
    }
  }

  // ==================== RUNWAY FORECASTING ====================

  /**
   * Forecast DAO runway (months until empty)
   */
  async forecastRunway(daoId: string): Promise<RunwayForecast> {
    try {
      const dao = await db.query.daos.findFirst({
        where: eq(daos.id, daoId as any),
      });

      if (!dao) {
        throw new Error(`DAO not found: ${daoId}`);
      }

      const burnMetrics = await this.calculateBurnRate(daoId, 90);  // 90-day burn rate
      const currentBalance = await this._getDAOBalance(daoId);

      // Calculate runway
      const dailyBurnRate = burnMetrics.dailyBurnRate;
      const runwayDays = dailyBurnRate > 0 ? currentBalance / dailyBurnRate : 999;
      const runwayMonths = runwayDays / 30;

      // Project empty date
      const projectedEmptyDate = new Date();
      projectedEmptyDate.setDate(projectedEmptyDate.getDate() + runwayDays);

      // Confidence level (higher consistency = higher confidence)
      const confidenceLevel = burnMetrics.trend === 'STABLE' ? 'HIGH' : burnMetrics.trend === 'DECELERATING' ? 'MEDIUM' : 'LOW';

      // Generate recommendations
      const recommendations: string[] = [];

      if (runwayMonths < 3) {
        recommendations.push('🚨 CRITICAL: DAO has less than 3 months of runway. Implement cost reduction immediately.');
        recommendations.push('💰 Consider seeking treasury grants or fundraising.');
      } else if (runwayMonths < 6) {
        recommendations.push('⚠️ WARNING: DAO has less than 6 months of runway. Plan cost optimization.');
        recommendations.push('📊 Review expense categories and prioritize critical operations.');
      } else if (runwayMonths < 12) {
        recommendations.push('ℹ️ DAO has less than 12 months of runway. Monitor burn rate closely.');
        recommendations.push('🎯 Develop revenue diversification strategy.');
      } else {
        recommendations.push('✅ DAO has healthy runway (>12 months). Continue current trajectory.');
        recommendations.push('🚀 Consider growth investments or new initiatives.');
      }

      if (burnMetrics.trend === 'ACCELERATING') {
        recommendations.push('⚠️ ALERT: Burn rate is accelerating. Investigate cause and implement controls.');
      }

      return {
        daoId,
        currentBalance,
        dailyBurnRate,
        runwayMonths,
        runwayDays,
        projectedEmptyDate,
        confidenceLevel,
        recommendations,
      };
    } catch (error) {
      console.error('❌ Error forecasting runway:', error);
      throw error;
    }
  }

  // ==================== CORRELATION ANALYSIS ====================

  /**
   * PRODUCTION: Analyze portfolio correlation using 90-day historical price data
   */
  async portfolioCorrelationAnalysis(vaultId: string): Promise<PortfolioCorrelation> {
    try {
      const vault = await db.query.vaults.findFirst({
        where: eq(vaults.id, vaultId as any),
      });

      if (!vault) {
        throw new Error(`Vault not found: ${vaultId}`);
      }

      // Get vault holdings/allocations
      const allocations = await db.execute(sql`
        SELECT asset_symbol, allocation_percentage FROM vault_strategy_allocations
        WHERE vault_id = ${vaultId}
      `);

      if (allocations.length === 0) {
        return {
          vaultId,
          correlations: new Map(),
          diversificationScore: 0,
          systemicRisk: 0,
          idiosyncratiRisk: 1,
        };
      }

      // Fetch 90-day price history for each asset
      const assetSymbols = allocations.map(a => a.asset_symbol);
      const priceHistories = await this._fetchPriceHistories(assetSymbols, 90);

      // Calculate correlation matrix
      const correlations = this._calculateCorrelationMatrix(priceHistories);

      // Build correlation profile
      const vaultCorrelations = new Map<string, number>();
      for (const asset of assetSymbols) {
        if (correlations.has(asset)) {
          vaultCorrelations.set(asset, correlations.get(asset)!);
        }
      }

      // Calculate diversification score (0-100)
      const avgCorrelation = Array.from(vaultCorrelations.values()).reduce((a, b) => a + b, 0) / vaultCorrelations.size;
      const diversificationScore = Math.max(0, Math.min(100, (1 - avgCorrelation) * 100));

      // Systemic risk = average correlation (market exposure)
      const systemicRisk = Math.max(0, Math.min(1, avgCorrelation));

      // Idiosyncratic risk = unique risk (1 - systemic)
      const idiosyncratiRisk = 1 - systemicRisk;

      return {
        vaultId,
        correlations: vaultCorrelations,
        diversificationScore,
        systemicRisk,
        idiosyncratiRisk,
      };
    } catch (error) {
      console.error('❌ Error analyzing portfolio correlation:', error);
      throw error;
    }
  }

  /**
   * PRODUCTION: Fetch 90-day price history from CoinGecko for multiple assets
   */
  private async _fetchPriceHistories(
    symbols: string[],
    days: number = 90
  ): Promise<Map<string, number[]>> {
    const histories = new Map<string, number[]>();

    for (const symbol of symbols) {
      try {
        // Map symbol to CoinGecko ID (simplified mapping)
        const coinMap: {[key: string]: string} = {
          'ETH': 'ethereum',
          'USDC': 'usd-coin',
          'USDT': 'tether',
          'BTC': 'bitcoin',
          'MTAA': 'mtaa',  // Your DAO token
          'STETH': 'staked-ether',
          'CURVE': 'curve-dao-token',
        };

        const coinId = coinMap[symbol] || symbol.toLowerCase();

        // Fetch market chart data
        const response = await axios.get(
          `${COINGECKO_API}/coins/${coinId}/market_chart`,
          {
            params: {
              vs_currency: 'usd',
              days,
              interval: 'daily',
            },
          }
        );

        // Extract prices array
        const prices = response.data.prices.map((p: [number, number]) => p[1]);
        histories.set(symbol, prices);
      } catch (error) {
        console.warn(`⚠️ Could not fetch price history for ${symbol}:`, error);
        // Fallback: empty array
        histories.set(symbol, []);
      }
    }

    return histories;
  }

  /**
   * PRODUCTION: Calculate Pearson correlation matrix from price histories
   */
  private _calculateCorrelationMatrix(priceHistories: Map<string, number[]>): Map<string, number> {
    const correlations = new Map<string, number>();
    const symbols = Array.from(priceHistories.keys());

    // Convert prices to daily returns
    const returns = new Map<string, number[]>();
    for (const [symbol, prices] of priceHistories.entries()) {
      const dailyReturns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        const ret = (prices[i] - prices[i - 1]) / prices[i - 1];
        dailyReturns.push(ret);
      }
      returns.set(symbol, dailyReturns);
    }

    // Calculate average correlation with market (sum of all pairwise correlations)
    let totalCorr = 0;
    let pairCount = 0;

    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const ret1 = returns.get(symbols[i]) || [];
        const ret2 = returns.get(symbols[j]) || [];

        if (ret1.length > 0 && ret2.length > 0) {
          const corr = this._calculatePearsonCorrelation(ret1, ret2);
          totalCorr += corr;
          pairCount++;
        }
      }
    }

    // Average correlation is the average of all pairs
    const avgCorrelation = pairCount > 0 ? totalCorr / pairCount : 0;

    for (const symbol of symbols) {
      correlations.set(symbol, avgCorrelation);
    }

    return correlations;
  }

  /**
   * PRODUCTION: Calculate Pearson correlation coefficient
   */
  private _calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let xVariance = 0;
    let yVariance = 0;

    for (let i = 0; i < n; i++) {
      const xDev = x[i] - xMean;
      const yDev = y[i] - yMean;

      numerator += xDev * yDev;
      xVariance += xDev * xDev;
      yVariance += yDev * yDev;
    }

    const denominator = Math.sqrt(xVariance * yVariance);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  // ==================== RISK METRICS ====================

  /**
   * Calculate Value at Risk (VaR) and other risk metrics
   */
  async calculateRiskMetrics(vaultId: string): Promise<RiskMetrics> {
    try {
      // Get 365 days of performance data
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 365);

      const performanceData = await db.execute(sql`
        SELECT daily_return, vault_value FROM vault_performance
        WHERE vault_id = ${vaultId}
        AND date >= ${cutoffDate}
        ORDER BY date ASC
      `);

      if (performanceData.length < 2) {
        return {
          vaultId,
          valueAtRisk95: 0,
          valueAtRisk99: 0,
          volatility: 0,
          sharpeRatio: 0,
          sortinoRatio: 0,
          maxDrawdown: 0,
          recoveryTime: 0,
        };
      }

      // Calculate volatility
      const returns = performanceData.map(p => p.daily_return);
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance) * 100;  // Convert to %

      // Calculate daily volatility for percentile-based VaR
      const sortedReturns = [...returns].sort((a, b) => a - b);
      const index95 = Math.floor(sortedReturns.length * 0.05);  // 5th percentile
      const index99 = Math.floor(sortedReturns.length * 0.01);  // 1st percentile

      const currentValue = performanceData[performanceData.length - 1].vault_value;
      const valueAtRisk95 = currentValue * Math.abs(sortedReturns[index95]);
      const valueAtRisk99 = currentValue * Math.abs(sortedReturns[index99]);

      // Calculate Sharpe Ratio (using daily risk-free rate ≈ 0.02%)
      const riskFreeRate = 0.0002;
      const sharpeRatio = (avgReturn - riskFreeRate) / (volatility / 100);

      // Calculate Sortino Ratio (downside capture)
      const downside = returns
        .filter(r => r < 0)
        .reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
      const downsideDeviation = Math.sqrt(downside);
      const sortinoRatio = (avgReturn - riskFreeRate) / downsideDeviation;

      // Calculate max drawdown
      let maxDrawdown = 0;
      let peak = performanceData[0].vault_value;
      for (const data of performanceData) {
        if (data.vault_value > peak) {
          peak = data.vault_value;
        }
        const drawdown = (peak - data.vault_value) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }

      // Calculate recovery time (days to recover from max drawdown)
      let recoveryTime = 0;
      let recoveryStarted = false;
      for (let i = 1; i < performanceData.length; i++) {
        const prevValue = performanceData[i - 1].vault_value;
        const currValue = performanceData[i].vault_value;
        if (!recoveryStarted && currValue > prevValue) {
          recoveryStarted = true;
        }
        if (recoveryStarted) {
          recoveryTime++;
          if (currValue >= peak) break;
        }
      }

      return {
        vaultId,
        valueAtRisk95,
        valueAtRisk99,
        volatility,
        sharpeRatio,
        sortinoRatio,
        maxDrawdown: maxDrawdown * 100,  // Convert to %
        recoveryTime,
      };
    } catch (error) {
      console.error('❌ Error calculating risk metrics:', error);
      throw error;
    }
  }

  // ==================== PERFORMANCE ANALYSIS ====================

  /**
   * Analyze vault performance over period
   */
  async analyzePerformance(
    vaultId: string,
    days: number = 365
  ): Promise<PerformanceAnalysis> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const performanceData = await db.execute(sql`
        SELECT daily_return, vault_value FROM vault_performance
        WHERE vault_id = ${vaultId}
        AND date >= ${cutoffDate}
        ORDER BY date ASC
      `);

      if (performanceData.length === 0) {
        return {
          vaultId,
          period: {days},
          totalReturn: 0,
          annualizedReturn: 0,
          cumulativeReturn: 0,
          bestDay: 0,
          worstDay: 0,
          winRate: 0,
        };
      }

      // Total return calculation
      const startValue = performanceData[0].vault_value;
      const endValue = performanceData[performanceData.length - 1].vault_value;
      const totalReturn = ((endValue - startValue) / startValue) * 100;

      // Annualized return
      const periods = days / 365;
      const annualizedReturn = (Math.pow(endValue / startValue, 1 / periods) - 1) * 100;

      // Cumulative return in USD
      const cumulativeReturn = endValue - startValue;

      // Daily returns analysis
      const dailyReturns = performanceData.map(p => p.daily_return);
      const bestDay = Math.max(...dailyReturns) * 100;
      const worstDay = Math.min(...dailyReturns) * 100;

      // Win rate
      const positiveReturns = dailyReturns.filter(r => r > 0).length;
      const winRate = (positiveReturns / dailyReturns.length) * 100;

      return {
        vaultId,
        period: {days},
        totalReturn,
        annualizedReturn,
        cumulativeReturn,
        bestDay,
        worstDay,
        winRate,
      };
    } catch (error) {
      console.error('❌ Error analyzing performance:', error);
      throw error;
    }
  }

  // ==================== HEALTH DASHBOARD ====================

  /**
   * Generate comprehensive health dashboard for DAO
   */
  async generateDAOHealthDashboard(daoId: string): Promise<{
    burnRate: BurnRateMetrics;
    runway: RunwayForecast;
    healthScore: number;  // 0-100
    recommendations: string[];
  }> {
    try {
      const burnRate = await this.calculateBurnRate(daoId, 90);
      const runway = await this.forecastRunway(daoId);

      // Calculate health score (100 = excellent, 0 = critical)
      let healthScore = 100;

      // Deduct for runway (max -50 points)
      if (runway.runwayMonths < 3) healthScore -= 50;
      else if (runway.runwayMonths < 6) healthScore -= 30;
      else if (runway.runwayMonths < 12) healthScore -= 15;

      // Deduct for burn rate trend (max -20 points)
      if (burnRate.trend === 'ACCELERATING') healthScore -= 20;
      else if (burnRate.trend === 'STABLE') healthScore -= 5;

      // Deduct for transaction volatility (max -30 points)
      const volatility = burnRate.monthlyBurnRate / (burnRate.averageTransactionSize || 1);
      if (volatility > 100) healthScore -= 30;
      else if (volatility > 50) healthScore -= 15;

      healthScore = Math.max(0, Math.min(100, healthScore));

      return {
        burnRate,
        runway,
        healthScore,
        recommendations: runway.recommendations,
      };
    } catch (error) {
      console.error('❌ Error generating health dashboard:', error);
      throw error;
    }
  }

  // ==================== UTILITIES ====================

  /**
   * Internal: Get total DAO balance
   */
  private async _getDAOBalance(daoId: string): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COALESCE(SUM(balance), 0) as total FROM wallet_transactions
        WHERE dao_id = ${daoId}
      `);

      return result[0]?.total || 0;
    } catch (error) {
      console.error('❌ Error getting DAO balance:', error);
      return 0;
    }
  }

  /**
   * Export analytics as JSON report
   */
  async exportAnalyticsReport(daoId: string): Promise<string> {
    try {
      const burnRate = await this.calculateBurnRate(daoId, 90);
      const runway = await this.forecastRunway(daoId);
      const dashboard = await this.generateDAOHealthDashboard(daoId);

      return JSON.stringify({
        generatedAt: new Date().toISOString(),
        daoId,
        burnRate,
        runway,
        healthDashboard: dashboard,
      }, null, 2);
    } catch (error) {
      console.error('❌ Error exporting analytics:', error);
      throw error;
    }
  }
}

export const advancedAnalyticsService = new AdvancedAnalyticsService();
