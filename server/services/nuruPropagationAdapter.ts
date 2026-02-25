/**
 * Graph Propagation Engine → NURU (Capital Decision Layer) Adapter
 * 
 * NURU reads propagated node states and makes capital decisions
 * Input: Modified nodes from propagation engine
 * Output: Allocation decisions, rebalancing triggers
 */

import { logger } from '../utils/logger';
import { graphPropagationEngine, GraphNode } from './graphPropagationEngine';

export interface AllocationDecision {
  nodeId: string;
  nodeType: string;
  currentAllocation: number;
  recommendedAllocation: number;
  adjustmentPercent: number;
  reason: string;
  confidence: number;
  riskScore: number;
}

export interface TreasuryRiskAssessment {
  timestamp: number;
  totalNodes: number;
  highRiskNodes: number;
  mediumRiskNodes: number;
  lowRiskNodes: number;
  averagePropagatedRiskScore: number;
  criticalAlerts: string[];
  recommendations: string[];
}

/**
 * Risk scoring thresholds
 */
export const ALLOCATION_THRESHOLDS = {
  criticalRisk: 0.75,      // > 75% = critical, reduce by 50%
  highRisk: 0.6,           // 60-75% = high, reduce by 30%
  mediumRisk: 0.4,         // 40-60% = medium, monitor
  lowRisk: 0.2,            // < 40% = low, consider increasing
  allocationMinimum: 0.01, // minimum allocation 1%
  allocationMaximum: 0.3,  // maximum allocation 30%
};

/**
 * Score a node's risk based on propagationState
 */
export function scoreNodeRisk(node: GraphNode): number {
  const state = node.propagationState;
  
  // Risk components (0-1 each):
  // 1. Volatility risk (20%)
  const volatilityRisk = state.volatilityScore * 0.2;
  
  // 2. Propagated systemic risk (30%)
  const systemicRisk = state.propagatedRiskScore * 0.3;
  
  // 3. Liquidity risk (15%)
  const liquidityRisk = (1 - state.liquidityScore) * 0.15;
  
  // 4. Structural risk (20%)
  const structuralRisk = (state.depegRisk + state.counterpartyRisk) / 2 * 0.2;
  
  // 5. Causality/contagion risk (15%)
  const contagionRisk = state.causalityRisk * 0.15;
  
  const totalRisk = 
    volatilityRisk + 
    systemicRisk + 
    liquidityRisk + 
    structuralRisk + 
    contagionRisk;
  
  return Math.min(totalRisk, 1.0);
}

/**
 * Score signal confidence (how much to trust it)
 */
export function scoreSignalConfidence(node: GraphNode): number {
  const state = node.propagationState;
  
  // Confidence reduced by:
  // - Data staleness
  // - Low signal confidence
  // - Conflicting signals
  
  const dataFreshness = state.dataFreshness; // 1.0 = fresh
  const signalConfidence = state.signalConfidence;
  const signalWeight = state.signalWeight;
  
  // Weighted combination
  const combined = 
    (dataFreshness * 0.3 +
     signalConfidence * 0.4 +
     signalWeight * 0.3);
  
  return Math.min(combined, 1.0);
}

/**
 * Generate allocation decision for a node
 */
export function generateAllocationDecision(
  node: GraphNode,
  currentAllocation: number,
  targetAllocation: number
): AllocationDecision {
  const riskScore = scoreNodeRisk(node);
  const confidence = scoreSignalConfidence(node);
  
  let recommendedAllocation = currentAllocation;
  let adjustmentPercent = 0;
  let reason = '';
  
  // Adjust based on risk score
  if (riskScore >= ALLOCATION_THRESHOLDS.criticalRisk) {
    // Critical risk: cut by half
    recommendedAllocation = currentAllocation * 0.5;
    adjustmentPercent = -50;
    reason = `CRITICAL RISK: ${(riskScore * 100).toFixed(0)}% (vol+systemic+contagion)`;
  } else if (riskScore >= ALLOCATION_THRESHOLDS.highRisk) {
    // High risk: reduce 30%
    recommendedAllocation = currentAllocation * 0.7;
    adjustmentPercent = -30;
    reason = `HIGH RISK: ${(riskScore * 100).toFixed(0)}% (tighten exposure)`;
  } else if (riskScore >= ALLOCATION_THRESHOLDS.mediumRisk) {
    // Medium risk: maintain or slight reduction
    recommendedAllocation = currentAllocation * 0.9;
    adjustmentPercent = -10;
    reason = `MEDIUM RISK: ${(riskScore * 100).toFixed(0)}% (monitor closely)`;
  } else if (riskScore < ALLOCATION_THRESHOLDS.lowRisk && node.propagationState.signalBias === 'bullish') {
    // Low risk + bullish signal: consider increasing
    recommendedAllocation = Math.min(
      currentAllocation * 1.2,
      ALLOCATION_THRESHOLDS.allocationMaximum
    );
    adjustmentPercent = 20;
    reason = `LOW RISK + BULLISH: ${(riskScore * 100).toFixed(0)}% + ${node.propagationState.signalBias.toUpperCase()}`;
  } else {
    // Maintain
    adjustmentPercent = 0;
    reason = `STABLE: ${(riskScore * 100).toFixed(0)}% risk, maintain`;
  }
  
  // Apply allocation bounds
  recommendedAllocation = Math.max(
    ALLOCATION_THRESHOLDS.allocationMinimum,
    Math.min(recommendedAllocation, ALLOCATION_THRESHOLDS.allocationMaximum)
  );
  
  return {
    nodeId: node.nodeId,
    nodeType: node.nodeType,
    currentAllocation,
    recommendedAllocation,
    adjustmentPercent,
    reason,
    confidence,
    riskScore,
  };
}

