/**
 * Wallet Analyzer
 * 
 * Analyzes DAO wallet health, transaction history, security, and activity patterns
 */

import type { AnalysisResponse, Risk } from '../types';
import { db } from '../../../db';
import { wallets, walletTransactions, userBalances } from '../../../../shared/schema';
import { eq, and, sql, desc, gte, count } from 'drizzle-orm';

export class WalletAnalyzer {
  /**
   * Analyze wallet health and transaction patterns
   */
  async analyze(daoId: string, timeframe?: string): Promise<AnalysisResponse> {
    const metricsData = await this.calculateMetrics(daoId, timeframe);
    const insights = this.generateInsights(metricsData);
    const risks = this.identifyRisks(metricsData);
    
    // Extract only numeric metrics for the metrics field
    const metrics: Record<string, number> = {};
    if (typeof metricsData === 'object' && metricsData !== null && 'walletCount' in metricsData) {
      metrics.walletCount = metricsData.walletCount;
      metrics.activeWallets = metricsData.activeWallets;
      metrics.totalBalance = metricsData.totalBalance;
      metrics.transactionCount = metricsData.transactionCount;
      metrics.avgTransactionValue = metricsData.avgTransactionValue;
      metrics.maxTransactionValue = metricsData.maxTransactionValue;
      metrics.minTransactionValue = metricsData.minTransactionValue;
      metrics.lastActivityDays = metricsData.lastActivityDays;
      metrics.securityScore = metricsData.securityScore;
      metrics.walletDiversification = metricsData.walletDiversification;
      metrics.concentrationRisk = metricsData.concentrationRisk;
    }
    
    return {
      summary: this.generateSummary(metricsData),
      metrics,
      insights,
      risks,
      recommendations: this.generateRecommendations(metricsData, risks)
    };
  }

