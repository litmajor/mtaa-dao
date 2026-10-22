/**
 * ════════════════════════════════════════════════════════════════════════════════
 * YUKI Intelligence Router — Market Signals & Microstructure
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Mount point: /v1/yuki/intelligence
 * (13th YUKI sub-router — see execute, exchanges, orders, market, marketplace,
 *  routing, strategies, dex, rebalancing, staking, algo, bridge)
 *
 * Real-time WebSocket feeds, futures analytics (funding, liquidations, OI),
 * and proprietary microstructure alpha signals — now covering both
 * CEX order-book microstructure (order flow toxicity, vol-of-vol, price
 * impact) and AMM/DEX microstructure (cross-DEX liquidity concentration,
 * constant-product impact curves, pool price deviation, sandwich exposure).
 *
 * ⚠️ REQUIRES AUTHENTICATION: authenticateToken applied globally below.
 * ⚠️ ADVANCED MODE: /liquidation-risk accepts a leverage param and is gated
 *    behind advancedModeGuard, consistent with bridge/swap + bridge/transfer.
 *
 * Audit note: this router previously lived unversioned at /api/v1/priority4
 * (unauthenticated, Feb 2026), then was flattened to /api/trading-signals
 * (authenticated but outside the /v1/yuki mount tree — not covered by the
 * versioned route-intelligence enricher or the chain/exchange allowlists
 * used elsewhere in YUKI). This revision folds it into /v1/yuki so it's
 * covered by the same audit surface as the other 12 sub-routers. -- July 2026
 *
 * AMM section note: unlike the CEX section, AMM routes take no `exchange`
 * param and are NOT run through validateExchange — there's no single
 * "exchange" concept for a DEX aggregation spanning many chains/DEXes.
 * Only `symbol` is validated. Optional `dex`/`chain` query filters are
 * passed through to dexscreenerClient's own filtering rather than checked
 * against a fixed allowlist, since the DEX/chain universe is meant to
 * grow (that's the whole point of covering "the broader ecosystem") and
 * a fixed allowlist here would fight that goal the way it wouldn't for
 * the fixed, small set of supported CEXes.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { Router} from 'express';
import type {Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../../../middleware/auth';
import advancedModeGuard from '../../../middleware/advancedModeGuard'; // fixed: default import to match bridge.ts
import { websocketRealtimeFeeds } from '../../../services/websocketRealTimeFeeds';
import { futuresMarketSupport } from '../../../services/futuresMarketSupport';
import { advancedMicrostructureIndicators } from '../../../services/advancedMicrostructureIndicators';
import { ammMicrostructureIndicators } from '../../../services/ammMicrostructureIndicators';
import { dexscreenerClient, type DexPair } from '../../../services/dexscreenerClient';
import { ApiResponse } from '../../../utils/apiResponse';
import { logger } from '../../../utils/logger';
import { getMarketSentiment } from '../../../services/fearGreedIndex';

const router = Router();

// ════════════════════════════════════════════════════════════════════════════════
// 🔒 AUTHENTICATION — applies to every route below
// ════════════════════════════════════════════════════════════════════════════════
router.use(authenticateToken as any);

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION — exchange/symbol allowlist (CEX routes only)
// ════════════════════════════════════════════════════════════════════════════════
const SUPPORTED_EXCHANGES = ['binance', 'coinbase', 'kraken', 'bybit', 'okx'] as const;
type SupportedExchange = (typeof SUPPORTED_EXCHANGES)[number];

function validateExchange(exchange: unknown, res: Response): SupportedExchange | null {
  const ex = String(exchange ?? 'binance').toLowerCase();
  if (!SUPPORTED_EXCHANGES.includes(ex as SupportedExchange)) {
    res.status(400).json(
      ApiResponse.error(`Unsupported exchange: ${exchange}`).addMeta({
        supported: SUPPORTED_EXCHANGES
      })
    );
    return null;
  }
  return ex as SupportedExchange;
}

// Symbols like "AAA/../etc" or overly long strings shouldn't reach service
// calls unvalidated — basic shape check, not an exhaustive symbol registry.
// Reused as-is for AMM routes: DEX-style pairs like "CELO/cUSD" already match.
const SYMBOL_PATTERN = /^[A-Z0-9]{2,15}(?:[-_/][A-Z0-9]{2,15})?$/i;

function validateSymbol(symbol: unknown, res: Response): string | null {
  const sym = String(symbol ?? '');
  if (!SYMBOL_PATTERN.test(sym)) {
    res.status(400).json(ApiResponse.error(`Invalid symbol format: ${symbol}`));
    return null;
  }
  return sym;
}

// ════════════════════════════════════════════════════════════════════════════════
// RATE LIMITING — grouped by cost, mirroring dex.ts
// ════════════════════════════════════════════════════════════════════════════════

const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many stats requests'
});

const futuresLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many futures data requests'
});

const predictionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many prediction requests'
});

const liquidationRiskLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many liquidation-risk requests'
});

const microstructureLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many microstructure requests'
});

// AMM routes fan out to dexscreenerClient (external, rate-limited at 300ms/req
// on its own side) plus on-pool math — budget in line with microstructureLimiter
// but kept separate in case AMM and CEX traffic need different tuning later.
const ammLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many AMM microstructure requests'
});

const alertsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many alert requests'
});

// Composite endpoint fans out to multiple downstream calls — tighter budget.
const compositeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many market-insight requests'
});

// ════════════════════════════════════════════════════════════════════════════════
// LEGACY WEBSOCKET UPGRADE ROUTE
// ════════════════════════════════════════════════════════════════════════════════

// NOTE: The `/api/trading/realtime`/`/v1/yuki/intelligence/realtime` upgrade route
// was formerly implemented with express-ws. The current server does not install or
// initialize express-ws, so that route is not available here. Real-time market feed
// traffic is served through the dedicated raw WebSocket price stream server at
// `/ws/prices` instead.

/**
 * GET /v1/yuki/intelligence/stats
 * WebSocket connection statistics
 */
