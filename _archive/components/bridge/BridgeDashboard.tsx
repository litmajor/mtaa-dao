/**
 * BridgeDashboard.tsx
 * Cross-Chain Operations Dashboard
 * 
 * Wires all 2 Bridge simulators:
 * - BRIDGE_TRANSFER
 * - CROSS_CHAIN_ARBITRAGE
 */

import React, { useState } from 'react';
import { useActionHistoryStore } from '../../stores/actionHistory';
import { BridgeTransferPanel } from './BridgeTransferPanel';
import { CrossChainArbitragePanel } from './CrossChainArbitragePanel';

interface BridgeDashboardProps {
  userId: string;
  daoName?: string;
}

export const BridgeDashboard: React.FC<BridgeDashboardProps> = ({
  userId,
  daoName = 'My DAO',
}) => {
  const [activePanel, setActivePanel] = useState<'transfer' | 'arbitrage'>('transfer');
  const bridgeHistory = useActionHistoryStore((s) => s.actionHistory);
  const pushAction = useActionHistoryStore((s) => s.pushAction);
  const [showHistory, setShowHistory] = useState(false);

  // Bridge state
  const [bridgeState] = useState({
    totalCrossChain: 1500000,
    activeTokens: 12,
    supportedChains: 7,
    avgTransferTime: '2 min',
  });

  const handleSimulationComplete = (result: any) => {
    const action = {
      id: `bridge_action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      details: result,
    };
    pushAction(action);
  };

  return (
    <div className="bridge-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Cross-Chain Operations</h1>
          <p className="subtitle">Bridge transfers and cross-chain arbitrage opportunities</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Cross-Chain</span>
            <span className="stat-value">
              ${bridgeState.totalCrossChain.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Tokens</span>
            <span className="stat-value">{bridgeState.activeTokens}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Supported Chains</span>
            <span className="stat-value">{bridgeState.supportedChains}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg Transfer Time</span>
            <span className="stat-value">{bridgeState.avgTransferTime}</span>
          </div>
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Bridge Operations</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'transfer' ? 'active' : ''}`}
            onClick={() => setActivePanel('transfer')}
          >
            <span className="tab-icon">🌉</span>
            <span className="tab-label">Bridge Transfer</span>
            <span className="tab-subtitle">Cross-chain transfers</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'arbitrage' ? 'active' : ''}`}
            onClick={() => setActivePanel('arbitrage')}
          >
            <span className="tab-icon">💹</span>
            <span className="tab-label">Cross-Chain Arbitrage</span>
            <span className="tab-subtitle">Profit from spreads</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'transfer' && (
          <div className="panel-wrapper">
            <BridgeTransferPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'arbitrage' && (
          <div className="panel-wrapper">
            <CrossChainArbitragePanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>Bridge Activity History</h2>
          {bridgeHistory.length === 0 ? (
            <div className="empty-history">
              <p>No bridge operations yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {bridgeHistory.map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'transfer' && '🌉'}
                    {action.type === 'arbitrage' && '💹'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'transfer' && 'Bridge Transfer'}
                      {action.type === 'arbitrage' && 'Arbitrage Executed'}
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
        <h3>💡 Cross-Chain Tools</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Bridge Transfer</h4>
            <p>Transfer assets between blockchain networks with minimal slippage. Analyze gas costs and select optimal bridge routes.</p>
          </div>
          <div className="info-card">
            <h4>Cross-Chain Arbitrage</h4>
            <p>Exploit price differences across chains. Buy on low-price chain, sell on high-price chain. All gas costs must be covered.</p>
          </div>
        </div>
      </div>

      {/* Supported Networks */}
      <div className="networks-section">
        <h3>🌐 Supported Networks</h3>
        <div className="networks-grid">
          <div className="network-card">Ethereum (L1)</div>
          <div className="network-card">Polygon</div>
          <div className="network-card">Arbitrum</div>
          <div className="network-card">Optimism</div>
          <div className="network-card">Bitcoin L2</div>
          <div className="network-card">Solana Bridge</div>
          <div className="network-card">Avalanche</div>
        </div>
      </div>
    </div>
  );
};

export default BridgeDashboard;
