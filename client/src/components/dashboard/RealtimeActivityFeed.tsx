import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Note: Some lucide-react icons are not available, using available alternatives
import {
  TrendingUp,
  Activity,
  CheckCircle,
  ArrowUpRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
// Virtualized list for performance - using simple array map instead
// import { FixedSizeList } from 'react-window';

// Types for activity items
type ActivityType = 'opportunity' | 'defi' | 'arbitrage' | 'market' | 'global' | 'activity';

interface BaseActivity {
  id: string;
  timestamp: number;
  type: ActivityType;
}

interface OpportunityActivity extends BaseActivity {
  type: 'opportunity';
  title: string;
  description: string;
  category: 'treasury' | 'governance' | 'community';
  priority: 'high' | 'medium' | 'low';
  gain: number;
  risk: 'low' | 'medium' | 'high';
  daoId: string;
  daoName: string;
}

interface DefiActivity extends BaseActivity {
  type: 'defi';
  poolName: string;
  apy: number;
  tvl: number;
  userPotential: number;
  chain: string;
}

interface ArbitrageActivity extends BaseActivity {
  type: 'arbitrage';
  assetSymbol: string;
  buyVenue: string;
  sellVenue: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPercentage: number;
}

interface MarketDataActivity extends BaseActivity {
  type: 'market';
  exchange: string;
  assetSymbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

interface GlobalMetricsActivity extends BaseActivity {
  type: 'global';
  metric: 'fear-greed' | 'btc-dominance' | 'market-cap' | 'volume' | 'eth-gas' | 'top-movers';
  value: number;
  change?: number;
  description: string;
}

interface DaoActivityLog extends BaseActivity {
  type: 'activity';
  daoId: string;
  daoName: string;
  action: string;
  member: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
}

type Activity = OpportunityActivity | DefiActivity | ArbitrageActivity | MarketDataActivity | GlobalMetricsActivity | DaoActivityLog;

interface RealtimeActivityFeedProps {
  activities: Activity[];
  loading?: boolean;
  onActivityClick?: (activity: Activity) => void;
}

// Activity Item Components
function OpportunityCard({ activity }: { activity: OpportunityActivity }) {
  const priorityColor =
    activity.priority === 'high' ? 'text-red-400' :
    activity.priority === 'medium' ? 'text-amber-400' :
    'text-green-400';

  const riskColor =
    activity.risk === 'high' ? 'bg-red-900/30' :
    activity.risk === 'medium' ? 'bg-amber-900/30' :
    'bg-green-900/30';

  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
      <div className="flex items-start gap-3">
        <Star className={`w-5 h-5 ${priorityColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-white">{activity.title}</h4>
            <span className={`text-xs px-2 py-0.5 rounded ${riskColor}`}>
              {activity.risk} risk
            </span>
            <span className="text-xs text-slate-400">
              {activity.daoName}
            </span>
          </div>
          <p className="text-sm text-slate-300 mt-1">{activity.description}</p>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="font-semibold text-emerald-400">+{activity.gain}% gain</span>
            <span className="text-slate-400">
              {new Date(activity.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DefiCard({ activity }: { activity: DefiActivity }) {
  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
      <div className="flex items-start gap-3">
        <ZapIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white">{activity.poolName}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{activity.chain}</p>
          <div className="grid grid-cols-3 gap-3 mt-2 text-sm">
            <div>
              <p className="text-slate-400 text-xs">APY</p>
              <p className="font-semibold text-emerald-400">{activity.apy.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">TVL</p>
              <p className="font-semibold text-white">${(activity.tvl / 1000000).toFixed(0)}M</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Your Potential</p>
              <p className="font-semibold text-blue-400">${activity.userPotential.toFixed(0)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArbitrageCard({ activity }: { activity: ArbitrageActivity }) {
  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
      <div className="flex items-start gap-3">
        <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white">{activity.assetSymbol} Arbitrage</h4>
          <div className="flex items-center gap-2 text-sm mt-1 flex-wrap">
            <span className="text-slate-300">{activity.buyVenue}</span>
            <ArrowUpRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-300">{activity.sellVenue}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Buy Price</p>
              <p className="font-semibold text-white">${activity.buyPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Sell Price</p>
              <p className="font-semibold text-white">${activity.sellPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Profit</p>
              <p className="font-semibold text-emerald-400">+{activity.profitPercentage.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketDataCard({ activity }: { activity: MarketDataActivity }) {
  const priceColor = activity.change24h >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
      <div className="flex items-start gap-3">
        <BarChart2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-white">{activity.assetSymbol}</h4>
            <span className="text-xs text-slate-400">{activity.exchange}</span>
          </div>
          <p className="text-sm text-slate-300 mt-1">
            ${activity.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className={`font-semibold ${priceColor}`}>
              {activity.change24h >= 0 ? '+' : ''}{activity.change24h.toFixed(2)}%
            </span>
            <span className="text-slate-400">
              Vol: ${(activity.volume24h / 1000000).toFixed(0)}M
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobalMetricsCard({ activity }: { activity: GlobalMetricsActivity }) {
  const metricLabels: Record<string, string> = {
    'fear-greed': 'Fear & Greed Index',
    'btc-dominance': 'BTC Dominance',
    'market-cap': 'Total Market Cap',
    'volume': '24h Volume',
    'eth-gas': 'ETH Gas',
    'top-movers': 'Top Movers',
  };

  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
      <div className="flex items-start gap-3">
        <GlobeIcon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white">{metricLabels[activity.metric]}</h4>
          <p className="text-sm text-slate-300 mt-1">{activity.description}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-bold text-white">{activity.value}</span>
            {activity.change !== undefined && (
              <span className={`text-sm font-semibold ${
                activity.change >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {activity.change >= 0 ? '+' : ''}{activity.change.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activity }: { activity: DaoActivityLog }) {
  const statusIcon =
    activity.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
    activity.status === 'failed' ? <AlertOctagon className="w-4 h-4 text-red-400" /> :
    <ClockIcon className="w-4 h-4 text-amber-400" />;

  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
      <div className="flex items-start gap-3">
        <Activity className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-white">{activity.daoName}</h4>
            {statusIcon}
          </div>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-blue-400">{activity.member}</span>
            {' '}
            {activity.action}
          </p>
          <p className="text-xs text-slate-400 mt-1">{activity.description}</p>
          <p className="text-xs text-slate-500 mt-1">
            {new Date(activity.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// Main Feed Component
export function RealtimeActivityFeed({
  activities,
  loading = false,
  onActivityClick,
}: RealtimeActivityFeedProps) {
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (filterType === 'all') {
      return activities;
    }
    return activities.filter(a => a.type === filterType);
  }, [activities, filterType]);

  // Render activity item
  const renderActivityItem = useCallback((activity: Activity) => {
    switch (activity.type) {
      case 'opportunity':
        return <OpportunityCard activity={activity as OpportunityActivity} />;
      case 'defi':
        return <DefiCard activity={activity as DefiActivity} />;
      case 'arbitrage':
        return <ArbitrageCard activity={activity as ArbitrageActivity} />;
      case 'market':
        return <MarketDataCard activity={activity as MarketDataActivity} />;
      case 'global':
        return <GlobalMetricsCard activity={activity as GlobalMetricsActivity} />;
      case 'activity':
        return <ActivityCard activity={activity as DaoActivityLog} />;
      default:
        return null;
    }
  }, []);

  if (loading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  const tabs: { label: string; type: ActivityType | 'all'; icon: React.ReactNode }[] = [
    { label: 'All', type: 'all', icon: <Activity className="w-4 h-4" /> },
    { label: 'Opportunities', type: 'opportunity', icon: <Sparkles className="w-4 h-4" /> },
    { label: 'DeFi', type: 'defi', icon: <Zap className="w-4 h-4" /> },
    { label: 'Arbitrage', type: 'arbitrage', icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'Markets', type: 'market', icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Global', type: 'global', icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Real-time Activity Feed
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
          >
            {autoScroll ? '⏸ Pause' : '▶ Live'}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.type}
              onClick={() => setFilterType(tab.type)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg whitespace-nowrap text-sm transition-colors ${
                filterType === tab.type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {filteredActivities.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-400">No activities yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {filteredActivities.map(activity => (
              <div
                key={activity.id}
                onClick={() => onActivityClick?.(activity)}
                className="cursor-pointer transition-transform hover:scale-105"
              >
                {renderActivityItem(activity)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RealtimeActivityFeed;
