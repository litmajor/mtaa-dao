import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('chain-identity-to-holdings-migration');

export async function migrateChainIdentityToHoldings(): Promise<void> {
  logger.info('Adding chain and token identity to indexed holdings');
  await pool.query(`
    ALTER TABLE public.vault_token_holdings
      ADD COLUMN IF NOT EXISTS chain_id INTEGER,
      ADD COLUMN IF NOT EXISTS chain VARCHAR(32),
      ADD COLUMN IF NOT EXISTS token_address VARCHAR(255),
      ADD COLUMN IF NOT EXISTS holder_address VARCHAR(255),
      ADD COLUMN IF NOT EXISTS token_decimals INTEGER,
      ADD COLUMN IF NOT EXISTS indexed_block_number BIGINT,
      ADD COLUMN IF NOT EXISTS indexed_block_hash VARCHAR(66);

    ALTER TABLE public.treasury_positions
      ADD COLUMN IF NOT EXISTS chain_id INTEGER,
      ADD COLUMN IF NOT EXISTS holder_address VARCHAR(255);

    CREATE INDEX IF NOT EXISTS vault_token_holdings_chain_asset_idx
      ON public.vault_token_holdings (chain_id, lower(token_address))
      WHERE token_address IS NOT NULL;

    CREATE INDEX IF NOT EXISTS treasury_positions_chain_asset_idx
      ON public.treasury_positions (chain_id, lower(contract_address));
  `);
  logger.info('Chain identity columns are ready; existing rows remain unverified until backfilled from trusted chain metadata');
}
