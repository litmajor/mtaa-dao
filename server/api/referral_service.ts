/**
 * Enhanced Invitation Service with Referral Validation
 * 
 * Key Changes:
 * - Only award referral rewards after user completes signup AND acceptance
 * - Track pending vs confirmed invitations separately
 * - Implement invite-to-signup conversion tracking
 * - Add referral analytics
 */

import { db } from '../db';
import { daoInvitations, daoMemberships, referralRewards, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';

// ============================================
// TYPES
// ============================================

export interface ReferralStatus {
  invitationSent: boolean;
  invitationAccepted: boolean;
  userSignedUp: boolean;
  rewardAwarded: boolean;
  rewardAmount?: number;
  statusTimestamp: Date;
}

// ============================================
// ENHANCED INVITATION TRACKING
// ============================================

/**
 * Create invitation with referral tracking (NO REWARDS YET)
 * Rewards are only awarded after user signs up AND accepts
 */
export async function createInvitationWithTracking(
  daoId: string,
  referrerId: string,
  email?: string,
  phone?: string,
  role: string = 'member'
) {
  try {
    const inviteToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    // Check if user already exists (early detection)
    const existingUser = email
      ? await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .then((rows: any[]) => rows[0])
      : null;

    const [invitation] = await db
      .insert(daoInvitations)
      .values({
        daoId,
        invitedEmail: email,
        invitedPhone: phone,
        role,
        status: 'pending',
        inviteLink: inviteToken,
        expiresAt,
        isPeerInvite: false,
        referrerId,
        invitationSentAt: new Date(),
        userExistedAtInvite: !!existingUser,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return {
      invitation,
      userAlreadyExists: !!existingUser
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Accept invitation - UPDATE referral status
 * This is when user accepts, but rewards only given after signup
 */
export async function acceptInvitationWithReferral(
  inviteToken: string,
  userId: string
) {
  try {
    const invitation = await db
      .select()
      .from(daoInvitations)
      .where(eq(daoInvitations.inviteLink, inviteToken))
      .then((rows: any[]) => rows[0]);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation already ${invitation.status}`);
    }

    if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
      throw new Error('Invitation has expired');
    }

    // Get user to verify they completed signup
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .then((rows: any[]) => rows[0]);

    if (!user) {
      throw new Error('User not found - must complete signup first');
    }

    // Update invitation status
    await db
      .update(daoInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        recipientUserId: userId,
        updatedAt: new Date()
      })
      .where(eq(daoInvitations.id, invitation.id));

    // Create DAO membership
    const [membership] = await db
      .insert(daoMemberships)
      .values({
        id: uuidv4(),
        userId,
        daoId: invitation.daoId,
        role: invitation.role,
        status: 'approved',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // NOW award referral rewards (only if user completed signup)
    if (invitation.referrerId && user.createdAt) {
      await awardReferralReward(
        invitation.daoId,
        invitation.referrerId,
        userId,
        'invitation_accepted'
      );
    }

    return membership;
  } catch (err) {
    throw err;
  }
}

/**
 * Award referral reward - ONLY called after user is fully verified
 */
async function awardReferralReward(
  daoId: string,
  referrerId: string,
  newUserId: string,
  rewardType: 'invitation_accepted' | 'first_contribution' | 'milestone'
) {
  try {
    // Verify both users exist
    const referrer = await db
      .select()
      .from(users)
      .where(eq(users.id, referrerId))
      .then((rows: any[]) => rows[0]);

    const newUser = await db
      .select()
      .from(users)
      .where(eq(users.id, newUserId))
      .then((rows: any[]) => rows[0]);

    if (!referrer || !newUser) {
      throw new Error('Invalid referrer or new user');
    }

    // Determine reward amount based on type with tiered calculation
    const rewardAmount = await calculateRewardAmount(rewardType, daoId, newUserId);

    // Record referral reward
    const [reward] = await db
      .insert(referralRewards)
      .values({
        id: uuidv4(),
        referrerId,
        referredUserId: newUserId,
        daoId,
        rewardAmount: rewardAmount.toString(),
        rewardType,
        status: 'awarded',
        awardedAt: new Date(),
        claimed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return reward;
  } catch (err) {
    throw err;
  }
}

/**
 * Get referral status for an invitation
 */
export async function getReferralStatus(
  invitationId: string
): Promise<ReferralStatus> {
  try {
    const invitation = await db
      .select()
      .from(daoInvitations)
      .where(eq(daoInvitations.id, invitationId))
      .then(rows => rows[0]);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // Check if reward exists
    const reward = invitation.referrerId
      ? await db
          .select()
          .from(referralRewards)
          .where(
            and(
              eq(referralRewards.referrerId, invitation.referrerId),
              eq(referralRewards.daoId, invitation.daoId)
            )
          )
          .then(rows => rows[0])
      : null;

    return {
      invitationSent: !!invitation.invitationSentAt,
      invitationAccepted: invitation.status === 'accepted',
      userSignedUp: !!invitation.recipientUserId,
      rewardAwarded: !!reward,
      rewardAmount: reward ? parseFloat(reward.rewardAmount?.toString() || '0') : undefined,
      statusTimestamp: invitation.updatedAt || new Date()
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Get referral analytics for a user
 */
export async function getUserReferralAnalytics(userId: string) {
  try {
    // Get all invitations sent by this user
    const sentInvitations = await db
      .select()
      .from(daoInvitations)
      .where(eq(daoInvitations.referrerId, userId));

    // Get all referral rewards
    const rewards = await db
      .select()
      .from(referralRewards)
      .where(eq(referralRewards.referrerId, userId));

    // Calculate stats
    const stats = {
      totalInvitationsSent: sentInvitations.length,
      invitationsAccepted: sentInvitations.filter(i => i.status === 'accepted').length,
      invitationsPending: sentInvitations.filter(i => i.status === 'pending').length,
      invitationsExpired: sentInvitations.filter(i => i.status === 'expired').length,
      invitationsRejected: sentInvitations.filter(i => i.status === 'rejected').length,
      totalRewardsAwarded: rewards.length,
      totalRewardAmount: rewards.reduce((sum, r) => sum + parseFloat(r.rewardAmount?.toString() || '0'), 0),
      conversionRate: sentInvitations.length > 0
        ? (sentInvitations.filter(i => i.status === 'accepted').length / sentInvitations.length) * 100
        : 0,
      rewardsByType: {
        invitationAccepted: rewards.filter(r => r.rewardType === 'invitation_accepted').length,
        firstContribution: rewards.filter(r => r.rewardType === 'first_contribution').length,
        milestone: rewards.filter(r => r.rewardType === 'milestone').length
      }
    };

    return {
      stats,
      recentInvitations: sentInvitations.slice(0, 10),
      recentRewards: rewards.slice(0, 10)
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Validate referral eligibility
 */
export async function validateReferralEligibility(
  referrerId: string,
  email: string
): Promise<{
  isEligible: boolean;
  reason?: string;
  userExists?: boolean;
}> {
  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .then(rows => rows[0]);

    if (existingUser) {
      return {
        isEligible: false,
        reason: 'User already exists - no referral reward available',
        userExists: true
      };
    }

    // Check referrer status
    const referrer = await db
      .select()
      .from(users)
      .where(eq(users.id, referrerId))
      .then(rows => rows[0]);

    if (!referrer) {
      return {
        isEligible: false,
        reason: 'Referrer not found',
        userExists: false
      };
    }

    // Check for duplicate pending invitations
    const pendingInvite = await db
      .select()
      .from(daoInvitations)
      .where(
        and(
          eq(daoInvitations.invitedEmail, email),
          eq(daoInvitations.status, 'pending')
        )
      )
      .then(rows => rows[0]);

    if (pendingInvite) {
      return {
        isEligible: false,
        reason: 'Invitation already sent to this email',
        userExists: false
      };
    }

    return {
      isEligible: true,
      userExists: false
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Calculate reward amount based on DAO maturity, contribution level, and reward type
 */
async function calculateRewardAmount(
  rewardType: string, 
  daoId: string,
  referredUserId?: string
): Promise<number> {
  // Get DAO age to determine maturity tier
  const dao = await db
    .select()
    .from(daos)
    .where(eq(daos.id, daoId))
    .then(rows => rows[0]);

  if (!dao) return 0;

  const daoAge = Date.now() - new Date(dao.createdAt).getTime();
  const monthsOld = daoAge / (1000 * 60 * 60 * 24 * 30);

  // Base amounts by reward type
  const baseRewardMap: { [key: string]: number } = {
    invitation_accepted: 20,
    first_contribution: 50,
    milestone: 100
  };

  let baseReward = baseRewardMap[rewardType] || 0;

  // TIER 1: DAO Maturity Multiplier
  let maturityMultiplier = 1.0;
  if (monthsOld < 3) {
    maturityMultiplier = 1.5; // 50% bonus for new DAOs (0-3 months)
  } else if (monthsOld < 6) {
    maturityMultiplier = 1.2; // 20% bonus for growing DAOs (3-6 months)
  } else if (monthsOld < 12) {
    maturityMultiplier = 1.0; // Standard for maturing DAOs (6-12 months)
  } else {
    maturityMultiplier = 0.7; // 30% reduction for mature DAOs (1+ years)
  }

  // TIER 2: Contribution-based bonus (if user has contributed)
  let contributionMultiplier = 1.0;
  if (referredUserId && rewardType === 'first_contribution') {
    const totalContributed = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${contributions.amount} AS NUMERIC)), 0)` })
      .from(contributions)
      .where(eq(contributions.userId, referredUserId));

    const contributionAmount = Number(totalContributed[0]?.total || 0);

    if (contributionAmount >= 10000) {
      contributionMultiplier = 1.5; // 10% of contribution for whales ($10K+)
    } else if (contributionAmount >= 1000) {
      contributionMultiplier = 1.3; // 7.5% for major contributors ($1K+)
    } else if (contributionAmount >= 100) {
      contributionMultiplier = 1.15; // 5% for regular contributors ($100+)
    }
  }

  // TIER 3: Longevity bonus (if user stayed active)
  let longevityMultiplier = 1.0;
  if (referredUserId && rewardType === 'milestone') {
    const userJoinDate = await db
      .select()
      .from(users)
      .where(eq(users.id, referredUserId))
      .then(rows => rows[0]?.createdAt);


/**
 * Ping an inactive referred user to encourage re-engagement
 */
export async function pingInactiveReferral(
  referrerId: string,
  referredUserId: string,
  daoId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Verify referrer is the one who invited this user
    const invitation = await db
      .select()
      .from(daoInvitations)
      .where(
        and(
          eq(daoInvitations.referrerId, referrerId),
          eq(daoInvitations.recipientUserId, referredUserId),
          eq(daoInvitations.daoId, daoId),
          eq(daoInvitations.status, 'accepted')
        )
      )
      .then(rows => rows[0]);

    if (!invitation) {
      return {
        success: false,
        message: 'You did not refer this user or they have not accepted'
      };
    }

    // Check if user is actually inactive (no activity in last 30 days)
    const lastActivity = await db
      .select()
      .from(userActivities)
      .where(eq(userActivities.userId, referredUserId))
      .orderBy(sql`${userActivities.createdAt} DESC`)
      .limit(1)
      .then(rows => rows[0]);

    const daysSinceActivity = lastActivity
      ? (Date.now() - new Date(lastActivity.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    if (daysSinceActivity < 30) {
      return {
        success: false,
        message: 'User has been active recently (within last 30 days)'
      };
    }

    // Check ping rate limit (max once per 7 days per user)
    const recentPings = await db
      .select()
      .from(notificationHistory)
      .where(
        and(
          eq(notificationHistory.userId, referredUserId),
          eq(notificationHistory.type, 'referral_ping'),
          sql`${notificationHistory.createdAt} > NOW() - INTERVAL '7 days'`
        )
      );

    if (recentPings.length > 0) {
      return {
        success: false,
        message: 'User was already pinged recently. Please wait 7 days between pings.'
      };
    }

    // Get referred user details
    const referredUser = await db
      .select()
      .from(users)
      .where(eq(users.id, referredUserId))
      .then(rows => rows[0]);

    const referrer = await db
      .select()
      .from(users)
      .where(eq(users.id, referrerId))
      .then(rows => rows[0]);

    const dao = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .then(rows => rows[0]);

    if (!referredUser || !referrer || !dao) {
      return {
        success: false,
        message: 'User, referrer, or DAO not found'
      };
    }

    // Send notification to inactive user
    await db.insert(notificationHistory).values({
      userId: referredUserId,
      type: 'referral_ping',
      title: `${referrer.username || referrer.email} is missing you!`,
      message: `Hey! ${referrer.username || referrer.email} invited you to ${dao.name} and noticed you haven't been active lately. Come back and see what's new! The community would love to have you back.`,
      metadata: {
        referrerId,
        daoId,
        pingType: 'inactive_reminder',
        daysSinceLastActivity: Math.floor(daysSinceActivity)
      },
      createdAt: new Date()
    });

    // Also send email if available
    if (referredUser.email) {
      // TODO: Integrate with email service
      console.log(`📧 Sending re-engagement email to ${referredUser.email}`);
    }

    return {
      success: true,
      message: `Successfully pinged ${referredUser.username || referredUser.email}. They will receive a notification encouraging them to return.`
    };
  } catch (err) {
    console.error('Error pinging inactive referral:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to ping user'
    };
  }
}

/**
 * Handler: POST /api/referrals/ping-inactive
 */
export async function pingInactiveReferralHandler(req: Request, res: Response) {
  try {
    const referrerId = (req as any).user?.id;
    if (!referrerId) return res.status(401).json({ error: 'Unauthorized' });

    const { referredUserId, daoId } = req.body as any;

    if (!referredUserId || !daoId) {
      return res.status(400).json({ error: 'Missing referredUserId or daoId' });
    }

    const result = await pingInactiveReferral(referrerId, referredUserId, daoId);

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err instanceof Error ? err.message : 'Failed to ping user' 
    });
  }
}


    if (userJoinDate) {
      const userAge = Date.now() - new Date(userJoinDate).getTime();
      const userMonths = userAge / (1000 * 60 * 60 * 24 * 30);

      if (userMonths >= 12) {
        longevityMultiplier = 2.0; // 2x for 1+ year members
      } else if (userMonths >= 6) {
        longevityMultiplier = 1.5; // 1.5x for 6+ month members
      } else if (userMonths >= 1) {
        longevityMultiplier = 1.2; // 1.2x for 1+ month members
      }
    }
  }

  const finalReward = baseReward * maturityMultiplier * contributionMultiplier * longevityMultiplier;
  return Math.round(finalReward * 100) / 100; // Round to 2 decimals
}

/**
 * Handler: POST /api/referrals/validate
 * Check if referral is eligible before sending
 */
export async function validateReferralHandler(req: Request, res: Response) {
  try {
    const { referrerId, email } = req.body as any;

    const eligibility = await validateReferralEligibility(referrerId, email);
    res.json(eligibility);
  } catch (err) {
    res.status(400).json({
      isEligible: false,
      reason: err instanceof Error ? err.message : 'Validation failed'
    });
  }
}

/**
 * Handler: GET /api/referrals/analytics
 * Get referral analytics for current user
 */
export async function getReferralAnalyticsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const analytics = await getUserReferralAnalytics(userId);
    res.json(analytics);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to get analytics' });
  }
}

/**
 * Handler: GET /api/referrals/status/:invitationId
 * Get referral status for specific invitation
 */
export async function getReferralStatusHandler(req: Request, res: Response) {
  try {
    const { invitationId } = req.params;
    const status = await getReferralStatus(invitationId);
    res.json(status);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to get status' });
  }
}

export default {
  createInvitationWithTracking,
  acceptInvitationWithReferral,
  getReferralStatus,
  getUserReferralAnalytics,
  validateReferralEligibility,
  validateReferralHandler,
  getReferralAnalyticsHandler,
  getReferralStatusHandler
};
