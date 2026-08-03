import { pool } from '../../db';

export async function migrateYukiWatchlists(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS symbols (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticker VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS yuki_watchlists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS yuki_watchlist_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      watchlist_id UUID NOT NULL REFERENCES yuki_watchlists(id) ON DELETE CASCADE,
      item_type VARCHAR(50) NOT NULL,
      symbol_id UUID REFERENCES symbols(id),
      pool_id UUID,
      vault_id UUID,
      investment_pool_id UUID,
      alert_metric VARCHAR(50),
      alert_direction VARCHAR(20),
      alert_threshold NUMERIC(20,8),
      alert_active BOOLEAN NOT NULL DEFAULT FALSE,
      alert_last_fired_at TIMESTAMPTZ,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE symbols ADD COLUMN IF NOT EXISTS ticker VARCHAR(64);
    ALTER TABLE symbols ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE symbols ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE symbols ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    ALTER TABLE yuki_watchlists ADD COLUMN IF NOT EXISTS user_id VARCHAR;
    ALTER TABLE yuki_watchlists ADD COLUMN IF NOT EXISTS name VARCHAR(100);
    ALTER TABLE yuki_watchlists ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE yuki_watchlists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS watchlist_id UUID;
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(50);
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS symbol_id UUID;
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS pool_id UUID;
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS vault_id UUID;
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS investment_pool_id UUID;
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS alert_metric VARCHAR(50);
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS alert_direction VARCHAR(20);
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS alert_threshold NUMERIC(20,8);
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS alert_active BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS alert_last_fired_at TIMESTAMPTZ;
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE yuki_watchlist_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

    CREATE UNIQUE INDEX IF NOT EXISTS idx_symbols_ticker ON symbols(ticker);
    CREATE INDEX IF NOT EXISTS idx_yuki_watchlists_user_id ON yuki_watchlists(user_id);
    CREATE INDEX IF NOT EXISTS idx_yuki_watchlist_items_watchlist_id ON yuki_watchlist_items(watchlist_id);
    CREATE INDEX IF NOT EXISTS idx_yuki_watchlist_items_item_type ON yuki_watchlist_items(item_type);
    CREATE INDEX IF NOT EXISTS idx_yuki_watchlist_items_symbol_id ON yuki_watchlist_items(symbol_id);
    CREATE INDEX IF NOT EXISTS idx_yuki_watchlist_items_alert_active ON yuki_watchlist_items(alert_active);
  `);
}

export async function rollbackYukiWatchlists(): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS yuki_watchlist_items CASCADE');
  await pool.query('DROP TABLE IF EXISTS yuki_watchlists CASCADE');
  await pool.query('DROP TABLE IF EXISTS symbols CASCADE');
}
