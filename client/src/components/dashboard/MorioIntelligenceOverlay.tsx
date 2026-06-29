import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, AlertTriangle, Info, Clock, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MorioEvent {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  actionLabel: string;
  actionUrl: string;
  timestamp: string;
}

export default function MorioIntelligenceOverlay({ daoId }: { daoId: string }) {
  const [events, setEvents] = useState<MorioEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/v1/daos/${daoId}/intelligence/events`);
        const data = await res.json();
        if (mounted && data.success) {
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error('Failed to fetch Morio events', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchEvents();
    // Poll every 60 seconds
    const interval = setInterval(fetchEvents, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [daoId]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'medium': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'low': return <Info className="w-5 h-5 text-blue-400" />;
      default: return <Info className="w-5 h-5 text-slate-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-500/50 bg-red-500/10';
      case 'medium': return 'border-yellow-500/50 bg-yellow-500/10';
      case 'low': return 'border-blue-500/50 bg-blue-500/10';
      default: return 'border-slate-700 bg-slate-800';
    }
  };

  if (loading && events.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <Brain className="w-5 h-5 text-purple-400 animate-pulse" /> Morio Live Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-20 bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-20 bg-slate-800 rounded-lg animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 border-slate-800 h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-purple-400" /> Morio Live Intelligence
          </CardTitle>
          <span className="text-xs font-mono text-green-400 flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Real-time Feed
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 overflow-y-auto min-h-[300px]">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 py-8">
            <Brain className="w-12 h-12 opacity-20" />
            <p>Morio is monitoring the DAO. No critical events right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div 
                key={event.id} 
                className={`p-4 rounded-xl border ${getSeverityColor(event.severity)} transition-all hover:bg-slate-800`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getSeverityIcon(event.severity)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-200 mb-2 font-medium">{event.message}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center text-xs text-slate-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {event.actionLabel && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs font-medium hover:text-white hover:bg-white/10"
                          onClick={() => {
                            // If actionUrl starts with ?, it means we want to navigate within the dashboard.
                            // In a real app we'd trigger a router push or Context update.
                            // For this demo, we'll just log it or handle via a callback.
                            console.log(`Action clicked: ${event.actionUrl}`);
                          }}
                        >
                          {event.actionLabel} <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
