/**
 * Admin Billing - Platform-wide Billing Analytics
 * 
 * Admin-only endpoints for platform financial metrics and analytics
 * 
 * Endpoints:
 * GET    /api/admin/billing/analytics/platform    Get platform financial analytics
 */

import express, { Request, Response } from 'express';
import { isAuthenticated } from '../../auth';
import { db } from '../../storage';
import { users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { financialAnalyticsService } from '../../services/financialAnalyticsService';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE - ADMIN ONLY
// ════════════════════════════════════════════════════════════════════════════════

// All admin billing operations require authentication and admin access
router.use(isAuthenticated);

// Admin authorization middleware
router.use(async (req: Request, res: Response, next) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    
    // Check if user is admin/superuser
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.isSuperUser) {
      return res.status(403).json({ 
        success: false,
        error: 'Admin access required' 
      });
    }
    
    next();
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: 'Authorization check failed' 
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/billing/analytics/platform
 * Get platform-wide financial analytics
 * 
 * Query Parameters:
 * - startDate: ISO date string for analysis start
 * - endDate: ISO date string for analysis end
 * 
 * Returns:
 * - Total revenue, MRR, growth metrics
 * - Plan breakdown (free vs premium)
 * - Top performing DAOs
 * - Churn analysis
 */
router.get('/analytics/platform', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const analytics = await financialAnalyticsService.getPlatformFinancialMetrics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      data: analytics
    });

  } catch (error: any) {
    console.error('Platform analytics error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load platform analytics',
      message: error.message 
    });
  }
});

export default router;
