
import { EventEmitter } from 'events';
import nodemailer from 'nodemailer';
import { storage } from './storage';

interface PaymentNotification {
  type: 'payment_pending' | 'payment_success' | 'payment_failed' | 'payment_retry';
  amount: number;
  currency: string;
  transactionId: string;
  errorMessage?: string;
}

interface SystemNotification {
  userId: string;
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}

interface NotificationChannel {
  sms?: boolean;
  email?: boolean;
  push?: boolean;
  webhook?: string;
}

class NotificationService extends EventEmitter {
  private subscribers = new Map<string, NotificationChannel>();
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    super();
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async createNotification(notification: SystemNotification) {
    try {
      // Store notification in database
      const dbNotification = await storage.createNotification({
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority || 'medium',
        metadata: notification.metadata || {},
      });

      // Get user's notification preferences
      const preferences = await storage.getUserNotificationPreferences(notification.userId);
      
      // Send via different channels based on preferences
      if (preferences?.emailNotifications) {
        await this.sendEmailNotification(notification.userId, notification);
      }

      if (preferences?.pushNotifications) {
        await this.sendPushNotification(notification.userId, notification);
      }

      // Emit real-time event
      this.emit('notification_created', {
        ...dbNotification,
        userId: notification.userId
      });

      console.log(`Notification created for user ${notification.userId}: ${notification.type}`);
      return dbNotification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      return null;
    }
  }

  async sendPaymentNotification(recipient: string, notification: PaymentNotification) {
    try {
      const channel = this.subscribers.get(recipient) || { sms: true };
      
      // Send SMS notification
      if (channel.sms) {
        await this.sendSMS(recipient, this.formatSMSMessage(notification));
      }

      // Send email notification
      if (channel.email) {
        await this.sendEmail(recipient, this.formatEmailMessage(notification));
      }

      // Send push notification
      if (channel.push) {
        await this.sendPushNotification(recipient, this.formatPushMessage(notification));
      }

      // Send webhook notification
      if (channel.webhook) {
        await this.sendWebhook(channel.webhook, notification);
      }

      // Emit real-time event
      this.emit('payment_notification', {
        recipient,
        notification,
        timestamp: new Date().toISOString()
      });

      console.log(`Payment notification sent to ${recipient}: ${notification.type}`);
      return true;
    } catch (error) {
      console.error('Failed to send payment notification:', error);
      return false;
    }
  }

