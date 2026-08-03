import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { healthRegistry } from '../../core/consolidation/HealthRegistryConsolidation';
import healthRouter from '../health';

describe('health routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a critical fallback payload when the registry snapshot throws', async () => {
    vi.spyOn(healthRegistry, 'getSnapshot').mockImplementation(() => {
      throw new Error('registry unavailable');
    });

    const app = express();
    app.use('/api/health', healthRouter);

    const response = await request(app).get('/api/health/docs/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('critical');
    expect(response.body.unhealthyEndpoints).toBe(1);
    expect(response.body.totalEndpoints).toBe(1);
  });

  it('returns a zeroed summary payload when the registry snapshot throws', async () => {
    vi.spyOn(healthRegistry, 'getSnapshot').mockImplementation(() => {
      throw new Error('registry unavailable');
    });

    const app = express();
    app.use('/api/health', healthRouter);

    const response = await request(app).get('/api/health/docs/stats/summary');

    expect(response.status).toBe(200);
    expect(response.body.summary.totalEndpoints).toBe(0);
    expect(response.body.summary.totalCalls).toBe(0);
    expect(response.body.summary.healthyCount).toBe(0);
  });
});
