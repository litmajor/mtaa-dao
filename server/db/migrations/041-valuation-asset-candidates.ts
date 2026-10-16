import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('valuation-asset-candidates-migration');
const manualProposalReason =
  'Manually proposed from the user-provided CoinMarketCap watchlist; requires explicit admin approval unless already allowlisted.';

const manualCandidates: Array<{ symbol: string; coingeckoId: string | null; tier: 1 | 2 }> = [
  { symbol: 'BTC', coingeckoId: 'bitcoin', tier: 1 },
  { symbol: 'ETH', coingeckoId: 'ethereum', tier: 1 },
  { symbol: 'USDT', coingeckoId: 'tether', tier: 1 },
  { symbol: 'BNB', coingeckoId: 'binancecoin', tier: 1 },
  { symbol: 'XRP', coingeckoId: 'ripple', tier: 1 },
  { symbol: 'SOL', coingeckoId: 'solana', tier: 1 },
  { symbol: 'DOGE', coingeckoId: 'dogecoin', tier: 1 },
  { symbol: 'ADA', coingeckoId: 'cardano', tier: 1 },
  { symbol: 'TRX', coingeckoId: 'tron', tier: 1 },
  { symbol: 'NEAR', coingeckoId: 'near', tier: 1 },
  { symbol: 'XLM', coingeckoId: 'stellar', tier: 1 },
  { symbol: 'BCH', coingeckoId: 'bitcoin-cash', tier: 1 },
  { symbol: 'HBAR', coingeckoId: 'hedera-hashgraph', tier: 1 },
  { symbol: 'SUI', coingeckoId: 'sui', tier: 1 },
  { symbol: 'GRAM', coingeckoId: 'the-open-network', tier: 1 },
  { symbol: 'DAI', coingeckoId: 'dai', tier: 1 },
  { symbol: 'ZEC', coingeckoId: 'zcash', tier: 1 },
  { symbol: 'OKB', coingeckoId: 'okb', tier: 1 },
  { symbol: 'AAVE', coingeckoId: 'aave', tier: 1 },
  { symbol: 'ALGO', coingeckoId: 'algorand', tier: 1 },
  { symbol: 'KAS', coingeckoId: 'kaspa', tier: 1 },
  { symbol: 'CRO', coingeckoId: 'crypto-com-chain', tier: 1 },
  { symbol: 'SHIB', coingeckoId: 'shiba-inu', tier: 1 },
  { symbol: 'WLD', coingeckoId: 'worldcoin-wld', tier: 1 },
  { symbol: 'ONDO', coingeckoId: 'ondo-finance', tier: 1 },
  { symbol: 'MNT', coingeckoId: 'mantle', tier: 1 },
  { symbol: 'PEPE', coingeckoId: 'pepe', tier: 1 },
  { symbol: 'STX', coingeckoId: 'blockstack', tier: 1 },
  { symbol: 'XAUT', coingeckoId: 'tether-gold', tier: 1 },
  { symbol: 'PENDLE', coingeckoId: 'pendle', tier: 1 },
  { symbol: 'RAY', coingeckoId: 'raydium', tier: 1 },
  { symbol: 'SEI', coingeckoId: 'sei-network', tier: 1 },
  { symbol: 'POL', coingeckoId: 'polygon-ecosystem-token', tier: 1 },
  { symbol: 'CRV', coingeckoId: 'curve-dao-token', tier: 1 },
  { symbol: 'ICP', coingeckoId: 'internet-computer', tier: 1 },
  { symbol: 'INJ', coingeckoId: 'injective-protocol', tier: 1 },
  { symbol: 'JUP', coingeckoId: 'jupiter-exchange-solana', tier: 1 },
  { symbol: 'LTC', coingeckoId: 'litecoin', tier: 1 },
  { symbol: 'LINK', coingeckoId: 'chainlink', tier: 1 },
  { symbol: 'UNI', coingeckoId: 'uniswap', tier: 1 },
  { symbol: 'VET', coingeckoId: 'vechain', tier: 1 },
  { symbol: 'PI', coingeckoId: 'pi-network', tier: 1 },
  { symbol: 'ARB', coingeckoId: 'arbitrum', tier: 2 },
  { symbol: 'OP', coingeckoId: 'optimism', tier: 2 },
  { symbol: 'FLOW', coingeckoId: 'flow', tier: 2 },
  { symbol: 'GALA', coingeckoId: 'gala', tier: 2 },
  { symbol: 'MANA', coingeckoId: 'decentraland', tier: 2 },
  { symbol: 'SAND', coingeckoId: 'the-sandbox', tier: 2 },
  { symbol: 'THETA', coingeckoId: 'theta-token', tier: 2 },
  { symbol: 'MINA', coingeckoId: 'mina-protocol', tier: 2 },
  { symbol: 'KAVA', coingeckoId: 'kava', tier: 2 },
  { symbol: 'POLYX', coingeckoId: 'polymesh', tier: 2 },
  { symbol: 'TRB', coingeckoId: 'tellor', tier: 2 },
  { symbol: 'S', coingeckoId: null, tier: 2 },
  { symbol: 'BOME', coingeckoId: 'book-of-meme', tier: 2 },
  { symbol: 'BRETT', coingeckoId: 'based-brett', tier: 2 },
  { symbol: 'MEW', coingeckoId: 'cat-in-a-dogs-world', tier: 2 },
  { symbol: 'SNEK', coingeckoId: 'snek', tier: 2 },
  { symbol: 'CHZ', coingeckoId: 'chiliz', tier: 2 },
  { symbol: 'BEAM', coingeckoId: 'beam-2', tier: 2 },
  { symbol: 'FDUSD', coingeckoId: 'first-digital-usd', tier: 2 },
  { symbol: 'WOO', coingeckoId: 'woo-network', tier: 2 },
];

