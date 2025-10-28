
import React, { useEffect, useState } from 'react';
import { Shield, BarChart, Users, Coins, Network, Eye, Loader2, Settings, AlertTriangle, TrendingUp, Clock, Database, Server, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../pages/hooks/useAuth';

type ChainInfo = {
  chain?: string;
  block?: string | number;
};

type SystemInfo = {
  uptime?: string;
  version?: string;
  status?: string;
  memory?: string;
  cpu?: string;
};

type RecentDao = {
  name: string;
  createdAt: string;
  members: number;
  plan: string;
};

type TopMember = {
  name: string;
  score: string | number;
  daoName: string;
};

type CriticalAlert = {
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
};

type Stats = {
  daos: number;
  treasury: number;
  members: number;
  subscriptions: number;
  activeVaults: number;
  totalTransactions: number;
  pendingTasks: number;
  chainInfo: ChainInfo;
  system: SystemInfo;
  recentDaos: RecentDao[];
  topMembers: TopMember[];
  contractAddresses: string[];
  systemLogs: string[];
  criticalAlerts: CriticalAlert[];
  revenueMetrics: {
    monthly: number;
    quarterly: number;
    annual: number;
  };
  systemHealth: {
    database: 'healthy' | 'warning' | 'critical';
    blockchain: 'healthy' | 'warning' | 'critical';
    payments: 'healthy' | 'warning' | 'critical';
    api: 'healthy' | 'warning' | 'critical';
  };
};

export default function SuperUserDashboard() {
  const { user } = useAuth();
  const isOwner = user?.roles === 'super_admin' || user?.roles === 'admin';
  
  const [stats, setStats] = useState<Stats>({
    daos: 0,
    treasury: 0,
    members: 0,
    subscriptions: 0,
    activeVaults: 0,
    totalTransactions: 0,
    pendingTasks: 0,
    chainInfo: {},
    system: {},
    recentDaos: [],
    topMembers: [],
    contractAddresses: [],
    systemLogs: [],
    criticalAlerts: [],
    revenueMetrics: { monthly: 0, quarterly: 0, annual: 0 },
    systemHealth: {
      database: 'healthy',
      blockchain: 'healthy',
      payments: 'healthy',
      api: 'healthy'
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isOwner) return;
    
    async function fetchAnalytics() {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('/api/admin/analytics', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(
          typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message?: string }).message)
            : 'Error fetching analytics'
        );
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [isOwner]);

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getHealthBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500/20';
      case 'warning': return 'bg-yellow-500/20';
      case 'critical': return 'bg-red-500/20';
      default: return 'bg-gray-500/20';
    }
  };

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-purple-900">
        <div className="bg-white/10 p-8 rounded-3xl shadow-2xl text-center">
          <Shield className="w-12 h-12 mx-auto text-purple-500 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-white/80">This page is for the app owner only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Eye className="w-10 h-10 text-purple-400 mr-4" />
            <div>
              <h1 className="text-3xl font-bold text-white">Super User Dashboard</h1>
              <p className="text-white/70">Comprehensive system oversight and management</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Loader2 className="w-4 h-4 mr-2 inline" />
              Refresh
            </button>
          </div>
        </div>

        {/* Critical Alerts */}
        {stats.criticalAlerts && stats.criticalAlerts.length > 0 && (
          <div className="mb-8 bg-red-500/20 border border-red-500/30 rounded-2xl p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400 mr-3" />
              <h2 className="text-xl font-bold text-white">Critical Alerts</h2>
            </div>
            <div className="space-y-3">
              {stats.criticalAlerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      alert.type === 'error' ? 'bg-red-500' : 
                      alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <span className="text-white">{alert.message}</span>
                  </div>
                  <span className="text-white/60 text-sm">{alert.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-white/10 rounded-lg p-1">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart },
              { id: 'health', label: 'System Health', icon: Activity },
              { id: 'management', label: 'Management', icon: Settings },
              { id: 'logs', label: 'Logs & Monitoring', icon: Database }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mr-3" />
            <span className="text-white/80 text-lg">Loading analytics...</span>
          </div>
        ) : error ? (
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-6 text-center text-red-100 mb-8">
            <Shield className="w-8 h-8 mx-auto text-red-400 mb-2" />
            <div className="text-lg font-bold">{error}</div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-purple-900/30 rounded-2xl p-6 flex flex-col items-center">
                    <BarChart className="w-8 h-8 text-purple-300 mb-2" />
                    <div className="text-2xl font-bold text-white">{stats.daos}</div>
                    <div className="text-white/70">Total DAOs</div>
                  </div>
                  <div className="bg-purple-900/30 rounded-2xl p-6 flex flex-col items-center">
                    <Users className="w-8 h-8 text-green-300 mb-2" />
                    <div className="text-2xl font-bold text-white">{stats.members}</div>
                    <div className="text-white/70">Total Members</div>
                  </div>
                  <div className="bg-purple-900/30 rounded-2xl p-6 flex flex-col items-center">
                    <Coins className="w-8 h-8 text-yellow-300 mb-2" />
                    <div className="text-2xl font-bold text-white">${stats.treasury?.toLocaleString?.() ?? stats.treasury}</div>
                    <div className="text-white/70">Treasury Value</div>
                  </div>
                  <div className="bg-purple-900/30 rounded-2xl p-6 flex flex-col items-center">
                    <TrendingUp className="w-8 h-8 text-pink-300 mb-2" />
                    <div className="text-2xl font-bold text-white">{stats.subscriptions}</div>
                    <div className="text-white/70">Subscriptions</div>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Platform Activity</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-white/70">Active Vaults</span>
                        <span className="text-white font-semibold">{stats.activeVaults}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Total Transactions</span>
                        <span className="text-white font-semibold">{stats.totalTransactions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Pending Tasks</span>
                        <span className="text-white font-semibold">{stats.pendingTasks}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Revenue Metrics</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-white/70">Monthly</span>
                        <span className="text-green-400 font-semibold">${stats.revenueMetrics.monthly}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Quarterly</span>
                        <span className="text-green-400 font-semibold">${stats.revenueMetrics.quarterly}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Annual</span>
                        <span className="text-green-400 font-semibold">${stats.revenueMetrics.annual}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Chain Info</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-white/70">Chain</span>
                        <span className="text-white font-semibold">{stats.chainInfo?.chain}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Block</span>
                        <span className="text-white font-semibold">{stats.chainInfo?.block}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Status</span>
                        <span className="text-green-400 font-semibold">Connected</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Health Tab */}
            {activeTab === 'health' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Object.entries(stats.systemHealth).map(([system, status]) => (
                    <div key={system} className={`rounded-2xl p-6 ${getHealthBg(status)}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white capitalize">{system}</h3>
                        <div className={`w-3 h-3 rounded-full ${getHealthColor(status).replace('text', 'bg')}`}></div>
                      </div>
                      <div className={`text-sm font-semibold ${getHealthColor(status)}`}>
                        {status.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white/10 rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">System Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-white/70">Uptime</span>
                        <span className="text-white font-semibold">{stats.system?.uptime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Version</span>
                        <span className="text-white font-semibold">{stats.system?.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Status</span>
                        <span className="text-green-400 font-semibold">{stats.system?.status || 'Online'}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-white/70">Memory Usage</span>
                        <span className="text-white font-semibold">{stats.system?.memory || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">CPU Usage</span>
                        <span className="text-white font-semibold">{stats.system?.cpu || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Management Tab */}
            {activeTab === 'management' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Link to="/admin/billing" className="block bg-white/10 rounded-2xl p-6 hover:bg-white/20 transition-colors">
                    <div className="flex items-center mb-4">
                      <Coins className="w-8 h-8 text-green-400 mr-3" />
                      <h3 className="text-lg font-bold text-white">Billing Management</h3>
                    </div>
                    <p className="text-white/70">Manage subscriptions and billing</p>
                  </Link>

                  <Link to="/admin/payments" className="block bg-white/10 rounded-2xl p-6 hover:bg-white/20 transition-colors">
                    <div className="flex items-center mb-4">
                      <Activity className="w-8 h-8 text-blue-400 mr-3" />
                      <h3 className="text-lg font-bold text-white">Payment Reconciliation</h3>
                    </div>
                    <p className="text-white/70">Monitor payment processing</p>
                  </Link>

                  <Link to="/analytics" className="block bg-white/10 rounded-2xl p-6 hover:bg-white/20 transition-colors">
                    <div className="flex items-center mb-4">
                      <BarChart className="w-8 h-8 text-purple-400 mr-3" />
                      <h3 className="text-lg font-bold text-white">Analytics</h3>
                    </div>
                    <p className="text-white/70">Detailed platform analytics</p>
                  </Link>

                  <Link to="/admin/users" className="block bg-white/10 rounded-2xl p-6 hover:bg-white/20 transition-colors">
                    <div className="flex items-center mb-4">
                      <Users className="w-8 h-8 text-yellow-400 mr-3" />
                      <h3 className="text-lg font-bold text-white">User Management</h3>
                    </div>
                    <p className="text-white/70">Manage users and permissions</p>
                  </Link>

                  <Link to="/admin/daos" className="block bg-white/10 rounded-2xl p-6 hover:bg-white/20 transition-colors">
                    <div className="flex items-center mb-4">
                      <Network className="w-8 h-8 text-orange-400 mr-3" />
                      <h3 className="text-lg font-bold text-white">DAO Management</h3>
                    </div>
                    <p className="text-white/70">Oversee and moderate DAOs</p>
                  </Link>

                  <Link to="/admin/settings" className="block bg-white/10 rounded-2xl p-6 hover:bg-white/20 transition-colors">
                    <div className="flex items-center mb-4">
                      <Settings className="w-8 h-8 text-gray-400 mr-3" />
                      <h3 className="text-lg font-bold text-white">System Settings</h3>
                    </div>
                    <p className="text-white/70">Configure system parameters</p>
                  </Link>

                  <Link to="/admin/security" className="block bg-white/10 rounded-2xl p-6 hover:bg-white/20 transition-colors">
                    <div className="flex items-center mb-4">
                      <Shield className="w-8 h-8 text-red-400 mr-3" />
                      <h3 className="text-lg font-bold text-white">Security Audit</h3>
                    </div>
                    <p className="text-white/70">Security monitoring and reports</p>
                  </Link>

                  <Link to="/admin/announcements" className="block bg-white/10 rounded-2xl p-6 hover:bg-white/20 transition-colors">
                    <div className="flex items-center mb-4">
                      <Activity className="w-8 h-8 text-indigo-400 mr-3" />
                      <h3 className="text-lg font-bold text-white">Announcements</h3>
                    </div>
                    <p className="text-white/70">Manage platform announcements</p>
                  </Link>

                  <Link to="/admin/pools" className="block bg-white/10 rounded-2xl p-6 hover:bg-white/20 transition-colors">
                    <div className="flex items-center mb-4">
                      <Coins className="w-8 h-8 text-purple-400 mr-3" />
                      <h3 className="text-lg font-bold text-white">Investment Pools</h3>
                    </div>
                    <p className="text-white/70">Create and manage investment pools</p>
                  </Link>
                </div>

                {/* Recent DAOs */}
                {Array.isArray(stats.recentDaos) && stats.recentDaos.length > 0 && (
                  <div className="bg-white/10 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Recent DAOs</h3>
                    <div className="space-y-3">
                      {stats.recentDaos.map((dao, i) => (
                        <div key={i} className="bg-purple-900/20 rounded-xl px-4 py-3 flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-white">{dao.name}</span>
                            <div className="text-xs text-purple-300">{dao.members} members • {dao.plan} plan</div>
                          </div>
                          <span className="text-xs text-purple-300">{dao.createdAt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Logs & Monitoring Tab */}
            {activeTab === 'logs' && (
              <div className="space-y-8">
                {/* System Logs */}
                {Array.isArray(stats.systemLogs) && stats.systemLogs.length > 0 && (
                  <div className="bg-white/10 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Recent System Logs</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {stats.systemLogs.map((log, i) => (
                        <div key={i} className="bg-gray-900/20 rounded-lg px-4 py-2 text-xs text-white/80 font-mono">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contract Addresses */}
                {Array.isArray(stats.contractAddresses) && stats.contractAddresses.length > 0 && (
                  <div className="bg-white/10 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Contract Addresses</h3>
                    <div className="space-y-2">
                      {stats.contractAddresses.map((address, i) => (
                        <div key={i} className="bg-blue-900/20 rounded-lg px-4 py-2 font-mono text-xs text-white/80">
                          {address}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Members */}
                {Array.isArray(stats.topMembers) && stats.topMembers.length > 0 && (
                  <div className="bg-white/10 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Top Contributors</h3>
                    <div className="space-y-3">
                      {stats.topMembers.map((member, i) => (
                        <div key={i} className="bg-green-900/20 rounded-xl px-4 py-3 flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-white">{member.name}</span>
                            <div className="text-xs text-green-300">{member.daoName}</div>
                          </div>
                          <span className="text-xs text-green-300">Score: {member.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
