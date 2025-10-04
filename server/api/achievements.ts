
import express from 'express';
import { z } from 'zod';
import { AchievementService } from '../achievementService';

const router = express.Router();

// Get user's achievements
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const achievements = await AchievementService.getUserAchievements(userId);
    const stats = await AchievementService.getUserAchievementStats(userId);
    
    res.json({
      achievements,
      stats
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get current user's achievements
router.get('/me', async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const achievements = await AchievementService.getUserAchievements(userId);
    const stats = await AchievementService.getUserAchievementStats(userId);
    
    res.json({
      achievements,
      stats
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Check for new achievements
router.post('/check', async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const newAchievements = await AchievementService.checkUserAchievements(userId);
    
    res.json({
      newAchievements,
      count: newAchievements.length
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Claim achievement reward
router.post('/:achievementId/claim', async (req, res) => {
  try {
    const { achievementId } = req.params;
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const success = await AchievementService.claimAchievementReward(userId, achievementId);
    
    if (!success) {
      return res.status(400).json({ error: 'Achievement not available for claiming' });
    }
    
    res.json({
      success: true,
      message: 'Achievement reward claimed successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get achievement leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
  const { db } = await import('../storage');
  const { achievements, userAchievements } = await import('../../shared/achievementSchema');
  const { users } = await import('../../shared/schema');
    const { sql, desc, eq } = await import('drizzle-orm');
    
    const leaderboard = await db
      .select({
        userId: userAchievements.userId,
        userName: users.username,
        totalAchievements: sql<number>`count(${userAchievements.id})`,
        totalPoints: sql<number>`sum(${achievements.rewardPoints})`
      })
      .from(userAchievements)
      .leftJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .leftJoin(users, eq(userAchievements.userId, users.id))
      .where(eq(userAchievements.isCompleted, true))
      .groupBy(userAchievements.userId, users.username)
      .orderBy(desc(sql`sum(${achievements.rewardPoints})`))
      .limit(50);
    
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
