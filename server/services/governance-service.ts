/**
 * Governance & Treasury Management Service - Phase 5
 * Lightweight implementation that keeps the draft governance surface usable
 * without depending on a live database during local development or tests.
 */

import { count, desc, eq, sql } from "drizzle-orm";
import { contributions, daoMemberships, proposals as proposalTable, users, votes } from "../../shared/schema";

let dbAdapterPromise: Promise<{ db: any } | null> | null = null;

async function getDbAdapter() {
  if (dbAdapterPromise) {
    return dbAdapterPromise;
  }

  dbAdapterPromise = (async () => {
    if (process.env.GOVERNANCE_SERVICE_USE_MEMORY === "true") {
      return null;
    }

    try {
      const mod = await import("../db");
      if (mod?.db && typeof mod.db.select === "function") {
        return { db: mod.db };
      }
    } catch {
      // Fall back to the in-memory implementation when the database is unavailable.
    }

    return null;
  })();

  return dbAdapterPromise;
}

type DaoRecord = {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  daoType: string;
  votingPeriodDays: number;
  votingQuorumPercent: number;
  votingApprovalPercent: number;
  totalMembers: number;
  totalProposals: number;
  createdAt: Date;
  updatedAt: Date;
};

type MemberRecord = {
  id: string;
  daoId: string;
  walletId: string;
  role: string;
  votingPower: string;
  governanceTokensHeld: string;
  memberStatus: string;
  votingWeightPercent: string;
  votesCast: number;
  createdAt: Date;
  updatedAt: Date;
};

type ProposalRecord = {
  id: string;
  daoId: string;
  proposalNumber: number;
  creatorWalletId: string;
  title: string;
  description: string;
  proposalType: string;
  proposalStatus: string;
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
  approved: boolean;
  quorumMet: boolean;
  executed: boolean;
  executionTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
};

type VoteRecord = {
  id: string;
  proposalId: string;
  voterWalletId: string;
  voteChoice: string;
  votingPowerUsed: string;
  voteReason?: string;
  createdAt: Date;
};

