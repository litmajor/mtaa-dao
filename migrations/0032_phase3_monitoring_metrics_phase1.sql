-- Migration: Phase 3B - Monitoring Metrics Tables (Phase 1)
-- Creates platform monitoring and metrics tables for real data integration
-- Timestamp: January 22, 2026

-- Platform Performance Metrics - Real-time system health tracking
CREATE TABLE IF NOT EXISTS "platform_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" timestamp NOT NULL DEFAULT NOW(),
  
  -- Platform stats
  "total_daos" integer NOT NULL DEFAULT 0,
  "active_daos" integer NOT NULL DEFAULT 0,
  "total_members" integer NOT NULL DEFAULT 0,
  "total_vaults" integer NOT NULL DEFAULT 0,
  "active_vaults" integer NOT NULL DEFAULT 0,
  
  -- Financial metrics
  "total_tvl" numeric(20, 8) NOT NULL DEFAULT '0',
  "total_transactions" integer NOT NULL DEFAULT 0,
  "total_fees" numeric(20, 8) NOT NULL DEFAULT '0',
  "total_revenue" numeric(20, 8) NOT NULL DEFAULT '0',
  
  -- System health
  "cpu_usage" numeric(5, 2) DEFAULT '0',
  "memory_usage" numeric(5, 2) DEFAULT '0',
  "disk_usage" numeric(5, 2) DEFAULT '0',
  "network_latency" integer DEFAULT 0,
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "platform_metrics_timestamp_idx" ON "platform_metrics"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "platform_metrics_created_idx" ON "platform_metrics"("created_at" DESC);

-- DeFi Protocol Metrics - Track protocol health and performance
CREATE TABLE IF NOT EXISTS "defi_protocol_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "protocol_name" varchar NOT NULL UNIQUE,
  
  "status" varchar NOT NULL DEFAULT 'operational',
  "tvl" numeric(20, 8) NOT NULL DEFAULT '0',
  "apy" numeric(8, 4) NOT NULL DEFAULT '0',
  "pool_count" integer NOT NULL DEFAULT 0,
  "health_score" integer DEFAULT 100,
  "last_update" timestamp NOT NULL DEFAULT NOW(),
  
  "volume_24h" numeric(20, 8) DEFAULT '0',
  "unique_users" integer DEFAULT 0,
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "defi_protocol_metrics_protocol_idx" ON "defi_protocol_metrics"("protocol_name");
CREATE INDEX IF NOT EXISTS "defi_protocol_metrics_status_idx" ON "defi_protocol_metrics"("status");
CREATE INDEX IF NOT EXISTS "defi_protocol_metrics_last_update_idx" ON "defi_protocol_metrics"("last_update" DESC);

-- CeFi Exchange Metrics - Track exchange integrations
CREATE TABLE IF NOT EXISTS "cefi_exchange_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "exchange_name" varchar NOT NULL UNIQUE,
  
  "status" varchar NOT NULL DEFAULT 'connected',
  "trading_volume" numeric(20, 8) NOT NULL DEFAULT '0',
  "active_accounts" integer NOT NULL DEFAULT 0,
  "fees_collected" numeric(20, 8) NOT NULL DEFAULT '0',
  "health_score" integer DEFAULT 100,
  "success_rate" numeric(5, 2) DEFAULT '100.00',
  
  "last_update" timestamp NOT NULL DEFAULT NOW(),
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "cefi_exchange_metrics_exchange_idx" ON "cefi_exchange_metrics"("exchange_name");
CREATE INDEX IF NOT EXISTS "cefi_exchange_metrics_status_idx" ON "cefi_exchange_metrics"("status");

-- Blockchain Health Metrics - Monitor chain status
CREATE TABLE IF NOT EXISTS "blockchain_health_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chain_name" varchar NOT NULL UNIQUE,
  
  "status" varchar NOT NULL DEFAULT 'operational',
  "latency" integer NOT NULL DEFAULT 0,
  "node_count" integer NOT NULL DEFAULT 0,
  "alert_count" integer NOT NULL DEFAULT 0,
  "health_score" integer DEFAULT 100,
  
  "block_height" integer DEFAULT 0,
  "gas_price" numeric(20, 8) DEFAULT '0',
  "transaction_rate" numeric(10, 2) DEFAULT '0',
  "error_rate" numeric(5, 2) DEFAULT '0',
  
  "last_update" timestamp NOT NULL DEFAULT NOW(),
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "blockchain_health_metrics_chain_idx" ON "blockchain_health_metrics"("chain_name");
CREATE INDEX IF NOT EXISTS "blockchain_health_metrics_status_idx" ON "blockchain_health_metrics"("status");

