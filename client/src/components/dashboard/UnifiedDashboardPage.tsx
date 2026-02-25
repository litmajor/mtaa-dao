import React, { useState, useEffect } from 'react';
import {
  RefreshCcw,
  Settings,
  Wifi,
} from 'lucide-react';
import PlatformOverviewCard from './PlatformOverviewCard';
import DaoTreeSection from './DaoTreeSection';
import UserBalanceSection from './UserBalanceSection';
import AssetListTable from './AssetListTable';
import RealtimeActivityFeed from './RealtimeActivityFeed';
import { useUnifiedDashboardData } from './hooks/useUnifiedDashboardData';
import { useWebSocket, WebSocketMessage } from './hooks/useWebSocket';

export function UnifiedDashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTimeframe, setFilterTimeframe] = useState('30d');
  const [isPaused, setIsPaused] = useState(false);
  const [timeUntilNextUpdate, setTimeUntilNextUpdate] = useState(30);

  // Fetch dashboard data
  const { data, loading, error, refetch, lastUpdated } = useUnifiedDashboardData();

  // Real-time WebSocket connection
  const { connected, reconnecting, messages } = useWebSocket('wss://api.mtaadao.io/ws', {
    enabled: !isPaused,
  });

  // Update countdown timer
  useEffect(() => {
    if (isPaused || !connected) return;

    const interval = setInterval(() => {
      setTimeUntilNextUpdate(prev => (prev > 1 ? prev - 1 : 30));
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, connected]);

  // Process real-time messages
  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    
    switch (latestMessage.type) {
      case 'PLATFORM_METRICS':
      case 'DAO_METRICS':
      case 'OPPORTUNITY':
      case 'MARKET_DATA':
      case 'GLOBAL_METRICS':
      case 'ACTIVITY':
        // In a real implementation, update state with new data
        console.log('[Dashboard] Received update:', latestMessage.type);
        break;
    }
  }, [messages]);

  const handleRefresh = async () => {
    await refetch();
    setTimeUntilNextUpdate(30);
  };

  if (!data && loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <RefreshCcw className="w-8 h-8 text-blue-400" />
          </div>
          <p className="mt-4 text-slate-400">Loading your unified dashboard...</p>
        </div>
      </div>
    );
  }

  const platformData = data?.platform || null;
  const daos = data?.daos || [];
  const userBalances = data?.userBalances || {};
  const assets = data?.assets || [];
  const opportunities = data?.opportunities || [];
  const activities = data?.activities || [];
  const daoNames = data?.daoNames || {};
  const totalNetWorth = data?.totalNetWorth || 0;
  const stakingAmount = data?.stakingAmount || 0;
  const poolAmount = data?.poolAmount || 0;

  // Convert opportunities and activities to activity feed format
  const activityFeedItems = [
    ...opportunities.map(opp => ({
      id: opp.id,
      timestamp: opp.timestamp,
      type: 'opportunity' as const,
      title: opp.title,
      description: opp.description,
      category: opp.category,
      priority: opp.priority,
      gain: opp.gain,
      risk: opp.risk,
      daoId: opp.daoId,
      daoName: opp.daoName,
    })),
    ...activities.map(act => ({
      id: act.id,
      timestamp: act.timestamp,
      type: 'activity' as const,
      daoId: act.daoId,
      daoName: act.daoName,
      action: act.action,
      member: act.member,
      description: act.description,
      status: act.status,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-800/95 backdrop-blur border-b border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">📊 Unified Dashboard</h1>
              <p className="text-slate-400 text-sm mt-1">Family tree view of your DAOs, balances & opportunities</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-700/50 border border-slate-600">
                {connected ? (
                  <>
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400">Connected</span>
                  </>
                ) : reconnecting ? (
                  <>
                    <Wifi className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="text-xs text-amber-400">Reconnecting...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4 text-red-400 opacity-50" />
                    <span className="text-xs text-red-400">Offline</span>
                  </>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCcw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search DAOs, assets, members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Timeframe Filter */}
            <select
              aria-label="Select timeframe filter"
              value={filterTimeframe}
              onChange={(e) => setFilterTimeframe(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="90d">90 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {/* Live/Paused Toggle */}
            <Button
              variant={isPaused ? 'secondary' : 'default'}
              onClick={() => setIsPaused(!isPaused)}
              className="gap-2"
            >
              {isPaused ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Paused
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Live
                </>
              )}
            </Button>
          </div>

          {/* Status Bar */}
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </span>
            <span>
              {isPaused ? 'Updates paused' : `Next update in ${timeUntilNextUpdate}s`}
            </span>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-sm text-red-400">
              {error.message}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Platform Overview */}
        {platformData && (
          <PlatformOverviewCard
            data={{
              tvl: platformData.tvl,
              assetCount: platformData.assetCount,
              daoCount: platformData.daoCount,
              memberCount: platformData.memberCount,
              healthScores: {
                overall: (platformData.healthScores as any)?.treasury || 0,
                treasury: platformData.healthScores?.treasury || 0,
                governance: platformData.healthScores?.governance || 0,
                community: (platformData.healthScores as any)?.liquidity || 0,
                system: (platformData.healthScores as any)?.security || 0,
              },
            }}
            loading={loading}
            lastUpdated={new Date(lastUpdated || Date.now())}
          />
        )}

        {/* Tree View: DAOs, Balances, Assets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: DAO Tree */}
          <div className="lg:col-span-2">
            <DaoTreeSection
              daos={daos}
              userBalances={userBalances}
              loading={loading}
              searchQuery={searchQuery}
            />
          </div>

          {/* Right: Balance Summary */}
          <div className="lg:col-span-1">
            <UserBalanceSection
              balances={userBalances}
              daoNames={daoNames}
              totalNetWorth={totalNetWorth}
              stakingAmount={stakingAmount}
              poolAmount={poolAmount}
              loading={loading}
            />
          </div>
        </div>

        {/* Assets Table */}
        <AssetListTable
          assets={assets}
          loading={loading}
          onExport={() => {
            const csv = [
              ['Symbol', 'Name', 'Amount', 'Price', 'Value', '24h Change', 'Location'],
              ...assets.map(a => [
                a.symbol,
                a.name,
                a.amount,
                a.price,
                a.value,
                a.change24h,
                a.location,
              ]),
            ]
              .map(row => row.join(','))
              .join('\n');
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `assets-${new Date().toISOString()}.csv`;
            a.click();
          }}
        />

        {/* Real-time Activity Feed */}
        <RealtimeActivityFeed
          activities={activityFeedItems}
          loading={loading}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-800/50">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-slate-400">
          <p>Real-time data synced across {filterTimeframe} • {daos.length} DAOs • {assets.length} Assets</p>
        </div>
      </footer>
    </div>
  );
}

export default UnifiedDashboardPage;
