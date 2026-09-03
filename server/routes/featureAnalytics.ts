/**
 * Enhanced Feature Analytics Routes
 * Endpoints for feature tracking, analytics, and beta access management
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../auth';
import { enhancedFeatureService } from '../services/enhancedFeatureService';
import { authenticate } from '../auth';
import { requireRole } from '../middleware/rbac';
import { logger } from '../utils/logger';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: AuthRequest['user'];
}

const asyncHandler = (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const getAuthenticatedUserId = (req: AuthenticatedRequest): string | undefined => {
  return req.user?.id ?? req.user?.claims?.sub ?? undefined;
};

/**
 * GET /api/features/user/accessible
 * Get features accessible to current user
 */
router.get('/user/accessible', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
    });
  }

  const features = await enhancedFeatureService.getUserAccessibleFeatures(userId);

  res.json({
    success: true,
    count: features.length,
    features,
  });
}));

/**
 * GET /api/features/check/:featureKey
 * Check if user has access to a specific feature
 */
router.get('/check/:featureKey', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { featureKey } = req.params;
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
    });
  }

  const { allowed, reason } = await enhancedFeatureService.canUserAccessFeature(userId, featureKey);

  res.json({
    success: true,
    featureKey,
    allowed,
    reason,
  });
}));

/**
 * POST /api/features/track/:featureKey
 * Track feature usage
 */
router.post('/track/:featureKey', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { featureKey } = req.params;
  const userId = getAuthenticatedUserId(req);
  const { metadata } = req.body;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
    });
  }

  await enhancedFeatureService.trackFeatureUsage(userId, featureKey, metadata);

  res.json({
    success: true,
    message: 'Feature usage tracked',
  });
}));

/**
 * GET /api/features/analytics/:featureKey
 * Get analytics for a feature
 */
router.get('/analytics/:featureKey', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { featureKey } = req.params;

  const analytics = await enhancedFeatureService.getFeatureAnalytics(featureKey);

  if (!analytics) {
    return res.status(404).json({
      success: false,
      error: 'No analytics found for feature',
    });
  }

  res.json({
    success: true,
    analytics,
  });
}));

/**
 * POST /api/features/beta/grant
 * Grant beta access to user (admin only)
 */
router.post('/beta/grant', authenticate, requireRole('admin', 'super_admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, featureKey, expiresAt } = req.body;
  const requestingUserId = getAuthenticatedUserId(req);

  if (!requestingUserId) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated',
    });
  }

  if (!userId || !featureKey) {
    return res.status(400).json({
      success: false,
      error: 'userId and featureKey are required',
    });
  }

  let expiryDate: Date | undefined;
  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
    expiryDate = new Date(expiresAt as string | number | Date);
    if (Number.isNaN(expiryDate.getTime())) {
      logger.warn('Invalid beta access expiry supplied', { userId, featureKey, expiresAt, requestingUserId });
      return res.status(400).json({
        success: false,
        error: 'expiresAt must be a valid ISO date or timestamp',
      });
    }
  }

  await enhancedFeatureService.grantBetaAccess(userId, featureKey, expiryDate);

  res.json({
    success: true,
    message: 'Beta access granted',
  });
}));

/**
 * DELETE /api/features/beta/revoke
 * Revoke beta access (admin only)
 */
router.delete('/beta/revoke/:userId/:featureKey', authenticate, requireRole('admin', 'super_admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, featureKey } = req.params;

  if (!userId || !featureKey) {
    return res.status(400).json({
      success: false,
      error: 'userId and featureKey are required',
    });
  }

  await enhancedFeatureService.revokeBetaAccess(userId, featureKey);

  res.json({
    success: true,
    message: 'Beta access revoked',
  });
}));

/**
 * POST /api/features/rollout
 * Set feature rollout percentage for A/B testing (admin only)
 */
router.post('/rollout', authenticate, requireRole('admin', 'super_admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { featureKey, percentage } = req.body;

  if (!featureKey || percentage === undefined) {
    return res.status(400).json({
      success: false,
      error: 'featureKey and percentage are required',
    });
  }

  const numericPercentage = Number(percentage);
  if (!Number.isFinite(numericPercentage) || numericPercentage < 0 || numericPercentage > 100) {
    logger.warn('Invalid feature rollout percentage', { featureKey, percentage, userId: getAuthenticatedUserId(req) });
    return res.status(400).json({
      success: false,
      error: 'Percentage must be a finite number between 0 and 100',
    });
  }

  await enhancedFeatureService.setFeatureRollout(featureKey, numericPercentage);

  res.json({
    success: true,
    message: `Feature rollout set to ${numericPercentage}%`,
    featureKey,
    percentage: numericPercentage,
  });
}));

export default router;
