/**
 * InstallmentPanel.tsx
 * Recurring Payments - Installment
 * 
 * Wires: INSTALLMENT simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface InstallmentPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const InstallmentPanel: React.FC<InstallmentPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [totalPrice, setTotalPrice] = useState<string>('1200');
  const [numberOfPayments, setNumberOfPayments] = useState<string>('12');
  const [interestRate, setInterestRate] = useState<string>('4.5');
  const [paymentFrequency, setPaymentFrequency] = useState<string>('monthly');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewInstallment = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'INSTALLMENT',
      {
        userId,
        totalPrice: Number(totalPrice),
        numberOfPayments: Number(numberOfPayments),
        interestRate: Number(interestRate),
        paymentFrequency,
      },
      userId
    );
  };

  const handleExecuteInstallment = async () => {
    console.log('Executing installment setup:', {
      totalPrice,
      numberOfPayments,
      interestRate,
      paymentFrequency,
    });
    closeModal();
  };

  return (
    <div className="panel installment-panel">
      <div className="panel-header">
        <h3>Installment Payment Plan</h3>
        <p className="subtitle">Break payment into regular installments with interest</p>
      </div>

      <form onSubmit={handlePreviewInstallment}>
        <div className="form-group">
          <label htmlFor="totalPrice">Total Price ($)</label>
          <input
            id="totalPrice"
            type="number"
            value={totalPrice}
            onChange={(e) => setTotalPrice(e.target.value)}
            min="1"
            step="10"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="numberOfPayments">Number of Payments</label>
          <input
            id="numberOfPayments"
            type="number"
            value={numberOfPayments}
            onChange={(e) => setNumberOfPayments(e.target.value)}
            min="2"
            max="120"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="interestRate">Annual Interest Rate (%)</label>
          <input
            id="interestRate"
            type="number"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            min="0"
            max="30"
            step="0.1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="paymentFrequency">Payment Frequency</label>
          <select
            id="paymentFrequency"
            value={paymentFrequency}
            onChange={(e) => setPaymentFrequency(e.target.value)}
            required
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Payment Schedule'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteInstallment}
        title="Installment Plan Analysis"
      />
    </div>
  );
};

export default InstallmentPanel;
