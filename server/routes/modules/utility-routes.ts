import { Router } from 'express';
import { crossChainService } from '../../services/crossChainService';
import { asyncHandler } from '../../middleware/errorHandler';
import { isAuthenticated } from '../../nextAuthMiddleware';
import { vaultSchema } from './validation-schemas';

const router = Router();

// Get relayer status
router.get('/relayer/status', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      isRunning: true,
      pollInterval: 30000
    }
  });
}));

// Get bridge analytics
router.get('/analytics', asyncHandler(async (req, res) => {
  const { timeframe = 'day' } = req.query;
  const { bridgeMonitoringService } = await import('../../services/bridgeMonitoringService');
  
  const analytics = await bridgeMonitoringService.getBridgeAnalytics(
    timeframe as 'day' | 'week' | 'month'
  );
  
  const feesCollected = await bridgeMonitoringService.calculateFeesCollected(
    timeframe as 'day' | 'week' | 'month'
  );

  res.json({
    success: true,
    data: {
      analytics,
      feesCollected
    }
  });
}));

// Create cross-chain vault
router.post('/vault', isAuthenticated, asyncHandler(async (req, res) => {
  try {
    const validated = vaultSchema.parse(req.body);
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const vaultId = await crossChainService.createCrossChainVault(
      userId,
      validated.chains,
      validated.name
    );

    res.json({
      success: true,
      data: { vaultId }
    });
  } catch (error) {
    throw error;
  }
}));

export const utilityRoutes = router;
