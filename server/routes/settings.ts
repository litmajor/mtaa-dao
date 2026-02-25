/**
 * User Settings Routes
 * 
 * Comprehensive settings management for:
 * - User preferences
 * - API keys (exchange, integrations)
 * - Security settings
 * - Notification preferences
 * - Connected devices
 * - Feature preferences
 */

import express from 'express';
import crypto from 'crypto';
import { db } from '../db';
import {
  userSettings,
  exchangeApiKeys,
  connectedDevices,
  featurePreferences,
  apiQuotas,
  users,
} from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { isAuthenticated } from '../nextAuthMiddleware';
import { Logger } from '../utils/logger';
import { AppError, ValidationError } from '../middleware/errorHandler';
import { z } from 'zod';

const router = express.Router();

/**
 * Encryption utilities for sensitive data (API keys, secrets)
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SALT = process.env.ENCRYPTION_SALT || crypto.randomBytes(16).toString('hex');

/**
 * Derive encryption key from master key
 */
function deriveKey(masterKey: string): Buffer {
  return crypto
    .pbkdf2Sync(masterKey, SALT, 100000, 32, 'sha256');
}

/**
 * Encrypt sensitive data
 */
function encryptData(data: string): string {
  try {
    const iv = crypto.randomBytes(12);
    const key = deriveKey(ENCRYPTION_KEY);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return: iv.authTag.encrypted
    return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted}`;
  } catch (error) {
    Logger.error('Encryption failed', { error: (error as Error).message });
    throw new AppError('Failed to encrypt data', 500);
  }
}

/**
 * Decrypt sensitive data
 */
function decryptData(encryptedData: string): string {
  try {
    const parts = encryptedData.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = deriveKey(ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    Logger.error('Decryption failed', { error: (error as Error).message });
    throw new AppError('Failed to decrypt data', 500);
  }
}

// Validation schemas
const updateUserSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  fontSize: z.enum(['small', 'normal', 'large', 'xlarge']).optional(),
  language: z.string().length(2).optional(),
  timezone: z.string().optional(),
  preferredCurrency: z.string().length(3).optional(),
  profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
  activityVisibility: z.enum(['public', 'members', 'private']).optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
  twoFactorMethod: z.enum(['authenticator', 'sms', 'email']).optional(),
  sessionTimeout: z.number().int().positive().optional(),
  highContrast: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
});

const addApiKeySchema = z.object({
  exchange: z.string().min(1).max(50),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  apiPassphrase: z.string().optional(),
  label: z.string().max(100).optional(),
});

const updateConnectedDeviceSchema = z.object({
  deviceName: z.string().max(100).optional(),
  isTrustedDevice: z.boolean().optional(),
});

// GET /api/settings - Get all user settings
router.get('/all', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get or create user settings
    let settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    if (!settings.length) {
      // Create default settings
      await db.insert(userSettings).values({
        userId,
      });
      settings = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
    }

    // Get feature preferences
    const prefs = await db
      .select()
      .from(featurePreferences)
      .where(eq(featurePreferences.userId, userId));

    // Get API quotas
    const quotas = await db
      .select()
      .from(apiQuotas)
      .where(eq(apiQuotas.userId, userId));

    res.json({
      settings: settings[0],
      preferences: prefs[0] || null,
      quotas: quotas[0] || null,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings - Update user settings
router.put('/update', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = updateUserSettingsSchema.parse(req.body);

    // Ensure settings exist
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    if (!existing.length) {
      await db.insert(userSettings).values({ userId });
    }

    // Update settings
    const updated = await db
      .update(userSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId))
      .returning();

    Logger.info(`User ${userId} updated settings`, { userId });
    res.json({ success: true, settings: updated[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid settings data', { errors: error.errors }));
    }
    next(error);
  }
});

// ========================================
// Exchange API Keys Management
// ========================================

// GET /api/settings/api-keys - List all API keys
router.get('/api-keys', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const keys = await db
      .select({
        id: exchangeApiKeys.id,
        exchange: exchangeApiKeys.exchange,
        label: exchangeApiKeys.label,
        isActive: exchangeApiKeys.isActive,
        lastUsedAt: exchangeApiKeys.lastUsedAt,
        createdAt: exchangeApiKeys.createdAt,
        // Don't return actual keys
      })
      .from(exchangeApiKeys)
      .where(eq(exchangeApiKeys.userId, userId));

    res.json({ apiKeys: keys });
  } catch (error) {
    next(error);
  }
});

// POST /api/settings/api-keys - Add new API key
router.post('/api-keys', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = addApiKeySchema.parse(req.body);

    // Encrypt the sensitive keys before storing
    const encrypted = {
      apiKey: encryptData(data.apiKey),
      apiSecret: encryptData(data.apiSecret),
      apiPassphrase: data.apiPassphrase ? encryptData(data.apiPassphrase) : null,
    };

    const [newKey] = await db
      .insert(exchangeApiKeys)
      .values({
        userId,
        exchange: data.exchange,
        apiKey: encrypted.apiKey,
        apiSecret: encrypted.apiSecret,
        apiPassphrase: encrypted.apiPassphrase,
        label: data.label || `${data.exchange} API Key`,
        isActive: true,
      })
      .returning();

    Logger.info(`User ${userId} added ${data.exchange} API key`, { userId, exchange: data.exchange });

    res.status(201).json({
      success: true,
      apiKey: {
        id: newKey.id,
        exchange: newKey.exchange,
        label: newKey.label,
        isActive: newKey.isActive,
        createdAt: newKey.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid API key data', { errors: error.errors }));
    }
    next(error);
  }
});

// GET /api/settings/api-keys/:id/decrypt - Get decrypted API key (use with caution)
router.get('/api-keys/:id/decrypt', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify ownership
    const key = await db
      .select()
      .from(exchangeApiKeys)
      .where(
        and(
          eq(exchangeApiKeys.id, id),
          eq(exchangeApiKeys.userId, userId)
        )
      )
      .limit(1);

    if (!key[0]) {
      return next(new AppError('API key not found', 404));
    }

    // Decrypt the keys
    const decryptedKey = {
      id: key[0].id,
      exchange: key[0].exchange,
      label: key[0].label,
      apiKey: decryptData(key[0].apiKey),
      apiSecret: decryptData(key[0].apiSecret),
      apiPassphrase: key[0].apiPassphrase ? decryptData(key[0].apiPassphrase) : null,
      isActive: key[0].isActive,
    };

    Logger.warn(`User ${userId} retrieved decrypted API key for ${key[0].exchange}`, { userId });

    res.json({
      success: true,
      apiKey: decryptedKey,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/settings/api-keys/:id - Delete API key
router.delete('/api-keys/:id', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify ownership
    const key = await db
      .select()
      .from(exchangeApiKeys)
      .where(
        and(
          eq(exchangeApiKeys.id, id),
          eq(exchangeApiKeys.userId, userId)
        )
      );

    if (!key.length) {
      throw new AppError('API key not found', 404);
    }

    await db
      .delete(exchangeApiKeys)
      .where(eq(exchangeApiKeys.id, id));

    Logger.info(`User ${userId} deleted API key`, { userId, keyId: id });
    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/api-keys/:id - Update API key
router.put('/api-keys/:id', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { label, isActive } = req.body;

    // Verify ownership
    const key = await db
      .select()
      .from(exchangeApiKeys)
      .where(
        and(
          eq(exchangeApiKeys.id, id),
          eq(exchangeApiKeys.userId, userId)
        )
      );

    if (!key.length) {
      throw new AppError('API key not found', 404);
    }

    const [updated] = await db
      .update(exchangeApiKeys)
      .set({
        label: label || key[0].label,
        isActive: isActive !== undefined ? isActive : key[0].isActive,
        updatedAt: new Date(),
      })
      .where(eq(exchangeApiKeys.id, id))
      .returning();

    res.json({
      success: true,
      apiKey: {
        id: updated.id,
        exchange: updated.exchange,
        label: updated.label,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// Connected Devices Management
// ========================================

// GET /api/settings/devices - List connected devices
router.get('/devices', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const devices = await db
      .select()
      .from(connectedDevices)
      .where(eq(connectedDevices.userId, userId));

    res.json({ devices });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/devices/:id - Update device settings
router.put('/devices/:id', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const data = updateConnectedDeviceSchema.parse(req.body);

    // Verify ownership
    const device = await db
      .select()
      .from(connectedDevices)
      .where(
        and(
          eq(connectedDevices.id, id),
          eq(connectedDevices.userId, userId)
        )
      );

    if (!device.length) {
      throw new AppError('Device not found', 404);
    }

    const [updated] = await db
      .update(connectedDevices)
      .set({
        deviceName: data.deviceName || device[0].deviceName,
        isTrustedDevice: data.isTrustedDevice !== undefined ? data.isTrustedDevice : device[0].isTrustedDevice,
        updatedAt: new Date(),
      })
      .where(eq(connectedDevices.id, id))
      .returning();

    res.json({ success: true, device: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid device data', { errors: error.errors }));
    }
    next(error);
  }
});

// DELETE /api/settings/devices/:id - Logout from device
router.delete('/devices/:id', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify ownership
    const device = await db
      .select()
      .from(connectedDevices)
      .where(
        and(
          eq(connectedDevices.id, id),
          eq(connectedDevices.userId, userId)
        )
      );

    if (!device.length) {
      throw new AppError('Device not found', 404);
    }

    await db
      .delete(connectedDevices)
      .where(eq(connectedDevices.id, id));

    Logger.info(`User ${userId} removed device`, { userId, deviceId: id });
    res.json({ success: true, message: 'Device removed' });
  } catch (error) {
    next(error);
  }
});

// ========================================
// Feature Preferences
// ========================================

// GET /api/settings/preferences - Get feature preferences
router.get('/preferences', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;

    let prefs = await db
      .select()
      .from(featurePreferences)
      .where(eq(featurePreferences.userId, userId));

    if (!prefs.length) {
      // Create default preferences
      await db.insert(featurePreferences).values({ userId });
      prefs = await db
        .select()
        .from(featurePreferences)
        .where(eq(featurePreferences.userId, userId));
    }

    res.json({ preferences: prefs[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/preferences - Update feature preferences
router.put('/preferences', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = req.body;

    // Ensure preferences exist
    const existing = await db
      .select()
      .from(featurePreferences)
      .where(eq(featurePreferences.userId, userId));

    if (!existing.length) {
      await db.insert(featurePreferences).values({ userId });
    }

    const [updated] = await db
      .update(featurePreferences)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(featurePreferences.userId, userId))
      .returning();

    res.json({ success: true, preferences: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
