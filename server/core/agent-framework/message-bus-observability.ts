/**
 * HTTP Observability Endpoint for Enhanced Message Bus
 * 
 * Provides REST API for monitoring message bus health, history, and metrics
 * Integrates with Express and Prometheus
 */

import { Router} from 'express';
import type { Request, Response } from 'express';
import { EnhancedMessageBus } from './enhanced-message-bus';
import { MessageBusMetricsExporter } from './message-bus-metrics';
import { Logger } from '../../utils/logger';
import * as prometheus from 'prom-client';

const logger = new Logger('message-bus-observability');

/**
 * Message Bus Observability Router
 */
export function createMessageBusObservabilityRouter(
  bus: EnhancedMessageBus,
  metricsExporter?: MessageBusMetricsExporter
): Router {
  const router = Router();

  /**
   * GET /health
   * Returns overall health status
   */
  router.get('/health', (req: Request, res: Response) => {
    try {
      const stats = bus.getStats();
      const health = {
        status: stats.dlqSize < 5000 && stats.totalFailed < stats.totalPublished * 0.1 ? 'healthy' : 'degraded',
        timestamp: new Date(),
        uptime: process.uptime(),
        bus: {
          connected: true,
          redisConnected: stats.redisConnected,
          subscriberCount: stats.subscriberCount,
          pendingResponses: stats.pendingResponses,
        },
        metrics: {
          totalPublished: stats.totalPublished,
          totalDelivered: stats.totalDelivered,
          totalFailed: stats.totalFailed,
          totalExpired: stats.totalExpired,
          totalDLQ: stats.totalDLQ,
          failureRate: stats.totalPublished > 0
            ? Number(((stats.totalFailed / stats.totalPublished) * 100).toFixed(2))
            : 0,
        },
        queues: {
          history: stats.historySize,
          dlq: stats.dlqSize,
          processing: {
            critical: stats.queueDepth.critical,
            high: stats.queueDepth.high,
            medium: stats.queueDepth.medium,
            low: stats.queueDepth.low,
          },
        },
      };

      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({
        status: 'error',
        error: String(error),
      });
    }
  });

  /**
   * GET /stats
   * Returns detailed statistics
   */
  router.get('/stats', (req: Request, res: Response) => {
    try {
      const stats = bus.getStats();
      res.json({
        timestamp: new Date(),
        summary: {
          totalMessages: stats.totalPublished,
          delivered: stats.totalDelivered,
          failed: stats.totalFailed,
          expired: stats.totalExpired,
          inDLQ: stats.totalDLQ,
          responses: stats.totalResponses,
          timeouts: stats.totalTimeouts,
        },
        performance: {
          avgDeliveryTime: stats.avgDeliveryTime,
          pendingResponses: stats.pendingResponses,
          subscriberCount: stats.subscriberCount,
        },
        distribution: {
          messagesByType: stats.messagesByType,
          subscribersByType: stats.subscribersByType,
        },
        queues: {
          historySize: stats.historySize,
          dlqSize: stats.dlqSize,
          queueDepth: stats.queueDepth,
        },
        system: {
          redisConnected: stats.redisConnected,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        },
      });
    } catch (error) {
      logger.error('Stats error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /history
   * Returns message history
   * Query params:
   *   - limit: max number of messages (default 100)
   *   - type: filter by message type
   */
  router.get('/history', (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const type = req.query.type as string | undefined;

      let history = bus.getHistory(limit);

      if (type) {
        history = history.filter(msg => msg.type === type);
      }

      res.json({
        timestamp: new Date(),
        count: history.length,
        messages: history.map(msg => ({
          id: msg.id,
          type: msg.type,
          from: msg.from,
          to: msg.to,
          timestamp: msg.timestamp,
          priority: msg.priority,
          subsystem: msg.subsystem,
          requiresResponse: msg.requiresResponse,
          correlationId: msg.correlationId,
          expiresAt: msg.expiresAt,
          age: Date.now() - msg.timestamp.getTime(),
          deliveryAttempts: msg.deliveryAttempts,
          payload: msg.payload,
        })),
      });
    } catch (error) {
      logger.error('History error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /dlq
   * Returns dead letter queue
   * Query params:
   *   - limit: max number of messages (default 100)
   */
  router.get('/dlq', (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const dlq = bus.getDeadLetterQueue(limit);

      res.json({
        timestamp: new Date(),
        count: dlq.length,
        messages: dlq.map(msg => ({
          id: msg.id,
          type: msg.type,
          from: msg.from,
          to: msg.to,
          timestamp: msg.timestamp,
          priority: msg.priority,
          subsystem: msg.subsystem,
          deliveryAttempts: msg.deliveryAttempts,
          maxDeliveryAttempts: msg.maxDeliveryAttempts,
          correlationId: msg.correlationId,
          age: Date.now() - msg.timestamp.getTime(),
          payload: msg.payload,
        })),
      });
    } catch (error) {
      logger.error('DLQ error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /metrics
   * Returns Prometheus metrics
   */
  router.get('/metrics', (req: Request, res: Response) => {
    try {
      res.set('Content-Type', prometheus.register.contentType);
      res.end(prometheus.register.metrics());
    } catch (error) {
      logger.error('Metrics error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /message-types
   * Returns information about all message types
   */
  router.get('/message-types', (req: Request, res: Response) => {
    try {
      const stats = bus.getStats();
      const messageTypes = Object.entries(stats.messagesByType).map(([type, count]) => ({
        type,
        published: count,
        subscribers: stats.subscribersByType[type] || 0,
        hasSubscribers: (stats.subscribersByType[type] || 0) > 0,
      }));

      res.json({
        timestamp: new Date(),
        total: messageTypes.length,
        types: messageTypes.sort((a, b) => (b.published as number) - (a.published as number)),
      });
    } catch (error) {
      logger.error('Message types error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /subscribers
   * Returns subscriber information
   * Query params:
   *   - type: filter by message type
   */
  router.get('/subscribers', (req: Request, res: Response) => {
    try {
      const type = req.query.type as string | undefined;
      const stats = bus.getStats();

      const subscriberInfo = type
        ? { [type]: stats.subscribersByType[type] || 0 }
        : stats.subscribersByType;

      res.json({
        timestamp: new Date(),
        total: Object.values(subscriberInfo).reduce((a, b) => a + (b as number), 0),
        byType: subscriberInfo,
      });
    } catch (error) {
      logger.error('Subscribers error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /message/:id
   * Returns details for a specific message
   */
  router.get('/message/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const history = bus.getHistory();
      const message = history.find(msg => msg.id === id);

      if (!message) {
        // Check DLQ
        const dlq = bus.getDeadLetterQueue();
        const dlqMessage = dlq.find(msg => msg.id === id);
        
        if (!dlqMessage) {
          return res.status(404).json({
            error: `Message ${id} not found in history or DLQ`,
          });
        }

        return res.json({
          timestamp: new Date(),
          location: 'dlq',
          message: dlqMessage,
        });
      }

      res.json({
        timestamp: new Date(),
        location: 'history',
        message,
      });
    } catch (error) {
      logger.error('Message lookup error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /dlq/:id/retry
   * Retry a message from the dead letter queue
   */
  router.post('/dlq/:id/retry', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const dlq = bus.getDeadLetterQueue();
      const messageIndex = dlq.findIndex(msg => msg.id === id);

      if (messageIndex === -1) {
        return res.status(404).json({
          error: `Message ${id} not found in DLQ`,
        });
      }

      const message = dlq[messageIndex];
      message.deliveryAttempts = 0; // Reset attempts

      // Republish the message
      bus.publish(message).then(() => {
        res.json({
          status: 'success',
          message: 'Message republished from DLQ',
          messageId: id,
        });
      }).catch((error) => {
        res.status(500).json({
          error: `Failed to republish message: ${error.message}`,
        });
      });
    } catch (error) {
      logger.error('DLQ retry error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /alerts
   * Returns recent alerts and warnings
   */
  router.get('/alerts', (req: Request, res: Response) => {
    try {
      const stats = bus.getStats();
      const alerts = [];

      if (stats.dlqSize > 1000) {
        alerts.push({
          level: 'warning',
          type: 'high_dlq',
          message: `Dead Letter Queue size is high: ${stats.dlqSize}`,
          timestamp: new Date(),
        });
      }

      if (stats.totalFailed > stats.totalPublished * 0.1) {
        alerts.push({
          level: 'critical',
          type: 'high_failure_rate',
          message: `Message failure rate is high: ${((stats.totalFailed / stats.totalPublished) * 100).toFixed(2)}%`,
          timestamp: new Date(),
        });
      }

      if (stats.pendingResponses > 100) {
        alerts.push({
          level: 'warning',
          type: 'many_pending_responses',
          message: `High number of pending request-responses: ${stats.pendingResponses}`,
          timestamp: new Date(),
        });
      }

      if (!stats.redisConnected) {
        alerts.push({
          level: 'warning',
          type: 'redis_disconnected',
          message: 'Redis connection lost - persistence disabled',
          timestamp: new Date(),
        });
      }

      if (stats.totalTimeouts > 10) {
        alerts.push({
          level: 'warning',
          type: 'request_timeouts',
          message: `Request timeouts detected: ${stats.totalTimeouts}`,
          timestamp: new Date(),
        });
      }

      res.json({
        timestamp: new Date(),
        count: alerts.length,
        alerts: alerts.sort((a, b) => {
          const levelOrder = { critical: 3, warning: 2, info: 1 };
          return (levelOrder[b.level as 'critical' | 'warning' | 'info'] || 0) -
                 (levelOrder[a.level as 'critical' | 'warning' | 'info'] || 0);
        }),
      });
    } catch (error) {
      logger.error('Alerts error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  logger.info('Message Bus Observability Router initialized');
  return router;
}

/**
 * Register the observability endpoint on an Express app
 */
export function registerMessageBusObservability(
  app: any,
  bus: EnhancedMessageBus,
  metricsExporter?: MessageBusMetricsExporter,
  basePath: string = '/api/bus'
): void {
  const router = createMessageBusObservabilityRouter(bus, metricsExporter);
  app.use(basePath, router);
  logger.info(`Message Bus Observability endpoints registered at ${basePath}`);
}
