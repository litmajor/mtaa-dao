
import { storage } from './storage';
import { eq } from 'drizzle-orm';

export interface NotificationData {
  type: 'dao_invite' | 'proposal_created' | 'proposal_voted' | 'task_assigned' | 'task_completed' | 'payment_received' | 'membership_approved' | 'membership_rejected' | 'system_update' | 'vault_deposit' | 'vault_withdrawal';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export class NotificationService {
  // Send notification to a single user
  static async sendToUser(userId: string, notification: NotificationData): Promise<void> {
    try {
      await storage.createNotification({
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata || {},
        priority: notification.priority || 'medium',
        read: false,
      });
    } catch (error) {
      console.error('Failed to send notification to user:', error);
    }
  }

  // Send notification to multiple users
  static async sendToUsers(userIds: string[], notification: NotificationData): Promise<void> {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata || {},
        priority: notification.priority || 'medium',
        read: false,
      }));

      await storage.createBulkNotifications(userIds, notification);
    } catch (error) {
      console.error('Failed to send notifications to users:', error);
    }
  }

  // Send notification to all DAO members
  static async sendToDao(daoId: string, notification: NotificationData): Promise<void> {
    try {
      const members = await storage.getDaoMembers(daoId);
      const userIds = members.map(member => member.userId);
      
      if (userIds.length > 0) {
        await this.sendToUsers(userIds, {
          ...notification,
          metadata: { ...notification.metadata, daoId }
        });
      }
    } catch (error) {
      console.error('Failed to send notifications to DAO members:', error);
    }
  }

  // Automated notifications for specific events
  static async onProposalCreated(proposalId: string, daoId: string, proposerName: string): Promise<void> {
    const proposal = await storage.getProposal(proposalId);
    if (!proposal) return;

    await this.sendToDao(daoId, {
      type: 'proposal_created',
      title: 'New Proposal Created',
      message: `${proposerName} has created a new proposal: "${proposal.title}"`,
      metadata: { proposalId, daoId, proposerId: proposal.proposerId },
      priority: 'medium'
    });
  }

  static async onProposalVoted(proposalId: string, daoId: string, voterName: string, voteType: string): Promise<void> {
    const proposal = await storage.getProposal(proposalId);
    if (!proposal) return;

    // Notify proposal creator
    await this.sendToUser(proposal.proposerId, {
      type: 'proposal_voted',
      title: 'New Vote on Your Proposal',
      message: `${voterName} voted "${voteType}" on your proposal: "${proposal.title}"`,
      metadata: { proposalId, daoId, voteType },
      priority: 'low'
    });
  }

  static async onTaskAssigned(taskId: string, assigneeId: string, assignerName: string): Promise<void> {
    const task = await storage.getTask(taskId);
    if (!task) return;

    await this.sendToUser(assigneeId, {
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: `${assignerName} assigned you a task: "${task.title}"`,
      metadata: { taskId, daoId: task.daoId },
      priority: 'high'
    });
  }

  static async onTaskCompleted(taskId: string, completerId: string, completerName: string): Promise<void> {
    const task = await storage.getTask(taskId);
    if (!task) return;

    // Notify task creator
    await this.sendToUser(task.creatorId, {
      type: 'task_completed',
      title: 'Task Completed',
      message: `${completerName} has completed the task: "${task.title}"`,
      metadata: { taskId, daoId: task.daoId, completerId },
      priority: 'medium'
    });
  }

  static async onPaymentReceived(userId: string, amount: string, currency: string, source: string): Promise<void> {
    await this.sendToUser(userId, {
      type: 'payment_received',
      title: 'Payment Received',
      message: `You received ${amount} ${currency} from ${source}`,
      metadata: { amount, currency, source },
      priority: 'high'
    });
  }

  static async onMembershipStatusChanged(userId: string, daoName: string, status: 'approved' | 'rejected'): Promise<void> {
    const type = status === 'approved' ? 'membership_approved' : 'membership_rejected';
    const title = status === 'approved' ? 'Membership Approved' : 'Membership Rejected';
    const message = status === 'approved' 
      ? `Your membership to ${daoName} has been approved!`
      : `Your membership request to ${daoName} has been rejected.`;

    await this.sendToUser(userId, {
      type,
      title,
      message,
      metadata: { daoName, status },
      priority: status === 'approved' ? 'high' : 'medium'
    });
  }

  static async onVaultTransaction(userId: string, type: 'deposit' | 'withdrawal', amount: string, currency: string): Promise<void> {
    const notificationType = type === 'deposit' ? 'vault_deposit' : 'vault_withdrawal';
    const title = type === 'deposit' ? 'Vault Deposit Confirmed' : 'Vault Withdrawal Processed';
    const message = `Your ${type} of ${amount} ${currency} has been processed successfully.`;

    await this.sendToUser(userId, {
      type: notificationType,
      title,
      message,
      metadata: { amount, currency, transactionType: type },
      priority: 'medium'
    });
  }

  static async onSystemUpdate(title: string, message: string): Promise<void> {
    const allUsers = await storage.getAllActiveUsers();
    const userIds = allUsers.map(user => user.id);

    if (userIds.length > 0) {
      await this.sendToUsers(userIds, {
        type: 'system_update',
        title,
        message,
        priority: 'low'
      });
    }
  }
}