type DelegationRecord = {
  id: string;
  daoId: string;
  delegatorWalletId: string;
  delegateWalletId: string;
  votingPowerDelegated: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type TreasuryAccountRecord = {
  id: string;
  daoId: string;
  accountName: string;
  accountType: string;
  treasuryAddress: string;
  blockchainNetwork: string;
  multiSigRequired: boolean;
  signaturesRequired?: number;
  totalSigners?: number;
  totalBalanceUsd: string;
  createdAt: Date;
  updatedAt: Date;
};

type TreasuryTransactionRecord = {
  id: string;
  treasuryAccountId: string;
  transactionType: string;
  fromAddress?: string;
  toAddress?: string;
  assetAddress: string;
  amount: string;
  amountUsd: string;
  transactionHash?: string;
  status: string;
  relatedProposalId?: string;
  description?: string;
  createdAt: Date;
};

type TreasuryAssetRecord = {
  id: string;
  treasuryAccountId: string;
  assetType: string;
  assetAddress: string;
  assetName: string;
  assetSymbol?: string;
  quantity: string;
  unitPriceUsd: string;
  totalValueUsd: string;
  acquisitionCostUsd: string;
  unrealizedGainLossUsd: string;
  allocationPercent: number;
  createdAt: Date;
  updatedAt: Date;
};

type BudgetCategoryRecord = {
  id: string;
  daoId: string;
  categoryName: string;
  categoryDescription?: string;
  monthlyBudgetUsd: string;
  quarterlyBudgetUsd: string;
  annualBudgetUsd: string;
  approvalRequired: boolean;
  spentThisMonthUsd: string;
  createdAt: Date;
  updatedAt: Date;
};

type ExpenseRecord = {
  id: string;
  budgetCategoryId: string;
  expenseName: string;
  expenseDescription?: string;
  amountUsd: string;
  submittedBy: string;
  approvalStatus: string;
  approvedBy?: string;
  rejectionReason?: string;
  dueDate?: Date;
  receiptIpfsHash?: string;
  createdAt: Date;
  updatedAt: Date;
};

type GovernanceEventRecord = {
  id: string;
  daoId: string;
  eventType: string;
  eventDescription: string;
  triggeredBy?: string;
  relatedProposalId?: string;
  createdAt: Date;
};

type MemberActivityRecord = {
  id: string;
  memberId: string;
  activityType: string;
  activityDescription: string;
  activityPoints: string;
  createdAt: Date;
};

type GovernanceReportRecord = {
  id: string;
  daoId: string;
  reportPeriod: string;
  periodStartDate: Date;
  periodEndDate: Date;
  totalProposals: number;
  approvedProposals: number;
  rejectedProposals: number;
  averageParticipationRate: string;
  averageApprovalRate: string;
  activeMembers: number;
  newMembers: number;
  totalVotesCast: number;
  treasuryInflowsUsd: string;
  treasuryOutflowsUsd: string;
  netTreasuryChangeUsd: string;
  governanceHealthScore: number;
  createdAt: Date;
};

type GovernanceParameterRecord = {
  id: string;
  daoId: string;
  parameterName: string;
  parameterCategory: string;
  currentValue: string;
  previousValue?: string;
  minValue?: string;
  maxValue?: string;
  unit?: string;
  description?: string;
  lastChangedBy?: string;
  lastChangedAt?: Date;
  changeProposalId?: string;
  createdAt: Date;
  updatedAt: Date;
};

const state = {
  daos: new Map<string, DaoRecord>(),
  members: new Map<string, MemberRecord>(),
  proposals: new Map<string, ProposalRecord>(),
  votes: new Map<string, VoteRecord>(),
  delegations: new Map<string, DelegationRecord>(),
  treasuryAccounts: new Map<string, TreasuryAccountRecord>(),
  treasuryTransactions: new Map<string, TreasuryTransactionRecord>(),
  treasuryAssets: new Map<string, TreasuryAssetRecord>(),
  budgetCategories: new Map<string, BudgetCategoryRecord>(),
  expenses: new Map<string, ExpenseRecord>(),
  governanceEvents: new Map<string, GovernanceEventRecord>(),
  memberActivities: new Map<string, MemberActivityRecord>(),
  governanceReports: new Map<string, GovernanceReportRecord>(),
  governanceParameters: new Map<string, GovernanceParameterRecord>(),
  governanceTokens: new Map<string, any>(),
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function serializeDao(record: DaoRecord) {
  return {
    ...record,
    founder_wallet_id: record.creatorId,
    founderWalletId: record.creatorId,
    dao_type: record.daoType,
    voting_period_days: record.votingPeriodDays,
    voting_quorum_percent: record.votingQuorumPercent,
    voting_approval_percent: record.votingApprovalPercent,
    total_members: record.totalMembers,
    total_proposals: record.totalProposals,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function serializeMember(record: MemberRecord) {
  return {
    ...record,
    wallet_id: record.walletId,
    member_role: record.role,
    member_status: record.memberStatus,
    voting_power: record.votingPower,
    governance_tokens_held: record.governanceTokensHeld,
    voting_weight_percent: record.votingWeightPercent,
    votes_cast: record.votesCast,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function serializeProposal(record: ProposalRecord) {
  return {
    ...record,
    proposal_title: record.title,
    proposal_description: record.description,
    proposal_type: record.proposalType,
    proposal_status: record.proposalStatus,
    votes_for: record.votesFor,
    votes_against: record.votesAgainst,
    votes_abstain: record.votesAbstain,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    approved: record.approved,
    quorum_met: record.quorumMet,
    executed: record.executed,
    execution_tx_hash: record.executionTxHash,
  };
}

function serializeVote(record: VoteRecord) {
  return {
    ...record,
    vote_choice: record.voteChoice,
    voting_power_used: record.votingPowerUsed,
    vote_reason: record.voteReason,
    created_at: record.createdAt,
  };
}

function serializeDelegation(record: DelegationRecord) {
  return {
    ...record,
    delegator_wallet_id: record.delegatorWalletId,
    delegate_wallet_id: record.delegateWalletId,
    voting_power_delegated: record.votingPowerDelegated,
    is_active: record.isActive,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function serializeTreasuryAccount(record: TreasuryAccountRecord) {
  return {
    ...record,
    account_name: record.accountName,
    account_type: record.accountType,
    treasury_address: record.treasuryAddress,
    blockchain_network: record.blockchainNetwork,
    multi_sig_required: record.multiSigRequired,
    signatures_required: record.signaturesRequired,
    total_signers: record.totalSigners,
    total_balance_usd: record.totalBalanceUsd,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function serializeTreasuryTransaction(record: TreasuryTransactionRecord) {
  return {
    ...record,
    treasury_account_id: record.treasuryAccountId,
    transaction_type: record.transactionType,
    from_address: record.fromAddress,
    to_address: record.toAddress,
    asset_address: record.assetAddress,
    amount_usd: record.amountUsd,
    transaction_hash: record.transactionHash,
    related_proposal_id: record.relatedProposalId,
    created_at: record.createdAt,
  };
}

function serializeTreasuryAsset(record: TreasuryAssetRecord) {
  return {
    ...record,
    treasury_account_id: record.treasuryAccountId,
    asset_type: record.assetType,
    asset_address: record.assetAddress,
    asset_name: record.assetName,
    asset_symbol: record.assetSymbol,
    unit_price_usd: record.unitPriceUsd,
    total_value_usd: record.totalValueUsd,
    acquisition_cost_usd: record.acquisitionCostUsd,
    unrealized_gain_loss_usd: record.unrealizedGainLossUsd,
    allocation_percent: record.allocationPercent,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function serializeBudgetCategory(record: BudgetCategoryRecord) {
  return {
    ...record,
    category_name: record.categoryName,
    category_description: record.categoryDescription,
    monthly_budget_usd: record.monthlyBudgetUsd,
    quarterly_budget_usd: record.quarterlyBudgetUsd,
    annual_budget_usd: record.annualBudgetUsd,
    approval_required: record.approvalRequired,
    spent_this_month_usd: record.spentThisMonthUsd,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function serializeExpense(record: ExpenseRecord) {
  return {
    ...record,
    budget_category_id: record.budgetCategoryId,
    expense_name: record.expenseName,
    expense_description: record.expenseDescription,
    amount_usd: record.amountUsd,
    submitted_by: record.submittedBy,
    approval_status: record.approvalStatus,
    approved_by: record.approvedBy,
    rejection_reason: record.rejectionReason,
    receipt_ipfs_hash: record.receiptIpfsHash,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function serializeGovernanceEvent(record: GovernanceEventRecord) {
  return {
    ...record,
    dao_id: record.daoId,
    event_type: record.eventType,
    event_description: record.eventDescription,
    triggered_by: record.triggeredBy,
    related_proposal_id: record.relatedProposalId,
    created_at: record.createdAt,
  };
}

function serializeMemberActivity(record: MemberActivityRecord) {
  return {
    ...record,
    member_id: record.memberId,
    activity_type: record.activityType,
    activity_description: record.activityDescription,
    activity_points: record.activityPoints,
    created_at: record.createdAt,
  };
}

function serializeGovernanceReport(record: GovernanceReportRecord) {
  return {
    ...record,
    dao_id: record.daoId,
    report_period: record.reportPeriod,
    period_start_date: record.periodStartDate,
    period_end_date: record.periodEndDate,
    total_proposals: record.totalProposals,
    approved_proposals: record.approvedProposals,
    rejected_proposals: record.rejectedProposals,
    average_participation_rate: record.averageParticipationRate,
    average_approval_rate: record.averageApprovalRate,
    active_members: record.activeMembers,
    new_members: record.newMembers,
    total_votes_cast: record.totalVotesCast,
    treasury_inflows_usd: record.treasuryInflowsUsd,
    treasury_outflows_usd: record.treasuryOutflowsUsd,
    net_treasury_change_usd: record.netTreasuryChangeUsd,
    governance_health_score: record.governanceHealthScore,
    created_at: record.createdAt,
  };
}

function serializeGovernanceParameter(record: GovernanceParameterRecord) {
  return {
    ...record,
    dao_id: record.daoId,
    parameter_name: record.parameterName,
    parameter_category: record.parameterCategory,
    current_value: record.currentValue,
    previous_value: record.previousValue,
    min_value: record.minValue,
    max_value: record.maxValue,
    last_changed_by: record.lastChangedBy,
    last_changed_at: record.lastChangedAt,
    change_proposal_id: record.changeProposalId,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function resetGovernanceServiceState() {
  state.daos.clear();
  state.members.clear();
  state.proposals.clear();
  state.votes.clear();
  state.delegations.clear();
  state.treasuryAccounts.clear();
  state.treasuryTransactions.clear();
  state.treasuryAssets.clear();
  state.budgetCategories.clear();
  state.expenses.clear();
  state.governanceEvents.clear();
  state.memberActivities.clear();
  state.governanceReports.clear();
  state.governanceParameters.clear();
  state.governanceTokens.clear();
}

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
) {
  const daoId = makeId("dao");
  const record: DaoRecord = {
    id: daoId,
    name,
    description,
    creatorId: founderWalletId,
    daoType,
    votingPeriodDays,
    votingQuorumPercent,
    votingApprovalPercent,
    totalMembers: 0,
    totalProposals: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.daos.set(daoId, record);
  return serializeDao(record);
}

export async function getDAO(daoId: string) {
  const record = state.daos.get(daoId);
  if (!record) throw new Error(`DAO ${daoId} not found`);
  return serializeDao(record);
}

export async function getAllDAOs() {
  return Array.from(state.daos.values()).map(serializeDao);
}

export async function updateDAOParameters(
  daoId: string,
  votingPeriodDays: number | null,
  votingQuorumPercent: number | null,
  votingApprovalPercent: number | null
) {
  const record = state.daos.get(daoId);
  if (!record) throw new Error(`DAO ${daoId} not found`);
  if (votingPeriodDays !== null) record.votingPeriodDays = votingPeriodDays;
  if (votingQuorumPercent !== null) record.votingQuorumPercent = votingQuorumPercent;
  if (votingApprovalPercent !== null) record.votingApprovalPercent = votingApprovalPercent;
  record.updatedAt = new Date();
  return [serializeDao(record)];
}

export async function addDAOMember(
  daoId: string,
  walletId: string,
  role: string,
  votingPower: string,
  governanceTokensHeld: string
) {
  const dao = state.daos.get(daoId);
  if (!dao) throw new Error(`DAO ${daoId} not found`);
  const memberId = makeId("member");
  const record: MemberRecord = {
    id: memberId,
    daoId,
    walletId,
    role,
    votingPower,
    governanceTokensHeld,
    memberStatus: "active",
    votingWeightPercent: (parseFloat(votingPower) / 1e18 * 100).toString(),
    votesCast: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.members.set(memberId, record);
  dao.totalMembers += 1;
  dao.updatedAt = new Date();
  return serializeMember(record);
}

export async function getDAOMembers(daoId: string) {
  return Array.from(state.members.values())
    .filter((member) => member.daoId === daoId)
    .map(serializeMember);
}

export async function getMember(memberId: string) {
  const record = state.members.get(memberId);
  if (!record) throw new Error(`Member ${memberId} not found`);
  return serializeMember(record);
}

export async function updateMemberVotingPower(memberId: string, newVotingPower: string, newTokenBalance: string) {
  const record = state.members.get(memberId);
  if (!record) throw new Error(`Member ${memberId} not found`);
  record.votingPower = newVotingPower;
  record.governanceTokensHeld = newTokenBalance;
  record.updatedAt = new Date();
  return [serializeMember(record)];
}

export async function getDAOMembershipStats(daoId: string) {
  const members = Array.from(state.members.values()).filter((member) => member.daoId === daoId);
  const coreMembers = members.filter((member) => member.role === "core").length;
  const contributors = members.filter((member) => member.role === "contributor").length;
  const avgParticipationRate = members.length === 0 ? 0 : members.reduce((sum, member) => sum + Number(member.votingWeightPercent || 0), 0) / members.length;
  return {
    totalMembers: members.length,
    coreMembers,
    contributors,
    avgParticipationRate,
  };
}

export async function createGovernanceToken(
  daoId: string,
  tokenName: string,
  tokenSymbol: string,
  tokenAddress: string,
  totalSupply: string,
  tokenDecimals: number,
  tokenPrice: string
) {
  const tokenId = makeId("token");
  const record = {
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
  };
  state.governanceTokens.set(tokenId, record);
  return {
    ...record,
    token_name: record.tokenName,
    token_symbol: record.tokenSymbol,
    token_address: record.tokenAddress,
    total_supply: record.totalSupply,
    circulating_supply: record.circulatingSupply,
    token_decimals: record.tokenDecimals,
    token_price_usd: record.tokenPriceUsd,
    market_cap_usd: record.marketCapUsd,
  };
}

export async function getGovernanceToken(tokenId: string) {
  const record = state.governanceTokens.get(tokenId);
  if (!record) throw new Error(`Token ${tokenId} not found`);
  return {
    ...record,
    token_name: record.tokenName,
    token_symbol: record.tokenSymbol,
    token_address: record.tokenAddress,
    total_supply: record.totalSupply,
    circulating_supply: record.circulatingSupply,
    token_decimals: record.tokenDecimals,
    token_price_usd: record.tokenPriceUsd,
    market_cap_usd: record.marketCapUsd,
  };
}

export async function updateTokenPrice(tokenId: string, newPrice: string) {
  const record = state.governanceTokens.get(tokenId);
  if (!record) throw new Error(`Token ${tokenId} not found`);
  record.tokenPriceUsd = newPrice;
  record.marketCapUsd = (parseFloat(record.totalSupply) * parseFloat(newPrice) / 1e18).toString();
  return [await getGovernanceToken(tokenId)];
}

export async function createProposal(
  daoId: string,
  creatorWalletId: string,
  title: string,
  description: string,
  proposalType: string,
  ipfsHash?: string
) {
  const dao = state.daos.get(daoId);
  if (!dao) throw new Error(`DAO ${daoId} not found`);
  const proposalId = makeId("prop");
  const record: ProposalRecord = {
    id: proposalId,
    daoId,
    proposalNumber: dao.totalProposals + 1,
    creatorWalletId,
    title,
    description,
    proposalType,
    proposalStatus: "active",
    votesFor: "0",
    votesAgainst: "0",
    votesAbstain: "0",
    approved: false,
    quorumMet: false,
    executed: false,
    executionTxHash: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.proposals.set(proposalId, record);
  dao.totalProposals += 1;
  dao.updatedAt = new Date();
  return { id: proposalId, proposalNumber: record.proposalNumber, status: record.proposalStatus };
}

export async function getProposal(proposalId: string) {
  const record = state.proposals.get(proposalId);
  if (!record) throw new Error(`Proposal ${proposalId} not found`);
  return serializeProposal(record);
}

export async function getDAOProposals(daoId: string, status?: string) {
  const proposals = Array.from(state.proposals.values())
    .filter((proposal) => proposal.daoId === daoId)
    .filter((proposal) => (status ? proposal.proposalStatus === status : true));
  return proposals.map(serializeProposal);
}

export async function updateProposalStatus(
  proposalId: string,
  status: string,
  votesFor: string,
  votesAgainst: string,
  votesAbstain: string,
  quorumMet: boolean,
  approved: boolean
) {
  const record = state.proposals.get(proposalId);
  if (!record) throw new Error(`Proposal ${proposalId} not found`);
  record.proposalStatus = status;
  record.votesFor = votesFor;
  record.votesAgainst = votesAgainst;
  record.votesAbstain = votesAbstain;
  record.quorumMet = quorumMet;
  record.approved = approved;
  record.updatedAt = new Date();
  return [serializeProposal(record)];
}

export async function executeProposal(proposalId: string, txHash: string) {
  const record = state.proposals.get(proposalId);
  if (!record) throw new Error(`Proposal ${proposalId} not found`);
  record.executed = true;
  record.executionTxHash = txHash;
  record.proposalStatus = "executed";
  record.updatedAt = new Date();
  return serializeProposal(record);
}

export async function castVote(
  proposalId: string,
  voterWalletId: string,
  voteChoice: string,
  votingPowerUsed: string,
  voteReason?: string
) {
  const proposal = state.proposals.get(proposalId);
  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
  const voteId = makeId("vote");
  const record: VoteRecord = {
    id: voteId,
    proposalId,
    voterWalletId,
    voteChoice,
    votingPowerUsed,
    voteReason,
    createdAt: new Date(),
  };
  state.votes.set(voteId, record);
  return serializeVote(record);
}

export async function getProposalVotes(proposalId: string) {
  return Array.from(state.votes.values())
    .filter((vote) => vote.proposalId === proposalId)
    .map(serializeVote);
}

export async function getMemberVotes(voterWalletId: string) {
  return Array.from(state.votes.values())
    .filter((vote) => vote.voterWalletId === voterWalletId)
    .map(serializeVote);
}

export async function delegateVotes(
  daoId: string,
  delegatorWalletId: string,
  delegateWalletId: string,
  votingPowerDelegated: string
) {
  const delegationId = makeId("deleg");
  const record: DelegationRecord = {
    id: delegationId,
    daoId,
    delegatorWalletId,
    delegateWalletId,
    votingPowerDelegated,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.delegations.set(delegationId, record);
  return serializeDelegation(record);
}

export async function getWalletDelegations(daoId: string, walletId: string) {
  return Array.from(state.delegations.values())
    .filter((delegation) => delegation.daoId === daoId && delegation.delegatorWalletId === walletId)
    .map(serializeDelegation);
}

export async function revokeDelegation(delegationId: string) {
  const record = state.delegations.get(delegationId);
  if (!record) throw new Error(`Delegation ${delegationId} not found`);
  record.isActive = false;
  record.updatedAt = new Date();
  return [serializeDelegation(record)];
}

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
  const accountId = makeId("treasury");
  const record: TreasuryAccountRecord = {
    id: accountId,
    daoId,
    accountName,
    accountType,
    treasuryAddress,
    blockchainNetwork,
    multiSigRequired,
    signaturesRequired,
    totalSigners,
    totalBalanceUsd: "0",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.treasuryAccounts.set(accountId, record);
  return serializeTreasuryAccount(record);
}

export async function getTreasuryAccount(accountId: string) {
  const record = state.treasuryAccounts.get(accountId);
  if (!record) throw new Error(`Treasury account ${accountId} not found`);
  return serializeTreasuryAccount(record);
}

export async function getDAOTreasuryAccounts(daoId: string) {
  return Array.from(state.treasuryAccounts.values())
    .filter((account) => account.daoId === daoId)
    .map(serializeTreasuryAccount);
}

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
  const account = state.treasuryAccounts.get(treasuryAccountId);
  if (!account) throw new Error(`Treasury account ${treasuryAccountId} not found`);
  const txId = makeId("tx");
  const record: TreasuryTransactionRecord = {
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
    createdAt: new Date(),
  };
  state.treasuryTransactions.set(txId, record);
  const balanceChange = transactionType === "deposit" ? Number(amountUsd) : -Number(amountUsd);
  account.totalBalanceUsd = (Number(account.totalBalanceUsd) + balanceChange).toString();
  account.updatedAt = new Date();
  return serializeTreasuryTransaction(record);
}

export async function getTreasuryTransactions(accountId: string) {
  return Array.from(state.treasuryTransactions.values())
    .filter((transaction) => transaction.treasuryAccountId === accountId)
    .map(serializeTreasuryTransaction);
}

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
  const assetId = makeId("asset");
  const totalValue = (parseFloat(quantity) * parseFloat(unitPrice)).toString();
  const unrealizedGainLoss = (parseFloat(totalValue) - parseFloat(acquisitionCost)).toString();
  const record: TreasuryAssetRecord = {
    id: assetId,
    treasuryAccountId,
    assetType,
    assetAddress,
    assetName,
    assetSymbol,
    quantity,
    unitPriceUsd: unitPrice,
    totalValueUsd: totalValue,
    acquisitionCostUsd: acquisitionCost,
    unrealizedGainLossUsd: unrealizedGainLoss,
    allocationPercent: 0,
    createdAt: acquisitionDate,
    updatedAt: new Date(),
  };
  state.treasuryAssets.set(assetId, record);
  return serializeTreasuryAsset(record);
}

export async function getTreasuryAssets(accountId: string) {
  return Array.from(state.treasuryAssets.values())
    .filter((asset) => asset.treasuryAccountId === accountId)
    .map(serializeTreasuryAsset);
}

export async function updateAssetPrice(assetId: string, newPrice: string) {
  const record = state.treasuryAssets.get(assetId);
  if (!record) throw new Error("Asset not found");
  record.unitPriceUsd = newPrice;
  record.totalValueUsd = (parseFloat(record.quantity) * parseFloat(newPrice)).toString();
  record.unrealizedGainLossUsd = (parseFloat(record.totalValueUsd) - parseFloat(record.acquisitionCostUsd)).toString();
  record.updatedAt = new Date();
  return [serializeTreasuryAsset(record)];
}

export async function createBudgetCategory(
  daoId: string,
  categoryName: string,
  monthlyBudget: string,
  quarterlyBudget: string,
  annualBudget: string,
  description?: string,
  approvalRequired = true
) {
  const categoryId = makeId("budget");
  const record: BudgetCategoryRecord = {
    id: categoryId,
    daoId,
    categoryName,
    categoryDescription: description,
    monthlyBudgetUsd: monthlyBudget,
    quarterlyBudgetUsd: quarterlyBudget,
    annualBudgetUsd: annualBudget,
    approvalRequired,
    spentThisMonthUsd: "0",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.budgetCategories.set(categoryId, record);
  return serializeBudgetCategory(record);
}

export async function getDAOBudgetCategories(daoId: string) {
  return Array.from(state.budgetCategories.values())
    .filter((category) => category.daoId === daoId)
    .map(serializeBudgetCategory);
}

export async function submitExpense(
  budgetCategoryId: string,
  expenseName: string,
  amount: string,
  submittedBy: string,
  description?: string,
  dueDate?: Date,
  receiptIpfs?: string
) {
  const category = state.budgetCategories.get(budgetCategoryId);
  if (!category) throw new Error(`Budget category ${budgetCategoryId} not found`);
  const expenseId = makeId("exp");
  const record: ExpenseRecord = {
    id: expenseId,
    budgetCategoryId,
    expenseName,
    expenseDescription: description,
    amountUsd: amount,
    submittedBy,
    approvalStatus: "pending",
    dueDate,
    receiptIpfsHash: receiptIpfs,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.expenses.set(expenseId, record);
  category.spentThisMonthUsd = (Number(category.spentThisMonthUsd) + Number(amount)).toString();
  category.updatedAt = new Date();
  return serializeExpense(record);
}

export async function approveExpense(expenseId: string, approvedBy: string) {
  const record = state.expenses.get(expenseId);
  if (!record) throw new Error(`Expense ${expenseId} not found`);
  record.approvalStatus = "approved";
  record.approvedBy = approvedBy;
  record.updatedAt = new Date();
  return [serializeExpense(record)];
}

export async function rejectExpense(expenseId: string, rejectionReason: string) {
  const record = state.expenses.get(expenseId);
  if (!record) throw new Error(`Expense ${expenseId} not found`);
  record.approvalStatus = "rejected";
  record.rejectionReason = rejectionReason;
  record.updatedAt = new Date();
  return [serializeExpense(record)];
}

export async function getBudgetExpenses(budgetCategoryId: string) {
  return Array.from(state.expenses.values())
    .filter((expense) => expense.budgetCategoryId === budgetCategoryId)
    .map(serializeExpense);
}

export async function recordGovernanceEvent(
  daoId: string,
  eventType: string,
  description: string,
  triggeredBy?: string,
  relatedProposalId?: string
) {
  const eventId = makeId("event");
  const record: GovernanceEventRecord = {
    id: eventId,
    daoId,
    eventType,
    eventDescription: description,
    triggeredBy,
    relatedProposalId,
    createdAt: new Date(),
  };
  state.governanceEvents.set(eventId, record);
  return [serializeGovernanceEvent(record)];
}

export async function getGovernanceEvents(daoId: string) {
  return Array.from(state.governanceEvents.values())
    .filter((event) => event.daoId === daoId)
    .map(serializeGovernanceEvent);
}

export async function recordMemberActivity(memberId: string, activityType: string, description: string, points: number = 0) {
  const activityId = makeId("activity");
  const record: MemberActivityRecord = {
    id: activityId,
    memberId,
    activityType,
    activityDescription: description,
    activityPoints: points.toString(),
    createdAt: new Date(),
  };
  state.memberActivities.set(activityId, record);
  return [serializeMemberActivity(record)];
}

export async function getMemberActivity(memberId: string) {
  return Array.from(state.memberActivities.values())
    .filter((activity) => activity.memberId === memberId)
    .map(serializeMemberActivity);
}

export async function generateGovernanceReport(
  daoId: string,
  reportPeriod: string,
  periodStartDate: Date,
  periodEndDate: Date
) {
  const proposalCount = Array.from(state.proposals.values()).filter((proposal) => proposal.daoId === daoId).length;
  const approvedCount = Array.from(state.proposals.values()).filter((proposal) => proposal.daoId === daoId && proposal.approved).length;
  const rejectedCount = Array.from(state.proposals.values()).filter((proposal) => proposal.daoId === daoId && !proposal.approved && proposal.proposalStatus === "failed").length;
  const activeMembers = Array.from(state.members.values()).filter((member) => member.daoId === daoId).length;
  const totalVotes = Array.from(state.votes.values()).filter((vote) => state.proposals.get(vote.proposalId)?.daoId === daoId).length;
  const treasuryTransactions = Array.from(state.treasuryTransactions.values()).filter((transaction) => state.treasuryAccounts.get(transaction.treasuryAccountId)?.daoId === daoId);
  const inflows = treasuryTransactions.filter((transaction) => transaction.transactionType === "deposit").reduce((sum, transaction) => sum + Number(transaction.amountUsd), 0);
  const outflows = treasuryTransactions.filter((transaction) => transaction.transactionType === "withdrawal").reduce((sum, transaction) => sum + Number(transaction.amountUsd), 0);
  const reportId = makeId("report");
  const record: GovernanceReportRecord = {
    id: reportId,
    daoId,
    reportPeriod,
    periodStartDate,
    periodEndDate,
    totalProposals: proposalCount,
    approvedProposals: approvedCount,
    rejectedProposals: rejectedCount,
    averageParticipationRate: "0",
    averageApprovalRate: "50",
    activeMembers,
    newMembers: 0,
    totalVotesCast: totalVotes,
    treasuryInflowsUsd: inflows.toString(),
    treasuryOutflowsUsd: outflows.toString(),
    netTreasuryChangeUsd: (inflows - outflows).toString(),
    governanceHealthScore: 75,
    createdAt: new Date(),
  };
  state.governanceReports.set(reportId, record);
  return serializeGovernanceReport(record);
}

export async function getGovernanceReports(daoId: string) {
  return Array.from(state.governanceReports.values())
    .filter((report) => report.daoId === daoId)
    .map(serializeGovernanceReport);
}

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
  const paramId = makeId("param");
  const record: GovernanceParameterRecord = {
    id: paramId,
    daoId,
    parameterName,
    parameterCategory,
    currentValue,
    minValue,
    maxValue,
    unit,
    description,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.governanceParameters.set(paramId, record);
  return serializeGovernanceParameter(record);
}

export async function getGovernanceParameters(daoId: string) {
  return Array.from(state.governanceParameters.values())
    .filter((parameter) => parameter.daoId === daoId)
    .map(serializeGovernanceParameter);
}

export async function updateGovernanceParameter(paramId: string, newValue: string, changedBy?: string, proposalId?: string) {
  const record = state.governanceParameters.get(paramId);
  if (!record) throw new Error("Parameter not found");
  record.previousValue = record.currentValue;
  record.currentValue = newValue;
  record.lastChangedBy = changedBy;
  record.lastChangedAt = new Date();
  record.changeProposalId = proposalId;
  record.updatedAt = new Date();
  return [serializeGovernanceParameter(record)];
}

export async function getGovernanceLeaderboard(daoId: string, limit = 20) {
  const adapter = await getDbAdapter();

  if (adapter?.db) {
    const leaderboard = await adapter.db
      .select({
        userId: users.id,
        username: users.username,
        email: users.email,
        profileImage: users.profileImageUrl,
        role: daoMemberships.role,
        joinedAt: daoMemberships.joinedAt,
        contributionCount: sql<number>`(
          SELECT COUNT(*) FROM contributions c
          WHERE c.dao_id = ${daoId} AND c.user_id = users.id
        )`,
        proposalCount: sql<number>`(
          SELECT COUNT(*) FROM proposals p
          WHERE p.dao_id = ${daoId} AND p.proposer_id = users.id
        )`,
        voteCount: sql<number>`(
          SELECT COUNT(*) FROM votes v
          WHERE v.dao_id = ${daoId} AND v.user_id = users.id
        )`,
      })
      .from(daoMemberships)
      .innerJoin(users, eq(users.id, daoMemberships.userId))
      .where(eq(daoMemberships.daoId, daoId))
      .orderBy(desc(sql<number>`(
        SELECT COUNT(*) FROM contributions c
        WHERE c.dao_id = ${daoId} AND c.user_id = users.id
      )`))
      .limit(limit);

    return leaderboard.map((member: any, index: number) => ({
      rank: index + 1,
      userId: member.userId,
      username: member.username,
      email: member.email,
      profileImage: member.profileImage,
      role: member.role,
      joinedAt: member.joinedAt,
      stats: {
        contributions: Number(member.contributionCount || 0),
        proposals: Number(member.proposalCount || 0),
        votes: Number(member.voteCount || 0),
        score: Number(member.contributionCount || 0) * 10 + Number(member.proposalCount || 0) * 20 + Number(member.voteCount || 0) * 5,
      },
    }));
  }

  const members = Array.from(state.members.values()).filter((member) => member.daoId === daoId);
  return members
    .map((member) => ({
      rank: 0,
      userId: member.walletId,
      username: member.walletId,
      email: null,
      profileImage: null,
      role: member.role,
      joinedAt: member.createdAt,
      stats: {
        contributions: 0,
        proposals: 0,
        votes: 0,
        score: 0,
      },
    }))
    .slice(0, limit);
}

export async function getGovernanceStats(daoId: string) {
  const adapter = await getDbAdapter();

  if (adapter?.db) {
    const [memberStats] = await adapter.db
      .select({ totalMembers: count(daoMemberships.id) })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));

    const [contributionStats] = await adapter.db
      .select({ totalContributions: count(contributions.id) })
      .from(contributions)
      .where(eq(contributions.daoId, daoId));

    const [proposalStats] = await adapter.db
      .select({ totalProposals: count(proposalTable.id) })
      .from(proposalTable)
      .where(eq(proposalTable.daoId, daoId));

    const [voteStats] = await adapter.db
      .select({ totalVotes: count(votes.id) })
      .from(votes)
      .where(eq(votes.daoId, daoId));

    return {
      totalMembers: Number(memberStats?.totalMembers || 0),
      totalContributions: Number(contributionStats?.totalContributions || 0),
      totalProposals: Number(proposalStats?.totalProposals || 0),
      totalVotes: Number(voteStats?.totalVotes || 0),
      totalActivityScore: Number(contributionStats?.totalContributions || 0) * 10 + Number(proposalStats?.totalProposals || 0) * 20 + Number(voteStats?.totalVotes || 0) * 5,
    };
  }

  const members = Array.from(state.members.values()).filter((member) => member.daoId === daoId);
  const daoProposals = Array.from(state.proposals.values()).filter((proposal) => proposal.daoId === daoId);
  const votesForDao = Array.from(state.votes.values()).filter((vote) => state.proposals.get(vote.proposalId)?.daoId === daoId);
  return {
    totalMembers: members.length,
    totalContributions: 0,
    totalProposals: daoProposals.length,
    totalVotes: votesForDao.length,
    totalActivityScore: daoProposals.length * 20 + votesForDao.length * 5,
  };
}

export async function getGovernanceMemberRank(daoId: string, userId: string) {
  const leaderboard = await getGovernanceLeaderboard(daoId, 500);
  const match = leaderboard.find((member: any) => member.userId === userId);
  if (!match) {
    throw new Error("User not found in this DAO");
  }

  return {
    daoId,
    userId,
    rank: match.rank,
    username: match.username,
    email: match.email,
    profileImage: match.profileImage,
    role: match.role,
    stats: match.stats,
  };
}

export async function getTopContributors(daoId: string, type = "overall", limit = 10) {
  const leaderboard = await getGovernanceLeaderboard(daoId, 500);
  const sorted = [...leaderboard].sort((a: any, b: any) => {
    const valueA = type === "contributions" ? a.stats.contributions : type === "proposals" ? a.stats.proposals : type === "votes" ? a.stats.votes : a.stats.score;
    const valueB = type === "contributions" ? b.stats.contributions : type === "proposals" ? b.stats.proposals : type === "votes" ? b.stats.votes : b.stats.score;
    return valueB - valueA;
  });

  return {
    daoId,
    type,
    topContributors: sorted.slice(0, limit).map((member: any, index: number) => ({
      rank: index + 1,
      userId: member.userId,
      username: member.username,
      profileImage: member.profileImage,
      contributions: member.stats.contributions,
      proposals: member.stats.proposals,
      votes: member.stats.votes,
      totalScore: member.stats.score,
    })),
  };
}

export async function getDAOGovernanceStatus(daoId: string) {
  const dao = await getDAO(daoId);
  const members = await getDAOMembershipStats(daoId);
  const proposals = await getDAOProposals(daoId);
  const treasury = await getDAOTreasuryAccounts(daoId);
  const budgets = await getDAOBudgetCategories(daoId);
  const activeProposals = proposals.filter((proposal: any) => proposal.proposal_status === "active");
  const passedProposals = proposals.filter((proposal: any) => proposal.approved);
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
      totalBalance: treasury.reduce((sum: number, account: any) => sum + Number(account.total_balance_usd), 0),
      accounts: treasury,
    },
    budgets: {
      categories: budgets.length,
      details: budgets,
    },
  };
}
