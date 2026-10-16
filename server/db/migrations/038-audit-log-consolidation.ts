import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('audit-log-consolidation-migration');

export async function migrateAuditLogConsolidation(): Promise<void> {
  logger.info('Applying audit log consolidation schema');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        user_id VARCHAR REFERENCES public.users(id),
        user_email VARCHAR,
        action VARCHAR NOT NULL DEFAULT 'legacy',
        resource VARCHAR NOT NULL DEFAULT 'unknown',
        resource_id VARCHAR,
        method VARCHAR NOT NULL DEFAULT 'CUSTOM',
        endpoint VARCHAR NOT NULL DEFAULT 'unknown',
        ip_address VARCHAR NOT NULL DEFAULT 'system',
        user_agent VARCHAR NOT NULL DEFAULT 'system',
        status INTEGER NOT NULL DEFAULT 200,
        details JSONB,
        event_type VARCHAR,
        correlation_id VARCHAR,
        deleted_at TIMESTAMP,
        delete_reason TEXT,
        deleted_by VARCHAR,
        severity VARCHAR NOT NULL DEFAULT 'low',
        category VARCHAR NOT NULL DEFAULT 'security',
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE public.audit_logs
        ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES public.users(id),
        ADD COLUMN IF NOT EXISTS user_email VARCHAR,
        ADD COLUMN IF NOT EXISTS action VARCHAR NOT NULL DEFAULT 'legacy',
        ADD COLUMN IF NOT EXISTS resource VARCHAR NOT NULL DEFAULT 'unknown',
        ADD COLUMN IF NOT EXISTS resource_id VARCHAR,
        ADD COLUMN IF NOT EXISTS method VARCHAR NOT NULL DEFAULT 'CUSTOM',
        ADD COLUMN IF NOT EXISTS endpoint VARCHAR NOT NULL DEFAULT 'unknown',
        ADD COLUMN IF NOT EXISTS ip_address VARCHAR NOT NULL DEFAULT 'system',
        ADD COLUMN IF NOT EXISTS user_agent VARCHAR NOT NULL DEFAULT 'system',
        ADD COLUMN IF NOT EXISTS status INTEGER NOT NULL DEFAULT 200,
        ADD COLUMN IF NOT EXISTS details JSONB,
        ADD COLUMN IF NOT EXISTS event_type VARCHAR,
        ADD COLUMN IF NOT EXISTS correlation_id VARCHAR,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS delete_reason TEXT,
        ADD COLUMN IF NOT EXISTS deleted_by VARCHAR,
        ADD COLUMN IF NOT EXISTS severity VARCHAR NOT NULL DEFAULT 'low',
        ADD COLUMN IF NOT EXISTS category VARCHAR NOT NULL DEFAULT 'security',
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_attribute
          WHERE attrelid = 'public.audit_logs'::REGCLASS
            AND attname = 'actor_id'
            AND NOT attisdropped
        ) THEN
          ALTER TABLE public.audit_logs ALTER COLUMN actor_id DROP NOT NULL;
        END IF;
        IF EXISTS (
          SELECT 1 FROM pg_attribute
          WHERE attrelid = 'public.audit_logs'::REGCLASS
            AND attname = 'action_type'
            AND NOT attisdropped
        ) THEN
          ALTER TABLE public.audit_logs ALTER COLUMN action_type DROP NOT NULL;
        END IF;
        IF EXISTS (
          SELECT 1 FROM pg_attribute
          WHERE attrelid = 'public.audit_logs'::REGCLASS
            AND attname = 'target_type'
            AND NOT attisdropped
        ) THEN
          ALTER TABLE public.audit_logs ALTER COLUMN target_type DROP NOT NULL;
        END IF;
        IF EXISTS (
          SELECT 1 FROM pg_attribute
          WHERE attrelid = 'public.audit_logs'::REGCLASS
            AND attname = 'target_id'
            AND NOT attisdropped
        ) THEN
          ALTER TABLE public.audit_logs ALTER COLUMN target_id DROP NOT NULL;
        END IF;

        DROP TRIGGER IF EXISTS audit_logs_prevent_update ON public.audit_logs;
      END
      $$;

      CREATE INDEX IF NOT EXISTS audit_logs_event_type_idx
        ON public.audit_logs (event_type);
      CREATE INDEX IF NOT EXISTS audit_logs_correlation_id_idx
        ON public.audit_logs (correlation_id)
        WHERE correlation_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS audit_logs_deleted_at_idx
        ON public.audit_logs (deleted_at)
        WHERE deleted_at IS NOT NULL;
    `);
    logger.info('Audit log consolidation schema applied');
  } catch (error) {
    logger.error('Failed to apply audit log consolidation schema', error);
    throw error;
  }
}

export async function rollbackAuditLogConsolidation(): Promise<void> {
  logger.info('Rolling back audit log consolidation columns and indexes');
  try {
    await pool.query(`
      DROP INDEX IF EXISTS public.audit_logs_deleted_at_idx;
      DROP INDEX IF EXISTS public.audit_logs_correlation_id_idx;
      DROP INDEX IF EXISTS public.audit_logs_event_type_idx;

      ALTER TABLE IF EXISTS public.audit_logs
        DROP COLUMN IF EXISTS deleted_by,
        DROP COLUMN IF EXISTS delete_reason,
        DROP COLUMN IF EXISTS deleted_at,
        DROP COLUMN IF EXISTS correlation_id,
        DROP COLUMN IF EXISTS event_type;
    `);
    logger.info('Audit log consolidation columns and indexes rolled back');
  } catch (error) {
    logger.error('Failed to roll back audit log consolidation schema', error);
    throw error;
  }
}
