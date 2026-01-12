/**
 * Database Migration: Add Limit Orders table for Phase 3 Smart Order Router
 * Tracks persistent limit orders placed on centralized exchanges
 */

import { db } from '../db';

export async function migrateLimitOrdersTables() {
  try {
    console.log('🔄 Running limit orders table migrations...');

    // Create limit_orders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS limit_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        exchange VARCHAR(50) NOT NULL,
        order_id VARCHAR(255) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
        amount NUMERIC(20, 8) NOT NULL,
        price NUMERIC(20, 8) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'canceled', 'expired')),
        filled_amount NUMERIC(20, 8) DEFAULT 0,
        filled_price NUMERIC(20, 8),
        fee NUMERIC(20, 8) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        filled_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        canceled_at TIMESTAMP,
        last_checked_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(exchange, order_id)
      );
    `);
    console.log('✅ Created limit_orders table');

    // Create index for user lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_limit_orders_user_id ON limit_orders(user_id);
    `);

    // Create index for status lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_limit_orders_status ON limit_orders(status);
    `);

    // Create index for expiration checks
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_limit_orders_expires_at ON limit_orders(expires_at);
    `);

    // Create index for symbol lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_limit_orders_symbol ON limit_orders(symbol);
    `);

    // Create composite index for common queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_limit_orders_user_status ON limit_orders(user_id, status);
    `);

    console.log('✅ Created indexes for limit_orders table');
  } catch (error: any) {
    console.error('❌ Error running limit orders migrations:', error.message);
    throw error;
  }
}

export async function rollbackLimitOrdersTables() {
  try {
    console.log('🔄 Rolling back limit orders table...');

    await db.query(`DROP TABLE IF EXISTS limit_orders CASCADE;`);

    console.log('✅ Rolled back limit_orders table');
  } catch (error: any) {
    console.error('❌ Error rolling back limit orders migrations:', error.message);
    throw error;
  }
}
