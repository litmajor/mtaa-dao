
-- Add short-term DAO extension tracking columns
ALTER TABLE daos 
ADD COLUMN IF NOT EXISTS dao_type VARCHAR DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS extension_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_duration INTEGER,
ADD COLUMN IF NOT EXISTS current_extension_duration INTEGER;

-- Update existing short-term DAOs
UPDATE daos 
SET dao_type = 'short_term',
    original_duration = 30
WHERE plan = 'free' 
  AND plan_expires_at IS NOT NULL;

-- Add check constraint for extension limit
ALTER TABLE daos 
ADD CONSTRAINT extension_count_check 
CHECK (extension_count >= 0 AND extension_count <= 2);
