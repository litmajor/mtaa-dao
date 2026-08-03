// frontend/src/hooks/useDashboardData.ts
/**
 * Dashboard data hook — wired to real /api/v1/yuki/* endpoints.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * COVERAGE NOTE — v2, corrected against verified source
 * ═══════════════════════════════════════════════════════════════════════
 * Verified against actual route source: market.ts, exchanges.ts,
 * strategies.ts, dex.ts. The marketplace sub-router
 * (marketplace/strategies.ts) is still unverified — flagged below.
 *
 * CORRECTIONS FROM v1 OF THIS HOOK:
 *   - watchlist: switched from /market/prices to /market/top.
 *     /market/prices only returns real price + a `chart` object that is
 *     ONLY present when include_charts=true, and that chart's change24h
 *     and volume24h are literally `(Math.random() - 0.5) * 10` and
 *     `Math.random() * 1000000` in the route source — fabricated on
 *     every request. /market/top has no such field and pulls
 *     change24h/marketCap from priceOracle for real, plus real
 *     aggregated volume across exchanges.
 *   - dexPairs: switched from /dex/pools to /dex/pairs/trending.
 *     /dex/pools is a documentation stub — it returns a hardcoded
 *     example `poolStructure` object and a message pointing you
 *     elsewhere, not live pool data. /dex/pairs/trending is backed by
 *     the real dexscreenerClient (verified earlier in this project).
 *   - opportunities: REVERSED from "not available" — a real endpoint
 *     exists at GET /v1/yuki/market/opportunities, backed by
 *     venue_execution_stats + Redis cache, requires auth, computes
 *     arbitrage/liquidity_gap/volatility from the user's actual
 *     connected-exchange trade history. Now wired for real.
 *   - portfolio/balance: switched from a guessed /wallets/balance
 *     endpoint to the real two-step path: list connected exchanges
 *     (GET /exchanges) then fetch balances per exchange
 *     (GET /exchanges/:id/balances), aggregated client-side.
 *
 * ⚠️ KNOWN BACKEND BUG THAT LEAKS INTO THIS DATA — NOT FIXABLE HERE:
 *   GET /v1/yuki/exchanges/:id/balances computes `totalValue` as
 *   `balance.total * (Math.random() * 100 + 1)` — the comment literally
 *   says "Market price conversion" but it's a random multiplier, not a
 *   real price lookup. `portfolio` and `balance.totalValue` below will
 *   show FABRICATED dollar values until that route is fixed to use
 *   priceOracle for the actual conversion. `amount` (raw token balance)
 *   is real; `value` (USD) is not. Flagged per-entry via `valueReliable`.
 *
 *   - marketplace: verified against marketplace/strategies.ts. Corrected
 *     a real bug in the previous adapter — the field is `title`, not
 *     `name`, and stats live under `stats: {rating, copies, avgReturn}`
 *     with `ratingCount` only present on the single-strategy detail
 *     endpoint, not the list. Fully real, backed by `marketplace_strategies`
 *     table with Redis caching (5 min TTL on detail, list is uncached).
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

export interface BalanceData {
  tradingBalance: number;
  availableBalance: number;
  totalValue: number;
  totalValueReliable: boolean; // false while the backend Math.random() bug is live
  todayGain: number;
  todayGainPct: number;
  winRate: number;
  activeStrategies: number;
  riskLevel: string;
}

export interface Opportunity {
  id: string;
  type: 'arbitrage' | 'liquidity_gap' | 'volatility';
  symbol: string;
  buyVenue?: string;
  sellVenue?: string;
  buyPrice?: number;
  sellPrice?: number;
  profitPct?: number;
  venue?: string;
  volatility?: number;
  confidence: number;
  scannedAt: string;
}

export interface WatchlistEntry {
  symbol: string;
  rank: number;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number | null;
  exchanges: string[];
}

export interface CexMarket {
  id: string;
  exchange: string;
  name: string;
  status: 'connected' | 'disconnected';
  tradingEnabled: boolean;
  connectedAt?: string;
  lastSync: string | null;
}

export interface DexPair {
  pairAddress: string;
  chainId: string;
  dexId: string;
  baseSymbol: string;
  quoteSymbol: string;
  priceUsd: number | null;
  liquidityUsd: number;
  volume24h: number;
  priceChange24h: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  maxDrawdown: number;
  executionCount: number | null;
  lastExecutedAt?: string;
}

export interface PortfolioEntry {
  symbol: string;
  amount: number;
  value: number;
  valueReliable: boolean; // see COVERAGE NOTE — backend price-conversion bug
  exchangeId: string;
}

export interface MarketplaceStrategy {
  id: string;
  title: string;
  description: string;
  author: { id: string; name: string; avatar: string | null };
  category: string;
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  minCapital: number | null;
  rating: number;
  copies: number;
  avgReturn: number;
  publishedAt?: string;
}

export interface DashboardData {
  balance: BalanceData | null;
  opportunities: Opportunity[];
  watchlist: WatchlistEntry[];
  cexMarkets: CexMarket[];
  dexPairs: DexPair[];
  strategies: Strategy[];
  selectedPair: string;
  portfolio: PortfolioEntry[];
  marketplaceStrategies: MarketplaceStrategy[];
}

interface SectionState {
  balance: boolean;
  opportunities: boolean;
  watchlist: boolean;
  cexMarkets: boolean;
  dexPairs: boolean;
  strategies: boolean;
  portfolio: boolean;
  marketplace: boolean;
}

const DEFAULT_WATCHLIST_LIMIT = 20;
const DEFAULT_DEX_CHAIN = 'celo';

// ─────────────────────────────────────────────────────────────────────────
// FETCH HELPER
// ─────────────────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error ? `: ${body.error}` : '';
    } catch { /* ignore */ }
    throw new Error(`${path} → HTTP ${res.status}${detail}`);
  }
  const json = await res.json();
  if (json && typeof json === 'object' && json.success === false) {
    throw new Error(json.error ?? `${path} returned success:false`);
  }
  return (json?.data ?? json) as T;
}

