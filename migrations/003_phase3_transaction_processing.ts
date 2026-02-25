/**
 * Phase 3 Migration: Transaction Processing & Smart Contracts
 * Creates tables for transaction batching, smart contracts, DEX swaps, yield farming, and DeFi operations
 */

import { db } from "@/server/db";

export async function up() {
  // Create smart contracts table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS smart_contracts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id INTEGER NOT NULL,
      contract_address VARCHAR(255) NOT NULL,
      contract_name VARCHAR(255) NOT NULL,
      contract_type VARCHAR(50) NOT NULL,
      abi JSONB NOT NULL,
      bytecode TEXT,
      deployment_tx_hash VARCHAR(255),
      deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      verification_status VARCHAR(50) DEFAULT 'unverified',
      is_active BOOLEAN DEFAULT TRUE,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chain_id, contract_address)
    );

    CREATE INDEX idx_smart_contracts_chain_id ON smart_contracts(chain_id);
    CREATE INDEX idx_smart_contracts_address ON smart_contracts(contract_address);
    CREATE INDEX idx_smart_contracts_type ON smart_contracts(contract_type);
    CREATE INDEX idx_smart_contracts_active ON smart_contracts(is_active);
  `);

  // Create transaction batches table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transaction_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id),
      batch_name VARCHAR(255) NOT NULL,
      batch_type VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      total_transactions INTEGER DEFAULT 0,
      completed_transactions INTEGER DEFAULT 0,
      failed_transactions INTEGER DEFAULT 0,
      estimated_gas_total VARCHAR(80),
      actual_gas_used VARCHAR(80),
      gas_optimization_percent DECIMAL(5, 2),
      scheduled_for TIMESTAMP,
      executed_at TIMESTAMP,
      priority VARCHAR(50) DEFAULT 'normal',
      description TEXT,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_transaction_batches_wallet_id ON transaction_batches(wallet_connection_id);
    CREATE INDEX idx_transaction_batches_status ON transaction_batches(status);
    CREATE INDEX idx_transaction_batches_type ON transaction_batches(batch_type);
    CREATE INDEX idx_transaction_batches_priority ON transaction_batches(priority);
    CREATE INDEX idx_transaction_batches_created_at ON transaction_batches(created_at);
  `);

  // Create batched transactions table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS batched_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID NOT NULL REFERENCES transaction_batches(id),
      transaction_id UUID REFERENCES blockchain_transactions(id),
      sequence_order INTEGER NOT NULL,
      target_address VARCHAR(255) NOT NULL,
      function_signature VARCHAR(255),
      function_params JSONB,
      encoded_data TEXT,
      estimated_gas VARCHAR(80),
      actual_gas VARCHAR(80),
      call_value VARCHAR(80),
      status VARCHAR(50) DEFAULT 'pending',
      executed_tx_hash VARCHAR(255),
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_batched_transactions_batch_id ON batched_transactions(batch_id);
    CREATE INDEX idx_batched_transactions_tx_id ON batched_transactions(transaction_id);
    CREATE INDEX idx_batched_transactions_status ON batched_transactions(status);
  `);

  // Create contract interactions table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contract_interactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id),
      contract_id UUID NOT NULL REFERENCES smart_contracts(id),
      transaction_id UUID REFERENCES blockchain_transactions(id),
      function_name VARCHAR(255) NOT NULL,
      function_type VARCHAR(50) NOT NULL,
      input_params JSONB,
      output_data JSONB,
      gas_used VARCHAR(80),
      executed_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'pending',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_contract_interactions_wallet_id ON contract_interactions(wallet_connection_id);
    CREATE INDEX idx_contract_interactions_contract_id ON contract_interactions(contract_id);
    CREATE INDEX idx_contract_interactions_function ON contract_interactions(function_name);
    CREATE INDEX idx_contract_interactions_status ON contract_interactions(status);
  `);

  // Create DEX swaps table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dex_swaps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id),
      dex_id UUID NOT NULL REFERENCES smart_contracts(id),
      from_token UUID NOT NULL,
      to_token UUID NOT NULL,
      from_amount VARCHAR(80) NOT NULL,
      to_amount_expected VARCHAR(80) NOT NULL,
      to_amount_actual VARCHAR(80),
      slippage_percent DECIMAL(5, 2),
      price_impact_percent DECIMAL(5, 2),
      route JSONB,
      transaction_id UUID REFERENCES blockchain_transactions(id),
      executed_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'pending',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_dex_swaps_wallet_id ON dex_swaps(wallet_connection_id);
    CREATE INDEX idx_dex_swaps_dex_id ON dex_swaps(dex_id);
    CREATE INDEX idx_dex_swaps_status ON dex_swaps(status);
  `);

  // Create yield farms table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS yield_farms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id INTEGER NOT NULL,
      farm_name VARCHAR(255) NOT NULL,
      protocol_name VARCHAR(255) NOT NULL,
      contract_address VARCHAR(255) NOT NULL,
      underlying_token UUID NOT NULL,
      yield_token_address VARCHAR(255),
      apy DECIMAL(8, 2),
      apy_historical_7d DECIMAL(8, 2),
      tvl VARCHAR(80),
      risk_level VARCHAR(50),
      auto_compound BOOLEAN DEFAULT FALSE,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_yield_farms_chain_id ON yield_farms(chain_id);
    CREATE INDEX idx_yield_farms_protocol ON yield_farms(protocol_name);
    CREATE INDEX idx_yield_farms_status ON yield_farms(status);
  `);

  // Create yield positions table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS yield_positions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id),
      farm_id UUID NOT NULL REFERENCES yield_farms(id),
      deposited_amount VARCHAR(80) NOT NULL,
      deposited_amount_usd DECIMAL(20, 2),
      yield_tokens_held VARCHAR(80),
      accrued_rewards VARCHAR(80),
      accrued_rewards_usd DECIMAL(20, 2),
      deposit_tx_id UUID REFERENCES blockchain_transactions(id),
      last_claim_at TIMESTAMP,
      last_rebalance_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_yield_positions_wallet_id ON yield_positions(wallet_connection_id);
    CREATE INDEX idx_yield_positions_farm_id ON yield_positions(farm_id);
    CREATE INDEX idx_yield_positions_status ON yield_positions(status);
  `);

  // Create yield claims table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS yield_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      yield_position_id UUID NOT NULL REFERENCES yield_positions(id),
      reward_amount VARCHAR(80) NOT NULL,
      reward_amount_usd DECIMAL(20, 2),
      reward_token VARCHAR(100),
      transaction_id UUID REFERENCES blockchain_transactions(id),
      claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_yield_claims_position_id ON yield_claims(yield_position_id);
    CREATE INDEX idx_yield_claims_claimed_at ON yield_claims(claimed_at);
  `);

  // Create rebalancing rules table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rebalancing_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id),
      rule_name VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      target_allocations JSONB,
      rebalance_trigger VARCHAR(50) NOT NULL,
      deviation_threshold DECIMAL(5, 2),
      rebalance_frequency VARCHAR(50),
      min_rebalance_amount VARCHAR(80),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_rebalancing_rules_wallet_id ON rebalancing_rules(wallet_connection_id);
    CREATE INDEX idx_rebalancing_rules_active ON rebalancing_rules(is_active);
  `);

  // Create rebalancing actions table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rebalancing_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID NOT NULL REFERENCES rebalancing_rules(id),
      batch_id UUID REFERENCES transaction_batches(id),
      tokens_sold JSONB,
      tokens_bought JSONB,
      total_swap_value VARCHAR(80),
      total_swap_value_usd DECIMAL(20, 2),
      status VARCHAR(50) DEFAULT 'pending',
      executed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_rebalancing_actions_rule_id ON rebalancing_actions(rule_id);
    CREATE INDEX idx_rebalancing_actions_status ON rebalancing_actions(status);
  `);

  // Create bridge transactions table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bridge_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id),
      source_chain_id INTEGER NOT NULL,
      destination_chain_id INTEGER NOT NULL,
      bridge_contract_id UUID NOT NULL REFERENCES smart_contracts(id),
      source_token UUID NOT NULL,
      destination_token UUID,
      source_amount VARCHAR(80) NOT NULL,
      estimated_dest_amount VARCHAR(80),
      actual_dest_amount VARCHAR(80),
      source_tx_id UUID REFERENCES blockchain_transactions(id),
      destination_tx_id UUID REFERENCES blockchain_transactions(id),
      bridge_fee VARCHAR(80),
      bridge_fee_percent DECIMAL(5, 2),
      status VARCHAR(50) DEFAULT 'pending',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_bridge_transactions_wallet_id ON bridge_transactions(wallet_connection_id);
    CREATE INDEX idx_bridge_transactions_source_chain ON bridge_transactions(source_chain_id);
    CREATE INDEX idx_bridge_transactions_dest_chain ON bridge_transactions(destination_chain_id);
    CREATE INDEX idx_bridge_transactions_status ON bridge_transactions(status);
  `);

  // Create transaction simulations table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transaction_simulations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id),
      chain_id INTEGER NOT NULL,
      target_contract VARCHAR(255) NOT NULL,
      function_signature VARCHAR(255) NOT NULL,
      input_params JSONB,
      simulation_result JSONB,
      estimated_gas VARCHAR(80),
      estimated_cost VARCHAR(80),
      estimated_cost_usd DECIMAL(20, 2),
      is_valid BOOLEAN DEFAULT TRUE,
      validation_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    );

    CREATE INDEX idx_transaction_simulations_wallet_id ON transaction_simulations(wallet_connection_id);
    CREATE INDEX idx_transaction_simulations_chain_id ON transaction_simulations(chain_id);
    CREATE INDEX idx_transaction_simulations_valid ON transaction_simulations(is_valid);
  `);

  // Create gas optimization history table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS gas_optimization_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id),
      batch_id UUID REFERENCES transaction_batches(id),
      optimization_strategy VARCHAR(255) NOT NULL,
      original_gas_estimate VARCHAR(80),
      optimized_gas_estimate VARCHAR(80),
      gas_savings VARCHAR(80),
      gas_savings_percent DECIMAL(5, 2),
      original_cost VARCHAR(80),
      optimized_cost VARCHAR(80),
      cost_savings DECIMAL(20, 2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_gas_optimization_wallet_id ON gas_optimization_history(wallet_connection_id);
    CREATE INDEX idx_gas_optimization_strategy ON gas_optimization_history(optimization_strategy);
  `);

  // Create price oracle feeds table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS price_oracle_feeds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chain_id INTEGER NOT NULL,
      oracle_type VARCHAR(50) NOT NULL,
      token_address VARCHAR(255) NOT NULL,
      base_token VARCHAR(255),
      oracle_address VARCHAR(255),
      decimals INTEGER DEFAULT 18,
      update_frequency INTEGER,
      last_updated_at TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_price_oracle_feeds_chain_id ON price_oracle_feeds(chain_id);
    CREATE INDEX idx_price_oracle_feeds_type ON price_oracle_feeds(oracle_type);
    CREATE INDEX idx_price_oracle_feeds_active ON price_oracle_feeds(is_active);
  `);

  // Create price history table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS price_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      oracle_feed_id UUID NOT NULL REFERENCES price_oracle_feeds(id),
      price DECIMAL(20, 8) NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      block_number INTEGER
    );

    CREATE INDEX idx_price_history_feed_id ON price_history(oracle_feed_id);
    CREATE INDEX idx_price_history_timestamp ON price_history(timestamp);
  `);
}

export async function down() {
  // Drop tables in reverse order of dependencies
  await db.execute("DROP TABLE IF EXISTS price_history CASCADE;");
  await db.execute("DROP TABLE IF EXISTS price_oracle_feeds CASCADE;");
  await db.execute("DROP TABLE IF EXISTS gas_optimization_history CASCADE;");
  await db.execute("DROP TABLE IF EXISTS transaction_simulations CASCADE;");
  await db.execute("DROP TABLE IF EXISTS bridge_transactions CASCADE;");
  await db.execute("DROP TABLE IF EXISTS rebalancing_actions CASCADE;");
  await db.execute("DROP TABLE IF EXISTS rebalancing_rules CASCADE;");
  await db.execute("DROP TABLE IF EXISTS yield_claims CASCADE;");
  await db.execute("DROP TABLE IF EXISTS yield_positions CASCADE;");
  await db.execute("DROP TABLE IF EXISTS yield_farms CASCADE;");
  await db.execute("DROP TABLE IF EXISTS dex_swaps CASCADE;");
  await db.execute("DROP TABLE IF EXISTS contract_interactions CASCADE;");
  await db.execute("DROP TABLE IF EXISTS batched_transactions CASCADE;");
  await db.execute("DROP TABLE IF EXISTS transaction_batches CASCADE;");
  await db.execute("DROP TABLE IF EXISTS smart_contracts CASCADE;");
}
