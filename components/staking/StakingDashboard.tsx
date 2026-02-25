/**
 * StakingDashboard.tsx
 * Staking & Yield Opportunities Dashboard
 * 
 * Wires all 4 Staking simulators:
 * - SOLO_STAKING
 * - POOL_STAKING
 * - LIQUIDITY_POOL
 * - YIELD_FARMING
 */

import React, { useState } from 'react';
import { SoloStakingPanel } from './SoloStakingPanel';
import { PoolStakingPanel } from './PoolStakingPanel';
import { LiquidityPoolPanel } from './LiquidityPoolPanel';
import { YieldFarmingPanel } from './YieldFarmingPanel';

interface StakingDashboardProps {
  userId: string;
  daoName?: string;
}

export const StakingDashboard: React.FC<StakingDashboardProps> = ({
  userId,
  daoName = 'My DAO',
}) => {
  const [activePanel, setActivePanel] = useState<'solo' | 'pool' | 'liquidity' | 'farming'>('solo');
  const [stakingHistory, setStakingHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Staking state
  const [stakingState] = useState({
    totalStaked: 500000,
    estimatedApy: 6.8,
    activeValidators: 5,
    liquidityPools: 8,
    farmingOpportunities: 12,
  });

  const handleSimulationComplete = (result: any) => {
    const action = {
      id: `staking_action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      details: result,
    };
    setStakingHistory([action, ...stakingHistory]);
  };

  return (
    <div className="staking-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} Staking & Yield</h1>
          <p className="subtitle">Explore staking options and maximize APY returns</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Staked</span>
            <span className="stat-value">
              ${stakingState.totalStaked.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Est. APY</span>
            <span className="stat-value success">{stakingState.estimatedApy}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Validators</span>
            <span className="stat-value">{stakingState.activeValidators}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Liquidity Pools</span>
            <span className="stat-value">{stakingState.liquidityPools}</span>
          </div>
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>Staking Tools</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'solo' ? 'active' : ''}`}
            onClick={() => setActivePanel('solo')}
          >
            <span className="tab-icon">🖥️</span>
            <span className="tab-label">Solo Staking</span>
            <span className="tab-subtitle">Run node & validate</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'pool' ? 'active' : ''}`}
            onClick={() => setActivePanel('pool')}
          >
            <span className="tab-icon">👥</span>
            <span className="tab-label">Pool Staking</span>
            <span className="tab-subtitle">Share rewards</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'liquidity' ? 'active' : ''}`}
            onClick={() => setActivePanel('liquidity')}
          >
            <span className="tab-icon">💧</span>
            <span className="tab-label">Liquidity Pool</span>
            <span className="tab-subtitle">Earn LP fees</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'farming' ? 'active' : ''}`}
            onClick={() => setActivePanel('farming')}
          >
            <span className="tab-icon">🌾</span>
            <span className="tab-label">Yield Farming</span>
            <span className="tab-subtitle">Maximize yields</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'solo' && (
          <div className="panel-wrapper">
            <SoloStakingPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'pool' && (
          <div className="panel-wrapper">
            <PoolStakingPanel
              userId={userId}
              poolId="main-pool"
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'liquidity' && (
          <div className="panel-wrapper">
            <LiquidityPoolPanel
              userId={userId}
              poolId="main-lp"
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'farming' && (
          <div className="panel-wrapper">
            <YieldFarmingPanel
              userId={userId}
              farmId="main-farm"
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>Staking Action History</h2>
          {stakingHistory.length === 0 ? (
            <div className="empty-history">
              <p>No staking actions yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {stakingHistory.map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'solo' && '🖥️'}
                    {action.type === 'pool' && '👥'}
                    {action.type === 'liquidity' && '💧'}
                    {action.type === 'farming' && '🌾'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'solo' && 'Solo Stake Created'}
                      {action.type === 'pool' && 'Pool Deposit Made'}
                      {action.type === 'liquidity' && 'Liquidity Added'}
                      {action.type === 'farming' && 'Farm Position Opened'}
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
        <h3>💡 Staking & Yield Tools</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Solo Staking</h4>
            <p>Run your own validator node. Full rewards minus technical costs. Requires 32 ETH minimum. Monitor slashing risks.</p>
          </div>
          <div className="info-card">
            <h4>Pool Staking</h4>
            <p>Deposit in staking pools for shared validator rewards. Lower barrier entry. Pool operator fees apply to rewards.</p>
          </div>
          <div className="info-card">
            <h4>Liquidity Pool</h4>
            <p>Provide liquidity in AMMs for trading fees. Subject to impermanent loss. Analyze volatility and fee tier selection.</p>
          </div>
          <div className="info-card">
            <h4>Yield Farming</h4>
            <p>Earn governance token or platform rewards. High APY but higher risk. Monitor farm sustainability and token price.</p>
          </div>
        </div>
      </div>

      {/* APY Comparison */}
      <div className="comparison-section">
        <h3>📊 Current APY Comparison</h3>
        <div className="apy-cards">
          <div className="apy-card">
            <div className="apy-name">Solo Staking</div>
            <div className="apy-value">4.5%</div>
            <div className="apy-risk">Low Risk</div>
          </div>
          <div className="apy-card">
            <div className="apy-name">Pool Staking</div>
            <div className="apy-value">5.2%</div>
            <div className="apy-risk">Low Risk</div>
          </div>
          <div className="apy-card">
            <div className="apy-name">Liquidity Pool</div>
            <div className="apy-value">8-15%</div>
            <div className="apy-risk">Medium Risk (IL)</div>
          </div>
          <div className="apy-card">
            <div className="apy-name">Yield Farm</div>
            <div className="apy-value">120%+</div>
            <div className="apy-risk">High Risk</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StakingDashboard;
