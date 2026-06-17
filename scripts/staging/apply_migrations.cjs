#!/usr/bin/env node
// Simple migration runner for staging: executes all .sql files in server/db/migrations
try { require('dotenv').config(); } catch (e) {}
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'server', 'db', 'migrations');
const dbUrl = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
if (!dbUrl) {
  console.error('DATABASE_URL is not set. Set it in .env or pass env var.');
  process.exit(1);
}

(async function main() {
  const pool = new Pool({ connectionString: dbUrl, ssl: process.env.DATABASE_SSL === 'true' || false });
  const client = await pool.connect();
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    console.log('migrations to run:', files);
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log('Running', file);
      try {
        await client.query(sql);
      } catch (err) {
        console.error('migration error', file, err.message || err);
        // continue to next migration
      }
    }
    console.log('migrations complete');
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
})();
