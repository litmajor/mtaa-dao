import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daoMemberships, users, daos } from '../../../shared/schema';
import { eq, desc, sql, and, or, like, inArray } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logAuditEvent, AuditEventType } from '../../services/auditLogging';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

/**
 * Member Management Routes with Role-Based Access Control
 * 
 * SUPER ADMIN (Platform Admin):
 * - Can VIEW all members of any DAO
 * - Can REMOVE members (emergency only)
 * - Can VIEW member analytics
 * - CANNOT change roles directly (DAO admin does that)
 * 
 * DAO ADMIN (DAO Creator/Elder):
 * - Can manage members of their own DAO
 * - Can add/remove members
 * - Can promote/demote members
 * - Can set member permissions
 * - Limited to their own DAO
 */

// GET /api/admin/daos/:daoId/members - List members of a DAO
router.get('/daos/:daoId/members', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { page = '1', limit = '20', search = '', role = '' } = req.query;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions - Super Admin or DAO Admin
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          inArray(daoMemberships.role, ['admin', 'elder'])
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Access denied to this DAO' });
      }
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const conditions: any[] = [eq(daoMemberships.daoId, daoId)];

    if (search && typeof search === 'string' && search.trim()) {
      conditions.push(
        or(
          like(users.email, `%${search}%`),
          like(users.username, `%${search}%`)
        )
      );
    }

    if (role && typeof role === 'string' && role !== 'all') {
      conditions.push(eq(daoMemberships.role, role));
    }

    const membersList = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        role: daoMemberships.role,
        joinedAt: daoMemberships.createdAt,
        permissions: daoMemberships.permissions,
        isActive: daoMemberships.isActive,
      })
      .from(daoMemberships)
      .innerJoin(users, eq(daoMemberships.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(daoMemberships.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .innerJoin(users, eq(daoMemberships.userId, users.id))
      .where(and(...conditions));

    res.json({
      members: membersList,
      dao: {
        id: dao[0].id,
        name: dao[0].name,
      },
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / parseInt(limit as string)),
      },
      userRole,
      canManage: userRole === 'super_admin' || true, // DAO admin can manage
    });
  } catch (error) {
    logger.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// GET /api/admin/daos/:daoId/members/:memberId - Get member details
router.get('/daos/:daoId/members/:memberId', async (req: Request, res: Response) => {
  try {
    const { daoId, memberId } = req.params;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          inArray(daoMemberships.role, ['admin', 'elder'])
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const member = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        role: daoMemberships.role,
        joinedAt: daoMemberships.createdAt,
        permissions: daoMemberships.permissions,
        isActive: daoMemberships.isActive,
      })
      .from(daoMemberships)
      .innerJoin(users, eq(daoMemberships.userId, users.id))
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, memberId)
      ));

    if (!member.length) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({
      member: member[0],
      dao: { id: dao[0].id, name: dao[0].name },
    });
  } catch (error) {
    logger.error('Error fetching member details:', error);
    res.status(500).json({ error: 'Failed to fetch member details' });
  }
});

// POST /api/admin/daos/:daoId/members/:memberId/promote - Promote member role
// Roles: member -> contributor -> elder -> admin
router.post('/daos/:daoId/members/:memberId/promote', async (req: Request, res: Response) => {
  try {
    const { daoId, memberId } = req.params;
    const adminId = (req.user as any).id;
    const userRole = (req.user as any).roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions - DAO Admin only
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          eq(daoMemberships.role, 'admin')
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Only DAO admin can promote members' });
      }
    }

    // Get current member
    const currentMember = await db
      .select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, memberId)
      ));

    if (!currentMember.length) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const roleHierarchy = ['member', 'contributor', 'elder', 'admin'];
    const currentRoleIndex = roleHierarchy.indexOf(currentMember[0].role);
    
    if (currentRoleIndex === -1 || currentRoleIndex >= roleHierarchy.length - 1) {
      return res.status(400).json({ error: 'Cannot promote further' });
    }

    const newRole = roleHierarchy[currentRoleIndex + 1];

    // Update role
    await db
      .update(daoMemberships)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, memberId)
      ));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.MEMBER_PROMOTED,
      userId: adminId,
      action: `Member promoted: ${currentMember[0].role} → ${newRole}`,
      severity: 'medium',
      endpoint: `/api/admin/daos/:daoId/members/:memberId/promote`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        memberId,
        oldRole: currentMember[0].role,
        newRole,
      }
    }).catch(err => console.error('Audit log failed:', err));

    logger.info('Member promoted', { memberId, daoId, adminId, newRole });

    res.json({
      success: true,
      message: 'Member promoted successfully',
      member: {
        id: memberId,
        role: newRole,
      }
    });
  } catch (error) {
    logger.error('Error promoting member:', error);
    res.status(500).json({ error: 'Failed to promote member' });
  }
});

