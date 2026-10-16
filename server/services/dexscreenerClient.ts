/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DexScreener API Client
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Bridges multi-chain DEX pair discovery with Node.js server.
 * Supports REST + real-time WebSocket updates.
 */

import { logger } from '../utils/logger';

// ============= TYPES =============

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: {
    address: string;
    name: string;
    symbol: string;
    decimals?: number;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
    decimals?: number;
  };
  priceNative: string;
  priceUsd: string | null;
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  volume?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24: number;
  };
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  txns?: {
    [timeframe: string]: { buys?: number; sells?: number };
  };
  info?: {
    imageUrl?: string;
    websites?: Array<{ url: string }>;
    socials?: Array<{ platform: string; handle: string }>;
  };
  boosts?: {
    active?: number;
  };
}

export interface DexToken {
  address: string;
  name: string;
  symbol: string;
  decimals?: number;
  chainId: string;
}

export interface DexPairEnrichment {
  bestPair: DexPair | null;
  totalLiquidityUsd: number;
  volume24h: number;
  dexes: string[];
  hasDEXData: boolean;
}

export interface DexSearchResponse {
  schemaVersion?: string;
  pairs: DexPair[];
}

export interface DexOHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volume_quote: number;
}

export interface DexOHLCVResponse {
  status: 'success' | 'error';
  symbol: string;
  pair: string;
  chain: string;
  pairAddress?: string;
  timeframe: string;
  exchange: string;
  total_candles: number;
  from: number;
  to: number;
  data: DexOHLCVCandle[];
  error?: string;
}

export interface DexCandleUpdate {
  type: 'candle';
  symbol: string;
  pair: string;
  chainId: string;
  pairAddress: string;
  timeframe: string;
  candle: DexOHLCVCandle;
}

export type DexWsMessage =
  | { type: 'pair'; pair: DexPair; chainId: string }
  | { type: 'token'; tokenAddress: string; data: any }
  | { type: 'boost'; data: any }
  | { type: 'profile'; data: any }
  | { type: 'connected'; message: string }
  | DexCandleUpdate;

type WsCallback = (message: DexWsMessage) => void;

// ============= CLIENT =============

export class DexScreenerClient {
  private readonly BASE_URL = 'https://api.dexscreener.com';
  private readonly RATE_LIMIT_MS = 300;
  private lastCall = 0;

  // WebSocket
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscribers: Set<WsCallback> = new Set();
  private watchedPairs = new Map<string, DexPair>();
  private watchedCandleTimeframes = new Map<string, string[]>();
  private pendingChainSubscriptions = new Set<string>();
  private candleState = new Map<string, DexOHLCVCandle>();

