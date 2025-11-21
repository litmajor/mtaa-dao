
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { 
  CreditCard, 
  Vault, 
  Users, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Calendar,
  DollarSign,
  Settings
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type PaymentMethod = 'stripe' | 'vault' | 'split_equal' | 'split_custom' | 'split_percentage';

interface SubscriptionDetails {
  currentPlan: string;
  status: string;
  nextBillingDate: string;
  billingHistory: any[];
}

export default function SubscriptionManagement() {
  const { daoId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedPlan, setSelectedPlan] = useState('premium');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('vault');
  const [selectedVaultId, setSelectedVaultId] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom' | 'percentage'>('equal');

  // Fetch subscription details
  const { data: subscription, isLoading } = useQuery<SubscriptionDetails>({
    queryKey: ['subscription', daoId],
    queryFn: async () => {
      const res = await fetch(`/api/subscription-management/${daoId}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch subscription');
      return res.json();
    }
  });

  // Fetch DAO vaults
  const { data: vaults } = useQuery({
    queryKey: ['dao-vaults', daoId],
    queryFn: async () => {
      const res = await fetch(`/api/dao-treasury/${daoId}/vaults`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch vaults');
      return res.json();
    }
  });

  // Upgrade mutation
  const upgradeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/subscription-management/${daoId}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upgrade failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', daoId] });
      toast({
        title: 'Success!',
        description: 'Subscription upgraded successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleUpgrade = () => {
    const upgradeData: any = {
      plan: selectedPlan,
      paymentMethod
    };

    if (paymentMethod === 'vault') {
      upgradeData.vaultId = selectedVaultId;
    }

    if (paymentMethod.startsWith('split')) {
      upgradeData.splitConfig = { type: splitType };
    }

    upgradeMutation.mutate(upgradeData);
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  const pricing = {
    community: { amount: 0, currency: 'KES' },
    growth: { amount: 300, currency: 'KES' },
    professional: { amount: 1200, currency: 'KES' }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription Management</h1>
          <p className="text-gray-600">Manage your DAO's subscription and billing</p>
        </div>
        <Badge variant={subscription?.status === 'active' ? 'default' : 'secondary'}>
          {subscription?.currentPlan?.toUpperCase()}
        </Badge>
      </div>

      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Plan</p>
              <p className="text-lg font-semibold">{subscription?.currentPlan || 'Free'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-lg font-semibold">{subscription?.status || 'Active'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Next Billing</p>
              <p className="text-lg font-semibold">
                {subscription?.nextBillingDate 
                  ? new Date(subscription.nextBillingDate).toLocaleDateString()
                  : 'N/A'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upgrade to Premium</CardTitle>
          <CardDescription>Choose your payment method and upgrade your DAO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment Method Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="vault" id="vault" />
                <Label htmlFor="vault" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Vault className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Pay from DAO Vault</p>
                    <p className="text-sm text-gray-600">Automatic payment from DAO treasury</p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="stripe" id="stripe" />
                <Label htmlFor="stripe" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-medium">Pay with Stripe</p>
                    <p className="text-sm text-gray-600">Card payment via Stripe</p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="split_equal" id="split_equal" />
                <Label htmlFor="split_equal" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Users className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">Split Equally Among Members</p>
                    <p className="text-sm text-gray-600">Automatic equal split between all members</p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="split_custom" id="split_custom" />
                <Label htmlFor="split_custom" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Settings className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="font-medium">Custom Split by Role</p>
                    <p className="text-sm text-gray-600">Admins/Elders pay more, members less</p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="split_percentage" id="split_percentage" />
                <Label htmlFor="split_percentage" className="flex items-center gap-2 cursor-pointer flex-1">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="font-medium">Split by Voting Power/Contribution</p>
                    <p className="text-sm text-gray-600">Based on member contribution level</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Vault Selection */}
          {paymentMethod === 'vault' && (
            <div className="space-y-2">
              <Label>Select Vault</Label>
              <Select value={selectedVaultId} onValueChange={setSelectedVaultId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a vault" />
                </SelectTrigger>
                <SelectContent>
                  {vaults?.vaults?.map((vault: any) => (
                    <SelectItem key={vault.id} value={vault.id}>
                      {vault.name} - Balance: {vault.balance} {vault.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pricing Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <span className="font-semibold">Total Amount</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">
                KES {pricing[selectedPlan as keyof typeof pricing].amount}
              </span>
            </div>
            {paymentMethod.startsWith('split') && (
              <p className="text-sm text-gray-600 mt-2">
                Will be automatically split among all active members
              </p>
            )}
          </div>

          <Button 
            onClick={handleUpgrade} 
            className="w-full"
            disabled={upgradeMutation.isPending || (paymentMethod === 'vault' && !selectedVaultId)}
          >
            {upgradeMutation.isPending ? 'Processing...' : 'Upgrade to Premium'}
          </Button>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {subscription?.billingHistory?.length > 0 ? (
              subscription.billingHistory.map((bill: any) => (
                <div key={bill.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{bill.description}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(bill.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{bill.currency} {bill.amount}</p>
                    <Badge variant={bill.status === 'completed' ? 'default' : 'secondary'}>
                      {bill.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">No billing history yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
