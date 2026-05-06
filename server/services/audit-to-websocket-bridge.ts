/**
 * Audit Service to WebSocket Bridge
 * Converts audit events to real-time WebSocket broadcasts
 * 
 * Automatically emits WebSocket events when audit events occur
 * Enables real-time activity feeds, status updates, and notifications
 */

import { AuditService, AuditEvent } from '../core/consolidation/AuditServiceConsolidation';
import type { AuditEventType, AuditSeverity } from '../core/consolidation/AuditServiceConsolidation';
import { WebSocketEventEmitter, getEventEmitter } from '../middleware/websocket-event-emitter';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

/**
 * Map audit severity to alert severity
 * Audit severities: 'info' | 'warning' | 'error' | 'critical'
 * Alert severities: 'low' | 'medium' | 'high' | 'critical'
 */
function mapAuditSeverityToAlertSeverity(auditSeverity: AuditSeverity): 'low' | 'medium' | 'high' | 'critical' {
  const severityMap: Record<AuditSeverity, 'low' | 'medium' | 'high' | 'critical'> = {
    'info': 'low',
    'warning': 'medium',
    'error': 'high',
    'critical': 'critical'
  };
  return severityMap[auditSeverity] || 'low';
}

/**
 * Register WebSocket listener with audit service
 * Converts audit events to WebSocket broadcasts
 */
export function registerWebSocketAuditListener(auditService: AuditService): () => void {
  return auditService.onEvent(async (event: AuditEvent) => {
    try {
      const wsEmitter = getEventEmitter();
      const userId = event.actor.userId || event.actor.agentId || 'system';

      // Route audit events to appropriate WebSocket events based on type
      switch (event.type) {
        case 'USER_ACTION':
          emitUserActivityEvent(wsEmitter, event, userId);
          break;
        case 'OPERATIONAL':
          emitOperationalEvent(wsEmitter, event, userId);
          break;
        case 'TRADING':
          emitTradingEvent(wsEmitter, event, userId);
          break;
        case 'GOVERNANCE':
          emitGovernanceEvent(wsEmitter, event, userId);
          break;
        case 'VAULT':
          emitVaultEvent(wsEmitter, event, userId);
          break;
        case 'SECURITY':
          emitSecurityEvent(wsEmitter, event, userId);
          break;
        case 'AGENT':
          emitAgentEvent(wsEmitter, event, userId);
          break;
        case 'COMPLIANCE':
          emitComplianceEvent(wsEmitter, event, userId);
          break;
        case 'CUSTOM':
          emitCustomEvent(wsEmitter, event, userId);
          break;
      }

      // Emit critical alerts for any failed operations
      if (!event.success && event.severity === 'critical') {
        wsEmitter.emitAlert(
          'audit_failure_critical',
          'critical',
          `${event.action} failed: ${event.errorMessage || 'Unknown error'}`,
          userId,
          {
            eventId: event.id,
            eventType: event.type,
            resource: event.resource,
            errorMessage: event.errorMessage,
            correlationId: event.correlationId
          }
        );
      }
    } catch (error) {
      logger.warn('Failed to emit WebSocket audit event:', {
        error,
        eventType: event.type,
        action: event.action
      });
    }
  });
}

/**
 * Emit user activity as WebSocket event
 */
function emitUserActivityEvent(emitter: WebSocketEventEmitter, event: AuditEvent, userId: string): void {
  emitter.emitActivity(
    event.resource.type,
    event.resource.id,
    userId,
    event.action,
    {
      auditEventId: event.id,
      correlationId: event.correlationId,
      ...event.context
    }
  );
}

/**
 * Emit operational changes as WebSocket event
 */
function emitOperationalEvent(emitter: WebSocketEventEmitter, event: AuditEvent, userId: string): void {
  emitter.emitSystemEvent(
    'operational_change',
    `${event.action} on ${event.resource.type} ${event.resource.id}`,
    userId,
    {
      auditEventId: event.id,
      severity: event.severity,
      resource: event.resource,
      changes: event.changes,
      correlationId: event.correlationId
    }
  );

  // If operational change is critical, send alert
  if (event.severity === 'critical' || event.severity === 'warning') {
    emitter.emitAlert(
      'operational_alert',
      mapAuditSeverityToAlertSeverity(event.severity),
      `${event.action} on ${event.resource.type}`,
      userId,
      {
        eventId: event.id,
        resource: event.resource,
        correlationId: event.correlationId
      }
    );
  }
}

/**
 * Emit trading operations as status/activity updates
 */
function emitTradingEvent(emitter: WebSocketEventEmitter, event: AuditEvent, userId: string): void {
  emitter.emitActivity(
    'trading',
    event.resource.id,
    userId,
    event.action,
    {
      auditEventId: event.id,
      success: event.success,
      ...event.context
    }
  );

  // If trading operation failed, send alert
  if (!event.success) {
    emitter.emitAlert(
      'trading_error',
      mapAuditSeverityToAlertSeverity(event.severity),
      `Trading operation failed: ${event.action}`,
      userId,
      {
        eventId: event.id,
        resource: event.resource,
        error: event.errorMessage
      }
    );
  }
}

/**
 * Emit governance events (voting, proposals)
 */
function emitGovernanceEvent(emitter: WebSocketEventEmitter, event: AuditEvent, userId: string): void {
  // Governance events should trigger approval/vote updates
  if (event.resource.type.includes('proposal') || event.resource.type.includes('vote')) {
    emitter.emitApprovalUpdate(
      event.resource.type,
      event.resource.id,
      event.action,
      userId,
      event.context
    );
  } else {
    emitter.emitActivity(
      event.resource.type,
      event.resource.id,
      userId,
      event.action,
      event.context
    );
  }
}

/**
 * Emit vault operations
 */
function emitVaultEvent(emitter: WebSocketEventEmitter, event: AuditEvent, userId: string): void {
  emitter.emitActivity(
    event.resource.type,
    event.resource.id,
    userId,
    event.action,
    {
      auditEventId: event.id,
      success: event.success,
      ...event.context
    }
  );

  // Emit status change if withdrawal/deposit
  if (['deposit', 'withdraw', 'transfer'].includes(event.action.toLowerCase())) {
    emitter.emitStatusChange(
      event.resource.type,
      event.resource.id,
      event.action,
      userId,
      event.context
    );
  }
}

/**
 * Emit security events (auth, permissions)
 */
function emitSecurityEvent(emitter: WebSocketEventEmitter, event: AuditEvent, userId: string): void {
  // Security events should be high priority
  const severity = event.success ? ('low' as const) : ('high' as const);

  emitter.emitAlert(
    'security_event',
    severity,
    `${event.action}: ${event.resource.type}`,
    userId,
    {
      eventId: event.id,
      category: 'security',
      resource: event.resource,
      correlationId: event.correlationId
    }
  );

  // Also log as activity
  emitter.emitActivity(
    event.resource.type,
    event.resource.id,
    userId,
    event.action,
    event.context
  );
}

/**
 * Emit agent lifecycle events
 */
function emitAgentEvent(emitter: WebSocketEventEmitter, event: AuditEvent, userId: string): void {
  emitter.emitSystemEvent(
    'agent_event',
    `Agent ${event.action}: ${event.resource.id}`,
    userId,
    {
      auditEventId: event.id,
      resource: event.resource,
      ...event.context
    }
  );

  // Status changes for agent creation, deactivation, etc.
  if (['create', 'activate', 'deactivate', 'update'].includes(event.action.toLowerCase())) {
    emitter.emitStatusChange(
      'agent',
      event.resource.id,
      event.action,
      userId,
      event.context
    );
  }
}

/**
 * Emit compliance events
 */
function emitComplianceEvent(emitter: WebSocketEventEmitter, event: AuditEvent, userId: string): void {
  // Compliance events are always important
  emitter.emitAlert(
    'compliance_alert',
    mapAuditSeverityToAlertSeverity(event.severity),
    `${event.action}: ${event.resource.type}`,
    userId,
    {
      eventId: event.id,
      category: 'compliance',
      resource: event.resource,
      ...event.context,
      correlationId: event.correlationId
    }
  );
}

/**
 * Emit custom domain-specific events
 */
function emitCustomEvent(emitter: WebSocketEventEmitter, event: AuditEvent, userId: string): void {
  // For custom events, emit as activity/system event based on context
  if (event.context?.asAlert) {
    emitter.emitAlert(
      event.context?.alertType || 'custom_event',
      event.severity,
      event.action,
      userId,
      event.context
    );
  } else {
    emitter.emitSystemEvent(
      event.resource.type,
      event.action,
      userId,
      event.context || {}
    );
  }
}

export default { registerWebSocketAuditListener };
