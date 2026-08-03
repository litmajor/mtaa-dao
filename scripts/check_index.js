import 'dotenv/config';
import { Pool } from 'pg';

(async function(){
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon') ? { rejectUnauthorized: false } : false,
  });
  try {
    const res = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename='daos' AND indexname='daos_name_unique_idx'");
    console.log('index rows:', res.rows);
    const duplicates = await pool.query("SELECT lower(name) AS normalized, count(*) AS count FROM daos GROUP BY lower(name) HAVING count(*) > 1");
    console.log('duplicate lower(name) rows:', duplicates.rows);
  } catch (err) {
    console.error('Error querying indexes:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
