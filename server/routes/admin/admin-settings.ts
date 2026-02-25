import { Router } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { config } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

// Get system settings
router.get('/settings', requireSuperAdmin, async (req, res) => {
  try {
    const settings = await db.select().from(config);

    res.json({
      success: true,
      settings: Object.fromEntries(settings.map(s => [s.key, s.value])),
    });
  } catch (error) {
    logger.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update system settings
router.put('/settings/:key', requireSuperAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    await db
      .update(config)
      .set({ value })
      .where(eq(config.key, key));

    logger.info('System setting updated', { key, value });

    res.json({
      success: true,
      message: 'Setting updated successfully',
    });
  } catch (error) {
    logger.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
