/**
 * useMultichainWithdrawal Hook
 * Manages multichain withdrawal flow with routing, execution, and status tracking
 * Integrates with existing dashboard pattern
 */

import { useState, useCallback, useEffect } from 'react';

export interface RoutingOption {
  id: number;
  method: 'direct' | 'bridge' | 'swap_bridge';
  sourceChain: string;
  targetChain: string;
  bridgeProtocol?: string;
  estimatedTimeSeconds: number;
  totalCostUSD: string;
  gasCost: string;
  bridgeFee: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface ExecutionStatus {
  withdrawalId: string;
  status: 'pending' | 'executing' | 'bridging' | 'confirmed' | 'completed' | 'failed';
  confirmations: number;
  totalConfirmationsNeeded: number;
  estimatedTimeRemaining: number;
  progressPercent: number;
  sourceTransactionHash?: string;
  bridgeTransactionHash?: string;
  targetTransactionHash?: string;
  failureReason?: string;
}

export interface WithdrawalHistoryItem {
  withdrawalId: string;
  sourceChain: string;
  targetChain: string;
  amount: string;
  token: string;
  status: string;
  costUSD: string;
  timeSeconds: number;
  createdAt: string;
  completedAt?: string;
}

export function useMultichainWithdrawal() {
  const [routingOptions, setRoutingOptions] = useState<RoutingOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RoutingOption | null>(null);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus | null>(null);
  const [history, setHistory] = useState<WithdrawalHistoryItem[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Get routing options for withdrawal
  const getRoutingOptions = useCallback(
    async (
      targetChain: string,
      token: string,
      amount: string,
      priority: 'cost' | 'speed' | 'balanced' = 'balanced'
    ) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/multichain/routing-options', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({
            targetChain,
            token,
            amount,
            priority,
          }),
        });

        if (!response.ok) throw new Error('Failed to fetch routing options');

        const data = await response.json();
        setRoutingOptions(data.options || []);
        return data.options || [];
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Execute withdrawal
  const executeWithdrawal = useCallback(
    async (
      targetChain: string,
      token: string,
      amount: string,
      recipientAddress: string,
      routeId: number,
      password: string
    ) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/multichain/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({
            targetChain,
            token,
            amount,
            recipientAddress,
            routingOptionId: routeId,
            password,
          }),
        });

        if (!response.ok) throw new Error('Execution failed');

        const data = await response.json();

        if (data.success) {
          setExecutionStatus({
            withdrawalId: data.withdrawalId,
            status: data.status,
            confirmations: 0,
            totalConfirmationsNeeded: 12,
            estimatedTimeRemaining: data.estimatedCompletionTime || 0,
            progressPercent: 5, // Just started
            sourceTransactionHash: data.transactionHash,
          });

          // Start polling for updates
          startPolling(data.withdrawalId);
        } else {
          setError(data.error || 'Unknown execution error');
        }

        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Get withdrawal status
  const getWithdrawalStatus = useCallback(async (withdrawalId: string) => {
    try {
      const response = await fetch(`/api/multichain/withdrawal/${withdrawalId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch status');

      const data = await response.json();
      setExecutionStatus({
        withdrawalId: data.withdrawalId,
        status: data.status,
        confirmations: data.confirmations || 0,
        totalConfirmationsNeeded: 12,
        estimatedTimeRemaining: data.estimatedTimeRemaining || 0,
        progressPercent: Math.min(95, (data.confirmations || 0) * 8 + 5),
        sourceTransactionHash: data.sourceTransactionHash,
        bridgeTransactionHash: data.bridgeTransactionHash,
        targetTransactionHash: data.targetTransactionHash,
        failureReason: data.failureReason,
      });

      return data;
    } catch (err) {
      console.error('Failed to get status:', err);
      return null;
    }
  }, []);

  // Start polling for withdrawal status
  const startPolling = useCallback(
    (withdrawalId: string) => {
      setIsPolling(true);
      const pollingInterval = setInterval(async () => {
        const status = await getWithdrawalStatus(withdrawalId);

        if (status?.status === 'completed' || status?.status === 'failed') {
          setIsPolling(false);
          clearInterval(pollingInterval);
        }
      }, 3000); // Poll every 3 seconds

      return () => {
        clearInterval(pollingInterval);
        setIsPolling(false);
      };
    },
    [getWithdrawalStatus]
  );

  // Get withdrawal history
  const getHistory = useCallback(async (limit = 20, offset = 0) => {
    try {
      const response = await fetch(
        `/api/multichain/history?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch history');

      const data = await response.json();
      setHistory(data.withdrawals || []);
      return data.withdrawals || [];
    } catch (err) {
      console.error('Failed to get history:', err);
      return [];
    }
  }, []);

  // Cancel withdrawal
  const cancelWithdrawal = useCallback(async (withdrawalId: string) => {
    try {
      const response = await fetch(`/api/multichain/cancel/${withdrawalId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });

      if (!response.ok) throw new Error('Cancellation failed');

      const data = await response.json();
      setIsPolling(false);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    }
  }, []);

  // Get supported chains
  const getSupportedChains = useCallback(async () => {
    try {
      const response = await fetch('/api/multichain/supported-chains');
      if (!response.ok) throw new Error('Failed to fetch chains');
      const data = await response.json();
      return data.chains || [];
    } catch (err) {
      console.error('Failed to get chains:', err);
      return [];
    }
  }, []);

  return {
    // Data
    routingOptions,
    selectedRoute,
    executionStatus,
    history,

    // State
    loading,
    error,
    isPolling,

    // Functions
    getRoutingOptions,
    executeWithdrawal,
    getWithdrawalStatus,
    startPolling,
    getHistory,
    cancelWithdrawal,
    getSupportedChains,

    // Helpers
    selectRoute: setSelectedRoute,
    clearError: () => setError(null),
  };
}
