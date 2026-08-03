import { describe, expect, it } from 'vitest';
import { getHeapUsageSummary } from '../utils/memoryUsage';

describe('getHeapUsageSummary', () => {
  it('uses the V8 heap size limit for pressure percentages instead of the currently allocated heap', () => {
    const summary = getHeapUsageSummary(
      {
        rss: 600 * 1024 * 1024,
        heapTotal: 450 * 1024 * 1024,
        heapUsed: 445 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 0,
      } as NodeJS.MemoryUsage,
      2048 * 1024 * 1024
    );

    expect(summary.usedMB).toBe(445);
    expect(summary.allocatedMB).toBe(450);
    expect(summary.limitMB).toBe(2048);
    expect(summary.usagePercent).toBe(22);
    expect(summary.allocatedPercent).toBe(22);
  });
});
