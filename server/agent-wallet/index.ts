/**
 * Agent Wallet Service - Index
 * 
 * Central export point for all wallet service modules and utilities
 * Provides singleton instance creation and type exports
 */

// Service exports
export { WalletOperationsService, createWalletOperationsService } from './wallet-operations';
export { TokenUtilitiesService, createTokenUtilitiesService } from './token-utilities';
export { WalletPersistenceService, createWalletPersistenceService } from './wallet-persistence';
export { WalletGasManagerService, createWalletGasManagerService } from './wallet-gas-manager';
export { WalletInfoService, createWalletInfoService } from './wallet-info';
export { DeFiService, createDeFiService } from './defi-service';
export { ChainManager, createChainManager, SUPPORTED_CHAINS } from './networks-config';
export {
  WALLET_PROVIDERS,
  INTEGRATION_ROADMAP,
  IMPLEMENTATION_GUIDE,
  SECURITY_BEST_PRACTICES,
  getSupportedProviders,
  getPlannedProviders,
  getProvidersByStatus,
  getProvidersForChain,
  getProvidersByConnectionMethod,
  getImplementationSummary
} from './wallet-provider-integrations';

// Type exports
export type {
  WalletConfig,
  WalletState,
  WalletBalance,
  AccountInfo,
  TokenInfo,
  TokenBalance,
  TransactionResult,
  GasConfig,
  GasPriceData
} from './types';

export type {
  SwapQuote,
  LiquidityPosition,
  StakingInfo,
  FlashLoan
} from './defi-service';

export type { ChainConfig } from './networks-config';
export type { WalletProvider } from './wallet-provider-integrations';

// ERC20 ABI export
export { ENHANCED_ERC20_ABI } from './erc20-abi';
import Web3 from 'web3';
type Web3Type = InstanceType<typeof Web3>;

interface SignerAccount {
  address: string;
  signTransaction(tx: Record<string, unknown>): Promise<any>;
}

/**
 * AgentWalletManager - Unified wallet service interface
 * 
 * Provides a single point of access for all wallet operations
 * Manages initialization and lifecycle of all service modules
 */
export class AgentWalletManager {
  private walletOperations?: import('./wallet-operations').WalletOperationsService;
  private tokenUtilities?: import('./token-utilities').TokenUtilitiesService;
  private walletPersistence?: import('./wallet-persistence').WalletPersistenceService;
  private gasManager?: import('./wallet-gas-manager').WalletGasManagerService;
  private walletInfo?: import('./wallet-info').WalletInfoService;
  private isInitialized: boolean = false;

  /**
   * Initialize all wallet services
   */
  async initialize(web3: Web3Type, account: SignerAccount, chainId: number, dataDir?: string): Promise<void> {
    try {
      const { createWalletOperationsService } = await import('./wallet-operations');
      const { createTokenUtilitiesService } = await import('./token-utilities');
      const { createWalletPersistenceService } = await import('./wallet-persistence');
      const { createWalletGasManagerService } = await import('./wallet-gas-manager');
      const { createWalletInfoService } = await import('./wallet-info');

      this.walletOperations = createWalletOperationsService(web3, account, chainId);
      this.tokenUtilities = createTokenUtilitiesService(web3);
      this.walletPersistence = createWalletPersistenceService(dataDir);
      this.gasManager = createWalletGasManagerService(web3);
      this.walletInfo = createWalletInfoService(web3);

      await this.walletPersistence.initialize();
      this.isInitialized = true;

      console.log('AgentWalletManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AgentWalletManager:', error);
      throw new Error(
        `Failed to initialize wallet manager: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get wallet operations service
   */
  getWalletOperations() {
    this.assertInitialized();
    return this.walletOperations;
  }

  /**
   * Get token utilities service
   */
  getTokenUtilities() {
    this.assertInitialized();
    return this.tokenUtilities;
  }

  /**
   * Get wallet persistence service
   */
  getWalletPersistence() {
    this.assertInitialized();
    return this.walletPersistence;
  }

  /**
   * Get gas manager service
   */
  getGasManager() {
    this.assertInitialized();
    return this.gasManager;
  }

  /**
   * Get wallet info service
   */
  getWalletInfo() {
    this.assertInitialized();
    return this.walletInfo;
  }

  /**
   * Check if manager is initialized
   */
  isInitializedCheck(): boolean {
    return this.isInitialized;
  }

  /**
   * Assert that services are initialized
   */
  private assertInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('AgentWalletManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Shutdown services
   */
  async shutdown(): Promise<void> {
    // Cleanup cache and resources
    if (this.tokenUtilities) {
      this.tokenUtilities.clearTokenCache?.();
    }
    if (this.walletInfo) {
      this.walletInfo.clearCache?.();
    }
    if (this.walletOperations) {
      this.walletOperations.clearTransactionCache?.();
    }

    this.isInitialized = false;
    console.log('AgentWalletManager shut down successfully');
  }

  /**
   * Get service statistics
   */
  getStatistics(): Record<string, any> {
    return {
      initialized: this.isInitialized,
      services: {
        walletOperations: !!this.walletOperations,
        tokenUtilities: !!this.tokenUtilities,
        walletPersistence: !!this.walletPersistence,
        gasManager: !!this.gasManager,
        walletInfo: !!this.walletInfo
      },
      caches: {
        tokenCache: this.tokenUtilities?.getCacheStats?.() || {},
        walletInfoCache: this.walletInfo?.getCacheStats?.() || {}
      }
    };
  }
}

// Export singleton creator
export const createAgentWalletManager = (): AgentWalletManager => {
  return new AgentWalletManager();
};

// Default export
export default AgentWalletManager;
