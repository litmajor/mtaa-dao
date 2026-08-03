-- Migration: Add Yuki Advanced Orders Table
-- Creates table for tracking advanced order types (stop-loss, take-profit, trailing stops, etc.)
-- Timestamp: 2026-07-10

CREATE TABLE IF NOT EXISTS yuki_advanced_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  order_type VARCHAR(30) NOT NULL,
  exchange VARCHAR(50),
  symbol VARCHAR(30) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  amount NUMERIC(20, 8) NOT NULL,
  price NUMERIC(20, 8),
  stop_price NUMERIC(20, 8),
  take_profit_price NUMERIC(20, 8),
  trail_percent NUMERIC(10, 4),
  trail_amount NUMERIC(20, 8),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_yuki_advanced_orders_user_id 
  ON yuki_advanced_orders(user_id);

CREATE INDEX IF NOT EXISTS idx_yuki_advanced_orders_status 
  ON yuki_advanced_orders(status);

CREATE INDEX IF NOT EXISTS idx_yuki_advanced_orders_created_at 
  ON yuki_advanced_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_yuki_advanced_orders_user_status 
  ON yuki_advanced_orders(user_id, status);
