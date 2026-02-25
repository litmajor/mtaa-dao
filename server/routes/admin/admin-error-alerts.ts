import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { requireRole } from '../../middleware/rbac';
import {
  PaymentErrorAlertService,
  AlertTrigger,
  AlertRecipient,
  AlertSeverity,
  AlertChannel,
} from '../../services/paymentErrorAlertService';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

/**
 * ADMIN ERROR ALERTS MANAGEMENT ROUTES
 * Phase 3c Part 2 - Real-time alerts and notifications
 */

// ============================================================================
// ALERT TRIGGER MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/alerts/triggers
 * Get all alert triggers
 */
router.get('/alerts/triggers', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const triggers = PaymentErrorAlertService.getAllTriggers();

    res.json({
      timestamp: new Date(),
      count: triggers.length,
      triggers: triggers.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        enabled: t.enabled,
        condition: t.condition,
        actionsCount: t.actions.length,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching alert triggers', { error });
    res.status(500).json({ error: 'Failed to fetch alert triggers' });
  }
});

/**
 * GET /api/admin/alerts/triggers/:triggerId
 * Get specific alert trigger
 */
router.get('/alerts/triggers/:triggerId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { triggerId } = req.params;
    const trigger = PaymentErrorAlertService.getTrigger(triggerId);

    if (!trigger) {
      return res.status(404).json({ error: 'Alert trigger not found' });
    }

    res.json({
      timestamp: new Date(),
      trigger,
    });
  } catch (error) {
    logger.error('Error fetching alert trigger', { error });
    res.status(500).json({ error: 'Failed to fetch alert trigger' });
  }
});

/**
 * POST /api/admin/alerts/triggers
 * Create new alert trigger
 */
router.post('/alerts/triggers', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, condition, actions, enabled } = req.body;

    if (!name || !condition) {
      return res.status(400).json({
        error: 'Missing required fields: name, condition',
      });
    }

    const trigger: AlertTrigger = {
      id: `trigger-${Date.now()}`,
      name,
      description,
      enabled: enabled !== false,
      condition,
      actions: actions || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = PaymentErrorAlertService.createOrUpdateTrigger(trigger);

    res.status(201).json({
      timestamp: new Date(),
      trigger: created,
      message: 'Alert trigger created successfully',
    });
  } catch (error) {
    logger.error('Error creating alert trigger', { error });
    res.status(500).json({ error: 'Failed to create alert trigger' });
  }
});

/**
 * PUT /api/admin/alerts/triggers/:triggerId
 * Update alert trigger
 */
router.put('/alerts/triggers/:triggerId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { triggerId } = req.params;
    const existing = PaymentErrorAlertService.getTrigger(triggerId);

    if (!existing) {
      return res.status(404).json({ error: 'Alert trigger not found' });
    }

    const { name, description, condition, actions, enabled } = req.body;

    const updated: AlertTrigger = {
      ...existing,
      name: name || existing.name,
      description: description !== undefined ? description : existing.description,
      condition: condition || existing.condition,
      actions: actions || existing.actions,
      enabled: enabled !== undefined ? enabled : existing.enabled,
      updatedAt: new Date(),
    };

    const result = PaymentErrorAlertService.createOrUpdateTrigger(updated);

    res.json({
      timestamp: new Date(),
      trigger: result,
      message: 'Alert trigger updated successfully',
    });
  } catch (error) {
    logger.error('Error updating alert trigger', { error });
    res.status(500).json({ error: 'Failed to update alert trigger' });
  }
});

/**
 * DELETE /api/admin/alerts/triggers/:triggerId
 * Delete alert trigger
 */
router.delete('/alerts/triggers/:triggerId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { triggerId } = req.params;
    const deleted = PaymentErrorAlertService.deleteTrigger(triggerId);

    if (!deleted) {
      return res.status(404).json({ error: 'Alert trigger not found' });
    }

    res.json({
      timestamp: new Date(),
      message: 'Alert trigger deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting alert trigger', { error });
    res.status(500).json({ error: 'Failed to delete alert trigger' });
  }
});

// ============================================================================
// ALERT RECIPIENT MANAGEMENT
// ============================================================================

/**
 * POST /api/admin/alerts/recipients
 * Register alert recipient
 */
router.post('/alerts/recipients', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id, email, phoneNumber, preferredChannel, alertRoles, doNotDisturbSchedule } =
      req.body;

    if (!id || !alertRoles || alertRoles.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: id, alertRoles',
      });
    }

    if (!email && !phoneNumber) {
      return res.status(400).json({
        error: 'At least one contact method required: email or phoneNumber',
      });
    }

    const recipient: AlertRecipient = {
      id,
      email,
      phoneNumber,
      preferredChannel: preferredChannel || AlertChannel.EMAIL,
      alertRoles,
      doNotDisturbSchedule,
      enabled: true,
    };

    const registered = PaymentErrorAlertService.registerRecipient(recipient);

    res.status(201).json({
      timestamp: new Date(),
      recipient: registered,
      message: 'Alert recipient registered successfully',
    });
  } catch (error) {
    logger.error('Error registering alert recipient', { error });
    res.status(500).json({ error: 'Failed to register alert recipient' });
  }
});

/**
 * GET /api/admin/alerts/recipients
 * Get all alert recipients
 */
