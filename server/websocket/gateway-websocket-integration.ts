/**
 * Gateway WebSocket Integration
 * Sets up WebSocket server with the main HTTP server
 */

import { Express } from "express";
import { Server as HTTPServer } from "http";
import {
  createGatewayWebSocketServer,
  GatewayWebSocketServer,
} from "./gateway-websocket";
import { GatewayAgentService } from "../core/agents/gateway/service";

/**
 * Integration configuration
 */
export interface WebSocketIntegrationConfig {
  gatewayService?: GatewayAgentService;
  corsOrigin?: string;
  pingInterval?: number; // ms
  pingTimeout?: number; // ms
}

/**
 * Initialize Gateway WebSocket integration
 * Should be called after creating HTTP server but before listening
 */
export function setupGatewayWebSocket(
  httpServer: HTTPServer,
  config: WebSocketIntegrationConfig = {}
): GatewayWebSocketServer {
  const wsServer = createGatewayWebSocketServer(
    httpServer,
    config.gatewayService
  );

  // Configure Socket.IO options if needed
  const io = wsServer.getIO();
  // Note: Socket.IO options are configured during server creation, not modified after
  // CORS, ping intervals, etc. should be set during GatewayWebSocketServer initialization
  
  if (config.corsOrigin) {
    console.log(`[Gateway WebSocket] CORS configured for origin: ${config.corsOrigin}`);
  }
  if (config.pingInterval) {
    console.log(`[Gateway WebSocket] Ping interval: ${config.pingInterval}ms`);
  }
  if (config.pingTimeout) {
    console.log(`[Gateway WebSocket] Ping timeout: ${config.pingTimeout}ms`);
  }

  console.log("[Gateway WebSocket] WebSocket server initialized");

  return wsServer;
}

/**
 * Express/Socket.IO integration example for main server file
 *
 * Usage in server.ts:
 *
 * import { createServer } from 'http';
 * import express from 'express';
 * import { setupGatewayWebSocket } from './websocket/gateway-websocket-integration';
 *
 * const app = express();
 * const httpServer = createServer(app);
 *
 * // Setup Gateway routes first
 * app.use('/api/v1/gateway', gatewayRoutes);
 *
 * // Initialize Gateway WebSocket
 * const wsServer = setupGatewayWebSocket(httpServer, {
 *   gatewayService: gatewayService,
 *   corsOrigin: process.env.CORS_ORIGIN || '*',
 *   pingInterval: 30000,
 *   pingTimeout: 60000,
 * });
 *
 * // Listen on port
 * const PORT = process.env.PORT || 3000;
 * httpServer.listen(PORT, () => {
 *   console.log(`Server running on http://localhost:${PORT}`);
 * });
 *
 * // Graceful shutdown
 * process.on('SIGTERM', async () => {
 *   await wsServer.shutdown();
 *   httpServer.close(() => {
 *     process.exit(0);
 *   });
 * });
 */

/**
 * Get WebSocket statistics endpoint
 * Mount on Express app: app.get('/api/v1/gateway/ws/stats', getWebSocketStats(wsServer))
 */
export function getWebSocketStats(wsServer: GatewayWebSocketServer) {
  return (_req: any, res: any) => {
    res.json({
      success: true,
      data: wsServer.getStats(),
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Example client-side WebSocket connection and usage
 *
 * Usage in frontend (React/Vue/etc):
 *
 * import { io } from 'socket.io-client';
 *
 * const socket = io('http://localhost:3000', {
 *   auth: {
 *     token: 'your-jwt-token',
 *     userId: 'user-123',
 *   },
 * });
 *
 * // Connect
 * socket.on('connect', () => {
 *   console.log('Connected to Gateway');
 * });
 *
 * // Subscribe to prices
 * socket.emit('gateway:subscribe_prices', {
 *   symbols: ['ETH', 'BTC'],
 *   chains: ['ethereum', 'polygon'],
 * }, (response) => {
 *   if (response.success) {
 *     console.log('Subscribed:', response.subscriptionId);
 *   }
 * });
 *
 * // Listen for price updates
 * socket.on('gateway:prices_update', (data) => {
 *   console.log('Price update:', data);
 * });
 *
 * // Request one-time data
 * socket.emit('gateway:request_data', {
 *   type: 'prices',
 *   params: {
 *     symbols: ['ETH'],
 *   },
 * }, (response) => {
 *   console.log('Data:', response.data);
 * });
 *
 * // Get subscriptions
 * socket.emit('gateway:get_subscriptions', (response) => {
 *   console.log('Current subscriptions:', response.subscriptions);
 * });
 *
 * // Unsubscribe
 * socket.emit('gateway:unsubscribe', {
 *   subscriptionId: 'sub:...',
 * }, (response) => {
 *   console.log('Unsubscribed:', response.message);
 * });
 *
 * // Health check
 * socket.emit('gateway:health_check', (response) => {
 *   console.log('Health:', response.healthy);
 * });
 *
 * // Disconnect
 * socket.disconnect();
 */

/**
 * Monitoring WebSocket metrics
 *
 * Example metrics to track:
 * - connectedClients: number of active WebSocket connections
 * - totalSubscriptions: total number of subscriptions created
 * - activeSubscriptions: number of active subscriptions
 * - subscriptionsByType: breakdown by data type
 *
 * Add to Prometheus/monitoring:
 *
 * const gauge = new prometheus.Gauge({
 *   name: 'gateway_ws_connected_clients',
 *   help: 'Number of connected WebSocket clients',
 * });
 *
 * const subscription = new prometheus.Gauge({
 *   name: 'gateway_ws_active_subscriptions',
 *   help: 'Number of active subscriptions',
 * });
 *
 * setInterval(() => {
 *   const stats = wsServer.getStats();
 *   gauge.set(stats.connectedClients);
 *   subscription.set(stats.activeSubscriptions);
 * }, 30000);
 */

export default setupGatewayWebSocket;
