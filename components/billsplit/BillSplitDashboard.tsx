/**
 * BillSplitDashboard.tsx
 * Group Expense & Bill Split Management Dashboard
 * 
 * Wires all 3 Bill Split simulators:
 * - BILL_SPLIT
 * - EXPENSE_REIMBURSEMENT
 * - GROUP_SETTLEMENT
 */

import React, { useState } from 'react';
import { BillSplitPanel } from './BillSplitPanel';
import { ExpenseReimbursementPanel } from './ExpenseReimbursementPanel';
import { GroupSettlementPanel } from './GroupSettlementPanel';

interface BillSplitDashboardProps {
  userId: string;
  daoName?: string;
}

export const BillSplitDashboard: React.FC<BillSplitDashboardProps> = ({
  userId,
  daoName = 'My DAO',
}) => {
  const [activePanel, setActivePanel] = useState<'split' | 'reimbursement' | 'settlement'>('split');
  const [billSplitHistory, setBillSplitHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Bill split state
  const [billSplitState] = useState({
    totalPending: 45000,
    activeGroups: 12,
    activeSettlements: 34,
    avgGroupSize: 6.8,
  });

  const handleSimulationComplete = (result: any) => {
    const action = {
      id: `billsplit_action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      details: result,
    };
    setBillSplitHistory([action, ...billSplitHistory]);
  };

  return (
    <div className="billsplit-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Group Expenses</h1>
          <p className="subtitle">Fair bill splitting, expense tracking, and group settlements</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Pending Settlements</span>
            <span className="stat-value">
              ${billSplitState.totalPending.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Groups</span>
            <span className="stat-value">{billSplitState.activeGroups}</span>
          </div>
          <div className="stat">
            <span className="stat-label">In Settlement</span>
            <span className="stat-value">{billSplitState.activeSettlements}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg Group Size</span>
            <span className="stat-value">{billSplitState.avgGroupSize.toFixed(1)} people</span>
          </div>
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Expense Management</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'split' ? 'active' : ''}`}
            onClick={() => setActivePanel('split')}
          >
            <span className="tab-icon">🧮</span>
            <span className="tab-label">Bill Split</span>
            <span className="tab-subtitle">Calculate fair shares</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'reimbursement' ? 'active' : ''}`}
            onClick={() => setActivePanel('reimbursement')}
          >
            <span className="tab-icon">💳</span>
            <span className="tab-label">Expense Reimbursement</span>
            <span className="tab-subtitle">Track who paid</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'settlement' ? 'active' : ''}`}
            onClick={() => setActivePanel('settlement')}
          >
            <span className="tab-icon">🤝</span>
            <span className="tab-label">Group Settlement</span>
            <span className="tab-subtitle">Optimal payment graph</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'split' && (
          <div className="panel-wrapper">
            <BillSplitPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'reimbursement' && (
          <div className="panel-wrapper">
            <ExpenseReimbursementPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'settlement' && (
          <div className="panel-wrapper">
            <GroupSettlementPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>Settlement History</h2>
          {billSplitHistory.length === 0 ? (
            <div className="empty-history">
              <p>No expense operations yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {billSplitHistory.map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'split' && '🧮'}
                    {action.type === 'reimbursement' && '💳'}
                    {action.type === 'settlement' && '🤝'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'split' && 'Bill Split Calculated'}
                      {action.type === 'reimbursement' && 'Reimbursement Tracked'}
                      {action.type === 'settlement' && 'Settlement Optimized'}
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
        <h3>💡 Expense Management Tools</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Fair Bill Splitting</h4>
            <p>Split expenses equally, by percentage, or by itemized amounts. Support unequal splits with adjustment factors for special cases.</p>
          </div>
          <div className="info-card">
            <h4>Expense Reimbursement</h4>
            <p>Track who paid for what. Calculate net balances across the group automatically accounting for multiple expenses.</p>
          </div>
          <div className="info-card">
            <h4>Optimal Settlement</h4>
            <p>Minimize transaction count using payment graph optimization. One person might settle multiple debts through a single intermediary.</p>
          </div>
        </div>
      </div>

      {/* Settlement Insights */}
      <div className="insights-section">
        <h3>📊 Settlement Insights</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <span className="icon">💰</span>
            <h4>Avg Expense</h4>
            <p>${(billSplitState.totalPending / billSplitState.activeSettlements).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="insight-card">
            <span className="icon">⏱️</span>
            <h4>Avg Settlement Time</h4>
            <p>3.2 days</p>
          </div>
          <div className="insight-card">
            <span className="icon">📉</span>
            <h4>Avg Transactions/Group</h4>
            <p>2.4 (optimized)</p>
          </div>
          <div className="insight-card">
            <span className="icon">✅</span>
            <h4>Disputes Rate</h4>
            <p>0.8%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillSplitDashboard;