-- Liquidity Pool Metrics - Track pool analytics
CREATE TABLE IF NOT EXISTS "liquidity_pool_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pool_address" varchar NOT NULL UNIQUE,
  "chain_id" varchar NOT NULL,
  
  "token_pair" varchar,
  "total_liquidity" numeric(20, 8) NOT NULL DEFAULT '0',
  "volume_24h" numeric(20, 8) NOT NULL DEFAULT '0',
  "fee_24h" numeric(20, 8) NOT NULL DEFAULT '0',
  "apr" numeric(8, 4) NOT NULL DEFAULT '0',
  "apy" numeric(8, 4) NOT NULL DEFAULT '0',
  
  "token_a_reserves" numeric(20, 8) DEFAULT '0',
  "token_b_reserves" numeric(20, 8) DEFAULT '0',
  "price_a" numeric(20, 8) DEFAULT '0',
  "price_b" numeric(20, 8) DEFAULT '0',
  
  "last_update" timestamp NOT NULL DEFAULT NOW(),
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "liquidity_pool_metrics_pool_idx" ON "liquidity_pool_metrics"("pool_address");
CREATE INDEX IF NOT EXISTS "liquidity_pool_metrics_chain_idx" ON "liquidity_pool_metrics"("chain_id");

-- Revenue Metrics - Track platform revenue
CREATE TABLE IF NOT EXISTS "revenue_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" date NOT NULL,
  
  "trading_fees" numeric(20, 8) NOT NULL DEFAULT '0',
  "subscription_revenue" numeric(20, 8) NOT NULL DEFAULT '0',
  "api_fees" numeric(20, 8) NOT NULL DEFAULT '0',
  "premium_features" numeric(20, 8) NOT NULL DEFAULT '0',
  "referral_revenue" numeric(20, 8) NOT NULL DEFAULT '0',
  "other_revenue" numeric(20, 8) NOT NULL DEFAULT '0',
  
  "total_revenue" numeric(20, 8) NOT NULL DEFAULT '0',
  "expenses" numeric(20, 8) NOT NULL DEFAULT '0',
  "net_revenue" numeric(20, 8) NOT NULL DEFAULT '0',
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW(),
  
  UNIQUE("date")
);

CREATE INDEX IF NOT EXISTS "revenue_metrics_date_idx" ON "revenue_metrics"("date" DESC);

-- Payment Provider Metrics - Track payment gateway performance
CREATE TABLE IF NOT EXISTS "payment_provider_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_name" varchar NOT NULL UNIQUE,
  
  "status" varchar NOT NULL DEFAULT 'operational',
  "total_transactions" integer NOT NULL DEFAULT 0,
  "successful_transactions" integer NOT NULL DEFAULT 0,
  "failed_transactions" integer NOT NULL DEFAULT 0,
  "success_rate" numeric(5, 2) NOT NULL DEFAULT '100.00',
  
  "total_volume" numeric(20, 8) NOT NULL DEFAULT '0',
  "total_fees" numeric(20, 8) NOT NULL DEFAULT '0',
  "average_transaction_time" numeric(8, 2) DEFAULT '0',
  
  "last_update" timestamp NOT NULL DEFAULT NOW(),
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "payment_provider_metrics_provider_idx" ON "payment_provider_metrics"("provider_name");
CREATE INDEX IF NOT EXISTS "payment_provider_metrics_status_idx" ON "payment_provider_metrics"("status");

-- Agent Performance Metrics - Track bot/agent performance
CREATE TABLE IF NOT EXISTS "agent_performance_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" varchar NOT NULL,
  "date" date NOT NULL,
  
  "executions" integer NOT NULL DEFAULT 0,
  "successful_executions" integer NOT NULL DEFAULT 0,
  "failed_executions" integer NOT NULL DEFAULT 0,
  "success_rate" numeric(5, 2) NOT NULL DEFAULT '100.00',
  
  "total_profit" numeric(20, 8) NOT NULL DEFAULT '0',
  "total_loss" numeric(20, 8) NOT NULL DEFAULT '0',
  "roi" numeric(8, 4) NOT NULL DEFAULT '0',
  "average_execution_time" numeric(8, 2) DEFAULT '0',
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW(),
  
  UNIQUE("agent_id", "date")
);

CREATE INDEX IF NOT EXISTS "agent_performance_metrics_agent_idx" ON "agent_performance_metrics"("agent_id");
CREATE INDEX IF NOT EXISTS "agent_performance_metrics_date_idx" ON "agent_performance_metrics"("date" DESC);
