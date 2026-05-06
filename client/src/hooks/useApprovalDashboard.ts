/**
 * Approval Dashboard Hooks
 * 
 * React hooks for managing withdrawal approval data and state
 * Integrates with the multisig approval handler API
 */

import { useCallback, useEffect, useState, useRef } from 'react';

interface UseApprovalDashboardOptions {
  daoId: string;
  autoRefreshInterval?: number; // milliseconds, default 30s
}

interface PendingApproval {
  id: string;
  vaultId: string;
  daoId: string;
  userId: string;
  amount: number;
  destination: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';
  requiredSignatures: number;
  currentSignatures: number;
  signers: Array<{
    userId: string;
    userRole: 'member' | 'elder' | 'admin';
    approved?: boolean;
    rejected?: boolean;
    signature?: string;
    signedAt?: string;
    ipAddress?: string;
  }>;
  expiresAt: string;
  createdAt: string;
  executedAt?: string;
  currentUserHasSigned?: boolean;
  currentUserApproved?: boolean;
  currentUserRejected?: boolean;
}

interface ApprovalDetails {
  approval: PendingApproval;
  signatures: Array<{
    id: string;
    signerId: string;
    signer_role: string;
    signature: string;
    signedAt: string;
    ipAddress?: string;
    isValid: boolean;
    verificationError?: string;
  }>;
  vault: {
    id: string;
    name: string;
    type: string;
    balance: string;
    currency: string;
  };
}

export const useApprovals = (options: UseApprovalDashboardOptions) => {
  const { daoId, autoRefreshInterval = 30000 } = options;
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/daos/${daoId}/treasury/withdrawals/signer-pending`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setApprovals(data.approvals || []);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch approvals');
    } finally {
      setLoading(false);
    }
  }, [daoId]);

  // Set up auto-refresh
  useEffect(() => {
    fetchApprovals();
    intervalRef.current = setInterval(fetchApprovals, autoRefreshInterval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchApprovals, autoRefreshInterval]);

  return { approvals, loading, error, refetch: fetchApprovals };
};

export const useApprovalDetails = (
  daoId: string,
  approvalId: string | null
) => {
  const [details, setDetails] = useState<ApprovalDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!approvalId) {
      setDetails(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/daos/${daoId}/treasury/withdrawals/${approvalId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setDetails(data);
    } catch (err) {
      console.error('Failed to fetch approval details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch details');
    } finally {
      setLoading(false);
    }
  }, [daoId, approvalId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return { details, loading, error, refetch: fetchDetails };
};

export const useApprovalSignature = (
  daoId: string,
  approvalId: string
) => {
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(
    async (signature: string): Promise<boolean> => {
      try {
        setSigning(true);
        setError(null);

        const response = await fetch(
          `/api/v1/daos/${daoId}/treasury/withdrawals/${approvalId}/approve`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ signature }),
            credentials: 'include',
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return false;
      } finally {
        setSigning(false);
      }
    },
    [daoId, approvalId]
  );

  const reject = useCallback(
    async (reason?: string): Promise<boolean> => {
      try {
        setSigning(true);
        setError(null);

        const response = await fetch(
          `/api/v1/daos/${daoId}/treasury/withdrawals/${approvalId}/reject`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: reason || '' }),
            credentials: 'include',
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return false;
      } finally {
        setSigning(false);
      }
    },
    [daoId, approvalId]
  );

  return { approve, reject, signing, error };
};

export const useSignatureHistory = (
  daoId: string,
  approvalId: string | null
) => {
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSignatures = useCallback(async () => {
    if (!approvalId) {
      setSignatures([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/daos/${daoId}/treasury/withdrawals/${approvalId}/signatures`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSignatures(data.signatures || []);
    } catch (err) {
      console.error('Failed to fetch signatures:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch signatures');
    } finally {
      setLoading(false);
    }
  }, [daoId, approvalId]);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  return { signatures, loading, error, refetch: fetchSignatures };
};

// Convenience hook combining all approval operations
export const useApprovalDashboard = (options: UseApprovalDashboardOptions) => {
  const { daoId } = options;
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const approvalsQuery = useApprovals({
    ...options,
    autoRefreshInterval: autoRefresh ? 30000 : undefined,
  });

  const detailsQuery = useApprovalDetails(daoId, selectedApprovalId);
  const signaturesQuery = useSignatureHistory(daoId, selectedApprovalId);
  const signatureOps = useApprovalSignature(daoId, selectedApprovalId || '');

  const selectApproval = useCallback((approvalId: string) => {
    setSelectedApprovalId(approvalId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedApprovalId(null);
  }, []);

  const handleApprove = useCallback(
    async (signature: string) => {
      const success = await signatureOps.approve(signature);
      if (success) {
        // Refresh all data
        await Promise.all([
          approvalsQuery.refetch(),
          detailsQuery.refetch(),
          signaturesQuery.refetch(),
        ]);
      }
      return success;
    },
    [signatureOps, approvalsQuery, detailsQuery, signaturesQuery]
  );

  const handleReject = useCallback(
    async (reason?: string) => {
      const success = await signatureOps.reject(reason);
      if (success) {
        // Refresh all data
        await Promise.all([
          approvalsQuery.refetch(),
          detailsQuery.refetch(),
          signaturesQuery.refetch(),
        ]);
      }
      return success;
    },
    [signatureOps, approvalsQuery, detailsQuery, signaturesQuery]
  );

  return {
    // Approvals list
    approvals: approvalsQuery.approvals,
    approvalsLoading: approvalsQuery.loading,
    approvalsError: approvalsQuery.error,
    refetchApprovals: approvalsQuery.refetch,

    // Selected approval details
    selectedApprovalId,
    selectedApproval: detailsQuery.details,
    detailsLoading: detailsQuery.loading,
    detailsError: detailsQuery.error,

    // Signatures
    signatures: signaturesQuery.signatures,
    signaturesLoading: signaturesQuery.loading,

    // Actions
    selectApproval,
    clearSelection,
    approve: handleApprove,
    reject: handleReject,
    signing: signatureOps.signing,
    signatureError: signatureOps.error,

    // Controls
    autoRefresh,
    setAutoRefresh,
  };
};

export default useApprovalDashboard;
