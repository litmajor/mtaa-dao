/**
 * Multisig Treasury API Client
 * UNIFIED: Uses existing Phase 2 endpoints with Phase 3 enhancements
 * 
 * Routes (with full error handling and logging):
 * - POST /api/dao/treasury/multisig/propose
 * - POST /api/dao/treasury/multisig/:txId/sign
 * - POST /api/dao/treasury/multisig/:txId/execute
 * - GET /api/dao/treasury/multisig/pending
 * - GET /api/dao/treasury/multisig/:txId (Phase 3)
 * - GET /api/dao/treasury/multisig/transactions/list (Phase 3)
 * - GET /api/dao/treasury/multisig/pending/detailed (Phase 3)
 * - GET /api/dao/treasury/multisig/audit-log (Phase 3)
 * - POST /api/dao/treasury/multisig/:txId/can-execute (Phase 3)
 * - POST /api/dao/treasury/multisig/:txId/enable-smart-contract (Phase 3)
 * - POST /api/dao/treasury/multisig/:txId/blockchain-execution (Phase 3)
 */

import { api, handleApiError } from './baseApi';

// ==================== Type Definitions ====================

export interface ProposeTransactionRequest {
  amount: string | number;
  recipient: string;
  purpose: string;
  currency?: string;
}

export interface TransactionResponse {
  success: boolean;
  transaction?: {
    id: string;
    daoId: string;
    proposedBy: string;
    transactionType: string;
    amount: string;
    currency: string;
    recipient: string;
    purpose: string;
    requiredSignatures: number;
    currentSignatures: number;
    status: string;
    expiresAt: string;
    createdAt: string;
    signers?: Array<{
      userId: string;
      signedAt: string;
      signature: string;
    }>;
  };
  message?: string;
  error?: string;
}

export interface SignTransactionResponse {
  success: boolean;
  approved: boolean;
  signatures: number;
  message?: string;
  error?: string;
}

export interface ExecuteTransactionResponse {
  success: boolean;
  newBalance?: string;
  message?: string;
  error?: string;
}

export interface TransactionDetailsResponse {
  success: boolean;
  transaction?: {
    id: string;
    daoId: string;
    proposedBy: string;
    transactionType: string;
    amount: string;
    currency: string;
    recipient: string;
    purpose: string;
    requiredSignatures: number;
    currentSignatures: number;
    status: string;
    approvalCount: number;
    remainingApprovals: number;
    isExecutable: boolean;
    isExpired: boolean;
    approvers: string[];
    timeUntilExpiry: number;
    expiresAt: string;
    createdAt: string;
  };
  error?: string;
}

export interface TransactionListResponse {
  success: boolean;
  transactions?: Array<{
    id: string;
    daoId: string;
    proposedBy: string;
    transactionType: string;
    amount: string;
    currency: string;
    recipient: string;
    purpose: string;
    requiredSignatures: number;
    currentSignatures: number;
    status: string;
    approvalCount: number;
    remainingApprovals: number;
    expiresAt: string;
    createdAt: string;
  }>;
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  error?: string;
}

export interface PendingApprovalsResponse {
  success: boolean;
  pending?: Array<{
    id: string;
    daoId: string;
    proposedBy: string;
    transactionType: string;
    amount: string;
    currency: string;
    recipient: string;
    purpose: string;
    requiredSignatures: number;
    approvalCount: number;
    remainingApprovals: number;
    approvers: string[];
    expiresAt: string;
    createdAt: string;
  }>;
  error?: string;
}

export interface CanExecuteResponse {
  success: boolean;
  canExecute: boolean;
  reason?: string;
  timeRemaining?: number;
  error?: string;
}

