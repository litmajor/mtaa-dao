/**
 * Contribution Analyzer
 * 
 * Analyzes member contributions, engagement patterns, and contribution-based metrics
 * for fair compensation, member tier assignment, and proportional selection
 */

import type { AnalysisResponse, Risk } from '../types';
import { db } from '../../../db';
import { contributions, users, daoMemberships } from '../../../../shared/schema';
import { eq, and, sql, desc, gte, count, sum } from 'drizzle-orm';

export interface ContributionProfile {
  memberId: string;
  memberName: string;
  totalContribution: number;
  contributionCount: number;
  averageContribution: number;
  contributionFrequency: string; // 'daily', 'weekly', 'monthly'
  lastContributionDate: Date | null;
  contributionTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  engagementScore: number; // 0-100
  consistencyScore: number; // 0-100
  growthTrend: 'increasing' | 'stable' | 'decreasing';
}

export class ContributionAnalyzer {
  /**
   * Analyze DAO contribution ecosystem
   */
  async analyze(daoId: string, timeframe?: string): Promise<AnalysisResponse> {
    const metricsData = await this.calculateMetrics(daoId, timeframe);
    const insights = this.generateInsights(metricsData);
    const risks = this.identifyRisks(metricsData);
    
    const metrics: Record<string, number> = {};
    if (typeof metricsData === 'object' && metricsData !== null) {
      metrics.totalContributors = metricsData.totalContributors || 0;
      metrics.activeContributors = metricsData.activeContributors || 0;
      metrics.totalContributions = metricsData.totalContributions || 0;
      metrics.averageContribution = metricsData.averageContribution || 0;
      metrics.topContributorShare = metricsData.topContributorShare || 0;
      metrics.contributionHealth = metricsData.contributionHealth || 0;
    }

    return {
      metrics,
      summary: `${metricsData.activeContributors} active contributors generated $${(metricsData.totalContributions / 1000).toFixed(0)}K in contributions`,
      insights,
      risks,
      recommendations: this.generateRecommendations(metricsData, risks),
      threatLevel: risks.length > 1 ? 'medium' : 'low',
      details: metricsData
    };
  }

