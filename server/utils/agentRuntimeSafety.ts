import os from 'node:os';
import v8 from 'node:v8';

export interface AgentRuntimeSafetyResult {
  shouldPause: boolean;
  reason?: string;
  memoryPressurePercent?: number;
  eventLoopLagMs?: number;
}

export function evaluateAgentRuntimeSafety(
  memoryUsage: NodeJS.MemoryUsage = process.memoryUsage(),
  eventLoopLagMs: number = 0,
  heapLimitBytes: number = v8.getHeapStatistics().heap_size_limit,
  totalSystemMemoryBytes: number = os.totalmem()
): AgentRuntimeSafetyResult {
  if (process.env.AGENT_FORCE_START === 'true') {
    return { shouldPause: false };
  }

  const heapUsed = memoryUsage.heapUsed;
  const heapTotal = memoryUsage.heapTotal;
  const memoryPressurePercent = heapLimitBytes > 0 ? Math.round((heapUsed / heapLimitBytes) * 100) : 0;
  const rssPressurePercent = totalSystemMemoryBytes > 0 ? Math.round((memoryUsage.rss / totalSystemMemoryBytes) * 100) : 0;

  const shouldPause =
    memoryPressurePercent >= 75 ||
    rssPressurePercent >= 80 ||
    eventLoopLagMs >= 250;

  return {
    shouldPause,
    reason: shouldPause
      ? [
          memoryPressurePercent >= 75 ? `heap pressure ${memoryPressurePercent}%` : null,
          rssPressurePercent >= 80 ? `rss pressure ${rssPressurePercent}%` : null,
          eventLoopLagMs >= 250 ? `event loop lag ${eventLoopLagMs}ms` : null,
        ].filter(Boolean).join(', ')
      : undefined,
    memoryPressurePercent,
    eventLoopLagMs,
  };
}
