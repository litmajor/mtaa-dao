/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO Members Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DAO-scoped member management with:
 * - Member list and discovery
 * - Invite generation and acceptance
 * - Join/leave operations
 * - Role management
 * - Member status tracking
 *
 * Base Path: /api/v1/daos/:daoId/members
 * Parent ensures: isAuthenticated, validateDaoId
 *
 * Migration Sources:
 * - /api/daos/:id/invite → /api/v1/daos/:daoId/members/invite
 * - /api/daos/:id/join-by-invite → /api/v1/daos/:daoId/members/join-by-invite
 * - /api/daos/:id/join → /api/v1/daos/:daoId/members/join
 * - /api/daos/:id/leave → /api/v1/daos/:daoId/members/leave
 * - /api/daos/:id[member count] → /api/v1/daos/:daoId/members (GET)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, Router } from 'express';
import { db } from '../../../../storage';
import { logger } from '../../../../utils/logger';
import { daoMemberships, daoInvites, daos, users } from '../../../../../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import crypto from 'crypto';

interface MembersParams {
  daoId: string;
  userId?: string;
  inviteId?: string;
}

type MembersRequest = Request<MembersParams>;

const router: Router = express.Router({ mergeParams: true });

// Helper to get userId with proper type narrowing
function getUserId(req: any): string | null {
  return (req.user as any)?.id || (req.user as any)?.claims?.sub || null;
}

// ════════════════════════════════════════════════════════════════════════════════
// MEMBERS - LIST & DISCOVERY
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/members
 * List all members of the DAO
 */
