
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, TrendingDown, Brain, Target, AlertTriangle, 
  CheckCircle, ArrowUpRight, DollarSign, BarChart3 
} from 'lucide-react';

interface TreasuryIntelligenceProps {
  daoId: string;
}

export default function TreasuryIntelligenceDashboard({ daoId }: TreasuryIntelligenceProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchIntelligenceReport();
  }, [daoId]);

  const fetchIntelligenceReport = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/treasury-intelligence/${daoId}/intelligence-report`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyOptimization = async () => {
    try {
      const res = await fetch(`/api/treasury-intelligence/${daoId}/apply-optimization`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Budget optimization proposal created!');
      fetchIntelligenceReport();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-4">Loading treasury intelligence...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!report) return null;

  const { healthIndicators, topInitiatives, optimization, insights, recommendations } = report;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-500" />
            Treasury Intelligence
          </h1>
          <p className="text-muted-foreground">AI-powered treasury optimization & insights</p>
        </div>
        <Badge variant={healthIndicators.overallROI > 0 ? 'default' : 'destructive'} className="text-lg px-4 py-2">
          {healthIndicators.overallROI.toFixed(1)}% Average ROI
        </Badge>
      </div>

      {/* Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Initiatives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthIndicators.activeInitiatives}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {healthIndicators.successRate.toFixed(0)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${healthIndicators.totalImpact.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Generated value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthIndicators.efficiency.toFixed(2)}x</div>
            <p className="text-xs text-muted-foreground mt-1">Impact multiplier</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={healthIndicators.successRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Overall performance</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {insights.map((insight: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <p className="text-sm">{insight}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Initiatives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Top Performing Initiatives
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topInitiatives.map((initiative: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-semibold">{initiative.name}</h4>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span>{initiative.category}</span>
                    <span>•</span>
                    <span>${initiative.totalSpent.toLocaleString()} spent</span>
                    <span>•</span>
                    <span>{initiative.contributorsGained} new members</span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={initiative.roi > 0 ? 'default' : 'destructive'}>
                    {initiative.roi > 0 ? '+' : ''}{initiative.roi.toFixed(0)}% ROI
                  </Badge>
                  <div className="text-sm text-muted-foreground mt-1">
                    Health: {initiative.healthScore}/100
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Budget Optimization */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Budget Optimization
            </CardTitle>
            <Button onClick={applyOptimization} size="sm">
              Apply Recommendations
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              Expected Impact Gain: <span className="text-green-600 font-semibold">
                ${optimization.expectedImpactGain.toLocaleString()}
              </span>
            </p>
          </div>

          <div className="space-y-3">
            {optimization.budgetAdjustments.map((adj: any, i: number) => (
              <div key={i} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold capitalize">{adj.category}</h4>
                  <Badge variant="outline">
                    {adj.expectedROI.toFixed(0)}% Expected ROI
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Current: </span>
                    <span className="font-medium">${adj.currentBudget.toLocaleString()}</span>
                  </div>
                  <ArrowUpRight className="h-4 w-4" />
                  <div>
                    <span className="text-muted-foreground">Recommended: </span>
                    <span className="font-medium">${adj.recommendedBudget.toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{adj.reason}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strategic Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Strategic Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {recommendations.map((rec: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <DollarSign className="h-5 w-5 text-orange-500 mt-0.5" />
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
