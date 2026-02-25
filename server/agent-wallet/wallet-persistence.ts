/**
 * Agent Wallet Service - Wallet Persistence Module
 * 
 * Handles wallet data persistence, storage, and recovery
 */

import fs from 'fs/promises';
import path from 'path';
import type { WalletConfig, WalletState } from './types';

/**
 * WalletPersistenceService - Manages wallet data persistence
 */
export class WalletPersistenceService {
  private dataDir: string;
  private walletFile: string;
  private stateFile: string;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.walletFile = path.join(dataDir, 'wallet.json');
    this.stateFile = path.join(dataDir, 'wallet-state.json');
  }

  /**
   * Initialize the data directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log(`Wallet persistence initialized at: ${this.dataDir}`);
    } catch (error) {
      console.error('Failed to initialize wallet persistence:', error);
      throw new Error(
        `Failed to initialize wallet directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Save wallet configuration
   */
  async saveWalletConfig(config: WalletConfig): Promise<void> {
    try {
      await this.initialize();

      // Don't save sensitive data directly
      const safeConfig = {
        address: config.address,
        chainId: config.chainId,
        network: config.network,
        savedAt: new Date().toISOString()
      };

      await fs.writeFile(this.walletFile, JSON.stringify(safeConfig, null, 2), 'utf-8');
      console.log('Wallet configuration saved');
    } catch (error) {
      console.error('Failed to save wallet config:', error);
      throw new Error(
        `Failed to save wallet config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load wallet configuration
   */
  async loadWalletConfig(): Promise<Partial<WalletConfig> | null> {
    try {
      const data = await fs.readFile(this.walletFile, 'utf-8');
      const config = JSON.parse(data);
      return config;
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        return null; // File doesn't exist yet
      }
      console.error('Failed to load wallet config:', error);
      throw new Error(
        `Failed to load wallet config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Save wallet state
   */
  async saveWalletState(state: WalletState): Promise<void> {
    try {
      await this.initialize();

      const safeState = {
        ...state,
        savedAt: new Date().toISOString()
      };

      await fs.writeFile(this.stateFile, JSON.stringify(safeState, null, 2), 'utf-8');
      console.log('Wallet state saved');
    } catch (error) {
      console.error('Failed to save wallet state:', error);
      throw new Error(
        `Failed to save wallet state: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load wallet state
   */
  async loadWalletState(): Promise<Partial<WalletState> | null> {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      const state = JSON.parse(data);
      return state;
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        return null; // File doesn't exist yet
      }
      console.error('Failed to load wallet state:', error);
      throw new Error(
        `Failed to load wallet state: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete wallet data
   */
  async deleteWalletData(): Promise<void> {
    try {
      try {
        await fs.unlink(this.walletFile);
      } catch (error) {
        if ((error as any)?.code !== 'ENOENT') {
          throw error;
        }
      }

      try {
        await fs.unlink(this.stateFile);
      } catch (error) {
        if ((error as any)?.code !== 'ENOENT') {
          throw error;
        }
      }

      console.log('Wallet data deleted');
    } catch (error) {
      console.error('Failed to delete wallet data:', error);
      throw new Error(
        `Failed to delete wallet data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Backup wallet data
   */
  async backupWalletData(): Promise<string> {
    try {
      await this.initialize();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(this.dataDir, 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const backupFile = path.join(backupDir, `wallet-backup-${timestamp}.json`);

      // Read both files and combine
      const config = await this.loadWalletConfig();
      const state = await this.loadWalletState();

      const backup = {
        config,
        state,
        backedUpAt: new Date().toISOString()
      };

      await fs.writeFile(backupFile, JSON.stringify(backup, null, 2), 'utf-8');
      console.log(`Wallet backed up to: ${backupFile}`);

      return backupFile;
    } catch (error) {
      console.error('Failed to backup wallet:', error);
      throw new Error(
        `Failed to backup wallet: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<string[]> {
    try {
      const backupDir = path.join(this.dataDir, 'backups');
      try {
        const files = await fs.readdir(backupDir);
        return files.filter(f => f.startsWith('wallet-backup-') && f.endsWith('.json'));
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Restore wallet data from backup
   */
  async restoreFromBackup(backupFileName: string): Promise<void> {
    try {
      const backupDir = path.join(this.dataDir, 'backups');
      const backupFile = path.join(backupDir, backupFileName);

      const data = await fs.readFile(backupFile, 'utf-8');
      const backup = JSON.parse(data);

      if (backup.config) {
        await this.saveWalletConfig(backup.config);
      }
      if (backup.state) {
        await this.saveWalletState(backup.state);
      }

      console.log('Wallet restored from backup');
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw new Error(
        `Failed to restore backup: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if wallet data exists
   */
  async walletDataExists(): Promise<boolean> {
    try {
      const config = await this.loadWalletConfig();
      return config !== null;
    } catch {
      return false;
    }
  }
}

// Export singleton instance creator
export const createWalletPersistenceService = (dataDir?: string): WalletPersistenceService => {
  return new WalletPersistenceService(dataDir);
};
