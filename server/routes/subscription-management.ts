
import { Router } from 'express';
import { subscriptionService } from '../services/subscriptionService';
import { isAuthenticated } from '../auth';
import { Logger } from '../utils/logger';

const router = Router();
const logger = Logger.getLogger();

// Get subscription details for a DAO
router.get('/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const details = await subscriptionService.getSubscriptionDetails(daoId);
    res.json(details);
  } catch (error: any) {
    logger.error('Get subscription details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upgrade/change subscription
router.post('/:daoId/upgrade', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = (req.user as any)?.claims?.id;
    
    const result = await subscriptionService.upgradeSubscription({
      daoId,
      userId,
      ...req.body
    });
    
    res.json(result);
  } catch (error: any) {
    logger.error('Subscription upgrade error:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Cancel subscription
router.post('/:daoId/cancel', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = (req.user as any)?.claims?.id;
    
    const result = await subscriptionService.cancelSubscription(daoId, userId);
    res.json(result);
  } catch (error: any) {
    logger.error('Subscription cancel error:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