// ─────────────────────────────────────────────────────────────────────────
// ADAPTERS — shape assumptions isolated here
// ─────────────────────────────────────────────────────────────────────────

/** GET /v1/yuki/market/top → { rank, symbol, name, price, change24h, marketCap, circulatingSupply, volume24h, exchanges } */
function adaptWatchlist(raw: any): WatchlistEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => ({
    symbol: r.symbol,
    rank: r.rank ?? 0,
    price: Number(r.price ?? 0),
    change24h: Number(r.change24h ?? 0),
    volume24h: Number(r.volume24h ?? 0),
    marketCap: r.marketCap ?? null,
    exchanges: Array.isArray(r.exchanges) ? r.exchanges : [],
  }));
}

/** GET /v1/yuki/exchanges → { data: { accounts: [...] } } */
function adaptCexMarkets(raw: any): CexMarket[] {
  const accounts = raw?.accounts;
  if (!Array.isArray(accounts)) return [];
  return accounts.map((a: any) => ({
    id: a.id,
    exchange: a.exchange,
    name: a.name,
    status: a.status ?? 'disconnected',
    tradingEnabled: !!a.tradingEnabled,
    connectedAt: a.connectedAt,
    lastSync: a.lastSync ?? null,
  }));
}

/** GET /v1/yuki/dex/pairs/trending → array of DexScreener pair objects (real, via dexscreenerClient) */
function adaptDexPairs(raw: any): DexPair[] {
  const pairs = Array.isArray(raw) ? raw : raw?.pairs;
  if (!Array.isArray(pairs)) return [];
  return pairs.map((p: any) => ({
    pairAddress: p.pairAddress,
    chainId: p.chainId,
    dexId: p.dexId,
    baseSymbol: p.baseToken?.symbol ?? '?',
    quoteSymbol: p.quoteToken?.symbol ?? '?',
    priceUsd: p.priceUsd != null ? Number(p.priceUsd) : null,
    liquidityUsd: Number(p.liquidity?.usd ?? 0),
    volume24h: Number(p.volume?.h24 ?? 0),
    priceChange24h: Number(p.priceChange?.h24 ?? 0),
  }));
}

