// Dashboard API utility functions for Okedi, Yuki, and Amara personas
// These functions replace mock data with real API calls to the backend

/**
 * Balance Source Structure
 * 
 * Each balance in the dashboard includes:
 * - source: 'okedi' | 'exchange' | 'bank' | 'custodial' | 'subprofile' | 'dao' | 'escrow'
 * - custodyType: 'non-custodial' | 'custodial' | 'linked'
 *   * non-custodial: User holds private keys (OKEDI wallet, subprofile)
 *   * custodial: Team/partner holds keys (bank, exchange, or custodial service)
 *   * linked: Read-only aggregation from external service
 * - amount: balance in this source
 * - currency: asset ticker (e.g., 'cUSD', 'USDC', 'ETH')
 * - label: display name (e.g., 'Primary Okedi Wallet', 'Amara Subprofile', 'OKEDI DAO Treasury')
 * - description: optional context (e.g., "Personal savings", "DAO Treasury", "Escrow pending")
 * - parentLabel: grouping label (e.g., 'Primary Wallet (Okedi)', 'My Subprofiles', 'My DAOs', 'Linked Accounts')
 * - updatedAt: ISO timestamp of last sync
 * - status: 'verified' | 'pending' | 'error'
 * - icon: optional emoji override
 */

export interface BalanceSource {
  source: 'okedi' | 'exchange' | 'bank' | 'custodial' | 'subprofile' | 'dao' | 'escrow';
  custodyType: 'non-custodial' | 'custodial' | 'linked';
  amount: number;
  currency: string;
  label: string;
  description?: string;
  parentLabel?: string;
  updatedAt: string;
  status?: 'verified' | 'pending' | 'error';
  icon?: string;
}

// Lightweight trading types used across dashboard/Yuki APIs
export interface Strategy {
  id: string;
  name: string;
  description?: string;
  author?: string;
  returnPct?: number;
  risk?: 'low' | 'medium' | 'high' | string;
}

export interface Position {
  id: string;
  symbol: string;
  size: number;
  entryPrice: number;
  side: 'long' | 'short' | string;
  pnl?: number;
}

export interface Exchange {
  id: string;
  name: string;
  balances?: { currency: string; amount: number }[];
  connectedAt?: string;
}

export interface OkediDashboardData {
  user?: string | {
    id?: string;
    name?: string;
    kycStatus?: string;
    kycLevel?: string;
  };
  totalBalance: number;
  trustScore: number;
  governanceScore: number;
  governanceActivity?: Array<{ title?: string; summary?: string; timestamp?: string }>;
  daoCount: number;
  memberCount: number;
  strategies: Strategy[];
  strategyStatuses: { [key: string]: 'active' | 'inactive' };
  treasuryAlerts?: Array<{ title?: string; message?: string; summary?: string; timestamp?: string }>;
  positions: Position[];
  exchanges: Exchange[];
  balances: BalanceSource[];  // Unified balance breakdown by source
  myDAOs: DAOInfo[];
  activeProposals: ProposalInfo[];
  recentProposals: ProposalInfo[];
  recentTransactions: TransactionInfo[];
  activeEscrows: EscrowInfo[];
  governanceStats: GovernanceStats;
  treasuryChanges?: Array<{ summary?: string; note?: string; ts?: string }>;
  marketAnomalies?: Array<{ title?: string; summary?: string; timestamp?: string }>;
  strategyTriggers?: Array<{ title?: string; note?: string; timestamp?: string }>;
  proposalDeadlines?: Array<{ title?: string; deadline?: string }>;
  liquidityChanges?: Array<{ title?: string; timestamp?: string; summary?: string }>;
  riskEvents?: Array<{ title?: string; summary?: string; timestamp?: string }>;
  referralStats: ReferralStats;
  daoChat: DaoChatData;
  tipOfTheDay: string;
  kycLevel?: 'pending' | 'verified';
  kycStatus?: string;
  kycProgress?: number;
  kycLimits?: {
    daily: number;
    monthly: number;
    verifiedDaily: number;
    verifiedMonthly: number;
  };
  transferLimits?: {
    daily: number;
    monthly: number;
    verifiedDaily: number;
    verifiedMonthly: number;
  };
  cryptoCurrency?: string;
  fiatCurrency?: string;

  selectedDaoId?: string;
  currentUser?: {
    id: string;
    name?: string;
    votingPower?: number;
  };
  marketRegime?: string;
  treasuryExposure?: number;
  connectedExchanges?: number;
  riskLevel?: string;
  pendingActionsCount?: number;
  walletAddress?: string;
}


// Added missing schema interfaces for type safety
export interface DAOInfo {
  id: string;
  name: string;
  logo?: string;
  members: number;
  role: 'founder' | 'admin' | 'member' | 'elder' | string;
  description?: string;
  memberCount?: number;
  treasury?: number;
  activityPoints?: number;
  promotionEligible?: boolean;
  type?: 'meta' | 'collective' | 'free' | 'short_term';
  activity?: Array<Record<string, unknown>>;
  memberSince?: string;
  onboarding?: { complete?: boolean };
  onboardingState?: { complete?: boolean };
  createdBy?: string;
  createdByName?: string;
  votingPower?: number;
  proposals?: ProposalInfo[];
  recentProposals?: ProposalInfo[];
}

