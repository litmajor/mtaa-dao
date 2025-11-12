/**
 * Governance Analyzer
 * 
 * Analyzes voting patterns, proposal success rates, and governance health
 */

import type { AnalysisResponse, Risk } from '../types';
import { db } from '../../../db';
import { proposals, votes, voteDelegations, daoMemberships } from '../../../../shared/schema';
import { eq, and, sql, gte, count, countDistinct } from 'drizzle-orm';

export class GovernanceAnalyzer {
  /**
   * Analyze governance metrics and health
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
      // No time filter
    } else {
      const days = this.parseTimeframeDays(timeframe);
      if (days > 0) {
        since = new Date();
        since.setDate(since.getDate() - days);
      } else {
        // Default to 30 days
        since = new Date();
        since.setDate(since.getDate() - 30);
      }
    }

    // Total members (for normalization)
    const totalMembersQuery = await db.select({ count: sql`count(*)` })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));
    const totalMembers = Number(totalMembersQuery[0]?.count || 0);

    // Base where clauses
    const proposalWhere = since
      ? and(eq(proposals.daoId, daoId), gte(proposals.createdAt, since))
      : eq(proposals.daoId, daoId);
    const voteWhere = since
      ? and(eq(votes.daoId, daoId), gte(votes.createdAt, since))
      : eq(votes.daoId, daoId);
    const delegationWhere = since
      ? and(eq(voteDelegations.daoId, daoId), gte(voteDelegations.createdAt, since))
      : eq(voteDelegations.daoId, daoId);

    // Proposal counts using aggregates
    const proposalCounts = await db.select({
      total: count(proposals.id),
      active: sql<number>`SUM(CASE WHEN ${proposals.status} = 'active' THEN 1 ELSE 0 END)`,
      passed: sql<number>`SUM(CASE WHEN ${proposals.status} = 'passed' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN ${proposals.status} = 'failed' THEN 1 ELSE 0 END)`,
    }).from(proposals).where(proposalWhere);

    const totalProposals = Number(proposalCounts[0]?.total || 0);
    const activeProposals = Number(proposalCounts[0]?.active || 0);
    const passedProposals = Number(proposalCounts[0]?.passed || 0);
    const failedProposals = Number(proposalCounts[0]?.failed || 0);

    // Unique voters
    const uniqueVotersQuery = await db.select({ count: countDistinct(votes.userId) })
      .from(votes)
      .where(voteWhere);
    const uniqueVoters = Number(uniqueVotersQuery[0]?.count || 0);

    // Avg participation rate: avg (unique voters per proposal / total members)
    let avgParticipationRate = 0;
    if (totalProposals > 0 && totalMembers > 0) {
      // Fetch all proposals to get IDs (for large sets, consider subqueries)
      const propIds = await db.select({ id: proposals.id })
        .from(proposals)
        .where(proposalWhere);
      let totalParticipation = 0;
      for (const prop of propIds) {
        const votersPerProp = await db.select({ count: countDistinct(votes.userId) })
          .from(votes)
          .where(eq(votes.proposalId, prop.id));
        totalParticipation += Number(votersPerProp[0]?.count || 0) / totalMembers;
      }
      avgParticipationRate = totalParticipation / totalProposals;
    }

    // Avg quorum: avg ( (yes+no+abstain) / quorumRequired )
    let avgQuorum = 0;
    if (totalProposals > 0) {
      const quorumData = await db.select({
        quorumAchieved: sql<number>`(COALESCE(${proposals.yesVotes}, 0) + COALESCE(${proposals.noVotes}, 0) + COALESCE(${proposals.abstainVotes}, 0)) / NULLIF(${proposals.quorumRequired}, 0)`
      }).from(proposals).where(proposalWhere);
      const validQuorums = quorumData.filter(q => q.quorumAchieved !== null).map(q => q.quorumAchieved || 0);
      avgQuorum = validQuorums.length > 0 ? validQuorums.reduce((a, b) => a + b, 0) / validQuorums.length : 0;
    }

    // Proposal success rate
    const proposalSuccessRate = totalProposals > 0 ? passedProposals / totalProposals : 0;

    // Average voting time (in days), only for proposals with start and end times
    let avgVotingTime = 0;
    const votingTimes = await db.select({
      duration: sql<number>`EXTRACT(EPOCH FROM (${proposals.voteEndTime} - ${proposals.voteStartTime})) / 86400`
    }).from(proposals).where(and(proposalWhere, sql`${proposals.voteStartTime} IS NOT NULL AND ${proposals.voteEndTime} IS NOT NULL`));
    const validTimes = votingTimes.map(v => v.duration || 0).filter(d => d > 0);
    if (validTimes.length > 0) {
      avgVotingTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    }

    // Delegated votes: count (time-filtered if applicable)
    const delegatedVotesQuery = await db.select({ count: count(voteDelegations.id) })
      .from(voteDelegations)
      .where(delegationWhere);
    const delegatedVotes = Number(delegatedVotesQuery[0]?.count || 0);

    return {
      totalProposals,
      activeProposals,
      passedProposals,
      failedProposals,
      avgParticipationRate,
      avgQuorum,
      proposalSuccessRate,
      avgVotingTime,
      uniqueVoters,
      delegatedVotes
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
    const participation = (metrics.avgParticipationRate * 100).toFixed(0);
    const successRate = (metrics.proposalSuccessRate * 100).toFixed(0);
    
    return `Governance health: ${participation}% participation rate with ${successRate}% proposal success rate. ${metrics.activeProposals} proposals currently active.`;
  }

  private generateInsights(metrics: Record<string, number>): string[] {
    const insights: string[] = [];
    
    if (metrics.avgParticipationRate > 0.6) {
      insights.push('High participation rate indicates engaged community');
    }
    
    if (metrics.proposalSuccessRate > 0.7) {
      insights.push('High proposal success rate suggests good proposal quality');
    } else if (metrics.proposalSuccessRate < 0.4) {
      insights.push('Low proposal success rate may indicate need for better proposal guidelines');
    }
    
    if (metrics.delegatedVotes > metrics.uniqueVoters * 0.3) {
      insights.push('Significant vote delegation shows trust in community leaders');
    }
    
    if (metrics.avgVotingTime < 7) {
      insights.push('Quick voting resolution enables efficient decision-making');
    }
    
    return insights;
  }

  private identifyRisks(metrics: Record<string, number>): Risk[] {
    const risks: Risk[] = [];
    
    if (metrics.avgParticipationRate < 0.3) {
      risks.push({
        level: 'high',
        category: 'governance',
        description: 'Low participation rate threatens governance legitimacy',
        mitigation: 'Implement notification system and voting incentives'
      });
    }
    
    if (metrics.avgQuorum < 0.5) {
      risks.push({
        level: 'medium',
        category: 'governance',
        description: 'Quorum frequently not met',
        mitigation: 'Review quorum requirements or improve member engagement'
      });
    }
    
    if (metrics.uniqueVoters < 20) {
      risks.push({
        level: 'medium',
        category: 'centralization',
        description: 'Low number of unique voters creates centralization risk',
        mitigation: 'Grow active member base and encourage participation'
      });
    }
    
    return risks;
  }

  private generateRecommendations(
    metrics: Record<string, number>,
    risks: Risk[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (metrics.avgParticipationRate < 0.5) {
      recommendations.push('Implement push notifications for active proposals');
      recommendations.push('Create proposal discussion channels before voting');
    }
    
    if (metrics.proposalSuccessRate < 0.5) {
      recommendations.push('Provide proposal templates and guidelines');
      recommendations.push('Implement proposal review process before submission');
    }
    
    if (metrics.avgVotingTime > 10) {
      recommendations.push('Consider shorter voting periods for routine proposals');
    }
    
    recommendations.push('Maintain regular governance reviews and retrospectives');
    
    return recommendations;
  }
}