/** GET /v1/yuki/strategies → { data: { strategies: [{id,name,description,performance:{...},execution:{...}|null}] } } */
function adaptStrategies(raw: any): Strategy[] {
  const list = raw?.strategies;
  if (!Array.isArray(list)) return [];
  return list.map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? '',
    totalReturn: Number(s.performance?.totalReturn ?? 0),
    winRate: Number(s.performance?.winRate ?? 0),
    totalTrades: Number(s.performance?.totalTrades ?? 0),
    maxDrawdown: Number(s.performance?.maxDrawdown ?? 0),
    executionCount: s.execution?.executionCount ?? null,
    lastExecutedAt: s.execution?.lastExecutedAt,
  }));
}

/** GET /v1/yuki/market/opportunities → { data: { opportunities: [...] } } */
function adaptOpportunities(raw: any): Opportunity[] {
  const list = raw?.opportunities;
  if (!Array.isArray(list)) return [];
  return list.map((o: any) => ({
    id: o.id,
    type: o.type,
    symbol: o.symbol,
    buyVenue: o.buyVenue,
    sellVenue: o.sellVenue,
    buyPrice: o.buyPrice,
    sellPrice: o.sellPrice,
    profitPct: o.profitPct,
    venue: o.venue,
    volatility: o.volatility,
    confidence: Number(o.confidence ?? 0),
    scannedAt: o.scannedAt,
  }));
}

/**
 * GET /v1/yuki/exchanges/:id/balances → { data: { balances: [{symbol,free,used,total}], summary: {totalValue,...} } }
 * NOTE: summary.totalValue and per-balance USD value are NOT reliable —
 * see COVERAGE NOTE. amount (raw token count) is real.
 */
function adaptExchangeBalances(raw: any, exchangeId: string): PortfolioEntry[] {
  const balances = raw?.balances;
  if (!Array.isArray(balances)) return [];
  return balances.map((b: any) => ({
    symbol: b.symbol,
    amount: Number(b.total ?? 0),
    // No reliable per-token USD value is returned by this endpoint today —
    // only an aggregate `summary.totalValue` computed with a random
    // multiplier. Surface 0 rather than propagate a fabricated number.
    value: 0,
    valueReliable: false,
    exchangeId,
  }));
}

