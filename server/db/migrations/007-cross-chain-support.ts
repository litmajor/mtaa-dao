/**
 * Database Migration: Cross-Chain Support Tables
 * Creates tables for multi-chain support: bridges, DEXes, tokens, transfers
 * Phase 5.2: Cross-chain governance and asset management
 */

import { pool } from '../../db';

export async function migrateCrossChainTables() {
  try {
    console.log('🔄 Running cross-chain support migrations...');

    // Create cross_chain_chains table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cross_chain_chains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chain_name VARCHAR(50) NOT NULL UNIQUE,
        chain_id VARCHAR(50) NOT NULL,
        chain_type VARCHAR(20) NOT NULL,
        native_token VARCHAR(20) NOT NULL,
        rpc_url TEXT NOT NULL,
        rpc_backup TEXT,
        explorer_url TEXT,
        is_active BOOLEAN DEFAULT true,
        is_supported BOOLEAN DEFAULT true,
        min_gas_price NUMERIC(20, 8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created cross_chain_chains table');

    // Create indices for cross_chain_chains
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chain_name ON cross_chain_chains(chain_name)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_is_active ON cross_chain_chains(is_active)`);

    // Create cross_chain_tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cross_chain_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        symbol VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        chain_name VARCHAR(50) NOT NULL,
        contract_address VARCHAR(255) NOT NULL,
        decimals INTEGER DEFAULT 18,
        logo_url TEXT,
        coingecko_id VARCHAR(100),
        is_native BOOLEAN DEFAULT false,
        is_bridgeable BOOLEAN DEFAULT true,
        is_swappable BOOLEAN DEFAULT true,
        price NUMERIC(20, 8),
        price_updated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chain_name) REFERENCES cross_chain_chains(chain_name)
      )
    `);
    console.log('✅ Created cross_chain_tokens table');

    // Create indices for cross_chain_tokens
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_symbol ON cross_chain_tokens(symbol)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chain ON cross_chain_tokens(chain_name)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bridge ON cross_chain_tokens(is_bridgeable)`);

    // Create cross_chain_bridges table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cross_chain_bridges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bridge_name VARCHAR(100) NOT NULL,
        bridge_type VARCHAR(50) NOT NULL,
        source_chain VARCHAR(50) NOT NULL,
        destination_chain VARCHAR(50) NOT NULL,
        bridge_contract_address VARCHAR(255) NOT NULL,
        pool_contract_address VARCHAR(255),
        token_address VARCHAR(255) NOT NULL,
        supported_token VARCHAR(20) NOT NULL,
        min_amount NUMERIC(20, 8),
        max_amount NUMERIC(20, 8),
        bridge_fee_percent NUMERIC(10, 4) DEFAULT 0.25,
        estimated_time_minutes INTEGER DEFAULT 20,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_chain) REFERENCES cross_chain_chains(chain_name),
        FOREIGN KEY (destination_chain) REFERENCES cross_chain_chains(chain_name)
      )
    `);
    console.log('✅ Created cross_chain_bridges table');

    // Create indices for cross_chain_bridges
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bridge_name ON cross_chain_bridges(bridge_name)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chains ON cross_chain_bridges(source_chain, destination_chain)`);

    // Create cross_chain_dexes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cross_chain_dexes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dex_name VARCHAR(100) NOT NULL,
        dex_type VARCHAR(50) NOT NULL,
        chain_name VARCHAR(50) NOT NULL,
        router_contract_address VARCHAR(255) NOT NULL,
        factory_contract_address VARCHAR(255),
        liquidity_token_symbol VARCHAR(20),
        fee_percent NUMERIC(10, 4) DEFAULT 0.25,
        tvl NUMERIC(20, 2),
        volume_24h NUMERIC(20, 2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chain_name) REFERENCES cross_chain_chains(chain_name)
      )
    `);
    console.log('✅ Created cross_chain_dexes table');

    // Create indices for cross_chain_dexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_dex_name ON cross_chain_dexes(dex_name)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chain_dex ON cross_chain_dexes(chain_name)`);

    // Create cross_chain_trading_pairs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cross_chain_trading_pairs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dex_id UUID NOT NULL,
        base_token VARCHAR(20) NOT NULL,
        quote_token VARCHAR(20) NOT NULL,
        pair_contract_address VARCHAR(255),
        liquidity NUMERIC(20, 8),
        volume_24h NUMERIC(20, 8),
        price_base_per_quote NUMERIC(20, 8),
        price_updated_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dex_id) REFERENCES cross_chain_dexes(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created cross_chain_trading_pairs table');

    // Create indices for cross_chain_trading_pairs
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pair ON cross_chain_trading_pairs(base_token, quote_token)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_dex_pair ON cross_chain_trading_pairs(dex_id)`);

    // Create cross_chain_transfers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cross_chain_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transfer_id VARCHAR(255) NOT NULL UNIQUE,
        user_id VARCHAR(255) NOT NULL,
        source_chain VARCHAR(50) NOT NULL,
        destination_chain VARCHAR(50) NOT NULL,
        token_symbol VARCHAR(20) NOT NULL,
        token_address VARCHAR(255) NOT NULL,
        amount NUMERIC(18, 8) NOT NULL,
        source_address VARCHAR(255) NOT NULL,
        destination_address VARCHAR(255) NOT NULL,
        bridge_used VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        source_transaction_hash VARCHAR(255),
        destination_transaction_hash VARCHAR(255),
        bridge_fee NUMERIC(18, 8),
        gas_fee NUMERIC(18, 8),
        estimated_arrival_time TIMESTAMP,
        completed_at TIMESTAMP,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (source_chain) REFERENCES cross_chain_chains(chain_name),
        FOREIGN KEY (destination_chain) REFERENCES cross_chain_chains(chain_name)
      )
    `);
    console.log('✅ Created cross_chain_transfers table');

    // Create indices for cross_chain_transfers - with existence checks
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_transfer ON cross_chain_transfers(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_status ON cross_chain_transfers(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_chains_transfer ON cross_chain_transfers(source_chain, destination_chain)`);
      
      // Check if source_transaction_hash column exists before creating index
      const hashColumnExists = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public'
          AND table_name = 'cross_chain_transfers' 
          AND column_name = 'source_transaction_hash'
        )
      `);
      
      if (hashColumnExists.rows[0]?.exists) {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_tx_hash ON cross_chain_transfers(source_transaction_hash)`);
      } else {
        console.warn('⚠️ source_transaction_hash column not found, adding it now...');
        try {
          await pool.query(`ALTER TABLE cross_chain_transfers ADD COLUMN source_transaction_hash VARCHAR(255)`);
          await pool.query(`CREATE INDEX IF NOT EXISTS idx_tx_hash ON cross_chain_transfers(source_transaction_hash)`);
        } catch (alterError: any) {
          if (!alterError.message?.includes('already exists')) {
            throw alterError;
          }
        }
      }
    } catch (indexError: any) {
      console.warn('⚠️ Error creating indices for cross_chain_transfers:', indexError.message);
      // Continue anyway - indices are not critical for table functionality
    }

    // Create cross_chain_swaps table for tracking swaps
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cross_chain_swaps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        swap_id VARCHAR(255) NOT NULL UNIQUE,
        user_id VARCHAR(255) NOT NULL,
        from_chain VARCHAR(50) NOT NULL,
        to_chain VARCHAR(50) NOT NULL,
        from_token VARCHAR(20) NOT NULL,
        to_token VARCHAR(20) NOT NULL,
        from_amount NUMERIC(18, 8) NOT NULL,
        to_amount NUMERIC(18, 8),
        from_dex VARCHAR(100),
        to_dex VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        transaction_hash VARCHAR(255),
        slippage_percent NUMERIC(8, 4),
        execution_price NUMERIC(20, 8),
        total_fee NUMERIC(18, 8),
        profit_loss NUMERIC(18, 8),
        completed_at TIMESTAMP,
        failed_at TIMESTAMP,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (from_chain) REFERENCES cross_chain_chains(chain_name),
        FOREIGN KEY (to_chain) REFERENCES cross_chain_chains(chain_name)
      )
    `);
    console.log('✅ Created cross_chain_swaps table');

    // Create indices for cross_chain_swaps
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_swap ON cross_chain_swaps(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_status_swap ON cross_chain_swaps(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chains_swap ON cross_chain_swaps(from_chain, to_chain)`);

    console.log('✅ All cross-chain support tables created successfully!');
    return true;
  } catch (error: any) {
    console.error('❌ Cross-chain migration failed:', error.message);
    throw error;
  }
}

export async function rollbackCrossChainTables() {
  try {
    console.log('🔄 Rolling back cross-chain support migrations...');

    const tables = [
      'cross_chain_swaps',
      'cross_chain_transfers',
      'cross_chain_trading_pairs',
      'cross_chain_dexes',
      'cross_chain_bridges',
      'cross_chain_tokens',
      'cross_chain_chains',
    ];

    for (const table of tables) {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`✅ Dropped ${table} table`);
    }

    console.log('✅ Cross-chain tables rolled back successfully!');
    return true;
  } catch (error: any) {
    console.error('❌ Rollback failed:', error.message);
    throw error;
  }
}
