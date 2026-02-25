/**
 * Phase 2 Migration: Wallet Integration & Blockchain
 * Creates tables for multi-chain wallet connectivity and transaction management
 */

import { db } from "@/server/db";

export async function up() {
  // Create blockchain networks table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS blockchain_networks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id INTEGER NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(50),
      rpc_endpoint VARCHAR(500),
      backup_rpc_endpoint VARCHAR(500),
      explorer_url VARCHAR(500),
      native_token_symbol VARCHAR(20),
      native_token_decimals INTEGER DEFAULT 18,
      gas_estimates_standard DECIMAL(20, 8),
      gas_estimates_fast DECIMAL(20, 8),
      gas_estimates_instant DECIMAL(20, 8),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_blockchain_networks_chain_id ON blockchain_networks(chain_id);
    CREATE INDEX idx_blockchain_networks_status ON blockchain_networks(status);
  `);

  // Create blockchain tokens table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS blockchain_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id INTEGER NOT NULL,
      token_address VARCHAR(255),
      symbol VARCHAR(20) NOT NULL,
      name VARCHAR(255),
      decimals INTEGER DEFAULT 18,
      is_native_token BOOLEAN DEFAULT FALSE,
      price_usd DECIMAL(20, 8),
      price_feed_address VARCHAR(255),
      market_cap DECIMAL(30, 2),
      total_supply DECIMAL(50, 8),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_tokens_network FOREIGN KEY(chain_id) REFERENCES blockchain_networks(chain_id),
      UNIQUE(chain_id, token_address)
    );

    CREATE INDEX idx_blockchain_tokens_chain_id ON blockchain_tokens(chain_id);
    CREATE INDEX idx_blockchain_tokens_symbol ON blockchain_tokens(symbol);
    CREATE INDEX idx_blockchain_tokens_status ON blockchain_tokens(status);
  `);

  // Create wallet connections table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS wallet_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL,
      user_id UUID NOT NULL,
      chain_id INTEGER NOT NULL,
      wallet_address VARCHAR(255) NOT NULL,
      label VARCHAR(100),
      status VARCHAR(50) DEFAULT 'connected',
      is_verified BOOLEAN DEFAULT FALSE,
      daily_limit_usd DECIMAL(20, 2) DEFAULT 10000,
      monthly_limit_usd DECIMAL(20, 2) DEFAULT 100000,
      last_transaction_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_wallet_account FOREIGN KEY(account_id) REFERENCES accounts(id),
      CONSTRAINT fk_wallet_user FOREIGN KEY(user_id) REFERENCES users(id),
      CONSTRAINT fk_wallet_network FOREIGN KEY(chain_id) REFERENCES blockchain_networks(chain_id),
      UNIQUE(account_id, chain_id, wallet_address)
    );

    CREATE INDEX idx_wallet_connections_account_id ON wallet_connections(account_id);
    CREATE INDEX idx_wallet_connections_user_id ON wallet_connections(user_id);
    CREATE INDEX idx_wallet_connections_chain_id ON wallet_connections(chain_id);
    CREATE INDEX idx_wallet_connections_wallet_address ON wallet_connections(wallet_address);
    CREATE INDEX idx_wallet_connections_status ON wallet_connections(status);
  `);

  // Create wallet token balances table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS wallet_token_balances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL,
      token_id UUID NOT NULL,
      balance VARCHAR(80) DEFAULT '0',
      balance_usd DECIMAL(20, 2) DEFAULT 0,
      last_synced_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_balance_wallet FOREIGN KEY(wallet_connection_id) REFERENCES wallet_connections(id),
      CONSTRAINT fk_balance_token FOREIGN KEY(token_id) REFERENCES blockchain_tokens(id),
      UNIQUE(wallet_connection_id, token_id)
    );

    CREATE INDEX idx_wallet_token_balances_wallet_id ON wallet_token_balances(wallet_connection_id);
    CREATE INDEX idx_wallet_token_balances_token_id ON wallet_token_balances(token_id);
  `);

  // Create blockchain transactions table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS blockchain_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL,
      to_address VARCHAR(255) NOT NULL,
      from_address VARCHAR(255) NOT NULL,
      amount VARCHAR(80) NOT NULL,
      amount_usd DECIMAL(20, 2),
      token_id UUID,
      transaction_hash VARCHAR(255) UNIQUE,
      gas_limit VARCHAR(80),
      gas_used VARCHAR(80),
      gas_price VARCHAR(80),
      transaction_fee DECIMAL(20, 8),
      nonce INTEGER,
      block_number INTEGER,
      status VARCHAR(50) DEFAULT 'pending',
      transaction_type VARCHAR(50),
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_transaction_wallet FOREIGN KEY(wallet_connection_id) REFERENCES wallet_connections(id),
      CONSTRAINT fk_transaction_token FOREIGN KEY(token_id) REFERENCES blockchain_tokens(id)
    );

    CREATE INDEX idx_blockchain_transactions_wallet_id ON blockchain_transactions(wallet_connection_id);
    CREATE INDEX idx_blockchain_transactions_tx_hash ON blockchain_transactions(transaction_hash);
    CREATE INDEX idx_blockchain_transactions_status ON blockchain_transactions(status);
    CREATE INDEX idx_blockchain_transactions_created_at ON blockchain_transactions(created_at);
  `);

  // Create transaction queue table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transaction_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL,
      to_address VARCHAR(255) NOT NULL,
      amount VARCHAR(80) NOT NULL,
      token_symbol VARCHAR(20),
      description TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      priority VARCHAR(50) DEFAULT 'normal',
      queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP,
      attempted_at TIMESTAMP,
      attempt_count INTEGER DEFAULT 0,
      next_retry_at TIMESTAMP,
      error_message TEXT,
      transaction_hash VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_queue_wallet FOREIGN KEY(wallet_connection_id) REFERENCES wallet_connections(id)
    );

    CREATE INDEX idx_transaction_queue_wallet_id ON transaction_queue(wallet_connection_id);
    CREATE INDEX idx_transaction_queue_status ON transaction_queue(status);
    CREATE INDEX idx_transaction_queue_priority ON transaction_queue(priority);
    CREATE INDEX idx_transaction_queue_queued_at ON transaction_queue(queued_at);
  `);

  // Create wallet connection history table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS wallet_connection_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      event_data JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_history_wallet FOREIGN KEY(wallet_connection_id) REFERENCES wallet_connections(id)
    );

    CREATE INDEX idx_wallet_connection_history_wallet_id ON wallet_connection_history(wallet_connection_id);
    CREATE INDEX idx_wallet_connection_history_event_type ON wallet_connection_history(event_type);
    CREATE INDEX idx_wallet_connection_history_created_at ON wallet_connection_history(created_at);
  `);

  // Create network health table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS network_health (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id INTEGER NOT NULL,
      rpc_latency_ms INTEGER,
      gas_price VARCHAR(80),
      status VARCHAR(50) DEFAULT 'healthy',
      last_block_height INTEGER,
      average_block_time INTEGER,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_health_network FOREIGN KEY(chain_id) REFERENCES blockchain_networks(chain_id)
    );

    CREATE INDEX idx_network_health_chain_id ON network_health(chain_id);
    CREATE INDEX idx_network_health_status ON network_health(status);
    CREATE INDEX idx_network_health_created_at ON network_health(created_at);
  `);
}

export async function down() {
  // Drop tables in reverse order of dependencies
  await db.execute("DROP TABLE IF EXISTS network_health CASCADE;");
  await db.execute("DROP TABLE IF EXISTS wallet_connection_history CASCADE;");
  await db.execute("DROP TABLE IF EXISTS transaction_queue CASCADE;");
  await db.execute("DROP TABLE IF EXISTS blockchain_transactions CASCADE;");
  await db.execute("DROP TABLE IF EXISTS wallet_token_balances CASCADE;");
  await db.execute("DROP TABLE IF EXISTS wallet_connections CASCADE;");
  await db.execute("DROP TABLE IF EXISTS blockchain_tokens CASCADE;");
  await db.execute("DROP TABLE IF EXISTS blockchain_networks CASCADE;");
}