export interface AuditLogResponse {
  success: boolean;
  entries?: Array<{
    id: string;
    daoId: string;
    actorId: string;
    action: string;
    amount?: string;
    previousBalance?: string;
    newBalance?: string;
    reason: string;
    multisigTxId?: string;
    transactionHash?: string;
    severity?: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  error?: string;
}

export interface EnableSmartContractResponse {
  success: boolean;
  timelockEnd?: string;
  message?: string;
  error?: string;
}

export interface BlockchainExecutionResponse {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  message?: string;
  error?: string;
}

// ==================== API Client ====================

export const multisigAPI = {
  /**
   * Propose a new multisig transaction
   * Requires: elder or admin role
   * @param daoId - DAO identifier
   * @param request - Transaction proposal details
   */
  async proposeTransaction(
    daoId: string,
    request: ProposeTransactionRequest
  ): Promise<TransactionResponse> {
    try {
      if (!request.amount || !request.recipient || !request.purpose) {
        throw new Error('Amount, recipient, and purpose are required');
      }

      const response = await api.post<TransactionResponse>(
        `/api/dao/treasury/multisig/propose`,
        request,
        { headers: { 'X-DAO-ID': daoId }, retries: 2 }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to propose transaction');
      }

      console.log(`[Multisig] Transaction proposed: ${response.transaction?.id}`);
      return response;
    } catch (error: any) {
      console.error('[Multisig] Proposal failed:', error);
      throw {
        success: false,
        error: handleApiError(error),
      } as TransactionResponse;
    }
  },

  /**
   * Sign/approve a pending transaction
   * Requires: authorized signer (treasury signer)
   * @param daoId - DAO identifier
   * @param txId - Transaction ID to sign
   */
  async approveTransaction(daoId: string, txId: string): Promise<SignTransactionResponse> {
    try {
      if (!txId) throw new Error('Transaction ID is required');

      const response = await api.post<SignTransactionResponse>(
        `/api/dao/treasury/multisig/${txId}/sign`,
        {},
        { headers: { 'X-DAO-ID': daoId }, retries: 2 }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to approve transaction');
      }

      console.log(`[Multisig] Transaction approved: ${response.signatures} signatures`);
      return response;
    } catch (error: any) {
      console.error('[Multisig] Approval failed:', error);
      throw {
        success: false,
        error: handleApiError(error),
      } as SignTransactionResponse;
    }
  },

  /**
   * Execute an approved transaction
   * Requires: sufficient approvals + timelock elapsed
   * @param daoId - DAO identifier
   * @param txId - Transaction ID to execute
   */
  async executeTransaction(daoId: string, txId: string): Promise<ExecuteTransactionResponse> {
    try {
      if (!txId) throw new Error('Transaction ID is required');

      const response = await api.post<ExecuteTransactionResponse>(
        `/api/dao/treasury/multisig/${txId}/execute`,
        {},
        { headers: { 'X-DAO-ID': daoId }, retries: 2 }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to execute transaction');
      }

      console.log(`[Multisig] Transaction executed, new balance: ${response.newBalance}`);
      return response;
    } catch (error: any) {
      console.error('[Multisig] Execution failed:', error);
      throw {
        success: false,
        error: handleApiError(error),
      } as ExecuteTransactionResponse;
    }
  },

  /**
   * Get transaction details with approval status
   * PHASE 3 Enhancement: Returns full details including timelock, approvers, executability
   * @param daoId - DAO identifier
   * @param txId - Transaction ID
   */
  async getTransaction(daoId: string, txId: string): Promise<TransactionDetailsResponse> {
    try {
      if (!txId) throw new Error('Transaction ID is required');

      return await api.get<TransactionDetailsResponse>(
        `/api/dao/treasury/multisig/${txId}`,
        { headers: { 'X-DAO-ID': daoId } }
      );
    } catch (error: any) {
      console.error('[Multisig] Get transaction failed:', error);
      return {
        success: false,
        error: handleApiError(error),
      };
    }
  },

  /**
   * Get paginated transaction list
   * PHASE 3 Enhancement: Supports filtering by status
   * @param daoId - DAO identifier
   * @param status - Optional: 'pending', 'approved', 'executed', 'rejected', 'expired'
   * @param limit - Pagination limit (default 50)
   * @param offset - Pagination offset (default 0)
   */
  async getTransactions(
    daoId: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionListResponse> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      return await api.get<TransactionListResponse>(
        `/api/dao/treasury/multisig/transactions/list?${params.toString()}`,
        { headers: { 'X-DAO-ID': daoId } }
      );
    } catch (error: any) {
      console.error('[Multisig] Get transactions failed:', error);
      return {
        success: false,
        error: handleApiError(error),
      };
    }
  },

  /**
   * Get pending transactions with detailed approval info
   * PHASE 3 Enhancement: Includes approval counts and remaining approvals
   * @param daoId - DAO identifier
   */
  async getPendingApprovals(daoId: string): Promise<PendingApprovalsResponse> {
    try {
      return await api.get<PendingApprovalsResponse>(
        `/api/dao/treasury/multisig/pending/detailed`,
        { headers: { 'X-DAO-ID': daoId } }
      );
    } catch (error: any) {
      console.error('[Multisig] Get pending approvals failed:', error);
      return {
        success: false,
        error: handleApiError(error),
      };
    }
  },

