/**
 * COMPREHENSIVE MTAA DAO DASHBOARD v2.0
 * 
 * Architecture:
 * - Main Tabs: DAOs (with nested tabs), Wallet, Profile, Referrals, Vaults, Analytics, More
 * - DAO Tab: Overview, Governance, Treasury, Members, Settings
 * - More Menu: KYC, Pools, Achievements, Events, Support, NFT, Escrow, Rewards
 * - Feature Gating: User permissions control visibility
 * - Responsive Design: Mobile-first, nested navigation
 */

import React, { useState, useMemo, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, Users, DollarSign, Plus, Wallet, Shield, CheckCircle, Settings,
  Activity, Link as LinkIcon, Send, Gift, MoreHorizontal, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { useAuth } from '@/pages/hooks/useAuth';
import { useFeatures } from '@/contexts/features-context';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const API_ENDPOINT = `${API_BASE_URL}/api`;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface DaoData {
  id: string;
  name: string;
  description: string;
  members: number;
  tvl: number;
  status: 'active' | 'inactive';
  created: string;
  avatar?: string;
  governance: {
    proposals: number;
    activeFundingRound: boolean;
    votingPower: number;
  };
  treasury: {
    balance: number;
    assets: Array<{ name: string; value: number }>;
    lastUpdated: string;
  };
  stats: {
    transactionVolume: number;
    memberGrowth: number;
    proposalsApproved: number;
  };
}

interface DashboardData {
  // Summary
  totalAssets: number;
  monthlyReturn: number;
  activeInvestments: number;
  pendingWithdrawals: number;

  // DAOs (Enhanced)
  userDAOs: DaoData[];
  daoDiscovery: DaoData[];
  daoOfTheWeek?: DaoData;

  // Wallet Data
  wallets: Array<{
    id: string;
    address: string;
    balance: number;
    network: string;
    verified: boolean;
  }>;

  // Referral Data
  referralStats: {
    totalReferrals: number;
    activeReferrals: number;
    referralRewards: number;
    pendingRewards: number;
  };

  // Vaults & Pools
  vaults: Array<{
    id: string;
    name: string;
    balance: number;
    apy: number;
    type: string;
    created: string;
  }>;
  investmentPools: Array<{
    id: string;
    name: string;
    totalValue: number;
    apy: number;
    participants: number;
  }>;

  // Analytics
  portfolioValue: Array<{ date: string; value: number }>;
  transactionHistory: Array<{
    id: string;
    type: 'buy' | 'sell' | 'deposit' | 'withdraw';
    amount: number;
    date: string;
  }>;
  performanceData: Array<{ month: string; return: number }>;

  // Feature Gating
  features: {
    kyc: boolean;
    pools: boolean;
    achievements: boolean;
    escrow: boolean;
    nft: boolean;
  };
}

// ============================================================================
// FEATURE GATING CONSTANTS
// ============================================================================

const FEATURE_GATES = {
  KYC: 'kyc',
  POOLS: 'pools',
  ACHIEVEMENTS: 'achievements',
  ESCROW: 'escrow',
  NFT: 'nft',
  EVENTS: 'events',
  REWARDS: 'rewards',
} as const;

const PAGE_TRACKER = {
  main: [
    { id: 'daos', label: 'DAOs', icon: Users, category: 'core' },
    { id: 'wallet', label: 'Wallet', icon: Wallet, category: 'core' },
    { id: 'profile', label: 'Profile', icon: Users, category: 'core' },
    { id: 'referrals', label: 'Referrals', icon: Gift, category: 'core' },
    { id: 'vaults', label: 'Vaults', icon: DollarSign, category: 'core' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, category: 'core' },
  ],
  moreMenu: [
    { id: 'kyc', label: 'KYC Verification', icon: Shield, gate: 'kyc' },
    { id: 'pools', label: 'Investment Pools', icon: Activity, gate: 'pools' },
    { id: 'achievements', label: 'Achievements', icon: Activity, gate: 'achievements' },
    { id: 'events', label: 'Events', icon: Activity, gate: 'events' },
    { id: 'support', label: 'Support Center', icon: Activity, gate: undefined },
    { id: 'nft', label: 'NFT Marketplace', icon: Users, gate: 'nft' },
    { id: 'escrow', label: 'Escrow Services', icon: Shield, gate: 'escrow' },
    { id: 'rewards', label: 'Rewards Hub', icon: Gift, gate: 'rewards' },
  ],
  daoNested: [
    { id: 'overview', label: 'Overview', icon: Users },
    { id: 'governance', label: 'Governance', icon: Users },
    { id: 'treasury', label: 'Treasury', icon: DollarSign },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ],
} as const;

// ============================================================================
// DATA FETCHING
// ============================================================================

const fetchDashboardData = async (): Promise<DashboardData> => {
  const token = localStorage.getItem('accessToken');
  const baseUrl = API_BASE_URL.includes('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;
  const dashboardUrl = `${baseUrl}/dashboard/complete`;
  
  console.log('Dashboard fetch - URL:', dashboardUrl, 'Token present:', !!token);

  try {
    const response = await fetch(dashboardUrl, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Dashboard API error:', response.status, response.statusText);
      throw new Error(`API returned ${response.status}`);
    }
    const data = await response.json();
    console.log('Dashboard data loaded:', !!data?.userDAOs?.length);
    return data;
  } catch (error) {
    console.warn('Dashboard fetch failed, using fallback data:', error);
    return {
      totalAssets: 125000,
      monthlyReturn: 3.2,
      activeInvestments: 8,
      pendingWithdrawals: 2,
      userDAOs: [
        {
          id: '1',
          name: 'TechDAO',
          description: 'Web3 Technology Hub',
          members: 234,
          tvl: 450000,
          status: 'active',
          created: '2024-01-15',
          avatar: '🏗️',
          governance: { proposals: 12, activeFundingRound: true, votingPower: 100 },
          treasury: { balance: 450000, assets: [{ name: 'USDC', value: 450000 }], lastUpdated: '2024-11-22' },
          stats: { transactionVolume: 125000, memberGrowth: 12.5, proposalsApproved: 9 },
        },
      ],
      daoDiscovery: [
        {
          id: '2',
          name: 'CreativeDAO',
          description: 'Digital Arts Collective',
          members: 156,
          tvl: 320000,
          status: 'active',
          created: '2024-02-01',
          avatar: '🎨',
          governance: { proposals: 8, activeFundingRound: false, votingPower: 0 },
          treasury: { balance: 320000, assets: [{ name: 'USDC', value: 320000 }], lastUpdated: '2024-11-22' },
          stats: { transactionVolume: 89000, memberGrowth: 8.2, proposalsApproved: 6 },
        },
      ],
      daoOfTheWeek: {
        id: '3',
        name: 'GreenFuture DAO',
        description: 'Sustainable Finance Initiative',
        members: 456,
        tvl: 750000,
        status: 'active',
        created: '2024-03-10',
        avatar: '♻️',
        governance: { proposals: 15, activeFundingRound: true, votingPower: 0 },
        treasury: { balance: 750000, assets: [{ name: 'USDC', value: 750000 }], lastUpdated: '2024-11-22' },
        stats: { transactionVolume: 250000, memberGrowth: 18.5, proposalsApproved: 13 },
      },
      wallets: [
        { id: '1', address: '0x742d3...', balance: 50000, network: 'Ethereum', verified: true },
        { id: '2', address: '0x894a2...', balance: 75000, network: 'Polygon', verified: true },
      ],
      referralStats: {
        totalReferrals: 24,
        activeReferrals: 18,
        referralRewards: 8500,
        pendingRewards: 1200,
      },
      vaults: [
        { id: '1', name: 'Growth Vault', balance: 45000, apy: 12.5, type: 'Aggressive', created: '2024-01-01' },
        { id: '2', name: 'Stable Vault', balance: 55000, apy: 6.2, type: 'Conservative', created: '2024-02-15' },
      ],
      investmentPools: [
        { id: '1', name: 'DeFi Index Fund', totalValue: 5000000, apy: 15.2, participants: 1250 },
      ],
      portfolioValue: [
        { date: '2024-11-01', value: 110000 },
        { date: '2024-11-10', value: 115000 },
        { date: '2024-11-20', value: 125000 },
      ],
      transactionHistory: [
        { id: '1', type: 'deposit', amount: 10000, date: '2024-11-20' },
        { id: '2', type: 'buy', amount: 5000, date: '2024-11-18' },
      ],
      performanceData: [
        { month: 'Sep', return: 2.1 },
        { month: 'Oct', return: 2.8 },
        { month: 'Nov', return: 3.2 },
      ],
      features: {
        kyc: true,
        pools: true,
        achievements: true,
        escrow: false,
        nft: true,
      },
    };
  }
};

// ============================================================================
// DAO TAB COMPONENT - NESTED STRUCTURE
// ============================================================================

interface DaoTabProps {
  dao: DaoData;
  features: DashboardData['features'];
}

const DaoTab: React.FC<DaoTabProps> = ({ dao, features }) => {
  const [nestedTab, setNestedTab] = useState('overview');

  return (
    <div className="space-y-4">
      {/* DAO Header Card */}
      <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-4xl mb-2">{dao.avatar}</div>
              <CardTitle className="text-3xl">{dao.name}</CardTitle>
              <CardDescription className="text-purple-100">{dao.description}</CardDescription>
            </div>
            <Button variant="outline" className="text-black">
              <Settings className="w-4 h-4 mr-2" />
              Manage DAO
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{dao.members}</p>
            <p className="text-xs text-green-600">+{dao.stats.memberGrowth.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">TVL</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${(dao.tvl / 1000).toFixed(0)}K</p>
            <p className="text-xs text-gray-500">Treasury Assets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Proposals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{dao.governance.proposals}</p>
            <p className="text-xs text-gray-500">{dao.stats.proposalsApproved} Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${(dao.stats.transactionVolume / 1000).toFixed(0)}K</p>
            <p className="text-xs text-gray-500">This Month</p>
          </CardContent>
        </Card>
      </div>

      {/* Nested DAO Tabs */}
      <Card>
        <Tabs value={nestedTab} onValueChange={setNestedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 p-1 bg-gray-100">
            {PAGE_TRACKER.daoNested.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
                  <IconComponent className="w-4 h-4 mr-1" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Treasury Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={dao.treasury.assets}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {['#8b5cf6', '#ec4899', '#f59e0b'].map((color, idx) => (
                          <Cell key={`cell-${idx}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity Feed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Proposal #12 approved</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">5 new members joined</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">TVL increased to $450K</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Governance */}
          <TabsContent value="governance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Proposals</CardTitle>
                <CardDescription>Vote on important governance decisions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">Proposal #{i}: Increase Marketing Budget</p>
                          <p className="text-sm text-gray-500">Voting ends in 3 days</p>
                        </div>
                        <Badge>58% in favor</Badge>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full w-[58%]" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Treasury */}
          <TabsContent value="treasury" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Treasury Management</CardTitle>
                <CardDescription>Balance: ${(dao.treasury.balance).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dao.treasury.assets.map((asset, idx) => (
                    <div key={idx} className="flex justify-between p-2 hover:bg-gray-50 rounded">
                      <span className="font-medium">{asset.name}</span>
                      <span>${asset.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members */}
          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Members ({dao.members})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
                        <span className="text-sm">Member {i}</span>
                      </div>
                      <Badge variant="outline">Contributor</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>DAO Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  Edit DAO Information
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Members
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="w-4 h-4 mr-2" />
                  Security Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export default function ComprehensiveDashboardV2() {
  const { user: authUser } = useAuth();
  const { isFeatureEnabled } = useFeatures();
  const [activeTab, setActiveTab] = useState('daos');
  const [selectedDao, setSelectedDao] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [showMorePages, setShowMorePages] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-v2', authUser?.id || 'anonymous'],
    queryFn: fetchDashboardData,
    refetchInterval: 30000,
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  if (!authUser) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Please log in to view your dashboard</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex justify-center items-center h-96">
        <Activity className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-yellow-800 font-semibold mb-2">Failed to load dashboard data</p>
            <p className="text-yellow-700 text-sm mb-4">{error?.message || 'Unknown error'}</p>
            <p className="text-yellow-700 text-xs">Check your connection and try refreshing the page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summaryMetrics = [
    {
      title: 'Total Assets',
      value: `$${(data.totalAssets / 1000).toFixed(1)}K`,
      change: '+12.5%',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Monthly Return',
      value: `${data.monthlyReturn}%`,
      change: '+0.8%',
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Your DAOs',
      value: data.userDAOs.length,
      change: data.userDAOs.length > 0 ? 'Active' : 'None yet',
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Pending',
      value: data.pendingWithdrawals,
      change: 'Action needed',
      icon: Shield,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
    },
  ];

  const availableMorePages = PAGE_TRACKER.moreMenu.filter(
    (page) => {
      if (!page.gate) return true;
      return data.features[page.gate as keyof typeof data.features];
    }
  );

  const selectedDaoData = data.userDAOs.find((dao) => dao.id === selectedDao);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header with User Info */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Welcome, {authUser.name}! 🚀
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your DAOs, investments, and portfolio from one place
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Activity className="w-4 h-4" />
            </Button>
            <Button variant="outline">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryMetrics.map((metric, idx) => {
            const IconComponent = metric.icon;
            return (
              <Card key={idx} className="hover:shadow-lg transition-all hover:scale-105">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                    <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                      <IconComponent className={`w-5 h-5 ${metric.color}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-1">{metric.value}</div>
                  <Badge variant="secondary" className="text-green-600 text-xs">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    {metric.change}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Navigation */}
        <Card>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7 gap-1 p-1 bg-gray-100 dark:bg-gray-800">
              {PAGE_TRACKER.main.map((tab) => {
                // Check if this tab is enabled
                const featureKey = `core.${tab.id}`;
                if (!isFeatureEnabled(featureKey)) {
                  return null; // Hide disabled tabs
                }

                const IconComponent = tab.icon;
                // Get count for this tab
                let count = 0;
                if (tab.id === 'daos') count = data.userDAOs?.length || 0;
                else if (tab.id === 'wallet') count = data.wallets?.length || 0;
                else if (tab.id === 'vaults') count = data.vaults?.length || 0;
                else if (tab.id === 'proposals') count = data.userDAOs?.reduce((sum, dao) => sum + (dao.governance?.proposals || 0), 0) || 0;
                
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <IconComponent className="w-4 h-4" />
                        {count > 0 && (
                          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {count}
                          </span>
                        )}
                      </div>
                      <span>{tab.label}</span>
                    </div>
                  </TabsTrigger>
                );
              }).filter(Boolean)}
              <TabsTrigger value="more" className="text-xs sm:text-sm">
                <MoreHorizontal className="w-4 h-4 mr-1" />
                More
              </TabsTrigger>
            </TabsList>

            {/* DAOs TAB - with nested structure */}
            {isFeatureEnabled('core.daos') && (
            <TabsContent value="daos" className="space-y-4">
              {data.userDAOs.length > 0 ? (
                <div>
                  <div className="mb-4">
                    <p className="text-sm font-semibold mb-2">Your DAOs ({data.userDAOs.length})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data.userDAOs.map((dao) => (
                        <Card
                          key={dao.id}
                          className={`cursor-pointer transition-all ${selectedDao === dao.id ? 'ring-2 ring-purple-600' : 'hover:shadow-md'}`}
                          onClick={() => setSelectedDao(dao.id)}
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="text-3xl">{dao.avatar}</div>
                                <div>
                                  <p className="font-semibold">{dao.name}</p>
                                  <p className="text-xs text-gray-500">{dao.members} members</p>
                                </div>
                              </div>
                              <Badge variant={dao.status === 'active' ? 'default' : 'secondary'}>
                                {dao.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {selectedDao && selectedDaoData && (
                    <DaoTab dao={selectedDaoData} features={data.features} />
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">You haven't created any DAOs yet</p>
                  {isFeatureEnabled('dao.creation') && (
                    <>
                      <Button className="mr-2">
                        <Plus className="w-4 h-4 mr-2" />
                        Create DAO
                      </Button>
                    </>
                  )}
                  {isFeatureEnabled('dao.overview') && (
                    <Button variant="outline">
                      <Activity className="w-4 h-4 mr-2" />
                      Discover DAOs
                    </Button>
                  )}
                </div>
              )}

              {/* DAO of the Week & Discovery */}
              {data.daoOfTheWeek && (
                <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-purple-600" />
                      <CardTitle>DAO of the Week</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-4xl">{data.daoOfTheWeek.avatar}</div>
                        <div>
                          <p className="font-semibold">{data.daoOfTheWeek.name}</p>
                          <p className="text-sm text-gray-600">{data.daoOfTheWeek.description}</p>
                          <p className="text-xs text-gray-500">{data.daoOfTheWeek.members} members • ${(data.daoOfTheWeek.tvl / 1000).toFixed(0)}K TVL</p>
                        </div>
                      </div>
                      <Button>
                        Join <Activity className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            )}

            {/* WALLET TAB */}
            {isFeatureEnabled('core.wallet') && (
            <TabsContent value="wallet" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Connected Wallets</CardTitle>
                      <CardDescription>Manage your blockchain wallets</CardDescription>
                    </div>
                    <Button size="sm" className="gap-2">
                      <Plus className="w-4 h-4" />
                      Add Wallet
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.wallets.map((wallet) => (
                      <div key={wallet.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Wallet className="w-5 h-5 text-purple-600" />
                          <div>
                            <p className="font-semibold text-sm">{wallet.address}</p>
                            <p className="text-xs text-gray-500">{wallet.network}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${wallet.balance.toLocaleString()}</p>
                          {wallet.verified && (
                            <Badge variant="outline" className="text-green-600 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            )}

            {/* PROFILE TAB */}
            {isFeatureEnabled('core.profile') && (
            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Full Name</p>
                      <p className="font-semibold">{authUser.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-semibold">{authUser.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Role</p>
                      <Badge className="capitalize mt-1">{authUser.role}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <Badge variant="outline" className="text-green-600 mt-1">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            )}

            {/* REFERRALS TAB */}
            {isFeatureEnabled('core.referrals') && (
            <TabsContent value="referrals" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Referrals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{data.referralStats.totalReferrals}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Active</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{data.referralStats.activeReferrals}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Earned</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">${(data.referralStats.referralRewards / 1000).toFixed(1)}K</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">${(data.referralStats.pendingRewards / 1000).toFixed(1)}K</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            )}
            
            {/* VAULTS TAB */}
            <TabsContent value="vaults" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Investment Vaults</CardTitle>
                    <Button size="sm" className="gap-2">
                      <Plus className="w-4 h-4" />
                      New Vault
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.vaults.map((vault) => (
                      <div key={vault.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold">{vault.name}</p>
                          <Badge variant="outline">{vault.type}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-600">Balance</p>
                            <p className="font-semibold">${(vault.balance / 1000).toFixed(1)}K</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">APY</p>
                            <p className="font-semibold text-green-600">{vault.apy}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ANALYTICS TAB */}
            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={data.portfolioValue}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#8b5cf6"
                          fillOpacity={1}
                          fill="url(#colorValue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={data.performanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip />
                        <Bar dataKey="return" fill="#8b5cf6" name="Return %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* MORE MENU TAB */}
            <TabsContent value="more" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableMorePages.map((page) => {
                  const IconComponent = (page.icon as any) || Activity;
                  return (
                    <Card key={page.id} className="hover:shadow-lg transition-all cursor-pointer">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <IconComponent className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-semibold">{page.label}</p>
                              <p className="text-xs text-gray-500">Manage your {page.label.toLowerCase()}</p>
                            </div>
                          </div>
                          <Activity className="w-5 h-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {availableMorePages.length === 0 && (
                <Card className="text-center py-12">
                  <p className="text-gray-600">No additional features available yet</p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </Card>

        {/* Page Tracker Footer */}
        <Card className="bg-gray-50 dark:bg-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Dashboard Navigation Tracker</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-semibold mb-1">Core Pages (6)</p>
                <div className="flex flex-wrap gap-2">
                  {PAGE_TRACKER.main.map((page) => (
                    <Badge key={page.id} variant="outline">{page.label}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-semibold mb-1">DAO Nested Tabs (5)</p>
                <div className="flex flex-wrap gap-2">
                  {PAGE_TRACKER.daoNested.map((page) => (
                    <Badge key={page.id} variant="outline">{page.label}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-semibold mb-1">More Menu ({availableMorePages.length})</p>
                <div className="flex flex-wrap gap-2">
                  {availableMorePages.map((page) => (
                    <Badge key={page.id} variant="secondary">{page.label}</Badge>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-600">Total Pages: {PAGE_TRACKER.main.length + PAGE_TRACKER.daoNested.length + availableMorePages.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
