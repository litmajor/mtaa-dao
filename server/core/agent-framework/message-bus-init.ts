/**
 * Message Bus System Initialization
 * 
 * Initializes and wires up the Enhanced Unified Message Bus with:
 * - Redis persistence for durability and cross-process messaging
 * - Priority/TTL enforcement
 * - Dead Letter Queue for failed messages
 * - Prometheus metrics collection
 * - HTTP observability endpoints
 * - Bridging for coordinator and gateway subsystems
 */

import type { Express } from 'express';
import Redis from 'ioredis';
import { Logger } from '../../utils/logger';
import {
  initializeMessageBus,
  getMessageBus,
  EnhancedMessageBus,
  MessageType,
} from './enhanced-message-bus';
import {
  initializeMetricsExporter,
  MessageBusMetricsExporter,
} from './message-bus-metrics';
import {
  registerMessageBusObservability,
} from './message-bus-observability';
import {
  MessageBusBridge,
  CoordinatorBridgeAdapter,
  GatewayBridgeAdapter,
} from './message-bus-bridge';

const logger = new Logger('message-bus-system');

/**
 * Initialize the entire Enhanced Message Bus system
 * Call this early in your server startup (after Express app creation, before routes)
 */
export async function initializeMessageBusSystem(
  app: Express
): Promise<{
  messageBus: EnhancedMessageBus;
  metricsExporter: MessageBusMetricsExporter;
  bridge: MessageBusBridge;
  coordinatorBridge: CoordinatorBridgeAdapter;
  gatewayBridge: GatewayBridgeAdapter;
}> {
  try {
    logger.info('Starting Message Bus System initialization...');

    // Initialize Redis client for persistence and cross-process messaging
    let redis: Redis | undefined;
    const enablePersistence = process.env.ENABLE_MESSAGE_BUS_PERSISTENCE !== 'false';
    
    if (enablePersistence) {
      try {
        redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          db: parseInt(process.env.REDIS_DB || '0'),
          password: process.env.REDIS_PASSWORD,
          retryStrategy: (times) => Math.min(times * 50, 2000),
          lazyConnect: false,
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
        });

        // Wait for Redis connection
        await redis.ping();
        logger.info('✅ Redis connected for message bus persistence');
      } catch (error) {
        logger.warn('Failed to connect to Redis - message bus will operate without persistence:', error);
        redis = undefined;
      }
    } else {
      logger.info('Message bus persistence disabled (ENABLE_MESSAGE_BUS_PERSISTENCE=false)');
    }

    // Initialize enhanced message bus
    const messageBus = initializeMessageBus(redis);
    logger.info('✅ Enhanced Message Bus initialized');

    // Initialize Prometheus metrics exporter
    const enableMetrics = process.env.ENABLE_BUS_METRICS !== 'false';
    let metricsExporter: MessageBusMetricsExporter | null = null;
    
    if (enableMetrics) {
      metricsExporter = initializeMetricsExporter(messageBus);
      logger.info('✅ Metrics exporter initialized');
    } else {
      logger.info('Message bus metrics disabled (ENABLE_BUS_METRICS=false)');
    }

    // Register observability endpoints
    const observabilityPath = process.env.MESSAGE_BUS_OBSERVABILITY_PATH || '/api/bus';
    registerMessageBusObservability(
      app,
      messageBus,
      metricsExporter || undefined,
      observabilityPath
    );
    logger.info(`✅ Observability endpoints registered at ${observabilityPath}`);

    // Initialize bridge for coordinator and gateway subsystems
    const bridge = new MessageBusBridge(messageBus);
    const coordinatorBridge = bridge.getCoordinatorBridge();
    const gatewayBridge = bridge.getGatewayBridge();
    logger.info('✅ Message Bus Bridge initialized for subsystem bridging');

    // Set up event listeners for alerts
    messageBus.on('no-subscribers', (event) => {
      logger.warn(`⚠️ Message has no subscribers: type=${event.messageType}, from=${event.from}, id=${event.messageId}`);
    });

    messageBus.on('dlq-message', (event) => {
      logger.error(`❌ Message moved to DLQ: type=${event.type}, reason=${event.reason}, id=${event.messageId}`);
    });

    // Graceful shutdown handler
    const shutdown = async () => {
      logger.info('Shutting down Message Bus System...');
      try {
        await messageBus.shutdown();
        if (redis) {
          await redis.quit();
        }
        logger.info('✅ Message Bus System shutdown complete');
      } catch (error) {
        logger.error('Error during Message Bus System shutdown:', error);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    logger.info('✅ Message Bus System initialization complete');

    return {
      messageBus,
      metricsExporter: metricsExporter!,
      bridge,
      coordinatorBridge,
      gatewayBridge,
    };
  } catch (error) {
    logger.error('Fatal error during Message Bus System initialization:', error);
    throw error;
  }
}

/**
 * Get the global message bus instance
 * Use this throughout your application after initialization
 */
export function getGlobalMessageBus(): EnhancedMessageBus {
  return getMessageBus();
}

/**
 * Export types for convenience
 */
export type {
  MessageBusBridge,
  CoordinatorBridgeAdapter,
  GatewayBridgeAdapter,
};
export { MessageType };
