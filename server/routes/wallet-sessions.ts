/**
 * Wallet Session Routes
 * API endpoints for managing wallet sessions
 * Enables PIN-based wallet access without seedphrase
 */

import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import {
  createWalletSession,
  getActiveWalletSession,
  getUserActiveSessions,
  verifySessionToken,
  extendWalletSession,
  disconnectWalletSession,
  disconnectWalletByToken,
  disconnectAllUserSessions,
} from '../services/wallet-session-service';
import { verifyUserPIN } from '../services/pin-service';
import { db } from '../db';
import { wallets, users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Validation schemas
 */
const connectWalletSchema = z.object({
  walletId: z.string().uuid(),
  pin: z.string().length(4), // 4-digit PIN
});

const extendSessionSchema = z.object({
  hours: z.number().int().positive().default(24),
});

const verifyTokenSchema = z.object({
  sessionToken: z.string(),
});

/**
 * POST /api/wallet-sessions/connect
 * Connect wallet using PIN (creates session)
 * User must be authenticated, then verify PIN
 */
router.post('/connect', authenticateToken, async (req, res) => {
  try {
    const validated = connectWalletSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Verify wallet belongs to user
    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.id, validated.walletId),
    });

    if (!wallet || wallet.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Wallet not found or does not belong to user',
      });
    }

    // Verify PIN
    const pinVerified = await verifyUserPIN(userId, validated.pin);
    if (!pinVerified) {
      logger.warn(`Failed PIN verification attempt for user ${userId}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid PIN',
      });
    }

    // Create wallet session
    const session = await createWalletSession(
      validated.walletId,
      userId,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      success: true,
      data: {
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt,
        walletId: validated.walletId,
        message: 'Wallet connected successfully',
      },
    });
  } catch (error) {
    logger.error('Wallet connect error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect wallet',
    });
  }
});

/**
 * GET /api/wallet-sessions/active
 * Get all active wallet sessions for authenticated user
 */
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const sessions = await getUserActiveSessions(userId);

    res.json({
      success: true,
      data: sessions.map(s => ({
        id: s.id,
        walletId: s.walletId,
        connectedAt: s.connectedAt,
        expiresAt: s.expiresAt,
        lastAccessedAt: s.lastAccessedAt,
        ipAddress: s.ipAddress,
        deviceId: s.deviceId,
      })),
    });
  } catch (error) {
    logger.error('Get active sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active sessions',
    });
  }
});

/**
 * POST /api/wallet-sessions/verify
 * Verify if a session token is valid
 */
router.post('/verify', async (req, res) => {
  try {
    const validated = verifyTokenSchema.parse(req.body);

    const result = await verifySessionToken(validated.sessionToken);

    if (result.valid) {
      res.json({
        success: true,
        data: {
          valid: true,
          walletId: result.walletId,
          userId: result.userId,
          expiresAt: result.expiresAt,
        },
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired session token',
      });
    }
  } catch (error) {
    logger.error('Session verification error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to verify session',
    });
  }
});

/**
 * POST /api/wallet-sessions/extend
 * Extend wallet session expiry
 */
router.post('/extend', authenticateToken, async (req, res) => {
  try {
    const validated = extendSessionSchema.parse(req.body);
    const sessionToken = req.headers['x-wallet-session'] as string;

    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        error: 'Session token required in x-wallet-session header',
      });
    }

    const sessionVerify = await verifySessionToken(sessionToken);
    if (!sessionVerify.valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session token',
      });
    }

    // Find session to get ID
    const sessions = await getUserActiveSessions(req.user!.id!);
    const session = sessions.find(s => s.walletId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    const result = await extendWalletSession(session.id, validated.hours);

    if (result.success) {
      res.json({
        success: true,
        data: {
          message: `Session extended by ${validated.hours} hours`,
          newExpiresAt: result.newExpiresAt,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to extend session',
      });
    }
  } catch (error) {
    logger.error('Extend session error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to extend session',
    });
  }
});

/**
 * POST /api/wallet-sessions/disconnect
 * Disconnect wallet session (manual logout)
 */
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    const sessionToken = req.headers['x-wallet-session'] as string;

    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        error: 'Session token required in x-wallet-session header',
      });
    }

    const result = await disconnectWalletByToken(sessionToken);

    if (result.success) {
      res.json({
        success: true,
        data: {
          message: 'Wallet session disconnected',
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to disconnect session',
      });
    }
  } catch (error) {
    logger.error('Disconnect session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect session',
    });
  }
});

/**
 * POST /api/wallet-sessions/disconnect-all
 * Disconnect all wallet sessions for user
 */
router.post('/disconnect-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const result = await disconnectAllUserSessions(userId);

    res.json({
      success: true,
      data: {
        message: `${result.disconnected} wallet session(s) disconnected`,
        disconnected: result.disconnected,
      },
    });
  } catch (error) {
    logger.error('Disconnect all sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect sessions',
    });
  }
});

export default router;
