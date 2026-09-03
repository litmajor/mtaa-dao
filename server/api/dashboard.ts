import type { Request, Response } from 'express';
import { db } from '../db';
import {
  users,
  proposals,
  tasks,
  daos,
  daoMemberships,
  contributions,
  vaults,
  referralRewards,
} from '../../shared/schema';
import { eq, and, desc, count, inArray, gte } from 'drizzle-orm';

/**
 * Helper to safely extract authenticated user ID
 */
function getAuthUserId(req: Request): string | null {
  return (req.user as any)?.id || (req.user as any)?.userId || null;
}

/**
 * GET /api/dashboard/stats
 * Returns aggregated stats for the user's dashboard
 */
export async function getDashboardStatsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's DAOs
    const userDaos = await db
      .select({ daoId: daoMemberships.daoId })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    const daoIds = userDaos.map((d) => d.daoId);

    // Run query aggregations concurrently
    const [
      activeProposalsCount,
      userVaults,
      activeMembersCount,
      completedTasksCount,
    ] = await Promise.all([
      daoIds.length > 0
        ? db
            .select({ count: count() })
            .from(proposals)
            .where(
              and(
                inArray(proposals.daoId, daoIds),
                eq(proposals.status, 'active')
              )
            )
        : [{ count: 0 }],

      db.select().from(vaults).where(eq(vaults.userId, userId)),

      daoIds.length > 0
        ? db
            .select({ count: count() })
            .from(daoMemberships)
            .where(inArray(daoMemberships.daoId, daoIds))
        : [{ count: 0 }],

      db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.claimerId, userId),
            eq(tasks.status, 'completed')
          )
        ),
    ]);

    const treasuryBalance = userVaults.reduce((sum, vault) => {
      return sum + (parseFloat(vault.balance || '0') || 0);
    }, 0);

    res.json({
      activeProposals: activeProposalsCount[0]?.count || 0,
      treasuryBalance,
      activeMembers: activeMembersCount[0]?.count || 0,
      totalVotes: 0,
      completedTasks: completedTasksCount[0]?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
}

/**
 * GET /api/dashboard/proposals
 * Returns active proposals for user's DAOs
 */
export async function getDashboardProposalsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userDaos = await db
      .select({ daoId: daoMemberships.daoId })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    const daoIds = userDaos.map((d) => d.daoId);

    if (daoIds.length === 0) {
      res.json([]);
      return;
    }

    const activeProposals = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        description: proposals.description,
        status: proposals.status,
        createdAt: proposals.createdAt,
        proposerId: proposals.proposerId,
      })
      .from(proposals)
      .where(
        and(
          inArray(proposals.daoId, daoIds),
          eq(proposals.status, 'active')
        )
      )
      .orderBy(desc(proposals.createdAt))
      .limit(10);

    if (activeProposals.length === 0) {
      res.json([]);
      return;
    }

    const authorIds = [...new Set(activeProposals.map((p) => p.proposerId))];
    const authors = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, authorIds));

    const authorMap = new Map(authors.map((a) => [a.id, a.username]));

    const formattedProposals = activeProposals.map((p) => {
      const now = new Date();
      const createdAt = p.createdAt ? new Date(p.createdAt) : new Date();
      const endDate = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      const timeLeftMs = endDate.getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.floor(timeLeftMs / (24 * 60 * 60 * 1000)));
      const hoursLeft = Math.max(0, Math.floor((timeLeftMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));

      return {
        id: p.id.toString(),
        title: p.title,
        description: p.description || '',
        category: 'general',
        author: authorMap.get(p.proposerId) || 'Unknown',
        votes: 0,
        timeLeft: daysLeft > 0 ? `${daysLeft}d left` : `${hoursLeft}h left`,
        status: p.status,
        urgency: daysLeft < 2 ? 'high' : 'normal',
      };
    });

    res.json(formattedProposals);
  } catch (error) {
    console.error('Error fetching dashboard proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
}

/**
 * GET /api/dashboard/vaults
 */
export async function getDashboardVaultsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId))
      .orderBy(desc(vaults.createdAt))
      .limit(5);

    const formattedVaults = userVaults.map((v) => ({
      id: v.id.toString(),
      currency: v.currency || 'CELO',
      balance: v.balance || '0',
      monthlyGoal: v.monthlyGoal || '1000',
    }));

    res.json(formattedVaults);
  } catch (error) {
    console.error('Error fetching dashboard vaults:', error);
    res.status(500).json({ error: 'Failed to fetch vaults' });
  }
}

