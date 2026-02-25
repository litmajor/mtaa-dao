/**
 * Agent Wallet Service - Wallet Info Module
 * 
 * Handles wallet information retrieval, balance checking, and account status
 */

import Web3 from 'web3';
import { isAddress } from 'web3-validator';
import type { WalletBalance, AccountInfo } from './types';

/**
 * WalletInfoService - Manages wallet information retrieval
 */
export class WalletInfoService {
  private web3: Web3;
  private balanceCache: Map<string, { balance: string; timestamp: number }> = new Map();
  private cacheDuration: number = 30000; // 30 seconds

  constructor(web3: Web3) {
    this.web3 = web3;
  }

  /**
   * Get native token balance
   */
  async getBalance(address: string): Promise<string> {
    if (!isAddress(address)) {
      throw new Error('Invalid address');
    }

    // Check cache
    const cached = this.balanceCache.get(address);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.balance;
    }

    try {
      const balance = await this.web3.eth.getBalance(address);
      const balanceStr = balance.toString();

      // Update cache
      this.balanceCache.set(address, {
        balance: balanceStr,
        timestamp: Date.now()
      });

      return balanceStr;
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw new Error(`Failed to fetch balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get balance in ETH format
   */
  async getBalanceInEth(address: string): Promise<number> {
    const balanceWei = await this.getBalance(address);
    return Number(this.web3.utils.fromWei(balanceWei, 'ether'));
  }

  /**
   * Get wallet information
   */
  async getWalletInfo(address: string): Promise<WalletBalance> {
    if (!isAddress(address)) {
      throw new Error('Invalid address');
    }

    try {
      const [balance, nonce, code] = await Promise.all([
        this.getBalance(address),
        this.web3.eth.getTransactionCount(address),
        this.web3.eth.getCode(address)
      ]);

      const balanceEth = Number(this.web3.utils.fromWei(balance, 'ether'));

      return {
        address,
        balance,
        balanceEth,
        nonce: Number(nonce),
        isContract: code !== '0x',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to get wallet info:', error);
      throw new Error(`Failed to fetch wallet info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get account information (includes transaction data)
   */
  async getAccountInfo(address: string): Promise<AccountInfo> {
    if (!isAddress(address)) {
      throw new Error('Invalid address');
    }

    try {
      const [balance, transactionCount, code] = await Promise.all([
        this.getBalance(address),
        this.web3.eth.getTransactionCount(address),
        this.web3.eth.getCode(address)
      ]);

      const balanceEth = Number(this.web3.utils.fromWei(balance, 'ether'));

      return {
        address,
        balance,
        balanceEth,
        transactionCount: Number(transactionCount),
        isContract: code !== '0x',
        codeLength: code.length,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to get account info:', error);
      throw new Error(`Failed to fetch account info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if address has sufficient balance
   */
  async hasSufficientBalance(address: string, requiredAmount: number): Promise<boolean> {
    try {
      const balanceEth = await this.getBalanceInEth(address);
      return balanceEth >= requiredAmount;
    } catch (error) {
      console.error('Failed to check balance:', error);
      return false;
    }
  }

  /**
   * Get transaction history (requires additional indexing service in production)
   */
  async getTransactionHistory(address: string, limit: number = 10): Promise<any[]> {
    if (!isAddress(address)) {
      throw new Error('Invalid address');
    }

    console.log(`Transaction history requires blockchain explorer API or indexing service.`);
    console.log(`Address: ${address}, Limit: ${limit}`);

    // In production, this would integrate with Etherscan, The Graph, or similar services
    return [];
  }

  /**
   * Check if wallet exists (has been used on chain)
   */
  async walletExists(address: string): Promise<boolean> {
    try {
      const info = await this.getAccountInfo(address);
      // Wallet exists if it has either balance, transactions, or is a contract
      return info.balanceEth > 0 || info.transactionCount > 0 || info.isContract;
    } catch {
      return false;
    }
  }

  /**
   * Clear balance cache
   */
  clearCache(): void {
    this.balanceCache.clear();
  }

  /**
   * Set cache duration
   */
  setCacheDuration(durationMs: number): void {
    this.cacheDuration = durationMs;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { cachedAddresses: number; cacheSize: number } {
    return {
      cachedAddresses: this.balanceCache.size,
      cacheSize: this.balanceCache.size * 50 // Rough estimate in bytes
    };
  }
}

// Export singleton instance creator
export const createWalletInfoService = (web3: Web3): WalletInfoService => {
  return new WalletInfoService(web3);
};
