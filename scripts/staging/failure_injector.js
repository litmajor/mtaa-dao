#!/usr/bin/env node
// Failure injector for staging: mark a percentage of payment_sagas as failed or inject errors
// Usage example:
// node failure_injector.js --dbUrl=postgres://... --percent=10 --action=fail
// node failure_injector.js --dbUrl=postgres://... --percent=5 --action=clear

const { Pool } = require('pg');
const args = require('minimist')(process.argv.slice(2));
const dbUrl = args.dbUrl || process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
const percent = Number(args.percent || 10);
const action = args.action || 'fail'; // fail | clear

if (!dbUrl) {
  console.error('Provide --dbUrl or set DATABASE_URL');
  process.exit(1);
}

(async () => {
  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();
  try {
    // select a sample of saga ids
    const res = await client.query('SELECT id FROM payment_sagas ORDER BY random() LIMIT $1', [1000]);
    const ids = res.rows.map(r => r.id);
    const targetCount = Math.max(1, Math.floor((percent / 100) * ids.length));
    const selected = ids.slice(0, targetCount);
    console.log('selected', selected.length, 'sagas for action', action);
    if (action === 'fail') {
      for (const id of selected) {
        await client.query('UPDATE payment_sagas SET status = $1, last_error = $2, updated_at = now() WHERE id = $3', ['failed', 'injected failure by failure_injector', id]);
      }
    } else if (action === 'clear') {
      for (const id of selected) {
        await client.query("UPDATE payment_sagas SET status = 'pending', last_error = NULL, updated_at = now() WHERE id = $1", [id]);
      }
    } else if (action === 'slow') {
      // mark created_at far in the past to simulate long-running
      for (const id of selected) {
        await client.query("UPDATE payment_sagas SET created_at = now() - interval '2 hours', updated_at = now() WHERE id = $1", [id]);
      }
    } else {
      console.error('unknown action', action);
    }
    console.log('done');
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
})();
