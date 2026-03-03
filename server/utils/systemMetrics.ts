/**
 * System Metrics Collector
 * 
 * Provides real system metrics like CPU usage, memory usage, and disk usage
 * Used by metricsAggregationService for accurate platform monitoring
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

interface SystemMetrics {
  cpuUsage: number;        // Percentage 0-100
  memoryUsage: number;     // Percentage 0-100
  diskUsage: number;       // Percentage 0-100
  totalMemoryMB: number;   // Total system memory in MB
  usedMemoryMB: number;    // Used memory in MB
  processMemoryMB: number; // Node.js process memory in MB
}

export class SystemMetricsCollector {
  private static lastCpuCheck: { time: number; idle: number; total: number } | null = null;

  /**
   * Get CPU usage percentage
   * Calculates based on CPU load average relative to number of cores
   */
  static getCPUUsage(): number {
    try {
      const cpus = os.cpus();
      const numCores = cpus.length;
      
      // Get load average (1 minute)
      const loadAvg = os.loadavg()[0];
      
      // Calculate percentage: (load average / number of cores) * 100
      const cpuUsagePercent = Math.min((loadAvg / numCores) * 100, 100);
      
      return Math.round(cpuUsagePercent * 100) / 100; // Round to 2 decimals
    } catch (error) {
      logger.warn('Failed to calculate CPU usage:', error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * Get memory usage percentage
   */
  static getMemoryUsage(): number {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      
      const memoryUsagePercent = (usedMem / totalMem) * 100;
      return Math.round(memoryUsagePercent * 100) / 100; // Round to 2 decimals
    } catch (error) {
      logger.warn('Failed to calculate memory usage:', error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * Get disk usage percentage
   * Checks the root partition or working directory
   */
  static getDiskUsage(): number {
    try {
      // Get disk space of current working directory
      const diskRoot = process.cwd();
      
      // Use df command to get disk usage (works on Unix-like systems)
      try {
        const { execSync } = require('child_process');
        const result = execSync(`df -h "${diskRoot}" | tail -1 | awk '{print $5}' | sed 's/%//'`).toString().trim();
        const diskUsagePercent = parseFloat(result);
        
        if (!isNaN(diskUsagePercent)) {
          return Math.round(diskUsagePercent * 100) / 100;
        }
      } catch {
        // If df command fails, return 0 (not available)
      }
      
      return 0;
    } catch (error) {
      logger.warn('Failed to calculate disk usage:', error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * Get process memory usage in MB
   */
  static getProcessMemoryMB(): number {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      return heapUsedMB;
    } catch (error) {
      logger.warn('Failed to get process memory:', error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * Get total system memory in MB
   */
  static getTotalMemoryMB(): number {
    try {
      const totalMem = os.totalmem();
      return Math.round(totalMem / 1024 / 1024);
    } catch (error) {
      logger.warn('Failed to get total memory:', error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * Get used system memory in MB
   */
  static getUsedMemoryMB(): number {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      return Math.round(usedMem / 1024 / 1024);
    } catch (error) {
      logger.warn('Failed to get used memory:', error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * Get all system metrics at once
   */
  static getSystemMetrics(): SystemMetrics {
    return {
      cpuUsage: this.getCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      diskUsage: this.getDiskUsage(),
      totalMemoryMB: this.getTotalMemoryMB(),
      usedMemoryMB: this.getUsedMemoryMB(),
      processMemoryMB: this.getProcessMemoryMB(),
    };
  }

  /**
   * Get network latency to a target (e.g., ping time)
   * This is simplified - in production you might use actual ping measurement
   */
  static getNetworkLatency(): number {
    try {
      // For now, return 0 as a placeholder
      // In production, implement actual network latency measurement
      // using dns lookup times or HTTP ping to a monitoring endpoint
      return 0;
    } catch (error) {
      logger.warn('Failed to measure network latency:', error instanceof Error ? error.message : String(error));
      return 0;
    }
  }
}

export const systemMetricsCollector = new SystemMetricsCollector();