/**
 * GET /api/dashboard/contributions
 */
export async function getDashboardContributionsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [userContributions, monthlyContributionsCount] = await Promise.all([
      db
        .select()
        .from(contributions)
        .where(eq(contributions.userId, userId))
        .orderBy(desc(contributions.createdAt))
        .limit(100),

      db
        .select({ count: count() })
        .from(contributions)
        .where(
          and(
            eq(contributions.userId, userId),
            gte(contributions.createdAt, thirtyDaysAgo)
          )
        ),
    ]);

    // Compute streak on standard date boundaries
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const contributionDates = userContributions
      .map((c) => {
        const d = c.createdAt ? new Date(c.createdAt) : null;
        if (!d) return null;
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
      .filter((d): d is number => d !== null)
      .sort((a, b) => b - a);

    if (contributionDates.length > 0) {
      let checkDate = today.getTime();
      const uniqueDates = [...new Set(contributionDates)];

      for (const date of uniqueDates) {
        if (date === checkDate || date === checkDate - 86400000) {
          currentStreak++;
          checkDate = date - 86400000;
        } else {
          break;
        }
      }
    }

    res.json({
      currentStreak,
      monthlyContributions: monthlyContributionsCount[0]?.count || 0,
      totalContributions: userContributions.length,
    });
  } catch (error) {
    console.error('Error fetching contributions:', error);
    res.status(500).json({ error: 'Failed to fetch contributions' });
  }
}

/**
 * GET /api/dashboard/members
 */
export async function getDashboardMembersHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userDaos = await db
      .select({ daoId: daoMemberships.daoId })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    const daoIds = userDaos.map((d) => d.daoId);

    if (daoIds.length === 0) {
      res.json([]);
      return;
    }

    const recentMembers = await db
      .select({
        userId: daoMemberships.userId,
        role: daoMemberships.role,
        joinedAt: daoMemberships.joinedAt,
      })
      .from(daoMemberships)
      .where(inArray(daoMemberships.daoId, daoIds))
      .orderBy(desc(daoMemberships.joinedAt))
      .limit(10);

    const memberUserIds = recentMembers.map((m) => m.userId);
    const memberUsers = memberUserIds.length > 0
      ? await db
          .select({
            id: users.id,
            username: users.username,
            profilePicture: users.profileImageUrl,
          })
          .from(users)
          .where(inArray(users.id, memberUserIds))
      : [];

    const userMap = new Map(memberUsers.map((u) => [u.id, u]));

    const formattedMembers = recentMembers.map((m) => {
      const user = userMap.get(m.userId);
      return {
        name: user?.username || 'Unknown',
        avatar: user?.profilePicture || '',
        status: 'active',
        role: m.role || 'member',
      };
    });

    res.json(formattedMembers);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
}

/**
 * GET /api/dashboard/tasks
 */
