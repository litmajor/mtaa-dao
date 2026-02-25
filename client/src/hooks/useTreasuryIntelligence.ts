/**
 * useTreasuryIntelligence Hook
 * 
 * Makes treasury intelligence easy to consume in React components
 * Provides semantic understanding for asset engine and cognition layer
 */

import { useState, useCallback, useEffect } from 'react';
import { DAOTreasury } from '@/types/treasury';
import {
  generateTreasuryIntelligence,
  TreasuryIntelligenceSummary,
  GovernanceWeightFormula,
  GovernanceWeightFactors,
  AssetClassification
} from '@/utils/treasury-intelligence';

interface UseTreasuryIntelligenceReturn {
  // Intelligence data
  intelligence: TreasuryIntelligenceSummary | null;
  isAnalyzing: boolean;
  error: string | null;

  // Quick accessors
  treasuryCharacter: () => string;
  healthStatus: () => string;
  isFragmented: () => boolean;
  exposures: () => { stable: number; volatile: number; yield: number };
  risks: () => string[];
  opportunities: () => string[];
  keyInsights: () => string[];

  // Governance weight support
  calculateGovernanceWeight: (factors: GovernanceWeightFactors, formulaName?: string) => number;
  getRecommendedFormula: () => string;

  // Asset class reasoning
  getAssetClass: (symbol: string, chain: string) => AssetClassification | undefined;
  assetsOfClass: (assetClass: string) => AssetClassification[];

  // Manual update
  analyze: (treasury: DAOTreasury, priceData: Record<string, number>) => void;
}

/**
 * Hook to generate and consume treasury intelligence
 */
export const useTreasuryIntelligence = (): UseTreasuryIntelligenceReturn => {
  const [intelligence, setIntelligence] = useState<TreasuryIntelligenceSummary | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Main analysis function
  const analyze = useCallback(
    (treasury: DAOTreasury, priceData: Record<string, number>) => {
      try {
        setIsAnalyzing(true);
        setError(null);
        const result = generateTreasuryIntelligence(treasury, priceData);
        setIntelligence(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to analyze treasury';
        setError(errorMessage);
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  // Quick accessors
  const treasuryCharacter = useCallback(
    () => intelligence?.semanticSummary.treasuryCharacter || 'unknown',
    [intelligence]
  );

  const healthStatus = useCallback(
    () => intelligence?.semanticSummary.healthStatus || 'unknown',
    [intelligence]
  );

  const isFragmented = useCallback(
    () => intelligence?.crossChainState.isCriticallyFragmented || false,
    [intelligence]
  );

  const exposures = useCallback(
    () => ({
      stable: intelligence?.crossChainState.stableExposure || 0,
      volatile: intelligence?.crossChainState.volatileExposure || 0,
      yield: intelligence?.crossChainState.yieldExposure || 0
    }),
    [intelligence]
  );

  const risks = useCallback(
    () => intelligence?.risks || [],
    [intelligence]
  );

  const opportunities = useCallback(
    () => intelligence?.opportunities || [],
    [intelligence]
  );

  const keyInsights = useCallback(
    () => intelligence?.semanticSummary.keyInsights || [],
    [intelligence]
  );

  // Governance weight calculator
  const calculateGovernanceWeight = useCallback(
    (factors: GovernanceWeightFactors, formulaName?: string): number => {
      if (!intelligence) return 0;

      const formula = formulaName || intelligence.recommendedGovernanceFormula;

      switch (formula) {
        case 'equal':
          return GovernanceWeightFormula.equal()(factors);
        case 'depositBased':
          return GovernanceWeightFormula.depositBased()(factors);
        case 'tokenHoldingBased':
          return GovernanceWeightFormula.tokenHoldingBased()(factors);
        case 'quadratic':
          return GovernanceWeightFormula.quadratic()(factors);
        case 'timeWeighted':
          return GovernanceWeightFormula.timeWeighted()(factors);
        case 'roleMultiplied':
          return GovernanceWeightFormula.roleMultiplied()(factors);
        case 'reputationWeighted':
          return GovernanceWeightFormula.reputationWeighted()(factors);
        case 'hybrid':
          return GovernanceWeightFormula.hybrid()(factors);
        case 'stableAssetsOnly':
          return GovernanceWeightFormula.stableAssetsOnly()(factors);
        default:
          return GovernanceWeightFormula.depositBased()(factors);
      }
    },
    [intelligence]
  );

  const getRecommendedFormula = useCallback(
    () => intelligence?.recommendedGovernanceFormula || 'depositBased',
    [intelligence]
  );

  // Asset class accessors
  const getAssetClass = useCallback(
    (symbol: string, chain: string): AssetClassification | undefined => {
      const key = `${symbol}-${chain}`;
      return intelligence?.assetClassifications.get(key);
    },
    [intelligence]
  );

  const assetsOfClass = useCallback(
    (assetClass: string): AssetClassification[] => {
      if (!intelligence) return [];
      const result: AssetClassification[] = [];
      for (const classif of intelligence.assetClassifications.values()) {
        if (classif.assetClass === assetClass) {
          result.push(classif);
        }
      }
      return result;
    },
    [intelligence]
  );

  return {
    intelligence,
    isAnalyzing,
    error,
    treasuryCharacter,
    healthStatus,
    isFragmented,
    exposures,
    risks,
    opportunities,
    keyInsights,
    calculateGovernanceWeight,
    getRecommendedFormula,
    getAssetClass,
    assetsOfClass,
    analyze
  };
};

/**
 * Advanced hook: subscription to intelligence updates
 * Useful if treasury or prices change frequently
 */
export const useTreasuryIntelligenceMonitor = (
  treasury: DAOTreasury | null,
  priceData: Record<string, number> | null,
  pollIntervalMs: number = 5000
) => {
  const { intelligence, analyze, ...rest } = useTreasuryIntelligence();

  useEffect(() => {
    if (!treasury || !priceData) return;

    // Initial analysis
    analyze(treasury, priceData);

    // Poll for updates
    const interval = setInterval(() => {
      analyze(treasury, priceData);
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [treasury, priceData, pollIntervalMs, analyze]);

  return { intelligence, ...rest };
};
