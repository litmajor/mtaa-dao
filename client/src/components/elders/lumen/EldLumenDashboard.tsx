import React, { useEffect, useState } from 'react';
import { useAuth } from '@/pages/hooks/useAuth';
import { AlertCircle, CheckCircle, Clock, TrendingUp, Shield } from 'lucide-react';

interface EthicsStats {
  totalReviewed: number;
  approved: number;
  rejected: number;
  conditional: number;
  approvalRate: string;
  concernDistribution: {
    green: number;
    yellow: number;
    orange: number;
    red: number;
  };
  averageConfidence: string;
}

interface DashboardData {
  thisWeek: EthicsStats;
  thisMonth: EthicsStats;
  concernTrend: Record<string, number>;
}

interface AuditRecord {
  timestamp: string;
  decisionId: string;
  decisionType: string;
  concernLevel: string;
  outcome: string;
  principlesAffected: string[];
  confidenceScore: number;
}

/**
 * ELD-LUMEN Frontend Dashboard
 * Displays ethics review information with role-based access control
 * 
 * - Superusers: Full access to all ethics data, audit logs, statistics
 * - DAO Members: View their own decision reviews only
 * - Public: Limited health check info only
 */
export default function EldLumenDashboard() {
  const { user, token } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [auditLog, setAuditLog] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    // Only superusers can access full dashboard
    if (user.role !== 'superuser') {
      setError('Access restricted to superusers');
      setLoading(false);
      return;
    }

    fetchDashboardData();
  }, [user, token]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, auditRes] = await Promise.all([
        fetch('/api/elders/lumen/dashboard', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/elders/lumen/audit-log?days=30', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (!dashRes.ok || !auditRes.ok) {
        throw new Error('Failed to fetch ethics data');
      }

      const dashData = await dashRes.json();
      const auditData = await auditRes.json();

      setDashboardData(dashData);
      setAuditLog(auditData.auditLog || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Access Denied View
  if (!user || user.role !== 'superuser') {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Restricted</h2>
            <p className="text-gray-400">
              ELD-LUMEN Ethics Dashboard is available to superusers only.
            </p>
            <p className="text-gray-500 text-sm mt-4">
              DAO members can view their own decision reviews through their DAO settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-slate-800 rounded-lg p-8 text-center">
            <div className="animate-spin inline-block">
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-gray-400 mt-4">Loading ethics dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-6">
            <div className="flex gap-4">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-red-100">Error Loading Dashboard</h3>
                <p className="text-red-200 text-sm mt-1">{error}</p>
                <button
                  onClick={fetchDashboardData}
                  className="mt-3 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-400" />
              ELD-LUMEN Ethics Dashboard
            </h1>
            <p className="text-gray-400 mt-1">
              Ethical oversight and governance compliance monitoring
            </p>
          </div>
        </div>

        {/* This Week vs This Month Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* This Week */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4">This Week</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Decisions Reviewed</span>
                <span className="text-2xl font-bold text-blue-400">
                  {dashboardData?.thisWeek.totalReviewed || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Approval Rate</span>
                <span className="text-xl font-bold text-green-400">
                  {dashboardData?.thisWeek.approvalRate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Concern Level</span>
                <div className="flex gap-2">
                  <span className="text-xs bg-green-900/30 border border-green-700 text-green-200 px-2 py-1 rounded">
                    Green: {dashboardData?.thisWeek.concernDistribution.green}
                  </span>
                  <span className="text-xs bg-yellow-900/30 border border-yellow-700 text-yellow-200 px-2 py-1 rounded">
                    Yellow: {dashboardData?.thisWeek.concernDistribution.yellow}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* This Month */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4">This Month</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Decisions Reviewed</span>
                <span className="text-2xl font-bold text-blue-400">
                  {dashboardData?.thisMonth.totalReviewed || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Approval Rate</span>
                <span className="text-xl font-bold text-green-400">
                  {dashboardData?.thisMonth.approvalRate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Avg Confidence</span>
                <span className="text-xl font-bold text-purple-400">
                  {dashboardData?.thisMonth.averageConfidence}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Concern Distribution Breakdown */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Concern Distribution (30 Days)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ConcernCard
              level="green"
              label="No Concerns"
              count={dashboardData?.concernTrend.green || 0}
              color="green"
            />
            <ConcernCard
              level="yellow"
              label="Minor"
              count={dashboardData?.concernTrend.yellow || 0}
              color="yellow"
            />
            <ConcernCard
              level="orange"
              label="Moderate"
              count={dashboardData?.concernTrend.orange || 0}
              color="orange"
            />
            <ConcernCard
              level="red"
              label="Severe"
              count={dashboardData?.concernTrend.red || 0}
              color="red"
            />
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Recent Ethical Reviews</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditLog.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No ethical reviews in the last 30 days</p>
              </div>
            ) : (
              auditLog.slice(0, 20).map((record, idx) => (
                <AuditLogItem key={idx} record={record} />
              ))
            )}
          </div>
        </div>

        {/* Ethical Principles Reference */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Ethical Principles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Minimize Harm', weight: '1.0' },
              { name: 'Respect Autonomy', weight: '0.9' },
              { name: 'Ensure Justice', weight: '0.95' },
              { name: 'Promote Beneficence', weight: '0.8' },
              { name: 'Transparency', weight: '0.85' },
              { name: 'Proportionality', weight: '0.9' },
              { name: 'Fairness', weight: '0.95' },
              { name: 'Accountability', weight: '0.9' }
            ].map((principle, idx) => (
              <div
                key={idx}
                className="bg-slate-700/50 border border-slate-600 rounded p-3"
              >
                <p className="font-semibold text-white text-sm">{principle.name}</p>
                <p className="text-xs text-gray-400 mt-1">Weight: {principle.weight}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Information */}
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
          <p className="text-sm text-gray-300">
            <strong>ℹ️ Info:</strong> ELD-LUMEN Ethics Dashboard is superuser-only. DAO members can request ethical reviews of decisions through their DAO settings. All decisions are logged for compliance and audit purposes.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Concern Level Card Component
 */
function ConcernCard({
  level,
  label,
  count,
  color
}: {
  level: string;
  label: string;
  count: number;
  color: string;
}) {
  const colorMap = {
    green: 'bg-green-900/30 border-green-700 text-green-200',
    yellow: 'bg-yellow-900/30 border-yellow-700 text-yellow-200',
    orange: 'bg-orange-900/30 border-orange-700 text-orange-200',
    red: 'bg-red-900/30 border-red-700 text-red-200'
  };

  const bgMap = {
    green: 'bg-green-500/20',
    yellow: 'bg-yellow-500/20',
    orange: 'bg-orange-500/20',
    red: 'bg-red-500/20'
  };

  return (
    <div className={`${colorMap[color as keyof typeof colorMap]} border rounded-lg p-4 text-center`}>
      <div className={`${bgMap[color as keyof typeof bgMap]} w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2`}>
        <span className="text-lg font-bold">{count}</span>
      </div>
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs opacity-75 mt-1">concerns</p>
    </div>
  );
}

/**
 * Audit Log Item Component
 */
function AuditLogItem({ record }: { record: AuditRecord }) {
  const getConcernColor = (level: string) => {
    switch (level) {
      case 'green':
        return 'bg-green-900/30 border-green-700 text-green-200';
      case 'yellow':
        return 'bg-yellow-900/30 border-yellow-700 text-yellow-200';
      case 'orange':
        return 'bg-orange-900/30 border-orange-700 text-orange-200';
      case 'red':
        return 'bg-red-900/30 border-red-700 text-red-200';
      default:
        return 'bg-gray-900/30 border-gray-700 text-gray-200';
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'rejected':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  return (
    <div className="bg-slate-700/30 border border-slate-600 rounded p-3 flex items-start justify-between gap-3 hover:bg-slate-700/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {getOutcomeIcon(record.outcome)}
          <span className="font-semibold text-white text-sm">{record.decisionType}</span>
          <span className="text-xs text-gray-500">{record.decisionId}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getConcernColor(record.concernLevel)}`}>
            {record.concernLevel.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400">{record.timestamp}</span>
          <span className="text-xs text-gray-500">Confidence: {(record.confidenceScore * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="text-right">
        <span className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${
          record.outcome === 'approved' ? 'bg-green-900/30 text-green-200' :
          record.outcome === 'rejected' ? 'bg-red-900/30 text-red-200' :
          'bg-yellow-900/30 text-yellow-200'
        }`}>
          {record.outcome.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
