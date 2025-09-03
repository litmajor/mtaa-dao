
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign,
  TrendingUp,
  AlertCircle,
  Play,
  Eye
} from 'lucide-react';

interface PaymentReconciliationReport {
  provider: string;
  totalPayments: number;
  completed: number;
  failed: number;
  pending: number;
  cancelled: number;
  totalAmount: number;
  successRate: string;
  avgProcessingTime: number;
  failureReasons: { reason: string; count: number; percentage: string }[];
  inRetryQueue: number;
  reconciliationErrors: number;
}

interface OverallMetrics {
  totalPayments: number;
  totalCompleted: number;
  totalFailed: number;
  totalAmount: number;
  overallSuccessRate: string;
}

export default function PaymentReconciliation() {
  const [reports, setReports] = useState<PaymentReconciliationReport[]>([]);
  const [overall, setOverall] = useState<OverallMetrics | null>(null);
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoResolving, setAutoResolving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');

  useEffect(() => {
    fetchReconciliationData();
  }, [selectedProvider]);

  const fetchReconciliationData = async () => {
    try {
      setIsLoading(true);
      const params = selectedProvider !== 'all' ? `?provider=${selectedProvider}` : '';
      const response = await fetch(`/api/payments/reconciliation/report${params}`);
      const data = await response.json();

      if (data.success) {
        setReports(data.providers);
        setOverall(data.overall);
        setAnomalies(data.anomalies);
      }
    } catch (error) {
      console.error('Error fetching reconciliation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoResolve = async (provider?: string) => {
    try {
      setAutoResolving(true);
      const response = await fetch('/api/payments/reconciliation/auto-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Auto-resolve completed: ${data.resolved || data.totalResolved} issues resolved`);
        fetchReconciliationData();
      }
    } catch (error) {
      console.error('Error auto-resolving:', error);
    } finally {
      setAutoResolving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      case 'cancelled': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getSuccessRateColor = (rate: string) => {
    const numRate = parseFloat(rate.replace('%', ''));
    if (numRate >= 95) return 'text-green-600';
    if (numRate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2">Loading reconciliation data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Reconciliation</h1>
            <p className="text-gray-600">Monitor and reconcile payments across all providers</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => fetchReconciliationData()} 
              variant="outline"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              onClick={() => handleAutoResolve()} 
              disabled={autoResolving}
            >
              <Play className={`h-4 w-4 mr-2 ${autoResolving ? 'animate-spin' : ''}`} />
              Auto Resolve
            </Button>
          </div>
        </div>

        {/* Anomalies Alert */}
        {anomalies.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>{anomalies.length} anomalies detected:</strong>
              <ul className="mt-2 space-y-1">
                {anomalies.map((anomaly, index) => (
                  <li key={index} className="text-sm">• {anomaly}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Overall Metrics */}
        {overall && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Payments</p>
                    <p className="text-2xl font-bold">{overall.totalPayments}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{overall.totalCompleted}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Failed</p>
                    <p className="text-2xl font-bold text-red-600">{overall.totalFailed}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Success Rate</p>
                    <p className={`text-2xl font-bold ${getSuccessRateColor(overall.overallSuccessRate)}`}>
                      {overall.overallSuccessRate}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-2xl font-bold">${overall.totalAmount.toLocaleString()}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Provider Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Details</CardTitle>
            <CardDescription>Payment reconciliation by provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {reports.map((report) => (
                <div key={report.provider} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{report.provider}</h3>
                      <Badge 
                        variant={parseFloat(report.successRate.replace('%', '')) >= 90 ? 'default' : 'destructive'}
                      >
                        {report.successRate} success rate
                      </Badge>
                      {report.reconciliationErrors > 0 && (
                        <Badge variant="destructive">
                          {report.reconciliationErrors} reconciliation errors
                        </Badge>
                      )}
                      {report.inRetryQueue > 0 && (
                        <Badge variant="secondary">
                          {report.inRetryQueue} in retry queue
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleAutoResolve(report.provider.toLowerCase())}
                        disabled={autoResolving}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-xl font-semibold">{report.totalPayments}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Completed</p>
                      <p className="text-xl font-semibold text-green-600">{report.completed}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Failed</p>
                      <p className="text-xl font-semibold text-red-600">{report.failed}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pending</p>
                      <p className="text-xl font-semibold text-yellow-600">{report.pending}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Success Rate</p>
                      <Progress 
                        value={parseFloat(report.successRate.replace('%', ''))} 
                        className="h-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Avg Processing: {report.avgProcessingTime}s
                      </p>
                    </div>
                    
                    {report.failureReasons.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Top Failure Reasons</p>
                        <div className="space-y-1">
                          {report.failureReasons.slice(0, 3).map((reason, index) => (
                            <div key={index} className="flex justify-between text-xs">
                              <span className="truncate">{reason.reason}</span>
                              <span className="text-gray-500">{reason.count} ({reason.percentage})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
