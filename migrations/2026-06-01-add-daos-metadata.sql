-- Add metadata JSONB column to daos for storing lifecycle/features and other arbitrary metadata
ALTER TABLE IF EXISTS daos
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Optional: backfill existing rows with empty metadata where null
UPDATE daos SET metadata = '{}'::jsonb WHERE metadata IS NULL;
