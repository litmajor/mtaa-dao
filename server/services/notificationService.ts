import { logger } from '../utils/logger';

/**
 * Notification Service
 * Handles email and SMS notifications for payment system alerts
 */

export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  cc?: string[];
  bcc?: string[];
  priority?: 'high' | 'normal' | 'low';
}

export interface SMSNotification {
  to: string;
  message: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
  provider: string;
}

/**
 * Email Provider Interface
 */
interface EmailProvider {
  send(notification: EmailNotification): Promise<NotificationResult>;
}

/**
 * SMS Provider Interface
 */
interface SMSProvider {
  send(notification: SMSNotification): Promise<NotificationResult>;
}

/**
 * Mock Email Provider (for development/testing)
 */
class MockEmailProvider implements EmailProvider {
  async send(notification: EmailNotification): Promise<NotificationResult> {
    logger.info('Mock email sent', {
      to: notification.to,
      subject: notification.subject,
    });

    return {
      success: true,
      messageId: `mock-email-${Date.now()}`,
      timestamp: new Date(),
      provider: 'mock-email',
    };
  }
}

/**
 * Mock SMS Provider (for development/testing)
 */
class MockSMSProvider implements SMSProvider {
  async send(notification: SMSNotification): Promise<NotificationResult> {
    logger.info('Mock SMS sent', {
      to: notification.to,
      message: notification.message.substring(0, 50) + '...',
    });

    return {
      success: true,
      messageId: `mock-sms-${Date.now()}`,
      timestamp: new Date(),
      provider: 'mock-sms',
    };
  }
}

/**
 * SendGrid Email Provider (for production)
 */
class SendGridEmailProvider implements EmailProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SENDGRID_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('SendGrid API key not configured. Falling back to mock provider.');
    }
  }

  async send(notification: EmailNotification): Promise<NotificationResult> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'SendGrid API key not configured',
          timestamp: new Date(),
          provider: 'sendgrid',
        };
      }

      // Simulate SendGrid API call
      // In production, use @sendgrid/mail package
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: notification.to }],
              cc: notification.cc?.map(email => ({ email })),
              bcc: notification.bcc?.map(email => ({ email })),
            },
          ],
          from: { email: 'alerts@mtaadao.io', name: 'MTAA Payment Alerts' },
          subject: notification.subject,
          content: [
            {
              type: 'text/plain',
              value: notification.body,
            },
            ...(notification.bodyHtml
              ? [{ type: 'text/html', value: notification.bodyHtml }]
              : []),
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('SendGrid API error', { status: response.status, error });
        return {
          success: false,
          error: `SendGrid error: ${response.statusText}`,
          timestamp: new Date(),
          provider: 'sendgrid',
        };
      }

      return {
        success: true,
        messageId: response.headers.get('X-Message-ID') || `sg-${Date.now()}`,
        timestamp: new Date(),
        provider: 'sendgrid',
      };
    } catch (error) {
      logger.error('SendGrid send error', { error });
      return {
        success: false,
        error: String(error),
        timestamp: new Date(),
        provider: 'sendgrid',
      };
    }
  }
}

/**
 * Twilio SMS Provider (for production)
 */
class TwilioSMSProvider implements SMSProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid?: string, authToken?: string, fromNumber?: string) {
    this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = fromNumber || process.env.TWILIO_PHONE_NUMBER || '';

    if (!this.accountSid || !this.authToken) {
      logger.warn('Twilio credentials not configured. Falling back to mock provider.');
    }
  }

  async send(notification: SMSNotification): Promise<NotificationResult> {
    try {
      if (!this.accountSid || !this.authToken) {
        return {
          success: false,
          error: 'Twilio credentials not configured',
          timestamp: new Date(),
          provider: 'twilio',
        };
      }

      // Simulate Twilio API call
      // In production, use twilio package
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
              'base64'
            )}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: this.fromNumber,
            To: notification.to,
            Body: notification.message,
          }).toString(),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error('Twilio API error', { status: response.status, error });
        return {
          success: false,
          error: `Twilio error: ${response.statusText}`,
          timestamp: new Date(),
          provider: 'twilio',
        };
      }

      const data = await response.json() as any;
      return {
        success: true,
        messageId: data.sid,
        timestamp: new Date(),
        provider: 'twilio',
      };
    } catch (error) {
      logger.error('Twilio send error', { error });
      return {
        success: false,
        error: String(error),
        timestamp: new Date(),
        provider: 'twilio',
      };
    }
  }
}

