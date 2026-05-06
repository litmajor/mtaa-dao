/**
 * Database Migration: Add CCXT Phase 2 CEX tables
 * Run this migration to set up price tracking, orders, credentials, and arbitrage tracking
 */

import { pool } from '../../db';

export async function migrateCEXTables() {
  try {
    console.log('🔄 Running CEX table migrations...');

    // Create cex_prices table for storing real-time and historical prices
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cex_prices (
        id SERIAL PRIMARY KEY,
        exchange VARCHAR(50) NOT NULL,
        trading_pair VARCHAR(20) NOT NULL,
        price DECIMAL(20, 8) NOT NULL,
        bid DECIMAL(20, 8),
        ask DECIMAL(20, 8),
        volume DECIMAL(20, 8),
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(exchange, trading_pair)
      );
    `);
    console.log('✅ Created cex_prices table');

    // Create cex_orders table for tracking user orders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cex_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        exchange VARCHAR(50) NOT NULL,
        order_type VARCHAR(20) NOT NULL,
        order_side VARCHAR(10) NOT NULL,
        trading_pair VARCHAR(20) NOT NULL,
        amount DECIMAL(20, 8) NOT NULL,
        price DECIMAL(20, 8),
        status VARCHAR(20) DEFAULT 'pending',
        exchange_order_id VARCHAR(255),
        filled_amount DECIMAL(20, 8) DEFAULT 0,
        fee DECIMAL(20, 8) DEFAULT 0,
        fee_currency VARCHAR(10),
        commission DECIMAL(20, 8) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Created cex_orders table');

    // Create cex_credentials table for storing encrypted API keys
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cex_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL UNIQUE,
        exchange VARCHAR(50) NOT NULL,
        api_key_encrypted BYTEA NOT NULL,
        api_secret_encrypted BYTEA NOT NULL,
        passphrase_encrypted BYTEA,
        is_sandbox BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Created cex_credentials table');

    // Create arbitrage_opportunities table for tracking potential arbitrage
    await pool.query(`
      CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trading_pair VARCHAR(20) NOT NULL,
        buy_exchange VARCHAR(50) NOT NULL,
        buy_price DECIMAL(20, 8) NOT NULL,
        sell_exchange VARCHAR(50) NOT NULL,
        sell_price DECIMAL(20, 8) NOT NULL,
        spread_percent DECIMAL(8, 4) NOT NULL,
        spread_amount DECIMAL(20, 8) NOT NULL,
        estimated_profit DECIMAL(20, 8),
        buy_liquidity DECIMAL(20, 8),
        sell_liquidity DECIMAL(20, 8),
        buy_fee_percent DECIMAL(8, 4) DEFAULT 0.1,
        sell_fee_percent DECIMAL(8, 4) DEFAULT 0.1,
        net_profit DECIMAL(20, 8),
        status VARCHAR(20) DEFAULT 'detected',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_at TIMESTAMP
      );
    `);
    console.log('✅ Created arbitrage_opportunities table');

    // Create exchange_settings table for storing exchange-specific configurations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exchange_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        exchange VARCHAR(50) NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        setting_value TEXT,
        setting_type VARCHAR(20) DEFAULT 'string',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, exchange, setting_key)
      );
    `);
    console.log('✅ Created exchange_settings table');

    // Create indexes for performance optimization (each as separate query)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cex_prices_exchange_pair ON cex_prices(exchange, trading_pair);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cex_prices_timestamp ON cex_prices(timestamp DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cex_orders_user_exchange ON cex_orders(user_id, exchange);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cex_orders_status ON cex_orders(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cex_orders_pair ON cex_orders(trading_pair);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cex_orders_created_at ON cex_orders(created_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cex_prices_exchange_pair_timestamp ON cex_prices(exchange, trading_pair, timestamp DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cex_credentials_user_exchange ON cex_credentials(user_id, exchange);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_arbitrage_pair ON arbitrage_opportunities(trading_pair);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_arbitrage_status ON arbitrage_opportunities(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_arbitrage_detected_at ON arbitrage_opportunities(detected_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_arbitrage_created_at ON arbitrage_opportunities(created_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_exchange_settings_user_exchange ON exchange_settings(user_id, exchange);`);
    console.log('✅ Created performance indexes');

    console.log('✅ All CEX migrations completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ CEX migration failed:', error);
    throw error;
  }
}

export async function rollbackCEXTables() {
  try {
    console.log('🔄 Rolling back CEX tables...');
    
    await pool.query(`DROP TABLE IF EXISTS exchange_settings;`);
    await pool.query(`DROP TABLE IF EXISTS arbitrage_opportunities;`);
    await pool.query(`DROP TABLE IF EXISTS cex_credentials;`);
    await pool.query(`DROP TABLE IF EXISTS cex_orders;`);
    await pool.query(`DROP TABLE IF EXISTS cex_prices;`);
    
    console.log('✅ CEX tables rolled back');
    return true;
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}
