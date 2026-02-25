/**
 * Legacy Compatibility Layer
 * 
 * Provides backward compatibility for old monolithic wallet API
 * Maps old API to new modular services
 */

import { ethers } from 'ethers';
import { WalletOperationsService } from './wallet-operations';
import { ChainManager, SUPPORTED_CHAINS } from './networks-config';

/**
 * Legacy NetworkConfig class for backward compatibility
 */
export class NetworkConfig {
  static readonly CELO_MAINNET = SUPPORTED_CHAINS[42220];
  static readonly CELO_ALFAJORES = SUPPORTED_CHAINS[44787];
  static readonly ETHEREUM_MAINNET = SUPPORTED_CHAINS[1];
  static readonly ETHEREUM_SEPOLIA = SUPPORTED_CHAINS[11155111];
  static readonly POLYGON_MAINNET = SUPPORTED_CHAINS[137];
}

/**
 * Legacy WalletManager class for backward compatibility
 */
export class WalletManager {
  /**
   * Create a new random wallet
   */
  static createWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase || '',
    };
  }

  /**
   * Validate private key format
   */
  static validatePrivateKey(privateKey: string): boolean {
    try {
      // Check if it's a valid Ethereum private key (64 hex chars or 66 with 0x)
      if (!/^0x?[0-9a-fA-F]{64}$/.test(privateKey)) {
        return false;
      }
      // Try to create a wallet from it
      new ethers.Wallet(privateKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize private key (add 0x prefix if missing)
   */
  static normalizePrivateKey(privateKey: string): string {
    if (!privateKey.startsWith('0x')) {
      return '0x' + privateKey;
    }
    return privateKey;
  }

  /**
   * Get address from private key
   */
  static getAddressFromPrivateKey(privateKey: string): string {
    try {
      const normalized = this.normalizePrivateKey(privateKey);
      const wallet = new ethers.Wallet(normalized);
      return wallet.address;
    } catch {
      throw new Error('Invalid private key');
    }
  }

  /**
   * Create wallet from mnemonic
   */
  static createWalletFromMnemonic(mnemonic: string, index: number = 0) {
    try {
      const wallet = ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`);
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic,
      };
    } catch {
      throw new Error('Invalid mnemonic');
    }
  }
}

/**
 * Legacy EnhancedAgentWallet wrapper
 */
export class EnhancedAgentWallet {
  private walletService: WalletOperationsService;
  public address: string;
  private privateKey: string;
  private networkConfig: any;

  constructor(privateKey: string, networkConfig: any) {
    // Validate and normalize private key
    const normalized = WalletManager.normalizePrivateKey(privateKey);
    if (!WalletManager.validatePrivateKey(normalized)) {
      throw new Error('Invalid private key');
    }

    this.privateKey = normalized;
    this.networkConfig = networkConfig;
    
    // Get address from private key
    const wallet = new ethers.Wallet(normalized);
    this.address = wallet.address;

    // Create wallet operations service
    this.walletService = new WalletOperationsService(normalized, networkConfig.rpcUrl);
  }

  /**
   * Get network configuration
   */
  getNetworkConfig() {
    return this.networkConfig;
  }

  /**
   * Transfer tokens
   */
  async transfer(toAddress: string, amount: string, tokenAddress?: string) {
    if (tokenAddress) {
      return this.walletService.transferToken(toAddress, amount, tokenAddress);
    } else {
      return this.walletService.transferNative(toAddress, amount);
    }
  }

  /**
   * Get balance
   */
  async getBalance(tokenAddress?: string) {
    if (tokenAddress) {
      return this.walletService.getTokenBalance(tokenAddress);
    } else {
      return this.walletService.getNativeBalance();
    }
  }

  /**
   * Swap tokens
   */
  async swap(fromToken: string, toToken: string, amount: string) {
    return this.walletService.swapTokens(fromToken, toToken, amount);
  }
}

/**
 * Legacy DaoTreasuryManager for backward compatibility
 * Maps to underlying wallet operations
 */
export class DaoTreasuryManager {
  private wallet: EnhancedAgentWallet;
  private treasuryAddress: string;
  private allowedTokens: string[];

  constructor(wallet: EnhancedAgentWallet, treasuryAddress: string, allowedTokens: string[] = []) {
    this.wallet = wallet;
    this.treasuryAddress = treasuryAddress;
    this.allowedTokens = allowedTokens;
  }

  /**
   * Get treasury snapshot
   */
  async getTreasurySnapshot() {
    return {
      treasuryAddress: this.treasuryAddress,
      balance: await this.wallet.getBalance(),
      tokenCount: this.allowedTokens.length,
      tokens: this.allowedTokens,
      timestamp: new Date(),
    };
  }

  /**
   * Generate treasury report
   */
  async generateTreasuryReport() {
    const snapshot = await this.getTreasurySnapshot();
    return {
      snapshot,
      reportDate: new Date(),
      status: 'active',
    };
  }

  /**
   * Add allowed token
   */
  addAllowedToken(tokenAddress: string) {
    if (!this.allowedTokens.includes(tokenAddress)) {
      this.allowedTokens.push(tokenAddress);
    }
  }

  /**
   * Remove allowed token
   */
  removeAllowedToken(tokenAddress: string) {
    this.allowedTokens = this.allowedTokens.filter(t => t !== tokenAddress);
  }

  /**
   * Get allowed tokens
   */
  getAllowedTokens() {
    return this.allowedTokens;
  }
}
