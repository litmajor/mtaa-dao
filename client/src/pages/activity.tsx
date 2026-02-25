import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpRight, ArrowDownLeft, Send, LogIn, LogOut,
  Gift, Zap, Filter, Download, Calendar, Search, TrendingUp, DollarSign,
  Wallet, Lock, Shuffle, Plus, Minus, Eye, EyeOff, Users, Zap as ZapIcon,
  LogOut as LogoutIcon, Eye as EyeIcon, CreditCard, Building2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ActivityType = 'transaction' | 'session' | 'dao' | 'governance' | 'reward' | 'escrow';
type ActivityStatus = 'completed' | 'pending' | 'failed';

interface Activity {
  id: string;
  type: ActivityType;
  category: 'send' | 'receive' | 'deposit' | 'withdraw' | 'swap' | 'claim' | 'bridge' | 'stake' | 'unstake' | 'login' | 'logout' | 'proposal' | 'vote' | 'escrow' | 'reward';
  description: string;
  details?: string;
  amount?: number;
  currency?: string;
  status: ActivityStatus;
  date: Date;
  hash?: string;
  fromAddress?: string;
  toAddress?: string;
  metadata?: {
    ipAddress?: string;
    deviceType?: string;
    location?: string;
    daoName?: string;
    proposalId?: string;
  };
}

// Mock data for demo - aggregated from sessions, transactions, DAO activity
const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'session',
    category: 'login',
    description: 'Logged in from Chrome',
    status: 'completed',
    date: new Date(Date.now() - 5 * 60 * 1000),
    metadata: { deviceType: 'Desktop', ipAddress: '192.168.1.100', location: 'San Francisco, CA' }
  },
  {
    id: '2',
    type: 'transaction',
    category: 'receive',
    description: 'Received from DAO Treasury',
    amount: 1500,
    currency: 'cUSD',
    status: 'completed',
    date: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '3',
    type: 'dao',
    category: 'vote',
    description: 'Voted on Proposal #42',
    details: 'Treasury Reallocation - Voted YES',
    status: 'completed',
    date: new Date(Date.now() - 3 * 60 * 60 * 1000),
    metadata: { daoName: 'MtaaDAO', proposalId: '42' }
  },
  {
    id: '4',
    type: 'transaction',
    category: 'deposit',
    description: 'Deposited to Vault',
    amount: 500,
    currency: 'cEUR',
    status: 'completed',
    date: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: '5',
    type: 'reward',
    category: 'claim',
    description: 'Claimed Rewards',
    amount: 250,
    currency: 'CELO',
    status: 'completed',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: '6',
    type: 'transaction',
    category: 'swap',
    description: 'Swapped CELO for cUSD',
    amount: 100,
    currency: 'CELO',
    status: 'completed',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '7',
    type: 'session',
    category: 'logout',
    description: 'Logged out',
    status: 'completed',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    metadata: { deviceType: 'Mobile', location: 'New York, NY' }
  },
  {
    id: '8',
    type: 'dao',
    category: 'proposal',
    description: 'New proposal created',
    details: 'Community Fund Allocation - 50,000 cUSD',
    status: 'pending',
    date: new Date(Date.now() - 15 * 60 * 60 * 1000),
    metadata: { daoName: 'MtaaDAO', proposalId: '43' }
  },
  {
    id: '9',
    type: 'escrow',
    category: 'escrow',
    description: 'Escrow transaction initiated',
    amount: 1000,
    currency: 'cUSD',
    status: 'pending',
    date: new Date(Date.now() - 20 * 60 * 60 * 1000),
  },
  {
    id: '10',
    type: 'transaction',
    category: 'bridge',
    description: 'Cross-chain bridge',
    amount: 1000,
    currency: 'cUSD',
    status: 'completed',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: '11',
    type: 'transaction',
    category: 'stake',
    description: 'Staked for governance',
    amount: 5000,
    currency: 'CELO',
    status: 'completed',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: '12',
    type: 'transaction',
    category: 'withdraw',
    description: 'Withdrew from Vault',
    amount: 250,
    currency: 'cUSD',
    status: 'completed',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
];

function getActivityIcon(type: ActivityType, category: string) {
  const iconProps = { className: 'w-5 h-5' };
  
  // Session activities
  if (type === 'session') {
    if (category === 'login') return <LogIn {...iconProps} />;
    if (category === 'logout') return <LogOut {...iconProps} />;
  }
  
  // Transaction categories
  if (type === 'transaction') {
    switch (category) {
      case 'send': return <Send {...iconProps} />;
      case 'receive': return <ArrowDownLeft {...iconProps} />;
      case 'deposit': return <Plus {...iconProps} />;
      case 'withdraw': return <Minus {...iconProps} />;
      case 'claim': return <Gift {...iconProps} />;
      case 'swap': return <Shuffle {...iconProps} />;
      case 'bridge': return <Shuffle {...iconProps} />;
      case 'stake': return <Lock {...iconProps} />;
      default: return <Wallet {...iconProps} />;
    }
  }
  
  // DAO activities
  if (type === 'dao') {
    if (category === 'vote') return <TrendingUp {...iconProps} />;
    if (category === 'proposal') return <Building2 {...iconProps} />;
  }
  
  // Governance
  if (type === 'governance') {
    return <Users {...iconProps} />;
  }
  
  // Rewards
  if (type === 'reward') {
    return <Gift {...iconProps} />;
  }
  
  // Escrow
  if (type === 'escrow') {
    return <Lock {...iconProps} />;
  }
  
  return <Wallet {...iconProps} />;
}

