import cron, { type ScheduledTask } from 'node-cron';
import type { PoolClient } from 'pg';
import { pool } from '../db';
import { logger } from '../utils/logger';
import { priceOracle } from './priceOracle';

const COINGECKO_BASE_URL =
  process.env.COINGECKO_API_BASE_URL?.replace(/\/+$/, '') ??
  (process.env.COINGECKO_PRO_API_KEY
    ? 'https://pro-api.coingecko.com/api/v3'
    : 'https://api.coingecko.com/api/v3');
const CANDIDATE_RANK_LIMIT = 150;
const DEFAULT_DETAIL_LIMIT = 25;
const HIGH_PRIORITY_SCORE = 60;
const REQUEST_DELAY_MS = 4_000;
const QUORUM_REVIEW_DAYS = Math.max(
  1,
  Number.parseInt(process.env.VALUATION_QUORUM_REVIEW_DAYS ?? '7', 10) || 7
);

interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
  total_volume: number | null;
}

interface CoinTicker {
  market?: { identifier?: string; name?: string };
  trust_score?: string | null;
  is_stale?: boolean;
  last_traded_at?: string | null;
  converted_volume?: { usd?: number };
}

interface TickerResponse {
  tickers?: CoinTicker[];
}

interface CoinDetails {
  genesis_date?: string | null;
}

interface MarketObservationSummary {
  observedDays: number;
  trustedVolume30dUsd: number;
}

interface TickerStats {
  exchangeCount: number;
  trustScore: number | null;
  trustedVolume24hUsd: number;
}

interface ExistingCandidate {
  symbol: string;
  coingecko_id: string | null;
  name: string | null;
  status: string;
  source: string;
  score: number;
  criteria_snapshot: Record<string, unknown>;
}

export interface CandidatePipelineResult {
  skipped: boolean;
  candidatesScanned: number;
  candidateDetailsRefreshed: number;
  assetsRevalidated: number;
  assetsFlaggedForReview: number;
}

function scoreCandidate(input: {
  marketCapRank: number | null;
  exchangeCount: number | null;
  trustedVolume30dUsd: number | null;
  volumeObservationDays: number;
  trustScore: number | null;
  ageDays: number | null;
}): number {
  const rank = input.marketCapRank;
  const rankPoints =
    rank === null || rank < 1 || rank > 200
      ? 0
      : rank <= 50
        ? 40
        : (200 - rank) / 150 * 40;

  const exchanges = input.exchangeCount ?? 0;
  const exchangePoints =
    exchanges >= 5 ? 30 : exchanges === 4 ? 25 : exchanges === 3 ? 20 : exchanges === 2 ? 10 : 0;

  let volumePoints = 0;
  if (
    input.trustedVolume30dUsd !== null &&
    input.volumeObservationDays >= 20 &&
    input.trustedVolume30dUsd >= 1_000_000
  ) {
    volumePoints =
      Math.min(
        20,
        (Math.log10(input.trustedVolume30dUsd) - 6) / 2 * 20
      );
  }

  const trustPoints =
    input.trustScore === null ? 0 : Math.max(0, Math.min(100, input.trustScore)) / 10;
  const rawScore = Math.round(rankPoints + exchangePoints + volumePoints + trustPoints);
  const ageIsVerified = input.ageDays !== null && input.ageDays >= 90;

  // Young or unverified assets stay visible, but cannot rise into the high-score queue.
  return ageIsVerified ? Math.min(100, rawScore) : Math.min(59, rawScore);
}

function toPositiveNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseTrustScore(score: string | null | undefined): number {
  if (score === 'green') return 100;
  if (score === 'yellow') return 50;
  return 0;
}

function isFreshTicker(ticker: CoinTicker, now: number): boolean {
  if (ticker.is_stale === true || !ticker.market?.identifier) return false;
  if (!toPositiveNumber(ticker.converted_volume?.usd)) return false;
  const tradedAt = ticker.last_traded_at ? Date.parse(ticker.last_traded_at) : Number.NaN;
  return Number.isFinite(tradedAt) && tradedAt <= now && now - tradedAt <= 7 * 86_400_000;
}

