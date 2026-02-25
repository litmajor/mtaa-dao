/**
 * MicroTransactionsDashboard.tsx
 * Micro-Transactions & Micro-Finance Dashboard
 * 
 * Wires all 4 Micro simulators:
 * - MICRO_WITHDRAWAL
 * - TIP_DONATION
 * - MICRO_LOAN
 * - SAVINGS_CHALLENGE
 */

import React, { useState } from 'react';
import { MicroWithdrawalPanel } from './MicroWithdrawalPanel';
import { TipDonationPanel } from './TipDonationPanel';
import { MicroLoanPanel } from './MicroLoanPanel';
import { SavingsChallengePanel } from './SavingsChallengePanel';

interface MicroTransactionsDashboardProps {
  userId: string;
  daoName?: string;
}

export const MicroTransactionsDashboard: React.FC<MicroTransactionsDashboardProps> = ({
  userId,
  daoName = 'My DAO',
}) => {
  const [activePanel, setActivePanel] = useState<'withdrawal' | 'tip' | 'loan' | 'savings'>('withdrawal');
  const [microHistory, setMicroHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Micro state
  const [microState] = useState({
    totalMicroFlow: 650000,
    activeUsers: 12500,
    activeLoanPositions: 3480,
    activeChallengers: 2156,
  });

  const handleSimulationComplete = (result: any) => {
    const action = {
      id: `micro_action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      details: result,
    };
    setMicroHistory([action, ...microHistory]);
  };

  return (
    <div className="micro-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Micro-Transactions & Finance</h1>
          <p className="subtitle">Sub-$100 transactions, tips, micro-loans, and savings challenges</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Micro-Flow</span>
            <span className="stat-value">
              ${microState.totalMicroFlow.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Users</span>
            <span className="stat-value">
              {microState.activeUsers.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Micro-Loans Active</span>
            <span className="stat-value">{microState.activeLoanPositions.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Challengers</span>
            <span className="stat-value">{microState.activeChallengers.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Micro-Finance Tools</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'withdrawal' ? 'active' : ''}`}
            onClick={() => setActivePanel('withdrawal')}
          >
            <span className="tab-icon">💸</span>
            <span className="tab-label">Micro-Withdrawal</span>
            <span className="tab-subtitle">Small withdrawals</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'tip' ? 'active' : ''}`}
            onClick={() => setActivePanel('tip')}
          >
            <span className="tab-icon">🎁</span>
            <span className="tab-label">Tip & Donation</span>
            <span className="tab-subtitle">Creator support</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'loan' ? 'active' : ''}`}
            onClick={() => setActivePanel('loan')}
          >
            <span className="tab-icon">💳</span>
            <span className="tab-label">Micro-Loan</span>
            <span className="tab-subtitle">Quick financing</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'savings' ? 'active' : ''}`}
            onClick={() => setActivePanel('savings')}
          >
            <span className="tab-icon">🎯</span>
            <span className="tab-label">Savings Challenge</span>
            <span className="tab-subtitle">Gamified saving</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'withdrawal' && (
          <div className="panel-wrapper">
            <MicroWithdrawalPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'tip' && (
          <div className="panel-wrapper">
            <TipDonationPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'loan' && (
          <div className="panel-wrapper">
            <MicroLoanPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'savings' && (
          <div className="panel-wrapper">
            <SavingsChallengePanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>Micro-Transaction History</h2>
          {microHistory.length === 0 ? (
            <div className="empty-history">
              <p>No micro-transactions yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {microHistory.map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'withdrawal' && '💸'}
                    {action.type === 'tip' && '🎁'}
                    {action.type === 'loan' && '💳'}
                    {action.type === 'savings' && '🎯'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'withdrawal' && 'Micro-Withdrawal Processed'}
                      {action.type === 'tip' && 'Tip Sent'}
                      {action.type === 'loan' && 'Micro-Loan Disbursed'}
                      {action.type === 'savings' && 'Challenge Contribution'}
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
        <h3>💡 Micro-Finance Tools</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Micro-Withdrawals</h4>
            <p>Sub-$100 withdrawals optimized for minimal gas fees. Batching support for multiple small withdrawals in one transaction.</p>
          </div>
          <div className="info-card">
            <h4>Tip & Donation Streaming</h4>
            <p>Support creators with tips starting from $1.00. Direct payouts or accumulated to minimum threshold. Recurrent support options.</p>
          </div>
          <div className="info-card">
            <h4>Micro-Loans</h4>
            <p>Quick loans under $100 with flexible repayment terms. Instant approval for good-standing accounts. Daily/weekly repayment options.</p>
          </div>
          <div className="info-card">
            <h4>Savings Challenges</h4>
            <p>Gamified saving with leaderboards, streak bonuses, and milestone rewards. Friend challenges and collaborative goals supported.</p>
          </div>
        </div>
      </div>

      {/* Creator Spotlight */}
      <div className="creator-spotlight">
        <h3>🌟 Top Creators Receiving Tips</h3>
        <div className="creator-grid">
          <div className="creator-card">
            <span className="creator-rank">1</span>
            <h4>CreatorOne</h4>
            <p>$4,250 tips this month</p>
            <span className="badge">Popular</span>
          </div>
          <div className="creator-card">
            <span className="creator-rank">2</span>
            <h4>ArtisticMind</h4>
            <p>$3,125 tips this month</p>
            <span className="badge">Rising Star</span>
          </div>
          <div className="creator-card">
            <span className="creator-rank">3</span>
            <h4>DesignPro</h4>
            <p>$2,890 tips this month</p>
            <span className="badge">Verified</span>
          </div>
          <div className="creator-card">
            <span className="creator-rank">4</span>
            <h4>MusicGenius</h4>
            <p>$2,456 tips this month</p>
            <span className="badge">Trending</span>
          </div>
        </div>
      </div>

      {/* Savings Challenge Leaderboard */}
      <div className="challenges-section">
        <h3>🏆 Active Savings Challenges</h3>
        <div className="challenges-grid">
          <div className="challenge-card">
            <h4>Weekly Warrior</h4>
            <p>Save $50 in 7 days</p>
            <span className="participants">1,254 joined</span>
          </div>
          <div className="challenge-card">
            <h4>Monthly Marathon</h4>
            <p>Save $200 in 30 days</p>
            <span className="participants">856 joined</span>
          </div>
          <div className="challenge-card">
            <h4>Quarterly Quest</h4>
            <p>Save $750 in 90 days</p>
            <span className="participants">432 joined</span>
          </div>
          <div className="challenge-card">
            <h4>Year-Round Champion</h4>
            <p>Save $2,500 in 365 days</p>
            <span className="participants">178 joined</span>
          </div>
        </div>
      </div>

      {/* Micro-Finance Statistics */}
      <div className="stats-section">
        <h3>📊 Micro-Finance Insights</h3>
        <div className="stats-grid">
          <div className="stats-card">
            <span className="stat-icon">💰</span>
            <h4>Avg Withdrawal</h4>
            <p>${(microState.totalMicroFlow / (microState.activeUsers * 2)).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="stats-card">
            <span className="stat-icon">📈</span>
            <h4>Avg Tip Amount</h4>
            <p>$3.50</p>
          </div>
          <div className="stats-card">
            <span className="stat-icon">⏱️</span>
            <h4>Avg Loan Term</h4>
            <p>14 days</p>
          </div>
          <div className="stats-card">
            <span className="stat-icon">✅</span>
            <h4>Challenge Completion</h4>
            <p>73% success rate</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MicroTransactionsDashboard;
