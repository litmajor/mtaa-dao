/**
 * Governance Analyzer
 * 
 * Analyzes voting patterns, proposal success rates, and governance health
 */


import type { AnalysisResponse, Risk } from '../types';
import { db } from '../../../db';
import { proposals, votes, voteDelegations } from '../../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

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
    if (timeframe === '30d' || !timeframe) {
      since = new Date();
      since.setDate(since.getDate() - 30);
    } else if (timeframe === '7d') {
      since = new Date();
      since.setDate(since.getDate() - 7);
    }

    // Proposals
    let proposalWhere: any = eq(proposals.daoId, daoId);
    if (since) {
      proposalWhere = and(proposalWhere, sql`${proposals.createdAt} >= ${since}`);
    }
    const allProposals = await db.select().from(proposals).where(proposalWhere);
    const totalProposals = allProposals.length;
    const activeProposals = allProposals.filter(p => p.status === 'active').length;
    const passedProposals = allProposals.filter(p => p.status === 'passed').length;
    const failedProposals = allProposals.filter(p => p.status === 'failed').length;

    // Votes
    let voteWhere: any = eq(votes.daoId, daoId);
    if (since) {
      voteWhere = and(voteWhere, sql`${votes.createdAt} >= ${since}`);
    }
    const allVotes = await db.select().from(votes).where(voteWhere);
    const uniqueVoters = new Set(allVotes.map(v => v.userId)).size;

    // Participation rate: average % of members voting per proposal
    let avgParticipationRate = 0;
    if (totalProposals > 0) {
      const proposalVoteCounts = allProposals.map(p => allVotes.filter(v => v.proposalId === p.id).length);
      avgParticipationRate = proposalVoteCounts.reduce((a, b) => a + b, 0) / (totalProposals * (proposalVoteCounts.length > 0 ? 1 : 1));
      // If you want to normalize by member count, you can fetch member count here
    }

    // Quorum: average quorum achieved (using yesVotes+noVotes+abstainVotes/quorumRequired)
    let avgQuorum = 0;
    if (totalProposals > 0) {
      avgQuorum = allProposals.reduce((sum, p) => {
        const totalVotes = (p.yesVotes || 0) + (p.noVotes || 0) + (p.abstainVotes || 0);
        return sum + (p.quorumRequired ? totalVotes / p.quorumRequired : 0);
      }, 0) / totalProposals;
    }

    // Proposal success rate
    const proposalSuccessRate = totalProposals > 0 ? passedProposals / totalProposals : 0;

    // Average voting time (in days)
    let avgVotingTime = 0;
    if (totalProposals > 0) {
      avgVotingTime = allProposals.reduce((sum, p) => {
        if (p.voteStartTime && p.voteEndTime) {
          const start = new Date(p.voteStartTime).getTime();
          const end = new Date(p.voteEndTime).getTime();
          return sum + (end - start) / (1000 * 60 * 60 * 24);
        }
        return sum;
      }, 0) / totalProposals;
    }

    // Delegated votes
    let delegatedVotes = 0;
    const delegations = await db.select().from(voteDelegations).where(eq(voteDelegations.daoId, daoId));
    delegatedVotes = delegations.length;

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
