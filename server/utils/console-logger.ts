import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Console Logger Service
 * 
 * Features:
 * - Captures all console output (log, warn, error, info, debug)
 * - Creates unique timestamped log files per server run
 * - Includes boot metadata (timestamp, environment, node version, etc.)
 * - Maintains both live console output AND file logging
 * - Respects log levels and filtering
 */

interface LogMetadata {
  timestamp: string;
  uptime: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  memory?: NodeJS.MemoryUsage;
}

export class ConsoleLoggerService {
  private logDir: string;
  private currentLogFile: string;
  private writeStream: fs.WriteStream | null = null;
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };
  private startTime: number = Date.now();
  private bootMetadata: Record<string, any> = {};

  constructor() {
    // Create logs directory
    this.logDir = path.join(dirname(__dirname), 'logs');
    this.ensureLogsDirectory();
    
    // Generate unique log file name with timestamp
    this.currentLogFile = this.generateLogFileName();
    
    // Create write stream
    this.createWriteStream();
    
    // Initialize boot metadata
    this.initializeBootMetadata();
  }

  /**
   * Ensure logs directory exists
   */
  private ensureLogsDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
      this.originalConsole.log(`📁 Logs directory created: ${this.logDir}`);
    }
  }

  /**
   * Generate unique log filename with timestamp
   * Format: server-2025-03-04T14-32-15-123.log
   */
  private generateLogFileName(): string {
    const now = new Date();
    const iso = now.toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .slice(0, -1); // Remove 'Z'
    
    const fileName = `server-${iso}.log`;
    return path.join(this.logDir, fileName);
  }

  /**
   * Create write stream for log file
   */
  private createWriteStream(): void {
    try {
      this.writeStream = fs.createWriteStream(this.currentLogFile, {
        flags: 'a',
        encoding: 'utf-8',
      });
      
      this.writeStream.on('error', (err) => {
        this.originalConsole.error('🔴 Log file write error:', err);
      });

      this.originalConsole.log(`📝 Console logging to: ${this.currentLogFile}`);
    } catch (error) {
      this.originalConsole.error('🔴 Failed to create log file:', error);
    }
  }

  /**
   * Initialize boot metadata
   */
  private initializeBootMetadata(): void {
    this.bootMetadata = {
      bootTime: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '5000',
      pid: process.pid,
      workingDirectory: process.cwd(),
    };
  }

  /**
   * Write boot metadata to log file
   */
  public writeBootMetadata(): void {
    const separator = '═'.repeat(80);
    const lines = [
      separator,
      '🚀 SERVER BOOT METADATA',
      separator,
      `Boot Time:          ${this.bootMetadata.bootTime}`,
      `Node Version:       ${this.bootMetadata.nodeVersion}`,
      `Platform:           ${this.bootMetadata.platform}`,
      `Architecture:       ${this.bootMetadata.arch}`,
      `Environment:        ${this.bootMetadata.environment}`,
      `Port:               ${this.bootMetadata.port}`,
      `Process ID (PID):   ${this.bootMetadata.pid}`,
      `Working Directory:  ${this.bootMetadata.workingDirectory}`,
      `Log File:           ${this.currentLogFile}`,
      separator,
      '',
    ];

    lines.forEach(line => {
      this.originalConsole.log(line);
      this.writeToFile(line);
    });
  }

  /**
   * Write string to log file
   */
  private writeToFile(message: string): void {
    if (!this.writeStream) return;

    try {
      this.writeStream.write(message + '\n');
    } catch (error) {
      this.originalConsole.error('🔴 Failed to write to log file:', error);
    }
  }

  /**
   * Format log message with metadata
   */
  private formatLogMessage(level: string, args: any[]): string {
    const uptime = this.getUptime();
    const timestamp = new Date().toISOString();
    const message = args
      .map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    return `[${timestamp}] [${level.toUpperCase()}] [${uptime}s] ${message}`;
  }

  /**
   * Get server uptime in seconds
   */
  private getUptime(): string {
    const uptimeMs = Date.now() - this.startTime;
    return (uptimeMs / 1000).toFixed(2);
  }

  /**
   * Hook console.log
   */
  public hookConsoleLog(): void {
    (console as any).log = (...args: any[]) => {
      const formatted = this.formatLogMessage('log', args);
      this.originalConsole.log(...args);
      this.writeToFile(formatted);
    };

    (console as any).info = (...args: any[]) => {
      const formatted = this.formatLogMessage('info', args);
      this.originalConsole.info(...args);
      this.writeToFile(formatted);
    };

    (console as any).warn = (...args: any[]) => {
      const formatted = this.formatLogMessage('warn', args);
      this.originalConsole.warn(...args);
      this.writeToFile(formatted);
    };

    (console as any).error = (...args: any[]) => {
      const formatted = this.formatLogMessage('error', args);
      this.originalConsole.error(...args);
      this.writeToFile(formatted);
    };

    (console as any).debug = (...args: any[]) => {
      const formatted = this.formatLogMessage('debug', args);
      this.originalConsole.debug(...args);
      this.writeToFile(formatted);
    };
  }

  /**
   * Get current log file path
   */
  public getCurrentLogPath(): string {
    return this.currentLogFile;
  }

  /**
   * Get logs directory path
   */
  public getLogsDir(): string {
    return this.logDir;
  }

  /**
   * Get boot metadata
   */
  public getBootMetadata(): Record<string, any> {
    return this.bootMetadata;
  }

  /**
   * List all log files
   */
  public listLogFiles(): string[] {
    try {
      return fs.readdirSync(this.logDir)
        .filter(f => f.endsWith('.log'))
        .map(f => path.join(this.logDir, f))
        .sort()
        .reverse(); // Most recent first
    } catch (error) {
      this.originalConsole.error('Failed to list log files:', error);
      return [];
    }
  }

  /**
   * Get live tail of current log
   * Returns last N lines from the current log file
   */
  public getTailOfCurrentLog(lines: number = 50): string {
    try {
      const content = fs.readFileSync(this.currentLogFile, 'utf-8');
      const logLines = content.split('\n');
      return logLines.slice(-lines).join('\n');
    } catch (error) {
      this.originalConsole.error('Failed to read log tail:', error);
      return '';
    }
  }

  /**
   * Close and finalize logging
   */
  public closeLogging(): void {
    const lines = [
      '',
      '═'.repeat(80),
      '🛑 SERVER SHUTDOWN',
      `Shutdown Time: ${new Date().toISOString()}`,
      `Total Uptime: ${this.getUptime()}s`,
      '═'.repeat(80),
      '',
    ];

    lines.forEach(line => {
      this.writeToFile(line);
    });

    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }
}

/**
 * Singleton instance
 */
let instance: ConsoleLoggerService | null = null;

export function initializeConsoleLogger(): ConsoleLoggerService {
  if (!instance) {
    instance = new ConsoleLoggerService();
    instance.hookConsoleLog();
    instance.writeBootMetadata();
  }
  return instance;
}

export function getConsoleLogger(): ConsoleLoggerService {
  if (!instance) {
    return initializeConsoleLogger();
  }
  return instance;
}
