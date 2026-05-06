/**
 * Token Blacklist Service
 * Implements Option B: In-memory + Redis blacklist for revoked tokens
 * Used for immediate token invalidation (logout, force-logout, suspicious activity)
 * 
 * The refresh_tokens DB table provides persistent revocation (Option A)
 * This service provides fast in-memory cache for real-time checks
 */

import { redis } from './redis';
import NodeCache from 'node-cache';

// In-memory cache as fallback when Redis is unavailable
// stdTTL: 600s (10 minutes), checkperiod: 60s (cleanup every minute)
const tokenBlacklistCache = new NodeCache({ stdTTL: 600, checkperiod: 60 });

const BLACKLIST_PREFIX = 'token:blacklist';
const BLACKLIST_TTL = 24 * 60 * 60; // 24 hours - keep tokens blacklisted even after expiry

/**
 * Add token to blacklist immediately
 * Used for: logout, force-logout, suspicious activity
 * 
 * @param tokenHash - Hash of the refresh token (stored in DB)
 * @param expiresIn - Seconds until token naturally expires (determines TTL)
 */
export async function blacklistToken(tokenHash: string, expiresIn: number, type: 'refresh' | 'access' = 'refresh'): Promise<void> {
  try {
    const key = `${BLACKLIST_PREFIX}:${type}:${tokenHash}`;
    // Keep blacklist entry until token naturally expires + small buffer
    const ttl = expiresIn + 60; // expire 1 minute after the token would naturally expire

    // Add to Redis with TTL
    await redis.set(key, 'revoked', ttl);

    // Also add to in-memory cache for immediate availability
    tokenBlacklistCache.set(`${type}:${tokenHash}`, true, ttl);

    console.log(`[TOKEN_BLACKLIST] Blacklisted ${type} token: ${tokenHash.substring(0, 10)}...`);
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error blacklisting token:', error);
    // Fail gracefully - at worst, token will expire naturally
    tokenBlacklistCache.set(`${type}:${tokenHash}`, true, BLACKLIST_TTL);
  }
}

/**
 * Check if token is blacklisted
 * Fast path: Check in-memory cache first
 * Fallback: Check Redis
 * 
 * @param tokenHash - Hash of the refresh token
 * @returns true if token is blacklisted, false otherwise
 */
export async function isTokenBlacklisted(tokenHash: string): Promise<boolean> {
  // Fast path: Check in-memory cache first (covering both access & refresh)
  if (tokenBlacklistCache.has(`refresh:${tokenHash}`) || tokenBlacklistCache.has(`access:${tokenHash}`)) {
    return true;
  }

  try {
    // Check Redis for both access and refresh token keys
    const refreshKey = `${BLACKLIST_PREFIX}:refresh:${tokenHash}`;
    const accessKey = `${BLACKLIST_PREFIX}:access:${tokenHash}`;

    const refreshExists = await redis.exists(refreshKey);
    const accessExists = await redis.exists(accessKey);

    if (refreshExists || accessExists) {
      // Cache it for future checks
      if (refreshExists) tokenBlacklistCache.set(`refresh:${tokenHash}`, true, BLACKLIST_TTL);
      if (accessExists) tokenBlacklistCache.set(`access:${tokenHash}`, true, BLACKLIST_TTL);
      return true;
    }
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error checking Redis:', error);
    // If Redis fails, we only check in-memory cache (already done above)
  }

  return false;
}

/**
 * Blacklist all tokens for a user (force logout)
 * Used for: password reset, account compromise, admin force-logout
 * 
 * @param userId - User ID
 */
export async function blacklistUserTokens(userId: string): Promise<void> {
  try {
    const pattern = `${BLACKLIST_PREFIX}user:${userId}:*`;
    
    // Mark user's tokens as revoked in Redis
    // In production, query refresh_tokens table and mark them revoked
    const userBlacklistKey = `user:blacklist:${userId}`;
    await redis.set(userBlacklistKey, 'all_revoked', BLACKLIST_TTL);
    
    console.log(`[TOKEN_BLACKLIST] Blacklisted all tokens for user: ${userId}`);
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error blacklisting user tokens:', error);
  }
}

/**
 * Check if all tokens for a user are revoked
 * 
 * @param userId - User ID
 * @returns true if all user's tokens are revoked
 */
export async function areUserTokensRevoked(userId: string): Promise<boolean> {
  try {
    const key = `user:blacklist:${userId}`;
    return await redis.exists(key) > 0;
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error checking user tokens:', error);
    return false;
  }
}

/**
 * Clear blacklist for a user (used rarely, e.g., if compromise was false alarm)
 */
export async function clearUserBlacklist(userId: string): Promise<void> {
  try {
    const key = `user:blacklist:${userId}`;
    await redis.delete(key);
    console.log(`[TOKEN_BLACKLIST] Cleared blacklist for user: ${userId}`);
  } catch (error) {
    console.error('[TOKEN_BLACKLIST] Error clearing user blacklist:', error);
  }
}

// Export for testing/cleanup
export { tokenBlacklistCache };
