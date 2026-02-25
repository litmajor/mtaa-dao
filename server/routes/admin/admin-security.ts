import { Router } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { users, sessions, auditLogs } from '../../../shared/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

// Get sessions
router.get('/security/sessions', requireSuperAdmin, async (req, res) => {
  try {
    const activeSessions = await db
      .select()
      .from(sessions)
      .where(gte(sessions.expiresAt, new Date()));

    res.json({
      success: true,
      sessions: activeSessions,
    });
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Revoke session
router.delete('/security/sessions/:sessionId', requireSuperAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const adminId = (req.user as any).id;

    await db.delete(sessions).where(eq(sessions.id, sessionId));

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
    // Failed login attempts (mock - would need actual tracking)
    const failedLogins = 0;
    
    // Users with super_admin role
    const adminUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.roles, 'super_admin'));
    
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

    res.json(auditReport);
  } catch (error) {
    logger.error('Error generating security audit:', error);
    res.status(500).json({ error: 'Failed to generate audit report' });
  }
});

export default router;
