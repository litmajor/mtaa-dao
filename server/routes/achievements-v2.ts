import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { isAuthenticated } from '../auth';
import { AchievementSystemService } from '../services/achievementSystemService';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

const parsePositiveInteger = (value: unknown, fallback: number, max: number, field: string): number => {
  const parsed = Number.parseInt(String(value ?? fallback), 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > max) {
    throw new AppError(`${field} must be an integer between 1 and ${max}`, 400, true, 'VALIDATION_ERROR');
  }

  return parsed;
};

const parseProgressValue = (value: unknown, field: string): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000000) {
    throw new AppError(`${field} must be a finite number between 0 and 1000000`, 400, true, 'VALIDATION_ERROR');
  }

  return parsed;
};

const validateWalletAddress = (walletAddress: unknown): string => {
  if (typeof walletAddress !== 'string' || !walletAddress.trim()) {
    throw new AppError('Wallet address is required', 400, true, 'VALIDATION_ERROR');
  }

  const normalized = walletAddress.trim();
  if (!ethers.isAddress(normalized)) {
    throw new AppError('Wallet address must be a valid Ethereum address', 400, true, 'VALIDATION_ERROR');
  }

  if (ethers.getAddress(normalized) !== normalized) {
    throw new AppError('Wallet address must use checksum casing', 400, true, 'VALIDATION_ERROR');
  }

  return normalized;
};

/**
 * Middleware to check admin role
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (req.user.role !== 'admin' && req.user.claims?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin role required' });
  }
  
  next();
}

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
 * POST /api/achievements - Create new achievement (admin only)
 */
router.post('/', isAuthenticated, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const achievementData = req.body;

  const achievement = await AchievementSystemService.createAchievement(achievementData);

  res.status(201).json({
    success: true,
    achievement
  });
}));

// ============ User Progress ============

/**
 * GET /api/achievements/user/progress - Get user's achievement progress
 * ⚠️ SECURITY: Requires authentication - user owns their progress data
 */
router.get('/user/progress', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id || (req.user as any)?.sub;

  const progress = await AchievementSystemService.getUserAchievementProgress(userId);
  const stats = await AchievementSystemService.getUserAchievementStats(userId);

  res.json({
    success: true,
    progress,
    stats
  });
}));

/**
 * PUT /api/achievements/user/progress/:achievementId - Update achievement progress
 * ⚠️ SECURITY: Requires authentication - user owns their progress data
 */
router.put('/user/progress/:achievementId', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id || (req.user as any)?.sub;
  const { progressValue, progressPercent } = req.body;

  const safeProgressValue = parseProgressValue(progressValue, 'progressValue');
  const safeProgressPercent = parseProgressValue(progressPercent, 'progressPercent');

  if (safeProgressPercent > 100) {
    throw new AppError('progressPercent must be between 0 and 100', 400, true, 'VALIDATION_ERROR');
  }

  await AchievementSystemService.updateUserProgress(
    userId,
    req.params.achievementId,
    safeProgressValue,
    safeProgressPercent
  );

  res.json({ success: true, message: 'Progress updated' });
}));

// ============ Badges ============

/**
 * GET /api/achievements/user/badges - Get user's badges
 */
router.get('/user/badges', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id || (req.user as any)?.sub;

  const badges = await AchievementSystemService.getUserBadges(userId);

  res.json({
    success: true,
    badges
  });
}));

/**
 * POST /api/achievements/badges - Create badge (admin only)
 */
router.post('/badges', isAuthenticated, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const badge = await AchievementSystemService.createBadge(req.body);

  res.status(201).json({
    success: true,
    badge
  });
}));

// ============ Leaderboard ============

/**
 * GET /api/achievements/leaderboard - Get achievement leaderboard
 */
router.get('/leaderboard', asyncHandler(async (req: Request, res: Response) => {
  const { limit = 10 } = req.query;
  const safeLimit = parsePositiveInteger(limit, 10, 100, 'limit');

  const leaderboard = await AchievementSystemService.getTopAchievers(safeLimit);

  res.json({
    success: true,
    count: leaderboard.length,
    leaderboard
  });
}));

/**
 * POST /api/achievements/leaderboard/update - Update leaderboard rankings (admin only)
 */
router.post('/leaderboard/update', isAuthenticated, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await AchievementSystemService.updateLeaderboard();

  res.json({
    success: true,
    message: 'Leaderboard updated'
  });
}));

/**
 * POST /api/achievements/:achievementId/unlock - Unlock achievement
 */
router.post('/:achievementId/unlock', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
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
}));

/**
 * POST /api/achievements/:achievementId/claim - Claim achievement reward
 * ⚠️ SECURITY: Requires authentication - user owns their rewards
 */
router.post('/:achievementId/claim', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id || (req.user as any)?.sub;

  await AchievementSystemService.claimAchievementReward(userId, req.params.achievementId);

  res.json({
    success: true,
    message: 'Reward claimed successfully!'
  });
}));

// ============ NFT Minting ============

/**
 * POST /api/achievements/:achievementId/mint-nft - Mint achievement NFT
 */
router.post('/:achievementId/mint-nft', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id || (req.user as any)?.sub;
  const { walletAddress } = req.body;

  const normalizedWalletAddress = validateWalletAddress(walletAddress);

  const result = await AchievementSystemService.mintAchievementNFT(
    userId,
    req.params.achievementId,
    normalizedWalletAddress
  );

  res.json({
    success: true,
    message: 'NFT minted successfully!',
    nft: result
  });
}));

// ============ Milestones ============

/**
 * POST /api/achievements/:achievementId/milestones - Create milestone (admin only)
 */
router.post('/:achievementId/milestones', isAuthenticated, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const milestone = await AchievementSystemService.createMilestone({
    ...req.body,
    achievementId: req.params.achievementId
  });

  res.status(201).json({
    success: true,
    milestone
  });
}));

/**
 * GET /api/achievements/:achievementId - Get achievement details
 */
router.get('/:achievementId', asyncHandler(async (req: Request, res: Response) => {
  const achievement = await AchievementSystemService.getAchievementById(req.params.achievementId);

  if (!achievement) {
    throw new AppError('Achievement not found', 404, true, 'NOT_FOUND');
  }

  res.json({ success: true, achievement });
}));

export default router;
