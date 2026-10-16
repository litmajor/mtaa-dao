import { pool } from '../../db';

export async function migrateTreasuryEventCursors(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS treasury_event_cursors (
      contract_address VARCHAR(42) PRIMARY KEY,
      last_processed_block BIGINT NOT NULL DEFAULT -1,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

export async function rollbackTreasuryEventCursors(): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS treasury_event_cursors;');
}
