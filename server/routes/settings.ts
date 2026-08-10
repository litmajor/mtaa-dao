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
import { isAuthenticated } from '../auth';
import { verifyPassword } from '../auth';
import { adminTOTPService } from '../services/admin-totp-service';
import { logger } from '../utils/logger';
import { AppError, ValidationError } from '../middleware/errorHandler';
import { env, isProduction } from '../../shared/config';
import { z } from 'zod';

const router = express.Router();

/**
 * Encryption utilities for sensitive data (API keys, secrets)
 *
 * SECURITY NOTE: this derives a single deterministic key from a static
 * master key + static salt. Every secret in the table is encrypted under
 * the same key. If ENCRYPTION_KEY leaks, every stored credential leaks.
 * A stronger design is envelope encryption (unique data key per record,
 * itself wrapped by a master key/KMS). Flagging this as a follow-up —
 * not fixed inline here since it's a data-migration-shaped change
 * (existing rows would need re-encryption), not a drop-in swap.
 */
const ENCRYPTION_KEY = String(env.ENCRYPTION_KEY ?? '');
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SALT = String(env.ENCRYPTION_SALT ?? '');

if (!ENCRYPTION_KEY || !SALT) {
  const message = 'Encryption configuration is missing. Set ENCRYPTION_KEY and ENCRYPTION_SALT before starting the server.';
  if (isProduction) {
    throw new Error(message);
  }
  logger.warn(message);
}

/**
 * Derive the encryption key ONCE at module load, not per request.
 * The inputs (master key, salt) are static, so the output is deterministic —
 * recomputing it per call via pbkdf2Sync (100k rounds, synchronous) just
 * blocks the event loop for no security benefit.
 *
 * NOTE: this still falls back to a hardcoded salt outside production, which
 * is inconsistent with the throw-in-production guard above. Left as-is
 * behaviorally (not silently changing your dev experience), but worth
 * deciding deliberately rather than leaving two guards that disagree.
 */
function deriveKey(masterKey: string, salt: string): Buffer {
  const effectiveSalt = salt || 'default-salt';
  return crypto.pbkdf2Sync(masterKey, effectiveSalt, 100000, 32, 'sha256');
}

const DERIVED_KEY = deriveKey(ENCRYPTION_KEY, SALT);

/**
 * Encrypt sensitive data
 */
