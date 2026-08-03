import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectMock = vi.fn();
const createClientMock = vi.fn(() => ({
  isOpen: false,
  connect: connectMock,
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  quit: vi.fn(),
  config: vi.fn(),
  ping: vi.fn(),
}));

vi.mock('redis', () => ({
  createClient: createClientMock,
}));

describe('redisConnectionManager', () => {
  beforeEach(() => {
    vi.resetModules();
    connectMock.mockClear();
    createClientMock.mockClear();
  });

  it('starts the underlying Redis client connection as soon as it is created', async () => {
    const { getRedisInstance } = await import('../config/redisConnectionManager');

    const client = getRedisInstance();

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(client).toBeDefined();
  });
});
