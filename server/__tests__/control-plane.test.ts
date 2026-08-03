import express from 'express';
import request from 'supertest';
import controlPlaneRouter from '../control-plane';

describe('control plane module', () => {
  it('toggles maintenance mode and exposes a status snapshot', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/control-plane', controlPlaneRouter);

    const toggleResponse = await request(app)
      .post('/api/control-plane/kill-switch')
      .send({ enabled: true, reason: 'test' });

    expect(toggleResponse.status).toBe(200);
    expect(toggleResponse.body.enabled).toBe(true);
    expect(toggleResponse.body.reason).toBe('test');

    const statusResponse = await request(app).get('/api/control-plane/kill-switch');
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.enabled).toBe(true);
  });
});
