import { Router } from "express";
import { db } from "../db";
import { daos, daoMemberships, users } from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { authenticate } from "../auth";

const router = Router();

// GET /api/daos - List all DAOs with user membership status
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get all DAOs with member count and treasury balance
    const allDAOs = await db
      .select({
        id: daos.id,
        name: daos.name,
        description: daos.description,
        category: daos.category,
        createdAt: daos.createdAt,
        founderWallet: daos.founderWallet,
        treasuryBalance: daos.treasuryBalance,
        theme: sql<string>`COALESCE(${daos.theme}, 'purple')`.as('theme'),
        avatar: sql<string>`COALESCE(${daos.avatar}, '🏛️')`.as('avatar'),
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
        COUNT(*) FILTER (WHERE "joinedAt" >= NOW() - INTERVAL '30 days') * 100.0 / NULLIF(COUNT(*), 0) as "growthRate"
      FROM dao_members
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

      // Determine theme colors based on category
      const themeMap: Record<string, { theme: string; gradient: string }> = {
        development: { theme: 'purple', gradient: 'from-purple-600 via-pink-600 to-orange-500' },
        education: { theme: 'blue', gradient: 'from-blue-600 via-cyan-500 to-teal-400' },
        energy: { theme: 'green', gradient: 'from-green-500 via-emerald-500 to-teal-500' },
        business: { theme: 'pink', gradient: 'from-pink-500 via-rose-500 to-red-500' },
        healthcare: { theme: 'teal', gradient: 'from-teal-500 via-cyan-500 to-blue-500' },
        arts: { theme: 'purple', gradient: 'from-purple-500 via-pink-500 to-red-500' },
        sports: { theme: 'orange', gradient: 'from-orange-500 via-red-500 to-pink-500' },
        tech: { theme: 'blue', gradient: 'from-blue-500 via-indigo-500 to-purple-500' },
      };

      const themeInfo = themeMap[dao.category || 'development'] || themeMap.development;

      return {
        id: dao.id,
        name: dao.name,
        description: dao.description,
        memberCount,
        treasuryBalance: parseFloat(dao.treasuryBalance || '0'),
        role: membership?.role || null,
        isJoined: !!membership,
        gradient: themeInfo.gradient,
        theme: themeInfo.theme,
        trending: growthRate > 15, // Consider trending if growth > 15%
        growthRate: parseFloat(growthRate.toFixed(1)),
        recentActivity: activeProposals > 0 ? `${activeProposals} proposals active` : 'No recent activity',
        avatar: dao.avatar || '🏛️',
        category: dao.category,
      };
    });

    // Sort: user's DAOs first, then by member count
    enrichedDAOs.sort((a, b) => {
      if (a.isJoined && !b.isJoined) return -1;
      if (!a.isJoined && b.isJoined) return 1;
      return b.memberCount - a.memberCount;
    });

    res.json(enrichedDAOs);
  } catch (error) {
    console.error("Error fetching DAOs:", error);
    res.status(500).json({ error: "Failed to fetch DAOs" });
  }
});

// POST /api/daos/:id/join - Join a DAO
router.post("/:id/join", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const daoId = parseInt(req.params.id);

    if (isNaN(daoId)) {
      return res.status(400).json({ error: "Invalid DAO ID" });
    }

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
    const userId = req.user!.id;
    const daoId = parseInt(req.params.id);

    if (isNaN(daoId)) {
      return res.status(400).json({ error: "Invalid DAO ID" });
    }

    // Check if DAO exists
    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId),
    });

    if (!dao) {
      return res.status(404).json({ error: "DAO not found" });
    }

    // Check if user is founder
    if (dao.founderWallet === userId) {
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
    const daoId = parseInt(req.params.id);

    if (isNaN(daoId)) {
      return res.status(400).json({ error: "Invalid DAO ID" });
    }

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

