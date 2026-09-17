/**
 * Deprecated staking API forwarding layer
 *
 * This file kept for backwards compatibility. The canonical staking methods
 * now live in `client/src/api/yukiApi.ts`. Imports here are forwarded to the
 * `yukiApi` implementations to keep existing call sites working.
 */

 
// @ts-ignore - Forwarding to yukiApi
import * as yuki from '../api/yukiApi';

export const getStakingPools = yuki.getStakingPools;
export const getStakingPositions = yuki.getStakingPositions;
export const stakeTokens = yuki.stakeTokens;
export const unstakeTokens = yuki.unstakeTokens;
export const claimStakingRewards = yuki.claimStakingRewards;
export const getStakingLeaderboard = async () => {
  // yukiApi exposes pool/position APIs; leaderboard is proxied if present
  if (typeof (yuki as any).getStakingLeaderboard === 'function') {
    return (yuki as any).getStakingLeaderboard();
  }
  return [];
};

// Keep local utility that callers might rely on
export function calculateProjectedRewards(
  amount: number,
  duration: number,
  baseAPY: number = 12
): {
  apy: number;
  dailyReward: number;
  periodReward: number;
} {
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
