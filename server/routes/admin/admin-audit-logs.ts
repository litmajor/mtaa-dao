/**
 * Admin Audit Log Routes
 * Day 3 - Comprehensive Audit Trail Queries
 * 
 * Endpoints for querying and viewing audit logs
 * Power Checklist: #4 Authority Transparency, #8 Post-Action Narrative
 */

import { Router, Request, Response } from 'express';
import auditLoggingService from '../../services/auditLoggingService';

const router = Router();

/**
 * GET /api/admin/audit-logs
 * Query audit logs with flexible filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const {
      actionType,
      actionCategory,
      targetType,
      targetId,
      actorId,
      result,
      reversible,
      since,
      until,
      limit = '50',
      offset = '0',
    } = req.query;

    // Parse filters
    const filters: any = {
      limit: Math.min(parseInt(limit as string), 1000),
      offset: parseInt(offset as string),
    };

    if (actionType) {
      filters.actionType = (actionType as string).split(',');
    }

    if (actionCategory) {
      filters.actionCategory = (actionCategory as string).split(',');
    }

    if (targetType) {
      filters.targetType = (targetType as string).split(',');
    }

    if (targetId) {
      filters.targetId = targetId as string;
    }

    if (actorId) {
      filters.actorId = actorId as string;
    }

    if (result) {
      filters.result = result as string;
    }

    if (reversible) {
      filters.reversible = reversible === 'true';
    }

    if (since) {
      filters.sinceDate = new Date(since as string);
    }

    if (until) {
      filters.untilDate = new Date(until as string);
    }

    const { logs, total } = await auditLoggingService.queryAuditLogs(filters);

    res.json({
      logs,
      total,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: filters.offset + filters.limit < total,
    });
  } catch (error) {
    console.error('Error querying audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/audit-logs/:logId
 * Get full details of a specific audit log entry
 */
router.get('/:logId', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { logId } = req.params;

    const log = await auditLoggingService.getActionDetails(logId);

    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json(log);
  } catch (error) {
    console.error('Error getting audit log details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/audit-logs/actor/:actorId
 * Get all actions by a specific actor
 */
router.get('/actor/:actorId', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { actorId } = req.params;
    const { actionType, since = '7', limit = '50', offset = '0' } = req.query;

    const filters: any = {
      limit: Math.min(parseInt(limit as string), 1000),
      offset: parseInt(offset as string),
    };

    if (actionType) {
      filters.actionType = actionType as string;
    }

    if (since) {
      const days = parseInt(since as string);
      filters.since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    const logs = await auditLoggingService.getActorActionLog(actorId, filters);

    res.json({
      actorId,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Error getting actor audit log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/audit-logs/resource/:targetType/:targetId
 * Get all actions affecting a specific resource
 */
router.get('/resource/:targetType/:targetId', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { targetType, targetId } = req.params;
    const { since = '30', limit = '50', offset = '0' } = req.query;

    const filters: any = {
      limit: Math.min(parseInt(limit as string), 1000),
      offset: parseInt(offset as string),
    };

    if (since) {
      const days = parseInt(since as string);
      filters.since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    const logs = await auditLoggingService.getResourceActionLog(targetType, targetId, filters);

    res.json({
      targetType,
      targetId,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Error getting resource audit log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/audit-logs/stats
 * Get audit statistics for a time period
 */
router.get('/stats/period', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { since = '7', until = '0' } = req.query;

    const sinceDate = new Date(Date.now() - parseInt(since as string) * 24 * 60 * 60 * 1000);
    const untilDate = new Date(Date.now() - parseInt(until as string) * 24 * 60 * 60 * 1000);

    const stats = await auditLoggingService.getAuditStats({
      since: sinceDate,
      until: untilDate,
    });

    res.json({
      period: {
        since: sinceDate,
        until: untilDate,
      },
      stats,
    });
  } catch (error) {
    console.error('Error getting audit stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
