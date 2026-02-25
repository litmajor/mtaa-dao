import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ActivityService, ActivityType } from '../services/activity-service';
import { PromotionService, UserRole } from '../services/promotion-service';

const router = Router();

/**
 * Activity & Promotion Routes
 *
 * Activities:
 * POST   /api/governance/:daoId/activity/award
 * GET    /api/governance/:daoId/activity/history
 * GET    /api/governance/:daoId/activity/stats
 * GET    /api/governance/:daoId/leaderboard
 *
 * Promotions:
 * GET    /api/governance/:daoId/promotion/eligibility
 * POST   /api/governance/:daoId/promotion/request
 * GET    /api/governance/:daoId/promotion/history
 * POST   /api/governance/:daoId/promotion/accept (admin)
 * POST   /api/governance/:daoId/promotion/reject (admin)
 */

// ============================================
// ACTIVITY ROUTES
// ============================================

/**
 * POST /api/governance/:daoId/activity/award
 * Award activity points to a user
 */
router.post(
  '/:daoId/activity/award',
  (authenticateToken as any),
  async (req: any, res: Response) => {
    try {
      const { daoId } = req.params;
      const { userId, type, description, points, metadata } = req.body;

      // Validate input
      if (!userId || !type || !description) {
        return res.status(400).json({
          error: 'Missing required fields: userId, type, description',
        });
      }

      if (!Object.values(ActivityType).includes(type)) {
        return res.status(400).json({
          error: `Invalid activity type. Must be one of: ${Object.values(ActivityType).join(', ')}`,
        });
      }

      // Award points
      const activity = await ActivityService.awardPoints(
        userId,
        daoId,
        type as ActivityType,
        description,
        points,
        metadata
      );

      res.json({
        success: true,
        activity,
      });
    } catch (error) {
      console.error('Award activity error:', error);
      res.status(500).json({
        error: 'Failed to award activity points',
      });
    }
  }
);

/**
 * GET /api/governance/:daoId/activity/history
 * Get activity history for current user
 */
router.get(
  '/:daoId/activity/history',
  (authenticateToken as any),
  async (req: any, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).userId; // From auth middleware
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await ActivityService.getActivityHistory(
        userId,
        daoId,
        limit,
        offset
      );

      res.json({
        success: true,
        history,
      });
    } catch (error) {
      console.error('Get activity history error:', error);
      res.status(500).json({
        error: 'Failed to fetch activity history',
      });
    }
  }
);

/**
 * GET /api/governance/:daoId/activity/stats
 * Get activity statistics for current user
 */
router.get(
  '/:daoId/activity/stats',
  (authenticateToken as any),
  async (req: any, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).userId;

      const stats = await ActivityService.calculateStats(userId, daoId);
      const pointsWithDecay = await ActivityService.calculatePointsWithDecay(userId, daoId);

      res.json({
        success: true,
        stats: {
          ...stats,
          totalPointsWithDecay: pointsWithDecay,
        },
      });
    } catch (error) {
      console.error('Get activity stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch activity statistics',
      });
    }
  }
);

/**
 * GET /api/governance/:daoId/leaderboard
 * Get activity leaderboard for DAO
 */
router.get(
  '/:daoId/leaderboard',
  (authenticateToken as any),
  async (req: any, res: Response) => {
    try {
      const { daoId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const leaderboard = await ActivityService.getLeaderboard(daoId, limit);

      res.json({
        success: true,
        leaderboard,
      });
    } catch (error) {
      console.error('Get leaderboard error:', error);
      res.status(500).json({
        error: 'Failed to fetch leaderboard',
      });
    }
  }
);

// ============================================
// PROMOTION ROUTES
// ============================================

/**
 * GET /api/governance/:daoId/promotion/eligibility
 * Check promotion eligibility for current user
 */
router.get(
  '/:daoId/promotion/eligibility',
  (authenticateToken as any),
  async (req: any, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).userId;

      const eligibility = await PromotionService.checkEligibility(userId, daoId);

      res.json({
        success: true,
        eligibility,
      });
    } catch (error) {
      console.error('Check eligibility error:', error);
      res.status(500).json({
        error: 'Failed to check promotion eligibility',
      });
    }
  }
);

/**
 * POST /api/governance/:daoId/promotion/request
 * Request promotion (if not fully eligible)
 */
router.post(
  '/:daoId/promotion/request',
  (authenticateToken as any),
  async (req: any, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).userId;
      const { reason } = req.body;

      // Check if already at max role
      const eligibility = await PromotionService.checkEligibility(userId, daoId);
      if (eligibility.currentRole === UserRole.ADMIN) {
        return res.status(400).json({
          error: 'Already at maximum role',
        });
      }

      const promotionRequest = await PromotionService.requestPromotion(
        userId,
        daoId,
        reason
      );

      res.json({
        success: true,
        request: promotionRequest,
      });
    } catch (error) {
      console.error('Request promotion error:', error);
      res.status(500).json({
        error: 'Failed to request promotion',
      });
    }
  }
);

/**
 * GET /api/governance/:daoId/promotion/history
 * Get promotion history for current user
 */
router.get(
  '/:daoId/promotion/history',
  (authenticateToken as any),
  async (req: any, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).userId;

      const history = await PromotionService.getPromotionHistory(userId, daoId);

      res.json({
        success: true,
        history,
      });
    } catch (error) {
      console.error('Get promotion history error:', error);
      res.status(500).json({
        error: 'Failed to fetch promotion history',
      });
    }
  }
);

/**
 * POST /api/governance/:daoId/promotion/accept
 * Accept a promotion request (admin only)
 */
router.post(
  '/:daoId/promotion/accept',
  (authenticateToken as any),
  async (req: any, res: Response) => {
    try {
      const { daoId } = req.params;
      const adminId = (req as any).userId;
      const { requestId } = req.body;

      // TODO: Verify admin permissions

      const promotion = await PromotionService.acceptPromotionRequest(
        requestId,
        adminId,
        daoId
      );

      res.json({
        success: true,
        promotion,
      });
    } catch (error) {
      console.error('Accept promotion error:', error);
      res.status(500).json({
        error: 'Failed to accept promotion request',
      });
    }
  }
);

/**
 * POST /api/governance/:daoId/promotion/reject
 * Reject a promotion request (admin only)
 */
router.post(
  '/:daoId/promotion/reject',
  (authenticateToken as any),
  async (req: any, res: Response) => {
    try {
      const { daoId } = req.params;
      const adminId = (req as any).userId;
      const { requestId, reason } = req.body;

      // TODO: Verify admin permissions

      await PromotionService.rejectPromotionRequest(
        requestId,
        adminId,
        daoId,
        reason
      );

      res.json({
        success: true,
        message: 'Promotion request rejected',
      });
    } catch (error) {
      console.error('Reject promotion error:', error);
      res.status(500).json({
        error: 'Failed to reject promotion request',
      });
    }
  }
);

export default router;
