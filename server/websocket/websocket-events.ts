import WebSocketManager from './websocket';

/**
 * WebSocket Event Handlers Service
 * Centralized handlers for all real-time events
 */

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

class WebSocketEventService {
  constructor(private wsManager: WebSocketManager) {}

  /**
   * Broadcast configuration change to relevant subscribers
   */
  public notifyConfigurationChange(event: ConfigChangeEvent) {
    const room = `config:${event.entityType}:${event.entityId}`;

    this.wsManager.emitToRoom(room, 'config:changed', {
      ...event,
      timestamp: new Date(),
      type: 'configuration-change'
    });

    // Also notify dashboard subscribers
    this.wsManager.emitToRoom('dashboard:updates', 'config:changed', {
      entityType: event.entityType,
      entityId: event.entityId,
      action: 'modified',
      timestamp: new Date()
    });
  }

  /**
   * Broadcast activity event
   */
  public notifyActivity(event: ActivityEvent) {
    const room = `activity:${event.entityType}:${event.entityId}`;

    this.wsManager.emitToRoom(room, 'activity:logged', {
      ...event,
      timestamp: new Date(),
      type: 'activity-log'
    });

    // Notify activity feed subscribers
    this.wsManager.emitToRoom('activity:feed', 'activity:new', {
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast alert event
   */
  public notifyAlert(event: AlertEvent) {
    this.wsManager.emitToRoom('alerts', 'alert:new', {
      ...event,
      timestamp: new Date(),
      type: 'alert',
      id: `alert-${Date.now()}`
    });

    // Notify specific entity subscribers if applicable
    if (event.entityId) {
      const room = `alerts:${event.entityType}:${event.entityId}`;
      this.wsManager.emitToRoom(room, 'alert:entity', {
        ...event,
        timestamp: new Date()
      });
    }

    // Send notification to admin if critical
    if (event.severity === 'critical') {
      this.wsManager.emitToRoom('alerts:critical', 'alert:critical', {
        ...event,
        timestamp: new Date()
      });
    }
  }

  /**
   * Broadcast presence update
   */
  public notifyPresence(userId: string, event: PresenceEvent) {
    const room = `presence:${event.section}`;

    this.wsManager.emitToRoom(room, 'presence:updated', {
      userId,
      ...event,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast search result ready
   */
  public notifySearchResult(event: SearchResultEvent) {
    this.wsManager.emitToRoom('search:results', 'search:result-ready', {
      ...event,
      timestamp: new Date(),
      type: 'search-complete'
    });
  }

  /**
   * Broadcast analytics update
   */
  public notifyAnalyticsUpdate(event: AnalyticsUpdateEvent) {
    this.wsManager.emitToRoom('analytics', 'analytics:updated', {
      ...event,
      timestamp: new Date(),
      type: 'analytics-update'
    });

    // Also notify dashboard
    this.wsManager.emitToRoom('dashboard:metrics', 'metrics:updated', {
      metricType: event.metricType,
      period: event.period,
      timestamp: new Date()
    });
  }

  /**
   * Notify specific user
   */
  public notifyUser(userId: string, eventType: string, data: any) {
    this.wsManager.emitToUser(userId, eventType, {
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast to dashboard subscribers
   */
  public notifyDashboard(data: any) {
    this.wsManager.emitToRoom('dashboard:updates', 'dashboard:update', {
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast to analytics dashboard
   */
  public notifyAnalyticsDashboard(metrics: Record<string, any>) {
    this.wsManager.emitToRoom('dashboard:analytics', 'analytics:metrics', {
      ...metrics,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast status change
   */
  public notifyStatusChange(entityType: string, entityId: string, status: string) {
    this.wsManager.emitToRoom(`status:${entityType}:${entityId}`, 'status:changed', {
      entityType,
      entityId,
      status,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast approval event
   */
  public notifyApprovalStatusChange(entityType: string, entityId: string, approvalStatus: string) {
    this.wsManager.emitToRoom(`approval:${entityType}:${entityId}`, 'approval:changed', {
      entityType,
      entityId,
      approvalStatus,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast scheduled change event
   */
  public notifyScheduledChange(entityType: string, entityId: string, action: string) {
    this.wsManager.emitToRoom('scheduled:changes', 'scheduled:updated', {
      entityType,
      entityId,
      action, // 'created', 'approved', 'executed', 'cancelled'
      timestamp: new Date()
    });
  }

  /**
   * Broadcast bulk update
   */
  public notifyBulkUpdate(updateType: string, affectedEntities: number, details: any) {
    this.wsManager.emitToRoom('system:updates', 'bulk:update', {
      updateType,
      affectedEntities,
      details,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast system event
   */
  public notifySystemEvent(eventType: string, message: string, data?: any) {
    this.wsManager.broadcastToAll('system:event', {
      eventType,
      message,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Get connection stats
   */
  public getConnectionStats() {
    const users = this.wsManager.getConnectedUsers();
    const rooms = this.wsManager.getAllRooms();

    return {
      totalConnectedSockets: users.length,
      totalUniqueUsers: new Set(users.map(u => u.userId)).size,
      totalRooms: rooms.length,
      timestamp: new Date()
    };
  }
}

export default WebSocketEventService;
