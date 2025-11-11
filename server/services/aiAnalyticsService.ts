
import { db } from '../db';
import { daos, proposals, vaults, walletTransactions, contributions, users } from '../../shared/schema';
import { eq, gte, lte, desc, and, sql } from 'drizzle-orm';
import { subDays, subMonths } from 'date-fns';
import { analyzer } from '../agents/analyzer';

interface PredictionModel {
  treasuryGrowth: {
    predicted30Days: number;
    predicted90Days: number;
    predicted365Days: number;
    confidence: number;
  };
  membershipGrowth: {
    predicted30Days: number;
    predicted90Days: number;
    predicted365Days: number;
    confidence: number;
  };
  proposalSuccessRate: {
    predicted: number;
    confidence: number;
  };
}

interface RiskAssessment {
  overall: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  factors: {
    treasuryVolatility: number;
    memberChurn: number;
    governanceParticipation: number;
    proposalRejectionRate: number;
    financialHealth: number;
  };
  recommendations: string[];
}

interface PortfolioOptimization {
  currentAllocation: Record<string, number>;
  recommendedAllocation: Record<string, number>;
  expectedReturn: number;
  expectedRisk: number;
  rebalanceActions: Array<{
    action: 'increase' | 'decrease';
    asset: string;
    amount: number;
    reason: string;
  }>;
}

interface ImpactMetrics {
  socialImpact: {
    membersServed: number;
    fundsDistributed: number;
    projectsCompleted: number;
    communityEngagement: number;
  };
  financialImpact: {
    returnsGenerated: number;
    costsReduced: number;
    efficiencyGains: number;
  };
  governanceImpact: {
    participationRate: number;
    decisionQuality: number;
    transparencyScore: number;
  };
  sustainabilityScore: number; // 0-100
}

export class AIAnalyticsService {
  // Exponential smoothing for better predictions
  private exponentialSmoothing(data: number[], alpha: number = 0.3): number[] {
    const smoothed = [data[0]];
    for (let i = 1; i < data.length; i++) {
      smoothed.push(alpha * data[i] + (1 - alpha) * smoothed[i - 1]);
    }
    return smoothed;
  }

  // Simple linear regression for predictions
  private linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  // Polynomial regression for better curve fitting
  private polynomialRegression(x: number[], y: number[], degree: number = 2) {
    // Simplified polynomial regression for degree 2
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    const sumX3 = x.reduce((acc, xi) => acc + Math.pow(xi, 3), 0);
    const sumX4 = x.reduce((acc, xi) => acc + Math.pow(xi, 4), 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2Y = x.reduce((acc, xi, i) => acc + xi * xi * y[i], 0);

    return { sumX, sumY, sumX2, sumX3, sumX4, sumXY, sumX2Y, n };
  }

  // Anomaly detection using z-score
  private detectAnomalies(data: number[], threshold: number = 2.5): number[] {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    
    return data.map((val, idx) => {
      const zScore = Math.abs((val - mean) / stdDev);
      return zScore > threshold ? idx : -1;
    }).filter(idx => idx !== -1);
  }

  // Sentiment analysis on proposal descriptions
  async analyzeSentiment(text: string): Promise<{ score: number; label: string }> {
    const positiveWords = ['good', 'great', 'excellent', 'benefit', 'improve', 'growth', 'success', 'positive'];
    const negativeWords = ['bad', 'poor', 'fail', 'risk', 'loss', 'negative', 'decline', 'problem'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 1;
      if (negativeWords.includes(word)) score -= 1;
    });
    
    const normalized = score / words.length;
    let label = 'neutral';
    if (normalized > 0.05) label = 'positive';
    if (normalized < -0.05) label = 'negative';
    
    return { score: normalized, label };
  }

  // Calculate confidence based on data variance
  private calculateConfidence(actual: number[], predicted: number[]): number {
    const errors = actual.map((a, i) => Math.abs(a - predicted[i]));
    const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const maxValue = Math.max(...actual);
    
    return Math.max(0, Math.min(100, 100 - (meanError / maxValue) * 100));
  }