  /**
   * Rate-limited fetch wrapper
   */
  private async rateLimitedFetch(url: string): Promise<any> {
    const now = Date.now();
    const wait = this.RATE_LIMIT_MS - (now - this.lastCall);
    if (wait > 0) {
      await new Promise(r => setTimeout(r, wait));
    }
    this.lastCall = Date.now();

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error body');
      throw new Error(`DexScreener ${response.status}: ${url} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Search across all chains and DEXes for a query.
   */
  async searchPairs(query: string): Promise<DexPair[]> {
    try {
      const data: DexSearchResponse = await this.rateLimitedFetch(
        `${this.BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      return data.pairs || [];
    } catch (err) {
      logger.warn(`[DexScreener] searchPairs "${query}" failed:`, { error: err });
      return [];
    }
  }

  /**
   * Get detailed info about a specific pair.
   */
  async getPairDetails(chainId: string, pairAddress: string): Promise<DexPair | null> {
    try {
      const data = await this.rateLimitedFetch(
        `${this.BASE_URL}/latest/dex/pairs/${chainId}/${pairAddress}`
      );
      return data.pairs?.[0] || null;
    } catch (err) {
      logger.warn(`[DexScreener] getPairDetails failed:`, { error: err });
      return null;
    }
  }

  /**
   * Get all pairs for a specific token address on any chain.
   */
  async getTokenPairs(tokenAddress: string): Promise<DexPair[]> {
    try {
      const data = await this.rateLimitedFetch(
        `${this.BASE_URL}/latest/dex/tokens/${tokenAddress}`
      );
      return data.pairs || [];
    } catch (err) {
      logger.warn(`[DexScreener] getTokenPairs failed for ${tokenAddress}:`, { error: err });
      return [];
    }
  }

  /**
   * Get pairs for a token on a specific chain (newer endpoint).
   */
  async getTokenPairsOnChain(chainId: string, tokenAddress: string): Promise<DexPair[]> {
    try {
      const data = await this.rateLimitedFetch(
        `${this.BASE_URL}/token-pairs/v1/${chainId}/${tokenAddress}`
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      logger.warn(`[DexScreener] getTokenPairsOnChain failed:`, { error: err });
      return [];
    }
  }

  async getOHLCV(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<DexOHLCVResponse> {
    try {
      const searchTerm = symbol.includes('/') ? symbol.split('/')[0] : symbol;
      const pairs = await this.searchPairs(searchTerm);

      if (!pairs.length) {
        return this.ohlcvError(symbol, timeframe, `No pairs found for ${symbol}`);
      }

      // Prioritize Celo for native symbols, then highest liquidity pair
      let bestPair = pairs[0];

      const upperSymbol = symbol.toUpperCase();
      const isCeloNative = upperSymbol.includes('CUSD') ||
                          upperSymbol.includes('CEUR') ||
                          upperSymbol.includes('CKES') ||
                          upperSymbol.includes('CREAL');

      if (isCeloNative) {
        const celoPair = pairs.find(p => p.chainId === 'celo' && p.priceUsd);
        if (celoPair) bestPair = celoPair;
      } else {
        bestPair = pairs.sort((a, b) =>
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];
      }

      if (bestPair.pairAddress && bestPair.chainId) {
        const detailed = await this.getPairDetails(bestPair.chainId, bestPair.pairAddress);
        if (detailed) bestPair = detailed;
      }

      const candles = this.buildSyntheticOHLCV(bestPair, timeframe, limit);

      if (bestPair.pairAddress && bestPair.chainId) {
        this.watchPairs([{ chainId: bestPair.chainId, pairAddress: bestPair.pairAddress, timeframe }]);
      }

      return {
        status: 'success',
        symbol,
        pair: `${bestPair.baseToken.symbol}/${bestPair.quoteToken.symbol}`,
        chain: bestPair.chainId as any,
        pairAddress: bestPair.pairAddress,
        timeframe,
        exchange: `dexscreener:${bestPair.dexId}`,
        total_candles: candles.length,
        from: candles[0].timestamp,
        to: candles[candles.length - 1].timestamp,
        data: candles,
      };
    } catch (err: any) {
      logger.warn(`[DexScreener] getOHLCV failed for ${symbol}:`, { error: err });
      return this.ohlcvError(symbol, timeframe, err.message || 'Unknown error');
    }
  }

  private buildSyntheticOHLCV(pair: DexPair, timeframe: string, limit: number): DexOHLCVCandle[] {
    const priceUsd = Number(pair.priceUsd) || 0;
    const change24h = pair.priceChange?.h24 ?? 0;
    const volume24h = pair.volume?.h24 ?? 0;
    const count = Math.min(Math.max(limit, 1), 288);
    const periodSecs = this.timeframeToSeconds(timeframe);
    const now = Math.floor(Date.now() / 1000);

    const growthFactor = 1 + change24h / 100;
    const startPrice = growthFactor > 0 ? priceUsd / growthFactor : priceUsd;
    let previousClose = startPrice;

    return Array.from({ length: count }, (_, index) => {
      const fraction = count > 1 ? index / (count - 1) : 1;
      const close = startPrice * (1 + fraction * (change24h / 100));
      const open = index === 0 ? startPrice : previousClose;
      const high = Math.max(open, close) * 1.001;
      const low = Math.min(open, close) * 0.999;
      const volumeQuote = volume24h / count;
      const volume = priceUsd > 0 ? volumeQuote / priceUsd : 0;
      previousClose = close;

      return {
        timestamp: now - (count - 1 - index) * periodSecs,
        open,
        high,
        low,
        close,
        volume,
        volume_quote: volumeQuote,
      };
    });
  }

  private timeframeToSeconds(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };
    return map[timeframe] ?? 3600;
  }

  private ohlcvError(symbol: string, timeframe: string, message: string): DexOHLCVResponse {
    return {
      status: 'error',
      symbol,
      pair: symbol,
      chain: 'dex',
      timeframe,
      exchange: 'dexscreener',
      total_candles: 0,
      from: 0,
      to: 0,
      data: [],
      error: message,
    };
  }

  /**
   * Get Celo-specific trending pairs with liquidity/volume filters.
   */
  async getCeloTrendingPairs(options?: {
    minLiquidityUsd?: number;
    minVolume24h?: number;
    limit?: number;
  }): Promise<DexPair[]> {
    const {
      minLiquidityUsd = 10_000,
      minVolume24h = 5_000,
      limit = 50,
    } = options || {};

    try {
      const pairs = await this.searchPairs('celo');

      const filtered = pairs
        .filter(p =>
          p.chainId === 'celo' &&
          (p.liquidity?.usd || 0) >= minLiquidityUsd &&
          (p.volume?.h24 || 0) >= minVolume24h
        )
        .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, limit);

      // Auto-register discovered tokens
      try {
        const { priceOracle } = await import('./priceOracle');
        const { tokenRegistry } = await import('./tokenRegistry');
        const supported = new Set(priceOracle.getSupportedCurrencies().map(s => s.toUpperCase()));

        for (const pair of filtered) {
          const candidates = [pair.baseToken, pair.quoteToken];
          for (const tk of candidates) {
            const sym = (tk.symbol || '').toUpperCase();
            if (!sym || supported.has(sym)) continue;

            const reg = tokenRegistry.filterTokens({ symbol: sym })[0];
            if (reg && reg.coingeckoId) {
              priceOracle.registerSymbolMapping(sym, reg.coingeckoId);
              supported.add(sym);
              logger.debug(`[DexScreener] Registered ${sym} → ${reg.coingeckoId}`);
              continue;
            }

            const candidate = sym.toLowerCase();
            if (/^[a-z0-9-]{1,64}$/.test(candidate)) {
              priceOracle.registerSymbolMapping(sym, candidate);
              supported.add(sym);
              logger.debug(`[DexScreener] Heuristically registered ${sym}`);
            }
          }
        }
      } catch (regErr: any) {
        logger.warn('[DexScreener] Auto-registration failed:', regErr?.message);
      }

      return filtered;
    } catch (err) {
      logger.warn('[DexScreener] getCeloTrendingPairs failed:', { error: err });
      return [];
    }
  }

  /**
   * Get Celo pairs for a list of token addresses (batched).
   */
  async getCeloPairsForTokens(tokenAddresses: string[]): Promise<Map<string, DexPair[]>> {
    const result = new Map<string, DexPair[]>();
    const BATCH_SIZE = 30;

    for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
      const batch = tokenAddresses.slice(i, i + BATCH_SIZE);
      try {
        const data = await this.rateLimitedFetch(
          `${this.BASE_URL}/tokens/v1/celo/${batch.join(',')}`
        );
        const pairs: DexPair[] = Array.isArray(data) ? data : (data.pairs || []);

        for (const pair of pairs) {
          if (pair.chainId !== 'celo') continue;
          const addr = pair.baseToken.address.toLowerCase();
          if (!result.has(addr)) result.set(addr, []);
          result.get(addr)!.push(pair);
        }
      } catch (err: any) {
        logger.warn(`[DexScreener] Batch failed:`, err.message);
      }
    }

    return result;
  }

