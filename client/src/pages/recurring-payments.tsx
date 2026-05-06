import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  Plus,
  Pause,
  Play,
  Trash2,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiPost, apiDelete, apiPut, apiGet } from '@/lib/api';
import RecurringPaymentModal from '@/components/modals/RecurringPaymentModal';

interface RecurringPayment {
  id: string;
  recipient: string;
  amount: string;
  token: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextPayment: string;
  status: 'active' | 'paused';
  description?: string;
  totalExecuted: number;
  lastExecuted?: string;
  createdAt: string;
}

export default function RecurringPaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    fetchRecurringPayments();
  }, []);

  const fetchRecurringPayments = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/v1/wallets/payments/recurring?status=');
      setPayments(response.payments || []);
    } catch (error: any) {
      console.error('Error loading recurring payments:', error);
      // Continue silently to show empty state rather than error
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      await apiPut(`/api/v1/wallets/payments/recurring/${id}`, { status: newStatus });
      
      setPayments(payments.map(p =>
        p.id === id ? { ...p, status: newStatus } : p
      ));
      
      toast({
        title: 'Success',
        description: `Recurring payment ${newStatus === 'active' ? 'resumed' : 'paused'}`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recurring payment?')) return;

    try {
      await apiDelete(`/api/v1/wallets/payments/recurring/${id}`);
      setPayments(payments.filter(p => p.id !== id));
      
      toast({
        title: 'Success',
        description: 'Recurring payment deleted'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly'
    };
    return labels[frequency] || frequency;
  };

  const activePayments = payments.filter(p => p.status === 'active');
  const pausedPayments = payments.filter(p => p.status === 'paused');

  // Calculate stats
  const totalMonthly = activePayments
    .filter(p => p.frequency === 'monthly')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const stats = [
    {
      label: 'Active Payments',
      value: activePayments.length.toString(),
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      label: 'Paused Payments',
      value: pausedPayments.length.toString(),
      icon: Pause,
      color: 'text-orange-600'
    },
    {
      label: 'Monthly Total',
      value: `${totalMonthly.toFixed(2)} cUSD`,
      icon: DollarSign,
      color: 'text-blue-600'
    },
    {
      label: 'Total Executed',
      value: activePayments.reduce((sum, p) => sum + (p.totalExecuted || 0), 0).toString(),
      icon: TrendingUp,
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Recurring Payments
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Automate your regular transactions
            </p>
          </div>
          <Button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Recurring Payment
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <Icon className={`h-8 w-8 ${stat.color} opacity-20`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Payment List */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Your Recurring Payments
            </CardTitle>
            <CardDescription>
              {payments.length} total
              {activePayments.length > 0 && ` · ${activePayments.length} active`}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-48 bg-gray-200 rounded"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
              </div>
            ) : payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Clock className="h-12 w-12 text-gray-300 dark:text-gray-700 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  No recurring payments yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create your first automated payment to get started
                </p>
                <Button onClick={() => setShowModal(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Payment
                </Button>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-4 border-0">
                  <TabsTrigger value="active" className="data-[state=active]:border-b-2">
                    Active ({activePayments.length})
                  </TabsTrigger>
                  <TabsTrigger value="paused" className="data-[state=active]:border-b-2">
                    Paused ({pausedPayments.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-3 p-4">
                  {activePayments.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">No active recurring payments</p>
                  ) : (
                    activePayments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        onTogglePause={() => handleTogglePause(payment.id, payment.status)}
                        onDelete={() => handleDelete(payment.id)}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="paused" className="space-y-3 p-4">
                  {pausedPayments.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">No paused recurring payments</p>
                  ) : (
                    pausedPayments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        onTogglePause={() => handleTogglePause(payment.id, payment.status)}
                        onDelete={() => handleDelete(payment.id)}
                      />
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal */}
      <RecurringPaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchRecurringPayments}
      />
    </div>
  );
}

function PaymentCard({
  payment,
  onTogglePause,
  onDelete
}: {
  payment: RecurringPayment;
  onTogglePause: () => void;
  onDelete: () => void;
}) {
  const nextPaymentDate = new Date(payment.nextPayment);
  const daysUntil = Math.ceil((nextPaymentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {payment.recipient.startsWith('0x') ? `${payment.recipient.slice(0, 6)}...${payment.recipient.slice(-4)}` : payment.recipient}
            </h3>
            <Badge variant={payment.status === 'active' ? 'default' : 'secondary'}>
              {payment.status === 'active' ? 'Active' : 'Paused'}
            </Badge>
            <Badge variant="outline">{getFrequencyLabel(payment.frequency)}</Badge>
          </div>

          {payment.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{payment.description}</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Amount</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {payment.amount} {payment.token}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Next Payment</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {nextPaymentDate.toLocaleDateString()}
                <span className="text-xs text-gray-500 block">
                  {daysUntil > 0 ? `in ${daysUntil}d` : 'Today'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Total Executed</p>
              <p className="font-semibold text-gray-900 dark:text-white">{payment.totalExecuted}</p>
            </div>
            {payment.lastExecuted && (
              <div>
                <p className="text-gray-500 dark:text-gray-400">Last Payment</p>
                <p className="font-semibold text-gray-900 dark:text-white text-xs">
                  {new Date(payment.lastExecuted).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onTogglePause}>
              {payment.status === 'active' ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Payment
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume Payment
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Payment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function getFrequencyLabel(frequency: string) {
  const labels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly'
  };
  return labels[frequency] || frequency;
}
