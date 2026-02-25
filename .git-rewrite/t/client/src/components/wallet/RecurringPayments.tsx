
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Calendar, Clock, DollarSign, Pause, Play, Trash2, Plus } from 'lucide-react';
import { Switch } from '../ui/switch';

interface RecurringPayment {
  id: string;
  title: string;
  description?: string;
  amount: string;
  currency: string;
  toAddress: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextPayment: string;
  isActive: boolean;
  createdAt: string;
  lastPayment?: string;
  totalPaid: string;
  paymentCount: number;
}

interface RecurringPaymentsProps {
  walletAddress: string;
}

export default function RecurringPayments({ walletAddress }: RecurringPaymentsProps) {
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    title: '',
    description: '',
    amount: '',
    currency: 'cUSD',
    toAddress: '',
    frequency: 'monthly' as const
  });

  useEffect(() => {
    fetchRecurringPayments();
  }, [walletAddress]);

  const fetchRecurringPayments = async () => {
    try {
      const response = await fetch(`/api/wallet/recurring-payments?walletAddress=${walletAddress}`);
      const data = await response.json();
      setRecurringPayments(data.payments || []);
    } catch (error) {
      console.error('Error fetching recurring payments:', error);
    }
    setLoading(false);
  };

  const createRecurringPayment = async () => {
    try {
      const response = await fetch('/api/wallet/recurring-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPayment,
          walletAddress
        })
      });

      if (response.ok) {
        setCreateModalOpen(false);
        setNewPayment({
          title: '',
          description: '',
          amount: '',
          currency: 'cUSD',
          toAddress: '',
          frequency: 'monthly'
        });
        fetchRecurringPayments();
      }
    } catch (error) {
      console.error('Error creating recurring payment:', error);
    }
  };

  const togglePayment = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/wallet/recurring-payments/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });
      fetchRecurringPayments();
    } catch (error) {
      console.error('Error toggling payment:', error);
    }
  };

  const deletePayment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recurring payment?')) return;
    
    try {
      await fetch(`/api/wallet/recurring-payments/${id}`, {
        method: 'DELETE'
      });
      fetchRecurringPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
    }
  };

  const getFrequencyDisplay = (frequency: string) => {
    const displays = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly'
    };
    return displays[frequency as keyof typeof displays] || frequency;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recurring Payments
            </CardTitle>
            <CardDescription>
              Automate your regular transactions
            </CardDescription>
          </div>
          
          <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Recurring Payment</DialogTitle>
                <DialogDescription>
                  Set up an automated payment that will execute on a regular schedule
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="title">Payment Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Monthly DAO Contribution"
                    value={newPayment.title}
                    onChange={(e) => setNewPayment({ ...newPayment, title: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    placeholder="Additional details"
                    value={newPayment.description}
                    onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={newPayment.currency} onValueChange={(value) => setNewPayment({ ...newPayment, currency: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cUSD">cUSD</SelectItem>
                        <SelectItem value="CELO">CELO</SelectItem>
                        <SelectItem value="cEUR">cEUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="toAddress">Recipient Address</Label>
                  <Input
                    id="toAddress"
                    placeholder="0x..."
                    value={newPayment.toAddress}
                    onChange={(e) => setNewPayment({ ...newPayment, toAddress: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="frequency">Payment Frequency</Label>
                  <Select value={newPayment.frequency} onValueChange={(value) => setNewPayment({ ...newPayment, frequency: value as any })}>
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

                <div className="flex justify-end space-x-2 mt-6">
                  <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createRecurringPayment} disabled={!newPayment.title || !newPayment.amount || !newPayment.toAddress}>
                    Create Payment
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {recurringPayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recurring payments set up yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recurringPayments.map((payment) => (
              <div key={payment.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-medium">{payment.title}</h3>
                      <Badge variant={payment.isActive ? 'default' : 'secondary'}>
                        {payment.isActive ? 'Active' : 'Paused'}
                      </Badge>
                      <Badge variant="outline">
                        {getFrequencyDisplay(payment.frequency)}
                      </Badge>
                    </div>
                    
                    {payment.description && (
                      <p className="text-sm text-gray-600 mt-1">{payment.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {payment.amount} {payment.currency}
                      </span>
                      <span>To: {formatAddress(payment.toAddress)}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Next: {new Date(payment.nextPayment).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                      <span>{payment.paymentCount} payments</span>
                      <span>Total paid: {payment.totalPaid} {payment.currency}</span>
                      {payment.lastPayment && (
                        <span>Last: {new Date(payment.lastPayment).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={payment.isActive}
                      onCheckedChange={(checked) => togglePayment(payment.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePayment(payment.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
