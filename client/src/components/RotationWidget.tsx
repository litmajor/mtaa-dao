import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCw, TrendingUp, Users, Clock } from 'lucide-react';

interface RotationStatus {
  daoId: string;
  daoType: string;
  durationModel: string;
  rotationFrequency: string;
  selectionMethod: string;
  currentCycle: number;
  totalCycles?: number;
  nextRotationDate: string;
  treasuryBalance: string;
  totalMembers: number;
  cycleHistory: {
    cycleNumber: number;
    recipient: string;
    amountDistributed: string;
    status: string;
    distributedAt?: string;
  }[];
}

interface RotationWidgetProps {
  daoId: string;
}

export function RotationWidget({ daoId }: RotationWidgetProps) {
  const [status, setStatus] = useState<RotationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRotationStatus();
    // Poll every minute for updates
    const interval = setInterval(fetchRotationStatus, 60000);
    return () => clearInterval(interval);
  }, [daoId]);

  const fetchRotationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dao/${daoId}/rotation/status`);
      if (!response.ok) throw new Error('Failed to fetch rotation status');
      
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rotation status');
    } finally {
      setLoading(false);
    }
  };

  if (!status || status.durationModel !== 'rotation') return null;

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full"></div>
        </CardContent>
      </Card>
    );
  }

  const nextRotationDate = new Date(status.nextRotationDate);
  const daysUntilRotation = Math.ceil((nextRotationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-green-50 dark:from-teal-950/30 dark:to-green-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
          <RotateCw className="w-5 h-5" />
          Rotation Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Cycle */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Current Cycle</p>
            <p className="text-2xl font-bold text-teal-600">
              {status.currentCycle}/{status.totalCycles || '∞'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Treasury Balance</p>
            <p className="text-2xl font-bold text-green-600">
              {parseFloat(status.treasuryBalance || '0').toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">cUSD</p>
          </div>
        </div>

        {/* Next Rotation */}
        <div className="bg-white dark:bg-gray-900 p-3 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Next Rotation</span>
            <Badge variant="outline">{daysUntilRotation} days</Badge>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {nextRotationDate.toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500">
            Method: <strong>{status.selectionMethod}</strong>
          </p>
        </div>

        {/* Recent Cycles */}
        {status.cycleHistory.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent Cycles</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {status.cycleHistory.slice(-3).reverse().map(cycle => (
                <div
                  key={cycle.cycleNumber}
                  className="flex items-center justify-between text-xs p-2 bg-white dark:bg-gray-900 rounded"
                >
                  <span>
                    Cycle {cycle.cycleNumber}:{' '}
                    <Badge variant="secondary" className="text-xs">
                      {cycle.status}
                    </Badge>
                  </span>
                  <span className="font-mono">
                    {parseFloat(cycle.amountDistributed).toLocaleString()} cUSD
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <Button size="sm" variant="outline" className="w-full" onClick={fetchRotationStatus}>
          <Clock className="w-4 h-4 mr-2" />
          Refresh Status
        </Button>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RotationWidget;
