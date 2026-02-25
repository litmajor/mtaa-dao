/**
 * Graph Propagation Integration Hooks
 * 
 * Wires OHLCV and TA services into the graph propagation engine
 * This module should be loaded during server startup to activate event propagation
 */

import { logger } from '../utils/logger';
import { graphPropagationEngine, PropagationDelta } from './graphPropagationEngine';
import { propagationMonitoringService } from './propagationMonitoringService';

/**
 * Initialize graph propagation hooks
 * Call this during server startup to activate event propagation
 */
export async function initializeGraphPropagationHooks(): Promise<void> {
  try {
    logger.info('⚡ Initializing graph propagation integration hooks...');
    
    // Hook 1: OHLCV Service Integration
    // This hook is called when OHLCV volatility crosses threshold
    setupOHLCVHooks();
    
    // Hook 2: Technical Analysis Service Integration
    // This hook is called when signal bias changes
    setupTAHooks();
    
    // Hook 3: NURU Decision Loop
    // This hook reads propagation state and makes capital decisions
    setupNURUHooks();
    
    logger.info('✅ All graph propagation hooks initialized');
  } catch (error) {
    logger.error('Failed to initialize graph propagation hooks:', error);
    throw error;
  }
}

/**
 * OHLCV Service Hooks
 * 
 * Triggered when:
 * - Volatility crosses threshold
 * - Liquidity changes significantly
 * - Trend regime changes
 */
function setupOHLCVHooks(): void {
  // This would be integrated with the actual OHLCV service
  // we intergrate the service below

  
  const onVolatilityChange = async (
    symbol: string,
    previousVolatility: number,
    currentVolatility: number
  ) => {
    try {
      const magnitude = Math.abs(currentVolatility - previousVolatility) / 
        Math.max(previousVolatility, 0.01);
      
      // Only propagate if change is > 20%
      if (magnitude < 0.2) return;
      
      const delta: PropagationDelta = {
        nodeId: symbol,
        deltaType: 'volatility',
        previousValue: previousVolatility,
        newValue: currentVolatility,
        magnitude: Math.min(magnitude, 1.0),
        threshold: 0.2,
        timestamp: Date.now(),
      };
      
      // Trigger propagation
      const modified = graphPropagationEngine.propagate(delta);
      
      logger.info(
        `📊 OHLCV propagation: ${symbol} volatility ${(magnitude * 100).toFixed(1)}% → ` +
        `${modified.size} nodes affected`
      );
      
      propagationMonitoringService.recordEvent({
        type: 'ohlcv_integrated',
        timestamp: Date.now(),
        nodeId: symbol,
        details: {
          deltaType: 'volatility',
          magnitude,
          cascadesCount: modified.size,
        },
        severity: 'info',
      });
    } catch (error) {
      logger.error(`Error propagating OHLCV change for ${symbol}:`, error);
    }
  };
  
  const onLiquidityChange = async (
    symbol: string,
    previousScore: number,
    currentScore: number
  ) => {
    try {
      const magnitude = Math.abs(currentScore - previousScore);
      
      // Only propagate if change is significant
      if (magnitude < 0.15) return;
      
      const delta: PropagationDelta = {
        nodeId: symbol,
        deltaType: 'liquidity',
        previousValue: previousScore,
        newValue: currentScore,
        magnitude: Math.min(magnitude, 1.0),
        threshold: 0.15,
        timestamp: Date.now(),
      };
      
      const modified = graphPropagationEngine.propagate(delta);
      
      logger.info(
        `💧 OHLCV propagation: ${symbol} liquidity change → ` +
        `${modified.size} nodes affected`
      );
    } catch (error) {
      logger.error(`Error propagating liquidity change for ${symbol}:`, error);
    }
  };
  
  // Export these for external use
  (globalThis as any).__graphPropagation = (globalThis as any).__graphPropagation || {};
  (globalThis as any).__graphPropagation.onVolatilityChange = onVolatilityChange;
  (globalThis as any).__graphPropagation.onLiquidityChange = onLiquidityChange;
  
  logger.info('✅ OHLCV hooks registered');
}

/**
 * Technical Analysis Service Hooks
 * 
 * Triggered when:
 * - Signal bias changes (bullish → bearish)
 * - Signal confidence changes significantly
 * - Regime shifts
 */
