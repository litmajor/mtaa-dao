import { Router } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { config } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

// Feature flag management
router.get('/flags', requireSuperAdmin, async (req, res) => {
  try {
    const flags = await db.select().from(config);

    res.json({
      success: true,
      flags: flags.map(f => ({
        key: f.key,
        value: f.value,
      })),
    });
  } catch (error) {
    logger.error('Error fetching feature flags:', error);
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

// Update feature flag
router.put('/flags/:flagKey', requireSuperAdmin, async (req, res) => {
  try {
    const { flagKey } = req.params;
    const { value } = req.body;

    await db
      .update(config)
      .set({ value })
      .where(eq(config.key, flagKey));

    logger.info('Feature flag updated', { flagKey, value });

    res.json({
      success: true,
      message: 'Feature flag updated successfully',
    });
  } catch (error) {
    logger.error('Error updating feature flag:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

export default router;
