/**
 * Feature Visibility Routes
 * API endpoints for feature flag management
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  getAllFeatures,
  getEnabledFeatures,
  isFeatureEnabled,
  getFeature,
  getFeaturesByPhase,
  getFeaturesByCategory,
  enableFeature,
  disableFeature,
  releasePhase,
  releaseAllFeatures,
  getFeatureStats,
} from '../services/featureService';
import {
  GATING_RULES,
  checkFeatureGating,
} from '../services/gatingService';
import { isAuthenticated } from '../auth';
import { requireRole } from '../middleware/rbac';
import type { isSuperUser } from 'server/middleware/auth';

// Typed request interface for authenticated routes
interface AuthenticatedUser {
  id: string;
  username?: string;
  createdAt?: string | Date;
  balance?: number;
  preferredCurrency?: string;
  reputation?: number;
  advancedMode?: boolean;
  isSuperUser?: boolean;
  [key: string]: any;

}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Wrapper utility for safe async route handling
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Helper: Safely calculate user account age in days
const calculateAccountAgeInDays = (createdAt?: string | Date): number => {
  if (!createdAt) return 0;
  const createdTimestamp = new Date(createdAt).getTime();
  if (isNaN(createdTimestamp)) return 0;
  
  const ageInMs = Date.now() - createdTimestamp;
  return Math.max(0, Math.floor(ageInMs / (1000 * 60 * 60 * 24)));
};

const router = Router();

/**
 * GET /api/features
 * Get all features with their visibility status
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const features = getAllFeatures();
    return res.json({
      success: true,
      count: Object.keys(features || {}).length,
      features,
    });
  } catch (error) {
    console.error('Error fetching features:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch features',
    });
  }
});

/**
 * GET /api/features/enabled
 * Get only enabled features
 */
router.get('/enabled', (_req: Request, res: Response) => {
  try {
    const features = getEnabledFeatures();
    return res.json({
      success: true,
      count: Object.keys(features || {}).length,
      features,
    });
  } catch (error) {
    console.error('Error fetching enabled features:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch enabled features',
    });
  }
});

/**
 * GET /api/features/stats
 * Get feature statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getFeatureStats();
    return res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching feature stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch feature stats',
    });
  }
});

/**
 * GET /api/features/check/:featureKey
 * Check if a specific feature is enabled
 */
router.get('/check/:featureKey', (req: Request, res: Response) => {
  try {
    const { featureKey } = req.params;
    const feature = getFeature(featureKey);

    if (!feature) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found',
      });
    }

    const enabled = isFeatureEnabled(featureKey);

    return res.json({
      success: true,
      featureKey,
      enabled,
      feature,
    });
  } catch (error) {
    console.error('Error checking feature:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check feature',
    });
  }
});

/**
 * GET /api/features/by-phase/:phase
 * Get all features for a specific phase or earlier
 */
router.get('/by-phase/:phase', (req: Request, res: Response) => {
  try {
    const phase = parseInt(req.params.phase, 10);
    if (isNaN(phase)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phase number',
      });
    }

    const features = getFeaturesByPhase(phase);
    return res.json({
      success: true,
      phase,
      count: Object.keys(features || {}).length,
      features,
    });
  } catch (error) {
    console.error('Error fetching features by phase:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch features by phase',
    });
  }
});

/**
 * GET /api/features/by-category/:category
 * Get all features for a specific category
 */
router.get('/by-category/:category', (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const features = getFeaturesByCategory(category);
    return res.json({
      success: true,
      category,
      count: Object.keys(features || {}).length,
      features,
    });
  } catch (error) {
    console.error('Error fetching features by category:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch features by category',
    });
  }
});

/**
 * POST /api/features/enable/:featureKey
 * Enable a specific feature
 * Requires admin authentication
 */
router.post(
  '/enable/:featureKey',
  isAuthenticated,
  requireRole('super_admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { featureKey } = req.params;
    const feature = getFeature(featureKey);

    if (!feature) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found',
      });
    }

    await enableFeature(featureKey);
    const updatedFeature = getFeature(featureKey);

    return res.json({
      success: true,
      message: `Feature ${featureKey} enabled`,
      feature: updatedFeature,
    });
  })
);

/**
 * POST /api/features/disable/:featureKey
 * Disable a specific feature
 * Requires admin authentication
 */
router.post(
  '/disable/:featureKey',
  isAuthenticated,
  requireRole('super_admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { featureKey } = req.params;
    const feature = getFeature(featureKey);

    if (!feature) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found',
      });
    }

    await disableFeature(featureKey);
    const updatedFeature = getFeature(featureKey);

    return res.json({
      success: true,
      message: `Feature ${featureKey} disabled`,
      feature: updatedFeature,
    });
  })
);

/**
 * POST /api/features/release-phase/:phase
 * Release all features up to a specific phase
 * Requires admin authentication
 */
router.post(
  '/release-phase/:phase',
  isAuthenticated,
  requireRole('super_admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const phase = parseInt(req.params.phase, 10);
    if (isNaN(phase)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phase number',
      });
    }

    await releasePhase(phase);
    const features = getFeaturesByPhase(phase);

    return res.json({
      success: true,
      message: `Phase ${phase} released`,
      enabledCount: Object.keys(features || {}).length,
      stats: getFeatureStats(),
    });
  })
);

/**
 * POST /api/features/release-all
 * Release all features immediately
 * Requires admin authentication
 */
router.post(
  '/release-all',
  isAuthenticated,
  requireRole('super_admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    await releaseAllFeatures();
    const features = getAllFeatures();

    return res.json({
      success: true,
      message: 'All features released',
      enabledCount: Object.keys(features || {}).length,
      stats: getFeatureStats(),
    });
  })
);

/**
 * GET /api/gating-rules
 * Get all feature gating rules and explanations
 */
router.get('/gating-rules', (_req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      rules: GATING_RULES,
      description: 'Feature gating rules and explanations',
    });
  } catch (error) {
    console.error('Error fetching gating rules:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch gating rules',
    });
  }
});

/**
 * GET /api/gating-status
 * Get user-specific gating status for all features
 */
router.get('/gating-status', isAuthenticated, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const featureKeys = Object.keys(GATING_RULES || {});
    const status: Record<string, any> = {};

    featureKeys.forEach((feature) => {
      status[feature] = checkFeatureGating(feature, user as any);
    });

    return res.json({
      success: true,
      status,
      user: {
        id: user.id,
        accountAge: calculateAccountAgeInDays(user.createdAt),
        balance: user.balance || 0,
        balanceCurrency: 'KES', // Base currency
        preferredCurrency: (user.preferredCurrency || 'KES').toUpperCase(),
        reputation: user.reputation || 0,
        advancedMode: user.advancedMode || false,
      },
    });
  } catch (error) {
    console.error('Error checking gating status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check gating status',
    });
  }
});

export default router;