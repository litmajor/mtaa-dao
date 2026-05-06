/**
 * WebSocket Event Emitter Middleware
 * Centralized utility for emitting WebSocket events from services
 * Standardizes event emission patterns across the application
 *
 * Usage:
 * this.wsEmitter.emit('config:changed', `config:${entityId}`, userId, { ...payload });
 */

import WebSocketManager from '../websocket/websocket';

export interface EmitOptions {
  includeTimestamp?: boolean;
  includeSender?: boolean;
  userId?: string;
  userEmail?: string;
}

/**
 * Centralized WebSocket event emitter for service integration
 */
export class WebSocketEventEmitter {
  constructor(private wsManager: WebSocketManager) {}

  /**
   * Emit event to a specific room
   * @param eventType The type of event (e.g., 'config:changed', 'activity:logged')
   * @param room The room to broadcast to (e.g., 'config:elder:123')
   * @param userId User ID of who triggered the event (for logging/audit)
   * @param payload Event data
   * @param options Additional configuration
   */
  public emit(
    eventType: string,
    room: string,
    userId: string,
    payload: Record<string, any>,
    options: EmitOptions = {}
  ): void {
    const enrichedPayload = {
      ...payload,
      ...(options.includeTimestamp !== false && { timestamp: new Date() }),
      ...(options.includeSender !== false && {
        eventType,
        senderId: userId,
        senderEmail: options.userEmail
      })
    };

    this.wsManager.emitToRoom(room, eventType, enrichedPayload);
  }

  /**
   * Emit event to multiple rooms
   * Useful for broadcasting to both specific and general rooms
   */
  public emitToRooms(
    eventType: string,
    rooms: string[],
    userId: string,
    payload: Record<string, any>,
    options: EmitOptions = {}
  ): void {
    rooms.forEach(room => {
      this.emit(eventType, room, userId, payload, options);
    });
  }

  /**
   * Emit event to a specific user
   * @param userId User ID to send message to
   * @param eventType Event type
   * @param payload Event data
   */
  public emitToUser(
    userId: string,
    eventType: string,
    payload: Record<string, any>,
    options: EmitOptions = {}
  ): void {
    const enrichedPayload = {
      ...payload,
      ...(options.includeTimestamp !== false && { timestamp: new Date() }),
      ...(options.includeSender !== false && {
        eventType
      })
    };

    this.wsManager.emitToUser(userId, eventType, enrichedPayload);
  }

  /**
   * Emit configuration change event
   * Broadcasts to both specific config room and general dashboard
   */
  public emitConfigChange(
    entityType: string,
    entityId: string,
    userId: string,
    changePayload: Record<string, any>,
    userEmail?: string
  ): void {
    const basePayload = {
      entityType,
      entityId,
      ...changePayload
    };

    // Emit to specific config room
    this.emit(
      'config:changed',
      `config:${entityType}:${entityId}`,
      userId,
      basePayload,
      { userEmail }
    );

    // Also emit to general dashboard updates
    this.emit('config:changed', 'dashboard:updates', userId, {
      entityType,
      entityId,
      action: 'modified'
    });
  }

  /**
   * Emit activity/audit log event
   */
  public emitActivity(
    entityType: string,
    entityId: string,
    userId: string,
    action: string,
    details: Record<string, any> = {},
    userEmail?: string
  ): void {
    const basePayload = {
      entityType,
      entityId,
      action,
      details
    };

    // Emit to specific activity room
    this.emit(
      'activity:logged',
      `activity:${entityType}:${entityId}`,
      userId,
      basePayload,
      { userEmail }
    );

    // Also emit to activity feed
    this.emit('activity:new', 'activity:feed', userId, {
      entityType,
      entityId,
      action
    });
  }

  /**
   * Emit alert event
   */
  public emitAlert(
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    userId: string,
    metadata: Record<string, any> = {},
    userEmail?: string
  ): void {
    const basePayload = {
      alertType,
      severity,
      message,
      ...metadata,
      id: `alert-${Date.now()}`
    };

    // Emit to general alerts room
    this.emit('alert:new', 'alerts', userId, basePayload, { userEmail });

    // Emit to critical room if severity is critical
    if (severity === 'critical') {
      this.emit('alert:critical', 'alerts:critical', userId, basePayload, { userEmail });
    }

    // Emit to entity-specific room if entityId provided
    if (metadata.entityId) {
      this.emit(
        'alert:new',
        `alerts:${metadata.entityType || 'system'}:${metadata.entityId}`,
        userId,
        basePayload
      );
    }
  }