// POST /api/admin/daos/:daoId/members/:memberId/demote - Demote member role
router.post('/daos/:daoId/members/:memberId/demote', async (req: Request, res: Response) => {
  try {
    const { daoId, memberId } = req.params;
    const adminId = (req.user as any).id;
    const userRole = (req.user as any).roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions - DAO Admin only
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          eq(daoMemberships.role, 'admin')
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Only DAO admin can demote members' });
      }
    }

    // Get current member
    const currentMember = await db
      .select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, memberId)
      ));

    if (!currentMember.length) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const roleHierarchy = ['member', 'contributor', 'elder', 'admin'];
    const currentRoleIndex = roleHierarchy.indexOf(currentMember[0].role);
    
    if (currentRoleIndex <= 0) {
      return res.status(400).json({ error: 'Cannot demote further' });
    }

    const newRole = roleHierarchy[currentRoleIndex - 1];

    // Update role
    await db
      .update(daoMemberships)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, memberId)
      ));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.MEMBER_DEMOTED,
      userId: adminId,
      action: `Member demoted: ${currentMember[0].role} → ${newRole}`,
      severity: 'medium',
      endpoint: `/api/admin/daos/:daoId/members/:memberId/demote`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        memberId,
        oldRole: currentMember[0].role,
        newRole,
      }
    }).catch(err => console.error('Audit log failed:', err));

    logger.info('Member demoted', { memberId, daoId, adminId, newRole });

    res.json({
      success: true,
      message: 'Member demoted successfully',
      member: {
        id: memberId,
        role: newRole,
      }
    });
  } catch (error) {
    logger.error('Error demoting member:', error);
    res.status(500).json({ error: 'Failed to demote member' });
  }
});

// POST /api/admin/daos/:daoId/members/:memberId/remove - Remove member from DAO
router.post('/daos/:daoId/members/:memberId/remove', async (req: Request, res: Response) => {
  try {
    const { daoId, memberId } = req.params;
    const { reason } = req.body;
    const adminId = (req.user as any).id;
    const userRole = (req.user as any).roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions - DAO Admin only
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          eq(daoMemberships.role, 'admin')
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Only DAO admin can remove members' });
      }
    }

    // Prevent removing last admin
    const adminCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.role, 'admin')
      ));

    if (adminCount[0].count === 1) {
      const removingMember = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, memberId)
        ));

      if (removingMember.length && removingMember[0].role === 'admin') {
        return res.status(400).json({ error: 'Cannot remove last admin' });
      }
    }

    // Get member info before removal
    const member = await db
      .select()
      .from(daoMemberships)
      .innerJoin(users, eq(daoMemberships.userId, users.id))
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, memberId)
      ));

    if (!member.length) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Remove member
    await db
      .update(daoMemberships)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, memberId)
      ));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.MEMBER_REMOVED,
      userId: adminId,
      action: `Member removed: ${member[0].users.email}`,
      severity: 'high',
      endpoint: `/api/admin/daos/:daoId/members/:memberId/remove`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        memberId,
        email: member[0].users.email,
        reason,
      }
    }).catch(err => console.error('Audit log failed:', err));

    logger.warn('Member removed from DAO', { memberId, daoId, adminId, reason });

    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    logger.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// GET /api/admin/daos/:daoId/members/stats - Get member statistics
router.get('/daos/:daoId/members/stats', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId)
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const [
      totalMembers,
      admins,
      elders,
      contributors,
      members,
      activeMembers,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(eq(daoMemberships.daoId, daoId)),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.role, 'admin'))),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.role, 'elder'))),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.role, 'contributor'))),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.role, 'member'))),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.isActive, true))),
    ]);

    res.json({
      stats: {
        totalMembers: totalMembers[0].count,
        admins: admins[0].count,
        elders: elders[0].count,
        contributors: contributors[0].count,
        members: members[0].count,
        activeMembers: activeMembers[0].count,
        inactiveMembers: totalMembers[0].count - activeMembers[0].count,
      }
    });
  } catch (error) {
    logger.error('Error fetching member stats:', error);
    res.status(500).json({ error: 'Failed to fetch member stats' });
  }
});

export default router;
