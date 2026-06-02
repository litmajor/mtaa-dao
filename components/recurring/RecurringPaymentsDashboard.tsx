/**
 * RecurringPaymentsDashboard.tsx
 * Recurring Payments & Subscriptions Dashboard
 * 
 * Wires all 3 Recurring simulators:
 * - SUBSCRIPTION
 * - INSTALLMENT
 * - PAYMENT_AUTOMATION
 */

import React, { useState } from 'react';
import { SubscriptionPanel } from './SubscriptionPanel';
import { InstallmentPanel } from './InstallmentPanel';
import { PaymentAutomationPanel } from './PaymentAutomationPanel';
import { useActionHistoryStore } from '../../stores/actionHistory';

interface RecurringPaymentsDashboardProps {
  userId: string;
  daoName?: string;
}

export const RecurringPaymentsDashboard: React.FC<RecurringPaymentsDashboardProps> = ({
  userId,
  daoName = 'My DAO',
}) => {
  const [activePanel, setActivePanel] = useState<'subscription' | 'installment' | 'automation'>('subscription');
  const recurringHistory = useActionHistoryStore((s) => s.actionHistory);
  const pushAction = useActionHistoryStore((s) => s.pushAction);
  const [showHistory, setShowHistory] = useState(false);

  // Recurring state
  const [recurringState] = useState({
    totalRecurring: 350000,
    activeSubscriptions: 45,
    totalInstallments: 78,
    automationRate: 89.5,
  });

  const handleSimulationComplete = (result: any) => {
    const action = {
      id: `recurring_action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      details: result,
    };
    pushAction(action);
  };

  return (
    <div className="recurring-payments-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Recurring Payments</h1>
          <p className="subtitle">Manage subscriptions, installments, and automated payments</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Monthly Recurring</span>
            <span className="stat-value">
              ${recurringState.totalRecurring.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Subscriptions</span>
            <span className="stat-value">{recurringState.activeSubscriptions}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Installment Plans</span>
            <span className="stat-value">{recurringState.totalInstallments}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Automation Rate</span>
            <span className="stat-value">{recurringState.automationRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Recurring Payment Tools</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'subscription' ? 'active' : ''}`}
            onClick={() => setActivePanel('subscription')}
          >
            <span className="tab-icon">🔄</span>
            <span className="tab-label">Subscription</span>
            <span className="tab-subtitle">Manage recurring plans</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'installment' ? 'active' : ''}`}
            onClick={() => setActivePanel('installment')}
          >
            <span className="tab-icon">📅</span>
            <span className="tab-label">Installment</span>
            <span className="tab-subtitle">Set payment schedules</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'automation' ? 'active' : ''}`}
            onClick={() => setActivePanel('automation')}
          >
            <span className="tab-icon">🤖</span>
            <span className="tab-label">Payment Automation</span>
            <span className="tab-subtitle">Automated execution</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'subscription' && (
          <div className="panel-wrapper">
            <SubscriptionPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'installment' && (
          <div className="panel-wrapper">
            <InstallmentPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'automation' && (
          <div className="panel-wrapper">
            <PaymentAutomationPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>Payment History</h2>
          {recurringHistory.length === 0 ? (
            <div className="empty-history">
              <p>No payment operations yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {recurringHistory.map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'subscription' && '🔄'}
                    {action.type === 'installment' && '📅'}
                    {action.type === 'automation' && '🤖'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'subscription' && 'Subscription Configured'}
                      {action.type === 'installment' && 'Installment Plan Created'}
                      {action.type === 'automation' && 'Payment Automated'}
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
        <h3>💡 Recurring Payment Tools</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Subscription Management</h4>
            <p>Create recurring revenue streams with flexible billing cycles. Manage tier levels, cancellation policies, and customer retention.</p>
          </div>
          <div className="info-card">
            <h4>Installment Plans</h4>
            <p>Break large payments into smaller chunks across time. Perfect for big purchases with financing terms and interest accrual.</p>
          </div>
          <div className="info-card">
            <h4>Payment Automation</h4>
            <p>Automatically charge on-chain wallets using approved spending limits. Reduce churn with smart retry logic. Override control available.</p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="stats-section">
        <h3>📊 Recurring Payment Insights</h3>
        <div className="stats-grid">
          <div className="stats-card">
            <span className="stat-icon">💳</span>
            <h4>Avg Subscription Value</h4>
            <p>${(recurringState.totalRecurring / recurringState.activeSubscriptions).toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo</p>
          </div>
          <div className="stats-card">
            <span className="stat-icon">⏱️</span>
            <h4>Installment Duration</h4>
            <p>12 months average</p>
          </div>
          <div className="stats-card">
            <span className="stat-icon">✅</span>
            <h4>Success Rate</h4>
            <p>94.2% first attempt</p>
          </div>
          <div className="stats-card">
            <span className="stat-icon">📉</span>
            <h4>Churn Rate</h4>
            <p>3.5% monthly</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecurringPaymentsDashboard;
