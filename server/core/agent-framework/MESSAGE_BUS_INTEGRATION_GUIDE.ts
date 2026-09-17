/**
 * Server Integration Guide - Enhanced Unified Message Bus
 * 
 * How to initialize and integrate the new enhanced message bus with Redis persistence,
 * priority/TTL enforcement, dead letter queue, and observability endpoints.
 */

/**
 * QUICK START - Add to server/index.ts or your Express app initialization:
 * 
 * import Redis from 'ioredis';
 * import { initializeMessageBus } from './core/agent-framework/enhanced-message-bus';
 * import { initializeMetricsExporter } from './core/agent-framework/message-bus-metrics';
 * import { registerMessageBusObservability } from './core/agent-framework/message-bus-observability';
 * import { MessageBusBridge } from './core/agent-framework/message-bus-bridge';
 * 
 * // Initialize Redis (optional but recommended for durability)
 * const redis = new Redis({
 *   host: process.env.REDIS_HOST || 'localhost',
 *   port: parseInt(process.env.REDIS_PORT || '6379'),
 *   db: parseInt(process.env.REDIS_DB || '0'),
 *   retryStrategy: (times) => Math.min(times * 50, 2000),
 * });
 * 
 * // Initialize the enhanced message bus
 * const messageBus = initializeMessageBus(redis);
 * 
 * // Initialize metrics exporter
 * const metricsExporter = initializeMetricsExporter(messageBus);
 * 
 * // Register observability endpoints
 * registerMessageBusObservability(app, messageBus, metricsExporter, '/api/bus');
 * 
 * // Initialize bridge for coordinator and gateway subsystems
 * const bridge = new MessageBusBridge(messageBus);
 * const coordinatorBridge = bridge.getCoordinatorBridge();
 * const gatewayBridge = bridge.getGatewayBridge();
 */

import { type Express } from 'express';
import Redis from 'ioredis';
import {
  initializeMessageBus,
  getMessageBus,
  type EnhancedMessageBus,
  MessageType,
} from './enhanced-message-bus';
import {
  initializeMetricsExporter,
  type MessageBusMetricsExporter,
} from './message-bus-metrics';
import {
  registerMessageBusObservability,
} from './message-bus-observability';
import {
  MessageBusBridge,
  type CoordinatorBridgeAdapter,
  type GatewayBridgeAdapter,
} from './message-bus-bridge';
import { Logger } from '../../utils/logger';

const logger = new Logger('message-bus-integration');

/**
 * Complete integration configuration
 */
export interface MessageBusIntegrationConfig {
  /** Redis connection options */
  redis?: {
    host: string;
    port: number;
    db?: number;
    password?: string;
    retryStrategy?: (times: number) => number;
  };
  /** Enable Redis persistence */
  enablePersistence?: boolean;
  /** Enable distributed bus (cross-process via Redis) */
  enableDistributed?: boolean;
  /** Observability endpoint base path */
  observabilityPath?: string;
  /** Enable Prometheus metrics */
  enableMetrics?: boolean;
}

/**
 * Initialize the entire message bus system
 */
export async function initializeMessageBusSystem(
  app: Express,
  config: MessageBusIntegrationConfig = {}
): Promise<{
  messageBus: EnhancedMessageBus;
  metricsExporter: MessageBusMetricsExporter | null;
  bridge: MessageBusBridge;
  coordinatorBridge: CoordinatorBridgeAdapter;
  gatewayBridge: GatewayBridgeAdapter;
}> {
  const config_ = {
    enablePersistence: true,
    enableDistributed: false,
    observabilityPath: '/api/bus',
    enableMetrics: true,
    ...config,
  };

  logger.info('Initializing Enhanced Message Bus System');

  // Initialize Redis if configured
  let redis: Redis | undefined;
  if (config_.enablePersistence && config_.redis) {
    try {
      redis = new Redis({
        host: config_.redis.host,
        port: config_.redis.port,
        db: config_.redis.db || 0,
        password: config_.redis.password,
        retryStrategy: config_.redis.retryStrategy || ((times) => Math.min(times * 50, 2000)),
      });

      // Wait for connection
      await redis.ping();
      logger.info('Redis connection established');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      redis = undefined;
    }
  }

  // Initialize main message bus
  const messageBus = initializeMessageBus(redis);
  logger.info('Enhanced Message Bus initialized');

  // Initialize metrics exporter
  let metricsExporter: MessageBusMetricsExporter | null = null;
  if (config_.enableMetrics) {
    metricsExporter = initializeMetricsExporter(messageBus);
    logger.info('Metrics exporter initialized');
  }

  // Register observability endpoints
  registerMessageBusObservability(
    app,
    messageBus,
    metricsExporter,
    config_.observabilityPath
  );
  logger.info(`Observability endpoints registered at ${config_.observabilityPath}`);

  // Initialize bridge for other subsystems
  const bridge = new MessageBusBridge(messageBus);
  const coordinatorBridge = bridge.getCoordinatorBridge();
  const gatewayBridge = bridge.getGatewayBridge();
  logger.info('Message Bus Bridge initialized');

  // Set up graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down message bus');
    await messageBus.shutdown();
    if (redis) {
      redis.disconnect();
    }
  });

  logger.info('Message Bus System initialization complete');

  return {
    messageBus,
    metricsExporter,
    bridge,
    coordinatorBridge,
    gatewayBridge,
  };
}

/**
 * Get the global message bus instance
 */
export function getGlobalMessageBus(): EnhancedMessageBus {
  return getMessageBus();
}

/**
 * USAGE EXAMPLES
 */

/**
 * Example 1: Publishing a message
 */
