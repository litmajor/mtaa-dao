
import express from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const router = express.Router();
const logger = new Logger('user-preferences');

// Get user preferences
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        preferredCurrency: true
      }
    });

    res.json({
      success: true,
      data: {
        preferredCurrency: user?.preferredCurrency || 'cUSD'
      }
    });
  } catch (error: any) {
    logger.error('Error fetching user preferences', error);
    res.status(500).json({ error: error.message });
  }
});

// Update preferred currency
router.put('/currency', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { currency } = req.body;

    // Validate currency
    const validCurrencies = ['cUSD', 'cKES', 'cEUR', 'USDC', 'USDT', 'CELO'];
    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({ 
        error: 'Invalid currency. Must be one of: ' + validCurrencies.join(', ') 
      });
    }

    await db.update(users)
      .set({ preferredCurrency: currency })
      .where(eq(users.id, userId));

    logger.info(`User ${userId} updated preferred currency to ${currency}`);

    res.json({
      success: true,
      message: 'Preferred currency updated',
      data: { preferredCurrency: currency }
    });
  } catch (error: any) {
    logger.error('Error updating preferred currency', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
