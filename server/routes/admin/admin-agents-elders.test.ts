import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  getElderById: vi.fn(),
  updateElder: vi.fn(),
  getAgentById: vi.fn(),
  updateAgent: vi.fn(),
  getSystemConfiguration: vi.fn(),
  updateSystemConfiguration: vi.fn(),
  ensureSystemConfiguration: vi.fn(),
  getAllElders: vi.fn(),
  getAllAgents: vi.fn(),
}));

vi.mock('../../middleware/auth', () => ({
  authenticateToken: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/rbac', () => ({
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/rateLimit', () => ({
  rateLimitPerUser: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../services/auditConsolidated', () => ({
  AuditEventType: {
    ADMIN_USER_LIST_ACCESSED: 'ADMIN_USER_LIST_ACCESSED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    ADMIN_SETTINGS_CHANGED: 'ADMIN_SETTINGS_CHANGED',
  },
  logConsolidatedAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/auditLogging', () => ({
  AuditEventType: { ADMIN_SETTINGS_CHANGED: 'ADMIN_SETTINGS_CHANGED' },
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  Logger: {
    getLogger: () => ({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    }),
  },
}));

vi.mock('../../db/services/agentsEldersService', () => serviceMocks);
vi.mock('../../middleware/websocket-event-emitter', () => ({
  getEventEmitter: () => ({
    emitConfigChange: vi.fn(),
    emitSystemEvent: vi.fn(),
  }),
}));

import adminAgentsEldersRouter from './admin-agents-elders';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { user?: unknown }).user = { id: 'admin-1', roles: ['super_admin'] };
    next();
  });
  app.use('/admin', adminAgentsEldersRouter);
  return app;
}

describe('admin agents and elders configuration routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-string scout updateFrequency without throwing', async () => {
    serviceMocks.getAgentById.mockResolvedValue({
      id: 'agent-1',
      type: 'Scout',
      configuration: {},
    });

    const response = await request(createApp())
      .put('/admin/config/agents/agent-1')
      .send({ configuration: { enabled: true, updateInterval: 100, logLevel: 'info', updateFrequency: {} } });

    expect(response.status).toBe(400);
    expect(response.body.details).toContain('Update frequency must be in format: 5m, 1h, 1d');
    expect(serviceMocks.updateAgent).not.toHaveBeenCalled();
  });

  it('normalizes agent type casing before applying type-specific validation', async () => {
    serviceMocks.getAgentById.mockResolvedValue({
      id: 'agent-1',
      type: 'Analyzer',
      configuration: {},
    });

    const response = await request(createApp())
      .put('/admin/config/agents/agent-1')
      .send({ configuration: { enabled: true, updateInterval: 100, logLevel: 'info', analysisDepth: 'invalid', timeWindow: 1 } });

    expect(response.status).toBe(400);
    expect(response.body.details).toContain('analysisDepth must be one of: shallow, standard, deep');
  });

  it('reports unsupported bulk item types as request validation errors', async () => {
    const response = await request(createApp())
      .put('/admin/config/bulk')
      .send({ updates: [{ id: 'agent-1', type: 'system', configuration: {} }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid bulk update payload');
    expect(serviceMocks.updateAgent).not.toHaveBeenCalled();
  });

  it('returns partial bulk failure details and records the audit summary', async () => {
    serviceMocks.getElderById.mockResolvedValue({ id: 'elder-1', name: 'Kaizen', type: 'KAIZEN', configuration: {} });
    serviceMocks.getAgentById.mockResolvedValue(null);
    serviceMocks.updateElder.mockResolvedValue({ id: 'elder-1' });

    const response = await request(createApp())
      .put('/admin/config/bulk')
      .send({ updates: [
        { id: 'elder-1', type: 'elder', configuration: { enabled: true, logLevel: 'info', optimizationTarget: 'performance', threshold: 0.5 } },
        { id: 'agent-1', type: 'agent', configuration: { enabled: true } },
      ] });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.results.successful).toBe(1);
    expect(response.body.results.failed).toBe(1);
    expect(response.body.results.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'agent-1', type: 'agent', error: 'Agent not found' }),
    ]));
    expect(serviceMocks.updateElder).toHaveBeenCalledWith('elder-1', { configuration: { enabled: true, logLevel: 'info', optimizationTarget: 'performance', threshold: 0.5 } });
  });
});
