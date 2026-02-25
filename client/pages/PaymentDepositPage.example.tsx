/**
 * Example Integration: Payment Deposit Flow
 * 
 * Shows complete end-to-end workflow using:
 * 1. usePaymentSimulation hook for state & API calls
 * 2. SimulationPreviewModal for user confirmation
 * 3. SuccessNotification / ErrorNotification for feedback
 * 4. Form handling with react-hook-form
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import usePaymentSimulation from '../hooks/usePaymentSimulation';
import {
  SimulationPreviewModal,
  SuccessNotification,
  ErrorNotification,
} from '../components/PaymentSimulation';

interface DepositFormInputs {
  amount: number;
  currency: string;
  paymentMethod: 'bank_transfer' | 'card' | 'wallet';
  exchangeRate?: number;
}

export const PaymentDepositPage: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DepositFormInputs>({
    defaultValues: {
      amount: 100,
      currency: 'USD',
      paymentMethod: 'bank_transfer',
    },
  });

  const {
    // Simulators
    simulatePaymentDeposit,
    executePayment,
    // State
    isSimulationModalOpen,
    currentSimulation,
    isSimulating,
    simulationError,
    isExecuting,
    executionError,
    lastSuccessNotification,
    lastErrorNotification,
    // Handlers
    handleSimulationCancel,
    dismissSuccessNotification,
    dismissErrorNotification,
  } = usePaymentSimulation();

  const [formData, setFormData] = useState<DepositFormInputs | null>(null);

  /**
   * Step 1: User submits form
   * Initiates simulation
   */
  const onSubmit = async (data: DepositFormInputs) => {
    setFormData(data);
    await simulatePaymentDeposit(data);
  };

  /**
   * Step 2: User reviews simulation in modal
   * Decides to confirm or cancel
   */
  const handleConfirmSimulation = async () => {
    if (!currentSimulation || !formData) return;

    try {
      // Execute the payment
      const response = await executePayment('PAYMENT_DEPOSIT', currentSimulation, formData);

      if (response?.success) {
        // Reset form after successful execution
        reset();
        setFormData(null);
      }
    } catch (error) {
      console.error('Execution failed:', error);
    }
  };

  const handleCancel = () => {
    handleSimulationCancel();
    setFormData(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-md mx-auto">
        {/* Page Header */}
        <h1 className="text-3xl font-bold text-white mb-2">Deposit Funds</h1>
        <p className="text-slate-400 mb-8">
          Securely add funds to your account. All transactions are reversible within 24 hours.
        </p>

        {/* Deposit Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-slate-800 p-6 rounded-lg border border-slate-700">
          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register('amount', {
                  required: 'Amount is required',
                  min: { value: 0.01, message: 'Amount must be greater than 0' },
                })}
                className="flex-1 bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
              <select
                {...register('currency')}
                className="bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Payment Method</label>
            <select
              {...register('paymentMethod')}
              className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Credit/Debit Card</option>
              <option value="wallet">Wallet</option>
            </select>
          </div>

          {/* Exchange Rate (Optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Exchange Rate <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="number"
              step="0.0001"
              placeholder="Auto-detected"
              {...register('exchangeRate')}
              className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-slate-400 text-xs mt-1">Leave blank to use current market rate</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isSimulating}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            {isSimulating ? 'Simulating...' : 'Preview & Continue'}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-slate-800 rounded border border-slate-700">
          <p className="text-slate-300 text-sm">
            <strong>Security:</strong> Your deposit will be simulated to show fees and impact before confirmation. You can stop or modify up to 24 hours after initiation.
          </p>
        </div>
      </div>

      {/* Simulation Preview Modal */}
      {currentSimulation && (
        <SimulationPreviewModal
          isOpen={isSimulationModalOpen}
          simulation={currentSimulation}
          actionType="PAYMENT_DEPOSIT"
          onConfirm={handleConfirmSimulation}
          onCancel={handleCancel}
          isLoading={isExecuting}
        />
      )}

      {/* Success Notification */}
      <SuccessNotification
        isVisible={!!lastSuccessNotification}
        title={lastSuccessNotification?.title || ''}
        message={lastSuccessNotification?.message || ''}
        actionId={lastSuccessNotification?.actionId}
        onDismiss={dismissSuccessNotification}
      />

      {/* Error Notification */}
      <ErrorNotification
        isVisible={!!lastErrorNotification}
        title={lastErrorNotification?.title || ''}
        message={lastErrorNotification?.message || ''}
        onDismiss={dismissErrorNotification}
      />
    </div>
  );
};

export default PaymentDepositPage;
