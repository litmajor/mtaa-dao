
import request from 'supertest';
import express from 'express';
import healthRouter from '../../server/routes/health';

const app = express();
app.use('/api/health', healthRouter);

describe('Health Check Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        environment: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });

  describe('GET /api/health/detailed', () => {
    it('should return detailed health status', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        timestamp: expect.any(String),
        checks: {
          database: expect.objectContaining({
            status: expect.stringMatching(/^(pass|warn|fail)$/),
            responseTime: expect.any(Number)
          }),
          memory: expect.objectContaining({
            status: expect.stringMatching(/^(pass|warn|fail)$/),
            responseTime: expect.any(Number)
          })
        },
        metrics: expect.objectContaining({
          healthScore: expect.any(Number),
          responseTime: expect.any(Number)
        })
      });
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/api/health/ready');

      expect(response.body).toMatchObject({
        ready: expect.any(Boolean),
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /api/health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/api/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        alive: true,
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });
});
