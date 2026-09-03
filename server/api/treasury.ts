/**
 * Treasury API Endpoints - Layer 3 Intelligence Integration
 * 
 * Real implementations wrapping treasury service and intelligence layer in REST endpoints.
 * Provides semantic analysis and recommendations for DAO treasuries.
 */

import type { Request, Response } from 'express';
import { db } from '../db';
import { daos, daoMemberships, vaultTokenHoldings, vaults } from '../../shared/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
  analyzeTreasuryBehavior,
  classifyAsset,
  generateTreasuryIntelligence,
  normalizeCrossChainState,
  recommendGovernanceFormula,
} from '../services/treasury-intelligence.service';
import { getPriceDataObjectForTreasury } from '../services/price.service';
import { getTreasuryHealthHistory } from '../services/treasury-monitoring.service';
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
function normalizeDaoType(daoType?: string | null): any {
  if (!daoType) return 'free';

  const normalized = String(daoType).trim();
  const typeMap: Record<string, string> = {
    free: 'free',
    harambee: 'free',
    short_term: 'shortTerm',
    shortTerm: 'shortTerm',
    collective: 'collective',
    community: 'collective',
    savings: 'collective',
    investment: 'meta',
    investment_club: 'meta',
    governance: 'governance',
    meta: 'meta',
    merryGoRound: 'collective',
    merry_go_round: 'collective',
  };

  return typeMap[normalized] ?? normalized;
}

function resolveTreasuryAssetMeta(symbol: string, daoType?: string | null) {
  const normalizedType = normalizeDaoType(daoType);
  const symbolUpper = String(symbol).trim().toUpperCase();
  const assetChainMap: Record<string, string> = {
    CELO: 'CELO',
    CUSD: 'CELO',
    CEUR: 'CELO',
    USDC: 'CELO',
    USDT: 'CELO',
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana',
    MTAA: normalizedType === 'meta' ? 'multi' : 'CELO',
  };

  return {
    chain: assetChainMap[symbolUpper] || 'unknown',
    decimals: Number(symbolUpper === 'USDC' || symbolUpper === 'USDT' ? 6 : 18),
  };
}

function buildTreasuryAssetsFromHoldings(holdings: any[], daoType?: string | null) {
  return holdings.map((holding: any) => {
    const symbol = String(holding?.tokenSymbol ?? holding?.symbol ?? 'UNKNOWN').trim();
    const assetMeta = resolveTreasuryAssetMeta(symbol, daoType);
    const chain = typeof holding?.chain === 'string' && holding.chain.trim() ? holding.chain.trim() : assetMeta.chain;

    return {
      symbol,
      chain,
      amount: holding?.balance ?? holding?.amount ?? '0',
      decimals: assetMeta.decimals,
    };
  });
}

