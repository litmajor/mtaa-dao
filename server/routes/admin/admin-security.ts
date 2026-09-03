import { Router } from 'express';
import type { Request } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { users, sessions, auditLogs } from '../../../shared/schema';
import { eq, gte, sql, and, or, ilike } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logConsolidatedAuditEvent } from '../../services/auditConsolidated';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

function getAdminId(req: Request): string | null {
  return req.user?.userId || req.user?.claims?.sub || req.user?.id || null;
}

function parsePagination(query: Request['query']): { page: number; limit: number; offset: number } | null {
  const pageValue = String(query.page ?? '1');
  const limitValue = String(query.limit ?? '50');
  if (!/^\d+$/.test(pageValue) || !/^\d+$/.test(limitValue)) return null;
  const page = Number(pageValue);
  const limit = Number(limitValue);
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset)) return null;
  return { page, limit, offset };
}

async function auditSecurityAction(req: Request, actionType: string, targetId: string, metadata?: Record<string, unknown>): Promise<void> {
  const actorId = getAdminId(req);
  if (!actorId) return;
  try {
    await logConsolidatedAuditEvent({ actorId, actorType: 'super_admin', actorRole: 'super_admin', actionType,
      actionCategory: 'security', targetType: 'session', targetId, endpoint: req.originalUrl,
      ipAddress: req.ip, userAgent: req.get('user-agent'), result: 'success', severity: 'high', metadata });
  } catch (error) {
    logger.error('Security audit logging failed:', error);
  }
}

// Get sessions
router.get('/security/sessions', requireSuperAdmin, async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ error: 'page must be >= 1 and limit must be between 1 and 100' });
    const activeSessions = await db.select({
      id: sessions.id, userId: sessions.userId, userEmail: users.email, username: users.username,
      expiresAt: sessions.expiresAt, createdAt: sessions.createdAt, updatedAt: sessions.updatedAt,
      lastAccessedAt: sessions.lastAccessedAt, ipAddress: sessions.ipAddress, userAgent: sessions.userAgent,
    }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
      .where(gte(sessions.expiresAt, new Date())).orderBy(sessions.expiresAt)
      .limit(pagination.limit).offset(pagination.offset);
    const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(sessions)
      .where(gte(sessions.expiresAt, new Date()));

    const response = {
      success: true,
      sessions: activeSessions,
      pagination: { ...pagination, total: Number(total || 0), pages: Math.ceil(Number(total || 0) / pagination.limit) },
    };
    await auditSecurityAction(req, 'ADMIN_SECURITY_SESSIONS_ACCESSED', 'active');
    res.json(response);
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Lookup a specific session safely (metadata only, no raw token material)
router.get('/security/sessions/:sessionId', requireSuperAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    const [session] = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
        lastAccessedAt: sessions.lastAccessedAt,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
      })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gte(sessions.expiresAt, new Date())))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    await auditSecurityAction(req, 'ADMIN_SECURITY_SESSION_LOOKUP', sessionId, { viewedUserId: session.userId });
    res.json({ success: true, session });
  } catch (error) {
    logger.error('Error looking up session:', error);
    res.status(500).json({ error: 'Failed to look up session' });
  }
});

// Revoke session
router.delete('/security/sessions/:sessionId', requireSuperAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    const deleted = await db.delete(sessions).where(eq(sessions.id, sessionId)).returning({ id: sessions.id });
    if (!deleted.length) return res.status(404).json({ success: false, error: 'Session not found' });

    await auditSecurityAction(req, 'ADMIN_SECURITY_SESSION_REVOKED', sessionId, { revokedBy: adminId });

    logger.info('Session revoked by admin', { sessionId, adminId });

    res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    logger.error('Error revoking session:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// Security audit report
router.get('/security/audit', requireSuperAdmin, async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [failedLoginResult] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(and(
      gte(auditLogs.createdAt, since),
      or(ilike(auditLogs.action, '%LOGIN_FAILURE%'), ilike(auditLogs.action, '%login_failed%')),
    ));
    const failedLogins = Number(failedLoginResult?.count || 0);
    
    // Users with super_admin role
    const adminUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(or(eq(users.roles, 'super_admin'), ilike(users.roles, '%super_admin%')));
    
    // Banned users
    const bannedUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isBanned, true));
    
    // Active sessions
    const activeSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(gte(sessions.expiresAt, new Date()));

    const auditReport = {
      timestamp: new Date().toISOString(),
      security: {
        failedLoginAttempts: failedLogins,
        adminUserCount: adminUsers[0].count,
        bannedUserCount: bannedUsers[0].count,
        activeSessionCount: activeSessions[0].count,
      },
      recommendations: [
        failedLogins > 100 && 'High number of failed login attempts detected',
        adminUsers[0].count > 5 && 'Consider limiting the number of super admin users',
      ].filter(Boolean),
    };

    await auditSecurityAction(req, 'ADMIN_SECURITY_AUDIT_ACCESSED', 'audit-report');
    res.json(auditReport);
  } catch (error) {
    logger.error('Error generating security audit:', error);
    res.status(500).json({ error: 'Failed to generate audit report' });
  }
});

export default router;
