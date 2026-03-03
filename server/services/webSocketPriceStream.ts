/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WEBSOCKET PRICE STREAM SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Real-time price and portfolio updates via WebSocket:
 * • Subscribe to price streams for assets
 * • Aggregate price data from multiple sources
 * • Emit portfolio balance updates
 * • Trigger rebalancing alerts based on drift
 * • Multi-chain price aggregation
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface PriceUpdate {
  asset: string;
  chain: string;
  price: number;
  priceUsd: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  volumeUsd24h: number;
  marketCap?: number;
  timestamp: number;
  source: 'chainlink' | 'uniswap' | 'coingecko' | 'aggregated';
}

export interface PortfolioUpdate {
  userId: string;
  totalValueUsd: number;
  change24hUsd: number;
  changePercent24h: number;
  byChain: Record<string, number>;
  byAsset: Record<string, { valueUsd: number; weight: number }>;
  lastUpdated: number;
}

export interface RebalancingAlert {
  strategyId: string;
  asset: string;
  targetWeight: number;
  currentWeight: number;
  driftPercent: number;
  driftValueUsd: number;
  alertSeverity: 'info' | 'warning' | 'critical';
  suggestedAction: 'hold' | 'buy' | 'sell';
  timestamp: number;
}

export interface SubscriptionData {
  userId?: string;
  strategyId?: string;
  assets: string[];
  chains?: string[];
  updateFrequency: 'realtime' | 'slow' | 'fast'; // realtime (100ms), fast (1s), slow (5s)
}

// ════════════════════════════════════════════════════════════════════════════════
// WEBSOCKET PRICE STREAM SERVICE
// ════════════════════════════════════════════════════════════════════════════════

class WebSocketPriceStream {
  private io: SocketIOServer | null = null;
  private priceCache: Map<string, PriceUpdate> = new Map();
  private subscriptions: Map<string, SubscriptionData> = new Map();
  private portfolioUpdates: Map<string, PortfolioUpdate> = new Map();
  private priceStreams: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;

  /**
   * Initialize WebSocket server
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('[WebSocket] Initializing price stream service');

    // Register connection handler
    this.io.on('connection', (socket: Socket) => {
      this.handleClientConnection(socket);
    });

    logger.info('[WebSocket] ✅ Socket.IO server initialized');
  }

  /**
   * Handle new client connection
   */
  private handleClientConnection(socket: Socket): void {
    logger.info(`[WebSocket] Client connected: ${socket.id}`);

    // Route message handlers
    socket.on('subscribe:price', (data: SubscriptionData) => this.handlePriceSubscription(socket, data));
    socket.on('subscribe:portfolio', (data: { userId: string; updateFrequency: string }) =>
      this.handlePortfolioSubscription(socket, data)
    );
    socket.on('subscribe:rebalancing', (data: { strategyId: string }) =>
      this.handleRebalancingSubscription(socket, data)
    );
    socket.on('unsubscribe', (data: { subscriptionId: string }) => this.handleUnsubscribe(socket, data));
    socket.on('disconnect', () => this.handleClientDisconnection(socket));
    socket.on('error', (error) => this.handleSocketError(socket, error));

    logger.debug(`[WebSocket] Connection handlers registered for ${socket.id}`);
  }

  /**
   * Handle disconnect
   */
  private handleClientDisconnection(socket: Socket): void {
    logger.info(`[WebSocket] Client disconnected: ${socket.id}`);

    // Clean up subscriptions
    const keys = Array.from(this.subscriptions.keys());
    for (const key of keys) {
      if (key.startsWith(socket.id)) {
        this.subscriptions.delete(key);
      }
    }
  }

  /**
   * Handle socket errors
   */
  private handleSocketError(socket: Socket, error: any): void {
    logger.error(`[WebSocket] Socket error for ${socket.id}:`, error);

    // Attempt reconnection
    const reconnectKey = socket.id;
    const attempts = (this.reconnectAttempts.get(reconnectKey) || 0) + 1;

    if (attempts < this.maxReconnectAttempts) {
      this.reconnectAttempts.set(reconnectKey, attempts);
      socket.emit('reconnect:attempt', { attempt: attempts, maxAttempts: this.maxReconnectAttempts });
      logger.info(`[WebSocket] Reconnection attempt ${attempts} for ${socket.id}`);
    } else {
      logger.error(`[WebSocket] Max reconnection attempts reached for ${socket.id}`);
      socket.disconnect(true);
    }
  }

