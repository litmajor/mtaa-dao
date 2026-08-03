import express from 'express';
import request from 'supertest';
import { createRequestLifecycleMiddleware, eventFabric } from '../event-fabric';

describe('event fabric request lifecycle middleware', () => {
  it('emits started and completed events for handled requests', async () => {
    const app = express();
    const seen: Array<{ event: string; path?: string; method?: string; statusCode?: number }> = [];

    const unsubscribeStarted = eventFabric.subscribe('server.request.started', (event) => {
      seen.push({ event: 'started', path: event.payload.path as string | undefined, method: event.payload.method as string | undefined });
    });

    const unsubscribeCompleted = eventFabric.subscribe('server.request.completed', (event) => {
      seen.push({ event: 'completed', path: event.payload.path as string | undefined, method: event.payload.method as string | undefined, statusCode: event.payload.statusCode as number | undefined });
    });

    app.use(createRequestLifecycleMiddleware());
    app.get('/health', (_req, res) => {
      res.status(204).end();
    });

    await request(app).get('/health');

    expect(seen.some((entry) => entry.event === 'started' && entry.path === '/health' && entry.method === 'GET')).toBe(true);
    expect(seen.some((entry) => entry.event === 'completed' && entry.path === '/health' && entry.method === 'GET' && entry.statusCode === 204)).toBe(true);

    unsubscribeStarted();
    unsubscribeCompleted();
  });
});
