/**
 * Database Migration: Unified Stats Denormalization
 * 
 * Creates denormalized tables to replace expensive GROUP BY queries:
 * 1. venue_execution_stats - Replaces market.ts GROUP BY query
 * 2. order_execution_summary - Replaces orders.ts aggregation query
 * 3. exchange_balance_summary - Replaces calculated balance sums in exchanges.ts
 */

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. VENUE EXECUTION STATS - Replaces market.ts aggregation
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS venue_execution_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  venue VARCHAR(50) NOT NULL,
  
  -- Aggregated metrics (updated async)
  avg_price NUMERIC(20,8) DEFAULT 0,
  price_range NUMERIC(20,8) DEFAULT 0,
  trade_count BIGINT DEFAULT 0,
  last_trade TIMESTAMPTZ,
  avg_slippage NUMERIC(5,2) DEFAULT 0,
  success_rate NUMERIC(3,2) DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, symbol, venue),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_venue_stats_user ON venue_execution_stats(user_id);
CREATE INDEX idx_venue_stats_symbol ON venue_execution_stats(symbol);
CREATE INDEX idx_venue_stats_venue ON venue_execution_stats(venue);
CREATE INDEX idx_venue_stats_updated ON venue_execution_stats(updated_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ORDER EXECUTION SUMMARY - Replaces orders.ts aggregation
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS order_execution_summary (
  id BIGSERIAL PRIMARY KEY,
  exchange VARCHAR(50) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  
  -- Aggregated 30-day metrics (updated async)
  total_executions BIGINT DEFAULT 0,
  avg_accuracy NUMERIC(5,2) DEFAULT 0,
  avg_slippage NUMERIC(5,2) DEFAULT 0,
  success_rate NUMERIC(3,2) DEFAULT 0,
  avg_fill_time NUMERIC(10,2) DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(exchange, symbol)
);

CREATE INDEX idx_order_summary_exchange ON order_execution_summary(exchange);
CREATE INDEX idx_order_summary_symbol ON order_execution_summary(symbol);
CREATE INDEX idx_order_summary_updated ON order_execution_summary(updated_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. EXCHANGE BALANCE SUMMARY - User balance snapshots
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS exchange_balance_summary (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  exchange_id VARCHAR(100) NOT NULL,
  
  -- Cached balance summary (updated on every fetch)
  total_value NUMERIC(20,8) DEFAULT 0,
  total_assets BIGINT DEFAULT 0,
  estimated_gas_cost NUMERIC(10,8) DEFAULT 0,
  
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, exchange_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_exchange_balance_user ON exchange_balance_summary(user_id);
CREATE INDEX idx_exchange_balance_updated ON exchange_balance_summary(last_updated DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. POSTGRESQL TRIGGERS - Auto-update stats on execution_metrics changes
-- ═══════════════════════════════════════════════════════════════════════════════

-- Trigger for venue execution stats updates
CREATE OR REPLACE FUNCTION update_venue_execution_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'stats:venue_update',
    json_build_object(
      'user_id', NEW.user_id,
      'symbol', NEW.symbol,
      'venue', NEW.venue
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venue_stats_on_metrics_insert ON execution_metrics;
CREATE TRIGGER trg_venue_stats_on_metrics_insert
AFTER INSERT ON execution_metrics
FOR EACH ROW
EXECUTE FUNCTION update_venue_execution_stats();

-- Trigger for order execution summary updates
CREATE OR REPLACE FUNCTION update_order_execution_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'stats:order_update',
    json_build_object(
      'exchange', NEW.exchange,
      'symbol', NEW.symbol
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_stats_on_metrics_insert ON execution_metrics;
CREATE TRIGGER trg_order_stats_on_metrics_insert
AFTER INSERT ON execution_metrics
FOR EACH ROW
EXECUTE FUNCTION update_order_execution_stats();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. BACKFILL EXISTING DATA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Backfill venue execution stats (one day window)
INSERT INTO venue_execution_stats (user_id, symbol, venue, avg_price, price_range, trade_count, last_trade, avg_slippage, success_rate)
SELECT 
  user_id,
  symbol,
  venue,
  AVG(execution_price) as avg_price,
  MAX(execution_price) - MIN(execution_price) as price_range,
  COUNT(*) as trade_count,
  MAX(recorded_at) as last_trade,
  AVG(slippage_percent) as avg_slippage,
  COUNT(CASE WHEN success THEN 1 END)::float / COUNT(*) as success_rate
FROM execution_metrics
WHERE recorded_at > NOW() - INTERVAL '1 day'
GROUP BY user_id, symbol, venue
ON CONFLICT (user_id, symbol, venue) DO NOTHING;

-- Backfill order execution summary (30 day window)
INSERT INTO order_execution_summary (exchange, symbol, total_executions, avg_accuracy, avg_slippage, success_rate, avg_fill_time)
SELECT 
  exchange,
  symbol,
  COUNT(*) as total_executions,
  AVG(accuracy) as avg_accuracy,
  AVG(slippage_percent) as avg_slippage,
  COUNT(CASE WHEN success THEN 1 END)::float / COUNT(*) as success_rate,
  AVG(fill_time_ms) as avg_fill_time
FROM execution_metrics
WHERE recorded_at > NOW() - INTERVAL '30 days'
GROUP BY exchange, symbol
ON CONFLICT (exchange, symbol) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 
  'venue_execution_stats' as table_name,
  COUNT(*) as row_count
FROM venue_execution_stats
UNION ALL
SELECT 
  'order_execution_summary' as table_name,
  COUNT(*) as row_count
FROM order_execution_summary
UNION ALL
SELECT 
  'exchange_balance_summary' as table_name,
  COUNT(*) as row_count
FROM exchange_balance_summary;
