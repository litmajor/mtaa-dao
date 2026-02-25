/**
 * usePaymentSimulation Hook
 * 
 * Complete orchestration of payment simulation workflow:
 * 1. Form input → 2. API simulation → 3. Preview modal → 4. User confirmation
 * 5. Execute API → 6. Success notification → 7. Store reversible action ID
 * 
 * Usage:
 * const {
 *   simulatePaymentDeposit,
 *   executePayment,
 *   reversePayment,
 *   pendingActions,
 *   ...state & handlers
 * } = usePaymentSimulation();
 */

import { useState, useCallback, useEffect } from 'react';

interface SimulationParams {
  [key: string]: any;
}

interface ApiResponse {
  success?: boolean;
  simulation?: any;
  action?: any;
  nextStep?: any;
  error?: string;
  message?: string;
}

export const usePaymentSimulation = () => {
  // State: Simulation Preview
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);
  const [currentSimulation, setCurrentSimulation] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // State: Action Execution
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [lastExecutedActionId, setLastExecutedActionId] = useState<string | null>(null);

  // State: Reversal
  const [isReversalDialogOpen, setIsReversalDialogOpen] = useState(false);
  const [reversalActionId, setReversalActionId] = useState<string | null>(null);
  const [reversalActionType, setReversalActionType] = useState<string>('');
  const [isReversing, setIsReversing] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);

  // State: Notifications
  const [lastSuccessNotification, setLastSuccessNotification] = useState<{ title: string; message: string; actionId?: string; reversibility?: { deadline?: string; hoursToReverse?: number; gracePeriodDeadline?: string; canReverse?: boolean } } | null>(null);
  const [lastErrorNotification, setLastErrorNotification] = useState<{ title: string; message: string } | null>(null);

  // State: Pending Actions
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [isLoadingPendingActions, setIsLoadingPendingActions] = useState(false);

  const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

  /**
   * Generic API caller with error handling
   */
  const callApi = useCallback(
    async (endpoint: string, method: 'GET' | 'POST' = 'POST', data?: any): Promise<ApiResponse> => {
      try {
        const response = await fetch(`${apiBaseUrl}${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `API error: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.error('API call failed:', endpoint, error);
        throw error;
      }
    },
    [apiBaseUrl]
  );

  // =========================================================================
  // PAYMENT SIMULATORS
  // =========================================================================

  /**
   * Simulate Payment Deposit
   */
  const simulatePaymentDeposit = useCallback(
    async (params: {
      amount: number;
      currency: string;
      paymentMethod: 'bank_transfer' | 'card' | 'wallet';
      exchangeRate?: number;
    }) => {
      setIsSimulating(true);
      setSimulationError(null);

      try {
        const response = await callApi('/simulation/payment-deposit', 'POST', params);
        setCurrentSimulation(response.simulation);
        setIsSimulationModalOpen(true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to simulate deposit';
        setSimulationError(errorMsg);
        setLastErrorNotification({
          title: 'Simulation Failed',
          message: errorMsg,
        });
      } finally {
        setIsSimulating(false);
      }
    },
    [callApi]
  );

  /**
   * Simulate Payment Withdrawal
   */
  const simulatePaymentWithdrawal = useCallback(
    async (params: {
      amount: number;
      currency: string;
      destination: 'bank' | 'wallet' | 'card';
      userBalance: number;
    }) => {
      setIsSimulating(true);
      setSimulationError(null);

      try {
        const response = await callApi('/simulation/payment-withdrawal', 'POST', params);
        setCurrentSimulation(response.simulation);
        setIsSimulationModalOpen(true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to simulate withdrawal';
        setSimulationError(errorMsg);
        setLastErrorNotification({
          title: 'Simulation Failed',
          message: errorMsg,
        });
      } finally {
        setIsSimulating(false);
      }
    },
    [callApi]
  );

  /**
   * Simulate P2P Transfer
   */
  const simulateP2PTransfer = useCallback(
    async (params: {
      recipientId: string;
      amount: number;
      memo?: string;
      userBalance: number;
    }) => {
      setIsSimulating(true);
      setSimulationError(null);

      try {
        const response = await callApi('/simulation/payment-p2p', 'POST', params);
        setCurrentSimulation(response.simulation);
        setIsSimulationModalOpen(true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to simulate transfer';
        setSimulationError(errorMsg);
        setLastErrorNotification({
          title: 'Simulation Failed',
          message: errorMsg,
        });
      } finally {
        setIsSimulating(false);
      }
    },
    [callApi]
  );

  /**
   * Simulate Recurring Payment Setup
   */
  const simulateRecurringPaymentSetup = useCallback(
    async (params: {
      recipientId: string;
      amount: number;
      frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
      startDate: number;
      cycles?: number;
      userBalance: number;
    }) => {
      setIsSimulating(true);
      setSimulationError(null);

      try {
        const response = await callApi('/simulation/recurring-payment-setup', 'POST', params);
        setCurrentSimulation(response.simulation);
        setIsSimulationModalOpen(true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to simulate recurring setup';
        setSimulationError(errorMsg);
        setLastErrorNotification({
          title: 'Simulation Failed',
          message: errorMsg,
        });
      } finally {
        setIsSimulating(false);
      }
    },
    [callApi]
  );

  /**
   * Simulate Payment Settlement
   */
  const simulatePaymentSettlement = useCallback(
    async (params: {
      requestId: string;
      senderId: string;
      amount: number;
      userBalance: number;
    }) => {
      setIsSimulating(true);
      setSimulationError(null);

      try {
        const response = await callApi('/simulation/payment-settlement', 'POST', params);
        setCurrentSimulation(response.simulation);
        setIsSimulationModalOpen(true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to simulate settlement';
        setSimulationError(errorMsg);
        setLastErrorNotification({
          title: 'Simulation Failed',
          message: errorMsg,
        });
      } finally {
        setIsSimulating(false);
      }
    },
    [callApi]
  );

  /**
   * Get available simulators
   */
  const getSimulatorsSummary = useCallback(async () => {
    try {
      const response = await callApi('/simulation/summary', 'GET');
      return response.simulation || [];
    } catch (error) {
      console.error('Failed to fetch simulators:', error);
      return [];
    }
  }, [callApi]);

  // =========================================================================
  // PAYMENT EXECUTION
  // =========================================================================

  /**
   * Execute Payment After User Confirms Simulation
   */
  const executePayment = useCallback(
    async (actionType: string, simulation: any, params: SimulationParams) => {
      setIsExecuting(true);
      setExecutionError(null);

      try {
        const endpoint = `/payments/${actionType.toLowerCase().replace(/^payment_/, '').replace(/_.*/, '').toLowerCase()}`;
        const executeParams = {
          simulation,
          ...params,
        };

        const response = await callApi(endpoint, 'POST', executeParams);

        if (response.success) {
          setLastExecutedActionId(response.action?.id);
          setIsSimulationModalOpen(false);
          setCurrentSimulation(null);

          const gracePeriodDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
          setLastSuccessNotification({
            title: 'Action Executed',
            message: `${actionType.replace(/_/g, ' ')} successfully queued for processing`,
            actionId: response.action?.id,
            reversibility: {
              deadline: gracePeriodDeadline,
              hoursToReverse: 72,
              gracePeriodDeadline: gracePeriodDeadline,
              canReverse: true,
            },
          });

          // Refresh pending actions
          await getPendingActions();

          return response;
        } else {
          throw new Error(response.message || 'Execution failed');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to execute payment';
        setExecutionError(errorMsg);
        setLastErrorNotification({
          title: 'Execution Failed',
          message: errorMsg,
        });
      } finally {
        setIsExecuting(false);
      }
    },
    [callApi]
  );

  // =========================================================================
  // PENDING ACTIONS & REVERSALS
  // =========================================================================

  /**
   * Fetch pending actions for current user
   */
  const getPendingActions = useCallback(async () => {
    setIsLoadingPendingActions(true);

    try {
      const response = await callApi('/payments/pending-actions', 'GET');
      const actions = (response && typeof response === 'object' && 'actions' in response) ? response.actions : [];
      setPendingActions(Array.isArray(actions) ? actions : []);
      return Array.isArray(actions) ? actions : [];
    } catch (error) {
      console.error('Failed to fetch pending actions:', error);
      setLastErrorNotification({
        title: 'Failed to Load Actions',
        message: 'Could not retrieve your pending actions',
      });
    } finally {
      setIsLoadingPendingActions(false);
    }
  }, [callApi]);

  /**
   * Open reversal dialog
   */
  const openReversalDialog = useCallback((actionId: string, actionType: string) => {
    setReversalActionId(actionId);
    setReversalActionType(actionType);
    setIsReversalDialogOpen(true);
  }, []);

  /**
   * Close reversal dialog
   */
  const closeReversalDialog = useCallback(() => {
    setIsReversalDialogOpen(false);
    setReversalActionId(null);
    setReversalActionType('');
    setReversalError(null);
  }, []);

  /**
   * Confirm and execute reversal
   */
  const confirmReversal = useCallback(
    async (actionId: string, reason: string) => {
      setIsReversing(true);
      setReversalError(null);

      try {
        const response = await callApi(`/payments/reverse/${actionId}`, 'POST', {
          reason,
        });

        if (response.success) {
          setLastSuccessNotification({
            title: 'Action Reversed',
            message: 'Your action has been successfully reversed. Funds will be restored shortly.',
            actionId,
            reversibility: {
              deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
              hoursToReverse: 72,
              gracePeriodDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
              canReverse: false,
            },
          });

          closeReversalDialog();

          // Refresh pending actions
          await getPendingActions();

          return response;
        } else {
          throw new Error(response.message || 'Reversal failed');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to reverse action';
        setReversalError(errorMsg);
        setLastErrorNotification({
          title: 'Reversal Failed',
          message: errorMsg,
        });
      } finally {
        setIsReversing(false);
      }
    },
    [callApi, closeReversalDialog, getPendingActions]
  );

  /**
   * Get details of a specific action
   */
  const getActionDetails = useCallback(
    async (actionId: string) => {
      try {
        const response = await callApi(`/payments/action/${actionId}`, 'GET');
        return response.action;
      } catch (error) {
        console.error('Failed to fetch action details:', error);
        return null;
      }
    },
    [callApi]
  );

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * Handle simulation modal confirmation
   */
  const handleSimulationConfirm = useCallback(
    async (simulation: any) => {
      // This is where you'd map simulation to execution endpoint
      // The actual execution happens through executePayment
      // This just closes the modal - execution is handled by the parent component
      setIsSimulationModalOpen(false);
    },
    []
  );

  /**
   * Handle simulation modal cancel
   */
  const handleSimulationCancel = useCallback(() => {
    setIsSimulationModalOpen(false);
    setCurrentSimulation(null);
    setSimulationError(null);
  }, []);

  /**
   * Dismiss success notification
   */
  const dismissSuccessNotification = useCallback(() => {
    setLastSuccessNotification(null);
  }, []);

  /**
   * Dismiss error notification
   */
  const dismissErrorNotification = useCallback(() => {
    setLastErrorNotification(null);
  }, []);

  // Load pending actions on mount
  useEffect(() => {
    getPendingActions();
  }, [getPendingActions]);

  // Return all state and handlers
  return {
    // Simulators
    simulatePaymentDeposit,
    simulatePaymentWithdrawal,
    simulateP2PTransfer,
    simulateRecurringPaymentSetup,
    simulatePaymentSettlement,
    getSimulatorsSummary,

    // Execution
    executePayment,

    // Pending Actions & Reversals
    getPendingActions,
    pendingActions,
    isLoadingPendingActions,
    openReversalDialog,
    closeReversalDialog,
    confirmReversal,
    getActionDetails,

    // Simulation Modal State
    isSimulationModalOpen,
    currentSimulation,
    isSimulating,
    simulationError,
    handleSimulationConfirm,
    handleSimulationCancel,

    // Execution State
    isExecuting,
    executionError,
    lastExecutedActionId,

    // Reversal State
    isReversalDialogOpen,
    reversalActionId,
    reversalActionType,
    isReversing,
    reversalError,

    // Notifications
    lastSuccessNotification,
    lastErrorNotification,
    dismissSuccessNotification,
    dismissErrorNotification,
  };
};

export default usePaymentSimulation;
