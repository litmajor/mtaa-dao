import { useState, useEffect, useCallback } from 'react';
import type { UnifiedDashboardDao } from '../../../../../shared/types/dao';

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

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

// Re-export shared type so consumers can import it from here
export type { UnifiedDashboardDao };

export interface UnifiedDashboardData {
  platform: PlatformMetrics;
  daos: UnifiedDashboardDao[];
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

// ---------------------------------------------------------------------------
// Normalisers
// ---------------------------------------------------------------------------

function normalizeApiDaos(raw: any[]): UnifiedDashboardDao[] {
  return (raw || []).map((d: any) => ({
    id: d.id,
    name: d.name || 'Unnamed Group',
    memberCount: d.memberCount ?? d.members ?? 0,
    activeMembers: d.activeMembers ?? Math.floor((d.memberCount ?? d.members ?? 0) * 0.6),
    treasury: parseFloat(d.treasuryBalance ?? d.treasury ?? '0'),
    governance: {
      participationRate: d.governance?.participationRate ?? 0,
      proposalCount: d.governance?.proposalCount ?? 0,
      approvalRate: d.governance?.approvalRate ?? 0,
    },
    health: d.health ?? 50,
    trend: (d.trend as 'improving' | 'stable' | 'declining') ?? 'stable',
  }));
}

function normalizeVaults(raw: any[]): Asset[] {
  return (raw || []).map((v: any, i: number) => ({
    id: v.id ?? `vault-${i}`,
    symbol: v.currency ?? v.symbol ?? 'cUSD',
    name: v.name ?? 'Vault',
    amount: parseFloat(v.balance ?? '0'),
    price: 1,
    value: parseFloat(v.balance ?? '0'),
    change24h: 0,
    location: v.name ?? 'DAO Vault',
    chain: 'Celo',
  }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUnifiedDashboardData(): UseUnifiedDashboardDataReturn {
  const [data, setData] = useState<UnifiedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const fetchJson = async (url: string, fallback: any = null) => {
        try {
          const res = await fetch(url, { credentials: 'include' });
          if (!res.ok) return fallback;
          return await res.json();
        } catch {
          return fallback;
        }
      };

      const [statsRaw, myDaosRaw, vaultsRaw] = await Promise.all([
        fetchJson('/api/dashboard/stats', {}),
        fetchJson('/api/v1/users/my-daos', []),
        fetchJson('/api/dashboard/vaults', []),
      ]);

      const daos = normalizeApiDaos(Array.isArray(myDaosRaw) ? myDaosRaw : []);
      const assets = normalizeVaults(Array.isArray(vaultsRaw) ? vaultsRaw : []);

      const userBalances: UserBalance = {};
      daos.forEach(dao => { userBalances[dao.id] = dao.treasury; });

      const platform: PlatformMetrics = {
        tvl: statsRaw.treasuryBalance ?? assets.reduce((s: number, a: Asset) => s + a.value, 0),
        assetCount: assets.length,
        daoCount: daos.length,
        memberCount: daos.reduce((s, d) => s + d.memberCount, 0),
        healthScores: {
          treasury: 75,
          liquidity: 65,
          governance: statsRaw.activeProposals ? Math.min(100, statsRaw.activeProposals * 10) : 50,
          security: 90,
          adoption: daos.length > 0 ? Math.min(100, daos.length * 15) : 30,
        },
        lastUpdated: Date.now(),
      };

      const daoNames = daos.reduce<Record<string, string>>((acc, dao) => {
        acc[dao.id] = dao.name;
        return acc;
      }, {});

      const totalNetWorth = Object.values(userBalances).reduce((s, v) => s + v, 0);

      setData({
        platform,
        daos,
        userBalances,
        assets,
        opportunities: [],
        activities: [],
        daoNames,
        totalNetWorth,
        stakingAmount: 0,
        poolAmount: 0,
      });
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData, lastUpdated };
}

export default useUnifiedDashboardData;
