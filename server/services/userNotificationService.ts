/**
 * User Notification Service
 * Manages in-app and email notifications for payment events
 * Phase 3c Part 4 - User Notifications
 */

import { db } from '../db';
import { AppError } from '../utils/appError';
import { PaymentErrorMonitoringService } from './paymentErrorMonitoringService';
import { PaymentErrorAnalyticsService } from './paymentErrorAnalyticsService';

// Notification types
export enum NotificationType {
  PAYMENT_FAILURE = 'payment_failure',
  PAYMENT_SUCCESS = 'payment_success',
  RETRY_ATTEMPT = 'retry_attempt',
  RETRY_SUCCESS = 'retry_success',
  RETRY_FAILED = 'retry_failed',
  PAYMENT_ERROR = 'payment_error',
  RECOVERY_SUGGESTION = 'recovery_suggestion',
  SYSTEM_ALERT = 'system_alert',
  TRANSACTION_STATUS = 'transaction_status'
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  data?: Record<string, any>;
  actionUrl?: string;
  expiresAt?: Date;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  data: Record<string, any>;
  actionUrl?: string;
  isRead: boolean;
  readAt?: Date;
  deliveredAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  template: string;
  variables: string[]; // e.g., ['{errorCode}', '{provider}', '{amount}']
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserNotificationPreferences {
  userId: string;
  paymentFailureEmail: boolean;
  paymentFailureInApp: boolean;
  retryUpdatesEmail: boolean;
  retryUpdatesInApp: boolean;
  recoveryHintsEmail: boolean;
  recoveryHintsInApp: boolean;
  systemAlertsEmail: boolean;
  systemAlertsInApp: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly';
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDeliveryRecord {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  sentAt?: Date;
  failureReason?: string;
  retryCount: number;
  lastRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Notification Service
 * Handles creation, delivery, and management of user notifications
 */
class UserNotificationServiceImpl {
  private static instance: UserNotificationServiceImpl;
  private templates: Map<string, NotificationTemplate[]> = new Map();
  private preferences: Map<string, UserNotificationPreferences> = new Map();

  private constructor() {
    this.initializeDefaultTemplates();
  }

  static getInstance(): UserNotificationServiceImpl {
    if (!UserNotificationServiceImpl.instance) {
      UserNotificationServiceImpl.instance = new UserNotificationServiceImpl();
    }
    return UserNotificationServiceImpl.instance;
  }

  /**
   * Initialize default notification templates
   */
  private initializeDefaultTemplates(): void {
    // Payment failure template (in-app)
    this.templates.set('PAYMENT_FAILURE_IN_APP', [
      {
        id: 'tpl_payment_failure_in_app',
        type: NotificationType.PAYMENT_FAILURE,
        channel: NotificationChannel.IN_APP,
        title: 'Payment Failed',
        template: 'Your payment of {amount} {currency} failed: {errorMessage}. Error: {errorCode}',
        variables: ['amount', 'currency', 'errorMessage', 'errorCode', 'provider'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // Payment failure template (email)
    this.templates.set('PAYMENT_FAILURE_EMAIL', [
      {
        id: 'tpl_payment_failure_email',
        type: NotificationType.PAYMENT_FAILURE,
        channel: NotificationChannel.EMAIL,
        title: 'Payment Failed - Action Required',
        template: `
          <h2>Payment Failed</h2>
          <p>Your payment of {amount} {currency} failed.</p>
          <p><strong>Error:</strong> {errorCode}</p>
          <p><strong>Details:</strong> {errorMessage}</p>
          <p><strong>Provider:</strong> {provider}</p>
          <p>You can retry your payment or try a different payment method.</p>
          <p><a href="{actionUrl}">Retry Payment</a></p>
        `,
        variables: ['amount', 'currency', 'errorCode', 'errorMessage', 'provider', 'actionUrl'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // Retry attempt template
    this.templates.set('RETRY_ATTEMPT_IN_APP', [
      {
        id: 'tpl_retry_attempt_in_app',
        type: NotificationType.RETRY_ATTEMPT,
        channel: NotificationChannel.IN_APP,
        title: 'Retrying Payment',
        template: 'Retrying your payment of {amount} {currency}. Attempt {attempt} of {maxAttempts}.',
        variables: ['amount', 'currency', 'attempt', 'maxAttempts'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // Retry success template
    this.templates.set('RETRY_SUCCESS_IN_APP', [
      {
        id: 'tpl_retry_success_in_app',
        type: NotificationType.RETRY_SUCCESS,
        channel: NotificationChannel.IN_APP,
        title: 'Payment Successful',
        template: 'Great! Your payment of {amount} {currency} has been processed successfully.',
        variables: ['amount', 'currency'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // Recovery suggestion template
    this.templates.set('RECOVERY_SUGGESTION_IN_APP', [
      {
        id: 'tpl_recovery_suggestion_in_app',
        type: NotificationType.RECOVERY_SUGGESTION,
        channel: NotificationChannel.IN_APP,
        title: 'Payment Recovery Tips',
        template: 'To complete your payment, try: {suggestion}. You have {retries} retry attempts remaining.',
        variables: ['suggestion', 'retries'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // System alert template
    this.templates.set('SYSTEM_ALERT_IN_APP', [
      {
        id: 'tpl_system_alert_in_app',
        type: NotificationType.SYSTEM_ALERT,
        channel: NotificationChannel.IN_APP,
        title: 'System Notice',
        template: '{message}',
        variables: ['message'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  }

  /**
   * Create and send a notification to user
   */
  async createNotification(payload: NotificationPayload): Promise<UserNotification> {
    try {
      // Get user preferences
      const prefs = await this.getUserPreferences(payload.userId);

      // Filter channels based on user preferences
      const channels = this.filterChannelsByPreferences(payload.type, prefs, payload.channels);

      if (channels.length === 0) {
        throw new AppError('No delivery channels enabled for user', 400);
      }

      // Create notification record in database
      const notification = await db.query(
        `INSERT INTO user_notifications (user_id, type, title, message, priority, channels, data, action_url, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          payload.userId,
          payload.type,
          payload.title,
          payload.message,
          payload.priority,
          JSON.stringify(channels),
          JSON.stringify(payload.data || {}),
          payload.actionUrl || null,
          payload.expiresAt || null
        ]
      );

      const notificationId = notification.rows[0].id;

      // Create delivery records for each channel
      for (const channel of channels) {
        await db.query(
          `INSERT INTO notification_deliveries (notification_id, channel, status)
           VALUES ($1, $2, $3)`,
          [notificationId, channel, 'pending']
        );
      }

      // Send notifications asynchronously
      this.sendNotificationAsync(notificationId, payload, channels);

      return {
        id: notification.rows[0].id,
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        priority: payload.priority,
        channels,
        data: payload.data || {},
        actionUrl: payload.actionUrl,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send notification async to all channels
   */
  private async sendNotificationAsync(
    notificationId: string,
    payload: NotificationPayload,
    channels: NotificationChannel[]
  ): Promise<void> {
    for (const channel of channels) {
      try {
        if (channel === NotificationChannel.IN_APP) {
          await this.sendInAppNotification(notificationId);
        } else if (channel === NotificationChannel.EMAIL) {
          await this.sendEmailNotification(notificationId, payload);
        } else if (channel === NotificationChannel.SMS) {
          await this.sendSmsNotification(notificationId, payload);
        }
      } catch (error) {
        console.error(`Error sending ${channel} notification ${notificationId}:`, error);
        await this.recordDeliveryFailure(notificationId, channel, error);
      }
    }
  }

  /**
   * Send in-app notification (just mark as sent)
   */
  private async sendInAppNotification(notificationId: string): Promise<void> {
    await db.query(
      `UPDATE notification_deliveries SET status = $1, sent_at = $2
       WHERE notification_id = $3 AND channel = $4`,
      ['sent', new Date(), notificationId, NotificationChannel.IN_APP]
    );
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notificationId: string, payload: NotificationPayload): Promise<void> {
    try {
      // Get user email
      const userResult = await db.query('SELECT email FROM users WHERE id = $1', [payload.userId]);
      if (userResult.rows.length === 0) {
        throw new AppError('User not found', 404);
      }

      const email = userResult.rows[0].email;

      // Get email template
      const templates = this.templates.get(`${payload.type.toUpperCase()}_EMAIL`);
      const template = templates?.[0];

      if (!template) {
        throw new AppError(`No email template for ${payload.type}`, 400);
      }

      // Compile template with variables
      const compiledTemplate = this.compileTemplate(template.template, payload.data || {});

      // Send email (integration point)
      // This would integrate with email service (SendGrid, AWS SES, etc.)
      console.log(`[EMAIL] To: ${email}, Subject: ${payload.title}, Body: ${compiledTemplate}`);

      // Mark as sent
      await db.query(
        `UPDATE notification_deliveries SET status = $1, sent_at = $2
         WHERE notification_id = $3 AND channel = $4`,
        ['sent', new Date(), notificationId, NotificationChannel.EMAIL]
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(notificationId: string, payload: NotificationPayload): Promise<void> {
    try {
      // Get user phone
      const userResult = await db.query('SELECT phone FROM users WHERE id = $1', [payload.userId]);
      if (userResult.rows.length === 0) {
        throw new AppError('User not found', 404);
      }

      const phone = userResult.rows[0].phone;
      if (!phone) {
        throw new AppError('User phone number not configured', 400);
      }

      // Create SMS message
      const message = `${payload.title}: ${payload.message}`;

      // Send SMS (integration point)
      // This would integrate with SMS service (Twilio, AWS SNS, etc.)
      console.log(`[SMS] To: ${phone}, Message: ${message}`);

      // Mark as sent
      await db.query(
        `UPDATE notification_deliveries SET status = $1, sent_at = $2
         WHERE notification_id = $3 AND channel = $4`,
        ['sent', new Date(), notificationId, NotificationChannel.SMS]
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Record delivery failure
   */
  private async recordDeliveryFailure(
    notificationId: string,
    channel: NotificationChannel,
    error: any
  ): Promise<void> {
    const failureReason = error instanceof Error ? error.message : String(error);

    await db.query(
      `UPDATE notification_deliveries 
       SET status = $1, failure_reason = $2, retry_count = retry_count + 1, last_retry_at = $3
       WHERE notification_id = $4 AND channel = $5`,
      ['failed', failureReason, new Date(), notificationId, channel]
    );
  }

  /**
   * Filter channels based on user preferences
   */
  private filterChannelsByPreferences(
    type: NotificationType,
    prefs: UserNotificationPreferences,
    requestedChannels: NotificationChannel[]
  ): NotificationChannel[] {
    const filtered: NotificationChannel[] = [];

    for (const channel of requestedChannels) {
      let allowed = false;

      if (type === NotificationType.PAYMENT_FAILURE) {
        allowed =
          (channel === NotificationChannel.EMAIL && prefs.paymentFailureEmail) ||
          (channel === NotificationChannel.IN_APP && prefs.paymentFailureInApp);
      } else if (type === NotificationType.RETRY_ATTEMPT || type === NotificationType.RETRY_SUCCESS) {
        allowed =
          (channel === NotificationChannel.EMAIL && prefs.retryUpdatesEmail) ||
          (channel === NotificationChannel.IN_APP && prefs.retryUpdatesInApp);
      } else if (type === NotificationType.RECOVERY_SUGGESTION) {
        allowed =
          (channel === NotificationChannel.EMAIL && prefs.recoveryHintsEmail) ||
          (channel === NotificationChannel.IN_APP && prefs.recoveryHintsInApp);
      } else if (type === NotificationType.SYSTEM_ALERT) {
        allowed =
          (channel === NotificationChannel.EMAIL && prefs.systemAlertsEmail) ||
          (channel === NotificationChannel.IN_APP && prefs.systemAlertsInApp);
      } else {
        allowed = true;
      }

      if (allowed) {
        filtered.push(channel);
      }
    }

    return filtered;
  }

  /**
   * Get user notifications (paginated)
   */
  async getUserNotifications(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number; offset?: number }
  ): Promise<{ notifications: UserNotification[]; total: number; unread: number }> {
    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      const unreadOnly = options?.unreadOnly || false;

      let query = 'SELECT * FROM user_notifications WHERE user_id = $1';
      let countQuery = 'SELECT COUNT(*) as count FROM user_notifications WHERE user_id = $1';
      let unreadQuery = 'SELECT COUNT(*) as count FROM user_notifications WHERE user_id = $1 AND is_read = false';

      if (unreadOnly) {
        query += ' AND is_read = false';
      }

      query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';

      const [notificationsResult, countResult, unreadResult] = await Promise.all([
        db.query(query, [userId, limit, offset]),
        db.query(countQuery, [userId]),
        db.query(unreadQuery, [userId])
      ]);

      return {
        notifications: notificationsResult.rows.map(row => this.mapRowToNotification(row)),
        total: countResult.rows[0].count,
        unread: unreadResult.rows[0].count
      };
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<UserNotification> {
    try {
      const result = await db.query(
        `UPDATE user_notifications 
         SET is_read = true, read_at = $1
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [new Date(), notificationId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Notification not found', 404);
      }

      return this.mapRowToNotification(result.rows[0]);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    try {
      const result = await db.query(
        `UPDATE user_notifications 
         SET is_read = true, read_at = $1
         WHERE user_id = $2 AND is_read = false`,
        [new Date(), userId]
      );

      return { updated: result.rowCount || 0 };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      const result = await db.query(
        `DELETE FROM user_notifications WHERE id = $1 AND user_id = $2`,
        [notificationId, userId]
      );

      if (result.rowCount === 0) {
        throw new AppError('Notification not found', 404);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<UserNotificationPreferences> {
    try {
      const cached = this.preferences.get(userId);
      if (cached) {
        return cached;
      }

      const result = await db.query(
        'SELECT * FROM user_notification_preferences WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        const prefs = result.rows[0];
        const preferences: UserNotificationPreferences = {
          userId,
          paymentFailureEmail: prefs.payment_failure_email,
          paymentFailureInApp: prefs.payment_failure_in_app,
          retryUpdatesEmail: prefs.retry_updates_email,
          retryUpdatesInApp: prefs.retry_updates_in_app,
          recoveryHintsEmail: prefs.recovery_hints_email,
          recoveryHintsInApp: prefs.recovery_hints_in_app,
          systemAlertsEmail: prefs.system_alerts_email,
          systemAlertsInApp: prefs.system_alerts_in_app,
          emailFrequency: prefs.email_frequency,
          createdAt: prefs.created_at,
          updatedAt: prefs.updated_at
        };

        this.preferences.set(userId, preferences);
        return preferences;
      }

      // Return default preferences
      const defaultPrefs: UserNotificationPreferences = {
        userId,
        paymentFailureEmail: true,
        paymentFailureInApp: true,
        retryUpdatesEmail: true,
        retryUpdatesInApp: true,
        recoveryHintsEmail: true,
        recoveryHintsInApp: true,
        systemAlertsEmail: false,
        systemAlertsInApp: true,
        emailFrequency: 'immediate',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save default preferences
      await db.query(
        `INSERT INTO user_notification_preferences 
         (user_id, payment_failure_email, payment_failure_in_app, retry_updates_email, retry_updates_in_app,
          recovery_hints_email, recovery_hints_in_app, system_alerts_email, system_alerts_in_app, email_frequency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          defaultPrefs.paymentFailureEmail,
          defaultPrefs.paymentFailureInApp,
          defaultPrefs.retryUpdatesEmail,
          defaultPrefs.retryUpdatesInApp,
          defaultPrefs.recoveryHintsEmail,
          defaultPrefs.recoveryHintsInApp,
          defaultPrefs.systemAlertsEmail,
          defaultPrefs.systemAlertsInApp,
          defaultPrefs.emailFrequency
        ]
      );

      this.preferences.set(userId, defaultPrefs);
      return defaultPrefs;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, updates: Partial<UserNotificationPreferences>): Promise<UserNotificationPreferences> {
    try {
      const current = await this.getUserPreferences(userId);
      const updated = { ...current, ...updates, userId, updatedAt: new Date() };

      await db.query(
        `UPDATE user_notification_preferences 
         SET payment_failure_email = $1, payment_failure_in_app = $2, 
             retry_updates_email = $3, retry_updates_in_app = $4,
             recovery_hints_email = $5, recovery_hints_in_app = $6,
             system_alerts_email = $7, system_alerts_in_app = $8,
             email_frequency = $9
         WHERE user_id = $10`,
        [
          updated.paymentFailureEmail,
          updated.paymentFailureInApp,
          updated.retryUpdatesEmail,
          updated.retryUpdatesInApp,
          updated.recoveryHintsEmail,
          updated.recoveryHintsInApp,
          updated.systemAlertsEmail,
          updated.systemAlertsInApp,
          updated.emailFrequency,
          userId
        ]
      );

      this.preferences.set(userId, updated);
      return updated;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  /**
   * Compile notification template with variables
   */
  private compileTemplate(template: string, data: Record<string, any>): string {
    let compiled = template;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{${key}}`;
      compiled = compiled.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return compiled;
  }

  /**
   * Create payment failure notification with recovery suggestions
   */
  async createPaymentFailureNotification(
    userId: string,
    paymentData: {
      amount: number;
      currency: string;
      errorCode: string;
      errorMessage: string;
      provider: string;
      transactionId: string;
      retryAttempt?: number;
      maxRetries?: number;
    }
  ): Promise<UserNotification> {
    try {
      // Get root cause analysis for better suggestions
      const analytics = PaymentErrorAnalyticsService.getInstance();
      const rootCause = analytics.analyzeRootCause(paymentData.errorCode);
      const mttr = analytics.calculateMTTR(paymentData.errorCode);

      // Create notification with recovery data
      return await this.createNotification({
        userId,
        type: NotificationType.PAYMENT_FAILURE,
        title: 'Payment Failed',
        message: `Your payment of ${paymentData.amount} ${paymentData.currency} failed. Error: ${paymentData.errorCode}`,
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        data: {
          amount: paymentData.amount,
          currency: paymentData.currency,
          errorCode: paymentData.errorCode,
          errorMessage: paymentData.errorMessage,
          provider: paymentData.provider,
          transactionId: paymentData.transactionId,
          retryAttempt: paymentData.retryAttempt || 1,
          maxRetries: paymentData.maxRetries || 3,
          rootCause: rootCause.primaryCause,
          recoveryRate: mttr.recoveryRate,
          averageRecoveryTime: mttr.meanTimeToRecovery,
          recommendations: rootCause.recommendations
        },
        actionUrl: `/payments/${paymentData.transactionId}/retry`
      });
    } catch (error) {
      console.error('Error creating payment failure notification:', error);
      throw error;
    }
  }

  /**
   * Create recovery suggestion notification
   */
  async createRecoverySuggestionNotification(
    userId: string,
    errorCode: string,
    suggestion: string,
    retriesRemaining: number
  ): Promise<UserNotification> {
    try {
      return await this.createNotification({
        userId,
        type: NotificationType.RECOVERY_SUGGESTION,
        title: 'Payment Recovery Tip',
        message: suggestion,
        priority: NotificationPriority.MEDIUM,
        channels: [NotificationChannel.IN_APP],
        data: {
          errorCode,
          suggestion,
          retriesRemaining
        }
      });
    } catch (error) {
      console.error('Error creating recovery suggestion:', error);
      throw error;
    }
  }

  /**
   * Create retry status notification
   */
  async createRetryStatusNotification(
    userId: string,
    amount: number,
    currency: string,
    attempt: number,
    maxAttempts: number
  ): Promise<UserNotification> {
    try {
      return await this.createNotification({
        userId,
        type: NotificationType.RETRY_ATTEMPT,
        title: 'Retrying Payment',
        message: `Attempting to process your payment of ${amount} ${currency}. Attempt ${attempt} of ${maxAttempts}.`,
        priority: NotificationPriority.MEDIUM,
        channels: [NotificationChannel.IN_APP],
        data: {
          amount,
          currency,
          attempt,
          maxAttempts
        }
      });
    } catch (error) {
      console.error('Error creating retry status notification:', error);
      throw error;
    }
  }

  /**
   * Create successful payment notification
   */
  async createPaymentSuccessNotification(
    userId: string,
    amount: number,
    currency: string,
    transactionId: string
  ): Promise<UserNotification> {
    try {
      return await this.createNotification({
        userId,
        type: NotificationType.PAYMENT_SUCCESS,
        title: 'Payment Successful',
        message: `Your payment of ${amount} ${currency} has been processed successfully.`,
        priority: NotificationPriority.LOW,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        data: {
          amount,
          currency,
          transactionId
        }
      });
    } catch (error) {
      console.error('Error creating payment success notification:', error);
      throw error;
    }
  }

  /**
   * Map database row to UserNotification object
   */
  private mapRowToNotification(row: any): UserNotification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      priority: row.priority,
      channels: JSON.parse(row.channels),
      data: JSON.parse(row.data || '{}'),
      actionUrl: row.action_url,
      isRead: row.is_read,
      readAt: row.read_at,
      deliveredAt: row.delivered_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export singleton instance
export const UserNotificationService = UserNotificationServiceImpl.getInstance();