router.get('/stats', statsLimiter, async (req: Request, res: Response) => {
  try {
    const stats = websocketRealtimeFeeds.getSubscriptionStats();
    res.json(
      ApiResponse.success({
        connectedClients: stats.totalClients,
        activeSubscriptions: stats.activeStreams,
        details: stats.streams,
        timestamp: Date.now()
      })
    );
  } catch (error) {
    logger.error('Failed to get WebSocket stats', { error });
    res.status(500).json(ApiResponse.error('Failed to get WebSocket stats'));
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// FUTURES MARKET SUPPORT
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/intelligence/funding-rate/:symbol
 */
router.get('/funding-rate/:symbol', futuresLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const fundingRate = await futuresMarketSupport.getFundingRate(symbol, exchange);

    res.json(ApiResponse.success({ ...fundingRate, cached: false }).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to get funding rate', { error });
    res.status(500).json(ApiResponse.error('Failed to get funding rate'));
  }
});

/**
 * GET /v1/yuki/intelligence/liquidations/:symbol
 */
router.get('/liquidations/:symbol', futuresLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const liquidationData = await futuresMarketSupport.getLiquidationData(symbol, exchange);

    res.json(
      ApiResponse.success({
        ...liquidationData,
        alerts: liquidationData.cascadeSeverity === 'extreme' ? ['LIQUIDATION CRISIS'] : []
      }).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to get liquidation data', { error });
    res.status(500).json(ApiResponse.error('Failed to get liquidation data'));
  }
});

/**
 * GET /v1/yuki/intelligence/open-interest/:symbol
 */
router.get('/open-interest/:symbol', futuresLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const openInterest = await futuresMarketSupport.getOpenInterest(symbol, exchange);

    res.json(ApiResponse.success(openInterest).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to get open interest', { error });
    res.status(500).json(ApiResponse.error('Failed to get open interest'));
  }
});

/**
 * POST /v1/yuki/intelligence/funding-prediction
 * Body: { symbol, exchange? }
 */
router.post('/funding-prediction', predictionLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.body.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.body.exchange, res);
    if (!exchange) return;

    const prediction = await futuresMarketSupport.predictFundingRate(symbol, exchange);

    res.json(ApiResponse.success(prediction).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to predict funding rate', { error });
    res.status(500).json(ApiResponse.error('Failed to predict funding rate'));
  }
});

