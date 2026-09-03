import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daoMemberships, users, daos } from '../../../shared/schema';
import { eq, desc, sql, and, or, ilike } from 'drizzle-orm';
import { authenticateToken } from '../../middleware/auth';
import { logConsolidatedAuditEvent } from '../../services/auditConsolidated';

const router = Router();

type AuthenticatedUser = {
  id?: string;
  userId?: string;
  roles?: string | string[];
  claims?: { sub?: string };
};

const roleHierarchy = ['member', 'contributor', 'elder', 'admin'];

function getActorId(req: Request): string | null {
  const user = req.user as AuthenticatedUser | undefined;
  return user?.userId || user?.claims?.sub || user?.id || null;
}

function getActorRole(req: Request): string {
  if (req.userRole) return req.userRole;
  const roles = (req.user as AuthenticatedUser | undefined)?.roles;
  return Array.isArray(roles) ? roles[0] || 'user' : roles || 'user';
}

async function requireMemberManager(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = getActorId(req);
    const { daoId } = req.params;

    if (!actorId) return res.status(401).json({ error: 'Authentication required' });
    const [user] = await db.select({ role: users.roles }).from(users).where(eq(users.id, actorId)).limit(1);
    const actorRole = user?.role || getActorRole(req);
    req.userRole = actorRole;
    if (actorRole !== 'super_admin' && actorRole !== 'admin') {
      const manager = await db.select({ id: daoMemberships.id }).from(daoMemberships).where(and(
        eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, actorId),
        eq(daoMemberships.role, 'admin'), eq(daoMemberships.status, 'approved'),
        eq(daoMemberships.isBanned, false),
      )).limit(1);
      if (!manager.length) return res.status(403).json({ error: 'Access denied to this DAO' });
    }
    next();
  } catch (error) {
    logger.error('Member authorization check failed:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

const requireMemberAccess = [authenticateToken, requireMemberManager];

function parsePagination(query: Request['query']): { page: number; limit: number; offset: number } | null {
  const pageValue = String(query.page ?? '1');
  const limitValue = String(query.limit ?? '20');
  if (!/^\d+$/.test(pageValue) || !/^\d+$/.test(limitValue)) return null;
  const page = Number(pageValue);
  const limit = Number(limitValue);
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset)) return null;
  return { page, limit, offset };
}

async function getDao(daoId: string) {
  const result = await db.select({ id: daos.id, name: daos.name, founderId: daos.founderId })
    .from(daos).where(eq(daos.id, daoId)).limit(1);
  return result[0];
}

function activeMemberConditions(daoId: string) {
  return [eq(daoMemberships.daoId, daoId), eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false)];
}

function escapeLikePattern(value: string): string {
  return value.replace(/[%_]/g, character => `\\${character}`);
}

async function auditMemberAccess(req: Request, actionType: string, daoId: string, targetId: string) {
  const actorId = getActorId(req);
  if (!actorId) return;
  try {
    await logConsolidatedAuditEvent({
      actorId, daoId, actionType, targetType: 'dao_member', targetId,
      result: 'success', ipAddress: req.ip, endpoint: req.originalUrl, severity: 'low',
    });
  } catch (error) {
    logger.error('Member access audit failed', { error, actorId, daoId, actionType, targetId });
  }
}