router.get('/', async (req: MembersRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const { limit = 50, offset = 0, role } = req.query;

    let conditions: any[] = [eq(daoMemberships.daoId, daoId)];
    
    if (role) {
      conditions.push(eq(daoMemberships.role, String(role)));
    }

    // Get total count
    const totalMembers = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(daoMemberships)
      .where(and(...conditions))
      .then(rows => Number(rows[0]?.count || 0));

    // Get paginated members with user details
    const members = await db
      .select({
        id: daoMemberships.id,
        userId: daoMemberships.userId,
        daoId: daoMemberships.daoId,
        role: daoMemberships.role,
        joinedAt: daoMemberships.joinedAt,
        status: daoMemberships.status,
        userName: users.username,
        userEmail: users.email,
        profileImageUrl: users.profileImageUrl,
      })
      .from(daoMemberships)
      .leftJoin(users, eq(daoMemberships.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(daoMemberships.joinedAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({
      success: true,
      data: members,
      pagination: {
        total: totalMembers,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < totalMembers
      }
    });
  } catch (error: any) {
    logger.error(`Error fetching members for DAO ${req.params.daoId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/daos/:daoId/members/:userId
 * Get specific member details
 */
router.get('/:userId', async (req: MembersRequest, res: Response) => {
  try {
    const { daoId, userId } = req.params as MembersParams & { userId: string };

    const member = await db
      .select({
        id: daoMemberships.id,
        userId: daoMemberships.userId,
        daoId: daoMemberships.daoId,
        role: daoMemberships.role,
        joinedAt: daoMemberships.joinedAt,
        status: daoMemberships.status,
        userName: users.username,
        userEmail: users.email,
        profileImageUrl: users.profileImageUrl,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(daoMemberships)
      .leftJoin(users, eq(daoMemberships.userId, users.id))
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!member.length) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    res.json({ success: true, data: member[0] });
  } catch (error: any) {
    logger.error(`Error fetching member details:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// MEMBERS - JOIN OPERATIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/daos/:daoId/members/join
 * Join a DAO directly
 */
router.post('/join', async (req: MembersRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if DAO exists
    const dao = await db.select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check if already a member
    const existingMembership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (existingMembership.length) {
      return res.status(400).json({ error: 'Already a member of this DAO' });
    }

    // Add user as member
    const [newMembership] = await db.insert(daoMemberships).values({
      daoId,
      userId,
      role: 'member',
      joinedAt: new Date(),
      status: 'approved',
    }).returning();

    res.status(201).json({
      success: true,
      message: 'Successfully joined the DAO',
      data: newMembership
    });
  } catch (error: any) {
    logger.error(`Error joining DAO:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/daos/:daoId/members/leave
 * Leave a DAO
 */
router.post('/leave', async (req: MembersRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if DAO exists
    const dao = await db.select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check if founder (cannot leave own DAO)
    if (dao[0].founderId === userId) {
      return res.status(400).json({
        error: 'Founders cannot leave their own DAO. Transfer ownership first.'
      });
    }

    // Check if member
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership.length) {
      return res.status(400).json({ error: 'Not a member of this DAO' });
    }

    // Remove membership
    await db.delete(daoMemberships).where(
      and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      )
    );

    res.json({
      success: true,
      message: 'Successfully left the DAO'
    });
  } catch (error: any) {
    logger.error(`Error leaving DAO:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// MEMBERS - INVITES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/daos/:daoId/members/invite
 * Generate an invite token for the DAO
 */
router.post('/invite', async (req: MembersRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if DAO exists
    const dao = await db.select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Verify inviter is a member with permission
    const inviterMembership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    const allowedRoles = ['admin', 'elder', 'creator'];
    if (!inviterMembership.length || !allowedRoles.includes(inviterMembership[0].role || '')) {
      return res.status(403).json({
        error: 'You do not have permission to invite members to this DAO'
      });
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h expiry

    // Store invite
    const [invite] = await db.insert(daoInvites).values({
      dao_id: daoId,
      inviter_id: userId,
      token,
      expires_at: expiresAt,
      created_at: new Date(),
    }).returning();

    res.status(201).json({
      success: true,
      data: {
        inviteId: invite.id,
        token,
        inviteUrl: `https://app.dao/invite/${daoId}?token=${token}`,
        expiresAt,
      }
    });
  } catch (error: any) {
    logger.error(`Error generating invite token:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/daos/:daoId/members/join-by-invite
 * Join DAO via invite token
 */
router.post('/join-by-invite', async (req: MembersRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = getUserId(req);
    const { token } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!token) {
      return res.status(400).json({ error: 'Invite token is required' });
    }

    // Find invite
    const invite = await db.select()
      .from(daoInvites)
      .where(and(
        eq(daoInvites.token, token),
        eq(daoInvites.dao_id, daoId)
      ))
      .limit(1);

    if (!invite.length) {
      return res.status(400).json({ error: 'Invalid or expired invite token' });
    }

    const inviteData = invite[0];

    // Check expiry
    if (new Date(inviteData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invite token expired' });
    }

    // Check if already used
    if (inviteData.used) {
      return res.status(400).json({ error: 'Invite token already used' });
    }

    // Check if already a member
    const existingMembership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (existingMembership.length) {
      return res.status(400).json({ error: 'You are already a member of this DAO' });
    }

    // Add user as member
    const [membership] = await db.insert(daoMemberships).values({
      daoId,
      userId,
      role: 'member',
      joinedAt: new Date(),
      status: 'approved',
    }).returning();

    // Mark invite as used
    await db.update(daoInvites)
      .set({ used: true })
      .where(eq(daoInvites.id, inviteData.id));

    res.json({
      success: true,
      message: 'Successfully joined DAO via invite',
      data: membership
    });
  } catch (error: any) {
    logger.error(`Error joining via invite:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/daos/:daoId/members/invites
 * List active invites for DAO (admin only)
 */
router.get('/invites/list', async (req: MembersRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user is admin
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership.length || !['admin', 'creator'].includes(membership[0].role || '')) {
      return res.status(403).json({ error: 'You do not have permission to view invites' });
    }

    // Get active invites
    const invites = await db.select({
      id: daoInvites.id,
      daoId: daoInvites.dao_id,
      token: daoInvites.token,
      inviterId: daoInvites.inviter_id,
      used: daoInvites.used,
      expiresAt: daoInvites.expires_at,
      createdAt: daoInvites.created_at,
    })
      .from(daoInvites)
      .where(eq(daoInvites.dao_id, daoId))
      .orderBy(desc(daoInvites.created_at));

    res.json({
      success: true,
      data: invites
    });
  } catch (error: any) {
    logger.error(`Error fetching invites:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v1/daos/:daoId/members/invites/:inviteId
 * Revoke an invite (admin only)
 */
router.delete('/invites/:inviteId', async (req: MembersRequest, res: Response) => {
  try {
    const { daoId, inviteId } = req.params as MembersParams & { inviteId: string };
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user is admin
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership.length || !['admin', 'creator'].includes(membership[0].role || '')) {
      return res.status(403).json({ error: 'You do not have permission to revoke invites' });
    }

    // Get invite to verify DAO
    const invite = await db.select()
      .from(daoInvites)
      .where(eq(daoInvites.id, inviteId))
      .limit(1);

    if (!invite.length || invite[0].dao_id !== daoId) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Delete invite
    await db.delete(daoInvites).where(eq(daoInvites.id, inviteId));

    res.json({
      success: true,
      message: 'Invite revoked successfully'
    });
  } catch (error: any) {
    logger.error(`Error revoking invite:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// MEMBERS - ROLE MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

/**
 * PATCH /api/v1/daos/:daoId/members/:userId/role
 * Update member role (admin only)
 */
router.patch('/:userId/role', async (req: MembersRequest, res: Response) => {
  try {
    const { daoId, userId } = req.params as MembersParams & { userId: string };
    const requesterId = getUserId(req);
    const { role } = req.body;

    if (!requesterId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const validRoles = ['member', 'proposer', 'elder', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Verify requester is admin
    const requesterMembership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, requesterId)
      ))
      .limit(1);

    if (!requesterMembership.length || requesterMembership[0].role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to update member roles' });
    }

    // Get target member
    const targetMembership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!targetMembership.length) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Cannot demote founder
    const dao = await db.select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (dao[0].founderId === userId && role !== 'admin') {
      return res.status(400).json({ error: 'Founder must remain as admin' });
    }

    // Update role
    const [updated] = await db.update(daoMemberships)
      .set({ role, updatedAt: new Date() })
      .where(eq(daoMemberships.id, targetMembership[0].id))
      .returning();

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: updated
    });
  } catch (error: any) {
    logger.error(`Error updating member role:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v1/daos/:daoId/members/:userId
 * Remove member from DAO (admin only)
 */
router.delete('/:userId', async (req: MembersRequest, res: Response) => {
  try {
    const { daoId, userId } = req.params as MembersParams & { userId: string };
    const requesterId = getUserId(req);

    if (!requesterId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify requester is admin
    const requesterMembership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, requesterId)
      ))
      .limit(1);

    if (!requesterMembership.length || requesterMembership[0].role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to remove members' });
    }

    // Get target member
    const targetMembership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!targetMembership.length) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Cannot remove founder
    const dao = await db.select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (dao[0].founderId === userId) {
      return res.status(400).json({ error: 'Cannot remove DAO founder' });
    }

    // Remove member
    await db.delete(daoMemberships).where(eq(daoMemberships.id, targetMembership[0].id));

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error: any) {
    logger.error(`Error removing member:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
