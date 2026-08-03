/**
 * ════════════════════════════════════════════════════════════════════════════════
 * YUKI Risk Router
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Mount point: /v1/yuki/risk
 * Handles user-level risk settings.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { ApiResponse } from '../../../utils/apiResponse';
import { logger } from '../../../utils/logger';

const router = Router();

router.use(authenticateToken as any);

/**
 * GET /v1/yuki/risk/settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = {
      maxDrawdownPct: 15,
      maxLeverage: 3,
      allowedAssets: ['USDC', 'ETH', 'BTC'],
      autoStopLossEnabled: true,
      autoStopLossPct: 5,
    };
    res.json(ApiResponse.success(settings));
  } catch (error) {
    logger.error('Failed to fetch risk settings', { error });
    res.status(500).json(ApiResponse.error('Failed to fetch risk settings'));
  }
});

/**
 * PUT /v1/yuki/risk/settings
 */
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    res.json(ApiResponse.success(settings));
  } catch (error) {
    logger.error('Failed to update risk settings', { error });
    res.status(500).json(ApiResponse.error('Failed to update risk settings'));
  }
});

export default router;
