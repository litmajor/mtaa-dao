/**
 * ═══════════════════════════════════════════════════════════════════════
 * CENTRAL WEBSOCKET EVENT REGISTRY
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Single source of truth for every WebSocket surface in the system:
 *   - Transport (Socket.IO path / raw ws path)
 *   - Room-naming conventions (as typed builder functions, not raw strings)
 *   - Client → Server event names + payload shapes
 *   - Server → Client event names + payload shapes
 *   - Which permission (if any) is required to join / publish to each room
 *
 * WHY THIS FILE EXISTS
 * Four independent WS servers currently exist in the codebase
 * (WebSocketManager/admin, GatewayWebSocketServer, PriceStreamServer,
 * CoordinatorWebSocketHandler). Each defined its own room strings and event
 * names inline, with no shared source of truth. That produced real drift:
 * WebSocketEventService (below) emitted to rooms like `dashboard:updates`
 * and `alerts:critical` that WebSocketManager.hasRoomPermission never
 * actually authorized a client to join. Import from here instead of typing
 * room/event strings by hand, so a typo or a missed permission rule is a
 * type error instead of a silent runtime no-op.
 *
 * IMPORTANT — ACTION REQUIRED ON THE SERVER SIDE:
 * WebSocketManager, GatewayWebSocketServer, and CoordinatorWebSocketHandler
 * each do `new SocketIOServer(httpServer, {...})` with no `path` set. If
 * more than one of these attaches to the same underlying HTTP server, they
 * will collide on Socket.IO's default `/socket.io/` path. Use the
 * `WS_PATHS` constants below as the `path` option on each server's
 * constructor to keep them isolated.
 */

// ─────────────────────────────────────────────────────────────────────────
// Transport: distinct paths per server (fixes potential Socket.IO collision)
// ─────────────────────────────────────────────────────────────────────────

export const WS_PATHS = {
  ADMIN: '/ws/admin',
  GATEWAY: '/ws/gateway',
  COORDINATOR: '/ws/coordinator',
  MORIO: '/ws/morio',
  NOTIFICATIONS: '/ws/notifications', // the raw `io` instance created directly in index.ts
  PRICE_STREAM: '/ws/prices', // raw `ws`, not Socket.IO — already distinct
} as const;

// ═══════════════════════════════════════════════════════════════════════
// 1. ADMIN NAMESPACE — WebSocketManager (websocket.ts)
// ═══════════════════════════════════════════════════════════════════════

export namespace AdminWS {
  /** Permission string required to JOIN a room, or null if no permission gate applies. */
  export type RoomPermission =
    | 'own'                    // only the owning user may join (user:${id})
    | 'view:alerts'
    | 'view:analytics'
    | 'view:configuration'
    | 'view:activity'
    | null;                    // open to any authenticated socket

  /**
   * Room builders. Always construct room names through these functions —
   * never inline a template string — so a rename here propagates everywhere.
   */
  export const Rooms = {
    /** Personal room for direct-to-user pushes. */
    user: (userId: string) => `user:${userId}` as const,
    alerts: () => 'alerts' as const,
    alertsCritical: () => 'alerts:critical' as const,
    alertsForEntity: (entityType: string, entityId: string) => `alerts:${entityType}:${entityId}` as const,
    analytics: () => 'analytics' as const,
    config: (entityType: string, entityId: string) => `config:${entityType}:${entityId}` as const,
    activity: (entityType: string, entityId: string) => `activity:${entityType}:${entityId}` as const,
    activityFeed: () => 'activity:feed' as const,
    presence: (section: string) => `presence:${section}` as const,
    searchResults: () => 'search:results' as const,
    status: (entityType: string, entityId: string) => `status:${entityType}:${entityId}` as const,
    approval: (entityType: string, entityId: string) => `approval:${entityType}:${entityId}` as const,
    scheduledChanges: () => 'scheduled:changes' as const,
    systemUpdates: () => 'system:updates' as const,
    dashboardUpdates: () => 'dashboard:updates' as const,
    dashboardMetrics: () => 'dashboard:metrics' as const,
    dashboardAnalytics: () => 'dashboard:analytics' as const,
  };

