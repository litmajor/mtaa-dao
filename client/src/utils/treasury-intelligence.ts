
/**
 * Treasury Intelligence Layer
 * 
 * Sits on TOP of treasury.config.ts (Layer 1: Capability Gate)
 *
 * Adds semantic reasoning for:
 * - Asset class classification (not just symbols)
 * - Risk profiling
 * - Treasury behavior modes
 * - Cross-chain state normalization
 * - Advanced governance weight formulas
 * - Exposure calculations
 * 
 * This is where the asset engine and cognition layer get their semantic vocabulary.
 */

import { DAOType, TreasuryAsset, DAOTreasury, ChainType } from '@/types/treasury';
import { getTreasuryConfigForDAOType } from '@/config/treasury.config';

// ========== ASSET CLASS HIERARCHY ==========

/**
 * Asset Class: How the system reasons about asset TYPE, not symbol
 * 
 * The cognition engine thinks in classes, not tokens:
 * - "Treasury is 82% stable" (not "has cUSD and USDC")
 * - "Too much volatile exposure" (not "owns too much CELO")
 * - "Yield strategies active" (not "owns LP tokens")
 */
export type AssetClass = 
  | 'stable'        // cUSD, USDC, DAI (pegged to USD)
  | 'volatile'      // CELO, ETH, BTC (price fluctuates)
  | 'governance'    // Governance tokens with voting rights
  | 'yield'         // Generates passive returns (aTokens, xTokens, LP positions)
  | 'derivative'    // Synthetic or derivative positions
  | 'lp'            // Liquidity pool shares
  | 'vault'         // Vault/contract shares (e.g., Aave deposits)
  | 'nft'           // NFT-backed or -collateralized
  | 'wrapped'       // Cross-chain wrapped assets
  | 'exotic';       // Custom/unknown tokens

/**
 * Risk Profile: How risky is this asset class?
 */
export type RiskProfile = 'low' | 'medium' | 'high' | 'very-high';

/**
 * Asset Classification
 * Maps each asset to its class + risk + properties
 */
export interface AssetClassification {
  symbol: string;
  chain: ChainType;
  assetClass: AssetClass;
  riskProfile: RiskProfile;
  strategyEligible: boolean;  // Can be used in yield/DeFi strategies?
  yieldCapable: boolean;       // Can earn yield?
  liquidityDepth: 'deep' | 'moderate' | 'shallow';  // On-chain liquidity
  volatilityScore: number;    // 0-100, higher = more volatile
  correlationWithOthers: Record<string, number>;  // Correlation to other major assets
}

/**
 * Classify assets from our treasury system
 */
export const classifyAsset = (asset: TreasuryAsset): AssetClassification => {
  // Stable coins
  if (['cUSD', 'USDC', 'USDT', 'DAI'].includes(asset.symbol)) {
    return {
      symbol: asset.symbol,
      chain: asset.chain,
      assetClass: 'stable',
      riskProfile: 'low',
      strategyEligible: true,
      yieldCapable: true,
      liquidityDepth: 'deep',
      volatilityScore: 2,
      correlationWithOthers: {
        USDC: 0.99,
        DAI: 0.98,
        cUSD: 0.99,
        USDT: 0.98,
        CELO: 0.15,
        ETH: 0.20
      }
    };
  }

  // Native/volatile assets
  if (['CELO', 'ETH', 'BTC'].includes(asset.symbol)) {
    return {
      symbol: asset.symbol,
      chain: asset.chain,
      assetClass: 'volatile',
      riskProfile: asset.symbol === 'CELO' ? 'high' : 'medium',
      strategyEligible: true,
      yieldCapable: true,  // Via LP or lending
      liquidityDepth: 'deep',
      volatilityScore: asset.symbol === 'CELO' ? 75 : 60,
      correlationWithOthers: {
        CELO: 1.0,
        ETH: 0.65,
        BTC: 0.55,
        USDC: 0.20,
        DAI: 0.18
      }
    };
  }

  // Governance tokens
  if (asset.symbol.includes('GOV') || asset.symbol.includes('DAO')) {
    return {
      symbol: asset.symbol,
      chain: asset.chain,
      assetClass: 'governance',
      riskProfile: 'very-high',
      strategyEligible: false,
      yieldCapable: false,
      liquidityDepth: 'shallow',
      volatilityScore: 85,
      correlationWithOthers: {}
    };
  }

  // Yield/LP tokens
  if (asset.symbol.includes('LP') || asset.symbol.includes('aToken') || asset.symbol.includes('xToken')) {
    return {
      symbol: asset.symbol,
      chain: asset.chain,
      assetClass: 'lp',
      riskProfile: 'medium',
      strategyEligible: true,
      yieldCapable: true,
      liquidityDepth: 'moderate',
      volatilityScore: 50,
      correlationWithOthers: {}
    };
  }

  // Wrapped assets
  if (asset.symbol.includes('w') || asset.symbol.includes('Wrapped')) {
    return {
      symbol: asset.symbol,
      chain: asset.chain,
      assetClass: 'wrapped',
      riskProfile: 'low',
      strategyEligible: true,
      yieldCapable: false,
      liquidityDepth: 'moderate',
      volatilityScore: 30,
      correlationWithOthers: {}
    };
  }

  // Default: unknown/custom token
  return {
    symbol: asset.symbol,
    chain: asset.chain,
    assetClass: 'exotic',
    riskProfile: 'very-high',
    strategyEligible: false,
    yieldCapable: false,
    liquidityDepth: 'shallow',
    volatilityScore: 80,
    correlationWithOthers: {}
  };
};

