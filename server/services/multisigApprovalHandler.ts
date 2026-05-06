/**
 * Multisig Approval Handler Service
 * 
 * Core service for managing withdrawal approvals with multisig support:
 * - Creates approval requests with configurable signature requirements
 * - Collects and validates signatures from authorized signers
 * - Executes withdrawals once threshold is met
 * - Handles approval timeouts and expiration
 * - Maintains complete audit trail with timestamps and signer details
 * 
 * ⚠️ CRITICAL: This service enforces governance for DAO treasury operations
 */

import { db } from '../storage';
import { eq, and, desc, lt } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { 
  withdrawalApprovals, 
  multisigSignatures, 
  vaults, 
  vaultTransactions
} from '@shared/schema';
import { logConsolidatedAuditEvent } from './auditConsolidated';

export interface ApprovalRequest {
  id: string;
  vaultId: string;
  daoId: string;
  userId: string;
  amount: number;
  destination: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';
  requiredSignatures: number;
  currentSignatures: number;
  signers: SignerInfo[];
  expiresAt: Date;
  createdAt: Date;
  executedAt?: Date;
}

export interface SignerInfo {
  userId: string;
  userRole: 'member' | 'elder' | 'admin';
  signature?: string;
  signedAt?: Date;
  ipAddress?: string;
  approved?: boolean;
  rejected?: boolean;
}

export interface ApprovalSignatureInput {
  approvalId: string;
  signerId: string;
  signature: string;
  ipAddress?: string;
  approved: boolean; // true = approve, false = reject
}

// ════════════════════════════════════════════════════════════════════════════════
// APPROVAL REQUEST CREATION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Create a new withdrawal approval request
 * Called by withdrawal endpoint when multisig is required
 */