  /**
   * Permission required to JOIN each room. This must stay in sync with
   * WebSocketManager.hasRoomPermission — anything listed here with a
   * non-null permission needs a matching `if (room === ... )` branch there.
   *
   * FIX: dashboard/status/approval/scheduled/system/activity-feed rooms
   * were previously used by WebSocketEventService but had NO corresponding
   * rule in hasRoomPermission, so joining them always failed. Treat these
   * as "authenticated, no extra permission" (null) unless you want tighter
   * scoping — but add the rule to hasRoomPermission either way.
   */
  export const ROOM_PERMISSIONS: Record<string, RoomPermission> = {
    [Rooms.alerts()]: 'view:alerts',
    [Rooms.alertsCritical()]: 'view:alerts',
    [Rooms.analytics()]: 'view:analytics',
    [Rooms.searchResults()]: null,
    [Rooms.activityFeed()]: 'view:activity',
    [Rooms.scheduledChanges()]: null,
    [Rooms.systemUpdates()]: null,
    [Rooms.dashboardUpdates()]: null,
    [Rooms.dashboardMetrics()]: null,
    [Rooms.dashboardAnalytics()]: null,
    // config:*, activity:*, status:*, approval:*, alerts:* (per-entity) are
    // prefix-matched (startsWith) in hasRoomPermission, not exact-keyed here.
  };

  /** Client → Server events */
  export const ClientEvents = {
    SUBSCRIBE_ROOM: 'subscribe:room',
    UNSUBSCRIBE_ROOM: 'unsubscribe:room',
    CONFIG_CHANGED: 'config:changed',
    ACTIVITY_LOG: 'activity:log',
    ALERT_TRIGGERED: 'alert:triggered',
    PRESENCE_UPDATE: 'presence:update',
    SEARCH_RESULT: 'search:result',
    ANALYTICS_UPDATED: 'analytics:updated',
  } as const;

  /** Server → Client events */
  export const ServerEvents = {
    ROOM_USER_JOINED: 'room:user-joined',
    ROOM_USER_LEFT: 'room:user-left',
    CONFIG_CHANGED: 'config:changed',
    ACTIVITY_LOGGED: 'activity:logged',
    ALERT_NEW: 'alert:new',
    ALERT_ENTITY: 'alert:entity',
    ALERT_CRITICAL: 'alert:critical',
    PRESENCE_UPDATED: 'presence:updated',
    SEARCH_RESULT_READY: 'search:result-ready',
    ANALYTICS_UPDATED: 'analytics:updated',
    SYSTEM_USER_COUNT: 'system:user-count',
    DASHBOARD_UPDATE: 'dashboard:update',
    METRICS_UPDATED: 'metrics:updated',
    STATUS_CHANGED: 'status:changed',
    APPROVAL_CHANGED: 'approval:changed',
    SCHEDULED_UPDATED: 'scheduled:updated',
    BULK_UPDATE: 'bulk:update',
    SYSTEM_EVENT: 'system:event',
    EXECUTION_LOG: 'execution:log', // pushed from Redis pub/sub, not app code directly
    ERROR_PERMISSION: 'error:permission',
  } as const;

  // ── Payload schemas ──────────────────────────────────────────────────

  export interface ConfigChangeEvent {
    entityType: string;
    entityId: string;
    versionNumber: number;
    changedFields: string[];
    changeReason?: string;
    configuration: Record<string, any>;
  }

  export interface ActivityEvent {
    entityType: string;
    entityId: string;
    action: string;
    details: Record<string, any>;
    severity?: 'info' | 'warning' | 'error';
  }

  export interface AlertEvent {
    entityType: string;
    entityId: string;
    alertType: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
  }

  export interface PresenceEvent {
    userId: string;
    section: string;
    action: 'viewing' | 'editing' | 'searching';
    metadata?: Record<string, any>;
  }

  export interface SearchResultEvent {
    queryId: string;
    totalResults: number;
    resultsCount: number;
    completed: boolean;
    query: string;
    filters?: Record<string, any>;
  }

  export interface AnalyticsUpdateEvent {
    metricType: string;
    entityType?: string;
    entityId?: string;
    metrics: Record<string, any>;
    period?: string;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 2. GATEWAY NAMESPACE — GatewayWebSocketServer (gateway-websocket.ts)
// ═══════════════════════════════════════════════════════════════════════

export namespace GatewayWS {
  /** Gateway has no rooms — delivery is per-subscription, directly to socket.id. */

  export const ClientEvents = {
    SUBSCRIBE_PRICES: 'gateway:subscribe_prices',
    SUBSCRIBE_LIQUIDITY: 'gateway:subscribe_liquidity',
    SUBSCRIBE_APY: 'gateway:subscribe_apy',
    SUBSCRIBE_RISK: 'gateway:subscribe_risk',
    UNSUBSCRIBE: 'gateway:unsubscribe',
    GET_SUBSCRIPTIONS: 'gateway:get_subscriptions',
    REQUEST_DATA: 'gateway:request_data',
    GET_STATUS: 'gateway:get_status',
    HEALTH_CHECK: 'gateway:health_check',
  } as const;