// ========== TREASURY BEHAVIOR MODES ==========

/**
 * Treasury Behavior Mode: How does this treasury ACT?
 * 
 * Not about the DAO type, but about the treasury's actual strategy.
 */
export type TreasuryMode = 
  | 'static'           // Hold-only (no yield, no strategies)
  | 'distributive'     // Designed for payouts (frequent withdrawals)
  | 'accumulative'     // Long-term growth (compound, reinvest)
  | 'market-active'    // Engage with DeFi (LP, yield, swaps)
  | 'hedged'          // Risk-managed (diversified, rebalanced)
  | 'speculative';    // Active trading, high-risk bets

/**
 * Infer treasury behavior mode from DAO config and asset composition
 */
export interface TreasuryBehaviorAnalysis {
  mode: TreasuryMode;
  confidence: number;  // 0-100
  indicators: string[];
  recommendations: string[];
  riskLevel: RiskProfile;
}

export const analyzeTreasuryBehavior = (
  treasury: DAOTreasury,
  classifications: Map<string, AssetClassification>
): TreasuryBehaviorAnalysis => {
  const indicators: string[] = [];
  const recommendations: string[] = [];
  let mode: TreasuryMode = 'static';
  let confidence = 50;
  let riskLevel: RiskProfile = 'low';

  // Count assets by class
  const assetsByClass = new Map<AssetClass, number>();
  let totalStableValue = 0;
  let totalVolatileValue = 0;
  let totalYieldValue = 0;

  for (const asset of treasury.assets) {
    if (!asset.isActive) continue;
    const classif = classifications.get(`${asset.symbol}-${asset.chain}`);
    if (!classif) continue;

    assetsByClass.set(classif.assetClass, (assetsByClass.get(classif.assetClass) || 0) + 1);

    if (classif.assetClass === 'stable') totalStableValue += parseFloat(asset.balance);
    if (classif.assetClass === 'volatile') totalVolatileValue += parseFloat(asset.balance);
    if (classif.assetClass === 'yield' || classif.assetClass === 'lp') totalYieldValue += parseFloat(asset.balance);
  }

  const totalValue = totalStableValue + totalVolatileValue + totalYieldValue;
  const stablePercent = totalValue > 0 ? (totalStableValue / totalValue) * 100 : 0;
  const volatilePercent = totalValue > 0 ? (totalVolatileValue / totalValue) * 100 : 0;
  const yieldPercent = totalValue > 0 ? (totalYieldValue / totalValue) * 100 : 0;

  // Analyze DAO type for hints
  const daoType = treasury.daoType;
  const config = getTreasuryConfigForDAOType(daoType);

  // Rule: Mostly stable + small treasury = static
  if (stablePercent > 80 && treasury.assets.length <= 2) {
    mode = 'static';
    confidence = 85;
    indicators.push(`High stable asset ratio (${stablePercent.toFixed(1)}%)`);
    indicators.push('Small asset portfolio');
    riskLevel = 'low';
  }
  // Rule: Mix of stable + volatile + yield = market-active
  else if (yieldPercent > 10 && volatilePercent > 20) {
    mode = 'market-active';
    confidence = 80;
    indicators.push(`Active yield component (${yieldPercent.toFixed(1)}%)`);
    indicators.push(`Volatile exposure (${volatilePercent.toFixed(1)}%)`);
    riskLevel = 'medium';
  }
  // Rule: Mostly stable = accumulative or distributive
  else if (stablePercent > 70) {
    // If DAO is short-term, probably distributive
    if (daoType === 'shortTerm') {
      mode = 'distributive';
      confidence = 75;
      indicators.push('Short-term DAO pattern');
      recommendations.push('Plan for regular payouts');
    } else {
      mode = 'accumulative';
      confidence = 70;
      indicators.push('Long-term holding strategy');
      recommendations.push('Consider yield-generating strategies');
    }
    riskLevel = 'low';
  }
  // Rule: High volatile = speculative or hedged (depends on analysis)
  else if (volatilePercent > 50) {
    mode = 'speculative';
    confidence = 65;
    indicators.push(`High volatile exposure (${volatilePercent.toFixed(1)}%)`);
    recommendations.push('Review risk management strategy');
    riskLevel = 'high';
  }

  // Add recommendations based on gaps
  if (stablePercent < 50 && ['collective', 'shortTerm'].includes(daoType)) {
    recommendations.push('Increase stablecoin holdings for DAO safety');
  }

  if (treasury.assets.length === 1) {
    recommendations.push('Add second asset for diversification');
  }

  if (!config.features.multiChainSupport && treasury.assets.some(a => a.chain !== 'CELO')) {
    recommendations.push('This DAO type should hold assets on single chain (CELO)');
  }

  return {
    mode,
    confidence,
    indicators,
    recommendations,
    riskLevel
  };
};

