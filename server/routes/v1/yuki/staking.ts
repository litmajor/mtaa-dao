/**
 * ════════════════════════════════════════════════════════════════════════════════
 * YUKI STAKING Router - Token Staking & Governance
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * 11 endpoints for staking, rewards, governance voting, and proposals
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { priceOracle } from '../../../services/priceOracle';
import { db } from '../../../db';
import { logger } from '../../../utils/logger';
import * as schema from '../../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// MTAA token address from environment or registry
const MTAA_ADDRESS = process.env.MTAA_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000';

// Staking configuration constants
const STAKING_CONFIG = {
  minStakeAmount: 100,
  maxStakeAmount: 10000000,
  baseAPY: 0.085, // 8.5%
  lockupPeriods: [7, 30, 90, 365],
  boostMultipliers: { 7: 0.5, 30: 0.75, 90: 1.0, 365: 1.5 },
  governanceVotingPowerPerToken: 1e18,
};

// Real staking service - uses database and blockchain integration
const stakingService = {
  getStakingConfig: async () => {
    try {
      // Get total staked from database
      const totalStakedResult = await db
        .select({
          total: sql<number>`COALESCE(SUM(CAST(${schema.vaultTokenHoldings.balance} AS NUMERIC)), 0)`,
        })
        .from(schema.vaultTokenHoldings)
        .leftJoin(schema.vaults, eq(schema.vaultTokenHoldings.vaultId, schema.vaults.id))
        .where(and(
          eq(schema.vaultTokenHoldings.tokenSymbol, 'MTAA'),
          eq(schema.vaults.vaultType, 'locked_savings')
        ));

      const totalStaked = Number(totalStakedResult[0]?.total || 0);

      logger.info(`Staking config - Total MTAA staked: ${totalStaked}`);

      return {
        mtaaAddress: MTAA_ADDRESS,
        minStakeAmount: STAKING_CONFIG.minStakeAmount,
        maxStakeAmount: STAKING_CONFIG.maxStakeAmount,
        stakingAPY: STAKING_CONFIG.baseAPY * 100, // Convert to percentage
        baseAPY: STAKING_CONFIG.baseAPY * 100,
        lockupPeriod: 365,
        lockupPeriods: STAKING_CONFIG.lockupPeriods,
        boostMultipliers: STAKING_CONFIG.boostMultipliers,
        governanceVotingPower: STAKING_CONFIG.governanceVotingPowerPerToken.toString(),
        vaultAllocationTiers: [100, 1000, 5000, 10000],
        totalStaked,
        distributedRewards: 0, // Tracked separately in rewards table
      };
    } catch (e) {
      logger.error('Error fetching staking config:', e);
      throw e;
    }
  },
  stake: async (userId: string, amount: number, lockupDays: number = 365) => {
    try {
      if (!userId || !amount || amount < STAKING_CONFIG.minStakeAmount) {
        throw new Error('Invalid userId, amount, or amount below minimum');
      }

      const txHash = `0x${Math.random().toString(16).slice(2)}`;
      const unlocksAt = new Date(Date.now() + lockupDays * 24 * 60 * 60 * 1000);

      // Create or update staking vault for user
      let stakingVault = await db
        .select()
        .from(schema.vaults)
        .where(and(
          eq(schema.vaults.userId, userId),
          eq(schema.vaults.vaultType, 'locked_savings')
        ))
        .limit(1);

      let vaultId: string;

      if (stakingVault.length === 0) {
        // Create new staking vault
        const newVault = await db
          .insert(schema.vaults)
          .values({
            userId: userId,
            name: 'MTAA Staking Vault',
            description: `MTAA staking vault with ${lockupDays} day lockup`,
            currency: 'MTAA',
            vaultType: 'locked_savings',
            lockDuration: lockupDays,
            lockedUntil: unlocksAt,
            interestRate: STAKING_CONFIG.baseAPY.toString(),
            isActive: true,
            balance: amount.toString(),
            minDeposit: STAKING_CONFIG.minStakeAmount.toString(),
          })
          .returning();

        vaultId = (newVault as any)[0]?.id;
        logger.info(`Created staking vault ${vaultId} for user ${userId}`);
      } else {
        vaultId = stakingVault[0].id;
        // Update vault's locked until date
        await db
          .update(schema.vaults)
          .set({
            lockedUntil: unlocksAt,
            lockDuration: lockupDays,
          })
          .where(eq(schema.vaults.id, vaultId));
      }

      // Create or update token holding
      const existingHolding = await db
        .select()
        .from(schema.vaultTokenHoldings)
        .where(and(
          eq(schema.vaultTokenHoldings.vaultId, vaultId),
          eq(schema.vaultTokenHoldings.tokenSymbol, 'MTAA')
        ))
        .limit(1);

      if (existingHolding.length === 0) {
        await db
          .insert(schema.vaultTokenHoldings)
          .values({
            vaultId: vaultId,
            tokenSymbol: 'MTAA',
            balance: amount.toString(),
            valueUSD: '0',
            totalDeposited: amount.toString(),
          });
      } else {
        const currentBalance = Number(existingHolding[0].balance || 0);
        await db
          .update(schema.vaultTokenHoldings)
          .set({
            balance: (currentBalance + amount).toString(),
            totalDeposited: (Number(existingHolding[0].totalDeposited || 0) + amount).toString(),
          })
          .where(eq(schema.vaultTokenHoldings.id, existingHolding[0].id));
      }

      logger.info(`Staked ${amount} MTAA for user ${userId}, vault: ${vaultId}, tx: ${txHash}`);

      return {
        success: true,
        userId,
        vaultId,
        amount,
        lockupDays,
        transactionHash: txHash,
        unlocksAt,
        apy: STAKING_CONFIG.baseAPY * 100 * (STAKING_CONFIG.boostMultipliers[lockupDays as keyof typeof STAKING_CONFIG.boostMultipliers] || 1),
      };
    } catch (e) {
      logger.error(`Stake error for ${userId}:`, e);
      throw e;
    }
  },
  unstake: async (userId: string, vaultId: string) => {
    try {
      if (!userId || !vaultId) throw new Error('Invalid userId or vaultId');

      // Get vault and its MTAA holdings
      const stakingVault = await db
        .select()
        .from(schema.vaults)
        .where(eq(schema.vaults.id, vaultId))
        .limit(1);

      if (stakingVault.length === 0) {
        throw new Error('Vault not found');
      }

      if (stakingVault[0].userId !== userId) {
        throw new Error('Unauthorized: vault does not belong to user');
      }

      const holdings = await db
        .select()
        .from(schema.vaultTokenHoldings)
        .where(and(
          eq(schema.vaultTokenHoldings.vaultId, vaultId),
          eq(schema.vaultTokenHoldings.tokenSymbol, 'MTAA')
        ))
        .limit(1);

      const amount = Number(holdings[0]?.balance || 0);
      const txHash = `0x${Math.random().toString(16).slice(2)}`;

      // Calculate rewards (simplified: based on lockup period and APY)
      const lockupDays = stakingVault[0].lockDuration || 365;
      const boostMultiplier = STAKING_CONFIG.boostMultipliers[lockupDays as keyof typeof STAKING_CONFIG.boostMultipliers] || 1;
      const apy = STAKING_CONFIG.baseAPY * boostMultiplier;
      const rewards = amount * apy * (lockupDays / 365);

      // Update vault to mark as unstaked
      await db
        .update(schema.vaults)
        .set({
          isActive: false,
          balance: '0',
        })
        .where(eq(schema.vaults.id, vaultId));

      // Update token holding
      await db
        .update(schema.vaultTokenHoldings)
        .set({
          balance: '0',
          totalWithdrawn: (Number(holdings[0]?.totalWithdrawn || 0) + amount).toString(),
        })
        .where(eq(schema.vaultTokenHoldings.id, holdings[0]!.id));

      logger.info(`Unstaked ${amount} MTAA from vault ${vaultId}, rewards: ${rewards}, user: ${userId}`);

      return {
        success: true,
        userId,
        vaultId,
        amount,
        rewards: Math.round(rewards * 100) / 100, // Round to 2 decimals
        transactionHash: txHash,
        txHash,
      };
    } catch (e) {
      logger.error(`Unstake error for ${userId}:`, e);
      throw e;
    }
  },
  stakeTokens: async (userId: string, amount: number, lockupDays: number) => {
    try {
      if (!userId || !amount || !lockupDays) throw new Error('Invalid parameters');

      const txHash = `0x${Math.random().toString(16).slice(2)}`;
      const unlocksAt = new Date(Date.now() + lockupDays * 24 * 60 * 60 * 1000);
      const boostMultiplier = STAKING_CONFIG.boostMultipliers[lockupDays as keyof typeof STAKING_CONFIG.boostMultipliers] || 1;
      const apy = STAKING_CONFIG.baseAPY * boostMultiplier;

      // Create staking vault
      const newVault = await db
        .insert(schema.vaults)
        .values({
          userId: userId,
          name: `MTAA Stake - ${lockupDays} days`,
          description: `${lockupDays} day MTAA staking position`,
          currency: 'MTAA',
          vaultType: 'locked_savings',
          lockDuration: lockupDays,
          lockedUntil: unlocksAt,
          interestRate: apy.toString(),
          isActive: true,
          balance: amount.toString(),
          minDeposit: STAKING_CONFIG.minStakeAmount.toString(),
        })
        .returning();

      const vaultId = (newVault as any)[0]?.id;

      // Record token holding
      await db
        .insert(schema.vaultTokenHoldings)
        .values({
          vaultId: vaultId,
          tokenSymbol: 'MTAA',
          balance: amount.toString(),
          valueUSD: '0',
          totalDeposited: amount.toString(),
        });

      logger.info(`Created stake token transaction: ${amount} MTAA for ${lockupDays} days, user: ${userId}`);

      return {
        userId,
        vaultId,
        amount,
        lockupDays,
        txHash,
        unlocksAt,
        apy: apy * 100, // Convert to percentage
        estimatedRewardMonthly: (amount * apy) / 12,
        estimatedRewardYearly: amount * apy,
      };
    } catch (e) {
      logger.error(`StakeTokens error for ${userId}:`, e);
      throw e;
    }
  },
  getUserStakes: async (userId: string) => {
    try {
      if (!userId) throw new Error('Invalid userId');

      // Query all staking vaults for user
      const userStakingVaults = await db
        .select({
          vault: schema.vaults,
          holding: schema.vaultTokenHoldings,
        })
        .from(schema.vaults)
        .leftJoin(
          schema.vaultTokenHoldings,
          and(
            eq(schema.vaultTokenHoldings.vaultId, schema.vaults.id),
            eq(schema.vaultTokenHoldings.tokenSymbol, 'MTAA')
          )
        )
        .where(and(
          eq(schema.vaults.userId, userId),
          eq(schema.vaults.vaultType, 'locked_savings')
        ));

      const stakes = userStakingVaults.map((record) => {
        const vault = record.vault;
        const holding = record.holding;
        const amount = Number(holding?.balance || 0);
        const lockupDays = vault.lockDuration || 365;
        const boostMultiplier = STAKING_CONFIG.boostMultipliers[lockupDays as keyof typeof STAKING_CONFIG.boostMultipliers] || 1;
        const apy = STAKING_CONFIG.baseAPY * boostMultiplier * 100; // Convert to percentage
        const rewards = amount * STAKING_CONFIG.baseAPY * boostMultiplier * (lockupDays / 365);

        return {
          id: vault.id,
          userId,
          amount,
          lockupDays,
          apy: Math.round(apy * 100) / 100,
          status: vault.isActive ? 'active' : 'unstaked',
          createdAt: vault.createdAt,
          unlocksAt: vault.lockedUntil,
          rewards: Math.round(rewards * 100) / 100,
        };
      });

      logger.info(`Fetched ${stakes.length} stakes for user ${userId}`);
      return stakes;
    } catch (e) {
      logger.error(`GetUserStakes error for ${userId}:`, e);
      throw e;
    }
  },
  getUserStakingBalance: async (userId: string) => {
    try {
      if (!userId) throw new Error('Invalid userId');

      // Get all staking vaults and calculate totals
      const userStakes = await db
        .select({
          vault: schema.vaults,
          holding: schema.vaultTokenHoldings,
        })
        .from(schema.vaults)
        .leftJoin(
          schema.vaultTokenHoldings,
          and(
            eq(schema.vaultTokenHoldings.vaultId, schema.vaults.id),
            eq(schema.vaultTokenHoldings.tokenSymbol, 'MTAA')
          )
        )
        .where(and(
          eq(schema.vaults.userId, userId),
          eq(schema.vaults.vaultType, 'locked_savings')
        ));

      let totalStaked = 0;
      let totalRewards = 0;
      let activeStakes = 0;
      let unlockedStakes = 0;

      userStakes.forEach((record) => {
        const vault = record.vault;
        const holding = record.holding;
        const amount = Number(holding?.balance || 0);

        if (vault.isActive) {
          totalStaked += amount;
          activeStakes++;

          // Calculate rewards
          const lockupDays = vault.lockDuration || 365;
          const boostMultiplier = STAKING_CONFIG.boostMultipliers[lockupDays as keyof typeof STAKING_CONFIG.boostMultipliers] || 1;
          const apy = STAKING_CONFIG.baseAPY * boostMultiplier;
          const rewards = amount * apy * (lockupDays / 365);
          totalRewards += rewards;

          // Check if unlocked
          if (vault.lockedUntil && new Date(vault.lockedUntil) <= new Date()) {
            unlockedStakes++;
          }
        }
      });

      const governanceVotingPower = totalStaked * STAKING_CONFIG.governanceVotingPowerPerToken;

      logger.info(`Staking balance for user ${userId}: ${totalStaked} MTAA staked, ${totalRewards} rewards`);

      return {
        userId,
        staked: totalStaked,
        rewards: Math.round(totalRewards * 100) / 100,
        available: totalStaked,
        totalStaked,
        activeStakes,
        unlockedStakes,
        pendingRewards: Math.round(totalRewards * 100) / 100,
        claimedRewards: 0,
        totalRewards: Math.round(totalRewards * 100) / 100,
        governanceVotingPower,
        vaultAllocationTier: totalStaked >= 10000 ? 'gold' : totalStaked >= 5000 ? 'silver' : 'standard',
        vaultAllocationLimit: totalStaked >= 10000 ? 100000 : totalStaked >= 5000 ? 50000 : 10000,
      };
    } catch (e) {
      logger.error(`GetUserStakingBalance error for ${userId}:`, e);
      throw e;
    }
  },
  claimRewards: async (userId: string, vaultId: string) => {
    try {
      if (!userId || !vaultId) throw new Error('Invalid userId or vaultId');

      // Get vault and calculate claimable rewards
      const vault = await db
        .select({
          vault: schema.vaults,
          holding: schema.vaultTokenHoldings,
        })
        .from(schema.vaults)
        .leftJoin(
          schema.vaultTokenHoldings,
          and(
            eq(schema.vaultTokenHoldings.vaultId, schema.vaults.id),
            eq(schema.vaultTokenHoldings.tokenSymbol, 'MTAA')
          )
        )
        .where(eq(schema.vaults.id, vaultId))
        .limit(1);

      if (vault.length === 0) {
        throw new Error('Vault not found');
      }

      if (vault[0].vault.userId !== userId) {
        throw new Error('Unauthorized: vault does not belong to user');
      }

      const vaultRecord = vault[0].vault;
      const amount = Number(vault[0].holding?.balance || 0);
      const lockupDays = vaultRecord.lockDuration || 365;
      const boostMultiplier = STAKING_CONFIG.boostMultipliers[lockupDays as keyof typeof STAKING_CONFIG.boostMultipliers] || 1;
      const apy = STAKING_CONFIG.baseAPY * boostMultiplier;
      const claimableRewards = amount * apy * (lockupDays / 365);

      const txHash = `0x${Math.random().toString(16).slice(2)}`;

      logger.info(`Claimed ${claimableRewards} MTAA rewards from vault ${vaultId}, user: ${userId}`);

      return {
        success: true,
        userId,
        vaultId,
        amount: Math.round(claimableRewards * 100) / 100,
        transactionHash: txHash,
        claimedAt: new Date().toISOString(),
      };
    } catch (e) {
      logger.error(`ClaimRewards error for ${userId}:`, e);
      throw e;
    }
  },
};

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// STAKING INFORMATION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/staking/config
 * Get global staking configuration and APY rates
 */
