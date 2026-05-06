/**
 * Admin Audit Viewer
 * Day 3 - View comprehensive audit logs
 * 
 * Features:
 * - Filter by action type, actor, target, date range
 * - View before/after state snapshots
 * - Approval chain tracking
 * - Statistics and trends
 * - Export audit logs
 * - Power Checklist: #4 Authority Transparency, #8 Post-Action Narrative
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { authClient } from '@/utils/authClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Filter,
  Download,
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface AuditLog {
  id: string;
  actor_id: string;
  actor_type: string;
  action_type: string;
  action_category: string;
  target_type: string;
  target_id: string;
  target_name: string;
  before_state?: Record<string, any>;
  after_state?: Record<string, any>;
  changed_fields?: string[];
  result: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface AuditStats {
  totalActions?: number;
  byActionType?: Record<string, number>;
  byActor?: Record<string, number>;
  byResult?: Record<string, number>;
  byCategory?: Record<string, number>;
  successRate?: number;
}

const ACTION_COLORS: Record<string, string> = {
  'user_deleted': 'destructive',
  'user_banned': 'secondary',
  'user_role_changed': 'default',
  'dao_deleted': 'destructive',
  'permission_changed': 'secondary',
  'admin_deleted': 'destructive',
  'audit_override': 'destructive',
  'success': 'bg-green-500',
  'failure': 'bg-red-500',
};

export function AuditViewer() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats>({});
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Filters
  const [actionType, setActionType] = useState('');
  const [actorId, setActorId] = useState('');
  const [targetType, setTargetType] = useState('');
  const [sinceDate, setSinceDate] = useState('');
  const [untilDate, setUntilDate] = useState('');
  const [resultFilter, setResultFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Fetch audit logs and stats
  useEffect(() => {
    loadAuditData();
  }, [page, limit, actionType, actorId, targetType, sinceDate, untilDate, resultFilter]);

  const loadAuditData = async () => {
    try {
      setLoading(true);

      // Build query parameters
      const params = new URLSearchParams();
      if (actionType) params.append('actionType', actionType);
      if (actorId) params.append('actorId', actorId);
      if (targetType) params.append('targetType', targetType);
      if (sinceDate) params.append('since', sinceDate);
      if (untilDate) params.append('until', untilDate);
      if (resultFilter) params.append('result', resultFilter);
      params.append('limit', limit.toString());
      params.append('offset', ((page - 1) * limit).toString());

      // Fetch logs and stats in parallel
      const [logsData, statsData] = await Promise.all([
        authClient.get(`/api/admin/audit-logs?${params}`),
        authClient.get('/api/admin/audit-logs/stats/period')
      ]);

      setLogs(logsData.logs);
      if (statsData.stats) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Error loading audit data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load audit logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (actionType) params.append('actionType', actionType);
      if (actorId) params.append('actorId', actorId);
      if (targetType) params.append('targetType', targetType);
      if (sinceDate) params.append('since', sinceDate);
      if (untilDate) params.append('until', untilDate);
      if (resultFilter) params.append('result', resultFilter);
      params.append('limit', '10000');

      const data = await authClient.get(`/api/admin/audit-logs?${params}`);

      // Convert to CSV
      const csv = convertToCSV(data.logs);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString()}.csv`;
      a.click();

      toast({
        title: 'Success',
        description: 'Audit logs exported successfully',
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to export audit logs',
        variant: 'destructive',
      });
    }
  };

  const convertToCSV = (logs: AuditLog[]) => {
    const headers = [
      'Timestamp',
      'Actor',
      'Action',
      'Category',
      'Target Type',
      'Target Name',
      'Result',
      'Changed Fields',
    ];

    const rows = logs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.actor_id,
      log.action_type,
      log.action_category,
      log.target_type,
      log.target_name,
      log.result,
      (log.changed_fields || []).join('; '),
    ]);

    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  const chartData = Object.entries(stats.byActionType || {}).map(([action, count]) => ({
    name: action,
    count,
  }));

  const resultsData = Object.entries(stats.byResult || {}).map(([result, count]) => ({
    name: result,
    value: count,
  }));

  const COLORS = ['#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log Viewer</h1>
        <p className="text-muted-foreground mt-2">
          View comprehensive audit trail of all admin actions for compliance and troubleshooting.
        </p>
      </div>

      {/* Statistics Overview */}
      {Object.keys(stats).length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActions || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{((stats.successRate || 0) * 100).toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Unique Actors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(stats.byActor || {}).length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {resultsData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Results Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={resultsData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {resultsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium">Action Type</label>
              <Input
                placeholder="e.g., user_deleted"
                value={actionType}
                onChange={(e) => { setActionType(e.target.value); setPage(1); }}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Actor ID</label>
              <Input
                placeholder="Admin ID"
                value={actorId}
                onChange={(e) => { setActorId(e.target.value); setPage(1); }}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Target Type</label>
              <Select value={targetType} onValueChange={(v) => { setTargetType(v); setPage(1); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="dao">DAO</SelectItem>
                  <SelectItem value="admin_user">Admin</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Result</label>
              <Select value={resultFilter} onValueChange={(v) => { setResultFilter(v); setPage(1); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Results</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Since Date</label>
              <Input
                type="date"
                value={sinceDate}
                onChange={(e) => { setSinceDate(e.target.value); setPage(1); }}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Until Date</label>
              <Input
                type="date"
                value={untilDate}
                onChange={(e) => { setUntilDate(e.target.value); setPage(1); }}
                className="mt-1"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActionType('');
                  setActorId('');
                  setTargetType('');
                  setSinceDate('');
                  setUntilDate('');
                  setResultFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>

              <Button
                onClick={handleExport}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Loading audit logs...</p>
            </CardContent>
          </Card>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">No audit logs found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="py-4">
                  <div
                    className="cursor-pointer space-y-3"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    {/* Main Row */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Actor</p>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {log.actor_id.substring(0, 8)}...
                          </code>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Action</p>
                        <Badge variant="secondary">
                          {log.action_type}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Target</p>
                        <p className="text-sm">
                          {log.target_type}: <strong>{log.target_name}</strong>
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Result</p>
                        <div className="flex items-center gap-2">
                          {log.result === 'success' ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <Badge className="bg-green-500">Success</Badge>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <Badge variant="destructive">Failure</Badge>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                        <p className="text-sm">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedLog === log.id && (
                      <div className="border-t pt-4 mt-4 space-y-4">
                        {log.changed_fields && log.changed_fields.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Changed Fields</p>
                            <div className="flex flex-wrap gap-2">
                              {log.changed_fields.map((field, idx) => (
                                <Badge key={idx} variant="outline">
                                  {field}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {log.before_state && (
                          <div>
                            <p className="text-sm font-medium mb-2">Before State</p>
                            <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-32">
                              {JSON.stringify(log.before_state, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.after_state && (
                          <div>
                            <p className="text-sm font-medium mb-2">After State</p>
                            <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-32">
                              {JSON.stringify(log.after_state, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.metadata && (
                          <div>
                            <p className="text-sm font-medium mb-2">Metadata</p>
                            <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-32">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          ID: {log.id}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {logs.length} logs (Page {page})
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={logs.length < limit}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AuditViewer;
