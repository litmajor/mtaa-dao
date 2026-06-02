import React from 'react';
import { useDAOOrchestrator } from '@/context/daoOrchestratorSystem';
import { AlertCircle, CheckCircle, Zap, TrendingUp, Heart } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

/**
 * Adaptive UI Components that respond to DAOOrchestratorSystem state.
 * These components automatically change visual tone, density, urgency, and information hierarchy
 * based on the system state.
 */

// ============================================================================
// 1. SYSTEM HEALTH BANNER
// ============================================================================
/**
 * Dynamic banner that shows overall DAO readiness and key issues.
 * Changes color, opacity, urgency based on risk level and readiness.
 */
export const SystemHealthBanner: React.FC = () => {
  const orchestrator = useDAOOrchestrator();
  const { state, helpers } = orchestrator;

  const bgMap = {
    'healthy': 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    'caution': 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
    'alert': 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    'critical': 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  };

  const textMap = {
    'healthy': 'text-green-900 dark:text-green-100',
    'caution': 'text-yellow-900 dark:text-yellow-100',
    'alert': 'text-orange-900 dark:text-orange-100',
    'critical': 'text-red-900 dark:text-red-100',
  };

  const iconMap = {
    'healthy': <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
    'caution': <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
    'alert': <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
    'critical': <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
  };

  const titleMap = {
    'healthy': 'System Health: Excellent',
    'caution': 'System Health: Review Needed',
    'alert': 'System Health: Attention Required',
    'critical': 'System Health: Critical Issues',
  };

  return (
    <Alert className={`border-2 ${bgMap[state.riskLevel]} ${helpers.surfaceClass('intense')}`}>
      <div className="flex items-start gap-3">
        {iconMap[state.riskLevel]}
        <div className="flex-1">
          <AlertTitle className={textMap[state.riskLevel]}>
            {titleMap[state.riskLevel]} ({state.overallReadiness}% ready)
          </AlertTitle>
          
          {state.criticalIssues.length > 0 && (
            <AlertDescription className={`mt-2 text-sm ${textMap[state.riskLevel]}`}>
              <div className="space-y-1">
                {state.criticalIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-lg leading-none">●</span>
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            </AlertDescription>
          )}
        </div>
      </div>
    </Alert>
  );
};

// ============================================================================
// 2. ADAPTIVE READINESS METER
// ============================================================================
/**
 * Visual representation of DAO readiness with multiple metrics.
 * Layout density changes based on mode (sparse to dense).
 */
export const AdaptiveReadinessMeter: React.FC = () => {
  const orchestrator = useDAOOrchestrator();
  const { state, helpers } = orchestrator;

  const metrics = [
    { label: 'Overall Readiness', value: state.overallReadiness, icon: '🎯' },
    { label: 'Governance Health', value: state.decentralizationLevel, icon: '⚖️' },
    { label: 'Treasury Readiness', value: state.treasuryReadiness, icon: '💰' },
    { label: 'Security Confidence', value: state.securityConfidence, icon: '🔒' },
  ];

  // Show all metrics in dense mode, subset in sparse
  const displayMetrics = state.activityDensity === 'sparse' 
    ? metrics.slice(0, 2)
    : metrics;

  return (
    <Card className={helpers.surfaceClass('moderate')}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          System Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className={state.activityDensity === 'sparse' ? 'space-y-4' : 'space-y-6'}>
        {displayMetrics.map((metric) => (
          <div key={metric.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <span>{metric.icon}</span>
                {metric.label}
              </span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {metric.value}%
              </span>
            </div>
            <Progress 
              value={metric.value} 
              className="h-2"
            />
          </div>
        ))}

        {/* Show overall progress bar prominently */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Journey Progress</span>
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
              {helpers.percentComplete()}%
            </span>
          </div>
          <Progress 
            value={helpers.percentComplete()} 
            className="h-3 bg-gray-200 dark:bg-gray-700"
          />
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// 3. WARNINGS & SUGGESTIONS PANEL
// ============================================================================
/**
 * Intelligent feedback panel that surfaces issues and suggestions.
 * Shows/hides based on risk level and activity density.
 */
export const WarningsAndSuggestionsPanel: React.FC = () => {
  const orchestrator = useDAOOrchestrator();
  const { state } = orchestrator;

  if (state.warnings.length === 0 && state.suggestions.length === 0) {
    return null;
  }

  const shouldShow = state.riskLevel !== 'healthy' || state.activityDensity !== 'sparse';

  if (!shouldShow && state.warnings.length <= 1) {
    return null;
  }

  return (
    <Card className="border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2 text-amber-900 dark:text-amber-100">
          <Zap className="w-4 h-4" />
          Design Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.warnings.map((warning, idx) => (
          <div key={`warning-${idx}`} className="flex gap-2 text-sm">
            <span className="text-amber-600 dark:text-amber-400 flex-shrink-0">⚠</span>
            <span className="text-amber-800 dark:text-amber-200">{warning}</span>
          </div>
        ))}

        {state.suggestions.length > 0 && (
          <>
            <div className="border-t border-amber-200 dark:border-amber-700 my-2" />
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
              💡 Suggestions
            </div>
            {state.suggestions.map((suggestion, idx) => (
              <div key={`suggestion-${idx}`} className="flex gap-2 text-sm">
                <span className="text-amber-600 dark:text-amber-400 flex-shrink-0">→</span>
                <span className="text-amber-700 dark:text-amber-300">{suggestion}</span>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// 4. MODE INDICATOR & PROGRESS
// ============================================================================
/**
 * Shows current operational mode and recommended next action.
 * Changes visual prominence based on readiness and urgency.
 */
export const OperationalModeIndicator: React.FC = () => {
  const orchestrator = useDAOOrchestrator();
  const { state, helpers } = orchestrator;

  const modeEmojis: Record<string, string> = {
    'definition': '🎯',
    'governance': '⚖️',
    'capital': '💰',
    'execution': '⚡',
    'commitment': '🚀',
  };

  const modeColors: Record<string, string> = {
    'definition': 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    'governance': 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
    'capital': 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200',
    'execution': 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
    'commitment': 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200',
  };

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${modeColors[state.operationalMode]} ${helpers.surfaceClass()}`}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{modeEmojis[state.operationalMode]}</span>
          <span className="font-semibold text-sm">
            {state.operationalMode.charAt(0).toUpperCase() + state.operationalMode.slice(1)} Phase
          </span>
        </div>
        <p className="text-xs opacity-90">{helpers.suggestedNextAction()}</p>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold">{helpers.percentComplete()}%</div>
        <div className="text-xs opacity-75">Complete</div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. RISK LEVEL BADGE
// ============================================================================
/**
 * Compact indicator of current risk level.
 * Changes appearance and urgency based on state.
 */
export const RiskLevelBadge: React.FC = () => {
  const orchestrator = useDAOOrchestrator();
  const { state } = orchestrator;

  const bgMap = {
    'healthy': 'bg-green-100 dark:bg-green-900',
    'caution': 'bg-yellow-100 dark:bg-yellow-900',
    'alert': 'bg-orange-100 dark:bg-orange-900',
    'critical': 'bg-red-100 dark:bg-red-900',
  };

  const textMap = {
    'healthy': 'text-green-800 dark:text-green-200',
    'caution': 'text-yellow-800 dark:text-yellow-200',
    'alert': 'text-orange-800 dark:text-orange-200',
    'critical': 'text-red-800 dark:text-red-200',
  };

  return (
    <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${bgMap[state.riskLevel]} ${textMap[state.riskLevel]}`}>
      {state.riskLevel.charAt(0).toUpperCase() + state.riskLevel.slice(1)}
    </div>
  );
};

// ============================================================================
// 6. EMOTIONAL TONE INDICATOR (Debug/Advanced)
// ============================================================================
/**
 * Shows current emotional tone of the system (for advanced users/debugging).
 */
export const EmotionalToneIndicator: React.FC = () => {
  const orchestrator = useDAOOrchestrator();
  const { state } = orchestrator;

  const toneEmojis: Record<string, string> = {
    'curious': '🤔',
    'thoughtful': '💭',
    'cautious': '⚠️',
    'energetic': '⚡',
    'decisive': '✊',
  };

  return (
    <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
      <span>{toneEmojis[state.emotionalTone]}</span>
      <span>{state.emotionalTone}</span>
    </div>
  );
};
