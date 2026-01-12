/**
 * CEXOrderModal Component
 * 
 * Complete order workflow: exchange selection, amount, price, review, and execution
 */

import React, { useState, useEffect } from 'react';
import { useCEXOrder, OrderSide, OrderType } from '../hooks/useCEXOrder';

interface CEXOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSymbol?: string;
  defaultExchange?: string;
  defaultSide?: OrderSide;
  onSuccess?: (orderId: string) => void;
}

interface StepData {
  exchange: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  amount: number;
  price: number | null;
  estimatedCost: number;
  estimatedFees: number;
}

type OrderStep = 'exchange' | 'details' | 'review' | 'executing' | 'success' | 'error';

/**
 * Modal component for placing CEX orders
 */
export const CEXOrderModal: React.FC<CEXOrderModalProps> = ({
  isOpen,
  onClose,
  defaultSymbol = 'BTC/USDT',
  defaultExchange = 'binance',
  defaultSide = 'buy',
  onSuccess,
}) => {
  const [step, setStep] = useState<OrderStep>('exchange');
  const [stepData, setStepData] = useState<StepData>({
    exchange: defaultExchange,
    symbol: defaultSymbol,
    side: defaultSide,
    type: 'market',
    amount: 0,
    price: null,
    estimatedCost: 0,
    estimatedFees: 0,
  });

  const {
    status,
    orderData,
    validationResult,
    executionResult,
    setOrderData,
    validate,
    place,
    reset,
    error,
    loading,
  } = useCEXOrder();

  const exchanges = ['binance', 'coinbase', 'kraken', 'gate.io', 'okx'];
  const takerFeeRate = 0.001; // 0.1% default taker fee

  /**
   * Handle exchange selection
   */
  const handleExchangeSelect = (exchange: string) => {
    setStepData((prev) => ({ ...prev, exchange }));
    setStep('details');
  };

  /**
   * Calculate estimated cost and fees
   */
  const calculateEstimates = (amount: number, price: number | null) => {
    if (stepData.type === 'market' || !price) {
      return { cost: 0, fees: 0 };
    }

    const cost = amount * price;
    const fees = cost * takerFeeRate;
    return { cost, fees };
  };

  /**
   * Handle amount/price input
   */
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseFloat(e.target.value) || 0;
    const estimates = calculateEstimates(
      amount,
      stepData.type === 'limit' ? stepData.price : null
    );

    setStepData((prev) => ({
      ...prev,
      amount,
      estimatedCost: estimates.cost,
      estimatedFees: estimates.fees,
    }));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const price = parseFloat(e.target.value) || null;
    const estimates = calculateEstimates(stepData.amount, price);

    setStepData((prev) => ({
      ...prev,
      price,
      estimatedCost: estimates.cost,
      estimatedFees: estimates.fees,
    }));
  };

  /**
   * Proceed to review step
   */
  const handleProceedToReview = async () => {
    // Validate inputs
    if (stepData.amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (stepData.type === 'limit' && (!stepData.price || stepData.price <= 0)) {
      alert('Please enter a valid price for limit orders');
      return;
    }

    // Set order data and validate
    setOrderData({
      exchange: stepData.exchange,
      symbol: stepData.symbol,
      side: stepData.side,
      amount: stepData.amount,
      price: stepData.price || undefined,
      type: stepData.type,
    });

    // Move to review step immediately (validation happens in background)
    setStep('review');
  };

  /**
   * Handle order execution
   */
  const handleExecuteOrder = async () => {
    setStep('executing');
    await place();
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    reset();
    setStep('exchange');
    setStepData({
      exchange: defaultExchange,
      symbol: defaultSymbol,
      side: defaultSide,
      type: 'market',
      amount: 0,
      price: null,
      estimatedCost: 0,
      estimatedFees: 0,
    });
    onClose();
  };

  /**
   * Handle successful order
   */
  useEffect(() => {
    if (step === 'executing' && status === 'placed' && executionResult?.success) {
      setStep('success');
      if (onSuccess && executionResult.orderId) {
        setTimeout(() => onSuccess(executionResult.orderId!), 2000);
      }
    }

    if (step === 'executing' && status === 'failed') {
      setStep('error');
    }
  }, [status, step, executionResult, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="cex-order-modal-overlay" onClick={handleClose}>
      <div className="cex-order-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cex-om-header">
          <h2>Place Order</h2>
          <button className="cex-om-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="cex-om-content">
          {/* EXCHANGE SELECTION STEP */}
          {step === 'exchange' && (
            <div className="cex-om-step exchange-step">
              <h3>Select Exchange</h3>
              <div className="cex-om-exchange-grid">
                {exchanges.map((exchange) => (
                  <button
                    key={exchange}
                    className={`cex-om-exchange-btn ${
                      stepData.exchange === exchange ? 'selected' : ''
                    }`}
                    onClick={() => handleExchangeSelect(exchange)}
                  >
                    <span className="cex-om-exchange-name">
                      {exchange.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ORDER DETAILS STEP */}
          {step === 'details' && (
            <div className="cex-om-step details-step">
              <h3>Order Details</h3>

              <div className="cex-om-form-group">
                <label>Symbol</label>
                <input
                  type="text"
                  value={stepData.symbol}
                  onChange={(e) =>
                    setStepData((prev) => ({
                      ...prev,
                      symbol: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="BTC/USDT"
                />
              </div>

              <div className="cex-om-form-row">
                <div className="cex-om-form-group">
                  <label>Side</label>
                  <div className="cex-om-side-toggle">
                    <button
                      className={`cex-om-side-btn buy ${
                        stepData.side === 'buy' ? 'active' : ''
                      }`}
                      onClick={() =>
                        setStepData((prev) => ({ ...prev, side: 'buy' }))
                      }
                    >
                      BUY
                    </button>
                    <button
                      className={`cex-om-side-btn sell ${
                        stepData.side === 'sell' ? 'active' : ''
                      }`}
                      onClick={() =>
                        setStepData((prev) => ({ ...prev, side: 'sell' }))
                      }
                    >
                      SELL
                    </button>
                  </div>
                </div>

                <div className="cex-om-form-group">
                  <label>Order Type</label>
                  <div className="cex-om-type-toggle">
                    <button
                      className={`cex-om-type-btn ${
                        stepData.type === 'market' ? 'active' : ''
                      }`}
                      onClick={() =>
                        setStepData((prev) => ({ ...prev, type: 'market' }))
                      }
                    >
                      MARKET
                    </button>
                    <button
                      className={`cex-om-type-btn ${
                        stepData.type === 'limit' ? 'active' : ''
                      }`}
                      onClick={() =>
                        setStepData((prev) => ({ ...prev, type: 'limit' }))
                      }
                    >
                      LIMIT
                    </button>
                  </div>
                </div>
              </div>

              <div className="cex-om-form-group">
                <label>Amount</label>
                <input
                  type="number"
                  step="0.00000001"
                  min="0"
                  value={stepData.amount || ''}
                  onChange={handleAmountChange}
                  placeholder="0.00000000"
                />
              </div>

              {stepData.type === 'limit' && (
                <div className="cex-om-form-group">
                  <label>Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={stepData.price || ''}
                    onChange={handlePriceChange}
                    placeholder="0.00"
                  />
                </div>
              )}

              {stepData.estimatedCost > 0 && (
                <div className="cex-om-estimates">
                  <div className="cex-om-estimate-item">
                    <span>Estimated Cost</span>
                    <strong>{stepData.estimatedCost.toFixed(2)} USDT</strong>
                  </div>
                  <div className="cex-om-estimate-item">
                    <span>Estimated Fees</span>
                    <strong>{stepData.estimatedFees.toFixed(8)} USDT</strong>
                  </div>
                </div>
              )}

              <button
                className="cex-om-btn-primary"
                onClick={handleProceedToReview}
                disabled={loading}
              >
                Review Order
              </button>
            </div>
          )}

          {/* REVIEW STEP */}
          {step === 'review' && (
            <div className="cex-om-step review-step">
              <h3>Review Order</h3>

              <div className="cex-om-review-table">
                <div className="cex-om-review-row">
                  <span className="label">Exchange</span>
                  <span className="value">{stepData.exchange.toUpperCase()}</span>
                </div>
                <div className="cex-om-review-row">
                  <span className="label">Symbol</span>
                  <span className="value">{stepData.symbol}</span>
                </div>
                <div className="cex-om-review-row">
                  <span className="label">Side</span>
                  <span className={`value ${stepData.side}`}>
                    {stepData.side.toUpperCase()}
                  </span>
                </div>
                <div className="cex-om-review-row">
                  <span className="label">Type</span>
                  <span className="value">{stepData.type.toUpperCase()}</span>
                </div>
                <div className="cex-om-review-row">
                  <span className="label">Amount</span>
                  <span className="value">{stepData.amount.toFixed(8)}</span>
                </div>
                {stepData.type === 'limit' && (
                  <div className="cex-om-review-row">
                    <span className="label">Price</span>
                    <span className="value">{stepData.price?.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {validationResult && !validationResult.valid && (
                <div className="cex-om-validation-error">
                  <p>Validation Issues:</p>
                  <ul>
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="cex-om-actions">
                <button
                  className="cex-om-btn-secondary"
                  onClick={() => setStep('details')}
                >
                  Back
                </button>
                <button
                  className="cex-om-btn-primary"
                  onClick={handleExecuteOrder}
                  disabled={loading || (validationResult?.valid === false) || undefined}
                >
                  {loading ? 'Processing...' : 'Execute Order'}
                </button>
              </div>
            </div>
          )}

          {/* EXECUTING STEP */}
          {step === 'executing' && (
            <div className="cex-om-step executing-step">
              <div className="cex-om-spinner"></div>
              <h3>Executing Order...</h3>
              <p>Please wait while we place your order</p>
            </div>
          )}

          {/* SUCCESS STEP */}
          {step === 'success' && executionResult?.success && (
            <div className="cex-om-step success-step">
              <div className="cex-om-success-icon">✓</div>
              <h3>Order Placed Successfully!</h3>
              <div className="cex-om-success-details">
                <p>
                  <strong>Order ID:</strong> {executionResult.orderId}
                </p>
                {executionResult.txHash && (
                  <p>
                    <strong>Tx Hash:</strong> {executionResult.txHash}
                  </p>
                )}
              </div>
              <button className="cex-om-btn-primary" onClick={handleClose}>
                Close
              </button>
            </div>
          )}

          {/* ERROR STEP */}
          {step === 'error' && (
            <div className="cex-om-step error-step">
              <div className="cex-om-error-icon">✕</div>
              <h3>Order Failed</h3>
              <p className="cex-om-error-message">{error || 'Unknown error occurred'}</p>
              <button
                className="cex-om-btn-secondary"
                onClick={() => setStep('review')}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CEXOrderModal;
