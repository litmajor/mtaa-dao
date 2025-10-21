
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Line } from 'react-chartjs-2';
import { TrendingUp } from 'lucide-react';

interface BalanceTrendsChartProps {
  walletAddress: string;
}

export default function BalanceTrendsChart({ walletAddress }: BalanceTrendsChartProps) {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [chartData, setChartData] = useState<any>(null);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalanceTrends();
  }, [walletAddress, period]);

  const fetchBalanceTrends = async () => {
    try {
      const response = await fetch(
        `/api/wallet/balance-trends?walletAddress=${walletAddress}&period=${period}`
      );
      const data = await response.json();

      if (data.success) {
        setCurrencies(data.data.currencies);
        
        // Format for Chart.js
        const labels = data.data.chartData.map((d: any) => d.date);
        const datasets = data.data.currencies.map((currency: string, index: number) => ({
          label: currency,
          data: data.data.chartData.map((d: any) => d[currency] || 0),
          borderColor: `hsl(${index * 60}, 70%, 50%)`,
          backgroundColor: `hsla(${index * 60}, 70%, 50%, 0.1)`,
          fill: true,
        }));

        setChartData({
          labels,
          datasets,
        });
      }
    } catch (error) {
      console.error('Error fetching balance trends:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Balance Trends
            </CardTitle>
            <CardDescription>Track your balance over time</CardDescription>
          </div>
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {chartData ? (
          <div className="h-64">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No trend data available</div>
        )}
      </CardContent>
    </Card>
  );
}
