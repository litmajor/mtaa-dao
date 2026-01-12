/**
 * CEXBalancePanel Component
 * 
 * Display user balances across multiple exchanges
 */

import React, { useState, useEffect } from 'react';
import './CEXBalancePanel.css';

interface BalanceItem {
  exchange: string;
  currency: string;
  free: number;
  used: number;
  total: number;
}

interface CEXBalancePanelProps {
  exchanges?: string[];
  onRefresh?: () => void;
}

/**
 * Component to display CEX balances
 */
export const CEXBalancePanel: React.FC<CEXBalancePanelProps> = ({
  exchanges = ['binance', 'coinbase', 'kraken'],
  onRefresh,
}) => {
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState(0);

  /**
   * Fetch balances from API
   */
  const fetchBalances = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/exchanges/balances?exchanges=${exchanges.join(',')}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setBalances(data.balances || []);
      setTotalValue(data.total_value || 0);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setLoading(false);
      console.error('Failed to fetch balances:', err);
    }
  };

  /**
   * Load balances on mount
   */
  useEffect(() => {
    fetchBalances();
  }, []);

  /**
   * Format currency value
   */
  const formatValue = (value: number): string => {
    if (value >= 1) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }

    return value.toFixed(8);
  };

  /**
   * Get balances for selected exchange
   */
  const getExchangeBalances = (exchange: string): BalanceItem[] => {
    return balances.filter((b) => b.exchange === exchange);
  };

  /**
   * Get total balance by exchange
   */
  const getExchangeTotal = (exchange: string): number => {
    return getExchangeBalances(exchange).reduce((sum, b) => sum + b.total, 0);
  };

  /**
   * Get unique exchanges with balances
   */
  const getExchangesWithBalances = (): string[] => {
    return Array.from(new Set(balances.map((b) => b.exchange)));
  };

  const exchangesWithBalances = getExchangesWithBalances();
  const activeExchange = selectedExchange || (exchangesWithBalances.length > 0 ? exchangesWithBalances[0] : null);
  const exchangeBalances = activeExchange ? getExchangeBalances(activeExchange) : [];

  return (
    <div className="cex-balance-panel">
      <div className="cex-bp-header">
        <h2>CEX Balances</h2>
        <button
          className={`cex-bp-refresh ${loading ? 'loading' : ''}`}
          onClick={() => {
            fetchBalances();
            if (onRefresh) onRefresh();
          }}
          disabled={loading}
          title="Refresh balances"
        >
          {loading ? '⟳' : '↻'}
        </button>
      </div>

      {error && (
        <div className="cex-bp-error">
          <span className="cex-bp-error-icon">⚠</span>
          {error}
        </div>
      )}

      {loading && balances.length === 0 ? (
        <div className="cex-bp-loading">
          <div className="cex-bp-spinner"></div>
          <p>Loading balances...</p>
        </div>
      ) : (
        <>
          {/* Total Value Summary */}
          {totalValue > 0 && (
            <div className="cex-bp-summary">
              <div className="cex-bp-total">
                <span className="cex-bp-label">Total Portfolio Value</span>
                <span className="cex-bp-value">
                  {formatValue(totalValue)}
                </span>
              </div>
            </div>
          )}

          {/* Exchange Selector */}
          {exchangesWithBalances.length > 1 && (
            <div className="cex-bp-exchanges">
              {exchangesWithBalances.map((exchange) => (
                <button
                  key={exchange}
                  className={`cex-bp-exchange-btn ${
                    activeExchange === exchange ? 'active' : ''
                  }`}
                  onClick={() => setSelectedExchange(exchange)}
                >
                  <span className="cex-bp-exchange-name">
                    {exchange.toUpperCase()}
                  </span>
                  <span className="cex-bp-exchange-value">
                    {getExchangeTotal(exchange).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Balances Table */}
          {exchangeBalances.length > 0 ? (
            <div className="cex-bp-table-container">
              <table className="cex-bp-table">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>Free</th>
                    <th>Used</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {exchangeBalances.map((balance) => (
                    <tr key={`${balance.exchange}-${balance.currency}`}>
                      <td className="cex-bp-currency">
                        <span className="cex-bp-currency-code">
                          {balance.currency}
                        </span>
                      </td>
                      <td className="cex-bp-amount free">
                        {balance.free.toFixed(8)}
                      </td>
                      <td className="cex-bp-amount used">
                        {balance.used.toFixed(8)}
                      </td>
                      <td className="cex-bp-amount total">
                        {balance.total.toFixed(8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cex-bp-empty">
              <p>No balances found</p>
              <small>Connect your exchanges to view balances</small>
            </div>
          )}

          {/* Exchange Details */}
          {activeExchange && (
            <div className="cex-bp-details">
              <div className="cex-bp-detail-item">
                <span className="label">Exchange</span>
                <span className="value">{activeExchange.toUpperCase()}</span>
              </div>
              <div className="cex-bp-detail-item">
                <span className="label">Total Coins</span>
                <span className="value">{exchangeBalances.length}</span>
              </div>
              <div className="cex-bp-detail-item">
                <span className="label">Exchange Value</span>
                <span className="value">
                  {getExchangeTotal(activeExchange).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="cex-bp-footer">
        <small>Last updated: {new Date().toLocaleTimeString()}</small>
      </div>
    </div>
  );
};

export default CEXBalancePanel;
