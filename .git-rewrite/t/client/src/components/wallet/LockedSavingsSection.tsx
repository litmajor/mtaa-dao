
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Unlock, Calendar, DollarSign, Target, TrendingUp } from 'lucide-react';

interface LockedSaving {
  id: string;
  amount: string;
  currency: string;
  lockPeriod: number;
  interestRate: string;
  lockedAt: string;
  unlocksAt: string;
  status: string;
}

interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  targetDate: string | null;
  category: string;
  isCompleted: boolean;
}

export function LockedSavingsSection({ userId }: { userId: string }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const queryClient = useQueryClient();

  // Fetch locked savings
  const { data: lockedSavings = [] } = useQuery<LockedSaving[]>({
    queryKey: ['locked-savings', userId],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/locked-savings/${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });

  // Fetch savings goals
  const { data: savingsGoals = [] } = useQuery<SavingsGoal[]>({
    queryKey: ['savings-goals', userId],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/savings-goals/${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Locked Savings & Goals</h2>
        <div className="space-x-2">
          <Button onClick={() => setShowCreateForm(true)} className="bg-purple-600 hover:bg-purple-700">
            <Lock className="w-4 h-4 mr-2" />
            Lock Savings
          </Button>
          <Button onClick={() => setShowGoalForm(true)} variant="outline">
            <Target className="w-4 h-4 mr-2" />
            Set Goal
          </Button>
        </div>
      </div>

      {/* Locked Savings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lockedSavings.map((saving) => (
          <LockedSavingCard key={saving.id} saving={saving} userId={userId} />
        ))}
      </div>

      {/* Savings Goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {savingsGoals.map((goal) => (
          <SavingsGoalCard key={goal.id} goal={goal} />
        ))}
      </div>

      {/* Create Forms */}
      {showCreateForm && (
        <CreateLockedSavingForm 
          userId={userId} 
          onClose={() => setShowCreateForm(false)} 
        />
      )}
      
      {showGoalForm && (
        <CreateSavingsGoalForm 
          userId={userId} 
          onClose={() => setShowGoalForm(false)} 
        />
      )}
    </div>
  );
}

function LockedSavingCard({ saving, userId }: { saving: LockedSaving; userId: string }) {
  const queryClient = useQueryClient();
  const now = new Date();
  const unlockDate = new Date(saving.unlocksAt);
  const isUnlocked = now >= unlockDate;
  const daysLeft = Math.ceil((unlockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const withdrawMutation = useMutation({
    mutationFn: async (isEarlyWithdrawal: boolean) => {
      const res = await fetch(`/api/wallet/locked-savings/withdraw/${saving.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEarlyWithdrawal }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast.success('Withdrawal successful!');
      queryClient.invalidateQueries({ queryKey: ['locked-savings', userId] });
    },
    onError: () => {
      toast.error('Withdrawal failed');
    },
  });

  const handleWithdraw = () => {
    const isEarlyWithdrawal = !isUnlocked;
    if (isEarlyWithdrawal) {
      const confirmed = confirm(
        'Early withdrawal will incur a 10% penalty. Are you sure you want to proceed?'
      );
      if (!confirmed) return;
    }
    withdrawMutation.mutate(isEarlyWithdrawal);
  };

  return (
    <Card className={`border-2 ${isUnlocked ? 'border-green-500' : 'border-orange-500'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">{saving.currency} {saving.amount}</span>
          {isUnlocked ? (
            <Unlock className="w-5 h-5 text-green-500" />
          ) : (
            <Lock className="w-5 h-5 text-orange-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 mr-2" />
          {isUnlocked ? 'Unlocked!' : `${daysLeft} days left`}
        </div>
        <div className="flex items-center text-sm text-muted-foreground">
          <TrendingUp className="w-4 h-4 mr-2" />
          {(parseFloat(saving.interestRate) * 100).toFixed(2)}% APY
        </div>
        {saving.status === 'locked' && (
          <Button 
            onClick={handleWithdraw} 
            disabled={withdrawMutation.isPending}
            className={`w-full ${isUnlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
          >
            {isUnlocked ? 'Withdraw' : 'Early Withdraw (10% penalty)'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SavingsGoalCard({ goal }: { goal: SavingsGoal }) {
  const progress = (parseFloat(goal.currentAmount) / parseFloat(goal.targetAmount)) * 100;

  return (
    <Card className="border-2 border-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{goal.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{goal.currency} {goal.currentAmount}</span>
            <span>{goal.currency} {goal.targetAmount}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {progress.toFixed(1)}% complete
          </div>
        </div>
        {goal.targetDate && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 mr-2" />
            Target: {new Date(goal.targetDate).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateLockedSavingForm({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [lockPeriod, setLockPeriod] = useState('30');
  const [currency, setCurrency] = useState('KES');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/wallet/locked-savings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      toast.success('Locked savings created successfully!');
      queryClient.invalidateQueries({ queryKey: ['locked-savings', userId] });
      onClose();
    },
    onError: () => {
      toast.error('Failed to create locked savings');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      userId,
      amount: parseFloat(amount),
      currency,
      lockPeriod: parseInt(lockPeriod),
      interestRate: getLockPeriodRate(parseInt(lockPeriod)),
    });
  };

  const getLockPeriodRate = (days: number) => {
    if (days >= 365) return 0.08; // 8% APY for 1+ year
    if (days >= 180) return 0.06; // 6% APY for 6+ months
    if (days >= 90) return 0.04;  // 4% APY for 3+ months
    return 0.02; // 2% APY for 1+ month
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Locked Savings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KES">KES</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="cUSD">cUSD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="lockPeriod">Lock Period</Label>
            <Select value={lockPeriod} onValueChange={setLockPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">1 Month (2% APY)</SelectItem>
                <SelectItem value="90">3 Months (4% APY)</SelectItem>
                <SelectItem value="180">6 Months (6% APY)</SelectItem>
                <SelectItem value="365">1 Year (8% APY)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex space-x-2">
            <Button type="submit" disabled={createMutation.isPending} className="flex-1">
              Create Lock
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateSavingsGoalForm({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [category, setCategory] = useState('general');
  const [currency, setCurrency] = useState('KES');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/wallet/savings-goals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      toast.success('Savings goal created successfully!');
      queryClient.invalidateQueries({ queryKey: ['savings-goals', userId] });
      onClose();
    },
    onError: () => {
      toast.error('Failed to create savings goal');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      userId,
      title,
      targetAmount: parseFloat(targetAmount),
      targetDate: targetDate || null,
      category,
      currency,
    });
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Savings Goal</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Goal Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Emergency Fund"
              required
            />
          </div>
          <div>
            <Label htmlFor="targetAmount">Target Amount</Label>
            <Input
              id="targetAmount"
              type="number"
              step="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="targetDate">Target Date (optional)</Label>
            <Input
              id="targetDate"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="emergency">Emergency Fund</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="housing">Housing</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KES">KES</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="cUSD">cUSD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex space-x-2">
            <Button type="submit" disabled={createMutation.isPending} className="flex-1">
              Create Goal
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
