/**
 * Community Analyzer
 * 
 * Analyzes community growth, engagement, and health metrics
 */

import type { AnalysisResponse, Risk } from '../types';
import { db } from '../../../db';
import { daoMemberships, userActivities } from '../../../../shared/schema';
import { eq, and, sql, desc, gte, inArray } from 'drizzle-orm';

export class CommunityAnalyzer {
  /**
   * Analyze community metrics and health
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
    if (timeframe === 'all') {
      // No time filter for 'all'
    } else {
      const days = this.parseTimeframeDays(timeframe);
      if (days > 0) {
        since = new Date();
        since.setDate(since.getDate() - days);
      } else {
        // Default to 30 days if invalid or unspecified
        since = new Date();
        since.setDate(since.getDate() - 30);
      }
    }

    // Total members (lifetime)
    const totalMembers = await db.select({ count: sql`count(*)` })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));
    const totalMembersCount = Number(totalMembers[0]?.count || 0);

    // New members in timeframe (or all if no timeframe)
    let newMembers;
    if (since) {
      newMembers = await db.select({ count: sql`count(*)` })
        .from(daoMemberships)
        .where(and(eq(daoMemberships.daoId, daoId), gte(daoMemberships.joinedAt, since)));
    } else {
      newMembers = await db.select({ count: sql`count(*)` })
        .from(daoMemberships)
        .where(and(eq(daoMemberships.daoId, daoId)));
    }
    const newMembersCount = Number(newMembers[0]?.count || 0);

    // All member userIds (for filtering activities)
    const allMembers = await db.select({ userId: daoMemberships.userId })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));
    const allMemberUserIds = allMembers.map(m => m.userId);

    // Active members: unique users with activity in timeframe (or all time if no timeframe)
    let activeMembersCount = 0;
    if (allMemberUserIds.length > 0) {
      let actives;
      if (since) {
        actives = await db
          .selectDistinct({ userId: userActivities.userId })
          .from(userActivities)
          .where(and(
            inArray(userActivities.userId, allMemberUserIds),
            eq(userActivities.dao_id, daoId),
            gte(userActivities.createdAt, since)
          ));
      } else {
        actives = await db
          .selectDistinct({ userId: userActivities.userId })
          .from(userActivities)
          .where(and(
            inArray(userActivities.userId, allMemberUserIds),
            eq(userActivities.dao_id, daoId)
          ));
      }
      activeMembersCount = actives.length;
    }

    // Retention rate: (active members / total members)
    const retentionRate = totalMembersCount > 0 ? activeMembersCount / totalMembersCount : 0;

    // Engagement score: proxy as (active members / total members)
    const engagementScore = retentionRate;

    // Average contribution per member: count 'contribution' activities in timeframe (or all)
    let avgContributionPerMember = 0;
    if (totalMembersCount > 0) {
      let contribs;
      if (since) {
        contribs = await db.select({ count: sql`count(*)` })
          .from(userActivities)
          .where(and(
            eq(userActivities.dao_id, daoId),
            eq(userActivities.type, 'contribution'),
            gte(userActivities.createdAt, since)
          ));
      } else {
        contribs = await db.select({ count: sql`count(*)` })
          .from(userActivities)
          .where(and(
            eq(userActivities.dao_id, daoId),
            eq(userActivities.type, 'contribution')
          ));
      }
      avgContributionPerMember = Number(contribs[0]?.count || 0) / totalMembersCount;
    }

    // Top contributors: number of members with >3 contributions in timeframe (or all)
    let topContributors = 0;
    let contribCountsQuery = db.select({ userId: userActivities.userId, count: sql`count(*)` })
      .from(userActivities)
      .where(and(eq(userActivities.dao_id, daoId), eq(userActivities.type, 'contribution')))
      .groupBy(userActivities.userId)
      .having(sql`count(*) > 3`);
    if (since) {
      contribCountsQuery = db.select({ userId: userActivities.userId, count: sql`count(*)` })
        .from(userActivities)
        .where(and(
          eq(userActivities.dao_id, daoId),
          eq(userActivities.type, 'contribution'),
          gte(userActivities.createdAt, since)
        ))
        .groupBy(userActivities.userId)
        .having(sql`count(*) > 3`);
    }
    const contribCounts = await contribCountsQuery;
    topContributors = contribCounts.length;

    // Growth rate: new members / total members
    const growthRate = totalMembersCount > 0 ? newMembersCount / totalMembersCount : 0;

    // Average session time: not tracked, so use placeholder (or implement if data available)
    const avgSessionTime = 12.5; // Placeholder; consider adding session tracking in schema

    // Returning member rate: calculate if timeframe set, else placeholder
    let returningMemberRate = 0.68; // Default placeholder
    if (since) {
      // To calculate properly, need a prior period. Here, assume prior same length.
      const periodDays = this.parseTimeframeDays(timeframe);
      if (periodDays > 0) {
        const priorSince = new Date(since);
        priorSince.setDate(priorSince.getDate() - periodDays);
        
        // Users active in prior period
        const priorActives = await db
          .selectDistinct({ userId: userActivities.userId })
          .from(userActivities)
          .where(and(
            inArray(userActivities.userId, allMemberUserIds),
            eq(userActivities.dao_id, daoId),
            gte(userActivities.createdAt, priorSince),
            sql`${userActivities.createdAt} < ${since}`
          ));
        const priorActiveCount = priorActives.length;

        if (priorActiveCount > 0) {
          // Users active in both periods
          const returningQuery = await db
            .selectDistinct({ userId: userActivities.userId })
            .from(userActivities)
            .where(and(
              inArray(userActivities.userId, priorActives.map(a => a.userId)),
              eq(userActivities.dao_id, daoId),
              gte(userActivities.createdAt, since)
            ));
          const returningCount = returningQuery.length;
          returningMemberRate = returningCount / priorActiveCount;
        }
      }
    }

    return {
      totalMembers: totalMembersCount,
      activeMembers: activeMembersCount,
      newMembers: newMembersCount,
      retentionRate,
      engagementScore,
      avgContributionPerMember,
      topContributors,
      growthRate,
      avgSessionTime,
      returningMemberRate
    };
  }

  private parseTimeframeDays(timeframe?: string): number {
    if (!timeframe) return 30;
    if (timeframe === '7d') return 7;
    if (timeframe === '30d') return 30;
    if (timeframe === '90d') return 90;
    // Add more as needed
    const match = timeframe.match(/^(\d+)d$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private generateSummary(metrics: Record<string, number>): string {
    const growth = (metrics.growthRate * 100).toFixed(0);
    const engagement = (metrics.engagementScore * 100).toFixed(0);
    const retention = (metrics.retentionRate * 100).toFixed(0);
    
    return `Community of ${metrics.totalMembers} members growing at ${growth}% with ${engagement}% engagement score and ${retention}% retention rate.`;
  }

  private generateInsights(metrics: Record<string, number>): string[] {
    const insights: string[] = [];
    
    if (metrics.retentionRate > 0.8) {
      insights.push('Excellent retention rate indicates strong community value');
    }
    
    if (metrics.engagementScore > 0.7) {
      insights.push('High engagement shows active and committed membership');
    }
    
    if (metrics.growthRate > 0.15) {
      insights.push('Strong growth rate demonstrates community appeal');
    }
    
    if (metrics.activeMembers / metrics.totalMembers > 0.6) {
      insights.push('High active member ratio shows healthy community participation');
    }
    
    if (metrics.returningMemberRate > 0.6) {
      insights.push('High returning member rate indicates sustained interest');
    }
    
    return insights;
  }

  private identifyRisks(metrics: Record<string, number>): Risk[] {
    const risks: Risk[] = [];
    
    if (metrics.retentionRate < 0.5) {
      risks.push({
        level: 'high',
        category: 'retention',
        description: 'Low retention rate threatens community stability',
        mitigation: 'Survey departing members and improve value proposition'
      });
    }
    
    if (metrics.engagementScore < 0.4) {
      risks.push({
        level: 'high',
        category: 'engagement',
        description: 'Low engagement indicates declining community interest',
        mitigation: 'Launch engagement campaigns and new community initiatives'
      });
    }
    
    if (metrics.growthRate < 0.05) {
      risks.push({
        level: 'medium',
        category: 'growth',
        description: 'Slow growth may limit community potential',
        mitigation: 'Implement referral program and marketing initiatives'
      });
    }
    
    if (metrics.activeMembers / metrics.totalMembers < 0.3) {
      risks.push({
        level: 'medium',
        category: 'participation',
        description: 'Low active member ratio suggests engagement issues',
        mitigation: 'Re-engage inactive members and improve onboarding'
      });
    }
    
    return risks;
  }

  private generateRecommendations(
    metrics: Record<string, number>,
    risks: Risk[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (metrics.retentionRate < 0.7) {
      recommendations.push('Implement member retention program');
      recommendations.push('Conduct exit surveys to understand churn reasons');
    }
    
    if (metrics.engagementScore < 0.6) {
      recommendations.push('Create more community events and activities');
      recommendations.push('Recognize and reward active contributors');
    }
    
    if (metrics.newMembers < metrics.totalMembers * 0.1) {
      recommendations.push('Launch referral rewards program');
      recommendations.push('Improve onboarding experience for new members');
    }
    
    recommendations.push('Maintain regular community health check-ins');
    recommendations.push('Celebrate community milestones and achievements');
    
    return recommendations;
  }
}