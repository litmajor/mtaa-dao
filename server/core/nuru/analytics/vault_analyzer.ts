/**
 * Vault Analyzer
 * 
 * Analyzes vault performance, strategy execution, asset allocation,
 * and risk-adjusted returns to provide comprehensive vault insights
 */

import type { AnalysisResponse, Risk } from '../types';
import { db } from '../../../db';
import { vaults, walletTransactions, contributions } from '../../../../shared/schema';
import { eq, and, sql, desc, gte, count } from 'drizzle-orm';

export interface VaultHealthMetrics {
  vaultCount: number;
  totalTVL: number;
  averageAPY: number;
  bestPerformingVault: string;
  worstPerformingVault: string;
  vaultHealth: number;
}

export class VaultAnalyzer {
  /**
   * Analyze vault ecosystem health and performance
   */
  async analyze(daoId: string, timeframe?: string): Promise<AnalysisResponse> {
    const metricsData = await this.calculateMetrics(daoId, timeframe);
    const insights = this.generateInsights(metricsData);
    const risks = this.identifyRisks(metricsData);
    
    const metrics: Record<string, number> = {};
    if (typeof metricsData === 'object' && metricsData !== null) {
      metrics.vaultCount = metricsData.vaultCount || 0;
      metrics.totalTVL = metricsData.totalTVL || 0;
      metrics.averageAPY = metricsData.averageAPY || 0;
      metrics.totalValueLocked = metricsData.totalTVL || 0;
      metrics.vaultHealth = metricsData.vaultHealth || 0;
    }

    return {
      metrics,
      summary: `Vault ecosystem shows ${metricsData.vaultHealth}% health with ${metricsData.vaultCount} active vaults managing $${(metricsData.totalTVL / 1000000).toFixed(2)}M in total value`,
      insights,
      risks,
      recommendations: this.generateRecommendations(metricsData, risks),
      threatLevel: risks.length > 0 ? 'medium' : 'low',
      details: metricsData
    };
  }

  /**
   * Analyze specific vault performance
   */
  async analyzeVaultPerformance(vaultId: string, timeframe?: string = '30d') {
    try {
      const vault = await db.query.vaults.findFirst({
        where: (vaults, { eq }) => eq(vaults.id, vaultId)
      });

      if (!vault) {
        return {
          error: 'Vault not found',
          vaultId
        };
      }

      const timeframeMs = this.parseTimeframeDays(timeframe) * 24 * 60 * 60 * 1000;
      const startDate = new Date(Date.now() - timeframeMs);

      // Get vault transactions
      const transactions = await db.query.walletTransactions.findMany({
        where: (tx, { and, gte }) => and(
          eq(tx.vaultId, vaultId),
          gte(tx.createdAt, startDate)
        ),
        orderBy: (tx) => desc(tx.createdAt),
        limit: 1000
      });

      // Calculate performance metrics
      const deposits = transactions.filter(t => t.type === 'deposit');
      const withdrawals = transactions.filter(t => t.type === 'withdrawal');

      const totalDeposited = deposits.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalWithdrawn = withdrawals.reduce((sum, t) => sum + (t.amount || 0), 0);
      const netFlow = totalDeposited - totalWithdrawn;

      // Calculate returns (simplified)
      const estimatedValue = (vault.balance || 0);
      const realizedReturn = estimatedValue - totalDeposited;
      const returnPercentage = totalDeposited > 0 ? (realizedReturn / totalDeposited) * 100 : 0;

      // Annualize the return
      const daysInPeriod = this.parseTimeframeDays(timeframe);
      const annualizedReturn = (returnPercentage * 365) / daysInPeriod;

      return {
        vaultId,
        name: vault.name,
        type: vault.type,
        balance: vault.balance,
        totalDeposited,
        totalWithdrawn,
        netFlow,
        realizedReturn,
        returnPercentage,
        annualizedAPY: annualizedReturn,
        transactionCount: transactions.length,
        depositCount: deposits.length,
        withdrawalCount: withdrawals.length,
        timeframe,
        riskProfile: this.assessRiskProfile(vault, transactions),
        rebalancingNeeded: this.detectRebalancingNeeded(vault),
        recommendations: this.generateVaultRecommendations(vault, returnPercentage, annualizedReturn)
      };
    } catch (error) {
      console.error('Error analyzing vault performance:', error);
      return { error: 'Failed to analyze vault performance' };
    }
  }

