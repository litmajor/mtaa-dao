/**
 * Governance Analyzer
 * 
 * Analyzes voting patterns, proposal success rates, and governance health
 */

import type { AnalysisResponse, Risk } from '../types';

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
    // Mock metrics - replace with actual database queries
    return {
      totalProposals: 24,
      activeProposals: 3,
      passedProposals: 16,
      failedProposals: 5,
      avgParticipationRate: 0.65, // 65%
      avgQuorum: 0.58,
      proposalSuccessRate: 0.67,
      avgVotingTime: 4.5, // days
      uniqueVoters: 42,
      delegatedVotes: 15
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