export interface ProposalInfo {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'passed' | 'failed' | 'executed' | 'voting' | 'pending';
  votesFor: number;
  votesAgainst: number;
  deadline: string;
  daoName?: string;
  currentVotes?: number;
  votesRequired?: number;
  createdBy?: string;
  createdByName?: string;
  description?: string;
  type?: 'general' | 'budget' | 'poll' | 'emergency';
  daoId?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  votingEndsAt?: string | Date;
  currentVotesBreakdown?: { for: number; against: number; abstain: number };
  userVotingPower?: number;
}

export interface TransactionInfo {
  id: string;
  type: 'send' | 'receive' | 'trade' | 'stake' | 'unstake' | 'deposit' | 'transfer';
  amount: number;
  currency: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  hash?: string;
}

export interface EscrowInfo {
  id: string;
  amount: number;
  currency: string;
  releaseDate: string;
  status: 'locked' | 'pending-release' | 'released';
  description?: string;
  participantName?: string;
  daysLeft?: number;
}

export interface GovernanceStats {
  totalVotingPower: number;
  votesParticipated: number;
  proposalsCreated: number;
  avgVotingRate: number;
  votesCast?: number;
  governancePower?: number;
  daoMemberCount?: number;
  influenceRank?: number;
}

export interface ReferralStats {
  referralCode: string;
  referrals: number;
  commission: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalEarnings?: number;
  activeReferrals?: number;
  referralLink?: string;
}

export interface DaoChatData {
  messages: ChatMessage[];
  unreadCount: number;
  daoName?: string;
}

export interface ChatMessage {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  reactions?: { emoji: string; count: number }[];
  text?: string;
  message?: string;
}

export interface DashboardResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export type OkediDashboardDataT = OkediDashboardData;

/**
 * Fetch Okedi (beginner) dashboard data
 * GET /api/dashboard/okedi
 */
export async function getOkediDashboard(): Promise<OkediDashboardDataT> {
  try {
    const res = await fetch('/api/v1/dashboard/okedi', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include auth cookies
    });
    
    if (!res.ok) {
      throw new Error(`Dashboard API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching Okedi dashboard:', error);
    throw error;
  }
}

/**
 * Fetch user's persona and metrics
 * GET /api/users/persona-data
 */
export async function getUserPersona() {
  try {
    const res = await fetch('/api/v1/users/persona-data', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error(`Persona API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching user persona:', error);
    throw error;
  }
}

/**
 * Fetch user's DAOs
 * GET /api/users/my-daos
 */
export async function getUserDAOs() {
  try {
    const res = await fetch('/api/v1/users/my-daos', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error(`DAOs API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching user DAOs:', error);
    throw error;
  }
}

/**
 * Fetch Yuki (intermediate) dashboard data
 * GET /api/dashboard/yuki
 */
export async function getYukiDashboard() {
  try {
    const res = await fetch('/api/v1/dashboard/yuki', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error(`Yuki Dashboard API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching Yuki dashboard:', error);
    throw error;
  }
}

/**
 * Fetch Amara (advanced) dashboard data
 * GET /api/dashboard/amara
 */
export async function getAmaraDashboard() {
  try {
    const res = await fetch('/api/v1/dashboard/amara', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error(`Amara Dashboard API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching Amara dashboard:', error);
    throw error;
  }
}

/**
 * Vote on a proposal (handles backend vote submission)
 * POST /api/proposals/{proposalId}/vote
 */
export async function voteOnProposal(proposalId: string, vote: boolean) {
  try {
    const res = await fetch(`/api/proposals/${proposalId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ vote }),
    });
    
    if (!res.ok) {
      throw new Error(`Vote API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error voting on proposal:', error);
    throw error;
  }
}

/**
 * Get referral stats for user
 * GET /api/referrals/stats
 */
export async function getReferralStats() {
  try {
    const res = await fetch('/api/referrals/stats', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error(`Referral stats API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    throw error;
  }
}

/**
 * Get DAO chat messages
 * GET /api/v1/daos/{daoId}/chat/messages
 */
export async function getDAOChat(daoId: string) {
  try {
    // V1 endpoint: GET /api/v1/daos/:daoId/chat/messages
    const res = await fetch(`/api/v1/daos/${daoId}/chat/messages`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error(`DAO Chat API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching DAO chat:', error);
    throw error;
  }
}

/**
 * Get governance stats for user
 * GET /api/governance/stats
 */
export async function getGovernanceStats() {
  try {
    const res = await fetch('/api/governance/stats', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error(`Governance stats API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching governance stats:', error);
    throw error;
  }
}

/**
 * Get active escrows for user
 * GET /api/escrows/active
 */
export async function getActiveEscrows() {
  try {
    const res = await fetch('/api/escrows/active', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error(`Escrows API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching escrows:', error);
    throw error;
  }
}

/**
 * Get recent transactions for user
 * GET /api/transactions?limit=5
 */
export async function getRecentTransactions(limit: number = 5) {
  try {
    const res = await fetch(`/api/transactions?limit=${limit}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error(`Transactions API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Get active proposals (for DAOs user is part of)
 * GET /api/proposals?status=active
 */
export async function getActiveProposals() {
  try {
    const res = await fetch('/api/proposals?status=active', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error(`Proposals API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching proposals:', error);
    throw error;
  }
}
