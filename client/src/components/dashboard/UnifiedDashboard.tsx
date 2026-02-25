import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Settings, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlatformOverviewCard } from './PlatformOverviewCard';
import { DaoTreeSection } from './DaoTreeSection';
import { UserBalanceSection } from './UserBalanceSection';
import { AssetListTable } from './AssetListTable';
import { RealtimeActivityFeed } from './RealtimeActivityFeed';
import { useUnifiedDashboardData } from './hooks/useUnifiedDashboardData';
import { useWebSocket } from './hooks/useWebSocket';

export function UnifiedDashboard() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTimeframe, setFilterTimeframe] = useState('7d');
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Load dashboard data
  const { data, loading, error, refetch } = useUnifiedDashboardData(filterTimeframe);

  // WebSocket for real-time updates
  const { messages, connected } = useWebSocket(!isPaused);

  // Update data when WebSocket messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setLastUpdated(new Date());
    }
  }, [messages]);

  const handleRefresh = async () => {
    await refetch();
    setLastUpdated(new Date());
  };

  const timeUntilNextUpdate = Math.max(0, 30 - Math.floor((Date.now() - lastUpdated.getTime()) / 1000));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                📊 UNIFIED DASHBOARD
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                Tree view of all your DAOs, balances, and real-time market opportunities
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <div className={`px-3 py-2 rounded-md text-xs font-medium ${
                connected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
              }`}>
                {connected ? '● Connected' : '● Reconnecting'}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search DAOs, assets, members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <select
              value={filterTimeframe}
              onChange={(e) => setFilterTimeframe(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            <Button
              onClick={() => setIsPaused(!isPaused)}
              variant="outline"
              size="sm"
              className={isPaused ? 'bg-slate-700' : ''}
            >
              {isPaused ? 'Paused' : 'Live'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Platform Overview */}
        <PlatformOverviewCard
          data={data?.platform}
          loading={loading}
          lastUpdated={lastUpdated}
        />

        {/* DAOs Tree Section */}
        <DaoTreeSection
          daos={data?.daos || []}
          userBalances={data?.userBalances || {}}
          loading={loading}
          searchQuery={searchQuery}
        />

        {/* User Balance Aggregation */}
        <UserBalanceSection
          balances={data?.userBalances}
          daos={data?.daos || []}
          loading={loading}
        />

        {/* Asset List Table */}
        <AssetListTable
          assets={data?.assets || []}
          loading={loading}
        />

        {/* Real-time Activity Feed */}
        <RealtimeActivityFeed
          opportunities={data?.opportunities || []}
          activities={data?.activities || []}
          marketData={data?.marketData || {}}
          globalMetrics={data?.globalMetrics}
          isPaused={isPaused}
          timeUntilNextUpdate={timeUntilNextUpdate}
          wsMessages={messages}
          loading={loading}
        />

        {/* Footer */}
        <div className="text-center text-sm text-slate-400 py-4 border-t border-slate-700/50">
          <div className="flex items-center justify-center gap-4">
            <span>Last synced: {lastUpdated.toLocaleTimeString()}</span>
            <span>●</span>
            <span className={connected ? 'text-green-400' : 'text-red-400'}>
              {connected ? 'Connected via WebSocket' : 'Using HTTP polling'}
            </span>
            <span>●</span>
            <span>Next update in {timeUntilNextUpdate}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UnifiedDashboard;
