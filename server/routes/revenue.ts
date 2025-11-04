
import { Router } from 'express';
import { authenticate } from '../auth';
import { revenueService } from '../services/revenueService';
import { asyncHandler } from '../middleware/errorHandler';
import { z } from 'zod';

const router = Router();

// Admin only - get comprehensive revenue report
router.get('/report', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin
  const user = req.user;
  if (!user?.isSuperUser) {
    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }

  const { period = 'monthly' } = req.query;
  
  const report = await revenueService.getRevenueReport(period as any);

  res.json({
    success: true,
    period,
    ...report,
    insights: {
      diversificationHealth: report.diversification >= 60 ? 'healthy' : 'needs_improvement',
      recommendedActions: generateRecommendations(report)
    }
  });
}));

// Calculate transaction fee for a proposed transaction
router.post('/calculate-fee', authenticate, asyncHandler(async (req, res) => {
  const schema = z.object({
    type: z.enum(['on_ramp', 'off_ramp', 'swap']),
    amountUSD: z.number().positive()
  });

  const { type, amountUSD } = schema.parse(req.body);

  const feeCalculation = await revenueService.calculateTransactionFee(type, amountUSD);

  res.json({
    success: true,
    amountUSD,
    fee: feeCalculation.fee,
    netAmount: feeCalculation.netAmount,
    feePercentage: ((feeCalculation.fee / amountUSD) * 100).toFixed(2)
  });
}));

// Check if DAO should upgrade (pay-as-you-grow)
router.get('/dao/:daoId/growth-check', authenticate, asyncHandler(async (req, res) => {
  const { daoId } = req.params;

  const growthCheck = await revenueService.checkDaoPayAsYouGrow(daoId);

  res.json({
    success: true,
    daoId,
    ...growthCheck
  });
}));

// Get MTAA marketplace stats
router.get('/marketplace/stats', authenticate, asyncHandler(async (req, res) => {
  const { period = 'monthly' } = req.query;

  const stats = await revenueService.getMTAAMarketplaceRevenue(period as any);

  res.json({
    success: true,
    period,
    ...stats
  });
}));

// Helper function to generate recommendations
function generateRecommendations(report: any): string[] {
  const recommendations = [];

  if (report.diversification < 40) {
    recommendations.push('⚠️ Low diversification - Consider activating more revenue streams');
  }

  const txFeeStream = report.streams.find((s: any) => s.source === 'Transaction Fees');
  if (!txFeeStream || txFeeStream.amount < 100) {
    recommendations.push('💡 Enable transaction fees on on/off-ramp to capture usage revenue');
  }

  const affiliateStream = report.streams.find((s: any) => s.source === 'Affiliate Yields');
  if (!affiliateStream || affiliateStream.amount < 50) {
    recommendations.push('💡 Promote DeFi vault strategies to increase affiliate yields');
  }

  const marketplaceStream = report.streams.find((s: any) => s.source === 'MTAA Marketplace');
  if (!marketplaceStream || marketplaceStream.amount < 1000) {
    recommendations.push('💡 Add more MTAA marketplace items (achievements, themes, perks)');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Revenue diversification is healthy - maintain current strategy');
  }

  return recommendations;
}

export default router;
