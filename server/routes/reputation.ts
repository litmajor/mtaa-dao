
import express, { Request, Response } from 'express';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { AchievementService } from '../achievementService';
import { AirdropService } from '../airdropService';
import { VestingService } from '../vestingService';
import { achievements } from '../../shared/achievementSchema';
import { ReputationService } from '../reputationService';
import { isAuthenticated } from '../auth';

const router = express.Router();

// Daily check-in
router.post('/check-in', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await ReputationService.recordDailyCheckIn(userId);

    res.json({
      success: true,
      message: result.pointsAwarded > 0 ? 'Check-in recorded successfully!' : 'Already checked in today',
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get streak info
router.get('/streak', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const streakInfo = await ReputationService.getStreakInfo(userId);

    res.json({
      success: true,
      ...streakInfo,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's reputation (detailed when allowed)
router.get('/user/:userId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = (req.user as any).claims?.sub || (req.user as any).claims?.id;

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

// Convert points to tokens
router.post('/convert', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { pointsToConvert, conversionRate } = req.body;

    if (!pointsToConvert || pointsToConvert <= 0) {
      return res.status(400).json({ message: 'Invalid points amount' });
    }

    const result = await ReputationService.convertPointsToTokens(userId, pointsToConvert, conversionRate);

    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Check airdrop eligibility
router.post('/airdrop/check', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { airdropId, minimumReputation, baseAmount } = req.body;

    if (!airdropId || minimumReputation == null || baseAmount == null) {
      return res.status(400).json({ message: 'Missing required airdrop parameters' });
    }

    const eligibility = await ReputationService.checkAirdropEligibility(userId, airdropId, minimumReputation, baseAmount);

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

// Achievement endpoints
router.get('/achievements', async (req: Request, res: Response) => {
  try {
    const achievementRows = await db.select().from(achievements).where(eq(achievements.isActive, true));
    res.json({ achievements: achievementRows });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });


// Get economic identity (credit score)
router.get('/economic-identity/:userId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = (req.user as any).claims?.sub || (req.user as any).claims?.id;

    // Users can only view their own economic identity unless admin
    if (userId !== authUserId && userId !== 'me' && (req.user as any).role !== 'superuser') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const targetUserId = userId === 'me' ? authUserId : userId;
    const identity = await ReputationService.getEconomicIdentity(targetUserId);
    
    res.json({ identity });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Record a contribution
router.post('/contribution', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { contributionType, daoId, value, metadata, relatedEntityId, relatedEntityType } = req.body;

    // Determine reputation weight based on contribution type
    const weight = CONTRIBUTION_WEIGHTS[contributionType as keyof typeof CONTRIBUTION_WEIGHTS] || 50;

    const contribution = await ReputationService.recordContribution({
      userId,
      contributionType,
      daoId,
      value,
      reputationWeight: weight,
      metadata,
      relatedEntityId,
      relatedEntityType,
      autoVerify: false, // Requires verification
    });

    res.json({ contribution });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Verify a contribution (admin/verifier only)
router.post('/contribution/:contributionId/verify', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { contributionId } = req.params;
    const verifierId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { approved, notes } = req.body;

    // Check if user has verification rights
    // TODO: Implement proper verifier role check

    await db.update(contributionGraph)
      .set({
        verified: approved,
        verifiedBy: verifierId,
        verifiedAt: new Date(),
        metadata: sql`jsonb_set(metadata, '{verificationNotes}', ${JSON.stringify(notes)})`,
      })
      .where(eq(contributionGraph.id, contributionId));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Award a soulbound badge
router.post('/badge/award', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { badgeType, badgeTier, name, description, category, criteriaType, criteriaValue } = req.body;

    // Only admins can manually award badges
    if ((req.user as any).role !== 'superuser' && (req.user as any).role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const badge = await ReputationService.awardBadge({
      userId,
      badgeType,
      badgeTier,
      name,
      description,
      category,
      criteriaType,
      criteriaValue,
    });

    res.json({ badge });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Verify a skill
router.post('/skill/verify', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const verifierId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { userId, skillName, skillCategory, verificationMethod, proficiencyLevel, verificationProof } = req.body;

    const skill = await ReputationService.verifySkill({
      userId,
      skillName,
      skillCategory,
      verifiedBy: verifierId,
      verificationMethod,
      proficiencyLevel,
      verificationProof,
    });

    res.json({ skill });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Link phone number (M-Pesa integration)
router.post('/phone/link', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { phoneNumber } = req.body;

    // TODO: Implement phone verification flow (send OTP)
    await ReputationService.linkPhoneNumber(userId, phoneNumber, false);

    res.json({ success: true, message: 'Phone number linked. Verification pending.' });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Get user's contribution history
router.get('/contributions/:userId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const contributions = await db
      .select()
      .from(contributionGraph)
      .where(eq(contributionGraph.userId, userId))
      .orderBy(desc(contributionGraph.createdAt))
      .limit(parseInt(limit as string));

    res.json({ contributions });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Get user's badges
router.get('/badges/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const badges = await db
      .select()
      .from(reputationBadges)
      .where(and(
        eq(reputationBadges.userId, userId),
        eq(reputationBadges.isActive, true)
      ))
      .orderBy(desc(reputationBadges.earnedAt));

    res.json({ badges });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Export contribution weights for reference
export { CONTRIBUTION_WEIGHTS } from '../reputationService';

  }
});

router.get('/achievements/user/:userId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = (req.user as any).claims?.sub || (req.user as any).claims?.id;

    if (userId !== authUserId && userId !== 'me') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const targetUserId = userId === 'me' ? authUserId : userId;
    const userAchievements = await AchievementService.getUserAchievements(targetUserId);
    const stats = await AchievementService.getUserAchievementStats(targetUserId);

    res.json({ achievements: userAchievements, stats });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/achievements/claim/:achievementId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { achievementId } = req.params;

    const success = await AchievementService.claimAchievementReward(userId, achievementId);

    if (success) {
      res.json({ message: 'Reward claimed successfully' });
    } else {
      res.status(400).json({ message: 'Unable to claim reward' });
    }
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Airdrop endpoints
router.get('/airdrops/eligible', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const eligibleAirdrops = await AirdropService.getUserAirdropEligibility(userId);
    res.json({ airdrops: eligibleAirdrops });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/airdrops/claim/:airdropId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { airdropId } = req.params;

    const txHash = await AirdropService.claimAirdrop(userId, airdropId);
    res.json({ message: 'Airdrop claimed successfully', transactionHash: txHash });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Vesting endpoints
router.get('/vesting/overview', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const overview = await VestingService.getUserVestingOverview(userId);
    res.json(overview);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/vesting/claimable', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const claimable = await VestingService.getClaimableTokens(userId);
    res.json({ claimable });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/vesting/claim/:scheduleId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { scheduleId } = req.params;

    const txHash = await VestingService.claimVestedTokens(userId, scheduleId);
    res.json({ message: 'Tokens claimed successfully', transactionHash: txHash });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
