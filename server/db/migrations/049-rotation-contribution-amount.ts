import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('rotation-contribution-amount-migration');

export async function migrateRotationContributionAmount(): Promise<void> {
  logger.info('Adding fixed KES contribution amount for merry-go-round DAOs');
  try {
    await pool.query(`
      ALTER TABLE public.daos
        ADD COLUMN IF NOT EXISTS rotation_contribution_amount_kes INTEGER;
    `);
    logger.info('Fixed KES contribution amount column applied');
  } catch (error) {
    logger.error('Failed to add fixed KES contribution amount column', error);
    throw error;
  }
}

export async function rollbackRotationContributionAmount(): Promise<void> {
  logger.info('Removing fixed KES contribution amount for merry-go-round DAOs');
  try {
    await pool.query(`
      ALTER TABLE public.daos
        DROP COLUMN IF EXISTS rotation_contribution_amount_kes;
    `);
    logger.info('Fixed KES contribution amount column removed');
  } catch (error) {
    logger.error('Failed to remove fixed KES contribution amount column', error);
    throw error;
  }
}
