/**
 * Vaults & Staking API Client Utilities
 *
 * Typed utilities for calling vault and staking endpoints from React components
 */

// ============================================================================
// VAULT API UTILITIES
// ============================================================================

export interface VaultListItem {
  id: string;
  name: string;
  description: string;
  category: 'market-neutral' | 'yield' | 'momentum' | 'stablecoin-defense';
  manager: string;
  apy: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalAUM: number;
  depositorsCount: number;
  fee: number;
  status: 'active' | 'paused' | 'full';
}

export interface VaultDetail extends VaultListItem {
  strategy: {
    id: string;
    name: string;
    description: string;
    blocks: any[];
  };
  positions: Array<{
    asset: string;
    amount: number;
    valueUSD: number;
    percentage: number;
  }>;
  performance: {
    return1d: number;
    return7d: number;
    return30d: number;
    return1y: number;
    volatility: number;
    winRate: number;
  };
  created: string;
}

export interface DepositResponse {
  depositId: string;
  vaultId: string;
  amount: string;
  shares: string;
  txHash: string;
  status: 'confirmed';
}

export interface WithdrawalResponse {
  withdrawalId: string;
  vaultId: string;
  shares: string;
  amount: string;
  txHash: string;
  status: 'confirmed';
}

export interface VaultBalance {
  vaultId: string;
  shares: string;
  valueUSD: number;
  depositedAmount: number;
  gains: number;
  gainsPercent: number;
}

/**
 * Get list of all available strategy vaults
 */
export async function getVaults(filters?: {
  category?: string;
  minAUM?: number;
  maxFee?: number;
}): Promise<VaultListItem[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.minAUM) params.append('minAUM', String(filters.minAUM));
    if (filters?.maxFee) params.append('maxFee', String(filters.maxFee));

    const response = await fetch(`/api/vaults?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to get vaults:', error);
    throw error;
  }
}

/**
 * Get detailed vault information including positions and performance
 */
export async function getVaultDetails(vaultId: string): Promise<VaultDetail> {
  try {
    const response = await fetch(`/api/vaults/${vaultId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to get vault details:', error);
    throw error;
  }
}

/**
 * Deposit capital into a vault
 */
export async function depositToVault(
  vaultId: string,
  amount: string,
  asset: string = 'USDC'
): Promise<DepositResponse> {
  try {
    const response = await fetch(`/api/vaults/${vaultId}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({ amount, asset }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to deposit to vault:', error);
    throw error;
  }
}

/**
 * Withdraw capital from a vault
 */
export async function withdrawFromVault(
  vaultId: string,
  shares: string,
  asset: string = 'USDC'
): Promise<WithdrawalResponse> {
  try {
    const response = await fetch(`/api/vaults/${vaultId}/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({ shares, asset }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to withdraw from vault:', error);
    throw error;
  }
}

/**
 * Get user's balance in a specific vault
 */
export async function getVaultBalance(vaultId: string): Promise<VaultBalance> {
  try {
    const response = await fetch(`/api/vaults/${vaultId}/balance`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to get vault balance:', error);
    throw error;
  }
}

/**
 * Get vault's current positions
 */
export async function getVaultPositions(vaultId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/vaults/${vaultId}/positions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to get vault positions:', error);
    throw error;
  }
}

/**
 * Get vault performance metrics
 */
export async function getVaultPerformance(
  vaultId: string,
  period: string = '30d'
): Promise<any> {
  try {
    const response = await fetch(
      `/api/vaults/${vaultId}/performance?period=${period}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
        },
      }
    );

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to get vault performance:', error);
    throw error;
  }
}

// ============================================================================
// STAKING API UTILITIES
// ============================================================================

export interface StakingConfig {
  mtaaAddress: string;
  minStakeAmount: string;
  maxStakeAmount: string;
  baseAPY: number;
  lockupPeriods: number[];
  boostMultipliers: Record<number, number>;
  governanceVotingPower: string;
  vaultAllocationTiers: Array<{
    tier: string;
    minStake: string;
    maxAllocation: string;
  }>;
}

export interface StakeResponse {
  stakeId: string;
  amount: string;
  lockupDays: number;
  apy: number;
  estimatedRewardMonthly: string;
  estimatedRewardYearly: string;
  lockedUntil: string;
  txHash: string;
}

export interface UserStakingBalance {
  totalStaked: string;
  activeStakes: string;
  unlockedStakes: string;
  pendingRewards: string;
  claimedRewards: string;
  totalRewards: string;
  governanceVotingPower: string;
  vaultAllocationTier: string;
  vaultAllocationLimit: number;
}

/**
 * Get staking configuration and APY rates
 */
export async function getStakingConfig(): Promise<StakingConfig> {
  try {
    const response = await fetch('/api/staking/config', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to get staking config:', error);
    throw error;
  }
}

/**
 * Stake MTAA tokens with specified lockup period
 */
export async function stakeTokens(
  amount: string,
  lockupDays: number
): Promise<StakeResponse> {
  try {
    const response = await fetch('/api/staking/stake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({ amount, lockupDays }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to stake tokens:', error);
    throw error;
  }
}

/**
 * Unstake MTAA tokens (only after lockup period)
 */
export async function unstakeTokens(stakeId: string): Promise<any> {
  try {
    const response = await fetch('/api/staking/unstake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({ stakeId }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to unstake tokens:', error);
    throw error;
  }
}

/**
 * Get all stakes for the current user
 */
export async function getUserStakes(): Promise<any[]> {
  try {
    const response = await fetch('/api/staking/stakes', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to get user stakes:', error);
    throw error;
  }
}

/**
 * Get user's staking balance and rewards
 */
export async function getStakingBalance(): Promise<UserStakingBalance> {
  try {
    const response = await fetch('/api/staking/balance', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to get staking balance:', error);
    throw error;
  }
}

/**
 * Claim accumulated staking rewards
 */
export async function claimRewards(): Promise<any> {
  try {
    const response = await fetch('/api/staking/claim-rewards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to claim rewards:', error);
    throw error;
  }
}

/**
 * Get top stakers leaderboard
 */
export async function getStakingLeaderboard(
  limit: number = 100
): Promise<any[]> {
  try {
    const response = await fetch(`/api/staking/leaderboard?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    throw error;
  }
}

/**
 * Get rewards pool status
 */
export async function getRewardsPoolStatus(): Promise<any> {
  try {
    const response = await fetch('/api/staking/rewards-pool', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to get rewards pool status:', error);
    throw error;
  }
}

/**
 * Get active governance proposals
 */
export async function getProposals(status: string = 'active'): Promise<any[]> {
  try {
    const response = await fetch(`/api/staking/proposals?status=${status}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to get proposals:', error);
    throw error;
  }
}

/**
 * Vote on a governance proposal
 */
export async function voteOnProposal(
  proposalId: string,
  support: boolean
): Promise<any> {
  try {
    const response = await fetch('/api/staking/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({ proposalId, support }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to vote on proposal:', error);
    throw error;
  }
}
