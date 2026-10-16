/**
 * WebSocket Real-Time Feeds Service (Production)
 *
 * Manages authenticated WebSocket clients, per-symbol ref-counted
 * subscriptions, heartbeats, and pushes price / volatility / health /
 * execution-alert updates.
 *
 * Design notes
 * ─────────────────────────────────────────────────────────────
 * • Interest is tracked per (feed, symbol) with a reference count.
 *   Streams start on first subscriber and stop on last unsubscribe.
 * • Heartbeat every HEARTBEAT_MS; clients that miss MAX_MISSED_PONGS
 *   are terminated.
 * • Polling is used as a pragmatic default. Replace the fetch helpers
 *   with exchange-native WebSocket streams (CCXT Pro etc.) when ready.
 * • Horizontal scaling: run one instance behind a sticky-session LB
 *   or fan-out via Redis pub/sub (not included here).
 */

import { EventEmitter } from 'events';
import type WebSocket from 'ws';
import { ccxtService } from './ccxtService';
import { volatilityMetricsService } from './volatilityMetricsService';
import { marketAnalyticsService } from './marketAnalyticsService';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const cfg = {
  defaultExchange: process.env.WS_FEED_EXCHANGE || 'binance',
  priceIntervalMs: Number(process.env.WS_PRICE_INTERVAL_MS ?? 2_000),
  volatilityIntervalMs: Number(process.env.WS_VOL_INTERVAL_MS ?? 5_000),
  healthIntervalMs: Number(process.env.WS_HEALTH_INTERVAL_MS ?? 10_000),
  heartbeatMs: Number(process.env.WS_HEARTBEAT_MS ?? 30_000),
  maxMissedPongs: Number(process.env.WS_MAX_MISSED_PONGS ?? 2),
  maxClients: Number(process.env.WS_MAX_CLIENTS ?? 5_000),
  sendTimeoutMs: Number(process.env.WS_SEND_TIMEOUT_MS ?? 5_000),
};

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type FeedType = 'price' | 'volatility' | 'health' | 'alert';

export interface RealTimeUpdate {
  type: FeedType;
  symbol: string;
  timestamp: number;
  data: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'alert' | 'critical';
}

export interface ExecutionAlert {
  orderId: string;
  symbol: string;
  type: 'order_placed' | 'partial_fill' | 'completed' | 'abandoned' | 'slippage_deviation';
  details: string;
  severity: 'info' | 'warning' | 'alert' | 'critical';
  timestamp: number;
}

interface ClientFilters {
  minVolatility?: number;
  maxVolatility?: number;
  healthScoreThreshold?: number;
  alertSeverity?: Array<'info' | 'warning' | 'alert' | 'critical'>;
}

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  /** Set of "feed:symbol" keys this client cares about */
  subscriptions: Set<string>;
  filters: ClientFilters;
  isAlive: boolean;
  missedPongs: number;
  userId?: string; // set by auth hook
}

type AuthResult = { ok: true; userId?: string } | { ok: false; reason: string };

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

class WebSocketRealTimeFeeds extends EventEmitter {
  private clients = new Map<string, WebSocketClient>();

  /**
   * refCount["price:BTC/USDT"] = number of clients currently subscribed
   */
  private refCount = new Map<string, number>();

  /**
   * activeIntervals["price:BTC/USDT"] = NodeJS.Timeout
   */
  private activeIntervals = new Map<string, NodeJS.Timeout>();

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private shuttingDown = false;
  private static instance: WebSocketRealTimeFeeds;

  /** Optional auth function – inject at startup */
  private authenticate: (req: unknown) => Promise<AuthResult> = async () => ({
    ok: true,
  });

  private constructor() {
    super();
  }

  static getInstance(): WebSocketRealTimeFeeds {
    if (!WebSocketRealTimeFeeds.instance) {
      WebSocketRealTimeFeeds.instance = new WebSocketRealTimeFeeds();
    }
    return WebSocketRealTimeFeeds.instance;
  }

  /**
   * Call once at process start to supply an auth callback and start heartbeats.
   */
  init(options?: {
    authenticate?: (req: unknown) => Promise<AuthResult>;
  }): void {
    if (options?.authenticate) {
      this.authenticate = options.authenticate;
    }
    this.startHeartbeat();
  }

  // ───────────────────────────────────────────────────────────
  // Client lifecycle
  // ───────────────────────────────────────────────────────────

