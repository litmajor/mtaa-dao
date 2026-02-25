import { useState, useEffect, useCallback } from 'react';

// API Response Types
interface PlatformMetrics {
  tvl: number;
  assetCount: number;
  daoCount: number;
  memberCount: number;
  healthScores: {
    treasury: number;
    liquidity: number;
    governance: number;
    security: number;
    adoption: number;
  };
  lastUpdated: number;
}

interface Dao {
  id: string;
  name: string;
  memberCount: number;
  activeMembers: number;
  treasury: number;
  governance: {
    participationRate: number;
    proposalCount: number;
    approvalRate: number;
  };
  health: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface UserBalance {
  [daoId: string]: number;
}

interface Asset {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  price: number;
  value: number;
  change24h: number;
  location: string;
  chain?: string;
}

interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: 'treasury' | 'governance' | 'community';
  priority: 'high' | 'medium' | 'low';
  gain: number;
  risk: 'low' | 'medium' | 'high';
  daoId: string;
  daoName: string;
  timestamp: number;
}

interface ActivityLog {
  id: string;
  daoId: string;
  daoName: string;
  action: string;
  member: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
}

export interface UnifiedDashboardData {
  platform: PlatformMetrics;
  daos: Dao[];
  userBalances: UserBalance;
  assets: Asset[];
  opportunities: Opportunity[];
  activities: ActivityLog[];
  daoNames: Record<string, string>;
  totalNetWorth: number;
  stakingAmount: number;
  poolAmount: number;
}

interface UseUnifiedDashboardDataReturn {
  data: UnifiedDashboardData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lastUpdated: number;
}

// Mock data generators for development
function generateMockPlatformMetrics(): PlatformMetrics {
  return {
    tvl: 25000000,
    assetCount: 142,
    daoCount: 8,
    memberCount: 2541,
    healthScores: {
      treasury: 82,
      liquidity: 75,
      governance: 88,
      security: 91,
      adoption: 68,
    },
    lastUpdated: Date.now(),
  };
}

function generateMockDaos(): Dao[] {
  return [
    {
      id: 'dao-1',
      name: 'MTAA Protocol DAO',
      memberCount: 542,
      activeMembers: 287,
      treasury: 8500000,
      governance: {
        participationRate: 0.68,
        proposalCount: 24,
        approvalRate: 0.87,
      },
      health: 92,
      trend: 'improving',
    },
    {
      id: 'dao-2',
      name: 'Treasury Council',
      memberCount: 89,
      activeMembers: 67,
      treasury: 3200000,
      governance: {
        participationRate: 0.82,
        proposalCount: 18,
        approvalRate: 0.94,
      },
      health: 88,
      trend: 'improving',
    },
    {
      id: 'dao-3',
      name: 'Research & Development',
      memberCount: 156,
      activeMembers: 124,
      treasury: 2100000,
      governance: {
        participationRate: 0.71,
        proposalCount: 31,
        approvalRate: 0.79,
      },
      health: 75,
      trend: 'stable',
    },
    {
      id: 'dao-4',
      name: 'Community Grants',
      memberCount: 1200,
      activeMembers: 542,
      treasury: 5800000,
      governance: {
        participationRate: 0.54,
        proposalCount: 47,
        approvalRate: 0.68,
      },
      health: 62,
      trend: 'declining',
    },
  ];
}

function generateMockUserBalances(): UserBalance {
  return {
    'dao-1': 45000,
    'dao-2': 12000,
    'dao-3': 8500,
    'dao-4': 6200,
  };
}

function generateMockAssets(): Asset[] {
  return [
    {
      id: 'asset-1',
      symbol: 'MTAA',
      name: 'MTAA Token',
      amount: 50000,
      price: 12.50,
      value: 625000,
      change24h: 5.2,
      location: 'MTAA Protocol',
      chain: 'Ethereum',
    },
    {
      id: 'asset-2',
      symbol: 'ETH',
      name: 'Ethereum',
      amount: 25.5,
      price: 2450,
      value: 62475,
      change24h: 3.1,
      location: 'Wallet',
      chain: 'Ethereum',
    },
    {
      id: 'asset-3',
      symbol: 'USDC',
      name: 'USD Coin',
      amount: 100000,
      price: 1.00,
      value: 100000,
      change24h: 0.0,
      location: 'Liquidity Pool',
      chain: 'Ethereum',
    },
    {
      id: 'asset-4',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      amount: 50000,
      price: 1.00,
      value: 50000,
      change24h: 0.1,
      location: 'Staking',
      chain: 'Ethereum',
    },
    {
      id: 'asset-5',
      symbol: 'BTC',
      name: 'Bitcoin',
      amount: 0.8,
      price: 42500,
      value: 34000,
      change24h: 2.8,
      location: 'Wallet',
      chain: 'Bitcoin',
    },
  ];
}

