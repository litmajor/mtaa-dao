import { Router } from "express";
import { db } from "../db";
import { users, vaults, contributions, userActivities } from "../../shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { authenticate } from "../auth";

const router = Router();

// GET /api/profile - Get user profile
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get user data
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        password: false, // Exclude sensitive data
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get contribution stats
    const contributionStats = await db
      .select({
        totalContributions: sql<number>`COALESCE(SUM(CAST(${contributions.amount} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(contributions)
      .where(eq(contributions.userId, userId))
      .then(rows => rows[0] || { totalContributions: 0, count: 0 });

    // Get monthly contributions
    const monthlyContributions = await db
      .select({
        monthlyContributions: sql<number>`COALESCE(SUM(CAST(${contributions.amount} AS DECIMAL)), 0)`,
      })
      .from(contributions)
      .where(
        and(
          eq(contributions.userId, userId),
          sql`${contributions.createdAt} >= NOW() - INTERVAL '30 days'`
        )
      )
      .then(rows => rows[0]?.monthlyContributions || 0);

    // Calculate current streak
    const recentActivities = await db.query.userActivities.findMany({
      where: eq(userActivities.userId, userId),
      orderBy: [desc(userActivities.createdAt)],
      limit: 365,
    });

    let currentStreak = 0;
    if (recentActivities.length > 0) {
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      for (const activity of recentActivities) {
        if (!activity.createdAt) continue;
        const activityDate = new Date(activity.createdAt);
        activityDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((currentDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === currentStreak) {
          currentStreak++;
        } else if (diffDays > currentStreak) {
          break;
        }
      }
    }

    // Get user's vaults
    const userVaults = await db.query.vaults.findMany({
      where: eq(vaults.userId, userId),
    });

    const totalBalance = userVaults.reduce((sum, vault) => 
      sum + parseFloat(vault.balance || "0"), 0
    );

    // Get recent contributions
    const recentContributions = await db.query.contributions.findMany({
      where: eq(contributions.userId, userId),
      orderBy: [desc(contributions.createdAt)],
      limit: 10,
    });

    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: user.roles,
        joinedAt: user.createdAt,
        profilePicture: user.profileImageUrl,
      },
      contributionStats: {
        totalContributions: parseFloat(contributionStats.totalContributions.toString()),
        monthlyContributions: parseFloat(monthlyContributions.toString()),
        currentStreak,
        totalCount: contributionStats.count,
      },
      contributions: recentContributions,
      vaults: userVaults.map(v => ({
        id: v.id,
        balance: v.balance,
        name: v.name,
      })),
      totalBalance,
      votingTokenBalance: user.votingTokenBalance || 0,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /api/profile - Update user profile (legacy)
router.put("/", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { firstName, lastName, profileImageUrl } = req.body;

    const updated = await db
      .update(users)
      .set({
        firstName,
        lastName,
        profileImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated.length) {
      return res.status(404).json({ error: "User not found" });
    }
    const { password, ...userWithoutPassword } = updated[0];
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PUT /api/profile/update - Update user profile
router.put("/update", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { firstName, lastName, email, profileImageUrl } = req.body;

    const updated = await db
      .update(users)
      .set({
        firstName,
        lastName,
        email,
        profileImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated.length) {
      return res.status(404).json({ error: "User not found" });
    }
    const { password, ...userWithoutPassword } = updated[0];
    res.json({ 
      success: true,
      message: "Profile updated successfully",
      user: userWithoutPassword 
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to update profile" 
    });
  }
});

// GET user contributions
router.get('/contributions', async (req, res) => {
  try {
    const userId = (req as any).userId;

    const contributions = await db
      .select({
        id: sql`CAST(${contributions.id} AS TEXT)`,
        daoId: contributions.daoId,
        amount: contributions.amount,
        contributionType: contributions.contributionType,
        createdAt: contributions.createdAt,
      })
      .from(contributions)
      .where(eq(contributions.userId, userId))
      .orderBy(desc(contributions.createdAt))
      .limit(50);

    res.json({ 
      success: true,
      contributions
    });
  } catch (error) {
    console.error('Error fetching contributions:', error);
    res.status(500).json({ error: 'Failed to fetch contributions' });
  }
});

export default router;