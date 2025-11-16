/**
 * Gateway WebSocket Module Exports
 */

export {
  GatewayWebSocketServer,
  attachGatewayWebSocketHandlers,
  createGatewayWebSocketServer,
  type GatewaySubscription,
} from "./gateway-websocket";

export {
  setupGatewayWebSocket,
  getWebSocketStats,
  type WebSocketIntegrationConfig,
} from "./gateway-websocket-integration";

export default setupGatewayWebSocket;
