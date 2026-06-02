
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useWalletOperatingStore } from '@/stores/wallet-operating-store';

interface PendingPayment {
  id: string;
  amount: string;
  currency: string;
  description: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface PendingPaymentsWidgetProps {
  walletAddress?: string;
  userId?: string;
}

export default function PendingPaymentsWidget({ walletAddress, userId }: PendingPaymentsWidgetProps) {
  const { socket, isConnected } = useWebSocket();
  const store = useWalletOperatingStore();
  
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    // Prefer central store transactions if available to derive pending payments
    if (store.transactions && store.transactions.length > 0) {
      const pending = (store.transactions as any[]).filter(t => t.status === 'pending' || t.status === 'processing');
      setPayments(pending.map(p => ({ id: p.id || '', amount: String(p.amount || '0'), currency: p.currency || 'cUSD', description: p.description || '', status: p.status || 'pending', expiresAt: p.expiresAt || '', createdAt: p.createdAt || '' })));
      setSummary({ totalPending: pending.length, byCurrency: {} });
      setLoading(false);
      return;
    }

    fetchPendingPayments();
  }, [walletAddress, userId, store.transactions]);

  // WebSocket real-time payment updates
  useEffect(() => {
    if (!isConnected) {
      setWsConnected(false);
      return;
    }

    setWsConnected(true);

    // Handle payment activity updates (completion, failure, etc.)
    const handleActivityLog = (data: any) => {
      try {
        if (data.entityType === 'payment' || data.action?.includes('payment')) {
          // Refresh pending payments when payment activity occurs
          fetchPendingPayments();
        }
      } catch (error) {
        console.error('Error processing payment activity:', error);
      }
    };

    // Handle payment alerts (failures, expirations, etc.)
    const handleAlert = (data: any) => {
      try {
        if (data.severity || data.message) {
          // Check if this is a payment-related alert
          if (data.message?.toLowerCase().includes('payment') || 
              data.entityType === 'payment') {
            // Toast notification could be added here
            fetchPendingPayments();
          }
        }
      } catch (error) {
        console.error('Error processing payment alert:', error);
      }
    };

    // Handle status changes for payment processing
    const handleStatusChange = (data: any) => {
      try {
        if (data.entityType === 'payment' || data.status?.includes('payment')) {
          fetchPendingPayments();
        }
      } catch (error) {
        console.error('Error processing status change:', error);
      }
    };

    socket.on('activity:logged', handleActivityLog);
    socket.on('alert:new', handleAlert);
    socket.on('status:changed', handleStatusChange);

    // Cleanup
    return () => {
      socket.off('activity:logged', handleActivityLog);
      socket.off('alert:new', handleAlert);
      socket.off('status:changed', handleStatusChange);
    };
  }, [socket, isConnected]);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (walletAddress) params.append('walletAddress', walletAddress);
      if (userId) params.append('userId', userId);

      const response = await fetch(`/api/v1/wallets/payments/pending?${params}`);
      const data = await response.json();

      if (data.success) {
        setPayments(data.data.payments || []);
        setSummary(data.data.summary || { totalPending: (data.data.payments || []).length });
      }
    } catch (error) {
      console.error('Error fetching pending payments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Payments
            </CardTitle>
            <CardDescription>Payments awaiting action</CardDescription>
            {/* WebSocket Status */}
            <div className="flex items-center gap-1 mt-2">
              {wsConnected ? (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-600">Real-time updates</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500">Polling mode</span>
                </>
              )}
            </div>
          </div>
          <Badge variant="outline">
            {summary?.totalPending || 0} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No pending payments</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary by currency */}
            {summary?.byCurrency && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                {Object.entries(summary.byCurrency).map(([currency, stats]: [string, any]) => (
                  <div key={currency} className="border rounded p-2 text-center">
                    <div className="text-sm text-gray-600">{currency}</div>
                    <div className="font-semibold">{stats.total.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{stats.count} requests</div>
                  </div>
                ))}
              </div>
            )}

            {/* Payment list */}
            <div className="space-y-3">
              {payments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="font-medium">
                      {payment.amount} {payment.currency}
                    </div>
                    <div className="text-sm text-gray-500">{payment.description || 'Payment request'}</div>
                    <div className="text-xs text-gray-400">
                      Expires: {new Date(payment.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {payments.length > 5 && (
              <Button variant="outline" className="w-full">
                View all {payments.length} payments
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
