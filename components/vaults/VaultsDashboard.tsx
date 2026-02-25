/**
 * VaultsDashboard.tsx
 * Vault Management Dashboard
 * 
 * Wires all 3 Vault simulators:
 * - VAULT_WITHDRAWAL
 * - VAULT_LIQUIDATION
 * - VAULT_STRATEGY
 */

import React, { useState } from 'react';
import { VaultWithdrawalPanel } from './VaultWithdrawalPanel';
import { VaultLiquidationPanel } from './VaultLiquidationPanel';
import { VaultStrategyPanel } from './VaultStrategyPanel';

interface VaultsDashboardProps {
  userId: string;
  daoName?: string;
}

export const VaultsDashboard: React.FC<VaultsDashboardProps> = ({
  userId,
  daoName = 'My DAO',
}) => {
  const [activePanel, setActivePanel] = useState<'withdrawal' | 'liquidation' | 'strategy'>('strategy');
  const [vaultHistory, setVaultHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Vault state
  const [vaultState] = useState({
    totalVault: 500000,
    totalDeposited: 500000,
    lockedAmount: 400000,
    unlockedAmount: 100000,
  });

  const handleSimulationComplete = (result: any) => {
    const action = {
      id: `vault_action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      details: result,
    };
    setVaultHistory([action, ...vaultHistory]);
  };

  return (
    <div className="vaults-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Vaults</h1>
          <p className="subtitle">Manage vault strategies, withdrawals, and liquidation analysis</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Value</span>
            <span className="stat-value">
              ${vaultState.totalVault.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Locked Amount</span>
            <span className="stat-value">
              ${vaultState.lockedAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Unlocked</span>
            <span className="stat-value success">
              ${vaultState.unlockedAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Vault Tools</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'strategy' ? 'active' : ''}`}
            onClick={() => setActivePanel('strategy')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">Strategy Optimization</span>
            <span className="tab-subtitle">Compare allocation strategies</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'withdrawal' ? 'active' : ''}`}
            onClick={() => setActivePanel('withdrawal')}
          >
            <span className="tab-icon">💸</span>
            <span className="tab-label">Withdrawal Planning</span>
            <span className="tab-subtitle">Analyze withdrawal options</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'liquidation' ? 'active' : ''}`}
            onClick={() => setActivePanel('liquidation')}
          >
            <span className="tab-icon">⚠️</span>
            <span className="tab-label">Liquidation Risk</span>
            <span className="tab-subtitle">Monitor collateral health</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'strategy' && (
          <div className="panel-wrapper">
            <VaultStrategyPanel
              userId={userId}
              vaultId="main-vault"
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'withdrawal' && (
          <div className="panel-wrapper">
            <VaultWithdrawalPanel
              userId={userId}
              vaultId="main-vault"
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'liquidation' && (
          <div className="panel-wrapper">
            <VaultLiquidationPanel
              userId={userId}
              vaultId="main-vault"
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>Vault Action History</h2>
          {vaultHistory.length === 0 ? (
            <div className="empty-history">
              <p>No vault actions yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {vaultHistory.map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'strategy' && '📊'}
                    {action.type === 'withdrawal' && '💸'}
                    {action.type === 'liquidation' && '⚠️'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'strategy' && 'Strategy Optimized'}
                      {action.type === 'withdrawal' && 'Withdrawal Analyzed'}
                      {action.type === 'liquidation' && 'Liquidation Risk Assessed'}
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
        <h3>💡 Vault Management Tools</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Strategy Optimization</h4>
            <p>Compare allocation strategies based on risk tolerance. Analyze projected returns and historical volatility for different asset mixes.</p>
          </div>
          <div className="info-card">
            <h4>Withdrawal Planning</h4>
            <p>Plan vault withdrawals considering lock-up periods and penalties. Analyze timing to minimize withdrawal costs and maximize returns.</p>
          </div>
          <div className="info-card">
            <h4>Liquidation Risk</h4>
            <p>Monitor collateral health and liquidation thresholds. Calculate liquidation prices and understand margin requirements.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultsDashboard;
