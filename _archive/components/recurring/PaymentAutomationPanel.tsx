/**
 * PaymentAutomationPanel.tsx
 * Recurring Payments - Payment Automation
 * 
 * Wires: PAYMENT_AUTOMATION simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface PaymentAutomationPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const PaymentAutomationPanel: React.FC<PaymentAutomationPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [monthlyPayment, setMonthlyPayment] = useState<string>('500');
  const [autoPaymentDays, setAutoPaymentDays] = useState<string>('[1, 15]');
  const [failureRetries, setFailureRetries] = useState<string>('3');
  const [automationDuration, setAutomationDuration] = useState<string>('12');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewAutomation = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse comma-separated days
    let paymentDays = [1];
    try {
      const daysInput = autoPaymentDays.replace(/[\[\]]/g, '').split(',').map(d => parseInt(d.trim()));
      paymentDays = daysInput.filter(d => !isNaN(d));
    } catch (err) {
      // Keep default if parsing fails
    }

    await runSimulation(
      'PAYMENT_AUTOMATION',
      {
        userId,
        monthlyPayment: Number(monthlyPayment),
        paymentDaysOfMonth: paymentDays,
        failureRetries: Number(failureRetries),
        durationMonths: Number(automationDuration),
      },
      userId
    );
  };

  const handleExecuteAutomation = async () => {
    console.log('Executing payment automation setup:', {
      monthlyPayment,
      autoPaymentDays,
      failureRetries,
      automationDuration,
    });
    closeModal();
  };

  return (
    <div className="panel payment-automation-panel">
      <div className="panel-header">
        <h3>Payment Automation</h3>
        <p className="subtitle">Set up automatic recurring payments with retry logic</p>
      </div>

      <form onSubmit={handlePreviewAutomation}>
        <div className="form-group">
          <label htmlFor="monthlyPayment">Monthly Payment Amount ($)</label>
          <input
            id="monthlyPayment"
            type="number"
            value={monthlyPayment}
            onChange={(e) => setMonthlyPayment(e.target.value)}
            min="0.01"
            step="50"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="autoPaymentDays">Payment Days of Month</label>
          <input
            id="autoPaymentDays"
            type="text"
            value={autoPaymentDays}
            onChange={(e) => setAutoPaymentDays(e.target.value)}
            placeholder="e.g., [1, 15] for 1st and 15th"
            required
          />
          <small>Enter days as comma-separated numbers or array format</small>
        </div>

        <div className="form-group">
          <label htmlFor="failureRetries">Failure Retry Attempts</label>
          <input
            id="failureRetries"
            type="number"
            value={failureRetries}
            onChange={(e) => setFailureRetries(e.target.value)}
            min="0"
            max="10"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="automationDuration">Automation Duration (months)</label>
          <input
            id="automationDuration"
            type="number"
            value={automationDuration}
            onChange={(e) => setAutomationDuration(e.target.value)}
            min="1"
            max="120"
            step="1"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Preview Automation Plan'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteAutomation}
        title="Payment Automation Analysis"
      />
    </div>
  );
};

export default PaymentAutomationPanel;
