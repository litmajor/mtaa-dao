/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SINGLETON INSTANCE VERIFICATION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Runtime verification that all critical services are singletons
 * Call once during server startup to perform comprehensive checks
 */

import { logger } from '../utils/logger';

/**
 * Track singleton instances
 */
class SingletonVerifier {
  private instanceMap = new Map<string, { count: number; timestamp: number }>();
  private creationStacks = new Map<string, string[]>();

  /**
   * Record an instance creation
   */
  recordInstance(serviceName: string, stack?: string): void {
    const now = Date.now();
    const existing = this.instanceMap.get(serviceName);

    if (!existing) {
      this.instanceMap.set(serviceName, { count: 1, timestamp: now });
      this.creationStacks.set(serviceName, [stack || 'Unknown']);
      logger.debug(`[Singleton] ${serviceName} instance #1 created`);
    } else {
      existing.count++;
      const stacks = this.creationStacks.get(serviceName) || [];
      if (stack) stacks.push(stack);

      logger.error(
        `[Singleton-Violation] ⚠️  DUPLICATE INSTANCE! ${serviceName} #${existing.count}`
      );
      logger.error(`[Singleton-Violation] Stack traces:\n${stacks.join('\n')}`);

      this.instanceMap.set(serviceName, {
        ...existing,
        timestamp: now,
      });
      this.creationStacks.set(serviceName, stacks);
    }
  }

  /**
   * Verify all services have exactly 1 instance
   */
  verify(): { isValid: boolean; report: string } {
    const violations: string[] = [];
    const passing: string[] = [];

    for (const [service, stats] of this.instanceMap) {
      if (stats.count === 1) {
        passing.push(`✅ ${service}: 1 instance`);
      } else {
        violations.push(`❌ ${service}: ${stats.count} instances (VIOLATION!)`);
      }
    }

    const report = [
      '═══════════════════════════════════════════════════════',
      'SINGLETON INSTANCE VERIFICATION REPORT',
      '═══════════════════════════════════════════════════════',
      '',
      'PASSING:',
      ...passing,
      '',
      violations.length === 0
        ? '❌ VIOLATIONS: None detected ✅'
        : `❌ VIOLATIONS: ${violations.length} detected`,
      ...violations,
      '',
      'SUMMARY:',
      `Total Services: ${this.instanceMap.size}`,
      `Valid Singletons: ${passing.length}`,
      `Duplicate Instances: ${violations.length}`,
      '',
    ].join('\n');

    return {
      isValid: violations.length === 0,
      report,
    };
  }

  /**
   * Get detailed report
   */
  getDetailedReport(): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════════',
      'DETAILED SINGLETON INSTANCE REPORT',
      '═══════════════════════════════════════════════════════',
      '',
    ];

    for (const [service, stats] of this.instanceMap) {
      lines.push(`Service: ${service}`);
      lines.push(
        `  Instances: ${stats.count}` + (stats.count > 1 ? ' ⚠️ VIOLATION' : ' ✅')
      );
      lines.push(`  Created At: ${new Date(stats.timestamp).toISOString()}`);

      const stacks = this.creationStacks.get(service) || [];
      if (stacks.length > 0) {
        lines.push('  Creation Stack Trace:');
        stacks.forEach((stack, idx) => {
          lines.push(`    Instance #${idx + 1}:`);
          lines.push(`      ${stack}`);
        });
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Reset for testing
   */
  reset(): void {
    this.instanceMap.clear();
    this.creationStacks.clear();
  }
}

/**
 * Global singleton verifier instance
 */
export const singletonVerifier = new SingletonVerifier();

/**
 * Quick verification function to call during startup
 */
export function verifySingletonInstances(): void {
  const { isValid, report } = singletonVerifier.verify();

  if (isValid) {
    logger.info('✅ All singleton instances verified');
  } else {
    logger.error(
      '❌ Singleton verification FAILED - duplicate instances detected!'
    );
    logger.error(singletonVerifier.getDetailedReport());
  }
}

/**
 * Log instance creation with automatic stack trace
 * Usage in singleton constructors:
 *
 * constructor() {
 *   logSingletonCreation(this.constructor.name);
 * }
 */
export function logSingletonCreation(serviceName: string): void {
  const stack = new Error()
    .stack?.split('\n')
    .slice(2, 4)
    .join('\n') || 'Unknown';
  singletonVerifier.recordInstance(serviceName, stack);
}

/**
 * Verify specific service count
 */
export function getSingletonCount(serviceName: string): number {
  const stats = (singletonVerifier as any).instanceMap.get(serviceName);
  return stats?.count ?? 0;
}

/**
 * Health check for singletons
 */
export function getSingletonHealthStatus(): {
  allValid: boolean;
  violations: string[];
  totalServices: number;
} {
  const { isValid, report } = singletonVerifier.verify();
  const violations = report
    .split('\n')
    .filter((line) => line.includes('❌'))
    .map((line) => line.replace('❌ ', ''));

  return {
    allValid: isValid,
    violations,
    totalServices: (singletonVerifier as any).instanceMap.size,
  };
}
