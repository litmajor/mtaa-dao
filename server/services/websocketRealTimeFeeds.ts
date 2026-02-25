import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { cacheService } from './cacheService';
import { ccxtService } from './ccxtService';
import { volatilityMetricsService } from './volatilityMetricsService';
import { marketAnalyticsService } from './marketAnalyticsService';
import { logger } from '../utils/logger';

// Real-time feed types
interface RealTimeUpdate {
  type: 'volatility' | 'price' | 'depth' | 'trade' | 'health' | 'slippage' | 'alert';
  symbol: string;
  timestamp: number;
  data: any;
  severity?: 'info' | 'warning' | 'alert' | 'critical';
}

interface PriceUpdate {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume24h: number;
  change24h: number;
  timestamp: number;
}

interface DepthUpdate {
  symbol: string;
  bids: Array<[number, number]>; // [price, size]
  asks: Array<[number, number]>;
  timestamp: number;
  sequence: number;
}

interface TradeUpdate {
  symbol: string;
  id: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

interface VolatilityUpdate {
  symbol: string;
  currentVolatility: number;
  volatilityTrend: 'increasing' | 'stable' | 'decreasing';
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  volatilityIndex: number;
  timestamp: number;
}

interface HealthUpdate {
  symbol: string;
  healthScore: number;
  assessment: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  recommendation: string;
  timestamp: number;
}

interface ExecutionAlert {
  orderId: string;
  symbol: string;
  type: 'order_placed' | 'partial_fill' | 'completed' | 'abandoned' | 'slippage_deviation';
  details: string;
  severity: 'info' | 'warning' | 'alert' | 'critical';
  timestamp: number;
}

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  filters: {
    minVolatility?: number;
    maxVolatility?: number;
    healthScoreThreshold?: number;
    alertSeverity?: string[];
  };
}

/**
 * WebSocket Real-Time Feeds Service
 * Streams live market data, volatility updates, health scores, and execution alerts
 */
class WebSocketRealTimeFeeds extends EventEmitter {
  private clients: Map<string, WebSocketClient> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();
  private priceUpdateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private volatilityUpdateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private healthUpdateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private static instance: WebSocketRealTimeFeeds;

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
   * Add new WebSocket client and set up subscriptions
   */
  addClient(clientId: string, ws: WebSocket): void {
    const client: WebSocketClient = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      filters: {}
    };

    this.clients.set(clientId, client);
    logger.info(`WebSocket client connected: ${clientId}`);

