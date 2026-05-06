/**
 * Database Migration: Marketplace Scaling Optimization
 * 
 * This migration adds denormalization and indexes needed to scale 
 * marketplace queries to millions of users without performance degradation.
 */

-- Add denormalized rating_count column
-- (BIGINT to support >2 billion ratings per strategy)
ALTER TABLE marketplace_strategies 
ADD COLUMN rating_count BIGINT DEFAULT 0,
ADD COLUMN last_stats_update TIMESTAMPTZ DEFAULT NOW();

-- Backfill rating_count with existing data
-- This may take time if you have millions of ratings
UPDATE marketplace_strategies m
SET rating_count = (
  SELECT COUNT(DISTINCT user_id) 
  FROM strategy_ratings 
  WHERE marketplace_id = m.id
),
last_stats_update = NOW()
WHERE is_published = true;

-- Create indexes for fast filtering
CREATE INDEX idx_marketplace_published 
  ON marketplace_strategies(is_published, is_public) 
  WHERE is_published = true AND is_public = true;

CREATE INDEX idx_marketplace_category 
  ON marketplace_strategies(category) 
  WHERE is_published = true;

CREATE INDEX idx_marketplace_risk_level 
  ON marketplace_strategies(risk_level) 
  WHERE is_published = true;

CREATE INDEX idx_marketplace_author_id 
  ON marketplace_strategies(author_id);

CREATE INDEX idx_marketplace_strategy_id 
  ON marketplace_strategies(strategy_id);

-- Sorting indexes for common queries
CREATE INDEX idx_marketplace_copy_count 
  ON marketplace_strategies(copy_count DESC) 
  WHERE is_published = true;

CREATE INDEX idx_marketplace_rating 
  ON marketplace_strategies(avg_rating DESC) 
  WHERE is_published = true;

CREATE INDEX idx_marketplace_return 
  ON marketplace_strategies(avg_return DESC) 
  WHERE is_published = true;

-- Rating table indexes for async updates
CREATE INDEX idx_strategy_ratings_marketplace 
  ON strategy_ratings(marketplace_id);

CREATE INDEX idx_strategy_ratings_user 
  ON strategy_ratings(user_id);

-- PostgreSQL Trigger: Auto-update stats on new ratings
CREATE OR REPLACE FUNCTION update_marketplace_stats_on_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify async worker to update stats
  PERFORM pg_notify(
    'marketplace:stats_update', 
    json_build_object(
      'marketplace_id', NEW.marketplace_id,
      'action', TG_OP
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT
DROP TRIGGER IF EXISTS trg_marketplace_stats_on_rating_insert ON strategy_ratings;
CREATE TRIGGER trg_marketplace_stats_on_rating_insert
AFTER INSERT ON strategy_ratings
FOR EACH ROW 
EXECUTE FUNCTION update_marketplace_stats_on_rating();

-- Trigger on DELETE (to decrement counts)
DROP TRIGGER IF EXISTS trg_marketplace_stats_on_rating_delete ON strategy_ratings;
CREATE TRIGGER trg_marketplace_stats_on_rating_delete
AFTER DELETE ON strategy_ratings
FOR EACH ROW 
EXECUTE FUNCTION update_marketplace_stats_on_rating();

-- PostgreSQL Trigger: Sync returns from strategies table
CREATE OR REPLACE FUNCTION sync_marketplace_returns()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.returns IS DISTINCT FROM NEW.returns THEN
    UPDATE marketplace_strategies 
    SET avg_return = NEW.returns, 
        updated_at = NOW()
    WHERE strategy_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_strategies_returns_sync ON strategies;
CREATE TRIGGER trg_strategies_returns_sync
AFTER UPDATE OF returns ON strategies
FOR EACH ROW 
EXECUTE FUNCTION sync_marketplace_returns();

-- Partial index for active marketplace lookups
-- (common case: recent published strategies)
CREATE INDEX idx_marketplace_recent_published 
  ON marketplace_strategies(published_at DESC) 
  WHERE is_published = true 
  AND published_at > NOW() - INTERVAL '90 days';

-- Composite index for common filter + sort combinations
CREATE INDEX idx_marketplace_category_rating 
  ON marketplace_strategies(category, avg_rating DESC) 
  WHERE is_published = true;

CREATE INDEX idx_marketplace_risk_rating 
  ON marketplace_strategies(risk_level, avg_rating DESC) 
  WHERE is_published = true;

-- Verify migration was successful
SELECT 
  COUNT(*) as total_strategies,
  COUNT(*) FILTER (WHERE rating_count > 0) as with_ratings,
  COUNT(*) FILTER (WHERE is_published = true) as published,
  MAX(rating_count) as max_ratings_per_strategy
FROM marketplace_strategies;
