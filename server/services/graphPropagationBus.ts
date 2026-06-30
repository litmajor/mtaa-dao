import { EventEmitter } from 'events';

/**
 * Central Event Bus for Graph Propagation Integration
 * Replaces fragile globalThis hook registrations with an explicit emitter
 */
export const graphPropagationBus = new EventEmitter();

// Event types:
// - "volatility_change": (symbol, previousVolatility, currentVolatility)
// - "liquidity_change": (symbol, previousScore, currentScore)
// - "signal_change": (symbol, previousBias, currentBias, confidence)
// - "regime_change": (symbol, regime)
// - "nuru_cycle": () => void

export type GraphPropagationEvents =
  | 'volatility_change'
  | 'liquidity_change'
  | 'signal_change'
  | 'regime_change'
  | 'nuru_cycle'
  | 'capital_decision';

export default graphPropagationBus;