  export const ServerEvents = {
    CONNECTED: 'gateway:connected',
    SUBSCRIBED: 'gateway:subscribed',
    UNSUBSCRIBED: 'gateway:unsubscribed',
    PRICES_UPDATE: 'gateway:prices_update',
    LIQUIDITY_UPDATE: 'gateway:liquidity_update',
    APY_UPDATE: 'gateway:apy_update',
    RISK_UPDATE: 'gateway:risk_update',
    ERROR: 'gateway:error',
  } as const;

  export type SubscriptionType = 'prices' | 'liquidity' | 'apy' | 'risk';

  // ── Payload schemas ──────────────────────────────────────────────────

  export interface SubscribePricesParams {
    symbols: string[];
    chains?: string[];
    source?: string;
  }

  export interface SubscribeLiquidityParams {
    protocols: string[];
    pools?: string[];
    chain?: string;
  }

  export interface SubscribeApyParams {
    protocols: string[];
    assets?: string[];
    chain?: string;
  }

  export interface SubscribeRiskParams {
    protocols: string[];
  }

  export interface UnsubscribeParams {
    subscriptionId: string;
  }

  export interface SubscribeAck {
    success: boolean;
    subscriptionId?: string;
    type?: SubscriptionType;
    message?: string;
    error?: string;
  }

  export interface DataUpdate<T = any> {
    subscriptionId: string;
    type: SubscriptionType;
    data: T;
    timestamp: string;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 3. PRICE STREAM — PriceStreamServer (raw `ws`, not Socket.IO)
// ═══════════════════════════════════════════════════════════════════════

export namespace PriceStreamWS {
  /** No named "events" — a single JSON message shape discriminated by `action` / `type`. */

  export const ClientActions = {
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
  } as const;

  export const ServerMessageTypes = {
    PRICE: 'price',
    ORDER: 'order',
    ARBITRAGE: 'arbitrage',
    SUBSCRIBED: 'subscribed',
    UNSUBSCRIBED: 'unsubscribed',
    ERROR: 'error',
  } as const;

  // ── Payload schemas ──────────────────────────────────────────────────

  export interface ClientMessage {
    action: 'subscribe' | 'unsubscribe';
    symbols?: string[];
    exchanges?: string[];
  }

  export interface PriceUpdateMessage {
    type: 'price';
    symbol: string;
    exchange: string;
    bid: number;
    ask: number;
    timestamp: number;
  }

  export interface ArbitrageMessage {
    type: 'arbitrage';
    symbol: string;
    buyExchange: string;
    sellExchange: string;
    buyPrice: number;
    sellPrice: number;
    spreadPct: number;
    profit: number;
    timestamp: number;
  }

  export interface SubscribedMessage {
    type: 'subscribed' | 'unsubscribed';
    symbols: string[];
    exchanges: string[];
    message: string;
  }

  export interface ErrorMessage {
    type: 'error';
    message: string;
  }

  /** Connection requires `?token=<jwt>` on the upgrade URL. */
  export const AUTH_QUERY_PARAM = 'token';
}

// ═══════════════════════════════════════════════════════════════════════
// 4. COORDINATOR NAMESPACE — CoordinatorWebSocketHandler
// ═══════════════════════════════════════════════════════════════════════

export namespace CoordinatorWS {
  /**
   * SECURITY NOTE: `handleSubscribe` currently joins `coordinator:${topic}`
   * for ANY client-supplied topic string with no permission check, and
   * `coordinator:consensus` broadcasts fire globally across all DAOs. The
   * room builders below scope consensus/kaizen/lumen topics by daoId —
   * the handler needs to be updated to (a) only allow subscribing to a
   * fixed enum of topics (below), and (b) require daoId membership for any
   * DAO-scoped topic, mirroring the check already done in
   * handleConsensusRequest. Until that lands, treat this namespace's
   * consensus/kaizen/lumen streams as NOT tenant-isolated.
   */
  export const Topics = {
    CONSENSUS: 'consensus',
    SCRY_ALERT: 'scry-alert',
    KAIZEN_RECOMMENDATION: 'kaizen-recommendation',
    LUMEN_REVIEW: 'lumen-review',
    MESSAGE_BUS_PUBLISHED: 'message-bus:message-published',
    MESSAGE_BUS_ERROR: 'message-bus:error',
  } as const;
  export type Topic = (typeof Topics)[keyof typeof Topics];

