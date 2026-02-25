/**
 * PaymentWithdrawalForm Component
 * 
 * Form component for payment withdrawal transactions
 */

import React, { useState } from 'react';
import { usePaymentSimulation } from '../hooks/usePaymentSimulation';
import { PaymentSimulationModal } from './PaymentSimulationModal';

interface PaymentWithdrawalFormProps {
  onSuccess?: (action: any) => void;
}

export const PaymentWithdrawalForm: React.FC<PaymentWithdrawalFormProps> = ({ onSuccess }) => {
  const {
    simulatePaymentWithdrawal,
    executePayment,
    simulationError,
    executionError,
  } = usePaymentSimulation();

  const [formData, setFormData] = useState({
    amount: '',
    currency: 'USD',
    withdrawalMethod: 'bank_transfer', // bank_transfer, wire, crypto_wallet
    recipientBank: '',
    accountNumber: '',
  });

  const [showModal, setShowModal] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [successAction, setSuccessAction] = useState<any>(null);
  const { currentSimulation } = usePaymentSimulation();

  const withdrawalMethods = [
    { id: 'bank_transfer', name: 'Bank Transfer', fee: 0.5 },
    { id: 'wire', name: 'Wire Transfer', fee: 1.0 },
    { id: 'crypto_wallet', name: 'Crypto Wallet', fee: 0.2 },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount) {
      alert('Please enter an amount');
      return;
    }

    if (!formData.recipientBank) {
      alert('Please enter bank details');
      return;
    }

    setIsSimulating(true);
    try {
      const destination = formData.withdrawalMethod === 'bank_transfer' ? 'bank' : formData.withdrawalMethod;
      await simulatePaymentWithdrawal({
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        destination: destination as 'bank' | 'card' | 'wallet',
        userBalance: 10000,
      });
      setShowModal(true);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleConfirm = async () => {
    if (!currentSimulation) return;

    try {
      await executePayment('payment_withdrawal', currentSimulation, {
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        withdrawalMethod: formData.withdrawalMethod,
        recipientBank: formData.recipientBank,
        accountNumber: formData.accountNumber,
      });
      setShowModal(false);
      onSuccess?.(currentSimulation);
    } catch (error) {
      console.error('Withdrawal failed:', error);
    }
  };

  const handleReset = () => {
    setFormData({
      amount: '',
      currency: 'USD',
      withdrawalMethod: 'bank_transfer',
      recipientBank: '',
      accountNumber: '',
    });
    setSuccessAction(null);
    setShowModal(false);
  };

  const selectedMethod = withdrawalMethods.find(m => m.id === formData.withdrawalMethod);
  const estimatedFee = formData.amount ? (parseFloat(formData.amount) * (selectedMethod?.fee || 0.5) / 100).toFixed(2) : '0.00';

  // Success State
  if (successAction) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-green-800 mb-2">Withdrawal Initiated</h3>
        <p className="text-green-700 mb-6">
          Your withdrawal has been initiated and is now within a grace period where it can be reversed if needed.
        </p>
        
        <div className="bg-white rounded p-4 mb-6 space-y-3 max-w-md mx-auto">
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Action ID</p>
            <p className="font-mono text-sm text-gray-800">{successAction.id}</p>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Amount</p>
            <p className="text-lg font-bold text-gray-800">
              {formData.amount} {formData.currency}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Reversible Until</p>
            <p className="text-sm text-gray-800">
              {successAction.reversibility?.deadline ? 
                new Date(successAction.reversibility.deadline).toLocaleString() :
                'N/A'
              }
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Hours Remaining</p>
            <p className="text-lg font-bold text-blue-600">
              {successAction.reversibility?.hoursToReverse.toFixed(1) || 'N/A'}h
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="px-6 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition"
        >
          ✕ Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">💸 Withdrawal</h2>
        <p className="text-gray-600 mt-2">
          Withdraw funds from your account. All withdrawals are reversible within the grace period.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSimulate} className="space-y-5">
        {/* Amount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Amount *
          </label>
          <input
            type="number"
            name="amount"
            value={formData.amount}
            onChange={handleInputChange}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Estimated fee: {estimatedFee} {formData.currency} ({selectedMethod?.fee}%)
          </p>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Currency *
          </label>
          <select
            name="currency"
            value={formData.currency}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
          </select>
        </div>

        {/* Withdrawal Method */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Withdrawal Method *
          </label>
          <select
            name="withdrawalMethod"
            value={formData.withdrawalMethod}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            {withdrawalMethods.map(method => (
              <option key={method.id} value={method.id}>
                {method.name} - {method.fee}% fee
              </option>
            ))}
          </select>
        </div>

        {/* Recipient Bank */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Recipient Bank Name *
          </label>
          <input
            type="text"
            name="recipientBank"
            value={formData.recipientBank}
            onChange={handleInputChange}
            placeholder="e.g., Chase Bank, Barclays"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Account Number */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Account Number / Address *
          </label>
          <input
            type="text"
            name="accountNumber"
            value={formData.accountNumber}
            onChange={handleInputChange}
            placeholder="Bank account or wallet address"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Errors */}
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
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {isSimulating ? '⏳ Simulating Withdrawal...' : '📋 Preview Withdrawal'}
        </button>
      </form>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-semibold">ℹ️ What happens next?</p>
        <p className="mt-2">
          After clicking "Preview", you'll see exactly what will happen to your account. 
          If everything looks correct, confirm the withdrawal and it will be processed with full reversibility rights.
        </p>
      </div>

      {/* Modal */}
      {currentSimulation && (
        <PaymentSimulationModal
          isOpen={showModal}
          simulation={currentSimulation}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          actionType="withdrawal"
          isLoading={false}
        />
      )}
    </div>
  );
};
