import { Router } from 'express';
import type { Request } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { config } from '../../../shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logConsolidatedAuditEvent, AuditEventType } from '../../services/auditConsolidated';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

// Keys that should be masked or hidden from general admin response payloads
const SENSITIVE_KEYS = new Set(['smtp_password', 'jwt_secret', 'treasury_private_key', 'stripe_secret_key']);

function getAdminId(req: Request): string | null {
  return req.user?.userId || req.user?.claims?.sub || req.user?.id || null;
}

function parseSettingKey(key: string): string | null {
  const trimmed = key.trim();
  return trimmed.length > 0 && trimmed.length <= 100 && /^[a-zA-Z0-9_.-]+$/.test(trimmed) ? trimmed : null;
}

function maskSensitiveValue(key: string, value: string): string {
  if (!SENSITIVE_KEYS.has(key)) return value;
  if (!value || value.length < 8) return '********';
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

function stringifySettingValue(value: unknown): string {
  if (typeof value === 'string') return value;
  const serialized = JSON.stringify(value);
  return serialized ?? '';
}

async function auditSettingsAccess(req: Request, actionType: AuditEventType | string): Promise<void> {
  const actorId = getAdminId(req);
  if (!actorId) return;
  try {
    await logConsolidatedAuditEvent({
      actorId,
      actorType: 'super_admin',
      actorRole: 'super_admin',
      actionType,
      actionCategory: 'admin',
      targetType: 'system_config',
      targetId: 'global',
      endpoint: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      result: 'success',
      severity: 'low',
    });
  } catch (error) {
    logger.error('Settings audit logging failed:', error);
  }
}

async function auditSettingsMutation(req: Request, actionType: AuditEventType | string, key: string, metadata: Record<string, unknown>): Promise<void> {
  const actorId = getAdminId(req);
  if (!actorId) return;
  try {
    await logConsolidatedAuditEvent({
      actorId,
      actorType: 'super_admin',
      actorRole: 'super_admin',
      actionType,
      actionCategory: 'admin',
      targetType: 'system_config',
      targetId: key,
      endpoint: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      result: 'success',
      severity: 'high',
      metadata,
    });
  } catch (error) {
    logger.error('Settings mutation audit logging failed:', error);
  }
}

// GET /api/admin/settings - Retrieve system settings
router.get('/settings', requireSuperAdmin, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    const settingsList = await db.select().from(config);

    const formattedSettings = Object.fromEntries(
      settingsList.map(s => [s.key, maskSensitiveValue(s.key, String(s.value ?? ''))])
    );

    await auditSettingsAccess(req, 'ADMIN_SETTINGS_ACCESSED');

    res.json({
      success: true,
      settings: formattedSettings,
    });
  } catch (error) {
    logger.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings/:key - Update an existing system setting
router.put('/settings/:key', requireSuperAdmin, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    const key = parseSettingKey(req.params.key);
    if (!key) return res.status(400).json({ error: 'Invalid configuration key format' });

    const { value } = req.body;
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'A setting value is required' });
    }

    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // Verify key exists before updating
    const existing = await db.select().from(config).where(eq(config.key, key)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: `Setting key '${key}' not found` });
    }

    const previousValue = existing[0].value;

    const updated = await db
      .update(config)
      .set({ value: stringValue })
      .where(eq(config.key, key))
      .returning({ key: config.key, value: config.value });

    if (!updated.length) {
      return res.status(409).json({ error: 'Failed to update setting due to concurrent modification' });
    }

    await auditSettingsMutation(req, 'SYSTEM_SETTING_UPDATED', key, {
      key,
      previousValue: maskSensitiveValue(key, String(previousValue ?? '')),
      newValue: maskSensitiveValue(key, stringValue),
    });

    logger.info('System setting updated', { key, adminId });

    res.json({
      success: true,
      message: 'Setting updated successfully',
      setting: {
        key,
        value: maskSensitiveValue(key, stringifySettingValue(updated[0].value)),
      },
    });
  } catch (error) {
    logger.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;