import 'dotenv/config';
import { Pool } from 'pg';

const INTERVAL_MS = parseInt(process.env.DB_PROBE_INTERVAL_MS || '1000', 10);
const SAMPLE_COUNT = parseInt(process.env.DB_PROBE_SAMPLES || '60', 10);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const probePool = new Pool({ connectionString: process.env.DATABASE_URL });

async function sample(index: number) {
  try {
    const res = await probePool.query(`
      SELECT pid, usename, application_name, client_addr, state, query_start, now() - query_start AS duration, substring(query, 1, 300) AS query
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
      ORDER BY query_start DESC
      LIMIT 50;
    `);

    const countRes = await probePool.query(`
      SELECT count(*) FILTER (WHERE state = 'active') AS active,
             count(*) FILTER (WHERE state <> 'active') AS others
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid();
    `);

    const active = countRes.rows[0].active;
    const others = countRes.rows[0].others;

    const poolTotals = {
      total: (probePool as any).totalCount ?? 'n/a',
      idle: (probePool as any).idleCount ?? 'n/a',
      waiting: (probePool as any).waitingCount ?? 'n/a',
      active: Math.max(0, ((probePool as any).totalCount ?? 0) - ((probePool as any).idleCount ?? 0)),
    };

    console.log(`\n[DB PROBE] sample=${index + 1}/${SAMPLE_COUNT} time=${new Date().toISOString()}`);
    console.log(`[DB PROBE] pool=${JSON.stringify(poolTotals)} db_active=${active} db_others=${others}`);

    if (res.rows.length === 0) {
      console.log('[DB PROBE] no other backends active');
    } else {
      console.log('[DB PROBE] recent activity:');
      for (const r of res.rows) {
        console.log(` pid=${r.pid} app=${r.application_name} user=${r.usename} client=${r.client_addr} state=${r.state} dur=${r.duration} query=${r.query}`);
      }
    }

    // Also capture pg_settings for connection limits
    const setting = await probePool.query(`SELECT name, setting FROM pg_settings WHERE name IN ('max_connections')`);
    console.log('[DB PROBE] postgres settings:', setting.rows.map((r: any) => `${r.name}=${r.setting}`).join(', '));
  } catch (err) {
    console.error('[DB PROBE] error:', err instanceof Error ? err.message : String(err));
  }
}

(async () => {
  console.log('[DB PROBE] Starting probe; press Ctrl+C to stop');
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    await sample(i);
    await new Promise((res) => setTimeout(res, INTERVAL_MS));
  }

  await probePool.end();
  console.log('[DB PROBE] Completed samples; exiting');
  process.exit(0);
})();
