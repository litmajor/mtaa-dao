/**
 * Elder User Analysis Routes
 * 
 * Allows Elders (ELD-SCRY, ELD-KAIZEN, etc.) to analyze individual users
 * and provide insights on their activity, risk profile, contributions, and potential
 */

import express, { Request, Response } from 'express';
import { db } from '../db';
import { users, contributions, userActivities, userFollows, proposals, votes, vaults } from '../../shared/schema';
import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import { authenticate } from '../auth';
import { Logger } from '../utils/logger';

const router = express.Router();
const logger = new Logger('elder-user-analysis');

// Middleware to check if user is an Elder
const requireElder = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { roles: true }
    });

    if (!user || !user.roles?.includes('elder')) {
      return res.status(403).json({ 
        error: 'Access denied. Only Elders can perform user analysis.' 
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking elder role', error);
    res.status(500).json({ error: 'Failed to verify elder status' });
  }
};

// POST /api/elder/analyze-user/:targetUserId - Comprehensive user analysis
router.post('/analyze-user/:targetUserId', authenticate, requireElder, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const elderId = req.user!.id;

    // Fetch target user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
      columns: {
        password: false,
        emailVerificationToken: false,
        phoneVerificationToken: false,
        passwordResetToken: false,
        encryptedWallet: false,
        walletSalt: false,
        walletIv: false,
        walletAuthTag: false,
      }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get contribution data
    const contributionData = await db
      .select({
        totalContributions: sql<number>`COALESCE(SUM(CAST(${contributions.amount} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(contributions)
      .where(eq(contributions.userId, targetUserId));

    // Get monthly contributions
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthlyContributions = await db
      .select({
        monthlyContributions: sql<number>`COALESCE(SUM(CAST(${contributions.amount} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(contributions)
      .where(
        and(
          eq(contributions.userId, targetUserId),
          gte(contributions.createdAt, thirtyDaysAgo)
        )
      );

    // Get recent activities
    const recentActivities = await db.query.userActivities.findMany({
      where: eq(userActivities.userId, targetUserId),
      orderBy: [desc(userActivities.createdAt)],
      limit: 20,
    });

    // Get followers and following
    const followersCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userFollows)
      .where(eq(userFollows.followingId, targetUserId));

    const followingCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userFollows)
      .where(eq(userFollows.followerId, targetUserId));

    // Get proposal activity
    const proposalsCreated = await db.query.proposals.findMany({
      where: eq(proposals.creatorId, targetUserId),
      orderBy: [desc(proposals.createdAt)],
      limit: 5,
    });

    const votesParticipated = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(votes)
      .where(eq(votes.voterId, targetUserId));

    // Get vaults info
    const userVaults = await db.query.vaults.findMany({
      where: eq(vaults.userId, targetUserId),
    });

    // Calculate engagement score
    const engagementScore = calculateEngagementScore({
      recentActivityCount: recentActivities.length,
      monthlyContributions: parseFloat(monthlyContributions[0]?.monthlyContributions?.toString() || '0'),
      followersCount: followersCount[0]?.count || 0,
      proposalsCreated: proposalsCreated.length,
      votesParticipated: votesParticipated[0]?.count || 0,
      daysActive: Math.floor((Date.now() - new Date(targetUser.createdAt || Date.now()).getTime()) / (24 * 60 * 60 * 1000)),
    });

    // Calculate risk profile
    const riskProfile = analyzeRiskProfile({
      reputationScore: parseFloat(targetUser.reputationScore?.toString() || '0'),
      accountAge: Math.floor((Date.now() - new Date(targetUser.createdAt || Date.now()).getTime()) / (24 * 60 * 60 * 1000)),
      contributionValue: parseFloat(contributionData[0]?.totalContributions?.toString() || '0'),
      activityFrequency: recentActivities.length,
      kyc: false, // Would need to check KYC table
    });

    // Generate insights
    const insights = generateInsights({
      user: targetUser,
      engagement: engagementScore,
      risk: riskProfile,
      activities: recentActivities,
      contributions: contributionData[0]?.totalContributions as any,
      proposals: proposalsCreated,
    });

    // Create analysis record
    const analysisTimestamp = new Date();

    res.json({
      success: true,
      analysis: {
        timestamp: analysisTimestamp.toISOString(),
        analyzedBy: elderId,
        targetUserId,
        userProfile: {
          name: `${targetUser.firstName} ${targetUser.lastName}`,
          username: targetUser.username,
          email: targetUser.email,
          joinedAt: targetUser.createdAt,
          role: targetUser.roles,
          reputationScore: parseFloat(targetUser.reputationScore?.toString() || '0'),
        },
        activityMetrics: {
          recentActivities: recentActivities.length,
          monthlyContributions: parseFloat(monthlyContributions[0]?.monthlyContributions?.toString() || '0'),
          totalContributions: parseFloat(contributionData[0]?.totalContributions?.toString() || '0'),
          contributionCount: contributionData[0]?.count || 0,
          monthlyContributionCount: monthlyContributions[0]?.count || 0,
          followers: followersCount[0]?.count || 0,
          following: followingCount[0]?.count || 0,
          proposalsCreated: proposalsCreated.length,
          votesParticipated: votesParticipated[0]?.count || 0,
          vaults: userVaults.length,
        },
        engagementScore,
        riskProfile,
        recentActivity: recentActivities.slice(0, 10).map(a => ({
          action: a.action,
          timestamp: a.createdAt,
          metadata: a.metadata,
        })),
        insights,
      },
      metadata: {
        analysisType: 'comprehensive_user_analysis',
        dataPoints: 12,
        riskLevel: riskProfile.riskLevel,
        trustScore: riskProfile.trustScore,
      }
    });

    // Log the analysis
    try {
      await db.insert(userActivities).values({
        userId: elderId,
        action: 'elder_user_analysis',
        metadata: JSON.stringify({
          targetUserId,
          engagementScore: engagementScore.score,
          riskLevel: riskProfile.riskLevel,
        }),
      });
    } catch (logError) {
      logger.error('Failed to log analysis', logError);
    }

  } catch (error) {
    logger.error('Error analyzing user', error);
    res.status(500).json({ 
      error: 'Failed to analyze user',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/elder/user-insights/:targetUserId - Quick insights
router.get('/user-insights/:targetUserId', authenticate, requireElder, async (req, res) => {
  try {
    const { targetUserId } = req.params;

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        reputationScore: true,
        createdAt: true,
        roles: true,
      }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Quick metrics
    const recentActivityCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userActivities)
      .where(
        and(
          eq(userActivities.userId, targetUserId),
          gte(userActivities.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      );

    const proposalCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(proposals)
      .where(eq(proposals.creatorId, targetUserId));

    const vaultCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(vaults)
      .where(eq(vaults.userId, targetUserId));

    res.json({
      success: true,
      insights: {
        user: targetUser,
        quickMetrics: {
          recentActivityLastWeek: recentActivityCount[0]?.count || 0,
          proposalsCreated: proposalCount[0]?.count || 0,
          vaultsCreated: vaultCount[0]?.count || 0,
          daysSinceJoin: Math.floor((Date.now() - new Date(targetUser.createdAt || Date.now()).getTime()) / (24 * 60 * 60 * 1000)),
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching user insights', error);
    res.status(500).json({ error: 'Failed to fetch user insights' });
  }
});

// Helper functions
function calculateEngagementScore(metrics: any): { score: number; level: string } {
  const {
    recentActivityCount = 0,
    monthlyContributions = 0,
    followersCount = 0,
    proposalsCreated = 0,
    votesParticipated = 0,
    daysActive = 1
  } = metrics;

  // Weighted scoring
  const activityScore = Math.min(recentActivityCount * 5, 25);
  const contributionScore = Math.min(monthlyContributions / 100, 25);
  const socialScore = Math.min((followersCount + proposalsCreated * 2 + votesParticipated) / 10, 25);
  const consistencyScore = Math.min(daysActive / 365 * 25, 25);

  const score = activityScore + contributionScore + socialScore + consistencyScore;

  let level: string;
  if (score >= 90) level = 'exceptional';
  else if (score >= 70) level = 'high';
  else if (score >= 50) level = 'moderate';
  else if (score >= 30) level = 'low';
  else level = 'minimal';

  return { score: Math.round(score), level };
}

function analyzeRiskProfile(metrics: any): any {
  const {
    reputationScore = 0,
    accountAge = 0,
    contributionValue = 0,
    activityFrequency = 0,
    kyc = false
  } = metrics;

  let riskScore = 100; // Start at 100, subtract for positive indicators

  // Account age - older is lower risk
  if (accountAge > 365) riskScore -= 15;
  else if (accountAge > 180) riskScore -= 10;
  else if (accountAge > 30) riskScore -= 5;

  // Contribution value - higher contributions lower risk
  if (contributionValue > 10000) riskScore -= 20;
  else if (contributionValue > 1000) riskScore -= 15;
  else if (contributionValue > 100) riskScore -= 10;

  // Reputation score
  if (reputationScore > 1000) riskScore -= 15;
  else if (reputationScore > 500) riskScore -= 10;
  else if (reputationScore > 100) riskScore -= 5;

  // Activity frequency
  if (activityFrequency > 10) riskScore -= 10;
  else if (activityFrequency > 5) riskScore -= 5;

  // KYC verification
  if (kyc) riskScore -= 10;

  riskScore = Math.max(0, Math.min(100, riskScore));

  let riskLevel: string;
  if (riskScore <= 20) riskLevel = 'low';
  else if (riskScore <= 40) riskLevel = 'moderate';
  else if (riskScore <= 70) riskLevel = 'high';
  else riskLevel = 'critical';

  return {
    riskScore: Math.round(riskScore),
    riskLevel,
    trustScore: 100 - Math.round(riskScore),
    flags: generateRiskFlags(riskScore, accountAge, reputationScore),
  };
}

function generateRiskFlags(riskScore: number, accountAge: number, reputationScore: number): string[] {
  const flags: string[] = [];

  if (riskScore > 70) flags.push('High risk profile');
  if (accountAge < 30) flags.push('New account');
  if (reputationScore < 50) flags.push('Low reputation');

  return flags;
}

function generateInsights(data: any): string[] {
  const insights: string[] = [];
  const { user, engagement, risk, activities, contributions, proposals } = data;

  // Engagement insights
  if (engagement.level === 'exceptional') {
    insights.push('🌟 Highly engaged community member with consistent activity');
  } else if (engagement.level === 'minimal') {
    insights.push('⚠️ Limited engagement - new or inactive user');
  }

  // Risk insights
  if (risk.riskLevel === 'critical') {
    insights.push('🚨 Critical risk level - recommend verification');
  } else if (risk.riskLevel === 'low') {
    insights.push('✅ Low risk profile - trusted member');
  }

  // Contribution insights
  if (contributions > 5000) {
    insights.push('💰 Major contributor with significant financial commitment');
  } else if (contributions > 0) {
    insights.push('📈 Active contributor to the community');
  }

  // Proposal insights
  if (proposals.length > 0) {
    insights.push(`📋 Created ${proposals.length} proposal(s) - leadership potential`);
  }

  // Reputation insights
  const reputationScore = parseFloat(user.reputationScore?.toString() || '0');
  if (reputationScore > 500) {
    insights.push('🏆 Established reputation within community');
  }

  return insights;
}

export default router;
