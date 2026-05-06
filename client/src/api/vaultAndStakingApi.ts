/**
 * Vaults & Staking API Client Utilities
 *
 * Typed utilities for calling vault and staking endpoints from React components
 * ✅ Updated to use authClient - NO localStorage/sessionStorage
 */

import { authClient } from '@/utils/authClient';

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

    const data = await authClient.get<VaultListItem[]>(`/api/vaults?${params}`);
    return data || [];
  } catch (error) {
    console.error('Failed to get vaults:', error);
    throw error;
  }
}

/**
 * Get detailed vault information including positions and performance
 */
export async function getVaultDetails(vaultId: string): Promise<VaultDetail> {
  return authClient.get<VaultDetail>(`/api/vaults/${vaultId}`);
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
    const data = await authClient.post<DepositResponse>(`/api/vaults/${vaultId}/deposit`, {
      amount,
      asset,
    });
    return data;
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
  return authClient.post<WithdrawalResponse>(`/api/vaults/${vaultId}/withdraw`, {
    shares,
    asset,
  });
}

/**
 * Get user's balance in a specific vault
 */
export async function getVaultBalance(vaultId: string): Promise<VaultBalance> {
  return authClient.get<VaultBalance>(`/api/vaults/${vaultId}/balance`);
}

/**
 * Get vault's current positions
 */
export async function getVaultPositions(vaultId: string): Promise<any[]> {
  const result = await authClient.get<{ data: any[] } | any[]>(`/api/vaults/${vaultId}/positions`);
  return Array.isArray(result) ? result : (result?.data || []);
}

/**
 * Get vault performance metrics
 */
export async function getVaultPerformance(
  vaultId: string,
  period: string = '30d'
): Promise<any> {
  return authClient.get<any>(`/api/vaults/${vaultId}/performance?period=${period}`);
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
  return authClient.get<StakingConfig>('/api/v1/yuki/staking/config');
}

/**
 * Stake MTAA tokens with specified lockup period
 */
export async function stakeTokens(
  amount: string,
  lockupDays: number
): Promise<StakeResponse> {
  return authClient.post<StakeResponse>('/api/v1/yuki/staking/stake', {
    amount,
    lockupDays,
  });
}

/**
 * Unstake MTAA tokens (only after lockup period)
 */
export async function unstakeTokens(stakeId: string): Promise<any> {
  return authClient.post<any>('/api/v1/yuki/staking/unstake', { stakeId });
}

/**
 * Get all stakes for the current user
 */
export async function getUserStakes(): Promise<any[]> {
  const result = await authClient.get<{ data: any[] } | any[]>('/api/v1/yuki/staking/stakes');
  return Array.isArray(result) ? result : (result?.data || []);
}

/**
 * Get user's staking balance and rewards
 */
export async function getStakingBalance(): Promise<UserStakingBalance> {
  return authClient.get<UserStakingBalance>('/api/v1/yuki/staking/balance');
}

/**
 * Claim accumulated staking rewards
 */
export async function claimRewards(): Promise<any> {
  return authClient.post<any>('/api/v1/yuki/staking/claim-rewards', {});
}

/**
 * Get top stakers leaderboard
 */
export async function getStakingLeaderboard(
  limit: number = 100
): Promise<any[]> {
  const result = await authClient.get<{ data: any[] } | any[]>(
    `/api/v1/yuki/staking/leaderboard?limit=${limit}`
  );
  return Array.isArray(result) ? result : (result?.data || []);
}

/**
 * Get rewards pool status
 */
export async function getRewardsPoolStatus(): Promise<any> {
  return authClient.get<any>('/api/v1/yuki/staking/rewards-pool');
}

/**
 * Get active governance proposals
 */
export async function getProposals(status: string = 'active'): Promise<any[]> {
  const result = await authClient.get<{ data: any[] } | any[]>(
    `/api/v1/yuki/staking/proposals?status=${status}`
  );
  return Array.isArray(result) ? result : (result?.data || []);
}

/**
 * Vote on a governance proposal
 */
export async function voteOnProposal(
  proposalId: string,
  support: boolean
): Promise<any> {
  return authClient.post<any>('/api/v1/yuki/staking/vote', { proposalId, support });
}
