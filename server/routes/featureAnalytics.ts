/**
 * Enhanced Feature Analytics Routes
 * Endpoints for feature tracking, analytics, and beta access management
 */

import { Router, Request, Response } from 'express';
import { enhancedFeatureService } from '../services/enhancedFeatureService';
import { authenticate } from '../auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/features/user/accessible
 * Get features accessible to current user
 */
router.get('/user/accessible', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub || (req as any).userId;

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
  } catch (error) {
    logger.error('Error fetching user accessible features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accessible features',
    });
  }
});

/**
 * GET /api/features/check/:featureKey
 * Check if user has access to a specific feature
 */
router.get('/check/:featureKey', authenticate, async (req: Request, res: Response) => {
  try {
    const { featureKey } = req.params;
    const userId = (req as any).user?.claims?.sub || (req as any).userId;

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
  } catch (error) {
    logger.error('Error checking feature access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check feature access',
    });
  }
});

/**
 * POST /api/features/track/:featureKey
 * Track feature usage
 */
router.post('/track/:featureKey', authenticate, async (req: Request, res: Response) => {
  try {
    const { featureKey } = req.params;
    const userId = (req as any).user?.claims?.sub || (req as any).userId;
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
  } catch (error) {
    logger.error('Error tracking feature usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track feature usage',
    });
  }
});

/**
 * GET /api/features/analytics/:featureKey
 * Get analytics for a feature
 */
router.get('/analytics/:featureKey', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    logger.error('Error fetching feature analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feature analytics',
    });
  }
});

/**
 * POST /api/features/beta/grant
 * Grant beta access to user (admin only)
 */
router.post('/beta/grant', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, featureKey, expiresAt } = req.body;
    const requestingUserId = (req as any).user?.claims?.sub;

    // Check if requesting user is admin
    // This should be expanded with proper role checking
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

    await enhancedFeatureService.grantBetaAccess(
      userId,
      featureKey,
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.json({
      success: true,
      message: 'Beta access granted',
    });
  } catch (error) {
    logger.error('Error granting beta access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to grant beta access',
    });
  }
});

/**
 * DELETE /api/features/beta/revoke
 * Revoke beta access (admin only)
 */
router.delete('/beta/revoke', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, featureKey } = req.body;

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
  } catch (error) {
    logger.error('Error revoking beta access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke beta access',
    });
  }
});

/**
 * POST /api/features/rollout
 * Set feature rollout percentage for A/B testing (admin only)
 */
router.post('/rollout', authenticate, async (req: Request, res: Response) => {
  try {
    const { featureKey, percentage } = req.body;

    if (!featureKey || percentage === undefined) {
      return res.status(400).json({
        success: false,
        error: 'featureKey and percentage are required',
      });
    }

    if (percentage < 0 || percentage > 100) {
      return res.status(400).json({
        success: false,
        error: 'Percentage must be between 0 and 100',
      });
    }

    await enhancedFeatureService.setFeatureRollout(featureKey, percentage);

    res.json({
      success: true,
      message: `Feature rollout set to ${percentage}%`,
      featureKey,
      percentage,
    });
  } catch (error) {
    logger.error('Error setting feature rollout:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set feature rollout',
    });
  }
});

export default router;
