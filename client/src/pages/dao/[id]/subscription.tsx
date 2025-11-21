import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Check, AlertCircle, Calendar, Zap, Users, BarChart3 } from 'lucide-react';

interface SubscriptionTier {
  name: 'free' | 'pro' | 'enterprise';
  displayName: string;
  price: number;
  billingCycle: 'monthly' | 'annual';
  limits: {
    maxMembers: number;
    maxDailyTransactions: number;
    maxMonthlyVolume: number;
    rotationFeature: boolean;
    customRulesFeature: boolean;
    advancedAnalytics: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
  };
  description: string;
}

interface CurrentSubscription {
  tier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'expired';
  startDate: string;
  renewalDate: string;
  autoRenew: boolean;
  paymentMethod: string;
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    name: 'free',
    displayName: 'Free',
    price: 0,
    billingCycle: 'monthly',
    limits: {
      maxMembers: 10,
      maxDailyTransactions: 50,
      maxMonthlyVolume: 5000,
      rotationFeature: true,
      customRulesFeature: false,
      advancedAnalytics: false,
      apiAccess: false,
      prioritySupport: false
    },
    description: 'Perfect for small groups'
  },
  {
    name: 'pro',
    displayName: 'Pro',
    price: 49,
    billingCycle: 'monthly',
    limits: {
      maxMembers: 100,
      maxDailyTransactions: 500,
      maxMonthlyVolume: 100000,
      rotationFeature: true,
      customRulesFeature: true,
      advancedAnalytics: true,
      apiAccess: true,
      prioritySupport: false
    },
    description: 'For growing DAOs'
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    price: 199,
    billingCycle: 'monthly',
    limits: {
      maxMembers: 10000,
      maxDailyTransactions: 5000,
      maxMonthlyVolume: 10000000,
      rotationFeature: true,
      customRulesFeature: true,
      advancedAnalytics: true,
      apiAccess: true,
      prioritySupport: true
    },
    description: 'For large-scale operations'
  }
];

