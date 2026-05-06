/**
 * Approval Dashboard Component
 * 
 * Dashboard for DAO signers to review and approve/reject pending withdrawals
 * Features:
 * - Display pending approvals with countdown timers
 * - Show signature status (X of N signatures)
 * - Display signer details and timestamps
 * - Allow approve/reject actions
 * - Show transaction history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { CheckCircle, XCircle, Clock, DollarSign, Users, AlertCircle } from 'lucide-react';

interface Signer {
  userId: string;
  userRole: 'member' | 'elder' | 'admin';
  approved?: boolean;
  rejected?: boolean;
  signature?: string;
  signedAt?: string;
  ipAddress?: string;
}

interface ApprovalRequest {
  id: string;
  vaultId: string;
  daoId: string;
  userId: string;
  amount: number;
  destination: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';
  requiredSignatures: number;
  currentSignatures: number;
  signers: Signer[];
  expiresAt: Date;
  createdAt: Date;
  executedAt?: Date;
}

interface Vault {
  id: string;
  name: string;
  type: string;
  balance: string;
  currency: string;
}

interface ApprovalDetails {
  approval: ApprovalRequest;
  signatures: any[];
  vault: Vault;
}

interface ApprovalDashboardProps {
  daoId: string;
  onRefresh?: () => void;
}

const ApprovalDashboard: React.FC<ApprovalDashboardProps> = ({ daoId, onRefresh }) => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [userRole, setUserRole] = useState<string>('member');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch pending approvals
  const fetchPendingApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/daos/${daoId}/treasury/withdrawals/signer-pending`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch approvals');
      }

      const data = await response.json();
      setApprovals(data.approvals);
      setUserRole(data.userRole);
    } catch (err) {
      console.error('Error fetching approvals:', err);
      setError('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, [daoId]);

  // Fetch approval details
  const fetchApprovalDetails = useCallback(
    async (approvalId: string) => {
      try {
        const response = await fetch(
          `/api/v1/daos/${daoId}/treasury/withdrawals/${approvalId}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch approval details');
        }

        const data = await response.json();
        setSelectedApproval({
          approval: { ...data.approval, expiresAt: new Date(data.approval.expiresAt) },
          signatures: data.signatures,
          vault: data.vault,
        });
      } catch (err) {
        console.error('Error fetching approval details:', err);
        setError('Failed to load approval details');
      }
    },
    [daoId]
  );

  // Initial load
  useEffect(() => {
    fetchPendingApprovals();

    // Set up interval to refresh every 30 seconds
    const refreshInterval = setInterval(fetchPendingApprovals, 30000);

    return () => clearInterval(refreshInterval);
  }, [fetchPendingApprovals]);

  // Handle approval
  const handleApprove = useCallback(
    async (approvalId: string) => {
      try {
        setSigning(true);
        setError(null);

        // In real implementation, signature would be generated here
        // For now, using a placeholder
        const signature = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const response = await fetch(
          `/api/v1/daos/${daoId}/treasury/withdrawals/${approvalId}/approve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signature }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to approve');
        }

        const result = await response.json();
        setSuccessMessage(result.message);

        // Refresh data
        await fetchPendingApprovals();
        if (selectedApproval) {
          await fetchApprovalDetails(approvalId);
        }

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (err: any) {
        console.error('Error approving:', err);
        setError(err.message || 'Failed to approve withdrawal');
      } finally {
        setSigning(false);
      }
    },
    [daoId, fetchPendingApprovals, selectedApproval, fetchApprovalDetails]
  );

  // Handle rejection
  const handleReject = useCallback(
    async (approvalId: string, reason: string = '') => {
      try {
        setSigning(true);
        setError(null);

        const response = await fetch(
          `/api/v1/daos/${daoId}/treasury/withdrawals/${approvalId}/reject`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to reject');
        }

        const result = await response.json();
        setSuccessMessage(result.message);

        // Refresh data
        await fetchPendingApprovals();
        if (selectedApproval) {
          await fetchApprovalDetails(approvalId);
        }

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (err: any) {
        console.error('Error rejecting:', err);
        setError(err.message || 'Failed to reject withdrawal');
      } finally {
        setSigning(false);
      }
    },
    [daoId, fetchPendingApprovals, selectedApproval, fetchApprovalDetails]
  );

  const isExpired = selectedApproval?.approval 
    ? isPast(new Date(selectedApproval.approval.expiresAt))
    : false;

  const isApprovalMet = selectedApproval?.approval 
    ? selectedApproval.approval.currentSignatures >= selectedApproval.approval.requiredSignatures
    : false;

  const timeRemaining = selectedApproval?.approval
    ? formatDistanceToNow(new Date(selectedApproval.approval.expiresAt), { addSuffix: true })
    : '';

  return (
    <div className="approval-dashboard space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Withdrawal Approvals</h2>
        <button
          onClick={fetchPendingApprovals}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-green-700 text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Approvals List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                Pending Approvals ({approvals.length})
              </h3>
            </div>

            {approvals.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No pending approvals requiring your signature
              </div>
            ) : (
              <div className="divide-y max-h-96 overflow-y-auto">
                {approvals.map((approval) => (
                  <div
                    key={approval.id}
                    onClick={() => fetchApprovalDetails(approval.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                      selectedApproval?.approval.id === approval.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          ${approval.amount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {approval.currentSignatures}/{approval.requiredSignatures} signatures
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(new Date(approval.createdAt), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>

                      {/* Status Indicator */}
                      <div className="text-right">
                        {approval.currentSignatures >= approval.requiredSignatures ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-yellow-600" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Approval Details */}
        {selectedApproval && (
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Withdrawal Request</h3>
                    <p className="text-sm text-gray-500 mt-1">ID: {selectedApproval.approval.id}</p>
                  </div>

                  {/* Status Badge */}
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isApprovalMet
                      ? 'bg-green-100 text-green-800'
                      : isExpired
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {isApprovalMet ? '✓ Approved' : isExpired ? '✗ Expired' : '⏳ Pending'}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Amount & Destination */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-500">Amount</div>
                      <div className="text-2xl font-bold text-gray-900">
                        ${selectedApproval.approval.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Destination</div>
                    <div className="text-sm font-mono text-gray-900 mt-1">
                      {selectedApproval.approval.destination}
                    </div>
                  </div>
                </div>

                {/* Vault Info */}
                <div className="bg-gray-50 rounded p-4">
                  <div className="text-sm text-gray-500 mb-2">Vault</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{selectedApproval.vault.name}</div>
                      <div className="text-sm text-gray-500">{selectedApproval.vault.type}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {selectedApproval.vault.balance} {selectedApproval.vault.currency}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Signature Progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">Signatures</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {selectedApproval.approval.currentSignatures}/{selectedApproval.approval.requiredSignatures}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isApprovalMet ? 'bg-green-600' : 'bg-blue-600'
                      }`}
                      style={{
                        width: `${
                          (selectedApproval.approval.currentSignatures /
                            selectedApproval.approval.requiredSignatures) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Expiration Timer */}
                <div className={`p-3 rounded flex items-center gap-2 ${
                  isExpired ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                }`}>
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">
                    {isExpired ? 'Expired' : `Expires ${timeRemaining}`}
                  </span>
                </div>

                {/* Signers */}
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-900">Signers</div>
                  <div className="space-y-2">
                    {selectedApproval.approval.signers.map((signer) => (
                      <div key={signer.userId} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                        {signer.approved ? (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        ) : signer.rejected ? (
                          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        )}

                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {signer.userId}
                          </div>
                          <div className="text-xs text-gray-500">
                            Role: {signer.userRole}
                            {signer.signedAt && ` • ${signer.signedAt}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                {!isApprovalMet && !isExpired && (
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleApprove(selectedApproval.approval.id)}
                      disabled={signing}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      {signing ? '⏳ Signing...' : '✓ Approve'}
                    </button>

                    <button
                      onClick={() => handleReject(selectedApproval.approval.id)}
                      disabled={signing}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 font-medium"
                    >
                      {signing ? '⏳ Signing...' : '✗ Reject'}
                    </button>
                  </div>
                )}

                {isApprovalMet && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                    ✓ This withdrawal has been approved and funds are being transferred.
                  </div>
                )}

                {isExpired && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    ✗ This approval request has expired and can no longer be signed.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
                Created {formatDistanceToNow(new Date(selectedApproval.approval.createdAt), {
                  addSuffix: true,
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {approvals.length === 0 && !loading && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All Clear!</h3>
          <p className="text-gray-600">
            No pending withdrawal approvals requiring your signature.
          </p>
        </div>
      )}
    </div>
  );
};

export default ApprovalDashboard;
