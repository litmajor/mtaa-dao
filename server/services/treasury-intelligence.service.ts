/**
 * Server-side Treasury Intelligence Service
 * 
 * Replicates client-side logic for server consumption.
 * Integrates with real database and price feeds.
 */

import { DAOType, TreasuryAsset, DAOTreasury, ChainType } from '@/types/treasury';
import { getTreasuryConfigForDAOType } from '@/config/treasury.config';
import { getAssetPrice, getPriceDataObjectForTreasury } from './price.service';

const ASSET_CLASS_MAP: Record<string, string> = {
  'cUSD': 'stable', 'USDC': 'stable', 'USDT': 'stable', 'DAI': 'stable',
  'CELO': 'volatile', 'ETH': 'volatile', 'BTC': 'volatile',
  'cGLD': 'governance', 'GOV': 'governance',
  'aUSDC': 'vault', 'aDAI': 'vault'
};

const RISK_LEVELS: Record<string, string> = {
  'stable': 'low',
  'volatile': 'high',
  'governance': 'medium',
  'yield': 'medium',
  'derivative': 'very-high',
  'lp': 'medium',
  'vault': 'low',
  'nft': 'very-high',
  'wrapped': 'medium',
  'exotic': 'very-high'
};

/**
 * Classify asset from treasury
 */
export async function classifyAsset(asset: TreasuryAsset) {
  const assetClass = ASSET_CLASS_MAP[asset.symbol] || 'exotic';
  const risk = RISK_LEVELS[assetClass] || 'medium';

  const price = await getAssetPrice(asset.symbol, asset.chain);

  return {
    symbol: asset.symbol,
    chain: asset.chain,
    assetClass,
    riskProfile: risk,
    usdValue: (parseFloat(asset.amount.toString()) || 0) * price.priceUsd,
    currentPrice: price.priceUsd,
    strategyEligible: assetClass !== 'nft' && assetClass !== 'exotic',
    yieldCapable: ['stable', 'volatile', 'wrapped'].includes(assetClass),
    liquidityDepth: assetClass === 'stable' || assetClass === 'volatile' ? 'deep' : 'moderate',
    volatilityScore: assetClass === 'volatile' ? 75 : assetClass === 'stable' ? 2 : 30,
  };
}

/**
 * Analyze treasury behavior based on composition
 */
export async function analyzeTreasuryBehavior(
  treasury: DAOTreasury,
  classifications: any[]
) {
  let stableValue = 0;
  let volatileValue = 0;
  let yieldValue = 0;

  classifications.forEach(c => {
    if (c.assetClass === 'stable') stableValue += c.usdValue;
    if (c.assetClass === 'volatile') volatileValue += c.usdValue;
    if (['yield', 'lp', 'vault'].includes(c.assetClass)) yieldValue += c.usdValue;
  });

  const totalValue = stableValue + volatileValue + yieldValue;
  const stablePercent = totalValue > 0 ? (stableValue / totalValue) * 100 : 0;
  const volatilePercent = totalValue > 0 ? (volatileValue / totalValue) * 100 : 0;
  const yieldPercent = totalValue > 0 ? (yieldValue / totalValue) * 100 : 0;

  // Determine mode based on composition
  let mode = 'conservative';
  if (stablePercent > 70) mode = 'conservative';
  else if (volatilePercent > 40) mode = 'aggressive';
  else mode = 'balanced';

  // Short-term DAOs should be distributive, others accumulative
  const isShortTerm = treasury.daoType === 'shortTerm';
  const distributionMode = isShortTerm ? 'distributive' : 'accumulative';

  return {
    mode: distributionMode,
    aggressiveness: mode,
    confidence: 85,
    stablePercent,
    volatilePercent,
    yieldPercent,
    indicators: [
      `${stablePercent.toFixed(1)}% stable assets`,
      `${volatilePercent.toFixed(1)}% volatile exposure`,
      `${yieldPercent.toFixed(1)}% yield-generating`,
    ],
    recommendations: [
      volatilePercent > 60 ? 'Consider reducing volatile exposure' : null,
      stablePercent < 30 ? 'Low stable asset backing - enhance with stablecoins' : null,
      yieldPercent === 0 && totalValue > 1000 ? 'Activate yield strategies for growth' : null,
    ].filter(Boolean),
    riskLevel: volatilePercent > 60 ? 'high' : 'medium'
  };
}

/**
 * Normalize cross-chain state
 */