  /**
   * Calculate portfolio composition metrics
   */
  async analyzePortfolioComposition(daoId: string) {
    try {
      const daoVaults = await db.query.vaults.findMany({
        where: (vaults, { eq }) => eq(vaults.daoId, daoId)
      });

      const composition: Record<string, any> = {};
      let totalValue = 0;

      for (const vault of daoVaults) {
        const value = vault.balance || 0;
        totalValue += value;
        
        const vaultType = vault.type || 'unknown';
        composition[vaultType] = (composition[vaultType] || 0) + value;
      }

      // Convert to percentages
      const percentages: Record<string, number> = {};
      if (totalValue > 0) {
        for (const [type, value] of Object.entries(composition)) {
          percentages[type] = (value as number / totalValue) * 100;
        }
      }

      return {
        vaultCount: daoVaults.length,
        totalTVL: totalValue,
        composition,
        percentages,
        diversification: this.calculateDiversificationScore(percentages),
        recommendations: this.recommendCompositionAdjustments(percentages)
      };
    } catch (error) {
      console.error('Error analyzing portfolio composition:', error);
      return { error: 'Failed to analyze portfolio composition' };
    }
  }

  /**
   * Track rebalancing impact and effectiveness
   */
  async analyzeRebalancingImpact(vaultId: string, timeframe?: string = '90d') {
    try {
      const timeframeMs = this.parseTimeframeDays(timeframe) * 24 * 60 * 60 * 1000;
      const startDate = new Date(Date.now() - timeframeMs);

      // Get rebalancing transactions (identified by specific patterns)
      const transactions = await db.query.walletTransactions.findMany({
        where: (tx, { and, gte }) => and(
          eq(tx.vaultId, vaultId),
          gte(tx.createdAt, startDate)
        ),
        orderBy: (tx) => desc(tx.createdAt)
      });

      // Identify rebalancing events (multiple transactions in short time)
      const rebalancingEvents = this.identifyRebalancingEvents(transactions);

      // Calculate effectiveness
      const effectiveness = rebalancingEvents.map((event: any) => ({
        timestamp: event.timestamp,
        targetAllocation: event.targetAllocation,
        actualAllocation: event.actualAllocation,
        driftBefore: event.driftBefore,
        driftAfter: event.driftAfter,
        effectiveness: ((event.driftBefore - event.driftAfter) / event.driftBefore) * 100,
        impact: event.impact
      }));

      const avgEffectiveness = effectiveness.length > 0
        ? effectiveness.reduce((sum: number, e: any) => sum + e.effectiveness, 0) / effectiveness.length
        : 0;

      return {
        vaultId,
        timeframe,
        rebalancingEventCount: rebalancingEvents.length,
        averageEffectiveness: avgEffectiveness,
        events: effectiveness,
        recommendations: this.recommendRebalancingStrategy(avgEffectiveness, rebalancingEvents.length)
      };
    } catch (error) {
      console.error('Error analyzing rebalancing impact:', error);
      return { error: 'Failed to analyze rebalancing impact' };
    }
  }

