/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAOs Router (Root Level)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Core DAO management operations:
 * - DAO CRUD (create, list, get, update, delete)
 * - DAO membership (join, leave)
 * - DAO discovery and statistics
 *
 * Base Path: /api/v1/daos
 *
 * Migration Source: /server/routes/daos.ts (legacy)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, Router } from 'express';
import { db } from '../../storage';
import { logger } from '../../utils/logger';
import { daos, daoMemberships, users, proposals } from '../../../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { isAuthenticated } from '../../nextAuthMiddleware';
import daoIdRouter from './daos/index';
import TreasuryService from '../../services/treasuryService';

const router: Router = express.Router();

// Helper to extract userId
function getUserId(req: any): string | null {
  return req.user?.id || req.user?.claims?.id || null;
}

// ════════════════════════════════════════════════════════════════════════════════
// List & Discovery
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos
 * List all DAOs with user membership status, member counts, and activity metrics
 */
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get all DAOs
    const allDAOs = await db
      .select({
        id: daos.id,
        name: daos.name,
        description: daos.description,
        createdAt: daos.createdAt,
        founderId: daos.founderId,
        treasuryBalance: daos.treasuryBalance,
        causeTags: daos.causeTags,
        primaryCause: daos.primaryCause,
      })
      .from(daos);

    // Get member counts for each DAO
    const memberCounts = await db
      .select({
        daoId: daoMemberships.daoId,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(daoMemberships)
      .groupBy(daoMemberships.daoId);

    // Get user's DAO memberships
    const userMemberships = await db
      .select({
        daoId: daoMemberships.daoId,
        role: daoMemberships.role,
        joinedAt: daoMemberships.joinedAt,
      })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    // Get active proposals count per DAO
    const activeProposalsCounts = await db
      .select({
        daoId: proposals.daoId,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(proposals)
      .where(eq(proposals.status, 'active'))
      .groupBy(proposals.daoId);

    // Map counts to lookup tables
    const memberCountMap = new Map();
    memberCounts.forEach(({ daoId, count }) => {
      memberCountMap.set(daoId, Number(count));
    });

    const membershipMap = new Map();
    userMemberships.forEach(({ daoId, role, joinedAt }) => {
      membershipMap.set(daoId, { role, joinedAt });
    });

    const proposalCountMap = new Map();
    activeProposalsCounts.forEach(({ daoId, count }) => {
      proposalCountMap.set(daoId, Number(count));
    });

    // Combine data
    const enrichedDAOs = await Promise.all(allDAOs.map(async (dao) => {
      const membership = membershipMap.get(dao.id);
      const memberCount = memberCountMap.get(dao.id) || 0;
      const activeProposals = proposalCountMap.get(dao.id) || 0;
      
      // Get computed treasury balance
      let treasuryBalance = 0;
      try {
        const computed = await TreasuryService.getComputedTreasuryBalance(dao.id);
        treasuryBalance = parseFloat(computed.totalComputedBalance);
      } catch (error) {
        logger.warn(`Could not compute treasury balance for DAO ${dao.id}:`, error);
        // Fall back to stored value if computation fails
        treasuryBalance = parseFloat(dao.treasuryBalance || '0');
      }
      
      return {
        id: dao.id,
        name: dao.name,
        description: dao.description,
        memberCount,
        treasuryBalance,
        role: membership?.role || null,
        isJoined: !!membership,
        joinedAt: membership?.joinedAt || null,
        activeProposals,
        recentActivity: activeProposals > 0 ? `${activeProposals} active proposals` : 'No recent activity',
        causeTags: dao.causeTags || [],
        primaryCause: dao.primaryCause || '',
        createdAt: dao.createdAt,
        founderId: dao.founderId,
      };
    }));

    res.json({
      success: true,
      data: enrichedDAOs,
      count: enrichedDAOs.length,
    });
  } catch (error: any) {
    logger.error('Error fetching DAOs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch DAOs' });
  }
});

/**
 * GET /api/v1/daos/featured
 * Get the featured DAO (DAO with most members - "DAO of the Week")
 * Returns a single featured DAO with full enrichment data
 */
