import { createClient, RedisClientType } from 'redis';

class RedisService {
  private client: RedisClientType | null = null;
  private fallbackStore = new Map<string, { value: string; expiresAt: number }>();
  private isConnected = false;
  private hasLoggedFallback = false;

  async connect(): Promise<void> {
    // Only attempt Redis connection if REDIS_URL is configured
    if (!process.env.REDIS_URL) {
      if (!this.hasLoggedFallback) {
        console.log('Redis: Not configured - using in-memory fallback.');
        this.hasLoggedFallback = true;
      }
      this.isConnected = false;
      return;
    }

    try {
      this.client = createClient({
        url: process.env.REDIS_URL,
      });

      this.client.on('error', () => {
        // Silently handle Redis errors - fallback is already in use
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis connected successfully');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      this.isConnected = false;
    }
  }

  async set(key: string, value: string, expiresInSeconds?: number): Promise<void> {
    try {
      if (this.isConnected && this.client) {
        if (expiresInSeconds) {
          await this.client.setEx(key, expiresInSeconds, value);
        } else {
          await this.client.set(key, value);
        }
      } else {
        // Fallback to in-memory store
        this.fallbackStore.set(key, {
          value,
          expiresAt: expiresInSeconds
            ? Date.now() + expiresInSeconds * 1000
            : Number.MAX_SAFE_INTEGER,
        });
      }
    } catch (error) {
      console.error('Redis SET error:', error);
      // Fallback to in-memory on error
      this.fallbackStore.set(key, {
        value,
        expiresAt: expiresInSeconds
          ? Date.now() + expiresInSeconds * 1000
          : Number.MAX_SAFE_INTEGER,
      });
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (this.isConnected && this.client) {
        return await this.client.get(key);
      } else {
        // Fallback to in-memory store
        const data = this.fallbackStore.get(key);
        if (!data) return null;
        
        if (Date.now() > data.expiresAt) {
          this.fallbackStore.delete(key);
          return null;
        }
        
        return data.value;
      }
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.isConnected && this.client) {
        await this.client.del(key);
      } else {
        this.fallbackStore.delete(key);
      }
    } catch (error) {
      console.error('Redis DELETE error:', error);
      this.fallbackStore.delete(key);
    }
  }

  async increment(key: string): Promise<number> {
    try {
      if (this.isConnected && this.client) {
        return await this.client.incr(key);
      } else {
        const current = this.fallbackStore.get(key);
        const newValue = (current ? parseInt(current.value) : 0) + 1;
        this.fallbackStore.set(key, {
          value: newValue.toString(),
          expiresAt: current?.expiresAt || Number.MAX_SAFE_INTEGER,
        });
        return newValue;
      }
    } catch (error) {
      console.error('Redis INCREMENT error:', error);
      return 1;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      if (this.isConnected && this.client) {
        await this.client.expire(key, seconds);
      } else {
        const current = this.fallbackStore.get(key);
        if (current) {
          this.fallbackStore.set(key, {
            ...current,
            expiresAt: Date.now() + seconds * 1000,
          });
        }
      }
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // Cleanup expired keys in fallback store (run periodically)
  cleanupFallbackStore(): void {
    const now = Date.now();
    for (const [key, data] of this.fallbackStore.entries()) {
      if (now > data.expiresAt) {
        this.fallbackStore.delete(key);
      }
    }
  }
}

export const redis = new RedisService();

// Cleanup fallback store every 5 minutes
setInterval(() => {
  redis.cleanupFallbackStore();
}, 5 * 60 * 1000);

