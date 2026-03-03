/**
 * Treasury Management API Client
 * 
 * Real implementations for PHASE 2 treasury controls:
 * - Recipient whitelist management
 * - Treasury limits configuration
 * - Multisig approval workflows
 */

export interface TreasuryWhitelistEntry {
  id: string;
  walletAddress: string;
  recipientName: string;
  category: 'charity' | 'payments' | 'team' | 'disbursements' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  expiresAt?: string;
  description?: string;
}

export interface TreasuryLimits {
  daoId: string;
  dailyCapPercentage: number;
  singleTransferMaxPercentage: number;
  multisigThresholdUSD: number;
  multisigRequiredSignatures: number;
  lastUpdated?: string;
}

export interface PendingApproval {
  id: string;
  transactionId: string;
  recipientAddress: string;
  amount: string;
  amountUSD: string;
  description: string;
  requiredSignatures: number;
  currentSignatures: number;
  signers: Array<{
    userId: string;
    role: string;
    hasSigned: boolean;
  }>;
  expiresAt: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

class TreasuryAPI {
  private baseUrl = '/api/treasury-management';
  private multisigUrl = '/api/multisig';

  private getHeaders() {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  /**
   * REQUEST WHITELIST APPROVAL
   * Submit a new recipient for whitelist approval
   */
  async requestWhitelistApproval(
    daoId: string,
    walletAddress: string,
    recipientName: string,
    category: 'charity' | 'payments' | 'team' | 'disbursements' | 'other',
    description?: string
  ): Promise<TreasuryWhitelistEntry> {
    const response = await fetch(`${this.baseUrl}/${daoId}/whitelist/request`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        walletAddress,
        recipientName,
        category,
        description,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to request whitelist approval');
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * GET WHITELIST ENTRIES
   * Fetch all whitelist entries for a DAO
   */
  async getWhitelistEntries(daoId: string): Promise<TreasuryWhitelistEntry[]> {
    const response = await fetch(`${this.baseUrl}/${daoId}/whitelist`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch whitelist entries');
    }

    const data = await response.json();
    return data.data?.entries || [];
  }

  /**
   * APPROVE WHITELIST ENTRY
   * DAO admin approves a pending whitelist entry
   * Requires: admin role
   */
  async approveWhitelistEntry(daoId: string, entryId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${daoId}/whitelist/${entryId}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to approve whitelist entry');
    }
  }

  /**
   * GET TREASURY LIMITS
   * Fetch current treasury limits for a DAO
   */
  async getTreasuryLimits(daoId: string): Promise<TreasuryLimits> {
    const response = await fetch(`${this.baseUrl}/${daoId}/limits`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch treasury limits');
    }

    const data = await response.json();
    return {
      daoId,
      dailyCapPercentage: data.data.dailyCapPercentage,
      singleTransferMaxPercentage: data.data.singleTransferMaxPercentage,
      multisigThresholdUSD: data.data.multisigThresholdUSD,
      multisigRequiredSignatures: data.data.multisigRequiredSignatures,
      lastUpdated: data.data.updatedAt,
    };
  }

  /**
   * UPDATE TREASURY LIMITS
   * DAO admin updates treasury limits
   * Requires: creator or admin role
   */
  async updateTreasuryLimits(
    daoId: string,
    limits: Partial<Omit<TreasuryLimits, 'daoId' | 'lastUpdated'>>
  ): Promise<TreasuryLimits> {
    const response = await fetch(`${this.baseUrl}/${daoId}/limits`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(limits),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update treasury limits');
    }

    const data = await response.json();
    return {
      daoId,
      dailyCapPercentage: limits.dailyCapPercentage || 10,
      singleTransferMaxPercentage: limits.singleTransferMaxPercentage || 5,
      multisigThresholdUSD: limits.multisigThresholdUSD || 10000,
      multisigRequiredSignatures: limits.multisigRequiredSignatures || 2,
      lastUpdated: data.data?.updatedAt,
    };
  }

  /**
   * GET PENDING APPROVALS
   * Fetch all pending multisig approvals for a DAO
   */
  async getPendingApprovals(daoId: string): Promise<PendingApproval[]> {
    const response = await fetch(`${this.multisigUrl}/${daoId}/pending`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch pending approvals');
    }

    const data = await response.json();
    return data.data?.approvals || [];
  }

  /**
   * SUBMIT MULTISIG SIGNATURE
   * Admin submits signature for a pending approval
   */
  async submitMultisigSignature(
    daoId: string,
    approvalId: string,
    signature: string
  ): Promise<void> {
    const response = await fetch(
      `${this.multisigUrl}/${daoId}/approval/${approvalId}/sign`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ signature }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit signature');
    }
  }

  /**
   * REJECT MULTISIG APPROVAL
   * Admin rejects a pending approval
   */
  async rejectMultisigApproval(
    daoId: string,
    approvalId: string,
    reason: string
  ): Promise<void> {
    const response = await fetch(
      `${this.multisigUrl}/${daoId}/approval/${approvalId}/reject`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ reason }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reject approval');
    }
  }

  /**
   * GET APPROVAL STATUS
   * Check if approval is ready for execution
   */
  async getApprovalStatus(
    daoId: string,
    approvalId: string
  ): Promise<{
    status: string;
    canExecute: boolean;
    currentSignatures: number;
    requiredSignatures: number;
    signaturesRemaining: number;
    expiresAt: string;
  }> {
    const response = await fetch(
      `${this.multisigUrl}/${daoId}/approval/${approvalId}/status`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch approval status');
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * GET APPROVAL DETAILS
   * Fetch detailed information about a specific approval
   */
  async getApprovalDetails(daoId: string, approvalId: string): Promise<PendingApproval> {
    const response = await fetch(
      `${this.multisigUrl}/${daoId}/approval/${approvalId}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch approval details');
    }

    const data = await response.json();
    return data.data;
  }
}

export const treasuryAPI = new TreasuryAPI();
