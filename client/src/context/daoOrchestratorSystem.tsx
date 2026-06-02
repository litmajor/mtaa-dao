import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * DAO Orchestrator System
 * 
 * A state-driven orchestration layer that transforms the create-DAO experience
 * from static form filling into a narrative, psychologically responsive system.
 * 
 * The orchestrator maintains SYSTEM STATE that influences UI tone, density,
 * urgency, confidence, and emotional resonance—making the entire platform feel alive.
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type OperationalMode = 
  | 'definition'      // Defining mission & identity
  | 'governance'      // Shaping power structure
  | 'capital'         // Allocating economic resources
  | 'execution'       // Simulation & confidence building
  | 'commitment';     // Ready to deploy

export type RiskLevel = 'healthy' | 'caution' | 'alert' | 'critical';
export type ConfidenceLevel = 'nascent' | 'uncertain' | 'confident' | 'ready';
export type EmotionalTone = 'curious' | 'thoughtful' | 'cautious' | 'energetic' | 'decisive';

export interface DAOSystemState {
  // Progression
  operationalMode: OperationalMode;
  progressPercent: number;           // 0-100
  launchStage: 'ideation' | 'designing' | 'validating' | 'simulating' | 'deploying' | 'live';

  // Governance Health
  governanceComplexity: number;       // 0-100 (higher = more complex voting/thresholds)
  decentralizationLevel: number;      // 0-100 (1-person = 0, fully distributed = 100)
  founderControl: number;             // 0-100 (what % of power is with founder?)

  // Treasury & Economic
  treasuryRisk: number;               // 0-100 (runway, concentration, volatility)
  treasuryReadiness: number;          // 0-100 (is treasury properly configured?)
  capitalAllocationHealth: number;    // 0-100 (is capital being allocated wisely?)

  // Voter & Participation
  voterDistribution: number;          // 0-100 (how spread out is voting power?)
  expectedParticipation: number;      // 0-100 (based on member count & design)
  quorumRealism: number;              // 0-100 (is quorum achievable?)

  // System Health & Readiness
  overallReadiness: number;           // 0-100 (composite: can we launch?)
  securityConfidence: number;         // 0-100 (are there risk vectors?)
  operationalComplexity: number;      // 0-100 (is this sustainable?)

  // Risk & Urgency
  riskLevel: RiskLevel;
  criticalIssues: string[];           // e.g., "Centralization risk", "Treasury runway"
  warnings: string[];                 // e.g., "High governance complexity"
  suggestions: string[];              // e.g., "Consider lowering quorum"

  // Psychological State
  confidence: ConfidenceLevel;
  urgency: 'relaxed' | 'normal' | 'elevated' | 'critical';
  activityDensity: 'sparse' | 'moderate' | 'dense' | 'overwhelming';
  emotionalTone: EmotionalTone;
  focusEntity?: 'governance' | 'treasury' | 'members' | 'trust';
}

export interface DAOOrchestratorContextType {
  state: DAOSystemState;
  actions: {
    // Mode transitions
    setOperationalMode: (mode: OperationalMode) => void;
    advanceStage: () => void;

    // Update metrics (typically called from form changes)
    updateGovernanceMetrics: (data: {
      governanceComplexity?: number;
      decentralizationLevel?: number;
      founderControl?: number;
      quorum?: number;
      memberCount?: number;
    }) => void;

    updateTreasuryMetrics: (data: {
      treasuryRisk?: number;
      treasuryReadiness?: number;
      capitalAllocationHealth?: number;
    }) => void;

    updateParticipationMetrics: (data: {
      voterDistribution?: number;
      expectedParticipation?: number;
      quorumRealism?: number;
    }) => void;

    // Reset orchestrator
    reset: () => void;
  };

  // Derived helpers for UI
  helpers: {
    // Get surface class for a component based on system state
    surfaceClass: (intensity?: 'subtle' | 'moderate' | 'intense') => string;
    
    // Get text color based on risk level
    riskColor: () => string;
    
    // Is the system ready to commit?
    canCommit: () => boolean;
    
    // Percentage complete
    percentComplete: () => number;
    
    // Suggested next action
    suggestedNextAction: () => string;
  };
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: DAOSystemState = {
  operationalMode: 'definition',
  progressPercent: 5,
  launchStage: 'ideation',

  governanceComplexity: 20,
  decentralizationLevel: 50,
  founderControl: 80,

  treasuryRisk: 40,
  treasuryReadiness: 20,
  capitalAllocationHealth: 50,

  voterDistribution: 50,
  expectedParticipation: 40,
  quorumRealism: 60,

  overallReadiness: 15,
  securityConfidence: 30,
  operationalComplexity: 40,

  riskLevel: 'caution',
  criticalIssues: ['Founder has centralized control'],
  warnings: ['Moderate governance complexity', 'Treasury not fully configured'],
  suggestions: ['Consider adding more governance participants', 'Define treasury allocation strategy'],

  confidence: 'nascent',
  urgency: 'relaxed',
  activityDensity: 'sparse',
  emotionalTone: 'curious',
};

// ============================================================================
// CONTEXT & HOOK
// ============================================================================

const DAOOrchestratorContext = createContext<DAOOrchestratorContextType | null>(null);

export const useDAOOrchestrator = () => {
  const ctx = useContext(DAOOrchestratorContext);
  if (!ctx) {
    throw new Error('useDAOOrchestrator must be used within DAOOrchestratorProvider');
  }
  return ctx;
};

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export const DAOOrchestratorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DAOSystemState>(initialState);

