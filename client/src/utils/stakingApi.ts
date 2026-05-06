/**
 * Staking API Utilities
 * 
 * Client-side functions for interacting with staking endpoints
 * Handles stake creation, claiming rewards, and unstaking
 * 
 * ✅ Migrated to authClient for centralized auth handling:
 * - Uses cookie-based authentication (httpOnly)
 * - Auto-refresh on 401
 * - Single-flight refresh to prevent token storms
 * - CSRF protection
 */

import { authClient } from './authClient';

const API_BASE = '/api/v1/yuki/staking';

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
  return authClient.post<StakeResponse>(`${API_BASE}/stake`, request);
}

/**
 * Get user's stakes
 */
export async function getMyStakes(): Promise<StakeResponse[]> {
  const data = await authClient.get<{ data: StakeResponse[] }>(`${API_BASE}/my-stakes`);
  return data.data || [];
}

/**
 * Get staking statistics
 */
export async function getStakingStats(): Promise<StakingStatsResponse> {
  return authClient.get<StakingStatsResponse>(`${API_BASE}/stats`);
}

/**
 * Claim rewards for a stake
 */
export async function claimRewards(stakeId: string): Promise<{ amount: number }> {
  return authClient.post<{ amount: number }>(`${API_BASE}/claim/${stakeId}`);
}

/**
 * Unstake tokens (requires lockup period to be over)
 */
export async function unstakeTokens(stakeId: string): Promise<{ amount: number; rewards: number }> {
  return authClient.post<{ amount: number; rewards: number }>(`${API_BASE}/unstake/${stakeId}`);
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
  return authClient.get<{
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    name: string;
    maxVaults: number;
    feeDiscount: number;
  }>(`${API_BASE}/vault-access`);
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
  const data = await authClient.get<{ data: Array<{ rank: number; userId: string; username: string; totalStaked: number; totalRewards: number }> }>(
    `${API_BASE}/leaderboard`
  );
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
