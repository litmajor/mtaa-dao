
import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, Target, DollarSign, ArrowUpRight, Sparkles, Crown, Award, Zap, Eye, RefreshCw, AlertTriangle, Bell, Calendar, Users, Vote, Gift } from 'lucide-react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { useVaultInfo, useVaultBalance, useVaultPerformance, useVaultTransactions } from './hooks/useVault';
import { useWallet } from './hooks/useWallet';
import DepositModal from '../components/vault/DepositModal';
import WithdrawalModal from '../components/vault/WithdrawalModal';
import VaultContextIndicator from '../components/vault/VaultContextIndicator';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import NotificationCenter from '../components/NotificationCenter';

const VaultDashboard = () => {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [dailyChallenge, setDailyChallenge] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  const { address, isConnected } = useAccount();
  const { connectWallet, isConnecting } = useWallet();

  // Fetch user vaults
  const [vaults, setVaults] = useState<any[]>([]);
  const [vaultStats, setVaultStats] = useState<any>(null);
  const [rewards, setRewards] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [lpPositions, setLpPositions] = useState<any[]>([]);

  useEffect(() => {
    if (isConnected && address) {
      fetchUserData();
    }
  }, [isConnected, address]);

  const fetchUserData = async () => {
    try {
      // Fetch user vaults with proper error handling
      try {
        const vaultsRes = await fetch(`/api/vaults?userId=${address}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (vaultsRes.ok) {
          const vaultsData = await vaultsRes.json();
          setVaults(vaultsData.vaults || []);
        }
      } catch (error) {
        console.error('Failed to fetch vaults:', error);
        setVaults([]);
      }

      // Fetch vault statistics
      try {
        const statsRes = await fetch(`/api/vaults/stats/${address}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setVaultStats(statsData);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setVaultStats({ totalValue: '0', totalROI: '0', activeVaults: 0, totalVaults: 0 });
      }

      // Fetch reputation/rewards
      try {
        const rewardsRes = await fetch(`/api/reputation/user/${address}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (rewardsRes.ok) {
          const rewardsData = await rewardsRes.json();
          setRewards(rewardsData);
        }
      } catch (error) {
        console.error('Failed to fetch rewards:', error);
        setRewards({ totalPoints: 0, claimableAmount: '0' });
      }

      // Fetch governance proposals
      try {
        const proposalsRes = await fetch('/api/governance/proposals', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (proposalsRes.ok) {
          const proposalsData = await proposalsRes.json();
          setProposals(proposalsData.slice(0, 5) || []);
        }
      } catch (error) {
        console.error('Failed to fetch proposals:', error);
        setProposals([]);
      }

      // Fetch LP positions (if user has any vaults)
      if (vaults.length > 0) {
        try {
          const lpRes = await fetch(`/api/vaults/${vaults[0].id}/lp-positions`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (lpRes.ok) {
            const lpData = await lpRes.json();
            setLpPositions(lpData || []);
          }
        } catch (error) {
          console.error('Failed to fetch LP positions:', error);
          setLpPositions([]);
        }
      }

      // Fetch daily challenge
      try {
        const challengeRes = await fetch(`/api/challenges/daily/${address}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (challengeRes.ok) {
          const challengeData = await challengeRes.json();
          setDailyChallenge(challengeData);
        }
      } catch (error) {
        console.error('Failed to fetch daily challenge:', error);
        setDailyChallenge(null);
      }

    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  const claimDailyReward = async () => {
    try {
      const res = await fetch('/api/challenges/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: address, challengeId: dailyChallenge?.id })
      });
      
      if (res.ok) {
        setDailyChallenge(prev => ({ ...prev, claimed: true }));
        fetchUserData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to claim reward:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <Crown className="w-16 h-16 mx-auto mb-4 text-blue-600" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">Connect your wallet to access your vault dashboard</p>
          <Button onClick={connectWallet} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-purple-400/5 to-pink-400/5" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header with Notifications */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-2">
              Vault Dashboard
            </h1>
            <p className="text-gray-600 text-lg">Manage your DeFi portfolio and governance</p>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationCenter />
            <Button onClick={() => setShowDepositModal(true)} className="bg-gradient-to-r from-blue-600 to-purple-600">
              <Plus className="mr-2 h-4 w-4" />
              Quick Deposit
            </Button>
          </div>
        </div>

        {/* Daily Challenge Banner */}
        {dailyChallenge && !dailyChallenge.claimed && (
          <Card className="mb-8 bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Gift className="w-6 h-6 text-orange-600" />
                  <div>
                    <h3 className="font-semibold text-orange-800">Daily Challenge</h3>
                    <p className="text-sm text-orange-600">{dailyChallenge.description}</p>
                  </div>
                </div>
                <Button 
                  onClick={claimDailyReward} 
                  className="bg-gradient-to-r from-orange-500 to-yellow-500"
                >
                  Claim {dailyChallenge.reward} Points
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 text-green-600" />
                <Badge className="bg-green-100 text-green-800">Total</Badge>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                ${vaultStats?.totalValue || '0.00'}
              </h3>
              <p className="text-gray-600 text-sm">Portfolio Value</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-800">ROI</Badge>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                +{vaultStats?.totalROI || '0.00'}%
              </h3>
              <p className="text-gray-600 text-sm">Total Return</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Award className="w-8 h-8 text-purple-600" />
                <Badge className="bg-purple-100 text-purple-800">Rewards</Badge>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {rewards?.totalPoints || '0'}
              </h3>
              <p className="text-gray-600 text-sm">Points Earned</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Zap className="w-8 h-8 text-orange-600" />
                <Badge className="bg-orange-100 text-orange-800">Streak</Badge>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {dailyChallenge?.streak || '0'}
              </h3>
              <p className="text-gray-600 text-sm">Day Streak</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
            <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* User Vaults List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Your Vaults</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vaults.length === 0 ? (
                  <div className="text-center py-8">
                    <Eye className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">No vaults found. Create your first vault!</p>
                    <Button className="mt-4" onClick={() => setShowDepositModal(true)}>
                      Create Vault
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vaults.map((vault, index) => (
                      <div key={vault.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-white font-bold">{vault.name?.[0] || 'V'}</span>
                          </div>
                          <div>
                            <h4 className="font-semibold">{vault.name}</h4>
                            <p className="text-sm text-gray-600">{vault.currency} • {vault.vaultType}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${vault.balance || '0.00'}</p>
                          <p className={`text-sm ${vault.performance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {vault.performance >= 0 ? '+' : ''}{vault.performance || '0.00'}%
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedVault(vault.id);
                            setShowDepositModal(true);
                          }}>
                            Deposit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedVault(vault.id);
                            setShowWithdrawModal(true);
                          }}>
                            Withdraw
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="governance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Vote className="w-5 h-5" />
                  <span>Active Proposals</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {proposals.length === 0 ? (
                  <div className="text-center py-8">
                    <Vote className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">No active proposals</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {proposals.map((proposal) => (
                      <div key={proposal.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{proposal.title}</h4>
                          <Badge className={proposal.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}>
                            {proposal.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{proposal.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-500">
                            {proposal.yesVotes} Yes • {proposal.noVotes} No
                          </div>
                          <Button size="sm">Vote</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="liquidity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Liquidity Provider Positions</CardTitle>
              </CardHeader>
              <CardContent>
                {lpPositions.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">No LP positions found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lpPositions.map((position, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold">{position.pair}</h4>
                            <p className="text-sm text-gray-600">Pool Share: {position.share}%</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${position.value}</p>
                            <p className="text-sm text-green-600">+{position.rewards} Rewards</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rewards & Achievements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-r from-gold-50 to-yellow-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Total Points</h4>
                    <p className="text-2xl font-bold text-yellow-600">{rewards?.totalPoints || '0'}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Claimable Rewards</h4>
                    <p className="text-2xl font-bold text-green-600">${rewards?.claimableAmount || '0.00'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Analytics charts will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <DepositModal 
        open={showDepositModal} 
        onOpenChange={setShowDepositModal}
      />
      <WithdrawalModal 
        open={showWithdrawModal} 
        onOpenChange={setShowWithdrawModal}
        vaultAddress={selectedVault || ""}
      />
    </div>
  );
};

export default VaultDashboard;
