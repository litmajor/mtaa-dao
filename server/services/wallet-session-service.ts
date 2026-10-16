/**
 * Wallet Session Service (Production)
 *
 * Manages time-bounded wallet connection sessions so a user can unlock
 * a wallet with a PIN instead of re-entering the seed phrase.
 *
 * Security properties
 * ─────────────────────────────────────────────────────────────
 * • Raw session token is returned ONLY at creation time.
 * • Only a SHA-256 hash of the token is stored / queried.
 * • Extend is refused for inactive or already-expired sessions.
 * • Concurrent active sessions per user are capped.
 * • Tokens are rotated on extend.
 * • Soft-delete preserves audit trail; periodic hard-delete reclaims space.
 */

import crypto from 'crypto';
import { and, eq, gt, lt, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { walletSessions } from '../../shared/schema';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const cfg = {
  /** Default session lifetime */
  defaultTimeoutHours: Number(process.env.WALLET_SESSION_TIMEOUT_HOURS ?? 24),
  /** Max simultaneous active sessions per user */
  maxSessionsPerUser: Number(process.env.WALLET_SESSION_MAX_PER_USER ?? 5),
  /** Hard-delete soft-expired rows older than this (days) */
  hardDeleteAfterDays: Number(process.env.WALLET_SESSION_HARD_DELETE_DAYS ?? 90),
};

// ─────────────────────────────────────────────────────────────
// Types & errors
// ─────────────────────────────────────────────────────────────

export interface WalletSessionConfig {
  sessionTimeoutHours?: number;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

export interface SessionInfo {
  valid: boolean;
  sessionId?: string;
  walletId?: string;
  userId?: string;
  expiresAt?: Date;
  connectedAt?: Date;
  lastAccessedAt?: Date;
  deviceId?: string | null;
}

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_FOUND'
      | 'EXPIRED'
      | 'INACTIVE'
      | 'LIMIT_REACHED'
      | 'INTERNAL'
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

type SessionRow = typeof walletSessions.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Crypto helpers
// ─────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function tokenPreview(rawToken: string): string {
  return `${rawToken.slice(0, 6)}…`;
}

// ─────────────────────────────────────────────────────────────
// Core API
// ─────────────────────────────────────────────────────────────

/**
 * Create a new wallet session.
 * Returns the raw token once; only the hash is stored.
 */
export async function createWalletSession(
  walletId: string,
  userId: string,
  config: WalletSessionConfig = {}
): Promise<{ sessionToken: string; sessionId: string; expiresAt: Date }> {
  const timeoutHours = config.sessionTimeoutHours ?? cfg.defaultTimeoutHours;
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timeoutHours * 60 * 60 * 1000);

  try {
    // Enforce concurrent session limit
    const activeCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(walletSessions)
      .where(
        and(
          eq(walletSessions.userId, userId),
          eq(walletSessions.isActive, true),
          gt(walletSessions.expiresAt, now)
        )
      );

    if ((activeCount[0]?.count ?? 0) >= cfg.maxSessionsPerUser) {
      // Revoke the oldest active session to make room
      const [oldest] = await db
        .select({ id: walletSessions.id })
        .from(walletSessions)
        .where(
          and(
            eq(walletSessions.userId, userId),
            eq(walletSessions.isActive, true),
            gt(walletSessions.expiresAt, now)
          )
        )
        .orderBy(walletSessions.connectedAt)
        .limit(1);

      if (oldest) {
        await db
          .update(walletSessions)
          .set({ isActive: false, disconnectedAt: now })
          .where(eq(walletSessions.id, oldest.id));
        logger.info('Revoked oldest session to respect concurrency limit', {
          userId,
          revokedSessionId: oldest.id,
        });
      }
    }

    const [row] = await db
      .insert(walletSessions)
      .values({
        walletId,
        userId,
        sessionToken: tokenHash, // store hash only
        isActive: true,
        connectedAt: now,
        expiresAt,
        lastAccessedAt: now,
        ipAddress: config.ipAddress ?? null,
        userAgent: config.userAgent ?? null,
        deviceId: config.deviceId ?? null,
      })
      .returning({ id: walletSessions.id });

    logger.info('Wallet session created', {
      userId,
      walletId,
      sessionId: row.id,
      tokenPreview: tokenPreview(rawToken),
      expiresAt,
    });

    return {
      sessionToken: rawToken, // raw token returned once
      sessionId: row.id,
      expiresAt,
    };
  } catch (err) {
    logger.error('Failed to create wallet session', {
      userId,
      walletId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new SessionError('Failed to create wallet session', 'INTERNAL');
  }
}

/**
 * Verify a raw session token.
 * Updates lastAccessedAt on success.
 */
export async function verifySessionToken(rawToken: string): Promise<SessionInfo> {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false };
  }

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  try {
    const session = await db.query.walletSessions.findFirst({
      where: and(
        eq(walletSessions.sessionToken, tokenHash),
        eq(walletSessions.isActive, true),
        gt(walletSessions.expiresAt, now)
      ),
    });

    if (!session) {
      return { valid: false };
    }

    // Optional device binding
    // (uncomment if you want strict binding)
    // if (session.deviceId && expectedDeviceId && session.deviceId !== expectedDeviceId) {
    //   return { valid: false };
    // }

    await db
      .update(walletSessions)
      .set({ lastAccessedAt: now })
      .where(eq(walletSessions.id, session.id));

    return {
      valid: true,
      sessionId: session.id,
      walletId: session.walletId,
      userId: session.userId,
      expiresAt: session.expiresAt ?? undefined,
      connectedAt: session.connectedAt,
      lastAccessedAt: now,
      deviceId: session.deviceId,
    };
  } catch (err) {
    logger.error('Failed to verify session token', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { valid: false };
  }
}

/**
 * Get the current active session for a user+wallet pair.
 */
export async function getActiveWalletSession(
  userId: string,
  walletId: string
): Promise<SessionRow | null> {
  const now = new Date();
  try {
    const session = await db.query.walletSessions.findFirst({
      where: and(
        eq(walletSessions.userId, userId),
        eq(walletSessions.walletId, walletId),
        eq(walletSessions.isActive, true),
        gt(walletSessions.expiresAt, now)
      ),
      orderBy: [desc(walletSessions.connectedAt)],
    });

    if (session) {
      await db
        .update(walletSessions)
        .set({ lastAccessedAt: now })
        .where(eq(walletSessions.id, session.id));
    }

    return session ?? null;
  } catch (err) {
    logger.error('Failed to get active wallet session', {
      userId,
      walletId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * All still-valid sessions for a user.
 */
export async function getUserActiveSessions(userId: string): Promise<SessionRow[]> {
  const now = new Date();
  try {
    return await db.query.walletSessions.findMany({
      where: and(
        eq(walletSessions.userId, userId),
        eq(walletSessions.isActive, true),
        gt(walletSessions.expiresAt, now)
      ),
      orderBy: [desc(walletSessions.connectedAt)],
    });
  } catch (err) {
    logger.error('Failed to get user sessions', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Extend a session. Refuses inactive / expired sessions.
 * Rotates the token and returns the new raw token.
 */
export async function extendWalletSession(
  sessionId: string,
  additionalHours: number = cfg.defaultTimeoutHours
): Promise<{ sessionToken: string; newExpiresAt: Date }> {
  const now = new Date();

  const session = await db.query.walletSessions.findFirst({
    where: eq(walletSessions.id, sessionId),
  });

  if (!session) {
    throw new SessionError('Session not found', 'NOT_FOUND');
  }
  if (!session.isActive) {
    throw new SessionError('Session is inactive', 'INACTIVE');
  }
  if (session.expiresAt <= now) {
    throw new SessionError('Session has expired', 'EXPIRED');
  }

  const newRawToken = generateToken();
  const newHash = hashToken(newRawToken);
  const newExpiresAt = new Date(
    Math.max(session.expiresAt.getTime(), now.getTime()) +
      additionalHours * 60 * 60 * 1000
  );

  await db
    .update(walletSessions)
    .set({
      sessionToken: newHash,
      expiresAt: newExpiresAt,
      lastAccessedAt: now,
    })
    .where(eq(walletSessions.id, sessionId));

  logger.info('Wallet session extended + token rotated', {
    sessionId,
    newExpiresAt,
  });

  return { sessionToken: newRawToken, newExpiresAt };
}

/**
 * Soft-disconnect a session by id.
 */
export async function disconnectWalletSession(
  sessionId: string
): Promise<void> {
  const now = new Date();
  const result = await db
    .update(walletSessions)
    .set({ isActive: false, disconnectedAt: now })
    .where(
      and(eq(walletSessions.id, sessionId), eq(walletSessions.isActive, true))
    )
    .returning({ id: walletSessions.id });

  if (!result.length) {
    throw new SessionError('Session not found or already inactive', 'NOT_FOUND');
  }

  logger.info('Wallet session disconnected', { sessionId });
}

/**
 * Soft-disconnect by raw token.
 */
export async function disconnectWalletByToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const result = await db
    .update(walletSessions)
    .set({ isActive: false, disconnectedAt: now })
    .where(
      and(
        eq(walletSessions.sessionToken, tokenHash),
        eq(walletSessions.isActive, true)
      )
    )
    .returning({ id: walletSessions.id });

  if (!result.length) {
    throw new SessionError('Session not found or already inactive', 'NOT_FOUND');
  }

  logger.info('Wallet session disconnected via token', {
    sessionId: result[0].id,
  });
}

/**
 * Soft-disconnect every active session for a user.
 */
export async function disconnectAllUserSessions(
  userId: string
): Promise<{ disconnected: number }> {
  const now = new Date();
  const result = await db
    .update(walletSessions)
    .set({ isActive: false, disconnectedAt: now })
    .where(
      and(eq(walletSessions.userId, userId), eq(walletSessions.isActive, true))
    )
    .returning({ id: walletSessions.id });

  logger.info('All wallet sessions disconnected for user', {
    userId,
    disconnected: result.length,
  });

  return { disconnected: result.length };
}

/**
 * Mark expired sessions inactive (soft cleanup).
 * Safe to run every few minutes.
 */
export async function cleanupExpiredSessions(): Promise<{ deactivated: number }> {
  const now = new Date();
  const result = await db
    .update(walletSessions)
    .set({ isActive: false })
    .where(
      and(lt(walletSessions.expiresAt, now), eq(walletSessions.isActive, true))
    )
    .returning({ id: walletSessions.id });

  if (result.length) {
    logger.info('Expired wallet sessions deactivated', {
      deactivated: result.length,
    });
  }

  return { deactivated: result.length };
}

/**
 * Hard-delete soft-expired sessions older than the retention window.
 * Run daily.
 */
export async function hardDeleteOldSessions(): Promise<{ deleted: number }> {
  const cutoff = new Date(
    Date.now() - cfg.hardDeleteAfterDays * 24 * 60 * 60 * 1000
  );

  const result = await db
    .delete(walletSessions)
    .where(
      and(
        eq(walletSessions.isActive, false),
        lt(walletSessions.expiresAt, cutoff)
      )
    )
    .returning({ id: walletSessions.id });

  if (result.length) {
    logger.info('Hard-deleted old wallet sessions', { deleted: result.length });
  }

  return { deleted: result.length };
}

/**
 * Full session details (for admin / support views).
 */
export async function getWalletSessionDetails(sessionId: string) {
  try {
    return (
      (await db.query.walletSessions.findFirst({
        where: eq(walletSessions.id, sessionId),
        with: {
          wallet: true,
          user: true,
        },
      })) ?? null
    );
  } catch (err) {
    logger.error('Failed to get session details', {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}