  /**
   * Calculate fee impact analysis
   */
  async analyzeFeeImpact(vaultId: string, timeframe?: string = '30d') {
    try {
      const vault = await db.query.vaults.findFirst({
        where: (vaults, { eq }) => eq(vaults.id, vaultId)
      });

      if (!vault) {
        return { error: 'Vault not found' };
      }

      const timeframeMs = this.parseTimeframeDays(timeframe) * 24 * 60 * 60 * 1000;
      const startDate = new Date(Date.now() - timeframeMs);

      const transactions = await db.query.walletTransactions.findMany({
        where: (tx, { and, gte }) => and(
          eq(tx.vaultId, vaultId),
          gte(tx.createdAt, startDate)
        )
      });

      // Estimate fees (would need actual fee data in schema)
      const estimatedTotalFees = transactions.reduce((sum, tx) => {
        const feePercent = this.estimateFeePercent(tx.type as string);
        return sum + ((tx.amount || 0) * feePercent);
      }, 0);

      const totalTransactionValue = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const effectiveFeeRate = totalTransactionValue > 0 ? (estimatedTotalFees / totalTransactionValue) * 100 : 0;

      // Calculate impact on returns
      const estimatedReturnWithoutFees = vault.balance ? (vault.balance * 0.1) : 0; // Assume 10% return
      const returnImpact = (estimatedTotalFees / (estimatedReturnWithoutFees || 1)) * 100;

      return {
        vaultId,
        timeframe,
        estimatedTotalFees,
        effectiveFeeRate,
        transactionCount: transactions.length,
        returnImpactPercent: Math.min(returnImpact, 100),
        recommendations: this.recommendFeeOptimization(effectiveFeeRate)
      };
    } catch (error) {
      console.error('Error analyzing fee impact:', error);
      return { error: 'Failed to analyze fee impact' };
    }
  }

  private async calculateMetrics(daoId: string, timeframe?: string) {
    try {
      const daoVaults = await db.query.vaults.findMany({
        where: (vaults, { eq }) => eq(vaults.daoId, daoId)
      });

      if (daoVaults.length === 0) {
        return {
          vaultCount: 0,
          totalTVL: 0,
          averageAPY: 0,
          vaultHealth: 0
        };
      }

      const totalTVL = daoVaults.reduce((sum, v) => sum + (v.balance || 0), 0);
      const averageAPY = daoVaults.reduce((sum, v) => sum + (v.apy || 0), 0) / daoVaults.length;

      // Find best and worst performing
      const sortedByAPY = [...daoVaults].sort((a, b) => (b.apy || 0) - (a.apy || 0));
      const bestPerforming = sortedByAPY[0]?.name || 'N/A';
      const worstPerforming = sortedByAPY[sortedByAPY.length - 1]?.name || 'N/A';

      // Calculate health (0-100)
      const healthFactors = [
        Math.min(totalTVL / 1000000 * 10, 30), // TVL factor (max 30 points)
        Math.min(averageAPY * 2, 30), // APY factor (max 30 points)
        Math.min(daoVaults.length * 10, 20), // Diversification factor (max 20 points)
        20 // Operational health (max 20 points)
      ];
      const vaultHealth = Math.round(healthFactors.reduce((a, b) => a + b, 0));

      return {
        vaultCount: daoVaults.length,
        totalTVL,
        averageAPY,
        bestPerformingVault: bestPerforming,
        worstPerformingVault: worstPerforming,
        vaultHealth,
        vaults: daoVaults
      };
    } catch (error) {
      console.error('Error calculating vault metrics:', error);
      return {
        vaultCount: 0,
        totalTVL: 0,
        averageAPY: 0,
        vaultHealth: 0
      };
    }
  }

  private generateInsights(metrics: any): string[] {
    const insights: string[] = [];

    if (!metrics.vaultCount) {
      insights.push('No vaults exist yet. Consider creating vaults to begin investing.');
      return insights;
    }

    insights.push(`Operating ${metrics.vaultCount} vaults with $${(metrics.totalTVL / 1000000).toFixed(2)}M in total value`);

    if (metrics.averageAPY > 10) {
      insights.push(`Strong average APY of ${metrics.averageAPY.toFixed(1)}% indicates high-performing strategies`);
    } else if (metrics.averageAPY > 5) {
      insights.push(`Moderate APY of ${metrics.averageAPY.toFixed(1)}% - consider strategy optimization`);
    } else {
      insights.push(`Low APY of ${metrics.averageAPY.toFixed(1)}% - may need strategic review`);
    }

    if (metrics.vaultCount > 5) {
      insights.push('Good portfolio diversification with multiple vault strategies');
    }

    return insights;
  }

