/**
 * Morio Proactive Notification System
 * 
 * Sends proactive notifications to users about important DAO events
 */

import type { MorioNotification } from '../types';
import { AgentCommunicator } from '../../../core/agent-framework/agent-communicator';
import { MessageType } from '../../../core/agent-framework/message-bus';
import { Logger } from '../../../utils/logger';

const logger = new Logger('morio-notifications');

export type NotificationType = 
  | 'proposal_expiring'
  | 'proposal_created'
  | 'voting_started'
  | 'voting_ended'
  | 'treasury_milestone'
  | 'member_joined'
  | 'high_contribution'
  | 'task_available'
  | 'event_coming'
  | 'vault_opportunity';

export interface NotificationPayload {
  type: NotificationType;
  userId: string;
  daoId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high';
}

export class NotificationManager {
  private communicator: AgentCommunicator;
  private userNotifications: Map<string, NotificationPayload[]> = new Map();
  private deliveryMap: Map<string, Set<string>> = new Map(); // Track delivered notifications

  constructor() {
    this.communicator = new AgentCommunicator('MORIO_NOTIFICATIONS');
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.communicator.subscribe([MessageType.NOTIFICATION], this.handleIncomingNotification.bind(this));
  }

  /**
   * Send a proactive notification
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      // Store notification
      const userNotifications = this.userNotifications.get(payload.userId) || [];
      userNotifications.push(payload);
      this.userNotifications.set(payload.userId, userNotifications);

      // Track delivery
      const deliveryKey = `${payload.userId}_${payload.daoId}`;
      const delivered = this.deliveryMap.get(deliveryKey) || new Set();
      delivered.add(`${payload.type}_${payload.timestamp.getTime()}`);
      this.deliveryMap.set(deliveryKey, delivered);

      // Broadcast to agent network
      await this.communicator.broadcast({
        type: MessageType.NOTIFICATION,
        payload: {
          ...payload,
          source: 'MORIO_NOTIFICATIONS'
        }
      });

      logger.info(`Notification sent: ${payload.type} to ${payload.userId}`);
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  /**
   * Handle incoming notifications from other agents
   */
  private async handleIncomingNotification(message: any): Promise<void> {
    try {
      const notification = message.payload;
      
      // Relay to user via Morio session
      logger.info(`Relaying notification: ${notification.type}`);
      
      // Store for later retrieval
      const key = notification.userId;
      const notifications = this.userNotifications.get(key) || [];
      notifications.push(notification);
      this.userNotifications.set(key, notifications);
    } catch (error) {
      logger.error('Failed to handle incoming notification:', error);
    }
  }

  /**
   * Get pending notifications for a user
   */
  async getPendingNotifications(userId: string): Promise<NotificationPayload[]> {
    const notifications = this.userNotifications.get(userId) || [];
    
    // Return last 10, sorted by priority and timestamp
    return notifications
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .slice(-10);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notifications = this.userNotifications.get(userId) || [];
    const index = notifications.findIndex(
      n => `${n.type}_${n.timestamp.getTime()}` === notificationId
    );
    
    if (index !== -1) {
      notifications.splice(index, 1);
      this.userNotifications.set(userId, notifications);
    }
  }

  /**
   * Common notification scenarios
   */

  async notifyProposalExpiring(userId: string, daoId: string, proposalId: string, title: string): Promise<void> {
    await this.sendNotification({
      type: 'proposal_expiring',
      userId,
      daoId,
      title: '⏰ Proposal Expiring Soon',
      message: `"${title}" expires in 24 hours. Don't miss your chance to vote!`,
      data: { proposalId },
      timestamp: new Date(),
      priority: 'high'
    });
  }

  async notifyProposalCreated(userId: string, daoId: string, proposalId: string, creator: string, title: string): Promise<void> {
    await this.sendNotification({
      type: 'proposal_created',
      userId,
      daoId,
      title: '📋 New Proposal',
      message: `${creator} created a new proposal: "${title}"`,
      data: { proposalId },
      timestamp: new Date(),
      priority: 'medium'
    });
  }

  async notifyVotingStarted(userId: string, daoId: string, proposalId: string, title: string): Promise<void> {
    await this.sendNotification({
      type: 'voting_started',
      userId,
      daoId,
      title: '🗳️ Voting Open',
      message: `Voting is now open for "${title}". Share your voice!`,
      data: { proposalId },
      timestamp: new Date(),
      priority: 'high'
    });
  }

  async notifyVotingEnded(userId: string, daoId: string, proposalId: string, title: string, result: 'passed' | 'failed'): Promise<void> {
    await this.sendNotification({
      type: 'voting_ended',
      userId,
      daoId,
      title: `✅ Voting ${result === 'passed' ? 'Passed' : 'Failed'}`,
      message: `"${title}" has ${result === 'passed' ? 'passed' : 'failed'}. Great participation!`,
      data: { proposalId },
      timestamp: new Date(),
      priority: 'medium'
    });
  }

  async notifyTreasuryMilestone(userId: string, daoId: string, milestone: string, amount: string): Promise<void> {
    await this.sendNotification({
      type: 'treasury_milestone',
      userId,
      daoId,
      title: '🎉 Treasury Milestone',
      message: `Your DAO reached ${milestone}! Treasury: ${amount}`,
      timestamp: new Date(),
      priority: 'medium'
    });
  }

  async notifyHighContribution(userId: string, daoId: string, scoreIncrease: number): Promise<void> {
    await this.sendNotification({
      type: 'high_contribution',
      userId,
      daoId,
      title: '⭐ Great Contribution!',
      message: `Your contribution score increased by ${scoreIncrease}. Keep it up!`,
      data: { scoreIncrease },
      timestamp: new Date(),
      priority: 'medium'
    });
  }

  async notifyTaskAvailable(userId: string, daoId: string, taskId: string, taskTitle: string, reward: string): Promise<void> {
    await this.sendNotification({
      type: 'task_available',
      userId,
      daoId,
      title: '✅ New Task Available',
      message: `"${taskTitle}" is available. Earn ${reward} by completing it!`,
      data: { taskId },
      timestamp: new Date(),
      priority: 'medium'
    });
  }

  async notifyEventComing(userId: string, daoId: string, eventName: string, daysUntil: number): Promise<void> {
    await this.sendNotification({
      type: 'event_coming',
      userId,
      daoId,
      title: '📅 Event Coming Up',
      message: `${eventName} is coming up in ${daysUntil} days. Mark your calendar!`,
      timestamp: new Date(),
      priority: 'low'
    });
  }

  async notifyVaultOpportunity(userId: string, daoId: string, vaultName: string, apy: string): Promise<void> {
    await this.sendNotification({
      type: 'vault_opportunity',
      userId,
      daoId,
      title: '🏦 Vault Opportunity',
      message: `New vault "${vaultName}" available with ${apy} APY. Start earning today!`,
      timestamp: new Date(),
      priority: 'medium'
    });
  }
}

// Singleton instance
let notificationManager: NotificationManager | null = null;

export function getNotificationManager(): NotificationManager {
  if (!notificationManager) {
    notificationManager = new NotificationManager();
  }
  return notificationManager;
}
