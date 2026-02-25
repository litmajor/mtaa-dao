/**
 * BountiesDashboard.tsx
 * Bounty Program Management Dashboard
 * 
 * Wires all 3 Bounties simulators:
 * - BOUNTY_PROGRAM
 * - REWARD_DISTRIBUTION
 * - BOUNTY_COMPLETION
 */

import React, { useState } from 'react';
import { BountyProgramPanel } from './BountyProgramPanel';
import { RewardDistributionPanel } from './RewardDistributionPanel';
import { BountyCompletionPanel } from './BountyCompletionPanel';

interface BountiesDashboardProps {
  userId: string;
  daoName?: string;
}

export const BountiesDashboard: React.FC<BountiesDashboardProps> = ({
  userId,
  daoName = 'My DAO',
}) => {
  const [activePanel, setActivePanel] = useState<'program' | 'distribution' | 'completion'>('program');
  const [bountiesHistory, setBountiesHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Bounties state
  const [bountiesState] = useState({
    totalBountyBudget: 500000,
    activeBounties: 28,
    completedBounties: 156,
    completionRate: 94.8,
  });

  const handleSimulationComplete = (result: any) => {
    const action = {
      id: `bounty_action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      details: result,
    };
    setBountiesHistory([action, ...bountiesHistory]);
  };

  return (
    <div className="bounties-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Bounty Programs</h1>
          <p className="subtitle">Create programs, distribute rewards, verify completion</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Budget</span>
            <span className="stat-value">
              ${bountiesState.totalBountyBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Bounties</span>
            <span className="stat-value">{bountiesState.activeBounties}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{bountiesState.completedBounties}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Completion Rate</span>
            <span className="stat-value">{bountiesState.completionRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Bounty Management</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'program' ? 'active' : ''}`}
            onClick={() => setActivePanel('program')}
          >
            <span className="tab-icon">🎯</span>
            <span className="tab-label">Bounty Program</span>
            <span className="tab-subtitle">Create new programs</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'distribution' ? 'active' : ''}`}
            onClick={() => setActivePanel('distribution')}
          >
            <span className="tab-icon">💰</span>
            <span className="tab-label">Reward Distribution</span>
            <span className="tab-subtitle">Tiered payouts</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'completion' ? 'active' : ''}`}
            onClick={() => setActivePanel('completion')}
          >
            <span className="tab-icon">✅</span>
            <span className="tab-label">Completion Verification</span>
            <span className="tab-subtitle">Verify and approve</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'program' && (
          <div className="panel-wrapper">
            <BountyProgramPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'distribution' && (
          <div className="panel-wrapper">
            <RewardDistributionPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'completion' && (
          <div className="panel-wrapper">
            <BountyCompletionPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>Bounty Activity History</h2>
          {bountiesHistory.length === 0 ? (
            <div className="empty-history">
              <p>No bounty operations yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {bountiesHistory.map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'program' && '🎯'}
                    {action.type === 'distribution' && '💰'}
                    {action.type === 'completion' && '✅'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'program' && 'Program Created'}
                      {action.type === 'distribution' && 'Rewards Distributed'}
                      {action.type === 'completion' && 'Completion Verified'}
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
        <h3>💡 Bounty Program Management</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Program Setup</h4>
            <p>Create bounty programs with clear objectives, success criteria, and reward tiers. Set review periods and approval workflows.</p>
          </div>
          <div className="info-card">
            <h4>Reward Distribution</h4>
            <p>Distribute payments based on tier levels. Support proportional splits, fixed amounts, or performance bonuses. Automatic treasury deductions.</p>
          </div>
          <div className="info-card">
            <h4>Quality Verification</h4>
            <p>Review submissions against acceptance criteria. Approve or request revisions. Track dispute resolution with arbitration queue.</p>
          </div>
        </div>
      </div>

      {/* Bounty Categories */}
      <div className="categories-section">
        <h3>📂 Popular Bounty Categories</h3>
        <div className="categories-grid">
          <div className="category-card">Bug Reported (10/15)</div>
          <div className="category-card">Feature Dev (5/8)</div>
          <div className="category-card">Content (12/20)</div>
          <div className="category-card">Security Audit (1/3)</div>
          <div className="category-card">UX Review (3/5)</div>
          <div className="category-card">Translation (8/10)</div>
        </div>
      </div>
    </div>
  );
};

export default BountiesDashboard;
