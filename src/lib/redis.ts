import { createClient } from 'redis';
import { promisify } from 'util';

export class RedisClient {
  private client: ReturnType<typeof createClient> | null = null;
  private maxRetries = 3;
  private retryDelay = 1000;
  private isEnabled = false;
  private hasLoggedDisabled = false;

  constructor(redisUrl: string = process.env.REDIS_URL || '') {
    this.isEnabled = !!redisUrl && redisUrl !== 'redis://localhost:6379';
    
    if (!this.isEnabled) {
      if (!this.hasLoggedDisabled) {
        console.log('Redis: Not configured (REDIS_URL not set). Using in-memory fallback.');
        this.hasLoggedDisabled = true;
      }
      return;
    }

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > this.maxRetries) {
            return new Error('Max retries exceeded');
          }
          return Math.min(retries * this.retryDelay, 3000);
        },
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.client) return;
    
    this.client.on('error', () => {
      // Silently handle Redis errors when not configured
    });

    this.client.on('connect', () => {
      console.log('Redis connected');
    });

    this.client.on('disconnect', () => {
      // Silent disconnect
    });

    this.client.on('reconnecting', () => {
      // Silent reconnecting
    });
  }

  async connect() {
    if (!this.isEnabled || !this.client) {
      return;
    }
    
    try {
      await this.client.connect();
      console.log('Redis client connected successfully');
    } catch (error) {
      this.isEnabled = false;
    }
  }

  async disconnect() {
    if (!this.isEnabled || !this.client) return;
    try {
      await this.client.disconnect();
    } catch (error) {
      // Silent error
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isEnabled || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      return null;
    }
  }

  async set(key: string, value: string, expirationSeconds?: number): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;
    try {
      if (expirationSeconds) {
        await this.client.setEx(key, expirationSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      return false;
    }
  }

  async deleteMany(keys: string[]): Promise<number> {
    if (!this.isEnabled || !this.client) return 0;
    try {
      return await this.client.del(keys);
    } catch (error) {
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  async setObject(key: string, obj: any, expirationSeconds?: number): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;
    try {
      const value = JSON.stringify(obj);
      return this.set(key, value, expirationSeconds);
    } catch (error) {
      return false;
    }
  }

  async getObject<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.client) return null;
    try {
      const value = await this.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  async increment(key: string): Promise<number> {
    if (!this.isEnabled || !this.client) return -1;
    try {
      return await this.client.incr(key);
    } catch (error) {
      return -1;
    }
  }

  async decrement(key: string): Promise<number> {
    if (!this.isEnabled || !this.client) return -1;
    try {
      return await this.client.decr(key);
    } catch (error) {
      return -1;
    }
  }

  async lpush(key: string, value: string): Promise<number> {
    if (!this.isEnabled || !this.client) return -1;
    try {
      return await this.client.lPush(key, value);
    } catch (error) {
      return -1;
    }
  }

  async rpush(key: string, value: string): Promise<number> {
    if (!this.isEnabled || !this.client) return -1;
    try {
      return await this.client.rPush(key, value);
    } catch (error) {
      return -1;
    }
  }

  async lpop(key: string): Promise<string | null> {
    if (!this.isEnabled || !this.client) return null;
    try {
      return await this.client.lPop(key);
    } catch (error) {
      return null;
    }
  }

  async getClient() {
    return this.client;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;
    try {
      await this.client.ping();
      return true;
    } catch (error) {
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
