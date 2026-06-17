import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema.js";
import { metricsCollector } from './monitoring/metricsCollector';

const DEFAULT_POOL_MAX = parseInt(process.env.DATABASE_POOL_MAX || '20', 10);
const DEFAULT_IDLE_TIMEOUT = parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || '30000', 10);
const DEFAULT_CONN_TIMEOUT = parseInt(process.env.DATABASE_POOL_CONN_TIMEOUT_MS || '30000', 10);

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
  ssl: process.env.DATABASE_SSL === 'true' || false,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
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
      console.log('✅ PostgreSQL connected successfully');
      client.release();
      return;
    } catch (err: any) {
      const attempt = i + 1;
      const delay = Math.min(initialDelayMs * Math.pow(2, i), maxDelayMs);
      if (attempt < retries) {
        console.log(`⏳ PostgreSQL connection attempt ${attempt}/${retries} failed, retrying in ${Math.round(delay/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ Failed to connect to PostgreSQL after retries:', err?.message || err);
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
      const total = (pool as any).totalCount ?? 0;
      const idle = (pool as any).idleCount ?? 0;
      const waiting = (pool as any).waitingCount ?? 0;

      // Report detailed pool gauges to metrics collector
      metricsCollector.reportDbPoolMetrics(total, idle, waiting);
    } catch (err) {
      // avoid crashing the process if metric collection fails
      console.error('Error collecting DB pool metrics:', err);
    }
  }, 10000);
} catch (err) {
  console.error('Failed to start DB metrics emitter:', err);
}