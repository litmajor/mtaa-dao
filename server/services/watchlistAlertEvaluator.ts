/**
 * Watchlist Alert Evaluator
 *
 * Polls active watchlist alerts on an interval, compares the configured
 * threshold against a live value, and fires a one-shot notification when
 * crossed (alert_active is set to false after firing -- the user re-arms
 * manually, per the confirmed v1 decision).
 *
 * REVISED ASSUMPTION (changed from an earlier version of this file): the
 * `symbols.ticker` column is now assumed to store FULL PAIR NOTATION
 * ('BTC/USDT', 'CELO/cUSD'), not a bare base ticker ('BTC'). This follows
 * from the confirmed requirement that watchlist symbols double as chart
 * pair selectors, and that the dashboard's DEX/CEX auto-routing
 * (isCeloPair-style detection) keys off the full pair string. VERIFY this
 * against the real `symbols` table -- if pair notation lives elsewhere
 * (e.g. separate base_symbol/quote_symbol columns), the fix is confined to
 * the SQL query in evaluateSymbolAlerts() below and the equivalent
 * TARGET_JOINS.symbol.nameExpr in the router.
 *
 * VENUE ROUTING: CEX pairs go through ccxtService (same pattern
 * marketStreamService uses). DEX pairs (Celo-native: cUSD, cEUR, cKES,
 * cREAL, eXOF, per this codebase's own dashboard header) do NOT exist on
 * ccxtService's exchanges and need a different price source.
 *
 * DEX price lookups now use marketDataClient fallback logic plus a candle
 * fallback path. If the symbol is a Celo-native pair without a stable quote,
 * the evaluator will attempt DEX candles from marketDataClient.getCandles().
 *
 * NOT IMPLEMENTED (unchanged from before): apy/tvl resolution for
 * pool/vault/investment_pool alerts -- no live source identified yet.
 */

import { pool } from '../db';
import { logger } from '../utils/logger';
import { notificationService } from '../notificationService';
import ccxtService from './ccxtService';
import { marketDataClient } from './marketDataClient';

const POLL_INTERVAL_MS = Number(process.env.WATCHLIST_EVALUATOR_INTERVAL_MS) || 30_000;
const PRICE_LOOKUP_EXCHANGES = ['binance', 'kraken', 'coinbase']; // ASSUMPTION: matches ccxtService's configured exchange ids
const DEFAULT_CEX_CHAIN_ID = 1;
const DEFAULT_DEX_CHAIN_ID = 42220;
const DEFAULT_PRICE_SOURCE = 'aggregated';

// Same detection convention already used in the dashboard (isCeloPair).
// Kept here as a single function so both places can eventually import one
// shared util instead of duplicating the string check.
function isDexPair(pairSymbol: string): boolean {
  const upper = pairSymbol.toUpperCase();
  return upper.includes('CUSD') || upper.includes('CEUR') || upper.includes('CKES') || upper.includes('CREAL') || upper.includes('EXOF');
}

function normalizePairSymbol(pairSymbol: string): string {
  const candidate = pairSymbol.trim().toUpperCase();
  if (candidate.includes('/')) return candidate;

  const stableQuotes = ['USDT', 'USDC', 'USD', 'BUSD', 'DAI', 'CUSD', 'CEUR', 'CKES', 'CREAL', 'EXOF', 'ETH', 'BTC'];
  for (const quote of stableQuotes) {
    if (candidate.endsWith(quote) && candidate.length > quote.length) {
      return `${candidate.slice(0, candidate.length - quote.length)}/${quote}`;
    }
  }

  return candidate;
}

function parsePair(pairSymbol: string): { base: string; quote?: string } {
  const normalized = normalizePairSymbol(pairSymbol);
  if (!normalized.includes('/')) {
    return { base: normalized };
  }

  const [base, quote] = normalized.split('/').map((part) => part.trim().toUpperCase());
  return { base, quote };
}

interface ActiveAlertRow {
  id: string;
  watchlist_id: string;
  item_type: string;
  symbol_id: string | null;
  vault_id: string | null;
  pool_id: string | null;
  investment_pool_id: string | null;
  alert_metric: string;
  alert_direction: 'above' | 'below';
  alert_threshold: string; // numeric comes back as string from pg
  user_id: string;
  watchlist_name: string;
  pair_symbol: string | null; // symbols.ticker, assumed full pair notation -- see header
}

