/**
 * Risk Assessor
 * 
 * Assesses risks, ethical compliance, and governance guardrails for proposals
 */

import type { EthicsCheck } from '../types';
import { db } from '../../../db';
import { proposals, vaults, daoMemberships, userActivities } from '../../../../shared/schema';
import { eq, and, sql, gte } from 'drizzle-orm';

export class RiskAssessor {
  /**
   * Assess risks and ethical compliance for a proposal
   */
  async assess(proposalId: string, daoId: string): Promise<EthicsCheck> {
    // Fetch proposal data
    const proposalData = await db.select().from(proposals).where(and(eq(proposals.id, proposalId), eq(proposals.daoId, daoId))).limit(1);
    const proposal = proposalData[0];
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found in DAO ${daoId}`);
    }

    const budgetCheck = await this.checkBudgetCompliance(proposal, daoId);
    const conflictCheck = await this.checkConflictOfInterest(proposal);
    const benefitScore = await this.assessCommunityBenefit(proposal);
    const riskLevel = await this.calculateRiskLevel(proposal);
    const fairnessScore = await this.assessFairness(proposal);
    
    const checks = {
      budgetCompliance: budgetCheck,
      conflictOfInterest: conflictCheck,
      communityBenefit: benefitScore,
      riskLevel,
      fairnessScore
    };
    
    return {
      proposalId,
      checks,
      recommendations: this.generateRecommendations(checks),
      requiredActions: this.determineRequiredActions(checks)
    };
  }

  private async checkBudgetCompliance(proposal: typeof proposals.$inferSelect, daoId: string): Promise<boolean> {
    // Fetch current treasury balance from vaults
    const daoVaults = await db.select({ balance: vaults.balance }).from(vaults).where(eq(vaults.daoId, daoId));
    const currentBalance = daoVaults.reduce((sum, v) => sum + parseFloat(v.balance || '0'), 0);

    // Get proposal amount from metadata if available
    let proposalAmount = 0;
    if (proposal.metadata && typeof proposal.metadata === 'object' && 'amount' in proposal.metadata && proposal.metadata.amount != null) {
      proposalAmount = parseFloat(String((proposal.metadata as any).amount));
    }
    const budgetThreshold = 0.1; // 10% of treasury
    return proposalAmount <= currentBalance * budgetThreshold;
  }

  private async checkConflictOfInterest(proposal: typeof proposals.$inferSelect): Promise<boolean> {
    // Use proposerId; check if proposer is admin or has recent activities that might conflict
    if (!proposal.proposerId) return false; // No conflict if no proposer

    const membership = await db.select({ role: daoMemberships.role })
      .from(daoMemberships)
      .where(and(eq(daoMemberships.userId, proposal.proposerId), eq(daoMemberships.daoId, proposal.daoId)))
      .limit(1);

    const userRole = membership[0]?.role || 'member';
    const hasConflict = ['admin', 'core'].includes(userRole); // Example roles that might have conflict

    // Additional check: if proposer has >5 contributions in last 30d, potential self-interest
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const recentContribs = await db.select({ count: sql`count(*)` })
      .from(userActivities)
      .where(and(
        eq(userActivities.userId, proposal.proposerId),
        eq(userActivities.dao_id, proposal.daoId),
        eq(userActivities.type, 'contribution'),
        gte(userActivities.createdAt, since)
      ));
    const contribCount = Number(recentContribs[0]?.count || 0);

    return hasConflict || contribCount > 5;
  }

  private async assessCommunityBenefit(proposal: typeof proposals.$inferSelect): Promise<number> {
    // Simple heuristic: keyword score in description (0-1)
    // Keywords: community, benefit, all members, shared, etc.
    const description = (proposal.description || '').toLowerCase();
    const keywords = ['community', 'benefit', 'members', 'shared', 'public', 'growth', 'engagement'];
    const matches = keywords.filter(k => description.includes(k)).length;
    const score = matches / keywords.length;

    // Bonus: if proposalType is 'community' or similar, +0.2
    if (proposal.proposalType === 'community') {
      return Math.min(1, score + 0.2);
    }
    return score;
  }

  private async calculateRiskLevel(proposal: typeof proposals.$inferSelect): Promise<'low' | 'medium' | 'high'> {
    // Based on amount relative to treasury, proposalType, and other factors
    let proposalAmount = 0;
    if (proposal.metadata && typeof proposal.metadata === 'object' && 'amount' in proposal.metadata && proposal.metadata.amount != null) {
      proposalAmount = parseFloat(String((proposal.metadata as any).amount));
    }

  // Fetch treasury for relative risk
  const daoVaults = await db.select({ balance: vaults.balance }).from(vaults).where(eq(vaults.daoId, proposal.daoId));
  const currentBalance = daoVaults.reduce((sum, v) => sum + parseFloat(v.balance || '0'), 0);
  const amountRatio = currentBalance > 0 ? proposalAmount / currentBalance : 0;

  if (amountRatio > 0.2 || proposal.proposalType === 'high_risk') return 'high';
  if (amountRatio > 0.05) return 'medium';
  return 'low';
  }

  private async assessFairness(proposal: typeof proposals.$inferSelect): Promise<number> {
    // Heuristic: check for words indicating fairness/equity in description
    const description = (proposal.description || '').toLowerCase();
    const positiveKeywords = ['fair', 'equitable', 'inclusive', 'diverse', 'equal'];
    const negativeKeywords = ['exclusive', 'favor', 'specific', 'individual'];
    const posMatches = positiveKeywords.filter(k => description.includes(k)).length;
    const negMatches = negativeKeywords.filter(k => description.includes(k)).length;
    
    let score = (posMatches - negMatches) / (positiveKeywords.length);
    score = Math.max(0, Math.min(1, score + 0.5)); // Normalize to 0-1, bias positive

    // If targets all members, higher score
    if (description.includes('all members')) {
      score += 0.2;
    }
    return Math.min(1, score);
  }

  private generateRecommendations(checks: EthicsCheck['checks']): string[] {
    const recommendations: string[] = [];
    
    if (!checks.budgetCompliance) {
      recommendations.push('Review and adjust proposal budget to comply with treasury limits');
    }
    
    if (checks.conflictOfInterest) {
      recommendations.push('Proposer should recuse themselves from voting due to conflict of interest');
      recommendations.push('Consider appointing independent reviewer for this proposal');
    }
    
    if (checks.communityBenefit < 0.6) {
      recommendations.push('Clarify how this proposal benefits the wider community');
      recommendations.push('Consider adding measurable success criteria');
    }
    
    if (checks.riskLevel === 'high') {
      recommendations.push('Implement additional safeguards and oversight');
      recommendations.push('Consider phased implementation to reduce risk');
    }
    
    if (checks.fairnessScore < 0.7) {
      recommendations.push('Review proposal distribution to ensure equitable impact');
      recommendations.push('Seek broader community input before proceeding');
    }
    
    return recommendations;
  }

  private determineRequiredActions(checks: EthicsCheck['checks']): string[] {
    const actions: string[] = [];
    
    if (!checks.budgetCompliance) {
      actions.push('REQUIRED: Revise budget to meet compliance');
    }
    
    if (checks.conflictOfInterest) {
      actions.push('REQUIRED: Declare conflict of interest publicly');
    }
    
    if (checks.riskLevel === 'high') {
      actions.push('REQUIRED: Obtain additional approvals from core team');
      actions.push('REQUIRED: Provide detailed risk mitigation plan');
    }
    
    if (checks.communityBenefit < 0.4) {
      actions.push('REQUIRED: Demonstrate clear community benefit');
    }
    
    return actions;
  }
}