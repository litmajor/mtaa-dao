/**
 * AdvancedOrderPanel.tsx (Enhanced)
 * 
 * Trading Dashboard Component with Margin Trade & Perpetuals/Futures Simulation Preview
 * Supports leveraged trading with liquidation price and funding rate analysis
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

type OrderType = 'MARGIN' | 'PERPETUALS';

interface AdvancedOrderFormData {
  orderType: OrderType;
  side: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  price: number;
  leverage: number;
  collateral: number;
}

interface AdvancedOrderPanelProps {
  userId: string;
  currentPrice: number;
  tradingPair: string;
  onOrderExecuted?: (result: any) => void;
}

/**
 * AdvancedOrderPanel Component
 * Margin and perpetuals trading with risk analysis
 */
export const AdvancedOrderPanel: React.FC<AdvancedOrderPanelProps> = ({
  userId,
  currentPrice,
  tradingPair,
  onOrderExecuted,
}) => {
  // Form state
  const [formData, setFormData] = useState<AdvancedOrderFormData>({
    orderType: 'MARGIN',
    side: 'BUY',
    symbol: tradingPair,
    quantity: 0,
    price: currentPrice,
    leverage: 2, // 2x leverage default
    collateral: 0,
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
      console.log('Advanced trade simulation successful:', result);
    },
  });

  // Calculate liquidation price (for margin trades)
  const calculateLiquidationPrice = (): number => {
    if (formData.orderType !== 'MARGIN' || formData.leverage <= 1) return 0;
    
    const liquidationPercentage = 1 / formData.leverage;
    if (formData.side === 'BUY') {
      return formData.price * (1 - liquidationPercentage);
    } else {
      return formData.price * (1 + liquidationPercentage);
    }
  };

  // Handle preview button click
  const handlePreviewTrade = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    if (formData.leverage < 1 || formData.leverage > 125) {
      alert('Leverage must be between 1 and 125');
      return;
    }

    const volatility = 3.5; // Example: 3.5% volatility for leveraged trades

    const simulatorType = formData.orderType === 'MARGIN' ? 'MARGIN_TRADE' : 'PERPETUALS_FUTURES';

    // Run simulation
    await runSimulation(
      simulatorType,
      {
        userId,
        side: formData.side,
        symbol: formData.symbol,
        quantity: formData.quantity,
        currentPrice: formData.price,
        leverage: formData.leverage,
        collateral: formData.collateral,
        volatility,
      },
      userId
    );
  };

  // Handle execution
  const handleExecuteTrade = async () => {
    try {
      const endpoint =
        formData.orderType === 'MARGIN'
          ? '/api/trading/execute-margin-order'
          : '/api/trading/execute-perpetuals-order';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          side: formData.side,
          symbol: formData.symbol,
          quantity: formData.quantity,
          price: formData.price,
          leverage: formData.leverage,
          collateral: formData.collateral,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onOrderExecuted?.(result);
        resetState();
        setFormData({ ...formData, quantity: 0, collateral: 0 });
      }
    } catch (error) {
      console.error('Trade execution failed:', error);
    }
  };

  const notionalValue = formData.quantity * formData.price;
  const usedMargin = formData.collateral;
  const liquidationPrice = calculateLiquidationPrice();
  const estimatedFundingCost = notionalValue * 0.075 * (formData.leverage - 1); // Example: 7.5% annual

  return (
    <div className="advanced-order-panel">
      <div className="panel-header">
        <h3>Advanced Order - {tradingPair}</h3>
        <div className="tabs">
          <button
            className={`tab ${formData.orderType === 'MARGIN' ? 'active' : ''}`}
            onClick={() => setFormData({ ...formData, orderType: 'MARGIN' })}
          >
            Margin
          </button>
          <button
            className={`tab ${formData.orderType === 'PERPETUALS' ? 'active' : ''}`}
            onClick={() => setFormData({ ...formData, orderType: 'PERPETUALS' })}
          >
            Perpetuals
          </button>
        </div>
      </div>

      <form onSubmit={handlePreviewTrade} className="order-form">
        {/* Side Selection */}
        <div className="form-group">
          <label>Position</label>
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
              Long
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
              Short
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
            value={formData.price}
            onChange={(e) =>
              setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
            }
          />
        </div>

        {/* Leverage */}
        <div className="form-group">
          <label htmlFor="leverage">
            Leverage: {formData.leverage}x
          </label>
          <input
            id="leverage"
            type="range"
            min="1"
            max="125"
            step="1"
            value={formData.leverage}
            onChange={(e) =>
              setFormData({ ...formData, leverage: parseFloat(e.target.value) })
            }
          />
          <div className="leverage-info">
            {formData.leverage > 10 && (
              <span className="warning">⚠ High leverage - increased liquidation risk</span>
            )}
            {formData.leverage > 50 && (
              <span className="critical">🔴 Extreme leverage - very high risk</span>
            )}
          </div>
        </div>

        {/* Collateral */}
        <div className="form-group">
          <label htmlFor="collateral">Collateral</label>
          <input
            id="collateral"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.collateral}
            onChange={(e) =>
              setFormData({ ...formData, collateral: parseFloat(e.target.value) || 0 })
            }
          />
        </div>

        {/* Risk Metrics */}
        <div className="risk-metrics">
          <div className="metric">
            <span>Notional Value</span>
            <span className="value">${notionalValue.toFixed(2)}</span>
          </div>

          {formData.orderType === 'MARGIN' && liquidationPrice > 0 && (
            <div className="metric critical">
              <span>Liquidation Price</span>
              <span className="value">${liquidationPrice.toFixed(2)}</span>
            </div>
          )}

          {formData.orderType === 'PERPETUALS' && (
            <div className="metric">
              <span>Est. Funding Cost (24h)</span>
              <span className="value">${estimatedFundingCost.toFixed(4)}</span>
            </div>
          )}

          <div className="metric">
            <span>Margin Ratio</span>
            <span className="value">
              {formData.collateral > 0 ? ((formData.collateral / notionalValue) * 100).toFixed(2) : '0'}%
            </span>
          </div>
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
        confirmButtonText={`Execute ${formData.orderType === 'MARGIN' ? 'Margin' : 'Perpetual'} Trade`}
      />
    </div>
  );
};

export default AdvancedOrderPanel;
