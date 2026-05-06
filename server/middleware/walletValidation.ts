/**
 * Wallet Validation Middleware
 * 
 * Ensures user has a connected wallet before accessing vault operations.
 * Vaults require a connected wallet for deposits, withdrawals, and other operations.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

/**
 * Middleware: Requires connected wallet
 * 
 * Validates that:
 * 1. User is authenticated
 * 2. User has connected a wallet (walletAddress exists)
 * 
 * If validation passes, attaches wallet info to request object.
 * If validation fails, returns 400 or 401 error with guidance.
 */
export async function requireConnectedWallet(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = (req.user as any)?.claims?.id;

    // Check authentication
    if (!userId) {
      logger.warn(`Vault operation attempted without authentication from IP: ${req.ip}`);
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_AUTH',
        message: 'Please log in first'
      });
    }

    // Check if user exists in database
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        walletAddress: true,
        username: true
      }
    });

    if (!user) {
      logger.warn(`Vault operation attempted by non-existent user: ${userId}`);
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if wallet is connected
    if (!user.walletAddress) {
      logger.debug(`Vault operation attempted by user without wallet: ${userId} (${user.username})`);
      return res.status(400).json({
        error: 'Wallet connection required',
        code: 'NO_WALLET',
        message: 
          'Please connect a wallet before accessing vaults. ' +
          'Use MetaMask, WalletConnect, or Minipay from the Wallet page.',
        action: 'Go to Wallet page and click Connect Wallet'
      });
    }

    // Attach wallet info to request for use in handlers
    (req as any).wallet = {
      address: user.walletAddress,
      userId: user.id
    };

    logger.debug(`Wallet validation passed for user: ${user.username} (${user.walletAddress})`);
    next();
  } catch (error) {
    logger.error('Error in wallet validation middleware:', error);
    res.status(500).json({
      error: 'Wallet validation failed',
      code: 'WALLET_VALIDATION_ERROR',
      message: 'An error occurred while validating your wallet connection. Please try again.'
    });
  }
}

/**
 * Middleware: Requires connected wallet (optional)
 * 
 * Soft validation - if wallet exists, attaches it to request.
 * If wallet doesn't exist, continues without error.
 * 
 * Use this for endpoints that can work without wallet but have enhanced
 * functionality with one (e.g., get vault info with user-specific data).
 */
export async function attachWalletIfExists(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = (req.user as any)?.claims?.id;

    if (userId) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          walletAddress: true
        }
      });

      if (user?.walletAddress) {
        (req as any).wallet = {
          address: user.walletAddress,
          userId: userId
        };
      }
    }

    next();
  } catch (error) {
    logger.error('Error in wallet attachment middleware:', error);
    // Non-critical, continue anyway
    next();
  }
}

/**
 * Middleware: Wallet Ownership Guard
 * 
 * Verifies that the :userId parameter in the URL matches the authenticated user's ID.
 * Prevents users from accessing other users' wallets, vaults, or backup data.
 * 
 * Should be applied to routes that access user-specific resources like:
 * - GET /api/wallet-setup/backup-status/:userId
 * - GET /api/wallet-setup/user-vaults/:userId
 */
export async function walletOwnershipGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authenticatedUserId = (req.user as any)?.claims?.id || (req.user as any)?.id;
    const paramUserId = req.params.userId;

    // Check authentication
    if (!authenticatedUserId) {
      logger.warn(`Wallet ownership check attempted without authentication from IP: ${req.ip}`);
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_AUTH',
        message: 'Please log in first'
      });
    }

    // Verify ownership
    if (authenticatedUserId !== paramUserId) {
      logger.warn(
        `Unauthorized wallet access attempt: user ${authenticatedUserId} tried to access resources for user ${paramUserId} from IP: ${req.ip}`
      );
      return res.status(403).json({
        error: 'Access denied',
        code: 'OWNERSHIP_MISMATCH',
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  } catch (error) {
    logger.error('Error in wallet ownership guard middleware:', error);
    res.status(500).json({
      error: 'Ownership check failed',
      code: 'OWNERSHIP_CHECK_ERROR',
      message: 'An error occurred while validating resource ownership. Please try again.'
    });
  }
}
