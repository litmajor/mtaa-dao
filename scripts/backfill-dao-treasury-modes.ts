import 'dotenv/config';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const DRY_RUN = process.env.DRY_RUN !== 'false';

const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const normalizeDaoTypeSql = `
      UPDATE daos
      SET dao_type = 'investment_club'
      WHERE dao_type IN ('investment-group', 'investment_group', 'club');
    `;

    const normalizeDurationSql = `
      UPDATE daos
      SET duration_model = 'ongoing'
      WHERE dao_type = 'investment_club'
        AND (duration_model IS NULL OR duration_model = '' OR duration_model NOT IN ('ongoing', 'time', 'rotation'));
    `;

    const normalizeWithdrawalSql = `
      UPDATE daos
      SET withdrawal_mode = 'multisig'
      WHERE dao_type = 'investment_club'
        AND (withdrawal_mode IS NULL OR withdrawal_mode = '' OR withdrawal_mode NOT IN ('multisig', 'direct', 'rotation'));
    `;

    const statements = [
      ['normalize dao_type aliases', normalizeDaoTypeSql],
      ['normalize duration model', normalizeDurationSql],
      ['normalize withdrawal mode', normalizeWithdrawalSql],
    ] as const;

    for (const [name, sql] of statements) {
      const result = await client.query(sql);
      console.log(`${name}: ${result.rowCount ?? 0} rows affected`);
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('DRY_RUN=true -> rolled back changes');
    } else {
      await client.query('COMMIT');
      console.log('Backfill committed successfully');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
