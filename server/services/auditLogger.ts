/**
 * ⚠️  DEPRECATED - FILE-BASED LOGGING
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * THIS SERVICE IS DEPRECATED AND SHOULD NOT BE USED
 * 
 * All audit logging must go to the database, not to files.
 * Use auditConsolidated.ts instead:
 * 👉 server/services/auditConsolidated.ts
 * 
 * Rationale:
 * - File-based logs are not queryable
 * - File-based logs are harder to search/analyze
 * - Database audit_logs table is the single source of truth
 * - File-based approach doesn't scale
 * 
 * New code should use:
 * import { logConsolidatedAuditEvent } from '../services/auditConsolidated';
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';

export enum AuditAction {
  SIMULATION_SUCCESS = 'SIMULATION_SUCCESS',
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  SIMULATION_ERROR = 'SIMULATION_ERROR',
  SIMULATION_FATAL = 'SIMULATION_FATAL',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_TYPE = 'INVALID_TYPE',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
}

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  /** Unique audit ID (generated) */
  auditId?: string;

  /** User who triggered the action */
  userId: string;

  /** Action performed */
  action: AuditAction | string;

  /** Resource affected */
  resource: string;

  /** Action status */
  status: AuditStatus | string;

  /** Additional context details */
  details?: Record<string, any>;

  /** Timestamp of the action */
  timestamp: Date;

  /** IP address (if available) */
  ipAddress?: string;

  /** Session ID (if available) */
  sessionId?: string;
}

/**
 * Audit logger configuration
 */
interface AuditConfig {
  /** Log directory path */
  logDir: string;

  /** Enable console logging */
  verbose: boolean;

  /** Enable file logging */
  fileLogging: boolean;

  /** Database connection for logging (future) */
  dbConnection?: any;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AuditConfig = {
  logDir: path.join(process.cwd(), 'logs', 'audit'),
  verbose: process.env.NODE_ENV !== 'production',
  fileLogging: true,
};

/**
 * Audit Logger Service
 */
class AuditLoggerService {
  private config: AuditConfig;

  constructor(config?: Partial<AuditConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Ensure log directory exists
    if (this.config.fileLogging) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Create audit log directory if it doesn't exist
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.config.logDir)) {
        fs.mkdirSync(this.config.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create audit log directory:', error);
    }
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format log entry as JSON
   */
  private formatLogEntry(entry: AuditLogEntry): string {
    return JSON.stringify(
      {
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Write log to file
   */
  private writeToFile(entry: AuditLogEntry): void {
    if (!this.config.fileLogging) return;

    try {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const fileName = `audit-${dateStr}.log`;
      const filePath = path.join(this.config.logDir, fileName);

      const logLine = this.formatLogEntry(entry) + '\n---\n';

      fs.appendFileSync(filePath, logLine, 'utf-8');
    } catch (error) {
      console.error('Failed to write audit log to file:', error);
    }
  }

  /**
   * Write to console
   */
  private writeToConsole(entry: AuditLogEntry): void {
    if (!this.config.verbose) return;

    const levelMap = {
      SUCCESS: '✓',
      WARNING: '⚠',
      ERROR: '✗',
      VALIDATION_ERROR: '⚠',
      INVALID_TYPE: '✗',
      EXECUTION_ERROR: '✗',
      UNEXPECTED_ERROR: '✗',
    };

    const iconColor = {
      SUCCESS: '\x1b[32m', // Green
      WARNING: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m', // Red
      VALIDATION_ERROR: '\x1b[33m',
      INVALID_TYPE: '\x1b[31m',
      EXECUTION_ERROR: '\x1b[31m',
      UNEXPECTED_ERROR: '\x1b[31m',
    };

    const resetColor = '\x1b[0m';
    const icon = levelMap[entry.status as keyof typeof levelMap] || '•';
    const color = iconColor[entry.status as keyof typeof iconColor] || '';

    console.log(
      `${color}${icon}${resetColor} [${entry.timestamp.toISOString()}] ${entry.action} (${entry.userId}@${entry.resource}): ${entry.status}`
    );

    if (entry.details && Object.keys(entry.details).length > 0) {
      console.log(
        `  Details: ${JSON.stringify(entry.details)}`
      );
    }
  }

  /**
   * Log to database (future feature)
   */
  private async writeToDatabase(entry: AuditLogEntry): Promise<void> {
    if (!this.config.dbConnection) return;

    try {
      // Future implementation: Insert into database
      // await this.config.dbConnection.query(
      //   'INSERT INTO audit_logs (auditId, userId, action, ...) VALUES (...)',
      //   [entry.auditId, entry.userId, ...]
      // );
    } catch (error) {
      console.error('Failed to write audit log to database:', error);
    }
  }

  /**
   * Generate a summary of recent logs
   */
  public getLogSummary(hoursBack: number = 24): {
    total: number;
    byStatus: Record<string, number>;
    byAction: Record<string, number>;
  } {
    try {
      const files = fs.readdirSync(this.config.logDir);
      const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      let logs: AuditLogEntry[] = [];

      for (const file of files) {
        if (!file.startsWith('audit-') || !file.endsWith('.log')) continue;

        const filePath = path.join(this.config.logDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const entries = content
          .split('---\n')
          .filter((e) => e.trim())
          .map((e) => {
            try {
              return JSON.parse(e.trim());
            } catch {
              return null;
            }
          })
          .filter((e) => e && new Date(e.timestamp) > cutoffDate);

        logs = [...logs, ...entries.filter(Boolean)];
      }

      const summary = {
        total: logs.length,
        byStatus: {} as Record<string, number>,
        byAction: {} as Record<string, number>,
      };

      for (const log of logs) {
        summary.byStatus[log.status] = (summary.byStatus[log.status] || 0) + 1;
        summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
      }

      return summary;
    } catch (error) {
      console.error('Failed to generate log summary:', error);
      return { total: 0, byStatus: {}, byAction: {} };
    }
  }

  /**
   * Main audit logging method
   */
  public async log(entry: AuditLogEntry): Promise<void> {
    // Generate audit ID if not provided
    if (!entry.auditId) {
      entry.auditId = this.generateAuditId();
    }

    // Log to all configured outputs
    this.writeToConsole(entry);
    this.writeToFile(entry);
    await this.writeToDatabase(entry);
  }

  /**
   * Convenience method for simulation success
   */
  public async logSimulationSuccess(
    userId: string,
    simulatorType: string,
    riskLevel: string,
    executionTimeMs: number
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.SIMULATION_SUCCESS,
      resource: 'simulator',
      status: AuditStatus.SUCCESS,
      details: {
        simulatorType,
        riskLevel,
        executionTimeMs,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Convenience method for simulation failure
   */
  public async logSimulationFailure(
    userId: string,
    simulatorType: string,
    error: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.SIMULATION_FAILED,
      resource: 'simulator',
      status: AuditStatus.ERROR,
      details: {
        simulatorType,
        error,
      },
      timestamp: new Date(),
    });
  }
}

/**
 * Singleton instance
 */
let loggerInstance: AuditLoggerService | null = null;

/**
 * Get or create logger instance
 */
export function getAuditLogger(config?: Partial<AuditConfig>): AuditLoggerService {
  if (!loggerInstance) {
    loggerInstance = new AuditLoggerService(config);
  }
  return loggerInstance;
}

/**
 * Log function (for convenience)
 * Usage: await auditLog({ userId: 'user123', action: 'SIMULATION_SUCCESS', ... })
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  const logger = getAuditLogger();
  await logger.log(entry);
}

export default AuditLoggerService;
