import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('valuation-assets-migration');

export async function migrateValuationAssets(): Promise<void> {
  logger.info('Applying valuation assets schema');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.valuation_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        symbol VARCHAR(32) NOT NULL,
        coingecko_id VARCHAR(128),
        asset_class VARCHAR(16) NOT NULL
          CHECK (asset_class IN ('stable', 'major', 'mid', 'alt')),
        max_deviation_pct NUMERIC(8, 4) NOT NULL DEFAULT 2,
        haircut_pct NUMERIC(8, 4) NOT NULL DEFAULT 0,
        chain VARCHAR(64),
        contract_address VARCHAR(128),
        is_active BOOLEAN NOT NULL DEFAULT true,
        notes TEXT,
        created_by VARCHAR,
        updated_by VARCHAR,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS valuation_assets_symbol_uq
        ON public.valuation_assets (symbol);

      INSERT INTO public.valuation_assets
        (symbol, coingecko_id, asset_class, max_deviation_pct, haircut_pct, is_active, notes)
      VALUES
        ('BTC', 'bitcoin', 'major', 1.0, 0.5, true, 'Curated initial valuation asset'),
        ('ETH', 'ethereum', 'major', 1.0, 0.5, true, 'Curated initial valuation asset'),
        ('SOL', 'solana', 'mid', 2.0, 2.0, true, 'Curated initial valuation asset'),
        ('BNB', 'binancecoin', 'mid', 2.0, 2.0, true, 'Curated initial valuation asset'),
        ('CELO', 'celo', 'mid', 2.5, 3.0, true, 'Curated initial valuation asset'),
        ('USDC', 'usd-coin', 'stable', 0.5, 0, true, 'Curated initial valuation asset'),
        ('USDT', 'tether', 'stable', 0.5, 0, true, 'Curated initial valuation asset'),
        ('CUSD', 'celo-dollar', 'stable', 0.75, 0, true, 'Curated initial valuation asset'),
        ('CEUR', 'celo-euro', 'stable', 1.0, 0, true, 'Curated initial valuation asset'),
        ('WBTC', 'wrapped-bitcoin', 'major', 1.0, 0.5, true, 'Curated initial valuation asset')
      ON CONFLICT (symbol) DO NOTHING;
    `);
    logger.info('Valuation assets schema applied');
  } catch (error) {
    logger.error('Failed to apply valuation assets schema', error);
    throw error;
  }
}

export async function rollbackValuationAssets(): Promise<void> {
  logger.info('Rolling back valuation assets schema');
  try {
    await pool.query('DROP TABLE IF EXISTS public.valuation_assets CASCADE');
    logger.info('Valuation assets schema rolled back');
  } catch (error) {
    logger.error('Failed to roll back valuation assets schema', error);
    throw error;
  }
}