  private async calculateMetrics(daoId: string, timeframe?: string) {
    const periodDays = this.parseTimeframeDays(timeframe);
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    // Get all wallets for the DAO
    const daoWallets = await db.select().from(wallets).where(eq(wallets.daoId, daoId));
    
    if (daoWallets.length === 0) {
      return {
        walletCount: 0,
        activeWallets: 0,
        totalBalance: 0,
        transactionCount: 0,
        avgTransactionValue: 0,
        maxTransactionValue: 0,
        minTransactionValue: 0,
        lastActivityDays: -1,
        securityScore: 0,
        walletDiversification: 0,
        concentrationRisk: 0
      };
    }

    // Get balances for these wallets
    const walletIds = daoWallets.map(w => w.id);
    const balances = await db.select()
      .from(userBalances)
      .where(sql`${userBalances.walletId} = any(${sql.raw(`array[${walletIds.map(id => `'${id}'`).join(',')}]`)})`);
    
    // Get all transactions for this DAO in the timeframe
    const txs = await db.select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.daoId, daoId),
        gte(walletTransactions.createdAt, since)
      ));

    // Calculate wallet activity metrics
    const activeWalletAddresses = new Set(txs.map(tx => tx.walletAddress).filter(Boolean));
    const activeWallets = activeWalletAddresses.size;

    // Calculate transaction metrics
    const amounts = txs.map(tx => parseFloat(tx.amount || '0')).filter(a => a > 0);
    const avgTransactionValue = amounts.length > 0 ? amounts.reduce((a, b) => a + b) / amounts.length : 0;
    const maxTransactionValue = amounts.length > 0 ? Math.max(...amounts) : 0;
    const minTransactionValue = amounts.length > 0 ? Math.min(...amounts) : 0;

    // Get last activity
    const lastTx = txs.length > 0 ? new Date(txs[txs.length - 1].createdAt!) : null;
    const lastActivityDays = lastTx ? Math.floor((Date.now() - lastTx.getTime()) / (1000 * 60 * 60 * 24)) : -1;

    // Calculate balance distribution (concentration risk)
    const balanceAmounts = balances.map(b => parseFloat(b.balance || '0'));
    const totalBalance = balanceAmounts.reduce((a, b) => a + b, 0);
    const concentrationRisk = this.calculateConcentrationRisk(balanceAmounts);
    const walletDiversification = 1 - concentrationRisk;

    // Security score based on wallet age, activity, and diversity
    const securityScore = this.calculateSecurityScore({
      walletCount: daoWallets.length,
      activeWallets,
      lastActivityDays,
      concentrationRisk,
      transactionCount: txs.length
    });

    return {
      walletCount: daoWallets.length,
      activeWallets,
      totalBalance,
      transactionCount: txs.length,
      avgTransactionValue,
      maxTransactionValue,
      minTransactionValue,
      lastActivityDays,
      securityScore,
      walletDiversification,
      concentrationRisk,
      walletDetails: daoWallets.map(w => ({
        address: w.address,
        balance: balances.find(b => b.walletId === w.id) ? parseFloat(balances.find(b => b.walletId === w.id)!.balance || '0') : 0,
        createdAt: w.createdAt,
        isActive: activeWalletAddresses.has(w.address),
        transactionCount: txs.filter(t => t.walletAddress === w.address).length
      }))
    };
  }

  private calculateConcentrationRisk(balances: number[]): number {
    const total = balances.reduce((a, b) => a + b, 0);
    if (total === 0) return 1; // All zero = max risk
    
    const shares = balances.map(b => b / total);
    const herfindahlIndex = shares.reduce((sum, share) => sum + share * share, 0);
    
    // HHI ranges 0-1, where 1 is max concentration (one wallet has all)
    return herfindahlIndex;
  }

  private calculateSecurityScore(data: {
    walletCount: number;
    activeWallets: number;
    lastActivityDays: number;
    concentrationRisk: number;
    transactionCount: number;
  }): number {
    let score = 50; // Base score

    // Multi-sig bonus
    if (data.walletCount > 1) {
      score += 10;
    }

    // Activity bonus (recent activity is good)
    if (data.lastActivityDays >= 0 && data.lastActivityDays <= 7) {
      score += 15;
    } else if (data.lastActivityDays > 30) {
      score -= 10; // Inactivity risk
    }

    // Diversification bonus
    if (data.concentrationRisk < 0.3) {
      score += 15; // Good diversity
    } else if (data.concentrationRisk > 0.7) {
      score -= 15; // High concentration risk
    }

    // Active usage bonus
    if (data.activeWallets > data.walletCount * 0.5) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private generateSummary(metrics: any): string {
    const riskLevel = metrics.securityScore < 40 ? 'High' : metrics.securityScore < 70 ? 'Medium' : 'Low';
    return `Wallet Security Analysis: ${metrics.walletCount} wallets with ${riskLevel} risk level. ` +
           `Concentration risk: ${(metrics.concentrationRisk * 100).toFixed(1)}%. ` +
           `Last activity: ${metrics.lastActivityDays >= 0 ? metrics.lastActivityDays + ' days ago' : 'Never'}`;
  }

  private generateInsights(metrics: any): string[] {
    const insights: string[] = [];

    if (metrics.walletCount === 0) {
      insights.push('No wallets configured for this DAO');
      return insights;
    }

    if (metrics.concentrationRisk > 0.8) {
      insights.push('⚠️ Extreme concentration: One wallet holds most funds. Consider distributing assets.');
    } else if (metrics.concentrationRisk > 0.6) {
      insights.push('⚠️ High concentration: Funds are concentrated in few wallets. Diversify for better security.');
    }

    if (metrics.lastActivityDays > 30 && metrics.lastActivityDays >= 0) {
      insights.push('No recent wallet activity detected. May indicate dormant treasury.');
    } else if (metrics.lastActivityDays >= 0 && metrics.lastActivityDays <= 7) {
      insights.push('✓ Active wallet usage detected in the last 7 days.');
    }

    if (metrics.activeWallets === 0 && metrics.walletCount > 0) {
      insights.push('⚠️ No active wallets. All wallets appear dormant.');
    } else if (metrics.activeWallets < metrics.walletCount * 0.5) {
      insights.push('⚠️ Low wallet utilization: Less than 50% of wallets are active.');
    }

    const avgValue = metrics.avgTransactionValue;
    const maxValue = metrics.maxTransactionValue;
    if (maxValue > avgValue * 10) {
      insights.push(`⚠️ Large outlier transaction detected: ${maxValue} (avg: ${avgValue.toFixed(2)})`);
    }

    return insights;
  }

  private identifyRisks(metrics: any): Risk[] {
    const risks: Risk[] = [];

    if (metrics.concentrationRisk > 0.7) {
      risks.push({
        category: 'concentration',
        level: 'high',
        description: 'Funds are concentrated in one or few wallets',
        mitigation: 'Implement multi-wallet strategy to reduce concentration risk'
      });
    }

    if (metrics.lastActivityDays > 60 && metrics.lastActivityDays >= 0) {
      risks.push({
        category: 'dormancy',
        level: 'medium',
        description: 'Wallets have been inactive for extended period',
        mitigation: 'Review wallet access credentials and restore active management'
      });
    }

    if (metrics.walletCount === 1) {
      risks.push({
        category: 'single-wallet',
        level: 'medium',
        description: 'DAO has only one wallet',
        mitigation: 'Create backup wallets for redundancy'
      });
    }

    if (metrics.securityScore < 40) {
      risks.push({
        category: 'security',
        level: 'high',
        description: 'Overall security score is low',
        mitigation: 'Increase wallet diversification and implement multi-sig'
      });
    }

    return risks;
  }

  private generateRecommendations(metrics: any, risks: Risk[]): string[] {
    const recommendations: string[] = [];

    if (metrics.walletCount === 0) {
      recommendations.push('Create wallet(s) for the DAO to manage funds');
      return recommendations;
    }

    if (risks.some(r => r.category === 'concentration')) {
      recommendations.push('Implement multi-wallet strategy to reduce concentration risk');
      recommendations.push('Consider using multi-sig wallets for enhanced security');
    }

    if (risks.some(r => r.category === 'dormancy')) {
      recommendations.push('Review wallet access credentials and restore active management');
      recommendations.push('Implement automated checks for wallet connectivity');
    }

    if (risks.some(r => r.category === 'single-wallet')) {
      recommendations.push('Create backup wallets for redundancy');
      recommendations.push('Set up wallet recovery procedures');
    }

    if (metrics.walletDiversification < 0.5) {
      recommendations.push('Increase wallet diversification by distributing funds across multiple addresses');
    }

    if (metrics.transactionCount === 0) {
      recommendations.push('Set up first transaction to activate wallet monitoring');
    }

    return recommendations;
  }

  private parseTimeframeDays(timeframe?: string): number {
    if (!timeframe) return 30;
    if (timeframe === 'all') return 365 * 10; // 10 years
    if (timeframe === '7d') return 7;
    if (timeframe === '30d') return 30;
    if (timeframe === '90d') return 90;
    if (timeframe === '1y') return 365;
    return 30;
  }
}
