export interface StableAssetDefinition {
  chain: string;
  chainId: number;
  tokenAddress: string;
  symbol: string;
  decimals: number;
  riskScore: number;
  liquidityScore: number;
  depegThresholdBps: number;
  minConfirmations: number;
  maxConfirmationDelaySec: number;
  pegTargetUsd: string;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface StableRiskFlags {
  depegDetected: boolean;
  delayedConfirmation: boolean;
  lowLiquidity: boolean;
  highRiskScore: boolean;
  notes: string[];
}

export function hasStableInflowRiskFlagsCleared(riskFlags: unknown): boolean {
  if (!riskFlags || typeof riskFlags !== 'object') return false;
  const flags = riskFlags as Partial<StableRiskFlags>;
  return flags.depegDetected === false &&
    flags.delayedConfirmation === false &&
    flags.lowLiquidity === false &&
    flags.highRiskScore === false;
}

export interface StableBalance {
  unitsMicroUsd: bigint | string;
  amountUsd: string;
  sourceChain: string;
  sourceToken: string;
  sourceTx: string;
}

export interface StableInflowEvent {
  id: string;
  chainId: number;
  txHash: string;
  logIndex: number;
  tokenAddress: string;
  tokenSymbol: string;
  toAddress: string;
  rawAmount: string;
  normalizedTokenAmount: string;
  normalizedAmountUsd: string;
  stableUnitsMicroUsd: string;
  confirmationState: 'pending' | 'confirmed' | 'low_confirmations';
  delayState: 'on_time' | 'delayed' | 'unknown';
  pegDeviationBps: number;
  riskFlags: StableRiskFlags;
  status: 'received' | 'credited' | 'flagged' | 'duplicate' | 'failed';
  source: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StableInflowProcessResult {
  success: boolean;
  stableInflowEventId?: string;
  duplicate?: boolean;
  normalizedAmountUsd?: string;
  stableUnitsMicroUsd?: string;
  riskFlags?: StableRiskFlags;
  confirmationState?: StableInflowEvent['confirmationState'];
  error?: string;
}