/**
 * POST /v1/yuki/intelligence/liquidation-risk
 * Body: { symbol, entryPrice, leverage?, exchange? }
 *
 * 🔒 advancedModeGuard: this is the one endpoint in the router that takes a
 * leverage input and returns a leveraged risk assessment — same category as
 * bridge/swap + bridge/transfer, so it gets the same gate.
 */
router.post(
  '/liquidation-risk',
  liquidationRiskLimiter,
  advancedModeGuard as any,
  async (req: Request, res: Response) => {
    try {
      const symbol = validateSymbol(req.body.symbol, res);
      if (!symbol) return;
      const exchange = validateExchange(req.body.exchange, res);
      if (!exchange) return;

      const { entryPrice, leverage = 1 } = req.body;
      if (!entryPrice || typeof entryPrice !== 'number' || entryPrice <= 0) {
        return res.status(400).json(ApiResponse.error('entryPrice must be a positive number'));
      }
      if (typeof leverage !== 'number' || leverage <= 0 || leverage > 125) {
        return res.status(400).json(ApiResponse.error('leverage must be a number between 0 and 125'));
      }

      const riskAssessment = await futuresMarketSupport.detectLiquidationRisk(
        symbol,
        entryPrice,
        leverage,
        exchange
      );

      res.json(ApiResponse.success(riskAssessment).addMeta({ timestamp: Date.now() }));
    } catch (error) {
      logger.error('Failed to detect liquidation risk', { error });
      res.status(500).json(ApiResponse.error('Failed to detect liquidation risk'));
    }
  }
);

/**
 * GET /v1/yuki/intelligence/market-health/:symbol
 */
router.get('/market-health/:symbol', futuresLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const health = await futuresMarketSupport.getFuturesMarketHealth(symbol, exchange);

    res.json(ApiResponse.success(health).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to get futures market health', { error });
    res.status(500).json(ApiResponse.error('Failed to get futures market health'));
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// CEX MICROSTRUCTURE (order-book based — proprietary alpha signals)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/intelligence/order-flow/:symbol
 */
router.get('/order-flow/:symbol', microstructureLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const orderFlow = await advancedMicrostructureIndicators.analyzeOrderFlowImbalance(symbol, exchange);

    res.json(ApiResponse.success(orderFlow).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to analyze order flow', { error });
    res.status(500).json(ApiResponse.error('Failed to analyze order flow'));
  }
});

/**
 * GET /v1/yuki/intelligence/vol-of-vol/:symbol
 */
router.get('/vol-of-vol/:symbol', microstructureLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const periods = Number(req.query.periods ?? 24);
    if (!Number.isFinite(periods) || periods < 1 || periods > 500) {
      return res.status(400).json(ApiResponse.error('periods must be between 1 and 500'));
    }

    const volOfVol = await advancedMicrostructureIndicators.calculateVolatilityOfVolatility(
      symbol,
      exchange,
      periods
    );

    res.json(ApiResponse.success(volOfVol).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to calculate vol of vol', { error });
    res.status(500).json(ApiResponse.error('Failed to calculate vol of vol'));
  }
});

/**
 * GET /v1/yuki/intelligence/toxicity/:symbol
 */
router.get('/toxicity/:symbol', microstructureLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const toxicity = await advancedMicrostructureIndicators.detectOrderBookToxicity(symbol, exchange);

    res.json(ApiResponse.success(toxicity).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to detect order book toxicity', { error });
    res.status(500).json(ApiResponse.error('Failed to detect order book toxicity'));
  }
});

/**
 * GET /v1/yuki/intelligence/price-impact/:symbol
 */
router.get('/price-impact/:symbol', microstructureLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const impact = await advancedMicrostructureIndicators.analyzePriceImpact(symbol, exchange);

    res.json(ApiResponse.success(impact).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to analyze price impact', { error });
    res.status(500).json(ApiResponse.error('Failed to analyze price impact'));
  }
});

/**
 * GET /v1/yuki/intelligence/comprehensive/:symbol
 */
