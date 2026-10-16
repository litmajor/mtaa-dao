import { pool } from '../../db';

export async function migratePoolShareMarketplace(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pool_share_listings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pool_id UUID REFERENCES investment_pools(id) ON DELETE CASCADE,
      seller_id VARCHAR REFERENCES users(id),
      shares NUMERIC(18, 8) NOT NULL,
      shares_remaining NUMERIC(18, 8),
      price_per_share NUMERIC(18, 8) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP
    );

    ALTER TABLE pool_share_listings
      ADD COLUMN IF NOT EXISTS shares_remaining NUMERIC(18, 8);

    UPDATE pool_share_listings
    SET shares_remaining = CASE
      WHEN status = 'active' THEN shares
      ELSE 0
    END
    WHERE shares_remaining IS NULL;

    ALTER TABLE pool_share_listings
      ALTER COLUMN shares_remaining SET DEFAULT 0,
      ALTER COLUMN shares_remaining SET NOT NULL;

    CREATE INDEX IF NOT EXISTS pool_share_listings_pool_active_idx
      ON pool_share_listings (pool_id, status);

    CREATE TABLE IF NOT EXISTS pool_share_trades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id UUID REFERENCES pool_share_listings(id),
      pool_id UUID REFERENCES investment_pools(id),
      buyer_id VARCHAR REFERENCES users(id),
      seller_id VARCHAR REFERENCES users(id),
      shares NUMERIC(18, 8) NOT NULL,
      price_per_share NUMERIC(18, 8) NOT NULL,
      total_amount NUMERIC(18, 2) NOT NULL,
      idempotency_key VARCHAR(200),
      status VARCHAR(20) NOT NULL DEFAULT 'completed',
      traded_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE pool_share_trades
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200);

    CREATE UNIQUE INDEX IF NOT EXISTS pool_share_trades_idempotency_uq
      ON pool_share_trades (idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `);
}

export async function rollbackPoolShareMarketplace(): Promise<void> {
  await pool.query(`
    DROP INDEX IF EXISTS pool_share_trades_idempotency_uq;
    DROP INDEX IF EXISTS pool_share_listings_pool_active_idx;
    ALTER TABLE pool_share_trades DROP COLUMN IF EXISTS idempotency_key;
    ALTER TABLE pool_share_listings DROP COLUMN IF EXISTS shares_remaining;
  `);
}
