/**
 * Redis Connection Helper Utilities
 * 
 * Provides consistent Redis URL building and connection management
 * across tests and services.
 * 
 * Usage:
 * ```typescript
 * import { buildRedisUrl, getRedisConfig } from './redisHelper';
 * 
 * // Build URL for connection
 * const url = buildRedisUrl();
 * 
 * // Or get full config object
 * const config = getRedisConfig();
 * ```
 */

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  url: string;
}

/**
 * Build Redis connection URL with proper authentication and database selection
 * 
 * Supports environment variables:
 * - REDIS_URL: Full URL (takes precedence)
 * - REDIS_HOST: Server hostname (default: localhost)
 * - REDIS_PORT: Server port (default: 6379)
 * - REDIS_PASSWORD: Authentication password (optional)
 * - REDIS_DB: Database index (default: 0)
 * 
 * @param overrides - Override specific config values
 * @returns Redis connection URL
 */
export function buildRedisUrl(overrides: Partial<RedisConfig> = {}): string {
  // Check for full URL first
  if (overrides.url || process.env.REDIS_URL) {
    return overrides.url || process.env.REDIS_URL!;
  }

  const host = overrides.host || process.env.REDIS_HOST || 'localhost';
  const port = overrides.port || parseInt(process.env.REDIS_PORT || '6379');
  const password = overrides.password || process.env.REDIS_PASSWORD;
  const db = overrides.db !== undefined ? overrides.db : parseInt(process.env.REDIS_DB || '0');

  // Construct URL with authentication
  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}/${db}`;
  } else {
    return `redis://${host}:${port}/${db}`;
  }
}

/**
 * Get full Redis configuration object
 * 
 * @param overrides - Override specific config values
 * @returns Redis configuration object
 */
export function getRedisConfig(overrides: Partial<RedisConfig> = {}): RedisConfig {
  const host = overrides.host || process.env.REDIS_HOST || 'localhost';
  const port = overrides.port || parseInt(process.env.REDIS_PORT || '6379');
  const password = overrides.password || process.env.REDIS_PASSWORD;
  const db = overrides.db !== undefined ? overrides.db : parseInt(process.env.REDIS_DB || '0');
  const url = overrides.url || buildRedisUrl({ host, port, password, db });

  return {
    host,
    port,
    password,
    db,
    url,
  };
}

/**
 * Validate Redis connection configuration
 * 
 * @returns true if Redis appears to be properly configured
 */
export function isRedisConfigured(): boolean {
  const url = buildRedisUrl();
  return !!url && url.trim().length > 0;
}
