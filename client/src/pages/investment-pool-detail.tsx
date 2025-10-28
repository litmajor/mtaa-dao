import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight, Bitcoin, Activity, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart } from 'recharts';

const COLORS = ['#F7931A', '#627EEA', '#14F195', '#F3BA2F', '#23292F', '#345D9D'];

export default function InvestmentPoolDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [investAmount, setInvestAmount] = useState('');
  const [withdrawShares, setWithdrawShares] = useState('');

  // Fetch pool details
  const { data: poolData, isLoading } = useQuery({
    queryKey: [`/api/investment-pools/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/investment-pools/${id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch pool');
      return res.json();
    },
  });

  // Fetch user's investment
  const { data: myInvestment } = useQuery({
    queryKey: [`/api/investment-pools/${id}/my-investment`],
    queryFn: async () => {
      const res = await fetch(`/api/investment-pools/${id}/my-investment`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch investment');
      return res.json();
    },
  });

  // Fetch pool analytics
  const { data: analyticsData } = useQuery({
    queryKey: [`/api/investment-pools/${id}/analytics`],
    queryFn: async () => {
      const res = await fetch(`/api/investment-pools/${id}/analytics`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });

  // Fetch performance chart data
  const [chartPeriod, setChartPeriod] = useState('30');
  const { data: chartData } = useQuery({
    queryKey: [`/api/investment-pools/${id}/performance-chart`, chartPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/investment-pools/${id}/performance-chart?days=${chartPeriod}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch chart data');
      return res.json();
    },
  });

  // Invest mutation
  const investMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch(`/api/investment-pools/${id}/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd: amount }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to invest');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/investment-pools/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/investment-pools/${id}/my-investment`] });
      toast({
        title: 'Investment Successful!',
        description: 'Your shares have been minted',
      });
      setShowInvestModal(false);
      setInvestAmount('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Investment Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async (shares: number) => {
      const res = await fetch(`/api/investment-pools/${id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shares }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to withdraw');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/investment-pools/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/investment-pools/${id}/my-investment`] });
      toast({
        title: 'Withdrawal Successful!',
        description: 'Funds sent to your wallet',
      });
      setShowWithdrawModal(false);
      setWithdrawShares('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Withdrawal Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleInvest = () => {
    const amount = parseFloat(investAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }
    investMutation.mutate(amount);
  };

  const handleWithdraw = () => {
    const shares = parseFloat(withdrawShares);
    if (isNaN(shares) || shares <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter valid shares',
        variant: 'destructive',
      });
      return;
    }
    withdrawMutation.mutate(shares);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const { pool, assets, investorCount } = poolData || {};
  const tvl = Number(pool?.totalValueLocked || 0);
  const sharePrice = Number(pool?.sharePrice || 1);
  const myShares = Number(myInvestment?.summary?.currentShares || 0);
  const myValue = Number(myInvestment?.summary?.currentValue || 0);
  const myReturn = Number(myInvestment?.summary?.returnPercentage || 0);

  // Prepare pie chart data for allocation
  const allocationChartData = assets?.map((asset: any, index: number) => ({
    name: asset.assetName,
    value: Number(asset.targetAllocation) / 100, // Convert basis points to percentage
    color: COLORS[index % COLORS.length],
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{pool?.name}</h1>
          <p className="text-white/70 text-lg">{pool?.description}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">${tvl.toLocaleString()}</div>
                <div className="text-white/70 text-sm mt-1">Total Value Locked</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">${sharePrice.toFixed(4)}</div>
                <div className="text-white/70 text-sm mt-1">Share Price</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{investorCount || 0}</div>
                <div className="text-white/70 text-sm mt-1">Investors</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{pool?.performanceFee / 100}%</div>
                <div className="text-white/70 text-sm mt-1">Performance Fee</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Portfolio & Assets */}
          <div className="lg:col-span-2 space-y-6">
            {/* Portfolio Allocation */}
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Portfolio Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={allocationChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name} ${value}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {allocationChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Assets */}
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {assets?.map((asset: any) => (
                    <div key={asset.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">{asset.assetSymbol.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="font-bold text-white">{asset.assetName}</div>
                          <div className="text-sm text-white/60">{asset.assetSymbol}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-white">{asset.targetAllocation / 100}%</div>
                        <div className="text-sm text-white/60">${Number(asset.currentPriceUsd || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Chart */}
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Performance History
                  </CardTitle>
                  <Tabs value={chartPeriod} onValueChange={setChartPeriod} className="w-auto">
                    <TabsList className="bg-white/5">
                      <TabsTrigger value="7" className="data-[state=active]:bg-purple-600">7D</TabsTrigger>
                      <TabsTrigger value="30" className="data-[state=active]:bg-purple-600">30D</TabsTrigger>
                      <TabsTrigger value="90" className="data-[state=active]:bg-purple-600">90D</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {chartData?.data && chartData.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData.data}>
                      <defs>
                        <linearGradient id="colorTvl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorReturn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#ffffff60"
                        tick={{ fill: '#ffffff60' }}
                        tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="#ffffff60"
                        tick={{ fill: '#ffffff60' }}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="#ffffff60"
                        tick={{ fill: '#ffffff60' }}
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value: any, name: string) => {
                          if (name === 'tvl') return [`$${Number(value).toLocaleString()}`, 'TVL'];
                          if (name === 'return') return [`${Number(value).toFixed(2)}%`, 'Return'];
                          if (name === 'sharePrice') return [`$${Number(value).toFixed(4)}`, 'Share Price'];
                          return [value, name];
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ color: '#fff' }}
                        formatter={(value) => {
                          if (value === 'tvl') return 'TVL';
                          if (value === 'return') return 'Return %';
                          if (value === 'sharePrice') return 'Share Price';
                          return value;
                        }}
                      />
                      <Area 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="tvl" 
                        stroke="#8b5cf6" 
                        fillOpacity={1} 
                        fill="url(#colorTvl)" 
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="sharePrice" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="return" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-white/60">
                    <div className="text-center">
                      <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Not enough data yet</p>
                      <p className="text-sm">Performance history will appear after first snapshot</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analytics Summary */}
            {analyticsData && (
              <Card className="bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Advanced Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-lg">
                      <div className="text-white/70 text-sm mb-1">7-Day Return</div>
                      <div className={`text-xl font-bold ${analyticsData.performance?.returns7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {analyticsData.performance?.returns7d >= 0 ? '+' : ''}
                        {analyticsData.performance?.returns7d?.toFixed(2) || 0}%
                      </div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                      <div className="text-white/70 text-sm mb-1">30-Day Return</div>
                      <div className={`text-xl font-bold ${analyticsData.performance?.returns30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {analyticsData.performance?.returns30d >= 0 ? '+' : ''}
                        {analyticsData.performance?.returns30d?.toFixed(2) || 0}%
                      </div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                      <div className="text-white/70 text-sm mb-1">Volatility</div>
                      <div className="text-xl font-bold text-blue-400">
                        {analyticsData.performance?.volatility?.toFixed(2) || 0}%
                      </div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                      <div className="text-white/70 text-sm mb-1">Sharpe Ratio</div>
                      <div className="text-xl font-bold text-purple-400">
                        {analyticsData.performance?.sharpeRatio?.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Governance - Weighted Voting */}
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  🗳️ Governance - Share-Weighted Voting
                </CardTitle>
                <CardDescription className="text-white/70">
                  Your voting power = Your shares. 1 share = 1 vote.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Voting Power Display */}
                <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg p-6 mb-6">
                  <div className="text-center">
                    <div className="text-white/70 text-sm mb-2">Your Voting Power</div>
                    <div className="text-4xl font-bold text-white mb-1">{myShares.toFixed(4)}</div>
                    <div className="text-white/60 text-sm">
                      shares ({(myShares / Number(pool?.shareTokenSupply || 1) * 100).toFixed(4)}% of total)
                    </div>
                    {myShares > 0 && (
                      <div className="mt-4 text-green-400 text-sm">
                        ✓ You can vote on proposals and create new ones
                      </div>
                    )}
                    {myShares === 0 && (
                      <div className="mt-4 text-orange-400 text-sm">
                        ⚠️ Invest in this pool to participate in governance
                      </div>
                    )}
                  </div>
                </div>

                {/* Governance Info */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/5 p-4 rounded-lg text-center">
                    <div className="text-white/70 text-sm">Quorum</div>
                    <div className="text-white font-bold">30%</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg text-center">
                    <div className="text-white/70 text-sm">Approval</div>
                    <div className="text-white font-bold">51%</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg text-center">
                    <div className="text-white/70 text-sm">Duration</div>
                    <div className="text-white font-bold">3 Days</div>
                  </div>
                </div>

                {/* Proposals Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Active Proposals</h3>
                    {myShares >= 1 && (
                      <Button 
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          toast({
                            title: 'Create Proposal',
                            description: 'Governance UI coming soon! This feature allows pool investors to propose changes like rebalancing strategies, asset allocations, and fee adjustments.',
                          });
                        }}
                      >
                        + New Proposal
                      </Button>
                    )}
                  </div>

                  {/* Sample Proposal (replace with real data) */}
                  <div className="space-y-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-purple-500/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-white font-bold mb-1">
                            📊 Rebalance to 60/40 BTC/ETH
                          </h4>
                          <p className="text-white/70 text-sm">
                            Proposed by investor with 15% stake
                          </p>
                        </div>
                        <Badge className="bg-green-600">Active</Badge>
                      </div>

                      {/* Voting Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm text-white/70 mb-2">
                          <span>For: 42.5%</span>
                          <span>Against: 15.2%</span>
                          <span>Turnout: 57.7%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="flex h-full">
                            <div className="bg-green-500" style={{ width: '42.5%' }} />
                            <div className="bg-red-500" style={{ width: '15.2%' }} />
                          </div>
                        </div>
                      </div>

                      {/* Vote Buttons */}
                      {myShares > 0 && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              toast({
                                title: `Vote Cast: FOR`,
                                description: `Your ${myShares.toFixed(4)} shares have been counted!`,
                              });
                            }}
                          >
                            ✓ Vote For
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-1 bg-red-600 hover:bg-red-700"
                            onClick={() => {
                              toast({
                                title: `Vote Cast: AGAINST`,
                                description: `Your ${myShares.toFixed(4)} shares have been counted!`,
                              });
                            }}
                          >
                            ✗ Vote Against
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-white/20 text-white hover:bg-white/10"
                          >
                            Abstain
                          </Button>
                        </div>
                      )}

                      {/* Time Remaining */}
                      <div className="mt-3 text-xs text-white/60 text-center">
                        ⏱️ Voting ends in 2 days, 5 hours
                      </div>
                    </div>

                    {/* Empty State */}
                    <div className="text-center py-8 text-white/60">
                      <p className="mb-2">No active proposals yet</p>
                      <p className="text-sm">
                        {myShares >= 1 
                          ? "Be the first to create a proposal!" 
                          : "Invest in this pool to participate in governance"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Governance Info */}
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <h4 className="text-white font-bold mb-2">💡 How Weighted Voting Works</h4>
                  <ul className="text-sm text-white/70 space-y-1">
                    <li>• Your voting power equals your share ownership</li>
                    <li>• Larger investors have proportionally more influence</li>
                    <li>• Proposals need 30% turnout and 51% approval to pass</li>
                    <li>• You can propose changes if you own at least 1 share</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - My Investment & Actions */}
          <div className="space-y-6">
            {/* My Investment */}
            <Card className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-purple-500/50">
              <CardHeader>
                <CardTitle className="text-white">My Investment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-white/70 text-sm mb-1">My Shares</div>
                  <div className="text-2xl font-bold text-white">{myShares.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-white/70 text-sm mb-1">Current Value</div>
                  <div className="text-2xl font-bold text-white">${myValue.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-white/70 text-sm mb-1">Total Return</div>
                  <div className={`text-2xl font-bold ${myReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {myReturn >= 0 ? '+' : ''}{myReturn.toFixed(2)}%
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={() => setShowInvestModal(true)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                size="lg"
              >
                <ArrowUpRight className="w-5 h-5 mr-2" />
                Invest
              </Button>

              <Button
                onClick={() => setShowWithdrawModal(true)}
                className="w-full bg-white/10 hover:bg-white/20 text-white"
                size="lg"
                disabled={myShares === 0}
              >
                <ArrowDownLeft className="w-5 h-5 mr-2" />
                Withdraw
              </Button>
            </div>
          </div>
        </div>

        {/* Invest Modal */}
        <Dialog open={showInvestModal} onOpenChange={setShowInvestModal}>
          <DialogContent className="bg-gray-900 border-white/20 text-white">
            <DialogHeader>
              <DialogTitle>Invest in {pool?.name}</DialogTitle>
              <DialogDescription className="text-white/70">
                Enter the amount you'd like to invest (minimum ${pool?.minimumInvestment})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-white mb-2 block">Amount (USD)</Label>
                <Input
                  type="number"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  placeholder="100.00"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              {investAmount && (
                <div className="bg-white/5 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Shares to receive</span>
                    <span className="text-white font-semibold">
                      {(parseFloat(investAmount) / sharePrice).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Share price</span>
                    <span className="text-white font-semibold">${sharePrice.toFixed(4)}</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowInvestModal(false)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleInvest}
                disabled={investMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {investMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Investment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Withdraw Modal */}
        <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
          <DialogContent className="bg-gray-900 border-white/20 text-white">
            <DialogHeader>
              <DialogTitle>Withdraw from {pool?.name}</DialogTitle>
              <DialogDescription className="text-white/70">
                Enter the number of shares you'd like to withdraw (available: {myShares.toFixed(4)})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-white mb-2 block">Shares to Withdraw</Label>
                <Input
                  type="number"
                  value={withdrawShares}
                  onChange={(e) => setWithdrawShares(e.target.value)}
                  placeholder="10.0000"
                  max={myShares}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              {withdrawShares && (
                <div className="bg-white/5 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Withdrawal value</span>
                    <span className="text-white font-semibold">
                      ${(parseFloat(withdrawShares) * sharePrice).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Performance fee ({pool?.performanceFee / 100}%)</span>
                    <span className="text-red-400">
                      -${((parseFloat(withdrawShares) * sharePrice * pool?.performanceFee) / 10000).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-white/20 pt-2">
                    <span className="text-white">You'll receive</span>
                    <span className="text-green-400">
                      ${((parseFloat(withdrawShares) * sharePrice) * (1 - pool?.performanceFee / 10000)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowWithdrawModal(false)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleWithdraw}
                disabled={withdrawMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Withdrawal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

