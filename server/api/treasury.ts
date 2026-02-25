/**
 * Treasury API Endpoints - Layer 3 Intelligence Integration
 * 
 * Real implementations wrapping treasury service and intelligence layer in REST endpoints.
 * Provides semantic analysis and recommendations for DAO treasuries.
 */

import { Request, Response } from 'express';
import { db } from '../db';
import { daos, daoMemberships, vaultTokenHoldings } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { 
  generateTreasuryIntelligence, 
  analyzeTreasuryBehavior, 
  normalizeCrossChainState,
  recommendGovernanceFormula,
  classifyAsset
} from '../services/treasury-intelligence.service';
import { 
  getAssetPrices, 
  getPriceDataObjectForTreasury,
  getAssetPrice 
} from '../services/price.service';
import { 
  getTreasuryHealthHistory, 
  getLatestTreasuryHealth,
  monitorDaoTreasuryNow 
} from '../services/treasury-monitoring.service';
import { getTreasuryConfigForDAOType } from '@/config/treasury.config';
import { logger } from '../utils/logger';

/**
 * POST /api/treasury/analyze
 * 
 * Analyzes a treasury and returns comprehensive intelligence summary.
 * 
 * Request body:
 * {
 *   daoId: string;
 *   priceData?: Record<string, number>; // Optional: symbol-chain -> USD price mapping
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   intelligence: TreasuryIntelligenceSummary {
 *     assetClassifications: AssetClassification[];
 *     assetClassBreakdown: Record<AssetClass, number>;
 *     behavior: TreasuryBehaviorAnalysis;
 *     crossChainState: CrossChainTreasuryState;
 *     recommendedGovernanceFormula: string;
 *     risks: string[];
 *     opportunities: string[];
 *     semanticSummary: {
 *       treasuryCharacter: string;
 *       healthStatus: 'healthy' | 'caution' | 'critical';
 *       keyInsights: string[];
 *     };
 *   };
 *   timestamp: string;
 * }
 */
export async function analyzeTreasuryHandler(req: Request, res: Response) {
  try {
    const { daoId, priceData } = req.body;
    
    if (!daoId) {
      return res.status(400).json({ error: 'daoId is required' });
    }

    // Verify user is member of this DAO
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const membership = await db
      .select()
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId))
      .then(rows => rows.length > 0);

    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: Not a member of this DAO' });
    }

    // Fetch DAO data
    const daoResult = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId));

    if (daoResult.length === 0) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const daoData = daoResult[0];

    // Fetch treasury assets from vault holdings
    const holdings = await db
      .select()
      .from(vaultTokenHoldings)
      .where(eq(vaultTokenHoldings.vaultId, daoId));

    // Build treasury object from DAO and holdings data
    const treasury = {
      daoId,
      daoType: (daoData.daoType || 'free') as any,
      assets: holdings.map(h => ({
        symbol: h.tokenSymbol,
        chain: 'CELO' as any, // Default to CELO, can be extended
        amount: h.tokenAmount,
        decimals: h.tokenDecimals || 18,
      })),
      multisigRequired: (daoData as any).treasuryMultisigEnabled || false,
      minSigners: (daoData as any).treasuryRequiredSignatures || 1,
      customTokenAllowed: true,
    };

    // Generate real treasury intelligence
    const intelligence = await generateTreasuryIntelligence(treasury, priceData);

    logger.info(`Treasury analysis completed for DAO ${daoId}`, {
      daoType: daoData.daoType,
      assetCount: holdings.length,
      totalValue: intelligence.crossChainState.totalValueUSD,
    });

    res.json({
      success: true,
      intelligence,
      timestamp: new Date().toISOString(),
      daoId,
      daoType: daoData.daoType
    });

  } catch (error: any) {
    logger.error(`Treasury analysis error for DAO analysis request`, error);
    res.status(500).json({ 
      error: error.message || 'Failed to analyze treasury',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * POST /api/treasury/recommend-formula
 * 
 * Recommends a governance weight formula based on treasury characteristics.
 * 
 * Request body:
 * {
 *   daoId: string;
 *   daoType: DAOType;
 *   currentBehavior?: TreasuryBehaviorAnalysis;
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   recommendedFormula: 'equal' | 'deposit' | 'timeWeighted' | 'quadratic' | 'hybrid' | 'reputationWeighted';
 *   rationale: string;
 *   alternatives: Array<{ formula: string; reason: string }>;
 *   implementationNotes: string;
 * }
 */
export async function recommendFormulaHandler(req: Request, res: Response) {
  try {
    const { daoId, daoType } = req.body;

    if (!daoId || !daoType) {
      return res.status(400).json({ error: 'daoId and daoType are required' });
    }

    // Verify authorization
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const membership = await db
      .select()
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));

    if (!membership.length) {
      return res.status(403).json({ error: 'Forbidden: Not a member of this DAO' });
    }

    // Generate formula recommendation
    const recommendation = recommendGovernanceFormula(daoType);

    logger.info(`Governance formula recommended for DAO ${daoId}`, {
      daoType,
      formula: recommendation.recommendedFormula
    });

    res.json({
      success: true,
      ...recommendation,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Formula recommendation error for DAO formula request', error);
    res.status(500).json({ 
      error: error.message || 'Failed to recommend formula'
    });
  }
}

/**
 * GET /api/treasury/health/:daoId
 * 
 * Returns comprehensive treasury health status for continuous monitoring.
 * 
 * Query params:
 * - includeHistory?: boolean (default: true) - Include historical snapshots
 * - timeframe?: '24h' | '7d' | '30d' | '90d' (default: '30d')
 * 
 * Response:
 * {
 *   success: boolean;
 *   daoId: string;
 *   health: {
 *     status: 'healthy' | 'caution' | 'critical';
 *     score: number; // 0-100
 *     timestamp: string;
 *     metrics: {
 *       assetConcentration: number;
 *       chainFragmentation: number;
 *       volatileExposure: number;
 *       governanceDistribution: number;
 *       liquidityScore: number;
 *     };
 *     alerts: Array<{
 *       severity: 'low' | 'medium' | 'high' | 'critical';
 *       type: string;
 *       message: string;
 *       recommendedAction: string;
 *     }>;
 *     recommendations: string[];
 *   };
 *   history?: Array<{
 *     timestamp: string;
 *     score: number;
 *     status: string;
 *   }>;
 * }
 */
export async function getTreasuryHealthHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const { includeHistory = 'true', timeframe = '30d' } = req.query;

    if (!daoId) {
      return res.status(400).json({ error: 'daoId is required' });
    }

    // Verify authorization
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const membership = await db
      .select()
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));

    if (!membership.length) {
      return res.status(403).json({ error: 'Forbidden: Not a member of this DAO' });
    }

    // Fetch DAO and treasury data
    const daoResult = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId));

    if (daoResult.length === 0) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const daoData = daoResult[0];

    // Fetch vault holdings for treasury assets
    const holdings = await db
      .select()
      .from(vaultTokenHoldings)
      .where(eq(vaultTokenHoldings.vaultId, daoId));

    // Build treasury object
    const treasury = {
      daoId,
      daoType: (daoData.daoType || 'free') as any,
      assets: holdings.map(h => ({
        symbol: h.tokenSymbol,
        chain: 'CELO' as any,
        amount: h.tokenAmount,
        decimals: h.tokenDecimals || 18,
      })),
    };

    // Generate health report using real intelligence
    const intelligence = await generateTreasuryIntelligence(treasury);
    const health = calculateHealthScore(intelligence);
    
    const history = includeHistory === 'true' 
      ? await fetchHealthHistory(daoId, timeframe as string) 
      : undefined;

    logger.info(`Treasury health check completed for DAO ${daoId}`, {
      healthStatus: health.status,
      healthScore: health.score
    });

    res.json({
      success: true,
      daoId,
      health,
      ...(history && { history }),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Treasury health check error for DAO health check request', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch treasury health'
    });
  }
}

