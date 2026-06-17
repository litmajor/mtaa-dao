-- Migration: create indexer_progress table
-- Created by assistant to persist durable indexer cursors

CREATE TABLE IF NOT EXISTS public.indexer_progress (
  indexer_name varchar(100) PRIMARY KEY,
  last_processed_block integer NOT NULL,
  last_processed_block_hash varchar(66),
  chain_id integer NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Optionally seed a default row for the maono indexer (uncomment to insert):
-- INSERT INTO public.indexer_progress (indexer_name, last_processed_block, chain_id) VALUES ('maono_vault_main_indexer', 22000000, 44787) ON CONFLICT (indexer_name) DO NOTHING;
