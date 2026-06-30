import { describe, it, expect } from 'vitest';

import {
  PropagationScorer,
  StateDispatcher,
  initializeNode,
  GraphEdge,
  PropagationDelta,
} from '../graphPropagationEngine';

describe('GraphPropagationEngine basics', () => {
  it('computeCascades should skip missing target nodes without throwing', () => {
    const nodeA = initializeNode('A', 'asset');

    const edge: GraphEdge = {
      from: 'A',
      to: 'B', // B does not exist in node list
      edgeType: 'correlates_with',
      weight: 0.8,
      directional: true,
      typeMultiplier: 1,
      metadata: { correlation: 0.9 },
      updatedAt: Date.now(),
    };

    const scorer = new PropagationScorer([nodeA], [edge]);

    const delta: PropagationDelta = {
      nodeId: 'A',
      deltaType: 'volatility',
      previousValue: 0.1,
      newValue: 0.5,
      magnitude: 0.6,
      threshold: 0.3,
      timestamp: Date.now(),
    };

    const cascades = scorer.computeCascades(delta);

    expect(cascades).toBeInstanceOf(Array);
    expect(cascades.length).toBe(0);
  });

  it('commitUpdates should recompute propagatedRiskScore', () => {
    const node = initializeNode('X', 'asset');
    node.propagationState.causalityRisk = 0.5;
    node.propagationState.depegRisk = 0.2;
    node.propagationState.counterpartyRisk = 0.4;
    node.propagationState.volatilityScore = 0.7;
    node.propagationState.liquidityScore = 0.6;

    const dispatcher = new StateDispatcher([node]);

    const updates = [
      {
        nodeId: 'X',
        field: 'causalityRisk' as any,
        currentValue: 0.5,
        proposedValue: 0.8,
        reason: 'test',
        confidence: 1,
      },
    ];

    const modified = dispatcher.commitUpdates(updates as any);

    const updated = modified.get('X');
    expect(updated).toBeDefined();

    const prs = updated!.propagationState.propagatedRiskScore;

    // expected = 0.35*0.8 + 0.25*0.2 + 0.2*0.4 + 0.15*0.7 + 0.05*(1-0.6) = 0.535
    expect(prs).toBeCloseTo(0.535, 3);
  });
});
