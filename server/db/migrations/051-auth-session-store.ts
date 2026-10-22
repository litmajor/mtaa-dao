import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('auth-session-store-migration');

export async function migrateAuthSessionStore(): Promise<void> {
  logger.info('Creating shared auth session store');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.auth_sessions (
        session_id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        email VARCHAR,
        role VARCHAR,
        login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address VARCHAR,
        user_agent VARCHAR
      );

      CREATE INDEX IF NOT EXISTS auth_sessions_user_activity_idx
        ON public.auth_sessions (user_id, last_activity DESC);

      CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx
        ON public.auth_sessions (last_activity);
    `);
    logger.info('Shared auth session store is ready');
  } catch (error) {
    logger.error('Failed to create shared auth session store', error);
    throw error;
  }
}

export async function rollbackAuthSessionStore(): Promise<void> {
  logger.info('Removing shared auth session store');
  try {
    await pool.query('DROP TABLE IF EXISTS public.auth_sessions');
    logger.info('Shared auth session store removed');
  } catch (error) {
    logger.error('Failed to remove shared auth session store', error);
    throw error;
  }
}
