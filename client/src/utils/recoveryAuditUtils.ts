/**
 * Recovery and Audit Utilities
 * Day 3 - Helper functions for soft delete recovery and audit logging
 */

import { formatDistanceToNow, differenceInDays } from 'date-fns';

/**
 * Calculate days remaining in recovery window
 */
export function calculateDaysRemaining(recoveryDeadline: string | Date): number {
  const deadline = typeof recoveryDeadline === 'string' ? new Date(recoveryDeadline) : recoveryDeadline;
  const days = differenceInDays(deadline, new Date());
  return Math.max(0, days);
}

/**
 * Determine if item is expired (recovery window passed)
 */
export function isRecoveryExpired(recoveryDeadline: string | Date): boolean {
  return calculateDaysRemaining(recoveryDeadline) <= 0;
}

/**
 * Determine if item is expiring soon (< 3 days)
 */
export function isExpiringoon(recoveryDeadline: string | Date): boolean {
  const daysRemaining = calculateDaysRemaining(recoveryDeadline);
  return daysRemaining > 0 && daysRemaining <= 3;
}

/**
 * Format status badge text for recovery item
 */
export function getRecoveryStatusBadge(recoveryDeadline: string | Date, isDeleted: boolean): {
  text: string;
  variant: 'default' | 'destructive' | 'secondary' | 'outline';
  icon?: string;
} {
  if (!isDeleted) {
    return { text: 'Active', variant: 'default' };
  }

  if (isRecoveryExpired(recoveryDeadline)) {
    return { text: 'Expired', variant: 'destructive', icon: 'AlertTriangle' };
  }

  if (isExpiringoon(recoveryDeadline)) {
    return { text: 'Expiring Soon', variant: 'secondary', icon: 'AlertTriangle' };
  }

  const daysRemaining = calculateDaysRemaining(recoveryDeadline);
  return { text: `${daysRemaining} days`, variant: 'outline' };
}

/**
 * Format recovery deadline for display
 */
export function formatRecoveryDeadline(recoveryDeadline: string | Date): string {
  return formatDistanceToNow(new Date(recoveryDeadline), { addSuffix: true });
}

/**
 * Group audit logs by action type for statistics
 */
export function groupAuditByActionType(logs: any[]): Record<string, number> {
  return logs.reduce(
    (acc, log) => {
      acc[log.action_type] = (acc[log.action_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Group audit logs by result for statistics
 */
export function groupAuditByResult(logs: any[]): Record<string, number> {
  return logs.reduce(
    (acc, log) => {
      acc[log.result] = (acc[log.result] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Group audit logs by actor for statistics
 */
export function groupAuditByActor(logs: any[]): Record<string, number> {
  return logs.reduce(
    (acc, log) => {
      acc[log.actor_id] = (acc[log.actor_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Calculate success rate for audit logs
 */
export function calculateSuccessRate(logs: any[]): number {
  if (logs.length === 0) return 0;
  const successCount = logs.filter(log => log.result === 'success').length;
  return successCount / logs.length;
}

/**
 * Filter audit logs by date range
 */
export function filterAuditByDateRange(
  logs: any[],
  startDate?: Date,
  endDate?: Date
): any[] {
  return logs.filter(log => {
    const logDate = new Date(log.created_at);
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;
    return true;
  });
}

/**
 * Filter audit logs by actor and action type
 */
export function filterAuditByActorAndAction(
  logs: any[],
  actorId?: string,
  actionType?: string
): any[] {
  return logs.filter(log => {
    if (actorId && log.actor_id !== actorId) return false;
    if (actionType && log.action_type !== actionType) return false;
    return true;
  });
}

/**
 * Get high-severity actions for dashboard alerts
 */
export function getHighSeverityActions(logs: any[]): any[] {
  const severityActions = [
    'user_deleted',
    'dao_deleted',
    'admin_deleted',
    'permission_changed',
    'audit_override',
  ];

  return logs.filter(log =>
    severityActions.includes(log.action_type) && log.result === 'failure'
  );
}

/**
 * Validate recovery request parameters
 */
export function validateRecoveryRequest(
  targetType: string,
  targetId: string,
  reason: string
): { valid: boolean; error?: string } {
  if (!['user', 'dao', 'admin_user'].includes(targetType)) {
    return { valid: false, error: 'Invalid target type' };
  }

  if (!targetId || targetId.trim().length === 0) {
    return { valid: false, error: 'Target ID is required' };
  }

  if (!reason || reason.trim().length === 0) {
    return { valid: false, error: 'Reason is required' };
  }

  if (reason.length > 500) {
    return { valid: false, error: 'Reason must be less than 500 characters' };
  }

  return { valid: true };
}

/**
 * Validate permanent delete request
 */
export function validatePermanentDeleteRequest(
  daysRemaining: number,
  reason: string,
  confirmDelete: boolean
): { valid: boolean; error?: string } {
  if (daysRemaining > 0) {
    return { valid: false, error: 'Recovery window has not expired yet' };
  }

  if (!reason || reason.trim().length === 0) {
    return { valid: false, error: 'Reason is required' };
  }

  if (!confirmDelete) {
    return { valid: false, error: 'Permanent deletion must be explicitly confirmed' };
  }

  return { valid: true };
}

/**
 * Format audit log entry for display
 */
export function formatAuditLogEntry(log: any): {
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  result: 'success' | 'failure';
} {
  return {
    actor: log.actor_id.substring(0, 8),
    action: log.action_type,
    target: `${log.target_type}:${log.target_name}`,
    timestamp: formatDistanceToNow(new Date(log.created_at), { addSuffix: true }),
    result: log.result as 'success' | 'failure',
  };
}

/**
 * Generate audit summary report
 */
export function generateAuditSummary(logs: any[]): {
  totalActions: number;
  totalSuccessful: number;
  totalFailed: number;
  successRate: number;
  topActors: Array<{ actor: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  dateRange: { start: string; end: string } | null;
} {
  if (logs.length === 0) {
    return {
      totalActions: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      successRate: 0,
      topActors: [],
      topActions: [],
      dateRange: null,
    };
  }

  const successful = logs.filter(l => l.result === 'success').length;
  const failed = logs.filter(l => l.result === 'failure').length;

  const actorCounts = groupAuditByActor(logs);
  const actionCounts = groupAuditByActionType(logs);

  const dates = logs.map(l => new Date(l.created_at)).sort((a, b) => a.getTime() - b.getTime());

  return {
    totalActions: logs.length,
    totalSuccessful: successful,
    totalFailed: failed,
    successRate: successful / logs.length,
    topActors: Object.entries(actorCounts)
      .map(([actor, count]) => ({ actor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topActions: Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    dateRange:
      dates.length > 0
        ? { start: dates[0].toISOString(), end: dates[dates.length - 1].toISOString() }
        : null,
  };
}

/**
 * Export recovery items to CSV
 */
export function exportRecoveryItemsToCSV(items: any[]): string {
  const headers = [
    'Type',
    'Name',
    'Deleted At',
    'Deleted By',
    'Deletion Reason',
    'Days Remaining',
    'Recovery Deadline',
    'Status',
  ];

  const rows = items.map(item => [
    item.type,
    item.name,
    item.deletedAt,
    item.deletedBy,
    item.reason,
    item.daysRemaining,
    item.recoveryDeadline,
    item.isExpired ? 'Expired' : item.isExpiringSoon ? 'Expiring Soon' : 'Recoverable',
  ]);

  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}