  /**
   * Check if a transaction can be executed
   * PHASE 3 Enhancement: Validates approvals, timelock, and smart contract features
   * @param daoId - DAO identifier
   * @param txId - Transaction ID to check
   */
  async canExecuteTransaction(daoId: string, txId: string): Promise<CanExecuteResponse> {
    try {
      if (!txId) throw new Error('Transaction ID is required');

      return await api.post<CanExecuteResponse>(
        `/api/dao/treasury/multisig/${txId}/can-execute`,
        {},
        { headers: { 'X-DAO-ID': daoId } }
      );
    } catch (error: any) {
      console.error('[Multisig] Can execute check failed:', error);
      return {
        success: false,
        canExecute: false,
        reason: handleApiError(error),
      };
    }
  },

  /**
   * Get audit log for treasury operations
   * PHASE 3 Enhancement: Comprehensive audit trail with filtering
   * @param daoId - DAO identifier
   * @param actionType - Optional: filter by action type
   * @param limit - Pagination limit (default 50)
   * @param offset - Pagination offset (default 0)
   */
  async getAuditLog(
    daoId: string,
    actionType?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLogResponse> {
    try {
      const params = new URLSearchParams();
      if (actionType) params.append('actionType', actionType);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      return await api.get<AuditLogResponse>(
        `/api/dao/treasury/multisig/audit-log?${params.toString()}`,
        { headers: { 'X-DAO-ID': daoId } }
      );
    } catch (error: any) {
      console.error('[Multisig] Get audit log failed:', error);
      return {
        success: false,
        error: handleApiError(error),
      };
    }
  },

  /**
   * PHASE 3: Enable smart contract features for a transaction
   * Adds timelock and voting snapshot integration
   * @param daoId - DAO identifier
   * @param txId - Transaction ID
   * @param timelockDays - Timelock duration in days (default 2)
   * @param votingSnapshotId - Optional: linked voting snapshot ID
   * @param blockNumber - Optional: blockchain block number
   */
  async enableSmartContractFeatures(
    daoId: string,
    txId: string,
    timelockDays: number = 2,
    votingSnapshotId?: string,
    blockNumber?: number
  ): Promise<EnableSmartContractResponse> {
    try {
      if (!txId) throw new Error('Transaction ID is required');

      return await api.post<EnableSmartContractResponse>(
        `/api/dao/treasury/multisig/${txId}/enable-smart-contract`,
        {
          timelockDays,
          votingSnapshotId,
          blockNumber,
        },
        {
          headers: { 'X-DAO-ID': daoId },
        }
      );
    } catch (error: any) {
      console.error('[Multisig] Enable smart contract features failed:', error);
      return {
        success: false,
        error: handleApiError(error),
      };
    }
  },

  /**
   * PHASE 3: Record on-chain blockchain execution
   * Stores transaction hash and block number when executed on smart contracts
   * @param daoId - DAO identifier
   * @param txId - Transaction ID
   * @param txHash - Blockchain transaction hash
   * @param blockNumber - Block number of execution
   */
  async recordBlockchainExecution(
    daoId: string,
    txId: string,
    txHash: string,
    blockNumber: number
  ): Promise<BlockchainExecutionResponse> {
    try {
      if (!txId || !txHash || !blockNumber) {
        throw new Error('Transaction ID, hash, and block number are required');
      }

      return await api.post<BlockchainExecutionResponse>(
        `/api/dao/treasury/multisig/${txId}/blockchain-execution`,
        {
          txHash,
          blockNumber,
        },
        {
          headers: { 'X-DAO-ID': daoId },
        }
      );
    } catch (error: any) {
      console.error('[Multisig] Record blockchain execution failed:', error);
      return {
        success: false,
        error: handleApiError(error),
      };
    }
  },

  // ==================== Helper Functions ====================

  /**
   * Get approval percentage
   * @param approvalCount - Current approvals
   * @param requiredCount - Required approvals
   */
  getApprovalPercentage(approvalCount: number, requiredCount: number): number {
    return Math.min(100, (approvalCount / requiredCount) * 100);
  },

  /**
   * Check if transaction is executable
   */
  isTransactionExecutable(tx: TransactionDetailsResponse['transaction']): boolean {
    if (!tx) return false;
    return tx.isExecutable && !tx.isExpired && tx.approvalCount >= tx.requiredSignatures;
  },

  /**
   * Format timelock remaining
   */
  formatTimelockRemaining(milliseconds: number): string {
    if (milliseconds <= 0) return 'Ready to execute';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h ${minutes % 60}m remaining`;
    if (minutes > 0) return `${minutes}m remaining`;
    return `${seconds}s remaining`;
  },

  /**
   * Get status badge color
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'executed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'expired':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  },
};

export default multisigAPI;