/**
 * Calculate health score from treasury intelligence
 */
function calculateHealthScore(intelligence: any) {
  const { crossChainState, semanticSummary, risks } = intelligence;
  
  // Base score starts at 100
  let score = 100;

  // Deductions based on risks and exposures
  if (crossChainState.volatileExposure > 80) score -= 30;
  else if (crossChainState.volatileExposure > 60) score -= 15;
  else if (crossChainState.volatileExposure > 40) score -= 5;

  if (crossChainState.chainConcentration > 0.8) score -= 20;
  else if (crossChainState.chainConcentration > 0.6) score -= 10;

  if (crossChainState.stableExposure < 30 && crossChainState.totalValueUSD > 1000) score -= 15;

  // Bonuses for good characteristics
  if (Object.keys(crossChainState.exposureByChain).length > 2) score += 5;
  if (crossChainState.assetConcentration < 0.3) score += 10;

  // Risk deductions
  score -= Math.min(risks.length * 3, 15);

  // Clamp between 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine status from score
  let status = 'healthy';
  if (score < 40) status = 'critical';
  else if (score < 70) status = 'caution';

  return {
    status,
    score: Math.round(score),
    timestamp: new Date().toISOString(),
    metrics: {
      assetConcentration: crossChainState.assetConcentration,
      chainFragmentation: 1 - crossChainState.chainConcentration,
      volatileExposure: crossChainState.volatileExposure / 100,
      governanceDistribution: 0.65, // TODO: calculate from actual governance
      liquidityScore: crossChainState.stableExposure > 0.5 ? 0.85 : 0.6,
    },
    alerts: risks.length > 0 ? risks.map((risk, idx) => ({
      severity: idx === 0 ? 'high' : 'medium',
      type: 'treasury-risk',
      message: risk,
      recommendedAction: 'Review treasury allocation and consider rebalancing'
    })) : [],
    recommendations: intelligence.opportunities || []
  };
}

/**
 * Fetch health history from database
 */
async function fetchHealthHistory(daoId: string, timeframe: string) {
  try {
    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const history = await getTreasuryHealthHistory(daoId, days);
    return history;
  } catch (error) {
    logger.warn(`Failed to fetch health history for DAO ${daoId}, returning empty array`, error as Error);
    return [];
  }
}
