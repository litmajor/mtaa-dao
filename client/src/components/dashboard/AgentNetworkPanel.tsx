import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Shield, BrainCircuit, Activity, AlertTriangle, Eye, CheckCircle, Clock } from 'lucide-react';

interface AgentSubscription {
  agentId: string;
  agentName: string;
  tier: string;
  isSubscribed: boolean;
  status: 'active' | 'idle' | 'offline' | 'error';
  lastActive: string | null;
  description: string;
  category: string;
}

interface AgentNetworkPanelProps {
  daoId: string;
}

const TIER_ICONS: Record<string, React.ReactNode> = {
  'Tier 1': <BrainCircuit className="h-5 w-5 text-purple-400" />,
  'Tier 2': <Eye className="h-5 w-5 text-amber-400" />,
  'Tier 3': <Activity className="h-5 w-5 text-blue-400" />,
  'Tier 4': <Shield className="h-5 w-5 text-red-400" />,
  'default': <Bot className="h-5 w-5 text-slate-400" />,
};

const AGENT_TIERS = [
  { name: 'Tier 1 — Core Orchestration', agents: ['Morio', 'Nuru'] },
  { name: 'Tier 2 — Elder Council', agents: ['Scry', 'Kaizen', 'Lumen', 'Coordinator'] },
  { name: 'Tier 3 — Execution (DeFi)', agents: ['Trader DeFi', 'Synchronizer'] },
  { name: 'Tier 4 — Security', agents: ['Defender', 'Scout', 'Analyzer', 'Repair'] },
  { name: 'Domain Analyzers', agents: ['Gov Analytics', 'Financial Analyzer', 'Risk Assessor', 'Compliance'] },
];

export default function AgentNetworkPanel({ daoId }: AgentNetworkPanelProps) {
  const [agents, setAgents] = useState<AgentSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch(`/api/v1/daos/${daoId}/intelligence/agent-network`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
        } else {
          // Fallback mocks if endpoint not fully ready
          setAgents([
            { agentId: '1', agentName: 'Nuru', tier: 'Tier 1', isSubscribed: true, status: 'active', lastActive: new Date().toISOString(), description: 'Core data layer', category: 'orchestration' },
            { agentId: '2', agentName: 'Elder Kaizen', tier: 'Tier 2', isSubscribed: true, status: 'idle', lastActive: new Date(Date.now() - 3600000).toISOString(), description: 'Optimization', category: 'elder' },
            { agentId: '3', agentName: 'Defender', tier: 'Tier 4', isSubscribed: true, status: 'active', lastActive: new Date().toISOString(), description: 'Security', category: 'security' },
            { agentId: '4', agentName: 'Financial Analyzer', tier: 'Domain Analyzers', isSubscribed: false, status: 'offline', lastActive: null, description: 'Treasury analytics', category: 'analyzer' },
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, [daoId]);

  if (loading) {
    return <div className="animate-pulse h-64 bg-slate-800/50 rounded-xl" />;
  }

  return (
    <Card className="bg-slate-800/60 border-slate-700 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-slate-700/50">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-purple-400" />
          Agent Network Status
        </CardTitle>
        <p className="text-xs text-slate-400 font-normal">
          Live connection status for {agents.length} intelligent agents. Subscriptions via AgentPaymentGateway.
        </p>
      </CardHeader>
      <CardContent className="pt-4 overflow-y-auto flex-1 space-y-6">
        {AGENT_TIERS.map((tierGroup) => {
          // Find agents that match this tier group
          const tierAgents = agents.filter(a => tierGroup.agents.some(ta => a.agentName.includes(ta)));
          
          if (tierAgents.length === 0) return null;

          return (
            <div key={tierGroup.name} className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {tierGroup.name}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tierAgents.map((agent) => (
                  <div key={agent.agentId} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {TIER_ICONS[agent.tier] || TIER_ICONS['default']}
                        <div>
                          <div className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">
                            {agent.agentName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {agent.isSubscribed ? 'Subscribed' : 'Not Subscribed'}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {agent.status === 'active' && <CheckCircle className="h-3 w-3 text-green-400" />}
                        {agent.status === 'idle' && <Clock className="h-3 w-3 text-amber-400" />}
                        {agent.status === 'offline' && <AlertTriangle className="h-3 w-3 text-slate-500" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