export async function createApprovalRequest(
  vaultId: string,
  daoId: string,
  userId: string,
  amount: string,
  destination: string,
  requiredSignatures: number,
  signers: SignerInfo[],
  approvalTimeoutMs: number = 604800000 // 7 days default
): Promise<ApprovalRequest> {
  try {
    const approvalId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + approvalTimeoutMs);

    // Prepare signers array
    const signersData = signers.map((signer) => ({
      userId: signer.userId,
      userRole: signer.userRole,
      approved: false,
      rejected: false,
    }));

    // Insert approval request
    await db.insert(withdrawalApprovals).values({
      id: approvalId as any,
      vaultId: vaultId as any,
      daoId: daoId as any,
      userId: userId as any,
      amount: amount as any,
      destination: destination as any,
      status: 'pending' as any,
      requiredSignatures: requiredSignatures as any,
      currentSignatures: 0 as any,
      signers: JSON.stringify(signersData) as any,
      expiresAt: expiresAt,
      createdAt: now,
      updatedAt: now,
    } as any);

    // Log approval creation
    await logConsolidatedAuditEvent({
      dao_id: daoId,
      user_id: userId,
      action: 'withdrawal_approval_created',
      severity: 'high',
      details: {
        approvalId,
        vaultId,
        amount,
        destination,
        requiredSignatures,
        signerCount: signers.length,
        expiresAt: expiresAt.toISOString(),
      },
    } as any);

    return {
      id: approvalId,
      vaultId,
      daoId,
      userId,
      amount: parseFloat(amount),
      destination,
      status: 'pending',
      requiredSignatures,
      currentSignatures: 0,
      signers: signersData,
      expiresAt,
      createdAt: now,
    };
  } catch (error) {
    console.error('Error creating approval request:', error);
    throw error;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// SIGNATURE COLLECTION & VALIDATION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Add a signer's approval/rejection
 */
export async function addSignature(
  input: ApprovalSignatureInput
): Promise<{ approved: boolean; currentSignatures: number; status: string }> {
  try {
    const { approvalId, signerId, signature, ipAddress, approved } = input;

    // 1. Verify approval exists and is still pending
    const approvalData = await db
      .select()
      .from(withdrawalApprovals)
      .where(eq(withdrawalApprovals.id, approvalId));

    if (!approvalData || approvalData.length === 0) {
      throw new Error('Approval request not found');
    }

    const approval = approvalData[0];

    if (approval.status !== 'pending') {
      throw new Error(`Approval is no longer pending (status: ${approval.status})`);
    }

    // Check if expired
    if (approval.expiresAt <= new Date()) {
      await updateApprovalStatus(approvalId, 'expired');
      throw new Error('Approval request has expired');
    }

    // 2. Verify signer is authorized
    const signers = JSON.parse(approval.signers || '[]');
    const signerRecord = signers.find((s: any) => s.userId === signerId);

    if (!signerRecord) {
      throw new Error('Signer not authorized for this approval');
    }

    // Check if already signed
    const existingSignature = await db
      .select()
      .from(multisigSignatures)
      .where(
        and(
          eq(multisigSignatures.approvalId, approvalId),
          eq(multisigSignatures.signerId, signerId)
        )
      );

    if (existingSignature && existingSignature.length > 0) {
      throw new Error('Signer has already signed this approval');
    }

    // 3. Record signature
    const signatureId = randomUUID();
    const now = new Date();

    await db.insert(multisigSignatures).values({
      id: signatureId as any,
      approvalId: approvalId as any,
      signerId: signerId as any,
      signer_role: signerRecord.userRole as any,
      signature: signature as any,
      signed_at: now,
      ip_address: ipAddress,
      is_valid: true,
      verification_error: null,
      createdAt: now,
      updatedAt: now,
    } as any);

    // 4. Update signer status in approval
    const updatedSigners = signers.map((s: any) => {
      if (s.userId === signerId) {
        return {
          ...s,
          approved: approved,
          rejected: !approved,
          signature,
          signedAt: now.toISOString(),
          ipAddress,
        };
      }
      return s;
    });

    // 5. Count approvals
    const approvalCount = updatedSigners.filter((s: any) => s.approved).length;
    const rejectionCount = updatedSigners.filter((s: any) => s.rejected).length;

    // 6. Check if threshold met or rejected
    let newStatus = 'pending';
    if (approvalCount >= approval.requiredSignatures) {
      newStatus = 'approved';
    } else if (rejectionCount > signers.length - approval.requiredSignatures) {
      newStatus = 'rejected';
    }

    // Update approval with new signer data
    await db.update(withdrawalApprovals)
      .set({
        signers: JSON.stringify(updatedSigners) as any,
        currentSignatures: approvalCount as any,
        status: newStatus as any,
        updatedAt: now,
      })
      .where(eq(withdrawalApprovals.id, approvalId));

    // Log signature
    await logConsolidatedAuditEvent({
      dao_id: approval.daoId,
      user_id: signerId,
      action: approved ? 'withdrawal_approved' : 'withdrawal_rejected',
      severity: 'high',
      details: {
        approvalId,
        signer: signerId,
        signature: signature.substring(0, 20) + '...', // Truncate for logging
        approvalCount,
        rejectionCount,
        currentStatus: newStatus,
      },
    } as any);

    // 7. If approved, execute withdrawal
    if (newStatus === 'approved') {
      await executeWithdrawal(approvalId);
    }

    // 8. If rejected, mark as rejected
    if (newStatus === 'rejected') {
      await updateApprovalStatus(approvalId, 'rejected');
    }

    return {
      approved: newStatus === 'approved',
      currentSignatures: approvalCount,
      status: newStatus,
    };
  } catch (error) {
    console.error('Error adding signature:', error);
    throw error;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL EXECUTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Execute withdrawal after approval threshold reached
 */
export async function executeWithdrawal(approvalId: string): Promise<void> {
  try {
    // 1. Get approval request
    const approvalData = await db
      .select()
      .from(withdrawalApprovals)
      .where(eq(withdrawalApprovals.id, approvalId));

    if (!approvalData || approvalData.length === 0) {
      throw new Error('Approval not found');
    }

    const approval = approvalData[0];

    // 2. Verify status is approved
    if (approval.status !== 'approved') {
      throw new Error(`Cannot execute withdrawal with status: ${approval.status}`);
    }

    // 3. Get vault and verify balance
    const vaultData = await db
      .select()
      .from(vaults)
      .where(eq(vaults.id, approval.vaultId));

    if (!vaultData || vaultData.length === 0) {
      throw new Error('Vault not found');
    }

    const vault = vaultData[0];
    const vaultBalance = parseFloat(vault.balance || '0');
    const withdrawalAmount = parseFloat(approval.amount);

    if (vaultBalance < withdrawalAmount) {
      throw new Error(`Insufficient vault balance. Available: ${vaultBalance}, Requested: ${withdrawalAmount}`);
    }

    // 4. Update vault balance
    const newBalance = vaultBalance - withdrawalAmount;
    const now = new Date();

    await db.update(vaults)
      .set({
        balance: newBalance.toString(),
        updatedAt: now,
      })
      .where(eq(vaults.id, approval.vaultId));

    // 5. Create transaction record
    const txId = randomUUID();
    await db.insert(vaultTransactions).values({
      id: txId as any,
      vaultId: approval.vaultId as any,
      userId: approval.userId as any,
      transactionType: 'withdrawal' as any,
      tokenSymbol: vault.currency as any,
      amount: approval.amount as any,
      valueUSD: '0' as any,
      status: 'completed' as any,
      approvalId: approvalId as any,
      destination_address: approval.destination as any,
      createdAt: now,
      updatedAt: now,
    } as any);

    // 6. Update approval status
    await db.update(withdrawalApprovals)
      .set({
        status: 'executed' as any,
        executedAt: now,
        executedBy: approval.userId as any,
        updatedAt: now,
      })
      .where(eq(withdrawalApprovals.id, approvalId));

    // 7. Get signers for audit trail
    const signatures = await db
      .select()
      .from(multisigSignatures)
      .where(eq(multisigSignatures.approvalId, approvalId));

    const signersList = signatures.map((sig) => ({
      userId: sig.signerId,
      role: sig.signer_role,
      signedAt: sig.signed_at,
    }));

    // 8. Log execution
    await logConsolidatedAuditEvent({
      dao_id: approval.daoId,
      user_id: approval.userId,
      action: 'withdrawal_executed',
      severity: 'critical', // CRITICAL: funds moved
      details: {
        approvalId,
        vaultId: approval.vaultId,
        amount: approval.amount,
        destination: approval.destination,
        newVaultBalance: newBalance.toFixed(2),
        txId,
        signers: signersList,
        signatureCount: signatures.length,
      },
    } as any);

    console.log(`✅ Withdrawal executed successfully. Approval: ${approvalId}, Transaction: ${txId}`);
  } catch (error) {
    console.error('Error executing withdrawal:', error);
    throw error;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// STATUS MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Update approval status
 */
export async function updateApprovalStatus(
  approvalId: string,
  newStatus: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired'
): Promise<void> {
  try {
    await db.update(withdrawalApprovals)
      .set({
        status: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(withdrawalApprovals.id, approvalId));

    // Log status change
    const approval = await db
      .select()
      .from(withdrawalApprovals)
      .where(eq(withdrawalApprovals.id, approvalId));

    if (approval && approval.length > 0) {
      await logConsolidatedAuditEvent({
        dao_id: approval[0].daoId,
        user_id: approval[0].userId,
        action: 'withdrawal_status_changed',
        severity: 'medium',
        details: {
          approvalId,
          oldStatus: approval[0].status,
          newStatus,
        },
      } as any);
    }
  } catch (error) {
    console.error('Error updating approval status:', error);
    throw error;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TIMEOUT HANDLING
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Process expired approval requests
 * Run periodically (e.g., hourly cron job)
 */
export async function processExpiredApprovals(): Promise<number> {
  try {
    const now = new Date();

    // Find all pending approvals that have expired
    const expiredApprovals = await db
      .select()
      .from(withdrawalApprovals)
      .where(
        and(
          eq(withdrawalApprovals.status, 'pending'),
          lt(withdrawalApprovals.expiresAt, now)
        )
      );

    // Update each to expired status
    for (const approval of expiredApprovals) {
      await updateApprovalStatus(approval.id, 'expired');

      console.log(`⏱️  Approval expired: ${approval.id}`);
    }

    return expiredApprovals.length;
  } catch (error) {
    console.error('Error processing expired approvals:', error);
    throw error;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// QUERY OPERATIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get approval request details
 */
export async function getApprovalRequest(approvalId: string): Promise<ApprovalRequest | null> {
  try {
    const approval = await db
      .select()
      .from(withdrawalApprovals)
      .where(eq(withdrawalApprovals.id, approvalId));

    if (!approval || approval.length === 0) {
      return null;
    }

    const data = approval[0];
    return {
      id: data.id,
      vaultId: data.vaultId,
      daoId: data.daoId,
      userId: data.userId,
      amount: parseFloat(data.amount || '0'),
      destination: data.destination,
      status: data.status,
      requiredSignatures: data.requiredSignatures,
      currentSignatures: data.currentSignatures,
      signers: JSON.parse(data.signers || '[]'),
      expiresAt: data.expiresAt || new Date(),
      createdAt: data.createdAt || new Date(),
      executedAt: data.executedAt,
    };
  } catch (error) {
    console.error('Error getting approval request:', error);
    throw error;
  }
}

/**
 * Get pending approvals for a DAO
 */
export async function getPendingApprovals(daoId: string): Promise<ApprovalRequest[]> {
  try {
    const approvals = await db
      .select()
      .from(withdrawalApprovals)
      .where(
        and(
          eq(withdrawalApprovals.daoId, daoId),
          eq(withdrawalApprovals.status, 'pending')
        )
      )
      .orderBy(desc(withdrawalApprovals.createdAt));

    return approvals.map((data) => ({
      id: data.id,
      vaultId: data.vaultId,
      daoId: data.daoId,
      userId: data.userId,
      amount: parseFloat(data.amount || '0'),
      destination: data.destination,
      status: data.status,
      requiredSignatures: data.requiredSignatures,
      currentSignatures: data.currentSignatures,
      signers: JSON.parse(data.signers || '[]'),
      expiresAt: data.expiresAt || new Date(),
      createdAt: data.createdAt || new Date(),
      executedAt: data.executedAt,
    }));
  } catch (error) {
    console.error('Error getting pending approvals:', error);
    throw error;
  }
}

/**
 * Get approvals requiring signature from a user
 */
export async function getApprovalsForSigner(
  daoId: string,
  userId: string
): Promise<ApprovalRequest[]> {
  try {
    const allApprovals = await db
      .select()
      .from(withdrawalApprovals)
      .where(
        and(
          eq(withdrawalApprovals.daoId, daoId),
          eq(withdrawalApprovals.status, 'pending')
        )
      )
      .orderBy(desc(withdrawalApprovals.createdAt));

    // Filter for approvals where this user is a signer
    return allApprovals
      .filter((approval) => {
        const signers = JSON.parse(approval.signers || '[]');
        const userSigner = signers.find((s: any) => s.userId === userId);
        return userSigner && !userSigner.approved && !userSigner.rejected; // Not yet signed
      })
      .map((data) => ({
        id: data.id,
        vaultId: data.vaultId,
        daoId: data.daoId,
        userId: data.userId,
        amount: parseFloat(data.amount || '0'),
        destination: data.destination,
        status: data.status,
        requiredSignatures: data.requiredSignatures,
        currentSignatures: data.currentSignatures,
        signers: JSON.parse(data.signers || '[]'),
        expiresAt: data.expiresAt || new Date(),
        createdAt: data.createdAt || new Date(),
        executedAt: data.executedAt,
      }));
  } catch (error) {
    console.error('Error getting approvals for signer:', error);
    throw error;
  }
}

/**
 * Get signature history for an approval
 */
export async function getSignatureHistory(approvalId: string) {
  try {
    const signatures = await db
      .select()
      .from(multisigSignatures)
      .where(eq(multisigSignatures.approvalId, approvalId))
      .orderBy(desc(multisigSignatures.signed_at));

    return signatures.map((sig) => ({
      id: sig.id,
      signerId: sig.signerId,
      signer_role: sig.signer_role,
      signature: sig.signature,
      signedAt: sig.signed_at,
      ipAddress: sig.ip_address,
      isValid: sig.is_valid,
      verificationError: sig.verification_error,
    }));
  } catch (error) {
    console.error('Error getting signature history:', error);
    throw error;
  }
}

export default {
  createApprovalRequest,
  addSignature,
  executeWithdrawal,
  updateApprovalStatus,
  processExpiredApprovals,
  getApprovalRequest,
  getPendingApprovals,
  getApprovalsForSigner,
  getSignatureHistory,
};
