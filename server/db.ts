import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema.js";
import { metricsCollector } from './monitoring/metricsCollector';

const DEFAULT_POOL_MAX = parseInt(process.env.DATABASE_POOL_MAX || '50', 10);
const DEFAULT_IDLE_TIMEOUT = parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || '30000', 10);
const DEFAULT_CONN_TIMEOUT = parseInt(process.env.DATABASE_POOL_CONN_TIMEOUT_MS || '120000', 10);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Pool settings are configurable via env vars with safe defaults
  max: DEFAULT_POOL_MAX,
  idleTimeoutMillis: DEFAULT_IDLE_TIMEOUT,
  connectionTimeoutMillis: DEFAULT_CONN_TIMEOUT,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Smart SSL detection: enable for Neon or when explicitly requested
  ssl: process.env.DATABASE_URL.includes('neon') || process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
});

// Handle pool errors
pool.on('error', (err: unknown) => {
  console.error('Unexpected PostgreSQL pool error:', err instanceof Error ? err.message : String(err));
});

// Export a wait helper for startup to block until DB is available.
// Uses exponential backoff and configurable retries via env or params.
export async function waitForDatabase(options?: { retries?: number; initialDelayMs?: number; maxDelayMs?: number }) {
  const retries = options?.retries ?? parseInt(process.env.DATABASE_WAIT_RETRIES || '10', 10);
  const initialDelayMs = options?.initialDelayMs ?? parseInt(process.env.DATABASE_WAIT_INITIAL_DELAY_MS || '2000', 10);
  const maxDelayMs = options?.maxDelayMs ?? parseInt(process.env.DATABASE_WAIT_MAX_DELAY_MS || '60000', 10);

  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('PostgreSQL connected successfully');
      client.release();
      return;
    } catch (err: unknown) {
      const attempt = i + 1;
      const delay = Math.min(initialDelayMs * Math.pow(2, i), maxDelayMs);
      if (attempt < retries) {
        console.log(`⏳ PostgreSQL connection attempt ${attempt}/${retries} failed, retrying in ${Math.round(delay/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ Failed to connect to PostgreSQL after retries:', err instanceof Error ? err.message : String(err));
        console.error('   Please check your DATABASE_URL and network connectivity');
        throw err;
      }
    }
  }
}

// Export typed database instance
export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

// Emit pool metrics periodically to metricsCollector
try {
  // report every 10s
  setInterval(() => {
    try {
      const total = (pool as Pool & { totalCount?: number }).totalCount ?? 0;
      const idle = (pool as Pool & { idleCount?: number }).idleCount ?? 0;
      const waiting = (pool as Pool & { waitingCount?: number }).waitingCount ?? 0;
      const active = Math.max(0, total - idle);

      // Report detailed pool gauges to metrics collector
      metricsCollector.reportDbPoolMetrics(total, idle, waiting);

      const poolStatus = `total=${total}, idle=${idle}, active=${active}, waiting=${waiting}`;
      if (waiting > 0 || idle <= 2 || active >= Math.max(1, DEFAULT_POOL_MAX - 2)) {
        console.warn(`[DB POOL] ${poolStatus}`);
      } else {
        console.debug(`[DB POOL] ${poolStatus}`);
      }
    } catch (err: unknown) {
      // avoid crashing the process if metric collection fails
      console.error('Error collecting DB pool metrics:', err instanceof Error ? err.message : String(err));
    }
  }, 10000);
} catch (err) {
  console.error('Failed to start DB metrics emitter:', err instanceof Error ? err.message : String(err));
}