export async function examplePublish() {
  const bus = getGlobalMessageBus();

  await bus.publish({
    id: 'msg-123',
    from: 'my-agent',
    to: 'broadcast',
    type: MessageType.RISK_ASSESSMENT,
    payload: { riskLevel: 'high', details: {} },
    timestamp: new Date(),
    priority: 'high',
    requiresResponse: false,
    ttl: 300000, // 5 minutes
  });
}

/**
 * Example 2: Subscribing to messages
 */
export function exampleSubscribe() {
  const bus = getGlobalMessageBus();

  bus.subscribe(
    'my-agent',
    [MessageType.RISK_ASSESSMENT, MessageType.THREAT_DETECTED],
    async (message) => {
      console.log('Received message:', message.type, message.payload);
    }
  );
}

/**
 * Example 3: Request-response pattern
 */
export async function exampleRequestResponse() {
  const bus = getGlobalMessageBus();

  try {
    const response = await bus.request(
      {
        id: 'req-123',
        from: 'my-agent',
        to: 'risk-analyzer',
        type: MessageType.ANALYSIS_REQUEST,
        payload: { data: 'analyze this' },
        timestamp: new Date(),
        priority: 'high',
        requiresResponse: true,
        ttl: 10000, // 10 seconds
      },
      5000 // 5 second timeout
    );

    console.log('Response:', response);
  } catch (error) {
    console.error('Request failed:', error);
  }
}

/**
 * Example 4: Broadcast message
 */
export async function exampleBroadcast() {
  const bus = getGlobalMessageBus();

  await bus.broadcast(
    MessageType.HEALTH_CHECK,
    { status: 'healthy', timestamp: new Date() },
    'health-monitor',
    'high'
  );
}

/**
 * Example 5: Bridging coordinator messages
 */
export async function exampleCoordinatorBridge(bridge: MessageBusBridge) {
  const coordinatorBridge = bridge.getCoordinatorBridge();

  // Bridge a coordinator message to the main bus
  await coordinatorBridge.bridgeMessage({
    id: 'coord-123',
    topic: 'scry:threat-detected',
    from: 'SCRY',
    to: 'ALL',
    data: { threatLevel: 'critical' },
    priority: 'critical',
    timestamp: new Date(),
  });

  // Subscribe to coordinator messages
  coordinatorBridge.subscribe('scry:threat-detected', async (message) => {
    console.log('Threat detected from SCRY:', message.data);
  });
}

/**
 * Example 6: Bridging gateway messages
 */
export async function exampleGatewayBridge(bridge: MessageBusBridge) {
  const gatewayBridge = bridge.getGatewayBridge();

  // Bridge a gateway message
  await gatewayBridge.bridgeMessage({
    id: 'gw-123',
    type: 'gateway:price_update',
    from: 'gateway',
    payload: { symbol: 'USDC', price: 1.001 },
    timestamp: new Date(),
  });

  // Subscribe to gateway messages
  gatewayBridge.subscribe('gateway:price_update', async (message) => {
    console.log('Price updated:', message.payload);
  });
}

/**
 * Example 7: Getting statistics
 */
export function exampleGetStats() {
  const bus = getGlobalMessageBus();
  const stats = bus.getStats();

  console.log('Bus Statistics:');
  console.log(`Total Published: ${stats.totalPublished}`);
  console.log(`Total Delivered: ${stats.totalDelivered}`);
  console.log(`Total Failed: ${stats.totalFailed}`);
  console.log(`Dead Letter Queue Size: ${stats.dlqSize}`);
  console.log(`Average Delivery Time: ${stats.avgDeliveryTime}ms`);
  console.log(`Pending Responses: ${stats.pendingResponses}`);
  console.log(`Redis Connected: ${stats.redisConnected}`);
}

/**
 * OBSERVABILITY ENDPOINTS
 * 
 * Once initialized, the following endpoints are available at the configured path:
 * 
 * GET /api/bus/health
 *   - Overall health status, uptime, metrics summary
 * 
 * GET /api/bus/stats
 *   - Detailed statistics including message distribution, performance, queues
 * 
 * GET /api/bus/history?limit=100&type=RISK_ASSESSMENT
 *   - Message history with optional filtering
 * 
 * GET /api/bus/dlq?limit=100
 *   - Dead letter queue contents
 * 
 * POST /api/bus/dlq/:id/retry
 *   - Retry a message from the dead letter queue
 * 
 * GET /api/bus/message/:id
 *   - Details for a specific message
 * 
 * GET /api/bus/message-types
 *   - Information about all message types and their activity
 * 
 * GET /api/bus/subscribers?type=RISK_ASSESSMENT
 *   - Subscriber information
 * 
 * GET /api/bus/alerts
 *   - Current alerts and warnings
 * 
 * GET /api/bus/metrics
 *   - Prometheus metrics endpoint
 */

/**
 * ENVIRONMENT VARIABLES
 * 
 * REDIS_HOST - Redis server host (default: localhost)
 * REDIS_PORT - Redis server port (default: 6379)
 * REDIS_DB - Redis database number (default: 0)
 * REDIS_PASSWORD - Redis password (optional)
 * 
 * ENABLE_MESSAGE_BUS_PERSISTENCE - Enable Redis persistence (default: true)
 * ENABLE_DISTRIBUTED_BUS - Enable cross-process messaging via Redis (default: false)
 * ENABLE_BUS_METRICS - Enable Prometheus metrics (default: true)
 * 
 * MESSAGE_BUS_TTL - Default message TTL in ms (default: 300000)
 * MESSAGE_BUS_MAX_HISTORY - Max messages in history (default: 10000)
 * MESSAGE_BUS_MAX_DLQ - Max messages in DLQ (default: 5000)
 */

export { MessageBusIntegrationConfig };
