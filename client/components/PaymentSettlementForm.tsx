/**
 * PaymentSettlementForm Component
 * 
 * Form component for settling outstanding payment obligations
 */

import React, { useState } from 'react';
import { usePaymentSimulation } from '../hooks/usePaymentSimulation';
import { PaymentSimulationModal } from './PaymentSimulationModal';

interface PaymentSettlementFormProps {
  onSuccess?: (action: any) => void;
}

export const PaymentSettlementForm: React.FC<PaymentSettlementFormProps> = ({ onSuccess }) => {
  const {
    simulatePaymentSettlement,
    executePayment,
    simulationError,
    executionError,
    handleSimulationConfirm: originalConfirm,
    handleSimulationCancel: originalCancel,
    currentSimulation,
    isSimulating: hookIsSimulating,
    isSimulationModalOpen,
    lastSuccessNotification,
    dismissSuccessNotification,
  } = usePaymentSimulation();

  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: '',
    currency: 'USD',
    paymentMethod: 'bank_transfer', // bank_transfer, card, crypto
    settlementType: 'FULL', // FULL, PARTIAL
    notes: '',
  });

  const [showModal, setShowModal] = useState(false);
  const [simulation, setSimulation] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [successAction, setSuccessAction] = useState<any>(null);

  const paymentMethods = [
    { id: 'bank_transfer', name: 'Bank Transfer', fee: 0.5 },
    { id: 'card', name: 'Credit/Debit Card', fee: 2.0 },
    { id: 'crypto', name: 'Cryptocurrency', fee: 0.1 },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.invoiceId) {
      alert('Please enter invoice ID');
      return;
    }

    if (!formData.amount) {
      alert('Please enter settlement amount');
      return;
    }

    setIsSimulating(true);
    try {
      await simulatePaymentSettlement({
        requestId: formData.invoiceId,
        senderId: 'current-user',
        amount: parseFloat(formData.amount),
        userBalance: 10000,
      });

      if (currentSimulation) {
        setSimulation(currentSimulation);
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
      await executePayment('payment_settlement', currentSimulation, {
        requestId: formData.invoiceId,
        senderId: 'current-user',
        amount: parseFloat(formData.amount),
        userBalance: 50000,
      });

      if (lastSuccessNotification?.actionId) {
        setSuccessAction({ 
          id: lastSuccessNotification.actionId,
          reversibility: { 
            deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            hoursToReverse: 72,
            gracePeriodDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            canReverse: true 
          }
        });
      }
      onSuccess?.(currentSimulation);
      setShowModal(false);
    } catch (error) {
      console.error('Settlement failed:', error);
    }
  };

  const handleReset = () => {
    setFormData({
      invoiceId: '',
      amount: '',
      currency: 'USD',
      paymentMethod: 'bank_transfer',
      settlementType: 'FULL',
      notes: '',
    });
    setSuccessAction(null);
    setShowModal(false);
    setSimulation(null);
  };

  const selectedMethod = paymentMethods.find(m => m.id === formData.paymentMethod);
  const estimatedFee = formData.amount ? (parseFloat(formData.amount) * (selectedMethod?.fee || 0.5) / 100).toFixed(2) : '0.00';

  // Success State
  if (successAction) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-green-800 mb-2">Settlement Completed</h3>
        <p className="text-green-700 mb-6">
          Your settlement has been processed and is reversible within the grace period.
        </p>
        
        <div className="bg-white rounded p-4 mb-6 space-y-3 max-w-md mx-auto">
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Action ID</p>
            <p className="font-mono text-sm text-gray-800">{successAction.id}</p>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Invoice</p>
            <p className="text-sm text-gray-800">{formData.invoiceId}</p>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Amount Settled</p>
            <p className="text-lg font-bold text-gray-800">
              {formData.amount} {formData.currency}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Type</p>
            <p className="text-sm text-gray-800">{formData.settlementType} Settlement</p>
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
        <h2 className="text-2xl font-bold text-gray-800">📋 Payment Settlement</h2>
        <p className="text-gray-600 mt-2">
          Settle invoices and payment obligations. Full reversibility guaranteed.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSimulate} className="space-y-5">
        {/* Invoice ID */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Invoice ID *
          </label>
          <input
            type="text"
            name="invoiceId"
            value={formData.invoiceId}
            onChange={handleInputChange}
            placeholder="INV-2024-001234"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">The invoice you're settling</p>
        </div>

        {/* Settlement Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Settlement Type *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="settlementType"
                value="FULL"
                checked={formData.settlementType === 'FULL'}
                onChange={handleInputChange}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Full Settlement</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="settlementType"
                value="PARTIAL"
                checked={formData.settlementType === 'PARTIAL'}
                onChange={handleInputChange}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Partial Settlement</span>
            </label>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Settlement Amount *
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
            title="Select settlement currency"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="MTAA">MTAA - Native Token</option>
          </select>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Payment Method *
          </label>
          <select
            name="paymentMethod"
            value={formData.paymentMethod}
            onChange={handleInputChange}
            title="Select payment method"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            {paymentMethods.map(method => (
              <option key={method.id} value={method.id}>
                {method.name} - {method.fee}% fee
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Settlement Notes (optional)
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Any additional notes or references for this settlement"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
        </div>

        {/* Info Box */}
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
          <p className="font-semibold">📌 Settlement Protection</p>
          <p className="mt-2">
            This settlement is protected by reversibility rights. If this is a mistake or the 
            invoice is disputed, you can reverse it within the grace period.
          </p>
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
          {isSimulating ? '⏳ Simulating Settlement...' : '📋 Preview Settlement'}
        </button>
      </form>

      {/* Legal Notice */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
        <p className="font-semibold text-gray-700">⚖️ Legal Notice</p>
        <p className="mt-2">
          By settling this invoice, you confirm that you have reviewed the details and agree to the 
          terms. Partial settlements may affect the original agreement. Consult accounting if needed.
        </p>
      </div>

      {/* Modal */}
      {simulation && (
        <PaymentSimulationModal
          isOpen={showModal}
          simulation={simulation}
          isLoading={isSimulating}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          actionType="payment-settlement"
        />
      )}
    </div>
  );
};
