import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, TrendingUp, Sparkles, Navigation, Clock } from 'lucide-react';

interface ElderInsight {
  elderId: string;
  name: string;
  role: string;
  activeInsight: string;
  recommendation: string;
  lastRun: string;
}

interface ElderCouncilPanelProps {
  daoId: string;
}

const ELDER_METADATA: Record<string, { icon: React.ReactNode, color: string }> = {
  'Scry': { icon: <Eye className="h-5 w-5" />, color: 'text-blue-400 bg-blue-400/10' },
  'Kaizen': { icon: <TrendingUp className="h-5 w-5" />, color: 'text-emerald-400 bg-emerald-400/10' },
  'Lumen': { icon: <Sparkles className="h-5 w-5" />, color: 'text-amber-400 bg-amber-400/10' },
  'Coordinator': { icon: <Navigation className="h-5 w-5" />, color: 'text-purple-400 bg-purple-400/10' },
};

export default function ElderCouncilPanel({ daoId }: ElderCouncilPanelProps) {
  const [insights, setInsights] = useState<ElderInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await fetch(`/api/v1/daos/${daoId}/intelligence/elder-insights`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setInsights(data.insights || []);
        } else {
          console.error('Failed to fetch elder insights');
          setInsights([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, [daoId]);

  if (loading) {
    return <div className="animate-pulse h-64 bg-slate-800/50 rounded-xl" />;
  }

  return (
    <Card className="bg-slate-800/60 border-slate-700 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-slate-700/50">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-400" />
          The Elder Council
        </CardTitle>
        <p className="text-xs text-slate-400 font-normal">
          Tier 2 Agents providing DAO-scoped strategic insights and optimizations.
        </p>
      </CardHeader>
      <CardContent className="pt-4 overflow-y-auto flex-1 space-y-4">
        {insights.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            The Elders are currently observing.
          </div>
        ) : (
          insights.map((insight) => {
            // Match name to metadata, default to generic
            const meta = Object.entries(ELDER_METADATA).find(([key]) => insight.name.includes(key))?.[1] || 
                         { icon: <Sparkles className="h-5 w-5" />, color: 'text-slate-400 bg-slate-400/10' };

            return (
              <div key={insight.elderId} className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{insight.name}</h4>
                    <span className="text-xs text-slate-400">{insight.role}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock className="h-3 w-3" />
                    {new Date(insight.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 bg-slate-800/50 p-2 rounded border border-slate-700/30">
                    <span className="text-xs font-semibold text-slate-500 block mb-1">OBSERVATION</span>
                    {insight.activeInsight}
                  </div>
                  <div className="text-sm text-purple-200 bg-purple-900/20 p-2 rounded border border-purple-500/20">
                    <span className="text-xs font-semibold text-purple-400 block mb-1">RECOMMENDATION</span>
                    {insight.recommendation}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
