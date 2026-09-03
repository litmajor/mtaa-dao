import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { auditLogs, userActivities } from '../../../shared/schema';
import { desc, eq, sql, and, gte, lte } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

class InvalidParameterError extends Error {}

/**
 * Safely parses and validates pagination input bounds
 */
function parsePaginationParams(pageQuery: unknown, limitQuery: unknown, defaultLimit = 50, maxLimit = 1000) {
  const page = pageQuery ? Number(pageQuery) : 1;
  const limit = limitQuery ? Number(limitQuery) : defaultLimit;

  if (!Number.isSafeInteger(page) || page < 1) {
    throw new InvalidParameterError("Invalid 'page' parameter: must be a positive integer");
  }

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new InvalidParameterError(`Invalid 'limit' parameter: must be an integer between 1 and ${maxLimit}`);
  }

  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * GET /api/admin/logs
 * Fetch system user activity logs with pagination and optional user filtering
 */
router.get('/logs', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page, limit, userId } = req.query;
    const { page: pageNum, limit: limitNum, offset } = parsePaginationParams(page, limit, 100, 500);

    const conditions = [];

    if (userId && typeof userId === 'string') {
      conditions.push(eq(userActivities.userId, userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, totalResult] = await Promise.all([
      db
        .select()
        .from(userActivities)
        .where(whereClause)
        .orderBy(desc(userActivities.createdAt))
        .limit(limitNum)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(userActivities)
        .where(whereClause)
    ]);

    const total = totalResult[0]?.count || 0;

    res.json({
      success: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Error fetching user activity logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user activity logs' });
  }
});

/**
 * GET /api/admin/audit
 * Fetch system audit logs with pagination and optional action filtering
 */
router.get('/audit', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page, limit, action, actorId, fromDate, toDate } = req.query;
    const { page: pageNum, limit: limitNum, offset } = parsePaginationParams(page, limit, 100, 500);

    const conditions = [];

    if (action && typeof action === 'string') {
      conditions.push(eq(auditLogs.action, action));
    }

    if (actorId && typeof actorId === 'string') {
      conditions.push(eq(auditLogs.userId, actorId));
    }

    if (fromDate && typeof fromDate === 'string' && !isNaN(Date.parse(fromDate))) {
      conditions.push(gte(auditLogs.createdAt, new Date(fromDate)));
    }

    if (toDate && typeof toDate === 'string' && !isNaN(Date.parse(toDate))) {
      conditions.push(lte(auditLogs.createdAt, new Date(toDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, totalResult] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limitNum)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(whereClause)
    ]);

    const total = totalResult[0]?.count || 0;

    res.json({
      success: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

export default router;