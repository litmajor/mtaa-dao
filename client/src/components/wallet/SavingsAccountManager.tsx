
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PiggyBank, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SavingsAccount {
  id: string;
  amount: string;
  currency: string;
  lockPeriod: number;
  interestRate: string;
  lockedAt: string;
  unlocksAt: string;
  status: string;
  currentValue: string;
  earnedInterest: string;
  isMatured: boolean;
  daysRemaining: number;
}

export function SavingsAccountManager() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedSavings, setSelectedSavings] = useState<SavingsAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [lockPeriod, setLockPeriod] = useState('30');
  const [forceWithdraw, setForceWithdraw] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: savingsData, isLoading } = useQuery({
    queryKey: ['savings'],
    queryFn: async () => {
      const res = await fetch('/api/wallet/savings', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch savings');
      return res.json();
    }
  });

  const createSavingsMutation = useMutation({
    mutationFn: async (data: { amount: string; lockPeriodDays: number }) => {
      const res = await fetch('/api/wallet/savings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create savings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings'] });
      setShowCreateModal(false);
      setAmount('');
    }
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ savingsId, force }: { savingsId: string; force: boolean }) => {
      const res = await fetch(`/api/wallet/savings/withdraw/${savingsId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ force })
      });
      if (!res.ok) throw new Error('Failed to withdraw');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings'] });
      setShowWithdrawModal(false);
      setForceWithdraw(false);
    }
  });

  const getInterestRate = (days: number) => {
    if (days >= 365) return '15%';
    if (days >= 180) return '12%';
    if (days >= 90) return '10%';
    if (days >= 30) return '8%';
    return '5%';
  };

  const handleCreateSavings = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    createSavingsMutation.mutate({
      amount,
      lockPeriodDays: parseInt(lockPeriod)
    });
  };

  const handleWithdraw = () => {
    if (!selectedSavings) return;
    withdrawMutation.mutate({
      savingsId: selectedSavings.id,
      force: forceWithdraw
    });
  };

  const savings = savingsData?.savings || [];
  const activeSavings = savings.filter((s: SavingsAccount) => s.status === 'locked');
  const totalSaved = activeSavings.reduce((sum: number, s: SavingsAccount) => 
    sum + parseFloat(s.currentValue), 0);
  const totalInterest = activeSavings.reduce((sum: number, s: SavingsAccount) => 
    sum + parseFloat(s.earnedInterest), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Savings Accounts</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <PiggyBank className="w-4 h-4 mr-2" />
          Create Savings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Saved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSaved.toFixed(2)} cUSD</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Interest Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{totalInterest.toFixed(2)} cUSD</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSavings.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8">Loading...</div>
        ) : savings.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No savings accounts yet. Create one to start earning interest!
          </div>
        ) : (
          savings.map((s: SavingsAccount) => (
            <Card key={s.id} className={s.status === 'withdrawn' ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{parseFloat(s.amount).toFixed(2)} {s.currency}</CardTitle>
                  <Badge variant={s.isMatured ? 'default' : 'secondary'}>
                    {s.isMatured ? 'Matured' : `${s.daysRemaining}d left`}
                  </Badge>
                </div>
                <CardDescription>
                  {(parseFloat(s.interestRate) * 100).toFixed(1)}% APY • {s.lockPeriod} days
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Value</span>
                    <span className="font-semibold">{s.currentValue} {s.currency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Interest Earned</span>
                    <span className="font-semibold text-green-600">+{s.earnedInterest}</span>
                  </div>
                </div>
                
                {s.status === 'locked' && (
                  <Button 
                    className="w-full" 
                    variant={s.isMatured ? 'default' : 'outline'}
                    onClick={() => {
                      setSelectedSavings(s);
                      setShowWithdrawModal(true);
                    }}
                  >
                    {s.isMatured ? 'Withdraw' : 'Early Withdrawal (10% penalty)'}
                  </Button>
                )}
                
                {s.status === 'withdrawn' && (
                  <Badge variant="secondary" className="w-full justify-center">
                    Withdrawn
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Savings Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Savings Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (cUSD)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                min="1"
              />
            </div>
            <div>
              <Label htmlFor="lockPeriod">Lock Period</Label>
              <select
                id="lockPeriod"
                value={lockPeriod}
                onChange={(e) => setLockPeriod(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="30">30 days - 8% APY</option>
                <option value="90">90 days - 10% APY</option>
                <option value="180">180 days - 12% APY</option>
                <option value="365">365 days - 15% APY</option>
              </select>
            </div>
            <Alert>
              <TrendingUp className="h-4 w-4" />
              <AlertDescription>
                Earn {getInterestRate(parseInt(lockPeriod))} APY. Early withdrawal before maturity incurs a 10% penalty.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSavings}
              disabled={createSavingsMutation.isPending || !amount}
            >
              {createSavingsMutation.isPending ? 'Creating...' : 'Create Savings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Savings</DialogTitle>
          </DialogHeader>
          {selectedSavings && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Principal</p>
                  <p className="font-semibold">{selectedSavings.amount} {selectedSavings.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Interest Earned</p>
                  <p className="font-semibold text-green-600">+{selectedSavings.earnedInterest}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Value</p>
                  <p className="font-semibold">{selectedSavings.currentValue} {selectedSavings.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={selectedSavings.isMatured ? 'default' : 'destructive'}>
                    {selectedSavings.isMatured ? 'Matured' : `${selectedSavings.daysRemaining} days left`}
                  </Badge>
                </div>
              </div>

              {!selectedSavings.isMatured && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Early withdrawal penalty: 10% of total value. You will receive{' '}
                    {(parseFloat(selectedSavings.currentValue) * 0.9).toFixed(2)} {selectedSavings.currency}.
                  </AlertDescription>
                </Alert>
              )}

              {selectedSavings.isMatured && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your savings has matured! No penalties apply.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending}
              variant={selectedSavings?.isMatured ? 'default' : 'destructive'}
            >
              {withdrawMutation.isPending ? 'Processing...' : 
               selectedSavings?.isMatured ? 'Withdraw' : 'Withdraw (with penalty)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
