import { Request, Response, NextFunction } from 'express';

/**
 * Cache control middleware for static assets
 * Sets appropriate cache headers based on file type
 */
export function staticAssetCache(req: Request, res: Response, next: NextFunction) {
  // Cache static assets for 1 year
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // Cache HTML for 5 minutes
  else if (req.path.match(/\.html$/)) {
    res.setHeader('Cache-Control', 'public, max-age=300');
  }
  next();
}

/**
 * API response caching middleware
 * Sets ETag for conditional requests
 */
export function apiCache(maxAge: number = 60) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Set cache control header
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    
    // Enable ETag for conditional requests
    res.setHeader('ETag', `W/"${Date.now()}"`);

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
 * In-memory cache for expensive operations
 */
class SimpleCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private ttl: number;

  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000;
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
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
      expires: Date.now() + ttl
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

// Export singleton cache instance
export const memoryCache = new SimpleCache(300); // 5 minutes default TTL

/**
 * Middleware to cache API responses in memory
 */
export function memoryCacheMiddleware(ttlSeconds: number = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${req.method}:${req.originalUrl}`;
    const cachedResponse = memoryCache.get(cacheKey);

    if (cachedResponse) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedResponse);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      memoryCache.set(cacheKey, body, ttlSeconds);
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}
