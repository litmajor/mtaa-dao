/**
 * Prometheus Metrics Exporter for Enhanced Message Bus
 * 
 * Exports comprehensive metrics for monitoring message bus health and performance
 */

import * as prometheus from 'prom-client';
import { type EnhancedMessageBus, MessageType } from './enhanced-message-bus';
import { Logger } from '../../utils/logger';

const logger = new Logger('message-bus-metrics');

export class MessageBusMetricsExporter {
  private bus: EnhancedMessageBus;
  
  // Counters
  private messagesPublished: prometheus.Counter;
  private messagesDelivered: prometheus.Counter;
  private messagesFailed: prometheus.Counter;
  private messagesExpired: prometheus.Counter;
  private messagesInDLQ: prometheus.Counter;
  private responsesReceived: prometheus.Counter;
  private requestTimeouts: prometheus.Counter;
  private publishedByType: prometheus.Counter;
  private deliveredByType: prometheus.Counter;
  private failedByType: prometheus.Counter;
  private subscribersByType: prometheus.Gauge;
  private noSubscriberAlerts: prometheus.Counter;
  
  // Gauges
  private pendingResponses: prometheus.Gauge;
  private historySize: prometheus.Gauge;
  private dlqSize: prometheus.Gauge;
  private queueDepth: prometheus.Gauge;
  private redisConnected: prometheus.Gauge;
  
  // Histograms
  private deliveryDuration: prometheus.Histogram;
  private messageAge: prometheus.Histogram;
  
  constructor(bus: EnhancedMessageBus) {
    this.bus = bus;
    
    // Initialize counters
    this.messagesPublished = new prometheus.Counter({
      name: 'mtaa_bus_messages_published_total',
      help: 'Total number of messages published',
      labelNames: [],
    });

    this.messagesDelivered = new prometheus.Counter({
      name: 'mtaa_bus_messages_delivered_total',
      help: 'Total number of messages delivered successfully',
      labelNames: [],
    });

    this.messagesFailed = new prometheus.Counter({
      name: 'mtaa_bus_messages_failed_total',
      help: 'Total number of message delivery failures',
      labelNames: [],
    });

    this.messagesExpired = new prometheus.Counter({
      name: 'mtaa_bus_messages_expired_total',
      help: 'Total number of expired messages',
      labelNames: [],
    });

    this.messagesInDLQ = new prometheus.Counter({
      name: 'mtaa_bus_messages_dlq_total',
      help: 'Total number of messages in dead letter queue',
      labelNames: [],
    });

    this.responsesReceived = new prometheus.Counter({
      name: 'mtaa_bus_responses_received_total',
      help: 'Total number of responses received',
      labelNames: [],
    });

    this.requestTimeouts = new prometheus.Counter({
      name: 'mtaa_bus_request_timeouts_total',
      help: 'Total number of request timeouts',
      labelNames: [],
    });

    this.publishedByType = new prometheus.Counter({
      name: 'mtaa_bus_messages_by_type_published_total',
      help: 'Messages published by type',
      labelNames: ['type'],
    });

    this.deliveredByType = new prometheus.Counter({
      name: 'mtaa_bus_messages_by_type_delivered_total',
      help: 'Messages delivered by type',
      labelNames: ['type'],
    });

    this.failedByType = new prometheus.Counter({
      name: 'mtaa_bus_messages_by_type_failed_total',
      help: 'Message delivery failures by type',
      labelNames: ['type'],
    });

    this.noSubscriberAlerts = new prometheus.Counter({
      name: 'mtaa_bus_no_subscriber_alerts_total',
      help: 'Alerts for messages with no subscribers',
      labelNames: ['type'],
    });

    // Initialize gauges
    this.pendingResponses = new prometheus.Gauge({
      name: 'mtaa_bus_pending_responses',
      help: 'Number of pending request-response correlations',
      labelNames: [],
    });

    this.historySize = new prometheus.Gauge({
      name: 'mtaa_bus_history_size',
      help: 'Current message history size',
      labelNames: [],
    });

    this.dlqSize = new prometheus.Gauge({
      name: 'mtaa_bus_dlq_size',
      help: 'Current dead letter queue size',
      labelNames: [],
    });

    this.queueDepth = new prometheus.Gauge({
      name: 'mtaa_bus_queue_depth',
      help: 'Depth of priority queue by priority level',
      labelNames: ['priority'],
    });

    this.redisConnected = new prometheus.Gauge({
      name: 'mtaa_bus_redis_connected',
      help: 'Redis connection status (1=connected, 0=disconnected)',
      labelNames: [],
    });

    this.subscribersByType = new prometheus.Gauge({
      name: 'mtaa_bus_subscribers_by_type',
      help: 'Number of subscribers by message type',
      labelNames: ['type'],
    });

    // Initialize histograms
    this.deliveryDuration = new prometheus.Histogram({
      name: 'mtaa_bus_delivery_duration_ms',
      help: 'Message delivery duration in milliseconds',
      labelNames: ['type'],
      buckets: [1, 5, 10, 50, 100, 500, 1000, 5000],
    });

    this.messageAge = new prometheus.Histogram({
      name: 'mtaa_bus_message_age_ms',
      help: 'Age of message at delivery time',
      labelNames: ['type'],
      buckets: [100, 500, 1000, 5000, 10000, 30000, 60000],
    });

    // Set up event listeners
    this.setupEventListeners();
    
    // Start periodic metrics collection
    this.startMetricsCollection();
  }

