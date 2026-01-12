
import express from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const router = express.Router();
const logger = new Logger('user-preferences');

// Supported currencies for display
const SUPPORTED_CURRENCIES = [
  'CELO', 'cUSD', 'cEUR', 'cREAL', 'USDC', 'USDT', 'VEUR',
  'USD', 'EUR', 'KES', 'GHS', 'NGN'
];

// Get user preferences (including currency settings)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        preferredCurrency: true
      }
    });

    // Parse stored currency preferences (stored as JSON string)
    let currencyPreferences = {
      primaryCurrency: 'cUSD',
      secondaryCurrency: 'KES'
    };

    if (user?.preferredCurrency) {
      try {
        currencyPreferences = JSON.parse(user.preferredCurrency);
      } catch (e) {
        // If not JSON, treat as legacy single currency preference
        currencyPreferences.primaryCurrency = user.preferredCurrency;
      }
    }

    res.json({
      success: true,
      data: {
        preferredCurrency: currencyPreferences.primaryCurrency,
        primaryCurrency: currencyPreferences.primaryCurrency,
        secondaryCurrency: currencyPreferences.secondaryCurrency
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
    const { currency, primaryCurrency, secondaryCurrency } = req.body;

    // Validate currencies
    let currencyToStore = currency || 'cUSD';
    
    if (primaryCurrency || secondaryCurrency) {
      const primary = primaryCurrency || 'cUSD';
      const secondary = secondaryCurrency || 'KES';

      if (!SUPPORTED_CURRENCIES.includes(primary)) {
        return res.status(400).json({ 
          error: `Invalid primary currency: ${primary}. Supported: ${SUPPORTED_CURRENCIES.join(', ')}` 
        });
      }

      if (!SUPPORTED_CURRENCIES.includes(secondary)) {
        return res.status(400).json({ 
          error: `Invalid secondary currency: ${secondary}. Supported: ${SUPPORTED_CURRENCIES.join(', ')}` 
        });
      }

      currencyToStore = JSON.stringify({
        primaryCurrency: primary,
        secondaryCurrency: secondary
      });
    } else if (!SUPPORTED_CURRENCIES.includes(currencyToStore)) {
      return res.status(400).json({ 
        error: `Invalid currency. Must be one of: ${SUPPORTED_CURRENCIES.join(', ')}` 
      });
    }

    await db.update(users)
      .set({ preferredCurrency: currencyToStore })
      .where(eq(users.id, userId));

    logger.info(`User ${userId} updated currency preferences to ${currencyToStore}`);

    res.json({
      success: true,
      message: 'Currency preferences updated',
      data: {
        preferredCurrency: primaryCurrency || currency,
        secondaryCurrency: secondaryCurrency || 'KES'
      }
    });
  } catch (error: any) {
    logger.error('Error updating currency preferences', error);
    res.status(500).json({ error: error.message });
  }
});

// Get supported currencies list
router.get('/currencies/supported', (req, res) => {
  res.json({
    success: true,
    data: SUPPORTED_CURRENCIES
  });
});

export default router;
