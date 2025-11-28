/**
 * DAO Analyzer
 * 
 * Analyzes DAO-level metrics including configuration, membership, structure, and health
 */

import type { AnalysisResponse, Risk } from '../types';
import { db } from '../../../db';
import { daos, users, daoMemberships, wallets, vaults, walletTransactions } from '../../../../shared/schema';
import { eq, and, sql, desc, gte, count } from 'drizzle-orm';

export class DaoAnalyzer {
  /**
   * Analyze DAO configuration and health
   */
  async analyze(daoId: string, timeframe?: string): Promise<AnalysisResponse> {
    const metricsData = await this.calculateMetrics(daoId, timeframe);
    
    // Handle error case
    if (typeof metricsData === 'object' && 'error' in metricsData) {
      return {
        summary: 'DAO not found',
        metrics: {},
        insights: [],
        risks: [],
        recommendations: []
      };
    }
    
    const insights = this.generateInsights(metricsData);
    const risks = this.identifyRisks(metricsData);
    
    // Extract only numeric metrics for the metrics field
    const metrics: Record<string, number> = {};
    if (typeof metricsData === 'object' && metricsData !== null && 'ageInDays' in metricsData) {
      metrics.ageInDays = metricsData.ageInDays;
      metrics.memberCount = metricsData.memberCount;
      metrics.activeMemberCount = metricsData.activeMemberCount;
      metrics.walletCount = metricsData.walletCount;
      metrics.vaultCount = metricsData.vaultCount;
      metrics.transactionCount = metricsData.transactionCount;
      metrics.treasuryBalance = metricsData.treasuryBalance;
      metrics.maturityScore = metricsData.maturityScore;
      metrics.governanceHealth = metricsData.governanceHealth;
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

    // Get DAO info
    const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!dao || dao.length === 0) {
      return { error: 'DAO not found' };
    }

    const daoRecord = dao[0];

    // Get member count
    const memberCountResult = await db.select({ count: count() })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));
    const memberCount = memberCountResult[0]?.count || 0;

    // Get wallet count
    const walletCountResult = await db.select({ count: count() })
      .from(wallets)
      .where(eq(wallets.daoId, daoId));
    const walletCount = walletCountResult[0]?.count || 0;

    // Get vault count
    const vaultCountResult = await db.select({ count: count() })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));
    const vaultCount = vaultCountResult[0]?.count || 0;

    // Get total transactions in timeframe
    const txCountResult = await db.select({ count: count() })
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.daoId, daoId),
        gte(walletTransactions.createdAt, since)
      ));
    const transactionCount = txCountResult[0]?.count || 0;

    // Get transaction distribution
    const txsByType = await db.select({
      type: walletTransactions.type,
      count: count()
    })
      .from(walletTransactions)
      .where(eq(walletTransactions.daoId, daoId))
      .groupBy(walletTransactions.type);

    // Calculate member activity
    const activeMembers = await db.select({ count: count() })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        gte(daoMemberships.createdAt, since)
      ));
    const activeMemberCount = activeMembers[0]?.count || 0;

    // Get Treasury info
    const treasuryVaults = await db.select()
      .from(vaults)
      .where(eq(vaults.daoId, daoId));
    
    const totalTreasuryBalance = treasuryVaults.reduce(
      (sum, v) => sum + parseFloat(v.balance || '0'), 
      0
    );

    // Calculate creation age in days
    const createdDate = new Date(daoRecord.createdAt!);
    const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate maturity score (0-100)
    const maturityScore = this.calculateMaturityScore({
      ageInDays,
      memberCount,
      walletCount,
      vaultCount,
      transactionCount,
      treasuryBalance: totalTreasuryBalance
    });

    // Calculate governance health
    const governanceHealth = this.calculateGovernanceHealth({
      hasDescription: !!daoRecord.description,
      hasRules: false, // DAOs schema doesn't have rules field yet
      memberCount,
      ageInDays
    });

    return {
      id: daoId,
      name: daoRecord.name,
      createdAt: daoRecord.createdAt,
      ageInDays,
      memberCount,
      activeMemberCount,
      walletCount,
      vaultCount,
      transactionCount,
      treasuryBalance: totalTreasuryBalance,
      maturityScore,
      governanceHealth,
      txByType: Object.fromEntries(txsByType.map(t => [t.type, t.count])),
      hasDescription: !!daoRecord.description,
      hasRules: false,
      treasuryAddress: (daoRecord as any).treasuryAddress || null,
      allowedTokens: []
    };
  }

  private calculateMaturityScore(data: {
    ageInDays: number;
    memberCount: number;
    walletCount: number;
    vaultCount: number;
    transactionCount: number;
    treasuryBalance: number;
  }): number {
    let score = 0;

    // Age factor (0-20 points)
    if (data.ageInDays >= 365) score += 20;
    else if (data.ageInDays >= 180) score += 15;
    else if (data.ageInDays >= 90) score += 10;
    else if (data.ageInDays >= 30) score += 5;

    // Member count (0-20 points)
    if (data.memberCount >= 50) score += 20;
    else if (data.memberCount >= 20) score += 15;
    else if (data.memberCount >= 10) score += 10;
    else if (data.memberCount >= 3) score += 5;

    // Infrastructure (0-20 points)
    if (data.walletCount >= 3) score += 10;
    else if (data.walletCount >= 1) score += 5;

    if (data.vaultCount >= 5) score += 10;
    else if (data.vaultCount >= 1) score += 5;

    // Activity (0-20 points)
    if (data.transactionCount >= 100) score += 20;
    else if (data.transactionCount >= 50) score += 15;
    else if (data.transactionCount >= 10) score += 10;
    else if (data.transactionCount >= 1) score += 5;

    // Treasury (0-20 points)
    if (data.treasuryBalance >= 100000) score += 20;
    else if (data.treasuryBalance >= 50000) score += 15;
    else if (data.treasuryBalance >= 10000) score += 10;
    else if (data.treasuryBalance > 0) score += 5;

    return Math.min(100, score);
  }

  private calculateGovernanceHealth(data: {
    hasDescription: boolean;
    hasRules: boolean;
    memberCount: number;
    ageInDays: number;
  }): number {
    let health = 50; // Base

    if (data.hasDescription) health += 15;
    if (data.hasRules) health += 15;
    if (data.memberCount >= 10) health += 10;
    if (data.memberCount >= 50) health += 10;
    if (data.ageInDays >= 180) health += 10;

    return Math.min(100, health);
  }

  private generateSummary(metrics: any): string {
    if (metrics.error) return `Error: ${metrics.error}`;
    
    const status = metrics.maturityScore > 70 ? 'mature' : metrics.maturityScore > 40 ? 'developing' : 'early-stage';
    return `DAO "${metrics.name}" is ${status} with ${metrics.memberCount} members, ` +
           `${metrics.walletCount} wallets, and $${metrics.treasuryBalance.toFixed(2)} treasury. ` +
           `Age: ${metrics.ageInDays} days. Maturity Score: ${metrics.maturityScore}/100`;
  }

  private generateInsights(metrics: any): string[] {
    if (metrics.error) return [`Error: ${metrics.error}`];

    const insights: string[] = [];

    // Maturity insights
    if (metrics.maturityScore < 30) {
      insights.push('🌱 Early-stage DAO: Recently created, still building infrastructure.');
    } else if (metrics.maturityScore < 70) {
      insights.push('📈 Developing DAO: Growing membership and transaction history.');
    } else {
      insights.push('⭐ Mature DAO: Established with solid infrastructure and activity.');
    }

    // Member insights
    if (metrics.memberCount === 0) {
      insights.push('⚠️ No members configured. Add members to enable collaboration.');
    } else if (metrics.memberCount < 5) {
      insights.push('⚠️ Small membership. Consider growing member base for resilience.');
    } else if (metrics.activeMemberCount < metrics.memberCount * 0.3) {
      insights.push('📉 Low member activity. Engagement may be declining.');
    }

    // Infrastructure insights
    if (metrics.walletCount === 0) {
      insights.push('⚠️ No wallets configured. Create wallets to manage funds.');
    }
    if (metrics.vaultCount === 0) {
      insights.push('⚠️ No vaults created. Set up vaults for fund allocation.');
    }

    // Treasury insights
    if (metrics.treasuryBalance === 0) {
      insights.push('💰 Empty treasury. Funds not yet contributed.');
    } else if (metrics.treasuryBalance < 1000) {
      insights.push('💰 Small treasury. Continue building reserves.');
    }

    // Governance insights
    if (!metrics.hasDescription) {
      insights.push('📋 Missing DAO description. Add description for clarity.');
    }
    if (!metrics.hasRules) {
      insights.push('📋 Missing governance rules. Define rules to clarify operations.');
    }

    // Activity insights
    if (metrics.transactionCount === 0) {
      insights.push('📊 No transactions yet. Begin treasury operations.');
    } else if (metrics.transactionCount > 100) {
      insights.push(`✓ Active DAO with ${metrics.transactionCount} transactions.`);
    }

    return insights;
  }

  private identifyRisks(metrics: any): Risk[] {
    if (metrics.error) return [];

    const risks: Risk[] = [];

    if (metrics.memberCount === 0) {
      risks.push({
        category: 'governance',
        level: 'critical',
        description: 'DAO has no members',
        mitigation: 'Add members to enable collaborative governance'
      });
    } else if (metrics.memberCount === 1) {
      risks.push({
        category: 'governance',
        level: 'high',
        description: 'DAO has only one member (centralized)',
        mitigation: 'Recruit additional members for true decentralization'
      });
    }

    if (metrics.walletCount === 0) {
      risks.push({
        category: 'treasury',
        level: 'high',
        description: 'No wallets for fund management',
        mitigation: 'Create wallets for treasury management and payments'
      });
    }

    if (metrics.treasuryBalance > 0 && metrics.walletCount === 1) {
      risks.push({
        category: 'treasury',
        level: 'medium',
        description: 'Treasury in single wallet',
        mitigation: 'Create additional wallets for redundancy and security'
      });
    }

    if (!metrics.hasRules && metrics.memberCount > 1) {
      risks.push({
        category: 'governance',
        level: 'medium',
        description: 'No governance rules defined',
        mitigation: 'Document governance rules and decision-making processes'
      });
    }

    if (metrics.ageInDays < 7 && metrics.memberCount < 3) {
      risks.push({
        category: 'stability',
        level: 'medium',
        description: 'Newly created DAO with few members',
        mitigation: 'Establish core operations and recruit more members'
      });
    }

    return risks;
  }

  private generateRecommendations(metrics: any, risks: Risk[]): string[] {
    if (metrics.error) return [];

    const recommendations: string[] = [];

    if (metrics.memberCount === 0) {
      recommendations.push('Add members to the DAO to enable collaborative governance');
      return recommendations;
    }

    if (risks.some(r => r.category === 'governance' && r.level === 'medium')) {
      recommendations.push('Create and document governance rules for decision-making');
      recommendations.push('Define roles and responsibilities for members');
    }

    if (metrics.walletCount === 0) {
      recommendations.push('Create at least one wallet for treasury management');
    }

    if (metrics.walletCount === 1 && metrics.treasuryBalance > 0) {
      recommendations.push('Create backup wallets for redundancy and security');
      recommendations.push('Consider multi-sig wallet for enhanced security');
    }

    if (!metrics.hasDescription) {
      recommendations.push('Add a clear DAO description to communicate purpose');
    }

    if (metrics.vaultCount === 0 && metrics.memberCount > 1) {
      recommendations.push('Create vaults for fund allocation and member contributions');
    }

    if (metrics.ageInDays < 30) {
      recommendations.push('Establish core operations and processes');
      recommendations.push('Recruit additional members to strengthen governance');
    }

    if (metrics.maturityScore < 40) {
      recommendations.push('Focus on building membership base');
      recommendations.push('Set up treasury infrastructure for fund management');
      recommendations.push('Define governance structure and decision-making processes');
    }

    return recommendations;
  }

  private parseTimeframeDays(timeframe?: string): number {
    if (!timeframe) return 30;
    if (timeframe === 'all') return 365 * 10;
    if (timeframe === '7d') return 7;
    if (timeframe === '30d') return 30;
    if (timeframe === '90d') return 90;
    if (timeframe === '1y') return 365;
    return 30;
  }
}
