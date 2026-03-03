
import { db } from '../db';
import { 
  daos, 
  treasuryMultisigTransactions, 
  treasuryBudgetAllocations,
  treasuryAuditLog,
  daoMemberships,
  users
} from '../../shared/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError, ValidationError, NotFoundError } from '../middleware/errorHandler';

export class TreasuryMultisigService {
  
  /**
   * CRITICAL: Propose a treasury withdrawal with multi-sig requirements
   */
  async proposeWithdrawal(
    daoId: string,
    proposedBy: string,
    amount: number,
    recipient: string,
    purpose: string,
    currency: string = 'cUSD'
  ) {
    try {
      // Get DAO treasury settings
      const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
      if (!dao.length) throw new NotFoundError('DAO not found');

      const daoData = dao[0];
      
      // CRITICAL: Check if proposer is elder or admin
      const membership = await db.select().from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, proposedBy)
        ))
        .limit(1);

      if (!membership.length || !['elder', 'admin'].includes(membership[0].role || '')) {
        throw new ValidationError('Only elders and admins can propose treasury withdrawals');
      }

      // CRITICAL: Check multi-sig threshold
      const needsMultisig = daoData.treasuryMultisigEnabled && 
                           amount >= parseFloat(daoData.treasuryWithdrawalThreshold || '1000');

      if (needsMultisig) {
        // Check sufficient signers available
        const signers = (daoData.treasurySigners as any[]) || [];
        if (signers.length < (daoData.treasuryRequiredSignatures || 3)) {
          throw new ValidationError(`Insufficient signers configured. Need ${daoData.treasuryRequiredSignatures}, have ${signers.length}`);
        }
      }

      // CRITICAL: Check daily spending limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dailySpent = await this.getDailySpending(daoId, today);
      
      if (dailySpent + amount > parseFloat(daoData.treasuryDailyLimit || '10000')) {
        throw new ValidationError(`Daily spending limit exceeded. Limit: ${daoData.treasuryDailyLimit}, Already spent: ${dailySpent}`);
      }

      // CRITICAL: Check treasury balance
      const currentBalance = parseFloat(daoData.treasuryBalance || '0');
      if (amount > currentBalance) {
        throw new ValidationError(`Insufficient treasury balance. Available: ${currentBalance}, Requested: ${amount}`);
      }

      // Create multi-sig transaction
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [transaction] = await db.insert(treasuryMultisigTransactions).values({
        daoId,
        proposedBy,
        transactionType: 'withdrawal',
        amount: amount.toString(),
        currency,
        recipient,
        purpose,
        requiredSignatures: needsMultisig ? (daoData.treasuryRequiredSignatures || 3) : 1,
        currentSignatures: 1, // proposer auto-signs
        signers: [{
          userId: proposedBy,
          signedAt: new Date().toISOString(),
          signature: 'auto_proposal'
        }],
        status: needsMultisig ? 'pending' : 'approved',
        expiresAt
      }).returning();

      // Audit log
      await this.logAudit({
        daoId,
        actorId: proposedBy,
        action: 'withdrawal_proposed',
        amount,
        reason: purpose,
        multisigTxId: transaction.id,
        severity: amount > 5000 ? 'high' : 'medium'
      });

      Logger.getLogger().info(`Treasury withdrawal proposed: ${transaction.id}, amount: ${amount}, requires ${transaction.requiredSignatures} signatures`);

      return transaction;
    } catch (error: any) {
      Logger.getLogger().error('Treasury withdrawal proposal failed:', error);
      throw error;
    }
  }

  /**
   * CRITICAL: Sign a multi-sig transaction
   */
  async signTransaction(txId: string, signerId: string) {
    try {
      const tx = await db.select().from(treasuryMultisigTransactions)
        .where(eq(treasuryMultisigTransactions.id, txId))
        .limit(1);

      if (!tx.length) throw new NotFoundError('Transaction not found');
      const transaction = tx[0];

      // Validate status
      if (transaction.status !== 'pending') {
        throw new ValidationError(`Transaction is ${transaction.status}, cannot sign`);
      }

      // Check expiry
      if (new Date() > new Date(transaction.expiresAt!)) {
        await db.update(treasuryMultisigTransactions)
          .set({ status: 'expired' })
          .where(eq(treasuryMultisigTransactions.id, txId));
        throw new ValidationError('Transaction has expired');
      }

      // CRITICAL: Verify signer is authorized elder/admin
      const dao = await db.select().from(daos).where(eq(daos.id, transaction.daoId)).limit(1);
      const authorizedSigners = (dao[0].treasurySigners as any[]) || [];
      
      if (!authorizedSigners.includes(signerId)) {
        throw new ValidationError('User is not an authorized signer');
      }

      // Check if already signed
      const signers = transaction.signers as any[];
      if (signers.some((s: any) => s.userId === signerId)) {
        throw new ValidationError('User has already signed this transaction');
      }

      // Add signature
      const updatedSigners = [...signers, {
        userId: signerId,
        signedAt: new Date().toISOString(),
        signature: `sig_${Date.now()}`
      }];

      const newSignatureCount = updatedSigners.length;
      const isApproved = newSignatureCount >= transaction.requiredSignatures;

      await db.update(treasuryMultisigTransactions)
        .set({
          signers: updatedSigners,
          currentSignatures: newSignatureCount,
          status: isApproved ? 'approved' : 'pending',
          approvedAt: isApproved ? new Date() : undefined,
          updatedAt: new Date()
        })
        .where(eq(treasuryMultisigTransactions.id, txId));

      // Audit log
      await this.logAudit({
        daoId: transaction.daoId,
        actorId: signerId,
        action: 'withdrawal_signed',
        amount: parseFloat(transaction.amount),
        reason: `Signed multi-sig transaction ${txId}`,
        multisigTxId: txId,
        severity: 'medium'
      });

      Logger.getLogger().info(`Transaction ${txId} signed by ${signerId}. Signatures: ${newSignatureCount}/${transaction.requiredSignatures}`);

      return { approved: isApproved, signatures: newSignatureCount };
    } catch (error: any) {
      Logger.getLogger().error('Transaction signing failed:', error);
      throw error;
    }
  }

  /**
   * Execute approved multi-sig transaction
   */
  async executeTransaction(txId: string, executorId: string) {
    try {
      const tx = await db.select().from(treasuryMultisigTransactions)
        .where(eq(treasuryMultisigTransactions.id, txId))
        .limit(1);

      if (!tx.length) throw new NotFoundError('Transaction not found');
      const transaction = tx[0];

      if (transaction.status !== 'approved') {
        throw new ValidationError('Transaction is not approved');
      }

      // Execute withdrawal (integrate with actual blockchain/wallet logic)
      // For now, update DAO balance
      const dao = await db.select().from(daos).where(eq(daos.id, transaction.daoId)).limit(1);
      const currentBalance = parseFloat(dao[0].treasuryBalance || '0');
      const newBalance = currentBalance - parseFloat(transaction.amount);

      await db.update(daos)
        .set({ 
          treasuryBalance: newBalance.toString(),
          updatedAt: new Date()
        })
        .where(eq(daos.id, transaction.daoId));

      // Mark transaction as executed
      await db.update(treasuryMultisigTransactions)
        .set({
          status: 'executed',
          executedAt: new Date(),
          executionTxHash: `0x${Date.now()}`, // Replace with actual tx hash
          updatedAt: new Date()
        })
        .where(eq(treasuryMultisigTransactions.id, txId));

      // Audit log
      await this.logAudit({
        daoId: transaction.daoId,
        actorId: executorId,
        action: 'withdrawal',
        amount: parseFloat(transaction.amount),
        previousBalance: currentBalance,
        newBalance: newBalance,
        reason: transaction.purpose,
        multisigTxId: txId,
        severity: 'high'
      });

      Logger.getLogger().info(`Treasury withdrawal executed: ${txId}, amount: ${transaction.amount}`);

      return { success: true, newBalance };
    } catch (error: any) {
      Logger.getLogger().error('Transaction execution failed:', error);
      throw error;
    }
  }

  /**
   * Budget enforcement - check spending against allocation
   */
  async checkBudgetCompliance(daoId: string, category: string, amount: number) {
    try {
      const now = new Date();
      
      const allocations = await db.select().from(treasuryBudgetAllocations)
        .where(and(
          eq(treasuryBudgetAllocations.daoId, daoId),
          eq(treasuryBudgetAllocations.category, category),
          eq(treasuryBudgetAllocations.isActive, true),
          lte(treasuryBudgetAllocations.periodStart, now),
          gte(treasuryBudgetAllocations.periodEnd, now)
        ))
        .limit(1);

      if (!allocations.length) {
        return { 
          compliant: false, 
          reason: `No active budget allocation for category: ${category}` 
        };
      }

      const allocation = allocations[0];
      const remaining = parseFloat(allocation.remainingAmount);

      if (amount > remaining) {
        return {
          compliant: false,
          reason: `Budget exceeded. Available: ${remaining}, Requested: ${amount}`,
          allocation
        };
      }

      return { compliant: true, allocation };
    } catch (error: any) {
      Logger.getLogger().error('Budget compliance check failed:', error);
      throw error;
    }
  }

  /**
   * Comprehensive audit logging
   */
  private async logAudit(data: {
    daoId: string;
    actorId: string;
    action: string;
    amount?: number;
    previousBalance?: number;
    newBalance?: number;
    category?: string;
    reason: string;
    multisigTxId?: string;
    transactionHash?: string;
    severity?: string;
  }) {
    await db.insert(treasuryAuditLog).values({
      ...data,
      amount: data.amount?.toString(),
      previousBalance: data.previousBalance?.toString(),
      newBalance: data.newBalance?.toString(),
      ipAddress: 'system', // Add actual IP if available
      metadata: { timestamp: new Date().toISOString() }
    });
  }

  /**
   * Get daily spending
   */
  private async getDailySpending(daoId: string, date: Date): Promise<number> {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${treasuryMultisigTransactions.amount} AS DECIMAL)), 0)`
    })
    .from(treasuryMultisigTransactions)
    .where(and(
      eq(treasuryMultisigTransactions.daoId, daoId),
      eq(treasuryMultisigTransactions.status, 'executed'),
      gte(treasuryMultisigTransactions.executedAt, date),
      lte(treasuryMultisigTransactions.executedAt, endOfDay)
    ));

    return result[0]?.total || 0;
  }

  /**
   * PHASE 3: Get transaction with approval details (for UI display)
   * Includes timelock status, approval count, remaining approvals
   */
  async getTransactionWithDetails(txId: string) {
    try {
      const tx = await db.select().from(treasuryMultisigTransactions)
        .where(eq(treasuryMultisigTransactions.id, txId))
        .limit(1);

      if (!tx.length) throw new NotFoundError('Transaction not found');
      
      const transaction = tx[0];
      const signers = (transaction.signers as any[]) || [];
      
      const now = new Date();
      const isExpired = new Date(transaction.expiresAt!) < now;
      const isExecutable = transaction.status === 'approved' && !isExpired;

      return {
        ...transaction,
        approvalCount: signers.length,
        remainingApprovals: Math.max(0, transaction.requiredSignatures - signers.length),
        isExecutable,
        isExpired,
        approvers: signers.map((s: any) => s.userId),
        timeUntilExpiry: Math.max(0, new Date(transaction.expiresAt!).getTime() - now.getTime())
      };
    } catch (error: any) {
      Logger.getLogger().error('Failed to get transaction details:', error);
      throw error;
    }
  }

  /**
   * PHASE 3: Get all transactions for a DAO with pagination
   */
  async getTransactions(daoId: string, status?: string, limit: number = 50, offset: number = 0) {
    try {
      const where = status 
        ? and(
            eq(treasuryMultisigTransactions.daoId, daoId),
            eq(treasuryMultisigTransactions.status, status)
          )
        : eq(treasuryMultisigTransactions.daoId, daoId);

      const transactions = await db.select()
        .from(treasuryMultisigTransactions)
        .where(where)
        .orderBy(desc(treasuryMultisigTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      return transactions.map(tx => ({
        ...tx,
        approvalCount: ((tx.signers as any) || []).length,
        remainingApprovals: Math.max(0, tx.requiredSignatures - ((tx.signers as any) || []).length)
      }));
    } catch (error: any) {
      Logger.getLogger().error('Failed to get transactions:', error);
      throw error;
    }
  }

  /**
   * PHASE 3: Check if transaction can be executed (timelock elapsed + approvals met)
   */
  async canExecuteTransaction(txId: string): Promise<{ canExecute: boolean; reason?: string; timeRemaining?: number }> {
    try {
      const tx = await db.select().from(treasuryMultisigTransactions)
        .where(eq(treasuryMultisigTransactions.id, txId))
        .limit(1);

      if (!tx.length) return { canExecute: false, reason: 'Transaction not found' };

      const transaction = tx[0];
      const signers = (transaction.signers as any[]) || [];
      const now = new Date();

      // Check approval count
      if (signers.length < transaction.requiredSignatures) {
        return { 
          canExecute: false, 
          reason: `Insufficient approvals. Have ${signers.length}, need ${transaction.requiredSignatures}` 
        };
      }

      // Check status
      if (transaction.status !== 'approved') {
        return { canExecute: false, reason: `Transaction is ${transaction.status}` };
      }

      // Check expiry
      const expiresAt = new Date(transaction.expiresAt!);
      if (now > expiresAt) {
        return { canExecute: false, reason: 'Transaction has expired' };
      }

      // Check for smart contract timelock (from metadata if Phase 3 enabled)
      const metadata = transaction.metadata as any || {};
      if (metadata.smartContractTimelock) {
        const timelockEnd = new Date(metadata.smartContractTimelockEnd);
        if (now < timelockEnd) {
          const remaining = timelockEnd.getTime() - now.getTime();
          return { 
            canExecute: false, 
            reason: `Smart contract timelock active. ${Math.ceil(remaining / 1000)} seconds remaining`,
            timeRemaining: remaining
          };
        }
      }

      return { canExecute: true };
    } catch (error: any) {
      Logger.getLogger().error('Failed to check transaction executability:', error);
      throw error;
    }
  }

  /**
   * PHASE 3: Get audit log for a DAO with filtering
   */
  async getAuditLog(daoId: string, actionType?: string, limit: number = 50, offset: number = 0) {
    try {
      const where = actionType
        ? and(
            eq(treasuryAuditLog.daoId, daoId),
            eq(treasuryAuditLog.action, actionType)
          )
        : eq(treasuryAuditLog.daoId, daoId);

      const entries = await db.select()
        .from(treasuryAuditLog)
        .where(where)
        .orderBy(desc(treasuryAuditLog.timestamp))
        .limit(limit)
        .offset(offset);

      return entries;
    } catch (error: any) {
      Logger.getLogger().error('Failed to get audit log:', error);
      throw error;
    }
  }

  /**
   * PHASE 3: Enable smart contract features for a transaction
   * Adds smart contract metadata: timelock, block number, voting snapshot ID
   */
  async enableSmartContractFeatures(
    txId: string, 
    timelockDays: number = 2,
    votingSnapshotId?: string,
    blockNumber?: number
  ) {
    try {
      const tx = await db.select().from(treasuryMultisigTransactions)
        .where(eq(treasuryMultisigTransactions.id, txId))
        .limit(1);

      if (!tx.length) throw new NotFoundError('Transaction not found');

      const transaction = tx[0];
      const metadata = (transaction.metadata as any) || {};
      
      const now = new Date();
      const timelockEnd = new Date(now.getTime() + timelockDays * 24 * 60 * 60 * 1000);

      // Update with smart contract metadata
      await db.update(treasuryMultisigTransactions)
        .set({
          metadata: {
            ...metadata,
            smartContractEnabled: true,
            smartContractTimelock: true,
            smartContractTimelockEnd: timelockEnd.toISOString(),
            timelockDays,
            votingSnapshotId,
            blockNumber,
            enabledAt: now.toISOString()
          } as any,
          updatedAt: new Date()
        })
        .where(eq(treasuryMultisigTransactions.id, txId));

      Logger.getLogger().info(`Smart contract features enabled for transaction ${txId}. Timelock: ${timelockDays} days`);

      return { success: true, timelockEnd };
    } catch (error: any) {
      Logger.getLogger().error('Failed to enable smart contract features:', error);
      throw error;
    }
  }

  /**
   * PHASE 3: Record blockchain execution
   * Stores tx hash and block number when transaction is executed on-chain
   */
  async recordBlockchainExecution(txId: string, txHash: string, blockNumber: number) {
    try {
      const tx = await db.select().from(treasuryMultisigTransactions)
        .where(eq(treasuryMultisigTransactions.id, txId))
        .limit(1);

      if (!tx.length) throw new NotFoundError('Transaction not found');

      const transaction = tx[0];

      await db.update(treasuryMultisigTransactions)
        .set({
          executionTxHash: txHash,
          metadata: {
            ...(transaction.metadata as any),
            blockNumber,
            blockchainExecutedAt: new Date().toISOString()
          } as any,
          updatedAt: new Date()
        })
        .where(eq(treasuryMultisigTransactions.id, txId));

      // Audit log for blockchain execution
      await this.logAudit({
        daoId: transaction.daoId,
        actorId: 'smart_contract',
        action: 'blockchain_execution',
        amount: parseFloat(transaction.amount),
        reason: `On-chain execution: ${txHash}`,
        transactionHash: txHash,
        multisigTxId: txId,
        severity: 'high'
      });

      Logger.getLogger().info(`Blockchain execution recorded for transaction ${txId}. TxHash: ${txHash}, Block: ${blockNumber}`);

      return { success: true, txHash, blockNumber };
    } catch (error: any) {
      Logger.getLogger().error('Failed to record blockchain execution:', error);
      throw error;
    }
  }

  /**
   * PHASE 3: Get pending approvals for a DAO
   */
  async getPendingApprovals(daoId: string) {
    try {
      const transactions = await db.select()
        .from(treasuryMultisigTransactions)
        .where(and(
          eq(treasuryMultisigTransactions.daoId, daoId),
          eq(treasuryMultisigTransactions.status, 'pending')
        ))
        .orderBy(desc(treasuryMultisigTransactions.createdAt));

      return transactions.map(tx => {
        const signers = (tx.signers as any[]) || [];
        return {
          ...tx,
          approvalCount: signers.length,
          remainingApprovals: Math.max(0, tx.requiredSignatures - signers.length),
          approvers: signers.map((s: any) => s.userId)
        };
      });
    } catch (error: any) {
      Logger.getLogger().error('Failed to get pending approvals:', error);
      throw error;
    }
  }
}

export const treasuryMultisigService = new TreasuryMultisigService();