router.get('/daos/:daoId/members', requireMemberAccess, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ error: 'page must be >= 1 and limit must be between 1 and 100' });
    const dao = await getDao(daoId);
    if (!dao) return res.status(404).json({ error: 'DAO not found' });

    const { page, limit, offset } = pagination;
    const { search = '', role = '' } = req.query;
    const conditions = activeMemberConditions(daoId);
    if (typeof search === 'string' && search.trim()) {
      const escapedSearch = escapeLikePattern(search.trim());
      const searchCondition = or(
        ilike(users.email, `%${escapedSearch}%`),
        ilike(users.username, `%${escapedSearch}%`),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    if (typeof role === 'string' && role && role !== 'all') conditions.push(eq(daoMemberships.role, role));

    const members = await db.select({
      id: users.id, email: users.email, username: users.username, role: daoMemberships.role,
      joinedAt: daoMemberships.joinedAt, status: daoMemberships.status, isBanned: daoMemberships.isBanned,
      isAdmin: daoMemberships.isAdmin, isElder: daoMemberships.isElder,
      canInitiateWithdrawal: daoMemberships.canInitiateWithdrawal,
      canApproveWithdrawal: daoMemberships.canApproveWithdrawal,
    }).from(daoMemberships).innerJoin(users, eq(daoMemberships.userId, users.id))
      .where(and(...conditions)).orderBy(desc(daoMemberships.joinedAt)).limit(limit).offset(offset);
    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(daoMemberships)
      .innerJoin(users, eq(daoMemberships.userId, users.id)).where(and(...conditions));
    const total = Number(totalResult[0]?.count || 0);

    await auditMemberAccess(req, 'ADMIN_MEMBER_LIST_ACCESSED', daoId, daoId);
    res.json({ members, dao: { id: dao.id, name: dao.name },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      userRole: getActorRole(req), canManage: true });
  } catch (error) {
    logger.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Static routes must precede /:memberId routes.
router.get('/daos/:daoId/members/stats', requireMemberAccess, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const dao = await getDao(daoId);
    if (!dao) return res.status(404).json({ error: 'DAO not found' });
    const base = activeMemberConditions(daoId);
    const [total, active, admins, elders, contributors, members] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(eq(daoMemberships.daoId, daoId)),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(...base)),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(...base, eq(daoMemberships.role, 'admin'))),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(...base, eq(daoMemberships.role, 'elder'))),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(...base, eq(daoMemberships.role, 'contributor'))),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(...base, eq(daoMemberships.role, 'member'))),
    ]);
    const totalMembers = Number(total[0]?.count || 0);
    const activeMembers = Number(active[0]?.count || 0);
    await auditMemberAccess(req, 'ADMIN_MEMBER_STATS_ACCESSED', daoId, daoId);
    res.json({ stats: { totalMembers, admins: Number(admins[0]?.count || 0),
      elders: Number(elders[0]?.count || 0), contributors: Number(contributors[0]?.count || 0),
      members: Number(members[0]?.count || 0), activeMembers, inactiveMembers: totalMembers - activeMembers } });
  } catch (error) {
    logger.error('Error fetching member stats:', error);
    res.status(500).json({ error: 'Failed to fetch member stats' });
  }
});

router.get('/daos/:daoId/members/:memberId', requireMemberAccess, async (req: Request, res: Response) => {
  try {
    const { daoId, memberId } = req.params;
    const dao = await getDao(daoId);
    if (!dao) return res.status(404).json({ error: 'DAO not found' });
    const member = await db.select({
      id: users.id, email: users.email, username: users.username, firstName: users.firstName, lastName: users.lastName,
      role: daoMemberships.role, joinedAt: daoMemberships.joinedAt, status: daoMemberships.status,
      isBanned: daoMemberships.isBanned, isAdmin: daoMemberships.isAdmin, isElder: daoMemberships.isElder,
      canInitiateWithdrawal: daoMemberships.canInitiateWithdrawal, canApproveWithdrawal: daoMemberships.canApproveWithdrawal,
    }).from(daoMemberships).innerJoin(users, eq(daoMemberships.userId, users.id)).where(and(
      eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, memberId),
    )).limit(1);
    if (!member.length) return res.status(404).json({ error: 'Member not found' });
    await auditMemberAccess(req, 'ADMIN_MEMBER_DETAILS_ACCESSED', daoId, memberId);
    res.json({ member: member[0], dao: { id: dao.id, name: dao.name } });
  } catch (error) {
    logger.error('Error fetching member details:', error);
    res.status(500).json({ error: 'Failed to fetch member details' });
  }
});

