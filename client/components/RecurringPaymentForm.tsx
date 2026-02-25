/**
 * RecurringPaymentForm Component
 * 
 * Form component for setting up recurring/subscription payments
 */

import React, { useState } from 'react';
import { usePaymentSimulation } from '../hooks/usePaymentSimulation';
import { PaymentSimulationModal } from './PaymentSimulationModal';

interface RecurringPaymentFormProps {
  onSuccess?: (action: any) => void;
}

export const RecurringPaymentForm: React.FC<RecurringPaymentFormProps> = ({ onSuccess }) => {
  const {
    simulatePaymentSettlement: simulateRecurringPayment,
    executePayment,
    simulationError,
    executionError,
    currentSimulation,
    isSimulating: hookIsSimulating,
    lastSuccessNotification,
  } = usePaymentSimulation();

  const [formData, setFormData] = useState({
    amount: '',
    currency: 'USD',
    frequency: 'MONTHLY', // WEEKLY, MONTHLY, QUARTERLY, ANNUAL
    recipientId: '',
    recipientEmail: '',
    description: '',
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
    endDate: '',
    maxPayments: '12',
    autoRenew: true,
  });

  const [showModal, setShowModal] = useState(false);
  const [simulation, setSimulation] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [successAction, setSuccessAction] = useState<any>(null);

  const frequencies = [
    { id: 'WEEKLY', name: 'Weekly', daysInterval: 7 },
    { id: 'MONTHLY', name: 'Monthly', daysInterval: 30 },
    { id: 'QUARTERLY', name: 'Quarterly', daysInterval: 90 },
    { id: 'ANNUAL', name: 'Annual', daysInterval: 365 },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount) {
      alert('Please enter an amount');
      return;
    }

    if (!formData.recipientEmail && !formData.recipientId) {
      alert('Please provide recipient email or ID');
      return;
    }

    setIsSimulating(true);
    try {
      await simulateRecurringPayment({
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        frequency: formData.frequency,
        recipientId: formData.recipientId,
        recipientEmail: formData.recipientEmail,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        maxPayments: parseInt(formData.maxPayments),
        autoRenew: formData.autoRenew,
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
    if (!currentSimulation) return;

    try {
      await executePayment('recurring-payment', currentSimulation, {
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        frequency: formData.frequency,
        recipientId: formData.recipientId,
        recipientEmail: formData.recipientEmail,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        maxPayments: parseInt(formData.maxPayments),
        autoRenew: formData.autoRenew,
      });

      if (lastSuccessNotification?.actionId) {
        setSuccessAction({
          id: lastSuccessNotification.actionId,
          reversibility: lastSuccessNotification.reversibility,
        });
        setShowModal(false);
        onSuccess?.(currentSimulation);
      }
    } catch (error) {
      console.error('Setup failed:', error);
    }
  };

  const handleReset = () => {
    setFormData({
      amount: '',
      currency: 'USD',
      frequency: 'MONTHLY',
      recipientId: '',
      recipientEmail: '',
      description: '',
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: '',
      maxPayments: '12',
      autoRenew: true,
    });
    setSuccessAction(null);
    setShowModal(false);
    setSimulation(null);
  };

  const estimatedFee = formData.amount ? (parseFloat(formData.amount) * 0.3 / 100).toFixed(2) : '0.00';
  const maxPayments = parseInt(formData.maxPayments) || 0;
  const firstPaymentDate = formData.startDate ? new Date(formData.startDate).toLocaleDateString() : 'N/A';
  const totalAmount = (parseFloat(formData.amount || '0') * maxPayments).toFixed(2);

  // Success State
  if (successAction) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-green-800 mb-2">Recurring Payment Created</h3>
        <p className="text-green-700 mb-6">
          Your recurring payment schedule has been set up and is reversible within the grace period.
        </p>
        
        <div className="bg-white rounded p-4 mb-6 space-y-3 max-w-md mx-auto">
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Action ID</p>
            <p className="font-mono text-sm text-gray-800">{successAction.id}</p>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Recipient</p>
            <p className="text-sm text-gray-800">{formData.recipientEmail || formData.recipientId}</p>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Per Payment</p>
            <p className="text-lg font-bold text-gray-800">
              {formData.amount} {formData.currency}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-600 uppercase">Total (All Payments)</p>
            <p className="text-lg font-bold text-orange-600">{totalAmount} {formData.currency}</p>
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
        <h2 className="text-2xl font-bold text-gray-800">⏰ Recurring Payment</h2>
        <p className="text-gray-600 mt-2">
          Set up automatic recurring payments. Cancel or modify anytime within grace period.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSimulate} className="space-y-5">
        {/* Amount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Amount Per Payment *
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
            Estimated fee per payment: {estimatedFee} {formData.currency} (0.3%)
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
            title="Select payment currency"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="MTAA">MTAA - Native Token</option>
          </select>
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Frequency *
          </label>
          <select
            name="frequency"
            value={formData.frequency}
            onChange={handleInputChange}
            title="Select payment frequency"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            {frequencies.map(freq => (
              <option key={freq.id} value={freq.id}>
                {freq.name}
              </option>
            ))}
          </select>
        </div>

        {/* Recipient Selection */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-semibold text-gray-700 mb-4">Recipient (choose one) *</p>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Recipient Email</label>
              <input
                type="email"
                name="recipientEmail"
                value={formData.recipientEmail}
                onChange={handleInputChange}
                placeholder="recipient@example.com"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>

            <div className="flex items-center justify-center text-sm text-gray-600">
              <span className="flex-1 border-t"></span>
              <span className="px-3">or</span>
              <span className="flex-1 border-t"></span>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Recipient ID</label>
              <input
                type="text"
                name="recipientId"
                value={formData.recipientId}
                onChange={handleInputChange}
                placeholder="user-id-or-handle"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Start Date *
          </label>
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleInputChange}
            title="Select payment start date"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Max Payments */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Number of Payments *
          </label>
          <input
            type="number"
            name="maxPayments"
            value={formData.maxPayments}
            onChange={handleInputChange}
            min="1"
            max="120"
            placeholder="12"
            title="Enter number of payments"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Total amount: <span className="font-bold">{totalAmount} {formData.currency}</span>
          </p>
        </div>

        {/* End Date (optional) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            End Date (optional)
          </label>
          <input
            type="date"
            name="endDate"
            value={formData.endDate}
            onChange={handleInputChange}
            title="Select payment end date (optional)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">Leave blank for no end date</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Description (optional)
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="What is this subscription for?"
            title="Enter subscription description"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
        </div>

        {/* Auto-Renew Toggle */}
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <input
            type="checkbox"
            name="autoRenew"
            checked={formData.autoRenew}
            onChange={handleInputChange}
            id="auto-renew-toggle"
            className="w-4 h-4 rounded"
          />
          <label htmlFor="auto-renew-toggle" className="text-sm font-semibold text-gray-700 cursor-pointer">
            🔄 Auto-Renewal (automatically extend after last payment)
          </label>
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
          {isSimulating ? '⏳ Simulating Setup...' : '📋 Preview Schedule'}
        </button>
      </form>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-semibold">ℹ️ How Recurring Payments Work</p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>• First payment on {firstPaymentDate}</li>
          <li>• Subsequent payments at {formData.frequency.toLowerCase()} intervals</li>
          <li>• You can cancel or modify up to {new Date(formData.startDate).toLocaleDateString()}</li>
          <li>• After grace period, changes require new setup</li>
        </ul>
      </div>

      {/* Modal */}
      {simulation && (
        <PaymentSimulationModal
          isOpen={showModal}
          simulation={simulation}
          isLoading={isSimulating}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          actionType="recurring-payment"
        />
      )}
    </div>
  );
};