export async function normalizeCrossChainState(
  treasury: DAOTreasury,
  classifications: any[]
) {
  const exposureByChain: Record<string, any> = {};
  const exposureByAssetClass: Record<string, any> = {};
  let totalValueUSD = 0;

  const chains = [...new Set(classifications.map(c => c.chain))];

  // Track by chain
  for (const chain of chains) {
    const chainAssets = classifications.filter(c => c.chain === chain);
    const chainValue = chainAssets.reduce((sum, a) => sum + a.usdValue, 0);
    totalValueUSD += chainValue;

    exposureByChain[chain] = {
      usdValue: chainValue,
      assetCount: chainAssets.length,
      dominantAssetClass: chainAssets.length > 0 ? chainAssets[0].assetClass : 'unknown',
      governanceWeightContribution: 0, // Will calculate later
    };
  }

  // Track by asset class
  const classes = [...new Set(classifications.map(c => c.assetClass))];
  for (const assetClass of classes) {
    const classAssets = classifications.filter(c => c.assetClass === assetClass);
    const classValue = classAssets.reduce((sum, a) => sum + a.usdValue, 0);

    exposureByAssetClass[assetClass] = {
      usdValue: classValue,
      assetCount: classAssets.length,
      chains: [...new Set(classAssets.map(a => a.chain))],
      governanceWeightContribution: 0,
    };
  }

  // Calculate percentages
  const stableExposure = totalValueUSD > 0 
    ? ((exposureByAssetClass['stable']?.usdValue || 0) / totalValueUSD) * 100 
    : 0;
  const volatileExposure = totalValueUSD > 0 
    ? ((exposureByAssetClass['volatile']?.usdValue || 0) / totalValueUSD) * 100 
    : 0;
  const yieldExposure = totalValueUSD > 0 
    ? ((exposureByAssetClass['vault']?.usdValue || 0) + (exposureByAssetClass['yield']?.usdValue || 0)) / totalValueUSD * 100
    : 0;

  // Calculate concentration
  const chainConcentration = chains.length > 0 
    ? Math.max(...Object.values(exposureByChain).map(c => c.usdValue)) / (totalValueUSD || 1) 
    : 0;
  const assetConcentration = classifications.length > 0 
    ? Math.max(...classifications.map(c => c.usdValue)) / (totalValueUSD || 1)
    : 0;

  return {
    exposureByChain,
    exposureByAssetClass,
    totalValueUSD: Math.round(totalValueUSD * 100) / 100,
    stableExposure: Math.round(stableExposure * 100) / 100,
    volatileExposure: Math.round(volatileExposure * 100) / 100,
    yieldExposure: Math.round(yieldExposure * 100) / 100,
    chainConcentration: Math.round(chainConcentration * 10000) / 10000,
    assetConcentration: Math.round(assetConcentration * 10000) / 10000,
    isCriticallyFragmented: chainConcentration > 0.9 && chains.length > 3,
    chainWithLargestShare: Object.entries(exposureByChain).sort((a, b) => b[1].usdValue - a[1].usdValue)[0]?.[0] || 'CELO',
    chainWithLargestSharePercent: totalValueUSD > 0 
      ? Math.round(Math.max(...Object.values(exposureByChain).map(c => c.usdValue)) / totalValueUSD * 100) 
      : 0,
  };
}

/**
 * Recommend governance formula based on treasury characteristics
 */
export function recommendGovernanceFormula(
  daoType: DAOType,
  behavior?: any,
  crossChainState?: any
) {
  const formulas: Record<DAOType, any> = {
    free: {
      recommendedFormula: 'equal',
      rationale: 'Equal voting is fundamental for free DAOs - fair for all members',
      alternatives: [
        { formula: 'deposit', reason: 'If you want to reward early contributors' }
      ],
      supportedFactors: ['memberCount'],
      implementationNotes: 'Simplest and most democratic approach'
    },
    shortTerm: {
      recommendedFormula: 'equal',
      rationale: 'Equal voting prevents whale dominance in short-term funds',
      alternatives: [
        { formula: 'timeWeighted', reason: 'Reward early contributors' }
      ],
      supportedFactors: ['memberCount'],
      implementationNotes: 'Rotating membership benefits from equal weights'
    },
    collective: {
      recommendedFormula: 'timeWeighted',
      rationale: 'Time-weighted voting rewards commitment to collective savings',
      alternatives: [
        { formula: 'hybrid', reason: 'Balance deposit + time' },
        { formula: 'quadratic', reason: 'Reduce whale voting power' }
      ],
      supportedFactors: ['joinDate', 'depositAmount', 'memberCount'],
      implementationNotes: 'Encourages long-term participation'
    },
    governance: {
      recommendedFormula: 'reputationWeighted',
      rationale: 'Experience matters in governance-focused DAOs',
      alternatives: [
        { formula: 'hybrid', reason: 'Balance reputation + deposit' },
        { formula: 'delegated', reason: 'For federated structures' }
      ],
      supportedFactors: ['reputation', 'delegationCapability'],
      implementationNotes: 'Weights experienced members more heavily'
    },
    meta: {
      recommendedFormula: 'hybrid',
      rationale: 'Meta DAOs need balanced multi-factor approach',
      alternatives: [
        { formula: 'reputationWeighted', reason: 'For federated governance' },
        { formula: 'custom', reason: 'Implement custom rules' }
      ],
      supportedFactors: ['depositAmount', 'joinDate', 'reputation', 'delegationCapability'],
      implementationNotes: 'Most flexible, supports delegation and multi-level governance'
    }
  };

  return formulas[daoType] || formulas['collective'];
}

