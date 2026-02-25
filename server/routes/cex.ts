/**
 * CEX API Routes
 * Endpoints for managing CEX credentials, orders, and price data
 * 
 * Routes:
 * POST   /api/cex/credentials           - Store encrypted API keys
 * GET    /api/cex/credentials           - Get credentials status
 * DELETE /api/cex/credentials           - Delete credentials
 * POST   /api/cex/credentials/test      - Test connection
 * GET    /api/cex/prices                - Get price comparison
 * POST   /api/cex/smart-route           - Calculate optimal trading route
 * GET    /api/cex/arbitrage             - Get arbitrage opportunities
 * POST   /api/cex/orders                - Place order
 * GET    /api/cex/orders                - Get user orders
 */

import { Router, Request, Response } from 'express';
import { CEXCredentialRepository } from '../repositories/cexCredentialRepository';
import { CEXPriceRepository } from '../repositories/cexPriceRepository';
import { CEXOrderRepository } from '../repositories/cexOrderRepository';
import { ArbitrageRepository } from '../repositories/arbitrageRepository';
import { KeyManagementService } from '../services/keyManagementService';
import {
  cexAuthMiddleware,
  optionalCexAuthMiddleware,
  validateExchange,
  validateTradingPair,
  validateCredentialRequest,
  rateLimitCredentials,
} from '../middleware/cexAuthMiddleware';
import {
  cexAuditLoggerMiddleware,
  getAuditLogEndpoint,
  getAuditStatsEndpoint,
} from '../middleware/cexAuditLogger';

const router = Router();
const keyMgmt = KeyManagementService.getInstance();

/**
 * Apply middleware to all CEX routes
 */
router.use(cexAuditLoggerMiddleware);

/**
 * POST /api/cex/credentials
 * Store encrypted API credentials
 */