function getStatusBadge(status: ActivityStatus) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800 animate-pulse">Pending</Badge>;
    case 'failed':
      return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
  }
}

function getActivityTypeColor(type: ActivityType): string {
  switch (type) {
    case 'transaction': return 'bg-blue-100 text-blue-600';
    case 'session': return 'bg-purple-100 text-purple-600';
    case 'dao': return 'bg-orange-100 text-orange-600';
    case 'governance': return 'bg-indigo-100 text-indigo-600';
    case 'reward': return 'bg-green-100 text-green-600';
    case 'escrow': return 'bg-red-100 text-red-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>(mockActivities);
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ActivityStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredActivities = activities.filter((activity) => {
    if (filterType !== 'all' && activity.type !== filterType) return false;
    if (filterStatus !== 'all' && activity.status !== filterStatus) return false;
    if (searchTerm && !activity.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Calculate stats by type
  const stats = {
    transactions: activities.filter((a) => a.type === 'transaction' && a.status === 'completed').length,
    sessions: activities.filter((a) => a.type === 'session').length,
    dao: activities.filter((a) => a.type === 'dao').length,
    pending: activities.filter((a) => a.status === 'pending').length,
  };

  const totalVolume = activities
    .filter((a) => a.type === 'transaction' && a.status === 'completed')
    .reduce((sum, a) => sum + (a.amount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Activity</h1>
              <p className="text-gray-600">Transactions, sessions, DAO governance, and account activity all in one place</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                Date Range
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6 bg-white/80 backdrop-blur-xl border border-white/20 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Transactions</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.transactions}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur-xl border border-white/20 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Sessions</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.sessions}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <LogIn className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur-xl border border-white/20 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">DAO Activities</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.dao}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white/80 backdrop-blur-xl border border-white/20 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Volume</p>
                  <p className="text-2xl font-bold text-green-600">${totalVolume.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="p-6 bg-white/80 backdrop-blur-xl border border-white/20 mb-6">
          <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-4 py-2">
              <Search className="w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent outline-none flex-1"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap gap-3">
              <div className="flex gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-600 self-center">Activity Type:</span>
                {(['all', 'transaction', 'session', 'dao', 'governance', 'reward', 'escrow'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={filterType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType(type)}
                  >
                    {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <span className="text-sm font-medium text-gray-600 self-center">Status:</span>
                {(['all', 'completed', 'pending', 'failed'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Activities List */}
        <Card className="bg-white/80 backdrop-blur-xl border border-white/20 overflow-hidden">
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="w-full rounded-none border-b border-gray-200 bg-gray-50/50">
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="p-6 m-0">
              {filteredActivities.length > 0 ? (
                <div className="space-y-4">
                  {filteredActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${getActivityTypeColor(activity.type)} rounded-lg flex items-center justify-center`}>
                          {getActivityIcon(activity.type, activity.category)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{activity.description}</p>
                          {activity.details && <p className="text-xs text-gray-500">{activity.details}</p>}
                          {activity.metadata?.location && (
                            <p className="text-xs text-gray-500">{activity.metadata.location}</p>
                          )}
                          <p className="text-xs text-gray-500">{formatDate(activity.date)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {activity.amount && (
                            <p className={`font-semibold text-sm`}>
                              ${activity.amount.toLocaleString()}
                            </p>
                          )}
                          {activity.currency && (
                            <p className="text-xs text-gray-500">{activity.currency}</p>
                          )}
                          <Badge variant="outline" className="text-xs mt-1">
                            {activity.type}
                          </Badge>
                        </div>
                        {getStatusBadge(activity.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No activities match your filters</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="p-6 m-0">
              <div className="relative">
                {filteredActivities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 ${getActivityTypeColor(activity.type)} rounded-full flex items-center justify-center`}>
                        {getActivityIcon(activity.type, activity.category)}
                      </div>
                      {index < filteredActivities.length - 1 && (
                        <div className="w-1 h-12 bg-gray-200 mt-2" />
                      )}
                    </div>
                    <div className="pb-8 flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{activity.description}</p>
                          {activity.details && <p className="text-sm text-gray-600 mt-1">{activity.details}</p>}
                          <p className="text-xs text-gray-500 mt-1">{formatDate(activity.date)}</p>
                        </div>
                        <div className="text-right ml-4">
                          {activity.amount && (
                            <p className="font-semibold text-sm">
                              ${activity.amount.toLocaleString()}
                            </p>
                          )}
                          <div className="mt-2 flex gap-2 justify-end">
                            <Badge variant="outline" className="text-xs">
                              {activity.type}
                            </Badge>
                            {getStatusBadge(activity.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
