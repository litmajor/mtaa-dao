import React, { useEffect, useState } from 'react';
import { Shield, BarChart, Users, Coins, Network, Eye, Loader2 } from 'lucide-react';

// TODO: Replace with real owner check (e.g., from auth context)
const isOwner = localStorage.getItem('superuser') === 'true';

type ChainInfo = {
  chain?: string;
  block?: string | number;
};

type SystemInfo = {
  uptime?: string;
  version?: string;
};

type RecentDao = {
  name: string;
  createdAt: string;
};

type TopMember = {
  name: string;
  score: string | number;
};

type Stats = {
  daos: number;
  treasury: number;
  members: number;
  subscriptions: number;
  chainInfo: ChainInfo;
  system: SystemInfo;
  recentDaos: RecentDao[];
  topMembers: TopMember[];
  contractAddresses: string[];
  systemLogs: string[];
};

export default function SuperUserDashboard() {
  const [stats, setStats] = useState<Stats>({
    daos: 0,
    treasury: 0,
    members: 0,
    subscriptions: 0,
    chainInfo: {},
    system: {},
    recentDaos: [],
    topMembers: [],
    contractAddresses: [],
    systemLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/admin/analytics');
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
  }, []);

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
      <div className="max-w-2xl mx-auto bg-white/10 rounded-3xl shadow-2xl p-8">
        <div className="flex items-center mb-8">
          <Eye className="w-10 h-10 text-purple-400 mr-4" />
          <h1 className="text-3xl font-bold text-white">Super User Dashboard</h1>
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
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="bg-purple-900/30 rounded-2xl p-6 flex flex-col items-center">
                <BarChart className="w-8 h-8 text-purple-300 mb-2" />
                <div className="text-2xl font-bold text-white">{stats.daos}</div>
                <div className="text-white/70">Total DAOs Created</div>
              </div>
              <div className="bg-purple-900/30 rounded-2xl p-6 flex flex-col items-center">
                <Coins className="w-8 h-8 text-yellow-300 mb-2" />
                <div className="text-2xl font-bold text-white">${stats.treasury?.toLocaleString?.() ?? stats.treasury}</div>
                <div className="text-white/70">Total Treasury Value</div>
              </div>
              <div className="bg-purple-900/30 rounded-2xl p-6 flex flex-col items-center">
                <Users className="w-8 h-8 text-green-300 mb-2" />
                <div className="text-2xl font-bold text-white">{stats.members}</div>
                <div className="text-white/70">Total Members</div>
              </div>
              <div className="bg-purple-900/30 rounded-2xl p-6 flex flex-col items-center">
                <BarChart className="w-8 h-8 text-pink-300 mb-2" />
                <div className="text-2xl font-bold text-white">{stats.subscriptions}</div>
                <div className="text-white/70">Total Subscriptions</div>
              </div>
            </div>
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center"><Network className="w-6 h-6 text-blue-300 mr-2" />Chain Info</h2>
              <div className="text-white/80">Chain: {stats.chainInfo?.chain}</div>
              <div className="text-white/80">Block: {stats.chainInfo?.block}</div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center"><Shield className="w-6 h-6 text-purple-300 mr-2" />System Info</h2>
              <div className="text-white/80">Uptime: {stats.system?.uptime}</div>
              <div className="text-white/80">Version: {stats.system?.version}</div>
            </div>
            {/* Additional Data Sections */}
            {Array.isArray(stats.recentDaos) && stats.recentDaos.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <BarChart className="w-6 h-6 text-purple-300 mr-2" />Recent DAOs
                </h2>
                <ul className="text-white/80 space-y-2">
                  {stats.recentDaos.map((dao, i) => (
                    <li key={i} className="bg-purple-900/20 rounded-xl px-4 py-2 flex justify-between items-center">
                      <span className="font-semibold">{dao.name}</span>
                      <span className="text-xs text-purple-300">{dao.createdAt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(stats.topMembers) && stats.topMembers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Users className="w-6 h-6 text-green-300 mr-2" />Top Members
                </h2>
                <ul className="text-white/80 space-y-2">
                  {stats.topMembers.map((member, i) => (
                    <li key={i} className="bg-green-900/20 rounded-xl px-4 py-2 flex justify-between items-center">
                      <span className="font-semibold">{member.name}</span>
                      <span className="text-xs text-green-300">{member.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(stats.contractAddresses) && stats.contractAddresses.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Network className="w-6 h-6 text-blue-300 mr-2" />Contract Addresses
                </h2>
                <ul className="text-white/80 space-y-2">
                  {stats.contractAddresses.map((address, i) => (
                    <li key={i} className="bg-blue-900/20 rounded-xl px-4 py-2 font-mono text-xs">
                      {address}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(stats.systemLogs) && stats.systemLogs.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Shield className="w-6 h-6 text-purple-300 mr-2" />System Logs
                </h2>
                <ul className="text-white/80 space-y-2">
                  {stats.systemLogs.map((log, i) => (
                    <li key={i} className="bg-gray-900/20 rounded-xl px-4 py-2 text-xs">
                      {log}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
