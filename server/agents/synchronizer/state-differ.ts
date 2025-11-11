
/**
 * State Differ - Detects and resolves state divergence
 */

import crypto from 'crypto';
import { StateSnapshot } from './types';
import { Logger } from '../../utils/logger';

const logger = new Logger('state-differ');

export class StateDiffer {
  computeStateHash(state: Record<string, any>): string {
    const stateStr = JSON.stringify(state, Object.keys(state).sort());
    return crypto.createHash('sha256').update(stateStr).digest('hex');
  }

  findDifferences(state1: StateSnapshot, state2: StateSnapshot): Record<string, any> {
    const diff: Record<string, any> = {};
    const allKeys = new Set([
      ...Object.keys(state1.data),
      ...Object.keys(state2.data)
    ]);

    for (const key of allKeys) {
      const val1 = state1.data[key];
      const val2 = state2.data[key];

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        diff[key] = {
          state1: val1,
          state2: val2,
          conflict: true
        };
      }
    }

    return diff;
  }

  resolveConflicts(snapshots: StateSnapshot[]): StateSnapshot {
    if (snapshots.length === 0) {
      throw new Error('No snapshots to resolve');
    }

    if (snapshots.length === 1) {
      return snapshots[0];
    }

    const allKeys = new Set<string>();
    snapshots.forEach(s => Object.keys(s.data).forEach(k => allKeys.add(k)));

    const resolvedData: Record<string, any> = {};

    for (const key of allKeys) {
      const values = snapshots
        .filter(s => key in s.data)
        .map(s => JSON.stringify(s.data[key]));

      if (values.length === 0) continue;

      // Majority voting
      const valueCounts = new Map<string, number>();
      values.forEach(v => {
        valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
      });

      let maxCount = 0;
      let mostCommon = values[0];
      
      valueCounts.forEach((count, value) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommon = value;
        }
      });

      resolvedData[key] = JSON.parse(mostCommon);
    }

    const resolved: StateSnapshot = {
      nodeId: 'RESOLVED',
      timestamp: Date.now(),
      data: resolvedData,
      version: Math.max(...snapshots.map(s => s.version)) + 1,
      checksum: ''
    };

    resolved.checksum = this.computeStateHash(resolved.data);

    return resolved;
  }
}
