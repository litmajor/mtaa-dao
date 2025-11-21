import { Request, Response } from 'express';
import { db } from '../db';
import { daoInvitations, daoMemberships, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const logger = new Logger('invitation-service');

// Email service (integrate with your email provider)
import nodemailer from 'nodemailer';

const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Generate a secure invite token
 */
function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create an invitation for a DAO member
 */
export async function createInvitation(
  daoId: string,
  invitedBy: string,
  invitedEmail?: string,
  invitedPhone?: string,
  recipientUserId?: string,
  role: string = 'member',
  isPeerInvite: boolean = false
) {
  try {
    if (!invitedEmail && !invitedPhone && !recipientUserId) {
      throw new Error('Must provide email, phone, or recipient user ID');
    }

    const inviteLink = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    const [invitation] = await db
      .insert(daoInvitations)
      .values({
        id: uuidv4(),
        daoId,
        invitedBy,
        invitedEmail,
        invitedPhone,
        recipientUserId,
        role,
        inviteLink,
        status: 'pending',
        expiresAt,
        isPeerInvite,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    logger.info(`Invitation created: ${invitation.id} for ${invitedEmail || invitedPhone}`);
    return invitation;
  } catch (err) {
    logger.error(`Error creating invitation: ${err}`);
    throw err;
  }
}

/**
 * Send invitation email
 */
export async function sendInvitationEmail(
  invitationId: string,
  daoName: string,
  inviterName: string,
  appBaseUrl: string
) {
  try {
    const invitation = await db
      .select()
      .from(daoInvitations)
      .where(eq(daoInvitations.id, invitationId))
      .then(rows => rows[0]);

    if (!invitation || !invitation.invitedEmail) {
      throw new Error('Invitation not found or no email address');
    }

    const inviteUrl = `${appBaseUrl}/invite/${invitation.inviteLink}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You're invited to join "${daoName}"! 🎉</h2>
        
        <p>Hi there,</p>
        
        <p><strong>${inviterName}</strong> has invited you to join <strong>"${daoName}"</strong> DAO.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>${daoName}</h3>
          <p><strong>Role:</strong> ${invitation.role}</p>
          <p><strong>Type:</strong> Community-Managed Fund</p>
          <p>Join and start collaborating with your community today!</p>
        </div>
        
        <p>
          <a href="${inviteUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Accept Invite
          </a>
        </p>
        
        <p style="color: #666; font-size: 12px;">
          This invite link expires in 30 days.<br>
          If you don't recognize this invitation, you can safely ignore this email.
        </p>
      </div>
    `;

    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || 'noreply@mtaa.app',
      to: invitation.invitedEmail,
      subject: `${inviterName} invited you to join ${daoName}`,
      html: htmlContent
    });

    logger.info(`Invitation email sent to ${invitation.invitedEmail}`);
  } catch (err) {
    logger.error(`Error sending invitation email: ${err}`);
    // Don't throw - invitation still created, just email failed
  }
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  inviteToken: string,
  userId: string
) {
  try {
    const invitation = await db
      .select()
      .from(daoInvitations)
      .where(eq(daoInvitations.inviteLink, inviteToken))
      .then(rows => rows[0]);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation already ${invitation.status}`);
    }

    if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
      throw new Error('Invitation has expired');
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

    logger.info(`Invitation accepted: ${invitation.id}, User: ${userId}`);
    return membership;
  } catch (err) {
    logger.error(`Error accepting invitation: ${err}`);
    throw err;
  }
}

/**
 * Reject an invitation
 */
export async function rejectInvitation(
  inviteToken: string,
  rejectionReason?: string
) {
  try {
    const invitation = await db
      .select()
      .from(daoInvitations)
      .where(eq(daoInvitations.inviteLink, inviteToken))
      .then(rows => rows[0]);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation already ${invitation.status}`);
    }

    await db
      .update(daoInvitations)
      .set({
        status: 'rejected',
        rejectedAt: new Date(),
        rejectionReason,
        updatedAt: new Date()
      })
      .where(eq(daoInvitations.id, invitation.id));

    logger.info(`Invitation rejected: ${invitation.id}`);
  } catch (err) {
    logger.error(`Error rejecting invitation: ${err}`);
    throw err;
  }
}

/**
 * Get pending invitations for a user
 */
export async function getPendingInvitations(userId: string) {
  try {
    const invitations = await db
      .select()
      .from(daoInvitations)
      .where(
        and(
          eq(daoInvitations.recipientUserId, userId),
          eq(daoInvitations.status, 'pending')
        )
      );

    return invitations;
  } catch (err) {
    logger.error(`Error getting pending invitations: ${err}`);
    throw err;
  }
}

