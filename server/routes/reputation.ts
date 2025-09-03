
import express, { Request, Response } from 'express';
import { ReputationService } from '../reputationService';
import { isAuthenticated } from '../nextAuthMiddleware';

const router = express.Router();

// Get user's reputation
router.get('/user/:userId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = (req.user as any).claims.sub;
    
    // Users can only view their own detailed reputation or view others' public reputation
    if (userId !== authUserId && userId !== 'me') {
      // Return limited public info for other users
      const reputation = await ReputationService.getUserReputation(userId);
      return res.json({
        totalPoints: reputation.totalPoints,
        badge: reputation.badge,
        level: reputation.level,
      });
    }

    const targetUserId = userId === 'me' ? authUserId : userId;
    const reputation = await ReputationService.getUserReputation(targetUserId);
    res.json(reputation);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Get reputation leaderboard
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    const leaderboard = await ReputationService.getLeaderboard(Number(limit));
    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Convert points to MsiaMo tokens
router.post('/convert', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims.sub;
    const { pointsToConvert, conversionRate } = req.body;

    if (!pointsToConvert || pointsToConvert <= 0) {
      return res.status(400).json({ message: 'Invalid points amount' });
    }

    const result = await ReputationService.convertPointsToTokens(
      userId,
      pointsToConvert,
      conversionRate
    );

    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Check airdrop eligibility
router.post('/airdrop/check', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims.sub;
    const { airdropId, minimumReputation, baseAmount } = req.body;

    if (!airdropId || !minimumReputation || !baseAmount) {
      return res.status(400).json({ message: 'Missing required airdrop parameters' });
    }

    const eligibility = await ReputationService.checkAirdropEligibility(
      userId,
      airdropId,
      minimumReputation,
      baseAmount
    );

    res.json(eligibility);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Award points manually (admin only)
router.post('/award', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { userId, action, points, daoId, description, multiplier } = req.body;
    const authUser = req.user as any;

    // Check if user is admin/superuser
    if (authUser.role !== 'superuser' && authUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    await ReputationService.awardPoints(userId, action, points, daoId, description, multiplier);
    res.json({ message: 'Points awarded successfully' });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