// ========== CROSS-CHAIN STATE NORMALIZATION ==========

/**
 * Cross-chain treasury view: unified perspective across all chains
 */
export interface CrossChainTreasuryState {
  // Exposure aggregation
  exposureByChain: Record<ChainType, {
    usdValue: number;
    assetCount: number;
    dominantAssetClass: AssetClass;
    governanceWeightContribution: number;
  }>;

  exposureByAssetClass: Record<AssetClass, {
    usdValue: number;
    assetCount: number;
    chains: ChainType[];
    governanceWeightContribution: number;
  }>;

  // Treasury health metrics
  totalValueUSD: number;
  stableExposure: number;     // %
  volatileExposure: number;   // %
  yieldExposure: number;      // %
  chainConcentration: number; // 0-1, higher = more concentrated
  assetConcentration: number; // 0-1, higher = fewer asset types

  // Fragmentation concerns
  isCriticallyFragmented: boolean;
  chainWithLargestShare: ChainType;
  chainWithLargestSharePercent: number;
}

/**
 * Normalize treasury state across chains
 */
export const normalizeCrossChainState = (
  treasury: DAOTreasury,
  priceData: Record<string, number>,  // symbol-chain -> USD price
  classifications: Map<string, AssetClassification>
): CrossChainTreasuryState => {
  const exposureByChain: Record<string, any> = {};
  const exposureByAssetClass: Record<string, any> = {};

  let totalValue = 0;
  let stableValue = 0;
  let volatileValue = 0;
  let yieldValue = 0;

  // First pass: aggregate values
  for (const asset of treasury.assets) {
    if (!asset.isActive) continue;

    const priceKey = `${asset.symbol}-${asset.chain}`;
    const price = priceData[priceKey] || 0;
    const balance = parseFloat(asset.balance) / Math.pow(10, asset.decimals);
    const usdValue = balance * price;

    totalValue += usdValue;

    const classif = classifications.get(priceKey);
    const assetClass = classif?.assetClass || 'exotic';

    if (assetClass === 'stable') stableValue += usdValue;
    if (assetClass === 'volatile') volatileValue += usdValue;
    if (['yield', 'lp', 'vault'].includes(assetClass)) yieldValue += usdValue;

    // Track by chain
    if (!exposureByChain[asset.chain]) {
      exposureByChain[asset.chain] = {
        usdValue: 0,
        assetCount: 0,
        assetClasses: new Set<AssetClass>(),
        governanceWeightContribution: 0
      };
    }
    exposureByChain[asset.chain].usdValue += usdValue;
    exposureByChain[asset.chain].assetCount++;
    if (classif) exposureByChain[asset.chain].assetClasses.add(classif.assetClass);

    // Track by asset class
    if (!exposureByAssetClass[assetClass]) {
      exposureByAssetClass[assetClass] = {
        usdValue: 0,
        assetCount: 0,
        chains: new Set<ChainType>(),
        governanceWeightContribution: 0
      };
    }
    exposureByAssetClass[assetClass].usdValue += usdValue;
    exposureByAssetClass[assetClass].assetCount++;
    exposureByAssetClass[assetClass].chains.add(asset.chain);
  }

  // Calculate concentrations
  let chainConcentration = 0;
  let maxChainShare = 0;
  let chainWithLargestShare: ChainType = 'CELO';

  for (const [chain, data] of Object.entries(exposureByChain)) {
    const share = totalValue > 0 ? data.usdValue / totalValue : 0;
    if (share > maxChainShare) {
      maxChainShare = share;
      chainWithLargestShare = chain as ChainType;
    }
  }

  // Herfindahl index for concentration (0-1, higher = more concentrated)
  for (const [_, data] of Object.entries(exposureByChain)) {
    const share = totalValue > 0 ? data.usdValue / totalValue : 0;
    chainConcentration += share * share;
  }

  let assetConcentration = 0;
  for (const [_, data] of Object.entries(exposureByAssetClass)) {
    const share = totalValue > 0 ? data.usdValue / totalValue : 0;
    assetConcentration += share * share;
  }

  // Determine if critically fragmented
  // Fragmented if: >5 chains, no chain >40%, or >10 asset classes
  const chainCount = Object.keys(exposureByChain).length;
  const assetClassCount = Object.keys(exposureByAssetClass).length;
  const isCriticallyFragmented = chainCount > 5 || maxChainShare < 0.4 || assetClassCount > 10;

  // Convert Sets to arrays for output
  const normalizedByChain: Record<ChainType, any> = {};
  for (const [chain, data] of Object.entries(exposureByChain)) {
    normalizedByChain[chain as ChainType] = {
      usdValue: data.usdValue,
      assetCount: data.assetCount,
      dominantAssetClass: Array.from(data.assetClasses)[0] || 'exotic',
      governanceWeightContribution: 0  // Will be calculated by governance engine
    };
  }

  const normalizedByClass: Record<AssetClass, any> = {};
  for (const [assetClass, data] of Object.entries(exposureByAssetClass)) {
    normalizedByClass[assetClass as AssetClass] = {
      usdValue: data.usdValue,
      assetCount: data.assetCount,
      chains: Array.from(data.chains),
      governanceWeightContribution: 0  // Will be calculated by governance engine
    };
  }

  return {
    exposureByChain: normalizedByChain,
    exposureByAssetClass: normalizedByClass,
    totalValueUSD: totalValue,
    stableExposure: totalValue > 0 ? (stableValue / totalValue) * 100 : 0,
    volatileExposure: totalValue > 0 ? (volatileValue / totalValue) * 100 : 0,
    yieldExposure: totalValue > 0 ? (yieldValue / totalValue) * 100 : 0,
    chainConcentration,
    assetConcentration,
    isCriticallyFragmented,
    chainWithLargestShare,
    chainWithLargestSharePercent: maxChainShare * 100
  };
};

