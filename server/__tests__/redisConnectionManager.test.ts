import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock config FIRST
vi.mock('../../shared/config.ts', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-this-is-long-enough-for-32-chars-requirement',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-this-is-long-enough-for-32-chars',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    NODE_ENV: 'test',
  },
}));

// Mock logger
vi.mock('../utils/logger', () => {
  class MockLogger {
    debug = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    info = vi.fn();
  }
  const defaultLogger = new MockLogger();
  return { 
    Logger: MockLogger,
    logger: defaultLogger,
    requestLogger: vi.fn(),
  };
});

const connectMock = vi.fn(() => Promise.resolve());
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
