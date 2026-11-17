import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BarChart3, TrendingUp, AlertCircle, Info, Filter, Download, Eye, EyeOff } from 'lucide-react';

interface DataPoint {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  severity?: 'critical' | 'warning' | 'info' | 'success';
}

interface SystemView {
  section: 'elders' | 'agents' | 'nutu-kwetu' | 'treasury' | 'governance';
  title: string;
  description: string;
  icon: React.ReactNode;
  data: DataPoint[];
  lastUpdated: string;
}

/**
 * Morio Data Hub - Unified System Dashboard
 * 
 * Makes ALL system data user-friendly:
 * - Elders (ELD-SCRY, ELD-KAIZEN, ELD-LUMEN)
 * - Agents (Analyzer, Defender, Scout, etc.)
 * - Nutu-Kwetu (Community engagement metrics)
 * - Treasury (Financial overview)
 * - Governance (DAO activities)
 * 
 * Philosophy: Break down complexity into simple, visual insights
 */
export default function MorioDataHub() {
  const { user, token } = useAuth();
  const [activeView, setActiveView] = useState<'elders' | 'agents' | 'nutu-kwetu' | 'treasury' | 'governance'>('elders');
  const [systemData, setSystemData] = useState<SystemView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailedMode, setDetailedMode] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    fetchSystemData();
  }, [activeView, token]);

  const fetchSystemData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch data based on active view
      let endpoint = '';
      switch (activeView) {
        case 'elders':
          endpoint = '/api/morio/elders/overview';
          break;
        case 'agents':
          endpoint = '/api/morio/agents/overview';
          break;
        case 'nutu-kwetu':
          endpoint = '/api/morio/nutu-kwetu/overview';
          break;
        case 'treasury':
          endpoint = '/api/morio/treasury/overview';
          break;
        case 'governance':
          endpoint = '/api/morio/governance/overview';
          break;
      }

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSystemData(data);
      } else if (response.status === 404) {
        // Fallback to mock data for demo
        setSystemData(getMockData(activeView));
      }
    } catch (err) {
      console.error('Failed to fetch system data:', err);
      // Use mock data as fallback
      setSystemData(getMockData(activeView));
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    if (!systemData) return;

    const csv = [
      ['Section', 'Label', 'Value', 'Unit', 'Timestamp'],
      ...systemData.data.map(d => [
        systemData.section,
        d.label,
        d.value,
        d.unit || '-',
        systemData.lastUpdated
      ])
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morio-${activeView}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!user || !token) {
    return (
      <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-6">
        <div className="flex gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-red-100">Authentication Required</h3>
            <p className="text-red-200 text-sm mt-1">Please log in to access the system data hub.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-400" />
            Morio Data Hub
          </h1>
          <p className="text-gray-400 mt-1">System-wide insights made simple and visual</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'elders' as const, label: '⛔ Elders', icon: '👑' },
          { id: 'agents' as const, label: '🤖 Agents', icon: '⚙️' },
          { id: 'nutu-kwetu' as const, label: '🌍 Nutu-Kwetu', icon: '🤝' },
          { id: 'treasury' as const, label: '💰 Treasury', icon: '💎' },
          { id: 'governance' as const, label: '🏛️ Governance', icon: '⚖️' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`px-4 py-2 rounded font-semibold whitespace-nowrap transition-all ${
              activeView === tab.id
                ? 'bg-blue-600 text-white border-2 border-blue-400'
                : 'bg-slate-700 text-gray-300 border-2 border-slate-600 hover:border-slate-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin">
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-gray-400 ml-3">Loading {activeView} data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-700/30 rounded p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-100">Error Loading Data</p>
              <p className="text-sm text-red-200 mt-1">{error}</p>
            </div>
          </div>
        ) : systemData ? (
          <>
            {/* Section Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  {systemData.icon}
                  {systemData.title}
                </h2>
                <p className="text-gray-400 text-sm mt-1">{systemData.description}</p>
                <p className="text-gray-500 text-xs mt-2">Last updated: {systemData.lastUpdated}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDetailedMode(!detailedMode)}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-gray-400 transition-colors"
                  title={detailedMode ? 'Switch to simple view' : 'Switch to detailed view'}
                >
                  {detailedMode ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={handleExportData}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-gray-400 transition-colors"
                  title="Export as CSV"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Data Grid - Simple View */}
            {!detailedMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemData.data.map((point, idx) => (
                  <DataCard key={idx} point={point} />
                ))}
              </div>
            )}

            {/* Data Table - Detailed View */}
            {detailedMode && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-3 px-3 font-semibold text-gray-300">Metric</th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-300">Value</th>
                      <th className="text-center py-3 px-3 font-semibold text-gray-300">Trend</th>
                      <th className="text-center py-3 px-3 font-semibold text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemData.data.map((point, idx) => (
                      <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                        <td className="py-3 px-3 text-gray-300">{point.label}</td>
                        <td className="text-right py-3 px-3">
                          <span className="font-semibold text-white">
                            {point.value}
                            {point.unit && <span className="text-gray-400 text-xs ml-1">{point.unit}</span>}
                          </span>
                        </td>
                        <td className="text-center py-3 px-3">
                          {point.trend && (
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                              point.trend === 'up' ? 'bg-green-900/30 text-green-200' :
                              point.trend === 'down' ? 'bg-red-900/30 text-red-200' :
                              'bg-gray-900/30 text-gray-200'
                            }`}>
                              {point.trend === 'up' ? '↑' : point.trend === 'down' ? '↓' : '→'}
                            </span>
                          )}
                        </td>
                        <td className="text-center py-3 px-3">
                          {point.severity && (
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                              point.severity === 'critical' ? 'bg-red-900/30 text-red-200' :
                              point.severity === 'warning' ? 'bg-yellow-900/30 text-yellow-200' :
                              point.severity === 'success' ? 'bg-green-900/30 text-green-200' :
                              'bg-blue-900/30 text-blue-200'
                            }`}>
                              {point.severity.charAt(0).toUpperCase() + point.severity.slice(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200">
          <p className="font-semibold mb-1">💡 Morio Data Hub Philosophy</p>
          <p>
            All system data is presented in simple, visual formats. Whether you're tracking Elder performance, Agent status, 
            Community engagement, Treasury health, or Governance activity - Morio breaks it down into insights you can understand.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Data Card Component
 */
function DataCard({ point }: { point: DataPoint }) {
  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-900/20 border-red-700/30 text-red-200';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-700/30 text-yellow-200';
      case 'success':
        return 'bg-green-900/20 border-green-700/30 text-green-200';
      default:
        return 'bg-blue-900/20 border-blue-700/30 text-blue-200';
    }
  };

  return (
    <div className={`border rounded-lg p-4 transition-all hover:shadow-lg ${getSeverityColor(point.severity)}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-semibold text-gray-300">{point.label}</span>
        {point.trend && (
          <span className={`text-xs font-bold ${
            point.trend === 'up' ? 'text-green-400' :
            point.trend === 'down' ? 'text-red-400' :
            'text-gray-400'
          }`}>
            {point.trend === 'up' ? '📈' : point.trend === 'down' ? '📉' : '→'}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{point.value}</span>
        {point.unit && <span className="text-gray-400 text-sm">{point.unit}</span>}
      </div>
      {point.severity && (
        <div className="mt-3 pt-3 border-t border-current/20">
          <span className="text-xs font-semibold opacity-75 capitalize">{point.severity}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Mock Data Generator
 * Provides realistic fallback data for demo purposes
 */
function getMockData(section: string): SystemView {
  const mockDataMap: Record<string, SystemView> = {
    elders: {
      section: 'elders',
      title: 'Elder Council Status',
      description: 'Performance and health of all three Elders monitoring the DAO',
      icon: '👑',
      data: [
        { label: 'ELD-SCRY Threats Detected', value: '127', unit: 'this week', trend: 'down', severity: 'info' },
        { label: 'ELD-SCRY Active Monitoring', value: '99.7', unit: '%', trend: 'stable', severity: 'success' },
        { label: 'ELD-KAIZEN Optimizations', value: '43', unit: 'applied', trend: 'up', severity: 'success' },
        { label: 'ELD-KAIZEN Avg Response Time', value: '145', unit: 'ms', trend: 'down', severity: 'success' },
        { label: 'ELD-LUMEN Reviews Conducted', value: '89', unit: 'this month', trend: 'up', severity: 'info' },
        { label: 'ELD-LUMEN Approval Rate', value: '73', unit: '%', trend: 'stable', severity: 'success' }
      ],
      lastUpdated: new Date().toLocaleTimeString()
    },
    agents: {
      section: 'agents',
      title: 'Agent Network Status',
      description: 'Status of all system agents (Analyzer, Defender, Scout, etc.)',
      icon: '⚙️',
      data: [
        { label: 'Active Agents', value: '8', unit: 'of 10', trend: 'stable', severity: 'warning' },
        { label: 'Analyzer Status', value: 'Online', unit: 'Normal', trend: 'stable', severity: 'success' },
        { label: 'Defender Threats Blocked', value: '342', unit: 'this month', trend: 'up', severity: 'info' },
        { label: 'Scout Coverage', value: '94', unit: '%', trend: 'up', severity: 'success' },
        { label: 'System Health', value: '92', unit: '%', trend: 'stable', severity: 'success' },
        { label: 'Messages Processed', value: '1.2M', unit: 'today', trend: 'up', severity: 'info' }
      ],
      lastUpdated: new Date().toLocaleTimeString()
    },
    'nutu-kwetu': {
      section: 'nutu-kwetu',
      title: 'Community Engagement',
      description: 'Nutu-Kwetu community involvement and participation metrics',
      icon: '🤝',
      data: [
        { label: 'Active Members', value: '2,847', unit: 'engaged', trend: 'up', severity: 'success' },
        { label: 'Community Posts', value: '423', unit: 'this week', trend: 'up', severity: 'success' },
        { label: 'Event Attendance', value: '1,204', unit: 'total', trend: 'up', severity: 'success' },
        { label: 'Engagement Rate', value: '68', unit: '%', trend: 'stable', severity: 'success' },
        { label: 'New Members', value: '267', unit: 'this month', trend: 'up', severity: 'info' },
        { label: 'Community Score', value: '8.4', unit: '/10', trend: 'stable', severity: 'success' }
      ],
      lastUpdated: new Date().toLocaleTimeString()
    },
    treasury: {
      section: 'treasury',
      title: 'Treasury Overview',
      description: 'DAO treasury health and financial metrics',
      icon: '💰',
      data: [
        { label: 'Total Treasury', value: '4.2M', unit: 'MTAA', trend: 'up', severity: 'success' },
        { label: 'Monthly Burn Rate', value: '145K', unit: 'MTAA', trend: 'down', severity: 'success' },
        { label: 'Runway', value: '28.9', unit: 'months', trend: 'stable', severity: 'success' },
        { label: 'Active Proposals', value: '12', unit: 'pending vote', trend: 'stable', severity: 'info' },
        { label: 'Allocations', value: '23.4M', unit: 'MTAA', trend: 'stable', severity: 'info' },
        { label: 'Investment Pools', value: '8', unit: 'active', trend: 'stable', severity: 'success' }
      ],
      lastUpdated: new Date().toLocaleTimeString()
    },
    governance: {
      section: 'governance',
      title: 'Governance Activity',
      description: 'DAO governance and voting metrics',
      icon: '⚖️',
      data: [
        { label: 'Active Proposals', value: '12', unit: 'open', trend: 'stable', severity: 'info' },
        { label: 'Voting Participation', value: '76', unit: '%', trend: 'up', severity: 'success' },
        { label: 'Passed Proposals', value: '156', unit: 'all time', trend: 'up', severity: 'success' },
        { label: 'Avg Vote Duration', value: '3.2', unit: 'days', trend: 'stable', severity: 'info' },
        { label: 'Member Delegate Rate', value: '34', unit: '%', trend: 'up', severity: 'success' },
        { label: 'Policy Updates', value: '8', unit: 'this month', trend: 'stable', severity: 'info' }
      ],
      lastUpdated: new Date().toLocaleTimeString()
    }
  };

  return mockDataMap[section] || mockDataMap['elders'];
}