// ========== ADVANCED GOVERNANCE WEIGHT FORMULAS ==========

/**
 * Instead of:
 *   votingWeightSource: 'deposit' | 'equal' | 'tokenHolding'
 * 
 * Support computed formulas:
 *   votingWeightFormula: (member context) => weight
 */

export type GovernanceWeightFactors = {
  depositAmount: number;
  holdingTime: number;      // days held
  assetClass: AssetClass;
  roleMultiplier: number;   // elder = 1.5, member = 1.0
  reputationScore: number;  // 0-100
};

/**
 * Voting weight formula builder
 */
export class GovernanceWeightFormula {
  /**
   * Equal voting: 1 person = 1 vote
   */
  static equal(): (factors: GovernanceWeightFactors) => number {
    return () => 1;
  }

  /**
   * Deposit-based: vote weight = deposit amount
   */
  static depositBased(): (factors: GovernanceWeightFactors) => number {
    return (factors) => factors.depositAmount;
  }

  /**
   * Token-holding based
   */
  static tokenHoldingBased(): (factors: GovernanceWeightFactors) => number {
    return (factors) => factors.depositAmount;  // Same as deposit in this context
  }

  /**
   * Quadratic: vote weight = sqrt(deposit)
   * Reduces influence of large deposits, gives voice to small holders
   */
  static quadratic(): (factors: GovernanceWeightFactors) => number {
    return (factors) => Math.sqrt(Math.max(0, factors.depositAmount));
  }

