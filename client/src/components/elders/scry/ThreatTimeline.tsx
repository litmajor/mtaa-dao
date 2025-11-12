import React, { useState, useMemo } from 'react';
import { AlertTriangle, AlertCircle, Clock, Filter } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  timestamp: string;
  description: string;
}

interface ThreatTimelineProps {
  events?: TimelineEvent[];
  daoId?: string;
}

const MOCK_EVENTS: TimelineEvent[] = [
  {
    id: '1',
    type: 'VOTING_ANOMALY',
    severity: 'critical',
    title: 'Unusual voting pattern detected',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    description: 'Multiple votes from same IP range in short timeframe'
  },
  {
    id: '2',
    type: 'TREASURY_MOVEMENT',
    severity: 'high',
    title: 'Large treasury withdrawal',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    description: '50,000 MTAA withdrawn to unknown address'
  },
  {
    id: '3',
    type: 'MEMBER_ACTIVITY',
    severity: 'medium',
    title: 'Elevated member activity',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    description: '5x normal proposal submissions in 1 hour'
  },
  {
    id: '4',
    type: 'GOVERNANCE_CHANGE',
    severity: 'low',
    title: 'Permission modification',
    timestamp: new Date(Date.now() - 6 * 3600000).toISOString(),
    description: 'Admin role assigned to new address'
  },
  {
    id: '5',
    type: 'VOTING_ANOMALY',
    severity: 'high',
    title: 'Coordinated voting detected',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    description: 'Same wallet voted in opposing directions on related proposals'
  }
];

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

/**
 * Historical threat timeline component
 * Shows threat events over time with filtering and details
 */
export default function ThreatTimeline({ events = MOCK_EVENTS, daoId }: ThreatTimelineProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const severityConfig = {
    critical: { color: 'from-red-600 to-red-700', bg: 'bg-red-900/30', dot: 'bg-red-500', text: 'text-red-400' },
    high: { color: 'from-orange-600 to-orange-700', bg: 'bg-orange-900/30', dot: 'bg-orange-500', text: 'text-orange-400' },
    medium: { color: 'from-yellow-600 to-yellow-700', bg: 'bg-yellow-900/30', dot: 'bg-yellow-500', text: 'text-yellow-400' },
    low: { color: 'from-blue-600 to-blue-700', bg: 'bg-blue-900/30', dot: 'bg-blue-500', text: 'text-blue-400' }
  };

  const filteredEvents = useMemo(() => {
    if (severityFilter === 'all') return events;
    return events.filter(e => e.severity === severityFilter);
  }, [events, severityFilter]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  };

  const getIcon = (severity: string) => {
    return severity === 'critical' || severity === 'high' ? (
      <AlertTriangle className="w-4 h-4" />
    ) : (
      <AlertCircle className="w-4 h-4" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Threat Timeline</h3>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <label htmlFor="severity-filter" className="sr-only">Filter by severity</label>
          <select
            id="severity-filter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            className="bg-slate-700 border border-slate-600 text-white rounded px-3 py-1 text-sm"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {filteredEvents.length === 0 ? (
          <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-8 text-center">
            <p className="text-gray-400">No threats found with selected severity</p>
          </div>
        ) : (
          filteredEvents.map((event, index) => {
            const config = severityConfig[event.severity];
            const isLast = index === filteredEvents.length - 1;

            return (
              <div key={event.id} className="relative">
                {/* Timeline line */}
                {!isLast && (
                  <div
                    className={`absolute left-6 top-12 w-0.5 h-12 bg-gradient-to-b ${config.color}`}
                  />
                )}

                {/* Event card */}
                <div className="flex gap-4 pb-6">
                  {/* Dot and line */}
                  <div className="relative flex flex-col items-center flex-shrink-0">
                    <div className={`${config.dot} w-3 h-3 rounded-full ring-4 ring-slate-800 relative z-10`} />
                  </div>

                  {/* Content */}
                  <div className={`${config.bg} border border-slate-600 rounded-lg p-4 flex-1 mt-0`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`${config.text}`}>
                            {getIcon(event.severity)}
                          </span>
                          <h4 className="font-bold text-white">{event.title}</h4>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            event.severity === 'critical' ? 'bg-red-900 text-red-100' :
                            event.severity === 'high' ? 'bg-orange-900 text-orange-100' :
                            event.severity === 'medium' ? 'bg-yellow-900 text-yellow-100' :
                            'bg-blue-900 text-blue-100'
                          }`}>
                            {event.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 mb-2">{event.description}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(event.timestamp)}</span>
                        </div>
                      </div>

                      {/* Type badge */}
                      <div className="text-right flex-shrink-0">
                        <span className="inline-block bg-slate-600/50 text-gray-200 text-xs font-mono px-2 py-1 rounded">
                          {event.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stats Footer */}
      <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-red-400">
              {events.filter(e => e.severity === 'critical').length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Critical</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-400">
              {events.filter(e => e.severity === 'high').length}
            </p>
            <p className="text-xs text-gray-400 mt-1">High</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-400">
              {events.filter(e => e.severity === 'medium').length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Medium</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-400">
              {events.filter(e => e.severity === 'low').length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Low</p>
          </div>
        </div>
      </div>
    </div>
  );
}
