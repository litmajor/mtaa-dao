/**
 * Inflows Router - V1 Canonical Endpoint
 * 
 * Shared operations between deposits and withdrawals:
 * - Stable asset discovery and metadata
 * - Exchange rates and pricing
 * - Provider fees and limits
 * 
 * Endpoints (3):
 * GET    /inflows/stable-assets        List stable assets (USDC, USDT, DAI, etc)
 * GET    /inflows/rates                Get exchange rates
 * GET    /inflows/providers            List payment providers
 * 
 * Referenced by:
 * - /v1/wallets/deposits/stable-assets (redirects here)
 * - /v1/wallets/withdrawals/stable-assets (redirects here)
 */

import express, { Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../../../auth';

const router = express.Router({ mergeParams: true });

/**
 * GET /inflows/stable-assets
 * List stable assets and their properties
 * 
 * Canonical endpoint for stable-asset discovery
 * Used by both deposits and withdrawals
 */
router.get(
  '/stable-assets',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

      res.json({
        success: true,
        data: {
          assets: [
            {
              symbol: 'USDC',
              name: 'USD Coin',
              decimal: 6,
              chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
              description: 'Circle-issued USD stablecoin',
            },
            {
              symbol: 'USDT',
              name: 'Tether USD',
              decimal: 6,
              chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'tron', 'solana'],
              description: 'Tether-issued USD stablecoin',
            },
            {
              symbol: 'DAI',
              name: 'DAI Stablecoin',
              decimal: 18,
              chains: ['ethereum', 'polygon', 'arbitrum', 'optimism'],
              description: 'MakerDAO decentralized stablecoin',
            },
            {
              symbol: 'BUSD',
              name: 'Binance USD',
              decimal: 18,
              chains: ['ethereum', 'binance', 'polygon'],
              description: 'Binance-issued USD stablecoin',
            },
            {
              symbol: 'CUSD',
              name: 'Celo Dollar',
              decimal: 18,
              chains: ['celo'],
              description: 'Native Celo stablecoin',
            },
          ],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inflows/rates
 * Get current exchange rates for stable assets
 * 
 * Returns real-time USD conversion rates from CoinGecko API
 * Caches results for 60 seconds to reduce API calls
 */

// Simple in-memory cache for rates
let ratesCache = {
  rates: {} as Record<string, number>,
  timestamp: 0,
};

async function fetchRatesFromAPI(): Promise<Record<string, number>> {
  try {
    // Check cache (valid for 60 seconds)
    if (Date.now() - ratesCache.timestamp < 60000) {
      return ratesCache.rates;
    }

    // Fetch from CoinGecko API (free, no auth required)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,dai,binance-usd,celo&vs_currencies=usd,eur,gbp&include_market_cap=false&include_24hr_vol=false'
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform CoinGecko response to our format
    const rates: Record<string, number> = {
      // Crypto assets (relative to USD)
      USDC: data['usd-coin']?.usd || 1.0,
      USDT: data['tether']?.usd || 1.0,
      DAI: data['dai']?.usd || 1.0,
      BUSD: data['binance-usd']?.usd || 1.0,
      CUSD: data['celo']?.usd || 1.0,

      // Fiat currencies (we'll use a separate API or hardcode safe values)
      EUR: 0.92,
      GBP: 0.79,
      KES: 130.5,
      ZAR: 18.5,
    };

    // Update cache
    ratesCache = {
      rates,
      timestamp: Date.now(),
    };

    return rates;
  } catch (error) {
    console.error('Error fetching rates from CoinGecko:', error);
    // Return last known rates or defaults
    return ratesCache.rates || {
      USDC: 1.0,
      USDT: 1.0,
      DAI: 1.0,
      BUSD: 1.0,
      CUSD: 1.0,
      EUR: 0.92,
      GBP: 0.79,
      KES: 130.5,
      ZAR: 18.5,
    };
  }
}

router.get(
  '/rates',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get source currency from query (default: USD)
      const baseCurrency = (req.query.base as string) || 'USD';

      // Fetch real-time rates
      const rates = await fetchRatesFromAPI();

      res.json({
        success: true,
        data: {
          base: baseCurrency,
          rates,
          cached: ratesCache.timestamp > 0,
          cacheAge: Date.now() - ratesCache.timestamp,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /inflows/providers
 * List available payment providers with their details
 * 
 * Used by both deposits and withdrawals to show available methods
 */
router.get(
  '/providers',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: {
          providers: [
            {
              id: 'stripe',
              name: 'Stripe',
              type: 'onramp',
              currencies: ['USD', 'EUR', 'GBP'],
              minAmount: '10',
              maxAmount: '5000',
              fee: {
                percentage: 2.5,
                fixed: '0.30',
              },
              settlementTime: '1-3 days',
              description: 'Credit/Debit cards worldwide',
              supportedCountries: 195,
            },
            {
              id: 'kotanipay',
              name: 'Kotanipay',
              type: 'onramp',
              currencies: ['USD', 'KES'],
              minAmount: '5',
              maxAmount: '2500',
              fee: {
                percentage: 3.5,
                fixed: '0.00',
              },
              settlementTime: '30 minutes',
              description: 'East Africa payment method',
              supportedCountries: 5,
            },
            {
              id: 'mpesa',
              name: 'M-Pesa',
              type: 'onramp',
              currencies: ['KES'],
              minAmount: '1',
              maxAmount: '500',
              fee: {
                percentage: 1.0,
                fixed: '0.00',
              },
              settlementTime: 'Instant',
              description: 'Mobile money (Kenya)',
              supportedCountries: 1,
            },
            {
              id: 'bank_transfer',
              name: 'Bank Transfer',
              type: 'offramp',
              currencies: ['USD', 'EUR', 'GBP', 'ZAR', 'KES'],
              minAmount: '50',
              maxAmount: '10000',
              fee: {
                percentage: 0.5,
                fixed: '5.00',
              },
              settlementTime: '1-5 business days',
              description: 'Direct bank transfer to any account',
              supportedCountries: 150,
            },
            {
              id: 'wallet_transfer',
              name: 'Wallet Transfer',
              type: 'transfer',
              currencies: ['USDC', 'USDT', 'ETH', 'CELO'],
              minAmount: '0.01',
              maxAmount: 'unlimited',
              fee: {
                percentage: 0.0,
                fixed: 'network',
              },
              settlementTime: '5-60 seconds',
              description: 'Send/receive from any Web3 wallet',
              supportedCountries: 195,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
