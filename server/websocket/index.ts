/**
 * Gateway WebSocket Module Exports
 */

export {
  GatewayWebSocketServer,
  type GatewaySubscription,
} from "./gateway-websocket";

export {
  default as WebSocketEventService,
  type ConfigChangeEvent,
  type ActivityEvent,
  type AlertEvent,
  type PresenceEvent,
  type SearchResultEvent,
  type AnalyticsUpdateEvent,
} from "./gateway-websocket-integration";
