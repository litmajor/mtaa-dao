
import { db } from '../storage';
import { proposals, walletTransactions, daos, vaults } from '../../shared/schema';
import { eq, desc, gte, and, sql } from 'drizzle-orm';
import { subMonths } from 'date-fns';

interface InitiativeROI {
  initiativeId: string;
  name: string;
  category: string;
  totalSpent: number;
  measuredImpact: number;
  roi: number;
  contributorsGained: number;
  transactionsGenerated: number;
  healthScore: number;
}

interface ProposalImpactScore {
  proposalId: string;
  predictedImpact: number;
  confidence: number;
  riskScore: number;
  recommendedAction: 'approve' | 'review' | 'reject';
  reasoning: string[];
  comparableProposals: string[];
}

interface TreasuryOptimization {
  currentAllocation: Record<string, number>;
  recommendedAllocation: Record<string, number>;
  expectedImpactGain: number;
  budgetAdjustments: Array<{
    category: string;
    currentBudget: number;
    recommendedBudget: number;
    reason: string;
    expectedROI: number;
  }>;
}

export class TreasuryIntelligenceService {
  
  /**
   * Calculate ROI for all treasury initiatives
   */
  async calculateInitiativeROI(daoId: string, timeframe: number = 90): Promise<InitiativeROI[]> {
    const startDate = subMonths(new Date(), Math.floor(timeframe / 30));
    
    // Get executed proposals (initiatives)
    const executedProposals = await db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.daoId, daoId),
          eq(proposals.status, 'executed'),
          gte(proposals.executedAt, startDate)
        )
      );

    const initiatives: InitiativeROI[] = [];

    for (const proposal of executedProposals) {
      const category = this.categorizeProposal(proposal.title, proposal.description);
      
      // Calculate spending
      const spending = await this.getProposalSpending(proposal.id);
      
      // Measure impact metrics
      const impact = await this.measureProposalImpact(daoId, proposal.id, proposal.executedAt);
      
      const roi = impact.totalValue > 0 ? (impact.totalValue - spending) / spending * 100 : -100;
      
      initiatives.push({
        initiativeId: proposal.id,
        name: proposal.title,
        category,
        totalSpent: spending,
        measuredImpact: impact.totalValue,
        roi,
        contributorsGained: impact.newMembers,
        transactionsGenerated: impact.transactions,
        healthScore: this.calculateHealthScore(roi, impact)
      });
    }

    return initiatives.sort((a, b) => b.roi - a.roi);
  }

  /**
   * ML-based proposal impact prediction
   */
  async predictProposalImpact(
    daoId: string,
    proposalTitle: string,
    proposalDescription: string,
    requestedAmount: number,
    category?: string
  ): Promise<ProposalImpactScore> {
    
    // Feature extraction
    const features = this.extractProposalFeatures(proposalTitle, proposalDescription, requestedAmount);
    
    // Find similar historical proposals
    const similarProposals = await this.findSimilarProposals(daoId, features);
    
    // Calculate average success metrics from similar proposals
    const historicalMetrics = this.aggregateHistoricalMetrics(similarProposals);
    
    // ML prediction model (simplified linear regression for now)
    const predictedImpact = this.predictImpactScore(features, historicalMetrics);
    
    // Risk assessment
    const riskScore = this.assessProposalRisk(requestedAmount, features, historicalMetrics);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(predictedImpact, riskScore, requestedAmount);
    
    return {
      proposalId: '', // Set when proposal is created
      predictedImpact: Math.round(predictedImpact * 100) / 100,
      confidence: historicalMetrics.sampleSize > 5 ? 0.85 : 0.65,
      riskScore: Math.round(riskScore * 100) / 100,
      recommendedAction: recommendation.action,
      reasoning: recommendation.reasoning,
      comparableProposals: similarProposals.slice(0, 5).map(p => p.id)
    };
  }

  /**
   * Adaptive budget allocation optimizer
   */
  async optimizeBudgetAllocation(daoId: string): Promise<TreasuryOptimization> {
    
    // Get current budget allocation by category
    const currentAllocation = await this.getCurrentAllocation(daoId);
    
    // Calculate ROI by category from historical data
    const categoryROI = await this.calculateCategoryROI(daoId);
    
    // Get total treasury balance
    const treasury = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    const totalBudget = parseFloat(treasury[0]?.treasuryBalance || '0');
    
    // Optimize allocation using ROI-weighted distribution
    const recommendedAllocation: Record<string, number> = {};
    const budgetAdjustments = [];
    
    let totalROI = Object.values(categoryROI).reduce((sum, roi) => sum + Math.max(roi, 0), 0);
    
    // If no positive ROI, use equal distribution
    if (totalROI === 0) {
      totalROI = Object.keys(categoryROI).length;
    }
    
    for (const [category, roi] of Object.entries(categoryROI)) {
      const weight = Math.max(roi, 0) / totalROI;
      const currentBudget = currentAllocation[category] || 0;
      const recommendedBudget = totalBudget * weight * 0.8; // 80% allocated, 20% reserve
      
      recommendedAllocation[category] = recommendedBudget;
      
      if (Math.abs(recommendedBudget - currentBudget) > totalBudget * 0.05) {
        budgetAdjustments.push({
          category,
          currentBudget,
          recommendedBudget,
          reason: this.generateAllocationReason(category, roi, currentBudget, recommendedBudget),
          expectedROI: roi
        });
      }
    }
    
    const expectedImpactGain = this.calculateExpectedGain(
      currentAllocation,
      recommendedAllocation,
      categoryROI
    );
    
    return {
      currentAllocation,
      recommendedAllocation,
      expectedImpactGain,
      budgetAdjustments: budgetAdjustments.sort((a, b) => b.expectedROI - a.expectedROI)
    };
  }

  /**
   * Generate Treasury Intelligence Report
   */
  async generateIntelligenceReport(daoId: string) {
    const [initiativeROI, optimization, treasury] = await Promise.all([
      this.calculateInitiativeROI(daoId),
      this.optimizeBudgetAllocation(daoId),
      this.getTreasuryMetrics(daoId)
    ]);

    // Top performing initiatives
    const topInitiatives = initiativeROI.slice(0, 10);
    const underperforming = initiativeROI.filter(i => i.roi < 0);
    
    // Treasury health indicators
    const healthIndicators = {
      overallROI: initiativeROI.reduce((sum, i) => sum + i.roi, 0) / initiativeROI.length,
      activeInitiatives: initiativeROI.length,
      successRate: initiativeROI.filter(i => i.roi > 0).length / initiativeROI.length * 100,
      totalImpact: initiativeROI.reduce((sum, i) => sum + i.measuredImpact, 0),
      efficiency: treasury.totalSpent > 0 ? treasury.totalImpact / treasury.totalSpent : 0
    };

    // Actionable insights
    const insights = this.generateActionableInsights(initiativeROI, optimization, healthIndicators);

    return {
      timestamp: new Date().toISOString(),
      daoId,
      treasury,
      healthIndicators,
      topInitiatives,
      underperformingInitiatives: underperforming,
      optimization,
      insights,
      recommendations: this.generateStrategicRecommendations(healthIndicators, optimization)
    };
  }

  // ===== Helper Methods =====

  private categorizeProposal(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    
    if (text.includes('grant') || text.includes('funding')) return 'grants';
    if (text.includes('marketing') || text.includes('awareness')) return 'marketing';
    if (text.includes('development') || text.includes('tech')) return 'development';
    if (text.includes('liquidity') || text.includes('pool')) return 'liquidity';
    if (text.includes('governance') || text.includes('voting')) return 'governance';
    if (text.includes('community') || text.includes('event')) return 'community';
    
    return 'other';
  }

  private async getProposalSpending(proposalId: string): Promise<number> {
    const spending = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${walletTransactions.amount} AS DECIMAL)), 0)` })
      .from(walletTransactions)
      .where(
        and(
          sql`${walletTransactions.description} LIKE ${`%${proposalId}%`}`,
          eq(walletTransactions.type, 'disbursement')
        )
      );
    
    return spending[0]?.total || 0;
  }

  private async measureProposalImpact(daoId: string, proposalId: string, executedAt: Date | null) {
    if (!executedAt) {
      return { totalValue: 0, newMembers: 0, transactions: 0 };
    }

    // Count new members since execution
    const newMembers = await db
      .select({ count: sql<number>`COUNT(DISTINCT user_id)` })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.daoId, daoId),
          gte(walletTransactions.createdAt, executedAt)
        )
      );

    // Count transactions generated
    const transactions = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.daoId, daoId),
          gte(walletTransactions.createdAt, executedAt)
        )
      );

    // Measure value generated (deposits, contributions)
    const valueGenerated = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${walletTransactions.amount} AS DECIMAL)), 0)` })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.daoId, daoId),
          eq(walletTransactions.type, 'deposit'),
          gte(walletTransactions.createdAt, executedAt)
        )
      );

    return {
      totalValue: valueGenerated[0]?.total || 0,
      newMembers: newMembers[0]?.count || 0,
      transactions: transactions[0]?.count || 0
    };
  }

  private calculateHealthScore(roi: number, impact: any): number {
    let score = 50; // Base score

    // ROI component (40 points)
    if (roi > 100) score += 40;
    else if (roi > 50) score += 30;
    else if (roi > 0) score += 20;
    else if (roi > -50) score += 10;

    // New members component (30 points)
    if (impact.newMembers > 50) score += 30;
    else if (impact.newMembers > 20) score += 20;
    else if (impact.newMembers > 5) score += 10;

    // Transaction activity (30 points)
    if (impact.transactions > 100) score += 30;
    else if (impact.transactions > 50) score += 20;
    else if (impact.transactions > 10) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  private extractProposalFeatures(title: string, description: string, amount: number) {
    return {
      wordCount: description.split(' ').length,
      requestedAmount: amount,
      category: this.categorizeProposal(title, description),
      hasMetrics: /\d+%|\d+\s*(members|users|transactions)/i.test(description),
      hasTimeline: /\d+\s*(days|weeks|months)/i.test(description),
      hasBudgetBreakdown: /budget|cost|expense/i.test(description)
    };
  }

  private async findSimilarProposals(daoId: string, features: any) {
    const allProposals = await db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.daoId, daoId),
          eq(proposals.status, 'executed')
        )
      );

    return allProposals
      .map(p => ({
        ...p,
        similarity: this.calculateSimilarity(features, this.extractProposalFeatures(p.title, p.description, 0))
      }))
      .sort((a, b) => b.similarity - a.similarity);
  }

  private calculateSimilarity(f1: any, f2: any): number {
    let score = 0;
    if (f1.category === f2.category) score += 0.5;
    if (Math.abs(f1.wordCount - f2.wordCount) < 100) score += 0.2;
    if (f1.hasMetrics === f2.hasMetrics) score += 0.1;
    if (f1.hasTimeline === f2.hasTimeline) score += 0.1;
    if (f1.hasBudgetBreakdown === f2.hasBudgetBreakdown) score += 0.1;
    return score;
  }

  private aggregateHistoricalMetrics(proposals: any[]) {
    const sampleSize = proposals.length;
    if (sampleSize === 0) return { sampleSize: 0, avgSuccess: 0.5, avgImpact: 0 };

    const passed = proposals.filter(p => p.status === 'passed' || p.status === 'executed').length;
    
    return {
      sampleSize,
      avgSuccess: passed / sampleSize,
      avgImpact: 0.5 // Placeholder - would calculate from actual impact data
    };
  }

  private predictImpactScore(features: any, historical: any): number {
    let baseScore = 50;

    // Category weight
    const categoryWeights: Record<string, number> = {
      development: 1.2,
      marketing: 1.1,
      grants: 1.0,
      liquidity: 1.3,
      community: 0.9,
      governance: 0.8
    };
    baseScore *= categoryWeights[features.category] || 1.0;

    // Quality indicators
    if (features.hasMetrics) baseScore += 15;
    if (features.hasTimeline) baseScore += 10;
    if (features.hasBudgetBreakdown) baseScore += 10;

    // Historical success rate
    baseScore *= (0.5 + historical.avgSuccess * 0.5);

    return Math.min(100, Math.max(0, baseScore));
  }

  private assessProposalRisk(amount: number, features: any, historical: any): number {
    let riskScore = 50;

    // Amount risk
    if (amount > 10000) riskScore += 30;
    else if (amount > 5000) riskScore += 20;
    else if (amount > 1000) riskScore += 10;

    // Quality risk (inverse)
    if (!features.hasMetrics) riskScore += 10;
    if (!features.hasTimeline) riskScore += 10;
    if (!features.hasBudgetBreakdown) riskScore += 10;

    // Historical risk
    if (historical.avgSuccess < 0.5) riskScore += 20;

    return Math.min(100, Math.max(0, riskScore));
  }

  private generateRecommendation(impact: number, risk: number, amount: number) {
    const reasoning = [];
    let action: 'approve' | 'review' | 'reject';

    if (impact > 70 && risk < 40) {
      action = 'approve';
      reasoning.push('High predicted impact with acceptable risk');
    } else if (impact > 50 && risk < 60) {
      action = 'review';
      reasoning.push('Moderate impact potential, requires careful evaluation');
    } else {
      action = 'reject';
      reasoning.push('Low impact or high risk profile');
    }

    if (risk > 70) reasoning.push('High risk score - thorough review needed');
    if (impact > 80) reasoning.push('Exceptional impact potential');
    if (amount > 5000) reasoning.push('Large budget request - ensure proper oversight');

    return { action, reasoning };
  }

  private async getCurrentAllocation(daoId: string): Promise<Record<string, number>> {
    const spending = await db
      .select({
        category: sql<string>`CASE 
          WHEN ${walletTransactions.description} LIKE '%grant%' THEN 'grants'
          WHEN ${walletTransactions.description} LIKE '%marketing%' THEN 'marketing'
          WHEN ${walletTransactions.description} LIKE '%development%' THEN 'development'
          ELSE 'other'
        END`,
        total: sql<number>`SUM(CAST(${walletTransactions.amount} AS DECIMAL))`
      })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.daoId, daoId),
          eq(walletTransactions.type, 'disbursement')
        )
      )
      .groupBy(sql`CASE 
        WHEN ${walletTransactions.description} LIKE '%grant%' THEN 'grants'
        WHEN ${walletTransactions.description} LIKE '%marketing%' THEN 'marketing'
        WHEN ${walletTransactions.description} LIKE '%development%' THEN 'development'
        ELSE 'other'
      END`);

    const allocation: Record<string, number> = {};
    spending.forEach(s => {
      allocation[s.category] = s.total;
    });

    return allocation;
  }

  private async calculateCategoryROI(daoId: string): Promise<Record<string, number>> {
    const initiatives = await this.calculateInitiativeROI(daoId);
    const categoryROI: Record<string, { total: number; count: number }> = {};

    initiatives.forEach(i => {
      if (!categoryROI[i.category]) {
        categoryROI[i.category] = { total: 0, count: 0 };
      }
      categoryROI[i.category].total += i.roi;
      categoryROI[i.category].count++;
    });

    const result: Record<string, number> = {};
    Object.entries(categoryROI).forEach(([category, data]) => {
      result[category] = data.total / data.count;
    });

    return result;
  }

  private generateAllocationReason(category: string, roi: number, current: number, recommended: number): string {
    const change = recommended - current;
    const direction = change > 0 ? 'increase' : 'decrease';
    const pct = Math.abs(change / current * 100).toFixed(0);

    if (roi > 100) {
      return `${direction} by ${pct}% - exceptional ${roi.toFixed(0)}% ROI`;
    } else if (roi > 0) {
      return `${direction} by ${pct}% - positive ${roi.toFixed(0)}% ROI`;
    } else {
      return `${direction} by ${pct}% - underperforming (${roi.toFixed(0)}% ROI)`;
    }
  }

  private calculateExpectedGain(current: Record<string, number>, recommended: Record<string, number>, roi: Record<string, number>): number {
    let currentExpected = 0;
    let recommendedExpected = 0;

    Object.keys(current).forEach(category => {
      const categoryROI = roi[category] || 0;
      currentExpected += current[category] * (categoryROI / 100);
      recommendedExpected += (recommended[category] || 0) * (categoryROI / 100);
    });

    return recommendedExpected - currentExpected;
  }

  private async getTreasuryMetrics(daoId: string) {
    const treasury = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    
    const spending = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${walletTransactions.amount} AS DECIMAL)), 0)` })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.daoId, daoId),
          eq(walletTransactions.type, 'disbursement')
        )
      );

    return {
      balance: parseFloat(treasury[0]?.treasuryBalance || '0'),
      totalSpent: spending[0]?.total || 0,
      totalImpact: 0 // Would calculate from impact measurements
    };
  }

  private generateActionableInsights(initiatives: InitiativeROI[], optimization: TreasuryOptimization, health: any): string[] {
    const insights = [];

    if (health.overallROI > 50) {
      insights.push(`Strong treasury performance with ${health.overallROI.toFixed(0)}% average ROI`);
    } else if (health.overallROI < 0) {
      insights.push(`Treasury is underperforming - immediate optimization needed`);
    }

    const topCategory = Object.entries(optimization.recommendedAllocation)
      .sort(([, a], [, b]) => b - a)[0];
    if (topCategory) {
      insights.push(`Focus resources on ${topCategory[0]} - highest predicted returns`);
    }

    if (health.successRate < 50) {
      insights.push(`Low proposal success rate (${health.successRate.toFixed(0)}%) - improve vetting process`);
    }

    if (optimization.expectedImpactGain > 1000) {
      insights.push(`Reallocation could generate $${optimization.expectedImpactGain.toFixed(0)} additional impact`);
    }

    return insights;
  }

  private generateStrategicRecommendations(health: any, optimization: TreasuryOptimization): string[] {
    const recommendations = [];

    if (optimization.budgetAdjustments.length > 0) {
      recommendations.push('Implement recommended budget reallocation to maximize ROI');
    }

    if (health.efficiency < 1) {
      recommendations.push('Treasury efficiency below target - focus on high-impact initiatives');
    }

    recommendations.push('Continue monitoring initiative performance and adjust quarterly');
    recommendations.push('Establish minimum ROI thresholds for new proposals');

    return recommendations;
  }
}

export const treasuryIntelligenceService = new TreasuryIntelligenceService();
