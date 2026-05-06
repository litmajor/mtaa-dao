/**
 * DENORMALIZED STAT TABLES
 * 
 * These tables maintain precomputed aggregates to avoid expensive GROUP BY queries.
 * Updated via:
 * 1. Event-driven triggers (on insert/update of source data)
 * 2. Periodic reconciliation job (every 5-10 minutes to catch drift)
 */

-- =========================================================================
-- DAO Member Stats: Precomputed activity metrics for leaderboard sorting
-- =========================================================================
CREATE TABLE IF NOT EXISTS dao_member_stats (
  id SERIAL PRIMARY KEY,
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  
  -- Precomputed counts (updated via event-driven triggers)
  contributions_count INT DEFAULT 0 NOT NULL,
  proposals_count INT DEFAULT 0 NOT NULL,
  votes_count INT DEFAULT 0 NOT NULL,
  
  -- Precomputed ranking fields (avoids dynamic scoring in queries)
  rank_score NUMERIC(12, 2) DEFAULT 0 NOT NULL,  -- contributions*10 + proposals*20 + votes*5
  reputation_score NUMERIC(12, 2) DEFAULT 0 NOT NULL,
  
  -- Tracking
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_reconciled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one stats record per member per DAO
  UNIQUE(dao_id, member_id),
  
  -- Indexes for fast leaderboard queries
  KEY(dao_id, rank_score DESC),
  KEY(dao_id, contributions_count DESC),
  KEY(dao_id, proposals_count DESC),
  KEY(dao_id, votes_count DESC)
);

-- =========================================================================
-- Strategy Stats: Precomputed execution metrics for strategy listing
-- =========================================================================
CREATE TABLE IF NOT EXISTS strategy_stats (
  id SERIAL PRIMARY KEY,
  strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  
  -- Precomputed execution metrics
  execution_count INT DEFAULT 0 NOT NULL,
  successful_executions INT DEFAULT 0 NOT NULL,
  failed_executions INT DEFAULT 0 NOT NULL,
  signal_count_24h INT DEFAULT 0 NOT NULL,  -- Signals in last 24 hours
  
  -- Performance metrics (cached from latest execution)
  avg_return NUMERIC(12, 4) DEFAULT 0,
  win_rate NUMERIC(5, 2) DEFAULT 0,  -- Percentage 0-100
  max_drawdown NUMERIC(12, 4) DEFAULT 0,
  
  -- Indexes for sorting
  popularity_score INT DEFAULT 0,  -- execution_count for ranking
  
  -- Tracking
  last_execution_at TIMESTAMP WITH TIME ZONE,
  last_reconciled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(strategy_id),
  
  -- Indexes for fast queries  
  KEY(execution_count DESC),
  KEY(popularity_score DESC),
  KEY(last_execution_at DESC)
);

-- =========================================================================
-- Trigger Helper: Update dao_member_stats on contribution insert
-- =========================================================================
CREATE OR REPLACE FUNCTION update_dao_member_stats_on_contribution()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify listener to update stats
  PERFORM pg_notify('dao_stats_update', json_build_object(
    'type', 'contribution',
    'dao_id', NEW.dao_id,
    'member_id', NEW.user_id,
    'action', TG_OP
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- Trigger Helper: Update dao_member_stats on proposal insert
-- =========================================================================
CREATE OR REPLACE FUNCTION update_dao_member_stats_on_proposal()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('dao_stats_update', json_build_object(
    'type', 'proposal',
    'dao_id', NEW.dao_id,
    'member_id', NEW.user_id,
    'action', TG_OP
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- Trigger Helper: Update dao_member_stats on vote insert
-- =========================================================================
CREATE OR REPLACE FUNCTION update_dao_member_stats_on_vote()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('dao_stats_update', json_build_object(
    'type', 'vote',
    'dao_id', NEW.dao_id,
    'member_id', NEW.user_id,
    'action', TG_OP
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- Trigger Helper: Update strategy_stats on execution
-- =========================================================================
CREATE OR REPLACE FUNCTION update_strategy_stats_on_execution()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('strategy_stats_update', json_build_object(
    'type', 'execution',
    'strategy_id', NEW.strategy_id,
    'status', NEW.status,
    'action', TG_OP
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- Create Triggers (if not exist)
-- =========================================================================
DROP TRIGGER IF EXISTS tr_update_dao_member_stats_contribution ON contributions;
CREATE TRIGGER tr_update_dao_member_stats_contribution
AFTER INSERT ON contributions
FOR EACH ROW
EXECUTE FUNCTION update_dao_member_stats_on_contribution();

DROP TRIGGER IF EXISTS tr_update_dao_member_stats_proposal ON proposals;
CREATE TRIGGER tr_update_dao_member_stats_proposal
AFTER INSERT ON proposals
FOR EACH ROW
EXECUTE FUNCTION update_dao_member_stats_on_proposal();

DROP TRIGGER IF EXISTS tr_update_dao_member_stats_vote ON votes;
CREATE TRIGGER tr_update_dao_member_stats_vote
AFTER INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION update_dao_member_stats_on_vote();

DROP TRIGGER IF EXISTS tr_update_strategy_stats_execution ON strategy_executions;
CREATE TRIGGER tr_update_strategy_stats_execution
AFTER INSERT ON strategy_executions
FOR EACH ROW
EXECUTE FUNCTION update_strategy_stats_on_execution();
