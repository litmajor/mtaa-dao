import type { StableRiskFlags as InflowStableRiskFlags } from './stableInflow';

export type StableRiskFlags = InflowStableRiskFlags;

export interface StableOutflowProcessResult {
  success: boolean;
  stableOutflowEventId?: string;
  duplicate?: boolean;
  normalizedAmountUsd?: string;
  stableUnitsMicroUsd?: string;
  riskFlags?: StableRiskFlags;
  confirmationState?: 'pending' | 'confirmed' | 'low_confirmations';
  error?: string;
}
