import type { Request, Response, NextFunction } from 'express';

/**
 * Cache control middleware for static assets
 */
export function staticAssetCache(req: Request, res: Response, next: NextFunction) {
  // Added 'i' flag for case-insensitive extension matching (.PNG, .JS, etc.)
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (req.path.match(/\.html$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=300');
  }
  next();
}

/**
 * API response caching headers (Delegates ETag to Express default)
 */
export function apiCache(maxAge: number = 60, isPrivate: boolean = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const visibility = isPrivate ? 'private' : 'public';
    res.setHeader('Cache-Control', `${visibility}, max-age=${maxAge}`);
    
    // Note: Express automatically generates valid ETags for res.send/res.json by default.
    next();
  };
}

/**
 * No-cache middleware for sensitive endpoints
 */
export function noCache(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

/**
 * In-memory cache with cleanup safety
 */
class SimpleCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private ttl: number;

  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000;
    
    // .unref() prevents timer from blocking process exit / Jest tests
    const timer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (timer.unref) timer.unref();
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.ttl;
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

export const memoryCache = new SimpleCache(300);

/**
 * Middleware to cache successful GET API responses in memory safely
 */
export function memoryCacheMiddleware(ttlSeconds: number = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    // Key includes user ID to avoid serving cached user data to the wrong person
    const userId = (req as any).user?.id || 'anonymous';
    const cacheKey = `${userId}:${req.method}:${req.originalUrl}`;

    const cachedResponse = memoryCache.get(cacheKey);

    if (cachedResponse) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedResponse);
    }

    res.setHeader('X-Cache', 'MISS');

    // Override res.json to capture response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Only cache successful 2xx responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        memoryCache.set(cacheKey, body, ttlSeconds);
      }
      return originalJson(body);
    };

    next();
  };
}