export async function migrateValuationAssetCandidates(): Promise<void> {
  logger.info('Applying valuation asset candidates schema and manual watchlist seed');
  try {
    await pool.query(`
      ALTER TABLE public.valuation_assets
        ADD COLUMN IF NOT EXISTS source VARCHAR(64) NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS added_reason TEXT,
        ADD COLUMN IF NOT EXISTS last_quorum_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_valuation_check_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS quorum_failure_since TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS review_required BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS review_reason TEXT,
        ADD COLUMN IF NOT EXISTS review_flagged_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS review_resolved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS review_resolved_by VARCHAR;

      UPDATE public.valuation_assets
      SET source = 'snapshot-2026-10-15',
          added_reason = notes
      WHERE notes = 'CoinGecko top-100 market-cap snapshot (2026-10-15); explicitly approved valuation candidate'
        AND source = 'manual'
        AND added_reason IS NULL;

      CREATE TABLE IF NOT EXISTS public.valuation_asset_candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        symbol VARCHAR(32) NOT NULL,
        coingecko_id VARCHAR(128),
        name TEXT,
        score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
        criteria_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(24) NOT NULL DEFAULT 'proposed'
          CHECK (status IN ('proposed', 'approved', 'rejected', 'stale', 'already_allowlisted')),
        source VARCHAR(16) NOT NULL CHECK (source IN ('pipeline', 'manual')),
        reason TEXT NOT NULL,
        review_notes TEXT,
        proposed_by VARCHAR,
        reviewed_by VARCHAR,
        reviewed_at TIMESTAMPTZ,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS valuation_asset_candidates_symbol_uq
        ON public.valuation_asset_candidates (symbol);
      CREATE UNIQUE INDEX IF NOT EXISTS valuation_asset_candidates_coingecko_id_uq
        ON public.valuation_asset_candidates (coingecko_id)
        WHERE coingecko_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS valuation_asset_candidates_status_score_idx
        ON public.valuation_asset_candidates (status, score DESC, last_seen_at DESC);

      CREATE TABLE IF NOT EXISTS public.valuation_asset_market_observations (
        coingecko_id VARCHAR(128) NOT NULL,
        observed_on DATE NOT NULL DEFAULT CURRENT_DATE,
        symbol VARCHAR(32) NOT NULL,
        market_cap_rank INTEGER,
        trusted_volume_24h_usd NUMERIC(30, 8),
        exchange_count INTEGER,
        trust_score NUMERIC(5, 2),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (coingecko_id, observed_on)
      );

      CREATE INDEX IF NOT EXISTS valuation_asset_market_observations_date_idx
        ON public.valuation_asset_market_observations (observed_on DESC);
    `);

    const values = manualCandidates
      .map((candidate, index) => {
        const offset = index * 4;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
      })
      .join(', ');
    const params = manualCandidates.flatMap((candidate) => [
      candidate.symbol,
      candidate.coingeckoId,
      candidate.tier,
      `${manualProposalReason} Tier ${candidate.tier}.`,
    ]);

    await pool.query(
      `
        INSERT INTO public.valuation_asset_candidates
          (symbol, coingecko_id, score, criteria_snapshot, status, source, reason, proposed_by, reviewed_at)
        SELECT
          candidate.symbol,
          candidate.coingecko_id,
          0,
          jsonb_build_object(
            'origin', 'user-provided CoinMarketCap watchlist',
            'tier', candidate.tier,
            'marketCapRank', NULL,
            'exchangeCount', NULL,
            'volume30dUsd', NULL,
            'trustScore', NULL
          ),
          CASE WHEN EXISTS (
            SELECT 1 FROM public.valuation_assets asset
            WHERE asset.symbol = candidate.symbol AND asset.is_active = true
          ) THEN 'already_allowlisted' ELSE 'proposed' END,
          'manual',
          CASE
            WHEN EXISTS (
              SELECT 1 FROM public.valuation_assets asset
              WHERE asset.symbol = candidate.symbol AND asset.is_active = true
            ) THEN candidate.reason || ' This symbol is already allowlisted; no new approval is implied.'
            ELSE candidate.reason
          END,
          'seed:cmc-watchlist'
        FROM (VALUES ${values}) AS candidate(symbol, coingecko_id, tier, reason)
        ON CONFLICT (symbol) DO NOTHING;
      `,
      params
    );

    await pool.query(
      `UPDATE public.valuation_assets
       SET source = 'manual',
           added_reason = COALESCE(added_reason, notes)
       WHERE source = 'manual' AND added_reason IS NULL`
    );
    logger.info('Valuation asset candidate schema and manual watchlist seed applied', {
      candidateCount: manualCandidates.length,
    });
  } catch (error) {
    logger.error('Failed to apply valuation asset candidates schema', error);
    throw error;
  }
}

export async function rollbackValuationAssetCandidates(): Promise<void> {
  logger.info('Rolling back valuation asset candidates schema');
  try {
    await pool.query(`
      DROP TABLE IF EXISTS public.valuation_asset_market_observations CASCADE;
      DROP TABLE IF EXISTS public.valuation_asset_candidates CASCADE;
      ALTER TABLE public.valuation_assets
        DROP COLUMN IF EXISTS added_reason,
        DROP COLUMN IF EXISTS source,
        DROP COLUMN IF EXISTS last_quorum_at,
        DROP COLUMN IF EXISTS last_valuation_check_at,
        DROP COLUMN IF EXISTS quorum_failure_since,
        DROP COLUMN IF EXISTS review_required,
        DROP COLUMN IF EXISTS review_reason,
        DROP COLUMN IF EXISTS review_flagged_at,
        DROP COLUMN IF EXISTS review_resolved_at,
        DROP COLUMN IF EXISTS review_resolved_by;
    `);
    logger.info('Valuation asset candidates schema rolled back');
  } catch (error) {
    logger.error('Failed to roll back valuation asset candidates schema', error);
    throw error;
  }
}