/**
 * Generate comprehensive treasury intelligence summary
 */
export async function generateTreasuryIntelligence(
  treasury: DAOTreasury,
  priceData?: Record<string, number>
) {
  // Classify all assets
  const classifications = await Promise.all(
    (treasury.assets || []).map(asset => classifyAsset(asset))
  );

  // Analyze behavior
  const behavior = await analyzeTreasuryBehavior(treasury, classifications);

  // Normalize cross-chain state
  const crossChainState = await normalizeCrossChainState(treasury, classifications);

  // Get governance recommendation
  const governanceFormula = recommendGovernanceFormula(
    treasury.daoType || 'free',
    behavior,
    crossChainState
  );

  // Calculate risks and opportunities
  const risks: string[] = [];
  const opportunities: string[] = [];

  if (crossChainState.chainConcentration > 0.7) {
    risks.push(`High chain concentration at ${crossChainState.chainWithLargestSharePercent}% on ${crossChainState.chainWithLargestShare}`);
  }
  if (crossChainState.volatileExposure > 60) {
    risks.push('Very high volatile asset exposure - treasury at risk in down markets');
    opportunities.push('Consider rebalancing toward stable assets');
  }
  if (classifications.some(c => c.assetClass === 'nft')) {
    risks.push('NFT holdings are illiquid and difficult to govern');
  }
  
  if (crossChainState.stableExposure === 0 && classifications.length > 0) {
    risks.push('No stable asset backing - treasury is vulnerable');
  }
  if (crossChainState.totalValueUSD > 5000 && crossChainState.yieldExposure === 0) {
    opportunities.push('Treasury is large enough to enable yield strategies for additional returns');
  }
  if (crossChainState.chainConcentration < 0.4 && Object.keys(crossChainState.exposureByChain).length > 2) {
    opportunities.push('Good cross-chain diversification - reduces single-chain risk');
  }

  // Determine health status
  let healthStatus = 'healthy';
  if (risks.length >= 2 || crossChainState.volatileExposure > 80) {
    healthStatus = 'critical';
  } else if (risks.length === 1 || crossChainState.volatileExposure > 60) {
    healthStatus = 'caution';
  }

  // Character mapping
  const characterMap: Record<DAOType, string> = {
    free: 'conservative-minimal',
    shortTerm: 'conservative-distributive',
    collective: 'balanced-accumulative',
    governance: 'balanced-defensive',
    meta: 'sophisticated-active'
  };

  return {
    assetClassifications: classifications,
    assetClassBreakdown: {
      stable: classifications.filter(c => c.assetClass === 'stable').length,
      volatile: classifications.filter(c => c.assetClass === 'volatile').length,
      governance: classifications.filter(c => c.assetClass === 'governance').length,
      yield: classifications.filter(c => c.assetClass === 'yield').length,
      derivative: classifications.filter(c => c.assetClass === 'derivative').length,
      lp: classifications.filter(c => c.assetClass === 'lp').length,
      vault: classifications.filter(c => c.assetClass === 'vault').length,
      nft: classifications.filter(c => c.assetClass === 'nft').length,
      wrapped: classifications.filter(c => c.assetClass === 'wrapped').length,
      exotic: classifications.filter(c => c.assetClass === 'exotic').length,
    },
    behavior: {
      mode: behavior.mode,
      aggressiveness: behavior.aggressiveness,
      confidence: behavior.confidence,
      indicators: behavior.indicators,
      recommendations: behavior.recommendations,
      riskLevel: behavior.riskLevel
    },
    crossChainState,
    recommendedGovernanceFormula: governanceFormula.recommendedFormula,
    governanceWeightFactor: 0.6,
    risks,
    opportunities,
    semanticSummary: {
      treasuryCharacter: characterMap[treasury.daoType || 'free'],
      healthStatus,
      keyInsights: [
        `${treasury.daoType || 'free'} DAO with ${behavior.mode} treasury strategy`,
        `${crossChainState.stableExposure.toFixed(1)}% stable asset backing`,
        `${Object.keys(crossChainState.exposureByChain).length} chain${Object.keys(crossChainState.exposureByChain).length === 1 ? '' : 's'} supported`,
        `Treasury value: $${crossChainState.totalValueUSD.toLocaleString()}`,
      ]
    }
  };
}
