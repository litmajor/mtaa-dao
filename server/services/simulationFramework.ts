/**
 * Simulation Framework Base Service
 * 
 * Provides the foundation for all destructive action simulators across the platform.
 * Each simulator extends this base and implements the simulate() method with appropriate
 * depth level (BASIC, INTERMEDIATE, ADVANCED).
 * 
 * BASIC: Direct calculations (fees, rates, conversions)
 * INTERMEDIATE: Include volatility, historical data, risk factors
 * ADVANCED: Monte Carlo forecasting, backtesting, complex modeling
 */

export enum SimulationDepth {
  BASIC = 'BASIC',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export enum SimulationStatus {
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

/**
 * Standard output format for all simulators
 * Used to populate ReversibleAction.beforeState and afterState
 */
export interface SimulationResult {
  // Core simulation metadata
  status: SimulationStatus;
  depth: SimulationDepth;
  timestamp: number;
  executionTimeMs: number;

  // State representation
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  delta: Record<string, any>;

  // Risk assessment
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  warnings: string[];
  errors: string[];

  // Reversibility metadata
  reversibilityWindow: {
    minGracePeriodHours: number;
    recommendedGracePeriodHours: number;
    maxGracePeriodDays: number;
  };

  // Impact summary
  summary: string;
  impactedEntities: {
    type: string;
    id: string;
    impact: string;
  }[];

  // Raw simulation data (varies by action type)
  simulationData?: Record<string, any>;
}

export interface SimulationParams {
  userId: string;
  actionId?: string;
  [key: string]: any;
}

/**
 * Base class for all simulators
 * 
 * Extends this class to implement a specific simulator:
 * 
 * class PaymentDepositSimulator extends SimulationService {
 *   async simulate(params: SimulationParams): Promise<SimulationResult> {
 *     // Implementation
 *   }
 * }
 */
export abstract class SimulationService {
  protected depth: SimulationDepth;
  protected actionType: string;

  constructor(actionType: string, depth: SimulationDepth = SimulationDepth.BASIC) {
    this.actionType = actionType;
    this.depth = depth;
  }

  /**
   * Execute the simulation with the given parameters
   * Returns a standardized SimulationResult
   */
  abstract simulate(params: SimulationParams): Promise<SimulationResult>;

  /**
   * Helper: Create empty warned result (for missing configurations)
   */
  protected createWarning(message: string, params: SimulationParams): SimulationResult {
    return {
      status: SimulationStatus.WARNING,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: 0,
      beforeState: params,
      afterState: params,
      delta: {},
      riskLevel: 'MEDIUM',
      riskFactors: ['missing-config', 'simulation-limited'],
      warnings: [message],
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 24,
        recommendedGracePeriodHours: 48,
        maxGracePeriodDays: 7,
      },
      summary: message,
      impactedEntities: [],
    };
  }

  /**
   * Helper: Create error result
   */
  protected createError(message: string, params: SimulationParams): SimulationResult {
    return {
      status: SimulationStatus.ERROR,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: 0,
      beforeState: params,
      afterState: {},
      delta: {},
      riskLevel: 'CRITICAL',
      riskFactors: ['simulation-error'],
      warnings: [],
      errors: [message],
      reversibilityWindow: {
        minGracePeriodHours: 24,
        recommendedGracePeriodHours: 48,
        maxGracePeriodDays: 7,
      },
      summary: `Simulation failed: ${message}`,
      impactedEntities: [],
    };
  }

  /**
   * Helper: Validate required parameters
   */
  protected validateRequired(params: any, required: string[]): string[] {
    const missing: string[] = [];
    for (const field of required) {
      if (params[field] === undefined || params[field] === null) {
        missing.push(field);
      }
    }
    return missing;
  }

  /**
   * Helper: Calculate basis points
   * basisPoints(100) = 0.01 (1%)
   * basisPoints(50) = 0.005 (0.5%)
   */
  protected basisPoints(bp: number): number {
    return bp / 10000;
  }

  /**
   * Helper: Apply percentage fee
   */
  protected applyFee(amount: number, feeBasisPoints: number): number {
    return amount * (1 - this.basisPoints(feeBasisPoints));
  }

  /**
   * Helper: Round to decimal places
   */
  protected round(value: number, decimals: number): number {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}
