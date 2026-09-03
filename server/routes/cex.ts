import { Router } from 'express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
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

// Standard Express type extension for authenticated user context.
// The CEX payload is already declared in the Express Request augmentation used by the auth middleware.
interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

const router = Router();
const keyMgmt = KeyManagementService.getInstance();

/**
 * Higher-order utility to remove try/catch boilerplate across handlers
 */
const asyncHandler = (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch((error) => {
      console.error(`[CEXApiRoutes] Error handling ${req.method} ${req.path}:`, error);
      res.status(500).json({
        error: `Failed to execute ${req.path}`,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  };

/**
 * Helper to validate authenticated user presence
 */
const requireUserId = (req: AuthenticatedRequest, res: Response): string | null => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return null;
  }
  return userId;
};

// Global Audit Logger Middleware
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
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { exchange, apiKey, apiSecret, passphrase } = req.body;

    const credential = await CEXCredentialRepository.storeCredentials(
      userId,
      exchange,
      apiKey,
      apiSecret,
      passphrase
    );

    return res.json({
      success: true,
      exchange: credential.exchange,
      isSandbox: credential.isSandbox,
      isActive: credential.isActive,
      createdAt: credential.createdAt,
      message: `Credentials stored for ${exchange}`,
    });
  })
);

/**
 * GET /api/cex/credentials
 * Get credentials status (without exposing secrets)
 */
router.get(
  '/credentials',
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const summary = await CEXCredentialRepository.getCredentialSummary(userId);

    if (!summary) {
      return res.json({
        configured: false,
        message: 'No CEX credentials configured',
      });
    }

    return res.json({
      configured: true,
      exchange: summary.exchange,
      apiKeyPreview: summary.apiKeyPreview,
      isActive: summary.isActive,
      lastUsedAt: summary.lastUsedAt,
    });
  })
);

/**
 * DELETE /api/cex/credentials
 * Permanently delete credentials
 */
router.delete(
  '/credentials',
  rateLimitCredentials,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { confirmDelete } = req.body;
    if (!confirmDelete) {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Set confirmDelete: true to permanently delete credentials',
      });
    }

    await CEXCredentialRepository.deleteCredentials(userId);
    await keyMgmt.logAudit('decrypt', 'api_credentials', true, 'credentials_deleted', userId);

    return res.json({
      success: true,
      message: 'Credentials permanently deleted',
    });
  })
);

/**
 * POST /api/cex/credentials/test
 * Test credentials by attempting connection
 */
router.post(
  '/credentials/test',
  rateLimitCredentials,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const testResult = await CEXCredentialRepository.testCredentials(userId);

    return res.json({
      valid: testResult.valid,
      exchange: testResult.exchange,
      message: testResult.message,
      testedAt: new Date(),
    });
  })
);

/**
 * GET /api/cex/prices?pair=BTC/USDT
 * Get price comparison across exchanges
 */
router.get(
  '/prices',
  optionalCexAuthMiddleware,
  validateTradingPair,
  asyncHandler(async (req, res) => {
    const pair = String(req.query.pair);
    const prices = await CEXPriceRepository.getPriceComparison(pair);

    if (prices.length === 0) {
      return res.json({
        pair,
        priceData: [],
        message: 'No price data available for this pair',
      });
    }

    const priceValues = prices.map((p) => parseFloat(p.price));
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    const avgPrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
    const spread = maxPrice - minPrice;
    const spreadPercent = (spread / avgPrice) * 100;

    return res.json({
      pair,
      priceData: prices.map((p) => ({
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
  })
);

/**
 * POST /api/cex/smart-route
 * Calculate optimal trading route with cost analysis
 */
router.post(
  '/smart-route',
  optionalCexAuthMiddleware,
  validateTradingPair,
  asyncHandler(async (req, res) => {
    const { pair, amount, mode, slippageTolerance } = req.body;

    if (!pair || !amount || !mode) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['pair', 'amount', 'mode'],
        mode: 'buy | sell',
      });
    }

    const prices = await CEXPriceRepository.getPriceComparison(pair);

    if (prices.length === 0) {
      return res.status(400).json({
        error: 'No price data available',
        message: `Cannot calculate route for ${pair}`,
      });
    }

    const ranked = prices
      .map((p) => {
        const fallbackPrice = parseFloat(p.price);
        const ask = p.ask ? parseFloat(p.ask) : fallbackPrice;
        const bid = p.bid ? parseFloat(p.bid) : fallbackPrice;
        return {
          exchange: p.exchange,
          price: fallbackPrice,
          bid,
          ask,
          volume: p.volume ? parseFloat(p.volume) : 0,
          cost: mode === 'buy' ? ask : bid,
        };
      })
      .sort((a, b) => (mode === 'buy' ? a.cost - b.cost : b.cost - a.cost));

    const recommendedExchange = ranked[0];
    const slippage = parseFloat(slippageTolerance || '0.5');

    return res.json({
      pair,
      mode,
      amount,
      recommendedExchange: {
        exchange: recommendedExchange.exchange,
        price: recommendedExchange.cost,
        volume: recommendedExchange.volume,
      },
      allRoutes: ranked.map((r) => ({
        exchange: r.exchange,
        price: r.cost,
        volume: r.volume,
        estimatedCost: (parseFloat(amount) * r.cost).toFixed(8),
      })),
      slippageTolerance: `${slippage}%`,
      timestamp: new Date(),
    });
  })
);

/**
 * GET /api/cex/arbitrage
 * Get active arbitrage opportunities
 */
router.get(
  '/arbitrage',
  optionalCexAuthMiddleware,
  asyncHandler(async (req, res) => {
    const minProfit = (req.query.minProfit as string) || '0.5';
    const opportunities = await ArbitrageRepository.getActiveOpportunities(minProfit);

    if (opportunities.length === 0) {
      return res.json({
        opportunities: [],
        message: 'No arbitrage opportunities detected',
        minProfitPercent: minProfit,
      });
    }

    return res.json({
      opportunities: opportunities.map((opp) => ({
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
  })
);

/**
 * POST /api/cex/orders
 * Place an order on exchange
 */
router.post(
  '/orders',
  cexAuthMiddleware,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { exchange, pair, orderType, side, amount, price } = req.body;

    if (!pair || !orderType || !side || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['pair', 'orderType', 'side', 'amount'],
        optional: ['price'],
      });
    }

    const order = await CEXOrderRepository.createOrder(
      userId,
      exchange,
      orderType,
      side,
      pair,
      amount,
      price
    );

    return res.json({
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
  })
);

/**
 * GET /api/cex/orders?limit=50&offset=0
 * Get user's orders
 */
router.get(
  '/orders',
  cexAuthMiddleware,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const limit = Math.max(1, parseInt(req.query.limit as string) || 50);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

    const [orders, stats] = await Promise.all([
      CEXOrderRepository.getUserOrders(userId, limit, offset),
      CEXOrderRepository.getUserOrderStats(userId),
    ]);

    return res.json({
      orders: orders.map((o) => ({
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
  })
);

/**
 * Admin endpoints for audit logs
 */
router.get('/admin/audit-logs', getAuditLogEndpoint);
router.get('/admin/audit-stats', getAuditStatsEndpoint);

export default router;