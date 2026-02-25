/**
 * GovernanceDashboard.tsx (Week 2 Governance)
 * 
 * Main governance dashboard aggregating all governance panels
 * Real-time proposal tracking, voting overview, parameter monitoring
 */

import React, { useState } from 'react';
import ProposalPanel from './ProposalPanel';
import VotingPanel from './VotingPanel';
import ExecutionPanel from './ExecutionPanel';
import ParameterPanel from './ParameterPanel';
import PermissionPanel from './PermissionPanel';

interface TabConfig {
  id: 'proposals' | 'voting' | 'execution' | 'parameters' | 'permissions';
  label: string;
  icon: string;
  description: string;
}

interface GovernanceDashboardProps {
  userId: string;
  daoName?: string;
  userVotingPower?: number;
  userRoles?: string[];
}

interface DaoStats {
  activeProposals: number;
  totalVotes: number;
  treasury: string;
  totalMembers: number;
}

/**
 * GovernanceDashboard Component
 * Aggregates all governance panels and displays DAO statistics
 */
export const GovernanceDashboard: React.FC<GovernanceDashboardProps> = ({
  userId,
  daoName = 'DAO',
  userVotingPower = 10000,
  userRoles = [],
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<'proposals' | 'voting' | 'execution' | 'parameters' | 'permissions'>(
    'proposals'
  );
  const [showStats, setShowStats] = useState<boolean>(true);

  // DAO Statistics
  const [stats] = useState<DaoStats>({
    activeProposals: 12,
    totalVotes: 450000,
    treasury: '$2.5M',
    totalMembers: 342,
  });

  // Tab configuration
  const tabs: TabConfig[] = [
    {
      id: 'proposals',
      label: 'Proposals',
      icon: '📋',
      description: 'Create and manage DAO proposals',
    },
    {
      id: 'voting',
      label: 'Voting',
      icon: '🗳️',
      description: 'Cast votes on active proposals',
    },
    {
      id: 'execution',
      label: 'Execution',
      icon: '⚙️',
      description: 'Execute passed proposals',
    },
    {
      id: 'parameters',
      label: 'Parameters',
      icon: '⚡',
      description: 'Modify DAO parameters',
    },
    {
      id: 'permissions',
      label: 'Permissions',
      icon: '🔐',
      description: 'Manage roles and access control',
    },
  ];

  // Render active panel based on tab
  const renderActivePanel = () => {
    switch (activeTab) {
      case 'proposals':
        return <ProposalPanel userId={userId} daoName={daoName} />;
      case 'voting':
        return (
          <VotingPanel
            userId={userId}
            userVotingPower={userVotingPower}
            activeProposals={[
              {
                proposalId: 'PROP-001',
                proposalTitle: 'Increase allocation to trading strategies',
                votingPeriodEnd: Date.now() / 1000 + 345600, // 4 days
                currentFor: 125000,
                currentAgainst: 45000,
                currentAbstain: 5000,
              },
              {
                proposalId: 'PROP-002',
                proposalTitle: 'Treasury rebalancing to 40% ETH',
                votingPeriodEnd: Date.now() / 1000 + 259200, // 3 days
                currentFor: 98000,
                currentAgainst: 32000,
                currentAbstain: 8000,
              },
            ]}
          />
        );
      case 'execution':
        return (
          <ExecutionPanel
            userId={userId}
            queuedProposals={[
              {
                proposalId: 'PROP-045',
                title: 'Parameter adjustment passed',
                description: 'Timelocked proposal ready for execution',
                eta: Date.now() / 1000 + 86400,
                executionRisk: 3,
                estimatedGasCost: 0.5,
                executedCount: 0,
              },
            ]}
          />
        );
      case 'parameters':
        return (
          <ParameterPanel
            userId={userId}
            availableParameters={[
              {
                name: 'Voting Quorum',
                currentValue: '35%',
                category: 'governance',
                description: 'Minimum participation required for proposal validity',
                minValue: 10,
                maxValue: 75,
                historicalValues: [
                  { value: '30%', changedAt: 1700000000 },
                  { value: '35%', changedAt: 1700100000 },
                ],
              },
              {
                name: 'Proposal Threshold',
                currentValue: '5000',
                category: 'governance',
                description: 'Minimum tokens required to create a proposal',
                minValue: 0,
                maxValue: 50000,
                historicalValues: [
                  { value: '2500', changedAt: 1700000000 },
                  { value: '5000', changedAt: 1700100000 },
                ],
              },
              {
                name: 'Treasury Rebalance Fee',
                currentValue: '0.1%',
                category: 'economic',
                description: 'Fee automatically applied during treasury rebalancing',
                minValue: 0,
                maxValue: 1,
                historicalValues: [
                  { value: '0.05%', changedAt: 1699900000 },
                  { value: '0.1%', changedAt: 1700000000 },
                ],
              },
              {
                name: 'Emergency Pause Threshold',
                currentValue: '75%',
                category: 'security',
                description: 'Vote percentage needed to pause all contract functions',
                minValue: 50,
                maxValue: 100,
                historicalValues: [
                  { value: '66%', changedAt: 1700000000 },
                  { value: '75%', changedAt: 1700050000 },
                ],
              },
            ]}
          />
        );
      case 'permissions':
        return (
          <PermissionPanel
            userId={userId}
            currentUserRoles={userRoles}
            availableRoles={[
              {
                roleId: 'admin',
                roleName: 'Admin',
                description: 'Full system access and governance control',
                currentMembers: 3,
                maxMembers: 5,
                permissions: [
                  'execute_proposals',
                  'modify_parameters',
                  'manage_treasury',
                  'create_proposals',
                ],
                requiredMultiSigThreshold: 100,
              },
              {
                roleId: 'treasurer',
                roleName: 'Treasurer',
                description: 'Treasury management and rebalancing',
                currentMembers: 2,
                maxMembers: 4,
                permissions: ['manage_treasury', 'create_proposals'],
                requiredMultiSigThreshold: 75,
              },
              {
                roleId: 'governance',
                roleName: 'Governance Lead',
                description: 'Proposal execution and voting oversight',
                currentMembers: 5,
                maxMembers: 10,
                permissions: [
                  'execute_proposals',
                  'create_proposals',
                  'modify_parameters',
                ],
                requiredMultiSigThreshold: 60,
              },
            ]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="governance-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Governance</h1>
          <p className="subtitle">Manage proposals, voting, and DAO parameters</p>
        </div>
        <button
          className="stats-toggle"
          onClick={() => setShowStats(!showStats)}
        >
          {showStats ? '📊 Hide' : '📊 Show'} Stats
        </button>
      </div>

      {/* Statistics Section */}
      {showStats && (
        <div className="governance-stats">
          <div className="stat-card">
            <span className="stat-icon">📋</span>
            <div className="stat-content">
              <span className="stat-label">Active Proposals</span>
              <span className="stat-value">{stats.activeProposals}</span>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">🗳️</span>
            <div className="stat-content">
              <span className="stat-label">Total Votes Cast</span>
              <span className="stat-value">{stats.totalVotes.toLocaleString()}</span>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">💰</span>
            <div className="stat-content">
              <span className="stat-label">Treasury Value</span>
              <span className="stat-value">{stats.treasury}</span>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">👥</span>
            <div className="stat-content">
              <span className="stat-label">Members</span>
              <span className="stat-value">{stats.totalMembers}</span>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⏱️</span>
            <div className="stat-content">
              <span className="stat-label">Your Voting Power</span>
              <span className="stat-value">{userVotingPower.toLocaleString()}</span>
            </div>
          </div>

          {userRoles.length > 0 && (
            <div className="stat-card">
              <span className="stat-icon">🎭</span>
              <div className="stat-content">
                <span className="stat-label">Your Roles</span>
                <span className="stat-value">{userRoles.join(', ')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="governance-tabs">
        <div className="tabs-container">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              title={tab.description}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Panel */}
      <div className="governance-content">
        {renderActivePanel()}
      </div>

      {/* Footer */}
      <div className="governance-footer">
        <div className="footer-note">
          💡 All changes are previewed before submission. Review risks carefully before confirming.
        </div>
      </div>
    </div>
  );
};

export default GovernanceDashboard;
