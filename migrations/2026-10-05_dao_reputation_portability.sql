-- Add DAO-scoped reputation and achievement portability storage.
-- These tables back server/services/metaDaoService.ts and
-- server/services/reputationPortabilityService.ts.
BEGIN;

CREATE TABLE IF NOT EXISTS member_reputation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dao_id uuid NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  reputation_score integer NOT NULL DEFAULT 0,
  last_decay_applied timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT member_reputation_member_dao_unique UNIQUE (member_id, dao_id)
);

CREATE TABLE IF NOT EXISTS member_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dao_id uuid NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  achievement_type varchar NOT NULL,
  earned_at timestamptz DEFAULT NOW(),
  is_ported boolean NOT NULL DEFAULT false,
  original_dao_id uuid REFERENCES daos(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reputation_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_dao_id uuid NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  to_dao_id uuid NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  transferred_amount integer NOT NULL,
  transferred_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reputation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dao_id uuid NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  reason text NOT NULL,
  appeal_status varchar NOT NULL DEFAULT 'PENDING',
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS member_reputation_dao_score_idx
  ON member_reputation (dao_id, reputation_score DESC);
CREATE INDEX IF NOT EXISTS member_achievements_member_created_idx
  ON member_achievements (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reputation_transfers_from_date_idx
  ON reputation_transfers (from_dao_id, transferred_at DESC);

COMMIT;
