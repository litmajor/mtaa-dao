/**
 * Advanced Mode Guard Middleware
 * 
 * Validates that user has advanced mode enabled in database.
 * Checked on every request - NOT cached in JWT to prevent token-holding bypass attacks.
 * 
 * Applied to: Bridge operations, Flash loans (high-risk operations)
 * 
 * Response (if disabled):
 * 403 Forbidden
 * {
 *   error: 'Advanced Mode required',
 *   toggle: '/api/v1/settings/advanced-mode'
 * }
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../storage';
import { users } from '../storage/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

/**
 * Middleware: Check if user has advanced mode enabled
 * 
 * - Reads from database (not JWT) on every request
 * - Prevents old JWT tokens from bypassing revoked mode
 * - Logs access attempts for security audit
 */
export async function advancedModeGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = (req as any).user?.id || (req as any).userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required'
      });
    }

    // Query database for current advanced mode status (NOT cached)
    const userRecord = await db.select()
      .from(users)
      .where(eq(users.id, userId as any))
      .limit(1);

    if (!userRecord || userRecord.length === 0) {
      logger.warn('[Advanced Mode Guard] User not found in database', { userId });
      return res.status(403).json({
        success: false,
        error: 'Advanced Mode required',
        toggle: '/api/v1/settings/advanced-mode'
      });
    }

    const advancedMode = userRecord[0]?.advancedMode === true;

    if (!advancedMode) {
      logger.warn('[Advanced Mode Guard] Access denied - advanced mode disabled', {
        userId,
        route: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        error: 'Advanced Mode required',
        toggle: '/api/v1/settings/advanced-mode'
      });
    }

    // Log successful access to advanced features
    logger.info('[Advanced Mode Guard] Access granted', {
      userId,
      route: req.path,
      method: req.method
    });

    // Proceed to next handler
    next();
  } catch (error) {
    logger.error('[Advanced Mode Guard] Error checking advanced mode', {
      userId: (req as any).user?.id,
      error
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to verify advanced mode status'
    });
  }
}

export default advancedModeGuard;
