/**
 * Staking API Utilities
 * 
 * Client-side functions for interacting with staking endpoints
 * Handles stake creation, claiming rewards, and unstaking
 */

const API_BASE = '/api/staking';

interface StakeRequest {
  amount: number;
  duration: number; // days
}

interface StakeResponse {
  stakeId: string;
  userId: string;
  amount: number;
  duration: number;
  stakedAt: Date;
  unlockAt: Date;
  rewards: number;
  apy: number;
  totalValue: number;
}

interface MyStakesResponse {
  data: StakeResponse[];
  totalStaked: number;
  totalRewards: number;
}

interface StakingStatsResponse {
  totalStaked: number;
  totalRewards: number;
  activeStakes: number;
  vaultAccess: {
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    name: string;
    minStake: number;
    maxVaults: number;
    feeDiscount: number;
    description: string;
  };
}

/**
 * Stake MTAA tokens
 */
export async function stakeTokens(request: StakeRequest): Promise<StakeResponse> {
  const response = await fetch(`${API_BASE}/stake`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Staking failed');
  }

  return response.json();
}

/**
 * Get user's stakes
 */
export async function getMyStakes(): Promise<StakeResponse[]> {
  const response = await fetch(`${API_BASE}/my-stakes`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch stakes');
  }

  const result = await response.json();
  return result.data || [];
}

/**
 * Get staking statistics
 */
export async function getStakingStats(): Promise<StakingStatsResponse> {
  const response = await fetch(`${API_BASE}/stats`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch staking stats');
  }

  return response.json();
}

/**
 * Claim rewards for a stake
 */
export async function claimRewards(stakeId: string): Promise<{ amount: number }> {
  const response = await fetch(`${API_BASE}/claim/${stakeId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to claim rewards');
  }

  return response.json();
}

/**
 * Unstake tokens (requires lockup period to be over)
 */
export async function unstakeTokens(stakeId: string): Promise<{ amount: number; rewards: number }> {
  const response = await fetch(`${API_BASE}/unstake/${stakeId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to unstake');
  }

  return response.json();
}

/**
 * Get vault access tier based on staked amount
 */
export async function getVaultAccessTier(): Promise<{
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  name: string;
  maxVaults: number;
  feeDiscount: number;
}> {
  const response = await fetch(`${API_BASE}/vault-access`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch vault access tier');
  }

  return response.json();
}

/**
 * Get global staking leaderboard
 */
export async function getStakingLeaderboard(): Promise<
  Array<{
    rank: number;
    userId: string;
    username: string;
    totalStaked: number;
    totalRewards: number;
  }>
> {
  const response = await fetch(`${API_BASE}/leaderboard`);

  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Calculate projected rewards for a stake
 */
export function calculateProjectedRewards(
  amount: number,
  duration: number,
  baseAPY: number = 12
): {
  apy: number;
  dailyReward: number;
  periodReward: number;
} {
  // Duration multipliers
  const multipliers: { [key: number]: number } = {
    7: 0.5,
    30: 1.0,
    90: 1.5,
    365: 2.5,
  };

  const multiplier = multipliers[duration] || 1.0;
  const apy = baseAPY * multiplier;
  const dailyReward = (amount * (apy / 100)) / 365;
  const periodReward = (amount * (apy / 100)) * (duration / 365);

  return {
    apy,
    dailyReward,
    periodReward,
  };
}