router.get('/comprehensive/:symbol', microstructureLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const indicators = await advancedMicrostructureIndicators.getComprehensiveMicrostructure(symbol, exchange);

    res.json(ApiResponse.success(indicators).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to get comprehensive microstructure', { error });
    res.status(500).json(ApiResponse.error('Failed to get comprehensive microstructure'));
  }
});

// Note: microstructure alert generation now exposed via /v1/yuki/alerts (CRUD).
// The intelligence router retains microstructure analysis routes but alert
// lifecycle endpoints were moved to server/routes/v1/yuki/alerts.ts

// ════════════════════════════════════════════════════════════════════════════════
// AMM / DEX MICROSTRUCTURE (reserve-based — cross-DEX, cross-chain ecosystem view)
// ════════════════════════════════════════════════════════════════════════════════
// No `exchange` param, no CEX allowlist — see file-level note at top.

/**
 * Resolve the highest-liquidity real pool for a symbol via dexscreenerClient,
 * optionally narrowed by dex/chain query filters. Shared by the routes below
 * that need a specific DexPair object (impact curve, sandwich risk, price
 * deviation) rather than the aggregated cross-DEX profile.
 */
async function resolveTopPool(
  symbol: string,
  dexFilter?: string,
  chainFilter?: string
): Promise<DexPair | null> {
  const pairs = await dexscreenerClient.searchPairs(symbol);
  const filtered = pairs.filter(p =>
    (p.liquidity?.usd ?? 0) > 0 &&
    (!dexFilter || p.dexId?.toLowerCase() === dexFilter.toLowerCase()) &&
    (!chainFilter || p.chainId?.toLowerCase() === chainFilter.toLowerCase())
  );
  if (filtered.length === 0) return null;
  return filtered.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

/**
 * Soft-validate optional AMM filters (`dex`, `chain`) against the dexscreener
 * results for the `symbol`. Unknown values are ignored and returned as
 * undefined, while a warning is emitted in the response meta. This implements
 * the "warn, don't block" failure mode: typos won't cause a hard 400.
 */
async function sanitizeAmmFilters(symbol: string, dex?: string, chain?: string): Promise<{ dex?: string; chain?: string; warnings: string[] }> {
  const warnings: string[] = [];
  try {
    const pairs = await dexscreenerClient.searchPairs(symbol);
    if (!pairs.length) {
      // Can't validate without pair data — don't block, but warn.
      if (dex) warnings.push(`Unable to validate dex filter '${dex}' (no dexscreener results)`);
      if (chain) warnings.push(`Unable to validate chain filter '${chain}' (no dexscreener results)`);
      return { dex, chain, warnings };
    }

    const availableDexes = new Set(pairs.map(p => (p.dexId || '').toLowerCase()));
    const availableChains = new Set(pairs.map(p => (p.chainId || '').toLowerCase()));

    let dexOk = dex;
    let chainOk = chain;

    if (dex) {
      if (!availableDexes.has(dex.toLowerCase())) {
        warnings.push(`Unknown DEX filter: '${dex}' — ignored; available: ${Array.from(availableDexes).slice(0,10).join(', ')}`);
        dexOk = undefined;
      }
    }

    if (chain) {
      if (!availableChains.has(chain.toLowerCase())) {
        warnings.push(`Unknown chain filter: '${chain}' — ignored; available: ${Array.from(availableChains).slice(0,10).join(', ')}`);
        chainOk = undefined;
      }
    }

    return { dex: dexOk, chain: chainOk, warnings };
  } catch (err) {
    // On error, do not block callers — return original values with a warning.
    if (dex) warnings.push(`Failed to validate dex filter '${dex}': ${String(err)}`);
    if (chain) warnings.push(`Failed to validate chain filter '${chain}': ${String(err)}`);
    return { dex, chain, warnings };
  }
}

/**
 * GET /v1/yuki/intelligence/amm/liquidity/:symbol
 * Cross-DEX liquidity concentration (HHI), total depth, and turnover ratio
 * across every DEX/chain dexscreenerClient indexes for this symbol.
 */
router.get('/amm/liquidity/:symbol', ammLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;

    const minLiquidityUSD = req.query.minLiquidityUsd ? Number(req.query.minLiquidityUsd) : undefined;
    if (minLiquidityUSD !== undefined && (!Number.isFinite(minLiquidityUSD) || minLiquidityUSD < 0)) {
      return res.status(400).json(ApiResponse.error('minLiquidityUsd must be a non-negative number'));
    }

    const profile = await ammMicrostructureIndicators.getCrossDexLiquidityProfile(
      symbol,
      minLiquidityUSD
    );

    res.json(ApiResponse.success(profile).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to get cross-DEX liquidity profile', { error });
    res.status(500).json(ApiResponse.error('Failed to get cross-DEX liquidity profile'));
  }
});

