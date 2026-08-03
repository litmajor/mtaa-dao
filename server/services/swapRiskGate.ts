import { logger } from '../utils/logger';
import {
  advancedMicrostructureIndicators,
  PriceImpactAnalysis,
} from './advancedMicrostructureIndicators';

export interface SwapRiskAssessment {
  safe: boolean;
  reason?: string;
  toxicity: number;
  toxicityAssessment: string;
  priceImpact: PriceImpactAnalysis | null;
}

const DEFAULT_TOXICITY_THRESHOLD = 75;
const DEFAULT_SHORT_TERM_IMPACT_THRESHOLD = 5;
const DEFAULT_MIN_RESILIENCE = 40;

function normalizeAssetSymbol(symbol: string): string {
  return String(symbol || '').trim().toUpperCase();
}

export async function assessSwapRisk(
  fromAsset: string,
  toAsset: string,
  exchange: string = 'binance'
): Promise<SwapRiskAssessment> {
  const normalizedToAsset = normalizeAssetSymbol(toAsset);

  try {
    const [toxicity, priceImpact] = await Promise.all([
      advancedMicrostructureIndicators.detectOrderBookToxicity(normalizedToAsset, exchange),
      advancedMicrostructureIndicators.analyzePriceImpact(normalizedToAsset, exchange),
    ]);

    const reasons: string[] = [];

    if (toxicity.toxicity >= DEFAULT_TOXICITY_THRESHOLD) {
      reasons.push(`High order-book toxicity (${toxicity.assessment}, ${toxicity.toxicity}%)`);
    }

    if (priceImpact.shortTermImpact > DEFAULT_SHORT_TERM_IMPACT_THRESHOLD) {
      reasons.push(`Elevated short-term impact (${priceImpact.shortTermImpact.toFixed(2)}%)`);
    }

    if (priceImpact.resilience < DEFAULT_MIN_RESILIENCE) {
      reasons.push(`Low resilience (${priceImpact.resilience.toFixed(0)})`);
    }

    return {
      safe: reasons.length === 0,
      reason: reasons.length > 0 ? reasons.join('; ') : 'Risk assessment passed',
      toxicity: toxicity.toxicity,
      toxicityAssessment: toxicity.assessment,
      priceImpact,
    };
  } catch (error) {
    logger.error('Failed to assess swap risk', { fromAsset, toAsset, error });
    return {
      safe: true,
      reason: 'Risk assessment unavailable',
      toxicity: 0,
      toxicityAssessment: 'unknown',
      priceImpact: null,
    };
  }
}
