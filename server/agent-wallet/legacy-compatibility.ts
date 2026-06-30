/**
 * Legacy Compatibility Layer
 * 
 * Provides backward compatibility for old monolithic wallet API
 * Maps old API to new modular services
 */

import { ethers } from 'ethers';
import Web3 from 'web3';
import { createWalletIfValid, recoverWalletFromMnemonic } from '../utils/cryptoWallet';
import { createWalletOperationsService } from './wallet-operations';
import { createTokenUtilitiesService } from './token-utilities';
import { createDeFiService } from './defi-service';
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
    // Basic format check
    if (!/^0x?[0-9a-fA-F]{64}$/.test(privateKey)) return false;
    // Use centralized helper to verify
    const w = createWalletIfValid(privateKey);
    return !!w;
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
      const wallet = createWalletIfValid(normalized);
      if (!wallet) throw new Error('Invalid private key');
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
      const creds = recoverWalletFromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`);
      return {
        address: creds.address,
        privateKey: creds.privateKey,
        mnemonic: creds.mnemonic || mnemonic
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
  private walletService: any;
  public address: string;
  private privateKey: string;
  private networkConfig: any;
  private web3: any;
  private tokenUtilities: any;
  private defiService?: any;

  constructor(privateKey: string, networkConfig: any) {
    // Validate and normalize private key
    const normalized = WalletManager.normalizePrivateKey(privateKey);
    if (!WalletManager.validatePrivateKey(normalized)) {
      throw new Error('Invalid private key');
    }

    this.privateKey = normalized;
    this.networkConfig = networkConfig;

    // Create an ethers provider and wallet for signing
    const ethersProvider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    const wallet = createWalletIfValid(normalized, ethersProvider);
    if (!wallet) throw new Error('Invalid private key');
    this.address = wallet.address;

    // Web3 instance for on-chain contract interactions
    this.web3 = new Web3(networkConfig.rpcUrl);

    // Signer adapter expected by WalletOperationsService
    const signerAccount = {
      address: wallet.address,
      signTransaction: async (tx: Record<string, unknown>) => {
        const ethersTx: any = {
          to: (tx as any).to,
          data: (tx as any).data,
          nonce: (tx as any).nonce !== undefined ? Number((tx as any).nonce) : undefined,
          chainId: (tx as any).chainId !== undefined ? Number((tx as any).chainId) : (networkConfig.chainId || 1)
        };
        if ((tx as any).value !== undefined) ethersTx.value = (tx as any).value;
        if ((tx as any).gas !== undefined) ethersTx.gasLimit = (tx as any).gas;
        if ((tx as any).gasPrice !== undefined) ethersTx.gasPrice = (tx as any).gasPrice;

        const raw = await wallet.signTransaction(ethersTx);
        return { rawTransaction: raw };
      }
    };

    this.walletService = createWalletOperationsService(this.web3, signerAccount, networkConfig.chainId || 1);
    this.tokenUtilities = createTokenUtilitiesService(this.web3);
    this.defiService = undefined;
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
      return this.walletService.sendTokenHuman(tokenAddress, toAddress, Number(amount));
    } else {
      return this.walletService.sendNativeToken(toAddress, Number(amount));
    }
  }

  /**
   * Get balance
   */
  async getBalance(tokenAddress?: string) {
    if (tokenAddress) {
      return this.tokenUtilities.getTokenBalance(tokenAddress, this.address);
    } else {
      const balanceWei = await this.web3.eth.getBalance(this.address);
      return this.web3.utils.fromWei(balanceWei as any, 'ether');
    }
  }

  /**
   * Swap tokens
   */
  async swap(fromToken: string, toToken: string, amount: string) {
    if (!this.defiService) {
      this.defiService = createDeFiService(this.web3, this.address, this.networkConfig.chainId || 1);
    }
    const quote = await this.defiService.getSwapQuote(fromToken, toToken, Number(amount), 0);
    return this.defiService.executeSwap(quote);
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