async function fetchCoinGecko<T>(path: string): Promise<T> {
  const headers = new Headers({ accept: 'application/json' });
  const proApiKey = process.env.COINGECKO_PRO_API_KEY;
  const demoApiKey = process.env.COINGECKO_API_KEY;
  if (proApiKey) headers.set('x-cg-pro-api-key', proApiKey);
  else if (demoApiKey) headers.set('x-cg-demo-api-key', demoApiKey);

  const response = await fetch(`${COINGECKO_BASE_URL}${path}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`CoinGecko request failed (${response.status}) for ${path}`);
  }
  return (await response.json()) as T;
}

async function getTickerStats(coinId: string): Promise<TickerStats> {
  const result = await fetchCoinGecko<TickerResponse>(
    `/coins/${encodeURIComponent(coinId)}/tickers?order=volume_desc&per_page=100&page=1`
  );
  const tickers = (result.tickers ?? []).filter((ticker) => isFreshTicker(ticker, Date.now()));
  const exchangeTrust = new Map<string, number>();
  let trustedVolume24hUsd = 0;

  for (const ticker of tickers) {
    const exchange = ticker.market?.identifier;
    if (!exchange) continue;
    const trust = parseTrustScore(ticker.trust_score);
    exchangeTrust.set(exchange, Math.max(exchangeTrust.get(exchange) ?? 0, trust));
    if (ticker.trust_score === 'green') {
      trustedVolume24hUsd += toPositiveNumber(ticker.converted_volume?.usd) ?? 0;
    }
  }

  const trustValues = Array.from(exchangeTrust.values());
  return {
    exchangeCount: trustValues.filter((trust) => trust >= 50).length,
    trustScore:
      trustValues.length > 0
        ? trustValues.reduce((total, trust) => total + trust, 0) / trustValues.length
        : null,
    trustedVolume24hUsd,
  };
}

async function getCoinAgeDays(coinId: string): Promise<number | null> {
  const details = await fetchCoinGecko<CoinDetails>(
    `/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`
  );
  if (!details.genesis_date) return null;
  const genesisDate = Date.parse(`${details.genesis_date}T00:00:00Z`);
  if (!Number.isFinite(genesisDate) || genesisDate > Date.now()) return null;
  return Math.floor((Date.now() - genesisDate) / 86_400_000);
}

function dateFromSnapshot(snapshot: Record<string, unknown>, key: string): number {
  const value = snapshot[key];
  if (typeof value !== 'string') return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getMarketObservationSummary(
  coinId: string
): Promise<MarketObservationSummary> {
  const { rows } = await pool.query<{
    observed_days: string;
    trusted_volume_30d_usd: string | null;
  }>(
    `SELECT COUNT(trusted_volume_24h_usd)::text AS observed_days,
            SUM(trusted_volume_24h_usd)::text AS trusted_volume_30d_usd
     FROM public.valuation_asset_market_observations
     WHERE coingecko_id = $1
       AND observed_on >= CURRENT_DATE - INTERVAL '29 days'`,
    [coinId]
  );
  return {
    observedDays: Number(rows[0]?.observed_days ?? 0),
    trustedVolume30dUsd:
      rows[0]?.trusted_volume_30d_usd === null
        ? 0
        : Number(rows[0]?.trusted_volume_30d_usd ?? 0),
  };
}

async function recordMarketObservation(
  coin: CoinMarket,
  stats: TickerStats | null
): Promise<void> {
  await pool.query(
    `INSERT INTO public.valuation_asset_market_observations
       (coingecko_id, observed_on, symbol, market_cap_rank, trusted_volume_24h_usd, exchange_count, trust_score)
     VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
     ON CONFLICT (coingecko_id, observed_on) DO UPDATE SET
       symbol = EXCLUDED.symbol,
       market_cap_rank = EXCLUDED.market_cap_rank,
       trusted_volume_24h_usd = COALESCE(
         EXCLUDED.trusted_volume_24h_usd,
         valuation_asset_market_observations.trusted_volume_24h_usd
       ),
       exchange_count = COALESCE(
         EXCLUDED.exchange_count,
         valuation_asset_market_observations.exchange_count
       ),
       trust_score = COALESCE(
         EXCLUDED.trust_score,
         valuation_asset_market_observations.trust_score
       )`,
    [
      coin.id,
      coin.symbol.toUpperCase(),
      coin.market_cap_rank,
      stats?.trustedVolume24hUsd ?? null,
      stats?.exchangeCount ?? null,
      stats?.trustScore ?? null,
    ]
  );
}

async function refreshMarketCandidates(detailLimit: number): Promise<{
  candidatesScanned: number;
  candidateDetailsRefreshed: number;
}> {
  const markets = await fetchCoinGecko<CoinMarket[]>(
    `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${CANDIDATE_RANK_LIMIT}&page=1&sparkline=false`
  );
  await pool.query(
    `DELETE FROM public.valuation_asset_market_observations
     WHERE observed_on < CURRENT_DATE - INTERVAL '29 days'`
  );
  const topMarkets = markets
    .filter((coin) => coin.id && coin.symbol && coin.name)
    .slice(0, CANDIDATE_RANK_LIMIT);
  const [activeAssets, existingCandidates] = await Promise.all([
    pool.query<{ symbol: string; coingecko_id: string | null }>(
      `SELECT symbol, coingecko_id FROM public.valuation_assets WHERE is_active = true`
    ),
    pool.query<ExistingCandidate>(
      `SELECT symbol, coingecko_id, name, status, source, score, criteria_snapshot
       FROM public.valuation_asset_candidates`
    ),
  ]);
  const activeSymbols = new Set(activeAssets.rows.map((asset) => asset.symbol.toUpperCase()));
  const activeCoinIds = new Set(
    activeAssets.rows.map((asset) => asset.coingecko_id).filter((id): id is string => Boolean(id))
  );
  const candidateBySymbol = new Map(
    existingCandidates.rows.map((candidate) => [candidate.symbol.toUpperCase(), candidate])
  );
  const candidateByCoinId = new Map(
    existingCandidates.rows
      .filter(
        (candidate): candidate is ExistingCandidate & { coingecko_id: string } =>
          Boolean(candidate.coingecko_id)
      )
      .map((candidate) => [candidate.coingecko_id, candidate])
  );

  const uniqueMarkets = new Map<string, CoinMarket>();
  for (const coin of topMarkets) {
    const symbol = coin.symbol.toUpperCase();
    if (activeSymbols.has(symbol) || activeCoinIds.has(coin.id)) continue;
    const previous = uniqueMarkets.get(symbol);
    if (!previous || (coin.market_cap_rank ?? Infinity) < (previous.market_cap_rank ?? Infinity)) {
      uniqueMarkets.set(symbol, coin);
    }
  }
  for (const candidate of existingCandidates.rows) {
    if (
      candidate.source !== 'manual' ||
      candidate.status !== 'proposed' ||
      !candidate.coingecko_id ||
      activeSymbols.has(candidate.symbol.toUpperCase()) ||
      uniqueMarkets.has(candidate.symbol.toUpperCase())
    ) {
      continue;
    }
    uniqueMarkets.set(candidate.symbol.toUpperCase(), {
      id: candidate.coingecko_id,
      symbol: candidate.symbol,
      name: candidate.name ?? candidate.symbol,
      market_cap_rank: null,
      total_volume: null,
    });
  }
  const candidates = Array.from(uniqueMarkets.values());

  const detailCandidates = candidates
    .map((coin) => ({
      coin,
      existing: candidateBySymbol.get(coin.symbol.toUpperCase()),
    }))
    .sort((left, right) => {
      const leftPriority =
        left.existing?.source === 'manual'
          ? 0
          : (left.coin.market_cap_rank ?? Infinity) <= 50
            ? 1
            : 2;
      const rightPriority =
        right.existing?.source === 'manual'
          ? 0
          : (right.coin.market_cap_rank ?? Infinity) <= 50
            ? 1
            : 2;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const leftAt =
        dateFromSnapshot(left.existing?.criteria_snapshot ?? {}, 'tickerAttemptedAt') ||
        dateFromSnapshot(left.existing?.criteria_snapshot ?? {}, 'tickerCheckedAt');
      const rightAt =
        dateFromSnapshot(right.existing?.criteria_snapshot ?? {}, 'tickerAttemptedAt') ||
        dateFromSnapshot(right.existing?.criteria_snapshot ?? {}, 'tickerCheckedAt');
      return leftAt - rightAt || (left.coin.market_cap_rank ?? Infinity) - (right.coin.market_cap_rank ?? Infinity);
    })
    .slice(0, detailLimit);

  const tickerStatsByCoinId = new Map<string, TickerStats>();
  const ageDaysByCoinId = new Map<string, number | null>();
  const tickerAttemptedAtByCoinId = new Map<string, string>();
  const candidateScores = new Map<string, number>();
  for (const [index, { coin }] of detailCandidates.entries()) {
    tickerAttemptedAtByCoinId.set(coin.id, new Date().toISOString());
    try {
      const [tickerResult, ageResult] = await Promise.allSettled([
        getTickerStats(coin.id),
        getCoinAgeDays(coin.id),
      ]);
      let stats: TickerStats | null = null;
      if (tickerResult.status === 'fulfilled') {
        stats = tickerResult.value;
        tickerStatsByCoinId.set(coin.id, stats);
      } else {
        logger.warn('[ValuationCandidates] Ticker quality data unavailable', {
          symbol: coin.symbol.toUpperCase(),
          error:
            tickerResult.reason instanceof Error
              ? tickerResult.reason.message
              : String(tickerResult.reason),
        });
      }
      if (ageResult.status === 'fulfilled') {
        ageDaysByCoinId.set(coin.id, ageResult.value);
      } else {
        logger.warn('[ValuationCandidates] Genesis date data unavailable', {
          symbol: coin.symbol.toUpperCase(),
          error:
            ageResult.reason instanceof Error
              ? ageResult.reason.message
              : String(ageResult.reason),
        });
      }
      await recordMarketObservation(coin, stats);
    } catch (error) {
      logger.warn('[ValuationCandidates] Candidate detail refresh failed', {
        symbol: coin.symbol.toUpperCase(),
        coingeckoId: coin.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await recordMarketObservation(coin, null);
    }

    if (index < detailCandidates.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }

  for (const coin of candidates) {
    const symbol = coin.symbol.toUpperCase();
    const existing = candidateBySymbol.get(symbol);
    if (existing?.coingecko_id && existing.coingecko_id !== coin.id) {
      logger.warn('[ValuationCandidates] Skipping ambiguous ticker collision', {
        symbol,
        existingCoinGeckoId: existing.coingecko_id,
        discoveredCoinGeckoId: coin.id,
      });
      continue;
    }
    const existingByCoinId = candidateByCoinId.get(coin.id);
    if (existingByCoinId && existingByCoinId.symbol.toUpperCase() !== symbol) {
      logger.warn('[ValuationCandidates] Skipping CoinGecko id already tied to another symbol', {
        symbol,
        coingeckoId: coin.id,
        existingSymbol: existingByCoinId.symbol,
      });
      continue;
    }

    const previousSnapshot = existing?.criteria_snapshot ?? {};
    const stats = tickerStatsByCoinId.get(coin.id);
    const ageDays = ageDaysByCoinId.has(coin.id)
      ? ageDaysByCoinId.get(coin.id) ?? null
      : typeof previousSnapshot.ageDays === 'number'
        ? previousSnapshot.ageDays
        : null;
    const summary = await getMarketObservationSummary(coin.id);
    const exchangeCount =
      stats?.exchangeCount ??
      (typeof previousSnapshot.exchangeCount === 'number' ? previousSnapshot.exchangeCount : null);
    const trustScore =
      stats?.trustScore ??
      (typeof previousSnapshot.trustScore === 'number' ? previousSnapshot.trustScore : null);
    const score = scoreCandidate({
      marketCapRank: coin.market_cap_rank,
      exchangeCount,
      trustedVolume30dUsd:
        summary.observedDays >= 20 ? summary.trustedVolume30dUsd : null,
      volumeObservationDays: summary.observedDays,
      trustScore,
      ageDays,
    });
    candidateScores.set(coin.id, score);
    const evaluatedAt = new Date().toISOString();
    const ageGatePassed = ageDays !== null && ageDays >= 90;
    const criteriaSnapshot = {
      marketCapRank: coin.market_cap_rank,
      exchangeCount,
      trustedVolume24hUsd:
        stats?.trustedVolume24hUsd ??
        (typeof previousSnapshot.trustedVolume24hUsd === 'number'
          ? previousSnapshot.trustedVolume24hUsd
          : null),
      trustedVolume30dUsd: summary.trustedVolume30dUsd,
      volumeObservationDays: summary.observedDays,
      trustScore,
      ageDays,
      ageGatePassed,
      ageDataVerified: ageDays !== null,
      marketRankIncluded: coin.market_cap_rank !== null,
      tickerAttemptedAt:
        tickerAttemptedAtByCoinId.get(coin.id) ?? previousSnapshot.tickerAttemptedAt ?? null,
      tickerCheckedAt: stats ? evaluatedAt : previousSnapshot.tickerCheckedAt ?? null,
      evaluatedAt,
      source: 'CoinGecko markets and trust-filtered tickers',
    };
    const reason = [
      `CoinGecko market-cap rank ${coin.market_cap_rank ?? 'unknown'}; score ${score}/100.`,
      `${exchangeCount ?? 0} fresh exchanges meet the trust/volume filter; mean trust score ${trustScore === null ? 'unavailable' : trustScore.toFixed(1)}.`,
      `Rolling trusted 30-day volume is $${Math.round(summary.trustedVolume30dUsd)} from ${summary.observedDays} daily observations.`,
      coin.market_cap_rank === null
        ? 'Market-rank points were withheld because the asset is outside the current top-150 market feed or rank data is unavailable.'
        : '',
      ageGatePassed
        ? `Genesis date confirms asset age of ${ageDays} days.`
        : ageDays === null
          ? 'Asset age could not be verified; score capped below the high-priority queue.'
          : `Asset is only ${ageDays} days old; score capped below the high-priority queue.`,
      summary.observedDays < 20
        ? `Only ${summary.observedDays} trusted-volume observations are available; 30-day volume scoring is withheld until 20 daily observations exist.`
        : `${summary.observedDays} trusted-volume observations cover the rolling 30-day window.`,
    ].join(' ');

    await pool.query(
      `INSERT INTO public.valuation_asset_candidates
         (symbol, coingecko_id, name, score, criteria_snapshot, status, source, reason, proposed_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'proposed', 'pipeline', $6, 'system:coingecko-candidate-pipeline')
       ON CONFLICT (symbol) DO UPDATE SET
         coingecko_id = COALESCE(valuation_asset_candidates.coingecko_id, EXCLUDED.coingecko_id),
         name = EXCLUDED.name,
         score = EXCLUDED.score,
         criteria_snapshot = EXCLUDED.criteria_snapshot,
         reason = CASE
           WHEN valuation_asset_candidates.source = 'manual' THEN
             valuation_asset_candidates.reason
           ELSE EXCLUDED.reason
         END,
         last_seen_at = NOW(),
         updated_at = NOW()
       WHERE valuation_asset_candidates.coingecko_id = EXCLUDED.coingecko_id
          OR valuation_asset_candidates.coingecko_id IS NULL`,
      [symbol, coin.id, coin.name, score, JSON.stringify(criteriaSnapshot), reason]
    );
  }

  logger.info('[ValuationCandidates] Market candidate refresh complete', {
    scanned: candidates.length,
    detailRefreshes: detailCandidates.length,
    surfacedAtOrAboveThreshold: candidates.filter((coin) => {
      return (candidateScores.get(coin.id) ?? 0) >= HIGH_PRIORITY_SCORE;
    }).length,
  });
  return {
    candidatesScanned: candidates.length,
    candidateDetailsRefreshed: detailCandidates.length,
  };
}

async function revalidateAsset(client: PoolClient, symbol: string): Promise<boolean> {
  let hasQuorum = false;
  try {
    hasQuorum = (await priceOracle.getValuationPrice(symbol)) !== null;
  } catch (error) {
    logger.warn('[ValuationCandidates] Valuation re-validation request failed', {
      symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }

  if (hasQuorum) {
    await client.query(
      `UPDATE public.valuation_assets
       SET last_quorum_at = NOW(),
           last_valuation_check_at = NOW(),
           quorum_failure_since = NULL,
           review_reason = CASE
             WHEN review_required THEN 'Valuation quorum recovered; administrator review is still pending.'
             ELSE review_reason
           END
       WHERE symbol = $1 AND is_active = true`,
      [symbol]
    );
    return false;
  }

  const { rows } = await client.query<{ review_required: boolean }>(
    `UPDATE public.valuation_assets
     SET last_valuation_check_at = NOW(),
         quorum_failure_since = COALESCE(quorum_failure_since, NOW()),
         review_required = review_required OR (
           COALESCE(quorum_failure_since, NOW()) <= NOW() - ($2 * INTERVAL '1 day')
         ),
         review_reason = CASE
           WHEN review_required THEN review_reason
           WHEN COALESCE(quorum_failure_since, NOW()) <= NOW() - ($2 * INTERVAL '1 day')
             THEN 'No valuation quorum for at least ' || $2::text || ' days; manual review required. Asset remains active.'
           ELSE review_reason
         END,
         review_flagged_at = CASE
           WHEN NOT review_required
             AND COALESCE(quorum_failure_since, NOW()) <= NOW() - ($2 * INTERVAL '1 day')
             THEN NOW()
           ELSE review_flagged_at
         END
     WHERE symbol = $1 AND is_active = true
     RETURNING review_required`,
    [symbol, QUORUM_REVIEW_DAYS]
  );
  return rows[0]?.review_required ?? false;
}

async function revalidateAllowlist(client: PoolClient): Promise<{
  assetsRevalidated: number;
  assetsFlaggedForReview: number;
}> {
  const { rows } = await client.query<{ symbol: string }>(
    `SELECT symbol
     FROM public.valuation_assets
     WHERE is_active = true
       AND (
         last_valuation_check_at IS NULL
         OR last_valuation_check_at < NOW() - INTERVAL '20 hours'
       )
     ORDER BY symbol`
  );
  let nextIndex = 0;
  let assetsFlaggedForReview = 0;
  const workerCount = Math.min(3, rows.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < rows.length) {
        const index = nextIndex++;
        const flagged = await revalidateAsset(client, rows[index].symbol);
        if (flagged) assetsFlaggedForReview++;
      }
    })
  );
  return {
    assetsRevalidated: rows.length,
    assetsFlaggedForReview,
  };
}

let scheduledTask: ScheduledTask | undefined;
let running = false;

export async function runValuationCandidatePipeline(): Promise<CandidatePipelineResult> {
  if (running) {
    return {
      skipped: true,
      candidatesScanned: 0,
      candidateDetailsRefreshed: 0,
      assetsRevalidated: 0,
      assetsFlaggedForReview: 0,
    };
  }

  running = true;
  let client: PoolClient | undefined;
  let hasLock = false;
  try {
    client = await pool.connect();
    const lockResult = await client.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock(hashtext('valuation-candidate-pipeline')) AS locked`
    );
    hasLock = lockResult.rows[0]?.locked === true;
    if (!hasLock) {
      logger.info('[ValuationCandidates] Skipping run; another instance holds the job lock');
      return {
        skipped: true,
        candidatesScanned: 0,
        candidateDetailsRefreshed: 0,
        assetsRevalidated: 0,
        assetsFlaggedForReview: 0,
      };
    }

    const detailLimit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(
          process.env.VALUATION_CANDIDATE_DETAIL_LIMIT ?? String(DEFAULT_DETAIL_LIMIT),
          10
        ) || DEFAULT_DETAIL_LIMIT
      )
    );
    let candidateResult = { candidatesScanned: 0, candidateDetailsRefreshed: 0 };
    try {
      candidateResult = await refreshMarketCandidates(detailLimit);
    } catch (error) {
      logger.error('[ValuationCandidates] Candidate discovery failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    let healthResult = { assetsRevalidated: 0, assetsFlaggedForReview: 0 };
    try {
      healthResult = await revalidateAllowlist(client);
    } catch (error) {
      logger.error('[ValuationCandidates] Allowlist re-validation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const result = { skipped: false, ...candidateResult, ...healthResult };
    logger.info('[ValuationCandidates] Daily pipeline finished', result);
    return result;
  } finally {
    try {
      if (hasLock && client) {
        await client.query(
          `SELECT pg_advisory_unlock(hashtext('valuation-candidate-pipeline'))`
        );
      }
    } finally {
      client?.release();
      running = false;
    }
  }
}

export function startValuationCandidatePipeline(): void {
  if (scheduledTask) {
    logger.warn('[ValuationCandidates] Scheduler is already running');
    return;
  }
  scheduledTask = cron.schedule(
    '15 0 * * *',
    () => {
      void runValuationCandidatePipeline().catch((error) => {
        logger.error('[ValuationCandidates] Scheduled pipeline execution failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    { timezone: 'UTC' }
  );
  logger.info('[ValuationCandidates] Daily pipeline scheduled for 00:15 UTC', {
    quorumReviewDays: QUORUM_REVIEW_DAYS,
    detailLimit: process.env.VALUATION_CANDIDATE_DETAIL_LIMIT ?? DEFAULT_DETAIL_LIMIT,
  });
}

export function stopValuationCandidatePipeline(): void {
  scheduledTask?.stop();
  scheduledTask = undefined;
  logger.info('[ValuationCandidates] Daily pipeline stopped');
}