  /**
   * Enrich Celo token addresses with DEX liquidity data.
   */
  async enrichWithCeloDEXData(celoTokenAddresses: string[]): Promise<Map<string, DexPairEnrichment>> {
    const pairsByToken = await this.getCeloPairsForTokens(celoTokenAddresses);
    const result = new Map<string, DexPairEnrichment>();

    for (const [address, pairs] of pairsByToken.entries()) {
      const sorted = [...pairs].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

      result.set(address, {
        bestPair: sorted[0] || null,
        totalLiquidityUsd: pairs.reduce((s, p) => s + (p.liquidity?.usd || 0), 0),
        volume24h: pairs.reduce((s, p) => s + (p.volume?.h24 || 0), 0),
        dexes: [...new Set(pairs.map(p => p.dexId))],
        hasDEXData: pairs.length > 0,
      });
    }

    logger.info(`[DexScreener] Enriched ${result.size} Celo tokens with DEX data`);
    return result;
  }

  /**
   * Monitor trending Celo tokens and return any new ones.
   */
  async discoverEmergingCeloTokens(
    knownAddresses: Set<string>,
    options?: { minLiquidityUsd?: number; minVolume24h?: number }
  ): Promise<DexToken[]> {
    const { minLiquidityUsd = 100_000, minVolume24h = 50_000 } = options || {};

    try {
      const pairs = await this.getCeloTrendingPairs({ minLiquidityUsd, minVolume24h, limit: 100 });
      const emerging: DexToken[] = [];

      for (const pair of pairs) {
        const baseAddr = pair.baseToken.address.toLowerCase();
        const quoteAddr = pair.quoteToken.address.toLowerCase();

        if (!knownAddresses.has(baseAddr)) {
          emerging.push({
            address: pair.baseToken.address,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            chainId: pair.chainId,
          });
        }

        if (!knownAddresses.has(quoteAddr)) {
          emerging.push({
            address: pair.quoteToken.address,
            symbol: pair.quoteToken.symbol,
            name: pair.quoteToken.name,
            chainId: pair.chainId,
          });
        }
      }

      const deduped = Array.from(
        new Map(emerging.map(t => [t.address.toLowerCase(), t])).values()
      );

      logger.info(`[DexScreener] Discovered ${deduped.length} emerging Celo tokens`);
      return deduped;
    } catch (err) {
      logger.warn('[DexScreener] Emerging token discovery failed:', { error: err });
      return [];
    }
  }

