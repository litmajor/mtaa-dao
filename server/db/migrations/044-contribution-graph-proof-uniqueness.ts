import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('contribution-graph-proof-uniqueness-migration');

export async function migrateContributionGraphProofUniqueness(): Promise<void> {
  logger.info('Applying contribution proof idempotency constraint');
  try {
    const table = await pool.query<{ table_name: string | null }>(
      "SELECT to_regclass('public.contribution_graph') AS table_name"
    );
    if (!table.rows[0]?.table_name) {
      logger.warn('Skipping contribution proof idempotency constraint: contribution_graph table is not installed');
      return;
    }

    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM public.contribution_graph
          WHERE related_entity_type = 'contribution'
            AND contribution_type = 'financial_contribution'
            AND related_entity_id IS NOT NULL
          GROUP BY related_entity_type, related_entity_id
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION
            'Cannot create contribution_graph_entity_uq: duplicate financial contribution proofs exist';
        END IF;
      END
      $$;

      CREATE UNIQUE INDEX IF NOT EXISTS contribution_graph_entity_uq
        ON public.contribution_graph (related_entity_type, related_entity_id)
        WHERE related_entity_type = 'contribution'
          AND contribution_type = 'financial_contribution';
    `);
    logger.info('Contribution proof idempotency constraint applied');
  } catch (error) {
    logger.error('Failed to apply contribution proof idempotency constraint', error);
    throw error;
  }
}

export async function rollbackContributionGraphProofUniqueness(): Promise<void> {
  logger.info('Rolling back contribution proof idempotency constraint');
  try {
    await pool.query('DROP INDEX IF EXISTS public.contribution_graph_entity_uq');
    logger.info('Contribution proof idempotency constraint rolled back');
  } catch (error) {
    logger.error('Failed to roll back contribution proof idempotency constraint', error);
    throw error;
  }
}
