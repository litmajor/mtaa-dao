import React from 'react';
import { AlertTriangle, AlertCircle, Clock } from 'lucide-react';

interface EarlyWarning {
  id: string;
  severity: 'warning' | 'alert' | 'critical';
  message: string;
  timeToEvent: number;
  requiredAction: string;
}

interface EarlyWarningAlertProps {
  warning: EarlyWarning;
}

/**
 * Alert component for early warning notifications
 * Displays urgent DAO health issues that require action
 */
export default function EarlyWarningAlert({ warning }: EarlyWarningAlertProps) {
  const bgColor = {
    critical: 'bg-red-500/20 border-red-500/50',
    alert: 'bg-orange-500/20 border-orange-500/50',
    warning: 'bg-yellow-500/20 border-yellow-500/50'
  }[warning.severity];

  const textColor = {
    critical: 'text-red-300',
    alert: 'text-orange-300',
    warning: 'text-yellow-300'
  }[warning.severity];

  return (
    <div className={`${bgColor} border rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        {warning.severity === 'critical' ? (
          <AlertTriangle className={`w-5 h-5 ${textColor} mt-0.5 flex-shrink-0`} />
        ) : (
          <AlertCircle className={`w-5 h-5 ${textColor} mt-0.5 flex-shrink-0`} />
        )}
        <div className="flex-1">
          <h4 className={`font-bold ${textColor} mb-1`}>{warning.message}</h4>
          <p className="text-sm text-gray-300 mb-2">{warning.requiredAction}</p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Expected in {warning.timeToEvent} hours</span>
          </div>
        </div>
      </div>
    </div>
  );
}
