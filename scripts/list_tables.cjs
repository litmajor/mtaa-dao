const { Client } = require('pg');
(async () => {
  try {
    const c = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await c.connect();
    const res = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;");
    console.log(res.rows.map(r => r.table_name).join('\n'));
    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
