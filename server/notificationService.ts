
import { EventEmitter } from 'events';

interface PaymentNotification {
  type: 'payment_pending' | 'payment_success' | 'payment_failed' | 'payment_retry';
  amount: number;
  currency: string;
  transactionId: string;
  errorMessage?: string;
}

interface NotificationChannel {
  sms?: boolean;
  email?: boolean;
  push?: boolean;
  webhook?: string;
}

class NotificationService extends EventEmitter {
  private subscribers = new Map<string, NotificationChannel>();

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
    // TODO: Integrate with email provider (SendGrid, Mailgun, etc.)
    console.log(`Email to ${email}: ${message.subject}`);
    
    // Mock email sending
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Email sent successfully to ${email}`);
        resolve();
      }, 100);
    });
  }

  private async sendPushNotification(userId: string, message: { title: string; body: string }): Promise<void> {
    // TODO: Integrate with push notification service (FCM, APNS, etc.)
    console.log(`Push to ${userId}: ${message.title}`);
    
    // Mock push notification
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Push notification sent successfully to ${userId}`);
        resolve();
      }, 100);
    });
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
}

export const notificationService = new NotificationService();