    // Handle incoming messages
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        this.handleClientMessage(clientId, data);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { clientId, error });
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.removeClient(clientId);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error });
    });
  }

  /**
   * Handle incoming client messages
   */
  private handleClientMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { action, payload } = data;

    switch (action) {
      case 'subscribe':
        this.subscribeClient(clientId, payload);
        break;
      case 'unsubscribe':
        this.unsubscribeClient(clientId, payload);
        break;
      case 'filter':
        this.setClientFilters(clientId, payload);
        break;
      default:
        client.ws.send(JSON.stringify({ type: 'error', message: 'Unknown action' }));
    }
  }

  /**
   * Subscribe client to real-time updates
   */
  private subscribeClient(clientId: string, payload: { feed: string; symbols?: string[] }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { feed, symbols = [] } = payload;
    const feedKey = symbols.length > 0 ? `${feed}:${symbols.join(',')}` : feed;

    client.subscriptions.add(feedKey);

    if (!this.subscriptions.has(feedKey)) {
      this.subscriptions.set(feedKey, new Set());
    }
    this.subscriptions.get(feedKey)!.add(clientId);

    // Start update streams if not already running
    if (symbols.length > 0) {
      symbols.forEach(symbol => {
        this.startUpdateStreams(feed, symbol);
      });
    }

    client.ws.send(
      JSON.stringify({
        type: 'subscription_confirmed',
        feed,
        symbols
      })
    );

    logger.info(`Client subscribed to feed: ${feed}`, { clientId, symbols });
  }

  /**
   * Unsubscribe client from updates
   */
  private unsubscribeClient(clientId: string, payload: { feed: string; symbols?: string[] }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { feed, symbols = [] } = payload;
    const feedKey = symbols.length > 0 ? `${feed}:${symbols.join(',')}` : feed;

    client.subscriptions.delete(feedKey);

    const feedSubscribers = this.subscriptions.get(feedKey);
    if (feedSubscribers) {
      feedSubscribers.delete(clientId);

      // Stop updates if no subscribers left
      if (feedSubscribers.size === 0) {
        symbols.forEach(symbol => {
          this.stopUpdateStreams(feed, symbol);
        });
      }
    }
  }

  /**
   * Set client filters for selective updates
   */
  private setClientFilters(clientId: string, filters: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.filters = {
      minVolatility: filters.minVolatility,
      maxVolatility: filters.maxVolatility,
      healthScoreThreshold: filters.healthScoreThreshold || 0,
      alertSeverity: filters.alertSeverity || ['warning', 'alert', 'critical']
    };

    client.ws.send(JSON.stringify({ type: 'filters_updated', filters: client.filters }));
  }

  /**
   * Remove client and clean up
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.forEach(subscription => {
      const feedSubscribers = this.subscriptions.get(subscription);
      if (feedSubscribers) {
        feedSubscribers.delete(clientId);
      }
    });

    this.clients.delete(clientId);
    logger.info(`WebSocket client disconnected: ${clientId}`);
  }

  /**
   * Publish real-time update to subscribers
   */
  broadcastUpdate(update: RealTimeUpdate): void {
    const feedKey = `${update.type}:${update.symbol}`;
    const subscribers = this.subscriptions.get(feedKey);

    if (!subscribers) return;

    subscribers.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (!client) return;

      // Apply client filters
      if (!this.passesFilters(client, update)) return;

      try {
        client.ws.send(JSON.stringify(update));
      } catch (error) {
        logger.error('Failed to send WebSocket update', { clientId, error });
      }
    });
  }

  /**
   * Check if update passes client filters
   */
  private passesFilters(client: WebSocketClient, update: RealTimeUpdate): boolean {
    if (update.type === 'volatility') {
      const vol = update.data.currentVolatility;
      if (client.filters.minVolatility && vol < client.filters.minVolatility) return false;
      if (client.filters.maxVolatility && vol > client.filters.maxVolatility) return false;
    }

    if (update.type === 'health') {
      const score = update.data.healthScore;
      if (client.filters.healthScoreThreshold && score < client.filters.healthScoreThreshold) {
        return false;
      }
    }

    if (update.severity && client.filters.alertSeverity) {
      if (!client.filters.alertSeverity.includes(update.severity)) return false;
    }

    return true;
  }

  /**
   * Start update streams for symbol
   */
  private startUpdateStreams(feed: string, symbol: string): void {
    if (feed === 'price') {
      this.startPriceStream(symbol);
    } else if (feed === 'volatility') {
      this.startVolatilityStream(symbol);
    } else if (feed === 'health') {
      this.startHealthStream(symbol);
    }
  }

  /**
   * Stop update streams for symbol
   */
  private stopUpdateStreams(feed: string, symbol: string): void {
    if (feed === 'price') {
      clearInterval(this.priceUpdateIntervals.get(symbol));
      this.priceUpdateIntervals.delete(symbol);
    } else if (feed === 'volatility') {
      clearInterval(this.volatilityUpdateIntervals.get(symbol));
      this.volatilityUpdateIntervals.delete(symbol);
    } else if (feed === 'health') {
      clearInterval(this.healthUpdateIntervals.get(symbol));
      this.healthUpdateIntervals.delete(symbol);
    }
  }

  /**
   * Start price update stream (every 1 second)
   */
  private startPriceStream(symbol: string): void {
    if (this.priceUpdateIntervals.has(symbol)) return;

    const interval = setInterval(async () => {
      try {
        const ticker = await ccxtService.fetchTicker(symbol, 'binance');
        const update: RealTimeUpdate = {
          type: 'price',
          symbol,
          timestamp: Date.now(),
          data: {
            price: ticker.last,
            bid: ticker.bid,
            ask: ticker.ask,
            volume24h: ticker.quoteVolume,
            change24h: ticker.percentage
          }
        };
        this.broadcastUpdate(update);
      } catch (error) {
        logger.error('Failed to fetch price', { symbol, error });
      }
    }, 1000);

    this.priceUpdateIntervals.set(symbol, interval);
  }

  /**
   * Start volatility update stream (every 5 seconds)
   */
  private startVolatilityStream(symbol: string): void {
    if (this.volatilityUpdateIntervals.has(symbol)) return;

    const interval = setInterval(async () => {
      try {
        const volatility = await volatilityMetricsService.calculateVolatility(symbol, '1h');
        const update: RealTimeUpdate = {
          type: 'volatility',
          symbol,
          timestamp: Date.now(),
          data: {
            currentVolatility: volatility.volatility,
            volatilityTrend: volatility.volatilityTrend,
            riskLevel: volatility.riskLevel,
            volatilityIndex: volatility.volatilityIndex
          }
        };
        this.broadcastUpdate(update);
      } catch (error) {
        logger.error('Failed to fetch volatility', { symbol, error });
      }
    }, 5000);

    this.volatilityUpdateIntervals.set(symbol, interval);
  }

  /**
   * Start market health update stream (every 10 seconds)
   */
  private startHealthStream(symbol: string): void {
    if (this.healthUpdateIntervals.has(symbol)) return;

    const interval = setInterval(async () => {
      try {
        const [volatility, spreads, depth, liquidity] = await Promise.all([
          volatilityMetricsService.calculateVolatility(symbol, '24h'),
          marketAnalyticsService.analyzeSpreadTrends(symbol, 'binance'),
          marketAnalyticsService.analyzeDepthTrends(symbol, 'binance'),
          marketAnalyticsService.analyzeLiquidityTrends(symbol, 'binance')
        ]);

        const healthScore = Math.round(
          (volatility.volatilityIndex * 0.3 +
            liquidity.liquidityScore * 0.3 +
            (100 - spreads.currentSpread * 1000) * 0.2 +
            depth.liquidityHealth * 0.2) * 0.75 // Normalize to 0-100
        );

        const assessment =
          healthScore >= 75
            ? 'Excellent'
            : healthScore >= 50
            ? 'Good'
            : healthScore >= 25
            ? 'Fair'
            : 'Poor';

        const update: RealTimeUpdate = {
          type: 'health',
          symbol,
          timestamp: Date.now(),
          data: {
            healthScore,
            assessment,
            recommendation:
              healthScore >= 75
                ? '✅ OPTIMAL CONDITIONS - Safe for large orders'
                : healthScore < 25
                ? '⚠️ POOR CONDITIONS - Use limit orders only'
                : 'Use caution with order sizing'
          }
        };
        this.broadcastUpdate(update);
      } catch (error) {
        logger.error('Failed to fetch market health', { symbol, error });
      }
    }, 10000);

    this.healthUpdateIntervals.set(symbol, interval);
  }

  /**
   * Broadcast execution alert to all clients
   */
  broadcastExecutionAlert(alert: ExecutionAlert): void {
    const update: RealTimeUpdate = {
      type: 'alert',
      symbol: alert.symbol,
      timestamp: alert.timestamp,
      severity: alert.severity,
      data: alert
    };

    // Broadcast to all alert subscribers
    const alertSubscribers = this.subscriptions.get('alert');
    if (alertSubscribers) {
      alertSubscribers.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client && this.passesFilters(client, update)) {
          try {
            client.ws.send(JSON.stringify(update));
          } catch (error) {
            logger.error('Failed to send alert', { clientId, error });
          }
        }
      });
    }
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get subscription stats
   */
  getSubscriptionStats(): any {
    return {
      totalClients: this.clients.size,
      totalSubscriptions: this.subscriptions.size,
      subscriptions: Array.from(this.subscriptions.entries()).map(([key, clients]) => ({
        feed: key,
        subscriberCount: clients.size
      }))
    };
  }
}

export const websocketRealtimeFeeds = WebSocketRealTimeFeeds.getInstance();

export type {
  RealTimeUpdate,
  PriceUpdate,
  DepthUpdate,
  TradeUpdate,
  VolatilityUpdate,
  HealthUpdate,
  ExecutionAlert,
  WebSocketClient
};
