
import { db } from './storage';
import { 
  proposalExecutionQueue, 
  proposals, 
  daos,
  walletTransactions,
  daoMemberships
} from '../shared/schema';
import { eq, and, lte } from 'drizzle-orm';

export class ProposalExecutionService {
  
  // Process pending executions
  static async processPendingExecutions() {
    try {
      const now = new Date();
      
      // Get proposals ready for execution
      const pendingExecutions = await db.select()
        .from(proposalExecutionQueue)
        .where(and(
          eq(proposalExecutionQueue.status, 'pending'),
          lte(proposalExecutionQueue.scheduledFor, now)
        ));
      
      for (const execution of pendingExecutions) {
        await this.executeProposal(execution);
      }
    } catch (error) {
      console.error('Error processing pending executions:', error);
    }
  }
  
  // Execute individual proposal
  static async executeProposal(execution: any) {
    try {
      // Update status to executing
      await db.update(proposalExecutionQueue)
        .set({ 
          status: 'executing',
          lastAttempt: new Date(),
          attempts: execution.attempts + 1
        })
        .where(eq(proposalExecutionQueue.id, execution.id));
      
      const { executionType, executionData, daoId, proposalId } = execution;
      
      switch (executionType) {
        case 'treasury_transfer':
          await this.executeTreasuryTransfer(executionData, daoId, proposalId);
          break;
        case 'member_action':
          await this.executeMemberAction(executionData, daoId, proposalId);
          break;
        case 'governance_change':
          await this.executeGovernanceChange(executionData, daoId, proposalId);
          break;
        default:
          throw new Error(`Unknown execution type: ${executionType}`);
      }
      
      // Mark as completed
      await db.update(proposalExecutionQueue)
        .set({ status: 'completed' })
        .where(eq(proposalExecutionQueue.id, execution.id));
      
      // Update proposal status
      await db.update(proposals)
        .set({ 
          status: 'executed',
          executedAt: new Date()
        })
        .where(eq(proposals.id, proposalId));
      
    } catch (error: any) {
      console.error('Error executing proposal:', error);
      
      // Update execution with error
      await db.update(proposalExecutionQueue)
        .set({ 
          status: 'failed',
          errorMessage: error.message
        })
        .where(eq(proposalExecutionQueue.id, execution.id));
    }
  }
  
  // Execute treasury transfer
  static async executeTreasuryTransfer(executionData: any, daoId: string, proposalId: string) {
    const { recipient, amount, currency, description } = executionData;
    
    // Record the transfer transaction
    await db.insert(walletTransactions).values({
      daoId,
      toUserId: recipient,
      amount: amount.toString(),
      currency,
      type: 'transfer',
      status: 'completed',
      description: `Proposal execution: ${description}`
    });
    
    // Update DAO treasury balance
    await db.update(daos)
      .set({ 
        treasuryBalance: db.select().from(daos).where(eq(daos.id, daoId)).limit(1).then(
          dao => (parseFloat(dao[0]?.treasuryBalance || '0') - amount).toString()
        )
      })
      .where(eq(daos.id, daoId));
  }
  
  // Execute member action (promote, demote, ban, etc.)
  static async executeMemberAction(executionData: any, daoId: string, proposalId: string) {
    const { action, targetUserId, newRole, reason } = executionData;
    
    switch (action) {
      case 'promote':
        await db.update(daoMemberships)
          .set({ role: newRole })
          .where(and(
            eq(daoMemberships.daoId, daoId),
            eq(daoMemberships.userId, targetUserId)
          ));
        break;
        
      case 'ban':
        await db.update(daoMemberships)
          .set({ 
            isBanned: true,
            banReason: reason
          })
          .where(and(
            eq(daoMemberships.daoId, daoId),
            eq(daoMemberships.userId, targetUserId)
          ));
        break;
        
      case 'unban':
        await db.update(daoMemberships)
          .set({ 
            isBanned: false,
            banReason: null
          })
          .where(and(
            eq(daoMemberships.daoId, daoId),
            eq(daoMemberships.userId, targetUserId)
          ));
        break;
    }
  }
  
  // Execute governance changes
  static async executeGovernanceChange(executionData: any, daoId: string, proposalId: string) {
    const { changes } = executionData;
    
    // Update DAO settings
    await db.update(daos)
      .set(changes)
      .where(eq(daos.id, daoId));
  }
  
  // Start the execution scheduler
  static startScheduler() {
    // Run every 5 minutes
    setInterval(async () => {
      await this.processPendingExecutions();
    }, 5 * 60 * 1000);
  }
}