router.get('/featured', async (req: Request, res: Response) => {
  try {
    // Get all DAOs
    const allDAOs = await db
      .select({
        id: daos.id,
        name: daos.name,
        description: daos.description,
        createdAt: daos.createdAt,
        founderId: daos.founderId,
        treasuryBalance: daos.treasuryBalance,
        causeTags: daos.causeTags,
        primaryCause: daos.primaryCause,
      })
      .from(daos);

    if (allDAOs.length === 0) {
      return res.status(404).json({ 
        error: 'No DAOs found',
        data: null 
      });
    }

    // Get member counts for each DAO
    const memberCounts = await db
      .select({
        daoId: daoMemberships.daoId,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(daoMemberships)
      .groupBy(daoMemberships.daoId);

    // Map member counts
    const memberCountMap = new Map();
    memberCounts.forEach(({ daoId, count }) => {
      memberCountMap.set(daoId, Number(count));
    });

    // Get active proposals count per DAO
    const activeProposalsCounts = await db
      .select({
        daoId: proposals.daoId,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(proposals)
      .where(eq(proposals.status, 'active'))
      .groupBy(proposals.daoId);

    const proposalCountMap = new Map();
    activeProposalsCounts.forEach(({ daoId, count }) => {
      proposalCountMap.set(daoId, Number(count));
    });

    // Find DAO with most members (featured)
    let featuredDao = allDAOs[0];
    let maxMembers = memberCountMap.get(allDAOs[0].id) || 0;

    for (const dao of allDAOs) {
      const memberCount = memberCountMap.get(dao.id) || 0;
      if (memberCount > maxMembers) {
        featuredDao = dao;
        maxMembers = memberCount;
      }
    }

    // Enrich featured DAO
    const memberCount = memberCountMap.get(featuredDao.id) || 0;
    const activeProposals = proposalCountMap.get(featuredDao.id) || 0;
    
    // Get computed treasury balance
    let treasuryBalance = 0;
    try {
      const computed = await TreasuryService.getComputedTreasuryBalance(featuredDao.id);
      treasuryBalance = parseFloat(computed.totalComputedBalance);
    } catch (error) {
      logger.warn(`Could not compute treasury balance for featured DAO ${featuredDao.id}:`, error);
      // Fall back to stored value if computation fails
      treasuryBalance = parseFloat(featuredDao.treasuryBalance || '0');
    }

    const enrichedFeatured = {
      id: featuredDao.id,
      name: featuredDao.name,
      description: featuredDao.description,
      memberCount,
      treasuryBalance,
      activeProposals,
      recentActivity: activeProposals > 0 ? `${activeProposals} active proposals` : 'No recent activity',
      causeTags: featuredDao.causeTags || [],
      primaryCause: featuredDao.primaryCause || '',
      createdAt: featuredDao.createdAt,
      founderId: featuredDao.founderId,
    };

    res.json({
      success: true,
      data: enrichedFeatured,
    });
  } catch (error: any) {
    logger.error('Error fetching featured DAO:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured DAO' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// DAO Details & Dashboard
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId
 * Get DAO details with membership info
 */
router.get('/:daoId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { daoId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get DAO details
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get member count
    const memberCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId))
      .then(rows => Number(rows[0]?.count || 0));

    // Get user's membership
    const [membership] = await db
      .select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    // Get computed treasury balance
    let treasuryBalance = 0;
    try {
      const computed = await TreasuryService.getComputedTreasuryBalance(daoId);
      treasuryBalance = parseFloat(computed.totalComputedBalance);
    } catch (error) {
      logger.warn(`Could not compute treasury balance for DAO ${daoId}:`, error);
      // Fall back to stored value if computation fails
      treasuryBalance = parseFloat((dao.treasuryBalance || '0').toString());
    }

    res.json({
      success: true,
      data: {
        ...dao,
        memberCount,
        userRole: membership?.role || null,
        isMember: !!membership,
        joinedAt: membership?.joinedAt || null,
        treasuryBalance,
      }
    });
  } catch (error: any) {
    logger.error(`Error fetching DAO ${req.params.daoId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch DAO details' });
  }
});

/**
 * GET /api/v1/daos/:daoId/dashboard-stats
 * Get DAO dashboard statistics (members, proposals, treasury, plan expiry)
 */
router.get('/:daoId/dashboard-stats', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;

    // Get DAO details
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get member stats (approved members only)
    const members = await db
      .select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.status, 'approved')
      ));

    // Count new members this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newMembersThisWeek = members.filter(m => 
      m.joinedAt && new Date(m.joinedAt) >= oneWeekAgo
    ).length;

    // Get active proposals
    const activeProposals = await db
      .select()
      .from(proposals)
      .where(and(
        eq(proposals.daoId, daoId),
        eq(proposals.status, 'active')
      ));

    // Calculate days until plan expiry
    let daysLeft = 0;
    let status: 'active' | 'expiring' | 'expired' = 'active';
    
    if (dao.planExpiresAt) {
      const expiryDate = new Date(dao.planExpiresAt);
      const now = new Date();
      daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft < 0) {
        status = 'expired';
        daysLeft = 0;
      } else if (daysLeft <= 14) {
        status = 'expiring';
      }
    }

    // Calculate funding progress
    let treasuryBalance = 0;
    try {
      const computed = await TreasuryService.getComputedTreasuryBalance(daoId);
      treasuryBalance = parseFloat(computed.totalComputedBalance);
    } catch (error) {
      logger.warn(`Could not compute treasury balance for DAO ${daoId}:`, error);
      // Fall back to stored value if computation fails
      treasuryBalance = parseFloat((dao.treasuryBalance || '0').toString());
    }
    
    const fundingGoal = 5000; // Default goal
    const fundingProgress = Math.min((treasuryBalance / fundingGoal) * 100, 100);

    res.json({
      success: true,
      data: {
        totalMembers: members.length,
        newMembersThisWeek,
        activeProposals: activeProposals.length,
        treasuryBalance: treasuryBalance.toFixed(2),
        fundingGoal: fundingGoal.toString(),
        fundingProgress: Math.round(fundingProgress),
        planExpiresAt: dao.planExpiresAt,
        daysLeft,
        status,
        plan: dao.plan || 'free',
      }
    });
  } catch (error: any) {
    logger.error(`Error fetching dashboard stats for DAO ${req.params.daoId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard statistics' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// DAO Membership
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/daos/:daoId/join
 * Join a DAO as a member
 */
router.post('/:daoId/join', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { daoId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if DAO exists
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check if already a member
    const [existingMembership] = await db
      .select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (existingMembership) {
      return res.status(400).json({ error: 'Already a member of this DAO' });
    }

    // Add user as member
    const [newMembership] = await db
      .insert(daoMemberships)
      .values({
        daoId,
        userId,
        role: 'member',
        joinedAt: new Date(),
        status: 'approved',
      })
      .returning();

    logger.info(`User ${userId} joined DAO ${daoId}`);

    res.status(201).json({
      success: true,
      message: 'Successfully joined the DAO',
      data: newMembership,
    });
  } catch (error: any) {
    logger.error(`Error joining DAO ${req.params.daoId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to join DAO' });
  }
});

/**
 * POST /api/v1/daos/:daoId/leave
 * Leave a DAO (founders cannot leave without transferring ownership)
 */
router.post('/:daoId/leave', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { daoId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if DAO exists
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Prevent founder from leaving
    if (dao.founderId === userId) {
      return res.status(400).json({
        error: 'Founders cannot leave their own DAO. Transfer ownership first.',
      });
    }

    // Check if member
    const [membership] = await db
      .select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership) {
      return res.status(400).json({ error: 'Not a member of this DAO' });
    }

    // Remove membership
    await db
      .delete(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ));

    logger.info(`User ${userId} left DAO ${daoId}`);

    res.json({
      success: true,
      message: 'Successfully left the DAO',
    });
  } catch (error: any) {
    logger.error(`Error leaving DAO ${req.params.daoId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to leave DAO' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// Mount DAO-scoped sub-routers (members, subscriptions, proposals, etc.)
// ════════════════════════════════════════════════════════════════════════════════
router.use('/:daoId', daoIdRouter);

export default router;
