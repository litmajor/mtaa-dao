/**
 * Financial Analyzer
 * 
 * Analyzes DAO treasury health, cash flow, and financial metrics
 */

import type { AnalysisResponse, Risk } from '../types';
import { db } from '../../../db';
import { vaults, walletTransactions } from '../../../../shared/schema';
import { eq, and, sql, desc, gte } from 'drizzle-orm';

export class FinancialAnalyzer {
  /**
   * Analyze treasury health and financial metrics
   */
  async analyze(daoId: string, timeframe?: string): Promise<AnalysisResponse> {
    const metrics = await this.calculateMetrics(daoId, timeframe);
    const insights = this.generateInsights(metrics);
    const risks = this.identifyRisks(metrics);
    
    return {
      summary: this.generateSummary(metrics),
      metrics,
      insights,
      risks,
      recommendations: this.generateRecommendations(metrics, risks)
    };
  }

  private async calculateMetrics(daoId: string, timeframe?: string) {
    // Calculate the time window
    let since: Date | undefined = undefined;
    let periodDays = 30; // Default
    if (timeframe === 'all') {
      // No time filter
    } else {
      periodDays = this.parseTimeframeDays(timeframe);
      if (periodDays > 0) {
        since = new Date();
        since.setDate(since.getDate() - periodDays);
      } else {
        // Default to 30 days
        periodDays = 30;
        since = new Date();
        since.setDate(since.getDate() - 30);
      }
    }

    // Get all vaults for the DAO - current balance (assume always lifetime/latest)
    const daoVaults = await db.select().from(vaults).where(eq(vaults.daoId, daoId));
    const currentBalance = daoVaults.reduce((sum, vault) => sum + parseFloat(vault.balance || '0'), 0);

    // Get transactions for the period (or all if no timeframe)
    const txWhere = since
      ? and(eq(walletTransactions.daoId, daoId), gte(walletTransactions.createdAt, since))
      : eq(walletTransactions.daoId, daoId);
    const txs = await db.select().from(walletTransactions).where(txWhere);

    let totalInflow = 0;
    let totalOutflow = 0;
    let contributionsCount = 0;
    let withdrawalsCount = 0;
    let sumContributions = 0;
    let sumWithdrawals = 0;

    txs.forEach(tx => {
      const amount = parseFloat(tx.amount || '0');
      if (tx.type === 'deposit' || tx.type === 'contribution') {
        totalInflow += amount;
        contributionsCount++;
        sumContributions += amount;
      } else if (tx.type === 'withdrawal' || tx.type === 'disbursement') {
        totalOutflow += amount;
        withdrawalsCount++;
        sumWithdrawals += amount;
      }
    });

    const netChange = totalInflow - totalOutflow;

    // Normalize burn rate to monthly (assume 30 days/month)
    const monthlyBurnRate = (totalOutflow / periodDays) * 30;

    // Runway in months
    const runway = monthlyBurnRate > 0 ? currentBalance / monthlyBurnRate : Infinity;

    const avgContribution = contributionsCount > 0 ? sumContributions / contributionsCount : 0;
    const avgWithdrawal = withdrawalsCount > 0 ? sumWithdrawals / withdrawalsCount : 0;

    // Treasury growth rate: netChange / (previous balance proxy: current - netChange)
    let treasuryGrowthRate = 0;
    const previousBalance = currentBalance - netChange;
    if (previousBalance > 0) {
      treasuryGrowthRate = netChange / previousBalance;
    }

    // If no timeframe, use placeholder or calculate properly if needed
    if (!since) {
      // For 'all', assume periodDays as total days from first tx or default
      // For simplicity, assume 365 days or fetch min createdAt
      const minDate = await db.select({ min: sql<string>`min(${walletTransactions.createdAt})` })
        .from(walletTransactions)
        .where(eq(walletTransactions.daoId, daoId));
      const firstTxDate = minDate[0]?.min ? new Date(minDate[0].min as string) : new Date();
      periodDays = Math.max(1, Math.ceil((new Date().getTime() - firstTxDate.getTime()) / (1000 * 3600 * 24)));
      const monthlyBurnRateAll = (totalOutflow / periodDays) * 30;
      const runwayAll = monthlyBurnRateAll > 0 ? currentBalance / monthlyBurnRateAll : Infinity;
      return {
        currentBalance,
        totalInflow,
        totalOutflow,
        netChange,
        burnRate: monthlyBurnRateAll,
        runway: Math.floor(runwayAll),
        contributionsCount,
        withdrawalsCount,
        avgContribution,
        avgWithdrawal,
        treasuryGrowthRate
      };
    }

    return {
      currentBalance,
      totalInflow,
      totalOutflow,
      netChange,
      burnRate: monthlyBurnRate,
      runway: Math.floor(runway),
      contributionsCount,
      withdrawalsCount,
      avgContribution,
      avgWithdrawal,
      treasuryGrowthRate
    };
  }

