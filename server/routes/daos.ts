import { Router } from "express";
import { db } from "../db";
import { daos, daoMemberships, users, proposals } from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { authenticate } from "../auth";

const router = Router();

// GET /api/daos - List all DAOs with user membership status
router.get("/", authenticate, async (req, res) => {
  try {
  const userId = (req.user as any).id;

    // Get all DAOs with member count and treasury balance
    const allDAOs = await db
      .select({
        id: daos.id,
        name: daos.name,
        description: daos.description,
        createdAt: daos.createdAt,
        founderId: daos.founderId,
        treasuryBalance: daos.treasuryBalance,
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

    // Get recent activity counts for each DAO (proposals)
    const activityCounts = await db.execute(sql`
      SELECT 
        "daoId",
        COUNT(*) as "activeProposals"
      FROM proposals
      WHERE status = 'active'
      GROUP BY "daoId"
    `);

    // Map activity counts
    const activityMap = new Map();
    if (Array.isArray(activityCounts.rows)) {
      activityCounts.rows.forEach((row: any) => {
        activityMap.set(row.daoId, row.activeProposals || 0);
      });
    }

    // Map member counts
    const memberCountMap = new Map();
    memberCounts.forEach(({ daoId, count }) => {
      memberCountMap.set(daoId, Number(count));
    });

    // Map user memberships
    const membershipMap = new Map();
    userMemberships.forEach(({ daoId, role, joinedAt }) => {
      membershipMap.set(daoId, { role, joinedAt });
    });

    // Calculate growth rates (simplified - based on recent member joins)
    const growthRates = await db.execute(sql`
      SELECT 
        "daoId",
        CASE 
          WHEN COUNT(*) = 0 THEN 0
          ELSE COUNT(*) FILTER (WHERE "joinedAt" >= NOW() - INTERVAL '30 days') * 100.0 / COUNT(*)
        END as "growthRate"
      FROM dao_memberships
      GROUP BY "daoId"
    `);

    const growthMap = new Map();
    if (Array.isArray(growthRates.rows)) {
      growthRates.rows.forEach((row: any) => {
        growthMap.set(row.daoId, parseFloat(row.growthRate || '0'));
      });
    }

    // Combine data
    const enrichedDAOs = allDAOs.map((dao) => {
      const membership = membershipMap.get(dao.id);
      const memberCount = memberCountMap.get(dao.id) || 0;
      const activeProposals = activityMap.get(dao.id) || 0;
      const growthRate = growthMap.get(dao.id) || 0;
      return {
        id: dao.id,
        name: dao.name,
        description: dao.description,
        memberCount,
        treasuryBalance: parseFloat(dao.treasuryBalance || '0'),
        role: membership?.role || null,
        isJoined: !!membership,
        trending: growthRate > 15,
        growthRate: parseFloat(growthRate.toFixed(1)),
        recentActivity: activeProposals > 0 ? `${activeProposals} proposals active` : 'No recent activity',
      };
    });

    res.json(enrichedDAOs);
  } catch (error) {
    console.error('Error fetching DAOs:', error);
    res.status(500).json({ error: 'Failed to fetch DAOs' });
  }
});

// Get DAO dashboard statistics
router.get('/:daoId/dashboard-stats', async (req, res) => {
  try {
    const { daoId } = req.params;

    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId)
    });

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get member stats
    const members = await db.query.daoMemberships.findMany({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.status, 'approved')
      )
    });

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newMembersThisWeek = members.filter(m => 
      m.createdAt && new Date(m.createdAt) >= oneWeekAgo
    ).length;

    // Get active proposals
    const activeProposals = await db.query.proposals.findMany({
      where: and(
        eq(proposals.daoId, daoId),
        eq(proposals.status, 'active')
      )
    });

    // Calculate days left
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
    const treasuryBalance = parseFloat(dao.treasuryBalance || '0');
    const fundingGoal = 5000; // Default goal, can be customized per DAO
    const fundingProgress = Math.min((treasuryBalance / fundingGoal) * 100, 100);

    res.json({
      totalMembers: members.length,
      newMembersThisWeek,
      activeProposals: activeProposals.length,
      treasuryBalance: treasuryBalance.toString(),
      fundingGoal: fundingGoal.toString(),
      fundingProgress: Math.round(fundingProgress),
      planExpiresAt: dao.planExpiresAt,
      daysLeft,
      status
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// POST /api/daos/:id/join - Join a DAO
router.post("/:id/join", authenticate, async (req, res) => {
  try {
  const userId = (req.user as any).id;
  const daoId = req.params.id as string;

    // Check if DAO exists
    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId),
    });

    if (!dao) {
      return res.status(404).json({ error: "DAO not found" });
    }

    // Check if already a member
    const existingMembership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ),
    });

    if (existingMembership) {
      return res.status(400).json({ error: "Already a member of this DAO" });
    }

    // Add user as member
    await db.insert(daoMemberships).values({
      daoId,
      userId,
      role: "member",
      joinedAt: new Date(),
    });

    res.json({
      success: true,
      message: "Successfully joined the DAO",
    });
  } catch (error) {
    console.error("Error joining DAO:", error);
    res.status(500).json({ error: "Failed to join DAO" });
  }
});

// POST /api/daos/:id/leave - Leave a DAO
router.post("/:id/leave", authenticate, async (req, res) => {
  try {
  const userId = (req.user as any).id;
  const daoId = req.params.id as string;

    // Check if DAO exists
    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId),
    });

    if (!dao) {
      return res.status(404).json({ error: "DAO not found" });
    }

    // Check if user is founder
    if (dao.founderId === userId) {
      return res.status(400).json({
        error: "Founders cannot leave their own DAO. Transfer ownership first.",
      });
    }

    // Check if member
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ),
    });

    if (!membership) {
      return res.status(400).json({ error: "Not a member of this DAO" });
    }

    // Remove membership
    await db.delete(daoMemberships).where(
      and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      )
    );

    res.json({
      success: true,
      message: "Successfully left the DAO",
    });
  } catch (error) {
    console.error("Error leaving DAO:", error);
    res.status(500).json({ error: "Failed to leave DAO" });
  }
});

// GET /api/daos/:id - Get DAO details
router.get("/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const daoId = req.params.id as string;

    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId),
    });

    if (!dao) {
      return res.status(404).json({ error: "DAO not found" });
    }

    // Get member count
    const memberCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId))
      .then(rows => Number(rows[0]?.count || 0));

    // Get user's membership
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ),
    });

    res.json({
      ...dao,
      memberCount,
      userRole: membership?.role || null,
      isMember: !!membership,
    });
  } catch (error) {
    console.error("Error fetching DAO details:", error);
    res.status(500).json({ error: "Failed to fetch DAO details" });
  }
});

export default router;

