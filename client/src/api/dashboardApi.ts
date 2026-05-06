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

export interface OkediDashboardData {
  totalBalance: number;
  trustScore: number;
  governanceScore: number;
  balances: BalanceSource[];  // Unified balance breakdown by source
  // FIXED: Replaced 'any' with proper interfaces to improve type safety
  myDAOs: DAOInfo[];
  activeProposals: ProposalInfo[];
  recentTransactions: TransactionInfo[];
  activeEscrows: EscrowInfo[];
  governanceStats: GovernanceStats;
  referralStats: ReferralStats;
  daoChat: DaoChatData;
  tipOfTheDay: string;
  kycStatus?: 'not-started' | 'pending' | 'verified';
  kycProgress?: number;
  transferLimits?: {
    daily: number;
    monthly: number;
    verifiedDaily: number;
    verifiedMonthly: number;
  };
  cryptoCurrency?: string;
  fiatCurrency?: string;
}

// FIXED: Added missing schema interfaces for type safety
export interface DAOInfo {
  id: string;
  name: string;
  logo?: string;
  members: number;
  role: 'founder' | 'admin' | 'member';
}

export interface ProposalInfo {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'passed' | 'failed' | 'executed';
  votesFor: number;
  votesAgainst: number;
  deadline: string;
}

export interface TransactionInfo {
  id: string;
  type: 'send' | 'receive' | 'trade' | 'stake' | 'unstake';
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
}

export interface GovernanceStats {
  totalVotingPower: number;
  votesParticipated: number;
  proposalsCreated: number;
  avgVotingRate: number;
}

export interface ReferralStats {
  referralCode: string;
  referrals: number;
  commission: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface DaoChatData {
  messages: ChatMessage[];
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  reactions?: { emoji: string; count: number }[];
}

export interface DashboardResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Fetch Okedi (beginner) dashboard data
 * GET /api/dashboard/okedi
 */
export async function getOkediDashboard() {
  try {
    const res = await fetch('/api/dashboard/okedi', {
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
    const res = await fetch('/api/users/persona-data', {
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
    const res = await fetch('/api/users/my-daos', {
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
    const res = await fetch('/api/dashboard/yuki', {
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
    const res = await fetch('/api/dashboard/amara', {
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
