
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Zap, 
  PieChart,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface RevenueStream {
  source: string;
  amount: number;
  currency: string;
  period: string;
}

export default function RevenueDashboard() {
  const [period, setPeriod] = React.useState<'daily' | 'weekly' | 'monthly'>('monthly');

  const { data: report, isLoading } = useQuery({
    queryKey: ['/api/revenue/report', period],
    queryFn: async () => {
      const res = await fetch(`/api/revenue/report?period=${period}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch revenue report');
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const diversificationColor = 
    report.diversification >= 60 ? 'text-green-600' :
    report.diversification >= 40 ? 'text-yellow-600' :
    'text-red-600';

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Revenue Analytics</h1>
        <p className="text-muted-foreground">Multi-stream revenue monitoring & insights</p>
      </div>

      {/* Period selector */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${report.total.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From {report.streams.length} revenue streams
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Diversification Score</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${diversificationColor}`}>
              {report.diversification.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {report.insights.diversificationHealth === 'healthy' ? '✅ Healthy' : '⚠️ Needs work'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Streams</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.streams.filter((s: RevenueStream) => s.amount > 0).length}/{report.streams.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue sources generating income
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue streams breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Streams</CardTitle>
          <CardDescription>Breakdown by source ({period})</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {report.streams.map((stream: RevenueStream) => (
              <div key={stream.source} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{stream.source}</p>
                  <p className="text-sm text-muted-foreground">{stream.currency}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">
                    {stream.currency === 'MTAA' 
                      ? `${stream.amount.toFixed(0)} MTAA`
                      : stream.currency === 'KES'
                      ? `KES ${stream.amount.toFixed(2)}`
                      : `$${stream.amount.toFixed(2)}`
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {((stream.amount / report.total) * 100).toFixed(1)}% of total
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Growth Recommendations</CardTitle>
          <CardDescription>AI-powered insights to improve revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {report.insights.recommendedActions.map((action: string, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                {action.includes('✅') ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                )}
                <p className="text-sm">{action}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
