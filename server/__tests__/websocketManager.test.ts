import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'http';
import WebSocketManager from '../websocket/websocket';
import { getRedisSubscriptionManager } from '../services/redisSubscriptionManager';

vi.mock('../services/redisSubscriptionManager', () => ({
  getRedisSubscriptionManager: vi.fn(),
}));

vi.mock('../middleware/socketAuth', () => ({
  default: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('WebSocketManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defers Redis subscription manager initialization until a room subscription is requested', () => {
    const httpServer = createServer();
    const manager = new WebSocketManager(httpServer as any);

    expect(getRedisSubscriptionManager).not.toHaveBeenCalled();

    manager.close();
    httpServer.close();
  });
});
