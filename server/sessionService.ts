import type { NextFunction, Request, Response } from 'express';
import type { QueryResultRow } from 'pg';
import { pool } from './db';

interface SessionData {
  userId: string;
  email?: string;
  role?: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

interface StoredSession extends QueryResultRow {
  sessionId: string;
  userId: string;
  email: string | null;
  role: string | null;
  loginTime: Date;
  lastActivity: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 5;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

export interface SessionContext {
  ip: string;
  userAgent: string;
}

function toSessionData(row: StoredSession): SessionData {
  return {
    userId: row.userId,
    email: row.email ?? undefined,
    role: row.role ?? undefined,
    loginTime: row.loginTime,
    lastActivity: row.lastActivity,
    ipAddress: row.ipAddress ?? undefined,
    userAgent: row.userAgent ?? undefined,
  };
}

function sessionColumns(alias = ''): string {
  const prefix = alias ? `${alias}.` : '';
  return `
    ${prefix}session_id AS "sessionId",
    ${prefix}user_id AS "userId",
    ${prefix}email,
    ${prefix}role,
    ${prefix}login_time AS "loginTime",
    ${prefix}last_activity AS "lastActivity",
    ${prefix}ip_address AS "ipAddress",
    ${prefix}user_agent AS "userAgent"
  `;
}

export async function createSession(
  sessionId: string,
  userId: string,
  userData: Partial<SessionData>,
  context: SessionContext
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [userId]
    );

    const { rows: activeSessions } = await client.query<StoredSession>(
      `SELECT ${sessionColumns()}
       FROM public.auth_sessions
       WHERE user_id = $1
         AND last_activity >= NOW() - ($2 * INTERVAL '1 millisecond')
       ORDER BY login_time ASC, session_id ASC
       FOR UPDATE`,
      [userId, SESSION_TIMEOUT_MS]
    );

    const existingIps = new Set(
      activeSessions
        .map((session) => session.ipAddress)
        .filter((ip): ip is string => Boolean(ip))
    );
    if (existingIps.size > 0 && !existingIps.has(context.ip)) {
      console.warn(`Suspicious login: User ${userId} logging in from new IP ${context.ip}`);
    }

    const sessionsToRemove = activeSessions.slice(
      0,
      Math.max(0, activeSessions.length - MAX_SESSIONS_PER_USER + 1)
    );
    if (sessionsToRemove.length > 0) {
      await client.query(
        'DELETE FROM public.auth_sessions WHERE session_id = ANY($1::varchar[])',
        [sessionsToRemove.map((session) => session.sessionId)]
      );
    }

    await client.query(
      `INSERT INTO public.auth_sessions (
         session_id, user_id, email, role, login_time, last_activity, ip_address, user_agent
       ) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6)`,
      [
        sessionId,
        userId,
        userData.email ?? null,
        userData.role ?? null,
        context.ip,
        context.userAgent,
      ]
    );
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Failed to roll back session creation:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const { rows } = await pool.query<StoredSession>(
    `UPDATE public.auth_sessions
     SET last_activity = NOW()
     WHERE session_id = $1
       AND last_activity >= NOW() - ($2 * INTERVAL '1 millisecond')
     RETURNING ${sessionColumns()}`,
    [sessionId, SESSION_TIMEOUT_MS]
  );

  if (rows[0]) return toSessionData(rows[0]);

  await pool.query(
    `DELETE FROM public.auth_sessions
     WHERE session_id = $1
      AND last_activity < NOW() - ($2 * INTERVAL '1 millisecond')`,
    [sessionId, SESSION_TIMEOUT_MS]
  );
  return null;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE public.auth_sessions
     SET last_activity = NOW()
     WHERE session_id = $1
      AND last_activity >= NOW() - ($2 * INTERVAL '1 millisecond')`,
    [sessionId, SESSION_TIMEOUT_MS]
  );
}

export async function destroySession(sessionId: string): Promise<void> {
  await pool.query('DELETE FROM public.auth_sessions WHERE session_id = $1', [sessionId]);
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [userId]
    );
    await client.query('DELETE FROM public.auth_sessions WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Failed to roll back session destruction:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getUserActiveSessions(userId: string): Promise<SessionData[]> {
  const { rows } = await pool.query<StoredSession>(
    `SELECT ${sessionColumns()}
     FROM public.auth_sessions
     WHERE user_id = $1
      AND last_activity >= NOW() - ($2 * INTERVAL '1 millisecond')
     ORDER BY login_time DESC`,
    [userId, SESSION_TIMEOUT_MS]
  );

  return rows.map(toSessionData);
}

export async function cleanupExpiredSessions(): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM public.auth_sessions
     WHERE last_activity < NOW() - ($1 * INTERVAL '1 millisecond')`,
    [SESSION_TIMEOUT_MS]
  );
  const cleanedCount = rowCount ?? 0;
  console.log(`Cleaned up ${cleanedCount} expired sessions`);
  return cleanedCount;
}

export async function detectAnomalousActivity(userId: string): Promise<boolean> {
  const sessions = await getUserActiveSessions(userId);
  const uniqueIps = new Set(sessions.map((session) => session.ipAddress));
  const uniqueUserAgents = new Set(sessions.map((session) => session.userAgent));
  return uniqueIps.size > 3 || uniqueUserAgents.size > 3;
}

export async function getSessionStats(): Promise<{
  totalSessions: number;
  uniqueUsers: number;
  uniqueIps: number;
  avgSessionAge: number;
}> {
  const { rows } = await pool.query<{
    totalSessions: number;
    uniqueUsers: number;
    uniqueIps: number;
    avgSessionAge: number | string | null;
  }>(
    `SELECT
       COUNT(*)::int AS "totalSessions",
       COUNT(DISTINCT user_id)::int AS "uniqueUsers",
       COUNT(DISTINCT ip_address)::int AS "uniqueIps",
       EXTRACT(EPOCH FROM AVG(NOW() - login_time)) / 60 AS "avgSessionAge"
     FROM public.auth_sessions
     WHERE last_activity >= NOW() - ($1 * INTERVAL '1 millisecond')`,
    [SESSION_TIMEOUT_MS]
  );

  const stats = rows[0];
  return {
    totalSessions: stats.totalSessions,
    uniqueUsers: stats.uniqueUsers,
    uniqueIps: stats.uniqueIps,
    avgSessionAge: Number(stats.avgSessionAge ?? 0),
  };
}

const cleanupTimer = setInterval(() => {
  void cleanupExpiredSessions().catch((error: unknown) => {
    console.error('Failed to clean up expired sessions:', error);
  });
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

export const sessionMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const headerSessionId = req.headers['x-session-id'];
    const sessionId =
      (typeof headerSessionId === 'string' ? headerSessionId : undefined) ??
      (typeof req.cookies?.sessionId === 'string' ? req.cookies.sessionId : undefined);

    if (sessionId) await updateSessionActivity(sessionId);
    next();
  } catch (error) {
    next(error);
  }
};
