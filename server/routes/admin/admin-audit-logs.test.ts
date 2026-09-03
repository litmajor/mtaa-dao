import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditLoggingServiceMock = vi.hoisted(() => ({
  queryAuditLogs: vi.fn(),
  getActionDetails: vi.fn(),
  getActorActionLog: vi.fn(),
  getResourceActionLog: vi.fn(),
  getAuditStats: vi.fn(),
}));

vi.mock('../../middleware/rbac', () => ({
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../services/auditLoggingService', () => ({
  default: auditLoggingServiceMock,
}));

import adminAuditLogsRouter from './admin-audit-logs';

function createApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as express.Request & { user?: { id: string; role: string } }).user = { id: 'admin-1', role: 'super_admin' };
    next();
  });
  app.use('/api/admin/audit-logs', adminAuditLogsRouter);
  return app;
}

describe('admin audit logs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes summary stats before the generic log detail matcher', async () => {
    auditLoggingServiceMock.getAuditStats.mockResolvedValue({
      totalActions: 2,
      byActionType: {},
      byActor: {},
      byResult: { success: 2, failed: 0, partial: 0 },
      byCategory: {},
      successRate: 100,
      failureRate: 0,
    });

    const response = await request(createApp()).get('/api/admin/audit-logs/stats/period?since=7&until=0');

    expect(response.status).toBe(200);
    expect(auditLoggingServiceMock.getAuditStats).toHaveBeenCalledWith(
      expect.objectContaining({
        since: expect.any(Date),
        until: expect.any(Date),
      })
    );
  });

  it('routes actor lookups before the generic log detail matcher', async () => {
    auditLoggingServiceMock.getActorActionLog.mockResolvedValue([
      { id: 'log-1', actorId: 'admin-42', actionType: 'user_ban', targetType: 'user', targetId: 'user-1' },
    ]);

    const response = await request(createApp()).get('/api/admin/audit-logs/actor/admin-42?since=7&limit=10');

    expect(response.status).toBe(200);
    expect(auditLoggingServiceMock.getActorActionLog).toHaveBeenCalledWith(
      'admin-42',
      expect.objectContaining({ limit: 10, offset: 0, since: expect.any(Date) })
    );
  });
});