  /**
   * Handle price subscription
   */
  private handlePriceSubscription(socket: Socket, data: SubscriptionData): void {
    try {
      const subscriptionId = `${socket.id}_price_${Date.now()}`;

      this.subscriptions.set(subscriptionId, {
        ...data,
        chains: data.chains || ['ethereum', 'polygon', 'arbitrum', 'optimism', 'celo'],
      });

      logger.info(
        `[WebSocket] Price subscription created: ${subscriptionId} ` +
          `for ${data.assets.join(', ')} at ${data.updateFrequency} frequency`
      );

      // Start price updates
      this.startPriceStream(subscriptionId, data, socket);

      // Acknowledge subscription
      socket.emit('subscription:created', {
        subscriptionId,
        type: 'price',
        assets: data.assets,
        status: 'active',
      });
    } catch (error) {
      logger.error('[WebSocket] Error handling price subscription:', error);
      socket.emit('subscription:error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Start price stream for subscription
   */
  private startPriceStream(subscriptionId: string, data: SubscriptionData, socket: Socket): void {
    // Determine update interval
    const updateInterval =
      data.updateFrequency === 'fast' ? 1000 : data.updateFrequency === 'realtime' ? 100 : 5000;

    const streamInterval = setInterval(() => {
      try {
        // Generate price updates for subscribed assets
        const updates = data.assets.map((asset) => this.generatePriceUpdate(asset, data.chains || []));

        // Emit to specific socket
        socket.emit('price:update', {
          timestamp: Date.now(),
          updates,
          subscriptionId,
        });

        logger.debug(`[WebSocket] Sent ${updates.length} price updates to ${socket.id}`);
      } catch (error) {
        logger.error(`[WebSocket] Error in price stream for ${subscriptionId}:`, error);
      }
    }, updateInterval);

    this.priceStreams.set(subscriptionId, streamInterval);

    logger.debug(`[WebSocket] Price stream started: ${subscriptionId} (${updateInterval}ms interval)`);
  }

  /**
   * Generate mock price update
   */
  private generatePriceUpdate(asset: string, chains: string[]): PriceUpdate {
    const cacheKey = `${asset}_current`;
    const cached = this.priceCache.get(cacheKey) || {
      price: 1500 + Math.random() * 50000,
      priceUsd: 1500 + Math.random() * 50000,
      change24h: -100 + Math.random() * 200,
      changePercent24h: -5 + Math.random() * 10,
      volume24h: 1000000 + Math.random() * 10000000,
      volumeUsd24h: 1000000 + Math.random() * 10000000,
    };

    // Simulate price drift (random walk)
    const drift = (Math.random() - 0.5) * 10;
    const newPrice = Math.max(cached.price + drift, 100);

    const update: PriceUpdate = {
      asset,
      chain: chains[0] || 'ethereum',
      price: newPrice,
      priceUsd: newPrice,
      change24h: cached.change24h + drift,
      changePercent24h: cached.changePercent24h + (drift / newPrice) * 100,
      volume24h: cached.volume24h,
      volumeUsd24h: cached.volumeUsd24h,
      timestamp: Date.now(),
      source: 'aggregated',
    };

    this.priceCache.set(cacheKey, update);

    return update;
  }

  /**
   * Handle portfolio subscription
   */
  private handlePortfolioSubscription(socket: Socket, data: { userId: string; updateFrequency: string }): void {
    try {
      const subscriptionId = `${socket.id}_portfolio_${data.userId}_${Date.now()}`;

      this.subscriptions.set(subscriptionId, {
        userId: data.userId,
        assets: [],
        updateFrequency: (data.updateFrequency as any) || 'slow',
      });

      logger.info(`[WebSocket] Portfolio subscription created: ${subscriptionId} for user ${data.userId}`);

      // Start portfolio updates
      const updateInterval = data.updateFrequency === 'fast' ? 2000 : 5000;

      const portfolioInterval = setInterval(() => {
        try {
          const update: PortfolioUpdate = {
            userId: data.userId,
            totalValueUsd: 10000 + Math.random() * 50000,
            change24hUsd: -500 + Math.random() * 1000,
            changePercent24h: -2 + Math.random() * 4,
            byChain: {
              ethereum: 3000 + Math.random() * 10000,
              polygon: 2000 + Math.random() * 8000,
              arbitrum: 1500 + Math.random() * 6000,
              optimism: 1000 + Math.random() * 4000,
              celo: 500 + Math.random() * 2000,
            },
            byAsset: {
              ETH: { valueUsd: 5000 + Math.random() * 8000, weight: 0.5 },
              USDC: { valueUsd: 3000 + Math.random() * 5000, weight: 0.3 },
              BTC: { valueUsd: 2000 + Math.random() * 3000, weight: 0.2 },
            },
            lastUpdated: Date.now(),
          };

          this.portfolioUpdates.set(data.userId, update);

          socket.emit('portfolio:update', {
            ...update,
            subscriptionId,
          });

          logger.debug(`[WebSocket] Sent portfolio update to ${socket.id}`);
        } catch (error) {
          logger.error(`[WebSocket] Error in portfolio stream:`, error);
        }
      }, updateInterval);

      this.priceStreams.set(subscriptionId, portfolioInterval);

      socket.emit('subscription:created', {
        subscriptionId,
        type: 'portfolio',
        userId: data.userId,
        status: 'active',
      });
    } catch (error) {
      logger.error('[WebSocket] Error handling portfolio subscription:', error);
      socket.emit('subscription:error', { error: 'Portfolio subscription failed' });
    }
  }

  /**
   * Handle rebalancing alerts subscription
   */
  private handleRebalancingSubscription(socket: Socket, data: { strategyId: string }): void {
    try {
      const subscriptionId = `${socket.id}_rebalance_${data.strategyId}_${Date.now()}`;

      this.subscriptions.set(subscriptionId, {
        strategyId: data.strategyId,
        assets: [],
        updateFrequency: 'slow',
      });

      logger.info(`[WebSocket] Rebalancing subscription created: ${subscriptionId} for strategy ${data.strategyId}`);

      // Simulate rebalancing alerts
      const alertInterval = setInterval(() => {
        if (Math.random() > 0.7) {
          const assets = ['ETH', 'USDC', 'BTC'];
          const driftPercent = 2 + Math.random() * 8;

          const alert: RebalancingAlert = {
            strategyId: data.strategyId,
            asset: assets[Math.floor(Math.random() * assets.length)],
            targetWeight: 0.3 + Math.random() * 0.4,
            currentWeight: 0.3 + Math.random() * 0.4,
            driftPercent,
            driftValueUsd: 500 + Math.random() * 2000,
            alertSeverity: driftPercent > 5 ? 'critical' : 'warning',
            suggestedAction: Math.random() > 0.5 ? 'buy' : 'sell',
            timestamp: Date.now(),
          };

          socket.emit('rebalancing:alert', {
            ...alert,
            subscriptionId,
          });

          logger.info(
            `[WebSocket] Rebalancing alert: ${alert.asset} ` +
              `drift ${alert.driftPercent.toFixed(2)}% - ${alert.suggestedAction}`
          );
        }
      }, 10000); // Check every 10 seconds

      this.priceStreams.set(subscriptionId, alertInterval);

      socket.emit('subscription:created', {
        subscriptionId,
        type: 'rebalancing',
        strategyId: data.strategyId,
        status: 'active',
      });
    } catch (error) {
      logger.error('[WebSocket] Error handling rebalancing subscription:', error);
      socket.emit('subscription:error', { error: 'Rebalancing subscription failed' });
    }
  }

  /**
   * Handle unsubscribe
   */
  private handleUnsubscribe(socket: Socket, data: { subscriptionId: string }): void {
    try {
      const stream = this.priceStreams.get(data.subscriptionId);
      if (stream) {
        clearInterval(stream);
        this.priceStreams.delete(data.subscriptionId);
      }

      this.subscriptions.delete(data.subscriptionId);

      socket.emit('subscription:cancelled', {
        subscriptionId: data.subscriptionId,
        status: 'inactive',
      });

      logger.info(`[WebSocket] Unsubscribed: ${data.subscriptionId}`);
    } catch (error) {
      logger.error('[WebSocket] Error handling unsubscribe:', error);
    }
  }

  /**
   * Broadcast price update to all connected clients
   */
  broadcastPriceUpdate(update: PriceUpdate): void {
    if (!this.io) {
      logger.warn('[WebSocket] Socket.IO not initialized');
      return;
    }

    this.priceCache.set(`${update.asset}_broadcast`, update);

    // Broadcast to all clients subscribed to this asset
    this.io.emit('price:broadcast', {
      ...update,
      timestamp: Date.now(),
    });

    logger.debug(`[WebSocket] Broadcasted price update: ${update.asset} @ ${update.priceUsd.toFixed(2)} USD`);
  }

  /**
   * Broadcast portfolio update
   */
  broadcastPortfolioUpdate(update: PortfolioUpdate): void {
    if (!this.io) {
      logger.warn('[WebSocket] Socket.IO not initialized');
      return;
    }

    this.io.to(`user_${update.userId}`).emit('portfolio:broadcast', {
      ...update,
      timestamp: Date.now(),
    });

    logger.debug(`[WebSocket] Broadcasted portfolio update for user ${update.userId}`);
  }

  /**
   * Emit rebalancing alert
   */
  emitRebalancingAlert(strategyId: string, alert: RebalancingAlert): void {
    if (!this.io) {
      logger.warn('[WebSocket] Socket.IO not initialized');
      return;
    }

    this.io.emit('rebalancing:broadcast', {
      ...alert,
      timestamp: Date.now(),
    });

    logger.info(`[WebSocket] Emitted rebalancing alert for strategy ${strategyId}`);
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(): { subscriptionId: string; data: SubscriptionData }[] {
    return Array.from(this.subscriptions.entries()).map(([subscriptionId, data]) => ({
      subscriptionId,
      data,
    }));
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    logger.info('[WebSocket] Cleaning up price streams...');

    for (const [id, stream] of this.priceStreams.entries()) {
      clearInterval(stream);
      logger.debug(`[WebSocket] Cleared stream: ${id}`);
    }

    this.priceStreams.clear();
    this.subscriptions.clear();
    this.priceCache.clear();

    logger.info('[WebSocket] ✅ Cleanup completed');
  }
}

export const webSocketPriceStream = new WebSocketPriceStream();
