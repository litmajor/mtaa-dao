-- Create a durable nonce counter table for atomic nonce allocation
CREATE TABLE IF NOT EXISTS nonce_counters (
  address varchar PRIMARY KEY,
  next_nonce numeric(30,0) NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nonce_counters_address ON nonce_counters (address);

-- Usage pattern (example):
-- INSERT INTO nonce_counters (address, next_nonce, updated_at)
-- VALUES ('0xabc...', 10, now())
-- ON CONFLICT (address) DO UPDATE SET next_nonce = nonce_counters.next_nonce + 10, updated_at = now()
-- RETURNING (next_nonce - 10) AS start_nonce;