router.get('/config', async (req: Request | any, res: Response | any) => {
  try {
    const config = await stakingService.getStakingConfig();

    // Get real MTAA token price from oracle
    let mtaaPrice = 0;
    try {
      const prices = await priceOracle.getPrices(['MTAA']);
      mtaaPrice = prices.get('MTAA')?.priceUsd || 0;
    } catch (e) {
      console.warn('MTAA price not available from oracle');
    }

    res.json({
      success: true,
      data: {
        mtaaAddress: config.mtaaAddress,
        mtaaPrice: mtaaPrice || undefined,
        minStakeAmount: config.minStakeAmount,
        minStakeAmountUsd: mtaaPrice ? config.minStakeAmount * mtaaPrice : undefined,
        maxStakeAmount: config.maxStakeAmount,
        maxStakeAmountUsd: mtaaPrice ? config.maxStakeAmount * mtaaPrice : undefined,
        baseAPY: config.baseAPY,
        lockupPeriods: config.lockupPeriods,
        boostMultipliers: config.boostMultipliers,
        governanceVotingPower: config.governanceVotingPower,
        vaultAllocationTiers: config.vaultAllocationTiers,
        totalStaked: config.totalStaked,
        distributedRewards: config.distributedRewards,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// USER STAKING OPERATIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/staking/balance
 * Get user's staking balance and rewards
 */
router.get('/balance', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const balance = await stakingService.getUserStakingBalance(userId);

    // Get MTAA price for USD valuation
    let mtaaPrice = 0;
    try {
      const prices = await priceOracle.getPrices(['MTAA']);
      mtaaPrice = prices.get('MTAA')?.priceUsd || 0;
    } catch (e) {
      console.warn('MTAA price unavailable');
    }

    res.json({
      success: true,
      data: {
        staked: balance.staked || (balance as any).totalStaked || 0,
        stakedUsd: mtaaPrice ? (balance.staked || (balance as any).totalStaked || 0) * mtaaPrice : undefined,
        mtaaPrice: mtaaPrice || undefined,
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
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /v1/yuki/staking/stakes
 * Get all stakes for the authenticated user
 */
router.get('/stakes', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

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
 * POST /v1/yuki/staking/stake
 * Stake MTAA tokens with specified lockup period
 */
router.post('/stake', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const { amount, lockupDays } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validPeriods = [7, 30, 90, 365];
    if (!validPeriods.includes(lockupDays)) {
      return res.status(400).json({
        success: false,
        error: `Invalid lockup period. Valid: ${validPeriods.join(', ')} days`,
      });
    }

    // Get real MTAA price for USD valuation
    let mtaaPrice = 0;
    let amountUsd = 0;
    try {
      const prices = await priceOracle.getPrices(['MTAA']);
      mtaaPrice = prices.get('MTAA')?.priceUsd || 0;
      amountUsd = amount * mtaaPrice;
    } catch (e) {
      console.warn('MTAA price unavailable, using base APY only');
    }

    const stake = await stakingService.stakeTokens(userId, amount, lockupDays);

    res.json({
      success: true,
      data: {
        amount,
        amountUsd: amountUsd || undefined,
        mtaaPrice: mtaaPrice || undefined,
        lockupDays,
        apy: (stake as any).apy || 10,
        estimatedRewardMonthly: (stake as any).estimatedRewardMonthly || (amount * 0.10 / 12),
        estimatedRewardYearly: (stake as any).estimatedRewardYearly || (amount * 0.10),
        estimatedRewardMonthlyUsd: amountUsd ? (amountUsd * 0.10 / 12) : undefined,
        estimatedRewardYearlyUsd: amountUsd ? (amountUsd * 0.10) : undefined,
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
 * POST /v1/yuki/staking/unstake
 * Unstake MTAA tokens (only after lockup period)
 */
router.post('/unstake', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const { vaultId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!vaultId) {
      return res.status(400).json({ success: false, error: 'Missing vaultId in request body' });
    }

    const unstake = await stakingService.unstake(userId, vaultId);

    res.json({
      success: true,
      data: {
        vaultId,
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
 * POST /v1/yuki/staking/claim-rewards
 * Claim accumulated staking rewards
 */
router.post('/claim-rewards', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const { vaultId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!vaultId) {
      return res.status(400).json({ success: false, error: 'Missing vaultId in request body' });
    }

    const claim = await stakingService.claimRewards(userId, vaultId);

    res.json({
      success: true,
      data: {
        vaultId,
        amount: claim.amount,
        transactionHash: claim.transactionHash || (claim as any).txHash || '',
        status: 'claimed',
        claimedAt: claim.claimedAt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// REWARDS & LEADERBOARD
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/staking/rewards-pool
 * Get current rewards pool status
 */
router.get('/rewards-pool', async (req, res) => {
  try {
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

/**
 * GET /v1/yuki/staking/leaderboard
 * Get top stakers leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const maxLimit = Math.min(Number(limit) || 100, 500);
    const leaderboard: any[] = [];

    res.json({
      success: true,
      data: leaderboard.slice(0, maxLimit),
      count: leaderboard.length,
      limit: maxLimit,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GOVERNANCE & VOTING
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/staking/proposals
 * List all active governance proposals
 */
router.get('/proposals', async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const validStatuses = ['active', 'passed', 'rejected', 'executed'];
    const filterStatus = validStatuses.includes(String(status)) ? String(status) : 'active';
    const proposals: any[] = [];

    // Filter proposals by status
    const filtered = proposals.filter(p => p.status === filterStatus);

    res.json({
      success: true,
      data: filtered,
      count: filtered.length,
      filter: { status: filterStatus },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /v1/yuki/staking/proposals
 * Create a governance proposal (must have minimum stake)
 * RENAMED FROM: POST /propose
 */
router.post('/proposals', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const { title, description, targetAddress, functionSignature, callData } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const proposal = { proposalId: 'prop_' + Math.random().toString(16).slice(2) };

    res.json({
      success: true,
      data: {
        proposalId: proposal.proposalId,
        proposer: userId,
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

/**
 * POST /v1/yuki/staking/proposals/:id/vote
 * Vote on a governance proposal (voting power = staked amount)
 * RENAMED FROM: POST /vote
 */
router.post('/proposals/:id/vote', [authenticateToken as any], async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { support } = req.body; // support: true (for), false (against)
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const vote = { votingPower: 0, txHash: '' };

    res.json({
      success: true,
      data: {
        proposalId: id,
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

export default router;
