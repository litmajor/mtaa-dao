
import { db } from './storage';
import { 
  proposalExecutionQueue, 
  proposals, 
  daos,
  walletTransactions,
  daoMemberships,
  vaults,
  vaultTransactions
} from '../shared/schema';
import { eq, and, lte } from 'drizzle-orm';
import { vaultService } from './services/vaultService';

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
      
      console.log(`Processing ${pendingExecutions.length} pending executions`);
      
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
      console.log(`Executing proposal ${execution.proposalId} with type ${execution.executionType}`);
      
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
        case 'vault_operation':
          await this.executeVaultOperation(executionData, daoId, proposalId);
          break;
        case 'member_action':
          await this.executeMemberAction(executionData, daoId, proposalId);
          break;
        case 'governance_change':
          await this.executeGovernanceChange(executionData, daoId, proposalId);
          break;
        case 'disbursement':
          await this.executeDisbursement(executionData, daoId, proposalId);
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
      
      console.log(`Successfully executed proposal ${proposalId}`);
      
    } catch (error: any) {
      console.error('Error executing proposal:', error);
      
      // Check if this is a retriable error or permanent failure
      const maxAttempts = 3;
      const shouldRetry = execution.attempts < maxAttempts && this.isRetriableError(error);
      
      await db.update(proposalExecutionQueue)
        .set({ 
          status: shouldRetry ? 'pending' : 'failed',
          errorMessage: error.message,
          // Retry after 1 hour if retriable
          scheduledFor: shouldRetry ? new Date(Date.now() + 60 * 60 * 1000) : undefined
        })
        .where(eq(proposalExecutionQueue.id, execution.id));
    }
  }
  
  // Execute treasury transfer
  static async executeTreasuryTransfer(executionData: any, daoId: string, proposalId: string) {
    const { recipient, amount, currency, description, fromVault } = executionData;
    
    if (fromVault) {
      // Transfer from DAO vault
      const daoVault = await db.query.vaults.findFirst({
        where: and(
          eq(vaults.daoId, daoId),
          eq(vaults.vaultType, 'dao_treasury')
        )
      });
      
      if (!daoVault) {
        throw new Error('DAO vault not found');
      }
      
      // Create withdrawal from vault
      await vaultService.withdrawToken({
        vaultId: daoVault.id,
        userId: 'system', // System user for proposal execution
        tokenSymbol: currency,
        amount: amount.toString(),
        transactionHash: `proposal_${proposalId}`
      });
    } else {
      // Direct treasury transfer (legacy)
      const daoRecord = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
      const currentBalance = parseFloat(daoRecord[0]?.treasuryBalance || '0');
      
      if (currentBalance < amount) {
        throw new Error(`Insufficient treasury balance. Available: ${currentBalance}, Requested: ${amount}`);
      }
      
      const newBalance = (currentBalance - amount).toString();
      await db.update(daos)
        .set({ treasuryBalance: newBalance })
        .where(eq(daos.id, daoId));
    }
    
    // Record the transfer transaction
    await db.insert(walletTransactions).values({
      walletAddress: recipient,
      amount: amount.toString(),
      currency,
      type: 'transfer',
      status: 'completed',
      description: `Proposal execution: ${description}`,
      daoId: daoId
    });
  }
  
  // Execute vault operations
  static async executeVaultOperation(executionData: any, daoId: string, proposalId: string) {
    const { vaultId, operation, operationData } = executionData;
    
    switch (operation) {
      case 'create_vault':
        await vaultService.createVault({
          ...operationData,
          daoId: daoId
        });
        break;
        
      case 'deposit':
        await vaultService.depositToken({
          vaultId,
          userId: 'system',
          ...operationData
        });
        break;
        
      case 'withdraw':
        await vaultService.withdrawToken({
          vaultId,
          userId: 'system',
          ...operationData
        });
        break;
        
      case 'allocate_strategy':
        await vaultService.allocateToStrategy({
          vaultId,
          userId: 'system',
          ...operationData
        });
        break;
        
      case 'rebalance':
        await vaultService.rebalanceVault(vaultId);
        break;
        
      default:
        throw new Error(`Unknown vault operation: ${operation}`);
    }
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
        
      case 'demote':
        await db.update(daoMemberships)
          .set({ role: newRole || 'member' })
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
        
      case 'remove':
        await db.update(daoMemberships)
          .set({ 
            status: 'rejected',
            banReason: reason
          })
          .where(and(
            eq(daoMemberships.daoId, daoId),
            eq(daoMemberships.userId, targetUserId)
          ));
        break;
        
      default:
        throw new Error(`Unknown member action: ${action}`);
    }
  }
  
  // Execute governance changes
  static async executeGovernanceChange(executionData: any, daoId: string, proposalId: string) {
    const { changes } = executionData;
    
    // Validate governance changes
    const allowedFields = [
      'quorumPercentage', 'votingPeriod', 'executionDelay', 
      'name', 'description', 'access', 'inviteOnly'
    ];
    
    const validChanges: any = {};
    for (const [key, value] of Object.entries(changes)) {
      if (allowedFields.includes(key)) {
        validChanges[key] = value;
      }
    }
    
    if (Object.keys(validChanges).length === 0) {
      throw new Error('No valid governance changes specified');
    }
    
    // Update DAO settings
    await db.update(daos)
      .set({
        ...validChanges,
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));
  }
  
  // Execute disbursement
  static async executeDisbursement(executionData: any, daoId: string, proposalId: string) {
    const { recipients, amount, currency, description, disbursementType } = executionData;
    
    const totalAmount = Array.isArray(recipients) ? 
      recipients.reduce((sum: number, r: any) => sum + r.amount, 0) : amount;
    
    // Check DAO treasury balance
    const daoRecord = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    const currentBalance = parseFloat(daoRecord[0]?.treasuryBalance || '0');
    
    if (currentBalance < totalAmount) {
      throw new Error(`Insufficient treasury balance for disbursement. Available: ${currentBalance}, Required: ${totalAmount}`);
    }
    
    // Process disbursements
    if (Array.isArray(recipients)) {
      // Multiple recipients
      for (const recipient of recipients) {
        await db.insert(walletTransactions).values({
          walletAddress: recipient.address,
          amount: recipient.amount.toString(),
          currency,
          type: 'disbursement',
          status: 'completed',
          description: `${description} - ${recipient.description || 'Disbursement'}`,
          daoId: daoId
        });
      }
    } else {
      // Single recipient
      await db.insert(walletTransactions).values({
        walletAddress: recipients,
        amount: amount.toString(),
        currency,
        type: 'disbursement',
        status: 'completed',
        description: description,
        daoId: daoId
      });
    }
    
    // Update DAO treasury balance
    const newBalance = (currentBalance - totalAmount).toString();
    await db.update(daos)
      .set({ treasuryBalance: newBalance })
      .where(eq(daos.id, daoId));
  }
  
  // Schedule a proposal for execution
  static async scheduleProposalExecution(
    proposalId: string,
    daoId: string,
    executionType: string,
    executionData: any,
    scheduledFor: Date
  ) {
    await db.insert(proposalExecutionQueue).values({
      proposalId,
      daoId,
      executionType,
      executionData,
      scheduledFor,
      status: 'pending'
    });
  }
  
  // Check if error is retriable
  private static isRetriableError(error: any): boolean {
    const retriableErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'Rate limit',
      'Service unavailable'
    ];
    
    return retriableErrors.some(errorType => 
      error.message?.includes(errorType) || error.code === errorType
    );
  }
  
  // Get execution status
  static async getExecutionStatus(proposalId: string) {
    return await db.query.proposalExecutionQueue.findFirst({
      where: eq(proposalExecutionQueue.proposalId, proposalId)
    });
  }
  
  // Cancel pending execution
  static async cancelExecution(proposalId: string) {
    await db.update(proposalExecutionQueue)
      .set({ 
        status: 'cancelled',
        errorMessage: 'Execution cancelled by user'
      })
      .where(and(
        eq(proposalExecutionQueue.proposalId, proposalId),
        eq(proposalExecutionQueue.status, 'pending')
      ));
  }
  
  // Start the execution scheduler
  static startScheduler() {
    console.log('Starting proposal execution scheduler...');
    
    // Run every 5 minutes
    setInterval(async () => {
      await this.processPendingExecutions();
    }, 5 * 60 * 1000);
    
    // Run immediately on startup
    setTimeout(() => {
      this.processPendingExecutions();
    }, 10000); // Wait 10 seconds for app to initialize
  }

  // Batch execute multiple proposals
  static async batchExecuteProposals(proposalIds: string[]): Promise<{ successful: string[]; failed: string[] }> {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const proposalId of proposalIds) {
      try {
        const execution = await db.select()
          .from(proposalExecutionQueue)
          .where(and(
            eq(proposalExecutionQueue.proposalId, proposalId),
            eq(proposalExecutionQueue.status, 'pending')
          ))
          .limit(1);

        if (execution.length > 0) {
          await this.executeProposal(execution[0]);
          successful.push(proposalId);
        }
      } catch (error) {
        console.error(`Failed to execute proposal ${proposalId}:`, error);
        failed.push(proposalId);
      }
    }

    return { successful, failed };
  }

  // Get execution statistics
  static async getExecutionStats(daoId: string): Promise<any> {
    const stats = await db.select({
      status: proposalExecutionQueue.status,
      count: sql<number>`count(*)`
    })
    .from(proposalExecutionQueue)
    .where(eq(proposalExecutionQueue.daoId, daoId))
    .groupBy(proposalExecutionQueue.status);

    return stats.reduce((acc, stat) => {
      acc[stat.status] = stat.count;
      return acc;
    }, {} as Record<string, number>);
  }
}