  /**
   * Get detailed contribution profile for a member
   */
  async getMemberContributionProfile(memberId: string, daoId: string, timeframe?: string = '90d'): Promise<ContributionProfile> {
    try {
      const timeframeMs = this.parseTimeframeDays(timeframe) * 24 * 60 * 60 * 1000;
      const startDate = new Date(Date.now() - timeframeMs);

      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, memberId)
      });

      const memberContributions = await db.query.contributions.findMany({
        where: (contrib, { and, gte, eq }) => and(
          eq(contrib.userId, memberId),
          eq(contrib.daoId, daoId),
          gte(contrib.createdAt, startDate)
        ),
        orderBy: (contrib) => desc(contrib.createdAt)
      });

      if (memberContributions.length === 0) {
        return {
          memberId,
          memberName: user?.name || 'Unknown',
          totalContribution: 0,
          contributionCount: 0,
          averageContribution: 0,
          contributionFrequency: 'none',
          lastContributionDate: null,
          contributionTier: 'bronze',
          engagementScore: 0,
          consistencyScore: 0,
          growthTrend: 'stable'
        };
      }

      const totalContribution = memberContributions.reduce((sum, c) => sum + (c.amount || 0), 0);
      const contributionCount = memberContributions.length;
      const averageContribution = totalContribution / contributionCount;
      const lastContribution = memberContributions[0];

      // Calculate engagement and consistency scores
      const engagementScore = Math.min(100, (contributionCount / 30) * 100); // Max 100 at 30 contributions/month
      const consistencyScore = this.calculateConsistencyScore(memberContributions);
      const growthTrend = this.detectGrowthTrend(memberContributions);
      const contributionTier = this.assignTier(totalContribution, engagementScore);
      const frequency = this.calculateFrequency(memberContributions.length, this.parseTimeframeDays(timeframe));

      return {
        memberId,
        memberName: user?.name || 'Unknown',
        totalContribution,
        contributionCount,
        averageContribution,
        contributionFrequency: frequency,
        lastContributionDate: lastContribution.createdAt || null,
        contributionTier,
        engagementScore: Math.round(engagementScore),
        consistencyScore: Math.round(consistencyScore),
        growthTrend
      };
    } catch (error) {
      console.error('Error getting member contribution profile:', error);
      return {
        memberId,
        memberName: 'Unknown',
        totalContribution: 0,
        contributionCount: 0,
        averageContribution: 0,
        contributionFrequency: 'none',
        lastContributionDate: null,
        contributionTier: 'bronze',
        engagementScore: 0,
        consistencyScore: 0,
        growthTrend: 'stable'
      };
    }
  }

  /**
   * Get top contributors ranked by various metrics
   */
  async getTopContributors(daoId: string, limit: number = 10, metric: 'total' | 'frequency' | 'engagement' = 'total') {
    try {
      const contributions_all = await db.query.contributions.findMany({
        where: (contrib, { eq }) => eq(contrib.daoId, daoId),
        orderBy: (contrib) => desc(contrib.createdAt),
        limit: 1000
      });

      // Group by user
      const userContributions: Record<string, any[]> = {};
      for (const contrib of contributions_all) {
        if (!userContributions[contrib.userId]) {
          userContributions[contrib.userId] = [];
        }
        userContributions[contrib.userId].push(contrib);
      }

      // Score each user
      const scored = Object.entries(userContributions).map(([userId, contribs]) => {
        const totalAmount = contribs.reduce((sum, c) => sum + (c.amount || 0), 0);
        const frequency = contribs.length;
        const engagement = Math.min(100, (frequency / 30) * 100);
        const consistency = this.calculateConsistencyScore(contribs);

        let score = 0;
        switch (metric) {
          case 'frequency':
            score = frequency;
            break;
          case 'engagement':
            score = engagement;
            break;
          case 'total':
          default:
            score = totalAmount;
        }

        return {
          userId,
          totalAmount,
          frequency,
          engagement: Math.round(engagement),
          consistency: Math.round(consistency),
          score,
          avgContribution: frequency > 0 ? totalAmount / frequency : 0
        };
      });

      // Sort and return top N
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item, rank) => ({
          rank: rank + 1,
          ...item
        }));
    } catch (error) {
      console.error('Error getting top contributors:', error);
      return [];
    }
  }

  /**
   * Analyze contribution distribution (Gini coefficient for inequality)
   */
  async analyzeContributionDistribution(daoId: string, timeframe?: string = '30d') {
    try {
      const profiles = await this.getAllMemberProfiles(daoId, timeframe);
      
      if (profiles.length === 0) {
        return {
          totalMembers: 0,
          giniCoefficient: 0,
          concentration: 'no_data',
          distributionHealth: 0,
          recommendations: ['No contribution data available yet']
        };
      }

      const amounts = profiles.map(p => p.totalContribution).sort((a, b) => a - b);
      const gini = this.calculateGiniCoefficient(amounts);

      // Calculate concentration metrics
      const top10Percent = Math.ceil(profiles.length * 0.1);
      const top10Share = amounts.slice(-top10Percent).reduce((a, b) => a + b, 0) / 
                         amounts.reduce((a, b) => a + b, 0);

      let concentration = 'healthy'; // Gini < 0.4
      if (gini > 0.5) concentration = 'concentrated'; // Few heavy contributors
      if (gini < 0.2) concentration = 'distributed'; // Many equal contributors

      const distributionHealth = Math.round((1 - gini) * 100);

      return {
        totalMembers: profiles.length,
        giniCoefficient: Math.round(gini * 1000) / 1000,
        concentration,
        top10Share: Math.round(top10Share * 100),
        distributionHealth,
        profiles: profiles.slice(0, 5), // Top 5
        recommendations: this.recommendDistributionImprovements(gini, top10Share)
      };
    } catch (error) {
      console.error('Error analyzing contribution distribution:', error);
      return { error: 'Failed to analyze distribution' };
    }
  }

  /**
   * Calculate weighted random selection based on contributions (for selectProportional)
   */
  async getContributionWeights(daoId: string, memberIds: string[], timeframe?: string = '90d'): Promise<Record<string, number>> {
    try {
      const weights: Record<string, number> = {};
      
      for (const memberId of memberIds) {
        const profile = await this.getMemberContributionProfile(memberId, daoId, timeframe);
        // Use total contribution as weight, minimum 1 for non-contributors
        weights[memberId] = Math.max(profile.totalContribution, 1);
      }

      return weights;
    } catch (error) {
      console.error('Error getting contribution weights:', error);
      return {};
    }
  }

  /**
   * Detect contribution patterns and anomalies
   */
  async detectPatterns(daoId: string, timeframe?: string = '90d') {
    try {
      const profiles = await this.getAllMemberProfiles(daoId, timeframe);

      const patterns = {
        steadyContributors: profiles.filter(p => p.consistencyScore > 80),
        sporadic: profiles.filter(p => p.consistencyScore < 40),
        growing: profiles.filter(p => p.growthTrend === 'increasing' && p.engagementScore > 50),
        declining: profiles.filter(p => p.growthTrend === 'decreasing'),
        inactive: profiles.filter(p => p.contributionCount === 0)
      };

      return {
        patterns,
        summary: {
          steadyCount: patterns.steadyContributors.length,
          sporadic Count: patterns.sporadic.length,
          growingCount: patterns.growing.length,
          decliningCount: patterns.declining.length,
          inactiveCount: patterns.inactive.length
        }
      };
    } catch (error) {
      console.error('Error detecting patterns:', error);
      return { error: 'Failed to detect patterns' };
    }
  }

  private async calculateMetrics(daoId: string, timeframe?: string = '30d') {
    try {
      const timeframeMs = this.parseTimeframeDays(timeframe) * 24 * 60 * 60 * 1000;
      const startDate = new Date(Date.now() - timeframeMs);

      // Get all members
      const members = await db.query.daoMemberships.findMany({
        where: (memberships, { eq }) => eq(memberships.daoId, daoId)
      });

      // Get contributions in timeframe
      const timeframeContributions = await db.query.contributions.findMany({
        where: (contrib, { and, gte, eq }) => and(
          eq(contrib.daoId, daoId),
          gte(contrib.createdAt, startDate)
        )
      });

      const totalContributors = new Set(timeframeContributions.map(c => c.userId)).size;
      const activeContributors = totalContributors;
      const totalContributions = timeframeContributions.reduce((sum, c) => sum + (c.amount || 0), 0);
      const avgContribution = activeContributors > 0 ? totalContributions / activeContributors : 0;

      // Calculate concentration (top contributor share)
      const byUser: Record<string, number> = {};
      for (const contrib of timeframeContributions) {
        byUser[contrib.userId] = (byUser[contrib.userId] || 0) + (contrib.amount || 0);
      }

      const topContributor = Math.max(...Object.values(byUser), 0);
      const topContributorShare = totalContributions > 0 ? (topContributor / totalContributions) * 100 : 0;

      // Calculate health
      const healthFactors = [
        Math.min(activeContributors * 10, 30), // Contributor count
        Math.min((totalContributions / 10000) * 30, 30), // Total contribution value
        Math.min((100 - topContributorShare) * 0.4, 20), // Diversity bonus
        20 // Base operational health
      ];
      const contributionHealth = Math.round(healthFactors.reduce((a, b) => a + b, 0));

      return {
        totalContributors: members.length,
        activeContributors,
        totalContributions,
        averageContribution: avgContribution,
        topContributorShare,
        contributionHealth,
        memberCount: members.length,
        engagementRate: ((activeContributors / members.length) * 100)
      };
    } catch (error) {
      console.error('Error calculating contribution metrics:', error);
      return {
        totalContributors: 0,
        activeContributors: 0,
        totalContributions: 0,
        averageContribution: 0,
        topContributorShare: 0,
        contributionHealth: 0
      };
    }
  }

  private async getAllMemberProfiles(daoId: string, timeframe?: string): Promise<ContributionProfile[]> {
    try {
      const members = await db.query.daoMemberships.findMany({
        where: (memberships, { eq }) => eq(memberships.daoId, daoId)
      });

      const profiles: ContributionProfile[] = [];
      for (const member of members) {
        const profile = await this.getMemberContributionProfile(member.userId, daoId, timeframe);
        profiles.push(profile);
      }

      return profiles.sort((a, b) => b.totalContribution - a.totalContribution);
    } catch (error) {
      console.error('Error getting all member profiles:', error);
      return [];
    }
  }

  private generateInsights(metrics: any): string[] {
    const insights: string[] = [];

    if (metrics.activeContributors === 0) {
      insights.push('No contributions yet. Encourage members to participate.');
      return insights;
    }

    insights.push(`${metrics.activeContributors} members contributed $${(metrics.totalContributions / 1000).toFixed(0)}K`);

    if (metrics.topContributorShare > 50) {
      insights.push(`High concentration: top contributor represents ${Math.round(metrics.topContributorShare)}% of contributions`);
    } else if (metrics.topContributorShare > 30) {
      insights.push(`Moderate concentration: top contributor represents ${Math.round(metrics.topContributorShare)}% of contributions`);
    } else {
      insights.push('Healthy contribution distribution across multiple members');
    }

    const engagementRate = (metrics.activeContributors / metrics.totalContributors) * 100;
    insights.push(`Engagement rate: ${Math.round(engagementRate)}% of members are actively contributing`);

    return insights;
  }

  private identifyRisks(metrics: any): Risk[] {
    const risks: Risk[] = [];

    if (metrics.activeContributors === 0) {
      risks.push({
        type: 'NO_CONTRIBUTIONS',
        severity: 'high',
        description: 'No member contributions detected',
        recommendation: 'Launch contribution incentives and awareness campaigns'
      });
    }

    if (metrics.topContributorShare > 70) {
      risks.push({
        type: 'CONCENTRATION',
        severity: 'high',
        description: `Extreme concentration: ${Math.round(metrics.topContributorShare)}% from single contributor`,
        recommendation: 'Diversify contribution sources and incentivize participation'
      });
    }

    const engagementRate = (metrics.activeContributors / metrics.totalContributors) * 100;
    if (engagementRate < 20) {
      risks.push({
        type: 'LOW_ENGAGEMENT',
        severity: 'medium',
        description: `Only ${Math.round(engagementRate)}% of members contributing`,
        recommendation: 'Increase member education and contribution opportunities'
      });
    }

    return risks;
  }

  private generateRecommendations(metrics: any, risks: Risk[]): string[] {
    const recommendations: string[] = [];

    if (risks.length > 0) {
      recommendations.push('Address identified engagement risks');
    }

    recommendations.push('Set up contribution tracking dashboards for transparency');
    recommendations.push('Establish tiered rewards based on contribution levels');

    return recommendations;
  }

  private calculateConsistencyScore(contributions: any[]): number {
    if (contributions.length < 2) return 50;

    // Analyze contribution intervals
    const dates = contributions
      .map(c => c.createdAt?.getTime() || 0)
      .sort((a, b) => a - b);

    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push(dates[i] - dates[i - 1]);
    }

    if (intervals.length === 0) return 50;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Lower std dev = more consistent
    const consistencyScore = Math.max(0, 100 - (stdDev / avgInterval) * 100);
    return Math.min(100, consistencyScore);
  }

  private detectGrowthTrend(contributions: any[]): 'increasing' | 'stable' | 'decreasing' {
    if (contributions.length < 3) return 'stable';

    const sorted = [...contributions].sort((a, b) => 
      (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0)
    );

    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half).reduce((sum, c) => sum + (c.amount || 0), 0);
    const secondHalf = sorted.slice(half).reduce((sum, c) => sum + (c.amount || 0), 0);

    if (secondHalf > firstHalf * 1.2) return 'increasing';
    if (firstHalf > secondHalf * 1.2) return 'decreasing';
    return 'stable';
  }

  private assignTier(totalContribution: number, engagement: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
    const score = (totalContribution / 1000) + (engagement / 2);
    
    if (score < 10) return 'bronze';
    if (score < 30) return 'silver';
    if (score < 60) return 'gold';
    return 'platinum';
  }

  private calculateFrequency(count: number, days: number): string {
    const perDay = count / days;
    
    if (perDay > 1) return 'daily';
    if (perDay > 0.2) return 'weekly';
    if (perDay > 0.05) return 'monthly';
    return 'sporadic';
  }

  private calculateGiniCoefficient(amounts: number[]): number {
    const n = amounts.length;
    if (n === 0) return 0;

    const total = amounts.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    let sumAbsoluteDifferences = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        sumAbsoluteDifferences += Math.abs(amounts[i] - amounts[j]);
      }
    }

    return sumAbsoluteDifferences / (2 * n * n * (total / n));
  }

  private recommendDistributionImprovements(gini: number, top10Share: number): string[] {
    const recommendations: string[] = [];

    if (gini > 0.5) {
      recommendations.push('Contribution inequality is high - create targeted programs for new contributors');
    }

    if (top10Share > 70) {
      recommendations.push('Top 10% controls over 70% of contributions - expand participation base');
    }

    recommendations.push('Use tiered rewards to incentivize more contributors');

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
