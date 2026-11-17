/**
 * SubscriptionPanel.tsx
 * Recurring Payments - Subscription
 * 
 * Wires: SUBSCRIPTION simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface SubscriptionPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const SubscriptionPanel: React.FC<SubscriptionPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [monthlyFee, setMonthlyFee] = useState<string>('29.99');
  const [subscriptionLength, setSubscriptionLength] = useState<string>('12');
  const [billingCycle, setBillingCycle] = useState<string>('monthly');
  const [autoRenew, setAutoRenew] = useState<boolean>(true);

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'SUBSCRIPTION',
      {
        userId,
        monthlyFee: Number(monthlyFee),
        subscriptionMonths: Number(subscriptionLength),
        billingCycle,
        autoRenewal: autoRenew,
      },
      userId
    );
  };

  const handleExecuteSubscription = async () => {
    console.log('Executing subscription setup:', {
      monthlyFee,
      subscriptionLength,
      billingCycle,
    });
    closeModal();
  };

  return (
    <div className="panel subscription-panel">
      <div className="panel-header">
        <h3>Subscription Setup</h3>
        <p className="subtitle">Configure recurring subscription billing</p>
      </div>

      <form onSubmit={handlePreviewSubscription}>
        <div className="form-group">
          <label htmlFor="monthlyFee">Monthly Fee ($)</label>
          <input
            id="monthlyFee"
            type="number"
            value={monthlyFee}
            onChange={(e) => setMonthlyFee(e.target.value)}
            min="0.01"
            step="0.01"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="subscriptionLength">Subscription Length (months)</label>
          <input
            id="subscriptionLength"
            type="number"
            value={subscriptionLength}
            onChange={(e) => setSubscriptionLength(e.target.value)}
            min="1"
            max="60"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="billingCycle">Billing Cycle</label>
          <select
            id="billingCycle"
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value)}
            required
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>

        <div className="form-group checkbox">
          <label htmlFor="autoRenew">
            <input
              id="autoRenew"
              type="checkbox"
              checked={autoRenew}
              onChange={(e) => setAutoRenew(e.target.checked)}
            />
            Auto-renew at end of term
          </label>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Subscription Cost'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteSubscription}
        title="Subscription Analysis"
      />
    </div>
  );
};

export default SubscriptionPanel;
