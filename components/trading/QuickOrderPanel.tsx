/**
 * QuickOrderPanel.tsx (Enhanced)
 * 
 * Trading Dashboard Component with Spot Trade Simulation Preview
 * Allows users to preview spot market trades before execution
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface OrderFormData {
  side: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  price: number;
}

interface QuickOrderPanelProps {
  userId: string;
  currentPrice: number;
  tradingPair: string;
  onOrderExecuted?: (result: any) => void;
}

/**
 * QuickOrderPanel Component
 * Spot trade placement with simulation preview
 */
export const QuickOrderPanel: React.FC<QuickOrderPanelProps> = ({
  userId,
  currentPrice,
  tradingPair,
  onOrderExecuted,
}) => {
  // Form state
  const [formData, setFormData] = useState<OrderFormData>({
    side: 'BUY',
    symbol: tradingPair,
    quantity: 0,
    price: currentPrice,
  });

  // Simulation state
  const {
    simulationResult,
    isLoading,
    isModalOpen,
    error,
    runSimulation,
    closeModal,
    resetState,
  } = useSimulationPreview({
    onSuccess: (result: SimulationResult) => {
      console.log('Spot trade simulation successful:', result);
    },
    onError: (error) => {
      console.error('Spot trade simulation failed:', error);
    },
  });

  // Handle preview button click
  const handlePreviewTrade = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (formData.quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    // Get estimated volatility (could fetch from market data)
    const volatility = 2.5; // Example: 2.5% volatility

    // Run simulation
    await runSimulation(
      'SPOT_TRADE',
      {
        userId,
        side: formData.side,
        symbol: formData.symbol,
        quantity: formData.quantity,
        currentPrice: formData.price,
        volatility,
      },
      userId
    );
  };

  // Handle trade execution after simulation approval
  const handleExecuteTrade = async () => {
    try {
      // Call actual trade execution
      const response = await fetch('/api/trading/execute-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          side: formData.side,
          symbol: formData.symbol,
          quantity: formData.quantity,
          price: formData.price,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onOrderExecuted?.(result);
        resetState();
        setFormData({ ...formData, quantity: 0 }); // Clear form
      }
    } catch (error) {
      console.error('Trade execution failed:', error);
    }
  };

  return (
    <div className="quick-order-panel">
      <div className="panel-header">
        <h3>Quick Order - {tradingPair}</h3>
        <span className="current-price">${currentPrice.toFixed(2)}</span>
      </div>

      <form onSubmit={handlePreviewTrade} className="order-form">
        {/* Side Selection */}
        <div className="form-group">
          <label>Order Type</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="BUY"
                checked={formData.side === 'BUY'}
                onChange={(e) =>
                  setFormData({ ...formData, side: e.target.value as 'BUY' | 'SELL' })
                }
              />
              Buy
            </label>
            <label>
              <input
                type="radio"
                value="SELL"
                checked={formData.side === 'SELL'}
                onChange={(e) =>
                  setFormData({ ...formData, side: e.target.value as 'BUY' | 'SELL' })
                }
              />
              Sell
            </label>
          </div>
        </div>

        {/* Quantity */}
        <div className="form-group">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            type="number"
            step="0.0001"
            min="0"
            placeholder="0.0000"
            value={formData.quantity}
            onChange={(e) =>
              setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })
            }
          />
        </div>

        {/* Price */}
        <div className="form-group">
          <label htmlFor="price">Price</label>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.price}
            onChange={(e) =>
              setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
            }
          />
        </div>

        {/* Total */}
        <div className="form-group total">
          <span>Total</span>
          <span className="total-value">
            ${(formData.quantity * formData.price).toFixed(2)}
          </span>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={isLoading || formData.quantity <= 0}
            className="btn btn-primary"
          >
            {isLoading ? 'Analyzing...' : 'Preview Trade'}
          </button>
        </div>
      </form>

      {/* Simulation Result Modal */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteTrade}
        confirmButtonText="Execute Trade"
      />
    </div>
  );
};

export default QuickOrderPanel;
