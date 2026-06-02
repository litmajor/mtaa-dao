/**
 * ReferralDashboard.tsx
 * Referral Program Management Dashboard
 * 
 * Wires all 4 Referral simulators:
 * - REFERRAL_GENERATION
 * - REFERRAL_REWARDS
 * - REFERRAL_TIER
 * - REFERRAL_FRAUD_DETECTION
 * 
 * ⭐ SPECIAL EMPHASIS: Fraud Detection with automatic holds and red warnings
 */

import React, { useState } from 'react';
import { useActionHistoryStore } from '../../stores/actionHistory';
import { ReferralGenerationPanel } from './ReferralGenerationPanel';
import { ReferralRewardsPanel } from './ReferralRewardsPanel';
import { ReferralTierAdvancementPanel } from './ReferralTierAdvancementPanel';
import { ReferralFraudDetectionPanel } from './ReferralFraudDetectionPanel';

interface ReferralDashboardProps {
  userId: string;
  daoName?: string;
}

export const ReferralDashboard: React.FC<ReferralDashboardProps> = ({
  userId,
  daoName = 'My DAO',
}) => {
  const [activePanel, setActivePanel] = useState<'generation' | 'rewards' | 'tier' | 'fraud'>('generation');
  const referralHistory = useActionHistoryStore((s) => s.actionHistory);
  const pushAction = useActionHistoryStore((s) => s.pushAction);
  const [showHistory, setShowHistory] = useState(false);

  // Referral state
  const [referralState] = useState({
    totalReferrals: 3456,
    activeReferrers: 892,
    fraudFlags: 7,
    fundsOnHold: 125000,
  });

  const handleSimulationComplete = (result: any) => {
    const action = {
      id: `referral_action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      details: result,
    };
    pushAction(action);
  };

  return (
    <div className="referral-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Referral Program</h1>
          <p className="subtitle">Manage referrals, rewards, tiers, and fraud detection</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Referrals</span>
            <span className="stat-value">
              {referralState.totalReferrals.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Referrers</span>
            <span className="stat-value">{referralState.activeReferrers}</span>
          </div>
          <div className="stat">
            <span className="stat-label">⚠️ Fraud Flags</span>
            <span className={`stat-value ${referralState.fraudFlags > 0 ? 'fraud-active' : 'fraud-safe'}`}>
              {referralState.fraudFlags}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Under Review</span>
            <span className={`stat-value ${referralState.fundsOnHold > 0 ? 'hold-active' : 'hold-safe'}`}>
              ${(referralState.fundsOnHold / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}K
            </span>
          </div>
        </div>
      </div>

      {/* ⭐ FRAUD ALERT SECTION */}
      {referralState.fraudFlags > 0 && (
        <div className="fraud-warning-section">
          <div className="fraud-alert">
            <span className="alert-icon">🚨</span>
            <div className="alert-content">
              <h3>Active Fraud Alerts</h3>
              <p>
                {referralState.fraudFlags} suspicious referral pattern{referralState.fraudFlags !== 1 ? 's' : ''} detected.
                Funds on hold: ${(referralState.fundsOnHold / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}K
              </p>
              <ul className="fraud-reasons">
                <li>Suspicious click patterns detected - potential bot activity</li>
                <li>Geographic anomalies - referrals from multiple countries in seconds</li>
                <li>Account creation spike - 50+ accounts from single IP</li>
              </ul>
            </div>
            <div className="alert-actions">
              <button className="btn-investigate">Investigate Now</button>
              <button className="btn-override">Override Hold</button>
            </div>
          </div>
        </div>
      )}

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Referral Management</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'generation' ? 'active' : ''}`}
            onClick={() => setActivePanel('generation')}
          >
            <span className="tab-icon">🔗</span>
            <span className="tab-label">Campaign</span>
            <span className="tab-subtitle">Create campaigns</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'rewards' ? 'active' : ''}`}
            onClick={() => setActivePanel('rewards')}
          >
            <span className="tab-icon">💰</span>
            <span className="tab-label">Rewards</span>
            <span className="tab-subtitle">Payout structure</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'tier' ? 'active' : ''}`}
            onClick={() => setActivePanel('tier')}
          >
            <span className="tab-icon">⬆️</span>
            <span className="tab-label">Tier System</span>
            <span className="tab-subtitle">Advancement logic</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'fraud' ? 'active' : ''} ${referralState.fraudFlags > 0 ? 'fraud-alert-tab' : ''}`}
            onClick={() => setActivePanel('fraud')}
          >
            <span className="tab-icon">⚠️</span>
            <span className="tab-label">Fraud Detection</span>
            <span className="tab-subtitle">Monitor threats</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'generation' && (
          <div className="panel-wrapper">
            <ReferralGenerationPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'rewards' && (
          <div className="panel-wrapper">
            <ReferralRewardsPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'tier' && (
          <div className="panel-wrapper">
            <ReferralTierAdvancementPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'fraud' && (
          <div className="panel-wrapper">
            <ReferralFraudDetectionPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>Referral Activity History</h2>
          {referralHistory.length === 0 ? (
            <div className="empty-history">
              <p>No referral operations yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {referralHistory.map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'generation' && '🔗'}
                    {action.type === 'rewards' && '💰'}
                    {action.type === 'tier' && '⬆️'}
                    {action.type === 'fraud' && '⚠️'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'generation' && 'Campaign Generated'}
                      {action.type === 'rewards' && 'Rewards Distributed'}
                      {action.type === 'tier' && 'Tier Advanced'}
                      {action.type === 'fraud' && 'Fraud Alert Triggered'}
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
        <h3>💡 Referral Program Tools</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Campaign Management</h4>
            <p>Create referral campaigns with customizable incentives. Track link generation, click-through rates, and conversion metrics.</p>
          </div>
          <div className="info-card">
            <h4>Reward Structure</h4>
            <p>Define payout tiers: referring user gets X%, referred user gets Y%, DAO keeps Z%. Automatic settlement with treasury integration.</p>
          </div>
          <div className="info-card">
            <h4>Tier Advancement</h4>
            <p>Automatic tier progression based on referral count. Higher tiers unlock better commission rates and exclusive perks.</p>
          </div>
          <div className="info-card">
            <h4>⚠️ Fraud Detection System</h4>
            <p>AI-powered detection of suspicious patterns: bot referrals, click farms, geographic anomalies. Automatic fund holds and manual override capability.</p>
          </div>
        </div>
      </div>

      {/* Tier Structure */}
      <div className="tier-structure">
        <h3>🏆 Referral Tier Structure</h3>
        <div className="tiers-grid">
          <div className="tier-card">
            <h4>Bronze</h4>
            <p>0-10 referrals</p>
            <span className="commission">5% commission</span>
          </div>
          <div className="tier-card">
            <h4>Silver</h4>
            <p>11-50 referrals</p>
            <span className="commission">7.5% commission</span>
          </div>
          <div className="tier-card">
            <h4>Gold</h4>
            <p>51-200 referrals</p>
            <span className="commission">10% commission</span>
          </div>
          <div className="tier-card">
            <h4>Platinum</h4>
            <p>200+ referrals</p>
            <span className="commission">12.5% commission</span>
          </div>
        </div>
      </div>

      {/* Fraud Detection Indicators */}
      <div className="fraud-indicators">
        <h3>🔍 Fraud Detection Indicators</h3>
        <div className="indicators-list">
          <div className="indicator">
            <span className="indicator-icon">🤖</span>
            <div className="indicator-text">
              <h4>Bot Detection</h4>
              <p>Identifies automated clicking patterns and bot-like behavior</p>
            </div>
          </div>
          <div className="indicator">
            <span className="indicator-icon">🗺️</span>
            <div className="indicator-text">
              <h4>Geographic Analysis</h4>
              <p>Flags impossible referral patterns across distant locations</p>
            </div>
          </div>
          <div className="indicator">
            <span className="indicator-icon">⏱️</span>
            <div className="indicator-text">
              <h4>Temporal Anomalies</h4>
              <p>Detects abnormal timing patterns in referral activity</p>
            </div>
          </div>
          <div className="indicator">
            <span className="indicator-icon">🔗</span>
            <div className="indicator-text">
              <h4>Network Analysis</h4>
              <p>Identifies suspicious interconnections between accounts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralDashboard;
