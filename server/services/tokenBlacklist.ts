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
import NodeCache from 'node-cache';

const tokenBlacklistCache = new NodeCache({ stdTTL: 600, checkperiod: 60 });

const BLACKLIST_PREFIX = 'token:blacklist';
const BLACKLIST_TTL = 24 * 60 * 60; // 24 hours — for individual per-token entries only now

// FIX #1: must cover the longest-lived credential it's meant to revoke.
// Matches auth.ts's REFRESH_TOKEN_EXPIRY ('7d') plus a 1-hour buffer.
const USER_REVOCATION_TTL = 7 * 24 * 60 * 60 + 60 * 60;

export async function blacklistToken(tokenHash: string, expiresIn: number, type: 'refresh' | 'access' = 'refresh'): Promise<void> {
  try {
    const key = `${BLACKLIST_PREFIX}:${type}:${tokenHash}`;
    const ttl = expiresIn + 60;

    await redis.set(key, 'revoked', ttl);
    tokenBlacklistCache.set(`${type}:${tokenHash}`, true, ttl);

    console.log(`[TOKEN_BLACKLIST] Blacklisted ${type} token: ${tokenHash.substring(0, 10)}...`);
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error blacklisting token:', error);
    // NOTE: this fallback only protects the CURRENT process. In a
    // multi-instance deployment, other replicas won't see this token as
    // blacklisted until Redis recovers — flagging since Option A (DB-backed
    // revocation) doesn't appear to be consulted anywhere as a backstop.
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

  return false;
}

/**
 * Blacklist all tokens for a user (force logout)
 * Used for: password reset, account compromise, admin force-logout
 */
export async function blacklistUserTokens(userId: string): Promise<void> {
  try {
    // FIX #2: removed the unused/broken `pattern` variable that was here —
    // it was never read and had a missing ':' separator bug.
    const userBlacklistKey = `user:blacklist:${userId}`;
    await redis.set(userBlacklistKey, 'all_revoked', USER_REVOCATION_TTL); // FIX #1

    console.log(`[TOKEN_BLACKLIST] Blacklisted all tokens for user: ${userId}`);
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error blacklisting user tokens:', error);
  }
}

export async function areUserTokensRevoked(userId: string): Promise<boolean> {
  try {
    const key = `user:blacklist:${userId}`;
    return (await redis.exists(key)) > 0;
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