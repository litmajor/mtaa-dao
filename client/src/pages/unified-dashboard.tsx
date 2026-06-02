import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
// Workspace-driven UI (replaces tab-centric approach)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/pages/hooks/useAuth';
import { useTheme } from '@/components/theme-provider';
import { apiRequest } from '@/lib/queryClient';
import {
  Settings,
  TrendingUp,
  RefreshCw,
  Wallet,
} from 'lucide-react';

// Hooks for data fetching
import {
  usePlatformMetrics,
  useUserDAOs,
  useDaoMetricsMultiple,
  useArbitrageOpportunities,
  useGlobalMetrics,
  useActivityLogs,
} from '@/hooks/useDashboardData';

import Shell from '../components/ui/shell';
import { Grid } from '../components/ui/grid';
import SystemStateProvider, { useSystemState, deriveOperationalMode, OperationalMode } from '../context/systemState';

// Sub-components (stub implementations, can be replaced with proper components later)
const PlatformOverviewCard = ({ data, isLoading }: any) => (
  <Card className="bg-slate-800 border-slate-700">
    <CardHeader>
      <CardTitle>Platform Overview</CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? 'Loading...' : `${data?.totalAssets || 0} assets`}
    </CardContent>
  </Card>
);

const DaoCardTree = ({ daos, metricsData, isLoading, expandAll }: any) => (
  <Card className="bg-slate-800 border-slate-700">
    <CardHeader>
      <CardTitle>DAOs ({daos?.length || 0})</CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? 'Loading...' : daos?.map((dao: any) => (
        <div key={dao.id} className="py-2 border-b border-slate-700 last:border-b-0">
          {dao.name}
        </div>
      ))}
    </CardContent>
  </Card>
);

const UserBalanceSection = ({ daos, metricsData, isLoading }: any) => (
  <Card className="bg-slate-800 border-slate-700">
    <CardHeader>
      <CardTitle>Balance</CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? 'Loading...' : 'Aggregated Balance'}
    </CardContent>
  </Card>
);

const AssetListTable = ({ daos, metricsData }: any) => (
  <Card className="bg-slate-800 border-slate-700">
    <CardHeader>
      <CardTitle>Assets</CardTitle>
    </CardHeader>
    <CardContent>
      Asset list table coming soon...
    </CardContent>
  </Card>
);

const RealtimeActivityFeed = ({ opportunities, globalMetrics, activityLogs, isLoading }: any) => (
  <Card className="bg-slate-800 border-slate-700">
    <CardHeader>
      <CardTitle>Activity Feed</CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? 'Loading...' : 'Real-time activity feed coming soon...'}
    </CardContent>
  </Card>
);

const TradingDashboard = () => (
  <Card className="surface-raised">
    <CardHeader>
      <CardTitle>Trading Dashboard</CardTitle>
    </CardHeader>
    <CardContent>
      Trading interface coming soon...
    </CardContent>
  </Card>
);

import { PageLoading } from '@/components/ui/page-loading';

interface UnifiedDashboardProps {
  userId?: string;
}

