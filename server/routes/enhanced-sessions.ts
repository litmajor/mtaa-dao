/**
 * Enhanced Session Routes
 * API endpoints for advanced session management features
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  extendWalletSession,
  checkSessionExpiry,
  getUserActiveSessions,
  disconnectSession,
  createSessionNotification,
  markNotificationAsRead,
  getUserNotifications,
  createPinResetRequest,
  verifyPinResetCode,
  completePinReset,
  enableBiometricUnlock,
  getBiometricSettings,
  disableBiometricUnlock,
  getSessionActivityLog,
} from '../services/enhanced-session-service';
import { logger } from '../utils/logger';

const router = Router();

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
  validateRequest(z.object({ sessionToken: z.string() }).strict(), 'query'),
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
          isCurrent: session.sessionToken === (req as any).sessionToken, // Current session
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

      await markNotificationAsRead(notificationId);

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
      resetMethod: z.enum(['email', 'sms']),
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

      const { resetToken, verificationCode } = await createPinResetRequest(
        userId,
        walletId,
        resetMethod
      );

      // TODO: Send verification code via email or SMS
      // This should be handled by a separate email/SMS service
      logger.info(`PIN reset requested for user ${userId}`, {
        resetMethod,
        resetToken: resetToken.slice(0, 8),
      });

      res.json({
        success: true,
        data: {
          resetToken,
          message: `Verification code sent to your ${resetMethod}`,
          expiresIn: '15 minutes',
        },
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
  validateRequest(
    z.object({
      resetToken: z.string(),
      verificationCode: z.string().length(6),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resetToken, verificationCode } = req.body;

      const isValid = await verifyPinResetCode(resetToken, verificationCode);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired verification code',
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
  validateRequest(
    z.object({
      resetToken: z.string(),
      newPin: z.string().length(4).regex(/^\d+$/),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resetToken, newPin } = req.body;
      const crypto = await import('crypto');
      const pbkdf2 = crypto.default.pbkdf2Sync;

      // Hash new PIN
      const salt = crypto.default.randomBytes(32).toString('hex');
      const newPinHash = pbkdf2(newPin, salt, 100000, 64, 'sha512').toString(
        'hex'
      );

      await completePinReset(resetToken, newPinHash);

      res.json({
        success: true,
        message:
          'PIN reset completed successfully. Please log in with your new PIN.',
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
  validateRequest(
    z.object({ deviceId: z.string() }).strict(),
    'query'
  ),
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
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

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
