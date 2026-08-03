import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSystemLogMock = vi.fn();
const appendFileSyncMock = vi.fn();
const existsSyncMock = vi.fn(() => true);
const mkdirSyncMock = vi.fn();
const winstonLogMock = vi.fn();

vi.mock('winston', () => ({
  createLogger: vi.fn(() => ({
    log: winstonLogMock,
    add: vi.fn(),
  })),
  format: {
    combine: vi.fn((...parts: unknown[]) => parts),
    timestamp: vi.fn(() => 'timestamp'),
    errors: vi.fn(() => 'errors'),
    json: vi.fn(() => 'json'),
    colorize: vi.fn(() => 'colorize'),
    simple: vi.fn(() => 'simple'),
    printf: vi.fn((formatter: (...args: any[]) => string) => formatter),
  },
  transports: {
    Console: class {},
    File: class {},
  },
}));

vi.mock('../../shared/config.ts', () => ({
  env: {
    LOG_LEVEL: 'info',
    NODE_ENV: 'test',
    ENABLE_REQUEST_LOGGING: 'true',
  },
  isDevelopment: false,
  isProduction: false,
}));

vi.mock('fs', () => ({
  default: {
    existsSync: existsSyncMock,
    mkdirSync: mkdirSyncMock,
    appendFileSync: appendFileSyncMock,
  },
}));

vi.mock('../storage.ts', () => ({
  storage: {
    createSystemLog: createSystemLogMock,
  },
}));

describe('logger infrastructure safeguards', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createSystemLogMock.mockResolvedValue(undefined);
    existsSyncMock.mockReturnValue(true);
    mkdirSyncMock.mockImplementation(() => undefined);
    appendFileSyncMock.mockImplementation(() => undefined);
    (globalThis as typeof globalThis & { isServerStarting?: boolean }).isServerStarting = false;
    (vi as any).unstubAllEnvs?.();
  });

  it('skips DB writes for info logs during startup', async () => {
    const { Logger } = await import('../utils/logger');
    const instance = new Logger('service-a');

    (globalThis as typeof globalThis & { isServerStarting?: boolean }).isServerStarting = true;
    instance.info('bootstrap');
    await Promise.resolve();

    expect(createSystemLogMock).not.toHaveBeenCalled();
    expect(winstonLogMock).toHaveBeenCalled();
  });

  it('opens the circuit and writes a fallback log on a critical DB failure', async () => {
    createSystemLogMock.mockRejectedValue(new Error('connection terminated'));

    const { Logger } = await import('../utils/logger');
    const instance = new Logger('service-b');

    instance.error('db failed', new Error('pool exhausted'));

    await vi.waitFor(() => {
      expect(appendFileSyncMock).toHaveBeenCalled();
    });

    expect((Logger as any).dbLoggingDisabledUntil).toBeGreaterThan(Date.now());
  });

  it('rate-limits DB logging once the threshold is hit', async () => {
    const { Logger } = await import('../utils/logger');
    (Logger as any).dbLogCount = 20;
    (Logger as any).dbLogWindowStart = Date.now();
    (Logger as any).dbLoggingDisabledUntil = 0;

    const instance = new Logger('service-c');
    instance.info('burst');
    await Promise.resolve();

    expect(createSystemLogMock).not.toHaveBeenCalled();
    expect((Logger as any).dbLoggingDisabledUntil).toBeGreaterThan(Date.now());
  });

  it('redacts sensitive payload fields before they reach the logger sink', async () => {
    const { logger } = await import('../utils/logger');

    logger.info('login attempt', {
      body: {
        email: 'player@example.com',
        password: 'super-secret',
        nested: {
          accessToken: 'abc123',
          safe: 'ok',
        },
      },
    });

    await Promise.resolve();

    expect(winstonLogMock).toHaveBeenCalled();
    const payload = winstonLogMock.mock.calls[0]?.[2];
    expect(payload.body.password).toBe('[REDACTED_FOR_SECURITY]');
    expect(payload.body.nested.accessToken).toBe('[REDACTED_FOR_SECURITY]');
    expect(payload.body.email).toBe('player@example.com');
    expect(payload.body.nested.safe).toBe('ok');
  });
});