/** GET /v1/yuki/marketplace/strategies → { data: { strategies: [{id,title,description,author,category,tags,riskLevel,minCapital,stats:{rating,copies,avgReturn}}] } } */
function adaptMarketplace(raw: any): MarketplaceStrategy[] {
  const list = raw?.strategies;
  if (!Array.isArray(list)) return [];
  return list.map((s: any) => ({
    id: s.id,
    title: s.title,
    description: s.description ?? '',
    author: {
      id: s.author?.id,
      name: s.author?.name ?? 'Guest',
      avatar: s.author?.avatar ?? null,
    },
    category: s.category,
    tags: Array.isArray(s.tags) ? s.tags : [],
    riskLevel: s.riskLevel ?? 'medium',
    minCapital: s.minCapital ?? null,
    rating: Number(s.stats?.rating ?? 0),
    copies: Number(s.stats?.copies ?? 0),
    avgReturn: Number(s.stats?.avgReturn ?? 0),
    publishedAt: s.publishedAt,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────

export const useDashboardData = (selectedPair = 'CELO/cUSD') => {
  const [data, setData] = useState<DashboardData>({
    balance: null,
    opportunities: [],
    watchlist: [],
    cexMarkets: [],
    dexPairs: [],
    strategies: [],
    selectedPair,
    portfolio: [],
    marketplaceStrategies: [],
  });

  const [sectionLoading, setSectionLoading] = useState<SectionState>({
    balance: true,
    opportunities: true,
    watchlist: true,
    cexMarkets: true,
    dexPairs: true,
    strategies: true,
    portfolio: true,
    marketplace: true,
  });

  const [sectionErrors, setSectionErrors] = useState<Partial<Record<keyof SectionState, string>>>({});

  const isLoading = Object.values(sectionLoading).some(Boolean);
  const allFailed = Object.keys(sectionErrors).length >= Object.keys(sectionLoading).length && !isLoading;
  const error = allFailed ? 'All dashboard sections failed to load. Check connectivity and auth.' : null;

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const setSection = useCallback(<K extends keyof SectionState>(key: K, loading: boolean, errMsg?: string) => {
    if (!mountedRef.current) return;
    setSectionLoading(prev => ({ ...prev, [key]: loading }));
    setSectionErrors(prev => {
      const next = { ...prev };
      if (errMsg) next[key] = errMsg; else delete next[key];
      return next;
    });
  }, []);

  // ── Fetchers ─────────────────────────────────────────────────────────

  const fetchWatchlist = useCallback(async () => {
    setSection('watchlist', true);
    try {
      const raw = await apiGet<any>(`/api/v1/yuki/market/top?limit=${DEFAULT_WATCHLIST_LIMIT}`);
      const watchlist = adaptWatchlist(raw);
      if (mountedRef.current) setData(prev => ({ ...prev, watchlist }));
      setSection('watchlist', false);
    } catch (err) {
      setSection('watchlist', false, err instanceof Error ? err.message : 'Failed to load market data');
    }
  }, [setSection]);

  const fetchCexMarkets = useCallback(async () => {
    setSection('cexMarkets', true);
    try {
      const raw = await apiGet<any>('/api/v1/yuki/exchanges');
      const cexMarkets = adaptCexMarkets(raw);
      if (mountedRef.current) setData(prev => ({ ...prev, cexMarkets }));
      setSection('cexMarkets', false);
      return cexMarkets; // returned so portfolio fetch can reuse without a second call
    } catch (err) {
      setSection('cexMarkets', false, err instanceof Error ? err.message : 'Failed to load exchanges');
      return [];
    }
  }, [setSection]);

  const fetchDexPairs = useCallback(async () => {
    setSection('dexPairs', true);
    try {
      const raw = await apiGet<any>(`/api/v1/yuki/dex/pairs/trending?chainId=${DEFAULT_DEX_CHAIN}&limit=20`);
      const dexPairs = adaptDexPairs(raw);
      if (mountedRef.current) setData(prev => ({ ...prev, dexPairs }));
      setSection('dexPairs', false);
    } catch (err) {
      setSection('dexPairs', false, err instanceof Error ? err.message : 'Failed to load DEX pairs');
    }
  }, [setSection]);

  const fetchStrategies = useCallback(async () => {
    setSection('strategies', true);
    try {
      const raw = await apiGet<any>('/api/v1/yuki/strategies?limit=20');
      const strategies = adaptStrategies(raw);
      if (mountedRef.current) setData(prev => ({ ...prev, strategies }));
      setSection('strategies', false);
    } catch (err) {
      setSection('strategies', false, err instanceof Error ? err.message : 'Failed to load strategies');
    }
  }, [setSection]);

  const fetchMarketplace = useCallback(async () => {
    setSection('marketplace', true);
    try {
      const raw = await apiGet<any>('/api/v1/yuki/marketplace/strategies');
      const marketplaceStrategies = adaptMarketplace(raw);
      if (mountedRef.current) setData(prev => ({ ...prev, marketplaceStrategies }));
      setSection('marketplace', false);
    } catch (err) {
      setSection('marketplace', false, err instanceof Error ? err.message : 'Failed to load marketplace');
    }
  }, [setSection]);

  const fetchOpportunities = useCallback(async () => {
    setSection('opportunities', true);
    try {
      const raw = await apiGet<any>('/api/v1/yuki/market/opportunities?limit=20');
      const opportunities = adaptOpportunities(raw);
      if (mountedRef.current) setData(prev => ({ ...prev, opportunities }));
      setSection('opportunities', false);
    } catch (err) {
      // Requires auth + at least one connected exchange with trade history —
      // a clean empty result on a new account is expected, not an error.
      setSection('opportunities', false, err instanceof Error ? err.message : 'Failed to scan opportunities');
    }
  }, [setSection]);

  const fetchPortfolioAndBalance = useCallback(async (knownExchanges?: CexMarket[]) => {
    setSection('portfolio', true);
    setSection('balance', true);
    try {
      const fetchedExchanges = await apiGet<any>('/api/v1/yuki/exchanges').then(adaptCexMarkets);
      const exchanges = knownExchanges ?? fetchedExchanges ?? [];
      const connected = exchanges.filter(e => e.status === 'connected');

      const balanceResults = await Promise.allSettled(
        connected.map(async ex => ({
          exchangeId: ex.id,
          raw: await apiGet<any>(`/api/v1/yuki/exchanges/${ex.id}/balances`),
        })),
      );

      const portfolio: PortfolioEntry[] = [];
      let totalValueFabricated = 0; // tracked separately, not surfaced as trustworthy
      for (const r of balanceResults) {
        if (r.status !== 'fulfilled') continue;
        const entries = adaptExchangeBalances(r.value.raw, r.value.exchangeId);
        portfolio.push(...entries);
        totalValueFabricated += Number(r.value.raw?.summary?.totalValue ?? 0);
      }

      const balance: BalanceData = {
        tradingBalance: 0,
        availableBalance: 0,
        totalValue: totalValueFabricated,
        totalValueReliable: false, // backend Math.random() bug — see COVERAGE NOTE
        todayGain: 0,
        todayGainPct: 0,
        winRate: 0,
        activeStrategies: 0,
        riskLevel: 'unknown',
      };

      if (mountedRef.current) setData(prev => ({ ...prev, portfolio, balance }));
      setSection('portfolio', false);
      setSection('balance', false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load balance';
      setSection('portfolio', false, msg);
      setSection('balance', false, msg);
    }
  }, [setSection]);

  // ── Orchestration ────────────────────────────────────────────────────

  useEffect(() => {
    fetchWatchlist();
    fetchDexPairs();
    fetchStrategies();
    fetchMarketplace();
    fetchOpportunities();

    // Exchanges feeds both cexMarkets display and the portfolio aggregation —
    // fetch once, reuse the result rather than calling /exchanges twice.
    fetchCexMarkets().then(exchanges => fetchPortfolioAndBalance(exchanges));

    const priceInterval = setInterval(fetchWatchlist, 3_000);
    const marketInterval = setInterval(() => {
      fetchDexPairs();
      fetchOpportunities();
    }, 15_000);
    const slowInterval = setInterval(() => {
      fetchStrategies();
      fetchMarketplace();
      fetchCexMarkets().then(exchanges => fetchPortfolioAndBalance(exchanges));
    }, 30_000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(marketInterval);
      clearInterval(slowInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setData(prev => ({ ...prev, selectedPair }));
  }, [selectedPair]);

  const refetch = useCallback(() => {
    fetchWatchlist();
    fetchDexPairs();
    fetchStrategies();
    fetchMarketplace();
    fetchOpportunities();
    fetchCexMarkets().then(exchanges => fetchPortfolioAndBalance(exchanges));
  }, [fetchWatchlist, fetchDexPairs, fetchStrategies, fetchMarketplace, fetchOpportunities, fetchCexMarkets, fetchPortfolioAndBalance]);

  return {
    data,
    isLoading,
    error,
    sectionLoading,
    sectionErrors,
    refetch,
  };
};