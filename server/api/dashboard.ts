import { Request, Response } from 'express';
import { db } from '../db';
import { users, proposals, tasks, daos, daoMemberships, contributions, vaults } from '../../shared/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';

/**
 * GET /api/dashboard/stats
 * Returns aggregated stats for the user's dashboard
 */
export async function getDashboardStatsHandler(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's DAOs
    const userDaos = await db
      .select({ daoId: daoMemberships.daoId })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    const daoIds = userDaos.map(d => d.daoId);

    // Count active proposals across user's DAOs
    const activeProposalsCount = daoIds.length > 0 
      ? await db
          .select({ count: count() })
          .from(proposals)
          .where(
            and(
              sql`${proposals.daoId} IN ${daoIds}`,
              eq(proposals.status, 'active')
            )
          )
      : [{ count: 0 }];

    // Get total treasury balance (sum of all vaults user has access to)
    const userVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId));

    const treasuryBalance = userVaults.reduce((sum, vault) => {
      return sum + parseFloat(vault.balance || '0');
    }, 0);

    // Count active members (total across user's DAOs)
    const activeMembersCount = daoIds.length > 0
      ? await db
          .select({ count: count() })
          .from(daoMemberships)
          .where(sql`${daoMemberships.daoId} IN ${daoIds}`)
      : [{ count: 0 }];

    // Count total votes user has cast
    const totalVotesCount = await db
      .select({ count: count() })
      .from(sql`votes`)
      .where(eq(sql`voter_id`, userId))
      .catch(() => [{ count: 0 }]); // If votes table doesn't exist yet

    // Count completed tasks
    const completedTasksCount = await db
      .select({ count: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.claimerId, userId),
          eq(tasks.status, 'completed')
        )
      );

    res.json({
      activeProposals: activeProposalsCount[0]?.count || 0,
      treasuryBalance,
      activeMembers: activeMembersCount[0]?.count || 0,
      totalVotes: totalVotesCount[0]?.count || 0,
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
export async function getDashboardProposalsHandler(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's DAOs
    const userDaos = await db
      .select({ daoId: daoMemberships.daoId })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    const daoIds = userDaos.map(d => d.daoId);

    if (daoIds.length === 0) {
      return res.json([]);
    }

    // Get active proposals
    const activeProposals = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        description: proposals.description,
        status: proposals.status,
        createdAt: proposals.createdAt,
        proposer: proposals.proposer,
      })
      .from(proposals)
      .where(
        and(
          sql`${proposals.daoId} IN ${daoIds}`,
          eq(proposals.status, 'active')
        )
      )
      .orderBy(desc(proposals.createdAt))
      .limit(10);

    // Get authors
  const authorIds = [...new Set(activeProposals.map(p => p.proposer))];
    const authors = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(sql`${users.id} IN ${authorIds}`);

    const authorMap = new Map(authors.map(a => [a.id, a.username]));

    // Format proposals
    const formattedProposals = activeProposals.map(p => {
      const now = new Date();
      // No endDate in schema, use 7 days from createdAt
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
        author: authorMap.get(p.proposer) || 'Unknown',
        votes: 0, // TODO: Get actual vote count
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
 * Returns user's vaults
 */
export async function getDashboardVaultsHandler(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId))
      .orderBy(desc(vaults.createdAt))
      .limit(5);

    const formattedVaults = userVaults.map(v => ({
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
 * Returns user's contribution stats
 */
export async function getDashboardContributionsHandler(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all contributions
    const userContributions = await db
      .select()
      .from(contributions)
      .where(eq(contributions.userId, userId))
      .orderBy(desc(contributions.createdAt));

    // Calculate streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const contributionDates = userContributions
      .map(c => {
        const d = c.createdAt ? new Date(c.createdAt) : null;
        if (!d) return null;
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
      .filter(Boolean)
      .sort((a, b) => (b as number) - (a as number));

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

    // Monthly contributions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthlyContributions = userContributions.filter(
      c => c.createdAt && new Date(c.createdAt) >= thirtyDaysAgo
    ).length;

    res.json({
      currentStreak,
      monthlyContributions,
      totalContributions: userContributions.length,
    });
  } catch (error) {
    console.error('Error fetching contributions:', error);
    res.status(500).json({ error: 'Failed to fetch contributions' });
  }
}

/**
 * GET /api/dashboard/members
 * Returns recent active members from user's DAOs
 */
export async function getDashboardMembersHandler(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's DAOs
    const userDaos = await db
      .select({ daoId: daoMemberships.daoId })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    const daoIds = userDaos.map(d => d.daoId);

    if (daoIds.length === 0) {
      return res.json([]);
    }

    // Get recent members
    const recentMembers = await db
      .select({
        userId: daoMemberships.userId,
        role: daoMemberships.role,
        joinedAt: daoMemberships.joinedAt,
      })
      .from(daoMemberships)
      .where(sql`${daoMemberships.daoId} IN ${daoIds}`)
      .orderBy(desc(daoMemberships.joinedAt))
      .limit(10);

    // Get user details
    const memberUserIds = recentMembers.map(m => m.userId);
    const memberUsers = await db
      .select({
        id: users.id,
        username: users.username,
        profilePicture: users.profileImageUrl,
      })
      .from(users)
      .where(sql`${users.id} IN ${memberUserIds}`);

    const userMap = new Map(memberUsers.map(u => [u.id, u]));

    const formattedMembers = recentMembers.map(m => {
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
 * Returns available tasks for the user
 */
export async function getDashboardTasksHandler(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's DAOs
    const userDaos = await db
      .select({ daoId: daoMemberships.daoId })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    const daoIds = userDaos.map(d => d.daoId);

    if (daoIds.length === 0) {
      return res.json([]);
    }

    // Get open tasks
    const openTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          sql`${tasks.daoId} IN ${daoIds}`,
          eq(tasks.status, 'open')
        )
      )
      .orderBy(desc(tasks.createdAt))
      .limit(10);

    const formattedTasks = openTasks.map(t => {
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