/**
 * GET /v1/yuki/intelligence/amm/impact-curve/:symbol?dex=&chain=
 * Constant-product price-impact curve for a pool. Defaults to the
 * highest-liquidity pool found for the symbol; dex/chain narrow the search.
 */
router.get('/amm/impact-curve/:symbol', ammLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const dexFilterRaw = req.query.dex ? String(req.query.dex) : undefined;
    const chainFilterRaw = req.query.chain ? String(req.query.chain) : undefined;

    const { dex: dexFilter, chain: chainFilter, warnings } = await sanitizeAmmFilters(symbol, dexFilterRaw, chainFilterRaw);

    const pool = await resolveTopPool(symbol, dexFilter, chainFilter);
    if (!pool) {
      // If filters were supplied but ignored, include that in the 404 meta to aid debugging
      const msg = `No DEX pool found for ${symbol}${dexFilterRaw ? ` on ${dexFilterRaw}` : ''}${chainFilterRaw ? ` (${chainFilterRaw})` : ''}`;
      return res.status(404).json(ApiResponse.error(msg).addMeta({ timestamp: Date.now(), warnings }));
    }

    const curve = ammMicrostructureIndicators.buildImpactCurve(pool);
    const meta: any = { timestamp: Date.now() };
    if (warnings?.length) meta.warnings = warnings;
    res.json(ApiResponse.success(curve).addMeta(meta));
  } catch (error) {
    logger.error('Failed to build AMM impact curve', { error });
    res.status(500).json(ApiResponse.error((error as Error).message || 'Failed to build AMM impact curve'));
  }
});

/**
 * GET /v1/yuki/intelligence/amm/price-deviation/:symbol?dex=&chain=
 * How far a pool's implied price (reserveQuote/reserveBase) has drifted
 * from priceOracle's external reference — staleness / arb-pressure signal.
 */
router.get('/amm/price-deviation/:symbol', ammLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const dexFilterRaw = req.query.dex ? String(req.query.dex) : undefined;
    const chainFilterRaw = req.query.chain ? String(req.query.chain) : undefined;

    const { dex: dexFilter, chain: chainFilter, warnings } = await sanitizeAmmFilters(symbol, dexFilterRaw, chainFilterRaw);

    const pool = await resolveTopPool(symbol, dexFilter, chainFilter);
    if (!pool) {
      const msg = `No DEX pool found for ${symbol}${dexFilterRaw ? ` on ${dexFilterRaw}` : ''}${chainFilterRaw ? ` (${chainFilterRaw})` : ''}`;
      return res.status(404).json(ApiResponse.error(msg).addMeta({ timestamp: Date.now(), warnings }));
    }

    const deviation = await ammMicrostructureIndicators.getPoolPriceDeviation(pool);
    const meta: any = { timestamp: Date.now() };
    if (warnings?.length) meta.warnings = warnings;
    res.json(ApiResponse.success(deviation).addMeta(meta));
  } catch (error) {
    logger.error('Failed to get AMM pool price deviation', { error });
    res.status(500).json(ApiResponse.error('Failed to get AMM pool price deviation'));
  }
});

/**
 * POST /v1/yuki/intelligence/amm/sandwich-risk
 * Body: { symbol, tradeSizeToken, dex?, chain? }
 *
 * Approximate sandwich-attack profitability heuristic for a specific trade
 * size against the resolved pool — see ammMicrostructureIndicators's own
 * doc comment: directional signal (impact vs round-trip fee cost), not an
 * exact MEV profit model. Not gated behind advancedModeGuard — this is a
 * read-only risk estimate, not a leveraged execution endpoint.
 */
