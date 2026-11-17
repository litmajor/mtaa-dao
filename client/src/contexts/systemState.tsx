import React, { createContext, useContext, useState, useCallback } from 'react';

export type OperationalMode = 'network'|'governance'|'capital'|'execution'|'intelligence';

export interface SystemState {
  mode: OperationalMode;
  narrative: string[];
  flags: Record<string, any>;
  // global telemetry and security fields
  threatLevel?: 'normal' | 'elevated' | 'critical';
  sessionTrust?: number;
  networkHealth?: number;
  activeWallet?: any;
  authState?: Record<string, any>;
}

export interface SystemStateContextValue {
  state: SystemState;
  setMode: (m: OperationalMode) => void;
  pushNarrative: (line: string) => void;
  setFlag: (k: string, v: any) => void;
}

const defaultState: SystemState = {
  mode: 'network',
  narrative: [],
  flags: {},
};

const SystemStateContext = createContext<SystemStateContextValue | undefined>(undefined);

interface SystemStateProviderProps {
  initialState?: Partial<SystemState>;
  children?: React.ReactNode;
}

export const SystemStateProvider: React.FC<SystemStateProviderProps> = ({ children, initialState }) => {
  const [state, setState] = useState<SystemState>({ ...defaultState, ...(initialState || {}) });

  const setMode = useCallback((m: OperationalMode) => {
    setState(prev => ({ ...prev, mode: m }));
  }, []);

  const pushNarrative = useCallback((line: string) => {
    setState(prev => ({ ...prev, narrative: [...prev.narrative.slice(-49), line] }));
  }, []);

  const setFlag = useCallback((k: string, v: any) => {
    setState(prev => ({ ...prev, flags: { ...prev.flags, [k]: v } }));
  }, []);

  return (
    <SystemStateContext.Provider value={{ state, setMode, pushNarrative, setFlag }}>
      {children}
    </SystemStateContext.Provider>
  );
};

export function useSystemState() {
  const ctx = useContext(SystemStateContext);
  if (!ctx) throw new Error('useSystemState must be used within SystemStateProvider');
  return ctx;
}

export function deriveOperationalMode(inputs: {
  treasuryHealth?: number | null;
  executionLoad?: number | null;
  governancePressure?: number | null;
  anomalies?: number | null;
  liquidityRisk?: number | null;
}): OperationalMode {
  const anomalies = inputs?.anomalies ?? 0;
  const executionLoad = inputs?.executionLoad ?? 0;
  const governancePressure = inputs?.governancePressure ?? 0;
  const liquidityRisk = inputs?.liquidityRisk ?? 0;
  const treasuryHealth = inputs?.treasuryHealth ?? 100;

  if (anomalies > 0.6 || treasuryHealth < 30 || executionLoad > 0.7) return 'execution';
  if (liquidityRisk > 0.5 || treasuryHealth < 60) return 'capital';
  if (governancePressure > 0.5) return 'governance';
  if (anomalies > 0.2) return 'intelligence';
  return 'network';
}

export default SystemStateProvider;
