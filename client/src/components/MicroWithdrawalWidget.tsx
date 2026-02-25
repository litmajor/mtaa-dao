import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, Zap, DollarSign, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface MicroWithdrawal {
  id: string;
  amount: string;
  currency: string;
  status: 'pending' | 'batched' | 'processed' | 'failed';
  toAddress: string;
  createdAt: string;
  estimatedGasFee?: string;
}

interface MicroWithdrawalStats {
  pendingCount: number;
  batchedCount: number;
  totalPendingAmount: string;
  oldestRequestAge: number;
  estimatedProcessTime: string;
}

export default function MicroWithdrawalWidget() {
  const [withdrawals, setWithdrawals] = useState<MicroWithdrawal[]>([]);
  const [stats, setStats] = useState<MicroWithdrawalStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('USDC');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [withdrawalsRes, statsRes] = await Promise.all([
        apiGet('/api/micro-withdrawals/pending'),
        apiGet('/api/micro-withdrawals/stats'),
      ]);

      setWithdrawals(withdrawalsRes.withdrawals || []);
      setStats(statsRes.stats);
    } catch (error: any) {
      console.error('Error loading data:', error);
    }
  };

  const handleRequestWithdrawal = async () => {
    if (!amount || !address) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const response = await apiPost('/api/micro-withdrawals/request', {
        amount,
        currency,
        toAddress: address,
      });

      toast({
        title: 'Success',
        description: response.withdrawal.message,
      });

      setAmount('');
      setAddress('');
      setDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this withdrawal request?')) return;

    try {
      await apiPost('/api/micro-withdrawals/cancel', { requestId: id });
      toast({ title: 'Success', description: 'Withdrawal cancelled' });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-900';
      case 'batched':
        return 'bg-blue-100 text-blue-900';
      case 'processed':
        return 'bg-green-100 text-green-900';
      case 'failed':
        return 'bg-red-100 text-red-900';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle className="flex items-center gap-2">
                  Micro-Withdrawals
                  <Badge variant="outline" className="text-xs">BETA</Badge>
                </CardTitle>
                <CardDescription>Batch small amounts under $10 for efficient withdrawal</CardDescription>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <DollarSign className="w-4 h-4" />
                  Request Withdrawal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Micro-Withdrawal</DialogTitle>
                  <DialogDescription>
                    Request a withdrawal under $10. Multiple requests are batched together to save on gas fees.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Amount (Max: $10)</label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        min="0.50"
                        max="10"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="border rounded px-3 py-2 w-32"
                      >
                        <option>USDC</option>
                        <option>USDT</option>
                        <option>cUSD</option>
                        <option>ETH</option>
                      </select>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Minimum: $0.50 | Maximum: $10.00</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Wallet Address</label>
                    <Input
                      placeholder="0x..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      ℹ️ Your request will be queued and processed with other micro-withdrawals in batches. This saves
                      on network fees!
                    </p>
                  </div>

                  <Button onClick={handleRequestWithdrawal} disabled={loading} className="w-full">
                    {loading ? 'Processing...' : 'Request Withdrawal'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Card */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Batch Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold">{stats.pendingCount}</div>
                <p className="text-xs text-muted-foreground">Pending Requests</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.batchedCount}</div>
                <p className="text-xs text-muted-foreground">In Batch</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.totalPendingAmount}</div>
                <p className="text-xs text-muted-foreground">Total Pending</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.estimatedProcessTime}</div>
                <p className="text-xs text-muted-foreground">Est. Process Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Why Micro-Withdrawals?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-amber-900">
            <strong>Problem:</strong> Network fees on blockchain are high, making it hard to withdraw small amounts.
          </p>
          <p className="text-amber-900">
            <strong>Solution:</strong> We batch multiple micro-withdrawals together. You pay a fraction of gas fees!
          </p>
          <div className="bg-white rounded p-2 mt-2">
            <p className="text-xs font-mono">
              ✅ You: Request $7 withdrawal<br />
              ⏳ System: Waits for other users<br />
              🚀 Batch: Processes 50+ withdrawals at once<br />
              💰 Result: You save 90% on gas!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawals List */}
      {withdrawals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Your Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">${withdrawal.amount}</div>
                    <div className="text-xs text-muted-foreground">{withdrawal.currency}</div>
                    <Badge className={getStatusColor(withdrawal.status)} variant="outline">
                      {withdrawal.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{withdrawal.toAddress}</div>
                </div>

                <div className="flex items-center gap-2">
                  {withdrawal.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancel(withdrawal.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Cancel
                    </Button>
                  )}
                  {withdrawal.status === 'processed' && (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {withdrawals.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Zap className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
            <p className="text-muted-foreground">No withdrawal requests yet</p>
            <p className="text-xs text-muted-foreground">Create your first micro-withdrawal to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
