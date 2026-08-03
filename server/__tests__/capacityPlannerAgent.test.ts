import { describe, expect, it } from 'vitest';
import { CapacityPlannerAgent } from '../agents/capacityPlannerAgent';

describe('CapacityPlannerAgent', () => {
  it('derives a recent call rate from cumulative counters instead of treating them as a full-window total', () => {
    const agent = new CapacityPlannerAgent('http://localhost:5000', { pollInterval: 600_000 });
    const now = Date.now();

    const previousSnapshot = {
      metrics: {
        timestamp: new Date(now - 10 * 60 * 1000),
        totalCalls: 100,
        avgLatency: 120,
        errorCount: 0,
        errorRate: 0,
        cpuPressure: 0,
        memoryPressure: 0,
        queuePressure: 0,
        workerSaturation: 0,
        eventLoopLagMs: 0,
        endpointCount: 1,
        hotEndpointCount: 0,
        bottleneckCount: 0,
      },
      assessment: {
        healthState: 'healthy' as const,
        healthScore: 100,
        trend: 'stable' as const,
        confidence: 1,
        saturationScore: 0,
      },
      hotEndpoints: [],
      bottlenecks: [],
    };

    const currentSnapshot = {
      ...previousSnapshot,
      metrics: {
        ...previousSnapshot.metrics,
        timestamp: new Date(now),
        totalCalls: 1000,
      },
    };

    (agent as any).capacitySnapshots = [previousSnapshot, currentSnapshot];

    const trend = agent.getUtilizationTrend(1);

    expect(trend.avgCallRate).toBe(90);
    expect(trend.peakCallRate).toBe(90);
    expect(trend.trend).toBe('increasing');
  });
});
