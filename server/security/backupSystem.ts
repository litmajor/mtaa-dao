
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { storage } from '../storage';

const execAsync = promisify(exec);

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron format
  retentionDays: number;
  location: string;
  encryptionKey?: string;
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  checksum: string;
  location: string;
  status: 'completed' | 'failed' | 'in_progress';
  error?: string;
}

export class BackupSystem {
  private static instance: BackupSystem;
  private config: BackupConfig;
  
  constructor(config: BackupConfig) {
    this.config = config;
  }
  
  public static getInstance(config?: BackupConfig): BackupSystem {
    if (!BackupSystem.instance && config) {
      BackupSystem.instance = new BackupSystem(config);
    }
    return BackupSystem.instance;
  }
  
  async createFullBackup(): Promise<BackupMetadata> {
    const backupId = `backup_${Date.now()}`;
    const timestamp = new Date();
    
    try {
      console.log(`Starting full backup: ${backupId}`);
      
      // Create backup directory
      const backupPath = path.join(this.config.location, backupId);
      await fs.mkdir(backupPath, { recursive: true });
      
      // Backup database
      const dbBackupPath = path.join(backupPath, 'database.sql');
      await this.backupDatabase(dbBackupPath);
      
      // Backup uploaded files
      const filesBackupPath = path.join(backupPath, 'uploads');
      await this.backupUploads(filesBackupPath);
      
      // Backup configuration
      const configBackupPath = path.join(backupPath, 'config.json');
      await this.backupConfiguration(configBackupPath);
      
      // Create metadata
      const stats = await fs.stat(backupPath);
      const checksum = await this.calculateChecksum(backupPath);
      
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type: 'full',
        size: stats.size,
        checksum,
        location: backupPath,
        status: 'completed'
      };
      
      // Store metadata
      await storage.createBackupRecord(metadata);
      
      console.log(`Full backup completed: ${backupId}`);
      return metadata;
      
    } catch (error) {
      console.error(`Backup failed: ${error}`);
      
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type: 'full',
        size: 0,
        checksum: '',
        location: '',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
      
      await storage.createBackupRecord(metadata);
      throw error;
    }
  }
  
  async createIncrementalBackup(lastBackupTime: Date): Promise<BackupMetadata> {
    const backupId = `incremental_${Date.now()}`;
    const timestamp = new Date();
    
    try {
      console.log(`Starting incremental backup: ${backupId}`);
      
      const backupPath = path.join(this.config.location, backupId);
      await fs.mkdir(backupPath, { recursive: true });
      
      // Backup only changed data since last backup
      await this.backupChangedData(backupPath, lastBackupTime);
      
      const stats = await fs.stat(backupPath);
      const checksum = await this.calculateChecksum(backupPath);
      
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type: 'incremental',
        size: stats.size,
        checksum,
        location: backupPath,
        status: 'completed'
      };
      
      await storage.createBackupRecord(metadata);
      
      console.log(`Incremental backup completed: ${backupId}`);
      return metadata;
      
    } catch (error) {
      console.error(`Incremental backup failed: ${error}`);
      throw error;
    }
  }
  
  async restoreFromBackup(backupId: string): Promise<void> {
    try {
      console.log(`Starting restore from backup: ${backupId}`);
      
      const metadata = await storage.getBackupRecord(backupId);
      if (!metadata) {
        throw new Error(`Backup not found: ${backupId}`);
      }
      
      if (metadata.status !== 'completed') {
        throw new Error(`Cannot restore from incomplete backup: ${backupId}`);
      }
      
      // Verify backup integrity
      const currentChecksum = await this.calculateChecksum(metadata.location);
      if (currentChecksum !== metadata.checksum) {
        throw new Error(`Backup integrity check failed: ${backupId}`);
      }
      
      // Stop application services before restore
      await this.stopServices();
      
      try {
        // Restore database
        const dbBackupPath = path.join(metadata.location, 'database.sql');
        await this.restoreDatabase(dbBackupPath);
        
        // Restore files
        const filesBackupPath = path.join(metadata.location, 'uploads');
        await this.restoreUploads(filesBackupPath);
        
        // Restore configuration
        const configBackupPath = path.join(metadata.location, 'config.json');
        await this.restoreConfiguration(configBackupPath);
        
        console.log(`Restore completed: ${backupId}`);
        
      } finally {
        // Restart services
        await this.startServices();
      }
      
    } catch (error) {
      console.error(`Restore failed: ${error}`);
      throw error;
    }
  }
  
  async cleanupOldBackups(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      const oldBackups = await storage.getBackupsOlderThan(cutoffDate);
      
      for (const backup of oldBackups) {
        try {
          // Remove backup files
          await fs.rm(backup.location, { recursive: true, force: true });
          
          // Remove backup record
          await storage.deleteBackupRecord(backup.id);
          
          console.log(`Cleaned up old backup: ${backup.id}`);
        } catch (error) {
          console.error(`Failed to cleanup backup ${backup.id}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
  
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const metadata = await storage.getBackupRecord(backupId);
      if (!metadata) return false;
      
      // Check if backup files exist
      try {
        await fs.access(metadata.location);
      } catch {
        return false;
      }
      
      // Verify checksum
      const currentChecksum = await this.calculateChecksum(metadata.location);
      return currentChecksum === metadata.checksum;
      
    } catch (error) {
      console.error(`Backup verification failed: ${error}`);
      return false;
    }
  }
  
  private async backupDatabase(outputPath: string): Promise<void> {
    // This would depend on your database type
    // For PostgreSQL:
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      await execAsync(`pg_dump "${dbUrl}" > "${outputPath}"`);
    }
  }
  
  private async backupUploads(outputPath: string): Promise<void> {
    const uploadsDir = path.join(process.cwd(), 'server', 'uploads');
    try {
      await execAsync(`cp -r "${uploadsDir}" "${outputPath}"`);
    } catch (error) {
      // Uploads directory might not exist
      console.warn('No uploads directory found, skipping');
    }
  }
  
  private async backupConfiguration(outputPath: string): Promise<void> {
    const config = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV,
      // Add other configuration as needed
    };
    
    await fs.writeFile(outputPath, JSON.stringify(config, null, 2));
  }
  
  private async backupChangedData(outputPath: string, since: Date): Promise<void> {
    // Export only data changed since the specified date
    const changedData = await storage.getDataChangedSince(since);
    await fs.writeFile(
      path.join(outputPath, 'incremental_data.json'),
      JSON.stringify(changedData, null, 2)
    );
  }
  
  private async restoreDatabase(backupPath: string): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      await execAsync(`psql "${dbUrl}" < "${backupPath}"`);
    }
  }
  
  private async restoreUploads(backupPath: string): Promise<void> {
    const uploadsDir = path.join(process.cwd(), 'server', 'uploads');
    await execAsync(`cp -r "${backupPath}" "${uploadsDir}"`);
  }
  
  private async restoreConfiguration(backupPath: string): Promise<void> {
    // Restore configuration if needed
    console.log('Configuration restore completed');
  }
  
  private async calculateChecksum(filePath: string): Promise<string> {
    const { stdout } = await execAsync(`find "${filePath}" -type f -exec sha256sum {} + | sha256sum`);
    return stdout.trim().split(' ')[0];
  }
  
  private async stopServices(): Promise<void> {
    console.log('Stopping services for restore...');
    // Implementation depends on your deployment setup
  }
  
  private async startServices(): Promise<void> {
    console.log('Starting services after restore...');
    // Implementation depends on your deployment setup
  }
}

// Backup scheduler
export class BackupScheduler {
  private backupSystem: BackupSystem;
  private isRunning = false;
  
  constructor(backupSystem: BackupSystem) {
    this.backupSystem = backupSystem;
  }
  
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Schedule daily backups at 2 AM
    const scheduleBackup = () => {
      const now = new Date();
      const nextBackup = new Date();
      nextBackup.setHours(2, 0, 0, 0);
      
      if (nextBackup <= now) {
        nextBackup.setDate(nextBackup.getDate() + 1);
      }
      
      const msUntilBackup = nextBackup.getTime() - now.getTime();
      
      setTimeout(async () => {
        try {
          await this.backupSystem.createFullBackup();
          await this.backupSystem.cleanupOldBackups();
        } catch (error) {
          console.error('Scheduled backup failed:', error);
        }
        
        // Schedule next backup
        scheduleBackup();
      }, msUntilBackup);
    };
    
    scheduleBackup();
    console.log('Backup scheduler started');
  }
  
  stop(): void {
    this.isRunning = false;
    console.log('Backup scheduler stopped');
  }
}
