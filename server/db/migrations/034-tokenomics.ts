import { pool } from '../../db';

export async function migrateTokenomicsTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS token_contract_deployments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id BIGINT NOT NULL,
      contract_type VARCHAR(64) NOT NULL,
      contract_address VARCHAR(42) NOT NULL,
      deployment_block BIGINT NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (chain_id, contract_type),
      UNIQUE (chain_id, contract_address)
    );
    CREATE TABLE IF NOT EXISTS token_indexer_checkpoints (
      indexer_id VARCHAR(128) PRIMARY KEY,
      chain_id BIGINT NOT NULL,
      last_indexed_block BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS token_transfer_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id BIGINT NOT NULL,
      token_address VARCHAR(42) NOT NULL,
      transaction_hash VARCHAR(66) NOT NULL,
      log_index INTEGER NOT NULL,
      block_number BIGINT NOT NULL,
      from_address VARCHAR(42) NOT NULL,
      to_address VARCHAR(42) NOT NULL,
      amount NUMERIC(78,0) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (chain_id, transaction_hash, log_index)
    );
    CREATE TABLE IF NOT EXISTS token_holder_balances (
      chain_id BIGINT NOT NULL,
      token_address VARCHAR(42) NOT NULL,
      holder_address VARCHAR(42) NOT NULL,
      balance NUMERIC(78,0) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (chain_id, token_address, holder_address)
    );
    CREATE TABLE IF NOT EXISTS token_ecosystem_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id BIGINT NOT NULL,
      contract_address VARCHAR(42) NOT NULL,
      transaction_hash VARCHAR(66) NOT NULL,
      log_index INTEGER NOT NULL,
      block_number BIGINT NOT NULL,
      event_name VARCHAR(96) NOT NULL,
      account_address VARCHAR(42),
      amount NUMERIC(78,0),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (chain_id, transaction_hash, log_index)
    );
    CREATE TABLE IF NOT EXISTS tokenomics_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id BIGINT NOT NULL,
      token_address VARCHAR(42) NOT NULL,
      block_number BIGINT NOT NULL,
      total_supply NUMERIC(78,0) NOT NULL DEFAULT 0,
      total_burned NUMERIC(78,0) NOT NULL DEFAULT 0,
      total_staked NUMERIC(78,0) NOT NULL DEFAULT 0,
      locked_supply NUMERIC(78,0) NOT NULL DEFAULT 0,
      circulating_supply NUMERIC(78,0) NOT NULL DEFAULT 0,
      holder_count INTEGER NOT NULL DEFAULT 0,
      transfer_count BIGINT NOT NULL DEFAULT 0,
      transfer_volume NUMERIC(78,0) NOT NULL DEFAULT 0,
      rewards_emitted NUMERIC(78,0) NOT NULL DEFAULT 0,
      rewards_claimed NUMERIC(78,0) NOT NULL DEFAULT 0,
      vested_released NUMERIC(78,0) NOT NULL DEFAULT 0,
      price NUMERIC(30,12),
      price_source VARCHAR(128),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS tokenomics_snapshots_lookup_idx
      ON tokenomics_snapshots (chain_id, token_address, created_at DESC);
  `);
}

export async function rollbackTokenomicsTables() {
  await pool.query(`
    DROP TABLE IF EXISTS tokenomics_snapshots CASCADE;
    DROP TABLE IF EXISTS token_ecosystem_events CASCADE;
    DROP TABLE IF EXISTS token_holder_balances CASCADE;
    DROP TABLE IF EXISTS token_transfer_events CASCADE;
    DROP TABLE IF EXISTS token_indexer_checkpoints CASCADE;
    DROP TABLE IF EXISTS token_contract_deployments CASCADE;
  `);
}
