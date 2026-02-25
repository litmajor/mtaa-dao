-- Migration: Phase 3B - Monitoring Metrics Tables (Phase 2)
-- Creates API usage, growth, support, and tokenomics metrics tables
-- Timestamp: January 22, 2026

-- API Usage Metrics - Track API performance and usage
CREATE TABLE IF NOT EXISTS "api_usage_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" date NOT NULL,
  
  "total_requests" integer NOT NULL DEFAULT 0,
  "successful_requests" integer NOT NULL DEFAULT 0,
  "failed_requests" integer NOT NULL DEFAULT 0,
  "error_rate" numeric(5, 2) NOT NULL DEFAULT '0',
  
  "total_response_time" numeric(15, 3) NOT NULL DEFAULT '0',
  "average_response_time" numeric(8, 2) NOT NULL DEFAULT '0',
  "p95_response_time" numeric(8, 2) DEFAULT '0',
  "p99_response_time" numeric(8, 2) DEFAULT '0',
  
  "unique_users" integer DEFAULT 0,
  "unique_ips" integer DEFAULT 0,
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW(),
  
  UNIQUE("date")
);

CREATE INDEX IF NOT EXISTS "api_usage_metrics_date_idx" ON "api_usage_metrics"("date" DESC);

-- Platform Growth Metrics - Track platform growth over time
CREATE TABLE IF NOT EXISTS "platform_growth_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" date NOT NULL,
  
  "new_users" integer NOT NULL DEFAULT 0,
  "total_users" integer NOT NULL DEFAULT 0,
  "active_users" integer NOT NULL DEFAULT 0,
  "churned_users" integer NOT NULL DEFAULT 0,
  
  "new_daos" integer NOT NULL DEFAULT 0,
  "total_daos" integer NOT NULL DEFAULT 0,
  "active_daos" integer NOT NULL DEFAULT 0,
  
  "new_transactions" integer NOT NULL DEFAULT 0,
  "total_transactions" integer NOT NULL DEFAULT 0,
  "transaction_volume" numeric(20, 8) NOT NULL DEFAULT '0',
  
  "daily_active_rate" numeric(5, 2) NOT NULL DEFAULT '0',
  "monthly_active_rate" numeric(5, 2) NOT NULL DEFAULT '0',
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW(),
  
  UNIQUE("date")
);

CREATE INDEX IF NOT EXISTS "platform_growth_metrics_date_idx" ON "platform_growth_metrics"("date" DESC);

-- Support Ticket Metrics - Track support system performance
CREATE TABLE IF NOT EXISTS "support_ticket_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" date NOT NULL,
  
  "total_tickets" integer NOT NULL DEFAULT 0,
  "open_tickets" integer NOT NULL DEFAULT 0,
  "closed_tickets" integer NOT NULL DEFAULT 0,
  "resolved_today" integer NOT NULL DEFAULT 0,
  
  "average_response_time" numeric(10, 2) DEFAULT '0',
  "average_resolution_time" numeric(10, 2) DEFAULT '0',
  "satisfaction_score" numeric(3, 1) DEFAULT '0',
  
  "critical_tickets" integer DEFAULT 0,
  "high_priority_tickets" integer DEFAULT 0,
  "medium_priority_tickets" integer DEFAULT 0,
  "low_priority_tickets" integer DEFAULT 0,
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW(),
  
  UNIQUE("date")
);

CREATE INDEX IF NOT EXISTS "support_ticket_metrics_date_idx" ON "support_ticket_metrics"("date" DESC);

-- Tokenomics Metrics - Track token supply and distribution
CREATE TABLE IF NOT EXISTS "tokenomics_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" date NOT NULL,
  
  "total_supply" numeric(20, 8) NOT NULL DEFAULT '0',
  "circulating_supply" numeric(20, 8) NOT NULL DEFAULT '0',
  "locked_supply" numeric(20, 8) NOT NULL DEFAULT '0',
  
  "current_price" numeric(20, 8) NOT NULL DEFAULT '0',
  "market_cap" numeric(20, 8) NOT NULL DEFAULT '0',
  "volume_24h" numeric(20, 8) NOT NULL DEFAULT '0',
  
  "holders_count" integer NOT NULL DEFAULT 0,
  "top_10_holders_percentage" numeric(5, 2) DEFAULT '0',
  
  "staking_amount" numeric(20, 8) NOT NULL DEFAULT '0',
  "staking_rate" numeric(5, 2) DEFAULT '0',
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW(),
  
  UNIQUE("date")
);

CREATE INDEX IF NOT EXISTS "tokenomics_metrics_date_idx" ON "tokenomics_metrics"("date" DESC);