  /**
   * Time-weighted: rewards long-term holders
   * weight = deposit * (1 + holdingDays / 365)
   */
  static timeWeighted(): (factors: GovernanceWeightFactors) => number {
    return (factors) => {
      const holdingBonus = 1 + (factors.holdingTime / 365);
      return factors.depositAmount * holdingBonus;
    };
  }

  /**
   * Role-based multiplier
   * e.g., elders get 1.5x, members get 1x
   */
  static roleMultiplied(): (factors: GovernanceWeightFactors) => number {
    return (factors) => factors.depositAmount * factors.roleMultiplier;
  }

  /**
   * Reputation-weighted
   * Higher reputation score = more influence
   */
  static reputationWeighted(): (factors: GovernanceWeightFactors) => number {
    return (factors) => {
      const reputationBonus = 1 + (factors.reputationScore / 100) * 0.5;  // +0% to +50%
      return factors.depositAmount * reputationBonus;
    };
  }

  /**
   * Hybrid: deposit + time + reputation
   * weight = deposit * (1 + holdingDays/365) * (1 + reputationScore/200) * roleMultiplier
   */
  static hybrid(): (factors: GovernanceWeightFactors) => number {
    return (factors) => {
      const timeBonus = 1 + (factors.holdingTime / 365);
      const reputationBonus = 1 + (factors.reputationScore / 200);
      return factors.depositAmount * timeBonus * reputationBonus * factors.roleMultiplier;
    };
  }

  /**
   * Asset-class aware: only stable deposits count for voting
   */
  static stableAssetsOnly(): (factors: GovernanceWeightFactors) => number {
    return (factors) => {
      // Only stable assets contribute to voting weight
      if (factors.assetClass === 'stable') {
        return factors.depositAmount;
      }
      return 0;  // Non-stable assets don't contribute
    };
  }
}

/**
 * Recommend voting weight formula based on treasury analysis
 */
export const recommendGovernanceFormula = (
  behavior: TreasuryBehaviorAnalysis,
  daoType: DAOType
): string => {
  // Short-term, stable treasuries → equal voting (fairness)
  if (behavior.mode === 'distributive' || behavior.mode === 'static') {
    return 'equal';
  }

  // Long-term, growth-oriented → time-weighted or hybrid
  if (behavior.mode === 'accumulative') {
    return daoType === 'collective' ? 'timeWeighted' : 'hybrid';
  }

  // Active market engagement → reputation-weighted (experienced members lead)
  if (behavior.mode === 'market-active') {
    return 'reputationWeighted';
  }

  // Speculative → require high reputation
  if (behavior.mode === 'speculative') {
    return 'reputationWeighted';  // Only experienced members drive risky decisions
  }

  return 'depositBased';  // Default
};

// ========== TREASURY INTELLIGENCE SUMMARY ==========

/**
 * Complete treasury intelligence report
 * This is what the asset engine and cognition layer consume
 */
