/**
 * Session Activity Log Component
 * Display login history and device information
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Check,
  X,
  Clock,
  MapPin,
  Globe,
  Loader,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ActivityLog {
  id: string;
  action: string;
  status: 'success' | 'failed' | 'blocked';
  deviceInfo?: string;
  ipAddress?: string;
  location?: any;
  timestamp: Date;
}

export const SessionActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');

  useEffect(() => {
    const fetchActivityLog = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/sessions/activity-log?limit=50', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!response.ok) throw new Error('Failed to fetch activity log');

        const data = await response.json();
        setLogs(data.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        setLoading(false);
      }
    };

    fetchActivityLog();
  }, []);

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      view: 'Viewed wallet',
      send: 'Sent funds',
      receive: 'Received funds',
      export: 'Exported data',
      backup: 'Created backup',
      modify_settings: 'Changed settings',
      unlock: 'Unlocked wallet',
      login: 'Logged in',
      logout: 'Logged out',
    };
    return labels[action] || action;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Check className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <X className="h-5 w-5 text-red-600" />;
      case 'blocked':
        return <Shield className="h-5 w-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      case 'blocked':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return '';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.status === filter;
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Recent login and account activity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 border-b">
          {(['all', 'success', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                filter === status
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-2 text-xs">
                  ({logs.filter((l) => l.status === status).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Activity list */}
        {filteredLogs.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            No activity found
          </p>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`rounded-lg border p-4 ${getStatusColor(log.status)}`}
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(log.status)}

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">
                        {getActionLabel(log.action)}
                      </h4>
                      <span className="text-sm text-gray-600">
                        {formatTimeAgo(log.timestamp)}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      {log.deviceInfo && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          {log.deviceInfo}
                        </div>
                      )}

                      {log.ipAddress && (
                        <div className="text-xs text-gray-500">
                          IP: {log.ipAddress}
                        </div>
                      )}

                      {log.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {typeof log.location === 'string'
                            ? log.location
                            : JSON.stringify(log.location)}
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <Badge
                        variant="outline"
                        className={
                          log.status === 'success'
                            ? 'border-green-200 text-green-700'
                            : log.status === 'failed'
                              ? 'border-red-200 text-red-700'
                              : 'border-yellow-200 text-yellow-700'
                        }
                      >
                        {log.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionActivityLog;
