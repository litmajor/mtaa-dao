/**
 * Database Migration: Futures Infrastructure & Position Tracking
 * 
 * Adds dedicated tables for:
 * 1. Perpetual/futures positions (currently stored in generic limit_orders)
 * 2. Position mark price history (for PnL tracking and analytics)
 * 3. Idempotency keys (prevent duplicate order submissions)
 * 4. Position leverage adjustments (for audit trail)
 */

import { pool } from '../../db';

export async function migrateFuturesInfrastructure() {
  try {
    console.log('🔄 Running futures infrastructure migrations...');

    // ─────────────────────────────────────────────────────────────────
    // 1. futures_positions - Dedicated perpetuals position tracking
    // ─────────────────────────────────────────────────────────────────
    // Reason: CCXT perpetuals have different semantics than spot orders:
    //   - position_id (from exchange) ≠ uuid (our ID space)
    //   - Position state (open, closed, liquidated) ≠ Order state (filled, canceled)
    //   - Fields (contracts, mark_price, liquidation_price) don't fit limit_orders schema
    //   - Partial close + leverage adjustment require position tracking, not order tracking
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS futures_positions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        credential_id UUID NOT NULL,
        exchange VARCHAR(50) NOT NULL,
        position_id VARCHAR(255) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL CHECK (side IN ('long', 'short', 'buy', 'sell')),
        contracts DECIMAL(20, 8) NOT NULL,
        contractSize DECIMAL(20, 8),
        entry_price DECIMAL(20, 8) NOT NULL,
        current_mark_price DECIMAL(20, 8),
        collateral DECIMAL(20, 8),
        leverage DECIMAL(5, 2) DEFAULT 1,
        liquidation_price DECIMAL(20, 8),
        unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
        unrealized_pnl_pct DECIMAL(8, 4) DEFAULT 0,
        realized_pnl DECIMAL(20, 8) DEFAULT 0,
        funding_paid DECIMAL(20, 8) DEFAULT 0,
        funding_is_estimated BOOLEAN NOT NULL DEFAULT FALSE,
        opened_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (credential_id) REFERENCES cex_credentials(id) ON DELETE CASCADE,
        UNIQUE(credential_id, exchange, position_id)
      );
    `);
    await pool.query(`
      ALTER TABLE futures_positions
        ADD COLUMN IF NOT EXISTS funding_is_estimated BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP;
    `);
    console.log('✅ Created futures_positions table');

    // ─────────────────────────────────────────────────────────────────
    // 2. mark_price_history - Track perpetual mark price over time
    // ─────────────────────────────────────────────────────────────────
    // Purpose: Calculate real winRate and PnL analytics for perpetual positions
    // Enables: "What was the max drawdown?" and "When did price cross liquidation?"
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mark_price_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        position_id UUID NOT NULL,
        mark_price DECIMAL(20, 8) NOT NULL,
        pnl_at_time DECIMAL(20, 8),
        pnl_pct_at_time DECIMAL(8, 4),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (position_id) REFERENCES futures_positions(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Created mark_price_history table');

    // ─────────────────────────────────────────────────────────────────
    // 3. order_idempotency_keys - Prevent duplicate order submission
    // ─────────────────────────────────────────────────────────────────
    // How it works:
    //   - Client generates a unique idempotencyKey (UUID or hash of parameters)
    //   - On first submit: INSERT idempotency_key, execute order, record result
    //   - On retry: SELECT by key, return cached result (no double submit)
    //   - TTL: 24 hours (after that, key can be reused for new order)
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_idempotency_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        credential_id UUID,
        exchange VARCHAR(50) NOT NULL,
        idempotency_key VARCHAR(255) NOT NULL,
        order_type VARCHAR(20) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        amount DECIMAL(20, 8) NOT NULL,
        price DECIMAL(20, 8),
        result_order_id VARCHAR(255),
        result_status VARCHAR(20),
        result_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (credential_id) REFERENCES cex_credentials(id) ON DELETE SET NULL,
        UNIQUE(exchange, idempotency_key)
      );
    `);
    console.log('✅ Created order_idempotency_keys table');

    // ─────────────────────────────────────────────────────────────────
    // 4. position_leverage_audit - Track leverage changes
    // ─────────────────────────────────────────────────────────────────
    // Purpose: Audit trail for leverage adjustments (required by some exchanges)
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS position_leverage_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        position_id UUID NOT NULL,
        old_leverage DECIMAL(5, 2),
        new_leverage DECIMAL(5, 2) NOT NULL,
        request_status VARCHAR(20) NOT NULL,
        exchange_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (position_id) REFERENCES futures_positions(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Created position_leverage_audit table');

    // ─────────────────────────────────────────────────────────────────
    // Performance Indexes
    // ─────────────────────────────────────────────────────────────────
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_futures_positions_user_exchange 
      ON futures_positions(user_id, exchange);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_futures_positions_credential_id 
      ON futures_positions(credential_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_futures_positions_symbol_side 
      ON futures_positions(symbol, side);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mark_price_history_position_id 
      ON mark_price_history(position_id, recorded_at DESC);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_order_idempotency_keys_lookup 
      ON order_idempotency_keys(exchange, idempotency_key);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_order_idempotency_keys_user 
      ON order_idempotency_keys(user_id, created_at DESC);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_position_leverage_audit_position_id 
      ON position_leverage_audit(position_id, created_at DESC);
    `);
    
    console.log('✅ Created performance indexes');

    // ─────────────────────────────────────────────────────────────────
    // Cleanup: Add cleanup trigger for expired idempotency keys
    // ─────────────────────────────────────────────────────────────────
    // Note: This is optional; you can also run a background job to clean up
    // await pool.query(`
    //   DELETE FROM order_idempotency_keys 
    //   WHERE expires_at < CURRENT_TIMESTAMP;
    // `);

    console.log('✅ All futures infrastructure migrations completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Futures infrastructure migration failed:', error);
    throw error;
  }
}

export async function rollbackFuturesInfrastructure() {
  try {
    console.log('🔄 Rolling back futures infrastructure tables...');
    
    await pool.query(`DROP TABLE IF EXISTS position_leverage_audit;`);
    await pool.query(`DROP TABLE IF EXISTS order_idempotency_keys;`);
    await pool.query(`DROP TABLE IF EXISTS mark_price_history;`);
    await pool.query(`DROP TABLE IF EXISTS futures_positions;`);
    
    console.log('✅ Futures infrastructure tables rolled back');
    return true;
  } catch (error) {
    console.error('❌ Futures infrastructure rollback failed:', error);
    throw error;
  }
}
