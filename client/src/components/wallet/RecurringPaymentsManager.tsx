
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Pause, Play, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiPost, apiDelete, apiPut } from '@/lib/api';
import { useSharedSocket } from '@/hooks/useSharedSocket';

interface RecurringPayment {
  id: string;
  recipient: string;
  amount: string;
  token: string;
  frequency: string;
  nextPayment: string;
  status: 'active' | 'paused';
}

export default function RecurringPaymentsManager() {
  const { socket, isConnected } = useSharedSocket();
  
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    recipient: '',
    amount: '',
    token: 'CELO',
    frequency: 'monthly',
    startDate: '',
  });

  const handleCreateRecurring = async () => {
    try {
      const result = await apiPost('/api/v1/wallets/payments/recurring', formData);
      toast({ title: 'Success', description: 'Recurring payment created' });
      setPayments([...payments, result.payment]);
      setIsOpen(false);
      setFormData({ recipient: '', amount: '', token: 'CELO', frequency: 'monthly', startDate: '' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // WebSocket real-time updates for recurring payments via notificationService
  useEffect(() => {
    if (!socket || !isConnected) {
      setWsConnected(false);
      return;
    }

    setWsConnected(true);

    // Handle recurring payment notifications from notificationService
    const handleNotification = (data: any) => {
      try {
        // Check if this is a recurring payment-related notification
        if (data.type?.includes('recurring') || data.type?.includes('payment') ||
            data.metadata?.entityType === 'recurring_payment') {
          
          // Show toast for important notifications
          if (data.type?.includes('failed') || data.type?.includes('alert')) {
            toast({ 
              title: data.title || 'Payment Notification', 
              description: data.message,
              variant: data.priority === 'high' ? 'destructive' : 'default'
            });
          }
          
          // Refresh list for any recurring payment notification
          if (data.type?.includes('created') || data.type?.includes('modified') || 
              data.type?.includes('completed') || data.type?.includes('failed')) {
            // Could fetch updated list here if needed
          }
        }
      } catch (error) {
        console.error('Error processing recurring payment notification:', error);
      }
    };

    socket.on('notification_created', handleNotification);

    // Cleanup
    return () => {
      socket.off('notification_created', handleNotification);
    };
  }, [socket, isConnected, toast]);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      await apiPut(`/api/v1/wallets/payments/recurring/${id}`, { status: newStatus });
      setPayments(payments.map(p => p.id === id ? { ...p, status: newStatus } : p));
      toast({ title: 'Success', description: `Payment ${newStatus}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/api/v1/wallets/payments/recurring/${id}`);
      setPayments(payments.filter(p => p.id !== id));
      toast({ title: 'Success', description: 'Recurring payment deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recurring Payments</CardTitle>
          <CardDescription>Manage your subscription and recurring payments</CardDescription>
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
                <span className="text-xs text-gray-500">Offline mode</span>
              </>
            )}
          </div>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Recurring Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Recurring Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Recipient (username or address)</Label>
                <Input
                  value={formData.recipient}
                  onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                  placeholder="@username or 0x..."
                />
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              <div>
                <Label>Token</Label>
                <Select value={formData.token} onValueChange={(value) => setFormData({ ...formData, token: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CELO">CELO</SelectItem>
                    <SelectItem value="cUSD">cUSD</SelectItem>
                    <SelectItem value="cEUR">cEUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={formData.frequency} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <Button onClick={handleCreateRecurring} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{payment.recipient}</div>
                <div className="text-sm text-muted-foreground">
                  {payment.amount} {payment.token} · {payment.frequency}
                </div>
                <div className="text-xs text-muted-foreground flex items-center mt-1">
                  <Calendar className="w-3 h-3 mr-1" />
                  Next: {payment.nextPayment}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleToggleStatus(payment.id, payment.status)}
                >
                  {payment.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(payment.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
