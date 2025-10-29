
import { Router } from 'express';
import { economyService } from '../services/economyService';
import { requireAuth } from '../middleware/rbac';

const router = Router();

/**
 * GET /api/economy/gdp
 * Get GDP effect metrics
 */
router.get('/gdp', async (req, res) => {
  try {
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'weekly';
    const metrics = await economyService.calculateGDPEffect(period);
    
    res.json({
      success: true,
      period,
      metrics
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/economy/earn
 * Get available earning opportunities
 */
router.get('/earn', requireAuth, async (req, res) => {
  try {
    const opportunities = await economyService.getEarnOpportunities(req.user!.id);
    
    res.json({
      success: true,
      opportunities
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/economy/spend
 * Get merchants accepting MTAA
 */
router.get('/spend', async (req, res) => {
  try {
    const location = req.query.location as string;
    const merchants = await economyService.getSpendOptions(location);
    
    res.json({
      success: true,
      merchants
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/economy/redeem/rates
 * Get redemption rates
 */
router.get('/redeem/rates', async (req, res) => {
  try {
    const rates = await economyService.getRedemptionRates();
    
    res.json({
      success: true,
      rates
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/economy/redeem
 * Merchant redemption of MTAA tokens
 */
router.post('/redeem', requireAuth, async (req, res) => {
  try {
    const { amount, toCurrency, method } = req.body;
    
    if (!amount || !toCurrency || !method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const result = await economyService.redeemMerchantTokens(
      req.user!.id,
      amount,
      toCurrency,
      method
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/economy/earn
 * Record an earning transaction
 */
router.post('/earn', requireAuth, async (req, res) => {
  try {
    const { amount, source, metadata } = req.body;
    
    if (!amount || !source) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    await economyService.recordEarn(req.user!.id, amount, source, metadata);
    
    res.json({
      success: true,
      message: 'Earning recorded successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/economy/spend
 * Record a spending transaction
 */
router.post('/spend', requireAuth, async (req, res) => {
  try {
    const { merchantId, amount, description } = req.body;
    
    if (!merchantId || !amount || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    await economyService.recordSpend(req.user!.id, merchantId, amount, description);
    
    res.json({
      success: true,
      message: 'Spending recorded successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
