/**
 * Governance & Treasury Management Service - Phase 5
 * Complete DAO governance operations, treasury management, voting, proposals, and expense tracking
 */

import { db } from "../db";


import {
  daos,
  daoMembers,
  governanceTokens,
  proposals,
  votes,
  voteDelegations,
  treasuryAccounts,
  treasuryAssets,
  treasuryTransactions,
  budgetCategories,
  expenses,
  governanceEvents,
  memberActivityLog,
  governanceReports,
  governanceParameters,
} from "@/shared/schema";
import { eq, and, or, sum, count, avg, gte, lte, between } from "drizzle-orm";

// ============================================================================
// DAO MANAGEMENT
// ============================================================================

/**
 * Create a new DAO
 */
export async function createDAO(
  name: string,
  description: string | undefined,
  founderWalletId: string,
  daoType: string,
  blockchainNetwork: string,
  governanceTokenAddress: string,
  treasuryAddress: string,
  votingPeriodDays: number,
  votingQuorumPercent: number,
  votingApprovalPercent: number
): Promise<{ id: string; name: string; created_at: Date }> {
  const daoId = `dao-${Date.now()}`;

  const result = await db
    .insert(daos)
    .values({
      id: daoId,
      name,
      description,
      founderWalletId,
      daoType,
      blockchainNetwork,
      governanceTokenAddress,
      treasuryAddress,
      votingPeriodDays,
      votingQuorumPercent,
      votingApprovalPercent,
    })
    .returning({ id: daos.id, name: daos.name, createdAt: daos.createdAt });

  if (result.length === 0) throw new Error("Failed to create DAO");

  return result[0];
}

/**
 * Get DAO details
 */
export async function getDAO(daoId: string) {
  const result = await db.select().from(daos).where(eq(daos.id, daoId));
  if (result.length === 0) throw new Error(`DAO ${daoId} not found`);
  return result[0];
}

/**
 * Get all DAOs
 */
export async function getAllDAOs() {
  return db.select().from(daos);
}

/**
 * Update DAO governance parameters
 */
export async function updateDAOParameters(
  daoId: string,
  votingPeriodDays: number | null,
  votingQuorumPercent: number | null,
  votingApprovalPercent: number | null
) {
  const updates: any = { updatedAt: new Date() };
  if (votingPeriodDays !== null) updates.votingPeriodDays = votingPeriodDays;
  if (votingQuorumPercent !== null) updates.votingQuorumPercent = votingQuorumPercent;
  if (votingApprovalPercent !== null) updates.votingApprovalPercent = votingApprovalPercent;

  return db.update(daos).set(updates).where(eq(daos.id, daoId)).returning();
}

// ============================================================================
// DAO MEMBERSHIP
// ============================================================================

/**
 * Add member to DAO
 */
