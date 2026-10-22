import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPoolQuery, mockConnect, mockClientQuery, mockRelease } = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
  mockConnect: vi.fn(),
  mockClientQuery: vi.fn(),
  mockRelease: vi.fn(),
}));

vi.mock('../db', () => ({
  pool: {
    query: mockPoolQuery,
    connect: mockConnect,
  },
}));

import {
  createSession,
  destroyAllUserSessions,
  getSession,
  getSessionStats,
} from '../sessionService';

describe('sessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('persists a session transactionally while locking session changes per user', async () => {
    await createSession(
      'session-1',
      'user-1',
      { email: 'user@example.com', role: 'member' },
      { ip: '192.0.2.1', userAgent: 'test-agent' }
    );

    expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      ['user-1']
    );
    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.auth_sessions'),
      ['session-1', 'user-1', 'user@example.com', 'member', '192.0.2.1', 'test-agent']
    );
    expect(mockClientQuery).toHaveBeenLastCalledWith('COMMIT');
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it('evicts the oldest active session before exceeding the per-user limit', async () => {
    const activeSessions = Array.from({ length: 5 }, (_, index) => ({
      sessionId: `session-${index + 1}`,
      userId: 'user-1',
      email: null,
      role: null,
      loginTime: new Date(`2026-10-17T10:0${index}:00.000Z`),
      lastActivity: new Date(`2026-10-17T10:0${index}:00.000Z`),
      ipAddress: '192.0.2.1',
      userAgent: 'test-agent',
    }));
    mockClientQuery.mockImplementation(async (query: string) => {
      if (query.includes('FROM public.auth_sessions')) {
        return { rows: activeSessions, rowCount: activeSessions.length };
      }
      return { rows: [], rowCount: 0 };
    });

    await createSession(
      'session-6',
      'user-1',
      {},
      { ip: '192.0.2.1', userAgent: 'test-agent' }
    );

    expect(mockClientQuery).toHaveBeenCalledWith(
      'DELETE FROM public.auth_sessions WHERE session_id = ANY($1::varchar[])',
      [['session-1']]
    );
  });

  it('serializes global sign-out with session creation', async () => {
    await destroyAllUserSessions('user-1');

    expect(mockClientQuery).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      ['user-1']
    );
    expect(mockClientQuery).toHaveBeenCalledWith(
      'DELETE FROM public.auth_sessions WHERE user_id = $1',
      ['user-1']
    );
    expect(mockClientQuery).toHaveBeenLastCalledWith('COMMIT');
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it('refreshes activity and returns a persisted active session', async () => {
    const session = {
      sessionId: 'session-1',
      userId: 'user-1',
      email: 'user@example.com',
      role: 'member',
      loginTime: new Date('2026-10-17T10:00:00.000Z'),
      lastActivity: new Date('2026-10-17T10:05:00.000Z'),
      ipAddress: '192.0.2.1',
      userAgent: 'test-agent',
    };
    mockPoolQuery.mockResolvedValue({ rows: [session], rowCount: 1 });

    await expect(getSession('session-1')).resolves.toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'member',
      loginTime: session.loginTime,
      lastActivity: session.lastActivity,
      ipAddress: '192.0.2.1',
      userAgent: 'test-agent',
    });
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE public.auth_sessions'),
      ['session-1', 30 * 60 * 1000]
    );
  });

  it('reports session statistics from the shared database', async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{
        totalSessions: 2,
        uniqueUsers: 1,
        uniqueIps: 2,
        avgSessionAge: '12.5',
      }],
      rowCount: 1,
    });

    await expect(getSessionStats()).resolves.toEqual({
      totalSessions: 2,
      uniqueUsers: 1,
      uniqueIps: 2,
      avgSessionAge: 12.5,
    });
  });
});
