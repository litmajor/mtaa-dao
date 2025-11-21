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

    // Determine reward amount based on type
    const rewardAmount = calculateRewardAmount(rewardType, daoId);

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
 * Calculate reward amount based on DAO config and reward type
 */
function calculateRewardAmount(rewardType: string, daoId: string): number {
  // This should be pulled from DAO settings
  // Default amounts:
  const rewardMap: { [key: string]: number } = {
    invitation_accepted: 50,
    first_contribution: 100,
    milestone: 200
  };

  return rewardMap[rewardType] || 0;
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
