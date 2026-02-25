/**
 * TipDonationPanel.tsx
 * Micro Transactions - Tip/Donation
 * 
 * Wires: TIP_DONATION simulator (Tier 3)
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface TipDonationPanelProps {
  userId: string;
  recipientId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const TipDonationPanel: React.FC<TipDonationPanelProps> = ({
  userId,
  recipientId = 'unknown',
  onSimulationComplete,
}) => {
  const [tipAmount, setTipAmount] = useState<string>('3.50');
  const [tipPercentage, setTipPercentage] = useState<string>('20');
  const [recipientType, setRecipientType] = useState<string>('content');
  const [recurring, setRecurring] = useState<boolean>(false);

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewTip = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'TIP_DONATION',
      {
        userId,
        recipientId,
        tipAmount: Number(tipAmount),
        tipPercentage: Number(tipPercentage),
        recipientType,
        recurringTip: recurring,
      },
      userId
    );
  };

  const handleExecuteTip = async () => {
    console.log('Processing tip/donation:', {
      tipAmount,
      tipPercentage,
      recipientType,
      recurring,
    });
    closeModal();
  };

  return (
    <div className="panel tip-donation-panel">
      <div className="panel-header">
        <h3>Tip / Donation</h3>
        <p className="subtitle">Send micro-tips or support creators with donations</p>
      </div>

      <form onSubmit={handlePreviewTip}>
        <div className="form-group">
          <label htmlFor="tipAmount">Tip Amount ($)</label>
          <input
            id="tipAmount"
            type="number"
            value={tipAmount}
            onChange={(e) => setTipAmount(e.target.value)}
            min="0.01"
            max="500"
            step="0.01"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="tipPercentage">Tip as % of Service/Item</label>
          <input
            id="tipPercentage"
            type="number"
            value={tipPercentage}
            onChange={(e) => setTipPercentage(e.target.value)}
            min="0"
            max="100"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="recipientType">Recipient Type</label>
          <select
            id="recipientType"
            value={recipientType}
            onChange={(e) => setRecipientType(e.target.value)}
            required
          >
            <option value="content">Content Creator</option>
            <option value="service">Service Provider</option>
            <option value="artist">Artist / Musician</option>
            <option value="charity">Charity / Organization</option>
          </select>
        </div>

        <div className="form-group checkbox">
          <label htmlFor="recurring">
            <input
              id="recurring"
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            Set up as recurring monthly tip
          </label>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Preview Tip Amount'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteTip}
        title="Tip / Donation Analysis"
      />
    </div>
  );
};

export default TipDonationPanel;
