/**
 * OHLCV Service → Graph Propagation Adapter
 * 
 * Converts OHLCV data into propagation deltas
 * Trigger: When volatility crosses threshold
 */

import { logger } from '../utils/logger';
import { graphPropagationEngine, PropagationDelta } from './graphPropagationEngine';
import { graphPropagationBus } from './graphPropagationBus';

export interface OHLCVUpdate {
  symbol: string;
  price: number;
  volume24h: number;
  volatility: number;
  previousVolatility: number;
  volatilityRegime: 'low' | 'normal' | 'high' | 'extreme';
  liquidityScore: number;
  previousLiquidityScore: number;
  trendRegime: 'uptrend' | 'downtrend' | 'range';
  timestamp: number;
}

/**
 * Configuration for volatility propagation
 */
export const VOLATILITY_THRESHOLDS = {
  low_to_normal: 0.3,
  normal_to_high: 0.5,
  high_to_extreme: 0.8,
  volatility_delta_trigger: 0.2, // propagate if change > 20%
};

/**
 * Convert OHLCV update to propagation delta
 */
export function ohlcvToPropagationDelta(update: OHLCVUpdate): PropagationDelta | null {
  // Calculate volatility change magnitude
  const volatilityDelta = Math.abs(update.volatility - update.previousVolatility);
  const volatilityChangePercent = volatilityDelta / update.previousVolatility;
  
  // Only propagate if change is significant
  if (volatilityChangePercent < VOLATILITY_THRESHOLDS.volatility_delta_trigger) {
    return null;
  }
  
  // Normalize magnitude to 0-1 scale
  // Extreme changes clamp at 1.0
  const magnitude = Math.min(volatilityChangePercent / 0.5, 1.0);
  
  return {
    nodeId: update.symbol,
    deltaType: 'volatility',
    previousValue: update.previousVolatility,
    newValue: update.volatility,
    magnitude,
    threshold: magnitude,
    timestamp: update.timestamp,
  };
}

/**
 * Process OHLCV update through propagation engine
 */
export async function processOHLCVUpdate(update: OHLCVUpdate): Promise<{
  propagated: boolean;
  delta: PropagationDelta | null;
  modifiedNodes: number;
  cascadeCount: number;
}> {
  try {
    const delta = ohlcvToPropagationDelta(update);
    
    if (!delta) {
      return {
        propagated: false,
        delta: null,
        modifiedNodes: 0,
        cascadeCount: 0,
      };
    }
    
    logger.info(
      `[OHLCV→Propagation] ${update.symbol}: vol ${update.previousVolatility.toFixed(3)} → ${update.volatility.toFixed(3)} (Δ${(delta.magnitude * 100).toFixed(1)}%)`
    );
    
    // Emit on the propagation bus; if no listeners, fallback to direct propagation
    let modified = new Map<string, any>();
    if (graphPropagationBus.listenerCount('volatility_change') > 0) {
      graphPropagationBus.emit('volatility_change', update.symbol, update.previousVolatility, update.volatility);
      // integration hooks will call propagate and monitoring
    } else {
      // Fallback: direct propagation
      modified = graphPropagationEngine.propagate(delta);
      // Update node with new volatility state
      const node = graphPropagationEngine.getNode(update.symbol);
      if (node) {
        node.propagationState.volatilityScore = update.volatility;
        node.propagationState.volatilityRegime = update.volatilityRegime;
        node.propagationState.liquidityScore = update.liquidityScore;
        node.currentPrice = update.price;
        node.propagationState.updatedAt = update.timestamp;
      }
    }

    return {
      propagated: true,
      delta,
      modifiedNodes: modified.size,
      cascadeCount: modified.size > 0 ? 1 : 0, // simplified, actual count from engine
    };
  } catch (error) {
    logger.error(`[OHLCV→Propagation] Error processing ${update.symbol}:`, error);
    return {
      propagated: false,
      delta: null,
      modifiedNodes: 0,
      cascadeCount: 0,
    };
  }
}

/**
 * Batch process multiple OHLCV updates
 */
export async function batchProcessOHLCVUpdates(updates: OHLCVUpdate[]): Promise<{
  totalProcessed: number;
  totalPropagated: number;
  totalModifiedNodes: number;
}> {
  let totalPropagated = 0;
  let totalModifiedNodes = 0;
  
  for (const update of updates) {
    const result = await processOHLCVUpdate(update);
    if (result.propagated) {
      totalPropagated++;
      totalModifiedNodes += result.modifiedNodes;
    }
  }
  
  return {
    totalProcessed: updates.length,
    totalPropagated,
    totalModifiedNodes,
  };
}

export const ohlcvPropagationAdapter = {
  onUpdate: processOHLCVUpdate,
  onBatchUpdate: batchProcessOHLCVUpdates,
  thresholds: VOLATILITY_THRESHOLDS,
};

export default ohlcvPropagationAdapter;
