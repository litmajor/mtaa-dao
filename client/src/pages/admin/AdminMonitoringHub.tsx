/**
 * Admin Monitoring Dashboard Hub
 * Central hub for accessing all monitoring pages and system health overview
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, AlertTriangle, Zap, Activity, Droplet, DollarSign, CreditCard, Bot, CheckCircle, ArrowRight, Users, Coins, Ticket, Trophy, Gift, Megaphone, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MonitoringPage {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  metrics?: string[];
}

export default function AdminMonitoringHub() {
  const navigate = useNavigate();

  const monitoringPages: MonitoringPage[] = [
    {
      title: 'Dashboard Overview',
      description: 'Platform health, metrics, chains, agents, and payments',
      icon: <BarChart3 className="h-6 w-6" />,
      path: '/admin/dashboard-overview',
      color: 'from-blue-600 to-blue-700',
      metrics: ['Platform Health', 'Active Wallets', 'Trading Volume', 'Fees Collected']
    },
    {
      title: 'DeFi Monitoring',
      description: 'Protocol integration status, liquidity pools, TVL and APY tracking',
      icon: <TrendingUp className="h-6 w-6" />,
      path: '/admin/defi-monitoring',
      color: 'from-green-600 to-green-700',
      metrics: ['Total TVL', 'Average APY', 'Active Protocols', 'Pool Health']
    },
    {
      title: 'CeFi Monitoring',
      description: 'Exchange integrations, trading volume, fees, and account status',
      icon: <Activity className="h-6 w-6" />,
      path: '/admin/cefi-monitoring',
      color: 'from-purple-600 to-purple-700',
      metrics: ['Connected Exchanges', 'Trading Volume', 'Active Accounts', 'Fees Collected']
    },
    {
      title: 'Health Monitoring',
      description: 'Blockchain networks, node health, system performance, and alerts',
      icon: <CheckCircle className="h-6 w-6" />,
      path: '/admin/health-monitoring',
      color: 'from-red-600 to-red-700',
      metrics: ['Chains Online', 'Avg Latency', 'Node Health', 'System Alerts']
    },
    {
      title: 'Liquidity Monitoring',
      description: 'Pool liquidity levels, spreads, slippage analysis, and depth tracking',
      icon: <Droplet className="h-6 w-6" />,
      path: '/admin/liquidity-monitoring',
      color: 'from-cyan-600 to-cyan-700',
      metrics: ['Total Liquidity', 'Avg Spread', 'Slippage Impact', 'Pool Health']
    },
    {
      title: 'Revenue Tracking',
      description: 'Platform revenue breakdown, fee collection, and financial metrics',
      icon: <DollarSign className="h-6 w-6" />,
      path: '/admin/revenue-tracking',
      color: 'from-yellow-600 to-yellow-700',
      metrics: ['Total Revenue', 'Daily Average', 'Revenue Sources', 'Trends']
    },
    {
      title: 'Payment Providers',
      description: 'Payment provider integrations, transaction status, and settlements',
      icon: <CreditCard className="h-6 w-6" />,
      path: '/admin/payment-providers',
      color: 'from-pink-600 to-pink-700',
      metrics: ['Active Providers', 'Transaction Volume', 'Success Rate', 'Settlements']
    },
    {
      title: 'Agent Monitoring',
      description: 'AI agents, task execution, performance metrics, and resource usage',
      icon: <Bot className="h-6 w-6" />,
      path: '/admin/agent-monitoring',
      color: 'from-indigo-600 to-indigo-700',
      metrics: ['Active Agents', 'Tasks Completed', 'Success Rate', 'Resource Usage']
    },
    {
      title: 'Platform Growth',
      description: 'User growth, vault creation, DAO metrics, and platform adoption trends',
      icon: <Users className="h-6 w-6" />,
      path: '/admin/growth',
      color: 'from-orange-600 to-orange-700',
      metrics: ['New Users', 'Active Users', 'Vaults Created', 'DAOs Created']
    },
    {
      title: 'API Usage Monitoring',
      description: 'API endpoint performance, rate limits, error tracking, and developer usage',
      icon: <Zap className="h-6 w-6" />,
      path: '/admin/api-usage',
      color: 'from-emerald-600 to-emerald-700',
      metrics: ['Total Requests', 'Error Rate', 'Avg Response Time', 'Active Developers']
    },
    {
      title: 'Tokenomics',
      description: 'Token distribution, supply tracking, emissions, and holder analytics',
      icon: <Coins className="h-6 w-6" />,
      path: '/admin/tokenomics',
      color: 'from-violet-600 to-violet-700',
      metrics: ['Token Price', 'Market Cap', 'Supply Info', 'Holder Distribution']
    },
    {
      title: 'Support Tickets',
      description: 'User support ticket management, categorization, and resolution tracking',
      icon: <Ticket className="h-6 w-6" />,
      path: '/admin/support-tickets',
      color: 'from-rose-600 to-rose-700',
      metrics: ['Open Tickets', 'In Progress', 'Resolution Rate', 'Satisfaction Score']
    },
    {
      title: 'Referral System',
      description: 'Track referral programs, top referrers, and referral rewards distribution',
      icon: <Share2 className="h-6 w-6" />,
      path: '/admin/referrals',
      color: 'from-teal-600 to-teal-700',
      metrics: ['New Referrals', 'Active Referrers', 'Conversion Rate', 'Rewards Distributed']
    },
    {
      title: 'Leaderboard & Rankings',
      description: 'Top contributors, members, and achievement rankings across the platform',
      icon: <Trophy className="h-6 w-6" />,
      path: '/admin/leaderboard',
      color: 'from-amber-600 to-amber-700',
      metrics: ['Top Members', 'Rankings', 'Achievements', 'Contribution Score']
    },
    {
      title: 'Rewards Management',
      description: 'Track weekly reward distribution, reward tiers, and user earnings',
      icon: <Gift className="h-6 w-6" />,
      path: '/admin/rewards',
      color: 'from-green-600 to-green-700',
      metrics: ['Total Distributed', 'Weekly Amount', 'Pending Rewards', 'Avg Reward']
    },
    {
      title: 'Achievements & Tasks',
      description: 'Create and manage achievements, tasks, and gamification elements',
      icon: <Target className="h-6 w-6" />,
      path: '/admin/achievements',
      color: 'from-sky-600 to-sky-700',
      metrics: ['Total Achievements', 'Active Tasks', 'Total Points', 'Engagement Rate']
    },
    {
      title: 'Announcements',
      description: 'Create, edit, and manage announcements across the platform',
      icon: <Megaphone className="h-6 w-6" />,
      path: '/admin/announcements',
      color: 'from-cyan-600 to-cyan-700',
      metrics: ['Published', 'Total Views', 'Click Rate', 'Engagement']
    },
    {
      title: 'DAO Analytics',
      description: 'Deep DAO analysis by type, region, cause, and custom segments',
      icon: <Building2 className="h-6 w-6" />,
      path: '/admin/dao-analytics',
      color: 'from-fuchsia-600 to-fuchsia-700',
      metrics: ['DAOs by Type', 'Regional Distribution', 'By Cause', 'Growth Trends']
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Monitoring Dashboard</h1>
          <p className="text-slate-400 text-lg">Access comprehensive monitoring for all platform systems</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Monitoring Pages</p>
            <p className="text-3xl font-bold text-white">18</p>
            <p className="text-slate-400 text-sm mt-2">System dashboards</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Coverage</p>
            <p className="text-3xl font-bold text-green-500">100%</p>
            <p className="text-slate-400 text-sm mt-2">All systems monitored</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Real-time Updates</p>
            <p className="text-3xl font-bold text-blue-500">30-60s</p>
            <p className="text-slate-400 text-sm mt-2">Refresh interval</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Data Points</p>
            <p className="text-3xl font-bold text-purple-500">100+</p>
            <p className="text-slate-400 text-sm mt-2">Tracked metrics</p>
          </Card>
        </div>

        {/* Monitoring Pages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {monitoringPages.map((page) => (
            <Card
              key={page.path}
              className="bg-slate-800 border-slate-700 hover:border-slate-600 transition cursor-pointer group overflow-hidden"
              onClick={() => navigate(page.path)}
            >
              <div className={`bg-gradient-to-r ${page.color} p-6 text-white`}>
                <div className="flex justify-between items-start mb-4">
                  {page.icon}
                  <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition transform group-hover:translate-x-1" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{page.title}</h3>
                <p className="text-sm text-white/80 mb-4">{page.description}</p>
              </div>

              <div className="p-4">
                {page.metrics && (
                  <div className="space-y-2 mb-4">
                    {page.metrics.map((metric, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-slate-400 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        <span>{metric}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  onClick={() => navigate(page.path)}
                  className="w-full bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white"
                >
                  Open Dashboard
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Information Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <h3 className="text-white font-semibold">System Monitoring</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Real-time monitoring of all platform systems including DeFi, CeFi, health checks, liquidity, and agent status.
            </p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="h-5 w-5 text-blue-500" />
              <h3 className="text-white font-semibold">Live Analytics</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Comprehensive analytics dashboards with charts, metrics, and performance indicators for data-driven decisions.
            </p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Activity className="h-5 w-5 text-green-500" />
              <h3 className="text-white font-semibold">Health Alerts</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Automatic alerts for system issues, performance degradation, and critical events across all platforms.
            </p>
          </Card>
        </div>

        {/* Documentation */}
        <Card className="bg-slate-800 border-slate-700 p-6 mt-6">
          <h3 className="text-white font-semibold mb-4">Monitoring Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-400">
            <div>
              <h4 className="text-white font-medium mb-2">Quick Start</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>Select a monitoring dashboard from above</li>
                <li>View real-time metrics and trends</li>
                <li>Access historical data and charts</li>
                <li>Review alerts and notifications</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-2">Key Features</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>30-60 second refresh intervals</li>
                <li>Multi-tab organization for clarity</li>
                <li>Export data for analysis</li>
                <li>Status indicators and alerts</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
