#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sqlPath = process.argv[2] || path.join('server', 'migrations', '2026-06-17_create_reward_requests_table.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    process.exit(2);
  }

  const dbUrl = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING || process.env.DB_URL || process.env.NEON_DB_URL || process.env.PG_CONNECTION;
  if (!dbUrl) {
    console.error('No database connection string found. Set DATABASE_URL environment variable.');
    process.exit(2);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('neon') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log(`Connecting to DB and applying migration: ${sqlPath}`);
    await client.connect();
    // Execute SQL as-is (file may include BEGIN/COMMIT)
    await client.query(sql);
    console.log('Migration applied successfully.');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err && err.message ? err.message : err);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

main();