class WatchlistAlertEvaluator {
  private intervalHandle: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(() => this.tick(), POLL_INTERVAL_MS);
    logger.info(`[WatchlistEvaluator] Started, polling every ${POLL_INTERVAL_MS}ms`);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      logger.warn('[WatchlistEvaluator] Previous tick still running, skipping this cycle');
      return;
    }
    this.running = true;
    try {
      await this.evaluateSymbolAlerts();
      await this.evaluateApyTvlAlerts();
    } catch (error) {
      logger.error('[WatchlistEvaluator] Tick failed', { error });
    } finally {
      this.running = false;
    }
  }

  private async evaluateSymbolAlerts(): Promise<void> {
    const { rows } = await pool.query<ActiveAlertRow>(
      `SELECT i.id, i.watchlist_id, i.item_type, i.symbol_id, i.alert_metric,
              i.alert_direction, i.alert_threshold,
              w.user_id, w.name AS watchlist_name,
              s.ticker AS pair_symbol
       FROM yuki_watchlist_items i
       JOIN yuki_watchlists w ON w.id = i.watchlist_id
       JOIN symbols s ON s.id = i.symbol_id
       WHERE i.alert_active = true AND i.item_type = 'symbol'`
    );

    if (rows.length === 0) return;

    const normalizedRows = rows.map((row) => ({
      ...row,
      pair_symbol: row.pair_symbol ? normalizePairSymbol(row.pair_symbol) : row.pair_symbol,
    }));

    const cexRows = normalizedRows.filter((r) => r.pair_symbol && !isDexPair(r.pair_symbol));
    const dexRows = normalizedRows.filter((r) => r.pair_symbol && isDexPair(r.pair_symbol));

    if (dexRows.length > 0) {
      logger.info(
        `[WatchlistEvaluator] ${dexRows.length} active alert(s) on DEX-routed pairs (${[...new Set(dexRows.map(r => r.pair_symbol))].join(', ')}) ` +
        `will be evaluated via marketDataClient candle lookup or DEX fallback logic.`
      );
    }

    // Fetch each distinct CEX pair's price once, not once per watchlist row.
    const distinctPairs = [...new Set(cexRows.map((r) => r.pair_symbol).filter(Boolean))] as string[];
    const priceByPair = new Map<string, number>();

    for (const pairSymbol of distinctPairs) {
      const price = await this.getCurrentCexPrice(pairSymbol);
      if (price !== null) priceByPair.set(pairSymbol, price);
    }

    for (const row of cexRows) {
      if (!row.pair_symbol) continue;
      const currentPrice = priceByPair.get(row.pair_symbol);
      if (currentPrice === undefined) continue; // no live price this cycle -- skip, don't fire on stale/missing data

      const threshold = Number(row.alert_threshold);
      const crossed =
        (row.alert_direction === 'above' && currentPrice >= threshold) ||
        (row.alert_direction === 'below' && currentPrice <= threshold);

      if (crossed) {
        await this.fireAlert(row, currentPrice, row.pair_symbol);
      }
    }

    for (const row of dexRows) {
      if (!row.pair_symbol) continue;
      const currentPrice = await this.getCurrentDexPrice(row.pair_symbol);
      if (currentPrice === null) continue;

      const threshold = Number(row.alert_threshold);
      const crossed =
        (row.alert_direction === 'above' && currentPrice >= threshold) ||
        (row.alert_direction === 'below' && currentPrice <= threshold);

      if (crossed) {
        await this.fireAlert(row, currentPrice, row.pair_symbol);
      }
    }
  }

  private async evaluateApyTvlAlerts(): Promise<void> {
    const { rows } = await pool.query<ActiveAlertRow>(
      `SELECT id, watchlist_id, item_type, vault_id, pool_id, investment_pool_id,
              alert_metric, alert_direction, alert_threshold
       FROM yuki_watchlist_items
       WHERE alert_active = true AND item_type IN ('vault', 'pool', 'investment_pool')`
    );

    if (rows.length === 0) return;

    logger.warn(
      `[WatchlistEvaluator] ${rows.length} active apy/tvl alert(s) found but no live data source is wired yet.`
    );
  }

  /**
   * ASSUMPTION: see file header re: ccxtService.getPricesFromMultipleExchanges
   * shape. Now called with a full pair ('BTC/USDT') rather than a bare
   * ticker -- more consistent with ccxt's own symbol convention anyway.
   */
  private async getCurrentCexPrice(pairSymbol: string): Promise<number | null> {
    const normalized = normalizePairSymbol(pairSymbol);
    const { base, quote } = parsePair(normalized);
    const sourceLabel = DEFAULT_PRICE_SOURCE;
    const usdLikeQuotes = new Set(['USDT', 'USDC', 'USD', 'BUSD', 'DAI']);

    if (quote && usdLikeQuotes.has(quote)) {
      try {
        const priceData = await marketDataClient.getPrice(base, DEFAULT_CEX_CHAIN_ID, sourceLabel);
        if (priceData && typeof (priceData as any).price === 'number') {
          logger.debug('[WatchlistEvaluator] marketDataClient price hit for USD-quoted CEX pair', {
            pair: normalized,
            source: sourceLabel,
            provider: 'marketDataClient',
          });
          return (priceData as any).price;
        }

        logger.warn('[WatchlistEvaluator] marketDataClient returned no price for USD-quoted CEX pair, falling back to ccxtService', {
          pair: normalized,
          source: sourceLabel,
        });
      } catch (error) {
        logger.warn('[WatchlistEvaluator] marketDataClient price fetch failed for USD-quoted CEX pair, falling back to ccxtService', {
          pair: normalized,
          error,
        });
      }
    }

    try {
      const prices = await ccxtService.getPricesFromMultipleExchanges(normalized, PRICE_LOOKUP_EXCHANGES);
      for (const exchangeId of PRICE_LOOKUP_EXCHANGES) {
        const data = prices[exchangeId];
        if (data && typeof data.last === 'number') {
          logger.debug('[WatchlistEvaluator] ccxtService fallback price hit', {
            pair: normalized,
            exchange: exchangeId,
            last: data.last,
          });
          return data.last;
        }
      }
    } catch (error) {
      logger.error(`[WatchlistEvaluator] Failed to fetch CEX price for ${normalized} via ccxtService`, { error });
    }

    return null;
  }

  private async getCurrentDexPrice(pairSymbol: string): Promise<number | null> {
    const normalized = normalizePairSymbol(pairSymbol);
    const { base, quote } = parsePair(normalized);
    const usdLikeQuotes = new Set(['USDT', 'USDC', 'USD', 'BUSD', 'DAI', 'CUSD', 'CEUR', 'CKES', 'CREAL', 'EXOF']);

    if (quote && usdLikeQuotes.has(quote)) {
      try {
        const priceData = await marketDataClient.getPrice(base, DEFAULT_DEX_CHAIN_ID, DEFAULT_PRICE_SOURCE);
        if (priceData && typeof (priceData as any).price === 'number') {
          logger.debug('[WatchlistEvaluator] marketDataClient DEX USD-fallback price hit', {
            pair: normalized,
            provider: DEFAULT_PRICE_SOURCE,
          });
          return (priceData as any).price;
        }
      } catch (error) {
        logger.warn('[WatchlistEvaluator] marketDataClient DEX USD-fallback failed', {
          pair: normalized,
          error,
        });
      }
    }

    try {
      const candles = await marketDataClient.getCandles(normalized, '1m', 1, 'dex');
      if (candles && candles.status === 'success' && candles.data.length > 0) {
        const latest = candles.data[candles.data.length - 1];
        logger.debug('[WatchlistEvaluator] DEX candle fallback price hit', {
          pair: normalized,
          price: latest.close,
          source: 'marketDataClient.getCandles',
        });
        return latest.close;
      }
    } catch (error) {
      logger.warn('[WatchlistEvaluator] DEX candle fallback failed', {
        pair: normalized,
        error,
      });
    }

    logger.warn('[WatchlistEvaluator] No DEX price available for pair', { pair: normalized });
    return null;
  }

  // Stubs -- apy/tvl, unchanged from before.
  private async getCurrentApy(_entityType: string, _entityId: string): Promise<number | null> {
    return null;
  }
  private async getCurrentTvl(_entityType: string, _entityId: string): Promise<number | null> {
    return null;
  }

  private async fireAlert(row: ActiveAlertRow, currentValue: number, targetLabel: string): Promise<void> {
    try {
      await notificationService.send({
        userId: row.user_id,
        type: 'watchlist_alert',
        title: `${targetLabel} ${row.alert_direction === 'above' ? 'crossed above' : 'dropped below'} your threshold`,
        message: `${targetLabel} is now ${currentValue} (${row.alert_metric}), your alert was set to ${row.alert_direction} ${row.alert_threshold}.`,
        priority: 'medium',
        metadata: {
          watchlistId: row.watchlist_id,
          watchlistItemId: row.id,
          watchlistName: row.watchlist_name,
          metric: row.alert_metric,
          currentValue,
          threshold: Number(row.alert_threshold),
        },
      });

      await pool.query(
        `UPDATE yuki_watchlist_items SET alert_active = false, alert_last_fired_at = now() WHERE id = $1`,
        [row.id]
      );

      logger.info(`[WatchlistEvaluator] Fired alert ${row.id} for ${targetLabel} at ${currentValue}`);
    } catch (error) {
      logger.error(`[WatchlistEvaluator] Failed to fire alert ${row.id}`, { error });
    }
  }
}

export const watchlistAlertEvaluator = new WatchlistAlertEvaluator();
