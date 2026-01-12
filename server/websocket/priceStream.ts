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
 */

import WebSocket, { WebSocketServer } from 'ws';
import { Server as HTTPServer } from 'http';
import { ccxtService } from '../services/ccxtService';
import { orderRouter } from '../services/orderRouter';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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

class PriceStreamServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, { subscription: ClientSubscription; ws: WebSocket }> = new Map();
  private priceCache: Map<string, any> = new Map();
  private streamingInterval: NodeJS.Timer | null = null;
  private arbitrageThreshold = 0.5; // 0.5% spread threshold for alerts
  private lastArbitrageAlerts: Map<string, number> = new Map(); // Debounce alerts
  private arbitrageDebounceMs = 60000; // Don't alert same pair more than once per minute

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    try {
      this.wss = new WebSocketServer({ 
        server: httpServer,
        path: '/ws/prices'
      });

      this.wss.on('connection', this.handleClientConnection.bind(this));
      logger.info('✅ WebSocket Price Stream Server initialized at /ws/prices');
      
      // Start price streaming
      this.startPriceStreaming();
    } catch (error: any) {
      logger.error('Error initializing WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Handle new client connection
   */
  private handleClientConnection(ws: WebSocket): void {
    const clientId = uuidv4();
    logger.info(`📱 Client connected: ${clientId}`);

    // Initialize client subscription
    const subscription: ClientSubscription = {
      clientId,
      symbols: new Set(),
      exchanges: new Set()
    };
    this.clients.set(clientId, { subscription, ws });

    // Handle incoming messages
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        this.handleClientMessage(clientId, data, ws);
      } catch (error: any) {
        logger.error(`Error parsing message from ${clientId}:`, error.message);
        this.sendToClient(ws, {
          type: 'error',
          message: 'Invalid message format'
        });
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.clients.delete(clientId);
      logger.info(`📱 Client disconnected: ${clientId}`);
    });

    // Handle errors
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
    const { action, symbols = [], exchanges = [] } = data;

    if (action === 'subscribe') {
      symbols.forEach((symbol: string) => subscription.symbols.add(symbol));
      exchanges.forEach((exchange: string) => subscription.exchanges.add(exchange));

      logger.info(
        `📌 Client ${clientId} subscribed to symbols: ${[...subscription.symbols].join(',')}`
      );

      this.sendToClient(ws, {
        type: 'subscribed',
        symbols: [...subscription.symbols],
        exchanges: [...subscription.exchanges],
        message: 'Successfully subscribed'
      });
    } else if (action === 'unsubscribe') {
      symbols.forEach((symbol: string) => subscription.symbols.delete(symbol));
      exchanges.forEach((exchange: string) => subscription.exchanges.delete(exchange));

      logger.info(`📌 Client ${clientId} unsubscribed`);

      this.sendToClient(ws, {
        type: 'unsubscribed',
        symbols: [...subscription.symbols],
        exchanges: [...subscription.exchanges],
        message: 'Successfully unsubscribed'
      });
    } else {
      logger.warn(`Unknown action from ${clientId}: ${action}`);
      this.sendToClient(ws, {
        type: 'error',
        message: `Unknown action: ${action}`
      });
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
      try {
        await this.broadcastPrices();
        await this.checkArbitrageOpportunities();
      } catch (error: any) {
        logger.error('Error in price streaming:', error.message);
      }
    }, 500); // Stream prices every 500ms
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
  }

  /**
   * Broadcast current prices to all subscribed clients
   */
  private async broadcastPrices(): Promise<void> {
    if (this.clients.size === 0) return;

    // Collect all unique symbols and exchanges
    const allSymbols = new Set<string>();
    const allExchanges = new Set<string>();

    for (const { subscription } of this.clients.values()) {
      subscription.symbols.forEach(s => allSymbols.add(s));
      subscription.exchanges.forEach(e => allExchanges.add(e));
    }

    if (allSymbols.size === 0 || allExchanges.size === 0) return;

    try {
      // Fetch prices for all symbols/exchanges
      for (const symbol of allSymbols) {
        const prices = await ccxtService.getPricesFromMultipleExchanges(
          symbol,
          Array.from(allExchanges)
        );

        // Broadcast to subscribed clients
        for (const [clientId, clientData] of this.clients.entries()) {
          const { subscription, ws } = clientData;
          if (!subscription.symbols.has(symbol)) continue;

          for (const [exchange, priceData] of Object.entries(prices)) {
            if (!subscription.exchanges.has(exchange)) continue;
            if (!priceData) continue;

            const update: PriceUpdate = {
              type: 'price',
              symbol,
              exchange,
              bid: priceData.bid,
              ask: priceData.ask,
              timestamp: priceData.timestamp || Date.now()
            };

            if (ws && ws.readyState === WebSocket.OPEN) {
              this.sendToClient(ws, update);
            }
          }
        }
      }
    } catch (error: any) {
      logger.error('Error broadcasting prices:', error.message);
    }
  }

  /**
   * Check for arbitrage opportunities and alert clients
   */
  private async checkArbitrageOpportunities(): Promise<void> {
    if (this.clients.size === 0) return;

    // Collect all unique symbols
    const allSymbols = new Set<string>();
    for (const { subscription } of this.clients.values()) {
      subscription.symbols.forEach(s => allSymbols.add(s));
    }

    if (allSymbols.size === 0) return;

    try {
      // Check each symbol for arbitrage
      for (const symbol of allSymbols) {
        const opportunities = await this.findArbitrageOpportunities(symbol);

        // Broadcast arbitrage alerts to all clients
        for (const opportunity of opportunities) {
          for (const [clientId, clientData] of this.clients.entries()) {
            const { subscription, ws } = clientData;
            if (!subscription.symbols.has(symbol)) continue;

            if (ws && ws.readyState === WebSocket.OPEN) {
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
              });
            }
          }
        }
      }
    } catch (error: any) {
      logger.error('Error checking arbitrage:', error.message);
    }
  }

  /**
   * Find arbitrage opportunities for a symbol
   */
  private async findArbitrageOpportunities(symbol: string): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    try {
      // Get all enabled exchanges
      const exchanges = await ccxtService.getAvailableExchanges();

      // Get prices from all exchanges
      const prices = await ccxtService.getPricesFromMultipleExchanges(symbol, exchanges);

      // Find pairs with spreads > threshold
      const exchangeList = Object.entries(prices)
        .filter(([_, priceData]) => priceData !== null)
        .map(([exchange, priceData]) => ({
          exchange,
          bid: (priceData as any).bid,
          ask: (priceData as any).ask
        }))
        .sort((a, b) => a.ask - b.ask); // Sort by ask price

      // Check each pair
      for (let i = 0; i < exchangeList.length; i++) {
        for (let j = i + 1; j < exchangeList.length; j++) {
          const buyEx = exchangeList[i]; // Lower ask price (good for buying)
          const sellEx = exchangeList[j]; // Higher bid price (good for selling)

          const spreadPct = ((sellEx.bid - buyEx.ask) / buyEx.ask) * 100;

          // Only alert if spread exceeds threshold
          if (spreadPct > this.arbitrageThreshold) {
            // Debounce alerts for same pair
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
                profit: (sellEx.bid - buyEx.ask) * 100, // Profit on 100 coins
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
        if (error) {
          logger.error('Error sending message to client:', error);
        }
      });
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(message: PriceUpdate): void {
    if (!this.wss) return;

    for (const { ws } of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get server statistics
   */
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
      subscription.symbols.forEach(s => uniqueSymbols.add(s));
      subscription.exchanges.forEach(e => uniqueExchanges.add(e));
    }

    return {
      clientCount: this.clients.size,
      totalSubscriptions,
      uniqueSymbols: uniqueSymbols.size,
      uniqueExchanges: uniqueExchanges.size
    };
  }
}

export const priceStreamServer = new PriceStreamServer();