async function changeMemberRole(req: Request, res: Response, direction: 1 | -1) {
  const { daoId, memberId } = req.params;
  const actorId = getActorId(req);
  if (!actorId) return res.status(401).json({ error: 'Authentication required' });
  if (direction < 0 && actorId === memberId) return res.status(400).json({ error: 'Cannot demote yourself' });
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM daos WHERE id = ${daoId} FOR UPDATE`);
    const dao = await tx.select({ founderId: daos.founderId }).from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!dao.length) return { status: 404, body: { error: 'DAO not found' } };
    const current = await tx.select().from(daoMemberships).where(and(
      eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, memberId),
    )).limit(1);
    if (!current.length) return { status: 404, body: { error: 'Member not found' } };
    const membership = current[0];
    if (dao[0].founderId === memberId) return { status: 400, body: { error: 'Founder role cannot be changed' } };
    if (membership.status !== 'approved' || membership.isBanned) return { status: 400, body: { error: 'Only approved, non-banned members can change roles' } };
    const currentIndex = roleHierarchy.indexOf(membership.role || 'member');
    const newRole = roleHierarchy[currentIndex + direction];
    if (currentIndex < 0 || !newRole) return { status: 400, body: { error: direction > 0 ? 'Cannot promote further' : 'Cannot demote further' } };
    if (direction < 0 && membership.role === 'admin') {
      const admins = await tx.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(
        eq(daoMemberships.daoId, daoId), eq(daoMemberships.role, 'admin'),
        eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false),
      ));
      if (Number(admins[0]?.count || 0) <= 1) return { status: 400, body: { error: 'Cannot demote last admin' } };
    }
    await tx.update(daoMemberships).set({ role: newRole, isAdmin: newRole === 'admin',
      isElder: newRole === 'elder', updatedAt: new Date() }).where(and(
        eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, memberId),
      ));
    return { status: 200, body: { role: newRole, oldRole: membership.role } };
  });
  if (result.status !== 200) return res.status(result.status).json(result.body);
  try {
    await logConsolidatedAuditEvent({ actorId, daoId, actionType: direction > 0 ? 'MEMBER_PROMOTED' : 'MEMBER_DEMOTED',
      targetType: 'dao_member', targetId: memberId, result: 'success', ipAddress: req.ip,
      endpoint: req.originalUrl, metadata: { oldRole: result.body.oldRole, newRole: result.body.role }, severity: 'medium' });
  } catch (error) {
    logger.error('Member role change audit failed', { error, actorId, daoId, memberId, direction });
  }
  res.json({ success: true, message: direction > 0 ? 'Member promoted successfully' : 'Member demoted successfully',
    member: { id: memberId, role: result.body.role } });
}

router.post('/daos/:daoId/members/:memberId/promote', requireMemberAccess, async (req: Request, res: Response) => {
  try { await changeMemberRole(req, res, 1); } catch (error) { logger.error('Error promoting member:', error); res.status(500).json({ error: 'Failed to promote member' }); }
});

router.post('/daos/:daoId/members/:memberId/demote', requireMemberAccess, async (req: Request, res: Response) => {
  try { await changeMemberRole(req, res, -1); } catch (error) { logger.error('Error demoting member:', error); res.status(500).json({ error: 'Failed to demote member' }); }
});

router.post('/daos/:daoId/members/:memberId/remove', requireMemberAccess, async (req: Request, res: Response) => {
  try {
    const { daoId, memberId } = req.params;
    const actorId = getActorId(req);
    if (!actorId) return res.status(401).json({ error: 'Authentication required' });
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM daos WHERE id = ${daoId} FOR UPDATE`);
      const dao = await tx.select({ founderId: daos.founderId }).from(daos).where(eq(daos.id, daoId)).limit(1);
      if (!dao.length) return { status: 404, body: { error: 'DAO not found' } };
      if (dao[0].founderId === memberId) return { status: 400, body: { error: 'Founder cannot be removed' } };
      const member = await tx.select({ email: users.email, role: daoMemberships.role,
        status: daoMemberships.status, isBanned: daoMemberships.isBanned }).from(daoMemberships)
        .innerJoin(users, eq(daoMemberships.userId, users.id)).where(and(
          eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, memberId),
        )).limit(1);
      if (!member.length) return { status: 404, body: { error: 'Member not found' } };
      if (member[0].role === 'admin' && member[0].status === 'approved' && !member[0].isBanned) {
        const admins = await tx.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(
          eq(daoMemberships.daoId, daoId), eq(daoMemberships.role, 'admin'),
          eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false),
        ));
        if (Number(admins[0]?.count || 0) <= 1) return { status: 400, body: { error: 'Cannot remove last admin' } };
      }
      await tx.update(daoMemberships).set({ status: 'rejected', updatedAt: new Date() }).where(and(
        eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, memberId),
      ));
      return { status: 200, body: { email: member[0].email } };
    });
    if (result.status !== 200) return res.status(result.status).json(result.body);
    try {
      await logConsolidatedAuditEvent({ actorId, daoId, actionType: 'MEMBER_REMOVED', targetType: 'dao_member',
        targetId: memberId, result: 'success', ipAddress: req.ip, endpoint: req.originalUrl,
        metadata: { email: result.body.email, reason: req.body?.reason }, severity: 'high' });
    } catch (error) {
      logger.error('Member removal audit failed', { error, actorId, daoId, memberId });
    }
    logger.warn('Member removed from DAO', { memberId, daoId, actorId, reason: req.body?.reason });
    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    logger.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