function generateMockOpportunities(): Opportunity[] {
  return [
    {
      id: 'opp-1',
      title: 'Treasury Rebalancing',
      description: 'Rebalance MTAA holdings to optimize for market conditions',
      category: 'treasury',
      priority: 'high',
      gain: 12.5,
      risk: 'low',
      daoId: 'dao-1',
      daoName: 'MTAA Protocol DAO',
      timestamp: Date.now() - 300000,
    },
    {
      id: 'opp-2',
      title: 'Governance Vote',
      description: 'Vote on new fee structure proposal',
      category: 'governance',
      priority: 'high',
      gain: 5.0,
      risk: 'low',
      daoId: 'dao-1',
      daoName: 'MTAA Protocol DAO',
      timestamp: Date.now() - 600000,
    },
    {
      id: 'opp-3',
      title: 'Community Initiative',
      description: 'Support developer grants program expansion',
      category: 'community',
      priority: 'medium',
      gain: 8.3,
      risk: 'medium',
      daoId: 'dao-4',
      daoName: 'Community Grants',
      timestamp: Date.now() - 900000,
    },
  ];
}

function generateMockActivities(): ActivityLog[] {
  return [
    {
      id: 'act-1',
      daoId: 'dao-1',
      daoName: 'MTAA Protocol DAO',
      action: 'voted on proposal #24',
      member: 'alice.eth',
      description: 'Approved the new fee structure',
      status: 'completed',
      timestamp: Date.now() - 120000,
    },
    {
      id: 'act-2',
      daoId: 'dao-2',
      daoName: 'Treasury Council',
      action: 'executed transaction',
      member: 'council.eth',
      description: 'Transferred 500k USDC to liquidity pool',
      status: 'completed',
      timestamp: Date.now() - 240000,
    },
    {
      id: 'act-3',
      daoId: 'dao-3',
      daoName: 'Research & Development',
      action: 'submitted grant application',
      member: 'dev.eth',
      description: 'Q2 2024 research funding request',
      status: 'pending',
      timestamp: Date.now() - 360000,
    },
  ];
}

/**
 * Hook to fetch and manage unified dashboard data
 * Combines data from multiple API endpoints
 */
export function useUnifiedDashboardData(): UseUnifiedDashboardDataReturn {
  const [data, setData] = useState<UnifiedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In production, replace with actual API calls:
      // const [platform, daos, balances, assets, opportunities, activities] = await Promise.all([
      //   fetch('/api/dashboard/metrics').then(r => r.json()),
      //   fetch('/api/elders/kaizen/all-metrics').then(r => r.json()),
      //   fetch('/api/user/balances').then(r => r.json()),
      //   fetch('/api/user/assets').then(r => r.json()),
      //   fetch('/api/elders/kaizen/opportunities').then(r => r.json()),
      //   fetch('/api/admin/activity-logs').then(r => r.json()),
      // ]);

      // Mock data for development
      const platform = generateMockPlatformMetrics();
      const daos = generateMockDaos();
      const userBalances = generateMockUserBalances();
      const assets = generateMockAssets();
      const opportunities = generateMockOpportunities();
      const activities = generateMockActivities();

      const daoNames = daos.reduce((acc, dao) => ({
        ...acc,
        [dao.id]: dao.name,
      }), {});

      const totalNetWorth = Object.values(userBalances).reduce((sum, val) => sum + val, 0);
      const stakingAmount = 80000; // Mock
      const poolAmount = 150000; // Mock

      const combinedData: UnifiedDashboardData = {
        platform,
        daos,
        userBalances,
        assets,
        opportunities,
        activities,
        daoNames,
        totalNetWorth,
        stakingAmount,
        poolAmount,
      };

      setData(combinedData);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    lastUpdated,
  };
}

export default useUnifiedDashboardData;
