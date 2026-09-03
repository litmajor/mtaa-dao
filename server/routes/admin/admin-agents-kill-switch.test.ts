import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const agentStatusServiceMock = vi.hoisted(() => ({
  getAllAgentsWithStatus: vi.fn(),
  getAgent: vi.fn(),
  deactivateAgent: vi.fn(),
  activateAgent: vi.fn(),
  getAgentStateHistory: vi.fn(),
}));

vi.mock('../../middleware/auth', () => ({
  authenticateToken: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/rbac', () => ({
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../services/agentStatusService', () => ({
  agentStatusService: agentStatusServiceMock,
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

import adminAgentsKillSwitchRouter from './admin-agents-kill-switch';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { user?: { id: string; role: string; roles: string[] } }).user = { id: 'admin-1', role: 'super_admin', roles: ['super_admin'] };
    next();
  });
  app.use('/api/admin/agents', adminAgentsKillSwitchRouter);
  return app;
}

describe('admin agent kill-switch routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires reason length to be at least 10 characters before deactivating', async () => {
    const response = await request(createApp())
      .post('/api/admin/agents/agent-1/kill-switch')
      .send({ reason: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Intent confirmation required');
    expect(agentStatusServiceMock.deactivateAgent).not.toHaveBeenCalled();
  });

  it('enforces page bounds and passes sanitized pagination values to the history query', async () => {
    agentStatusServiceMock.getAgentStateHistory.mockResolvedValue({ total: 1, items: [] });

    const response = await request(createApp())
      .get('/api/admin/agents/agent-1/history?limit=999999&skip=-5');

    expect(response.status).toBe(200);
    expect(agentStatusServiceMock.getAgentStateHistory).toHaveBeenCalledWith('agent-1', 100, 0);
  });
});
