import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../../../middleware/auth';
import { ApiResponse } from '../../../utils/apiResponse';
import { logger } from '../../../utils/logger';
import { notificationService } from '../../../notificationService';

const router = Router();

// Simple in-memory alerts store (user-scoped keys may be added later)
const ALERTS: Record<string, any> = {};

export async function fanOutYukiAlert(alert: Record<string, any>, userId: string) {
  try {
    const alertType = String(alert.type || '').toLowerCase();
    const isHighPriority = alert.severity === 'critical' || ['liquidation', 'risk', 'margin_call', 'price_alert'].includes(alertType);

    await notificationService.createNotification({
      userId,
      type: 'yuki_alert',
      title: `YUKI alert: ${alert.type || 'notification'}`,
      message: alert.message || 'YUKI alert received',
      priority: isHighPriority ? 'high' : 'medium',
      metadata: {
        source: 'yuki',
        yukiAlertId: alert.id,
        symbol: alert.symbol,
        threshold: alert.threshold ?? null,
        ...alert.metadata,
      },
    });
  } catch (error) {
    logger.warn('[YUKI][ALERTS] Failed to fan out alert to notification service', { error, alertId: alert.id });
  }
}

router.use(authenticateToken as any);

/**
 * GET /v1/yuki/alerts
 * Optional query: symbol
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const symbol = req.query.symbol ? String(req.query.symbol) : undefined;
    const list = Object.values(ALERTS).filter((a: any) => (symbol ? a.symbol === symbol : true));
    res.json(ApiResponse.success(list).addMeta({ total: list.length, timestamp: Date.now() }));
  } catch (error) {
    logger.error('[YUKI][ALERTS] Failed to list alerts', { error });
    res.status(500).json(ApiResponse.error('Failed to list alerts'));
  }
});

/**
 * POST /v1/yuki/alerts
 * Body: { symbol, type, message, threshold?, metadata? }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { symbol, type, message, threshold, metadata } = req.body;
    if (!symbol || !type) return res.status(400).json(ApiResponse.error('symbol and type are required'));

    const id = uuidv4();
    const alert = {
      id,
      symbol,
      type,
      message: message || '',
      threshold: threshold ?? null,
      metadata: metadata ?? null,
      createdAt: new Date().toISOString(),
      createdBy: (req as any).user?.id || 'system',
    };

    ALERTS[id] = alert;
    await fanOutYukiAlert(alert, (req as any).user?.id || 'system');
    res.json(ApiResponse.success(alert));
  } catch (error) {
    logger.error('[YUKI][ALERTS] Failed to create alert', { error });
    res.status(500).json(ApiResponse.error('Failed to create alert'));
  }
});

/**
 * DELETE /v1/yuki/alerts/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!ALERTS[id]) return res.status(404).json(ApiResponse.error('Alert not found'));
    delete ALERTS[id];
    res.json(ApiResponse.success({ id }).addMeta({ deleted: true }));
  } catch (error) {
    logger.error('[YUKI][ALERTS] Failed to delete alert', { error });
    res.status(500).json(ApiResponse.error('Failed to delete alert'));
  }
});

export default router;
