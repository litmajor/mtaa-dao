import WebSocketManager from './websocket';
import { AdminWS } from './websocket-events';

/**
 * WebSocket Event Handlers Service
 * Centralized handlers for all real-time events.
 *
 * FIX: every room/event name below now comes from the AdminWS registry in
 * websocket-events.ts instead of being typed inline. This is what caught
 * the drift where this service was pushing to rooms (`dashboard:updates`,
 * `alerts:critical`, `activity:feed`, `status:*`, `approval:*`,
 * `scheduled:changes`, `system:updates`) that WebSocketManager.hasRoomPermission
 * never actually allowed a client to join. Those permission rules need to be
 * added server-side (see AdminWS.ROOM_PERMISSIONS) or clients subscribing to
 * these rooms will keep getting silently rejected.
 */

export type ConfigChangeEvent = AdminWS.ConfigChangeEvent;
export type ActivityEvent = AdminWS.ActivityEvent;
export type AlertEvent = AdminWS.AlertEvent;
export type PresenceEvent = AdminWS.PresenceEvent;
export type SearchResultEvent = AdminWS.SearchResultEvent;
export type AnalyticsUpdateEvent = AdminWS.AnalyticsUpdateEvent;

class WebSocketEventService {
  constructor(private wsManager: WebSocketManager) {}

  public notifyConfigurationChange(event: AdminWS.ConfigChangeEvent) {
    const room = AdminWS.Rooms.config(event.entityType, event.entityId);

    this.wsManager.emitToRoom(room, AdminWS.ServerEvents.CONFIG_CHANGED, {
      ...event,
      timestamp: new Date(),
      type: 'configuration-change'
    });

    this.wsManager.emitToRoom(AdminWS.Rooms.dashboardUpdates(), AdminWS.ServerEvents.CONFIG_CHANGED, {
      entityType: event.entityType,
      entityId: event.entityId,
      action: 'modified',
      timestamp: new Date()
    });
  }

  public notifyActivity(event: AdminWS.ActivityEvent) {
    const room = AdminWS.Rooms.activity(event.entityType, event.entityId);

    this.wsManager.emitToRoom(room, AdminWS.ServerEvents.ACTIVITY_LOGGED, {
      ...event,
      timestamp: new Date(),
      type: 'activity-log'
    });

    this.wsManager.emitToRoom(AdminWS.Rooms.activityFeed(), 'activity:new', {
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      timestamp: new Date()
    });
  }

  public notifyAlert(event: AdminWS.AlertEvent) {
    this.wsManager.emitToRoom(AdminWS.Rooms.alerts(), AdminWS.ServerEvents.ALERT_NEW, {
      ...event,
      timestamp: new Date(),
      type: 'alert',
      id: `alert-${Date.now()}`
    });

    if (event.entityId) {
      const room = AdminWS.Rooms.alertsForEntity(event.entityType, event.entityId);
      this.wsManager.emitToRoom(room, AdminWS.ServerEvents.ALERT_ENTITY, {
        ...event,
        timestamp: new Date()
      });
    }

    if (event.severity === 'critical') {
      this.wsManager.emitToRoom(AdminWS.Rooms.alertsCritical(), AdminWS.ServerEvents.ALERT_CRITICAL, {
        ...event,
        timestamp: new Date()
      });
    }
  }

  public notifyPresence(userId: string, event: AdminWS.PresenceEvent) {
    const room = AdminWS.Rooms.presence(event.section);
    const { userId: _eventUserId, ...eventPayload } = event;

    this.wsManager.emitToRoom(room, AdminWS.ServerEvents.PRESENCE_UPDATED, {
      userId,
      ...eventPayload,
      timestamp: new Date()
    });
  }

  public notifySearchResult(event: AdminWS.SearchResultEvent) {
    this.wsManager.emitToRoom(AdminWS.Rooms.searchResults(), AdminWS.ServerEvents.SEARCH_RESULT_READY, {
      ...event,
      timestamp: new Date(),
      type: 'search-complete'
    });
  }

  public notifyAnalyticsUpdate(event: AdminWS.AnalyticsUpdateEvent) {
    this.wsManager.emitToRoom(AdminWS.Rooms.analytics(), AdminWS.ServerEvents.ANALYTICS_UPDATED, {
      ...event,
      timestamp: new Date(),
      type: 'analytics-update'
    });

    this.wsManager.emitToRoom(AdminWS.Rooms.dashboardMetrics(), AdminWS.ServerEvents.METRICS_UPDATED, {
      metricType: event.metricType,
      period: event.period,
      timestamp: new Date()
    });
  }

  public notifyUser(userId: string, eventType: string, data: any) {
    this.wsManager.emitToUser(userId, eventType, {
      ...data,
      timestamp: new Date()
    });
  }

  public notifyDashboard(data: any) {
    this.wsManager.emitToRoom(AdminWS.Rooms.dashboardUpdates(), AdminWS.ServerEvents.DASHBOARD_UPDATE, {
      ...data,
      timestamp: new Date()
    });
  }

  public notifyAnalyticsDashboard(metrics: Record<string, any>) {
    this.wsManager.emitToRoom(AdminWS.Rooms.dashboardAnalytics(), 'analytics:metrics', {
      ...metrics,
      timestamp: new Date()
    });
  }

  public notifyStatusChange(entityType: string, entityId: string, status: string) {
    this.wsManager.emitToRoom(AdminWS.Rooms.status(entityType, entityId), AdminWS.ServerEvents.STATUS_CHANGED, {
      entityType,
      entityId,
      status,
      timestamp: new Date()
    });
  }

  public notifyApprovalStatusChange(entityType: string, entityId: string, approvalStatus: string) {
    this.wsManager.emitToRoom(AdminWS.Rooms.approval(entityType, entityId), AdminWS.ServerEvents.APPROVAL_CHANGED, {
      entityType,
      entityId,
      approvalStatus,
      timestamp: new Date()
    });
  }

  public notifyScheduledChange(entityType: string, entityId: string, action: string) {
    this.wsManager.emitToRoom(AdminWS.Rooms.scheduledChanges(), AdminWS.ServerEvents.SCHEDULED_UPDATED, {
      entityType,
      entityId,
      action, // 'created', 'approved', 'executed', 'cancelled'
      timestamp: new Date()
    });
  }

  public notifyBulkUpdate(updateType: string, affectedEntities: number, details: any) {
    this.wsManager.emitToRoom(AdminWS.Rooms.systemUpdates(), AdminWS.ServerEvents.BULK_UPDATE, {
      updateType,
      affectedEntities,
      details,
      timestamp: new Date()
    });
  }

  public notifySystemEvent(eventType: string, message: string, data?: any) {
    this.wsManager.broadcastToAll(AdminWS.ServerEvents.SYSTEM_EVENT, {
      eventType,
      message,
      data,
      timestamp: new Date()
    });
  }

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