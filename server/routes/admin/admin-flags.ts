import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { config } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logConsolidatedAuditEvent } from '../../services/auditConsolidated';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

function getUserId(req: Request): string | undefined {
  const user = req.user as any;
  return user?.id || user?.claims?.sub;
}

/**
 * GET /api/admin/flags
 * Retrieve all system configuration flags
 */
router.get('/flags', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const flags = await db.select({
      key: config.key,
      value: config.value,
      updatedAt: config.updatedAt,
    }).from(config);

    res.json({
      success: true,
      flags,
    });
  } catch (error) {
    logger.error('Error fetching feature flags:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feature flags' });
  }
});

/**
 * PUT /api/admin/flags/:flagKey
 * Update a specific feature flag key with verification and audit logging
 */
router.put('/flags/:flagKey', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { flagKey } = req.params;
    const { value } = req.body;
    const adminId = getUserId(req);

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required body parameter 'value'",
      });
    }

    if (!flagKey || typeof flagKey !== 'string' || flagKey.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing feature flag key parameter',
      });
    }

    // Execute atomic update and return updated record
    const updated = await db
      .update(config)
      .set({
        value,
        updatedAt: new Date(),
      })
      .where(eq(config.key, flagKey))
      .returning({
        key: config.key,
        value: config.value,
        updatedAt: config.updatedAt,
      });

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Feature flag '${flagKey}' not found`,
      });
    }

    const updatedFlag = updated[0];

    // Log administrative audit event
    if (adminId) {
      try {
        await logConsolidatedAuditEvent({
          actionType: 'FEATURE_FLAG_UPDATED',
          actorId: adminId,
          targetType: 'system_config',
          targetId: flagKey,
          actionCategory: 'admin',
          result: 'success',
          severity: 'high',
          endpoint: `/api/admin/flags/${flagKey}`,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            flagKey,
            newValue: value,
          },
        });
      } catch (auditError) {
        logger.warn('Failed to record feature flag update audit log:', { error: String(auditError) });
      }
    }

    logger.info('Feature flag updated successfully', { flagKey, value, adminId });

    res.json({
      success: true,
      message: 'Feature flag updated successfully',
      flag: updatedFlag,
    });
  } catch (error) {
    logger.error('Error updating feature flag:', error);
    res.status(500).json({ success: false, error: 'Failed to update feature flag' });
  }
});

export default router;