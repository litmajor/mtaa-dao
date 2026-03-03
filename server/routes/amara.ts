/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AMARA DASHBOARD API ROUTES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Endpoints:
 * GET  /api/dashboard/portfolio         → Full portfolio view
 * GET  /api/dashboard/positions/:protocol → Positions in specific protocol
 * GET  /api/dashboard/exposures         → Asset exposures
 * GET  /api/dashboard/risks             → Risk analysis
 * GET  /api/dashboard/yields            → Yield tracking
 */

import express, { Request, Response } from 'express';
import { assetGraphService } from '../services/assetGraphService';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();
const router = express.Router();

// Middleware to extract user ID
function extractUserId(req: any): string {
  return req.user?.id || req.query.userId || 'test-user';
}

/**
 * GET /api/dashboard/portfolio
 * Full portfolio view for Amara Dashboard
 */
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    logger.debug(`[Amara] Loading portfolio for ${userId}`);

    const portfolioView = await assetGraphService.getAmaraPortfolioView(userId);

    res.json({
      success: true,
      data: portfolioView,
    });
  } catch (error) {
    logger.error('[Amara] Portfolio endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/dashboard/positions
 * All positions grouped by type
 */
router.get('/positions', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    logger.debug(`[Amara] Loading positions for ${userId}`);

    const graph = await assetGraphService.loadUserGraph(userId);

    const positions = {
      direct: Array.from(graph.nodes.values()).filter((n) => n.type === 'direct_holding'),
      protocol: Array.from(graph.nodes.values()).filter((n) => n.type === 'protocol_position'),
      vault: Array.from(graph.nodes.values()).filter((n) => n.type === 'vault_share'),
      lp: Array.from(graph.nodes.values()).filter((n) => n.type === 'lp_share'),
      collateral: Array.from(graph.nodes.values()).filter((n) => n.type === 'collateral'),
      debt: Array.from(graph.nodes.values()).filter((n) => n.type === 'debt'),
      derivative: Array.from(graph.nodes.values()).filter((n) => n.type === 'derivative'),
    };

    res.json({
      success: true,
      positions,
      totalCount: graph.nodes.size,
    });
  } catch (error) {
    logger.error('[Amara] Positions endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/dashboard/positions/:protocol
 * Positions in specific protocol
 */
router.get('/positions/:protocol', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    const { protocol } = req.params;

    logger.debug(`[Amara] Loading ${protocol} positions for ${userId}`);

    const positions = await assetGraphService.getProtocolPositions(userId, protocol);

    const totalValue = positions.reduce((sum, n) => sum + n.balanceUSD, 0);
    const totalYield = positions.reduce((sum, n) => sum + ((n.balance * (n.apyRate || 0)) / 100), 0);

    res.json({
      success: true,
      protocol,
      positions,
      summary: {
        totalValue,
        totalYield,
        positionCount: positions.length,
      },
    });
  } catch (error) {
    logger.error('[Amara] Protocol positions endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/dashboard/exposures
 * Asset exposures (net BTC, net ETH, etc)
 */
router.get('/exposures', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    logger.debug(`[Amara] Loading exposures for ${userId}`);

    const graph = await assetGraphService.loadUserGraph(userId);

    const exposures = Array.from(graph.compositeExposures.values()).map((exp) => ({
      ...exp,
      breakdown: exp.components.map((c) => ({
        symbol: c.symbol,
        quantity: c.quantity,
        value: c.valueUSD,
        weight: (c.weight * 100).toFixed(1) + '%',
        protocol: c.protocol,
      })),
    }));

    res.json({
      success: true,
      exposures,
      summary: {
        totalExposures: exposures.length,
        largestExposure: exposures.length > 0 ? exposures[0].exposureName : null,
      },
    });
  } catch (error) {
    logger.error('[Amara] Exposures endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/dashboard/exposures/:asset
 * Exposure for specific asset
 */
router.get('/exposures/:asset', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    const { asset } = req.params;

    logger.debug(`[Amara] Loading ${asset} exposure for ${userId}`);

    const exposure = await assetGraphService.getNetExposure(userId, asset);

    if (!exposure) {
      return res.json({
        success: true,
        exposure: null,
        message: `No ${asset} positions found`,
      });
    }

    res.json({
      success: true,
      exposure: {
        ...exposure,
        breakdown: exposure.components.map((c) => ({
          symbol: c.symbol,
          quantity: c.quantity,
          value: c.valueUSD,
          weight: (c.weight * 100).toFixed(1) + '%',
          protocol: c.protocol,
          direction: c.direction,
        })),
      },
    });
  } catch (error) {
    logger.error('[Amara] Asset exposure endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/dashboard/risks
 * All risks (liquidation, IL, protocol exposure)
 */
router.get('/risks', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    logger.debug(`[Amara] Loading risks for ${userId}`);

    const graph = await assetGraphService.loadUserGraph(userId);

    const liquidationRisks = graph.liquidationRisks.map((r) => ({
      ...r,
      marginPercent: (r.marginPercent * 100).toFixed(2) + '%',
      safetyLevel: r.criticalRisk ? 'CRITICAL' : r.atRisk ? 'AT_RISK' : 'SAFE',
    }));

    res.json({
      success: true,
      summary: {
        riskScore: graph.portfolioMetrics.riskScore,
        liquidationWarnings: liquidationRisks.filter((r) => r.atRisk).length,
        criticalRisks: liquidationRisks.filter((r) => r.criticalRisk).length,
      },
      risks: {
        liquidation: liquidationRisks,
        overall: graph.portfolioMetrics.riskScore > 70 ? 'HIGH' : graph.portfolioMetrics.riskScore > 40 ? 'MEDIUM' : 'LOW',
      },
      recommendations: generateRiskRecommendations(graph),
    });
  } catch (error) {
    logger.error('[Amara] Risks endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/dashboard/yields
 * Yield tracking and opportunities
 */
router.get('/yields', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    logger.debug(`[Amara] Loading yields for ${userId}`);

    const graph = await assetGraphService.loadUserGraph(userId);

    const yieldPositions = Array.from(graph.nodes.values())
      .filter((n) => n.apyRate && n.balance > 0)
      .map((n) => {
        const yearlyYield = (n.balance * (n.apyRate || 0)) / 100;
        const monthlyYield = yearlyYield / 12;
        
        return {
          nodeId: n.id,
          symbol: n.symbol,
          protocol: n.protocol || 'wallet',
          balance: n.balance,
          balanceUSD: n.balanceUSD,
          apy: (n.apyRate || 0).toFixed(2) + '%',
          monthlyYield: monthlyYield.toFixed(2),
          yearlyYield: yearlyYield.toFixed(2),
          yearlyYieldUSD: (monthlyYield * n.balanceUSD / n.balance * 12).toFixed(2),
        };
      });

    const totalMonthlyYield = yieldPositions.reduce(
      (sum, p) => sum + parseFloat(p.monthlyYield),
      0
    );

    const totalYearlyYield = yieldPositions.reduce(
      (sum, p) => sum + parseFloat(p.yearlyYield),
      0
    );

    res.json({
      success: true,
      yields: {
        positions: yieldPositions,
        summary: {
          totalMonthlyYield: totalMonthlyYield.toFixed(2),
          totalYearlyYield: totalYearlyYield.toFixed(2),
          blendedAPY: graph.portfolioMetrics.totalYieldAPY.toFixed(2) + '%',
          topYieldProtocol: yieldPositions.length > 0 ? yieldPositions[0].protocol : null,
        },
      },
      opportunities: [
        {
          suggestion: 'Consider moving to higher-yield protocols',
          currentAPY: graph.portfolioMetrics.totalYieldAPY,
          potentialAPY: graph.portfolioMetrics.totalYieldAPY + 2,
          impact: 'Potential 2% APY increase',
        },
      ],
    });
  } catch (error) {
    logger.error('[Amara] Yields endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/dashboard/summary
 * Quick summary for dashboard header
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    const graph = await assetGraphService.loadUserGraph(userId);
    const metrics = graph.portfolioMetrics;

    res.json({
      success: true,
      summary: {
        totalValueUSD: metrics.totalValueUSD.toFixed(2),
        totalYieldUSD: metrics.totalYieldUSD.toFixed(2),
        yieldAPY: metrics.totalYieldAPY.toFixed(2),
        riskScore: metrics.riskScore,
        protocolCount: metrics.protocolExposureCount,
        assetCount: metrics.uniqueAssets,
        positionCount: graph.nodes.size,
        lastUpdated: new Date(metrics.lastSyncedAt).toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Amara] Summary endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== HELPER FUNCTIONS =====

function generateRiskRecommendations(graph: any): string[] {
  const recommendations: string[] = [];

  if (graph.portfolioMetrics.riskScore > 70) {
    recommendations.push('⚠️ HIGH RISK: Review concentrated positions');
  }

  if (graph.liquidationRisks.some((r: any) => r.criticalRisk)) {
    recommendations.push('🚨 CRITICAL: Liquidation risk detected - add collateral or reduce debt');
  }

  if (graph.liquidationRisks.some((r: any) => r.atRisk)) {
    recommendations.push('⚠️ Monitor collateral ratios closely');
  }

  const protocolExposure = Math.max(
    ...Array.from(graph.byProtocol.values()).map((nodes: string[]) =>
      nodes.reduce((sum: number, id: string) => sum + (graph.nodes.get(id)?.balanceUSD || 0), 0)
    )
  );

  if (protocolExposure > graph.portfolioMetrics.totalValueUSD * 0.6) {
    recommendations.push('📊 Diversify across more protocols to reduce risk');
  }

  if (graph.portfolioMetrics.totalYieldAPY < 2) {
    recommendations.push('💰 Move assets to higher-yield protocols');
  }

  return recommendations.length > 0 ? recommendations : ['✅ Portfolio looks healthy'];
}

export default router;