router.post('/amm/sandwich-risk', ammLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.body.symbol, res);
    if (!symbol) return;

    const { tradeSizeToken, dex: dexRaw, chain: chainRaw } = req.body;
    if (typeof tradeSizeToken !== 'number' || tradeSizeToken <= 0) {
      return res.status(400).json(ApiResponse.error('tradeSizeToken must be a positive number'));
    }

    const { dex: dexFilter, chain: chainFilter, warnings } = await sanitizeAmmFilters(symbol, dexRaw, chainRaw);

    const pool = await resolveTopPool(symbol, dexFilter, chainFilter);
    if (!pool) {
      const msg = `No DEX pool found for ${symbol}${dexRaw ? ` on ${dexRaw}` : ''}${chainRaw ? ` (${chainRaw})` : ''}`;
      return res.status(404).json(ApiResponse.error(msg).addMeta({ timestamp: Date.now(), warnings }));
    }

    const exposure = ammMicrostructureIndicators.estimateSandwichExposure(pool, tradeSizeToken);
    const meta: any = { timestamp: Date.now() };
    if (warnings?.length) meta.warnings = warnings;
    res.json(ApiResponse.success(exposure).addMeta(meta));
  } catch (error) {
    logger.error('Failed to estimate sandwich exposure', { error });
    res.status(500).json(ApiResponse.error((error as Error).message || 'Failed to estimate sandwich exposure'));
  }
});

/**
 * GET /v1/yuki/intelligence/amm/comprehensive/:symbol
 * Full AMM snapshot: cross-DEX liquidity profile, top pool's impact curve,
 * price deviation, and sandwich exposure at a representative (1% of
 * reserves) trade size, plus a rolled-up 'healthy'/'fragile' assessment.
 */
router.get('/amm/comprehensive/:symbol', ammLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;

    const snapshot = await ammMicrostructureIndicators.getComprehensiveSnapshot(symbol);
    res.json(ApiResponse.success(snapshot).addMeta({ timestamp: Date.now() }));
  } catch (error) {
    logger.error('Failed to get comprehensive AMM microstructure', { error });
    res.status(500).json(ApiResponse.error('Failed to get comprehensive AMM microstructure'));
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// COMPOSITE
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/intelligence/market-insight/:symbol?includeAmm=true
 * Combined CEX microstructure + futures health + alerts. Optionally folds
 * in the AMM comprehensive snapshot (additive query param — omitting it
 * preserves the exact prior response shape for existing consumers).
 */
router.get('/market-insight/:symbol', compositeLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol, res);
    if (!symbol) return;
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const includeAmm = String(req.query.includeAmm ?? 'false').toLowerCase() === 'true';

    const [microstructure, futuresHealth, alerts, ammSnapshot] = await Promise.all([
      advancedMicrostructureIndicators.getComprehensiveMicrostructure(symbol, exchange),
      futuresMarketSupport.getFuturesMarketHealth(symbol, exchange),
      advancedMicrostructureIndicators.generateMicrostructureAlerts(symbol, exchange),
      includeAmm
        ? ammMicrostructureIndicators.getComprehensiveSnapshot(symbol).catch(err => {
            logger.warn('AMM snapshot failed in market-insight composite (non-fatal)', { symbol, error: err?.message });
            return null;
          })
        : Promise.resolve(null)
    ]);

    res.json(
      ApiResponse.success({
        symbol,
        microstructureQuality: microstructure.overallQuality,
        futuresHealthScore: futuresHealth.overallHealth,
        alerts: alerts.filter((a: any) => a.actionable),
        recommendations: [...microstructure.recommendations, ...futuresHealth.recommendations],
        amm: includeAmm ? ammSnapshot : undefined,
        timestamp: Date.now()
      }).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to get market insight', { error });
    res.status(500).json(ApiResponse.error('Failed to get market insight'));
  }
});

/**
 * GET /v1/yuki/intelligence/signals
 * Combined top-level trade signals, aggregating market opportunities,
 * order book microstructure, and liquidity risk.
 */