  private parseTimeframeDays(timeframe?: string): number {
    if (!timeframe) return 30;
    if (timeframe === '7d') return 7;
    if (timeframe === '30d') return 30;
    if (timeframe === '90d') return 90;
    const match = timeframe.match(/^(\d+)d$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private generateSummary(metrics: Record<string, number>): string {
    const balance = metrics.currentBalance.toLocaleString();
    const growth = (metrics.treasuryGrowthRate * 100).toFixed(1);
    const runway = Number.isFinite(metrics.runway) ? Math.floor(metrics.runway) : 'indefinite';
    
    return `Treasury balance is $${balance} with a ${growth}% growth rate. Current runway is ${runway} months at the current burn rate.`;
  }

  private generateInsights(metrics: Record<string, number>): string[] {
    const insights: string[] = [];
    
    if (metrics.treasuryGrowthRate > 0.1) {
      insights.push('Strong treasury growth indicates healthy community engagement');
    }
    
    if (!Number.isFinite(metrics.runway) || metrics.runway > 12) {
      insights.push('Excellent runway provides financial stability');
    } else if (metrics.runway < 6) {
      insights.push('Limited runway suggests need for fundraising or reduced spending');
    }
    
    if (metrics.avgContribution > metrics.avgWithdrawal) {
      insights.push('Positive contribution-to-withdrawal ratio shows sustainable model');
    }
    
    if (metrics.contributionsCount > metrics.withdrawalsCount * 3) {
      insights.push('High number of contributors creates strong community foundation');
    }
    
    return insights;
  }

  private identifyRisks(metrics: Record<string, number>): Risk[] {
    const risks: Risk[] = [];
    
    if (Number.isFinite(metrics.runway)) {
      if (metrics.runway < 3) {
        risks.push({
          level: 'critical',
          category: 'liquidity',
          description: 'Treasury runway is critically low',
          mitigation: 'Initiate fundraising campaign or reduce spending'
        });
      } else if (metrics.runway < 6) {
        risks.push({
          level: 'high',
          category: 'liquidity',
          description: 'Treasury runway is below safe threshold',
          mitigation: 'Plan fundraising activities and review spending'
        });
      }
    }
    
    // Normalize inflow to monthly for comparison
    const monthlyInflow = (metrics.totalInflow / (metrics.burnRate / 30)) * 30; // Approximate
    if (metrics.burnRate > monthlyInflow) {
      risks.push({
        level: 'medium',
        category: 'sustainability',
        description: 'Burn rate exceeds average monthly income',
        mitigation: 'Review operational costs and optimize spending'
      });
    }
    
    return risks;
  }

  private generateRecommendations(
    metrics: Record<string, number>,
    risks: Risk[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (risks.length > 0) {
      if (risks.some(r => r.level === 'critical' || r.level === 'high')) {
        recommendations.push('Review and reduce non-essential spending immediately');
        recommendations.push('Launch member contribution campaign');
      }
    }
    
    if (metrics.treasuryGrowthRate > 0.2) {
      recommendations.push('Consider allocating surplus to long-term investments');
    }
    
    if (metrics.contributionsCount < 20) {
      recommendations.push('Implement member incentive program to increase participation');
    }
    
    recommendations.push('Maintain emergency fund of at least 3 months runway');
    
    return recommendations;
  }
}