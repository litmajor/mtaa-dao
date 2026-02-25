/**
 * Agent Wallet Service - Gas Manager Module
 * 
 * Handles gas price estimation, configuration, and optimization
 */

import Web3 from 'web3';
import type { GasConfig, GasPriceData } from './types';

/**
 * WalletGasManagerService - Manages gas configuration and estimation
 */
export class WalletGasManagerService {
  private web3: Web3;
  private gasMultiplier: number = 1.1; // 10% buffer
  private priorityTipPercentage: number = 0.1; // 10% of base fee

  constructor(web3: Web3, gasMultiplier?: number) {
    this.web3 = web3;
    if (gasMultiplier) {
      this.gasMultiplier = gasMultiplier;
    }
  }

  /**
   * Get current gas prices
   */
  async getGasPrices(): Promise<GasPriceData> {
    try {
      const block = await this.web3.eth.getBlock('latest');
      if (!block) {
        throw new Error('Unable to fetch block data');
      }

      const baseFeePerGas = block.baseFeePerGas ? BigInt(block.baseFeePerGas) : BigInt(0);
      const gasPrice = await this.web3.eth.getGasPrice();

      return {
        gasPrice: gasPrice.toString(),
        baseFeePerGas: baseFeePerGas.toString(),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to get gas prices:', error);
      throw new Error(`Failed to fetch gas prices: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(transaction: any): Promise<number> {
    try {
      const gasEstimate = await this.web3.eth.estimateGas(transaction);
      return Number(gasEstimate);
    } catch (error) {
      console.error('Gas estimation failed:', error);
      // Return a default estimate if estimation fails
      return 200000;
    }
  }

  /**
   * Estimate gas with safety buffer
   */
  async estimateGasWithBuffer(transaction: any, bufferPercentage?: number): Promise<number> {
    try {
      const baseGas = await this.estimateGas(transaction);
      const buffer = bufferPercentage || 20; // 20% default buffer
      return Math.ceil(baseGas * (1 + buffer / 100));
    } catch (error) {
      console.error('Gas estimation with buffer failed:', error);
      return 200000;
    }
  }

  /**
   * Get optimal gas configuration
   */
  async getOptimalGasConfig(): Promise<GasConfig> {
    try {
      const gasPrices = await this.getGasPrices();
      const gasPrice = BigInt(gasPrices.gasPrice);
      const baseFeePerGas = BigInt(gasPrices.baseFeePerGas);

      // For EIP-1559 chains
      if (baseFeePerGas > BigInt(0)) {
        const priorityTip = (baseFeePerGas * BigInt(10)) / BigInt(100); // 10% of base fee
        const maxFeePerGas = baseFeePerGas + priorityTip;

        return {
          maxFeePerGas: maxFeePerGas.toString(),
          maxPriorityFeePerGas: priorityTip.toString(),
          gasPrice: gasPrice.toString()
        };
      } else {
        // For legacy chains
        const adjustedGasPrice = (gasPrice * BigInt(110)) / BigInt(100); // 10% buffer

        return {
          gasPrice: adjustedGasPrice.toString()
        };
      }
    } catch (error) {
      console.error('Failed to get optimal gas config:', error);
      // Return a safe default
      return {
        gasPrice: this.web3.utils.toWei('20', 'gwei')
      };
    }
  }

  /**
   * Get gas configuration for network
   */
  async getGasConfigForNetwork(network?: string): Promise<GasConfig> {
    try {
      const gasConfig = await this.getOptimalGasConfig();

      // Network-specific adjustments could go here
      // For now, just return the optimal config
      return gasConfig;
    } catch (error) {
      console.error('Failed to get network gas config:', error);
      return {
        gasPrice: this.web3.utils.toWei('20', 'gwei')
      };
    }
  }

  /**
   * Calculate total transaction cost
   */
  calculateTransactionCost(gasUsed: number, gasPrice: string): string {
    try {
      const gasPriceBigInt = BigInt(gasPrice);
      const totalCost = BigInt(gasUsed) * gasPriceBigInt;
      return this.web3.utils.fromWei(totalCost.toString(), 'ether');
    } catch (error) {
      console.error('Failed to calculate transaction cost:', error);
      return '0';
    }
  }

  /**
   * Set custom gas multiplier
   */
  setGasMultiplier(multiplier: number): void {
    if (multiplier < 1) {
      throw new Error('Gas multiplier must be >= 1');
    }
    this.gasMultiplier = multiplier;
  }

  /**
   * Set priority tip percentage
   */
  setPriorityTipPercentage(percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Priority tip percentage must be between 0 and 100');
    }
    this.priorityTipPercentage = percentage;
  }

  /**
   * Get current gas multiplier
   */
  getGasMultiplier(): number {
    return this.gasMultiplier;
  }

  /**
   * Get current priority tip percentage
   */
  getPriorityTipPercentage(): number {
    return this.priorityTipPercentage;
  }
}

// Export singleton instance creator
export const createWalletGasManagerService = (web3: Web3, gasMultiplier?: number): WalletGasManagerService => {
  return new WalletGasManagerService(web3, gasMultiplier);
};