export async function analyzeTreasuryHandler(req: Request, res: Response) {
  try {
    const daoId = typeof req.body?.daoId === 'string' ? req.body.daoId.trim() : '';
    const { priceData } = req.body;
    
    if (!daoId) {
      return res.status(400).json({ error: 'daoId is required' });
    }

    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const membership = await db
      .select({ id: daoMemberships.id, status: daoMemberships.status, isBanned: daoMemberships.isBanned })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.status, 'approved')
      ))
      .limit(1);

    if (membership.length === 0 || membership[0].isBanned) {
      return res.status(403).json({ error: 'Forbidden: Not an approved member of this DAO' });
    }

    const daoResult = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId));

    if (daoResult.length === 0) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const daoData = daoResult[0];
    const normalizedDaoType = normalizeDaoType(daoData.daoType);
    const vaultRows = await db
      .select({ id: vaults.id })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    const vaultIds = vaultRows.map((vault) => vault.id);
    const holdings = vaultIds.length > 0
      ? await db
          .select()
          .from(vaultTokenHoldings)
          .where(inArray(vaultTokenHoldings.vaultId, vaultIds))
      : [];

    const treasuryAssets = buildTreasuryAssetsFromHoldings(holdings, normalizedDaoType);
    const treasuryPriceData = typeof priceData === 'object' && priceData !== null
      ? priceData
      : await getPriceDataObjectForTreasury(treasuryAssets);

    const treasury = {
      daoId,
      daoType: normalizedDaoType,
      assets: treasuryAssets,
      multisigRequired: Boolean((daoData as any).treasuryMultisigEnabled),
      minSigners: Number((daoData as any).treasuryRequiredSignatures || 1),
      customTokenAllowed: true,
    } as any;

    // Generate real treasury intelligence
    const intelligence = await generateTreasuryIntelligence(treasury, treasuryPriceData);

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
      error: 'Failed to analyze treasury',
      ...(process.env.NODE_ENV === 'development' ? { stack: error instanceof Error ? error.stack : undefined } : {}),
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
    const daoId = typeof req.body?.daoId === 'string' ? req.body.daoId.trim() : '';
    const daoType = typeof req.body?.daoType === 'string' ? req.body.daoType.trim() : '';

    if (!daoId || !daoType) {
      return res.status(400).json({ error: 'daoId and daoType are required' });
    }

    const normalizedDaoType = normalizeDaoType(daoType);
    const allowedTypes = ['free', 'shortTerm', 'collective', 'governance', 'meta'];
    if (!allowedTypes.includes(normalizedDaoType)) {
      return res.status(400).json({ error: 'Unsupported daoType provided' });
    }

    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const membership = await db
      .select({ id: daoMemberships.id, status: daoMemberships.status, isBanned: daoMemberships.isBanned })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.status, 'approved')
      ))
      .limit(1);

    if (!membership.length || membership[0].isBanned) {
      return res.status(403).json({ error: 'Forbidden: Not an approved member of this DAO' });
    }

    const recommendation = recommendGovernanceFormula(normalizedDaoType);

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
    res.status(500).json({ error: 'Failed to recommend formula' });
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
    const daoId = typeof req.params?.daoId === 'string' ? req.params.daoId.trim() : '';
    const includeHistoryParam = req.query.includeHistory;
    const timeframeParam = req.query.timeframe ?? '30d';
    const includeHistory = typeof includeHistoryParam === 'string' ? includeHistoryParam === 'true' : Boolean(includeHistoryParam);
    const timeframe = ['24h', '7d', '30d', '90d'].includes(String(timeframeParam)) ? String(timeframeParam) : '30d';

    if (!daoId) {
      return res.status(400).json({ error: 'daoId is required' });
    }

    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const membership = await db
      .select({ id: daoMemberships.id, status: daoMemberships.status, isBanned: daoMemberships.isBanned })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.status, 'approved')
      ))
      .limit(1);

    if (!membership.length || membership[0].isBanned) {
      return res.status(403).json({ error: 'Forbidden: Not an approved member of this DAO' });
    }

    const daoResult = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId));

    if (daoResult.length === 0) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const daoData = daoResult[0];
    const normalizedDaoType = normalizeDaoType(daoData.daoType);
    const vaultRows = await db
      .select({ id: vaults.id })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    const vaultIds = vaultRows.map((vault) => vault.id);
    const holdings = vaultIds.length > 0
      ? await db
          .select()
          .from(vaultTokenHoldings)
          .where(inArray(vaultTokenHoldings.vaultId, vaultIds))
      : [];

    const treasuryAssets = buildTreasuryAssetsFromHoldings(holdings, normalizedDaoType);
    const treasury = {
      daoId,
      daoType: normalizedDaoType,
      assets: treasuryAssets,
    } as any;

    // Generate health report using real intelligence
    const priceData = await getPriceDataObjectForTreasury(treasuryAssets);
    const classifications = await Promise.all((treasury.assets || []).map((asset: any) => classifyAsset(asset as any)));
    const behavior = await analyzeTreasuryBehavior(treasury as any, classifications);
    const crossChainState = await normalizeCrossChainState(treasury as any, classifications);
    const intelligence = await generateTreasuryIntelligence(treasury, priceData);
    const health = calculateHealthScore({
      ...intelligence,
      crossChainState,
      behavior,
      risks: intelligence.risks || [],
    });
    
    const history = includeHistory
      ? await fetchHealthHistory(daoId, timeframe)
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
    res.status(500).json({ error: 'Failed to fetch treasury health' });
  }
}

/**
 * Calculate health score from treasury intelligence
 */
function calculateHealthScore(intelligence: any) {
  const { crossChainState, risks } = intelligence;
  
  let score = 100;

  if (crossChainState.volatileExposure > 80) score -= 30;
  else if (crossChainState.volatileExposure > 60) score -= 15;
  else if (crossChainState.volatileExposure > 40) score -= 5;

  if (crossChainState.chainConcentration > 0.8) score -= 20;
  else if (crossChainState.chainConcentration > 0.6) score -= 10;

  if (crossChainState.stableExposure < 30 && crossChainState.totalValueUSD > 1000) score -= 15;

  if (Object.keys(crossChainState.exposureByChain).length > 2) score += 5;
  if (crossChainState.assetConcentration < 0.3) score += 10;

  score -= Math.min(risks.length * 3, 15);
  score = Math.max(0, Math.min(100, score));

  let status = 'healthy';
  if (score < 40) status = 'critical';
  else if (score < 70) status = 'caution';

  const chainCount = Object.keys(crossChainState.exposureByChain || {}).length || 1;
  const governanceDistribution = Math.max(0, Math.min(1, (crossChainState.stableExposure / 100) * 0.6 + (chainCount / 5) * 0.4));

  return {
    status,
    score: Math.round(score),
    timestamp: new Date().toISOString(),
    metrics: {
      assetConcentration: crossChainState.assetConcentration,
      chainFragmentation: 1 - crossChainState.chainConcentration,
      volatileExposure: crossChainState.volatileExposure / 100,
      governanceDistribution,
      liquidityScore: crossChainState.stableExposure > 0.5 ? 0.85 : 0.6,
    },
    alerts: risks.length > 0 ? risks.map((risk: string, idx: number) => ({
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
    logger.warn(`Failed to fetch health history for DAO ${daoId}, returning empty array`, {
      daoId,
      timeframe,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
