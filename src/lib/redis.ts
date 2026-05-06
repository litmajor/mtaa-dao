import Redis from 'ioredis'; // Use ioredis for better stability on Windows/Docker

export class RedisClient {
  private client: Redis | null = null;
  private maxRetries = 10; // Increased from 3 for more resilience
  private retryDelay = 1000;
  private isEnabled = false;
  private hasLoggedDisabled = false;
  private redisOptions: any = {}; // Store for reconnect

  constructor(redisUrl?: string) {
    // Build REDIS_URL from environment variables if not provided
    if (!redisUrl) {
      const host = process.env.REDIS_HOST || 'localhost';
      const port = process.env.REDIS_PORT || '6379';
      const password = process.env.REDIS_PASSWORD;
      const db = process.env.REDIS_DB || '0';
      
      if (password) {
        redisUrl = `redis://:${encodeURIComponent(password)}@${host}:${port}/${db}`;
      } else if (process.env.REDIS_URL) {
        redisUrl = process.env.REDIS_URL;
      } else {
        redisUrl = `redis://${host}:${port}/${db}`;
      }
    }
    
    this.isEnabled = !!redisUrl && redisUrl.startsWith('redis://');
    
    if (!this.isEnabled) {
      if (!this.hasLoggedDisabled) {
        console.log('Redis: Not configured - operations will be no-op.');
        this.hasLoggedDisabled = true;
      }
      return;
    }

    this.redisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: Number(process.env.REDIS_DB) || 0,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        if (times > this.maxRetries) {
          return new Error('Max retries exceeded');
        }
        const delay = Math.min(times * this.retryDelay, 5000);
        console.log(`[Redis] Reconnect attempt ${times} after ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['ECONNRESET', 'ETIMEDOUT', 'Socket closed unexpectedly'];
        return targetErrors.some(e => err.message.includes(e));
      },
      keepAlive: 30000, // NEW: Send keepalive pings every 30s to prevent socket closure
      noDelay: true,
      connectionName: 'mtaa-dao-server', // For Redis logs/debug
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.client) return;
    
    this.client.on('error', (err: Error) => {
      console.warn('[Redis] Error:', err.message);
    });

    this.client.on('connect', () => {
      console.log('[Redis] Connected');
    });

    this.client.on('ready', () => {
      console.log('[Redis] Ready for commands');
    });

    this.client.on('close', () => {
      console.log('[Redis] Connection closed');
    });

    this.client.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });
  }

  async connect() {
    if (!this.isEnabled || this.client) {
      return;
    }
    
    try {
      this.client = new Redis(this.redisOptions);
      await this.client.ping(); // Test connection
      console.log('Redis client connected successfully');
    } catch (error) {
      console.error('[Redis] Connect failed:', (error as Error).message);
      this.isEnabled = false;
    }
  }

  async disconnect() {
    if (!this.isEnabled || !this.client) return;
    try {
      await this.client.quit();
    } catch (error) {
      console.warn('[Redis] Disconnect error:', (error as Error).message);
    } finally {
      this.client = null;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client) {
      await this.connect();
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isEnabled) return null;
    await this.ensureConnected();
    try {
      return await this.client.get(key);
    } catch (error) {
      console.debug('[Redis] GET failed:', (error as Error).message);
      return null;
    }
  }

  async set(key: string, value: string, expirationSeconds?: number): Promise<boolean> {
    if (!this.isEnabled) return false;
    await this.ensureConnected();
    try {
      if (expirationSeconds) {
        await this.client.set(key, value, { EX: expirationSeconds });
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.debug('[Redis] SET failed:', (error as Error).message);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isEnabled) return false;
    await this.ensureConnected();
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.debug('[Redis] DEL failed:', (error as Error).message);
      return false;
    }
  }

  async delMany(keys: string[]): Promise<number> {
    if (!this.isEnabled) return 0;
    await this.ensureConnected();
    try {
      return await this.client.del(keys);
    } catch (error) {
      console.debug('[Redis] DELMANY failed:', (error as Error).message);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled) return false;
    await this.ensureConnected();
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.debug('[Redis] EXISTS failed:', (error as Error).message);
      return false;
    }
  }

  async setObject(key: string, obj: any, expirationSeconds?: number): Promise<boolean> {
    if (!this.isEnabled) return false;
    try {
      const value = JSON.stringify(obj);
      return await this.set(key, value, expirationSeconds);
    } catch (error) {
      console.debug('[Redis] SETOBJECT failed:', (error as Error).message);
      return false;
    }
  }

  async getObject<T>(key: string): Promise<T | null> {
    if (!this.isEnabled) return null;
    try {
      const value = await this.get(key);
      return value ? JSON.parse(value) as T : null;
    } catch (error) {
      console.debug('[Redis] GETOBJECT failed:', (error as Error).message);
      return null;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.isEnabled) return -1;
    await this.ensureConnected();
    try {
      return Number(await this.client.incr(key));
    } catch (error) {
      console.debug('[Redis] INCR failed:', (error as Error).message);
      return -1;
    }
  }

  async decr(key: string): Promise<number> {
    if (!this.isEnabled) return -1;
    await this.ensureConnected();
    try {
      return Number(await this.client.decr(key));
    } catch (error) {
      console.debug('[Redis] DECR failed:', (error as Error).message);
      return -1;
    }
  }

  async lPush(key: string, value: string): Promise<number> {
    if (!this.isEnabled) return -1;
    await this.ensureConnected();
    try {
      return Number(await this.client.lPush(key, value));
    } catch (error) {
      console.debug('[Redis] LPUSH failed:', (error as Error).message);
      return -1;
    }
  }

  async rPush(key: string, value: string): Promise<number> {
    if (!this.isEnabled) return -1;
    await this.ensureConnected();
    try {
      return Number(await this.client.rPush(key, value));
    } catch (error) {
      console.debug('[Redis] RPUSH failed:', (error as Error).message);
      return -1;
    }
  }

  async lPop(key: string): Promise<string | null> {
    if (!this.isEnabled) return null;
    await this.ensureConnected();
    try {
      return await this.client.lPop(key);
    } catch (error) {
      console.debug('[Redis] LPOP failed:', (error as Error).message);
      return null;
    }
  }

  async getClient(): Promise<Redis | null> {
    await this.ensureConnected();
    return this.client;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isEnabled) return false;
    await this.ensureConnected();
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.debug('[Redis] Health check failed:', (error as Error).message);
      return false;
    }
  }
}

// Singleton instance
let redisInstance: RedisClient | null = null;

export async function getRedisClient(): Promise<RedisClient> {
  if (!redisInstance) {
    redisInstance = new RedisClient();
    await redisInstance.connect();
  }
  return redisInstance;
}

export async function closeRedisClient() {
  if (redisInstance) {
    await redisInstance.disconnect();
    redisInstance = null;
  }
}

// Periodic health check (every 30s)
setInterval(async () => {
  const client = await getRedisClient();
  const healthy = await client.isHealthy();
  if (!healthy) {
    console.warn('[Redis] Health check failed - may trigger reconnect');
  }
}, 30000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closeRedisClient();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeRedisClient();
  process.exit(0);
});