/**
 * TreasuryDashboard.tsx (Week 2 Treasury)
 * 
 * Complete Treasury Management Dashboard
 * Simulators: TREASURY_REBALANCE, ASSET_ALLOCATION, GRANT_DISTRIBUTION
 */

import React, { useState } from 'react';
import { useActionHistoryStore } from '../../stores/actionHistory';
import TreasuryRebalancePanel from './TreasuryRebalancePanel';
import AssetAllocationPanel from './AssetAllocationPanel';
import GrantDistributionPanel from './GrantDistributionPanel';
import { DividendReinvestmentPanel } from './DividendReinvestmentPanel';
import { MarginLendingPanel } from './MarginLendingPanel';
import { FixedIncomePanel } from './FixedIncomePanel';
import './treasury-panels.css';
import './TreasuryDashboard.css';

interface TreasuryDashboardProps {
  userId: string;
  daoName?: string;
  totalTreasury?: number;
}

/**
 * TreasuryDashboard Component
 * Aggregates all treasury management panels
 */
export const TreasuryDashboard: React.FC<TreasuryDashboardProps> = ({
  userId,
  daoName = 'My DAO',
  totalTreasury = 2500000,
}) => {
  // State management
  const [activePanel, setActivePanel] = useState<'rebalance' | 'allocation' | 'grants' | 'dividend' | 'margin' | 'fixedincome'>('rebalance');
  const treasuryHistory = useActionHistoryStore((s) => s.actionHistory);
  const pushAction = useActionHistoryStore((s) => s.pushAction);
  const [showHistory, setShowHistory] = useState(false);

  // Treasury state
  const [treasuryState, setTreasuryState] = useState({
    total: totalTreasury,
    month: 'February 2026',
    growthRate: '+12.5%',
  });

  // Asset positions (simplified)
  const [assetPositions] = useState({
    USDC: { amount: 1000000, price: 1, percentage: 40 },
    ETH: { amount: 400, price: 2500, percentage: 40 },
    BTC: { amount: 30, price: 65000, percentage: 20 },
  });

  const totalValue = Object.values(assetPositions).reduce(
    (sum, asset) => sum + asset.amount * asset.price,
    0
  );

  // Handle treasury actions
  const handleRebalanceExecuted = (result: any) => {
    const action = {
      id: `action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'rebalance',
      details: result,
    };
    pushAction(action);
  };

  const handleAllocationSet = (result: any) => {
    const action = {
      id: `action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'allocation',
      details: result,
    };
    pushAction(action);
  };

  const handleDistributionExecuted = (result: any) => {
    const action = {
      id: `action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'distribution',
      details: result,
    };
    pushAction(action);
  };

  return (
    <div className="treasury-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Treasury</h1>
          <p className="subtitle">Fund management and allocation optimization</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Value</span>
            <span className="stat-value">
              ${treasuryState.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Growth (YTD)</span>
            <span className="stat-value success">{treasuryState.growthRate}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Managed Assets</span>
            <span className="stat-value">3</span>
          </div>
        </div>
      </div>

      {/* Asset Breakdown */}
      <div className="asset-breakdown-section">
        <h2>Current Asset Position</h2>
        <div className="asset-grid">
          {Object.entries(assetPositions).map(([symbol, data]) => {
            const typedData = data as { amount: number; price: number; percentage: number };
            const value = typedData.amount * typedData.price;
            return (
              <div key={symbol} className="asset-card">
                <div className="asset-header">
                  <span className="asset-symbol">{symbol}</span>
                  <span className="asset-percentage">{typedData.percentage}%</span>
                </div>
                <div className="asset-amount">
                  {typedData.amount.toFixed(symbol === 'USDC' ? 0 : 2)} {symbol}
                </div>
                <div className="asset-value">
                  ${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Treasury Tools</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'rebalance' ? 'active' : ''}`}
            onClick={() => setActivePanel('rebalance')}
          >
            <span className="tab-icon">⚖️</span>
            <span className="tab-label">Rebalancing</span>
            <span className="tab-subtitle">Optimize allocation</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'allocation' ? 'active' : ''}`}
            onClick={() => setActivePanel('allocation')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">Asset Allocation</span>
            <span className="tab-subtitle">Strategy scenarios</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'grants' ? 'active' : ''}`}
            onClick={() => setActivePanel('grants')}
          >
            <span className="tab-icon">🎁</span>
            <span className="tab-label">Grant Distribution</span>
            <span className="tab-subtitle">Vesting & rewards</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'dividend' ? 'active' : ''}`}
            onClick={() => setActivePanel('dividend')}
          >
            <span className="tab-icon">💰</span>
            <span className="tab-label">DRIP Strategy</span>
            <span className="tab-subtitle">Dividend reinvestment</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'margin' ? 'active' : ''}`}
            onClick={() => setActivePanel('margin')}
          >
            <span className="tab-icon">📈</span>
            <span className="tab-label">Margin Lending</span>
            <span className="tab-subtitle">Leverage opportunities</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'fixedincome' ? 'active' : ''}`}
            onClick={() => setActivePanel('fixedincome')}
          >
            <span className="tab-icon">🏦</span>
            <span className="tab-label">Fixed Income</span>
            <span className="tab-subtitle">Bond analysis</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'rebalance' && (
          <div className="panel-wrapper">
            <TreasuryRebalancePanel
              userId={userId}
              initialPositions={[
                { symbol: 'USDC', currentAmount: 1000000, currentPrice: 1, targetPercentage: 40 },
                { symbol: 'ETH', currentAmount: 400, currentPrice: 2500, targetPercentage: 40 },
                { symbol: 'BTC', currentAmount: 30, currentPrice: 65000, targetPercentage: 20 },
              ]}
              onRebalanceExecuted={handleRebalanceExecuted}
            />
          </div>
        )}

        {activePanel === 'allocation' && (
          <div className="panel-wrapper">
            <AssetAllocationPanel
              userId={userId}
              availableCapital={totalValue}
              onAllocationSet={handleAllocationSet}
            />
          </div>
        )}

        {activePanel === 'grants' && (
          <div className="panel-wrapper">
            <GrantDistributionPanel
              userId={userId}
              grantBudget={500000}
              onDistributionExecuted={handleDistributionExecuted}
            />
          </div>
        )}

        {activePanel === 'dividend' && (
          <div className="panel-wrapper">
            <DividendReinvestmentPanel
              userId={userId}
              onSimulationComplete={handleRebalanceExecuted}
            />
          </div>
        )}

        {activePanel === 'margin' && (
          <div className="panel-wrapper">
            <MarginLendingPanel
              userId={userId}
              onSimulationComplete={handleRebalanceExecuted}
            />
          </div>
        )}

        {activePanel === 'fixedincome' && (
          <div className="panel-wrapper">
            <FixedIncomePanel
              userId={userId}
              onSimulationComplete={handleRebalanceExecuted}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>Treasury Action History</h2>
          {treasuryHistory.filter(a => ['rebalance','allocation','distribution'].includes(a.type)).length === 0 ? (
            <div className="empty-history">
              <p>No treasury actions yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {treasuryHistory.filter(a => ['rebalance','allocation','distribution'].includes(a.type)).map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'rebalance' && '⚖️'}
                    {action.type === 'allocation' && '📊'}
                    {action.type === 'distribution' && '🎁'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'rebalance' && 'Portfolio Rebalanced'}
                      {action.type === 'allocation' && 'Asset Allocation Updated'}
                      {action.type === 'distribution' && 'Grants Distributed'}
                    </div>
                    <div className="history-time">
                      {new Date(action.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="info-section">
        <h3>💡 Treasury Management Tools</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Rebalancing</h4>
            <p>Automatically optimize your asset allocation using Monte Carlo simulations (10,000 scenarios). Maintain target allocations within configurable thresholds.</p>
          </div>
          <div className="info-card">
            <h4>Asset Allocation</h4>
            <p>Choose from 4 predefined allocation strategies (Conservative, Balanced, Growth, Yield Max) or customize your own. See projected outcomes.</p>
          </div>
          <div className="info-card">
            <h4>Grant Distribution</h4>
            <p>Distribute tokens with flexible vesting schedules. Support linear, cliff, and stepped vesting. Track budget allocations in real-time.</p>
          </div>
          <div className="info-card">
            <h4>DRIP Strategy</h4>
            <p>Automatic dividend reinvestment with tax optimization. Compare DRIP vs manual strategies and analyze compounding over time.</p>
          </div>
          <div className="info-card">
            <h4>Margin Lending</h4>
            <p>Calculated leverage for increased returns. Monitor collateral ratios, liquidation prices, and potential interest costs in real-time.</p>
          </div>
          <div className="info-card">
            <h4>Fixed Income</h4>
            <p>Bond selection and yield analysis. Evaluate credit risk, pricing, and default probabilities for various bond types and ratings.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreasuryDashboard;
