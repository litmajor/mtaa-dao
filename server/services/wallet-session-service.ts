/**
 * Wallet Session Service
 * Manages wallet connection sessions for PIN-based access
 * Users can access wallets with PIN instead of seedphrase when session is active
 */

import { db } from '../db';
import { walletSessions, wallets, users } from '../../shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../utils/logger';

interface WalletSessionConfig {
  sessionTimeoutHours?: number; // Default 24 hours
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

/**
 * Create a new wallet session when wallet is connected
 * Session allows PIN-based access without requiring seedphrase
 */
export async function createWalletSession(
  walletId: string,
  userId: string,
  config: WalletSessionConfig = {}
): Promise<{ sessionToken: string; expiresAt: Date }> {
  try {
    const sessionTimeoutHours = config.sessionTimeoutHours || 24;
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + sessionTimeoutHours * 60 * 60 * 1000);

    const result = await db.insert(walletSessions).values({
      walletId,
      userId,
      sessionToken,
      isActive: true,
      connectedAt: new Date(),
      expiresAt,
      ipAddress: config.ipAddress,
      userAgent: config.userAgent,
      deviceId: config.deviceId,
    }).returning();

    logger.info(`Wallet session created for user ${userId} on wallet ${walletId}`, {
      sessionToken: sessionToken.slice(0, 8) + '...',
      expiresAt,
    });

    return {
      sessionToken,
      expiresAt,
    };
  } catch (error) {
    logger.error('Failed to create wallet session:', error);
    throw new Error('Failed to create wallet session');
  }
}

/**
 * Get active wallet session for a user
 */
export async function getActiveWalletSession(
  userId: string,
  walletId: string
): Promise<typeof walletSessions.$inferSelect | null> {
  try {
    const now = new Date();
    const session = await db.query.walletSessions.findFirst({
      where: and(
        eq(walletSessions.userId, userId),
        eq(walletSessions.walletId, walletId),
        eq(walletSessions.isActive, true),
        gt(walletSessions.expiresAt, now)
      ),
    });

    if (session) {
      // Update last accessed timestamp
      await db.update(walletSessions)
        .set({ lastAccessedAt: now })
        .where(eq(walletSessions.id, session.id));
    }

    return session || null;
  } catch (error) {
    logger.error('Failed to get wallet session:', error);
    return null;
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: string) {
  try {
    const now = new Date();
    return await db.query.walletSessions.findMany({
      where: and(
        eq(walletSessions.userId, userId),
        eq(walletSessions.isActive, true),
        gt(walletSessions.expiresAt, now)
      ),
    });
  } catch (error) {
    logger.error('Failed to get user sessions:', error);
    return [];
  }
}

/**
 * Verify session token
 */
export async function verifySessionToken(
  sessionToken: string
): Promise<{ valid: boolean; walletId?: string; userId?: string; expiresAt?: Date }> {
  try {
    const now = new Date();
    const session = await db.query.walletSessions.findFirst({
      where: and(
        eq(walletSessions.sessionToken, sessionToken),
        eq(walletSessions.isActive, true),
        gt(walletSessions.expiresAt, now)
      ),
    });

    if (session) {
      // Update last accessed
      await db.update(walletSessions)
        .set({ lastAccessedAt: now })
        .where(eq(walletSessions.id, session.id));

      return {
        valid: true,
        walletId: session.walletId,
        userId: session.userId,
        expiresAt: session.expiresAt,
      };
    }

    return { valid: false };
  } catch (error) {
    logger.error('Failed to verify session token:', error);
    return { valid: false };
  }
}

/**
 * Extend wallet session expiry
 */
export async function extendWalletSession(
  sessionId: string,
  additionalHours: number = 24
): Promise<{ success: boolean; newExpiresAt?: Date }> {
  try {
    const session = await db.query.walletSessions.findFirst({
      where: eq(walletSessions.id, sessionId),
    });

    if (!session) {
      return { success: false };
    }

    const newExpiresAt = new Date(session.expiresAt.getTime() + additionalHours * 60 * 60 * 1000);

    await db.update(walletSessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(walletSessions.id, sessionId));

    logger.info(`Wallet session extended: ${sessionId}`, { newExpiresAt });

    return {
      success: true,
      newExpiresAt,
    };
  } catch (error) {
    logger.error('Failed to extend wallet session:', error);
    return { success: false };
  }
}

/**
 * Disconnect wallet session (manual disconnect)
 */
export async function disconnectWalletSession(
  sessionId: string
): Promise<{ success: boolean }> {
  try {
    const now = new Date();
    await db.update(walletSessions)
      .set({
        isActive: false,
        disconnectedAt: now,
      })
      .where(eq(walletSessions.id, sessionId));

    logger.info(`Wallet session disconnected: ${sessionId}`);
    return { success: true };
  } catch (error) {
    logger.error('Failed to disconnect wallet session:', error);
    return { success: false };
  }
}

/**
 * Disconnect wallet by session token
 */
export async function disconnectWalletByToken(sessionToken: string): Promise<{ success: boolean }> {
  try {
    const now = new Date();
    await db.update(walletSessions)
      .set({
        isActive: false,
        disconnectedAt: now,
      })
      .where(eq(walletSessions.sessionToken, sessionToken));

    logger.info(`Wallet session disconnected via token`);
    return { success: true };
  } catch (error) {
    logger.error('Failed to disconnect wallet by token:', error);
    return { success: false };
  }
}

/**
 * Disconnect all user sessions
 */
export async function disconnectAllUserSessions(userId: string): Promise<{ disconnected: number }> {
  try {
    const now = new Date();
    const result = await db.update(walletSessions)
      .set({
        isActive: false,
        disconnectedAt: now,
      })
      .where(
        and(
          eq(walletSessions.userId, userId),
          eq(walletSessions.isActive, true)
        )
      );

    logger.info(`All wallet sessions disconnected for user: ${userId}`, {
      disconnected: result.rowCount,
    });

    return { disconnected: result.rowCount || 0 };
  } catch (error) {
    logger.error('Failed to disconnect all user sessions:', error);
    return { disconnected: 0 };
  }
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions(): Promise<{ deleted: number }> {
  try {
    const now = new Date();
    const result = await db.update(walletSessions)
      .set({ isActive: false })
      .where(
        and(
          lt(walletSessions.expiresAt, now),
          eq(walletSessions.isActive, true)
        )
      );

    logger.info(`Expired wallet sessions cleaned up`, {
      deleted: result.rowCount,
    });

    return { deleted: result.rowCount || 0 };
  } catch (error) {
    logger.error('Failed to cleanup expired sessions:', error);
    return { deleted: 0 };
  }
}

/**
 * Get session details for a wallet
 */
export async function getWalletSessionDetails(sessionId: string) {
  try {
    const session = await db.query.walletSessions.findFirst({
      where: eq(walletSessions.id, sessionId),
      with: {
        wallet: true,
        user: true,
      },
    });

    return session || null;
  } catch (error) {
    logger.error('Failed to get session details:', error);
    return null;
  }
}

import { lt } from 'drizzle-orm';