export async function addDAOMember(
  daoId: string,
  walletId: string,
  role: string,
  votingPower: string,
  governanceTokensHeld: string
) {
  const memberId = `member-${Date.now()}`;

  const dao = await getDAO(daoId);
  const weightPercent = parseFloat(votingPower) / 1e18;

  const result = await db
    .insert(daoMembers)
    .values({
      id: memberId,
      daoId,
      walletId,
      memberRole: role,
      votingPower,
      governanceTokensHeld,
      votingWeightPercent: (weightPercent * 100).toString(),
      memberStatus: "active",
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to add member");

  // Update DAO member count
  await db.update(daos).set({ totalMembers: dao.totalMembers + 1 }).where(eq(daos.id, daoId));

  // Log activity
  await recordGovernanceEvent(daoId, "member_joined", `${walletId} joined as ${role}`, walletId);

  return result[0];
}

/**
 * Get DAO members
 */
export async function getDAOMembers(daoId: string) {
  return db.select().from(daoMembers).where(eq(daoMembers.dao_id, daoId));
}

/**
 * Get member details
 */
export async function getMember(memberId: string) {
  const result = await db.select().from(daoMembers).where(eq(daoMembers.id, memberId));
  if (result.length === 0) throw new Error(`Member ${memberId} not found`);
  return result[0];
}

/**
 * Update member voting power
 */
export async function updateMemberVotingPower(
  memberId: string,
  newVotingPower: string,
  newTokenBalance: string
) {
  return db
    .update(daoMembers)
    .set({
      votingPower: newVotingPower,
      governanceTokensHeld: newTokenBalance,
      updatedAt: new Date(),
    })
    .where(eq(daoMembers.id, memberId))
    .returning();
}

/**
 * Get DAO membership statistics
 */
export async function getDAOMembershipStats(daoId: string) {
  const members = await db
    .select({
      totalMembers: count(daoMembers.id),
    })
    .from(daoMembers)
    .where(eq(daoMembers.daoId, daoId));

  const coreCount = await db
    .select({ count: count(daoMembers.id) })
    .from(daoMembers)
    .where(and(eq(daoMembers.daoId, daoId), eq(daoMembers.memberRole, "core")));

  const contributorCount = await db
    .select({ count: count(daoMembers.id) })
    .from(daoMembers)
    .where(and(eq(daoMembers.daoId, daoId), eq(daoMembers.memberRole, "contributor")));

  const avgParticipation = await db
    .select({ avg: avg(daoMembers.votingParticipationRate) })
    .from(daoMembers)
    .where(eq(daoMembers.daoId, daoId));

  return {
    totalMembers: members[0]?.totalMembers || 0,
    coreMembers: coreCount[0]?.count || 0,
    contributors: contributorCount[0]?.count || 0,
    avgParticipationRate: avgParticipation[0]?.avg || 0,
  };
}

// ============================================================================
// GOVERNANCE TOKENS
// ============================================================================

/**
 * Create governance token
 */
export async function createGovernanceToken(
  daoId: string,
  tokenName: string,
  tokenSymbol: string,
  tokenAddress: string,
  totalSupply: string,
  tokenDecimals: number,
  tokenPrice: string
) {
  const tokenId = `token-${Date.now()}`;

  const result = await db
    .insert(governanceTokens)
    .values({
      id: tokenId,
      daoId,
      tokenName,
      tokenSymbol,
      tokenAddress,
      totalSupply,
      circulatingSupply: totalSupply,
      tokenDecimals,
      tokenPriceUsd: tokenPrice,
      marketCapUsd: (parseFloat(totalSupply) * parseFloat(tokenPrice) / 1e18).toString(),
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to create governance token");
  return result[0];
}

/**
 * Get governance token
 */
export async function getGovernanceToken(tokenId: string) {
  const result = await db.select().from(governanceTokens).where(eq(governanceTokens.id, tokenId));
  if (result.length === 0) throw new Error(`Token ${tokenId} not found`);
  return result[0];
}

/**
 * Update token price and market cap
 */
export async function updateTokenPrice(tokenId: string, newPrice: string) {
  const token = await getGovernanceToken(tokenId);
  const newMarketCap = (parseFloat(token.circulatingSupply) * parseFloat(newPrice) / 1e18).toString();

  return db
    .update(governanceTokens)
    .set({
      tokenPriceUsd: newPrice,
      marketCapUsd: newMarketCap,
      updatedAt: new Date(),
    })
    .where(eq(governanceTokens.id, tokenId))
    .returning();
}

// ============================================================================
// PROPOSALS
// ============================================================================

/**
 * Create proposal
 */
export async function createProposal(
  daoId: string,
  creatorWalletId: string,
  title: string,
  description: string,
  proposalType: string,
  ipfsHash?: string
): Promise<{ id: string; proposalNumber: number; status: string }> {
  const dao = await getDAO(daoId);
  const proposalId = `prop-${Date.now()}`;
  const proposalNumber = dao.totalProposals + 1;
  const votingStartsAt = new Date();
  const votingEndsAt = new Date(votingStartsAt.getTime() + dao.votingPeriodDays * 24 * 60 * 60 * 1000);

  const result = await db
    .insert(proposals)
    .values({
      id: proposalId,
      daoId,
      proposalNumber,
      creatorWalletId,
      proposalTitle: title,
      proposalDescription: description,
      proposalType,
      votingStartsAt,
      votingEndsAt,
      proposalStatus: "active",
      ipfsHash: ipfsHash,
    })
    .returning({ id: proposals.id, proposalNumber: proposals.proposalNumber, status: proposals.proposalStatus });

  if (result.length === 0) throw new Error("Failed to create proposal");

  // Update DAO proposal count
  await db.update(daos).set({ totalProposals: dao.totalProposals + 1 }).where(eq(daos.id, daoId));

  // Record governance event
  await recordGovernanceEvent(daoId, "proposal_created", `Proposal #${proposalNumber}: ${title}`, creatorWalletId, proposalId);

  return { id: result[0].id, proposalNumber: result[0].proposalNumber, status: result[0].status };
}

/**
 * Get proposal details
 */
export async function getProposal(proposalId: string) {
  const result = await db.select().from(proposals).where(eq(proposals.id, proposalId));
  if (result.length === 0) throw new Error(`Proposal ${proposalId} not found`);
  return result[0];
}

/**
 * Get DAO proposals with filtering
 */
export async function getDAOProposals(daoId: string, status?: string) {
  let query = db.select().from(proposals).where(eq(proposals.daoId, daoId));

  if (status) {
    query = query.where(eq(proposals.proposalStatus, status));
  }

  return query;
}

/**
 * Update proposal status and voting results
 */
export async function updateProposalStatus(
  proposalId: string,
  status: string,
  votesFor: string,
  votesAgainst: string,
  votesAbstain: string,
  quorumMet: boolean,
  approved: boolean
) {
  const proposal = await getProposal(proposalId);
  const totalVotes = parseFloat(votesFor) + parseFloat(votesAgainst) + parseFloat(votesAbstain);
  const totalVoting = parseFloat(votesFor) + parseFloat(votesAgainst); // Excludes abstain
  const approvalRate = totalVoting > 0 ? (parseFloat(votesFor) / totalVoting) * 100 : 0;
  const participationRate = (totalVotes / 1e18) * 100; // Simplified

  return db
    .update(proposals)
    .set({
      proposalStatus: status,
      votesFor,
      votesAgainst,
      votesAbstain,
      totalVotes: totalVotes.toString(),
      approvalRate: approvalRate.toString(),
      quorumMet,
      approved,
      updatedAt: new Date(),
    })
    .where(eq(proposals.id, proposalId))
    .returning();
}

/**
 * Execute proposal
 */
export async function executeProposal(proposalId: string, txHash: string) {
  const result = await db
    .update(proposals)
    .set({
      executed: true,
      executionTxHash: txHash,
      executionDate: new Date(),
      proposalStatus: "executed",
      updatedAt: new Date(),
    })
    .where(eq(proposals.id, proposalId))
    .returning();

  if (result.length === 0) throw new Error("Failed to execute proposal");

  // Record event
  const proposal = result[0];
  await recordGovernanceEvent(proposal.daoId, "proposal_executed", `Proposal #${proposal.proposalNumber} executed`, undefined, proposalId);

  return result[0];
}

// ============================================================================
// VOTING
// ============================================================================

/**
 * Cast vote on proposal
 */
export async function castVote(
  proposalId: string,
  voterWalletId: string,
  voteChoice: string,
  votingPowerUsed: string,
  voteReason?: string
) {
  const voteId = `vote-${Date.now()}`;

  const result = await db
    .insert(votes)
    .values({
      id: voteId,
      proposal_id: proposalId,
      voter_wallet_id: voterWalletId,
      vote_choice: voteChoice,
      voting_power_used: votingPowerUsed,
      vote_reason: voteReason,
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to cast vote");

  // Update member vote count
  const member = await db.select().from(daoMembers).where(eq(daoMembers.walletId, voterWalletId));
  if (member.length > 0) {
    await db
      .update(daoMembers)
      .set({ votesCast: member[0].votesCast + 1 })
      .where(eq(daoMembers.id, member[0].id));
  }

  // Record activity
  const proposal = await getProposal(proposalId);
  await recordMemberActivity(member[0]?.id || "", "vote_cast", `Voted ${voteChoice} on proposal #${proposal.proposalNumber}`, 5);

  return result[0];
}

/**
 * Get votes on proposal
 */
export async function getProposalVotes(proposalId: string) {
  return db.select().from(votes).where(eq(votes.proposalId, proposalId));
}

/**
 * Get member votes
 */
export async function getMemberVotes(voterWalletId: string) {
  return db.select().from(votes).where(eq(votes.voterWalletId, voterWalletId));
}

// ============================================================================
// VOTE DELEGATION
// ============================================================================

/**
 * Delegate voting power
 */
export async function delegateVotes(
  daoId: string,
  delegatorWalletId: string,
  delegateWalletId: string,
  votingPowerDelegated: string
) {
  const delegationId = `deleg-${Date.now()}`;

  const result = await db
    .insert(voteDelegations)
    .values({
      id: delegationId,
      dao_id: daoId,
      delegator_wallet_id: delegatorWalletId,
      delegate_wallet_id: delegateWalletId,
      voting_power_delegated: votingPowerDelegated,
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to delegate votes");

  await recordGovernanceEvent(daoId, "vote_delegation", `${delegatorWalletId} delegated votes to ${delegateWalletId}`, delegatorWalletId);

  return result[0];
}

/**
 * Get delegations for wallet
 */
export async function getWalletDelegations(daoId: string, walletId: string) {
  return db
    .select()
    .from(voteDelegations)
    .where(and(eq(voteDelegations.daoId, daoId), eq(voteDelegations.delegatorWalletId, walletId)));
}

/**
 * Revoke delegation
 */
export async function revokeDelegation(delegationId: string) {
  return db
    .update(voteDelegations)
    .set({ isActive: false, delegationEndDate: new Date() })
    .where(eq(voteDelegations.id, delegationId))
    .returning();
}

// ============================================================================
// TREASURY MANAGEMENT
// ============================================================================

/**
 * Create treasury account
 */
export async function createTreasuryAccount(
  daoId: string,
  accountName: string,
  accountType: string,
  treasuryAddress: string,
  blockchainNetwork: string,
  multiSigRequired: boolean,
  signaturesRequired?: number,
  totalSigners?: number
) {
  const accountId = `treasury-${Date.now()}`;

  const result = await db
    .insert(treasuryAccounts)
    .values({
      id: accountId,
      daoId,
      accountName,
      accountType,
      treasuryAddress,
      blockchainNetwork,
      multiSigRequired,
      signaturesRequired,
      totalSigners,
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to create treasury account");
  return result[0];
}

/**
 * Get treasury account
 */
export async function getTreasuryAccount(accountId: string) {
  const result = await db.select().from(treasuryAccounts).where(eq(treasuryAccounts.id, accountId));
  if (result.length === 0) throw new Error(`Treasury account ${accountId} not found`);
  return result[0];
}

/**
 * Get DAO treasury accounts
 */
export async function getDAOTreasuryAccounts(daoId: string) {
  return db.select().from(treasuryAccounts).where(eq(treasuryAccounts.daoId, daoId));
}

/**
 * Record treasury transaction
 */
export async function recordTreasuryTransaction(
  treasuryAccountId: string,
  transactionType: string,
  fromAddress: string | undefined,
  toAddress: string | undefined,
  assetAddress: string,
  amount: string,
  amountUsd: string,
  txHash?: string,
  relatedProposalId?: string,
  description?: string
) {
  const txId = `tx-${Date.now()}`;

  const result = await db
    .insert(treasuryTransactions)
    .values({
      id: txId,
      treasuryAccountId,
      transactionType,
      fromAddress,
      toAddress,
      assetAddress,
      amount,
      amountUsd,
      transactionHash: txHash,
      status: "confirmed",
      relatedProposalId,
      description,
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to record transaction");

  // Update treasury balance
  const account = await getTreasuryAccount(treasuryAccountId);
  const balanceChange = transactionType === "deposit" ? parseFloat(amountUsd) : -parseFloat(amountUsd);
  await db
    .update(treasuryAccounts)
    .set({
      totalBalanceUsd: (parseFloat(account.totalBalanceUsd) + balanceChange).toString(),
      updatedAt: new Date(),
    })
    .where(eq(treasuryAccounts.id, treasuryAccountId));

  return result[0];
}

/**
 * Get treasury transactions
 */
export async function getTreasuryTransactions(accountId: string) {
  return db
    .select()
    .from(treasuryTransactions)
    .where(eq(treasuryTransactions.treasuryAccountId, accountId));
}

// ============================================================================
// TREASURY ASSETS
// ============================================================================

/**
 * Record treasury asset
 */
export async function recordTreasuryAsset(
  treasuryAccountId: string,
  assetType: string,
  assetAddress: string,
  assetName: string,
  assetSymbol: string | undefined,
  quantity: string,
  unitPrice: string,
  acquisitionDate: Date,
  acquisitionCost: string
) {
  const assetId = `asset-${Date.now()}`;
  const totalValue = (parseFloat(quantity) * parseFloat(unitPrice)).toString();
  const unrealizedGainLoss = (parseFloat(totalValue) - parseFloat(acquisitionCost)).toString();

  const result = await db
    .insert(treasuryAssets)
    .values({
      id: assetId,
      treasuryAccountId,
      assetType,
      assetAddress,
      assetName,
      assetSymbol,
      quantity,
      unitPriceUsd: unitPrice,
      totalValueUsd: totalValue,
      acquisitionDate,
      acquisitionCostUsd: acquisitionCost,
      unrealizedGainLossUsd: unrealizedGainLoss,
      allocationPercent: 0, // Will be calculated
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to record asset");
  return result[0];
}

/**
 * Get treasury assets
 */
export async function getTreasuryAssets(accountId: string) {
  return db.select().from(treasuryAssets).where(eq(treasuryAssets.treasuryAccountId, accountId));
}

/**
 * Update asset price and allocation
 */
export async function updateAssetPrice(assetId: string, newPrice: string) {
  const asset = await db.select().from(treasuryAssets).where(eq(treasuryAssets.id, assetId));
  if (asset.length === 0) throw new Error("Asset not found");

  const newValue = (parseFloat(asset[0].quantity) * parseFloat(newPrice)).toString();
  const newGainLoss = (parseFloat(newValue) - parseFloat(asset[0].acquisitionCostUsd)).toString();

  return db
    .update(treasuryAssets)
    .set({
      unitPriceUsd: newPrice,
      totalValueUsd: newValue,
      unrealizedGainLossUsd: newGainLoss,
      updatedAt: new Date(),
    })
    .where(eq(treasuryAssets.id, assetId))
    .returning();
}

// ============================================================================
// BUDGET & EXPENSES
// ============================================================================

/**
 * Create budget category
 */
export async function createBudgetCategory(
  daoId: string,
  categoryName: string,
  monthlyBudget: string,
  quarterlyBudget: string,
  annualBudget: string,
  description?: string,
  approvalRequired = true
) {
  const categoryId = `budget-${Date.now()}`;

  const result = await db
    .insert(budgetCategories)
    .values({
      id: categoryId,
      daoId,
      categoryName,
      categoryDescription: description,
      monthlyBudgetUsd: monthlyBudget,
      quarterlyBudgetUsd: quarterlyBudget,
      annualBudgetUsd: annualBudget,
      approvalRequired,
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to create budget category");
  return result[0];
}

/**
 * Get budget categories for DAO
 */
export async function getDAOBudgetCategories(daoId: string) {
  return db.select().from(budgetCategories).where(eq(budgetCategories.daoId, daoId));
}

/**
 * Submit expense
 */
export async function submitExpense(
  budgetCategoryId: string,
  expenseName: string,
  amount: string,
  submittedBy: string,
  description?: string,
  dueDate?: Date,
  receiptIpfs?: string
) {
  const expenseId = `exp-${Date.now()}`;

  const result = await db
    .insert(expenses)
    .values({
      id: expenseId,
      budgetCategoryId,
      expenseName,
      expenseDescription: description,
      amountUsd: amount,
      submittedBy,
      approvalStatus: "pending",
      dueDate,
      receiptIpfsHash: receiptIpfs,
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to submit expense");

  // Update category spent amount
  const category = await db.select().from(budgetCategories).where(eq(budgetCategories.id, budgetCategoryId));
  if (category.length > 0) {
    const newSpent = (parseFloat(category[0].spentThisMonthUsd) + parseFloat(amount)).toString();
    await db
      .update(budgetCategories)
      .set({ spentThisMonthUsd: newSpent })
      .where(eq(budgetCategories.id, budgetCategoryId));
  }

  return result[0];
}

/**
 * Approve expense
 */
export async function approveExpense(expenseId: string, approvedBy: string) {
  return db
    .update(expenses)
    .set({
      approvalStatus: "approved",
      approvedBy,
      updatedAt: new Date(),
    })
    .where(eq(expenses.id, expenseId))
    .returning();
}

/**
 * Reject expense
 */
export async function rejectExpense(expenseId: string, rejectionReason: string) {
  return db
    .update(expenses)
    .set({
      approvalStatus: "rejected",
      rejectionReason,
      updatedAt: new Date(),
    })
    .where(eq(expenses.id, expenseId))
    .returning();
}

/**
 * Get budget expenses
 */
export async function getBudgetExpenses(budgetCategoryId: string) {
  return db.select().from(expenses).where(eq(expenses.budget_category_id, budgetCategoryId));
}

// ============================================================================
// GOVERNANCE EVENTS & AUDIT
// ============================================================================

/**
 * Record governance event
 */
export async function recordGovernanceEvent(
  daoId: string,
  eventType: string,
  description: string,
  triggeredBy?: string,
  relatedProposalId?: string
) {
  const eventId = `event-${Date.now()}`;

  return db
    .insert(governanceEvents)
    .values({
      id: eventId,
      dao_id: daoId,
      event_type: eventType,
      event_description: description,
      triggered_by: triggeredBy,
      related_proposal_id: relatedProposalId,
    })
    .returning();
}

/**
 * Get governance events
 */
export async function getGovernanceEvents(daoId: string) {
  return db.select().from(governanceEvents).where(eq(governanceEvents.dao_id, daoId));
}

/**
 * Record member activity
 */
export async function recordMemberActivity(memberId: string, activityType: string, description: string, points: number = 0) {
  const activityId = `activity-${Date.now()}`;

  return db
    .insert(memberActivityLog)
    .values({
      id: activityId,
      member_id: memberId,
      activity_type: activityType,
      activity_description: description,
      activity_points: points.toString(),
    })
    .returning();
}

/**
 * Get member activity
 */
export async function getMemberActivity(memberId: string) {
  return db.select().from(memberActivityLog).where(eq(memberActivityLog.member_id, memberId));
}

// ============================================================================
// GOVERNANCE REPORTS
// ============================================================================

/**
 * Generate governance report
 */
export async function generateGovernanceReport(
  daoId: string,
  reportPeriod: string,
  periodStartDate: Date,
  periodEndDate: Date
) {
  const reportId = `report-${Date.now()}`;

  // Get statistics
  const proposalStats = await db
    .select({
      total: count(proposals.id),
    })
    .from(proposals)
    .where(and(eq(proposals.dao_id, daoId), between(proposals.created_at, periodStartDate, periodEndDate)));

  const approvedCount = await db
    .select({ count: count(proposals.id) })
    .from(proposals)
    .where(and(eq(proposals.dao_id, daoId), eq(proposals.approved, true), between(proposals.created_at, periodStartDate, periodEndDate)));

  const failedCount = await db
    .select({ count: count(proposals.id) })
    .from(proposals)
    .where(and(eq(proposals.dao_id, daoId), eq(proposals.approved, false), between(proposals.created_at, periodStartDate, periodEndDate)));

  const memberStats = await db
    .select({
      avgParticipation: avg(daoMembers.voting_participation_rate),
    })
    .from(daoMembers)
    .where(eq(daoMembers.dao_id, daoId));

  const activeCount = await db
    .select({ count: count(daoMembers.id) })
    .from(daoMembers)
    .where(and(eq(daoMembers.dao_id, daoId), eq(daoMembers.member_status, "active")));

  const voteStats = await db
    .select({ totalVotes: count(votes.id) })
    .from(votes)
    .innerJoin(proposals, eq(votes.proposal_id, proposals.id))
    .where(and(eq(proposals.dao_id, daoId), between(proposals.created_at, periodStartDate, periodEndDate)));

  const treasuryStats = await db
    .select({
      inflows: sum(treasuryTransactions.amount_usd),
    })
    .from(treasuryTransactions)
    .innerJoin(treasuryAccounts, eq(treasuryTransactions.treasury_account_id, treasuryAccounts.id))
    .where(and(eq(treasuryAccounts.dao_id, daoId), eq(treasuryTransactions.transaction_type, "deposit"), between(treasuryTransactions.transaction_date, periodStartDate, periodEndDate)));

  const outflowStats = await db
    .select({
      outflows: sum(treasuryTransactions.amount_usd),
    })
    .from(treasuryTransactions)
    .innerJoin(treasuryAccounts, eq(treasuryTransactions.treasury_account_id, treasuryAccounts.id))
    .where(and(eq(treasuryAccounts.dao_id, daoId), eq(treasuryTransactions.transaction_type, "withdrawal"), between(treasuryTransactions.transaction_date, periodStartDate, periodEndDate)));

  const result = await db
    .insert(governanceReports)
    .values({
      id: reportId,
      dao_id: daoId,
      report_period: reportPeriod,
      period_start_date: periodStartDate,
      period_end_date: periodEndDate,
      total_proposals: proposalStats[0]?.total || 0,
      approved_proposals: approvedCount[0]?.count || 0,
      rejected_proposals: failedCount[0]?.count || 0,
      average_participation_rate: (memberStats[0]?.avgParticipation || 0).toString(),
      average_approval_rate: "50",
      active_members: activeCount[0]?.count || 0,
      new_members: 0,
      total_votes_cast: voteStats[0]?.totalVotes || 0,
      treasury_inflows_usd: (treasuryStats[0]?.inflows || 0).toString(),
      treasury_outflows_usd: (outflowStats[0]?.outflows || 0).toString(),
      net_treasury_change_usd: ((treasuryStats[0]?.inflows || 0) - (outflowStats[0]?.outflows || 0)).toString(),
      governance_health_score: 75, // Simplified calculation
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to generate report");
  return result[0];
}

/**
 * Get governance reports
 */
export async function getGovernanceReports(daoId: string) {
  return db.select().from(governanceReports).where(eq(governanceReports.dao_id, daoId));
}

// ============================================================================
// GOVERNANCE PARAMETERS
// ============================================================================

/**
 * Set governance parameter
 */
export async function setGovernanceParameter(
  daoId: string,
  parameterName: string,
  parameterCategory: string,
  currentValue: string,
  minValue?: string,
  maxValue?: string,
  unit?: string,
  description?: string
) {
  const paramId = `param-${Date.now()}`;

  const result = await db
    .insert(governanceParameters)
    .values({
      id: paramId,
      dao_id: daoId,
      parameter_name: parameterName,
      parameter_category: parameterCategory,
      current_value: currentValue,
      min_value: minValue,
      max_value: maxValue,
      unit,
      description,
    })
    .returning();

  if (result.length === 0) throw new Error("Failed to set parameter");
  return result[0];
}

/**
 * Get governance parameters
 */
export async function getGovernanceParameters(daoId: string) {
  return db.select().from(governanceParameters).where(eq(governanceParameters.dao_id, daoId));
}

/**
 * Update governance parameter
 */
export async function updateGovernanceParameter(paramId: string, newValue: string, changedBy?: string, proposalId?: string) {
  const param = await db.select().from(governanceParameters).where(eq(governanceParameters.id, paramId));
  if (param.length === 0) throw new Error("Parameter not found");

  return db
    .update(governanceParameters)
    .set({
      previous_value: param[0].current_value,
      current_value: newValue,
      last_changed_by: changedBy,
      last_changed_at: new Date(),
      change_proposal_id: proposalId,
    })
    .where(eq(governanceParameters.id, paramId))
    .returning();
}

// ============================================================================
// DAO DASHBOARD SUMMARY
// ============================================================================

/**
 * Get complete DAO governance status
 */
export async function getDAOGovernanceStatus(daoId: string) {
  const dao = await getDAO(daoId);
  const members = await getDAOMembershipStats(daoId);
  const proposals = await getDAOProposals(daoId);
  const treasury = await getDAOTreasuryAccounts(daoId);
  const budgets = await getDAOBudgetCategories(daoId);

  const activeProposals = proposals.filter((p: any): boolean => p.proposal_status === "active");
  const passedProposals = proposals.filter((p: any): boolean => p.approved);

  return {
    dao,
    members,
    proposals: {
      total: proposals.length,
      active: activeProposals.length,
      passed: passedProposals.length,
      list: proposals,
    },
    treasury: {
      count: treasury.length,
      totalBalance: treasury.reduce((sum: number, t: any): number => sum + parseFloat(t.total_balance_usd), 0),
      accounts: treasury,
    },
    budgets: {
      categories: budgets.length,
      details: budgets,
    },
  };
}
