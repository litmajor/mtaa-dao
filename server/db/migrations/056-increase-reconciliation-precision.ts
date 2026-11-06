import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('reconciliation-precision-migration');

export async function migrateReconciliationPrecision(): Promise<void> {
  logger.info('Increasing reconciliation precision for chain token balances and discrepancy percentages');
  await pool.query(`
    ALTER TABLE public.treasury_reconciliation_audits
      ALTER COLUMN computed_value TYPE NUMERIC(38, 18),
      ALTER COLUMN on_chain_value TYPE NUMERIC(38, 18),
      ALTER COLUMN discrepancy TYPE NUMERIC(38, 18),
      ALTER COLUMN discrepancy_percent TYPE NUMERIC(12, 6);
  `);
}
