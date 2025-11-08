/**
 * Financial Analyzer
 * 
 * Analyzes DAO treasury health, cash flow, and financial metrics
 */


import type { AnalysisResponse, Risk } from '../types';
import { db } from '../../../db';
import { vaults, walletTransactions } from '../../../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export class FinancialAnalyzer {
  /**
   * Analyze treasury health and financial metrics
   */
  async analyze(daoId: string, timeframe?: string): Promise<AnalysisResponse> {
    // TODO: Implement actual data fetching from database/blockchain
    // For now, returning structured mock data
    
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
    if (timeframe === '30d' || !timeframe) {
      since = new Date();
      since.setDate(since.getDate() - 30);
    } else if (timeframe === '7d') {
      since = new Date();
      since.setDate(since.getDate() - 7);
    }

    // Get all vaults for the DAO
    const daoVaults = await db.query.vaults.findMany({ where: eq(vaults.daoId, daoId) });
    const currentBalance = daoVaults.reduce((sum, vault) => sum + parseFloat(vault.balance || '0'), 0);

    // Get all wallet transactions for the DAO (optionally filter by timeframe)
    let txWhere: any = eq(walletTransactions.daoId, daoId);
    if (since) {
      txWhere = and(txWhere, sql`${walletTransactions.createdAt} >= ${since}`);
    }
    const txs = await db.query.walletTransactions.findMany({ where: txWhere });

    let totalInflow = 0;
    let totalOutflow = 0;
    let contributionsCount = 0;
    let withdrawalsCount = 0;
    let sumContributions = 0;
    let sumWithdrawals = 0;

    txs.forEach((tx: typeof walletTransactions.$inferSelect) => {
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
    const burnRate = totalOutflow / ((since ? 1 : 1)); // per period (default: month)
    const runway = burnRate > 0 ? currentBalance / burnRate : 999;
    const avgContribution = contributionsCount > 0 ? sumContributions / contributionsCount : 0;
    const avgWithdrawal = withdrawalsCount > 0 ? sumWithdrawals / withdrawalsCount : 0;

    // Calculate treasury growth rate (compare to previous period if possible)
    // For now, use netChange/currentBalance as a proxy
    let treasuryGrowthRate = 0;
    if (currentBalance > 0) {
      treasuryGrowthRate = netChange / currentBalance;
    }

    return {
      currentBalance,
      totalInflow,
      totalOutflow,
      netChange,
      burnRate,
      runway: Math.floor(runway),
      contributionsCount,
      withdrawalsCount,
      avgContribution,
      avgWithdrawal,
      treasuryGrowthRate
    };
  }

  private generateSummary(metrics: Record<string, number>): string {
    const balance = metrics.currentBalance;
    const growth = (metrics.treasuryGrowthRate * 100).toFixed(1);
    const runway = Math.floor(metrics.runway);
    
    return `Treasury balance is $${balance.toLocaleString()} with a ${growth}% growth rate. Current runway is ${runway} months at the current burn rate.`;
  }

  private generateInsights(metrics: Record<string, number>): string[] {
    const insights: string[] = [];
    
    if (metrics.treasuryGrowthRate > 0.1) {
      insights.push('Strong treasury growth indicates healthy community engagement');
    }
    
    if (metrics.runway < 6) {
      insights.push('Low runway suggests need for fundraising or reduced spending');
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
    
    if (metrics.burnRate > metrics.totalInflow / 12) {
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
    
    if (risks.some(r => r.level === 'critical' || r.level === 'high')) {
      recommendations.push('Review and reduce non-essential spending immediately');
      recommendations.push('Launch member contribution campaign');
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
