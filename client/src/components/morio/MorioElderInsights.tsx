
import React, { useState, useEffect } from 'react';
import { Shield, TrendingUp, AlertTriangle, CheckCircle, Activity, Brain, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

interface ElderInsight {
  elder: 'KAIZEN' | 'SCRY' | 'LUMEN';
  type: 'optimization' | 'threat' | 'ethics';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  actionable: boolean;
  timestamp: string;
}

interface Props {
  userId: string;
  daoId?: string;
}

export function MorioElderInsights({ userId, daoId }: Props) {
  const [insights, setInsights] = useState<ElderInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchElderInsights();
  }, [userId, daoId]);

  const fetchElderInsights = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = daoId 
        ? `/api/morio/elder-insights?daoId=${daoId}`
        : `/api/morio/elder-insights?userId=${userId}`;
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      }
    } catch (error) {
      console.error('Failed to fetch elder insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getElderIcon = (elder: string) => {
    switch (elder) {
      case 'KAIZEN': return <TrendingUp className="w-4 h-4" />;
      case 'SCRY': return <Eye className="w-4 h-4" />;
      case 'LUMEN': return <Shield className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10';
      default: return 'text-blue-500 bg-blue-500/10';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Brain className="w-8 h-8 animate-pulse mx-auto mb-2 text-purple-500" />
          <p className="text-sm text-gray-500">Analyzing your DAO health...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-500" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Everything looks great! No issues detected.</p>
          </div>
        ) : (
          insights.map((insight, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${getSeverityColor(insight.severity)}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getElderIcon(insight.elder)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {insight.elder}
                    </Badge>
                    {insight.severity === 'critical' && (
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium">{insight.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{insight.timestamp}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
