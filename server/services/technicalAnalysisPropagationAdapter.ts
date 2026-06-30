/**
 * Technical Analysis Service → Graph Propagation Adapter
 * 
 * Converts TA signal changes into propagation deltas
 * Trigger: When signal bias changes (neutral→bullish, etc.)
 */

import { logger } from '../utils/logger';
import { graphPropagationEngine, PropagationDelta } from './graphPropagationEngine';
import { graphPropagationBus } from './graphPropagationBus';

export interface TAUpdate {
  symbol: string;
  timeframe: string;
  previousSignalBias: 'bullish' | 'neutral' | 'bearish';
  currentSignalBias: 'bullish' | 'neutral' | 'bearish';
  signalConfidence: number; // 0-1
  signalWeight: number; // 0-1
  rsiValue?: number;
  macdValue?: number;
  trendStrength: number; // 0-1
  volatilityRegime: 'low' | 'normal' | 'high' | 'extreme';
  timestamp: number;
}

/**
 * Configuration for signal propagation
 */
export const SIGNAL_THRESHOLDS = {
  confidence_to_propagate: 0.5, // only propagate if confidence > 50%
  signal_flip_magnitude: 0.7,  // signal flip = 70% magnitude
  confidence_increase_magnitude: 0.4, // increased confidence = 40% magnitude
};

/**
 * Calculate signal change magnitude
 */
function calculateSignalMagnitude(
  previousBias: string,
  currentBias: string,
  confidence: number
): number {
  // Bias flip (neutral → bullish): high magnitude
  if (previousBias !== currentBias) {
    return SIGNAL_THRESHOLDS.signal_flip_magnitude * confidence;
  }
  
  // Same bias: lower magnitude (confidence aligned)
  return SIGNAL_THRESHOLDS.confidence_increase_magnitude * confidence;
}

/**
 * Convert TA update to propagation delta
 */
export function taToPropagationDelta(update: TAUpdate): PropagationDelta | null {
  // Only propagate if confidence sufficient
  if (update.signalConfidence < SIGNAL_THRESHOLDS.confidence_to_propagate) {
    return null;
  }
  
  // Calculate magnitude
  const magnitude = calculateSignalMagnitude(
    update.previousSignalBias,
    update.currentSignalBias,
    update.signalConfidence
  );
  
  // Only propagate significant changes
  if (magnitude < 0.3) {
    return null;
  }
  
  return {
    nodeId: update.symbol,
    deltaType: 'signal',
    previousValue: update.previousSignalBias,
    newValue: update.currentSignalBias,
    magnitude: Math.min(magnitude, 1.0),
    threshold: Math.min(magnitude, 1.0),
    timestamp: update.timestamp,
  };
}

/**
 * Process TA update through propagation engine
 */
export async function processTAUpdate(update: TAUpdate): Promise<{
  propagated: boolean;
  delta: PropagationDelta | null;
  modifiedNodes: number;
  signalFlipped: boolean;
}> {
  try {
    const signalFlipped = update.previousSignalBias !== update.currentSignalBias;
    const delta = taToPropagationDelta(update);
    
    if (!delta) {
      return {
        propagated: false,
        delta: null,
        modifiedNodes: 0,
        signalFlipped,
      };
    }
    
    const action = signalFlipped ? 'FLIP' : 'STRENGTHEN';
    logger.info(
      `[TA→Propagation] ${update.symbol} (${update.timeframe}): ${action} → ${update.currentSignalBias} (conf: ${(update.signalConfidence * 100).toFixed(0)}%, mag: ${(delta.magnitude * 100).toFixed(1)}%)`
    );
    
    // Emit event on bus; fallback to direct propagation
    if (graphPropagationBus.listenerCount('signal_change') > 0) {
      graphPropagationBus.emit('signal_change', update.symbol, update.previousSignalBias, update.currentSignalBias, update.signalConfidence);
    } else {
      const modified = graphPropagationEngine.propagate(delta);
      // Update node with new signal state
      const node = graphPropagationEngine.getNode(update.symbol);
      if (node) {
        node.previousSignalBias = update.previousSignalBias;
        node.propagationState.signalBias = update.currentSignalBias;
        node.propagationState.signalConfidence = update.signalConfidence;
        node.propagationState.signalWeight = update.signalWeight;
        node.propagationState.trendStrength = update.trendStrength;
        node.propagationState.volatilityRegime = update.volatilityRegime;
        node.signalChanged = signalFlipped;
        node.propagationState.updatedAt = update.timestamp;
      }
    }
    
    return {
      propagated: true,
      delta,
      modifiedNodes: modified.size,
      signalFlipped,
    };
  } catch (error) {
    logger.error(`[TA→Propagation] Error processing ${update.symbol}:`, error);
    return {
      propagated: false,
      delta: null,
      modifiedNodes: 0,
      signalFlipped: false,
    };
  }
}

/**
 * Batch process multiple TA updates
 */
export async function batchProcessTAUpdates(updates: TAUpdate[]): Promise<{
  totalProcessed: number;
  totalPropagated: number;
  totalSignalFlips: number;
  totalModifiedNodes: number;
}> {
  let totalPropagated = 0;
  let totalSignalFlips = 0;
  let totalModifiedNodes = 0;
  
  for (const update of updates) {
    const result = await processTAUpdate(update);
    if (result.propagated) {
      totalPropagated++;
      totalModifiedNodes += result.modifiedNodes;
      if (result.signalFlipped) {
        totalSignalFlips++;
      }
    }
  }
  
  return {
    totalProcessed: updates.length,
    totalPropagated,
    totalSignalFlips,
    totalModifiedNodes,
  };
}

export const technicalAnalysisPropagationAdapter = {
  onUpdate: processTAUpdate,
  onBatchUpdate: batchProcessTAUpdates,
  thresholds: SIGNAL_THRESHOLDS,
};

export default technicalAnalysisPropagationAdapter;
