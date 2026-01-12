/**
 * ArbitrageDetector Component
 * 
 * Scan and highlight arbitrage opportunities between exchanges
 */

import React, { useState, useEffect } from 'react';
import { useCEXPrices } from '../hooks/useCEXPrices';
// import './ArbitrageDetector.css';

interface Opportunity {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPct: number;
  profitPotential: number;
}

interface ArbitrageDetectorProps {
  symbols?: string[];
  exchanges?: string[];
  minSpreadPct?: number;
  refreshInterval?: number;
  onOpportunity?: (opp: Opportunity) => void;
}

/**
 * Component to detect arbitrage opportunities
 */
export const ArbitrageDetector: React.FC<ArbitrageDetectorProps> = ({
  symbols = ['BTC/USDT', 'ETH/USDT', 'ADA/USDT', 'SOL/USDT'],
  exchanges = ['binance', 'coinbase', 'kraken'],
  minSpreadPct = 0.5,
  refreshInterval = 60000,
  onOpportunity,
}) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0]);
  const [isScanning, setIsScanning] = useState(false);

  // Fetch prices for monitoring
  const {
    prices,
    analysis,
    loading: pricesLoading,
    error: pricesError,
  } = useCEXPrices(selectedSymbol, exchanges, refreshInterval);

  /**
   * Scan for arbitrage opportunities
   */
  const scanOpportunities = async () => {
    if (!prices) return;

    const found: Opportunity[] = [];

    // For each pair of exchanges, check if there's an arbitrage opportunity
    for (const symbol of symbols) {
      const exchangeList: string[] = Object.keys(prices);

      for (let i = 0; i < exchangeList.length; i++) {
        for (let j = i + 1; j < exchangeList.length; j++) {
          const exchange1 = exchangeList[i];
          const exchange2 = exchangeList[j];
          const price1 = prices[exchange1]?.ask;
          const price2 = prices[exchange2]?.bid;

          if (price1 && price2) {
            const spread = price2 - price1;
            const spreadPct = (spread / price1) * 100;

            // Check if spread meets minimum threshold (and accounts for fees)
            if (spreadPct > minSpreadPct) {
              const feePct = 0.2; // 0.1% taker fee on each side
              const profitPct = spreadPct - feePct * 2;

              if (profitPct > 0) {
                found.push({
                  symbol,
                  buyExchange: exchange1,
                  sellExchange: exchange2,
                  buyPrice: price1,
                  sellPrice: price2,
                  spread,
                  spreadPct,
                  profitPotential: profitPct,
                });

                // Notify if callback provided
                if (onOpportunity) {
                  onOpportunity({
                    symbol,
                    buyExchange: exchange1,
                    sellExchange: exchange2,
                    buyPrice: price1,
                    sellPrice: price2,
                    spread,
                    spreadPct,
                    profitPotential: profitPct,
                  });
                }
              }
            }
          }
        }
      }
    }

    setOpportunities(found.sort((a, b) => b.profitPotential - a.profitPotential));
  };

  /**
   * Scan when prices update
   */
  useEffect(() => {
    if (prices && Object.keys(prices).length > 0) {
      scanOpportunities();
    }
  }, [prices]);

  /**
   * Format percentage
   */
  const formatPct = (pct: number): string => {
    return `${pct.toFixed(3)}%`;
  };

  /**
   * Get color for profit potential
   */
  const getProfitColor = (profitPct: number): string => {
    if (profitPct > 2) return 'high';
    if (profitPct > 1) return 'medium';
    return 'low';
  };

  /**
   * Get color for spread
   */
  const getSpreadColor = (spreadPct: number): string => {
    if (spreadPct > 5) return 'very-high';
    if (spreadPct > 2) return 'high';
    if (spreadPct > 0.5) return 'medium';
    return 'low';
  };

  return (
    <div className="arbitrage-detector">
      <div className="arb-header">
        <h2>Arbitrage Detector</h2>
        <div className="arb-info">
          <span className="arb-threshold">
            Min Spread: {minSpreadPct.toFixed(1)}%
          </span>
          <button
            className={`arb-scan-btn ${isScanning ? 'scanning' : ''}`}
            onClick={scanOpportunities}
            disabled={pricesLoading}
          >
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {pricesError && (
        <div className="arb-error">
          <span className="arb-error-icon">⚠</span>
          {pricesError}
        </div>
      )}

      {/* Symbol Selector */}
      <div className="arb-symbols">
        {symbols.map((symbol) => (
          <button
            key={symbol}
            className={`arb-symbol-btn ${selectedSymbol === symbol ? 'active' : ''}`}
            onClick={() => setSelectedSymbol(symbol)}
          >
            {symbol}
          </button>
        ))}
      </div>

      {/* Opportunities Display */}
      {pricesLoading && opportunities.length === 0 ? (
        <div className="arb-loading">
          <div className="arb-spinner"></div>
          <p>Scanning for opportunities...</p>
        </div>
      ) : opportunities.length > 0 ? (
        <div className="arb-opportunities">
          <div className="arb-opportunities-header">
            <span className="arb-count">
              {opportunities.length} {opportunities.length === 1 ? 'Opportunity' : 'Opportunities'} Found
            </span>
          </div>

          <div className="arb-table-container">
            <table className="arb-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Buy</th>
                  <th>Sell</th>
                  <th>Buy Price</th>
                  <th>Sell Price</th>
                  <th>Spread</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp, idx) => (
                  <tr key={idx} className="arb-opp-row">
                    <td className="arb-symbol">
                      <span className="arb-symbol-name">{opp.symbol}</span>
                    </td>
                    <td className="arb-exchange buy">
                      <span className="arb-exchange-name">{opp.buyExchange}</span>
                    </td>
                    <td className="arb-exchange sell">
                      <span className="arb-exchange-name">{opp.sellExchange}</span>
                    </td>
                    <td className="arb-price buy-price">
                      {opp.buyPrice.toFixed(2)}
                    </td>
                    <td className="arb-price sell-price">
                      {opp.sellPrice.toFixed(2)}
                    </td>
                    <td className={`arb-spread ${getSpreadColor(opp.spreadPct)}`}>
                      <span className="arb-spread-value">
                        {formatPct(opp.spreadPct)}
                      </span>
                    </td>
                    <td className={`arb-profit ${getProfitColor(opp.profitPotential)}`}>
                      <span className="arb-profit-value">
                        {formatPct(opp.profitPotential)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="arb-legend">
            <div className="arb-legend-item">
              <span className="arb-legend-box high"></span>
              <span>High Opportunity</span>
            </div>
            <div className="arb-legend-item">
              <span className="arb-legend-box medium"></span>
              <span>Medium Opportunity</span>
            </div>
            <div className="arb-legend-item">
              <span className="arb-legend-box low"></span>
              <span>Low Opportunity</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="arb-empty">
          <p>No arbitrage opportunities detected</p>
          <small>
            Keep scanning for opportunities that meet the minimum spread threshold
          </small>
        </div>
      )}

      <div className="arb-footer">
        <small>
          Arbitrage opportunities refresh every {(refreshInterval / 1000).toFixed(0)}s
        </small>
      </div>
    </div>
  );
};

export default ArbitrageDetector;
