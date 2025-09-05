
import { db } from './storage';
import { tasks, taskHistory, walletTransactions, notifications } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

export class TaskVerificationService {
  
  // Automated verification for simple tasks
  static async autoVerifyTask(taskId: string, proofData: any): Promise<boolean> {
    try {
      // Basic URL validation
      if (!proofData.proofUrl || !this.isValidUrl(proofData.proofUrl)) {
        return false;
      }

      // Check if proof URL is accessible
      const isAccessible = await this.checkUrlAccessibility(proofData.proofUrl);
      if (!isAccessible) {
        return false;
      }

      // Additional automated checks based on task category
      const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (!task.length) return false;

      const taskData = task[0];
      
      switch (taskData.category) {
        case 'Frontend Development':
          return await this.verifyFrontendTask(proofData);
        case 'Documentation':
          return await this.verifyDocumentationTask(proofData);
        default:
          return true; // Manual verification required
      }
    } catch (error) {
      console.error('Auto-verification failed:', error);
      return false;
    }
  }

  // Manual verification workflow
  static async requestManualVerification(taskId: string, reviewerId: string): Promise<void> {
    await db.insert(notifications).values({
      userId: reviewerId,
      title: 'Task Verification Required',
      message: `A task requires manual verification. Task ID: ${taskId}`,
      type: 'task_verification',
      metadata: { taskId, action: 'verify_task' }
    });
  }

  // Verification scoring system
  static async calculateVerificationScore(taskId: string, submissionData: any): Promise<number> {
    let score = 0;
    
    // Basic completeness (40 points)
    if (submissionData.proofUrl) score += 20;
    if (submissionData.description && submissionData.description.length > 20) score += 20;
    
    // Documentation quality (30 points)
    if (submissionData.screenshots && submissionData.screenshots.length > 0) score += 15;
    if (submissionData.description && submissionData.description.length > 100) score += 15;
    
    // Timeliness (30 points)
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (task.length && task[0].deadline) {
      const deadline = new Date(task[0].deadline);
      const now = new Date();
      if (now <= deadline) score += 30;
      else if (now.getTime() - deadline.getTime() <= 24 * 60 * 60 * 1000) score += 15; // 1 day grace
    } else {
      score += 30; // No deadline penalty
    }
    
    return Math.min(100, score);
  }

  // Helper methods
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static async checkUrlAccessibility(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.status < 400;
    } catch {
      return false;
    }
  }

  private static async verifyFrontendTask(proofData: any): Promise<boolean> {
    // Check if proof URL responds and has basic HTML structure
    try {
      const response = await fetch(proofData.proofUrl);
      const content = await response.text();
      return content.includes('<html') && content.includes('<body');
    } catch {
      return false;
    }
  }

  private static async verifyDocumentationTask(proofData: any): Promise<boolean> {
    // For documentation tasks, check content length and structure
    return proofData.description && proofData.description.length > 100;
  }

  // Process escrow release after verification
  static async processEscrowRelease(taskId: string, approved: boolean): Promise<void> {
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task.length) throw new Error('Task not found');

    const taskData = task[0];
    
    if (approved && taskData.claimerId) {
      // Find escrow transaction
      const escrow = await db
        .select()
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.type, 'escrow_deposit'),
          eq(walletTransactions.description, `Escrow for task: ${taskId}`),
          eq(walletTransactions.status, 'held')
        ))
        .limit(1);

      if (escrow.length > 0) {
        // Release escrow to claimant
        await db
          .update(walletTransactions)
          .set({ status: 'completed' })
          .where(eq(walletTransactions.id, escrow[0].id));

        // Create payout transaction
        // NOTE: users table does not have walletAddress column. You must implement wallet address retrieval differently if needed.
        await db.insert(walletTransactions).values({
          type: 'bounty_payout',
          amount: (escrow[0].amount ?? '').toString(),
          currency: (escrow[0].currency ?? '').toString(),
          walletAddress: '', // No wallet address available, set as empty string or fallback
          status: 'completed',
          description: `Bounty payment for completed task: ${taskData.title}`
        });

        // Notify claimant
        await db.insert(notifications).values({
          userId: taskData.claimerId,
          title: 'Bounty Payment Received',
          message: `You've received ${escrow[0].amount} ${escrow[0].currency} for completing "${taskData.title}"`,
          type: 'payment_received',
          metadata: { taskId, amount: escrow[0].amount, currency: escrow[0].currency }
        });
      }
    }
  }
}