/**
 * Get all invitations for a DAO
 */
export async function getDaoInvitations(daoId: string) {
  try {
    const invitations = await db
      .select()
      .from(daoInvitations)
      .where(eq(daoInvitations.daoId, daoId));

    return invitations;
  } catch (err) {
    logger.error(`Error getting DAO invitations: ${err}`);
    throw err;
  }
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(invitationId: string) {
  try {
    await db
      .update(daoInvitations)
      .set({
        status: 'revoked',
        updatedAt: new Date()
      })
      .where(eq(daoInvitations.id, invitationId));

    logger.info(`Invitation revoked: ${invitationId}`);
  } catch (err) {
    logger.error(`Error revoking invitation: ${err}`);
    throw err;
  }
}

/**
 * Generate a peer invite link for an existing member
 */
export async function generatePeerInviteLink(daoId: string, userId: string): Promise<string> {
  try {
    // Verify user is a member of the DAO
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.daoId, daoId)
        )
      )
      .then(rows => rows[0]);

    if (!membership) {
      throw new Error('User is not a member of this DAO');
    }

    const peerInviteToken = generateInviteToken();
    const baseUrl = process.env.APP_BASE_URL || 'https://app.mtaa.com';
    const peerInviteLink = `${baseUrl}/invite/peer/${peerInviteToken}`;

    // Store for tracking
    const [invitation] = await db
      .insert(daoInvitations)
      .values({
        id: uuidv4(),
        daoId,
        invitedBy: userId,
        inviteLink: peerInviteToken,
        status: 'pending',
        isPeerInvite: true,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    logger.info(`Peer invite link generated for DAO ${daoId}, by user ${userId}`);
    return peerInviteLink;
  } catch (err) {
    logger.error(`Error generating peer invite link: ${err}`);
    throw err;
  }
}

// ============================================
// API HANDLERS
// ============================================

/**
 * Handler: POST /api/dao/:daoId/invitations
 * Create invitation for new member
 */
export async function createInvitationHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const { invitedEmail, invitedPhone, role = 'member' } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const invitation = await createInvitation(
      daoId,
      userId,
      invitedEmail,
      invitedPhone,
      undefined,
      role,
      false
    );

    // Send email if provided
    if (invitedEmail) {
      const inviterUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .then(rows => rows[0]);

      const daoRecord = await db
        .select()
        .from(daoInvitations as any)
        .then(rows => rows[0]); // Get DAO name

      const appBaseUrl = process.env.APP_BASE_URL || 'https://app.mtaa.com';
      await sendInvitationEmail(
        invitation.id,
        'Your DAO', // TODO: get actual DAO name
        inviterUser?.username || 'A community member',
        appBaseUrl
      );
    }

    res.json(invitation);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
}

/**
 * Handler: GET /api/invitations/pending
 * Get pending invitations for current user
 */
export async function getPendingInvitationsHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const invitations = await getPendingInvitations(userId);
    res.json(invitations);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to get pending invitations' });
  }
}

/**
 * Handler: POST /api/invitations/:inviteToken/accept
 * Accept an invitation
 */
export async function acceptInvitationHandler(req: Request, res: Response) {
  try {
    const { inviteToken } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const membership = await acceptInvitation(inviteToken, userId);
    res.json({ status: 'accepted', membership });
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to accept invitation' });
  }
}

/**
 * Handler: POST /api/invitations/:inviteToken/reject
 * Reject an invitation
 */
export async function rejectInvitationHandler(req: Request, res: Response) {
  try {
    const { inviteToken } = req.params;
    const { reason } = req.body;

    await rejectInvitation(inviteToken, reason);
    res.json({ status: 'rejected' });
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to reject invitation' });
  }
}

/**
 * Handler: GET /api/dao/:daoId/peer-invite-link
 * Generate peer invite link for current user
 */
export async function getPeerInviteLinkHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const peerInviteLink = await generatePeerInviteLink(daoId, userId);
    res.json({ peerInviteLink });
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to generate peer invite link' });
  }
}

/**
 * Handler: GET /api/dao/:daoId/invitations
 * Get all invitations for a DAO
 */
export async function getDaoInvitationsHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const invitations = await getDaoInvitations(daoId);
    res.json(invitations);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to get DAO invitations' });
  }
}

/**
 * Handler: DELETE /api/dao/:daoId/invitations/:invitationId
 * Revoke an invitation
 */
export async function revokeInvitationHandler(req: Request, res: Response) {
  try {
    const { invitationId } = req.params;
    await revokeInvitation(invitationId);
    res.json({ status: 'revoked' });
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
}