  /**
   * Emit status change event
   */
  public emitStatusChange(
    entityType: string,
    entityId: string,
    newStatus: string,
    userId: string,
    additionalData: Record<string, any> = {},
    userEmail?: string
  ): void {
    const basePayload = {
      entityType,
      entityId,
      newStatus,
      ...additionalData
    };

    this.emit(
      'status:changed',
      `status:${entityType}:${entityId}`,
      userId,
      basePayload,
      { userEmail }
    );

    // Also emit to general status room for monitoring
    this.emit('system:event', 'status:updates', userId, {
      type: 'status-change',
      ...basePayload
    });
  }

  /**
   * Emit metrics/analytics update
   */
  public emitMetrics(
    metricType: string,
    metrics: Record<string, any>,
    userId: string,
    entityType?: string,
    entityId?: string
  ): void {
    const basePayload = {
      metricType,
      metrics,
      ...(entityType && { entityType }),
      ...(entityId && { entityId })
    };

    // Emit to metrics room
    this.emit('analytics:updated', 'dashboard:metrics', userId, basePayload);

    // Emit to analytics dashboard
    this.emit('metrics:updated', 'dashboard:analytics', userId, basePayload);
  }

  /**
   * Emit system health/status event
   */
  public emitSystemEvent(
    eventType: string,
    message: string,
    userId: string,
    details: Record<string, any> = {}
  ): void {
    const basePayload = {
      eventType,
      message,
      ...details
    };

    this.emit('system:event', 'system:updates', userId, basePayload);
  }

  /**
   * Emit bulk operation progress
   */
  public emitBulkProgress(
    operationId: string,
    totalItems: number,
    processedCount: number,
    errors: number,
    userId: string,
    status: 'in-progress' | 'completed' | 'failed'
  ): void {
    const basePayload = {
      operationId,
      totalItems,
      processedCount,
      remainingCount: totalItems - processedCount,
      errors,
      status,
      percentComplete: Math.floor((processedCount / totalItems) * 100)
    };

    this.emit('bulk:update', `bulk:${operationId}`, userId, basePayload);

    // Also emit to dashboard if completed or failed
    if (status === 'completed' || status === 'failed') {
      this.emit('bulk:complete', 'dashboard:updates', userId, basePayload);
    }
  }

  /**
   * Emit user presence update
   */
  public emitPresence(
    userId: string,
    section: string,
    action: 'viewing' | 'editing' | 'searching' | 'offline',
    metadata: Record<string, any> = {}
  ): void {
    const basePayload = {
      userId,
      section,
      action,
      ...metadata
    };

    this.emit('presence:updated', `presence:${section}`, userId, basePayload, {
      includeSender: false
    });
  }

  /**
   * Emit scheduled/approval update
   */
  public emitApprovalUpdate(
    entityType: string,
    entityId: string,
    status: string,
    userId: string,
    voteData?: Record<string, any>
  ): void {
    const basePayload = {
      entityType,
      entityId,
      status,
      ...(voteData && { voteData })
    };

    this.emit('approval:changed', `approval:${entityType}:${entityId}`, userId, basePayload);

    // Also emit to dashboard
    this.emit('approval:update', 'dashboard:updates', userId, basePayload);
  }

  /**
   * Emit search result ready
   */
  public emitSearchResult(
    queryId: string,
    query: string,
    totalResults: number,
    resultsCount: number,
    userId: string,
    filters?: Record<string, any>
  ): void {
    const basePayload = {
      queryId,
      query,
      totalResults,
      resultsCount,
      completed: true,
      filters
    };

    this.emit('search:result-ready', 'search:results', userId, basePayload);
  }
}

/**
 * Singleton instance of event emitter
 * Will be initialized with WebSocketManager once it's created
 */
let emitterInstance: WebSocketEventEmitter | null = null;

/**
 * Initialize the global event emitter
 * Call this once when WebSocketManager is created
 */
export function initializeEventEmitter(wsManager: WebSocketManager): WebSocketEventEmitter {
  emitterInstance = new WebSocketEventEmitter(wsManager);
  return emitterInstance;
}

/**
 * Get the global event emitter instance
 */
export function getEventEmitter(): WebSocketEventEmitter {
  if (!emitterInstance) {
    throw new Error('WebSocket event emitter not initialized. Call initializeEventEmitter first.');
  }
  return emitterInstance;
}

export default WebSocketEventEmitter;
