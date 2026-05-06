import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Increased pool to handle concurrent startup logging (30+ services initializing)
  max: 50, // Was 20, increased to 50 for concurrent startup operations
  idleTimeoutMillis: 10000, // Was 30000, reduced to 10s to free connections faster
  connectionTimeoutMillis: 15000, // Was 30000, reduced to 15s for faster failure detection
  keepAlive: true,
  keepAliveInitialDelayMs: 10000,
  // Add retry logic
  ssl: false,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Test connection on startup with retry logic
async function testConnection(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('✅ PostgreSQL connected successfully');
      client.release();
      return;
    } catch (err: any) {
      const attempt = i + 1;
      if (attempt < retries) {
        console.log(`⏳ PostgreSQL connection attempt ${attempt}/${retries} failed, retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ Failed to connect to PostgreSQL:', err.message);
        console.error('   Please check your DATABASE_URL in .env file');
        console.error('   Example: DATABASE_URL=postgresql://user:password@localhost:5432/database');
      }
    }
  }
}

testConnection();

// Export typed database instance
export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });