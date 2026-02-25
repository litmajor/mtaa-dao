import { logger } from '../utils/logger';
import { NotificationService, EmailNotification, SMSNotification } from './notificationService';

/**
 * Payment Error Alert Service
 * Manages alert configuration, triggers, and escalation
 */

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AlertChannel {
  EMAIL = 'email',
  SMS = 'sms',
  BOTH = 'both',
}

export interface AlertTrigger {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: AlertCondition;
  actions: AlertAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  type:
    | 'error_count'
    | 'error_rate'
    | 'provider_health'
    | 'specific_error'
    | 'status_change';
  metric: string; // 'total_errors', 'error_rate_per_hour', etc.
  threshold: number;
  timeWindowSeconds: number; // Evaluate condition over this window
  operator: '>' | '<' | '>=' | '<=' | '==';
  enabled: boolean;
}

export interface AlertAction {
  type: 'notify' | 'escalate' | 'auto_recover';
  channel?: AlertChannel;
  recipients?: string[]; // Email addresses or phone numbers
  escalationLevel?: number; // 0 = initial, 1 = escalate to manager, 2 = escalate to director
  delaySeconds?: number; // Delay before action (for batching)
}

export interface AlertRecipient {
  id: string;
  email?: string;
  phoneNumber?: string;
  preferredChannel: AlertChannel;
  alertRoles: ('error_ops' | 'payment_ops' | 'director')[];
  doNotDisturbSchedule?: DoNotDisturbSchedule;
  enabled: boolean;
}

export interface DoNotDisturbSchedule {
  enabled: boolean;
  timezone: string; // e.g., 'America/New_York'
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  days: number[]; // 0 = Sunday, 6 = Saturday
}

export interface AlertHistory {
  triggerId: string;
  timestamp: Date;
  severity: AlertSeverity;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  notificationsSent: {
    channel: AlertChannel;
    recipient: string;
    success: boolean;
    messageId?: string;
  }[];
  escalationLevel: number;
}

/**
 * In-memory alert trigger storage
 */
class AlertManager {
  private triggers: Map<string, AlertTrigger> = new Map();
  private recipients: Map<string, AlertRecipient> = new Map();
  private history: AlertHistory[] = [];
  private maxHistory = 5000; // Keep last 5000 alerts
  private lastEvaluationTime: Map<string, Date> = new Map();
  private evaluationInterval = 60 * 1000; // Evaluate every minute

  constructor() {
    this.initializeDefaultTriggers();
    this.initializeDefaultRecipients();

    // Start evaluation loop
    setInterval(() => this.evaluateAllTriggers(), this.evaluationInterval);
  }

