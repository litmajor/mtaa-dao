/**
 * 🔴 SINGLETON REDIS CONNECTION MANAGER
 * 
 * This is the ONLY place where Redis clients are created.
 * All services MUST use getInstance() to get the shared connection.
 * 
 * Pattern violations (creating new Redis instances) will be logged with stack traces.
 */

import { createClient} from 'redis';
import type { RedisClientType } from 'redis';
import { logger } from '../utils/logger';

function envInt(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const REDIS_CONNECT_TIMEOUT_MS = envInt('REDIS_CONNECT_TIMEOUT_MS', 1000);
export const REDIS_COMMAND_TIMEOUT_MS = envInt('REDIS_COMMAND_TIMEOUT_MS', 750);
const REDIS_MAX_RECONNECT_DELAY_MS = envInt('REDIS_MAX_RECONNECT_DELAY_MS', 30000);
const REDIS_ERROR_LOG_INTERVAL_MS = envInt('REDIS_ERROR_LOG_INTERVAL_MS', 60000);

class RedisConnectionManager {
  private static instance: RedisClientType | null = null;
  private static initPromise: Promise<RedisClientType> | null = null;
  private static instanceCount = 0;
  private static fallbackStore = new Map<string, { value: string; expiresAt: number }>();
  private static lastError: string | null = null;
  private static lastErrorAt: number | null = null;
  private static lastErrorLogAt = 0;

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
      this.initPromise = this.initializeClient().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  /**
   * Create the Redis client (called ONCE)
   */
  private static clearInstance(): void {
    this.instance = null;
    this.initPromise = null;
  }

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
      // Fail fast instead of queueing commands forever while disconnected.
      disableOfflineQueue: true,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        socketTimeout: 30000,
        keepAlive: true,
        noDelay: true,
        // Never give up: keep reconnecting in the background (capped backoff)
        // so Redis recovers without a process restart.
        reconnectStrategy: (retries: number) => {
          const delay = Math.min(REDIS_MAX_RECONNECT_DELAY_MS, 250 * Math.pow(2, Math.min(retries, 10)));
          return delay + Math.floor(Math.random() * 250);
        },
      },
      pingInterval: 10000,
    });

    // Start connecting eagerly while still allowing callers to wait for ready.
    void client.connect().catch((err: Error) => {
      logger.warn(`[REDIS] Initial connect attempt failed: ${err.message}`);
    });

    client.on('connect', () => {
      logger.info(`[REDIS] ✅ Connected (instance #${this.instanceCount})`);
    });

    client.on('error', (err: any) => {
      this.lastError = err?.message || String(err);
      this.lastErrorAt = Date.now();
      // Throttle: a dead Redis emits an error on every reconnect attempt.
      if (Date.now() - this.lastErrorLogAt >= REDIS_ERROR_LOG_INTERVAL_MS) {
        this.lastErrorLogAt = Date.now();
        logger.warn(`[REDIS] ❌ Error: ${this.lastError} (further errors throttled for ${REDIS_ERROR_LOG_INTERVAL_MS}ms)`, { code: err?.code });
      }
    });

    client.on('reconnecting', () => {
      logger.debug(`[REDIS] 🔄 Reconnecting...`);
    });

    client.on('ready', () => {
      this.lastErrorLogAt = 0;
      logger.info(`[REDIS] 🚀 Ready (instance #${this.instanceCount})`);
    });

    const cleanup = () => {
      logger.warn(`[REDIS] Connection ended/closed (instance #${this.instanceCount}), clearing singleton`);
      this.clearInstance();
    };

    client.on('end', cleanup);
    client.on('close', cleanup);

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
      if (client.isReady) {
        this.ensureNoEvictionPolicy(client).catch((err) => {
          logger.debug('[REDIS] Policy validation skipped (already open):', { err: String(err) });
        });
        resolve(client);
        return;
      }

      let timeoutHandle: NodeJS.Timeout | undefined;
      const cleanup = () => {
        client.removeListener('ready', onReady);
        client.removeListener('error', onError);
        if (timeoutHandle) clearTimeout(timeoutHandle);
      };

      const onReady = () => {
        cleanup();
        // Policy validation is best-effort and must not delay readiness.
        this.ensureNoEvictionPolicy(client).catch((err) =>
          logger.warn('[REDIS] Policy validation failed:', { err: String(err) })
        );
        resolve(client);
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      client.once('ready', onReady);
      client.once('error', onError);

      timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error(`Redis initialization timeout (${REDIS_CONNECT_TIMEOUT_MS}ms)`));
      }, REDIS_CONNECT_TIMEOUT_MS);
    });
  }

  /**
   * Ensure Redis eviction policy is set to `noeviction`. Attempt to auto-correct
   * if it differs. Non-fatal — failures here are logged but do not stop startup.
   */
  private static async ensureNoEvictionPolicy(client: RedisClientType): Promise<void> {
    try {
      const resp = await client.sendCommand(['CONFIG', 'GET', 'maxmemory-policy']);
      let current: string | undefined;

      if (Array.isArray(resp) && resp.length >= 2) {
        current = String(resp[1]);
      } else if (resp && typeof resp === 'object') {
        const config = resp as unknown as Record<string, unknown>;
        const value = config['maxmemory-policy'] || config.maxmemory_policy || Object.values(config)[0];
        current = typeof value === 'string' ? value : undefined;
      } else if (typeof resp === 'string') {
        current = resp;
      }

      if (!current) {
        logger.debug('[REDIS] Could not determine maxmemory-policy from CONFIG GET response');
        return;
      }

      if (current.toLowerCase() !== 'noeviction') {
        logger.warn(`[REDIS] Eviction policy is ${current}. Correcting to noeviction`);
        await client.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', 'noeviction']);
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
    return this.instance?.isReady || false;
  }

  static getLastError(): { message: string | null; at: number | null } {
    return { message: this.lastError, at: this.lastErrorAt };
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
export const getRedisLastError = () => RedisConnectionManager.getLastError();

export default RedisConnectionManager;
