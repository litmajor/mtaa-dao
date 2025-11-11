
/**
 * SYNCHRONIZER AGENT (SYNC-CORE)
 * The heartbeat of coherence across all Elder nodes and agent clusters
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { BaseAgent, AgentConfig, AgentStatus as BaseAgentStatus } from '../framework/base-agent';
import { VectorClock } from './vector-clock';
import { StateDiffer } from './state-differ';
import { RecoveryManager } from './recovery-manager';
import {
  SyncMode,
  AgentStatus,
  SyncBeat,
  StateSnapshot,
  SyncResult,
  SyncMetrics
} from './types';
import { Logger } from '../../utils/logger';

const logger = new Logger('synchronizer-agent');

export class SynchronizerAgent extends BaseAgent {
  private vectorClock: VectorClock;
  private stateDiffer: StateDiffer;
  private recoveryManager: RecoveryManager;
  private stateSnapshots: Map<string, StateSnapshot> = new Map();
  private syncMode: SyncMode = SyncMode.STEADY_BEAT;
  private agentStatus: AgentStatus = AgentStatus.ALIVE;
  private sequenceNumber: number = 0;
  private privateKey: Buffer;
  private trustedAgents: Set<string> = new Set();
  private metrics: SyncMetrics;
  private eventEmitter: EventEmitter;

  constructor(agentId: string = 'SYNC-MTAA-001', variant: string = 'AETHRA') {
    super({
      id: agentId,
      name: 'SYNCHRONIZER',
      version: '1.0.0',
      capabilities: [
        'state_synchronization',
        'conflict_resolution',
        'rollback_recovery',
        'vector_clock_sync',
        'distributed_consensus'
      ]
    });

    this.vectorClock = new VectorClock({ [agentId]: 0 });
    this.stateDiffer = new StateDiffer();
    this.recoveryManager = new RecoveryManager();
    this.privateKey = this.generateKey();
    this.eventEmitter = new EventEmitter();

    this.metrics = {
      syncLatency: [],
      heartbeatFrequency: 0,
      rollbackEvents: 0,
      clusterDriftIndex: 0,
      commitIntegrityScore: 1.0
    };
  }

  private generateKey(): Buffer {
    return crypto.createHash('sha256')
      .update(`${this.config.id}${Date.now()}`)
      .digest();
  }

  private signMessage(message: string): string {
    const hmac = crypto.createHmac('sha256', this.privateKey);
    return hmac.update(message).digest('base64');
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Synchronizer Agent', { agentId: this.config.id });
    this.setStatus(BaseAgentStatus.ACTIVE);
    this.agentStatus = AgentStatus.ALIVE;
    logger.info('Synchronizer Agent initialized successfully');
  }

  async process(data: any): Promise<any> {
    const startTime = Date.now();

    try {
      // Process synchronization request
      const result = await this.handleSyncRequest(data);
      this.updateMetrics(Date.now() - startTime, true);
      return result;
    } catch (error) {
      this.updateMetrics(Date.now() - startTime, false);
      logger.error('Sync process failed', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Synchronizer Agent');
    this.agentStatus = AgentStatus.OFFLINE;
    this.setStatus(BaseAgentStatus.PAUSED);
  }

  // === Core Synchronization Methods ===

  generateBeat(): SyncBeat {
    this.sequenceNumber++;

    const currentState = {
      snapshots: this.stateSnapshots.size,
      mode: this.syncMode,
      status: this.agentStatus
    };

    const stateHash = this.stateDiffer.computeStateHash(currentState);

    const beatData = {
      timestamp: Date.now(),
      agentId: this.config.id,
      status: this.agentStatus,
      stateHash,
      sequenceNumber: this.sequenceNumber
    };

    const messageStr = JSON.stringify(beatData);
    const signature = this.signMessage(messageStr);

    this.vectorClock.tick(this.config.id);

    return {
      ...beatData,
      vectorClock: this.vectorClock.toJSON(),
      signature
    };
  }

  receiveState(nodeId: string, stateData: Record<string, any>, version: number = 1): void {
    const snapshot: StateSnapshot = {
      nodeId,
      timestamp: Date.now(),
      data: stateData,
      version,
      checksum: this.stateDiffer.computeStateHash(stateData)
    };

    this.stateSnapshots.set(nodeId, snapshot);

    this.recoveryManager.logCommit(
      `state_update_${nodeId}`,
      snapshot.checksum,
      [nodeId],
      this.vectorClock.toJSON()
    );

    logger.debug('State received', { nodeId, version, checksum: snapshot.checksum });
  }

  detectDrift(): boolean {
    if (this.stateSnapshots.size < 2) return false;

    const checksums = Array.from(this.stateSnapshots.values()).map(s => s.checksum);
    const uniqueChecksums = new Set(checksums);

    const driftRatio = uniqueChecksums.size / checksums.length;
    this.metrics.clusterDriftIndex = driftRatio;

    return driftRatio > 0.5; // More than 50% divergence
  }

  async resolveDrift(): Promise<StateSnapshot | null> {
    if (!this.detectDrift()) return null;

    const snapshots = Array.from(this.stateSnapshots.values());

    try {
      const resolvedState = this.stateDiffer.resolveConflicts(snapshots);

      // Create checkpoint before applying resolution
      const checkpointId = `pre_resolve_${Date.now()}`;
      this.recoveryManager.createCheckpoint(checkpointId, snapshots[0]);

      this.metrics.rollbackEvents++;

      logger.info('Drift resolved', { 
        checkpointId, 
        conflictingStates: snapshots.length 
      });

      this.eventEmitter.emit('drift_resolved', {
        resolvedState,
        checkpointId,
        affectedNodes: snapshots.map(s => s.nodeId)
      });

      return resolvedState;
    } catch (error) {
      logger.error('Failed to resolve drift', error);
      return null;
    }
  }

  async rollbackToCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      const checkpoint = this.recoveryManager.getCheckpoint(checkpointId);
      if (!checkpoint) {
        logger.error('Checkpoint not found', { checkpointId });
        return false;
      }

      this.stateSnapshots.clear();
      this.stateSnapshots.set(checkpoint.nodeId, checkpoint);

      this.recoveryManager.logCommit(
        `rollback_to_${checkpointId}`,
        checkpoint.checksum,
        [checkpoint.nodeId],
        this.vectorClock.toJSON()
      );

      this.eventEmitter.emit('rollback_completed', {
        checkpointId,
        timestamp: checkpoint.timestamp
      });

      logger.info('Rollback successful', { checkpointId });
      return true;
    } catch (error) {
      logger.error('Rollback failed', error);
      return false;
    }
  }

  async synchronizeState(remoteState: StateSnapshot): Promise<SyncResult> {
    const localSnapshot = this.stateSnapshots.get(remoteState.nodeId);

    if (!localSnapshot) {
      // No local state, accept remote
      this.receiveState(remoteState.nodeId, remoteState.data, remoteState.version);
      return { success: true, consistent: true };
    }

    const differences = this.stateDiffer.findDifferences(localSnapshot, remoteState);

    if (Object.keys(differences).length === 0) {
      return { success: true, consistent: true };
    }

    // Conflicts detected
    const resolvedState = this.stateDiffer.resolveConflicts([localSnapshot, remoteState]);

    return {
      success: true,
      consistent: false,
      conflicts: Object.entries(differences).map(([key, value]) => ({ key, ...value })),
      resolvedState
    };
  }

  private async handleSyncRequest(data: any): Promise<SyncResult> {
    const { nodeId, state, vectorClock } = data;

    // Update vector clock
    if (vectorClock) {
      const remoteClock = VectorClock.fromJSON(vectorClock);
      this.vectorClock.update(remoteClock);
      this.vectorClock.tick(this.config.id);
    }

    // Synchronize state
    return await this.synchronizeState({
      nodeId,
      timestamp: Date.now(),
      data: state,
      version: data.version || 1,
      checksum: this.stateDiffer.computeStateHash(state)
    });
  }

  // === Public API Methods ===

  getMetrics(): SyncMetrics & { agentId: string; status: string; snapshots: number } {
    const avgLatency = this.metrics.syncLatency.length > 0
      ? this.metrics.syncLatency.reduce((a, b) => a + b, 0) / this.metrics.syncLatency.length
      : 0;

    return {
      agentId: this.config.id,
      status: this.agentStatus,
      snapshots: this.stateSnapshots.size,
      syncLatency: [avgLatency],
      heartbeatFrequency: this.metrics.heartbeatFrequency,
      rollbackEvents: this.metrics.rollbackEvents,
      clusterDriftIndex: this.metrics.clusterDriftIndex,
      commitIntegrityScore: this.metrics.commitIntegrityScore
    };
  }

  getStateSnapshots(): StateSnapshot[] {
    return Array.from(this.stateSnapshots.values());
  }

  getCommitHistory(limit?: number): any[] {
    return this.recoveryManager.getCommitLog(limit);
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }
}

// Export singleton instance
export const synchronizerAgent = new SynchronizerAgent();
