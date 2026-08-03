import type { RedisClientType } from 'redis';

/**
 * Lightweight adapter exposing a small subset of Redis operations via the
 * central `redisConnectionManager`. This prevents modules from creating
 * independent ioredis clients and keeps a single managed client per process.
 */

export async function getRedisClient(): Promise<RedisClientType> {
  // Prefer the async getter exposed by the connection manager
  const mgr = await import('../../server/config/redisConnectionManager');
  if (typeof mgr.getRedisInstanceAsync === 'function') {
    return await mgr.getRedisInstanceAsync();
  }
  // Fallback: if manager only exposes direct get, call that and wrap
  if (typeof mgr.getRedisInstance === 'function') {
    return mgr.getRedisInstance() as RedisClientType;
  }
  throw new Error('Redis connection manager does not expose a usable getter');
}

export async function closeRedisClient(): Promise<void> {
  const mgr = await import('../../server/config/redisConnectionManager');
  if (typeof mgr.getRedisInstanceAsync === 'function') {
    const client = await mgr.getRedisInstanceAsync();
    if (client && typeof client.quit === 'function') {
      await client.quit();
    }
    return;
  }
  if (typeof mgr.getRedisInstance === 'function') {
    const client = mgr.getRedisInstance();
    if (client && typeof client.quit === 'function') {
      await client.quit();
    }
  }
}