  // Compute derived metrics and risk levels
  const computeSystemState = useCallback((baseState: DAOSystemState): DAOSystemState => {
    const {
      governanceComplexity,
      decentralizationLevel,
      founderControl,
      treasuryRisk,
      treasuryReadiness,
      capitalAllocationHealth,
      voterDistribution,
      expectedParticipation,
      quorumRealism,
      operationalMode,
    } = baseState;

    // Composite readiness: average of key metrics
    const overallReadiness = Math.round(
      (decentralizationLevel * 0.3 +
        treasuryReadiness * 0.3 +
        quorumRealism * 0.2 +
        (100 - governanceComplexity) * 0.2) / 1
    );

    // Security confidence: governance + treasury health
    const securityConfidence = Math.round(
      (decentralizationLevel * 0.4 +
        treasuryReadiness * 0.3 +
        (100 - treasuryRisk) * 0.3) / 1
    );

    // Operational complexity score
    const operationalComplexity = Math.round(
      (governanceComplexity * 0.4 +
        (100 - expectedParticipation) * 0.3 +
        (100 - treasuryReadiness) * 0.3) / 1
    );

    // Determine risk level
    let riskLevel: RiskLevel = 'healthy';
    const criticalIssues: string[] = [];
    const warnings: string[] = [];

    if (founderControl > 75) {
      criticalIssues.push('⚠ Founder has centralized control (>75%)');
      riskLevel = 'alert';
    }
    if (treasuryRisk > 70) {
      criticalIssues.push('⚠ Treasury configuration risky');
      riskLevel = 'alert';
    }
    if (quorumRealism < 30) {
      criticalIssues.push('⚠ Quorum may be unachievable');
      riskLevel = 'caution';
    }
    if (governanceComplexity > 80) {
      warnings.push('Governance structure is very complex');
      if (riskLevel === 'healthy') riskLevel = 'caution';
    }
    if (decentralizationLevel < 30) {
      warnings.push('Power is concentrated among few members');
      if (riskLevel === 'healthy') riskLevel = 'caution';
    }
    if (treasuryReadiness < 40) {
      warnings.push('Treasury needs more configuration');
    }

    // Determine confidence level
    let confidence: ConfidenceLevel = 'nascent';
    if (overallReadiness > 60) confidence = 'confident';
    if (overallReadiness > 80) confidence = 'ready';
    else if (overallReadiness > 40) confidence = 'uncertain';

    // Determine emotional tone based on mode and state
    let emotionalTone: EmotionalTone = 'curious';
    if (operationalMode === 'governance') emotionalTone = 'thoughtful';
    if (operationalMode === 'capital') emotionalTone = 'cautious';
    if (operationalMode === 'execution') emotionalTone = 'energetic';
    if (operationalMode === 'commitment') emotionalTone = 'decisive';

    // Determine urgency based on risk
    let urgency: 'relaxed' | 'normal' | 'elevated' | 'critical' = 'normal';
    if (riskLevel === 'critical') urgency = 'critical';
    if (riskLevel === 'alert') urgency = 'elevated';
    if (overallReadiness > 70) urgency = 'relaxed';

    // Determine activity density based on mode
    let activityDensity: 'sparse' | 'moderate' | 'dense' | 'overwhelming' = 'moderate';
    if (operationalMode === 'definition' || operationalMode === 'governance') activityDensity = 'sparse';
    if (operationalMode === 'capital' || operationalMode === 'execution') activityDensity = 'dense';
    if (operationalMode === 'commitment') activityDensity = 'moderate';

    // Calculate progress based on mode
    let progressPercent = 5;
    const modeProgressMap: Record<OperationalMode, number> = {
      'definition': 15,
      'governance': 35,
      'capital': 55,
      'execution': 75,
      'commitment': 95,
    };
    progressPercent = modeProgressMap[operationalMode];

    // Add readiness bonus to progress
    progressPercent = Math.min(95, progressPercent + Math.round((overallReadiness - 50) * 0.1));

    const suggestions: string[] = [];
    if (founderControl > 60 && decentralizationLevel < 50) {
      suggestions.push('Consider adding more governance participants to reduce founder control');
    }
    if (governanceComplexity > 60) {
      suggestions.push('Simplify governance: consider fewer voting options or clearer thresholds');
    }
    if (expectedParticipation < 40) {
      suggestions.push('Low expected participation: review member count or quorum settings');
    }
    if (treasuryReadiness < 60) {
      suggestions.push('Complete treasury configuration: define allocation strategy and risk limits');
    }

    return {
      ...baseState,
      overallReadiness,
      securityConfidence,
      operationalComplexity,
      riskLevel,
      criticalIssues,
      warnings,
      suggestions,
      confidence,
      urgency,
      activityDensity,
      emotionalTone,
      progressPercent,
    };
  }, []);

