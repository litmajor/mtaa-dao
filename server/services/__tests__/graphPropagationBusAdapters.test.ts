import { describe, it, expect, beforeEach } from 'vitest';
import { graphPropagationBus } from '../graphPropagationBus';
import { graphPropagationEngine } from '../graphPropagationEngine';

describe('graphPropagationBus adapters integration', () => {
  beforeEach(() => {
    // reset listeners
    graphPropagationBus.removeAllListeners();
    // ensure engine is initialized
    // initialize with empty graph to enable propagation in tests
    graphPropagationEngine.initializeGraph([], []);
  });

  it('should allow adapters to emit volatility_change and engine to handle it', () => {
    const calls: any[] = [];
    graphPropagationBus.on('volatility_change', (symbol: string, prev: number, curr: number) => {
      calls.push({ symbol, prev, curr });
      // simulate engine propagation call
      graphPropagationEngine.propagate({
        source: symbol,
        type: 'volatility',
        magnitude: curr - prev,
        timestamp: Date.now(),
      } as any);
    });

    graphPropagationBus.emit('volatility_change', 'TEST-USD', 0.1, 0.5);

    expect(calls.length).toBe(1);
    expect(calls[0].symbol).toBe('TEST-USD');
  });

  it('should fallback to direct propagate when no listeners', () => {
    // Ensure no listeners
    graphPropagationBus.removeAllListeners('signal_change');

    const result = graphPropagationEngine.propagate({
      source: 'FOO',
      type: 'signal',
      magnitude: 1,
      timestamp: Date.now(),
    } as any);

    // Should return a Map even with no graph nodes
    expect(result).toBeInstanceOf(Map);
  });
});