  /**
   * Set up event listeners on the message bus
   */
  private setupEventListeners(): void {
    // Track messages published
    this.bus.on('message', (message) => {
      this.messagesPublished.inc();
      this.publishedByType.labels(message.type).inc();
    });

    // Track no subscribers
    this.bus.on('no-subscribers', (event) => {
      this.noSubscriberAlerts.labels(event.messageType).inc();
    });

    // Track DLQ messages
    this.bus.on('dlq-message', (event) => {
      this.messagesInDLQ.inc();
    });
  }

  /**
   * Start periodic metrics collection from bus stats
   */
  private startMetricsCollection(): void {
    // Update metrics every 10 seconds
    const interval = setInterval(() => {
      try {
        const stats = this.bus.getStats();

        // Update gauges
        this.pendingResponses.set(stats.pendingResponses);
        this.historySize.set(stats.historySize);
        this.dlqSize.set(stats.dlqSize);
        this.redisConnected.set(stats.redisConnected ? 1 : 0);

        // Update queue depth by priority
        this.queueDepth.labels('critical').set(stats.queueDepth.critical);
        this.queueDepth.labels('high').set(stats.queueDepth.high);
        this.queueDepth.labels('medium').set(stats.queueDepth.medium);
        this.queueDepth.labels('low').set(stats.queueDepth.low);

        // Update subscribers by type
        for (const [type, count] of Object.entries(stats.subscribersByType)) {
          this.subscribersByType.labels(type).set(count as number);
        }
      } catch (error) {
        logger.error('Failed to collect metrics:', error);
      }
    }, 10000); // 10 seconds

    // Allow process to exit if this is the only interval
    interval.unref();
  }

  /**
   * Record message delivery
   */
  recordMessageDelivery(
    messageType: string,
    durationMs: number,
    ageMs: number
  ): void {
    this.messagesDelivered.inc();
    this.deliveredByType.labels(messageType).inc();
    this.deliveryDuration.labels(messageType).observe(durationMs);
    this.messageAge.labels(messageType).observe(ageMs);
  }

  /**
   * Record message failure
   */
  recordMessageFailure(messageType: string): void {
    this.messagesFailed.inc();
    this.failedByType.labels(messageType).inc();
  }

  /**
   * Record message expiration
   */
  recordMessageExpiration(messageType: string): void {
    this.messagesExpired.inc();
  }

  /**
   * Record response received
   */
  recordResponseReceived(): void {
    this.responsesReceived.inc();
  }

  /**
   * Record request timeout
   */
  recordRequestTimeout(): void {
    this.requestTimeouts.inc();
  }

  /**
   * Get all metrics as Prometheus format
   */
  getMetricsText(): string {
    return prometheus.register.metrics();
  }

  /**
   * Get metrics for a specific message type
   */
  getMetricsForType(type: string): any {
    const stats = this.bus.getStats();
    return {
      type,
      published: stats.messagesByType[type] || 0,
      subscribers: stats.subscribersByType[type] || 0,
      avgDeliveryTime: stats.avgDeliveryTime,
    };
  }

  /**
   * Get health status based on metrics
   */
  getHealthStatus(): any {
    const stats = this.bus.getStats();
    const failureRate = stats.totalPublished > 0
      ? ((stats.totalFailed + stats.totalExpired) / stats.totalPublished) * 100
      : 0;

    return {
      healthy: failureRate < 5 && stats.dlqSize < 1000,
      failureRate: Math.round(failureRate * 100) / 100,
      dlqSize: stats.dlqSize,
      avgDeliveryTime: Math.round(stats.avgDeliveryTime * 100) / 100,
      redisConnected: stats.redisConnected,
      timeouts: stats.totalTimeouts,
      pendingResponses: stats.pendingResponses,
    };
  }
}

// Singleton instance
let metricsExporter: MessageBusMetricsExporter | null = null;

/**
 * Initialize metrics exporter
 */
export function initializeMetricsExporter(bus: EnhancedMessageBus): MessageBusMetricsExporter {
  if (!metricsExporter) {
    metricsExporter = new MessageBusMetricsExporter(bus);
    logger.info('Metrics exporter initialized');
  }
  return metricsExporter;
}

/**
 * Get metrics exporter instance
 */
export function getMetricsExporter(): MessageBusMetricsExporter | null {
  return metricsExporter;
}
