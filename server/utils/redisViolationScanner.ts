/**
 * 🔍 REDIS VIOLATION SCANNER
 * 
 * Detects Services creating multiple Redis instances instead of using singleton.
 * Run periodically to catch violations during development.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface RedisViolation {
  file: string;
  line: number;
  type: 'new-redis' | 'manual-connect' | 'missing-singleton';
  code: string;
  severity: 'critical' | 'high' | 'medium';
}

export class RedisViolationScanner {
  /**
   * Scan entire server directory for Redis instantiation violations
   */
  static scanProject(serverDir: string): RedisViolation[] {
    const violations: RedisViolation[] = [];
    
    // Find all TypeScript files
    const files = this.getAllFiles(serverDir, '.ts');

    for (const file of files) {
      const fileViolations = this.scanFile(file);
      violations.push(...fileViolations);
    }

    return violations;
  }

  /**
   * Scan single file for violations
   */
  static scanFile(filePath: string): RedisViolation[] {
    const violations: RedisViolation[] = [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      let inCommentBlock = false;

      lines.forEach((line, index) => {
        // Track comment blocks
        if (line.includes('/*')) inCommentBlock = true;
        if (line.includes('*/')) inCommentBlock = false;
        if (inCommentBlock) return;
        if (line.trim().startsWith('//')) return;

        const lineNum = index + 1;

        // Pattern 1: new Redis(...) in service/job files
        if (line.match(/new\s+Redis\s*\(/)) {
          violations.push({
            file: filePath,
            line: lineNum,
            type: 'new-redis',
            code: line.trim(),
            severity: 'critical',
          });
        }

        // Pattern 2: redis.connect() / redis.disconnect() called manually
        if (line.match(/redis\.(connect|disconnect)\(\)/)) {
          violations.push({
            file: filePath,
            line: lineNum,
            type: 'manual-connect',
            code: line.trim(),
            severity: 'high',
          });
        }

        // Pattern 3: Service using Redis but not importing singleton
        if (
          line.includes('redis.get') ||
          line.includes('redis.set') ||
          line.includes('redis.del') ||
          line.includes('redis.expire')
        ) {
          const hasCorrectImport =
            content.includes('getRedisInstance') ||
            content.includes('RedisConnectionManager');
          const hasIncorrectImport =
            (content.includes("from 'redis'") || content.includes("from 'ioredis'")) &&
            !content.includes('redisConnectionManager');

          if (hasIncorrectImport && !hasCorrectImport && !line.includes('//')) {
            violations.push({
              file: filePath,
              line: lineNum,
              type: 'missing-singleton',
              code: line.trim(),
              severity: 'high',
            });
          }
        }
      });
    } catch (err) {
      logger.warn(`[VIOLATION-SCAN] Failed to scan ${filePath}: ${String(err)}`);
    }

    return violations;
  }

  /**
   * Generate fix recommendations
   */
  static getFix(violation: RedisViolation): string {
    switch (violation.type) {
      case 'new-redis':
        return `Replace: ${violation.code}
With: const redis = getRedisInstance();
Import: import { getRedisInstance } from '../config/redisConnectionManager';`;

      case 'manual-connect':
        return `Remove manual connection management.
Singleton handles connect/disconnect automatically.
Delete: ${violation.code}`;

      case 'missing-singleton':
        return `Change Redis import to use singleton:
Remove: import {} from 'redis' / 'ioredis'
Add: import { getRedisInstance } from '../config/redisConnectionManager';
Use: const redis = getRedisInstance();`;

      default:
        return 'Unknown violation type';
    }
  }

  /**
   * Generate human-readable report
   */
  static generateReport(violations: RedisViolation[]): string {
    const critical = violations.filter((v) => v.severity === 'critical');
    const high = violations.filter((v) => v.severity === 'high');

    const workingDir = process.cwd();
    const makeRelative = (file: string) => path.relative(workingDir, file);

    let report = `
🔍 REDIS SINGLETON VIOLATION REPORT
=====================================

🚨 CRITICAL Issues (connection storms): ${critical.length}
⚠️  HIGH Issues (manual management): ${high.length}
📊 TOTAL Violations: ${violations.length}

`;

    if (critical.length > 0) {
      report += `CRITICAL VIOLATIONS (Fix immediately!):
${critical
  .map((v) => {
    const relPath = makeRelative(v.file);
    return `  📍 ${relPath}:${v.line}
     Code: ${v.code}
     Issue: Service creating new Redis instance instead of using singleton`;
  })
  .join('\n')}

`;
    }

    if (high.length > 0) {
      report += `HIGH VIOLATIONS:
${high
  .map((v) => {
    const relPath = makeRelative(v.file);
    const fix = this.getFix(v);
    return `  ⚠️  ${relPath}:${v.line}
     Code: ${v.code}
     Fix: ${fix.split('\n')[0]}`;
  })
  .join('\n')}

`;
    }

    return report;
  }

  /**
   * Recursively get all files with given extension
   */
  private static getAllFiles(dir: string, ext: string): string[] {
    const files: string[] = [];

    const walkDir = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          // Skip excluded directories
          if (
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === '.git' ||
            entry.name === 'coverage'
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(ext)) {
            files.push(fullPath);
          }
        }
      } catch (err) {
        // Skip directories we can't read
      }
    };

    walkDir(dir);
    return files;
  }
}

/**
 * Run scan and log results
 */
export async function runViolationScan(serverDir: string): Promise<RedisViolation[]> {
  logger.info('[VIOLATION-SCAN] Starting Redis singleton violation scan...');
  
  const violations = RedisViolationScanner.scanProject(serverDir);
  
  if (violations.length === 0) {
    logger.info('[VIOLATION-SCAN] ✅ No violations found! Redis singleton pattern is clean.');
  } else {
    const report = RedisViolationScanner.generateReport(violations);
    logger.warn(report);
  }

  return violations;
}
