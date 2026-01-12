/**
 * CEXPriceComparison Component
 * 
 * Display real-time prices from multiple exchanges with spread analysis
 */

import React, { useState } from 'react';
import { useCEXPrices } from '../hooks/useCEXPrices';

interface CEXPriceComparisonProps {
  symbol?: string;
  exchanges?: string[];
  refreshInterval?: number;
  onPriceSelect?: (exchange: string, price: number) => void;
}

interface ExchangePrice {
  exchange: string;
  bid: number;
  ask: number;
  last: number;
  spread: number;
  spreadPct: number;
  isBest: boolean;
}

/**
 * Component to display CEX prices with real-time updates
 */
export const CEXPriceComparison: React.FC<CEXPriceComparisonProps> = ({
  symbol = 'BTC/USDT',
  exchanges = ['binance', 'coinbase', 'kraken'],
  refreshInterval = 30000,
  onPriceSelect,
}) => {
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const {
    prices,
    analysis,
    loading,
    error,
    refetch,
    isRefetching,
  } = useCEXPrices(symbol, exchanges, refreshInterval);

  /**
   * Format price for display
   */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(price);
  };

  /**
   * Get exchange price data with analysis
   */
  const getExchangePrices = (): ExchangePrice[] => {
    if (!prices || !analysis) return [];

    return Object.entries(prices).map(([exchange, priceData]) => {
      if (!priceData) return null as any;
      
      const spread = analysis.best_ask - analysis.best_bid;
      const isBest = 
        (priceData.bid === analysis.best_bid) || 
        (priceData.ask === analysis.best_ask);

      return {
        exchange,
        bid: priceData.bid,
        ask: priceData.ask,
        last: priceData.last,
        spread,
        spreadPct: analysis.spread_pct,
        isBest,
      };
    }).filter(Boolean);
  };

  /**
   * Copy price to clipboard
   */
  const copyToClipboard = (price: number, type: string) => {
    navigator.clipboard.writeText(price.toString());
    setCopied(`${type}`);
    setTimeout(() => setCopied(null), 2000);
  };

  /**
   * Handle exchange selection
   */
  const handleSelectExchange = (exchange: string, price: number) => {
    setSelectedExchange(exchange);
    if (onPriceSelect) {
      onPriceSelect(exchange, price);
    }
  };

  const exchangePrices = getExchangePrices();

  return (
    <div className="cex-price-comparison">
      <div className="cex-pc-header">
        <h2>CEX Price Comparison</h2>
        <div className="cex-pc-controls">
          <span className="cex-pc-symbol">{symbol}</span>
          <button
            className={`cex-pc-refresh ${isRefetching ? 'loading' : ''}`}
            onClick={refetch}
            disabled={loading}
            title="Refresh prices"
          >
            {isRefetching ? '⟳' : '↻'}
          </button>
        </div>
      </div>

      {error && (
        <div className="cex-pc-error">
          <span className="cex-pc-error-icon">⚠</span>
          {error}
        </div>
      )}

      {loading && !prices ? (
        <div className="cex-pc-loading">
          <div className="cex-pc-spinner"></div>
          <p>Loading prices...</p>
        </div>
      ) : (
        <>
          {analysis && (
            <div className="cex-pc-summary">
              <div className="cex-pc-summary-item">
                <label>Best Bid</label>
                <span className="cex-pc-value">{formatPrice(analysis.best_bid)}</span>
              </div>
              <div className="cex-pc-summary-item">
                <label>Best Ask</label>
                <span className="cex-pc-value">{formatPrice(analysis.best_ask)}</span>
              </div>
              <div className="cex-pc-summary-item">
                <label>Spread</label>
                <span className={`cex-pc-value ${analysis.spread_pct > 0.5 ? 'high' : 'low'}`}>
                  {analysis.spread_pct.toFixed(3)}%
                </span>
              </div>
              <div className="cex-pc-summary-item">
                <label>Best Source</label>
                <span className="cex-pc-value">{analysis.best_source}</span>
              </div>
            </div>
          )}

          <div className="cex-pc-table-container">
            <table className="cex-pc-table">
              <thead>
                <tr>
                  <th>Exchange</th>
                  <th>Bid</th>
                  <th>Ask</th>
                  <th>Last</th>
                  <th>Spread</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {exchangePrices.map((ep) => (
                  <tr
                    key={ep.exchange}
                    className={`cex-pc-row ${ep.isBest ? 'best' : ''} ${
                      selectedExchange === ep.exchange ? 'selected' : ''
                    }`}
                  >
                    <td className="cex-pc-exchange">
                      <span className="cex-pc-exchange-name">{ep.exchange}</span>
                      {ep.isBest && <span className="cex-pc-badge">Best</span>}
                    </td>
                    <td
                      className="cex-pc-price bid"
                      onClick={() => copyToClipboard(ep.bid, 'Bid')}
                      title="Click to copy"
                    >
                      {formatPrice(ep.bid)}
                      {copied === 'Bid' && <span className="cex-pc-copied">✓</span>}
                    </td>
                    <td
                      className="cex-pc-price ask"
                      onClick={() => copyToClipboard(ep.ask, 'Ask')}
                      title="Click to copy"
                    >
                      {formatPrice(ep.ask)}
                      {copied === 'Ask' && <span className="cex-pc-copied">✓</span>}
                    </td>
                    <td className="cex-pc-price last">
                      {formatPrice(ep.last)}
                    </td>
                    <td className="cex-pc-spread">
                      {(ep.ask - ep.bid).toFixed(8)}
                    </td>
                    <td className="cex-pc-action">
                      <button
                        className="cex-pc-select-btn"
                        onClick={() => handleSelectExchange(ep.exchange, ep.ask)}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {exchangePrices.length === 0 && (
            <div className="cex-pc-empty">
              <p>No price data available</p>
            </div>
          )}
        </>
      )}

      <div className="cex-pc-footer">
        <small>Prices update every {refreshInterval / 1000}s</small>
      </div>
    </div>
  );
};

export default CEXPriceComparison;
