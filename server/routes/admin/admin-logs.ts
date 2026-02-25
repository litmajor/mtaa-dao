import { Router } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { auditLogs, userActivities } from '../../../shared/schema';
import { desc } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

// GET /api/admin/logs - Fetch system activity logs
router.get('/logs', requireSuperAdmin, async (req, res) => {
  try {
    const { limit = '100', offset = '0' } = req.query;

    const logs = await db
      .select()
      .from(userActivities)
      .orderBy(desc(userActivities.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      logs,
    });
  } catch (error) {
    logger.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/admin/audit - Fetch audit logs
router.get('/audit', requireSuperAdmin, async (req, res) => {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);

    res.json({
      success: true,
      logs,
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