  private async sendEmailNotification(userId: string, notification: SystemNotification) {
    try {
      const user = await storage.getUserById(userId);
      if (!user?.email) return;

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@mtaadao.com',
        to: user.email,
        subject: notification.title,
        html: this.formatEmailTemplate(notification),
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log(`Email notification sent to ${user.email}`);
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  private formatEmailTemplate(notification: SystemNotification): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 10px; text-align: center; font-size: 12px; color: #666; }
          .priority-high { border-left: 4px solid #ef4444; }
          .priority-urgent { border-left: 4px solid #dc2626; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MtaaDAO Notification</h1>
          </div>
          <div class="content ${notification.priority === 'high' || notification.priority === 'urgent' ? `priority-${notification.priority}` : ''}">
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            ${notification.metadata?.actionUrl ? `<p><a href="${notification.metadata.actionUrl}" style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Take Action</a></p>` : ''}
          </div>
          <div class="footer">
            <p>This is an automated message from MtaaDAO. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private async sendPushNotification(userId: string, notification: SystemNotification) {
    try {
      // TODO: Integrate with Firebase Cloud Messaging (FCM) or Apple Push Notification service (APNS)
      console.log(`Push notification sent to user ${userId}: ${notification.title}`);
      
      // Mock implementation - replace with actual push service
      const pushPayload = {
        title: notification.title,
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: {
          type: notification.type,
          userId: userId,
          metadata: notification.metadata
        }
      };

      // In a real implementation, you would send this to FCM/APNS
      console.log('Push payload:', pushPayload);
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  private formatSMSMessage(notification: PaymentNotification): string {
    switch (notification.type) {
      case 'payment_pending':
        return `Payment of ${notification.amount} ${notification.currency} is being processed. Transaction ID: ${notification.transactionId}`;
      case 'payment_success':
        return `Payment successful! ${notification.amount} ${notification.currency} received. Transaction ID: ${notification.transactionId}`;
      case 'payment_failed':
        return `Payment failed. ${notification.amount} ${notification.currency}. ${notification.errorMessage || 'Please try again.'}`;
      case 'payment_retry':
        return `Retrying payment of ${notification.amount} ${notification.currency}. Transaction ID: ${notification.transactionId}`;
      default:
        return `Payment update for transaction ${notification.transactionId}`;
    }
  }

  private formatEmailMessage(notification: PaymentNotification): { subject: string; body: string } {
    const subject = `Payment ${notification.type.replace('_', ' ')} - ${notification.transactionId}`;
    
    let body = `
      <h2>Payment Update</h2>
      <p><strong>Transaction ID:</strong> ${notification.transactionId}</p>
      <p><strong>Amount:</strong> ${notification.amount} ${notification.currency}</p>
      <p><strong>Status:</strong> ${notification.type.replace('_', ' ')}</p>
    `;

    if (notification.errorMessage) {
      body += `<p><strong>Error:</strong> ${notification.errorMessage}</p>`;
    }

    return { subject, body };
  }

  private formatPushMessage(notification: PaymentNotification): { title: string; body: string } {
    const title = `Payment ${notification.type.replace('_', ' ')}`;
    const body = `${notification.amount} ${notification.currency} - ${notification.transactionId}`;
    
    return { title, body };
  }

  private async sendSMS(phone: string, message: string): Promise<void> {
    // TODO: Integrate with SMS provider (Twilio, Africa's Talking, etc.)
    console.log(`SMS to ${phone}: ${message}`);
    
    // Mock SMS sending
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`SMS sent successfully to ${phone}`);
        resolve();
      }, 100);
    });
  }

  private async sendEmail(email: string, message: { subject: string; body: string }): Promise<void> {
    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@mtaadao.com',
        to: email,
        subject: message.subject,
        html: message.body,
      });
      console.log(`Email sent successfully to ${email}`);
    } catch (error) {
      console.error(`Email failed for ${email}:`, error);
      throw error;
    }
  }

  private async sendWebhook(url: string, notification: PaymentNotification): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'payment_notification',
          data: notification,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      console.log(`Webhook sent successfully to ${url}`);
    } catch (error) {
      console.error(`Webhook failed for ${url}:`, error);
      throw error;
    }
  }

  subscribe(recipient: string, channels: NotificationChannel) {
    this.subscribers.set(recipient, channels);
  }

  unsubscribe(recipient: string) {
    this.subscribers.delete(recipient);
  }

  // Real-time payment status updates via WebSocket
  getPaymentStatusStream(transactionId: string) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeAllListeners(`payment_${transactionId}`);
        reject(new Error('Payment status timeout'));
      }, 300000); // 5 minutes timeout

      this.once(`payment_${transactionId}`, (status) => {
        clearTimeout(timeout);
        resolve(status);
      });
    });
  }

  updatePaymentStatus(transactionId: string, status: any) {
    this.emit(`payment_${transactionId}`, status);
  }

  // Bulk notification creation for announcements
  async createBulkNotifications(userIds: string[], notificationData: Omit<SystemNotification, 'userId'>) {
    const notifications = [];
    
    for (const userId of userIds) {
      const notification = await this.createNotification({
        ...notificationData,
        userId
      });
      if (notification) {
        notifications.push(notification);
      }
    }
    
    return notifications;
  }

  // Server-Sent Events endpoint for real-time notifications
  setupSSE(userId: string, res: any) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const heartbeat = setInterval(() => {
      res.write('data: {"type":"heartbeat"}\n\n');
    }, 30000);

    const notificationHandler = (notification: any) => {
      if (notification.userId === userId) {
        res.write(`data: ${JSON.stringify(notification)}\n\n`);
      }
    };

    this.on('notification_created', notificationHandler);

    res.on('close', () => {
      clearInterval(heartbeat);
      this.removeListener('notification_created', notificationHandler);
    });
  }
}

export const notificationService = new NotificationService();