router.get('/alerts/recipients', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const role = req.query.role as string | undefined;

    let recipients: AlertRecipient[];
    if (role) {
      recipients = PaymentErrorAlertService.getRecipientsByRole(
        role as 'error_ops' | 'payment_ops' | 'director'
      );
    } else {
      // Get all - need to fetch from all roles
      const allRoles = ['error_ops', 'payment_ops', 'director'] as const;
      const recipientMap = new Map<string, AlertRecipient>();

      for (const r of allRoles) {
        for (const recipient of PaymentErrorAlertService.getRecipientsByRole(r)) {
          recipientMap.set(recipient.id, recipient);
        }
      }

      recipients = Array.from(recipientMap.values());
    }

    res.json({
      timestamp: new Date(),
      count: recipients.length,
      role: role || 'all',
      recipients,
    });
  } catch (error) {
    logger.error('Error fetching alert recipients', { error });
    res.status(500).json({ error: 'Failed to fetch alert recipients' });
  }
});

/**
 * GET /api/admin/alerts/recipients/:recipientId
 * Get specific recipient
 */
router.get('/alerts/recipients/:recipientId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { recipientId } = req.params;
    const recipient = PaymentErrorAlertService.getRecipient(recipientId);

    if (!recipient) {
      return res.status(404).json({ error: 'Alert recipient not found' });
    }

    res.json({
      timestamp: new Date(),
      recipient,
    });
  } catch (error) {
    logger.error('Error fetching alert recipient', { error });
    res.status(500).json({ error: 'Failed to fetch alert recipient' });
  }
});

// ============================================================================
// ALERT HISTORY
// ============================================================================

/**
 * GET /api/admin/alerts/history
 * Get alert history with optional filtering
 */
router.get('/alerts/history', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const triggerId = req.query.triggerId as string | undefined;
    const severity = req.query.severity as string | undefined;

    let history;
    if (triggerId) {
      history = PaymentErrorAlertService.getAlertHistoryByTrigger(triggerId, limit);
    } else if (severity) {
      history = PaymentErrorAlertService.getAlertHistoryBySeverity(severity as AlertSeverity, limit);
    } else {
      history = PaymentErrorAlertService.getAlertHistory(limit);
    }

    res.json({
      timestamp: new Date(),
      count: history.length,
      filters: {
        triggerId: triggerId || null,
        severity: severity || null,
        limit,
      },
      alerts: history,
    });
  } catch (error) {
    logger.error('Error fetching alert history', { error });
    res.status(500).json({ error: 'Failed to fetch alert history' });
  }
});

/**
 * POST /api/admin/alerts/test-trigger
 * Manually fire an alert trigger for testing
 */
router.post('/alerts/test-trigger', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { triggerId, severity, message } = req.body;

    if (!triggerId || !severity || !message) {
      return res.status(400).json({
        error: 'Missing required fields: triggerId, severity, message',
      });
    }

    const trigger = PaymentErrorAlertService.getTrigger(triggerId);
    if (!trigger) {
      return res.status(404).json({ error: 'Alert trigger not found' });
    }

    // Fire test alert
    const alert = await PaymentErrorAlertService.fireAlert(
      triggerId,
      severity as AlertSeverity,
      message,
      'test_metric',
      100,
      50
    );

    res.json({
      timestamp: new Date(),
      alert,
      message: 'Test alert fired successfully',
    });
  } catch (error) {
    logger.error('Error firing test alert', { error });
    res.status(500).json({ error: 'Failed to fire test alert' });
  }
});

/**
 * GET /api/admin/alerts/status
 * Get overall alert system status
 */
router.get('/alerts/status', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const triggers = PaymentErrorAlertService.getAllTriggers();
    const recentHistory = PaymentErrorAlertService.getAlertHistory(100);

    // Calculate statistics
    const enabledTriggers = triggers.filter(t => t.enabled).length;
    const totalAlerts = recentHistory.length;
    const criticalAlerts = recentHistory.filter(a => a.severity === AlertSeverity.CRITICAL).length;
    const warningAlerts = recentHistory.filter(a => a.severity === AlertSeverity.WARNING).length;

    // Get most recent alert
    const mostRecentAlert = recentHistory[recentHistory.length - 1];

    res.json({
      timestamp: new Date(),
      system: {
        triggersConfigured: triggers.length,
        triggersEnabled: enabledTriggers,
        triggersDisabled: triggers.length - enabledTriggers,
      },
      recentAlerts: {
        total: totalAlerts,
        critical: criticalAlerts,
        warning: warningAlerts,
        info: totalAlerts - criticalAlerts - warningAlerts,
      },
      lastAlert: mostRecentAlert ? {
        timestamp: mostRecentAlert.timestamp,
        triggerId: mostRecentAlert.triggerId,
        severity: mostRecentAlert.severity,
        message: mostRecentAlert.message,
      } : null,
    });
  } catch (error) {
    logger.error('Error fetching alert status', { error });
    res.status(500).json({ error: 'Failed to fetch alert status' });
  }
});

/**
 * POST /api/admin/alerts/clear-history (DEV ONLY)
 * Clear alert history
 */
router.post('/alerts/clear-history', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Cannot clear alert history in production',
      });
    }

    PaymentErrorAlertService.clearHistory();
    logger.warn('Alert history cleared by admin');

    res.json({
      timestamp: new Date(),
      message: 'Alert history cleared',
    });
  } catch (error) {
    logger.error('Error clearing alert history', { error });
    res.status(500).json({ error: 'Failed to clear alert history' });
  }
});

export default router;
