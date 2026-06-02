/**
 * EscrowDashboard.tsx
 * Escrow & Settlement Management Dashboard
 * 
 * Wires all 4 Escrow simulators:
 * - ESCROW_RELEASE
 * - DISPUTE_RESOLUTION
 * - SETTLEMENT_FINALITY
 * - ESCROW_RECOVERY (⭐ 30-day auto-recovery window)
 */

import React, { useState } from 'react';
import { useActionHistoryStore } from '../../stores/actionHistory';
import { EscrowReleasePanel } from './EscrowReleasePanel';
import { DisputeResolutionPanel } from './DisputeResolutionPanel';
import { SettlementFinalityPanel } from './SettlementFinalityPanel';
import { EscrowRecoveryPanel } from './EscrowRecoveryPanel';

interface EscrowDashboardProps {
  userId: string;
  daoName?: string;
}

export const EscrowDashboard: React.FC<EscrowDashboardProps> = ({
  userId,
  daoName = 'My DAO',
}) => {
  const [activePanel, setActivePanel] = useState<'release' | 'dispute' | 'finality' | 'recovery'>('release');
  const escrowHistory = useActionHistoryStore((s) => s.actionHistory);
  const pushAction = useActionHistoryStore((s) => s.pushAction);
  const [showHistory, setShowHistory] = useState(false);

  // Escrow state
  const [escrowState] = useState({
    totalEscrow: 250000,
    activeEscrows: 12,
    disputesPending: 2,
    recoveryActive: 3,
  });

  const handleSimulationComplete = (result: any) => {
    const action = {
      id: `escrow_action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      details: result,
    };
    pushAction(action);
  };

  return (
    <div className="escrow-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Escrow & Settlements</h1>
          <p className="subtitle">Manage releases, disputes, finality, and 30-day recovery windows</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Escrowed</span>
            <span className="stat-value">
              ${escrowState.totalEscrow.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Escrows</span>
            <span className="stat-value">{escrowState.activeEscrows}</span>
          </div>
          <div className="stat">
            <span className="stat-label">⚠️ Disputes Pending</span>
            <span className="stat-value alert">{escrowState.disputesPending}</span>
          </div>
          <div className="stat">
            <span className="stat-label">🕐 In Recovery</span>
            <span className="stat-value warning">{escrowState.recoveryActive}</span>
          </div>
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Escrow Tools</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'release' ? 'active' : ''}`}
            onClick={() => setActivePanel('release')}
          >
            <span className="tab-icon">✅</span>
            <span className="tab-label">Release</span>
            <span className="tab-subtitle">Execute fund release</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'dispute' ? 'active' : ''}`}
            onClick={() => setActivePanel('dispute')}
          >
            <span className="tab-icon">⚖️</span>
            <span className="tab-label">Dispute Resolution</span>
            <span className="tab-subtitle">Settle claims</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'finality' ? 'active' : ''}`}
            onClick={() => setActivePanel('finality')}
          >
            <span className="tab-icon">🔗</span>
            <span className="tab-label">Settlement Finality</span>
            <span className="tab-subtitle">Confirm transactions</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'recovery' ? 'active' : ''}`}
            onClick={() => setActivePanel('recovery')}
          >
            <span className="tab-icon">🕐</span>
            <span className="tab-label">Recovery (30-day)</span>
            <span className="tab-subtitle">Auto-recovery management</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'release' && (
          <div className="panel-wrapper">
            <EscrowReleasePanel
              userId={userId}
              escrowId="default"
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'dispute' && (
          <div className="panel-wrapper">
            <DisputeResolutionPanel
              userId={userId}
              disputeId="default"
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'finality' && (
          <div className="panel-wrapper">
            <SettlementFinalityPanel
              userId={userId}
              settlementId="default"
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'recovery' && (
          <div className="panel-wrapper">
            <EscrowRecoveryPanel
              userId={userId}
              escrowId="default"
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>Escrow Action History</h2>
          {escrowHistory.length === 0 ? (
            <div className="empty-history">
              <p>No escrow actions yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {escrowHistory.map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'release' && '✅'}
                    {action.type === 'dispute' && '⚖️'}
                    {action.type === 'finality' && '🔗'}
                    {action.type === 'recovery' && '🕐'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'release' && 'Escrow Released'}
                      {action.type === 'dispute' && 'Dispute Resolved'}
                      {action.type === 'finality' && 'Settlement Finalized'}
                      {action.type === 'recovery' && 'Recovery Processed'}
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
        <h3>💡 Escrow Management Tools</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Release</h4>
            <p>Execute escrow fund releases when conditions are met. Analyze buyer approval status and milestone completion.</p>
          </div>
          <div className="info-card">
            <h4>Dispute Resolution</h4>
            <p>Resolve disputes through negotiation, mediation, arbitration, or court proceedings. Analyze claim outcomes based on evidence strength.</p>
          </div>
          <div className="info-card">
            <h4>Settlement Finality</h4>
            <p>Evaluate settlement confirmation across blockchain networks. Compare immediate, probabilistic, economic, and legal finality types.</p>
          </div>
          <div className="info-card">
            <h4>⭐ 30-Day Recovery</h4>
            <p>Automatic fund recovery after 30 days of inactivity. Manage dispute windows, priority claims, and auto-recovery triggers.</p>
          </div>
        </div>
      </div>

      {/* Warning Section */}
      <div className="warning-section">
        <h4>⏱️ 30-Day Recovery Window</h4>
        <ul>
          <li>Days 1-29: Disputes/appeals can be filed</li>
          <li>Day 30: Automatic recovery triggers if unresolved</li>
          <li>Claims have priority over timeout recovery</li>
        </ul>
      </div>
    </div>
  );
};

export default EscrowDashboard;