  /**
   * Initialize default alert triggers
   */
  private initializeDefaultTriggers(): void {
    // High error rate trigger
    this.triggers.set('high-error-rate', {
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds threshold',
      enabled: true,
      condition: {
        type: 'error_rate',
        metric: 'errors_per_hour',
        threshold: 50,
        timeWindowSeconds: 3600,
        operator: '>',
        enabled: true,
      },
      actions: [
        {
          type: 'notify',
          channel: AlertChannel.EMAIL,
          recipients: [], // Will be populated from recipient roles
          escalationLevel: 0,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Critical errors trigger
    this.triggers.set('critical-errors', {
      id: 'critical-errors',
      name: 'Critical Errors Detected',
      description: 'Alert when critical (5xx) errors exceed threshold',
      enabled: true,
      condition: {
        type: 'error_count',
        metric: 'critical_errors',
        threshold: 5,
        timeWindowSeconds: 600,
        operator: '>=',
        enabled: true,
      },
      actions: [
        {
          type: 'notify',
          channel: AlertChannel.BOTH,
          recipients: [],
          escalationLevel: 1,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Provider down trigger
    this.triggers.set('provider-down', {
      id: 'provider-down',
      name: 'Payment Provider Down',
      description: 'Alert when payment provider becomes unavailable',
      enabled: true,
      condition: {
        type: 'provider_health',
        metric: 'provider_status',
        threshold: 0, // 0 = down, 1 = healthy
        timeWindowSeconds: 300,
        operator: '==',
        enabled: true,
      },
      actions: [
        {
          type: 'notify',
          channel: AlertChannel.BOTH,
          recipients: [],
          escalationLevel: 2,
        },
        {
          type: 'auto_recover',
          delaySeconds: 30,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info('Initialized default alert triggers', {
      count: this.triggers.size,
    });
  }

  /**
   * Initialize default alert recipients
   */
  private initializeDefaultRecipients(): void {
    // Placeholder for default recipients - would be loaded from database in production
    logger.info('Alert recipients ready to be configured via API');
  }

  /**
   * Create or update an alert trigger
   */
  createOrUpdateTrigger(trigger: AlertTrigger): AlertTrigger {
    const now = new Date();
    trigger.updatedAt = now;
    if (!trigger.createdAt) {
      trigger.createdAt = now;
    }

    this.triggers.set(trigger.id, trigger);
    logger.info('Alert trigger created/updated', { triggerId: trigger.id, name: trigger.name });

    return trigger;
  }

  /**
   * Get trigger by ID
   */
  getTrigger(triggerId: string): AlertTrigger | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Get all triggers
   */
  getAllTriggers(): AlertTrigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Delete trigger
   */
  deleteTrigger(triggerId: string): boolean {
    const deleted = this.triggers.delete(triggerId);
    if (deleted) {
      logger.info('Alert trigger deleted', { triggerId });
    }
    return deleted;
  }

  /**
   * Register alert recipient
   */
  registerRecipient(recipient: AlertRecipient): AlertRecipient {
    this.recipients.set(recipient.id, recipient);
    logger.info('Alert recipient registered', {
      recipientId: recipient.id,
      email: recipient.email,
      roles: recipient.alertRoles,
    });
    return recipient;
  }

  /**
   * Get recipient by ID
   */
  getRecipient(recipientId: string): AlertRecipient | undefined {
    return this.recipients.get(recipientId);
  }

  /**
   * Get all recipients with role
   */
  getRecipientsByRole(role: 'error_ops' | 'payment_ops' | 'director'): AlertRecipient[] {
    return Array.from(this.recipients.values()).filter(
      r => r.enabled && r.alertRoles.includes(role)
    );
  }

  /**
   * Check if recipient is in do-not-disturb window
   */
  isInDoNotDisturb(recipient: AlertRecipient): boolean {
    if (!recipient.doNotDisturbSchedule || !recipient.doNotDisturbSchedule.enabled) {
      return false;
    }

    const schedule = recipient.doNotDisturbSchedule;
    const now = new Date();

    // TODO: Use timezone-aware date comparison
    // For now, use UTC times
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const currentDay = now.getUTCDay();

    const inTimeWindow = currentTime >= schedule.startTime && currentTime < schedule.endTime;
    const inScheduledDay = schedule.days.includes(currentDay);

    return inTimeWindow && inScheduledDay;
  }

  /**
   * Evaluate all triggers (called periodically)
   */
  private async evaluateAllTriggers(): Promise<void> {
    for (const trigger of this.triggers.values()) {
      if (!trigger.enabled) continue;

      // Avoid evaluating same trigger too frequently
      const lastEval = this.lastEvaluationTime.get(trigger.id);
      if (lastEval && Date.now() - lastEval.getTime() < 30000) {
        // Don't evaluate more than every 30 seconds
        continue;
      }

      try {
        await this.evaluateTrigger(trigger);
      } catch (error) {
        logger.error('Error evaluating alert trigger', {
          triggerId: trigger.id,
          error,
        });
      }

      this.lastEvaluationTime.set(trigger.id, new Date());
    }
  }

  /**
   * Evaluate a single trigger and fire if condition is met
   */
  private async evaluateTrigger(trigger: AlertTrigger): Promise<void> {
    // This would be called by the monitoring service
    // and would evaluate the trigger condition
    // For now, this is a placeholder
  }

  /**
   * Fire an alert manually (called from monitoring service)
   */
  async fireAlert(
    triggerId: string,
    severity: AlertSeverity,
    message: string,
    metric: string,
    value: number,
    threshold: number
  ): Promise<AlertHistory> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger || !trigger.enabled) {
      logger.warn('Alert trigger not found or disabled', { triggerId });
      throw new Error(`Alert trigger not found: ${triggerId}`);
    }

    const alert: AlertHistory = {
      triggerId,
      timestamp: new Date(),
      severity,
      message,
      metric,
      value,
      threshold,
      notificationsSent: [],
      escalationLevel: 0,
    };

    // Execute alert actions
    for (const action of trigger.actions) {
      if (action.type === 'notify') {
        alert.escalationLevel = action.escalationLevel || 0;
        await this.executeNotificationAction(alert, action, trigger);
      } else if (action.type === 'escalate') {
        alert.escalationLevel = (action.escalationLevel || 0) + 1;
      }
    }

    // Store in history
    this.history.push(alert);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    logger.info('Alert fired', {
      triggerId,
      severity,
      message,
      notificationsSent: alert.notificationsSent.length,
    });

    return alert;
  }

  /**
   * Execute notification action
   */
  private async executeNotificationAction(
    alert: AlertHistory,
    action: AlertAction,
    trigger: AlertTrigger
  ): Promise<void> {
    // Determine recipients based on escalation level
    let recipients: AlertRecipient[] = [];

    if (action.escalationLevel === 0) {
      // Initial notification - alert ops team
      recipients = this.getRecipientsByRole('error_ops');
    } else if (action.escalationLevel === 1) {
      // Escalate to payment ops manager
      recipients = this.getRecipientsByRole('payment_ops');
    } else if (action.escalationLevel >= 2) {
      // Escalate to director
      recipients = this.getRecipientsByRole('director');
    }

    // Filter out recipients in do-not-disturb
    const activeRecipients = recipients.filter(r => !this.isInDoNotDisturb(r));

    if (activeRecipients.length === 0) {
      logger.warn('No active recipients for alert action', {
        triggerId: trigger.id,
        escalationLevel: action.escalationLevel,
      });
      return;
    }

    // Send notifications
    const emailBody = `
Alert: ${alert.message}

Severity: ${alert.severity.toUpperCase()}
Trigger: ${trigger.name}
Time: ${alert.timestamp.toISOString()}

Metric: ${alert.metric}
Current Value: ${alert.value}
Threshold: ${alert.threshold}

Description: ${trigger.description}

Please investigate and take appropriate action.
    `.trim();

    const smsMessage = `[ALERT] ${trigger.name}: ${alert.message} (${alert.severity.toUpperCase()})`;

    for (const recipient of activeRecipients) {
      try {
        // Check for duplicate notifications
        const dupKey = `${trigger.id}_${recipient.id}`;
        if (NotificationService.isDuplicate(dupKey, 5)) {
          logger.debug('Skipping duplicate notification', {
            triggerId: trigger.id,
            recipientId: recipient.id,
          });
          continue;
        }

        let success = false;

        // Send email
        if (
          (action.channel === AlertChannel.EMAIL || action.channel === AlertChannel.BOTH) &&
          recipient.email
        ) {
          const emailResult = await NotificationService.sendEmail({
            to: recipient.email,
            subject: `[${alert.severity.toUpperCase()}] ${trigger.name}`,
            body: emailBody,
            bodyHtml: `<pre>${emailBody}</pre>`,
            priority: alert.severity === AlertSeverity.CRITICAL ? 'high' : 'normal',
          });

          alert.notificationsSent.push({
            channel: AlertChannel.EMAIL,
            recipient: recipient.email,
            success: emailResult.success,
            messageId: emailResult.messageId,
          });

          if (emailResult.success) {
            success = true;
          }
        }

        // Send SMS
        if (
          (action.channel === AlertChannel.SMS || action.channel === AlertChannel.BOTH) &&
          recipient.phoneNumber
        ) {
          const smsResult = await NotificationService.sendSMS({
            to: recipient.phoneNumber,
            message: smsMessage,
            priority: alert.severity === AlertSeverity.CRITICAL ? 'high' : 'normal',
          });

          alert.notificationsSent.push({
            channel: AlertChannel.SMS,
            recipient: recipient.phoneNumber,
            success: smsResult.success,
            messageId: smsResult.messageId,
          });

          if (smsResult.success) {
            success = true;
          }
        }

        if (!success) {
          logger.warn('Failed to send alert notification', {
            triggerId: trigger.id,
            recipientId: recipient.id,
          });
        }
      } catch (error) {
        logger.error('Error sending alert notification', {
          triggerId: trigger.id,
          recipientId: recipient.id,
          error,
        });
      }
    }
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): AlertHistory[] {
    return this.history.slice(-limit);
  }

  /**
   * Get alert history by trigger
   */
  getAlertHistoryByTrigger(triggerId: string, limit: number = 50): AlertHistory[] {
    return this.history
      .filter(a => a.triggerId === triggerId)
      .slice(-limit);
  }

  /**
   * Get alert history by severity
   */
  getAlertHistoryBySeverity(severity: AlertSeverity, limit: number = 50): AlertHistory[] {
    return this.history
      .filter(a => a.severity === severity)
      .slice(-limit);
  }

  /**
   * Clear alert history (for testing)
   */
  clearHistory(): void {
    this.history = [];
    logger.info('Alert history cleared');
  }
}

// Singleton instance
const alertManager = new AlertManager();

/**
 * Alert Service - Public API
 */
export const PaymentErrorAlertService = {
  // Trigger management
  createOrUpdateTrigger: (trigger: AlertTrigger) => alertManager.createOrUpdateTrigger(trigger),
  getTrigger: (triggerId: string) => alertManager.getTrigger(triggerId),
  getAllTriggers: () => alertManager.getAllTriggers(),
  deleteTrigger: (triggerId: string) => alertManager.deleteTrigger(triggerId),

  // Recipient management
  registerRecipient: (recipient: AlertRecipient) => alertManager.registerRecipient(recipient),
  getRecipient: (recipientId: string) => alertManager.getRecipient(recipientId),
  getRecipientsByRole: (role: 'error_ops' | 'payment_ops' | 'director') =>
    alertManager.getRecipientsByRole(role),

  // Alert firing
  fireAlert: (
    triggerId: string,
    severity: AlertSeverity,
    message: string,
    metric: string,
    value: number,
    threshold: number
  ) => alertManager.fireAlert(triggerId, severity, message, metric, value, threshold),

  // History
  getAlertHistory: (limit?: number) => alertManager.getAlertHistory(limit),
  getAlertHistoryByTrigger: (triggerId: string, limit?: number) =>
    alertManager.getAlertHistoryByTrigger(triggerId, limit),
  getAlertHistoryBySeverity: (severity: AlertSeverity, limit?: number) =>
    alertManager.getAlertHistoryBySeverity(severity, limit),
  clearHistory: () => alertManager.clearHistory(),
};

export default PaymentErrorAlertService;
