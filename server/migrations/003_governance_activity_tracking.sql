-- Migration: Create governance activity tracking tables
-- Purpose: Support activity logging, role progression, and promotion system

-- Create governance_activity_log table
CREATE TABLE IF NOT EXISTS governance_activity_log (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- vote, proposal, comment, meeting, task, invite
  points INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  -- Indexes for common queries
  CONSTRAINT fk_user_dao UNIQUE (user_id, dao_id, id)
);

CREATE INDEX idx_activity_log_user_dao ON governance_activity_log(user_id, dao_id, created_at DESC);
CREATE INDEX idx_activity_log_dao_type ON governance_activity_log(dao_id, type, created_at DESC);
CREATE INDEX idx_activity_log_expires ON governance_activity_log(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_activity_log_points ON governance_activity_log(user_id, dao_id, points DESC);

-- Create governance_promotion_history table
CREATE TABLE IF NOT EXISTS governance_promotion_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  from_role VARCHAR(50) NOT NULL, -- member, elder, admin
  to_role VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  promoted_by VARCHAR(50) NOT NULL DEFAULT 'system', -- system, admin, request
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promotion_history_user_dao ON governance_promotion_history(user_id, dao_id, created_at DESC);
CREATE INDEX idx_promotion_history_dao ON governance_promotion_history(dao_id, created_at DESC);
CREATE INDEX idx_promotion_history_promoted_by ON governance_promotion_history(promoted_by);

-- Create governance_promotion_requests table
CREATE TABLE IF NOT EXISTS governance_promotion_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  current_role VARCHAR(50) NOT NULL, -- member, elder, admin
  requested_role VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  reason TEXT,
  current_points INTEGER NOT NULL DEFAULT 0,
  member_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_promotion_requests_user_dao ON governance_promotion_requests(user_id, dao_id, status);
CREATE INDEX idx_promotion_requests_dao_status ON governance_promotion_requests(dao_id, status, created_at DESC);
CREATE INDEX idx_promotion_requests_pending ON governance_promotion_requests(status) WHERE status = 'pending';

-- Create governance_activity_types reference table
CREATE TABLE IF NOT EXISTS governance_activity_types (
  type_id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  metadata JSONB
);

-- Seed activity types
INSERT INTO governance_activity_types (type_id, label, points, description) VALUES
  ('vote', 'Cast Vote', 5, 'Award points when user votes on a proposal'),
  ('proposal', 'Create Proposal', 15, 'Award points when user creates a proposal'),
  ('comment', 'Post Comment', 3, 'Award points when user comments on a proposal'),
  ('meeting', 'Attend Meeting', 10, 'Award points when user attends a DAO meeting'),
  ('task', 'Complete Task', 20, 'Award points when user completes a DAO task'),
  ('invite', 'Invite Member', 10, 'Award points when invited member joins DAO'),
  ('promotion', 'Role Promotion', 0, 'Bonus points for role promotion (amount varies)')
ON CONFLICT (type_id) DO NOTHING;

-- Create governance_role_requirements table
CREATE TABLE IF NOT EXISTS governance_role_requirements (
  role_id VARCHAR(50) PRIMARY KEY,
  next_role VARCHAR(50),
  points_required INTEGER NOT NULL,
  points_window_days INTEGER NOT NULL,
  min_member_days INTEGER NOT NULL,
  description TEXT
);

-- Seed role requirements
INSERT INTO governance_role_requirements (role_id, next_role, points_required, points_window_days, min_member_days, description) VALUES
  ('member', 'elder', 50, 30, 7, 'Reach 50 points in 30 days to become Elder'),
  ('elder', 'admin', 200, 90, 30, 'Reach 200 points in 90 days to become Admin'),
  ('admin', NULL, 0, 0, 0, 'Maximum role reached')
ON CONFLICT (role_id) DO NOTHING;

-- Create view for user activity stats
CREATE OR REPLACE VIEW vw_user_activity_stats AS
SELECT 
  gal.user_id,
  gal.dao_id,
  COUNT(*) as total_activities,
  SUM(gal.points) as total_points,
  COUNT(DISTINCT DATE(gal.created_at)) as days_active,
  MAX(gal.created_at) as last_activity_date,
  MIN(gal.created_at) as first_activity_date,
  ROUND(SUM(gal.points)::NUMERIC / COUNT(DISTINCT DATE(gal.created_at))::NUMERIC, 2) as avg_points_per_day
FROM governance_activity_log gal
WHERE gal.expires_at IS NULL OR gal.expires_at > NOW()
GROUP BY gal.user_id, gal.dao_id;

-- Create view for promotion eligibility
CREATE OR REPLACE VIEW vw_promotion_eligibility AS
SELECT 
  dm.user_id,
  dm.dao_id,
  dm.role as current_role,
  grr.next_role,
  grr.points_required,
  COALESCE(SUM(gal.points), 0) as current_points,
  COALESCE(SUM(gal.points), 0) >= grr.points_required as points_eligible,
  EXTRACT(DAY FROM NOW() - dm.joined_at)::INTEGER as member_days,
  EXTRACT(DAY FROM NOW() - dm.joined_at)::INTEGER >= grr.min_member_days as days_eligible,
  CASE 
    WHEN dm.role = 'admin' THEN false
    WHEN COALESCE(SUM(gal.points), 0) >= grr.points_required 
         AND EXTRACT(DAY FROM NOW() - dm.joined_at)::INTEGER >= grr.min_member_days THEN true
    ELSE false
  END as is_eligible
FROM dao_members dm
LEFT JOIN governance_role_requirements grr ON dm.role = grr.role_id
LEFT JOIN governance_activity_log gal ON dm.user_id = gal.user_id 
  AND dm.dao_id = gal.dao_id 
  AND gal.created_at > NOW() - INTERVAL '1 day' * grr.points_window_days
  AND (gal.expires_at IS NULL OR gal.expires_at > NOW())
GROUP BY dm.user_id, dm.dao_id, dm.role, dm.joined_at, grr.next_role, grr.points_required, grr.min_member_days, grr.points_window_days;

-- Add missing column to dao_members if it doesn't exist
ALTER TABLE dao_members 
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS activity_points INTEGER DEFAULT 0;

-- Create trigger to update activity_points when activity is logged
CREATE OR REPLACE FUNCTION update_user_activity_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dao_members 
  SET activity_points = (
    SELECT COALESCE(SUM(points), 0)
    FROM governance_activity_log
    WHERE user_id = NEW.user_id AND dao_id = NEW.dao_id
      AND (expires_at IS NULL OR expires_at > NOW())
  )
  WHERE user_id = NEW.user_id AND dao_id = NEW.dao_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_activity_points
AFTER INSERT ON governance_activity_log
FOR EACH ROW
EXECUTE FUNCTION update_user_activity_points();

-- Comments for documentation
COMMENT ON TABLE governance_activity_log IS 'Tracks user activity and points for role progression';
COMMENT ON TABLE governance_promotion_history IS 'Records user role promotions and history';
COMMENT ON TABLE governance_promotion_requests IS 'Pending promotion requests awaiting admin approval';
COMMENT ON COLUMN governance_activity_log.points IS 'Activity points awarded (default varies by activity type)';
COMMENT ON COLUMN governance_activity_log.expires_at IS 'Points expire after 90 days unless renewed';
COMMENT ON COLUMN governance_promotion_history.promoted_by IS 'How promotion was triggered: system (auto), admin (manual), or request (user requested)';
