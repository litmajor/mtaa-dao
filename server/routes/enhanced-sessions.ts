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
  enableBiometricUnlock,
  getBiometricSettings,
  disableBiometricUnlock,
  getSessionActivityLog,
} from '../services/enhanced-session-service';
import { requestPINReset, resetPIN } from '../services/pin-service';
import { otpService } from '../services/otpService';
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
      resetMethod: z.enum(['email', 'sms']).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { walletId, resetMethod, email, phone } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const targetEmail = resetMethod === 'email' ? email : undefined;
      const targetPhone = resetMethod === 'sms' ? phone : undefined;

      if (!targetEmail && !targetPhone) {
        return res.status(400).json({
          success: false,
          error: 'An email or phone number is required for PIN reset',
        });
      }

      const result = await requestPINReset(walletId, userId, targetPhone, targetEmail);

      logger.info(`PIN reset requested for user ${userId}`, {
        walletId,
        resetMethod: resetMethod || (targetEmail ? 'email' : 'sms'),
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
  validateRequest(
    z.object({
      walletId: z.string().uuid(),
      verificationCode: z.string().min(4),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { walletId, verificationCode, email, phone } = req.body;
      const contact = email || phone;

      if (!contact) {
        return res.status(400).json({
          success: false,
          error: 'An email or phone number is required',
        });
      }

      const identifier = email ? `email:${walletId}:${email}` : `phone:${walletId}:${phone}`;
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
  validateRequest(
    z.object({
      walletId: z.string().uuid(),
      verificationCode: z.string().min(4),
      newPin: z.string().length(4).regex(/^\d+$/),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { walletId, verificationCode, newPin, email, phone } = req.body;
      const contact = email || phone;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!contact) {
        return res.status(400).json({
          success: false,
          error: 'An email or phone number is required',
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
