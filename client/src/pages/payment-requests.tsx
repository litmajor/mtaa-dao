import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';
import {
  Copy,
  Check,
  X,
  Clock,
  DollarSign,
  Send,
  ArrowDownLeft,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/pages/hooks/useAuth';

interface PaymentRequest {
  id: string;
  fromUserId: string;
  toUserId: string | null;
  toAddress: string | null;
  amount: string;
  currency: string;
  description: string | null;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expiresAt: string | null;
  paidAt: string | null;
  transactionHash: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  sent: {
    total: number;
    paid: number;
    pending: number;
    expired: number;
    totalAmount: number;
  };
  received: {
    total: number;
    paid: number;
    pending: number;
    expired: number;
    totalAmount: number;
  };
}

export function PaymentRequestPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const [sentRequests, setSentRequests] = useState<PaymentRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<PaymentRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'expired'>('all');

  /**
   * Load requests and stats on mount
   */
  useEffect(() => {
    loadRequests();
    loadStats();
  }, []);

  /**
   * Load sent/received requests
   */
  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);

      // Load sent requests
      const sentData = await authClient.get('/api/payment-requests?type=sent');
      setSentRequests(sentData.requests || []);

      // Load received requests
      const receivedData = await authClient.get('/api/payment-requests?type=received');
      setReceivedRequests(receivedData.requests || []);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load stats
   */
  const loadStats = useCallback(async () => {
    try {
      const data = await authClient.get('/api/payment-requests/stats/summary');
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  /**
   * Cancel request
   */
  const handleCancel = useCallback(async (requestId: string) => {
    try {
      await authClient.post(`/api/payment-requests/${requestId}/cancel`, {});

      // Reload requests
      loadRequests();
      loadStats();
    } catch (error) {
      console.error('Failed to cancel request:', error);
    }
  }, [loadRequests, loadStats]);

  /**
   * Copy to clipboard
   */
  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  /**
   * Format date
   */
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-600';
      case 'pending':
        return 'bg-yellow-600';
      case 'expired':
        return 'bg-red-600';
      case 'cancelled':
        return 'bg-gray-600';
      default:
        return 'bg-blue-600';
    }
  };

  /**
   * Filter requests
   */
  const filterRequests = (requests: PaymentRequest[]) => {
    if (filterStatus === 'all') return requests;
    return requests.filter((r) => r.status === filterStatus);
  };

  const sentFiltered = filterRequests(sentRequests);
  const receivedFiltered = filterRequests(receivedRequests);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Payment Requests</h1>
          <p className="text-slate-400">Send and receive payment requests</p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {/* Sent Stats */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-400">Sent Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-2">{stats.sent.total}</div>
                <div className="flex gap-4 text-xs">
                  <div>
                    <span className="text-green-400">{stats.sent.paid}</span>
                    <span className="text-slate-500"> paid</span>
                  </div>
                  <div>
                    <span className="text-yellow-400">{stats.sent.pending}</span>
                    <span className="text-slate-500"> pending</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Received Stats */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-400">Received Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-2">{stats.received.total}</div>
                <div className="flex gap-4 text-xs">
                  <div>
                    <span className="text-green-400">{stats.received.paid}</span>
                    <span className="text-slate-500"> paid</span>
                  </div>
                  <div>
                    <span className="text-yellow-400">{stats.received.pending}</span>
                    <span className="text-slate-500"> pending</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Sent Amount */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-400">Amount Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">
                  {Number(stats.sent.totalAmount).toFixed(2)}
                </div>
                <span className="text-xs text-slate-500">cUSD</span>
              </CardContent>
            </Card>

            {/* Total Received Amount */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-400">Amount Received</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  {Number(stats.received.totalAmount).toFixed(2)}
                </div>
                <span className="text-xs text-slate-500">cUSD</span>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter & Tabs */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Requests</CardTitle>
              </div>
              <div className="flex gap-2">
                {(['all', 'pending', 'paid', 'expired'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus(status)}
                    className="capitalize"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="sent">Sent Requests</TabsTrigger>
                <TabsTrigger value="received">Received Requests</TabsTrigger>
              </TabsList>

              {/* Sent Tab */}
              <TabsContent value="sent" className="space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-slate-400">Loading...</div>
                ) : sentFiltered.length === 0 ? (
                  <div className="text-center py-8">
                    <Send className="h-12 w-12 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-slate-400">No sent payment requests</p>
                  </div>
                ) : (
                  sentFiltered.map((request) => (
                    <div
                      key={request.id}
                      className="border border-slate-700 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800/50 transition"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <DollarSign className="h-5 w-5 text-blue-400" />
                          <span className="font-medium text-white">
                            {request.currency} {Number(request.amount).toFixed(2)}
                          </span>
                          <Badge className={`${getStatusColor(request.status)} capitalize`}>
                            {request.status}
                          </Badge>
                        </div>
                        {request.description && (
                          <p className="text-sm text-slate-400 mb-1">{request.description}</p>
                        )}
                        <p className="text-xs text-slate-500">
                          Created: {formatDate(request.createdAt)}
                          {request.expiresAt && ` • Expires: ${formatDate(request.expiresAt)}`}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {request.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancel(request.id)}
                            className="text-red-400 border-red-400 hover:bg-red-600/20"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleCopy(
                              `${window.location.origin}/pay-request/${request.id}`,
                              request.id
                            )
                          }
                        >
                          {copied === request.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Received Tab */}
              <TabsContent value="received" className="space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-slate-400">Loading...</div>
                ) : receivedFiltered.length === 0 ? (
                  <div className="text-center py-8">
                    <ArrowDownLeft className="h-12 w-12 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-slate-400">No received payment requests</p>
                  </div>
                ) : (
                  receivedFiltered.map((request) => (
                    <div
                      key={request.id}
                      className="border border-slate-700 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800/50 transition"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <DollarSign className="h-5 w-5 text-green-400" />
                          <span className="font-medium text-white">
                            {request.currency} {Number(request.amount).toFixed(2)}
                          </span>
                          <Badge className={`${getStatusColor(request.status)} capitalize`}>
                            {request.status}
                          </Badge>
                        </div>
                        {request.description && (
                          <p className="text-sm text-slate-400 mb-1">{request.description}</p>
                        )}
                        <p className="text-xs text-slate-500">
                          From: {request.fromUserId}
                          {request.expiresAt && ` • Expires: ${formatDate(request.expiresAt)}`}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {request.status === 'pending' && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              // TODO: Open payment modal to pay this request
                            }}
                          >
                            Pay Now
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PaymentRequestPage;