function setupTAHooks(): void {
  const onSignalChange = async (
    symbol: string,
    previousBias: 'bullish' | 'neutral' | 'bearish',
    currentBias: 'bullish' | 'neutral' | 'bearish',
    confidence: number
  ) => {
    try {
      // Only propagate if signal actually changed
      if (previousBias === currentBias) return;
      
      const delta: PropagationDelta = {
        nodeId: symbol,
        deltaType: 'signal',
        previousValue: previousBias,
        newValue: currentBias,
        magnitude: confidence * 0.8, // Confidence-weighted
        threshold: 0.5,
        timestamp: Date.now(),
      };
      
      const modified = graphPropagationEngine.propagate(delta);
      
      logger.info(
        `📈 TA propagation: ${symbol} signal ${previousBias} → ${currentBias} ` +
        `(confidence: ${(confidence * 100).toFixed(0)}%) → ${modified.size} nodes affected`
      );
      
      propagationMonitoringService.recordEvent({
        type: 'ta_integrated',
        timestamp: Date.now(),
        nodeId: symbol,
        details: {
          deltaType: 'signal',
          magnitude: confidence,
          cascadesCount: modified.size,
        },
        severity: 'info',
      });
    } catch (error) {
      logger.error(`Error propagating TA signal change for ${symbol}:`, error);
    }
  };
  
  const onRegimeChange = async (
    symbol: string,
    regime: 'low' | 'normal' | 'high' | 'extreme'
  ) => {
    try {
      const delta: PropagationDelta = {
        nodeId: symbol,
        deltaType: 'volatility',
        previousValue: 'unknown',
        newValue: regime,
        magnitude: 0.6,
        threshold: 0.5,
        timestamp: Date.now(),
      };
      
      const modified = graphPropagationEngine.propagate(delta);
      
      logger.info(
        `🔄 TA propagation: ${symbol} regime shift to ${regime} → ` +
        `${modified.size} nodes affected`
      );
    } catch (error) {
      logger.error(`Error propagating regime change for ${symbol}:`, error);
    }
  };
  
  // Export these for external use
  (globalThis as any).__graphPropagation = (globalThis as any).__graphPropagation || {};
  (globalThis as any).__graphPropagation.onSignalChange = onSignalChange;
  (globalThis as any).__graphPropagation.onRegimeChange = onRegimeChange;
  
  logger.info('✅ TA hooks registered');
}

/**
 * NURU Integration Hooks
 * 
 * Reads propagated state and makes capital allocation decisions
 */
function setupNURUHooks(): void {
  const onNURUDecisionCycle = async () => {
    try {
      const nodes = graphPropagationEngine.getAllNodes();
      
      // Calculate portfolio risk score
      const riskScores = nodes.map(n => n.propagationState.propagatedRiskScore);
      const avgRisk = riskScores.reduce((a, b) => a + b, 0) / Math.max(riskScores.length, 1);
      
      // Identify high-risk nodes
      const highRiskNodes = nodes.filter(n => n.propagationState.propagatedRiskScore > 0.6);
      
      // Would integrate with NURU to trigger rebalancing
      if (highRiskNodes.length > 0 && avgRisk > 0.5) {
        logger.info(`⚠️ NURU: High portfolio risk detected (avg: ${(avgRisk * 100).toFixed(1)}%)`);
        logger.info(`   ${highRiskNodes.length} high-risk nodes detected`);
        logger.info(`   Recommendation: Trigger rebalancing`);
        
        propagationMonitoringService.recordEvent({
          type: 'nuru_decision',
          timestamp: Date.now(),
          nodeId: 'portfolio',
          details: {
            deltaType: 'signal',
            magnitude: avgRisk,
            cascadesCount: highRiskNodes.length,
          },
          severity: 'warning',
        });
      }
    } catch (error) {
      logger.error('Error in NURU decision cycle:', error);
    }
  };
  
  const onCapitalDecision = async (
    decision: 'buy' | 'sell' | 'hold' | 'rebalance',
    symbol: string,
    confidence: number
  ) => {
    try {
      logger.info(
        `💰 NURU decision: ${decision.toUpperCase()} ${symbol} ` +
        `(confidence: ${(confidence * 100).toFixed(0)}%)`
      );
      
      propagationMonitoringService.recordEvent({
        type: 'nuru_decision',
        timestamp: Date.now(),
        nodeId: symbol,
        details: {
          decision,
          confidence,
          deltaType: 'signal',
        },
        severity: 'info',
      });
    } catch (error) {
      logger.error('Error recording capital decision:', error);
    }
  };
  
  // Export these for external use
  (globalThis as any).__graphPropagation = (globalThis as any).__graphPropagation || {};
  (globalThis as any).__graphPropagation.onNURUDecisionCycle = onNURUDecisionCycle;
  (globalThis as any).__graphPropagation.onCapitalDecision = onCapitalDecision;
  
  logger.info('✅ NURU hooks registered');
}

export {
  setupOHLCVHooks,
  setupTAHooks,
  setupNURUHooks,
};