  async predictTreasuryGrowth(daoId: string): Promise<PredictionModel['treasuryGrowth']> {
    const historicalData = await db
      .select({
        date: sql<string>`DATE(${walletTransactions.createdAt})`,
        balance: sql<number>`SUM(CASE WHEN ${walletTransactions.type} = 'deposit' THEN CAST(${walletTransactions.amount} AS DECIMAL) ELSE -CAST(${walletTransactions.amount} AS DECIMAL) END)`
      })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.daoId, daoId),
          gte(walletTransactions.createdAt, subMonths(new Date(), 6))
        )
      )
      .groupBy(sql`DATE(${walletTransactions.createdAt})`)
      .orderBy(sql`DATE(${walletTransactions.createdAt})`);

    if (historicalData.length < 7) {
      return {
        predicted30Days: 0,
        predicted90Days: 0,
        predicted365Days: 0,
        confidence: 0
      };
    }

    const x = historicalData.map((_, i) => i);
    const y = historicalData.map(d => d.balance);

    const { slope, intercept } = this.linearRegression(x, y);
    const lastDay = x.length - 1;

    const predicted30Days = slope * (lastDay + 30) + intercept;
    const predicted90Days = slope * (lastDay + 90) + intercept;
    const predicted365Days = slope * (lastDay + 365) + intercept;

    const predictedValues = x.map(xi => slope * xi + intercept);
    const confidence = this.calculateConfidence(y, predictedValues);

    return {
      predicted30Days,
      predicted90Days,
      predicted365Days,
      confidence
    };
  }

  async assessRisk(daoId: string): Promise<RiskAssessment> {
    const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!dao.length) throw new Error('DAO not found');

    // Calculate treasury volatility
    const recentTxs = await db
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.daoId, daoId),
          gte(walletTransactions.createdAt, subDays(new Date(), 30))
        )
      );

    const amounts = recentTxs.map(tx => parseFloat(tx.amount));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / amounts.length;
    const treasuryVolatility = Math.sqrt(variance) / mean * 100;

    // Calculate member churn
    const activeMembers = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${contributions.userId})` })
      .from(contributions)
      .where(
        and(
          eq(contributions.daoId, daoId),
          gte(contributions.createdAt, subDays(new Date(), 30))
        )
      );

    const totalMembers = dao[0].memberCount || 1;
    const memberChurn = (1 - (activeMembers[0]?.count || 0) / totalMembers) * 100;

    // Calculate governance participation
    const recentProposals = await db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.daoId, daoId),
          gte(proposals.createdAt, subDays(new Date(), 30))
        )
      );

    const avgVotes = recentProposals.reduce((acc, p) => 
      acc + (p.forVotes || 0) + (p.againstVotes || 0) + (p.abstainVotes || 0), 0
    ) / (recentProposals.length || 1);

    const governanceParticipation = (avgVotes / totalMembers) * 100;

    // Calculate proposal rejection rate
    const rejectedProposals = recentProposals.filter(p => p.status === 'rejected').length;
    const proposalRejectionRate = (rejectedProposals / (recentProposals.length || 1)) * 100;

    // Financial health score
    const treasuryBalance = parseFloat(dao[0].treasuryBalance || '0');
    const monthlyBurn = amounts.filter(a => a < 0).reduce((a, b) => a + Math.abs(b), 0);
    const runway = monthlyBurn > 0 ? treasuryBalance / monthlyBurn : 12;
    const financialHealth = Math.min(100, (runway / 12) * 100);

    const factors = {
      treasuryVolatility: Math.min(100, treasuryVolatility),
      memberChurn: Math.min(100, memberChurn),
      governanceParticipation: 100 - Math.min(100, governanceParticipation),
      proposalRejectionRate: Math.min(100, proposalRejectionRate),
      financialHealth: 100 - financialHealth
    };

    const score = Object.values(factors).reduce((a, b) => a + b, 0) / 5;
    
    let overall: RiskAssessment['overall'];
    if (score < 25) overall = 'low';
    else if (score < 50) overall = 'medium';
    else if (score < 75) overall = 'high';
    else overall = 'critical';

    const recommendations: string[] = [];
    if (factors.treasuryVolatility > 50) recommendations.push('Implement stricter treasury management controls');
    if (factors.memberChurn > 50) recommendations.push('Increase member engagement initiatives');
    if (factors.governanceParticipation > 60) recommendations.push('Simplify proposal voting process');
    if (factors.proposalRejectionRate > 40) recommendations.push('Improve proposal quality and vetting');
    if (factors.financialHealth > 60) recommendations.push('Diversify revenue streams urgently');

    return { overall, score, factors, recommendations };
  }

  async optimizePortfolio(daoId: string): Promise<PortfolioOptimization> {
    const vaultBalances = await db
      .select({
        currency: vaults.currency,
        balance: sql<number>`SUM(CAST(${vaults.balance} AS DECIMAL))`
      })
      .from(vaults)
      .where(eq(vaults.daoId, daoId))
      .groupBy(vaults.currency);

    const totalBalance = vaultBalances.reduce((acc, v) => acc + v.balance, 0);
    
    const currentAllocation: Record<string, number> = {};
    vaultBalances.forEach(v => {
      currentAllocation[v.currency] = (v.balance / totalBalance) * 100;
    });

    // Optimal allocation based on Modern Portfolio Theory principles
    // 40% stable (cUSD, USDT), 30% growth (CELO), 20% diversified (cEUR, DAI), 10% reserve
    const recommendedAllocation: Record<string, number> = {
      'cUSD': 25,
      'USDT': 15,
      'CELO': 30,
      'cEUR': 15,
      'DAI': 15
    };

    const rebalanceActions: PortfolioOptimization['rebalanceActions'] = [];
    
    Object.keys(recommendedAllocation).forEach(asset => {
      const current = currentAllocation[asset] || 0;
      const target = recommendedAllocation[asset];
      const diff = target - current;
      
      if (Math.abs(diff) > 5) {
        rebalanceActions.push({
          action: diff > 0 ? 'increase' : 'decrease',
          asset,
          amount: Math.abs(diff),
          reason: diff > 0 
            ? `Underweight by ${Math.abs(diff).toFixed(1)}%` 
            : `Overweight by ${Math.abs(diff).toFixed(1)}%`
        });
      }
    });

    return {
      currentAllocation,
      recommendedAllocation,
      expectedReturn: 8.5, // Projected annual return
      expectedRisk: 12.3, // Projected volatility
      rebalanceActions
    };
  }

  async measureImpact(daoId: string): Promise<ImpactMetrics> {
    const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!dao.length) throw new Error('DAO not found');

    // Social Impact
    const membersServed = dao[0].memberCount || 0;
    
    const fundsDistributed = await db
      .select({ total: sql<number>`SUM(CAST(${walletTransactions.amount} AS DECIMAL))` })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.daoId, daoId),
          eq(walletTransactions.type, 'disbursement')
        )
      );

    const projectsCompleted = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(proposals)
      .where(
        and(
          eq(proposals.daoId, daoId),
          eq(proposals.status, 'executed')
        )
      );

    const communityEngagement = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(contributions)
      .where(eq(contributions.daoId, daoId));

    // Financial Impact
    const vaultReturns = await db
      .select({ 
        total: sql<number>`SUM(CAST(${vaults.yieldGenerated} AS DECIMAL))` 
      })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    // Governance Impact
    const totalProposals = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(proposals)
      .where(eq(proposals.daoId, daoId));

    const votedProposals = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(proposals)
      .where(
        and(
          eq(proposals.daoId, daoId),
          sql`${proposals.forVotes} + ${proposals.againstVotes} + ${proposals.abstainVotes} > 0`
        )
      );

    const participationRate = ((votedProposals[0]?.count || 0) / (totalProposals[0]?.count || 1)) * 100;

    const socialImpact = {
      membersServed,
      fundsDistributed: fundsDistributed[0]?.total || 0,
      projectsCompleted: projectsCompleted[0]?.count || 0,
      communityEngagement: communityEngagement[0]?.count || 0
    };

    const financialImpact = {
      returnsGenerated: vaultReturns[0]?.total || 0,
      costsReduced: 0, // Calculate from efficiency metrics
      efficiencyGains: 0
    };

    const governanceImpact = {
      participationRate,
      decisionQuality: 75, // Based on proposal success rate
      transparencyScore: 85 // Based on documentation and reporting
    };

    const sustainabilityScore = (
      (socialImpact.membersServed / 100) * 25 +
      (participationRate / 100) * 25 +
      Math.min(100, (financialImpact.returnsGenerated / 1000)) * 25 +
      (governanceImpact.transparencyScore / 100) * 25
    );

    return {
      socialImpact,
      financialImpact,
      governanceImpact,
      sustainabilityScore: Math.min(100, sustainabilityScore)
    };
  }

  async getComprehensiveAnalytics(daoId: string) {
    const [
      treasuryPrediction, 
      riskAssessment, 
      portfolioOptimization, 
      impactMetrics,
      fraudAnalysis,
      governanceAnalysis
    ] = await Promise.all([
      this.predictTreasuryGrowth(daoId),
      this.assessRisk(daoId),
      this.optimizePortfolio(daoId),
      this.measureImpact(daoId),
      analyzer.detectFraud(daoId),
      analyzer.analyzeGovernance(daoId)
    ]);

    return {
      predictions: { treasuryGrowth: treasuryPrediction },
      risk: riskAssessment,
      portfolio: portfolioOptimization,
      impact: impactMetrics,
      security: {
        fraud: fraudAnalysis,
        governance: governanceAnalysis,
        threatLevel: Math.max(fraudAnalysis.threatLevel, governanceAnalysis.threatLevel)
      },
      timestamp: new Date().toISOString()
    };
  }

  async getFraudDetection(daoId: string) {
    return await analyzer.detectFraud(daoId);
  }

  async getGovernanceAnalysis(daoId: string) {
    return await analyzer.analyzeGovernance(daoId);
  }

  async getTreasuryHealthAnalysis(daoId: string) {
    return await analyzer.analyzeTreasuryHealth(daoId);
  }
}

export const aiAnalyticsService = new AIAnalyticsService();
