import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/rbac';
import { exchangeFeeService } from '../../services/exchangeFeeService';
import {
  createManualFeeScheduleVersion,
  listFeeScheduleVersions,
} from '../../services/exchangeFeeScheduleRepository';
import { logger } from '../../utils/logger';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

const feeStructureSchema = z.object({
  maker: z.number().finite().min(0).max(0.05),
  taker: z.number().finite().min(0).max(0.05),
});

const scheduleSchema = z.object({
  baseStructure: feeStructureSchema,
  volumeTiers: z.array(z.object({
    volumeThreshold: z.number().finite().min(0),
    maker: z.number().finite().min(0).max(0.05),
    taker: z.number().finite().min(0).max(0.05),
  })),
  stablecoinPairs: feeStructureSchema,
  withdrawal: z.object({
    asset: z.string().trim().min(1).max(20),
    amount: z.number().finite().min(0),
  }).optional(),
  nativeTokenDiscount: z.object({
    token: z.string().trim().min(1).max(20),
    multiplier: z.number().finite().gt(0).max(1),
  }).optional(),
});

function getAdminId(req: Request): string {
  return req.user?.userId || req.user?.claims?.sub || req.user?.id || 'unknown';
}

router.get('/exchange-fees', requireSuperAdmin, async (_req, res) => {
  try {
    const versions = await listFeeScheduleVersions();
    res.json({
      success: true,
      schedules: exchangeFeeService.getSchedules(),
      history: versions,
      recentChanges: exchangeFeeService.getRecentScheduleChanges(),
    });
  } catch (error) {
    logger.error('Failed to retrieve exchange fee schedules:', error);
    res.status(500).json({ error: 'Failed to retrieve exchange fee schedules' });
  }
});

router.post('/exchange-fees/:exchange', requireSuperAdmin, async (req, res) => {
  try {
    const exchange = String(req.params.exchange).trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(exchange)) {
      return res.status(400).json({ error: 'Invalid exchange identifier' });
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason || reason.length > 500) {
      return res.status(400).json({ error: 'A reason of 1 to 500 characters is required' });
    }
    const parsedSchedule = scheduleSchema.safeParse(req.body?.schedule);
    if (!parsedSchedule.success) {
      return res.status(400).json({
        error: 'Invalid fee schedule',
        details: parsedSchedule.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const schedule = exchangeFeeService.validateSchedule({
      ...parsedSchedule.data,
      exchange,
      asOf: new Date().toISOString(),
    });
    const result = await createManualFeeScheduleVersion(schedule, reason, getAdminId(req));
    if (result.changed) {
      exchangeFeeService.loadScheduleVersions(await listFeeScheduleVersions());
      logger.info('Exchange fee schedule manually updated', {
        exchange,
        changedBy: getAdminId(req),
        reason,
        changes: exchangeFeeService.getRecentScheduleChanges(1)[0]?.changes ?? {},
      });
    }
    res.json({
      success: true,
      changed: result.changed,
      version: result.version,
    });
  } catch (error) {
    logger.error('Failed to update exchange fee schedule:', error);
    res.status(500).json({ error: 'Failed to update exchange fee schedule' });
  }
});

export default router;