/**
 * Generate treasury-wide risk assessment
 */
export function assessTreasuryRisk(
  nodes: GraphNode[],
  currentAllocations: Map<string, number>
): TreasuryRiskAssessment {
  const criticalAlerts: string[] = [];
  const recommendations: string[] = [];
  
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  let totalRiskScore = 0;
  
  for (const node of nodes) {
    const riskScore = scoreNodeRisk(node);
    totalRiskScore += riskScore;
    
    if (riskScore >= ALLOCATION_THRESHOLDS.criticalRisk) {
      highRiskCount++;
      criticalAlerts.push(
        `CRITICAL: ${node.nodeId} risk=${(riskScore * 100).toFixed(0)}% (volatility=${(node.propagationState.volatilityScore * 100).toFixed(0)}%, systemic=${(node.propagationState.propagatedRiskScore * 100).toFixed(0)}%)`
      );
    } else if (riskScore >= ALLOCATION_THRESHOLDS.highRisk) {
      highRiskCount++;
    } else if (riskScore >= ALLOCATION_THRESHOLDS.mediumRisk) {
      mediumRiskCount++;
    } else {
      lowRiskCount++;
    }
  }
  
  const avgRiskScore = nodes.length > 0 ? totalRiskScore / nodes.length : 0;
  
  // Generate recommendations
  if (avgRiskScore > 0.6) {
    recommendations.push('⚠️ TREASURY RISK ELEVATED: Consider de-risking portfolio');
  }
  if (highRiskCount > nodes.length * 0.3) {
    recommendations.push(`🔴 ${highRiskCount} nodes in high-risk state: Prepare rebalancing');`);
  }
  if (criticalAlerts.length > 0) {
    recommendations.push('🚨 CRITICAL ALERTS PRESENT: Immediate review required');
  }
  
  // Check for cascade patterns
  const highVolatilityNodes = nodes.filter(n => n.propagationState.volatilityScore > 0.7);
  if (highVolatilityNodes.length > nodes.length * 0.4) {
    recommendations.push('📊 HIGH VOLATILITY CLUSTER: Correlated assets may cascade');
  }
  
  return {
    timestamp: Date.now(),
    totalNodes: nodes.length,
    highRiskNodes: highRiskCount,
    mediumRiskNodes: mediumRiskCount,
    lowRiskNodes: lowRiskCount,
    averagePropagatedRiskScore: avgRiskScore,
    criticalAlerts,
    recommendations,
  };
}

/**
 * Detect if rebalancing is needed
 */
export function shouldRebalance(
  decisions: AllocationDecision[],
  thresholdPercent: number = 15
): boolean {
  const significantAdjustments = decisions.filter(
    d => Math.abs(d.adjustmentPercent) >= thresholdPercent
  );
  
  return significantAdjustments.length > 0;
}

/**
 * NURU decision cycle: Read propagated state, generate decisions
 */
export function executeNURUDecisionCycle(
  currentAllocations?: Map<string, number>
): {
  assessment: TreasuryRiskAssessment;
  decisions: AllocationDecision[];
  shouldRebalance: boolean;
  summary: string;
} {
  const nodes = graphPropagationEngine.getAllNodes();
  
  // Default allocations if not provided
  if (!currentAllocations) {
    currentAllocations = new Map(
      nodes.map(n => [n.nodeId, 0.05]) // 5% per node, adjust as needed
    );
  }
  
  // Assess treasury risk
  const assessment = assessTreasuryRisk(nodes, currentAllocations);
  
  // Generate allocation decisions
  const decisions: AllocationDecision[] = [];
  for (const node of nodes) {
    const current = currentAllocations.get(node.nodeId) || 0.05;
    const target = 0.05; // neutral target
    const decision = generateAllocationDecision(node, current, target);
    decisions.push(decision);
  }
  
  // Check if rebalancing needed
  const rebalancingNeeded = shouldRebalance(decisions);
  
  // Summary
  let summary = '';
  if (assessment.criticalAlerts.length > 0) {
    summary = `🚨 ${assessment.criticalAlerts.length} critical alerts`;
  } else if (assessment.highRiskNodes > 0) {
    summary = `⚠️  ${assessment.highRiskNodes} high-risk nodes`;
  } else {
    summary = '✅ Portfolio risk normal';
  }
  
  logger.info(`[NURU DECISION] ${summary} | Rebalance: ${rebalancingNeeded ? 'YES' : 'NO'}`);
  
  return {
    assessment,
    decisions,
    shouldRebalance: rebalancingNeeded,
    summary,
  };
}

export const nuruPropagationAdapter = {
  scoreNodeRisk,
  scoreSignalConfidence,
  generateAllocationDecision,
  assessTreasuryRisk,
  shouldRebalance,
  executeDecisionCycle: executeNURUDecisionCycle,
};

export default nuruPropagationAdapter;