  const actions = useMemo(() => ({
    setOperationalMode: (mode: OperationalMode) => {
      setState(prev => computeSystemState({ ...prev, operationalMode: mode }));
    },

    advanceStage: () => {
      const stageMap: Record<'ideation' | 'designing' | 'validating' | 'simulating' | 'deploying' | 'live', 'ideation' | 'designing' | 'validating' | 'simulating' | 'deploying' | 'live'> = {
        'ideation': 'designing',
        'designing': 'validating',
        'validating': 'simulating',
        'simulating': 'deploying',
        'deploying': 'live',
        'live': 'live',
      };
      setState(prev => computeSystemState({
        ...prev,
        launchStage: stageMap[prev.launchStage] || prev.launchStage,
      }));
    },

    updateGovernanceMetrics: (data) => {
      setState(prev => computeSystemState({
        ...prev,
        governanceComplexity: data.governanceComplexity ?? prev.governanceComplexity,
        decentralizationLevel: data.decentralizationLevel ?? prev.decentralizationLevel,
        founderControl: data.founderControl ?? prev.founderControl,
      }));
    },

    updateTreasuryMetrics: (data) => {
      setState(prev => computeSystemState({
        ...prev,
        treasuryRisk: data.treasuryRisk ?? prev.treasuryRisk,
        treasuryReadiness: data.treasuryReadiness ?? prev.treasuryReadiness,
        capitalAllocationHealth: data.capitalAllocationHealth ?? prev.capitalAllocationHealth,
      }));
    },

    updateParticipationMetrics: (data) => {
      setState(prev => computeSystemState({
        ...prev,
        voterDistribution: data.voterDistribution ?? prev.voterDistribution,
        expectedParticipation: data.expectedParticipation ?? prev.expectedParticipation,
        quorumRealism: data.quorumRealism ?? prev.quorumRealism,
      }));
    },

    reset: () => {
      setState(initialState);
    },
  }), [computeSystemState]);

  const helpers = useMemo(() => ({
    surfaceClass: (intensity: 'subtle' | 'moderate' | 'intense' = 'moderate'): string => {
      const baseClasses = 'transition-all duration-300';
      
      // Opacity based on urgency
      const opacityMap: Record<string, string> = {
        'relaxed': 'opacity-90',
        'normal': 'opacity-95',
        'elevated': 'opacity-100',
        'critical': 'opacity-100',
      };
      
      // Glow based on risk
      const glowMap: Record<RiskLevel, string> = {
        'healthy': '',
        'caution': 'shadow-md',
        'alert': 'shadow-lg shadow-orange-500/30',
        'critical': 'shadow-xl shadow-red-500/50',
      };

      // Density transform
      const densityMap: Record<string, string> = {
        'sparse': 'space-y-6',
        'moderate': 'space-y-4',
        'dense': 'space-y-2',
        'overwhelming': 'space-y-1',
      };

      return [baseClasses, opacityMap[state.urgency], glowMap[state.riskLevel], densityMap[state.activityDensity]].filter(Boolean).join(' ');
    },

    riskColor: (): string => {
      const colorMap: Record<RiskLevel, string> = {
        'healthy': 'text-green-600 dark:text-green-400',
        'caution': 'text-yellow-600 dark:text-yellow-400',
        'alert': 'text-orange-600 dark:text-orange-400',
        'critical': 'text-red-600 dark:text-red-400',
      };
      return colorMap[state.riskLevel];
    },

    canCommit: (): boolean => {
      return (
        state.overallReadiness > 70 &&
        state.criticalIssues.length === 0 &&
        state.confidence === 'ready'
      );
    },

    percentComplete: (): number => {
      return state.progressPercent;
    },

    suggestedNextAction: (): string => {
      const modeActions: Record<OperationalMode, string> = {
        'definition': 'Define your DAO\'s mission and identity',
        'governance': 'Shape your governance structure and voting rules',
        'capital': 'Allocate treasury resources and capital strategy',
        'execution': 'Simulate and validate your design',
        'commitment': 'Deploy your DAO to the blockchain',
      };
      return modeActions[state.operationalMode];
    },
  }), [state]);

  const value: DAOOrchestratorContextType = {
    state,
    actions,
    helpers,
  };

  return (
    <DAOOrchestratorContext.Provider value={value}>
      {children}
    </DAOOrchestratorContext.Provider>
  );
};