router.get('/signals', compositeLimiter, async (req: Request, res: Response) => {
  try {
    const symbol = req.query.symbol ? String(req.query.symbol) : undefined;
    if (symbol && !validateSymbol(symbol, res)) return;

    const targetSymbol = symbol || 'BTC/USD';
    const exchange = validateExchange(req.query.exchange, res);
    if (!exchange) return;

    const [sentiment, microstructure, futuresHealth, alerts, ammSnapshot] = await Promise.all([
      getMarketSentiment().catch((err) => {
        logger.warn('Failed to fetch market sentiment; using neutral fallback', { error: err });
        return { score: 50, mood: 'neutral' } as any;
      }),
      advancedMicrostructureIndicators.getComprehensiveMicrostructure(targetSymbol, exchange).catch((err) => {
        logger.warn('Microstructure analysis failed for signals endpoint', { symbol: targetSymbol, error: err });
        return {
          overallQuality: 'unknown',
          recommendations: ['Microstructure analysis unavailable'],
        } as any;
      }),
      futuresMarketSupport.getFuturesMarketHealth(targetSymbol, exchange).catch((err) => {
        logger.warn('Futures health analysis failed for signals endpoint', { symbol: targetSymbol, error: err });
        return { overallHealth: 'unknown', recommendations: ['Futures health unavailable'] } as any;
      }),
      advancedMicrostructureIndicators.generateMicrostructureAlerts(targetSymbol, exchange).catch((err) => {
        logger.warn('Alert generation failed for signals endpoint', { symbol: targetSymbol, error: err });
        return [] as any[];
      }),
      ammMicrostructureIndicators.getComprehensiveSnapshot(targetSymbol).catch((err) => {
        logger.warn('AMM snapshot failed for signals endpoint', { symbol: targetSymbol, error: err });
        return null;
      })
    ]);

    const ammOverallAssessment = (ammSnapshot as any)?.overallAssessment || 'insufficient_data';
    const ammSignalBoost = ammOverallAssessment === 'healthy' ? 15 : ammOverallAssessment === 'fragile' ? 5 : 0;
    const ammSignalDetail = (ammSnapshot as any)?.notes?.[0] || 'AMM snapshot completed';

    const signals = [
      {
        id: `sig_${Date.now()}_micro`,
        type: 'microstructure',
        asset: targetSymbol,
        confidence: Math.min(95, Math.max(40, 55 + (microstructure?.overallQuality === 'strong' ? 20 : microstructure?.overallQuality === 'moderate' ? 10 : 0))),
        details: microstructure?.recommendations?.[0] || 'Microstructure analysis completed',
        sentiment,
        metadata: { exchange, alerts: alerts.filter((a: any) => a.actionable).length },
        timestamp: new Date().toISOString(),
      },
      {
        id: `sig_${Date.now()}_futures`,
        type: 'futures',
        asset: targetSymbol,
        confidence: Math.min(95, Math.max(35, 45 + (futuresHealth?.overallHealth === 'healthy' ? 10 : futuresHealth?.overallHealth === 'caution' ? 5 : 0))),
        details: futuresHealth?.recommendations?.[0] || 'Futures health analysis completed',
        sentiment,
        metadata: { exchange },
        timestamp: new Date().toISOString(),
      },
      {
        id: `sig_${Date.now()}_amm`,
        type: 'amm',
        asset: targetSymbol,
        confidence: Math.min(95, Math.max(35, 50 + ammSignalBoost)),
        details: ammSignalDetail,
        sentiment,
        metadata: { exchange, overallAssessment: ammOverallAssessment },
        timestamp: new Date().toISOString(),
      }
    ];

    res.json(
      ApiResponse.success(signals).addMeta({
        timestamp: Date.now(),
        symbol: targetSymbol,
        exchange,
        sentiment,
        alertsCount: alerts.length,
        alertSeverity: alerts.length > 0 ? 'active' : 'clear',
      })
    );
  } catch (error) {
    logger.error('Failed to get unified signals', { error });
    res.status(500).json(ApiResponse.error('Failed to get unified signals'));
  }
});

export default router;