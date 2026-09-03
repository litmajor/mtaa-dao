/**
 * Enhanced Session Routes
 * API endpoints for advanced session management features
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { users, wallets } from '../../shared/schema';
import { authenticateToken } from '../middleware/auth';
import { validate, validateRequest } from '../middleware/validation';
import {
  extendWalletSession,
  checkSessionExpiry,
  getUserActiveSessions,
  disconnectSession,
  createSessionNotification,
  markNotificationAsRead,
  getUserNotifications,
  enableBiometricUnlock,
  getBiometricSettings,
  disableBiometricUnlock,
  getSessionActivityLog,
} from '../services/enhanced-session-service';
import { requestPINReset, resetPIN } from '../services/pin-service';
import { otpService } from '../services/otpService';
import { logger } from '../utils/logger';

const router = Router();

const getCurrentSessionToken = (req: Request): string | undefined => {
  const value = req.headers['x-wallet-session'];
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return undefined;
};

const getAuthenticatedProfile = async (userId: string) => {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
};

const ensureWalletOwnership = async (walletId: string, userId: string) => {
  const wallet = await db.query.wallets.findFirst({
    where: and(eq(wallets.id, walletId), eq(wallets.userId, userId)),
  });

  if (!wallet) {
    throw Object.assign(new Error('Wallet not found for this user'), { statusCode: 403 });
  }

  return wallet;
};

const parsePositiveLimit = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.max(1, Math.min(parsed, max));
};

/**
 * POST /api/sessions/extend
 * Extend active session with auto-refresh
 */
