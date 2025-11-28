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
router.post('/enable/:featureKey', (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication middleware here
    // if (!req.user?.isAdmin) {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }

    const { featureKey } = req.params;
    const feature = getFeature(featureKey);

    if (!feature) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found',
      });
    }

    enableFeature(featureKey);
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
router.post('/disable/:featureKey', (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication middleware here
    // if (!req.user?.isAdmin) {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }

    const { featureKey } = req.params;
    const feature = getFeature(featureKey);

    if (!feature) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found',
      });
    }

    disableFeature(featureKey);
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
router.post('/release-phase/:phase', (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication middleware here
    // if (!req.user?.isAdmin) {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }

    const phase = parseInt(req.params.phase, 10);
    if (isNaN(phase)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phase number',
      });
    }

    releasePhase(phase);
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
router.post('/release-all', (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication middleware here
    // if (!req.user?.isAdmin) {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }

    releaseAllFeatures();
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

export default router;
