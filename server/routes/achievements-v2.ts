import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AchievementSystemService } from '../services/achievementSystemService';

const router = Router();

// ============ Achievement Management ============

/**
 * GET /api/achievements - List all achievements
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, tier, hidden } = req.query;
    
    const achievements = await AchievementSystemService.getAllAchievements({
      category: category as string,
      tier: tier as string,
      hidden: hidden === 'true'
    });
    
    res.json({
      success: true,
      count: achievements.length,
      achievements
    });
  } catch (err) {
    console.error('Error fetching achievements:', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

/**
 * GET /api/achievements/:achievementId - Get achievement details
 */
router.get('/:achievementId', async (req: Request, res: Response) => {
  try {
    const achievement = await AchievementSystemService.getAchievementById(req.params.achievementId);
    
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    res.json({ success: true, achievement });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch achievement' });
  }
});

/**
 * POST /api/achievements - Create new achievement (admin only)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Require authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // TODO: Add admin role check
    const achievementData = req.body;
    
    const achievement = await AchievementSystemService.createAchievement(achievementData);
    
    res.status(201).json({
      success: true,
      achievement
    });
  } catch (err) {
    console.error('Error creating achievement:', err);
    res.status(400).json({ error: 'Failed to create achievement' });
  }
});

// ============ User Progress ============

/**
 * GET /api/achievements/user/progress - Get user's achievement progress
 */
router.get('/user/progress', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.sub;
    
    const progress = await AchievementSystemService.getUserAchievementProgress(userId);
    const stats = await AchievementSystemService.getUserAchievementStats(userId);
    
    res.json({
      success: true,
      progress,
      stats
    });
  } catch (err) {
    console.error('Error fetching user progress:', err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

/**
 * PUT /api/achievements/user/progress/:achievementId - Update achievement progress
 */
router.put('/user/progress/:achievementId', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.sub;
    const { progressValue, progressPercent } = req.body;
    
    await AchievementSystemService.updateUserProgress(
      userId,
      req.params.achievementId,
      progressValue || 0,
      progressPercent || 0
    );
    
    res.json({ success: true, message: 'Progress updated' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update progress' });
  }
});

/**
 * POST /api/achievements/:achievementId/unlock - Unlock achievement
 */
router.post('/:achievementId/unlock', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.sub;
    const { metadata } = req.body;
    
    const result = await AchievementSystemService.unlockAchievement(
      userId,
      req.params.achievementId,
      metadata
    );
    
    res.json({
      success: true,
      message: 'Achievement unlocked!',
      progressId: result
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to unlock achievement' });
  }
});

/**
 * POST /api/achievements/:achievementId/claim - Claim achievement reward
 */
router.post('/:achievementId/claim', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.sub;
    
    await AchievementSystemService.claimAchievementReward(userId, req.params.achievementId);
    
    res.json({
      success: true,
      message: 'Reward claimed successfully!'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to claim reward' });
  }
});

// ============ NFT Minting ============

/**
 * POST /api/achievements/:achievementId/mint-nft - Mint achievement NFT
 */
router.post('/:achievementId/mint-nft', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.sub;
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }
    
    const result = await AchievementSystemService.mintAchievementNFT(
      userId,
      req.params.achievementId,
      walletAddress
    );
    
    res.json({
      success: true,
      message: 'NFT minted successfully!',
      nft: result
    });
  } catch (err: any) {
    console.error('NFT minting error:', err);
    res.status(400).json({ error: err.message || 'Failed to mint NFT' });
  }
});

// ============ Badges ============

/**
 * GET /api/achievements/user/badges - Get user's badges
 */
router.get('/user/badges', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.sub;
    
    const badges = await AchievementSystemService.getUserBadges(userId);
    
    res.json({
      success: true,
      badges
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

/**
 * POST /api/achievements/badges - Create badge (admin only)
 */
router.post('/badges', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin role check
    const badge = await AchievementSystemService.createBadge(req.body);
    
    res.status(201).json({
      success: true,
      badge
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create badge' });
  }
});

// ============ Milestones ============

/**
 * POST /api/achievements/:achievementId/milestones - Create milestone (admin only)
 */
router.post('/:achievementId/milestones', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin role check
    const milestone = await AchievementSystemService.createMilestone({
      ...req.body,
      achievementId: req.params.achievementId
    });
    
    res.status(201).json({
      success: true,
      milestone
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create milestone' });
  }
});

// ============ Leaderboard ============

/**
 * GET /api/achievements/leaderboard - Get achievement leaderboard
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    
    const leaderboard = await AchievementSystemService.getTopAchievers(Number(limit));
    
    res.json({
      success: true,
      count: leaderboard.length,
      leaderboard
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * POST /api/achievements/leaderboard/update - Update leaderboard rankings (admin only)
 */
router.post('/leaderboard/update', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin role check
    await AchievementSystemService.updateLeaderboard();
    
    res.json({
      success: true,
      message: 'Leaderboard updated'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});

export default router;
