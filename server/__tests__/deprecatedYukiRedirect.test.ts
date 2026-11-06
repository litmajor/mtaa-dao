import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { deprecatedYukiRedirect } from '../middleware/deprecatedYukiRedirect';

describe('deprecated Yuki API redirect', () => {
  const app = express();
  app.use('/api/yuki', deprecatedYukiRedirect);
  app.use((_req, res) => res.sendStatus(404));

  it('preserves the full suffix and query string when redirecting supported methods', async () => {
    const response = await request(app).get('/api/yuki/market/prices?symbols=BTC');

    expect(response.status).toBe(307);
    expect(response.headers.location).toBe('/api/v1/yuki/market/prices?symbols=BTC');
    expect(response.headers['x-redirect-to']).toBe(response.headers.location);
    expect(response.body.newLocation).toBe(response.headers.location);
  });

  it('does not redirect TRACE requests', async () => {
    const response = await request(app).trace('/api/yuki/market/prices');

    expect(response.status).toBe(404);
    expect(response.headers.location).toBeUndefined();
  });
});