  /** Global (non-DAO-scoped) topics — safe for any authenticated user. */
  export const GLOBAL_TOPICS: Topic[] = [Topics.MESSAGE_BUS_ERROR];

  /** DAO-scoped topics — subscribing requires membership in the given daoId. */
  export const DAO_SCOPED_TOPICS: Topic[] = [
    Topics.CONSENSUS,
    Topics.SCRY_ALERT,
    Topics.KAIZEN_RECOMMENDATION,
    Topics.LUMEN_REVIEW,
    Topics.MESSAGE_BUS_PUBLISHED,
  ];

  export const Rooms = {
    /** Legacy flat room — used today, NOT tenant-scoped. Prefer forDao() once the handler supports it. */
    topic: (topic: Topic) => `coordinator:${topic}` as const,
    /** Target shape once daoId scoping is added to the handler. */
    forDao: (topic: Topic, daoId: string) => `coordinator:${topic}:${daoId}` as const,
  };

  export const ClientEvents = {
    SUBSCRIBE: 'coordinator:subscribe',
    UNSUBSCRIBE: 'coordinator:unsubscribe',
    REQUEST_CONSENSUS: 'coordinator:request-consensus',
    PING: 'coordinator:ping',
  } as const;

  export const ServerEvents = {
    CONNECTED: 'coordinator:connected',
    STATUS: 'coordinator:status',
    SUBSCRIBED: 'coordinator:subscribed',
    UNSUBSCRIBED: 'coordinator:unsubscribed',
    CONSENSUS_RESPONSE: 'coordinator:consensus-response',
    ERROR: 'coordinator:error',
    PONG: 'coordinator:pong',
    // Broadcast events — the event name IS the topic name (see broadcastToSubscribers)
    CONSENSUS: 'coordinator:consensus',
    SCRY_ALERT: 'coordinator:scry-alert',
    KAIZEN_RECOMMENDATION: 'coordinator:kaizen-recommendation',
    LUMEN_REVIEW: 'coordinator:lumen-review',
    MESSAGE_PUBLISHED: 'message-bus:message-published',
    MESSAGE_ERROR: 'message-bus:error',
  } as const;

  // ── Payload schemas ──────────────────────────────────────────────────

  export interface SubscribeParams {
    topic: Topic;
  }

  export interface RequestConsensusParams {
    daoId: string;
    proposalId: string;
  }

  export interface ConsensusResponse {
    success: boolean;
    data?: unknown; // shape owned by elderCoordinator.getElderConsensus — type there, not here
    timestamp: Date;
  }

  export interface CoordinatorErrorPayload {
    error: string;
    timestamp: Date;
  }

  export interface BroadcastEnvelope<T = unknown> {
    topic: string;
    data: T;
    timestamp: Date;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 5. MORIO NAMESPACE — MorioWebSocketServer (morio-websocket.ts)
// ═══════════════════════════════════════════════════════════════════════

export namespace MorioWS {
  /**
   * SECURITY NOTE: subscribe:dashboard / subscribe:alerts previously joined
   * `dashboard:${daoId}` / `alerts:${daoId}` for ANY client-supplied daoId
   * with no membership check — any authenticated user could subscribe to
   * another DAO's private dashboard/alert stream. The handler must verify
   * `user.daos.includes(daoId) || user.isSuperuser` before calling
   * socket.join(), exactly like CoordinatorWS's DAO-scoped topics.
   */
  export const Sections = {
    DASHBOARD: 'dashboard',
    ALERTS: 'alerts',
    PERFORMANCE: 'performance',
  } as const;

  export const Rooms = {
    dashboard: (daoId: string = 'global') => `dashboard:${daoId}` as const,
    alerts: (daoId: string = 'global') => `alerts:${daoId}` as const,
    performanceGlobal: () => 'performance:global' as const,
    section: (section: string, daoId: string = 'global') => `section:${section}:${daoId}` as const,
  };

  /** DAO ids that don't require a membership check — "global" aggregate views. */
  export const GLOBAL_SCOPE = 'global';

  export const ClientEvents = {
    SUBSCRIBE_DASHBOARD: 'subscribe:dashboard',
    SUBSCRIBE_ALERTS: 'subscribe:alerts',
    SUBSCRIBE_PERFORMANCE: 'subscribe:performance',
    SUBSCRIBE_SECTION: 'subscribe:section',
    UNSUBSCRIBE_DASHBOARD: 'unsubscribe:dashboard',
    UNSUBSCRIBE_ALERTS: 'unsubscribe:alerts',
  } as const;