router.post(
  '/credentials',
  rateLimitCredentials,
  validateExchange,
  validateCredentialRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { exchange, apiKey, apiSecret, passphrase, isSandbox } = req.body;

      // Store credentials (automatically encrypted)
      const credential = await CEXCredentialRepository.storeCredentials(
        userId,
        exchange,
        apiKey,
        apiSecret,
        passphrase
      );

      // Return safe response (no secrets)
      res.json({
        success: true,
        exchange: credential.exchange,
        isSandbox: credential.isSandbox,
        isActive: credential.isActive,
        createdAt: credential.createdAt,
        message: `Credentials stored for ${exchange}`,
      });
    } catch (error) {
      console.error('Failed to store credentials:', error);
      res.status(500).json({
        error: 'Failed to store credentials',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/cex/credentials
 * Get credentials status (without exposing secrets)
 */
router.get('/credentials', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const summary = await CEXCredentialRepository.getCredentialSummary(userId);

    if (!summary) {
      res.json({
        configured: false,
        message: 'No CEX credentials configured',
      });
      return;
    }

    res.json({
      configured: true,
      exchange: summary.exchange,
      apiKeyPreview: summary.apiKeyPreview,
      isActive: summary.isActive,
      lastUsedAt: summary.lastUsedAt,
    });
  } catch (error) {
    console.error('Failed to get credentials:', error);
    res.status(500).json({
      error: 'Failed to retrieve credentials status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/cex/credentials
 * Permanently delete credentials
 */
router.delete('/credentials', rateLimitCredentials, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Require confirmation
    const { confirmDelete } = req.body;
    if (!confirmDelete) {
      res.status(400).json({
        error: 'Confirmation required',
        message: 'Set confirmDelete: true to permanently delete credentials',
      });
      return;
    }

    await CEXCredentialRepository.deleteCredentials(userId);
    await keyMgmt.logAudit('decrypt', 'api_credentials', true, 'credentials_deleted', userId);

    res.json({
      success: true,
      message: 'Credentials permanently deleted',
    });
  } catch (error) {
    console.error('Failed to delete credentials:', error);
    res.status(500).json({
      error: 'Failed to delete credentials',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/cex/credentials/test
 * Test credentials by attempting connection
 */
router.post('/credentials/test', rateLimitCredentials, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const testResult = await CEXCredentialRepository.testCredentials(userId);

    res.json({
      valid: testResult.valid,
      exchange: testResult.exchange,
      message: testResult.message,
      testedAt: new Date(),
    });
  } catch (error) {
    console.error('Credential test failed:', error);
    res.status(500).json({
      error: 'Credential test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/cex/prices?pair=BTC/USDT
 * Get price comparison across exchanges
 */
router.get('/prices', optionalCexAuthMiddleware, validateTradingPair, async (req: Request, res: Response) => {
  try {
    const pair = String(req.query.pair);

    // Get prices for this pair from all exchanges
    const prices = await CEXPriceRepository.getPriceComparison(pair);

    if (prices.length === 0) {
      res.json({
        pair,
        priceData: [],
        message: 'No price data available for this pair',
      });
      return;
    }

    // Calculate statistics
    const priceValues = prices.map(p => parseFloat(p.price));
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    const avgPrice = priceValues.reduce((a, b) => a + b) / priceValues.length;
    const spread = maxPrice - minPrice;
    const spreadPercent = (spread / avgPrice) * 100;

    res.json({
      pair,
      priceData: prices.map(p => ({
        exchange: p.exchange,
        price: p.price,
        bid: p.bid,
        ask: p.ask,
        volume: p.volume,
        timestamp: p.timestamp,
      })),
      statistics: {
        minPrice,
        maxPrice,
        averagePrice: avgPrice.toFixed(8),
        spread,
        spreadPercent: spreadPercent.toFixed(4),
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to get prices:', error);
    res.status(500).json({
      error: 'Failed to retrieve prices',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/cex/smart-route
 * Calculate optimal trading route with cost analysis
 */
router.post(
  '/smart-route',
  optionalCexAuthMiddleware,
  validateTradingPair,
  async (req: Request, res: Response) => {
    try {
      const { pair, amount, mode, slippageTolerance } = req.body;

      if (!pair || !amount || !mode) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['pair', 'amount', 'mode'],
          mode: 'buy | sell',
        });
        return;
      }

      // Get prices for comparison
      const prices = await CEXPriceRepository.getPriceComparison(pair);

      if (prices.length === 0) {
        res.status(400).json({
          error: 'No price data available',
          message: `Cannot calculate route for ${pair}`,
        });
        return;
      }

      // Rank by best price for mode
      const ranked = prices
        .map(p => ({
          exchange: p.exchange,
          price: parseFloat(p.price),
          bid: parseFloat(p.bid || p.price),
          ask: parseFloat(p.ask || p.price),
          volume: parseFloat(p.volume || '0'),
          cost: mode === 'buy' ? parseFloat(p.ask || p.price) : parseFloat(p.bid || p.price),
        }))
        .sort((a, b) => (mode === 'buy' ? a.cost - b.cost : b.cost - a.cost));

      const recommendedExchange = ranked[0];
      const slippage = parseFloat(slippageTolerance || '0.5');

      res.json({
        pair,
        mode,
        amount,
        recommendedExchange: {
          exchange: recommendedExchange.exchange,
          price: recommendedExchange.cost,
          volume: recommendedExchange.volume,
        },
        allRoutes: ranked.map(r => ({
          exchange: r.exchange,
          price: r.cost,
          volume: r.volume,
          estimatedCost: (parseFloat(amount) * r.cost).toFixed(8),
        })),
        slippageTolerance: `${slippage}%`,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to calculate smart route:', error);
      res.status(500).json({
        error: 'Failed to calculate smart route',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/cex/arbitrage
 * Get active arbitrage opportunities
 */
router.get('/arbitrage', optionalCexAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const minProfit = req.query.minProfit as string || '0.5';

    // Get active opportunities
    const opportunities = await ArbitrageRepository.getActiveOpportunities(minProfit);

    if (opportunities.length === 0) {
      res.json({
        opportunities: [],
        message: 'No arbitrage opportunities detected',
        minProfitPercent: minProfit,
      });
      return;
    }

    res.json({
      opportunities: opportunities.map(opp => ({
        id: opp.id,
        pair: opp.tradingPair,
        buy: {
          exchange: opp.buyExchange,
          price: opp.buyPrice,
          liquidity: opp.buyLiquidity,
        },
        sell: {
          exchange: opp.sellExchange,
          price: opp.sellPrice,
          liquidity: opp.sellLiquidity,
        },
        profit: {
          spread: `${opp.spreadPercent}%`,
          estimatedAmount: opp.estimatedProfit,
          netAmount: opp.netProfit,
        },
        status: opp.status,
        detectedAt: opp.detectedAt,
      })),
      total: opportunities.length,
      minProfitPercent: minProfit,
    });
  } catch (error) {
    console.error('Failed to get arbitrage opportunities:', error);
    res.status(500).json({
      error: 'Failed to retrieve arbitrage opportunities',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/cex/orders
 * Place an order on exchange
 */
router.post('/orders', cexAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { exchange, pair, orderType, side, amount, price } = req.body;
    const cexCreds = (req as any).cex;

    // Validate order parameters
    if (!pair || !orderType || !side || !amount) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['pair', 'orderType', 'side', 'amount'],
        optional: ['price'], // Required for limit orders
      });
      return;
    }

    // Create order record
    const order = await CEXOrderRepository.createOrder(
      userId,
      exchange,
      orderType,
      side,
      pair,
      amount,
      price
    );

    // In production, would integrate with actual exchange API here
    // For now, return order structure

    res.json({
      success: true,
      orderId: order.id,
      exchange: order.exchange,
      pair: order.tradingPair,
      side: order.orderSide,
      amount: order.amount,
      price: order.price,
      status: order.status,
      createdAt: order.createdAt,
      message: 'Order submitted',
    });
  } catch (error) {
    console.error('Failed to place order:', error);
    res.status(500).json({
      error: 'Failed to place order',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/cex/orders?limit=50&offset=0
 * Get user's orders
 */
router.get('/orders', cexAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const orders = await CEXOrderRepository.getUserOrders(userId, limit, offset);
    const stats = await CEXOrderRepository.getUserOrderStats(userId);

    res.json({
      orders: orders.map(o => ({
        id: o.id,
        exchange: o.exchange,
        pair: o.tradingPair,
        side: o.orderSide,
        amount: o.amount,
        price: o.price,
        status: o.status,
        filled: o.filledAmount,
        fee: o.fee,
        createdAt: o.createdAt,
      })),
      stats,
      pagination: {
        limit,
        offset,
        total: stats.totalOrders,
      },
    });
  } catch (error) {
    console.error('Failed to get orders:', error);
    res.status(500).json({
      error: 'Failed to retrieve orders',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Admin endpoints for audit logs
 */
router.get('/admin/audit-logs', getAuditLogEndpoint);
router.get('/admin/audit-stats', getAuditStatsEndpoint);

export default router;
