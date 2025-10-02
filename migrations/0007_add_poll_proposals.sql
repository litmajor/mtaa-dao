
-- Add poll support to proposals
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS poll_options JSONB DEFAULT '[]';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS allow_multiple_choices BOOLEAN DEFAULT false;

-- Update proposal_type to include 'poll'
COMMENT ON COLUMN proposals.proposal_type IS 'general, budget, emergency, poll';
