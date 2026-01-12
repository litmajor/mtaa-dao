/**
 * DEX API Routes
 * Endpoints for DeFi DEX analytics, liquidity pools, and swap opportunities
 */

import { Router, Request, Response } from 'express';
import { dexService } from '../services/dexIntegrationService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/dex/supported
 * Get list of supported DEX adapters
 */
router.get('/supported', async (req: Request, res: Response) => {
  try {
    const dexes = dexService.getSupportedDEXes();
    res.json(dexes);
  } catch (error) {
    logger.error('Error fetching supported DEXes:', error);
    res.status(500).json({ error: 'Failed to fetch supported DEXes' });
  }
});

/**
 * GET /api/dex/supported-by-chain
 * Get supported DEXes for a specific chain
 */
router.get('/supported-by-chain/:chain', async (req: Request, res: Response) => {
  try {
    const { chain } = req.params;
    const dexes = dexService.getDEXesByChain(chain);
    res.json(dexes);
  } catch (error) {
    logger.error('Error fetching DEXes by chain:', error);
    res.status(500).json({ error: 'Failed to fetch DEXes by chain' });
  }
});

/**
 * POST /api/dex/quote
 * Get swap quote for two tokens
 * Body: { fromAsset, toAsset, amountIn, preferredDex?, chain? }
 */
router.post('/quote', async (req: Request, res: Response) => {
  try {
    const { fromAsset, toAsset, amountIn, preferredDex = 'ubeswap_celo', chain = 'celo' } = req.body;

    if (!fromAsset || !toAsset || !amountIn) {
      return res.status(400).json({
        error: 'Missing required fields: fromAsset, toAsset, amountIn'
      });
    }

    const quote = await dexService.getSwapQuote(
      fromAsset,
      toAsset,
      amountIn,
      preferredDex,
      chain
    );

    if (!quote) {
      return res.status(404).json({ error: 'Could not generate quote' });
    }

    res.json(quote);
  } catch (error) {
    logger.error('Error generating swap quote:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate quote'
    });
  }
});

/**
 * POST /api/dex/best-route
 * Get best route for a swap across multiple DEXes
 * Body: { fromAsset, toAsset, amountIn, chain? }
 */
router.post('/best-route', async (req: Request, res: Response) => {
  try {
    const { fromAsset, toAsset, amountIn, chain = 'celo' } = req.body;

    if (!fromAsset || !toAsset || !amountIn) {
      return res.status(400).json({
        error: 'Missing required fields: fromAsset, toAsset, amountIn'
      });
    }

    const bestRoute = await dexService.getBestRoute(fromAsset, toAsset, amountIn);

    if (!bestRoute) {
      return res.status(404).json({ error: 'No route found' });
    }

    res.json(bestRoute);
  } catch (error) {
    logger.error('Error finding best route:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to find route'
    });
  }
});

/**
 * POST /api/dex/swap
 * Execute a swap
 * Body: { fromAsset, toAsset, amountIn, slippageTolerance?, dex? }
 */
router.post('/swap', async (req: Request, res: Response) => {
  try {
    const { fromAsset, toAsset, amountIn, slippageTolerance = 0.5, dex = 'ubeswap_celo' } = req.body;

    if (!fromAsset || !toAsset || !amountIn) {
      return res.status(400).json({
        error: 'Missing required fields: fromAsset, toAsset, amountIn'
      });
    }

    // Check if DEX integration is available
    if (!dexService.isAvailable()) {
      return res.status(503).json({
        error: 'DEX service not available - wallet not initialized'
      });
    }

    const result = await dexService.executeSwap(
      fromAsset,
      toAsset,
      amountIn,
      slippageTolerance,
      dex
    );

    res.json(result);
  } catch (error) {
    logger.error('Error executing swap:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to execute swap'
    });
  }
});

/**
 * POST /api/dex/multiple-swaps
 * Execute multiple swaps (for rebalancing)
 * Body: { swaps: Array<{fromAsset, toAsset, amount}> }
 */
router.post('/multiple-swaps', async (req: Request, res: Response) => {
  try {
    const { swaps } = req.body;

    if (!Array.isArray(swaps) || swaps.length === 0) {
      return res.status(400).json({
        error: 'Invalid swaps array'
      });
    }

    const results = await dexService.executeMultipleSwaps(swaps);
    res.json({ results });
  } catch (error) {
    logger.error('Error executing multiple swaps:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to execute swaps'
    });
  }
});

/**
 * GET /api/dex/health
 * Check if DEX service is healthy
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isAvailable = dexService.isAvailable();
    const supportedDexes = dexService.getSupportedDEXes();

    res.json({
      available: isAvailable,
      supportedCount: supportedDexes.length,
      supportedDexes: supportedDexes.map(d => ({ id: d.id, name: d.name, chain: d.chain }))
    });
  } catch (error) {
    logger.error('Error checking DEX health:', error);
    res.status(500).json({
      error: 'Failed to check DEX health'
    });
  }
});

/**
 * GET /api/dex/pools
 * Get liquidity pools (placeholder - integrate with actual data sources)
 * Query params: chain, dex
 */
router.get('/pools', async (req: Request, res: Response) => {
  try {
    const { chain = 'ethereum', dex } = req.query;

    // This is a placeholder endpoint
    // In production, this would aggregate data from:
    // - The Graph (Subgraphs)
    // - DEX-specific APIs
    // - On-chain RPC calls

    const pools = [
      {
        id: '1',
        dex: 'uniswap-v3',
        token0: 'USDC',
        token1: 'ETH',
        liquidity: 2500000000,
        volume24h: 850000000,
        feeTier: '0.05%',
        apy: 8.5
      },
      {
        id: '2',
        dex: 'sushiswap',
        token0: 'USDT',
        token1: 'USDC',
        liquidity: 1800000000,
        volume24h: 420000000,
        apy: 12.2
      },
      {
        id: '3',
        dex: 'uniswap-v3',
        token0: 'DAI',
        token1: 'USDC',
        liquidity: 1200000000,
        volume24h: 380000000,
        feeTier: '0.01%',
        apy: 4.3
      }
    ];

    const filtered = dex ? pools.filter(p => p.dex === dex) : pools;
    res.json(filtered);
  } catch (error) {
    logger.error('Error fetching pools:', error);
    res.status(500).json({
      error: 'Failed to fetch pools'
    });
  }
});

/**
 * GET /api/dex/opportunities
 * Get arbitrage opportunities (placeholder)
 * Query params: chain
 */
router.get('/opportunities', async (req: Request, res: Response) => {
  try {
    const { chain = 'ethereum' } = req.query;

    // This is a placeholder endpoint
    // In production, this would detect actual arbitrage opportunities
    // by monitoring price differences across DEXes

    const opportunities = [
      {
        fromToken: 'USDC',
        toToken: 'USDT',
        dex: 'uniswap-v3',
        priceImpact: 0.012,
        estimatedOutput: 1000.15,
        gasEstimate: 45.32,
        profitPotential: 150.20
      }
    ];

    res.json(opportunities);
  } catch (error) {
    logger.error('Error fetching opportunities:', error);
    res.status(500).json({
      error: 'Failed to fetch opportunities'
    });
  }
});

export default router;
