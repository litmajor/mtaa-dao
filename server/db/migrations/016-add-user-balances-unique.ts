import { pool } from '../../db';

export async function migrateAddUserBalancesUnique() {
  try {
    console.log('🔄 Ensuring unique constraint on user_balances (user_id, dao_id, currency)');

    // Use expression index to treat NULL dao_id consistently by casting to text
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_balances_user_dao_currency
      ON user_balances (user_id, COALESCE(dao_id::text, ''), currency);
    `);

    console.log('✅ Created unique index idx_user_balances_user_dao_currency');
    return true;
  } catch (err: any) {
    console.error('❌ Migration 016 failed:', err.message || err);
    throw err;
  }
}

export async function rollbackAddUserBalancesUnique() {
  try {
    console.log('🔄 Rolling back unique index on user_balances');
    await pool.query(`DROP INDEX IF EXISTS idx_user_balances_user_dao_currency`);
    console.log('✅ Rolled back unique index');
    return true;
  } catch (err: any) {
    console.error('❌ Rollback 016 failed:', err.message || err);
    throw err;
  }
}