export interface TreasuryIntelligenceSummary {
  // Asset intelligence
  assetClassifications: Map<string, AssetClassification>;
  assetClassBreakdown: Record<AssetClass, number>;  // counts

  // Behavior analysis
  behavior: TreasuryBehaviorAnalysis;

  // Cross-chain state
  crossChainState: CrossChainTreasuryState;

  // Governance recommendations
  recommendedGovernanceFormula: string;
  governanceWeightFactor: number;  // How much weight affects decisions

  // Risks and opportunities
  risks: string[];
  opportunities: string[];
  
  // Cognition-friendly summary
  semanticSummary: {
    treasuryCharacter: string;  // "conservative", "balanced", "aggressive"
    healthStatus: 'healthy' | 'caution' | 'critical';
    keyInsights: string[];
  };
}

/**
 * Generate complete treasury intelligence
 */
export const generateTreasuryIntelligence = (
  treasury: DAOTreasury,
  priceData: Record<string, number>
): TreasuryIntelligenceSummary => {
  // Classify all assets
  const classifications = new Map<string, AssetClassification>();
  for (const asset of treasury.assets) {
    const key = `${asset.symbol}-${asset.chain}`;
    classifications.set(key, classifyAsset(asset));
  }

  // Analyze behavior
  const behavior = analyzeTreasuryBehavior(treasury, classifications);

  // Normalize cross-chain state
  const crossChainState = normalizeCrossChainState(treasury, priceData, classifications);

  // Recommend governance formula
  const recommendedFormula = recommendGovernanceFormula(behavior, treasury.daoType);

  // Assess risks and opportunities
  const risks: string[] = [];
  const opportunities: string[] = [];

  if (crossChainState.isCriticallyFragmented) {
    risks.push('Treasury is fragmented across many chains - consider consolidation');
  }

  if (crossChainState.assetConcentration > 0.8) {
    risks.push('Over-concentrated in single asset class - add diversification');
  }

  if (crossChainState.chainWithLargestSharePercent > 70) {
    risks.push(`${crossChainState.chainWithLargestShare} dominates holdings (${crossChainState.chainWithLargestSharePercent.toFixed(1)}%)`);
  }

  if (behavior.mode === 'static' && crossChainState.yieldExposure === 0) {
    opportunities.push('Treasury could benefit from yield-generating strategies');
  }

  if (crossChainState.volatileExposure > 50 && behavior.riskLevel === 'high') {
    risks.push('High volatile exposure - consider hedging strategy');
  }

  // Determine treasury character
  let character = 'balanced';
  if (crossChainState.stableExposure > 80) character = 'conservative';
  if (crossChainState.volatileExposure > 50) character = 'aggressive';
  if (behavior.mode === 'market-active') character = 'active';

  // Health status
  let healthStatus: 'healthy' | 'caution' | 'critical' = 'healthy';
  if (risks.length > 2) healthStatus = 'caution';
  if (risks.length > 4) healthStatus = 'critical';

  // Generate key insights
  const keyInsights: string[] = [];
  keyInsights.push(`Treasury mode: ${behavior.mode}`);
  keyInsights.push(`${crossChainState.stableExposure.toFixed(1)}% in stables`);
  if (crossChainState.yieldExposure > 0) {
    keyInsights.push(`${crossChainState.yieldExposure.toFixed(1)}% in yield strategies`);
  }
  keyInsights.push(`Largest chain: ${crossChainState.chainWithLargestShare} (${crossChainState.chainWithLargestSharePercent.toFixed(1)}%)`);

  return {
    assetClassifications: classifications,
    assetClassBreakdown: Object.fromEntries(
      Array.from(classifications.values()).reduce((map, c) => {
        map.set(c.assetClass, (map.get(c.assetClass) || 0) + 1);
        return map;
      }, new Map())
    ),
    behavior,
    crossChainState,
    recommendedGovernanceFormula: recommendedFormula,
    governanceWeightFactor: behavior.confidence / 100,
    risks,
    opportunities,
    semanticSummary: {
      treasuryCharacter: character,
      healthStatus,
      keyInsights
    }
  };
};
