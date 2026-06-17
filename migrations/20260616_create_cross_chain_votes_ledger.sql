-- Migration: create cross_chain_votes_ledger table
-- Created to match shared/schema.ts crossChainVotesLedger definition

CREATE TABLE IF NOT EXISTS public.cross_chain_votes_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  chain VARCHAR NOT NULL,
  vote_type VARCHAR NOT NULL,
  weight DECIMAL(6,4) DEFAULT 1.0,
  voting_power DECIMAL(18,6) DEFAULT 0,
  tx_hash VARCHAR,
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Helpful indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cross_chain_votes_proposal ON public.cross_chain_votes_ledger (proposal_id);
CREATE INDEX IF NOT EXISTS idx_cross_chain_votes_user ON public.cross_chain_votes_ledger (user_id);
CREATE INDEX IF NOT EXISTS idx_cross_chain_votes_dao ON public.cross_chain_votes_ledger (dao_id);
CREATE INDEX IF NOT EXISTS idx_cross_chain_votes_chain ON public.cross_chain_votes_ledger (chain);

-- Optionally create an index on tx_hash if used for lookups
CREATE INDEX IF NOT EXISTS idx_cross_chain_votes_tx_hash ON public.cross_chain_votes_ledger (tx_hash);
