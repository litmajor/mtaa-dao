/**
 * TradingDashboard.tsx (Week 2 Integration)
 * 
 * Complete Trading Dashboard with all 5 simulator-integrated panels
 * Simulators: SPOT_TRADE, MARGIN_TRADE, PERPETUALS_FUTURES, DEX_SWAP, FLASH_LOAN
 */

import React, { useState } from 'react';
import QuickOrderPanel from './QuickOrderPanel';
import AdvancedOrderPanel from './AdvancedOrderPanel';
import DexSwapPanel from './DexSwapPanel';
import FlashLoanPanel from './FlashLoanPanel';
import './trading-panels.css';

interface TradingDashboardProps {
  userId: string;
  currentPrices?: Record<string, number>;
}

/**
 * TradingDashboard Component
 * Aggregates all trading panels with unified state and settings
 */
export const TradingDashboard: React.FC<TradingDashboardProps> = ({
  userId,
  currentPrices = {
    'ETH': 2500,
    'BTC': 65000,
    'USDC': 1,
    'DAI': 1,
    'USDT': 1,
  },
}) => {
  // State management
  const [activePanel, setActivePanel] = useState<'spot' | 'advanced' | 'dex' | 'flash'>('spot');
  const [executedTrades, setExecutedTrades] = useState<any[]>([]);
  const [showTradeHistory, setShowTradeHistory] = useState(false);

  // Token list for DEX/Flash Loan
  const supportedTokens = ['USDC', 'USDT', 'DAI', 'ETH', 'BTC'];
  const availableAssets = ['USDC', 'ETH', 'DAI'];

  // Portfolio state (simplified)
  const [portfolio] = useState({
    USDC: 10000,
    ETH: 1.5,
    BTC: 0.15,
  });

  // Handle trade execution
  const handleTradeExecuted = (tradeData: any) => {
    const newTrade = {
      id: `trade_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      ...tradeData,
    };
    setExecutedTrades([newTrade, ...executedTrades]);
    console.log('Trade executed:', newTrade);
  };

  // Trading metrics
  const totalTrades = executedTrades.length;
  const successfulTrades = executedTrades.filter((t: any) => t.status === 'success').length;
  const successRate = totalTrades > 0 ? ((successfulTrades / totalTrades) * 100).toFixed(1) : 0;

  return (
    <div className="trading-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>Trading Dashboard</h1>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Trades</span>
            <span className="stat-value">{totalTrades}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Success Rate</span>
            <span className="stat-value">{successRate}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Pairs</span>
            <span className="stat-value">{supportedTokens.length}</span>
          </div>
        </div>
      </div>

      {/* Portfolio Overview */}
      <div className="portfolio-section">
        <h2>Current Portfolio</h2>
        <div className="portfolio-grid">
          {Object.entries(portfolio).map(([token, amount]) => (
            <div key={token} className="portfolio-item">
              <div className="token-symbol">{token}</div>
              <div className="token-amount">{(amount as number).toFixed(4)}</div>
              <div className="token-price">
                ${((amount as number) * currentPrices[token as keyof typeof currentPrices]).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Trading Simulators</h2>
          <button
            className="history-toggle"
            onClick={() => setShowTradeHistory(!showTradeHistory)}
          >
            {showTradeHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'spot' ? 'active' : ''}`}
            onClick={() => setActivePanel('spot')}
          >
            <span className="tab-icon">⚡</span>
            <span className="tab-label">Spot Trade</span>
            <span className="tab-subtitle">Market Orders</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'advanced' ? 'active' : ''}`}
            onClick={() => setActivePanel('advanced')}
          >
            <span className="tab-icon">📈</span>
            <span className="tab-label">Margin/Perpetuals</span>
            <span className="tab-subtitle">Leveraged Trading</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'dex' ? 'active' : ''}`}
            onClick={() => setActivePanel('dex')}
          >
            <span className="tab-icon">🔄</span>
            <span className="tab-label">DEX Swap</span>
            <span className="tab-subtitle">AMM Trading</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'flash' ? 'active' : ''}`}
            onClick={() => setActivePanel('flash')}
          >
            <span className="tab-icon">⚡💰</span>
            <span className="tab-label">Flash Loan</span>
            <span className="tab-subtitle">Arbitrage</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'spot' && (
          <div className="panel-wrapper">
            <QuickOrderPanel
              userId={userId}
              currentPrice={currentPrices['ETH']}
              tradingPair="ETH/USDC"
              onOrderExecuted={handleTradeExecuted}
            />
          </div>
        )}

        {activePanel === 'advanced' && (
          <div className="panel-wrapper">
            <AdvancedOrderPanel
              userId={userId}
              currentPrice={currentPrices['ETH']}
              tradingPair="ETH/USDC"
              onOrderExecuted={handleTradeExecuted}
            />
          </div>
        )}

        {activePanel === 'dex' && (
          <div className="panel-wrapper">
            <DexSwapPanel
              userId={userId}
              supportedTokens={supportedTokens}
              onSwapExecuted={handleTradeExecuted}
            />
          </div>
        )}

        {activePanel === 'flash' && (
          <div className="panel-wrapper">
            <FlashLoanPanel
              userId={userId}
              availableAssets={availableAssets}
              onFlashLoanExecuted={handleTradeExecuted}
            />
          </div>
        )}
      </div>

      {/* Trade History */}
      {showTradeHistory && (
        <div className="trade-history-section">
          <h2>Trade History</h2>
          {executedTrades.length === 0 ? (
            <div className="empty-history">
              <p>No trades executed yet. Start by selecting a trading simulator above.</p>
            </div>
          ) : (
            <div className="history-table">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Details</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {executedTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td>{new Date(trade.timestamp).toLocaleString()}</td>
                      <td>
                        <span className={`trade-type ${trade.type}`}>
                          {trade.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="details-cell">
                        {trade.symbol && `${trade.symbol} - ${trade.quantity} units`}
                        {trade.tokenPath && `${trade.tokenPath.join(' → ')}`}
                      </td>
                      <td>
                        <span className={`status-badge ${trade.status || 'pending'}`}>
                          {trade.status || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="info-section">
        <h3>ℹ️ Simulator Information</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Spot Trading</h4>
            <p>Execute immediate market orders with realistic execution. BASIC depth analysis.</p>
          </div>
          <div className="info-card">
            <h4>Leveraged Trading (Margin/Perpetuals)</h4>
            <p>Advanced trading with leverage up to 125x. Includes liquidation risk analysis.</p>
          </div>
          <div className="info-card">
            <h4>DEX Swaps</h4>
            <p>AMM-based token swaps with price impact calculation and slippage protection.</p>
          </div>
          <div className="info-card">
            <h4>Flash Loans</h4>
            <p>Uncollateralized loans with arbitrage, liquidation, and refinance strategies.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingDashboard;
