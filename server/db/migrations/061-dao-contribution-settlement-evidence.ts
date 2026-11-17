import { pool } from '../../db';

export async function migrateDaoContributionSettlementEvidence() {
  const duplicate = await pool.query(`
    SELECT stable_inflow_event_id
    FROM wallet_transactions
    WHERE stable_inflow_event_id IS NOT NULL
    GROUP BY stable_inflow_event_id
    HAVING COUNT(*) > 1
    LIMIT 1
  `);
  if (duplicate.rows.length > 0) {
    throw new Error(
      `Cannot enforce one treasury credit per stable inflow: duplicate event ${duplicate.rows[0].stable_inflow_event_id}`,
    );
  }

  await pool.query(`
    ALTER TABLE wallet_transactions
      ALTER COLUMN amount TYPE NUMERIC(38, 18)
      USING amount::NUMERIC(38, 18);

    CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_stable_inflow_event_uq
      ON wallet_transactions (stable_inflow_event_id)
      WHERE stable_inflow_event_id IS NOT NULL;
  `);
}

export async function rollbackDaoContributionSettlementEvidence() {
  await pool.query(`
    DROP INDEX IF EXISTS wallet_transactions_stable_inflow_event_uq;
  `);
}