/**
 * Notification Service Manager
 */
class NotificationManager {
  private emailProvider: EmailProvider;
  private smsProvider: SMSProvider;
  private sendingHistory: Map<string, Date> = new Map(); // Track sent notifications to prevent duplicates

  constructor() {
    const emailProviderType = process.env.EMAIL_PROVIDER || 'mock';
    const smsProviderType = process.env.SMS_PROVIDER || 'mock';

    // Initialize email provider
    if (emailProviderType === 'sendgrid') {
      this.emailProvider = new SendGridEmailProvider();
    } else {
      this.emailProvider = new MockEmailProvider();
    }

    // Initialize SMS provider
    if (smsProviderType === 'twilio') {
      this.smsProvider = new TwilioSMSProvider();
    } else {
      this.smsProvider = new MockSMSProvider();
    }
  }

  async sendEmail(notification: EmailNotification): Promise<NotificationResult> {
    try {
      logger.info('Sending email notification', {
        to: notification.to,
        subject: notification.subject,
      });

      const result = await this.emailProvider.send(notification);

      if (result.success) {
        logger.info('Email notification sent successfully', {
          to: notification.to,
          messageId: result.messageId,
        });
      } else {
        logger.warn('Email notification failed', {
          to: notification.to,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      logger.error('Error sending email', { error });
      return {
        success: false,
        error: String(error),
        timestamp: new Date(),
        provider: 'email',
      };
    }
  }

  async sendSMS(notification: SMSNotification): Promise<NotificationResult> {
    try {
      logger.info('Sending SMS notification', {
        to: notification.to,
      });

      const result = await this.smsProvider.send(notification);

      if (result.success) {
        logger.info('SMS notification sent successfully', {
          to: notification.to,
          messageId: result.messageId,
        });
      } else {
        logger.warn('SMS notification failed', {
          to: notification.to,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      logger.error('Error sending SMS', { error });
      return {
        success: false,
        error: String(error),
        timestamp: new Date(),
        provider: 'sms',
      };
    }
  }

  /**
   * Prevent duplicate notifications (simple deduplication)
   * Key format: "type_recipient_alertCode"
   */
  isDuplicate(key: string, windowMinutes: number = 5): boolean {
    const lastSent = this.sendingHistory.get(key);
    if (!lastSent) {
      this.sendingHistory.set(key, new Date());
      return false;
    }

    const elapsed = Date.now() - lastSent.getTime();
    if (elapsed < windowMinutes * 60 * 1000) {
      return true;
    }

    // Update timestamp
    this.sendingHistory.set(key, new Date());
    return false;
  }

  /**
   * Clear old history entries (runs periodically)
   */
  clearOldHistory(olderThanMinutes: number = 60): void {
    const cutoff = Date.now() - olderThanMinutes * 60 * 1000;
    for (const [key, timestamp] of this.sendingHistory) {
      if (timestamp.getTime() < cutoff) {
        this.sendingHistory.delete(key);
      }
    }
  }
}

// Singleton instance
const notificationManager = new NotificationManager();

// Periodically clear old history
setInterval(() => {
  notificationManager.clearOldHistory(60);
}, 30 * 60 * 1000); // Every 30 minutes

export const NotificationService = {
  sendEmail: (notification: EmailNotification) => notificationManager.sendEmail(notification),
  sendSMS: (notification: SMSNotification) => notificationManager.sendSMS(notification),
  isDuplicate: (key: string, windowMinutes?: number) =>
    notificationManager.isDuplicate(key, windowMinutes),
};

export default NotificationService;
