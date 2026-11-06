import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('proxy-reconciliation-audit-migration');

export async function migrateProxyReconciliationAudits(): Promise<void> {
  logger.info('Marking legacy database-proxy reconciliation audits as unverified');
  const result = await pool.query(`
    UPDATE public.treasury_reconciliation_audits
    SET
      reconciliation_status = 'unverified',
      notes = concat_ws(
        E'\\n',
        NULLIF(notes, ''),
        'Legacy comparison used database-derived values, not an independent live chain read.'
      ),
      updated_at = NOW()
    WHERE reconciliation_type IN ('dao_treasury', 'vault_balance')
      AND reconciliation_status <> 'unverified'
  `);
  logger.info(`Marked ${result.rowCount ?? 0} legacy reconciliation audits as unverified`);
}
