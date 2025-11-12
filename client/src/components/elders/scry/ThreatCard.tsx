import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, ChevronDown, ChevronUp, Clock, Activity } from 'lucide-react';

interface ThreatEvidence {
  type: string;
  value: string | number;
  timestamp: string;
}

interface ThreatCardProps {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  detectedAt: string;
  confidence: number;
  evidence?: ThreatEvidence[];
  daoId?: string;
  userId?: string;
  actionRequired?: boolean;
  relatedMetric?: string;
}

/**
 * Individual threat display component
 * Shows threat details with expandable evidence and context
 */
export default function ThreatCard({
  id,
  type,
  severity,
  title,
  description,
  detectedAt,
  confidence,
  evidence = [],
  daoId,
  userId,
  actionRequired = false,
  relatedMetric
}: ThreatCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const severityConfig = {
    critical: {
      bg: 'bg-red-900/30',
      border: 'border-red-700',
      badge: 'bg-red-900 text-red-100',
      icon: 'text-red-400',
      indicator: 'bg-red-500'
    },
    high: {
      bg: 'bg-orange-900/30',
      border: 'border-orange-700',
      badge: 'bg-orange-900 text-orange-100',
      icon: 'text-orange-400',
      indicator: 'bg-orange-500'
    },
    medium: {
      bg: 'bg-yellow-900/30',
      border: 'border-yellow-700',
      badge: 'bg-yellow-900 text-yellow-100',
      icon: 'text-yellow-400',
      indicator: 'bg-yellow-500'
    },
    low: {
      bg: 'bg-blue-900/30',
      border: 'border-blue-700',
      badge: 'bg-blue-900 text-blue-100',
      icon: 'text-blue-400',
      indicator: 'bg-blue-500'
    }
  };

  const config = severityConfig[severity];

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`${config.bg} border ${config.border} rounded-lg overflow-hidden transition-all`}>
      {/* Header */}
      <div
        className="p-4 flex items-start justify-between cursor-pointer hover:bg-black/20 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3 flex-1">
          {/* Icon and Severity Indicator */}
          <div className="relative flex-shrink-0 mt-1">
            <div className={`absolute inset-0 ${config.indicator} rounded-full animate-pulse opacity-20`} />
            {severity === 'critical' ? (
              <AlertTriangle className={`${config.icon} w-5 h-5 relative z-10`} />
            ) : (
              <AlertCircle className={`${config.icon} w-5 h-5 relative z-10`} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white">{title}</h3>
              <span className={`${config.badge} text-xs font-semibold px-2 py-1 rounded whitespace-nowrap`}>
                {severity.toUpperCase()}
              </span>
              {actionRequired && (
                <span className="bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
                  ACTION REQUIRED
                </span>
              )}
            </div>
            <p className="text-sm text-gray-300 mt-1">{description}</p>

            {/* Metadata Row */}
            <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatTime(detectedAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                <span>Confidence: {Math.round(confidence)}%</span>
              </div>
              {daoId && <span>DAO: {daoId.slice(0, 8)}...</span>}
              {userId && <span>User: {userId.slice(0, 8)}...</span>}
            </div>
          </div>
        </div>

        {/* Expand Button */}
        <button
          className="flex-shrink-0 ml-2 p-1 hover:bg-black/20 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-black/20 p-4 space-y-4">
          {/* Type and ID */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Threat Type</p>
              <p className="text-sm text-white font-semibold mt-1">{type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">ID</p>
              <p className="text-sm text-white font-mono mt-1">{id.slice(0, 12)}...</p>
            </div>
          </div>

          {/* Related Metric */}
          {relatedMetric && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Related Metric</p>
              <p className="text-sm text-white mt-1">{relatedMetric}</p>
            </div>
          )}

          {/* Evidence */}
          {evidence && evidence.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Supporting Evidence</p>
              <div className="space-y-2">
                {evidence.map((item, idx) => (
                  <div key={idx} className="bg-black/20 p-3 rounded text-xs">
                    <div className="text-gray-300">
                      <span className="font-semibold text-white">{item.type}:</span>{' '}
                      <span className="text-gray-400">{item.value}</span>
                    </div>
                    <div className="text-gray-500 mt-1">
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-3 rounded transition-colors">
              Review
            </button>
            <button className="flex-1 bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold py-2 px-3 rounded transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
