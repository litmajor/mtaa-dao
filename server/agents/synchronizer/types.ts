
/**
 * SYNCHRONIZER Agent Type Definitions
 */

export enum SyncMode {
  STEADY_BEAT = 'steady_beat',
  DELTA_ONLY = 'delta_only',
  MAJORITY_VOTE = 'majority_vote',
  ISOLATED_RECONVERGE = 'isolated_reconverge'
}

export enum AgentStatus {
  ALIVE = 'ALIVE',
  DEGRADED = 'DEGRADED',
  OFFLINE = 'OFFLINE',
  RECOVERING = 'RECOVERING'
}

export interface VectorClockData {
  clocks: Record<string, number>;
}

export interface SyncBeat {
  timestamp: number;
  agentId: string;
  status: AgentStatus;
  vectorClock: VectorClockData;
  stateHash: string;
  signature: string;
  sequenceNumber: number;
}

export interface StateSnapshot {
  nodeId: string;
  timestamp: number;
  data: Record<string, any>;
  version: number;
  checksum: string;
}

export interface CommitEntry {
  timestamp: number;
  operation: string;
  stateHash: string;
  affectedNodes: string[];
  vectorClock: VectorClockData;
  rollbackData?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  consistent: boolean;
  conflicts?: any[];
  resolvedState?: StateSnapshot;
}

export interface SyncMetrics {
  syncLatency: number[];
  heartbeatFrequency: number;
  rollbackEvents: number;
  clusterDriftIndex: number;
  commitIntegrityScore: number;
}
