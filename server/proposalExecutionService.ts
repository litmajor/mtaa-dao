
import { db } from './storage';
import { 
  proposalExecutionQueue, 
  proposals, 
  daos,
  walletTransactions,
  daoMemberships,
  vaults,
  vaultTransactions,
  treasuryMultisigTransactions
} from '../shared/schema';
import { eq, and, lte, or, isNull, sql } from 'drizzle-orm';
import { vaultService } from './services/vaultService';
import { TreasuryValidationService } from './services/treasuryValidationService';

export class ProposalExecutionService {
  
  /**
   * Validate user has permission to execute proposals for this DAO
   * Only DAO admins, elders, and treasury_manager roles can execute
   */
  private static async validateExecutionPermission(userId: string, daoId: string): Promise<boolean> {
    try {
      const membership = await db.select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.daoId, daoId)
        ))
        .limit(1);
      
      if (!membership.length) {
        return false; // Not a DAO member
      }
      
      const memberRole = membership[0].role || '';
      const allowedRoles = ['creator', 'admin', 'elder', 'treasury_manager'];
      
      return allowedRoles.includes(memberRole);
    } catch (error) {
      console.error('Error validating execution permission:', error);
      return false;
    }
  }
  
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
        try {
          await this.executeProposal(execution);
        } catch (error) {
          console.error(`Proposal execution ${execution.id} failed:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing pending executions:', error);
    }
  }
  
  // Execute individual proposal
  static async executeProposal(execution: any, executorUserId?: string, requestedIdempotencyKey?: string) {
    const executionId = execution.id as string;
    const proposalId = execution.proposalId as string;
    const daoId = execution.daoId as string;
    const actualExecutor = executorUserId || 'system';
    const idempotencyKey = requestedIdempotencyKey || `scheduler:${executionId}`;
    if (!idempotencyKey.trim() || idempotencyKey.length > 200) {
      throw new Error('Idempotency-Key must contain 1 to 200 characters');
    }

    type ExecutionClaim =
      | { kind: 'conflict' }
      | { kind: 'missing' }
      | { kind: 'busy' }
      | { kind: 'existing'; execution: typeof proposalExecutionQueue.$inferSelect }
      | { kind: 'claimed'; execution: typeof proposalExecutionQueue.$inferSelect };
    let claim: ExecutionClaim;
    try {
      claim = await db.transaction(async (tx) => {
        const [keyOwner] = await tx.select()
          .from(proposalExecutionQueue)
          .where(eq(proposalExecutionQueue.idempotencyKey, idempotencyKey))
          .limit(1);
        if (keyOwner && keyOwner.id !== executionId) {
          return { kind: 'conflict' as const };
        }

        const [alreadyClaimed] = await tx.select()
          .from(proposalExecutionQueue)
          .where(eq(proposalExecutionQueue.id, executionId))
          .limit(1);
        if (!alreadyClaimed) return { kind: 'missing' as const };
        if (alreadyClaimed.status !== 'pending') {
          if (alreadyClaimed.idempotencyKey !== idempotencyKey) return { kind: 'conflict' as const };
          return { kind: 'existing' as const, execution: alreadyClaimed };
        }

        const now = new Date();
        const [claimed] = await tx.update(proposalExecutionQueue)
          .set({
            status: 'executing',
            idempotencyKey,
            lastAttempt: now,
            attempts: (alreadyClaimed.attempts || 0) + 1,
            updatedAt: now,
          })
          .where(and(
            eq(proposalExecutionQueue.id, executionId),
            eq(proposalExecutionQueue.status, 'pending'),
            lte(proposalExecutionQueue.scheduledFor, now),
            or(isNull(proposalExecutionQueue.idempotencyKey), eq(proposalExecutionQueue.idempotencyKey, idempotencyKey)),
          ))
          .returning();
        if (!claimed) {
          const [concurrentExecution] = await tx.select()
            .from(proposalExecutionQueue)
            .where(eq(proposalExecutionQueue.id, executionId))
            .limit(1);
          if (concurrentExecution?.idempotencyKey === idempotencyKey) {
            return { kind: 'existing' as const, execution: concurrentExecution };
          }
          return { kind: 'busy' as const };
        }

        const [approvedProposal] = await tx.update(proposals)
          .set({ status: 'executing', updatedAt: now })
          .where(and(
            eq(proposals.id, proposalId),
            eq(proposals.daoId, daoId),
            eq(proposals.status, 'passed'),
          ))
          .returning({ id: proposals.id });
        if (!approvedProposal) {
          throw new Error(`Proposal ${proposalId} is not in the approved 'passed' state`);
        }
        return { kind: 'claimed' as const, execution: claimed };
      });
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new Error('Idempotency key is already assigned to another execution');
      }
      throw error;
    }

    if (claim.kind === 'conflict') {
      throw new Error('Proposal execution is already claimed with a different idempotency key');
    }
    if (claim.kind === 'missing') throw new Error(`Proposal execution ${executionId} was not found`);
    if (claim.kind === 'busy') throw new Error(`Proposal execution ${executionId} is not due or has already been claimed`);
    if (claim.kind === 'existing') {
      return {
        executionId,
        proposalId,
        status: claim.execution.status,
        result: claim.execution.executionResult,
        externalReference: claim.execution.externalReference,
        externalTxHash: claim.execution.externalTxHash,
        idempotent: true,
      };
    }

    const claimedExecution = claim.execution;
    const { executionType, executionData } = claimedExecution;
    try {
      const requiresExternalSettlement = ['treasury_transfer', 'vault_operation', 'disbursement'].includes(executionType);
      if (requiresExternalSettlement) {
        const result = {
          status: 'settlement_pending',
          message: 'Proposal approval is preserved. Submit the payout through the DAO multisig and link it to this proposal before it can be marked executed.',
        };
        await db.transaction(async (tx) => {
          const [waiting] = await tx.update(proposalExecutionQueue)
            .set({ status: 'settlement_pending', executionResult: result, updatedAt: new Date() })
            .where(and(
              eq(proposalExecutionQueue.id, executionId),
              eq(proposalExecutionQueue.status, 'executing'),
              eq(proposalExecutionQueue.idempotencyKey, idempotencyKey),
            ))
            .returning({ id: proposalExecutionQueue.id });
          if (!waiting) throw new Error(`Execution ${executionId} lost its claim before awaiting settlement`);

          await tx.update(proposals)
            .set({ status: 'passed', updatedAt: new Date() })
            .where(and(eq(proposals.id, proposalId), eq(proposals.status, 'executing')));
        });
        return { executionId, proposalId, status: 'settlement_pending', result };
      }

      console.log(`Executing proposal ${execution.proposalId} with type ${execution.executionType} by ${actualExecutor}`);

      switch (executionType) {
        case 'treasury_transfer':
          // For manual executions, require valid executor. For scheduled, use 'system'
          const treasuryExecutor = actualExecutor === 'system' ? actualExecutor : actualExecutor;
          await this.executeTreasuryTransfer(executionData, daoId, proposalId, treasuryExecutor);
          break;
        case 'vault_operation':
          // For manual executions, require valid executor. For scheduled, use 'system'
          const vaultExecutor = actualExecutor === 'system' ? actualExecutor : actualExecutor;
          await this.executeVaultOperation(executionData, daoId, proposalId, vaultExecutor);
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
      
      const now = new Date();
      await db.transaction(async (tx) => {
        const [completed] = await tx.update(proposalExecutionQueue)
          .set({ status: 'completed', executionResult: { status: 'completed' }, updatedAt: now })
          .where(and(
            eq(proposalExecutionQueue.id, executionId),
            eq(proposalExecutionQueue.status, 'executing'),
            eq(proposalExecutionQueue.idempotencyKey, idempotencyKey),
          ))
          .returning({ id: proposalExecutionQueue.id });
        if (!completed) throw new Error(`Execution ${executionId} lost its claim before completion`);

        await tx.update(proposals)
          .set({ status: 'executed', executedAt: now, executedBy: actualExecutor === 'system' ? null : actualExecutor, updatedAt: now })
          .where(and(eq(proposals.id, proposalId), eq(proposals.status, 'executing')));
      });
      
      console.log(`Successfully executed proposal ${proposalId}`);
      return { executionId, proposalId, status: 'completed' as const };
    } catch (error: any) {
      console.error('Error executing proposal:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await db.transaction(async (tx) => {
        await tx.update(proposalExecutionQueue)
          .set({
            status: 'reconciliation_required',
            errorMessage,
            executionResult: { status: 'reconciliation_required', error: errorMessage },
            updatedAt: new Date(),
          })
          .where(and(eq(proposalExecutionQueue.id, executionId), eq(proposalExecutionQueue.status, 'executing')));
        await tx.update(proposals)
          .set({ status: 'passed', updatedAt: new Date() })
          .where(and(eq(proposals.id, proposalId), eq(proposals.status, 'executing')));
      });
      throw error;
    }
  }

  static async reconcileOnchainExecution(executionId: string) {
    const [execution] = await db.select()
      .from(proposalExecutionQueue)
      .where(eq(proposalExecutionQueue.id, executionId))
      .limit(1);
    if (!execution) return { found: false as const };
    if (execution.status === 'completed' || execution.status === 'failed') {
      return { found: true as const, status: execution.status };
    }

    const matchingTransactions = await db.select()
      .from(treasuryMultisigTransactions)
      .where(and(
        eq(treasuryMultisigTransactions.daoId, execution.daoId),
        sql`${treasuryMultisigTransactions.metadata}->>'proposalId' = ${execution.proposalId}`,
      ))
      .limit(2);
    if (matchingTransactions.length > 1) {
      await db.update(proposalExecutionQueue)
        .set({
          status: 'reconciliation_required',
          errorMessage: 'Multiple DAO multisig transactions reference this proposal',
          updatedAt: new Date(),
        })
        .where(eq(proposalExecutionQueue.id, executionId));
      return { found: true as const, status: 'reconciliation_required' as const };
    }

    const transaction = matchingTransactions[0];
    if (!transaction) return { found: true as const, status: execution.status, linked: false as const };

    const metadata = (transaction.metadata || {}) as Record<string, unknown>;
    if (transaction.status === 'executed' && metadata.executedOnChain === true &&
        typeof metadata.executionTxHash === 'string' && metadata.executionTxHash) {
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx.update(proposalExecutionQueue)
          .set({
            status: 'completed',
            externalReference: transaction.id,
            externalTxHash: metadata.executionTxHash as string,
            executionResult: {
              status: 'completed',
              treasuryMultisigTransactionId: transaction.id,
              submissionTxHash: transaction.submittedTxHash,
              executionTxHash: metadata.executionTxHash,
              eventBlockNumber: metadata.eventBlockNumber,
              eventLogIndex: metadata.eventLogIndex,
            },
            errorMessage: null,
            updatedAt: now,
          })
          .where(and(
            eq(proposalExecutionQueue.id, executionId),
            sql`${proposalExecutionQueue.status} IN ('settlement_pending', 'submitted', 'failed', 'reconciliation_required')`,
          ));
        await tx.update(proposals)
          .set({
            status: 'executed',
            executedAt: transaction.executedAt || now,
            executionTxHash: metadata.executionTxHash as string,
            updatedAt: now,
          })
          .where(eq(proposals.id, execution.proposalId));
      });
      return { found: true as const, linked: true as const, status: 'completed' as const, externalTxHash: metadata.executionTxHash };
    }

    if (transaction.status === 'failed' || transaction.status === 'rejected' || transaction.status === 'expired') {
      await db.update(proposalExecutionQueue)
        .set({
          status: 'failed',
          externalReference: transaction.id,
          externalTxHash: transaction.submittedTxHash,
          errorMessage: `Linked multisig transaction is ${transaction.status}`,
          executionResult: { status: 'failed', treasuryMultisigTransactionId: transaction.id },
          updatedAt: new Date(),
        })
        .where(eq(proposalExecutionQueue.id, executionId));
      return { found: true as const, linked: true as const, status: 'failed' as const };
    }

    const submitted = transaction.status === 'submitted' && Boolean(transaction.submittedTxHash);
    await db.update(proposalExecutionQueue)
      .set({
        status: submitted ? 'submitted' : 'settlement_pending',
        externalReference: transaction.id,
        ...(transaction.submittedTxHash ? { externalTxHash: transaction.submittedTxHash } : {}),
        executionResult: {
          status: submitted ? 'submitted' : 'settlement_pending',
          treasuryMultisigTransactionId: transaction.id,
          submissionTxHash: transaction.submittedTxHash,
        },
        updatedAt: new Date(),
      })
      .where(and(
        eq(proposalExecutionQueue.id, executionId),
        sql`${proposalExecutionQueue.status} IN ('settlement_pending', 'submitted', 'reconciliation_required')`,
      ));
    return { found: true as const, linked: true as const, status: submitted ? 'submitted' as const : 'settlement_pending' as const };
  }
  
  // Execute treasury transfer
  // PHASE 1 FIX: Requires valid executor with treasury_manager/admin/elder role
  // PHASE 2 FIX: Validates whitelist, amount limits, and multisig requirements
  static async executeTreasuryTransfer(executionData: any, daoId: string, proposalId: string, executorUserId: string) {
    // Validate executor has permission (unless it's the scheduler)
    if (executorUserId !== 'system') {
      const hasPermission = await this.validateExecutionPermission(executorUserId, daoId);
      if (!hasPermission) {
        throw new Error(`User ${executorUserId} does not have permission to execute treasury transfers. Required roles: admin, elder, treasury_manager`);
      }
    }
    
    const { recipient, amount, currency, description, fromVault } = executionData;
    const transferAmount = parseFloat(amount);
    
    // PHASE 2: Validate recipient is whitelisted
    const whitelistCheck = await TreasuryValidationService.isRecipientWhitelisted(daoId, recipient);
    if (!whitelistCheck.approved) {
      throw new Error(
        `Recipient ${recipient} is not whitelisted. ` +
        `Admin approval required. Submit a whitelist request to add this address.`
      );
    }
    
    // PHASE 2: Validate transfer amount against limits
    const amountValidation = await TreasuryValidationService.validateTransferAmount(daoId, transferAmount);
    if (!amountValidation.valid) {
      throw new Error(`Transfer validation failed: ${amountValidation.reason}`);
    }
    
    // PHASE 2: Check if multisig is required
    const needsMultisig = await TreasuryValidationService.requiresMultisig(daoId, transferAmount);
    if (needsMultisig) {
      const requiredSigs = await TreasuryValidationService.getMultisigRequiredSignatures(daoId);
      const signers = await TreasuryValidationService.getAvailableSigners(daoId);
      
      // TODO: Create treasury_approval record and wait for signatures
      throw new Error(
        `Transfer of $${transferAmount.toFixed(2)} requires ${requiredSigs} out of ${signers.length} admin signatures. ` +
        `Multisig approval pending from: ${signers.slice(0, 3).join(', ')}${signers.length > 3 ? ' and others' : ''}`
      );
    }
    
    // Log treasury transaction for audit trail
    await TreasuryValidationService.logTreasuryTransaction(
      daoId,
      recipient,
      transferAmount,
      'treasury_transfer',
      true, // approved
      executorUserId
    );
    
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
      
      // Create withdrawal from vault - PHASE 1 FIX: Use actual executor
      await vaultService.withdrawToken({
        vaultId: daoVault.id,
        userId: executorUserId,
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
      
      try {
        const { TreasuryService } = await import('./services/treasuryService');
        const computed = await TreasuryService.getBalance(daoId);
        await TreasuryService.updateStoredTreasuryBalance(daoId, computed.total);
      } catch (err) {
        console.warn('[ProposalExecution] Failed to recompute stored treasury balance after transfer:', err);
      }
    }
    
    // Record the transfer transaction - PHASE 1 FIX: Include actual executor in audit
    await db.insert(walletTransactions).values({
      walletAddress: recipient,
      amount: amount.toString(),
      currency,
      type: 'transfer',
      status: 'completed',
      description: `Proposal execution by ${executorUserId}: ${description} [WHITELIST_APPROVED]`,
      daoId: daoId
    });
  }
  
  // Execute vault operations
  // PHASE 1 FIX: Requires valid executor with admin/elder role
  static async executeVaultOperation(executionData: any, daoId: string, proposalId: string, executorUserId: string) {
    // Validate executor has permission (unless it's the scheduler)
    if (executorUserId !== 'system') {
      const hasPermission = await this.validateExecutionPermission(executorUserId, daoId);
      if (!hasPermission) {
        throw new Error(`User ${executorUserId} does not have permission to execute vault operations. Required roles: admin, elder`);
      }
    }
    
    const { vaultId, operation, operationData } = executionData;
    
    switch (operation) {
      case 'create_vault':
        await vaultService.createVault({
          ...operationData,
          daoId: daoId
        });
        break;
        
      case 'deposit':
        // PHASE 1 FIX: Use actual executor instead of hardcoded 'system'
        await vaultService.depositToken({
          vaultId,
          userId: executorUserId,
          ...operationData
        });
        break;
        
      case 'withdraw':
        // PHASE 1 FIX: Use actual executor instead of hardcoded 'system'
        await vaultService.withdrawToken({
          vaultId,
          userId: executorUserId,
          ...operationData
        });
        break;
        
      case 'allocate_strategy':
        // PHASE 1 FIX: Use actual executor instead of hardcoded 'system'
        await vaultService.allocateToStrategy({
          vaultId,
          userId: executorUserId,
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
    
    // Recompute and persist stored treasury balance via TreasuryService
    try {
      const { TreasuryService } = await import('./services/treasuryService');
      const computed = await TreasuryService.getBalance(daoId);
      await TreasuryService.updateStoredTreasuryBalance(daoId, computed.total);
    } catch (err) {
      console.warn('[ProposalExecution] Failed to recompute stored treasury balance after disbursement:', err);
    }
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
      count: sql<string>`COUNT(*)`.as('count')
    })
    .from(proposalExecutionQueue)
    .where(eq(proposalExecutionQueue.daoId, daoId))
    .groupBy(proposalExecutionQueue.status);

    return stats.reduce((acc: Record<string, number>, stat) => {
      const key = stat.status ?? 'unknown';
      acc[key] = parseInt(stat.count as string, 10);
      return acc;
    }, {});
  }
}
