/**
 * WebSocket Price Stream Server
 *
 * Real-time price streaming for CCXT exchange integration
 * Features:
 * - Subscribe/unsubscribe to price updates per symbol/exchange
 * - Stream price updates every 500ms
 * - Real-time arbitrage detection
 * - Order status updates
 * - Broadcast to multiple clients simultaneously
 *
 * FIXES APPLIED:
 * 1. Added token-based auth on connection (query param), matching the
 *    Gateway WS's auth model. Previously this endpoint had none at all.
 * 2. Per-tick fetches are parallelized with Promise.all instead of a
 *    sequential for-await loop, and a tick-overlap guard (isTickRunning)
 *    prevents a slow tick from stacking concurrent runs on top of itself.
 * 3. Prices are now fetched once per (symbol) per tick and reused by both
 *    broadcastPrices and findArbitrageOpportunities, instead of fetching
 *    the same data twice.
 * 4. lastArbitrageAlerts entries are pruned periodically instead of
 *    growing forever.
 * 5. Added caps on subscription set sizes to bound per-client resource use.
 * 6. Added a real shutdown() that clears the interval and closes sockets.
 * 7. NodeJS.Timeout used instead of the deprecated NodeJS.Timer alias.
 */

import WebSocket, { WebSocketServer } from 'ws';
import { type Server as HTTPServer } from 'http';
import { type IncomingMessage } from 'http';
import { ccxtService } from '../services/ccxtService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { verifyAccessToken } from '../auth';

/**
 * Type Definitions
 */
interface ClientSubscription {
  clientId: string;
  symbols: Set<string>;
  exchanges: Set<string>;
}

interface PriceUpdate {
  type: 'price' | 'order' | 'arbitrage' | 'subscribed' | 'unsubscribed' | 'error';
  symbol?: string;
  exchange?: string;
  bid?: number;
  ask?: number;
  timestamp?: number;
  orderId?: string;
  status?: string;
  filledPrice?: number;
  message?: string;
  error?: string;
}

interface ArbitrageOpportunity {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spreadPct: number;
  profit: number;
  timestamp: number;
}

const MAX_SYMBOLS_PER_CLIENT = 50;
const MAX_EXCHANGES_PER_CLIENT = 20;
const ALERT_PRUNE_INTERVAL_MS = 5 * 60 * 1000; // sweep stale debounce entries every 5 min

class PriceStreamServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, { subscription: ClientSubscription; ws: WebSocket; userId?: string }> = new Map();
  private streamingInterval: NodeJS.Timeout | null = null;
  private alertPruneInterval: NodeJS.Timeout | null = null;
  private isTickRunning = false;
  private arbitrageThreshold = 0.5; // 0.5% spread threshold for alerts
  private lastArbitrageAlerts: Map<string, number> = new Map(); // Debounce alerts
  private arbitrageDebounceMs = 60000; // Don't alert same pair more than once per minute

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer, options: { requireAuth?: boolean } = {}): void {
    try {
      this.wss = new WebSocketServer({
        server: httpServer,
        path: '/ws/prices',
        // FIX #1: verify auth token during the HTTP upgrade, before the
        // socket is ever handed to a connection handler.
        verifyClient: options.requireAuth === false
          ? undefined
          : (info, callback) => this.verifyClient(info, callback),
      });

      this.wss.on('connection', this.handleClientConnection.bind(this));
      logger.info('✅ WebSocket Price Stream Server initialized at /ws/prices');

      this.startPriceStreaming();
      this.startAlertPruning();
    } catch (error: any) {
      logger.error('Error initializing WebSocket server:', error);
      throw error;
    }
  }

  /**
   * FIX #1: Reject connections without a valid access token.
   * Token is expected as a `token` query param since raw `ws` handshakes
   * don't have a structured auth payload like Socket.IO's `auth` option.
   */
  private verifyClient(
    info: { req: IncomingMessage },
    callback: (res: boolean, code?: number, message?: string) => void
  ): void {
    try {
      const url = new URL(info.req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        callback(false, 401, 'Missing auth token');
        return;
      }

      const payload = verifyAccessToken(token);
      if (!payload) {
        callback(false, 401, 'Invalid or expired token');
        return;
      }

      (info.req as any).userId = payload.sub;
      callback(true);
    } catch (error: any) {
      logger.warn('WebSocket auth verification failed:', error.message);
      callback(false, 401, 'Authentication error');
    }
  }

  /**
   * Handle new client connection
   */
  private handleClientConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = uuidv4();
    const userId = (req as any).userId;
    logger.info(`📱 Client connected: ${clientId}${userId ? ` (user: ${userId})` : ''}`);

    const subscription: ClientSubscription = {
      clientId,
      symbols: new Set(),
      exchanges: new Set()
    };
    this.clients.set(clientId, { subscription, ws, userId });

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        this.handleClientMessage(clientId, data, ws);
      } catch (error: any) {
        logger.error(`Error parsing message from ${clientId}:`, error.message);
        this.sendToClient(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
      logger.info(`📱 Client disconnected: ${clientId}`);
    });

    ws.on('error', (error: any) => {
      logger.error(`WebSocket error for ${clientId}:`, error.message);
    });
  }

  /**
   * Handle incoming client messages
   */
  private handleClientMessage(clientId: string, data: any, ws: WebSocket): void {
    const clientData = this.clients.get(clientId);
    if (!clientData) {
      logger.warn(`Client ${clientId} not found`);
      return;
    }

    const subscription = clientData.subscription;
    const { action, symbols = [], exchanges = [] } = data || {};

    if (!Array.isArray(symbols) || !Array.isArray(exchanges)) {
      this.sendToClient(ws, { type: 'error', message: 'symbols and exchanges must be arrays' });
      return;
    }

    if (action === 'subscribe') {
      // FIX #5: cap subscription set sizes
      const remainingSymbolSlots = MAX_SYMBOLS_PER_CLIENT - subscription.symbols.size;
      const remainingExchangeSlots = MAX_EXCHANGES_PER_CLIENT - subscription.exchanges.size;

      symbols.slice(0, Math.max(0, remainingSymbolSlots)).forEach((s: string) => subscription.symbols.add(s));
      exchanges.slice(0, Math.max(0, remainingExchangeSlots)).forEach((e: string) => subscription.exchanges.add(e));

      if (symbols.length > remainingSymbolSlots || exchanges.length > remainingExchangeSlots) {
        logger.warn(`Client ${clientId} hit subscription cap (symbols=${MAX_SYMBOLS_PER_CLIENT}, exchanges=${MAX_EXCHANGES_PER_CLIENT})`);
      }

      logger.info(
        `📌 Client ${clientId} subscribed to symbols: ${[...subscription.symbols].join(',')}`
      );

      this.sendToClient(ws, {
        type: 'subscribed',
        symbols: [...subscription.symbols],
        exchanges: [...subscription.exchanges],
        message: 'Successfully subscribed'
      } as any);
    } else if (action === 'unsubscribe') {
      symbols.forEach((symbol: string) => subscription.symbols.delete(symbol));
      exchanges.forEach((exchange: string) => subscription.exchanges.delete(exchange));

      logger.info(`📌 Client ${clientId} unsubscribed`);

      this.sendToClient(ws, {
        type: 'unsubscribed',
        symbols: [...subscription.symbols],
        exchanges: [...subscription.exchanges],
        message: 'Successfully unsubscribed'
      } as any);
    } else {
      logger.warn(`Unknown action from ${clientId}: ${action}`);
      this.sendToClient(ws, { type: 'error', message: `Unknown action: ${action}` });
    }
  }

  /**
   * Start the price streaming interval
   */
  private startPriceStreaming(): void {
    if (this.streamingInterval) {
      logger.warn('Price streaming already running');
      return;
    }

    logger.info('🔄 Starting price streaming (500ms interval)');

    this.streamingInterval = setInterval(async () => {
      // FIX #2: skip this tick entirely if the previous one is still running,
      // instead of letting ticks stack up under load.
      if (this.isTickRunning) {
        logger.debug('Skipping price stream tick — previous tick still in flight');
        return;
      }
      this.isTickRunning = true;
      try {
        await this.runTick();
      } catch (error: any) {
        logger.error('Error in price streaming tick:', error.message);
      } finally {
        this.isTickRunning = false;
      }
    }, 500);
  }

  private startAlertPruning(): void {
    this.alertPruneInterval = setInterval(() => {
      const cutoff = Date.now() - this.arbitrageDebounceMs * 3;
      for (const [key, ts] of this.lastArbitrageAlerts.entries()) {
        if (ts < cutoff) this.lastArbitrageAlerts.delete(key);
      }
    }, ALERT_PRUNE_INTERVAL_MS);
  }

  /**
   * Stop the price streaming interval
   */
  stopPriceStreaming(): void {
    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
      this.streamingInterval = null;
      logger.info('⏹️ Stopped price streaming');
    }
    if (this.alertPruneInterval) {
      clearInterval(this.alertPruneInterval);
      this.alertPruneInterval = null;
    }
  }

  /**
   * FIX #2 + FIX #3: One combined tick that fetches prices for every unique
   * (symbol, exchange-set) once, in parallel, and reuses the result for both
   * broadcasting to subscribers and arbitrage detection — instead of two
   * separate passes that each independently fetched the same data.
   */
  private async runTick(): Promise<void> {
    if (this.clients.size === 0) return;

    const allSymbols = new Set<string>();
    const allExchanges = new Set<string>();

    for (const { subscription } of this.clients.values()) {
      subscription.symbols.forEach((s) => allSymbols.add(s));
      subscription.exchanges.forEach((e) => allExchanges.add(e));
    }

    if (allSymbols.size === 0 || allExchanges.size === 0) return;

    const exchangeList = Array.from(allExchanges);

    // Fetch every symbol's prices across the union of subscribed exchanges,
    // in parallel, once per tick.
    const symbolList = Array.from(allSymbols);
    const priceResults = await Promise.allSettled(
      symbolList.map((symbol) => ccxtService.getPricesFromMultipleExchanges(symbol, exchangeList))
    );

    const pricesBySymbol = new Map<string, Record<string, any>>();
    symbolList.forEach((symbol, idx) => {
      const result = priceResults[idx];
      if (result.status === 'fulfilled') {
        pricesBySymbol.set(symbol, result.value);
      } else {
        logger.debug(`Price fetch failed for ${symbol}:`, {
          error: (result.reason as Error)?.message || String(result.reason)
        });
      }
    });

    this.broadcastPrices(pricesBySymbol);
    this.checkArbitrageOpportunities(pricesBySymbol);
  }

  /**
   * Broadcast current prices to all subscribed clients using already-fetched data.
   */
  private broadcastPrices(pricesBySymbol: Map<string, Record<string, any>>): void {
    for (const [symbol, prices] of pricesBySymbol.entries()) {
      for (const clientData of this.clients.values()) {
        const { subscription, ws } = clientData;
        if (!subscription.symbols.has(symbol)) continue;
        if (ws.readyState !== WebSocket.OPEN) continue;

        for (const [exchange, priceData] of Object.entries(prices)) {
          if (!subscription.exchanges.has(exchange) || !priceData) continue;

          this.sendToClient(ws, {
            type: 'price',
            symbol,
            exchange,
            bid: (priceData as any).bid,
            ask: (priceData as any).ask,
            timestamp: (priceData as any).timestamp || Date.now()
          });
        }
      }
    }
  }

  /**
   * Check for arbitrage opportunities using already-fetched data and alert clients.
   */
  private checkArbitrageOpportunities(pricesBySymbol: Map<string, Record<string, any>>): void {
    for (const [symbol, prices] of pricesBySymbol.entries()) {
      const opportunities = this.findArbitrageOpportunities(symbol, prices);
      if (opportunities.length === 0) continue;

      for (const opportunity of opportunities) {
        for (const clientData of this.clients.values()) {
          const { subscription, ws } = clientData;
          if (!subscription.symbols.has(symbol)) continue;
          if (ws.readyState !== WebSocket.OPEN) continue;

          this.sendToClient(ws, {
            type: 'arbitrage',
            symbol: opportunity.symbol,
            buyExchange: opportunity.buyExchange,
            sellExchange: opportunity.sellExchange,
            buyPrice: opportunity.buyPrice,
            sellPrice: opportunity.sellPrice,
            spreadPct: opportunity.spreadPct,
            profit: opportunity.profit,
            timestamp: opportunity.timestamp
          } as any);
        }
      }
    }
  }

  /**
   * Find arbitrage opportunities for a symbol from already-fetched prices
   * (no network call here anymore — FIX #3).
   */
  private findArbitrageOpportunities(symbol: string, prices: Record<string, any>): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    try {
      const exchangeList = Object.entries(prices)
        .filter(([, priceData]) => priceData !== null && priceData !== undefined)
        .map(([exchange, priceData]) => ({
          exchange,
          bid: (priceData as any).bid,
          ask: (priceData as any).ask
        }))
        .filter((e) => Number.isFinite(e.bid) && Number.isFinite(e.ask) && e.ask > 0)
        .sort((a, b) => a.ask - b.ask);

      for (let i = 0; i < exchangeList.length; i++) {
        for (let j = i + 1; j < exchangeList.length; j++) {
          const buyEx = exchangeList[i];
          const sellEx = exchangeList[j];

          const spreadPct = ((sellEx.bid - buyEx.ask) / buyEx.ask) * 100;

          if (spreadPct > this.arbitrageThreshold) {
            const pairKey = `${symbol}:${buyEx.exchange}-${sellEx.exchange}`;
            const lastAlert = this.lastArbitrageAlerts.get(pairKey) || 0;

            if (Date.now() - lastAlert > this.arbitrageDebounceMs) {
              this.lastArbitrageAlerts.set(pairKey, Date.now());

              opportunities.push({
                symbol,
                buyExchange: buyEx.exchange,
                sellExchange: sellEx.exchange,
                buyPrice: buyEx.ask,
                sellPrice: sellEx.bid,
                spreadPct,
                profit: (sellEx.bid - buyEx.ask) * 100,
                timestamp: Date.now()
              });

              logger.info(
                `⚡ Arbitrage opportunity: ${symbol} ${spreadPct.toFixed(2)}% spread ` +
                `buy@${buyEx.exchange}(${buyEx.ask.toFixed(4)}) sell@${sellEx.exchange}(${sellEx.bid.toFixed(4)})`
              );
            }
          }
        }
      }
    } catch (error: any) {
      logger.debug(`Error finding arbitrage for ${symbol}:`, error.message);
    }

    return opportunities;
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(ws: WebSocket, message: PriceUpdate): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message), (error) => {
        if (error) logger.error('Error sending message to client:', error);
      });
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(message: PriceUpdate): void {
    if (!this.wss) return;
    for (const { ws } of this.clients.values()) {
      this.sendToClient(ws, message);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getStats(): {
    clientCount: number;
    totalSubscriptions: number;
    uniqueSymbols: number;
    uniqueExchanges: number;
  } {
    const uniqueSymbols = new Set<string>();
    const uniqueExchanges = new Set<string>();
    let totalSubscriptions = 0;

    for (const { subscription } of this.clients.values()) {
      totalSubscriptions += subscription.symbols.size + subscription.exchanges.size;
      subscription.symbols.forEach((s) => uniqueSymbols.add(s));
      subscription.exchanges.forEach((e) => uniqueExchanges.add(e));
    }

    return {
      clientCount: this.clients.size,
      totalSubscriptions,
      uniqueSymbols: uniqueSymbols.size,
      uniqueExchanges: uniqueExchanges.size
    };
  }

  /**
   * FIX #6: graceful shutdown — clears intervals and closes all sockets/server.
   */
  async shutdown(): Promise<void> {
    logger.info('[PriceStreamServer] Shutting down...');
    this.stopPriceStreaming();

    for (const { ws } of this.clients.values()) {
      try {
        ws.close(1001, 'Server shutting down');
      } catch {
        // ignore
      }
    }
    this.clients.clear();

    await new Promise<void>((resolve) => {
      if (!this.wss) return resolve();
      this.wss.close(() => resolve());
    });

    logger.info('[PriceStreamServer] Shutdown complete');
  }
}

export const priceStreamServer = new PriceStreamServer();