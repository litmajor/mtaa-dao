/**
 * PIN Verification Middleware
 * Ensures PIN-protected operations (withdrawals, transfers, etc.) are verified
 * Works with existing wallet sessions
 */

import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../services/wallet-session-service';
import { logger } from '../utils/logger';

export interface PINProtectedRequest extends Request {
  walletSession?: {
    valid: boolean;
    walletId?: string;
    userId?: string;
    expiresAt?: Date;
  };
}

/**
 * Middleware to require active wallet session with PIN verification
 * Used for sensitive operations: withdrawals, transfers, asset operations
 */
export async function requirePINVerification(
  req: PINProtectedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get session token from header
    const sessionToken = req.headers['x-wallet-session'] as string;

    if (!sessionToken) {
      logger.warn(`PIN operation attempted without session: ${req.path}`);
      return res.status(401).json({
        success: false,
        error: 'PIN verification required. Please unlock wallet with PIN first.',
        code: 'PIN_VERIFICATION_REQUIRED',
      });
    }

    // Verify session token
    const sessionResult = await verifySessionToken(sessionToken);

    if (!sessionResult.valid) {
      logger.warn(`Invalid or expired session attempted: ${req.path}`);
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid. Please unlock wallet again.',
        code: 'SESSION_EXPIRED',
      });
    }

    // Verify user matches
    const userId = req.user?.id;
    if (!userId || userId !== sessionResult.userId) {
      logger.warn(`Session user mismatch: ${sessionResult.userId} vs ${userId}`);
      return res.status(403).json({
        success: false,
        error: 'Session does not belong to this user.',
        code: 'UNAUTHORIZED_SESSION',
      });
    }

    // Check if session is expiring soon (within 5 minutes)
    if (sessionResult.expiresAt) {
      const now = new Date();
      const fiveMinutes = 5 * 60 * 1000;
      if (sessionResult.expiresAt.getTime() - now.getTime() < fiveMinutes) {
        // Warn about expiring session but allow operation
        res.set('X-Session-Expiring-Soon', 'true');
        logger.info(`Session expiring soon for user ${userId}`);
      }
    }

    // Attach session info to request
    req.walletSession = sessionResult;

    // Log the PIN-protected operation
    logger.info(`PIN-verified operation: ${req.method} ${req.path}`, {
      userId: sessionResult.userId,
      walletId: sessionResult.walletId,
    });

    next();
  } catch (error) {
    logger.error('PIN verification middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'PIN verification failed',
      code: 'PIN_VERIFICATION_ERROR',
    });
  }
}

/**
 * Alternative: Optional PIN verification
 * Allows operation but includes session info if available
 * Used for operations that can work with or without PIN
 */
export async function optionalPINVerification(
  req: PINProtectedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const sessionToken = req.headers['x-wallet-session'] as string;

    if (sessionToken) {
      const sessionResult = await verifySessionToken(sessionToken);
      if (sessionResult.valid) {
        req.walletSession = sessionResult;
      }
    }

    next();
  } catch (error) {
    logger.error('Optional PIN verification error:', error);
    // Continue anyway, session just won't be available
    next();
  }
}

/**
 * Middleware to verify PIN matches a specific wallet
 * Used when multiple wallets exist and we need to ensure correct one is accessed
 */
export async function verifyWalletAccess(
  req: PINProtectedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.walletSession?.valid) {
      return res.status(401).json({
        success: false,
        error: 'Wallet session not valid',
      });
    }

    // Get wallet ID from request params or body
    const requestedWalletId = req.params.walletId || req.body?.walletId;

    if (!requestedWalletId) {
      return res.status(400).json({
        success: false,
        error: 'Wallet ID required',
      });
    }

    // Verify requested wallet matches session wallet
    if (requestedWalletId !== req.walletSession.walletId) {
      logger.warn(
        `Wallet mismatch: requested ${requestedWalletId} but session has ${req.walletSession.walletId}`
      );
      return res.status(403).json({
        success: false,
        error: 'Wallet does not match active session',
        code: 'WALLET_MISMATCH',
      });
    }

    next();
  } catch (error) {
    logger.error('Wallet access verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Wallet verification failed',
    });
  }
}

/**
 * Middleware to check if operation requires PIN based on amount
 * Example: Transfers > $1000 might require PIN re-entry
 */
export function checkAmountThreshold(thresholdAmount?: string | number) {
  const threshold = thresholdAmount 
    ? parseFloat(String(thresholdAmount))
    : process.env.PIN_REQUIRED_THRESHOLD
      ? parseFloat(process.env.PIN_REQUIRED_THRESHOLD)
      : 10000; // $10,000 default

  return (req: PINProtectedRequest, res: Response, next: NextFunction) => {
    try {
      const amount = req.body?.amount ? parseFloat(req.body.amount) : 0;

      if (amount > threshold) {
        if (!req.walletSession?.valid) {
          return res.status(401).json({
            success: false,
            error: `Large transfers (>${threshold}) require PIN verification`,
            code: 'PIN_REQUIRED_FOR_AMOUNT',
            amount,
            threshold,
          });
        }

        // Log large transaction
        logger.info(`Large PIN-verified transaction: $${amount}`, {
          userId: req.walletSession.userId,
          walletId: req.walletSession.walletId,
        });
      }

      next();
    } catch (error) {
      logger.error('Amount threshold check error:', error);
      next(); // Continue even if check fails
    }
  };
}