  export const ServerEvents = {
    SYSTEM_STATUS: 'data:system-status',
    ALERTS: 'data:alerts',
    PERFORMANCE: 'data:performance',
    DASHBOARD_UPDATE_PREFIX: 'update:', // actual event is `update:${section}`
    NEW_ALERT: 'new:alert',
    ERROR: 'error:permission',
  } as const;
}

// ═══════════════════════════════════════════════════════════════════════
// 6. NOTIFICATIONS NAMESPACE — raw `io` instance created directly in index.ts
// ═══════════════════════════════════════════════════════════════════════

export namespace NotificationsWS {
  /**
   * SECURITY NOTE: this socket previously exposed a client-emitted
   * `authenticate` event that let ANY connected socket claim an arbitrary
   * userId with no verification, joining that user's notification room.
   * The fix removes that event entirely — identity comes only from the
   * JWT verified in io.use() middleware at connection time. If a socket
   * reconnects with a new token, a fresh connection (and fresh middleware
   * run) is required; there is no legitimate reason for a client to
   * "re-identify" itself mid-connection.
   */
  export const Rooms = {
    // FIX: aligned with AdminWS.Rooms.user()'s `user:${id}` convention
    // instead of the previously separate `user_${id}` (underscore) scheme,
    // so the same room-naming pattern is used everywhere in the codebase.
    user: (userId: string) => `user:${userId}` as const,
  };

  export const ServerEvents = {
    NEW_NOTIFICATION: 'new_notification',
  } as const;

  export interface NotificationPayload {
    userId: string;
    [key: string]: any;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 7. OPPORTUNITY STREAM — raw `ws`, path /api/opportunities-stream
// ═══════════════════════════════════════════════════════════════════════

export namespace OpportunityWS {
  export const OpportunityTypes = ['arbitrage', 'dex-spread', 'emerging-token'] as const;
  export type OpportunityType = (typeof OpportunityTypes)[number];

  export const ClientMessageTypes = {
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    SET_FILTER: 'set-filter',
    GET_STATUS: 'get-status',
    PING: 'ping',
  } as const;

  export const ServerMessageTypes = {
    CONNECTED: 'connected',
    OPPORTUNITIES: 'opportunities',
    SUBSCRIBED: 'subscribed',
    UNSUBSCRIBED: 'unsubscribed',
    FILTER_UPDATED: 'filter-updated',
    STATUS: 'status',
    PONG: 'pong',
    ERROR: 'error',
  } as const;

  /** Connection requires `?token=<jwt>`, matching PriceStreamWS's convention. */
  export const AUTH_QUERY_PARAM = 'token';
}

// ═══════════════════════════════════════════════════════════════════════
// 8. MARKET STREAM — raw `ws`, path /api/market-stream
// ═══════════════════════════════════════════════════════════════════════

export namespace MarketStreamWS {
  export const ClientMessageTypes = {
    SUBSCRIBE: 'subscribe',
    PING: 'ping',
  } as const;

  export const ServerMessageTypes = {
    SUBSCRIBED: 'subscribed',
    PONG: 'pong',
    DEX_CANDLE: 'dex_candle',
    ERROR: 'error',
  } as const;

  /**
   * Exchanges this service actually has live data for, matching
   * ccxtService's EXCHANGE_CONFIG (derived from exchangesConfig). Any
   * exchange NOT in this set will always fall through to random-walk mock
   * data in generatePriceUpdates — huobi/gemini/ftx/cryptocom were being
   * shown to clients as if live despite never having been configured.
   */
  export const LIVE_EXCHANGES = ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx', 'gateio'] as const;

  export const AUTH_QUERY_PARAM = 'token';

  export interface MarketStreamUpdate {
    exchange: string;
    price: number;
    volume24h: number;
    priceChange: number;
    volumeChange: number;
    timestamp: string;
    liquidity: number;
    /** Added: previously absent, so clients had no way to tell fabricated
     * random-walk data from real exchange data. */
    source: 'live' | 'mock';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Backward-compatible re-exports (existing WebSocketEventService callers)
// ═══════════════════════════════════════════════════════════════════════

export type ConfigChangeEvent = AdminWS.ConfigChangeEvent;
export type ActivityEvent = AdminWS.ActivityEvent;
export type AlertEvent = AdminWS.AlertEvent;
export type PresenceEvent = AdminWS.PresenceEvent;
export type SearchResultEvent = AdminWS.SearchResultEvent;
export type AnalyticsUpdateEvent = AdminWS.AnalyticsUpdateEvent;