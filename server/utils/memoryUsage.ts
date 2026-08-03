import v8 from 'node:v8';

export interface HeapUsageSummary {
  usedMB: number;
  allocatedMB: number;
  limitMB: number;
  usagePercent: number;
  allocatedPercent: number;
}

export function getHeapUsageSummary(memoryUsage?: NodeJS.MemoryUsage, heapLimitBytes?: number): HeapUsageSummary {
  const usage = memoryUsage ?? process.memoryUsage();
  const limit = heapLimitBytes ?? v8.getHeapStatistics().heap_size_limit;

  const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const allocatedMB = Math.round(usage.heapTotal / 1024 / 1024);
  const limitMB = Math.max(1, Math.round(limit / 1024 / 1024));

  const usagePercent = limit > 0 ? Math.round((usage.heapUsed / limit) * 100) : 0;
  const allocatedPercent = usage.heapTotal > 0 ? Math.round((usage.heapTotal / limit) * 100) : 0;

  return {
    usedMB,
    allocatedMB,
    limitMB,
    usagePercent,
    allocatedPercent,
  };
}
