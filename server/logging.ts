/**
 * Logging Module
 * 
 * Provides centralized logging functionality for the server
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private formatLog(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data && { data }),
    };
  }

  private output(entry: LogEntry): void {
    const output = `[${entry.timestamp}] ${entry.level}: ${entry.message}`;
    
    if (entry.data) {
      if (entry.level === LogLevel.ERROR) {
        console.error(output, entry.data);
      } else if (entry.level === LogLevel.WARN) {
        console.warn(output, entry.data);
      } else if (this.isDevelopment) {
        console.log(output, entry.data);
      }
    } else {
      if (entry.level === LogLevel.ERROR) {
        console.error(output);
      } else if (entry.level === LogLevel.WARN) {
        console.warn(output);
      } else if (this.isDevelopment) {
        console.log(output);
      }
    }
  }

  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      const entry = this.formatLog(LogLevel.DEBUG, message, data);
      this.output(entry);
    }
  }

  info(message: string, data?: any): void {
    const entry = this.formatLog(LogLevel.INFO, message, data);
    this.output(entry);
  }

  warn(message: string, data?: any): void {
    const entry = this.formatLog(LogLevel.WARN, message, data);
    this.output(entry);
  }

  error(message: string, data?: any): void {
    const entry = this.formatLog(LogLevel.ERROR, message, data);
    this.output(entry);
  }
}

export const logger = new Logger();
