import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';
import {
  Users,
  DollarSign,
  Clock,
  Check,
  AlertCircle,
  Share2,
  Bell,
  Trash2,
  Plus,
  TrendingUp,
  Loader,
  ChevronRight,
} from 'lucide-react';
import { BillSplitModal } from '@/components/modals/BillSplitModal';
import { useAuth } from '@/pages/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface BillSplit {
  id: string;
  title: string;
  description?: string;
  totalAmount: number;
  currency: string;
  status: 'active' | 'settled' | 'cancelled';
  createdAt: string;
  creatorId: string;
  participants?: Array<{
    id: string;
    name: string;
    amount: number;
    paid: boolean;
  }>;
}

interface BillStats {
  totalBills: number;
  activeBills: number;
  settledBills: number;
  totalAmount: number;
  totalPaid: number;
  totalOwed: number;
}

export function BillSplitPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bills, setBills] = useState<BillSplit[]>([]);
  const [stats, setStats] = useState<BillStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'settled' | 'history'>('active');
  const [error, setError] = useState<string | null>(null);

  /**
   * Load bills and stats
   */
  const loadBills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await authClient.get('/api/v1/wallets/payments/bill-split');
      setBills(data.billSplits || []);

      // Calculate stats
      const active = data.billSplits.filter((b: any) => b.status === 'active').length;
      const settled = data.billSplits.filter((b: any) => b.status === 'settled').length;
      const total = data.billSplits.reduce((sum: number, b: any) => sum + parseFloat(b.totalAmount), 0);
      const paid = data.billSplits.reduce((sum: number, b: any) => {
        if (b.status === 'settled') return sum + parseFloat(b.totalAmount);
        return sum;
      }, 0);
      const owed = total - paid;

      setStats({
        totalBills: data.billSplits.length,
        activeBills: active,
        settledBills: settled,
        totalAmount: total,
        totalPaid: paid,
        totalOwed: owed,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load bills';
      setError(errorMsg);
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Load on mount
   */
  useEffect(() => {
    loadBills();
  }, [loadBills]);

  /**
   * Handle bill creation
   */
  const handleCreateBill = async (billData: any) => {
    try {
      await authClient.post('/api/v1/wallets/payments/bill-split', billData);

      setShowModal(false);
      toast({
        title: 'Success',
        description: `Bill "${billData.title}" created successfully!`,
        variant: 'success',
      });
      loadBills();

      // Track analytics
      if (window?.analytics) {
        window.analytics.track('Bill Split Created', {
          participantCount: billData.participants.length,
          totalAmount: billData.totalAmount,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create bill';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  /**
   * Send reminders to participants
   */
  const handleSendReminders = async (billId: string, billTitle: string) => {
    try {
      setActionLoading(billId);
      await authClient.post(`/api/v1/wallets/payments/bill-split/${billId}/remind`, {});

      toast({
        title: 'Reminders Sent',
        description: 'Payment reminders sent to all participants!',
        variant: 'success',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to send reminders';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Settle bill
   */
  const handleSettleBill = async (billId: string, billTitle: string) => {
    try {
      setActionLoading(billId);
      await authClient.post(`/api/v1/wallets/payments/bill-split/${billId}/settle`, {});

      toast({
        title: 'Bill Settled',
        description: `"${billTitle}" has been marked as settled.`,
        variant: 'success',
      });
      loadBills();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to settle bill';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Cancel bill
   */
  const handleCancelBill = async (billId: string, billTitle: string) => {
    if (!confirm(`Are you sure you want to cancel "${billTitle}"?`)) return;

    try {
      setActionLoading(billId);
      await authClient.post(`/api/v1/wallets/payments/bill-split/${billId}/cancel`, {});

      toast({
        title: 'Bill Cancelled',
        description: `"${billTitle}" has been cancelled.`,
        variant: 'success',
      });
      loadBills();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to cancel bill';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

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
   * Get status color
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'settled':
        return 'bg-green-600 text-white';
      case 'active':
        return 'bg-blue-600 text-white';
      case 'cancelled':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  /**
   * Filter bills
   */
  const filteredBills = bills.filter((b) => {
    if (activeTab === 'active') return b.status === 'active';
    if (activeTab === 'settled') return b.status === 'settled';
    return true;
  });

  // Loading skeleton
  const SkeletonCard = () => (
    <Card className="bg-slate-900 border-slate-700 animate-pulse">
      <CardHeader className="pb-3">
        <div className="h-4 bg-slate-700 rounded w-24"></div>
      </CardHeader>
      <CardContent>
        <div className="h-8 bg-slate-700 rounded w-16"></div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Bill Split</h1>
            <p className="text-slate-400">Easily split and manage shared expenses</p>
          </div>
          <Button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Bill
          </Button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-600/20 border border-red-600 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-medium">Unable to Load Bills</h3>
              <p className="text-red-300 text-sm mt-1">{error}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={loadBills}
                className="mt-2 text-red-400 border-red-600 hover:bg-red-600/20"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-slate-900 border-slate-700 hover:border-slate-600 transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Bills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats.totalBills}</div>
                <p className="text-xs text-slate-500 mt-1">all time</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700 hover:border-blue-600 transition border-l-4 border-l-blue-600">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Active Bills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">{stats.activeBills}</div>
                <p className="text-xs text-slate-500 mt-1">awaiting payment</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700 hover:border-slate-600 transition">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Amount
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats.totalAmount.toFixed(2)}</div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <span className="text-yellow-400">owed:</span> {stats.totalOwed.toFixed(2)} cUSD
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700 hover:border-green-600 transition border-l-4 border-l-green-600">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Settled
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">{stats.settledBills}</div>
                <p className="text-xs text-slate-500 mt-1">completed</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Bills List Card */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  Bill Splits
                </CardTitle>
                <CardDescription className="mt-1">
                  {filteredBills.length} {activeTab} {filteredBills.length === 1 ? 'bill' : 'bills'}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadBills}
                disabled={loading}
              >
                {loading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  '↻ Refresh'
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Active
                </TabsTrigger>
                <TabsTrigger value="settled" className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Settled
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4">
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-24 bg-slate-800 rounded-lg animate-pulse"></div>
                    ))}
                  </div>
                ) : filteredBills.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-slate-600 mx-auto mb-3 opacity-50" />
                    <p className="text-slate-400 font-medium">No active bills</p>
                    <p className="text-slate-500 text-sm mt-1">Create a new bill to get started</p>
                  </div>
                ) : (
                  filteredBills.map((bill) => (
                    <BillCard
                      key={bill.id}
                      bill={bill}
                      onRemind={() => handleSendReminders(bill.id, bill.title)}
                      onSettle={() => handleSettleBill(bill.id, bill.title)}
                      onCancel={() => handleCancelBill(bill.id, bill.title)}
                      isLoading={actionLoading === bill.id}
                      formatDate={formatDate}
                      getStatusColor={getStatusColor}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="settled" className="space-y-4">
                {filteredBills.length === 0 ? (
                  <div className="text-center py-12">
                    <Check className="h-12 w-12 text-slate-600 mx-auto mb-3 opacity-50" />
                    <p className="text-slate-400 font-medium">No settled bills yet</p>
                    <p className="text-slate-500 text-sm mt-1">Settled bills will appear here</p>
                  </div>
                ) : (
                  filteredBills.map((bill) => (
                    <BillCard
                      key={bill.id}
                      bill={bill}
                      onRemind={() => {}}
                      onSettle={() => {}}
                      onCancel={() => {}}
                      isLoading={false}
                      formatDate={formatDate}
                      getStatusColor={getStatusColor}
                      settled
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                {bills.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-slate-600 mx-auto mb-3 opacity-50" />
                    <p className="text-slate-400 font-medium">No bills in history</p>
                    <p className="text-slate-500 text-sm mt-1">Your bill history will appear here</p>
                  </div>
                ) : (
                  bills.map((bill) => (
                    <BillCard
                      key={bill.id}
                      bill={bill}
                      onRemind={() => {}}
                      onSettle={() => {}}
                      onCancel={() => {}}
                      isLoading={false}
                      formatDate={formatDate}
                      getStatusColor={getStatusColor}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Bill Split Modal */}
        <BillSplitModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onCreateBill={handleCreateBill}
        />
      </div>
    </div>
  );
}

/**
 * Bill Card Component
 */
function BillCard({
  bill,
  onRemind,
  onSettle,
  onCancel,
  isLoading,
  formatDate,
  getStatusColor,
  settled = false,
}: {
  bill: BillSplit;
  onRemind: () => void;
  onSettle: () => void;
  onCancel: () => void;
  isLoading: boolean;
  formatDate: (date: string) => string;
  getStatusColor: (status: string) => string;
  settled?: boolean;
}) {
  const paidCount = bill.participants?.filter((p) => p.paid).length || 0;
  const totalParticipants = bill.participants?.length || 0;
  const progressPercent = totalParticipants > 0 ? (paidCount / totalParticipants) * 100 : 0;

  return (
    <div className={`border border-slate-700 rounded-lg p-4 transition ${!settled ? 'hover:bg-slate-800/50' : 'opacity-75'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-white text-lg">{bill.title}</h3>
          {bill.description && (
            <p className="text-sm text-slate-400 mt-1">{bill.description}</p>
          )}
        </div>
        <Badge className={getStatusColor(bill.status)}>
          {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Amount</p>
          <p className="text-lg font-bold text-white mt-1">
            {bill.currency} {bill.totalAmount.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Participants</p>
          <p className="text-lg font-bold text-white mt-1">{totalParticipants}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Created</p>
          <p className="text-sm text-slate-300 mt-1">{formatDate(bill.createdAt)}</p>
        </div>
      </div>

      {/* Payment Progress */}
      {!settled && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400">Payment Progress</p>
            <p className="text-xs font-medium text-slate-300">
              {paidCount} of {totalParticipants}
            </p>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Actions */}
      {!settled && (
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onRemind}
            disabled={isLoading}
            className="text-slate-300 border-slate-600 hover:bg-slate-800"
          >
            {isLoading ? (
              <Loader className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Bell className="h-4 w-4 mr-1" />
            )}
            Remind
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onSettle}
            disabled={isLoading}
            className="text-green-400 border-green-600 hover:bg-green-600/20"
          >
            {isLoading ? (
              <Loader className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Settle
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="text-red-400 border-red-600 hover:bg-red-600/20"
          >
            {isLoading ? (
              <Loader className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export default BillSplitPage;
