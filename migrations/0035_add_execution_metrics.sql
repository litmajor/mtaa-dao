-- Migration: YUKI Orders - Execution Metrics & Learning System
-- Creates tables for tracking order execution performance and machine learning metrics
-- Timestamp: March 19, 2026

-- Execution Metrics - Track execution performance for learning & optimization
CREATE TABLE IF NOT EXISTS "execution_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" varchar(255) NOT NULL,
  "exchange" varchar(50) NOT NULL,
  "symbol" varchar(20) NOT NULL,
  
  -- Price metrics
  "expected_price" numeric(20, 8) NOT NULL,
  "actual_price" numeric(20, 8) NOT NULL,
  "slippage_percent" numeric(10, 6) NOT NULL DEFAULT '0',
  
  -- Execution metrics
  "filled" numeric(20, 8),
  "fill_time_ms" integer,
  "success" boolean NOT NULL DEFAULT true,
  "accuracy" numeric(5, 2) NOT NULL DEFAULT '100',
  
  -- Strategy metadata
  "strategy" varchar(50) DEFAULT 'unknown',
  "side" varchar(10),
  "amount" numeric(20, 8),
  
  "recorded_at" timestamp DEFAULT NOW(),
  "created_at" timestamp DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_execution_metrics_exchange_symbol" 
  ON "execution_metrics"("exchange", "symbol", "recorded_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_execution_metrics_recorded_at" 
  ON "execution_metrics"("recorded_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_execution_metrics_order_id" 
  ON "execution_metrics"("order_id");

CREATE INDEX IF NOT EXISTS "idx_execution_metrics_success" 
  ON "execution_metrics"("success", "recorded_at" DESC);

-- Execution Statistics - Aggregated performance by venue and symbol
CREATE TABLE IF NOT EXISTS "execution_statistics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "exchange" varchar(50) NOT NULL,
  "symbol" varchar(20) NOT NULL,
  
  -- Aggregated metrics (30-day rolling)
  "total_executions" integer NOT NULL DEFAULT 0,
  "successful_executions" integer NOT NULL DEFAULT 0,
  "success_rate" numeric(5, 2) NOT NULL DEFAULT '0',
  
  "average_slippage" numeric(10, 6) NOT NULL DEFAULT '0',
  "min_slippage" numeric(10, 6),
  "max_slippage" numeric(10, 6),
  
  "average_fill_time_ms" integer DEFAULT 0,
  "average_accuracy" numeric(5, 2) NOT NULL DEFAULT '0',
  
  -- Performance trend
  "accuracy_trend" numeric(5, 2) DEFAULT '0', -- Direction of accuracy change
  "improvement_rate" numeric(5, 2) DEFAULT '0', -- Percent improvement over period
  
  "last_updated" timestamp DEFAULT NOW(),
  "window_start" date NOT NULL,
  "window_end" date NOT NULL,
  
  UNIQUE("exchange", "symbol", "window_start", "window_end")
);

CREATE INDEX IF NOT EXISTS "idx_execution_statistics_exchange_symbol" 
  ON "execution_statistics"("exchange", "symbol");

CREATE INDEX IF NOT EXISTS "idx_execution_statistics_window" 
  ON "execution_statistics"("window_start" DESC, "window_end" DESC);

-- Execution History - User-specific execution tracking for attribution
CREATE TABLE IF NOT EXISTS "execution_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL,
  "order_id" varchar(255) NOT NULL,
  "exchange" varchar(50) NOT NULL,
  "symbol" varchar(20) NOT NULL,
  
  "side" varchar(10) NOT NULL,
  "amount" numeric(20, 8) NOT NULL,
  "expected_price" numeric(20, 8) NOT NULL,
  "actual_price" numeric(20, 8),
  
  "status" varchar(20) NOT NULL DEFAULT 'pending', -- pending, filled, partial, canceled
  "filled_amount" numeric(20, 8) DEFAULT '0',
  "slippage_percent" numeric(10, 6) DEFAULT '0',
  "accuracy" numeric(5, 2) DEFAULT '100',
  
  "strategy_used" varchar(50), -- simple, twap, vwap, etc.
  "venue_recommendation" varchar(100),
  
  "created_at" timestamp DEFAULT NOW(),
  "executed_at" timestamp,
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_execution_history_user_id" 
  ON "execution_history"("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_execution_history_status" 
  ON "execution_history"("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_execution_history_symbol" 
  ON "execution_history"("symbol", "created_at" DESC);

-- Venue Performance - Real-time confidence scoring by venue
CREATE TABLE IF NOT EXISTS "venue_performance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "venue_type" varchar(10) NOT NULL, -- 'dex' or 'cex'
  "exchange" varchar(50) NOT NULL,
  "symbol" varchar(20),
  
  -- Confidence metrics
  "success_rate" numeric(5, 2) NOT NULL DEFAULT '0',
  "average_accuracy" numeric(5, 2) NOT NULL DEFAULT '0',
  "average_slippage" numeric(10, 6) NOT NULL DEFAULT '0',
  "average_fill_time_ms" integer DEFAULT 0,
  
  -- Recent performance (last 7 days)
  "recent_success_rate" numeric(5, 2) DEFAULT '0',
  "recent_accuracy" numeric(5, 2) DEFAULT '0',
  
  -- Trend indicators
  "uptrend" boolean DEFAULT false,
  "downtrend" boolean DEFAULT false,
  "volatility" numeric(5, 2) DEFAULT '0',
  
  "last_execution_at" timestamp,
  "updated_at" timestamp DEFAULT NOW(),
  
  UNIQUE("venue_type", "exchange", "symbol")
);

CREATE INDEX IF NOT EXISTS "idx_venue_performance_type_exchange" 
  ON "venue_performance"("venue_type", "exchange");

CREATE INDEX IF NOT EXISTS "idx_venue_performance_updated_at" 
  ON "venue_performance"("updated_at" DESC);

-- Machine Learning Training Data - Features for ML models
CREATE TABLE IF NOT EXISTS "ml_training_data" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Input features
  "symbol" varchar(20) NOT NULL,
  "order_size" numeric(20, 8) NOT NULL,
  "time_of_day" varchar(20), -- morning, midday, afternoon, evening, night
  "market_volatility" numeric(5, 2), -- estimated IV
  "order_queue_depth" integer, -- queue position estimate
  
  -- Venue information
  "venue_type" varchar(10), -- dex or cex
  "exchange" varchar(50),
  "liquidity_score" numeric(5, 2),
  
  -- Output / Target variable
  "actual_slippage" numeric(10, 6) NOT NULL,
  "actual_fill_time_ms" integer NOT NULL,
  "execution_success" boolean NOT NULL,
  
  -- Metadata
  "model_version" varchar(20), -- for tracking which model version predicted
  "prediction_accuracy" numeric(5, 2), -- how close prediction was
  "feature_importance" jsonb, -- feature weights from model
  
  "recorded_at" timestamp DEFAULT NOW(),
  "created_at" timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_ml_training_data_symbol_time" 
  ON "ml_training_data"("symbol", "recorded_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_ml_training_data_venue" 
  ON "ml_training_data"("venue_type", "exchange");

CREATE INDEX IF NOT EXISTS "idx_ml_training_data_success" 
  ON "ml_training_data"("execution_success", "recorded_at" DESC);

-- Create materialized view for daily performance dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS execution_daily_summary AS
SELECT 
  DATE(recorded_at) as execution_date,
  exchange,
  symbol,
  COUNT(*) as total_executions,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_executions,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate,
  ROUND(AVG(slippage_percent), 6) as avg_slippage,
  ROUND(AVG(accuracy), 2) as avg_accuracy,
  MIN(recorded_at) as first_execution,
  MAX(recorded_at) as last_execution
FROM execution_metrics
GROUP BY DATE(recorded_at), exchange, symbol;

CREATE INDEX IF NOT EXISTS idx_execution_daily_summary_date 
  ON execution_daily_summary(execution_date DESC);
