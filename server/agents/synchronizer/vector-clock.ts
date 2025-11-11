
/**
 * Vector Clock Implementation
 * Provides logical timestamps for distributed synchronization
 */

import { VectorClockData } from './types';

export class VectorClock {
  public clocks: Record<string, number>;

  constructor(initialClocks?: Record<string, number>) {
    this.clocks = initialClocks || {};
  }

  tick(nodeId: string): void {
    this.clocks[nodeId] = (this.clocks[nodeId] || 0) + 1;
  }

  update(other: VectorClock): void {
    for (const [nodeId, clockVal] of Object.entries(other.clocks)) {
      this.clocks[nodeId] = Math.max(this.clocks[nodeId] || 0, clockVal);
    }
  }

  compare(other: VectorClock): 'before' | 'after' | 'concurrent' {
    const allKeys = new Set([
      ...Object.keys(this.clocks),
      ...Object.keys(other.clocks)
    ]);

    let selfGreater = false;
    let otherGreater = false;

    for (const key of allKeys) {
      const selfVal = this.clocks[key] || 0;
      const otherVal = other.clocks[key] || 0;

      if (selfVal > otherVal) {
        selfGreater = true;
      } else if (otherVal > selfVal) {
        otherGreater = true;
      }
    }

    if (selfGreater && !otherGreater) return 'after';
    if (otherGreater && !selfGreater) return 'before';
    return 'concurrent';
  }

  toJSON(): VectorClockData {
    return { clocks: { ...this.clocks } };
  }

  static fromJSON(data: VectorClockData): VectorClock {
    return new VectorClock(data.clocks);
  }
}