function encryptData(data: string): string {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, DERIVED_KEY, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return: iv.authTag.encrypted
    return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted}`;
  } catch (error) {
    logger.error('Encryption failed', error as Error);
    throw new AppError('Failed to encrypt data', 500);
  }
}

/**
 * Decrypt sensitive data.
 *
 * INTENTIONALLY NOT EXPORTED, NOT EXPOSED VIA ANY ROUTE.
 * This exists only for internal server use (e.g. an exchange-execution
 * service that needs the plaintext key to sign a request to the exchange).
 * Never wire this to an HTTP response — see the removed decrypt route below.
 */
function decryptData(encryptedData: string): string {
  try {
    const parts = encryptedData.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0] ?? '', 'hex');
    const authTag = Buffer.from(parts[1] ?? '', 'hex');
    const encrypted = parts[2] ?? '';

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, DERIVED_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', error as Error);
    throw new AppError('Failed to decrypt data', 500);
  }
}

/**
 * If your exchange-execution service lives in this same process, import
 * decryptData directly there instead of exporting it broadly — keep the
 * blast radius of "who can call decrypt" as small as possible.
 * If it's a separate service, that's the actual argument for envelope
 * encryption / a secrets manager rather than passing plaintext in-process.
 */
export { decryptData as __internal_decryptExchangeSecret };

/**
 * Mask a secret for display: show only the last N characters.
 * Never returns enough of the value to reconstruct it.
 */
function maskSecret(plaintext: string, visibleChars = 4): string {
  if (plaintext.length <= visibleChars) return '*'.repeat(plaintext.length);
  return '*'.repeat(plaintext.length - visibleChars) + plaintext.slice(-visibleChars);
}

// ========================================
// Step-up auth stub — WIRE THIS UP
// ========================================
/**
 * Placeholder for re-verifying the user's identity before a
 * security-sensitive change (disabling 2FA, changing 2FA method).
 * Replace the body with a real check against your auth system:
 * current password comparison, or a valid current TOTP code.
 *
 * Returns true only if the user has proven they're still who they say
 * they are, beyond just holding a valid session.
 */
async function verifyStepUpAuth(
  userId: string,
  credentials: { password?: string; totpCode?: string }
): Promise<boolean> {
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRows[0];
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (credentials.password) {
    const passwordMatches = await verifyPassword(credentials.password, user.password);
    if (passwordMatches) {
      return true;
    }
  }

  if (credentials.totpCode) {
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    const encryptionKey = process.env.TWO_FA_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new AppError('Two-factor encryption key is not configured', 500);
    }

    let secretData: { ciphertext: string; iv: string; authTag: string };
    try {
      secretData = JSON.parse(user.twoFactorSecret as string);
    } catch {
      return false;
    }

    const isValidTotp = adminTOTPService.verify2FACode(
      credentials.totpCode,
      {
        ciphertext: secretData.ciphertext,
        iv: secretData.iv,
        authTag: secretData.authTag,
      },
      encryptionKey
    );

    if (isValidTotp) {
      return true;
    }
  }

  return false;
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
  sessionTimeout: z.number().int().positive().optional(),
  highContrast: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  notifyGovernance: z.boolean().optional(),
  notifyTreasury: z.boolean().optional(),
  notifyMorio: z.boolean().optional(),
  notifyWeeklySummary: z.boolean().optional(),
  // twoFactorEnabled / twoFactorMethod intentionally REMOVED from here.
  // They now live behind /api/settings/security, which requires step-up auth.
});

const updateSecuritySettingsSchema = z.object({
  twoFactorEnabled: z.boolean().optional(),
  twoFactorMethod: z.enum(['authenticator', 'sms', 'email']).optional(),
  // Step-up credentials — not persisted, only used to verify identity.
  password: z.string().optional(),
  totpCode: z.string().optional(),
}).refine((data) => data.password || data.totpCode, {
  message: 'password or totpCode is required to change security settings',
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

// Explicit allow-list for feature preferences — replaces the previous
// `const data = req.body` mass-assignment pattern. Add fields here
// deliberately as the feature set grows; anything not listed is dropped.
const updateFeaturePreferencesSchema = z.object({
  advancedMode: z.boolean().optional(),
  defaultPersona: z.enum(['okedi', 'yuki', 'amara']).optional(),
  defaultDashboardLayout: z.string().max(50).optional(),
  showTestnetFeatures: z.boolean().optional(),
  autoRebalance: z.boolean().optional(),
  // Extend deliberately — never spread raw req.body into a DB update.
}).strict(); // .strict() rejects unknown keys outright rather than silently dropping them

// GET /api/settings - Get all user settings
router.get('/all', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user!.id;

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

// PUT /api/settings/update - Update general (non-security) user settings
router.put('/update', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user!.id;
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

    logger.info(`User ${userId} updated settings`, { userId });
    res.json({ success: true, settings: updated[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid settings data'));
    }
    next(error);
  }
});

// PUT /api/settings/security - Update 2FA settings, gated by step-up auth
router.put('/security', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { password, totpCode, ...data } = updateSecuritySettingsSchema.parse(req.body);

    const verified = await verifyStepUpAuth(userId, { password, totpCode });
    if (!verified) {
      logger.warn(`User ${userId} failed step-up auth for security settings change`, { userId });
      return next(new AppError('Re-authentication failed', 403));
    }

    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    if (!existing.length) {
      await db.insert(userSettings).values({ userId });
    }

    const updated = await db
      .update(userSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId))
      .returning();

    logger.info(`User ${userId} updated security settings`, { userId, fields: Object.keys(data) });
    res.json({ success: true, settings: updated[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid security settings data'));
    }
    next(error);
  }
});

// ========================================
// Exchange API Keys Management
// ========================================

// GET /api/settings/api-keys - List all API keys (never includes secrets)
router.get('/api-keys', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user!.id;

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
    const userId = req.user!.id;
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

    logger.info(`User ${userId} added ${data.exchange} API key`, { userId, exchange: data.exchange });

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
      return next(new ValidationError('Invalid API key data'));
    }
    next(error);
  }
});

// GET /api/settings/api-keys/:id/reveal - Return a MASKED version only.
// This replaces the old .../decrypt route. It never returns enough of the
// secret to reconstruct it — only the last few characters, for the user
// to visually confirm which key is which (e.g. "ends in 4f2a").
router.get('/api-keys/:id/reveal', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

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

    const plaintextKey = decryptData(key[0].apiKey);

    res.json({
      success: true,
      apiKey: {
        id: key[0].id,
        exchange: key[0].exchange,
        label: key[0].label,
        maskedKey: maskSecret(plaintextKey),
        // apiSecret / apiPassphrase are never returned, masked or otherwise —
        // there's no legitimate display use case for the secret itself,
        // only for the public-ish key identifier.
        isActive: key[0].isActive,
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/settings/api-keys/:id - Delete API key
router.delete('/api-keys/:id', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user!.id;
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

    logger.info(`User ${userId} deleted API key`, { userId, keyId: id });
    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/api-keys/:id - Update API key (label / active status only)
router.put('/api-keys/:id', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user!.id;
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
    const userId = req.user!.id;

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
    const userId = req.user!.id;
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
      return next(new ValidationError('Invalid device data'));
    }
    next(error);
  }
});

// DELETE /api/settings/devices/:id - Remove device record.
// NOTE: this only deletes the bookkeeping row. If your session/token
// validation doesn't also check connectedDevices on each request, this
// does NOT revoke an active session for that device — it just stops it
// from showing in the list. Confirm this against your auth middleware;
// if there's no live check, this route needs to also revoke the
// corresponding session/refresh token server-side.
router.delete('/devices/:id', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user!.id;
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

    logger.info(`User ${userId} removed device`, { userId, deviceId: id });
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
    const userId = req.user!.id;

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
    const userId = req.user!.id;
    // Validated + allow-listed — replaces the previous raw `req.body` spread.
    const data = updateFeaturePreferencesSchema.parse(req.body);

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
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Invalid preferences data'));
    }
    next(error);
  }
});

export default router;