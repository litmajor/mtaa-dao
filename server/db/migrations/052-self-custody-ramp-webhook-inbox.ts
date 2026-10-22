import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('self-custody-ramp-webhook-inbox-migration');

export async function migrateSelfCustodyRampWebhookInbox(): Promise<void> {
  logger.info('Creating self-custody ramp webhook inbox');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.self_custody_ramp_webhook_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_digest VARCHAR(64) NOT NULL UNIQUE,
      reference_id VARCHAR(120) NOT NULL,
      event VARCHAR(120) NOT NULL,
      payload JSONB NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'failed', 'processed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      received_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS self_custody_ramp_webhook_pending_idx
      ON public.self_custody_ramp_webhook_events (status, received_at)
      WHERE status IN ('pending', 'failed');
  `);
  logger.info('Self-custody ramp webhook inbox is ready');
}

export async function rollbackSelfCustodyRampWebhookInbox(): Promise<void> {
  logger.info('Removing self-custody ramp webhook inbox');
  await pool.query('DROP TABLE IF EXISTS public.self_custody_ramp_webhook_events');
}
