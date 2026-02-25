/**
 * PaymentDepositForm Component
 * 
 * Form for simulating and executing payment deposits
 */

import React, { useState } from 'react';
import { usePaymentSimulation } from '../hooks/usePaymentSimulation';
import { PaymentSimulationModal } from './PaymentSimulationModal';

interface PaymentDepositFormProps {
  onSuccess?: (action: any) => void;
}

export const PaymentDepositForm: React.FC<PaymentDepositFormProps> = ({ onSuccess }) => {
  const {
    simulatePaymentDeposit,
    executePayment,
    simulationError,
    executionError,
    currentSimulation,
    isSimulating: hookIsSimulating,
    isSimulationModalOpen,
    lastSuccessNotification,
    dismissSuccessNotification,
  } = usePaymentSimulation();

  const [formData, setFormData] = useState({
    amount: 1000,
    currency: 'USD',
    paymentMethod: 'bank_transfer' as 'bank_transfer' | 'card' | 'wallet',
    exchangeRate: 1.0,
  });

  const [showModal, setShowModal] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    try {
      await simulatePaymentDeposit({
        amount: formData.amount,
        currency: formData.currency,
        paymentMethod: formData.paymentMethod,
        exchangeRate: formData.exchangeRate,
      });
      if (currentSimulation) {
        setShowModal(true);
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleConfirm = async () => {
    try {
      await executePayment('deposit', currentSimulation, {
        amount: formData.amount,
        currency: formData.currency,
        paymentMethod: formData.paymentMethod,
      });

      if (lastSuccessNotification?.actionId) {
        onSuccess?.({
          id: lastSuccessNotification.actionId,
          reversibility: lastSuccessNotification.reversibility,
        });
      }
      setShowModal(false);
    } catch (error) {
      console.error('Deposit failed:', error);
    }
  };

  const handleReset = () => {
    setShowModal(false);
    setFormData({ amount: 1000, currency: 'USD', paymentMethod: 'bank_transfer', exchangeRate: 1.0 });
    dismissSuccessNotification?.();
  };

  if (lastSuccessNotification?.actionId) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">✅</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-green-800">Deposit Confirmed!</h3>
            <p className="text-green-700 mt-2">
              Deposit of {formData.amount} {formData.currency} has been queued for processing.
            </p>
            <p className="text-sm text-green-600 mt-1">
              Action ID: <span className="font-mono text-xs bg-green-100 px-2 py-1 rounded">{lastSuccessNotification.actionId}</span>
            </p>
            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm font-semibold text-blue-800">Grace Period Deadline:</p>
              <p className="text-sm text-blue-600 font-mono">
                {lastSuccessNotification.reversibility?.gracePeriodDeadline ? 
                  new Date(lastSuccessNotification.reversibility.gracePeriodDeadline).toLocaleString() :
                  'N/A'
                }
              </p>
              <p className="text-sm text-blue-600 mt-1">
                ⏱️ {lastSuccessNotification.reversibility?.hoursToReverse?.toFixed(1) || 'N/A'} hours remaining to reverse
              </p>
            </div>
            <button
              onClick={handleReset}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition"
            >
              New Deposit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Deposit Funds</h2>

      <form onSubmit={handleSimulate} className="space-y-4">
        {/* Amount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.amount}
            onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
            placeholder="0.00"
            title="Enter the amount you want to deposit"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Enter the amount you want to deposit</p>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
          <select
            value={formData.currency}
            onChange={e => setFormData({ ...formData, currency: e.target.value })}
            title="Select deposit currency"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="USD">US Dollar (USD)</option>
            <option value="EUR">Euro (EUR)</option>
            <option value="BTC">Bitcoin (BTC)</option>
            <option value="ETH">Ethereum (ETH)</option>
            <option value="MTAA">MTAA</option>
          </select>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
          <select
            value={formData.paymentMethod}
            onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as 'bank_transfer' | 'card' | 'wallet' })}
            title="Select deposit payment method"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="bank_transfer">Bank Transfer (0.3%)</option>
            <option value="card">Credit/Debit Card (2.0%)</option>
            <option value="wallet">Crypto Wallet (0.5%)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Select how you want to fund your account</p>
        </div>

        {/* Exchange Rate */}
        {formData.currency !== 'USD' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Exchange Rate (1 {formData.currency} = ? MTAA)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.exchangeRate}
              onChange={e => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Error Messages */}
        {simulationError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {simulationError}
          </div>
        )}

        {executionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {executionError}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSimulating}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSimulating ? '⏳ Simulating...' : '📊 Preview & Continue'}
        </button>
      </form>

      {/* Simulation Modal */}
      {currentSimulation && (
        <PaymentSimulationModal
          isOpen={showModal}
          simulation={currentSimulation}
          isLoading={isSimulating}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          actionType="Deposit"
        />
      )}
    </div>
  );
};
