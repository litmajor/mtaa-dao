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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "../components/ui/date-picker-with-range";
import { addDays } from "date-fns";

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

interface Payment {
  id: string;
  txHash: string;
  amount: string;
  currency: string;
  status: string;
  provider: string;
  daoId: string;
  createdAt: string;
  reconciled: boolean;
  expectedAmount: string;
  discrepancy?: boolean;
}

interface Stats {
  total: number;
  reconciled: number;
  pending: number;
  discrepancies: number;
  totalAmount: string;
}

export default function PaymentReconciliation() {
  const [reports, setReports] = useState<PaymentReconciliationReport[]>([]);
  const [overall, setOverall] = useState<OverallMetrics | null>(null);
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoResolving, setAutoResolving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');

  // State for new filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [filterReconciled, setFilterReconciled] = useState('all');
  const [dateRange, setDateRange] = useState<any>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: filterStatus,
        provider: filterProvider,
        reconciled: filterReconciled,
        dateRange: JSON.stringify(dateRange)
      });

      const response = await fetch(`/api/payment-reconciliation/payments?${params}`);
      const data = await response.json();

      if (response.ok) {
        setPayments(data.payments || []);
        setStats(data.stats || {
          total: 0,
          reconciled: 0,
          pending: 0,
          discrepancies: 0,
          totalAmount: '0'
        });
      } else {
        // Fallback to demo data
        setPayments([
          {
            id: '1',
            txHash: '0xabc123...',
            amount: '100.50',
            currency: 'cUSD',
            status: 'completed',
            provider: 'stripe',
            daoId: 'dao-001',
            createdAt: '2024-01-15T10:30:00Z',
            reconciled: true,
            expectedAmount: '100.50'
          },
          {
            id: '2',
            txHash: '0xdef456...',
            amount: '75.25',
            currency: 'cUSD',
            status: 'pending',
            provider: 'paystack',
            daoId: 'dao-002',
            createdAt: '2024-01-14T15:45:00Z',
            reconciled: false,
            expectedAmount: '75.25'
          },
          {
            id: '3',
            txHash: '0x789abc...',
            amount: '150.00',
            currency: 'CELO',
            status: 'completed',
            provider: 'kotanipay',
            daoId: 'dao-003',
            createdAt: '2024-01-13T09:20:00Z',
            reconciled: false,
            expectedAmount: '155.00', // Discrepancy
            discrepancy: true
          }
        ]);
        setStats({
          total: 3,
          reconciled: 1,
          pending: 1,
          discrepancies: 1,
          totalAmount: '325.75'
        });
      }
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconcile = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/payment-reconciliation/reconcile/${paymentId}`, {
        method: 'POST'
      });

      if (response.ok) {
        await loadPayments(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Reconciliation failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Reconciliation error:', error);
      alert('Reconciliation failed');
    }
  };

  const handleBulkReconcile = async () => {
    const unreconciled = payments.filter(p => !p.reconciled && p.status === 'completed');

    if (unreconciled.length === 0) {
      alert('No unreconciled payments found to process.');
      return;
    }

    try {
      const response = await fetch('/api/payment-reconciliation/bulk-reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIds: unreconciled.map(p => p.id)
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Bulk reconciliation successful: ${data.processed} payments processed.`);
        await loadPayments();
      } else {
        alert(`Bulk reconciliation failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Bulk reconciliation error:', error);
      alert('Bulk reconciliation failed');
    }
  };

  const exportData = () => {
    const csvContent = [
      ['ID', 'Transaction Hash', 'Amount', 'Currency', 'Status', 'Provider', 'DAO ID', 'Created At', 'Reconciled', 'Expected Amount', 'Discrepancy'],
      ...payments.map(p => [
        p.id,
        p.txHash,
        p.amount,
        p.currency,
        p.status,
        p.provider,
        p.daoId,
        p.createdAt,
        p.reconciled ? 'Yes' : 'No',
        p.expectedAmount,
        p.discrepancy ? 'Yes' : 'No'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment_reconciliation_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadPayments();
  }, [filterStatus, filterProvider, filterReconciled, dateRange]);


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

  async function handleAutoResolve(provider?: string): Promise<void> {
    setAutoResolving(true);
    try {
      const response = await fetch('/api/payment-reconciliation/auto-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider || filterProvider,
          status: filterStatus,
          reconciled: filterReconciled,
          dateRange,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message || 'Auto resolve completed.');
        await loadPayments();
      } else {
        alert(data.message || 'Auto resolve failed.');
      }
    } catch (error) {
      console.error('Auto resolve error:', error);
      alert('Auto resolve failed.');
    } finally {
      setAutoResolving(false);
    }
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
              onClick={() => loadPayments()} 
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

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select onValueChange={setFilterStatus} defaultValue={filterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent id="status-filter">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="provider-filter">Provider</Label>
                <Select onValueChange={setFilterProvider} defaultValue={filterProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Providers" />
                  </SelectTrigger>
                  <SelectContent id="provider-filter">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="paystack">Paystack</SelectItem>
                    <SelectItem value="kotanipay">KotaniPay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reconciled-filter">Reconciliation Status</Label>
                <Select onValueChange={setFilterReconciled} defaultValue={filterReconciled}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent id="reconciled-filter">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Reconciled</SelectItem>
                    <SelectItem value="false">Unreconciled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="date-range-filter">Date Range</Label>
                <DatePickerWithRange 
                  className="w-full" 
                  onChange={setDateRange} 
                  //initialDateRange={dateRange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

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
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Payments</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Reconciled</p>
                    <p className="text-2xl font-bold text-green-600">{stats.reconciled}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Discrepancies</p>
                    <p className="text-2xl font-bold text-red-600">{stats.discrepancies}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-2xl font-bold">${parseFloat(stats.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payment List */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Transactions</CardTitle>
            <div className="flex justify-between items-center">
              <CardDescription>Details of payments processed</CardDescription>
              <div className="flex gap-2">
                <Button onClick={exportData} variant="outline" size="sm">Export CSV</Button>
                <Button onClick={handleBulkReconcile} size="sm" disabled={payments.filter(p => !p.reconciled && p.status === 'completed').length === 0}>
                  Bulk Reconcile Selected
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tx Hash</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DAO ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reconciled</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{payment.txHash.substring(0, 6)}...{payment.txHash.substring(payment.txHash.length - 4)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{payment.amount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{payment.currency}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${getStatusColor(payment.status)}`}>
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        {payment.discrepancy && <AlertTriangle className="inline-block ml-1 h-4 w-4 text-red-500" />}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{payment.provider}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{payment.daoId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(payment.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {payment.reconciled ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-500" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-1">
                        {!payment.reconciled && payment.status === 'completed' && (
                          <Button size="sm" variant="ghost" onClick={() => handleReconcile(payment.id)}>
                            Reconcile
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Provider Reports (from original code, kept for context but not directly modified by the changes) */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Summary</CardTitle>
            <CardDescription>Payment reconciliation overview by provider</CardDescription>
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