/**
 * Feature Visibility Routes
 * API endpoints for feature flag management
 */

import { Router, Request, Response } from 'express';
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
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

/**
 * GET /api/features
 * Get all features with their visibility status
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const features = getAllFeatures();
    res.json({
      success: true,
      count: Object.keys(features).length,
      features,
    });
  } catch (error) {
    console.error('Error fetching features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch features',
    });
  }
});

/**
 * GET /api/features/enabled
 * Get only enabled features
 */
router.get('/enabled', (req: Request, res: Response) => {
  try {
    const features = getEnabledFeatures();
    res.json({
      success: true,
      count: Object.keys(features).length,
      features,
    });
  } catch (error) {
    console.error('Error fetching enabled features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enabled features',
    });
  }
});

/**
 * GET /api/features/stats
 * Get feature statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = getFeatureStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching feature stats:', error);
    res.status(500).json({
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
    const enabled = isFeatureEnabled(featureKey);
    const feature = getFeature(featureKey);

    if (!feature) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found',
      });
    }

    res.json({
      success: true,
      featureKey,
      enabled,
      feature,
    });
  } catch (error) {
    console.error('Error checking feature:', error);
    res.status(500).json({
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
    res.json({
      success: true,
      phase,
      count: Object.keys(features).length,
      features,
    });
  } catch (error) {
    console.error('Error fetching features by phase:', error);
    res.status(500).json({
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
    res.json({
      success: true,
      category,
      count: Object.keys(features).length,
      features,
    });
  } catch (error) {
    console.error('Error fetching features by category:', error);
    res.status(500).json({
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
router.post('/enable/:featureKey', requireAuth, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { featureKey } = req.params;
    const feature = getFeature(featureKey);

    if (!feature) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found',
      });
    }

    await enableFeature(featureKey);
    res.json({
      success: true,
      message: `Feature ${featureKey} enabled`,
      feature: getFeature(featureKey),
    });
  } catch (error) {
    console.error('Error enabling feature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable feature',
    });
  }
});

/**
 * POST /api/features/disable/:featureKey
 * Disable a specific feature
 * Requires admin authentication
 */
router.post('/disable/:featureKey', requireAuth, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { featureKey } = req.params;
    const feature = getFeature(featureKey);

    if (!feature) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found',
      });
    }

    await disableFeature(featureKey);
    res.json({
      success: true,
      message: `Feature ${featureKey} disabled`,
      feature: getFeature(featureKey),
    });
  } catch (error) {
    console.error('Error disabling feature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable feature',
    });
  }
});

/**
 * POST /api/features/release-phase/:phase
 * Release all features up to a specific phase
 * Requires admin authentication
 */
router.post('/release-phase/:phase', requireAuth, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const phase = parseInt(req.params.phase, 10);
    if (isNaN(phase)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phase number',
      });
    }

    await releasePhase(phase);
    const features = getFeaturesByPhase(phase);

    res.json({
      success: true,
      message: `Phase ${phase} released`,
      enabledCount: Object.keys(features).length,
      stats: getFeatureStats(),
    });
  } catch (error) {
    console.error('Error releasing phase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to release phase',
    });
  }
});

/**
 * POST /api/features/release-all
 * Release all features immediately
 * Requires admin authentication
 */
router.post('/release-all', requireAuth, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    await releaseAllFeatures();
    const features = getAllFeatures();

    res.json({
      success: true,
      message: 'All features released',
      enabledCount: Object.keys(features).length,
      stats: getFeatureStats(),
    });
  } catch (error) {
    console.error('Error releasing all features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to release all features',
    });
  }
});

/**
 * GET /api/gating-rules
 * Get all feature gating rules and explanations
 */
router.get('/gating-rules', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      rules: GATING_RULES,
      description: 'Feature gating rules and explanations',
    });
  } catch (error) {
    console.error('Error fetching gating rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gating rules',
    });
  }
});

/**
 * GET /api/gating-status
 * Get user-specific gating status for all features
 */
router.get('/gating-status', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const features = Object.keys(GATING_RULES);
    const status: Record<string, any> = {};
    
    features.forEach((feature) => {
      status[feature] = checkFeatureGating(feature, user);
    });

    res.json({
      success: true,
      status,
      user: {
        id: user.id,
        accountAge: Math.floor(
          (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
        balance: user.balance || 0,
        balanceCurrency: 'KES', // Base currency
        preferredCurrency: (user.preferredCurrency || 'KES').toUpperCase(),
        reputation: user.reputation || 0,
        advancedMode: user.advancedMode || false,
      },
    });
  } catch (error) {
    console.error('Error checking gating status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check gating status',
    });
  }
});

export default router;
