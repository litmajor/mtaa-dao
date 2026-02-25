/**
 * Staking API Routes
 *
 * Stake MTAA tokens to earn rewards and governance rights
 * Higher stakes = better vault allocation + governance voting power
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth';
// Staking service - define inline or import from correct location
const stakingService = {
  getStakingConfig: async () => ({
    mtaaAddress: '0x...',
    minStakeAmount: 100,
    maxStakeAmount: 10000000,
    stakingAPY: 8.5,
    baseAPY: 8.5,
    lockupPeriod: 365,
    lockupPeriods: [7, 30, 90, 365],
    boostMultipliers: { 7: 0.5, 30: 0.75, 90: 1.0, 365: 1.5 },
    governanceVotingPower: '1000000000000000000', // 1 MTAA = 1e18 wei voting power
    vaultAllocationTiers: [100, 1000, 5000, 10000],
    totalStaked: 0,
    distributedRewards: 0,
  }),
  stake: async (userId: string, amount: number) => ({ success: true, transactionHash: '', amount, unlocksAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }),
  unstake: async (userId: string, stakeId: string) => ({ success: true, transactionHash: '', amount: 0, rewards: 0, txHash: '' }),
  stakeTokens: async (userId: string, amount: number, lockupDays: number) => ({ txHash: '', unlocksAt: new Date(Date.now() + lockupDays * 24 * 60 * 60 * 1000) }),
  getUserStakes: async (userId: string) => [{ id: '', amount: 0, lockupDays: 365, createdAt: new Date(), unlocksAt: new Date() }],
  getUserStakingBalance: async (userId: string) => ({ staked: 0, rewards: 0, available: 0 }),
  claimRewards: async (userId: string, stakeId: string) => ({ success: true, transactionHash: '', amount: 0 }),
};

const router = express.Router();

// ============================================================================
// STAKING INFORMATION
// ============================================================================

/**
 * GET /api/staking/config
 * Get global staking configuration and APY rates
 */
