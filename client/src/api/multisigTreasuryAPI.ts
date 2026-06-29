/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Multisig Treasury API Client (Unified End-to-End)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Complete client API for multisig workflows:
 * - Create multisig wallet (admin only)
 * - Propose withdrawals (admin only)
 * - List pending approvals (all members)
 * - Sign approvals (signers only)
 * - Execute approvals (signers only)
 * 
 * Integrated with: `/v1/daos/:daoId/treasury/multisig/*` backend
 */

import { authClient } from '../../src/utils/authClient';

// ────────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ────────────────────────────────────────────────────────────────────────────────

export interface MultisigCreateRequest {
  signers: string[]; // wallet addresses or user IDs
  requiredSignatures: number;
  chainId?: number; // default 44787
  simulation?: boolean; // if true, don't deploy on-chain
}

export interface MultisigCreateResponse {
  success: boolean;
  multisigId: string;
  multisigAddress: string;
  signers: string[];
  requiredSignatures: number;
  chainId: number;
  createdAt: string;
  createdBy: string;
  status: 'pending' | 'deployed' | 'simulation';
}

export interface MultisigConfig {
  requiredApprovals: number;
  totalSigners: number;
  withdrawalThreshold: string;
  approvalTimeout: number;
  depositThreshold: null;
}

export interface MultisigConfigResponse {
  success: boolean;
  daoId: string;
  config: MultisigConfig;
}

export interface MultisigProposeRequest {
  recipient: string;
  amount: string;
  purpose: string;
}

export interface MultisigApproval {
  id: string;
  daoId: string;
  proposedBy: string;
  recipient: string;
  amount: string;
  purpose: string;
  requiredSignatures: number;
  currentSignatures: number;
  status: 'pending' | 'approved' | 'executed' | 'rejected' | 'expired';
  approvalCount?: number;
  remainingApprovals?: number;
  approvers?: string[];
  timeUntilExpiry?: number;
  expiresAt: string;
  createdAt: string;
  signers?: Array<{
    address: string;
    signed: boolean;
    signedAt?: string;
  }>;
}

export interface MultisigApprovalsListResponse {
  success: boolean;
  daoId: string;
  approvals: MultisigApproval[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface MultisigSignResponse {
  success: boolean;
  approvalId: string;
  status: 'pending' | 'approved';
  requiredSignatures: number;
  currentSignatures: number;
  signers: Array<{
    address: string;
    signed: boolean;
    signedAt?: string;
  }>;
  message?: string;
}

export interface MultisigExecuteResponse {
  success: boolean;
  approvalId: string;
  status: 'executed';
  transactionHash?: string;
  newBalance?: string;
  executedAt: string;
}

export interface MultisigSigner {
  id: string;
  address: string;
  role: 'admin' | 'elder' | 'member';
  name?: string;
  activeSince: string;
  approvalsCount?: number;
}

export interface MultisigSignersResponse {
  success: boolean;
  daoId: string;
  signers: MultisigSigner[];
}

// ────────────────────────────────────────────────────────────────────────────────
// API CLIENT
// ────────────────────────────────────────────────────────────────────────────────

export class MultisigTreasuryAPI {
  private baseUrl = '/v1/daos';

  private getHeaders() {
    const authHeaders = authClient.getAuthHeaders();
    return {
      'Content-Type': 'application/json',
      ...authHeaders,
    };
  }

  /**
   * Create a new multisig wallet for the DAO treasury.
   * 
   * REQUIRES: Admin or elder role in DAO
   * SECURITY: Logs CRITICAL audit event
   * 
   * @param daoId - DAO identifier
   * @param request - Multisig creation parameters
   * @returns MultisigCreateResponse
   */
  async createMultisig(
    daoId: string,
    request: MultisigCreateRequest
  ): Promise<MultisigCreateResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${daoId}/treasury/multisig/create`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to create multisig');
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Multisig create error:', error);
      throw error;
    }
  }

  /**
   * Fetch multisig configuration for the DAO.
   * 
   * Accessible by: All DAO members
   * 
   * @param daoId - DAO identifier
   * @returns MultisigConfigResponse
   */
  async getConfig(daoId: string): Promise<MultisigConfigResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${daoId}/treasury/multisig/config`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to fetch config');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Config fetch error:', error);
      throw error;
    }
  }

  /**
   * Propose a treasury withdrawal / transfer.
   * 
   * REQUIRES: Admin or elder role in DAO
   * SECURITY: Logs HIGH audit event
   * 
   * @param daoId - DAO identifier
   * @param request - Proposal parameters
   * @returns MultisigApproval (newly created)
   */
  async proposeTransfer(
    daoId: string,
    request: MultisigProposeRequest
  ): Promise<MultisigApproval> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${daoId}/treasury/multisig/propose`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to propose transfer');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Propose transfer error:', error);
      throw error;
    }
  }

  /**
   * List pending multisig approvals.
   * 
   * Accessible by: All DAO members
   * 
   * @param daoId - DAO identifier
   * @param status - Filter by status (optional)
   * @param limit - Pagination limit (default 50)
   * @param offset - Pagination offset (default 0)
   * @returns MultisigApprovalsListResponse
   */
  async getApprovals(
    daoId: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MultisigApprovalsListResponse> {
    try {
      const query = new URLSearchParams();
      if (status) query.append('status', status);
      query.append('limit', String(limit));
      query.append('offset', String(offset));

      const response = await fetch(
        `${this.baseUrl}/${daoId}/treasury/multisig/approvals?${query}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to fetch approvals');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Approvals fetch error:', error);
      throw error;
    }
  }

  /**
   * Sign (approve) a multisig proposal.
   * 
   * REQUIRES: Be an authorized signer (admin/elder)
   * SECURITY: Logs HIGH audit event
   * 
   * @param daoId - DAO identifier
   * @param approvalId - Approval ID to sign
   * @param comment - Optional comment
   * @returns MultisigSignResponse
   */
  async signApproval(
    daoId: string,
    approvalId: string,
    comment?: string
  ): Promise<MultisigSignResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${daoId}/treasury/multisig/${approvalId}/sign`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ comment }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to sign approval');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Sign approval error:', error);
      throw error;
    }
  }

  /**
   * Execute an approved multisig proposal.
   * 
   * REQUIRES: 
   *   - Be an authorized signer
   *   - Threshold signatures collected
   *   - Timelock expired (if applicable)
   * SECURITY: Logs CRITICAL audit event
   * 
   * @param daoId - DAO identifier
   * @param approvalId - Approval ID to execute
   * @returns MultisigExecuteResponse
   */
  async executeApproval(daoId: string, approvalId: string): Promise<MultisigExecuteResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${daoId}/treasury/multisig/${approvalId}/execute`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to execute approval');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Execute approval error:', error);
      throw error;
    }
  }

  /**
   * List authorized signers for the DAO's multisig.
   * 
   * Accessible by: All DAO members
   * 
   * @param daoId - DAO identifier
   * @returns MultisigSignersResponse
   */
  async getSigners(daoId: string): Promise<MultisigSignersResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${daoId}/treasury/multisig/signers`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to fetch signers');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Signers fetch error:', error);
      throw error;
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ────────────────────────────────────────────────────────────────────────────────

export const multisigTreasuryAPI = new MultisigTreasuryAPI();

export default multisigTreasuryAPI;
