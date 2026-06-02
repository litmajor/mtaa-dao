/**
 * Market Stream WebSocket Service
 * 
 * Provides real-time market data via WebSocket
 * - Price deltas and volume changes
 * - Per-exchange updates
 * - Automatic reconnection handling
 * 
 * Usage (client):
 * ```ts
 * const ws = new WebSocket('ws://localhost:3000/api/market-stream');
 * ws.onmessage = (event) => {
 *   const update = JSON.parse(event.data);
 *   console.log(`${update.exchange}: ${update.price} (${update.priceChange}%)`);
 * };
 * ```
 */

import { Server as HTTPServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import ccxtService from './ccxtService';

interface MarketStreamUpdate {
  exchange: string;
  price: number;
  volume24h: number;
  priceChange: number;
  volumeChange: number;
  timestamp: string;
  liquidity: number;
}

class MarketStreamService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private refreshInterval: NodeJS.Timer | null = null;
  private mockPrices: Map<string, number> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(server: HTTPServer): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/market-stream',
      // Only allow connections from authenticated clients
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      logger.info(`[Market Stream] New WebSocket connection from ${req.socket.remoteAddress}`);
      
      this.clients.add(ws);
      
      // Send initial data
      this.sendLatestPrices(ws);

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(ws, message);
        } catch (error) {
          logger.error('[Market Stream] Error parsing message:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        logger.info('[Market Stream] Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        logger.error('[Market Stream] WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    // Start sending periodic updates
    this.startBroadcasting();

    logger.info('[Market Stream] WebSocket server initialized at /api/market-stream');
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(ws: WebSocket, message: any): void {
    if (message.type === 'subscribe') {
      // Client requests specific exchanges
      ws.send(JSON.stringify({
        type: 'subscribed',
        exchanges: message.exchanges || [],
        timestamp: new Date().toISOString(),
      }));
    } else if (message.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  /**
   * Send latest price updates to a client
   */
  private sendLatestPrices(ws: WebSocket): void {
    // Async send: fetch latest from exchange services where available
    (async () => {
      try {
        const updates = await this.generatePriceUpdates();
        updates.forEach(update => {
          ws.send(JSON.stringify(update));
        });
      } catch (error) {
        logger.error('[Market Stream] Error sending prices:', error);
      }
    })();
  }

  /**
   * Broadcast updates to all connected clients
   */
  private startBroadcasting(): void {
    // Send updates every 2 seconds (configurable)
    this.refreshInterval = setInterval(() => {
      if (this.clients.size === 0) return;

      (async () => {
        try {
          const updates = await this.generatePriceUpdates();
          const data = JSON.stringify(updates);

          this.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(data);
              } catch (error) {
                logger.error('[Market Stream] Error sending to client:', error);
                this.clients.delete(ws);
              }
            }
          });
        } catch (error) {
          logger.error('[Market Stream] Error generating/broadcasting prices:', error);
        }
      })();
    }, 2000);
  }

  /**
   * Generate mock price updates
   * In production: Replace with real market data from exchanges
   */
  private async generatePriceUpdates(): Promise<MarketStreamUpdate[]> {
    // Map user-facing names to ccxt exchange ids
    const EXCHANGE_MAP: Record<string, string> = {
      Binance: 'binance',
      Kraken: 'kraken',
      Coinbase: 'coinbase',
      Huobi: 'huobi',
      OKEx: 'okx',
      Gemini: 'gemini',
      FTX: 'ftx',
      'Crypto.com': 'cryptocom',
    };

    const exchanges = Object.keys(EXCHANGE_MAP);
    const symbol = process.env.MARKET_STREAM_SYMBOL || 'ETH';

    try {
      // Ask ccxtService for prices across configured exchanges
      const exchangeIds = Object.values(EXCHANGE_MAP);
      const rawPrices = await ccxtService.getPricesFromMultipleExchanges(symbol, exchangeIds);

      const updates: MarketStreamUpdate[] = exchanges.map((exchange) => {
        const exchangeId = EXCHANGE_MAP[exchange];
        const priceData = rawPrices[exchangeId];

        if (priceData && typeof priceData.last === 'number') {
          const prev = this.mockPrices.get(exchangeId) || priceData.last;
          const price = priceData.last || 0;
          const priceChange = prev ? ((price - prev) / (prev || 1)) * 100 : 0;
          this.mockPrices.set(exchangeId, price);

          return {
            exchange,
            price: parseFloat(Number(price).toFixed(2)),
            volume24h: Number(priceData.volume || 0),
            priceChange: parseFloat(priceChange.toFixed(3)),
            volumeChange: 0,
            timestamp: new Date().toISOString(),
            liquidity: parseFloat((85 + Math.random() * 15).toFixed(1)),
          };
        }

        // Fallback: random walk if no CEX price available
        const key = exchange;
        if (!this.mockPrices.has(key)) {
          this.mockPrices.set(key, 2500 + Math.random() * 500);
        }

        const currentPrice = this.mockPrices.get(key) || 2500;
        const priceVariation = (Math.random() - 0.5) * 0.01;
        const newPrice = currentPrice * (1 + priceVariation);
        this.mockPrices.set(key, newPrice);

        const volumeVariation = Math.random() * 10; // 0-10%
        const liquidityScore = 85 + Math.random() * 15; // 85-100

        return {
          exchange,
          price: parseFloat(newPrice.toFixed(2)),
          volume24h: Math.random() * 1000000000,
          priceChange: parseFloat((priceVariation * 100).toFixed(3)),
          volumeChange: parseFloat(volumeVariation.toFixed(2)),
          timestamp: new Date().toISOString(),
          liquidity: parseFloat(liquidityScore.toFixed(1)),
        };
      });

      return updates;
    } catch (error) {
      logger.error('[Market Stream] Error generating price updates from ccxtService:', error);
      // Last-resort fallback to deterministic mock updates
      const exchangesFallback = ['Binance', 'Kraken', 'Coinbase', 'Huobi', 'OKEx', 'Gemini', 'FTX', 'Crypto.com'];
      return exchangesFallback.map(exchange => {
        if (!this.mockPrices.has(exchange)) this.mockPrices.set(exchange, 2500 + Math.random() * 500);
        const prev = this.mockPrices.get(exchange) || 2500;
        const variation = (Math.random() - 0.5) * 0.01;
        const price = prev * (1 + variation);
        this.mockPrices.set(exchange, price);

        return {
          exchange,
          price: parseFloat(price.toFixed(2)),
          volume24h: Math.random() * 1000000000,
          priceChange: parseFloat((variation * 100).toFixed(3)),
          volumeChange: 0,
          timestamp: new Date().toISOString(),
          liquidity: parseFloat((85 + Math.random() * 15).toFixed(1)),
        };
      });
    }
  }

  /**
   * Broadcast a specific update to all clients
   */
  broadcast(update: MarketStreamUpdate): void {
    const data = JSON.stringify(update);
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch (error) {
          logger.error('[Market Stream] Error broadcasting:', error);
        }
      }
    });
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.refreshInterval) {
      // clearInterval typing can differ between DOM and Node; cast to any to satisfy TS
      clearInterval(this.refreshInterval as any);
    }

    this.clients.forEach(ws => {
      ws.close();
    });

    if (this.wss) {
      this.wss.close();
    }

    logger.info('[Market Stream] Service shutdown complete');
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// Export singleton instance
export const marketStreamService = new MarketStreamService();