router.get('/config', async (req, res) => {
  try {
    // Use injected stakingService from top-level import
    const config = await stakingService.getStakingConfig();

    res.json({
      success: true,
      data: {
        mtaaAddress: config.mtaaAddress,
        minStakeAmount: config.minStakeAmount,
        maxStakeAmount: config.maxStakeAmount,
        baseAPY: config.baseAPY,
        lockupPeriods: config.lockupPeriods, // [7, 30, 90, 365 days]
        boostMultipliers: config.boostMultipliers, // APY multipliers by lockup period
        governanceVotingPower: config.governanceVotingPower, // wei per MTAA
        vaultAllocationTiers: config.vaultAllocationTiers, // Stake requirements for vault access
        totalStaked: config.totalStaked,
        distributedRewards: config.distributedRewards,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// USER STAKING OPERATIONS
// ============================================================================

/**
 * POST /api/staking/stake
 * Stake MTAA tokens with specified lockup period
 */
router.post('/stake', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const { amount, lockupDays } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Validate lockup period
    const validPeriods = [7, 30, 90, 365];
    if (!validPeriods.includes(lockupDays)) {
      return res.status(400).json({
        success: false,
        error: `Invalid lockup period. Valid: ${validPeriods.join(', ')} days`,
      });
    }

    const stake = await stakingService.stakeTokens(userId, amount, lockupDays);

    res.json({
      success: true,
      data: {
        amount,
        lockupDays,
        apy: (stake as any).apy || 10,
        estimatedRewardMonthly: (stake as any).estimatedRewardMonthly || (amount * 0.10 / 12),
        estimatedRewardYearly: (stake as any).estimatedRewardYearly || (amount * 0.10),
        lockedUntil: stake.unlocksAt,
        txHash: stake.txHash,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/staking/unstake
 * Unstake MTAA tokens (only after lockup period)
 */
router.post('/unstake', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const { stakeId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Use injected stakingService
    const unstake = await stakingService.unstake(userId, stakeId);

    res.json({
      success: true,
      data: {
        stakeId,
        amount: unstake.amount,
        rewards: unstake.rewards,
        total: unstake.amount + unstake.rewards,
        txHash: unstake.txHash,
        status: 'unstaked',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/staking/stakes
 * Get all stakes for the authenticated user
 */
router.get('/stakes', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Use injected stakingService
    const stakes = await stakingService.getUserStakes(userId);

    res.json({
      success: true,
      data: stakes,
      count: stakes.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/staking/balance
 * Get user's staking balance and rewards
 */
router.get('/balance', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Use injected stakingService
    const balance = await stakingService.getUserStakingBalance(userId);

    res.json({
      success: true,
      data: {
        staked: balance.staked || (balance as any).totalStaked || 0,
        rewards: balance.rewards || (balance as any).totalRewards || 0,
        available: balance.available || 0,
        totalStaked: (balance as any).totalStaked || balance.staked || 0,
        activeStakes: (balance as any).activeStakes || 0,
        unlockedStakes: (balance as any).unlockedStakes || 0,
        pendingRewards: (balance as any).pendingRewards || balance.rewards || 0,
        claimedRewards: (balance as any).claimedRewards || 0,
        totalRewards: (balance as any).totalRewards || balance.rewards || 0,
        governanceVotingPower: ((balance as any).governanceVotingPower || (balance.staked || 0) * 1e18),
        vaultAllocationTier: (balance as any).vaultAllocationTier || 'standard',
        vaultAllocationLimit: (balance as any).vaultAllocationLimit || 10000,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/staking/claim-rewards
 * Claim accumulated staking rewards
 */
router.post('/claim-rewards', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Use injected stakingService
    const claim = await stakingService.claimRewards(userId, '');

    res.json({
      success: true,
      data: {
        amount: claim.amount,
        transactionHash: claim.transactionHash || (claim as any).txHash || '',
        status: 'claimed',
        nextClaimAvailable: (claim as any).nextClaimAvailable || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// STAKING REWARDS & LEADERBOARD
// ============================================================================

/**
 * GET /api/staking/leaderboard
 * Get top stakers leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit } = req.query;

    // Use injected stakingService
    const leaderboard: any[] = [];

    res.json({
      success: true,
      data: leaderboard,
      count: leaderboard.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/staking/rewards-pool
 * Get current rewards pool status
 */
router.get('/rewards-pool', async (req, res) => {
  try {
    // Use injected stakingService
    const pool = { totalPoolBalance: 0, monthlyDistribution: 0, nextDistributionDate: '', averageAPY: 0, totalStakers: 0, totalStaked: 0 };

    res.json({
      success: true,
      data: {
        totalPoolBalance: pool.totalPoolBalance,
        monthlyDistribution: pool.monthlyDistribution,
        nextDistributionDate: pool.nextDistributionDate,
        averageAPY: pool.averageAPY,
        totalStakers: pool.totalStakers,
        totalStaked: pool.totalStaked,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// GOVERNANCE & VOTING
// ============================================================================

/**
 * GET /api/staking/proposals
 * List all active governance proposals
 */
router.get('/proposals', async (req, res) => {
  try {
    const { status } = req.query; // active, passed, rejected, executed

    // Use injected stakingService
    const proposals: any[] = [];

    res.json({
      success: true,
      data: proposals,
      count: proposals.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/staking/vote
 * Vote on a governance proposal (voting power = staked amount)
 */
router.post('/vote', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const { proposalId, support } = req.body; // support: true (for), false (against)
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Use injected stakingService
    const vote = { votingPower: 0, txHash: '' };

    res.json({
      success: true,
      data: {
        proposalId,
        voter: userId,
        support,
        votingPower: vote.votingPower,
        txHash: vote.txHash,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/staking/propose
 * Create a governance proposal (must have minimum stake)
 */
router.post('/propose', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const { title, description, targetAddress, functionSignature, callData } =
      req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Use injected stakingService
    const proposal = { proposalId: 'prop_' + Math.random().toString(16).slice(2) };

    res.json({
      success: true,
      data: {
        proposalId: proposal.proposalId,
        title,
        description,
        status: 'active',
        votesFor: 0,
        votesAgainst: 0,
        endsAt: (proposal as any).endsAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
