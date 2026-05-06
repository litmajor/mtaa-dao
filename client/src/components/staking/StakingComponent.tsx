/**
 * Staking Component
 * 
 * Stake MTAA tokens with duration options and earn rewards
 * Features: Multiple lockup periods, APY calculation, rewards claim
 */

import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Gift, TrendingUp } from 'lucide-react';
import { authClient } from '@/utils/authClient';

interface StakeOption {
  duration: number; // days
  durationLabel: string;
  apyBase: number; // 12% base
  multiplier: number;
  totalAPY: number;
}

interface UserStake {
  stakeId: string;
  amount: number;
  duration: number;
  stakedAt: Date;
  unlockAt: Date;
  rewards: number;
  totalValue: number;
  status: 'active' | 'matured' | 'unlocking';
}

interface StakingStats {
  totalStaked: number;
  totalRewards: number;
  activeStakes: number;
  vaultAccess: {
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    name: string;
    minStake: number;
    maxVaults: number;
    feeDiscount: number;
    description: string;
  };
}

export default function StakingComponent() {
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [userStakes, setUserStakes] = useState<UserStake[]>([]);
  const [stakingStats, setStakingStats] = useState<StakingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStaking, setIsStaking] = useState(false);
  const [activeTab, setActiveTab] = useState<'stake' | 'my-stakes' | 'rewards'>('stake');

  const STAKE_OPTIONS: StakeOption[] = [
    {
      duration: 7,
      durationLabel: '7 Days',
      apyBase: 12,
      multiplier: 0.5,
      totalAPY: 12 * 0.5,
    },
    {
      duration: 30,
      durationLabel: '30 Days',
      apyBase: 12,
      multiplier: 1.0,
      totalAPY: 12 * 1.0,
    },
    {
      duration: 90,
      durationLabel: '90 Days',
      apyBase: 12,
      multiplier: 1.5,
      totalAPY: 12 * 1.5,
    },
    {
      duration: 365,
      durationLabel: '1 Year',
      apyBase: 12,
      multiplier: 2.5,
      totalAPY: 12 * 2.5,
    },
  ];

  const selectedOption = STAKE_OPTIONS.find((opt) => opt.duration === selectedDuration)!;
  const projectedRewards = stakeAmount
    ? (parseFloat(stakeAmount) * (selectedOption.totalAPY / 100) * (selectedDuration / 365)).toFixed(2)
    : '0.00';

  useEffect(() => {
    const fetchStakingData = async () => {
      try {
        // Fetch user stakes
        const stakesRes = await authClient.get('/api/v1/yuki/staking/my-stakes');
        setUserStakes(stakesRes || []);

        // Fetch staking stats
        const statsRes = await authClient.get('/api/v1/yuki/staking/stats');
        setStakingStats(statsRes);
      } catch (err) {
        console.error('Failed to fetch staking data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStakingData();
  }, []);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsStaking(true);
    try {
      await authClient.post('/api/v1/yuki/staking/stake', {
        amount: parseFloat(stakeAmount),
        duration: selectedDuration,
      });

      alert(`Successfully staked ${stakeAmount} MTAA for ${selectedDuration} days!`);
      setStakeAmount('');

      // Refresh stakes
      const stakesRes = await authClient.get('/api/v1/yuki/staking/my-stakes');
      setUserStakes(stakesRes || []);
    } catch (err) {
      console.error('Staking error:', err);
      alert('Failed to stake MTAA tokens');
    } finally {
      setIsStaking(false);
    }
  };

  const handleClaimRewards = async (stakeId: string) => {
    try {
      await authClient.post(`/api/v1/yuki/staking/claim/${stakeId}`);

      alert('Rewards claimed successfully!');

      // Refresh stakes
      const stakesRes = await authClient.get('/api/v1/yuki/staking/my-stakes');
      setUserStakes(stakesRes || []);
    } catch (err) {
      console.error('Claim error:', err);
      alert('Failed to claim rewards');
    }
  };

  const handleUnstake = async (stakeId: string) => {
    if (!window.confirm('Are you sure? You may lose unclaimed rewards.')) return;

    try {
      await authClient.post(`/api/v1/yuki/staking/unstake/${stakeId}`);

      alert('Successfully unstaked!');

      // Refresh stakes
      const stakesRes = await authClient.get('/api/v1/yuki/staking/my-stakes');
      setUserStakes(stakesRes || []);
    } catch (err) {
      console.error('Unstake error:', err);
      alert('Failed to unstake');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <p className="text-slate-400">Loading staking data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-4xl font-bold">Stake MTAA</h1>
          <p className="text-slate-400 mt-2">Earn rewards by locking your MTAA tokens</p>
        </div>

        {/* STATS */}
        {stakingStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <p className="text-slate-400 text-sm">Total Staked</p>
              <p className="text-3xl font-bold mt-2">
                {stakingStats.totalStaked.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500 mt-2">MTAA</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <p className="text-slate-400 text-sm">Total Rewards Earned</p>
              <p className="text-3xl font-bold text-green-400 mt-2">
                +{stakingStats.totalRewards.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-2">MTAA</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <p className="text-slate-400 text-sm">Vault Tier</p>
              <p className="text-3xl font-bold mt-2">{stakingStats.vaultAccess.name}</p>
              <p className="text-xs text-slate-500 mt-2">
                Access {stakingStats.vaultAccess.maxVaults} vaults
              </p>
            </div>
          </div>
        )}

        {/* TABS */}
        <div className="flex gap-4 border-b border-slate-700">
          {[
            { id: 'stake', label: '🔒 Stake' },
            { id: 'my-stakes', label: '💼 My Stakes' },
            { id: 'rewards', label: '🎁 Rewards' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {activeTab === 'stake' && (
          <div className="space-y-6">
            {/* STAKING FORM */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Amount to Stake</label>
                <div className="relative">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                  <span className="absolute right-4 top-3.5 text-slate-400">MTAA</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Available: 10,000 MTAA</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3">Lock Duration</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {STAKE_OPTIONS.map((option) => (
                    <button
                      key={option.duration}
                      onClick={() => setSelectedDuration(option.duration)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedDuration === option.duration
                          ? 'border-blue-500 bg-blue-900/20 text-white'
                          : 'border-slate-600 bg-slate-900 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <p className="font-semibold text-sm">{option.durationLabel}</p>
                      <p className="text-xs mt-1 text-green-400">{option.totalAPY.toFixed(1)}% APY</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* APY BREAKDOWN */}
              <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Base APY</span>
                  <span className="font-semibold">{selectedOption.apyBase}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Duration Multiplier</span>
                  <span className="font-semibold">{selectedOption.multiplier}x</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-700 pt-2 mt-2">
                  <span className="text-slate-300 font-semibold">Total APY</span>
                  <span className="text-lg font-bold text-green-400">{selectedOption.totalAPY.toFixed(1)}%</span>
                </div>
              </div>

              {/* PROJECTED REWARDS */}
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Projected Rewards ({selectedDuration} days)</span>
                  <span className="text-2xl font-bold text-green-400">{projectedRewards} MTAA</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  You'll receive {projectedRewards} MTAA in rewards after the lock period expires
                </p>
              </div>

              <button
                onClick={handleStake}
                disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || isStaking}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Lock className="h-4 w-4" />
                {isStaking ? 'Staking...' : 'Stake MTAA'}
              </button>
            </div>

            {/* VAULT TIER INFO */}
            {stakingStats && (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  Unlock Vault Access
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 rounded p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">🥉 Bronze</p>
                      <p className="text-xs text-slate-500">Min 1,000 MTAA</p>
                    </div>
                    <p className="text-xs text-slate-400">Access 1 vault • No fee discount</p>
                  </div>
                  <div className="bg-slate-900 rounded p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">🥈 Silver</p>
                      <p className="text-xs text-slate-500">Min 5,000 MTAA</p>
                    </div>
                    <p className="text-xs text-slate-400">Access 5 vaults • 5% fee discount</p>
                  </div>
                  <div className="bg-slate-900 rounded p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">🥇 Gold</p>
                      <p className="text-xs text-slate-500">Min 25,000 MTAA</p>
                    </div>
                    <p className="text-xs text-slate-400">Access 15 vaults • 10% fee discount</p>
                  </div>
                  <div className="bg-slate-900 rounded p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">💎 Platinum</p>
                      <p className="text-xs text-slate-500">Min 100,000 MTAA</p>
                    </div>
                    <p className="text-xs text-slate-400">Access all vaults • 25% fee discount</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'my-stakes' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Your Active Stakes</h3>
            {userStakes.length > 0 ? (
              <div className="space-y-3">
                {userStakes
                  .filter((s) => s.status === 'active')
                  .map((stake) => {
                    const timeRemaining = Math.max(
                      0,
                      Math.floor(
                        (new Date(stake.unlockAt).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )
                    );
                    return (
                      <div
                        key={stake.stakeId}
                        className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{stake.amount.toLocaleString()} MTAA</p>
                            <p className="text-sm text-slate-400">
                              {stake.duration} days • {timeRemaining} days remaining
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-400">Pending Rewards</p>
                            <p className="text-lg font-bold text-green-400">
                              +{stake.rewards.toFixed(2)} MTAA
                            </p>
                          </div>
                        </div>

                        <div className="w-full bg-slate-900 rounded h-2">
                          <div
                            className="bg-blue-500 h-full rounded"
                            style={{
                              width: `${
                                100 -
                                (timeRemaining / stake.duration) * 100
                              }%`,
                            }}
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleClaimRewards(stake.stakeId)}
                            className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                          >
                            <Gift className="h-4 w-4" />
                            Claim Rewards
                          </button>
                          {timeRemaining === 0 && (
                            <button
                              onClick={() => handleUnstake(stake.stakeId)}
                              className="flex-1 bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                              <Unlock className="h-4 w-4" />
                              Unstake
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No active stakes</p>
            )}
          </div>
        )}

        {activeTab === 'rewards' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Rewards Summary</h3>
            {userStakes.length > 0 ? (
              <div className="space-y-3">
                {userStakes.map((stake) => (
                  <div
                    key={stake.stakeId}
                    className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold">{stake.amount.toLocaleString()} MTAA</p>
                      <p className="text-sm text-slate-400">
                        Locked for {stake.duration} days
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Total Value</p>
                      <p className="text-lg font-bold text-green-400">
                        +{stake.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        MTAA
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No rewards yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
