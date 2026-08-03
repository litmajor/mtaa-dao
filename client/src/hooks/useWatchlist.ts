import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listWatchlists,
  createWatchlist as apiCreateWatchlist,
  deleteWatchlist as apiDeleteWatchlist,
  addWatchlistItem as apiAddWatchlistItem,
  removeWatchlistItem as apiRemoveWatchlistItem,
  updateWatchlistItemAlert as apiUpdateWatchlistItemAlert,
  getMarketPrices,
  type Watchlist,
  type WatchlistItem,
  type WatchlistItemType,
  type WatchlistAlertMetric,
  type WatchlistAlertDirection,
} from '@/api/yukiApi';

// How often to re-poll live prices for symbol items currently on screen.
// NOTE: this goes through the REST endpoint (getMarketPrices), not the
// marketStream WebSocket -- see the evaluator's file header for why the
// WebSocket can't currently serve arbitrary multi-symbol subscriptions.
const PRICE_POLL_INTERVAL_MS = 15_000;

export interface WatchlistItemWithLiveValue extends WatchlistItem {
  liveValue: number | null;
  liveValueSource: 'live' | 'unavailable';
}

export interface WatchlistWithLiveValues extends Omit<Watchlist, 'items'> {
  items: WatchlistItemWithLiveValue[];
}

export function useWatchlist() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [livePrices, setLivePrices] = useState<Map<string, number>>(new Map()); // keyed by ticker
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await listWatchlists();
      setWatchlists(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll live prices for whatever symbol tickers are currently on any
  // watchlist. Re-derives the ticker list whenever watchlists change so a
  // newly-added symbol starts getting priced without a manual refresh.
  useEffect(() => {
    const tickers = new Set<string>();
    for (const wl of watchlists) {
      for (const item of wl.items) {
        if (item.item_type === 'symbol' && item.target_name) {
          tickers.add(item.target_name); // target_name for a symbol row is the ticker, resolved server-side
        }
      }
    }

    if (tickers.size === 0) {
      if (pollHandleRef.current) {
        clearInterval(pollHandleRef.current);
        pollHandleRef.current = null;
      }
      return;
    }

    const fetchPrices = async () => {
      try {
        const data = await getMarketPrices([...tickers]);
        // ASSUMPTION: getMarketPrices returns { [ticker]: { price: number, ... } }
        // or an array of { symbol, price }. I haven't seen the response shape
        // of GET /yuki/market/prices, only the request side in yukiApi.ts.
        // Adjust the parsing below to match once verified.
        const next = new Map<string, number>();
        if (Array.isArray(data)) {
          for (const entry of data) {
            if (entry && typeof entry === 'object' && 'symbol' in entry && 'price' in entry) {
              const symbol = String((entry as Record<string, unknown>).symbol);
              const price = (entry as Record<string, unknown>).price;
              if (typeof price === 'number') next.set(symbol, price);
            }
          }
        } else if (data && typeof data === 'object') {
          for (const [ticker, val] of Object.entries(data)) {
            if (val && typeof val === 'object') {
              const price = (val as Record<string, unknown>).price ?? (val as Record<string, unknown>).last;
              if (typeof price === 'number') next.set(ticker, price);
            }
          }
        }
        setLivePrices(next);
      } catch (err) {
        // Don't blow away previously-known prices on a transient failure --
        // stale-but-present beats blanking the UI every 15s on a flaky call.
        console.error('[useWatchlist] Failed to fetch live prices', err);
      }
    };

    fetchPrices();
    pollHandleRef.current = setInterval(fetchPrices, PRICE_POLL_INTERVAL_MS);

    return () => {
      if (pollHandleRef.current) {
        clearInterval(pollHandleRef.current);
        pollHandleRef.current = null;
      }
    };
  }, [watchlists]);

  const createWatchlist = useCallback(async (name: string) => {
    const newList = await apiCreateWatchlist(name);
    setWatchlists((prev) => [...prev, newList]);
    return newList;
  }, []);

  const deleteWatchlist = useCallback(async (watchlistId: string) => {
    await apiDeleteWatchlist(watchlistId);
    setWatchlists((prev) => prev.filter((w) => w.id !== watchlistId));
  }, []);

  const addItem = useCallback(
    async (
      watchlistId: string,
      params: {
        itemType: WatchlistItemType;
        targetId: string;
        alertMetric?: WatchlistAlertMetric;
        alertDirection?: WatchlistAlertDirection;
        alertThreshold?: number;
      }
    ) => {
      const newItem = await apiAddWatchlistItem(watchlistId, params);
      setWatchlists((prev) =>
        prev.map((w) => (w.id === watchlistId ? { ...w, items: [newItem, ...w.items] } : w))
      );
      return newItem;
    },
    []
  );

  const removeItem = useCallback(async (watchlistId: string, itemId: string) => {
    await apiRemoveWatchlistItem(itemId);
    setWatchlists((prev) =>
      prev.map((w) => (w.id === watchlistId ? { ...w, items: w.items.filter((i) => i.id !== itemId) } : w))
    );
  }, []);

  const updateItemAlert = useCallback(
    async (
      watchlistId: string,
      itemId: string,
      params: {
        alertMetric: WatchlistAlertMetric | null;
        alertDirection?: WatchlistAlertDirection;
        alertThreshold?: number;
      }
    ) => {
      const updated = await apiUpdateWatchlistItemAlert(itemId, params);
      setWatchlists((prev) =>
        prev.map((w) =>
          w.id === watchlistId
            ? { ...w, items: w.items.map((i) => (i.id === itemId ? updated : i)) }
            : w
        )
      );
      return updated;
    },
    []
  );

  // Merge live prices into watchlist items for rendering. vault/pool/
  // investment_pool items get liveValue: null with source 'unavailable'
  // until a live APY/TVL source is wired -- see watchlistAlertEvaluator.ts
  // header for the same unresolved gap on the evaluator side.
  const watchlistsWithLiveValues: WatchlistWithLiveValues[] = watchlists.map((w) => ({
    ...w,
    items: w.items.map((item) => {
      if (item.item_type === 'symbol' && item.target_name && livePrices.has(item.target_name)) {
        return { ...item, liveValue: livePrices.get(item.target_name)!, liveValueSource: 'live' as const };
      }
      return { ...item, liveValue: null, liveValueSource: 'unavailable' as const };
    }),
  }));

  return {
    watchlists: watchlistsWithLiveValues,
    loading,
    error,
    refresh,
    createWatchlist,
    deleteWatchlist,
    addItem,
    removeItem,
    updateItemAlert,
  };
}