  async addClient(clientId: string, ws: WebSocket, upgradeReq?: unknown): Promise<void> {
    if (this.shuttingDown) {
      ws.close(1012, 'Service restarting');
      return;
    }

    if (this.clients.size >= cfg.maxClients) {
      ws.close(1013, 'Max clients reached');
      return;
    }

    const auth = await this.authenticate(upgradeReq);
    if (!auth.ok) {
      ws.close(1008, auth.reason);
      return;
    }

    const client: WebSocketClient = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      filters: {
        alertSeverity: ['warning', 'alert', 'critical'],
      },
      isAlive: true,
      missedPongs: 0,
      userId: auth.userId,
    };

    this.clients.set(clientId, client);
    logger.info('WebSocket client connected', { clientId, userId: auth.userId });

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const data = JSON.parse(raw.toString());
        this.handleClientMessage(clientId, data);
      } catch {
        this.safeSend(client, {
          type: 'error',
          message: 'Invalid message format',
        });
      }
    });

    ws.on('pong', () => {
      client.isAlive = true;
      client.missedPongs = 0;
    });

    ws.on('close', () => this.removeClient(clientId));
    ws.on('error', (err) => {
      logger.error('WebSocket error', { clientId, error: err.message });
    });
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Decrement ref-counts for every subscription
    for (const key of client.subscriptions) {
      this.decrementRef(key);
    }

    this.clients.delete(clientId);
    logger.info('WebSocket client disconnected', { clientId });
  }

  // ───────────────────────────────────────────────────────────
  // Message handling
  // ───────────────────────────────────────────────────────────

  private handleClientMessage(clientId: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client || typeof data !== 'object' || data === null) return;

    const { action, payload } = data as {
      action?: string;
      payload?: Record<string, unknown>;
    };

    switch (action) {
      case 'subscribe':
        this.subscribe(client, payload as { feed: FeedType; symbols?: string[] });
        break;
      case 'unsubscribe':
        this.unsubscribe(client, payload as { feed: FeedType; symbols?: string[] });
        break;
      case 'filter':
        this.setFilters(client, payload as ClientFilters);
        break;
      case 'ping':
        this.safeSend(client, { type: 'pong', timestamp: Date.now() });
        break;
      default:
        this.safeSend(client, { type: 'error', message: 'Unknown action' });
    }
  }

  private subscribe(
    client: WebSocketClient,
    payload: { feed: FeedType; symbols?: string[] } | undefined
  ): void {
    if (!payload?.feed) {
      this.safeSend(client, { type: 'error', message: 'feed is required' });
      return;
    }

    const { feed, symbols = [] } = payload;

    // Global alert feed has no symbol
    if (feed === 'alert') {
      const key = 'alert:';
      if (!client.subscriptions.has(key)) {
        client.subscriptions.add(key);
        this.incrementRef(key);
      }
      this.safeSend(client, { type: 'subscription_confirmed', feed, symbols: [] });
      return;
    }

    if (!symbols.length) {
      this.safeSend(client, {
        type: 'error',
        message: 'symbols array is required for this feed',
      });
      return;
    }

    for (const symbol of symbols) {
      const key = `${feed}:${symbol}`;
      if (client.subscriptions.has(key)) continue;
      client.subscriptions.add(key);
      this.incrementRef(key);
    }

    this.safeSend(client, { type: 'subscription_confirmed', feed, symbols });
    logger.info('Client subscribed', {
      clientId: client.id,
      feed,
      symbols,
    });
  }

  private unsubscribe(
    client: WebSocketClient,
    payload: { feed: FeedType; symbols?: string[] } | undefined
  ): void {
    if (!payload?.feed) return;

    const { feed, symbols = [] } = payload;

    if (feed === 'alert') {
      const key = 'alert:';
      if (client.subscriptions.delete(key)) {
        this.decrementRef(key);
      }
      return;
    }

    for (const symbol of symbols) {
      const key = `${feed}:${symbol}`;
      if (client.subscriptions.delete(key)) {
        this.decrementRef(key);
      }
    }
  }

  private setFilters(client: WebSocketClient, filters: ClientFilters = {}): void {
    client.filters = {
      minVolatility: filters.minVolatility,
      maxVolatility: filters.maxVolatility,
      healthScoreThreshold: filters.healthScoreThreshold ?? 0,
      alertSeverity: filters.alertSeverity ?? ['warning', 'alert', 'critical'],
    };
    this.safeSend(client, { type: 'filters_updated', filters: client.filters });
  }

  // ───────────────────────────────────────────────────────────
  // Ref-counting & stream lifecycle
  // ───────────────────────────────────────────────────────────

  private incrementRef(key: string): void {
    const count = (this.refCount.get(key) ?? 0) + 1;
    this.refCount.set(key, count);

    if (count === 1) {
      this.startStream(key);
    }
  }

  private decrementRef(key: string): void {
    const count = (this.refCount.get(key) ?? 0) - 1;
    if (count <= 0) {
      this.refCount.delete(key);
      this.stopStream(key);
    } else {
      this.refCount.set(key, count);
    }
  }

  private startStream(key: string): void {
    if (this.activeIntervals.has(key) || this.shuttingDown) return;

    const [feed, symbol] = key.split(':') as [FeedType, string];

    let intervalMs: number;
    let tick: () => Promise<void>;

    switch (feed) {
      case 'price':
        intervalMs = cfg.priceIntervalMs;
        tick = () => this.tickPrice(symbol);
        break;
      case 'volatility':
        intervalMs = cfg.volatilityIntervalMs;
        tick = () => this.tickVolatility(symbol);
        break;
      case 'health':
        intervalMs = cfg.healthIntervalMs;
        tick = () => this.tickHealth(symbol);
        break;
      default:
        return; // alert has no polling stream
    }

    // Fire once immediately, then on interval
    tick().catch((err) =>
      logger.error('Initial stream tick failed', { key, error: String(err) })
    );

    const handle = setInterval(() => {
      tick().catch((err) =>
        logger.error('Stream tick failed', { key, error: String(err) })
      );
    }, intervalMs);

    this.activeIntervals.set(key, handle);
    logger.debug('Started stream', { key, intervalMs });
  }

  private stopStream(key: string): void {
    const handle = this.activeIntervals.get(key);
    if (handle) {
      clearInterval(handle);
      this.activeIntervals.delete(key);
      logger.debug('Stopped stream', { key });
    }
  }

  // ───────────────────────────────────────────────────────────
  // Tick helpers (replace with real WS later)
  // ───────────────────────────────────────────────────────────

  private async tickPrice(symbol: string): Promise<void> {
    const ticker = await ccxtService.fetchTicker(symbol, cfg.defaultExchange);
    this.broadcast({
      type: 'price',
      symbol,
      timestamp: Date.now(),
      data: {
        price: ticker.last,
        bid: ticker.bid,
        ask: ticker.ask,
        volume24h: ticker.volume,
        change24h: ticker.percentage ?? 0,
      },
    });
  }

  private async tickVolatility(symbol: string): Promise<void> {
    const vol = await volatilityMetricsService.calculateVolatility(symbol, '1h');
    this.broadcast({
      type: 'volatility',
      symbol,
      timestamp: Date.now(),
      data: {
        currentVolatility: vol.volatility,
        volatilityTrend: vol.volatilityTrend,
        riskLevel: vol.riskLevel,
        volatilityIndex: vol.volatilityIndex,
      },
    });
  }

  private async tickHealth(symbol: string): Promise<void> {
    const [volatility, spreads, depth, liquidity] = await Promise.all([
      volatilityMetricsService.calculateVolatility(symbol, '24h'),
      marketAnalyticsService.analyzeSpreadTrends(symbol, cfg.defaultExchange),
      marketAnalyticsService.analyzeDepthTrends(symbol, cfg.defaultExchange),
      marketAnalyticsService.analyzeLiquidityTrends(symbol, cfg.defaultExchange),
    ]);

    let healthScore = Math.round(
      volatility.volatilityIndex * 0.3 +
        liquidity.liquidityScore * 0.3 +
        Math.max(0, 100 - spreads.currentSpread * 1000) * 0.2 +
        depth.liquidityHealth * 0.2
    );
    healthScore = Math.max(0, Math.min(100, healthScore)); // clamp

    const assessment =
      healthScore >= 75
        ? 'Excellent'
        : healthScore >= 50
          ? 'Good'
          : healthScore >= 25
            ? 'Fair'
            : 'Poor';

    const recommendation =
      healthScore >= 75
        ? 'OPTIMAL CONDITIONS – safe for large orders'
        : healthScore < 25
          ? 'POOR CONDITIONS – use limit orders only'
          : 'Use caution with order sizing';

    this.broadcast({
      type: 'health',
      symbol,
      timestamp: Date.now(),
      data: { healthScore, assessment, recommendation },
    });
  }

  // ───────────────────────────────────────────────────────────
  // Broadcast
  // ───────────────────────────────────────────────────────────

  broadcast(update: RealTimeUpdate): void {
    const key =
      update.type === 'alert' ? 'alert:' : `${update.type}:${update.symbol}`;

    // Fast path: no subscribers
    if ((this.refCount.get(key) ?? 0) === 0) return;

    for (const client of this.clients.values()) {
      if (!client.subscriptions.has(key)) continue;
      if (!this.passesFilters(client, update)) continue;
      this.safeSend(client, update);
    }
  }

  broadcastExecutionAlert(alert: ExecutionAlert): void {
    this.broadcast({
      type: 'alert',
      symbol: alert.symbol,
      timestamp: alert.timestamp,
      severity: alert.severity,
      data: { ...alert },
    });
  }

  private passesFilters(client: WebSocketClient, update: RealTimeUpdate): boolean {
    if (update.type === 'volatility') {
      const vol = update.data.currentVolatility as number;
      if (
        client.filters.minVolatility !== undefined &&
        vol < client.filters.minVolatility
      ) {
        return false;
      }
      if (
        client.filters.maxVolatility !== undefined &&
        vol > client.filters.maxVolatility
      ) {
        return false;
      }
    }

    if (update.type === 'health') {
      const score = update.data.healthScore as number;
      if (
        client.filters.healthScoreThreshold !== undefined &&
        score < client.filters.healthScoreThreshold
      ) {
        return false;
      }
    }

    if (update.severity && client.filters.alertSeverity) {
      if (!client.filters.alertSeverity.includes(update.severity)) {
        return false;
      }
    }

    return true;
  }

  // ───────────────────────────────────────────────────────────
  // Safe send with back-pressure guard
  // ───────────────────────────────────────────────────────────

  private safeSend(client: WebSocketClient, payload: unknown): void {
    if (client.ws.readyState !== client.ws.OPEN) return;

    // Simple back-pressure: drop if the buffered amount is already large
    if (client.ws.bufferedAmount > 1_000_000) {
      logger.warn('Dropping message – client buffer full', { clientId: client.id });
      return;
    }

    try {
      client.ws.send(JSON.stringify(payload), (err) => {
        if (err) {
          logger.error('WebSocket send failed', {
            clientId: client.id,
            error: err.message,
          });
        }
      });
    } catch (err) {
      logger.error('WebSocket send threw', {
        clientId: client.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ───────────────────────────────────────────────────────────
  // Heartbeat
  // ───────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      for (const [id, client] of this.clients) {
        if (!client.isAlive) {
          client.missedPongs += 1;
          if (client.missedPongs > cfg.maxMissedPongs) {
            logger.info('Terminating unresponsive client', { clientId: id });
            client.ws.terminate();
            this.removeClient(id);
            continue;
          }
        }
        client.isAlive = false;
        try {
          client.ws.ping();
        } catch {
          this.removeClient(id);
        }
      }
    }, cfg.heartbeatMs);
  }

  // ───────────────────────────────────────────────────────────
  // Observability & shutdown
  // ───────────────────────────────────────────────────────────

  getClientCount(): number {
    return this.clients.size;
  }

  getSubscriptionStats(): {
    totalClients: number;
    activeStreams: number;
    streams: Array<{ key: string; subscribers: number }>;
  } {
    return {
      totalClients: this.clients.size,
      activeStreams: this.activeIntervals.size,
      streams: Array.from(this.refCount.entries()).map(([key, subscribers]) => ({
        key,
        subscribers,
      })),
    };
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const handle of this.activeIntervals.values()) {
      clearInterval(handle);
    }
    this.activeIntervals.clear();
    this.refCount.clear();

    const closePromises: Promise<void>[] = [];
    for (const client of this.clients.values()) {
      closePromises.push(
        new Promise((resolve) => {
          client.ws.once('close', () => resolve());
          client.ws.close(1001, 'Server shutting down');
          // Force after 2 s
          setTimeout(() => {
            client.ws.terminate();
            resolve();
          }, 2_000);
        })
      );
    }
    await Promise.all(closePromises);
    this.clients.clear();

    logger.info('WebSocketRealTimeFeeds shut down cleanly');
  }
}

export const websocketRealtimeFeeds = WebSocketRealTimeFeeds.getInstance();