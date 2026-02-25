/**
 * Enhanced Session Service
 * Advanced session management with biometric, notifications, and auto-extension
 */

import { db } from '../db';
import {
  walletSessions,
  wallets,
  users,
  sessionNotifications,
  pinResetRequests,
  biometricSettings,
  walletAccessLog,
} from '../../shared/schema';
import { eq, and, gt, lt, desc, or } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../utils/logger';

interface SessionExtensionConfig {
  autoExtend?: boolean;
  warningThresholdMinutes?: number; // Show warning when X minutes left
}

/**
 * Extend an active session
 * Called when user performs activity to auto-refresh timeout
 */
export async function extendWalletSession(
  sessionToken: string,
  config: SessionExtensionConfig = {}
): Promise<{ expiresAt: Date; extended: boolean }> {
  try {
    const session = await db.query.walletSessions.findFirst({
      where: eq(walletSessions.sessionToken, sessionToken),
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Check if auto-extend is enabled
    if (!session.autoExtendEnabled && !config.autoExtend) {
      return { expiresAt: session.expiresAt, extended: false };
    }

    // Check if session is still valid
    const now = new Date();
    if (session.expiresAt <= now) {
      throw new Error('Session has expired');
    }

    // Extend session by 24 hours from now
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db
      .update(walletSessions)
      .set({
        expiresAt: newExpiresAt,
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(walletSessions.sessionToken, sessionToken));

    logger.info(`Session extended for ${session.userId}`, {
      sessionToken: sessionToken.slice(0, 8) + '...',
      newExpiresAt,
    });

    return {
      expiresAt: newExpiresAt,
      extended: true,
    };
  } catch (error) {
    logger.error('Failed to extend session:', error);
    throw error;
  }
}

/**
 * Check if session is expiring soon and return warning data
 */
export async function checkSessionExpiry(
  sessionToken: string,
  warningThresholdMinutes: number = 30
): Promise<{
  isExpiringSoon: boolean;
  minutesRemaining: number;
  shouldShowWarning: boolean;
  expiresAt: Date;
}> {
  try {
    const session = await db.query.walletSessions.findFirst({
      where: eq(walletSessions.sessionToken, sessionToken),
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const now = new Date();
    const minutesRemaining = Math.floor(
      (session.expiresAt.getTime() - now.getTime()) / (60 * 1000)
    );

    const isExpiringSoon = minutesRemaining <= warningThresholdMinutes;
    const shouldShowWarning =
      isExpiringSoon && !session.warningShownAt;

    // Update warning shown timestamp if showing warning
    if (shouldShowWarning) {
      await db
        .update(walletSessions)
        .set({ warningShownAt: now })
        .where(eq(walletSessions.sessionToken, sessionToken));
    }

    return {
      isExpiringSoon,
      minutesRemaining: Math.max(0, minutesRemaining),
      shouldShowWarning,
      expiresAt: session.expiresAt,
    };
  } catch (error) {
    logger.error('Failed to check session expiry:', error);
    throw error;
  }
}

/**
 * Get all active sessions for a user with device info
 */
export async function getUserActiveSessions(
  userId: string
): Promise<Array<typeof walletSessions.$inferSelect>> {
  try {
    const now = new Date();
    const sessions = await db.query.walletSessions.findMany({
      where: and(
        eq(walletSessions.userId, userId),
        eq(walletSessions.isActive, true),
        gt(walletSessions.expiresAt, now)
      ),
      orderBy: desc(walletSessions.connectedAt),
    });

    return sessions;
  } catch (error) {
    logger.error('Failed to get user active sessions:', error);
    throw error;
  }
}

/**
 * Disconnect a specific session
 */
export async function disconnectSession(
  sessionId: string,
  userId: string
): Promise<void> {
  try {
    const now = new Date();

    const result = await db
      .update(walletSessions)
      .set({
        isActive: false,
        disconnectedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(walletSessions.id, sessionId),
          eq(walletSessions.userId, userId)
        )
      );

    logger.info(`Session disconnected for user ${userId}`, { sessionId });
  } catch (error) {
    logger.error('Failed to disconnect session:', error);
    throw error;
  }
}

/**
 * Create session notification for new login from other device
 */
export async function createSessionNotification(
  userId: string,
  sessionId: string,
  notificationData: {
    deviceName: string;
    location?: string;
    ipAddress?: string;
  }
): Promise<typeof sessionNotifications.$inferSelect> {
  try {
    const actionToken = crypto.randomBytes(16).toString('hex');
    const actionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const result = await db
      .insert(sessionNotifications)
      .values({
        userId,
        sessionId,
        notificationType: 'new_login',
        title: `New login on ${notificationData.deviceName}`,
        message: `Your wallet was accessed from a new device: ${notificationData.deviceName}${notificationData.location ? ` in ${notificationData.location}` : ''}. If this wasn't you, please review your account security.`,
        deviceName: notificationData.deviceName,
        location: notificationData.location,
        ipAddress: notificationData.ipAddress,
        actionRequired: true,
        actionToken,
        actionExpiresAt,
      })
      .returning();

    logger.info(`Session notification created for user ${userId}`, {
      sessionId,
      notificationType: 'new_login',
    });

    return result[0];
  } catch (error) {
    logger.error('Failed to create session notification:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  try {
    const now = new Date();

    await db
      .update(sessionNotifications)
      .set({
        isRead: true,
        readAt: now,
      })
      .where(eq(sessionNotifications.id, notificationId));

    logger.info(`Notification marked as read`, { notificationId });
  } catch (error) {
    logger.error('Failed to mark notification as read:', error);
    throw error;
  }
}

/**
 * Get unread notifications for user
 */
export async function getUserNotifications(
  userId: string,
  unreadOnly: boolean = false
): Promise<Array<typeof sessionNotifications.$inferSelect>> {
  try {
    const conditions = [eq(sessionNotifications.userId, userId)];

    if (unreadOnly) {
      conditions.push(eq(sessionNotifications.isRead, false));
    }

    const notifications = await db.query.sessionNotifications.findMany({
      where: and(...conditions),
      orderBy: desc(sessionNotifications.createdAt),
    });

    return notifications;
  } catch (error) {
    logger.error('Failed to get user notifications:', error);
    throw error;
  }
}

/**
 * Create PIN reset request
 */
export async function createPinResetRequest(
  userId: string,
  walletId: string,
  resetMethod: 'email' | 'sms'
): Promise<{
  resetToken: string;
  verificationCode: string;
}> {
  try {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const now = new Date();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const result = await db
      .insert(pinResetRequests)
      .values({
        userId,
        walletId,
        resetToken,
        resetMethod,
        verificationCode,
        verificationCodeExpiresAt,
        expiresAt,
      })
      .returning();

    logger.info(`PIN reset request created for user ${userId}`, {
      resetMethod,
      verificationCodeExpiresAt,
    });

    return {
      resetToken: result[0].resetToken,
      verificationCode: result[0].verificationCode || '',
    };
  } catch (error) {
    logger.error('Failed to create PIN reset request:', error);
    throw error;
  }
}

/**
 * Verify PIN reset code
 */
export async function verifyPinResetCode(
  resetToken: string,
  verificationCode: string
): Promise<boolean> {
  try {
    const now = new Date();

    const resetRequest = await db.query.pinResetRequests.findFirst({
      where: and(
        eq(pinResetRequests.resetToken, resetToken),
        eq(pinResetRequests.verificationCode, verificationCode),
        gt(pinResetRequests.verificationCodeExpiresAt, now),
        eq(pinResetRequests.isVerified, false)
      ),
    });

    if (!resetRequest) {
      return false;
    }

    // Mark as verified
    await db
      .update(pinResetRequests)
      .set({
        isVerified: true,
        verifiedAt: now,
      })
      .where(eq(pinResetRequests.resetToken, resetToken));

    logger.info(`PIN reset code verified`, { resetToken: resetToken.slice(0, 8) });

    return true;
  } catch (error) {
    logger.error('Failed to verify PIN reset code:', error);
    return false;
  }
}

/**
 * Complete PIN reset
 */
export async function completePinReset(
  resetToken: string,
  newPinHash: string
): Promise<void> {
  try {
    const now = new Date();

    // Get the reset request
    const resetRequest = await db.query.pinResetRequests.findFirst({
      where: eq(pinResetRequests.resetToken, resetToken),
    });

    if (!resetRequest || !resetRequest.isVerified) {
      throw new Error('Invalid or unverified reset request');
    }

    // Update the reset request as completed
    await db
      .update(pinResetRequests)
      .set({
        isCompleted: true,
        completedAt: now,
        newPinHash,
      })
      .where(eq(pinResetRequests.resetToken, resetToken));

    // Disconnect all sessions for this user to force re-login
    await db
      .update(walletSessions)
      .set({
        isActive: false,
        disconnectedAt: now,
        updatedAt: now,
      })
      .where(eq(walletSessions.userId, resetRequest.userId));

    logger.info(`PIN reset completed for user ${resetRequest.userId}`, {
      allSessionsDisconnected: true,
    });
  } catch (error) {
    logger.error('Failed to complete PIN reset:', error);
    throw error;
  }
}

/**
 * Enable biometric unlock for a device
 */
export async function enableBiometricUnlock(
  userId: string,
  deviceId: string,
  deviceName: string,
  biometricType: 'fingerprint' | 'face_id' | 'iris' | 'windows_hello',
  biometricPublicKey: string
): Promise<typeof biometricSettings.$inferSelect> {
  try {
    // Check if already enabled
    const existing = await db.query.biometricSettings.findFirst({
      where: and(
        eq(biometricSettings.userId, userId),
        eq(biometricSettings.deviceId, deviceId)
      ),
    });

    if (existing) {
      // Update existing
      const result = await db
        .update(biometricSettings)
        .set({
          biometricType,
          biometricPublicKey,
          isEnabled: true,
          updatedAt: new Date(),
        })
        .where(eq(biometricSettings.id, existing.id))
        .returning();

      return result[0];
    }

    // Create new
    const result = await db
      .insert(biometricSettings)
      .values({
        userId,
        deviceId,
        deviceName,
        biometricType,
        biometricPublicKey,
        isEnabled: true,
      })
      .returning();

    logger.info(`Biometric unlock enabled for user ${userId}`, {
      deviceId,
      biometricType,
    });

    return result[0];
  } catch (error) {
    logger.error('Failed to enable biometric unlock:', error);
    throw error;
  }
}

/**
 * Get biometric settings for a device
 */
export async function getBiometricSettings(
  userId: string,
  deviceId: string
): Promise<typeof biometricSettings.$inferSelect | null> {
  try {
    const settings = await db.query.biometricSettings.findFirst({
      where: and(
        eq(biometricSettings.userId, userId),
        eq(biometricSettings.deviceId, deviceId),
        eq(biometricSettings.isEnabled, true)
      ),
    });

    return settings || null;
  } catch (error) {
    logger.error('Failed to get biometric settings:', error);
    throw error;
  }
}

/**
 * Disable biometric unlock for a device
 */
export async function disableBiometricUnlock(
  userId: string,
  deviceId: string
): Promise<void> {
  try {
    await db
      .update(biometricSettings)
      .set({
        isEnabled: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(biometricSettings.userId, userId),
          eq(biometricSettings.deviceId, deviceId)
        )
      );

    logger.info(`Biometric unlock disabled for user ${userId}`, { deviceId });
  } catch (error) {
    logger.error('Failed to disable biometric unlock:', error);
    throw error;
  }
}

/**
 * Get session activity log
 */
export async function getSessionActivityLog(
  userId: string,
  limit: number = 50
): Promise<Array<typeof walletAccessLog.$inferSelect>> {
  try {
    const logs = await db.query.walletAccessLog.findMany({
      where: eq(walletAccessLog.userId, userId),
      orderBy: desc(walletAccessLog.createdAt),
      limit,
    });

    return logs;
  } catch (error) {
    logger.error('Failed to get session activity log:', error);
    throw error;
  }
}