export default function SubscriptionManagementPage() {
  const { id: daoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [upgradeProcessing, setUpgradeProcessing] = useState(false);
  const [invoiceHistory, setInvoiceHistory] = useState<any[]>([]);

  useEffect(() => {
    if (daoId) {
      fetchSubscription();
      checkAdminStatus();
    }
  }, [daoId]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch(`/api/dao/${daoId}/admin-check`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        setIsAdmin(true);
      }
    } catch (err) {
      console.error('Admin check failed:', err);
    }
  };

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dao/${daoId}/subscription`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch subscription');

      const data = await response.json();
      setSubscription(data.subscription);
      setInvoiceHistory(data.invoiceHistory || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (newTier: string) => {
    if (!isAdmin) return;

    try {
      setUpgradeProcessing(true);
      const response = await fetch(`/api/dao/${daoId}/subscription/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ newTier })
      });

      if (!response.ok) throw new Error('Failed to upgrade');

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        fetchSubscription();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade subscription');
    } finally {
      setUpgradeProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!isAdmin || !confirm('Are you sure you want to cancel? You will lose access to premium features.')) return;

    try {
      const response = await fetch(`/api/dao/${daoId}/subscription/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to cancel');

      fetchSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    }
  };

  const getTierTierIndex = (tier: string) => {
    return SUBSCRIPTION_TIERS.findIndex(t => t.name === tier);
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center p-8 text-red-600">
          Only DAO admins can manage subscriptions
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const currentTierIndex = subscription ? getTierTierIndex(subscription.tier) : 0;

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="w-8 h-8" />
            Subscription & Billing
          </h1>
          <p className="text-gray-600 mt-2">Manage your DAO's subscription and billing</p>
        </div>
        <Button onClick={() => navigate(-1)} variant="outline">
          Back
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Current Subscription Status */}
      {subscription && (
        <Card className="border-teal-200 dark:border-teal-800">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-950/50 dark:to-blue-950/50">
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Active Plan</p>
                <p className="text-3xl font-bold capitalize">{subscription.tier}</p>
                <Badge className={`mt-2 ${
                  subscription.tier === 'enterprise' ? 'bg-purple-600' :
                  subscription.tier === 'pro' ? 'bg-blue-600' :
                  'bg-gray-600'
                }`}>
                  {subscription.status}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Renewal Date</p>
                <p className="text-xl font-semibold">
                  {new Date(subscription.renewalDate).toLocaleDateString()}
                </p>
                {subscription.autoRenew ? (
                  <p className="text-xs text-green-600 mt-1">✓ Auto-renew enabled</p>
                ) : (
                  <p className="text-xs text-orange-600 mt-1">⚠️ Auto-renew disabled</p>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Payment Method</p>
                <p className="text-lg font-semibold">{subscription.paymentMethod || 'None'}</p>
                <Button size="sm" variant="outline" className="mt-2">
                  Update Payment
                </Button>
              </div>
            </div>

            {subscription.status === 'active' && (
              <Button
                onClick={handleCancelSubscription}
                variant="destructive"
                className="mt-4"
              >
                Cancel Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="plans" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plans">Plans & Pricing</TabsTrigger>
          <TabsTrigger value="features">Feature Comparison</TabsTrigger>
          <TabsTrigger value="billing">Billing History</TabsTrigger>
        </TabsList>

        {/* Plans & Pricing */}
        <TabsContent value="plans" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SUBSCRIPTION_TIERS.map((tier, index) => (
              <Card
                key={tier.name}
                className={`relative transition ${
                  subscription?.tier === tier.name
                    ? 'border-teal-500 border-2 shadow-lg'
                    : 'border-gray-200'
                }`}
              >
                {subscription?.tier === tier.name && (
                  <div className="absolute -top-3 -right-3">
                    <Badge className="bg-teal-500">Current Plan</Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle>{tier.displayName}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <p className="text-4xl font-bold">${tier.price}</p>
                    <p className="text-sm text-gray-500">per month</p>
                  </div>

                  {subscription?.tier !== tier.name && index > currentTierIndex && (
                    <Button
                      onClick={() => handleUpgrade(tier.name)}
                      disabled={upgradeProcessing}
                      className="w-full bg-teal-600 hover:bg-teal-700"
                    >
                      Upgrade to {tier.displayName}
                    </Button>
                  )}

                  {subscription?.tier === tier.name && (
                    <Button disabled className="w-full">
                      Current Plan
                    </Button>
                  )}

                  {subscription?.tier !== tier.name && index < currentTierIndex && (
                    <Button
                      onClick={() => handleUpgrade(tier.name)}
                      variant="outline"
                      className="w-full"
                    >
                      Downgrade
                    </Button>
                  )}

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-teal-600" />
                      <span className="text-sm">{tier.limits.maxMembers} Members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-teal-600" />
                      <span className="text-sm">${tier.limits.maxMonthlyVolume.toLocaleString()} Volume</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-teal-600" />
                      <span className="text-sm">{tier.limits.maxDailyTransactions} Daily Txns</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">What's included in each tier?</p>
                  <p className="mt-1">All plans include rotation logic and referral tracking. Pro and Enterprise unlock custom rules, analytics, and API access.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Comparison */}
        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Feature Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Feature</th>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <th key={tier.name} className="text-center py-3 px-4 font-semibold">
                          {tier.displayName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4">Rotation Logic</td>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <td key={tier.name} className="text-center">
                          {tier.limits.rotationFeature ? <Check className="w-5 h-5 text-green-600 mx-auto" /> : '—'}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Custom Rules</td>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <td key={tier.name} className="text-center">
                          {tier.limits.customRulesFeature ? <Check className="w-5 h-5 text-green-600 mx-auto" /> : '—'}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Advanced Analytics</td>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <td key={tier.name} className="text-center">
                          {tier.limits.advancedAnalytics ? <Check className="w-5 h-5 text-green-600 mx-auto" /> : '—'}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">API Access</td>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <td key={tier.name} className="text-center">
                          {tier.limits.apiAccess ? <Check className="w-5 h-5 text-green-600 mx-auto" /> : '—'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Priority Support</td>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <td key={tier.name} className="text-center">
                          {tier.limits.prioritySupport ? <Check className="w-5 h-5 text-green-600 mx-auto" /> : '—'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing History */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
            </CardHeader>
            <CardContent>
              {invoiceHistory.length === 0 ? (
                <p className="text-gray-500 py-8 text-center">No invoices yet</p>
              ) : (
                <div className="space-y-2">
                  {invoiceHistory.map(invoice => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900">
                      <div>
                        <p className="font-medium">{invoice.description}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(invoice.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${invoice.amount}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
