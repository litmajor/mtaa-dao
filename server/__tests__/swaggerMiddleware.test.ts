import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('swagger-ui-express', () => ({
  default: {
    serve: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    setup: () => (_req: express.Request, res: express.Response) => res.send('Swagger UI'),
  },
}));

vi.mock('../config/swagger', () => ({
  swaggerSpec: { openapi: '3.0.0', paths: {} },
}));

import swaggerMiddleware from '../middleware/swaggerMiddleware';

describe('Swagger API documentation routes', () => {
  const app = express();
  app.use('/api-docs', swaggerMiddleware);

  it('serves the UI and OpenAPI document beneath the advertised prefix', async () => {
    const ui = await request(app).get('/api-docs/');
    const spec = await request(app).get('/api-docs/openapi.json');

    expect(ui.status).toBe(200);
    expect(ui.text).toBe('Swagger UI');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.0.0');
  });
});
