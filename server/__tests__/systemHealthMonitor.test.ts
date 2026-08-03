import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemHealthMonitor } from '../utils/systemHealthMonitor';

describe('SystemHealthMonitor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    (SystemHealthMonitor as unknown as { consecutiveSaturatedSamples: number }).consecutiveSaturatedSamples = 0;
  });

  it('requires repeated saturated samples before reporting saturation', () => {
    const metrics = {
      timestamp: Date.now(),
      heap: { usedMB: 100, totalMB: 200, maxMB: 200, usagePercent: 90 },
      cpu: { user: 80, system: 0 },
      eventLoop: { lagMs: 200, isStalled: true },
      jobs: { totalJobs: 6, runningJobs: 5, skippedRecently: 6 },
    };

    vi.spyOn(SystemHealthMonitor, 'captureMetrics').mockReturnValue(metrics as never);

    expect(SystemHealthMonitor.isSaturated()).toBe(false);
    expect(SystemHealthMonitor.isSaturated()).toBe(true);
  });
});
