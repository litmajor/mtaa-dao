import { createClient } from 'redis';
import { promisify } from 'util';

export class RedisClient {
  private client: ReturnType<typeof createClient>;
  private maxRetries = 5;
  private retryDelay = 1000;

  constructor(redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > this.maxRetries) {
            console.error(`Redis: Max retries (${this.maxRetries}) exceeded`);
            return new Error('Max retries exceeded');
          }
          return Math.min(retries * this.retryDelay, 3000);
        },
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('error', (err) => {
      console.error('Redis Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis connected');
    });

    this.client.on('disconnect', () => {
      console.log('Redis disconnected');
    });

    this.client.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('Redis client connected successfully');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.disconnect();
      console.log('Redis client disconnected');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, expirationSeconds?: number): Promise<boolean> {
    try {
      if (expirationSeconds) {
        await this.client.setEx(key, expirationSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Redis DELETE error for key ${key}:`, error);
      return false;
    }
  }

  async deleteMany(keys: string[]): Promise<number> {
    try {
      return await this.client.del(keys);
    } catch (error) {
      console.error(`Redis MDELETE error for keys ${keys}:`, error);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  async setObject(key: string, obj: any, expirationSeconds?: number): Promise<boolean> {
    try {
      const value = JSON.stringify(obj);
      return this.set(key, value, expirationSeconds);
    } catch (error) {
      console.error(`Redis SET_OBJECT error for key ${key}:`, error);
      return false;
    }
  }

  async getObject<T>(key: string): Promise<T | null> {
    try {
      const value = await this.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Redis GET_OBJECT error for key ${key}:`, error);
      return null;
    }
  }

  async increment(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error(`Redis INCR error for key ${key}:`, error);
      return -1;
    }
  }

  async decrement(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      console.error(`Redis DECR error for key ${key}:`, error);
      return -1;
    }
  }

  async lpush(key: string, value: string): Promise<number> {
    try {
      return await this.client.lPush(key, value);
    } catch (error) {
      console.error(`Redis LPUSH error for key ${key}:`, error);
      return -1;
    }
  }

  async rpush(key: string, value: string): Promise<number> {
    try {
      return await this.client.rPush(key, value);
    } catch (error) {
      console.error(`Redis RPUSH error for key ${key}:`, error);
      return -1;
    }
  }

  async lpop(key: string): Promise<string | null> {
    try {
      return await this.client.lPop(key);
    } catch (error) {
      console.error(`Redis LPOP error for key ${key}:`, error);
      return null;
    }
  }

  async getClient() {
    return this.client;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
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