export function UnifiedDashboard({ userId }: UnifiedDashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Data fetching hooks
  const platformMetrics = usePlatformMetrics();
  const userDAOs = useUserDAOs();
  const arbitrageOps = useArbitrageOpportunities();
  const globalMetrics = useGlobalMetrics();
  const activityLogs = useActivityLogs();

  // Get DAO metrics for all user DAOs
  const daoIds = useMemo(
    () => (userDAOs.data ? userDAOs.data.map((dao: any) => dao.id) : []),
    [userDAOs.data]
  );
  const daoMetricsQueries = useDaoMetricsMultiple(daoIds);

  // Process DAO metrics data
  const daoMetricsData = useMemo(() => {
    return daoMetricsQueries
      .filter((q: any) => q.data)
      .map((q: any) => q.data)
      .reduce((acc: any, item: any) => {
        acc[item.daoId] = item.metrics;
        return acc;
      }, {});
  }, [daoMetricsQueries]);

  // Workspace state (Layered operational domains)
  // local fallback workspace for quick interactions (kept for legacy toggles)
  const [workspace, setWorkspace] = useState<OperationalMode>('network');

  // Top strip: system heartbeat (Layer 1)
  const TopStrip = ({ currentMode, onSetMode }: { currentMode: OperationalMode, onSetMode: (m: OperationalMode) => void }) => (
    <div className="w-full bg-slate-800/40 border-b border-slate-700 text-slate-300 text-sm py-2 px-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-xs text-slate-400">Portfolio</span>
          <span className="font-semibold">${(platformMetrics.data as any)?.totalAssets || 0}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-slate-400">Active Alerts</span>
          <span className="font-semibold text-amber-400">{hasErrors ? '⚠️' : '—'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-slate-400">Connectivity</span>
          <span className="font-semibold">{(platformMetrics.data as any)?.connectedExchanges ?? '—'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-xs text-slate-400">Workspace</div>
        <div className="flex items-center gap-2">
          <button onClick={() => { onSetMode('network'); }} className={`px-3 py-1 rounded ${currentMode==='network'? 'bg-slate-700 text-white' : 'text-slate-300'}`}>Network</button>
          <button onClick={() => { onSetMode('governance'); }} className={`px-3 py-1 rounded ${currentMode==='governance'? 'bg-slate-700 text-white' : 'text-slate-300'}`}>Governance</button>
          <button onClick={() => { onSetMode('capital'); }} className={`px-3 py-1 rounded ${currentMode==='capital'? 'bg-slate-700 text-white' : 'text-slate-300'}`}>Capital</button>
          <button onClick={() => { onSetMode('execution'); }} className={`px-3 py-1 rounded ${currentMode==='execution'? 'bg-slate-700 text-white' : 'text-slate-300'}`}>Execution</button>
          <button onClick={() => { onSetMode('intelligence'); }} className={`px-3 py-1 rounded ${currentMode==='intelligence'? 'bg-slate-700 text-white' : 'text-slate-300'}`}>Intelligence</button>
        </div>
      </div>
    </div>
  );

  // Active priorities (Layer 2)
  const ActivePriorities = ({ currentMode }: { currentMode: OperationalMode }) => {
    const topAnomalies = activityLogs.data?.slice(0,3) || [];
    const priorityClass = currentMode === 'execution' ? 'motion-priority-1' : currentMode === 'capital' ? 'motion-priority-2' : currentMode === 'intelligence' ? 'motion-priority-3' : 'motion-priority-4';
    return (
      <div className={`w-full bg-slate-800/20 border border-slate-700 rounded-lg p-4 mb-4 text-slate-200 ${priorityClass}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Active Priorities</div>
            <div className="font-semibold">{topAnomalies.length} items</div>
          </div>
          <div className="text-sm text-slate-400">Adaptive intelligence will surface risk, opportunities, and actions here.</div>
        </div>
      </div>
    );
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    const refetchQueries = [
      platformMetrics as any,
      userDAOs as any,
      arbitrageOps as any,
      globalMetrics as any,
      activityLogs as any,
    ].filter((q: any) => q.refetch);

    await Promise.all(
      refetchQueries.map((q: any) => q.refetch())
    );
    setRefreshing(false);
  };

  

  // Logout handler
  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      navigate('/login');
      window.location.reload();
    } catch (e) {
      alert('Logout failed');
    }
  };

  // Check wallet connection (WalletConnect/MetaMask)
  const isWalletConnected = typeof window !== 'undefined' && 
    !!(window as any).ethereum || !!(window as any).web3;

  // Error handling
  const hasErrors = [
    platformMetrics.isError,
    userDAOs.isError,
    arbitrageOps.isError,
    globalMetrics.isError,
    activityLogs.isError,
  ].some(Boolean);

  // Loading state
  const isLoading =
    platformMetrics.isLoading ||
    userDAOs.isLoading ||
    (daoIds.length > 0 && daoMetricsQueries.some(q => q.isLoading));

  if (isLoading && !platformMetrics.data) {
    return <PageLoading message="Loading Unified Dashboard..." />;
  }

  // Dashboard content component (consumes SystemState)
  function DashboardContentInner() {
    const { state, setMode, pushNarrative } = useSystemState();
    const [localMode, setLocalMode] = useState<OperationalMode>(state.mode);

    const derived = deriveOperationalMode({
      treasuryHealth: (platformMetrics.data as any)?.treasuryHealth ?? 100,
      executionLoad: (activityLogs.data?.length || 0) / 100,
      governancePressure: (userDAOs.data ? userDAOs.data.length / 10 : 0),
      anomalies: (activityLogs.data?.filter((a: any) => a.severity && a.severity > 7).length || 0) / Math.max(1, (activityLogs.data || []).length),
      liquidityRisk: (platformMetrics.data as any)?.liquidityRisk ?? 0,
    });

    useEffect(() => {
      if (derived !== state.mode) {
        pushNarrative(`Mode auto-suggested: ${derived} (signals changed)`);
        setMode(derived);
        setLocalMode(derived);
      }
    }, [derived]);

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <TopStrip currentMode={localMode} onSetMode={(m) => { setMode(m); setLocalMode(m); }} />
        <div className="mt-4">
          <ActivePriorities currentMode={localMode} />

          <div className="mt-4">
            {state.mode === 'network' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  {platformMetrics.data && <PlatformOverviewCard data={platformMetrics.data} isLoading={platformMetrics.isLoading} />}
                  {userDAOs.data && <DaoCardTree daos={userDAOs.data} metricsData={daoMetricsData} isLoading={daoMetricsQueries.some(q => q.isLoading)} />}
                </div>
                <div>
                  <RealtimeActivityFeed opportunities={arbitrageOps.data || []} globalMetrics={globalMetrics.data} activityLogs={activityLogs.data || []} isLoading={activityLogs.isLoading || arbitrageOps.isLoading || globalMetrics.isLoading} />
                </div>
              </div>
            )}

            {state.mode === 'governance' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <DaoCardTree daos={userDAOs.data || []} metricsData={daoMetricsData} isLoading={daoMetricsQueries.some(q => q.isLoading)} />
                </div>
                <div>
                  <UserBalanceSection daos={userDAOs.data || []} metricsData={daoMetricsData} isLoading={daoMetricsQueries.some(q => q.isLoading)} />
                </div>
              </div>
            )}

            {state.mode === 'capital' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <AssetListTable daos={userDAOs.data || []} metricsData={daoMetricsData} />
                </div>
                <div>
                  {platformMetrics.data && <PlatformOverviewCard data={platformMetrics.data} isLoading={platformMetrics.isLoading} />}
                </div>
              </div>
            )}

            {state.mode === 'execution' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <TradingDashboard />
                </div>
                <div>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle>Execution Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-400">Live orders, positions, and routing insights appear here.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {state.mode === 'intelligence' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <RealtimeActivityFeed opportunities={arbitrageOps.data || [] } globalMetrics={globalMetrics.data} activityLogs={activityLogs.data || []} isLoading={activityLogs.isLoading || arbitrageOps.isLoading || globalMetrics.isLoading} />
                </div>
                <div>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle>Analytics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-400">Aggregate insights and anomaly detection.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <SystemStateProvider>
      <Shell
        brand={
          <div>
            <h1 className="text-3xl font-bold text-white">📊 Dashboard</h1>
            <p className="text-slate-400 mt-1">Real-time metrics, opportunities, and activity across all DAOs</p>
          </div>
        }
        userActions={
          <div className="flex items-center gap-3">
            {/* Wallet Connect Button */}
            {!isWalletConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/wallet-setup')}
                className="gap-2 bg-blue-600/20 border-blue-500 hover:bg-blue-600/30 text-blue-300"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </Button>
            )}

            {/* Theme Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="gap-2"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <span>🔒</span>
              ) : (
                <span>🔓</span>
              )}
            </Button>

            {/* Settings */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
            </Button>

            {/* Profile Dropdown */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="gap-2 flex items-center"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={(user as any)?.avatar} alt={(user as any)?.name || 'User'} />
                  <AvatarFallback className="bg-blue-600 text-white text-xs">
                    {((user as any)?.name || (user as any)?.email || 'U')?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                ≡
              </Button>

              {/* Profile Dropdown Menu */}
              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                  <div className="p-4 border-b border-slate-700">
                    <p className="text-sm font-medium text-white">{(user as any)?.name || (user as any)?.email || 'User'}</p>
                    <p className="text-xs text-slate-400 truncate">{(user as any)?.email}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        navigate('/profile');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors"
                    >
                      👤 Profile
                    </button>
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors"
                    >
                      ⚙️ Settings
                    </button>
                    <button
                      onClick={() => {
                        navigate('/wallet');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors"
                    >
                      💳 Wallet
                    </button>
                    <div className="border-t border-slate-700 my-1" />
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowProfileDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-950/30 rounded transition-colors flex items-center gap-2"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      >

        {/* Status Bar */}
        <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <div />
            </div>

            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${hasErrors ? 'bg-red-500' : 'bg-green-500'}`} />
                {hasErrors ? 'Some data unavailable' : 'All systems connected'}
              </span>
              <span>
                {platformMetrics.data ? `Last updated: ${new Date().toLocaleTimeString()}` : 'Initializing...'}
              </span>
              <span>
                {(platformMetrics.data as any)?.totalAssets ? `${((platformMetrics.data as any).totalAssets).toLocaleString()} assets` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {hasErrors && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Alert variant="destructive">
              ⚠️
              <AlertDescription>
                Some data sources are unavailable. Showing cached data. Please try refreshing.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DashboardContentInner />

        {/* Footer */}
        <div className="border-t border-slate-700 bg-slate-900/50 backdrop-blur-sm py-4 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <div>
                Last synced: {platformMetrics.data ? new Date().toLocaleTimeString() : '—'}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Auto-refresh
                </label>
                <span>
                  {(platformMetrics.data as any)
                    ? `${((platformMetrics.data as any).totalMembers || 0)} members`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Shell>
    </SystemStateProvider>
  );
}

export default UnifiedDashboard;
