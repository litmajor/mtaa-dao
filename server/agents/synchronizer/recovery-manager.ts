
/**
 * Recovery Manager - Maintains commit logs and rollback checkpoints
 */

import { CommitEntry, StateSnapshot, VectorClockData } from './types';
import { Logger } from '../../utils/logger';

const logger = new Logger('recovery-manager');

export class RecoveryManager {
  private commitLog: CommitEntry[] = [];
  private checkpoints: Map<string, StateSnapshot> = new Map();
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  logCommit(
    operation: string,
    stateHash: string,
    affectedNodes: string[],
    vectorClock: VectorClockData,
    rollbackData?: Record<string, any>
  ): void {
    const entry: CommitEntry = {
      timestamp: Date.now(),
      operation,
      stateHash,
      affectedNodes,
      vectorClock,
      rollbackData
    };

    this.commitLog.push(entry);

    // Trim log if too large
    if (this.commitLog.length > this.maxEntries) {
      this.commitLog = this.commitLog.slice(-Math.floor(this.maxEntries / 2));
    }

    logger.debug('Commit logged', { operation, affectedNodes: affectedNodes.length });
  }

  createCheckpoint(checkpointId: string, snapshot: StateSnapshot): void {
    this.checkpoints.set(checkpointId, snapshot);
    logger.info('Checkpoint created', { checkpointId, version: snapshot.version });
  }

  getRollbackPoint(targetTime: number): CommitEntry | null {
    const candidates = this.commitLog.filter(e => e.timestamp <= targetTime);
    if (candidates.length === 0) return null;
    
    return candidates.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  replayFromCheckpoint(checkpointId: string, targetTime: number): CommitEntry[] {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    const checkpointTime = checkpoint.timestamp;
    return this.commitLog.filter(
      e => e.timestamp > checkpointTime && e.timestamp <= targetTime
    );
  }

  getCheckpoint(checkpointId: string): StateSnapshot | undefined {
    return this.checkpoints.get(checkpointId);
  }

  getCommitLog(limit?: number): CommitEntry[] {
    return limit ? this.commitLog.slice(-limit) : [...this.commitLog];
  }
}
