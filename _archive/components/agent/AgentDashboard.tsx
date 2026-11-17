/**
 * AgentDashboard.tsx (Week 2 Agent)
 * 
 * Main agent dashboard aggregating all agent management panels
 * Deploy, monitor, and manage autonomous agents
 */

import React, { useState } from 'react';
import AgentDeploymentPanel from './AgentDeploymentPanel';
import MultiAgentPanel from './MultiAgentPanel';

interface TabConfig {
  id: 'deployment' | 'fleet';
  label: string;
  icon: string;
  description: string;
}

interface AgentDashboardProps {
  userId: string;
  daoName?: string;
}

interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  totalCapital: string;
  totalValue: string;
  monthlyROI: number;
}

/**
 * AgentDashboard Component
 * Main interface for agent deployment and fleet management
 */
export const AgentDashboard: React.FC<AgentDashboardProps> = ({
  userId,
  daoName = 'DAO',
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<'deployment' | 'fleet'>('deployment');
  const [showStats, setShowStats] = useState<boolean>(true);

  // Agent Statistics
  const [stats] = useState<AgentStats>({
    totalAgents: 8,
    activeAgents: 6,
    totalCapital: '$500K',
    totalValue: '$562.5K',
    monthlyROI: 12.5,
  });

  // Tab configuration
  const tabs: TabConfig[] = [
    {
      id: 'deployment',
      label: 'Deployment',
      icon: '🚀',
      description: 'Deploy new autonomous agents',
    },
    {
      id: 'fleet',
      label: 'Fleet',
      icon: '🪂',
      description: 'Manage agent fleet and operations',
    },
  ];

  // Mock deployed agents for demonstration
  const mockDeployedAgents = [
    {
      agentId: 'agent-001',
      name: 'TradingBot-Alpha',
      status: 'running' as const,
      allocatedCapital: 50000,
      currentValue: 56250,
      monthlyPnL: 3125,
      lastExecuted: Date.now() - 3600000,
      successRate: 0.92,
    },
    {
      agentId: 'agent-002',
      name: 'ArbitrageBot',
      status: 'running' as const,
      allocatedCapital: 75000,
      currentValue: 84375,
      monthlyPnL: 5625,
      lastExecuted: Date.now() - 1800000,
      successRate: 0.88,
    },
    {
      agentId: 'agent-003',
      name: 'LiquidityBot',
      status: 'paused' as const,
      allocatedCapital: 100000,
      currentValue: 106250,
      monthlyPnL: 3125,
      lastExecuted: Date.now() - 86400000,
      successRate: 0.85,
    },
    {
      agentId: 'agent-004',
      name: 'RebalanceBot',
      status: 'running' as const,
      allocatedCapital: 125000,
      currentValue: 128750,
      monthlyPnL: 1875,
      lastExecuted: Date.now() - 7200000,
      successRate: 0.95,
    },
    {
      agentId: 'agent-005',
      name: 'VaultBot',
      status: 'running' as const,
      allocatedCapital: 80000,
      currentValue: 84000,
      monthlyPnL: 2000,
      lastExecuted: Date.now() - 5400000,
      successRate: 0.91,
    },
    {
      agentId: 'agent-006',
      name: 'YieldBot',
      status: 'error' as const,
      allocatedCapital: 70000,
      currentValue: 67900,
      monthlyPnL: -1050,
      lastExecuted: Date.now() - 172800000,
      successRate: 0.72,
    },
  ];

  // Mock agent templates
  const mockTemplates = [
    {
      templateId: 'tmpl-trading',
      name: 'Active Trading',
      description: 'High-frequency trading with momentum analysis',
      category: 'trading' as const,
      requiredCapital: 10000,
      estimatedGasPerTx: 500,
      successRate: 0.87,
      complexity: 4 as const,
    },
    {
      templateId: 'tmpl-arbitrage',
      name: 'Arbitrage Bot',
      description: 'Cross-exchange and DEX arbitrage opportunities',
      category: 'trading' as const,
      requiredCapital: 25000,
      estimatedGasPerTx: 1000,
      successRate: 0.91,
      complexity: 3 as const,
    },
    {
      templateId: 'tmpl-yield',
      name: 'Yield Farmer',
      description: 'Multi-protocol yield optimization',
      category: 'treasury' as const,
      requiredCapital: 50000,
      estimatedGasPerTx: 750,
      successRate: 0.84,
      complexity: 3 as const,
    },
    {
      templateId: 'tmpl-rebalance',
      name: 'Portfolio Rebalancer',
      description: 'Automated portfolio drift correction',
      category: 'rebalancing' as const,
      requiredCapital: 100000,
      estimatedGasPerTx: 300,
      successRate: 0.96,
      complexity: 2 as const,
    },
    {
      templateId: 'tmpl-monitor',
      name: 'Risk Monitor',
      description: 'Real-time risk analysis and alerts',
      category: 'monitoring' as const,
      requiredCapital: 5000,
      estimatedGasPerTx: 100,
      successRate: 0.99,
      complexity: 1 as const,
    },
  ];

  // Render active panel based on tab
  const renderActivePanel = () => {
    switch (activeTab) {
      case 'deployment':
        return (
          <AgentDeploymentPanel
            userId={userId}
            availableTemplates={mockTemplates}
          />
        );
      case 'fleet':
        return (
          <MultiAgentPanel
            userId={userId}
            deployedAgents={mockDeployedAgents}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="agent-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Agent Management</h1>
          <p className="subtitle">Deploy and manage autonomous trading agents</p>
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
        <div className="agent-stats">
          <div className="stat-card">
            <span className="stat-icon">🤖</span>
            <div className="stat-content">
              <span className="stat-label">Total Agents</span>
              <span className="stat-value">{stats.totalAgents}</span>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">🟢</span>
            <div className="stat-content">
              <span className="stat-label">Active Agents</span>
              <span className="stat-value">{stats.activeAgents}</span>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">💰</span>
            <div className="stat-content">
              <span className="stat-label">Total Capital</span>
              <span className="stat-value">{stats.totalCapital}</span>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">📈</span>
            <div className="stat-content">
              <span className="stat-label">Total Value</span>
              <span className="stat-value">{stats.totalValue}</span>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">💹</span>
            <div className="stat-content">
              <span className="stat-label">Monthly ROI</span>
              <span className="stat-value" style={{ color: '#10b981' }}>
                {stats.monthlyROI}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="agent-tabs">
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
      <div className="agent-content">
        {renderActivePanel()}
      </div>

      {/* Footer */}
      <div className="agent-footer">
        <div className="footer-note">
          💡 Agents execute autonomously. Monitor performance metrics daily and adjust configurations as needed.
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;
