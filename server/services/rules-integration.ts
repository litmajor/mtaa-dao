/**
 * Phase 3 Rules Engine Integration Hooks
 * 
 * This file provides integration points for the Custom Rules Engine
 * across different transaction flows in the DAO platform.
 */

import { ruleEngine } from './rule-engine';

/**
 * Evaluate member creation rules
 * 
 * @param daoId - The DAO ID
 * @param memberData - New member information
 * @returns {Promise<{approved: boolean, results: any[]}>}
 */
export async function evaluateMemberCreationRules(
  daoId: string,
  memberData: {
    memberAddress: string;
    contributionAmount?: string | number;
    role?: string;
    joinedAt?: Date;
  }
) {
  try {
    const context = {
      memberAddress: memberData.memberAddress,
      contributionAmount: memberData.contributionAmount || 0,
      role: memberData.role || 'member',
      joinedAt: memberData.joinedAt?.toISOString() || new Date().toISOString()
    };

    const results = await ruleEngine.evaluateAllRules(daoId, 'member_create', context);
    const approved = ruleEngine.checkAllApproved(results);

    return { approved, results };
  } catch (error) {
    console.error('[RulesIntegration] Member creation rule evaluation failed:', error);
    return { approved: true, results: [] }; // Fail open - allow if rules fail
  }
}

/**
 * Evaluate withdrawal rules
 * 
 * @param daoId - The DAO ID
 * @param withdrawalData - Withdrawal request information
 * @returns {Promise<{approved: boolean, results: any[]}>}
 */
export async function evaluateWithdrawalRules(
  daoId: string,
  withdrawalData: {
    memberAddress: string;
    withdrawalAmount: string | number;
    lastWithdrawalDate?: Date;
    frequency?: string;
  }
) {
  try {
    const context = {
      memberAddress: withdrawalData.memberAddress,
      withdrawalAmount: withdrawalData.withdrawalAmount,
      lastWithdrawalDate: withdrawalData.lastWithdrawalDate?.toISOString() || null,
      frequency: withdrawalData.frequency || 'on_demand',
      withdrawalDate: new Date().toISOString()
    };

    const results = await ruleEngine.evaluateAllRules(daoId, 'withdrawal', context);
    const approved = ruleEngine.checkAllApproved(results);

    return { approved, results };
  } catch (error) {
    console.error('[RulesIntegration] Withdrawal rule evaluation failed:', error);
    return { approved: true, results: [] }; // Fail open - allow if rules fail
  }
}

/**
 * Evaluate rotation rules
 * 
 * @param daoId - The DAO ID
 * @param rotationData - Rotation request information
 * @returns {Promise<{approved: boolean, results: any[]}>}
 */
export async function evaluateRotationRules(
  daoId: string,
  rotationData: {
    currentLeader?: string;
    nextLeader?: string;
    rotationFrequency?: string;
    rotationDate?: Date;
  }
) {
  try {
    const context = {
      currentLeader: rotationData.currentLeader || '',
      nextLeader: rotationData.nextLeader || '',
      rotationFrequency: rotationData.rotationFrequency || 'monthly',
      rotationDate: rotationData.rotationDate?.toISOString() || new Date().toISOString()
    };

    const results = await ruleEngine.evaluateAllRules(daoId, 'rotation', context);
    const approved = ruleEngine.checkAllApproved(results);

    return { approved, results };
  } catch (error) {
    console.error('[RulesIntegration] Rotation rule evaluation failed:', error);
    return { approved: true, results: [] }; // Fail open - allow if rules fail
  }
}

/**
 * Evaluate governance/proposal rules
 * 
 * @param daoId - The DAO ID
 * @param proposalData - Proposal information
 * @returns {Promise<{approved: boolean, results: any[]}>}
 */
export async function evaluateGovernanceRules(
  daoId: string,
  proposalData: {
    proposalId?: string;
    proposalType?: string;
    votesFor?: number;
    votesAgainst?: number;
    totalMembers?: number;
    createdAt?: Date;
  }
) {
  try {
    const context = {
      proposalId: proposalData.proposalId || '',
      proposalType: proposalData.proposalType || 'standard',
      votesFor: proposalData.votesFor || 0,
      votesAgainst: proposalData.votesAgainst || 0,
      totalMembers: proposalData.totalMembers || 1,
      createdAt: proposalData.createdAt?.toISOString() || new Date().toISOString()
    };

    // Calculate vote percentages for governance rules
    const totalVotes = context.votesFor + context.votesAgainst;
    (context as any)['votePercentage'] = totalVotes > 0 
      ? (context.votesFor / totalVotes * 100).toFixed(2)
      : 0;
    (context as any)['participationRate'] = context.totalMembers > 0
      ? (totalVotes / context.totalMembers * 100).toFixed(2)
      : 0;

    const results = await ruleEngine.evaluateAllRules(daoId, 'proposal', context);
    const approved = ruleEngine.checkAllApproved(results);

    return { approved, results };
  } catch (error) {
    console.error('[RulesIntegration] Governance rule evaluation failed:', error);
    return { approved: true, results: [] }; // Fail open - allow if rules fail
  }
}

/**
 * Evaluate financial transaction rules (interest, fees, etc.)
 * 
 * @param daoId - The DAO ID
 * @param transactionData - Transaction information
 * @returns {Promise<{approved: boolean, results: any[]}>}
 */
export async function evaluateFinancialRules(
  daoId: string,
  transactionData: {
    transactionType: string;
    amount: string | number;
    memberId?: string;
    description?: string;
  }
) {
  try {
    const context = {
      transactionType: transactionData.transactionType,
      amount: transactionData.amount,
      memberId: transactionData.memberId || '',
      description: transactionData.description || '',
      timestamp: new Date().toISOString()
    };

    const results = await ruleEngine.evaluateAllRules(daoId, 'transaction', context);
    const approved = ruleEngine.checkAllApproved(results);

    return { approved, results };
  } catch (error) {
    console.error('[RulesIntegration] Financial rule evaluation failed:', error);
    return { approved: true, results: [] }; // Fail open - allow if rules fail
  }
}

/**
 * Format rule rejection message for user
 */
export function formatRuleRejectionMessage(results: any[]): string {
  const rejectedRules = results.filter(r => r.status === 'rejected');
  if (rejectedRules.length === 0) return '';

  const reasons = rejectedRules
    .map(r => `${r.ruleName}: ${r.reason || 'Rejected'}`)
    .join('; ');

  return `Request denied by DAO rules: ${reasons}`;
}

/**
 * Log rule evaluation for audit trail
 */
export function logRuleEvaluation(
  daoId: string,
  eventType: string,
  context: any,
  results: any[]
): void {
  const approved = results.every(r => r.status === 'approved' || r.status === 'pending');
  
  console.log(`[RulesAudit] DAO: ${daoId} | Event: ${eventType} | Approved: ${approved}`, {
    totalRules: results.length,
    approvedRules: results.filter(r => r.status === 'approved').length,
    rejectedRules: results.filter(r => r.status === 'rejected').length,
    context
  });
}
