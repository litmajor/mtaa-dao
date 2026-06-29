import React, { useState, useEffect } from 'react';
import { Activity, Bell, AlertTriangle, ShieldCheck } from 'lucide-react';
import AgentNetworkPanel from './AgentNetworkPanel';
import ElderCouncilPanel from './ElderCouncilPanel';
import TreasuryIntelligenceDashboard from '../TreasuryIntelligenceDashboard';
import MorioIntelligenceOverlay from './MorioIntelligenceOverlay';

interface IntelligenceEvent {
  id: string;
  type: 'governance' | 'treasury' | 'security' | 'system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  sourceAgent: string;
}

export default function IntelligenceWorkspace({ daoId }: { daoId: string }) {
  const [events, setEvents] = useState<IntelligenceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/v1/daos/${daoId}/intelligence/events`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        } else {
          console.error('Failed to fetch intelligence events');
          setEvents([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [daoId]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🧠 Intelligence & Analytics
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            MtaaDAO Agent Network: Elder Council oversight, real-time security, and operational analytics.
          </p>
        </div>
      </div>
      
      {/* Top row: 3 Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Agent Network */}
        <div className="h-[450px]">
          <AgentNetworkPanel daoId={daoId} />
        </div>

        {/* Panel 2: DAO Event Feed */}
        <div className="h-[450px] bg-slate-800/60 border border-slate-700 rounded-xl flex flex-col">
          <div className="p-4 border-b border-slate-700/50 flex items-center justify-between shrink-0">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Intelligence Feed
            </h3>
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
              Live
            </span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-700/50 rounded-lg" />)}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No recent intelligence events</div>
            ) : (
              events.map((ev) => (
                <div key={ev.id} className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {ev.severity === 'critical' && <AlertTriangle className="h-4 w-4 text-red-400" />}
                      {ev.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                      {ev.severity === 'info' && <Bell className="h-4 w-4 text-blue-400" />}
                      <span className="text-sm font-semibold text-white">{ev.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2">{ev.description}</p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <ShieldCheck className="h-3 w-3" />
                    Source: {ev.sourceAgent}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel 3: Elder Council */}
        <div className="h-[450px]">
          <ElderCouncilPanel daoId={daoId} />
        </div>
      </div>

      {/* Bottom row: Legacy components if needed, or we can just leave them as deeper drill-downs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TreasuryIntelligenceDashboard daoId={daoId} />
        </div>
        <div className="lg:col-span-1 h-[600px] xl:h-[700px]">
          <MorioIntelligenceOverlay daoId={daoId} />
        </div>
      </div>
    </div>
  );
}
