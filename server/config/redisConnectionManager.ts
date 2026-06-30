/**
 * 🔴 SINGLETON REDIS CONNECTION MANAGER
 * 
 * This is the ONLY place where Redis clients are created.
 * All services MUST use getInstance() to get the shared connection.
 * 
 * Pattern violations (creating new Redis instances) will be logged with stack traces.
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

class RedisConnectionManager {
  private static instance: RedisClientType | null = null;
  private static initPromise: Promise<RedisClientType> | null = null;
  private static instanceCount = 0;
  private static fallbackStore = new Map<string, { value: string; expiresAt: number }>();

  /**
   * Get or create the SINGLE Redis instance for this process
   */
  static getInstance(): RedisClientType {
    if (!this.instance) {
      // Log the stack trace to see WHO is calling this
      const stack = new Error().stack?.split('\n').slice(2, 4).join('\n') || '';
      logger.debug(`[REDIS-SINGLETON] First instance creation from:\n${stack}`);
      
      this.instance = this.createClient();
    }
    return this.instance;
  }

  /**
   * Asynchronously get initialized instance (waits for ready)
   */
  static async getInitializedInstance(): Promise<RedisClientType> {
    if (!this.initPromise) {
      this.initPromise = this.initializeClient();
    }
    return this.initPromise;
  }

  /**
   * Create the Redis client (called ONCE)
   */
  private static createClient(): RedisClientType {
    this.instanceCount++;
    
    if (this.instanceCount > 1) {
      logger.error(
        `[REDIS-VIOLATION] ⚠️  Multiple Redis instances detected! Instance #${this.instanceCount}`
      );
      logger.error(
        `[REDIS-VIOLATION] Services are doing: new Redis(...) instead of getInstance()`
      );
      const stack = new Error().stack;
      logger.error(`[REDIS-VIOLATION] Stack:\n${stack}`);
    }

    const url = process.env.REDIS_URL || this.buildUrl();

    logger.info(`[REDIS] Creating Redis client (instance #${this.instanceCount})`);
    logger.debug(`[REDIS] URL: ${url.replace(/:[^@]*@/, ':***@')}`);

    const client = createClient({
      url,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries: number) => {
          if (retries > 2) {
            logger.warn(`[REDIS] Max retries exceeded (${retries}), stopping reconnection`);
            return false;
          }
          const delay = Math.min(retries * 100, 1000);
          logger.debug(`[REDIS] Retry attempt ${retries}, delay: ${delay}ms`);
          return delay;
        },
      },
    });

    // Monitor connection events
    client.on('connect', () => {
      logger.info(`[REDIS] ✅ Connected (instance #${this.instanceCount})`);
    });

    client.on('error', (err: any) => {
      logger.error(`[REDIS] ❌ Error: ${err.message}`, { code: err.code });
    });

    client.on('reconnecting', () => {
      logger.warn(`[REDIS] 🔄 Reconnecting...`);
    });

    client.on('ready', () => {
      logger.info(`[REDIS] 🚀 Ready (instance #${this.instanceCount})`);
    });

    client.on('close', () => {
      logger.warn(`[REDIS] Connection closed (instance #${this.instanceCount})`);
    });

    return client as RedisClientType;
  }

  /**
   * Build Redis URL from environment variables
   */
  private static buildUrl(): string {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT || '6379';
    const password = process.env.REDIS_PASSWORD;
    const db = process.env.REDIS_DB || '0';

    if (password) {
      return `redis://:${encodeURIComponent(password)}@${host}:${port}/${db}`;
    } else {
      return `redis://${host}:${port}/${db}`;
    }
  }

  /**
   * Initialize and wait for ready
   */
  private static async initializeClient(): Promise<RedisClientType> {
    const client = this.getInstance();
    
    return new Promise((resolve, reject) => {
      if (client.isOpen) {
        // Already open — ensure policy is correct asynchronously
        this.ensureNoEvictionPolicy(client).catch((err) => {
          logger.debug('[REDIS] Policy validation skipped (already open):', String(err));
        });
        resolve(client);
        return;
      }

      const onReady = () => {
        client.removeListener('error', onError);

        // Validate and correct eviction policy asynchronously before resolving
        this.ensureNoEvictionPolicy(client)
          .catch((err) => logger.warn('[REDIS] Policy validation failed:', String(err)))
          .finally(() => resolve(client));
      };

      const onError = (err: Error) => {
        client.removeListener('ready', onReady);
        reject(err);
      };

      client.once('ready', onReady);
      client.once('error', onError);

      // Timeout after 10s
      setTimeout(() => {
        client.removeListener('ready', onReady);
        client.removeListener('error', onError);
        reject(new Error('Redis initialization timeout (10s)'));
      }, 10000);
    });
  }

  /**
   * Ensure Redis eviction policy is set to `noeviction`. Attempt to auto-correct
   * if it differs. Non-fatal — failures here are logged but do not stop startup.
   */
  private static async ensureNoEvictionPolicy(client: RedisClientType): Promise<void> {
    try {
      // Use a loose typing for config access since client.config may vary between redis clients
      const resp = await (client as any).config('GET', 'maxmemory-policy');
      let current: string | undefined;

      if (Array.isArray(resp) && resp.length >= 2) {
        current = String(resp[1]);
      } else if (resp && typeof resp === 'object') {
        current = (resp['maxmemory-policy'] || resp.maxmemory_policy || Object.values(resp)[0]) as string;
      } else if (typeof resp === 'string') {
        current = resp;
      }

      if (!current) {
        logger.debug('[REDIS] Could not determine maxmemory-policy from CONFIG GET response');
        return;
      }

      if (current.toLowerCase() !== 'noeviction') {
        logger.warn(`[REDIS] Eviction policy is ${current}. Correcting to noeviction`);
        await (client as any).config('SET', 'maxmemory-policy', 'noeviction');
        logger.info('[REDIS] Eviction policy set to noeviction');
      }
    } catch (err) {
      logger.warn(`[REDIS] Could not validate/modify eviction policy: ${String(err)}`);
    }
  }

  /**
   * Get instance count (for diagnostics)
   */
  static getInstanceCount(): number {
    return this.instanceCount;
  }

  /**
   * Check if Redis is connected
   */
  static isConnected(): boolean {
    return this.instance?.isOpen || false;
  }

  /**
   * Get fallback store (for when Redis is offline)
   */
  static getFallbackStore(): Map<string, { value: string; expiresAt: number }> {
    return this.fallbackStore;
  }

  /**
   * Disconnect (graceful shutdown)
   */
  static async disconnect(): Promise<void> {
    if (this.instance) {
      logger.info(`[REDIS] Gracefully disconnecting...`);
      try {
        await this.instance.quit();
      } catch (err) {
        logger.warn(`[REDIS] Error during disconnect: ${String(err)}`);
      }
      this.instance = null;
      this.initPromise = null;
    }
  }
}

export const getRedisInstance = () => RedisConnectionManager.getInstance();
export const getRedisInstanceAsync = () => RedisConnectionManager.getInitializedInstance();
export const getRedisInstanceCount = () => RedisConnectionManager.getInstanceCount();
export const isRedisConnected = () => RedisConnectionManager.isConnected();

export default RedisConnectionManager;