router.post(
  '/extend',
  authenticateToken,
  validateRequest(
    z.object({
      sessionToken: z.string(),
      autoExtend: z.boolean().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionToken, autoExtend } = req.body;

      const result = await extendWalletSession(sessionToken, {
        autoExtend,
        warningThresholdMinutes: 30,
      });

      res.json({
        success: true,
        data: result,
        message: result.extended
          ? 'Session extended for 24 hours'
          : 'Session auto-extend is disabled',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sessions/expiry-check
 * Check if session is expiring soon
 */
router.get(
  '/expiry-check',
  authenticateToken,
  validate({
    query: z.object({ sessionToken: z.string() }).strict(),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionToken } = req.query;

      const result = await checkSessionExpiry(sessionToken as string, 30);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sessions/active
 * Get all active sessions for current user (device management)
 */
router.get(
  '/active',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const sessions = await getUserActiveSessions(userId);

      res.json({
        success: true,
        data: sessions.map((session) => ({
          id: session.id,
          deviceName: session.deviceName || 'Unknown Device',
          deviceId: session.deviceId,
          ipAddress: session.ipAddress,
          location: session.location,
          connectedAt: session.connectedAt,
          lastAccessedAt: session.lastAccessedAt,
          expiresAt: session.expiresAt,
          biometricEnabled: session.biometricEnabled,
          isCurrent: !!getCurrentSessionToken(req) && session.sessionToken === getCurrentSessionToken(req),
        })),
        count: sessions.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sessions/:sessionId/disconnect
 * Disconnect a specific session (log out from a device)
 */
router.post(
  '/:sessionId/disconnect',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      await disconnectSession(sessionId, userId);

      res.json({
        success: true,
        message: 'Session disconnected successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sessions/notifications
 * Get all notifications for user
 */
router.get(
  '/notifications',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const unreadOnly = req.query.unreadOnly === 'true';

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const notifications = await getUserNotifications(userId, unreadOnly);

      const unreadCount = notifications.filter((n) => !n.isRead).length;

      res.json({
        success: true,
        data: notifications,
        unreadCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sessions/notifications/:notificationId/read
 * Mark a notification as read
 */
router.post(
  '/notifications/:notificationId/read',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { notificationId } = req.params;

      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const updated = await markNotificationAsRead(notificationId, userId);

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found or not owned by this user',
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sessions/pin-reset/request
 * Request PIN reset via email or SMS
 */
router.post(
  '/pin-reset/request',
  authenticateToken,
  validateRequest(
    z.object({
      walletId: z.string().uuid(),
      resetMethod: z.enum(['email', 'sms']).optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { walletId, resetMethod } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      await ensureWalletOwnership(walletId, userId);

      const profile = await getAuthenticatedProfile(userId);
      const targetEmail = profile?.email || undefined;
      const targetPhone = profile?.phone || undefined;

      if (!targetEmail && !targetPhone) {
        return res.status(400).json({
          success: false,
          error: 'No verified email or phone is associated with this account',
        });
      }

      const effectiveMethod = resetMethod || (targetEmail ? 'email' : 'sms');
      const result = await requestPINReset(
        walletId,
        userId,
        effectiveMethod === 'sms' ? targetPhone : undefined,
        effectiveMethod === 'email' ? targetEmail : undefined
      );

      logger.info(`PIN reset requested for user ${userId}`, {
        walletId,
        resetMethod: effectiveMethod,
      });

      res.json({
        success: result.success,
        data: {
          message: result.message || 'Verification code sent',
          expiresIn: '5 minutes',
        },
        error: result.error,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sessions/pin-reset/verify
 * Verify PIN reset code
 */
router.post(
  '/pin-reset/verify',
  authenticateToken,
  validateRequest(
    z.object({
      walletId: z.string().uuid(),
      verificationCode: z.string().min(4),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { walletId, verificationCode } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      await ensureWalletOwnership(walletId, userId);

      const profile = await getAuthenticatedProfile(userId);
      const contact = profile?.email || profile?.phone;

      if (!contact) {
        return res.status(400).json({
          success: false,
          error: 'No verified email or phone is associated with this account',
        });
      }

      const identifier = contact.includes('@') ? `email:${userId}:${contact}` : `phone:${userId}:${contact}`;
      const verification = await otpService.verifyOTP(identifier, verificationCode);

      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          error: verification.error || 'Invalid or expired verification code',
        });
      }

      res.json({
        success: true,
        message: 'Verification code verified successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sessions/pin-reset/complete
 * Complete PIN reset with new PIN
 */
router.post(
  '/pin-reset/complete',
  authenticateToken,
  validateRequest(
    z.object({
      walletId: z.string().uuid(),
      verificationCode: z.string().min(4),
      newPin: z.string().length(4).regex(/^\d+$/),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { walletId, verificationCode, newPin } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      await ensureWalletOwnership(walletId, userId);

      const profile = await getAuthenticatedProfile(userId);
      const contact = profile?.email || profile?.phone;

      if (!contact) {
        return res.status(400).json({
          success: false,
          error: 'No verified email or phone is associated with this account',
        });
      }

      const identifier = contact.includes('@') ? `email:${userId}:${contact}` : `phone:${userId}:${contact}`;
      const verification = await otpService.verifyOTP(identifier, verificationCode);

      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          error: verification.error || 'Invalid or expired verification code',
        });
      }

      const result = await resetPIN(walletId, userId, contact, verificationCode, newPin);

      res.json({
        success: result.success,
        message: result.message || 'PIN reset completed successfully',
        error: result.error,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sessions/biometric/enable
 * Enable biometric unlock for current device
 */
router.post(
  '/biometric/enable',
  authenticateToken,
  validateRequest(
    z.object({
      deviceId: z.string(),
      deviceName: z.string(),
      biometricType: z.enum(['fingerprint', 'face_id', 'iris', 'windows_hello']),
      biometricPublicKey: z.string(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { deviceId, deviceName, biometricType, biometricPublicKey } =
        req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const biometric = await enableBiometricUnlock(
        userId,
        deviceId,
        deviceName,
        biometricType,
        biometricPublicKey
      );

      res.json({
        success: true,
        data: {
          id: biometric.id,
          deviceName: biometric.deviceName,
          biometricType: biometric.biometricType,
          enabled: biometric.isEnabled,
        },
        message: `${biometricType} unlock enabled for ${deviceName}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sessions/biometric/status
 * Get biometric unlock status for current device
 */
router.get(
  '/biometric/status',
  authenticateToken,
  validate({
    query: z.object({ deviceId: z.string() }).strict(),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { deviceId } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const biometric = await getBiometricSettings(userId, deviceId as string);

      res.json({
        success: true,
        data: {
          enabled: !!biometric,
          biometricType: biometric?.biometricType || null,
          lastUsedAt: biometric?.lastUsedAt || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sessions/biometric/disable
 * Disable biometric unlock for a device
 */
router.post(
  '/biometric/disable',
  authenticateToken,
  validateRequest(
    z.object({
      deviceId: z.string(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { deviceId } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      await disableBiometricUnlock(userId, deviceId);

      res.json({
        success: true,
        message: 'Biometric unlock disabled for this device',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sessions/activity-log
 * Get session activity log
 */
router.get(
  '/activity-log',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const limit = parsePositiveLimit(req.query.limit, 50, 100);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const activityLog = await getSessionActivityLog(userId, limit);

      res.json({
        success: true,
        data: activityLog.map((log) => ({
          id: log.id,
          action: log.action,
          status: log.status,
          deviceInfo: log.userAgent || 'Unknown Device',
          ipAddress: log.ipAddress,
          location: log.metadata,
          timestamp: log.createdAt,
        })),
        count: activityLog.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
