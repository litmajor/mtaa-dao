import { describe, expect, it } from 'vitest';
import { PerformanceOptimizerAgent } from '../agents/performanceOptimizerAgent';

describe('PerformanceOptimizerAgent', () => {
  it('recreates the singleton-backed instance when a new base URL is supplied', () => {
    const first = new PerformanceOptimizerAgent('http://localhost:3000');
    const second = new PerformanceOptimizerAgent('http://localhost:4000');

    expect(second).not.toBe(first);
    expect((second as unknown as { baseUrl: string }).baseUrl).toBe('http://localhost:4000');
  });

  it('emits a scale-down action when latency has recovered after prior scaling', async () => {
    const agent = new PerformanceOptimizerAgent('http://localhost:3000');
    const endpoint = 'GET /recovered';
    const now = new Date();

    (agent as unknown as { activeScalings: Map<string, number> }).activeScalings.set(endpoint, 2);
    (agent as unknown as { slowEndpoints: Map<string, Array<{ avgLatency: number; p99Latency: number; callCount: number; errorRate: number; timestamp: Date; path: string; method: string }>> }).slowEndpoints.set(endpoint, [
      { avgLatency: 1400, p99Latency: 3000, callCount: 60000, errorRate: 2, timestamp: new Date(now.getTime() - 10 * 60_000), path: '/recovered', method: 'GET' },
      { avgLatency: 1300, p99Latency: 2800, callCount: 58000, errorRate: 1.5, timestamp: new Date(now.getTime() - 5 * 60_000), path: '/recovered', method: 'GET' },
      { avgLatency: 700, p99Latency: 1500, callCount: 50000, errorRate: 0.5, timestamp: now, path: '/recovered', method: 'GET' },
    ]);

    const action = await (agent as unknown as { optimizeEndpoint(endpoint: string, snapshot: { avgLatency: number; p99Latency: number; callCount: number; errorRate: number; timestamp: Date; path: string; method: string }): Promise<{ action: string } | null> }).optimizeEndpoint(endpoint, {
      avgLatency: 700,
      p99Latency: 1500,
      callCount: 50000,
      errorRate: 0.5,
      timestamp: now,
      path: '/recovered',
      method: 'GET',
    });

    expect(action?.action).toBe('scale_down');
  });
});
