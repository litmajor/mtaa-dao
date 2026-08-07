/**
 * Token Blacklist Service
 * Implements Option B: In-memory + Redis blacklist for revoked tokens
 * Used for immediate token invalidation (logout, force-logout, suspicious activity)
 *
 * The refresh_tokens DB table exists in the schema, but the current auth flow
 * does not consult it for revocation checks. This module is therefore the
 * active revocation mechanism in the running server today: if Redis is down
 * or a node is restarted, any revocation that only exists in the in-memory
 * cache will not be visible to other replicas until Redis recovers.
 *
 * FIXES APPLIED:
 * 1. blacklistUserTokens() (force-logout / suspicious-activity) was using
 *    the generic BLACKLIST_TTL (24h) — but refresh tokens live 7 days
 *    (auth.ts's REFRESH_TOKEN_EXPIRY). A "revoke all tokens" action
 *    silently expired after 24h while the actual refresh token could
 *    still be valid for up to 6 more days, meaning a token an admin
 *    thought was permanently killed (e.g. in response to a compromise)
 *    would start working again on its own. Added a separate, longer TTL
 *    for user-wide revocation that covers the full refresh token lifetime
 *    plus a buffer.
 * 2. Removed a dead, unused `pattern` variable in blacklistUserTokens that
 *    was also missing a ':' separator (harmless since unused, but a
 *    landmine if someone later wired it up assuming it was correct).
 */

import { redis } from './redis';
import { db } from '../db';
import { refreshTokens } from '../../shared/schema';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import NodeCache from 'node-cache';

const tokenBlacklistCache = new NodeCache({ stdTTL: 600, checkperiod: 60 });

const BLACKLIST_PREFIX = 'token:blacklist';
const BLACKLIST_TTL = 24 * 60 * 60; // 24 hours — for individual per-token entries only now

// FIX #1: must cover the longest-lived credential it's meant to revoke.
// Matches auth.ts's REFRESH_TOKEN_EXPIRY ('7d') plus a 1-hour buffer.
const USER_REVOCATION_TTL = 7 * 24 * 60 * 60 + 60 * 60;

export async function blacklistToken(tokenHash: string, expiresIn: number, type: 'refresh' | 'access' = 'refresh'): Promise<void> {
  const key = `${BLACKLIST_PREFIX}:${type}:${tokenHash}`;
  const ttl = expiresIn + 60;

  try {
    await redis.set(key, 'revoked', ttl);
    tokenBlacklistCache.set(`${type}:${tokenHash}`, true, ttl);
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Redis write failed, falling back to DB-backed revocation:', error);
  }

  try {
    await db.update(refreshTokens)
      .set({
        revokedAt: new Date(),
        revokedReason: 'revoked',
      })
      .where(eq(refreshTokens.tokenHash, tokenHash));

    tokenBlacklistCache.set(`${type}:${tokenHash}`, true, BLACKLIST_TTL);
    console.log(`[TOKEN_BLACKLIST] Blacklisted ${type} token: ${tokenHash.substring(0, 10)}...`);
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error persisting token revocation to DB:', error);
    tokenBlacklistCache.set(`${type}:${tokenHash}`, true, BLACKLIST_TTL);
  }
}

export async function isTokenBlacklisted(tokenHash: string): Promise<boolean> {
  if (tokenBlacklistCache.has(`refresh:${tokenHash}`) || tokenBlacklistCache.has(`access:${tokenHash}`)) {
    return true;
  }

  try {
    const refreshKey = `${BLACKLIST_PREFIX}:refresh:${tokenHash}`;
    const accessKey = `${BLACKLIST_PREFIX}:access:${tokenHash}`;

    const refreshExists = await redis.exists(refreshKey);
    const accessExists = await redis.exists(accessKey);

    if (refreshExists || accessExists) {
      if (refreshExists) tokenBlacklistCache.set(`refresh:${tokenHash}`, true, BLACKLIST_TTL);
      if (accessExists) tokenBlacklistCache.set(`access:${tokenHash}`, true, BLACKLIST_TTL);
      return true;
    }
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error checking Redis:', error);
  }

  try {
    const revokedToken = await db.select().from(refreshTokens).where(and(
      eq(refreshTokens.tokenHash, tokenHash),
      isNotNull(refreshTokens.revokedAt)
    )).limit(1);

    if (revokedToken.length === 0) {
      return false;
    }

    tokenBlacklistCache.set(`refresh:${tokenHash}`, true, BLACKLIST_TTL);
    return true;
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error checking database revocation:', error);
    return false;
  }
}

/**
 * Blacklist all tokens for a user (force logout)
 * Used for: password reset, account compromise, admin force-logout
 */
export async function blacklistUserTokens(userId: string): Promise<void> {
  const userBlacklistKey = `user:blacklist:${userId}`;

  try {
    await redis.set(userBlacklistKey, 'all_revoked', USER_REVOCATION_TTL); // FIX #1
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error blacklisting user tokens in Redis:', error);
  }

  try {
    await db.update(refreshTokens)
      .set({
        revokedAt: new Date(),
        revokedReason: 'user_revoke',
      })
      .where(eq(refreshTokens.userId, userId));

    console.log(`[TOKEN_BLACKLIST] Blacklisted all tokens for user: ${userId}`);
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error persisting user-wide revocation to DB:', error);
  }
}

export async function areUserTokensRevoked(userId: string): Promise<boolean> {
  try {
    const key = `user:blacklist:${userId}`;
    const redisRevoked = (await redis.exists(key)) > 0;
    if (redisRevoked) return true;

    const revokedTokens = await db.select().from(refreshTokens).where(and(
      eq(refreshTokens.userId, userId),
      isNotNull(refreshTokens.revokedAt)
    )).limit(1);

    return revokedTokens.length > 0;
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error checking user tokens:', error);
    return false;
  }
}

export async function clearUserBlacklist(userId: string): Promise<void> {
  try {
    const key = `user:blacklist:${userId}`;
    await redis.delete(key);
    console.log(`[TOKEN_BLACKLIST] Cleared blacklist for user: ${userId}`);
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error clearing user blacklist:', error);
  }
}

export { tokenBlacklistCache };