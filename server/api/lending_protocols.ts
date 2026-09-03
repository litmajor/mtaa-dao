/**
 * Lending Protocols API
 * Serves cached, on-chain-derived Aave V3 data. See aaveDataService.ts for
 * how the cache is populated (background polling, stale-while-revalidate).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  getSupportedChains,
  getMarkets,
  getMarket,
  getFlashLoanAssets,
  startAavePolling,
} from './aaveDataService';

const router = Router();

// Start the background poller once, when this module is first loaded.
startAavePolling();

const SUPPORTED_CHAINS = new Set(getSupportedChains());

function validateChain(req: Request, res: Response): string | null {
  const chain = String(req.query.chain || 'ethereum').toLowerCase();
  if (!SUPPORTED_CHAINS.has(chain)) {
    res.status(400).json({
      error: `Unsupported chain "${chain}"`,
      supportedChains: Array.from(SUPPORTED_CHAINS),
    });
    return null;
  }
  return chain;
}

/**
 * GET /api/lending/protocols
 */
router.get('/protocols', async (req: Request, res: Response) => {
  const chain = validateChain(req, res);
  if (!chain) return;

  const { markets, health } = await getMarkets(chain);
  res.json({
    chain,
    reserveCount: markets.length,
    stale: health.stale,
    lastUpdateAgeMs: health.ageMs,
  });
});

/**
 * GET /api/lending/aave/markets
 */
router.get('/aave/markets', async (req: Request, res: Response) => {
  const chain = validateChain(req, res);
  if (!chain) return;

  const { markets, health } = await getMarkets(chain);
  if (!health.ok) {
    return res.status(503).json({ error: 'Market data not yet available', lastError: health.lastError });
  }
  res.json({ chain, markets, stale: health.stale, lastUpdateAgeMs: health.ageMs });
});

/**
 * GET /api/lending/aave/market/:asset
 */
router.get('/aave/market/:asset', async (req: Request, res: Response) => {
  const chain = validateChain(req, res);
  if (!chain) return;

  const asset = String(req.params.asset || '');
  if (!/^[A-Za-z0-9]{1,10}$/.test(asset)) {
    return res.status(400).json({ error: 'Invalid asset symbol' });
  }

  const { market, health } = await getMarket(chain, asset);
  if (!health.ok) {
    return res.status(503).json({ error: 'Market data not yet available', lastError: health.lastError });
  }
  if (!market) {
    return res.status(404).json({ error: `Market data not found for ${asset} on ${chain}` });
  }
  res.json({ chain, market, stale: health.stale, lastUpdateAgeMs: health.ageMs });
});

/**
 * GET /api/lending/aave/rates
 */
router.get('/aave/rates', async (req: Request, res: Response) => {
  const chain = validateChain(req, res);
  if (!chain) return;

  const { markets, health } = await getMarkets(chain);
  if (!health.ok) {
    return res.status(503).json({ error: 'Market data not yet available', lastError: health.lastError });
  }
  if (markets.length === 0) {
    return res.json({ chain, markets: [], averages: null, stale: health.stale });
  }

  const avgSupplyRate = markets.reduce((sum: number, m: { supplyRateApr: number }) => sum + m.supplyRateApr, 0) / markets.length;
  const avgBorrowRate = markets.reduce((sum: number, m: { borrowRateApr: number }) => sum + m.borrowRateApr, 0) / markets.length;

  res.json({
    chain,
    markets,
    averages: { supplyRateApr: avgSupplyRate, borrowRateApr: avgBorrowRate },
    stale: health.stale,
    lastUpdateAgeMs: health.ageMs,
  });
});

/**
 * GET /api/lending/flash-loan-assets
 */
router.get('/flash-loan-assets', async (req: Request, res: Response) => {
  const chain = validateChain(req, res);
  if (!chain) return;

  const { assets, health } = await getFlashLoanAssets(chain);
  if (!health.ok) {
    return res.status(503).json({ error: 'Flash loan data not yet available', lastError: health.lastError });
  }
  res.json({ chain, assets, stale: health.stale, lastUpdateAgeMs: health.ageMs });
});

export default router;