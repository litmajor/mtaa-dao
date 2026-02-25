/**
 * Payment Simulation Type Definitions
 */

export interface SimulationResult {
  id: string;
  actionType: string;
  summary: string;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  delta: Record<string, any>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  warnings: string[];
  errors?: string[];
  reversibilityInformation?: {
    gracePeriodHours: number;
    gracePeriodDays?: number;
  };
  affectedEntities?: string[];
  status?: 'SUCCESS' | 'WARNING' | 'ERROR';
}

export interface ReversibleAction {
  id: string;
  type: string;
  status: string;
  severity: string;
  description: string;
  createdAt: string;
  gracePeriodEndsAt: string;
  canReverse: boolean;
  percentRemaining: number;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  reversibility?: {
    deadline: string;
    hoursToReverse: number;
    canReverse: boolean;
  };
}

export interface PendingAction extends ReversibleAction {
  hoursRemaining: number;
  reverseEndpoint: string;
  gracePeriodendsAt: string;
}
