import Redis, { RedisOptions } from 'ioredis'; // Switch to ioredis for stability
import { logger } from '../utils/logger';

class RedisService {
  private client: Redis | null = null;
  private fallbackStore = new Map<string, { value: string; expiresAt: number }>();
  private isConnected = false;
  private hasLoggedFallback = false;
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private redisOptions: RedisOptions = {};

  async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected) return;

    // Build but ioredis prefers object)
    const host = process.env.REDIS_HOST || 'localhost';
    const port = Number(process.env.REDIS_PORT) || 6379;
    const password = process.env.REDIS_PASSWORD;
    const db = Number(process.env.REDIS_DB) || 0;

    this.redisOptions = {
      host,
      port,
      password,
      db,
      connectTimeout: 5000, // Fail fast per attempt
      enableReadyCheck: false, // Skip ready check, use connect event
      autoResubscribe: true,
      maxRetriesPerRequest: null, // Retry forever
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000); // 50ms×N, max 2s (faster than 5s)
        if (times <= 1 || times % 5 === 0) { // Log less frequently
          logger.debug(`[Redis] Reconnect attempt ${times} (delay ${delay}ms)`);
        }
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targets = [/ECONNRESET/, /ETIMEDOUT/, /Socket closed/];
        return targets.some((regex) => regex.test(err.message));
      },
      // Keepalive options
      keepAlive: 30000, // Ping every 30s
      noDelay: true,
      connectionName: 'mtaa-dao-server', // For debugging in Redis logs
    };

    // TLS for secure connections (enable if using cloud Redis)
    if (process.env.REDIS_TLS === 'true') {
      this.redisOptions.tls = { rejectUnauthorized: false }; // Self-signed certs
    }

    this.isConnecting = true;

    try {
      this.client = new Redis(this.redisOptions);

      this.client.on('error', (err: Error) => {
        logger.warn('[Redis] Error:', err.message);
      });

      this.client.on('connect', () => {
        logger.info('[Redis] Connected');
        this.isConnected = true;
        this.isConnecting = false;
      });

      this.client.on('ready', () => {
        // Don't ping - ioredis already confirmed connection via 'connect' event
        logger.info('[Redis] Ready and responsive');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.warn('[Redis] Connection ended');
        this.isConnected = false;
        this.isConnecting = false;
        // ioredis auto-reconnects, don't double-schedule
      });

      this.client.on('reconnecting', () => {
        this.isConnecting = true;
        this.isConnected = false;
      });

      // Don't await ping - let ioredis handle connection lifecycle
      // The 'connect' and 'ready' event handlers above will confirm status
      logger.debug('[Redis] Client created, waiting for connection...');
    } catch (error) {
      logger.error('[Redis] Failed to create client:', (error as Error).message);
      this.isConnecting = false;
      this.isConnected = false;
    }
  }

  // Lazy connect: Call this before any op
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  async set(key: string, value: string, expiresInSeconds?: number): Promise<void> {
    await this.ensureConnected();
    try {
      if (this.client && this.isConnected) {
        if (expiresInSeconds) {
          await this.client.set(key, value, 'EX', expiresInSeconds);
        } else {
          await this.client.set(key, value);
        }
      } else {
        this.useFallback('set', key, value, expiresInSeconds);
      }
    } catch (error) {
      logger.debug('[Redis] SET failed:', (error as Error).message);
      this.isConnected = false;
      this.useFallback('set', key, value, expiresInSeconds);
    }
  }

  async get(key: string): Promise<string | null> {
    await this.ensureConnected();
    try {
      if (this.client && this.isConnected) {
        return await this.client.get(key);
      } else {
        return this.getFromFallback(key);
      }
    } catch (error) {
      logger.debug('[Redis] GET failed:', (error as Error).message);
      this.isConnected = false;
      return this.getFromFallback(key);
    }
  }

  async del(key: string): Promise<void> {
    await this.ensureConnected();
    try {
      if (this.client && this.isConnected) {
        await this.client.del(key);
      } else {
        this.fallbackStore.delete(key);
      }
    } catch (error) {
      logger.debug('[Redis] DEL failed:', (error as Error).message);
      this.isConnected = false;
      this.fallbackStore.delete(key);
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    await this.ensureConnected();
    try {
      if (this.client && this.isConnected) {
        // ioredis publish returns number of clients that received the message
        return await (this.client as any).publish(channel, message);
      }
    } catch (error) {
      logger.debug('[Redis] PUBLISH failed:', (error as Error).message);
      this.isConnected = false;
    }
    return 0;
  }

  async incr(key: string): Promise<number> {
    await this.ensureConnected();
    try {
      if (this.client && this.isConnected) {
        return Number(await this.client.incr(key));
      } else {
        return this.incrFallback(key);
      }
    } catch (error) {
      logger.debug('[Redis] INCR failed:', (error as Error).message);
      this.isConnected = false;
      return this.incrFallback(key);
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.ensureConnected();
    try {
      if (this.client && this.isConnected) {
        await this.client.expire(key, seconds);
      } else {
        this.expireFallback(key, seconds);
      }
    } catch (error) {
      logger.debug('[Redis] EXPIRE failed:', (error as Error).message);
      this.isConnected = false;
      this.expireFallback(key, seconds);
    }
  }

  // Alias for set with EX
  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.set(key, value, seconds);
  }

  /**
   * Set value only if key does not already exist (NX semantics).
   * Returns true if the key was set, false if it already existed.
   */
  async setnx(key: string, value: string, expiresInSeconds?: number): Promise<boolean> {
    await this.ensureConnected();
    try {
      if (this.client && this.isConnected) {
        // ioredis: client.set(key, value, 'EX', seconds, 'NX') -> returns 'OK' or null
        if (expiresInSeconds) {
          const res = await (this.client as any).set(key, value, 'EX', expiresInSeconds, 'NX');
          return res === 'OK';
        } else {
          const res = await (this.client as any).set(key, value, 'NX');
          return res === 'OK';
        }
      } else {
        // Fallback: only set if not present in in-memory store (and not expired)
        const existing = this.getFromFallback(key);
        if (existing) return false;
        this.useFallback('set', key, value, expiresInSeconds);
        return true;
      }
    } catch (error) {
      logger.debug('[Redis] SETNX failed:', (error as Error).message);
      this.isConnected = false;
      // Fallback behavior: behave as if set succeeded to avoid blocking callers
      try {
        const existing = this.getFromFallback(key);
        if (existing) return false;
        this.useFallback('set', key, value, expiresInSeconds);
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  private useFallback(op: 'set', key: string, value: string, expires?: number): void {
    if (!this.hasLoggedFallback) {
      logger.warn('[Redis] Using in-memory fallback - data not persistent!');
      this.hasLoggedFallback = true;
    }
    this.fallbackStore.set(key, {
      value,
      expiresAt: expires ? Date.now() + expires * 1000 : Number.MAX_SAFE_INTEGER,
    });
  }

  private getFromFallback(key: string): string | null {
    const data = this.fallbackStore.get(key);
    if (!data || Date.now() > data.expiresAt) {
      this.fallbackStore.delete(key);
      return null;
    }
    return data.value;
  }

  private incrFallback(key: string): number {
    const data = this.fallbackStore.get(key);
    const num = data ? parseInt(data.value, 10) || 0 : 0;
    const newVal = num + 1;
    this.fallbackStore.set(key, {
      value: newVal.toString(),
      expiresAt: data?.expiresAt || Number.MAX_SAFE_INTEGER,
    });
    return newVal;
  }

  private expireFallback(key: string, seconds: number): void {
    const data = this.fallbackStore.get(key);
    if (data) {
      data.expiresAt = Date.now() + seconds * 1000;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      logger.info('[Redis] Scheduled reconnect attempt');
      this.client = null;
      this.isConnecting = false;
      await this.connect();
    }, 5000);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
    }
  }

  cleanupFallbackStore(): void {
    const now = Date.now();
    for (const [key, data] of [...this.fallbackStore.entries()]) {
      if (now > data.expiresAt) {
        this.fallbackStore.delete(key);
      }
    }
  }
}

export const redis = new RedisService();

// Auto-clean fallback every 5min
setInterval(() => redis.cleanupFallbackStore(), 300000);

// Global unhandled rejection handler to close Redis gracefully
process.on('unhandledRejection', async (reason) => {
  logger.error('Unhandled rejection:', reason);
  await redis.disconnect();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await redis.disconnect();
  process.exit(0);
});