  private identifyRisks(metrics: any): Risk[] {
    const risks: Risk[] = [];

    if (metrics.vaultCount === 0) {
      risks.push({
        type: 'NO_VAULTS',
        severity: 'high',
        description: 'No vaults established',
        recommendation: 'Create vaults to enable investment strategies'
      });
      return risks;
    }

    if (metrics.totalTVL < 1000) {
      risks.push({
        type: 'LOW_TVL',
        severity: 'medium',
        description: `Low TVL: $${metrics.totalTVL}. Consider vault marketing to increase deposits`,
        recommendation: 'Increase vault visibility and incentivize deposits'
      });
    }

    if (metrics.averageAPY < 3) {
      risks.push({
        type: 'LOW_RETURNS',
        severity: 'medium',
        description: 'Below-market returns detected',
        recommendation: 'Review strategy and consider rebalancing'
      });
    }

    return risks;
  }

  private generateRecommendations(metrics: any, risks: Risk[]): string[] {
    const recommendations: string[] = [];

    if (risks.length > 0) {
      recommendations.push(`Address ${risks.length} identified risks to improve vault performance`);
    }

    if (metrics.vaultCount < 3) {
      recommendations.push('Expand vault offerings - aim for 3-5 different strategies');
    }

    if (metrics.averageAPY > 15) {
      recommendations.push('High returns detected - consider risk factors and whether returns are sustainable');
    }

    recommendations.push(`Focus on vault '${metrics.bestPerformingVault}' strategies for insights`);

    return recommendations;
  }

  private assessRiskProfile(vault: any, transactions: any[]): string {
    // Simplified risk assessment
    const volatility = transactions.length > 10 
      ? 'moderate' 
      : 'low';
    
    const size = vault.balance > 1000000 ? 'high' : 'moderate';
    
    return `${volatility}-${size}`;
  }

  private detectRebalancingNeeded(vault: any): boolean {
    // Check if vault needs rebalancing based on drift
    return Math.random() < 0.3; // Placeholder
  }

  private generateVaultRecommendations(vault: any, returnPercent: number, annualizedReturn: number): string[] {
    const recs: string[] = [];

    if (annualizedReturn < 5) {
      recs.push('Consider adjusting strategy - returns below market');
    }
    
    if (vault.balance < 10000) {
      recs.push('Build AUM to improve economies of scale');
    }

    return recs;
  }

  private calculateDiversificationScore(percentages: Record<string, number>): number {
    // Herfindahl index for diversification
    const hIndex = Object.values(percentages).reduce((sum, p) => sum + (p / 100) ** 2, 0);
    return Math.round((1 - hIndex) * 100);
  }

  private recommendCompositionAdjustments(percentages: Record<string, number>): string[] {
    const recommendations: string[] = [];
    
    const maxAllocation = Math.max(...Object.values(percentages));
    if (maxAllocation > 60) {
      recommendations.push('High concentration detected - consider diversification');
    }

    return recommendations;
  }

  private identifyRebalancingEvents(transactions: any[]): any[] {
    // Simplified rebalancing event detection
    return [];
  }

  private recommendRebalancingStrategy(effectiveness: number, eventCount: number): string[] {
    const recommendations: string[] = [];

    if (effectiveness < 50) {
      recommendations.push('Rebalancing effectiveness is low - consider different strategy');
    }

    if (eventCount > 12) {
      recommendations.push('Frequent rebalancing detected - may generate unnecessary fees');
    }

    return recommendations;
  }

  private estimateFeePercent(txType: string): number {
    // Placeholder fee estimation
    return 0.001; // 0.1%
  }

  private recommendFeeOptimization(feeRate: number): string[] {
    const recommendations: string[] = [];

    if (feeRate > 0.5) {
      recommendations.push('High fee rate detected - negotiate better terms or switch providers');
    }

    return recommendations;
  }

  private parseTimeframeDays(timeframe?: string): number {
    if (!timeframe) return 30;
    
    const match = timeframe.match(/(\d+)([dhm])/);
    if (!match) return 30;
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 'd': return value;
      case 'h': return Math.ceil(value / 24);
      case 'm': return value * 30;
      default: return 30;
    }
  }
}
