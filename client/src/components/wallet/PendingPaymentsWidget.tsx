
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

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
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingPayments();
  }, [walletAddress, userId]);

  const fetchPendingPayments = async () => {
    try {
      const params = new URLSearchParams();
      if (walletAddress) params.append('walletAddress', walletAddress);
      if (userId) params.append('userId', userId);

      const response = await fetch(`/api/wallet/pending-payments?${params}`);
      const data = await response.json();

      if (data.success) {
        setPayments(data.data.payments);
        setSummary(data.data.summary);
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