  /**
   * General helper: Get trending pairs on any chain
   */
  async getTrendingPairsOnChain(chainId: string, options?: {
    minLiquidityUsd?: number;
    minVolume24h?: number;
    limit?: number;
  }): Promise<DexPair[]> {
    const { minLiquidityUsd = 50_000, minVolume24h = 20_000, limit = 50 } = options || {};
    const pairs = await this.searchPairs(chainId);

    return pairs
      .filter(p => 
        p.chainId === chainId &&
        (p.liquidity?.usd || 0) >= minLiquidityUsd &&
        (p.volume?.h24 || 0) >= minVolume24h
      )
      .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, limit);
  }

  // ==================== WEBSOCKET SUPPORT ====================

  /**
   * Connect to DexScreener real-time WebSocket
   */
  connectWebSocket(): void {
    if (this.ws && this.wsConnected) return;

    const wsUrl = 'wss://api.dexscreener.com/token-profiles/latest/v1'; // Primary real-time endpoint

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.wsConnected = true;
      this.reconnectAttempts = 0;
      logger.info('✅ DexScreener WebSocket connected');
      this.notifySubscribers({ type: 'connected', message: 'Real-time DexScreener stream active' });

      // Subscribe to broad coverage and any requested chains.
      const chains = new Set(['celo', 'solana', 'ethereum', 'base']);
      for (const id of this.pendingChainSubscriptions) {
        chains.add(id);
      }
      this.subscribeToChains(Array.from(chains));
      this.pendingChainSubscriptions.clear();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        this.handleWebSocketMessage(data);
      } catch (err) {
        logger.warn('[DexScreener WS] Parse error:', { error: err });
      }
    };

    this.ws.onerror = (err) => logger.error('[DexScreener WS] Error:', err);
    this.ws.onclose = () => {
      this.wsConnected = false;
      logger.warn('[DexScreener WS] Connection closed');
      this.attemptReconnect();
    };
  }

  private handleWebSocketMessage(raw: any): void {
    let message: DexWsMessage;

    if (raw.chainId && raw.pairAddress) {
      const pair: DexPair = { ...raw };
      this.updatePairCache(pair);
      message = { type: 'pair', pair, chainId: raw.chainId };
      this.handleRealtimePairUpdate(pair);
    } else if (raw.tokenAddress) {
      message = { type: 'token', tokenAddress: raw.tokenAddress, data: raw };
    } else if (raw.boosts) {
      message = { type: 'boost', data: raw };
    } else {
      message = { type: 'profile', data: raw };
    }

    this.notifySubscribers(message);
  }

  private updatePairCache(pair: DexPair): void {
    const key = `${pair.chainId}:${pair.pairAddress}`;
    this.watchedPairs.set(key, pair);
  }

  private subscribeToChains(chains: string[]): void {
    if (!this.ws || !this.wsConnected) return;
    // DexScreener WS accepts chain-level subscriptions for broad coverage.
    this.ws.send(JSON.stringify({ action: 'subscribe', chains }));
  }

  private getCandleKey(chainId: string, pairAddress: string, timeframe: string): string {
    return `${chainId}:${pairAddress}:${timeframe}`;
  }

  private buildOrUpdateRealtimeCandle(pair: DexPair, timeframe: string): DexOHLCVCandle | null {
    const price = Number(pair.priceUsd);
    if (!price || Number.isNaN(price)) return null;

    const now = Math.floor(Date.now() / 1000);
    const periodSecs = this.timeframeToSeconds(timeframe);
    const timestamp = now - (now % periodSecs);
    const key = this.getCandleKey(pair.chainId, pair.pairAddress, timeframe);
    const previous = this.candleState.get(key);

    const intervalCount = Math.max(1, Math.floor(86400 / periodSecs));
    const volumeQuote = pair.volume?.h24 ? pair.volume.h24 / intervalCount : 0;
    const volume = price > 0 ? volumeQuote / price : 0;

    const candle: DexOHLCVCandle = previous && previous.timestamp === timestamp
      ? {
          timestamp,
          open: previous.open,
          high: Math.max(previous.high, price),
          low: Math.min(previous.low, price),
          close: price,
          volume: Math.max(previous.volume, volume),
          volume_quote: Math.max(previous.volume_quote, volumeQuote),
        }
      : {
          timestamp,
          open: price,
          high: price,
          low: price,
          close: price,
          volume,
          volume_quote: volumeQuote,
        };

    this.candleState.set(key, candle);
    return candle;
  }

  private handleRealtimePairUpdate(pair: DexPair): void {
    const key = `${pair.chainId}:${pair.pairAddress}`;
    const timeframes = this.watchedCandleTimeframes.get(key);
    if (!timeframes?.length) return;

    const symbol = `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`;

    for (const timeframe of timeframes) {
      const candle = this.buildOrUpdateRealtimeCandle(pair, timeframe);
      if (!candle) continue;
      this.notifySubscribers({
        type: 'candle',
        symbol,
        pair: symbol,
        chainId: pair.chainId,
        pairAddress: pair.pairAddress,
        timeframe,
        candle,
      });
    }
  }

  /**
   * Subscribe to real-time updates
   */
  onUpdate(callback: WsCallback): () => void {
    this.subscribers.add(callback);
    if (!this.wsConnected) this.connectWebSocket();
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(message: DexWsMessage): void {
    for (const cb of this.subscribers) {
      try {
        cb(message);
      } catch (err) {
        logger.warn('[DexScreener WS] Subscriber error:', { error: err });
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    const delay = Math.min(2000 * this.reconnectAttempts, 30000);

    this.reconnectTimeout = setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  /**
   * Watch specific pairs in real-time and emit candle updates.
   */
  watchPairs(pairs: Array<{ chainId: string; pairAddress: string; timeframe?: string }>): void {
    if (!this.wsConnected) this.connectWebSocket();

    const chainsToSubscribe: string[] = [];

    for (const { chainId, pairAddress, timeframe = '1m' } of pairs) {
      const key = `${chainId}:${pairAddress}`;
      const existing = this.watchedCandleTimeframes.get(key) ?? [];
      if (!existing.includes(timeframe)) {
        existing.push(timeframe);
        this.watchedCandleTimeframes.set(key, existing);
      }

      const chainKey = `${chainId}:${pairAddress}`;
      if (!this.watchedPairs.has(chainKey) && !chainsToSubscribe.includes(chainId)) {
        chainsToSubscribe.push(chainId);
      }

      if (!this.wsConnected) {
        this.pendingChainSubscriptions.add(chainId);
      }
    }

    if (this.wsConnected && chainsToSubscribe.length > 0) {
      this.subscribeToChains(chainsToSubscribe);
    }

    logger.info(`[DexScreener] Watching ${pairs.length} pairs for real-time candle updates`);
  }

  disconnectWebSocket(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected = false;
    this.subscribers.clear();
    logger.info('[DexScreener] WebSocket disconnected');
  }

  isWsConnected(): boolean {
    return this.wsConnected;
  }
}

// ============= SINGLETON EXPORT =============
export const dexscreenerClient = new DexScreenerClient();