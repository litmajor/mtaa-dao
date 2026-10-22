import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('self-custody-ramps-migration');

export async function migrateSelfCustodyRamps(): Promise<void> {
  logger.info('Creating self-custody ramp transaction table');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.self_custody_ramp_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reference_id VARCHAR(120) NOT NULL UNIQUE,
      user_id VARCHAR NOT NULL REFERENCES public.users(id),
      direction VARCHAR(16) NOT NULL CHECK (direction IN ('onramp', 'offramp')),
      status VARCHAR(32) NOT NULL DEFAULT 'quoted',
      fiat_currency VARCHAR(8) NOT NULL DEFAULT 'KES',
      fiat_amount NUMERIC(18, 2) NOT NULL,
      crypto_amount NUMERIC(30, 18) NOT NULL,
      exchange_rate NUMERIC(30, 18),
      phone_number VARCHAR(32) NOT NULL,
      wallet_address VARCHAR(42) NOT NULL,
      deposit_address VARCHAR(42),
      chain VARCHAR(16) NOT NULL DEFAULT 'CELO',
      token VARCHAR(16) NOT NULL DEFAULT 'CUSD',
      transaction_hash VARCHAR(80),
      refund_transaction_hash VARCHAR(80),
      crypto_amount_settled NUMERIC(30, 18),
      fiat_amount_settled NUMERIC(18, 2),
      provider_transaction_id VARCHAR(120),
      onchain_status VARCHAR(32),
      fiat_status VARCHAR(32),
      provider_event VARCHAR(120),
      provider_metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS self_custody_ramp_user_created_idx
      ON public.self_custody_ramp_transactions (user_id, created_at DESC);
  `);
  logger.info('Self-custody ramp transaction table is ready');
}

export async function rollbackSelfCustodyRamps(): Promise<void> {
  logger.info('Removing self-custody ramp transaction table');
  await pool.query('DROP TABLE IF EXISTS public.self_custody_ramp_transactions');
}