export async function getDashboardTasksHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userDaos = await db
      .select({ daoId: daoMemberships.daoId })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    const daoIds = userDaos.map((d) => d.daoId);

    if (daoIds.length === 0) {
      res.json([]);
      return;
    }

    const openTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          inArray(tasks.daoId, daoIds),
          eq(tasks.status, 'open')
        )
      )
      .orderBy(desc(tasks.createdAt))
      .limit(10);

    const formattedTasks = openTasks.map((t) => {
      const deadline = t.deadline ? new Date(t.deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const timeLeftMs = deadline.getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.floor(timeLeftMs / (24 * 60 * 60 * 1000)));

      return {
        id: t.id.toString(),
        title: t.title,
        reward: parseFloat(t.reward || '0'),
        difficulty: t.difficulty || 'medium',
        timeLeft: `${daysLeft}d`,
        category: t.category || 'general',
      };
    });

    res.json(formattedTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

/**
 * GET /api/dashboard/complete
 * Comprehensive system-wide dashboard aggregation endpoint
 */
export async function getDashboardCompleteHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [userData, userMemberships, userVaults, pendingWithdrawalsResult, referralStatsResult] =
      await Promise.all([
        db.select().from(users).where(eq(users.id, userId)).limit(1),

        db.select().from(daoMemberships).where(eq(daoMemberships.userId, userId)),

        db.select().from(vaults).where(eq(vaults.userId, userId)),

        db
          .select({ count: count() })
          .from(contributions)
          .where(
            and(
              eq(contributions.userId, userId),
              eq(contributions.status, 'pending')
            )
          ),

        db
          .select({ totalReferrals: count() })
          .from(referralRewards)
          .where(eq(referralRewards.referrerId, userId))
          .catch(() => [{ totalReferrals: 0 }]),
      ]);

    const user = userData[0];
    const daoIds = userMemberships.map((m) => m.daoId);

    const userDAOs =
      daoIds.length > 0
        ? await db.select().from(daos).where(inArray(daos.id, daoIds))
        : [];

    const totalAssets = userVaults.reduce((sum, vault) => {
      return sum + (parseFloat(vault.balance || '0') || 0);
    }, 0);

    const activeInvestments = userVaults.filter(
      (v) => parseFloat(v.balance || '0') > 0
    ).length;

    const formattedDAOs = userDAOs.map((dao) => ({
      id: dao.id,
      name: dao.name || 'Untitled DAO',
      description: dao.description || '',
      members: userMemberships.filter((m) => m.daoId === dao.id).length,
      tvl: totalAssets,
      status: 'active' as const,
      created: dao.createdAt?.toISOString() || new Date().toISOString(),
      avatar: dao.imageUrl || '🏗️',
      governance: {
        proposals: 0,
        activeFundingRound: false,
        votingPower: 1,
      },
      treasury: {
        balance: totalAssets,
        assets: userVaults.map((v) => ({
          name: v.name || 'Vault',
          value: parseFloat(v.balance || '0'),
        })),
        lastUpdated: new Date().toISOString(),
      },
      stats: {
        transactionVolume: 0,
        memberGrowth: 0,
        proposalsApproved: 0,
      },
    }));

    const rawWallet = user?.walletAddress || '';
    const formattedWalletAddress =
      rawWallet.length > 10 ? `${rawWallet.slice(0, 6)}...${rawWallet.slice(-4)}` : '0x0000...';

    const dashboardData = {
      totalAssets: Math.round(totalAssets * 100) / 100,
      monthlyReturn: 3.2,
      activeInvestments,
      pendingWithdrawals: pendingWithdrawalsResult[0]?.count || 0,
      userDAOs: formattedDAOs,
      daoDiscovery: [],
      wallets: [
        {
          id: rawWallet || 'wallet-1',
          address: formattedWalletAddress,
          balance: totalAssets,
          network: 'Ethereum',
          verified: Boolean(rawWallet),
        },
      ],
      referralStats: {
        totalReferrals: referralStatsResult[0]?.totalReferrals || 0,
        activeReferrals: referralStatsResult[0]?.totalReferrals || 0,
        referralRewards: 0,
        pendingRewards: 0,
      },
      vaults: userVaults.map((v) => ({
        id: v.id,
        name: v.name || 'Vault',
        balance: parseFloat(v.balance || '0'),
        apy: parseFloat(String(v.interestRate ?? '0')),
        type: v.vaultType || 'regular',
        created: v.createdAt?.toISOString() || new Date().toISOString(),
      })),
      investmentPools: [],
      portfolioValue: [{ date: new Date().toISOString().split('T')[0], value: totalAssets }],
      transactionHistory: [],
      performanceData: [{ month: 'Nov', return: 3.2 }],
      features: {
        kyc: true,
        pools: true,
        achievements: true,
        escrow: false,
        nft: true,
      },
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching complete dashboard:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}