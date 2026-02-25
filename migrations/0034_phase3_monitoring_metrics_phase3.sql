-- Migration: Phase 3B - Monitoring Metrics Tables (Phase 3)
-- Creates referral, leaderboard, rewards, and DAO analytics tables
-- Timestamp: January 22, 2026

-- Referral Metrics - Track referral program performance
CREATE TABLE IF NOT EXISTS "referral_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" date NOT NULL,
  
  "total_referrals" integer NOT NULL DEFAULT 0,
  "new_referrals_today" integer NOT NULL DEFAULT 0,
  "referred_users_count" integer NOT NULL DEFAULT 0,
  "referred_users_active" integer NOT NULL DEFAULT 0,
  
  "total_referral_rewards" numeric(20, 8) NOT NULL DEFAULT '0',
  "rewards_distributed_today" numeric(20, 8) NOT NULL DEFAULT '0',
  "average_reward_per_referral" numeric(20, 8) NOT NULL DEFAULT '0',
  
  "top_referrer_count" integer DEFAULT 0,
  "average_referrals_per_user" numeric(10, 2) DEFAULT '0',
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW(),
  
  UNIQUE("date")
);

CREATE INDEX IF NOT EXISTS "referral_metrics_date_idx" ON "referral_metrics"("date" DESC);

-- Leaderboard Rankings - Track user rankings and positions
CREATE TABLE IF NOT EXISTS "leaderboard_rankings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL,
  "ranking_type" varchar NOT NULL,
  "date" date NOT NULL,
  
  "rank" integer NOT NULL,
  "score" numeric(20, 8) NOT NULL DEFAULT '0',
  "previous_rank" integer DEFAULT 0,
  "rank_change" integer DEFAULT 0,
  
  "metric_value" numeric(20, 8) DEFAULT '0',
  "tier" varchar DEFAULT 'bronze',
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW(),
  
  UNIQUE("user_id", "ranking_type", "date")
);

CREATE INDEX IF NOT EXISTS "leaderboard_rankings_rank_idx" ON "leaderboard_rankings"("ranking_type", "date", "rank");
CREATE INDEX IF NOT EXISTS "leaderboard_rankings_user_idx" ON "leaderboard_rankings"("user_id");

-- Reward Distribution - Track reward issuance
CREATE TABLE IF NOT EXISTS "reward_distribution" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient_id" varchar NOT NULL,
  "reward_type" varchar NOT NULL,
  "date" date NOT NULL,
  
  "amount" numeric(20, 8) NOT NULL DEFAULT '0',
  "status" varchar NOT NULL DEFAULT 'pending',
  "distribution_date" timestamp,
  
  "source" varchar DEFAULT 'activities',
  "metadata" jsonb DEFAULT '{}'::jsonb,
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "reward_distribution_recipient_idx" ON "reward_distribution"("recipient_id");
CREATE INDEX IF NOT EXISTS "reward_distribution_type_idx" ON "reward_distribution"("reward_type");
CREATE INDEX IF NOT EXISTS "reward_distribution_date_idx" ON "reward_distribution"("date" DESC);
CREATE INDEX IF NOT EXISTS "reward_distribution_status_idx" ON "reward_distribution"("status");

-- DAO Analytics - Track DAO metrics and performance
CREATE TABLE IF NOT EXISTS "dao_analytics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dao_id" uuid NOT NULL,
  "date" date NOT NULL,
  
  -- Membership metrics
  "total_members" integer NOT NULL DEFAULT 0,
  "new_members_today" integer NOT NULL DEFAULT 0,
  "active_members" integer NOT NULL DEFAULT 0,
  "members_by_tier" jsonb DEFAULT '{}'::jsonb,
  
  -- Activity metrics
  "total_proposals" integer NOT NULL DEFAULT 0,
  "active_proposals" integer NOT NULL DEFAULT 0,
  "total_votes" integer NOT NULL DEFAULT 0,
  "average_participation" numeric(5, 2) DEFAULT '0',
  
  -- Treasury metrics
  "treasury_balance" numeric(20, 8) NOT NULL DEFAULT '0',
  "inflows" numeric(20, 8) NOT NULL DEFAULT '0',
  "outflows" numeric(20, 8) NOT NULL DEFAULT '0',
  "net_flow" numeric(20, 8) NOT NULL DEFAULT '0',
  
  -- Type and region
  "dao_type" varchar,
  "region" varchar,
  "cause_category" varchar,
  
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW(),
  
  UNIQUE("dao_id", "date")
);

CREATE INDEX IF NOT EXISTS "dao_analytics_dao_idx" ON "dao_analytics"("dao_id");
CREATE INDEX IF NOT EXISTS "dao_analytics_date_idx" ON "dao_analytics"("date" DESC);
CREATE INDEX IF NOT EXISTS "dao_analytics_type_idx" ON "dao_analytics"("dao_type");
CREATE INDEX IF NOT EXISTS "dao_analytics_region_idx" ON "dao_analytics"("region");
CREATE INDEX IF NOT EXISTS "dao_analytics_cause_idx" ON "dao_analytics"("cause_category");
