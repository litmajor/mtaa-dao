#!/usr/bin/env node
const { Client } = require('pg');

(async () => {
  const dbUrl = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING || process.env.DB_URL || process.env.NEON_DB_URL || process.env.PG_CONNECTION;
  if (!dbUrl) {
    console.error('No DATABASE_URL found in environment');
    process.exit(2);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('neon') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    const existsRes = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='reward_requests') AS exists;");
    const exists = existsRes.rows[0]?.exists;
    console.log('reward_requests exists:', exists);

    if (exists) {
      const countRes = await client.query('SELECT COUNT(*)::int AS cnt FROM reward_requests;');
      console.log('row count:', countRes.rows[0]?.cnt ?? 0);

      const sample = await client.query('SELECT id, user_id, status, created_at FROM reward_requests ORDER BY created_at DESC LIMIT 3;');
      console.log('sample rows:', sample.rows);
    }

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Query failed:', err && err.message ? err.message : err);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
})();
