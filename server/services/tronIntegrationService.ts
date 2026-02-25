import TronWebModule from 'tronweb';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// TronWeb 6.x - try accessing as class
const TronWeb = (TronWebModule as any)?.TronWeb || (TronWebModule as any);

// Fallback: wrap in function if not constructor
function createTronWeb(config: any) {
  try {
    if (typeof TronWeb === 'function') {
      return new TronWeb(config);
    }
    if (typeof (TronWebModule as any)?.TronWeb === 'function') {
      return new (TronWebModule as any).TronWeb(config);
    }
    // Last resort - try to call it directly
    return TronWebModule(config);
  } catch (e) {
    throw new Error(`Failed to instantiate TronWeb: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export interface TronTransferRequest {
  fromAddress: string;
  toAddress: string;
  tokenAddress?: string; // For TRC20 transfers, omit for native TRX
  amount: string;
  decimals: number;
}

export interface TronTransactionStatus {
  txid: string;
  status: 'pending' | 'confirmed' | 'failed' | 'expired';
  timestamp: number;
  fee: number; // in SUN (1 TRX = 1,000,000 SUN)
  energyUsed?: number;
  bandwidthUsed?: number;
  confirmations?: number;
}

export interface TronTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  ownerAddress: string;
  contractAddress: string;
  tokenType: 'TRC20' | 'TRC10' | 'TRC721';
}

export interface TronAccountInfo {
  address: string;
  balance: string; // in TRX
  energyLimit?: number;
  energyUsed?: number;
  bandwidthLimit?: number;
  bandwidthUsed?: number;
  frozenBalance?: string;
  unfrozenBalance?: string;
}

export interface TronGasFees {
  networkFee: string; // in TRX
  energyPrice: number; // SUN per energy unit
  bandwidthPrice: number; // SUN per bandwidth
  estimatedEnergyNeeded?: number;
}

export class TronIntegrationService {
  private logger = Logger.getLogger();
  private tronWeb: any;
  private rpcUrl: string;

  constructor(
    rpcUrl: string = 'https://api.trongrid.io',
    apiKey?: string
  ) {
    this.rpcUrl = rpcUrl;
    
    // Initialize TronWeb with configuration
    const config: any = {
      fullHost: rpcUrl,
      headers: apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {}
    };

    // Create TronWeb instance
    this.tronWeb = createTronWeb(config);
  }

  /**
   * Validate TRON address format
   */
  validateAddress(address: string): boolean {
    try {
      return this.tronWeb.isAddress(address);
    } catch (error) {
      this.logger.error('Failed to validate TRON address:', error);
      return false;
    }
  }

  /**
   * Validate contract/token address
   */
  async validateContractAddress(address: string): Promise<boolean> {
    try {
      if (!this.validateAddress(address)) {
        return false;
      }

      const code = await this.tronWeb.trx.getContractInfo(address);
      return !!code;
    } catch (error) {
      this.logger.error('Failed to validate contract address:', error);
      return false;
    }
  }

  /**
   * Get native TRX balance for an address
   */
  async getBalance(address: string): Promise<string> {
    try {
      if (!this.validateAddress(address)) {
        throw new AppError('Invalid TRON address', 400);
      }

      const balanceSun = await this.tronWeb.trx.getBalance(address);
      // Convert from SUN (smallest unit) to TRX
      const balanceTrx = balanceSun / 1_000_000;
      return balanceTrx.toString();
    } catch (error) {
      this.logger.error('Failed to get TRON balance:', error);
      throw new AppError('Failed to fetch balance', 500);
    }
  }

  /**
   * Get TRC20 token balance
   */
  async getTokenBalance(address: string, tokenAddress: string): Promise<string> {
    try {
      if (!this.validateAddress(address)) {
        throw new AppError('Invalid TRON address', 400);
      }

      if (!this.validateAddress(tokenAddress)) {
        throw new AppError('Invalid token address', 400);
      }

      // Get TRC20 contract
      const contract = await this.tronWeb.contract().at(tokenAddress);

      // Call balanceOf function
      const balance = await contract.balanceOf(address).call();

      return balance.toString();
    } catch (error) {
      this.logger.error('Failed to get TRC20 token balance:', error);
      throw new AppError('Failed to fetch token balance', 500);
    }
  }

  /**
   * Get detailed account information
   */
  async getAccountInfo(address: string): Promise<TronAccountInfo> {
    try {
      if (!this.validateAddress(address)) {
        throw new AppError('Invalid TRON address', 400);
      }

      const account = await this.tronWeb.trx.getAccount(address);
      const balanceSun = account.balance || 0;

      let frozenBalance = '0';
      let unfrozenBalance = balanceSun.toString();
      let energyLimit = 0;
      let energyUsed = 0;
      let bandwidthLimit = 0;
      let bandwidthUsed = 0;

      // Check for frozen resources
      if (account.frozen && account.frozen.length > 0) {
        const frozenSun = account.frozen.reduce(
          (sum: number, f: any) => sum + (f.frozen_balance || 0),
          0
        );
        frozenBalance = frozenSun.toString();
        unfrozenBalance = (balanceSun - frozenSun).toString();
      }

      // Get account resources
      if (account.account_resource) {
        const resource = account.account_resource;
        energyLimit = resource.energy_limit || 0;
        energyUsed = resource.energy_used || 0;
        bandwidthLimit = resource.latest_bandwidth_limit || 0;
        bandwidthUsed = resource.latest_bandwidth_used || 0;
      }

      return {
        address,
        balance: (balanceSun / 1_000_000).toString(),
        energyLimit,
        energyUsed,
        bandwidthLimit,
        bandwidthUsed,
        frozenBalance: (parseInt(frozenBalance) / 1_000_000).toString(),
        unfrozenBalance: (parseInt(unfrozenBalance) / 1_000_000).toString()
      };
    } catch (error) {
      this.logger.error('Failed to get account info:', error);
      throw new AppError('Failed to fetch account information', 500);
    }
  }

  /**
   * Get TRC20 token information
   */
  async getTokenInfo(tokenAddress: string): Promise<TronTokenInfo> {
    try {
      if (!this.validateAddress(tokenAddress)) {
        throw new AppError('Invalid token address', 400);
      }

      const contract = await this.tronWeb.contract().at(tokenAddress);
      const contractInfo = await this.tronWeb.trx.getContractInfo(tokenAddress);

      // Fetch token details
      let name = '';
      let symbol = '';
      let decimals = 0;
      let totalSupply = '0';

      try {
        name = await contract.name().call();
      } catch {
        name = contractInfo.contract_name || '';
      }

      try {
        symbol = await contract.symbol().call();
      } catch {
        symbol = '';
      }

      try {
        decimals = await contract.decimals().call();
      } catch {
        decimals = 6; // Default TRON decimals
      }

      try {
        totalSupply = (await contract.totalSupply().call()).toString();
      } catch {
        totalSupply = '0';
      }

      return {
        address: tokenAddress,
        name,
        symbol,
        decimals: parseInt(decimals.toString()),
        totalSupply,
        ownerAddress: contractInfo.owner_address || '',
        contractAddress: tokenAddress,
        tokenType: 'TRC20'
      };
    } catch (error) {
      this.logger.error('Failed to get token info:', error);
      throw new AppError('Failed to fetch token information', 500);
    }
  }

  /**
   * Get token supply
   */
  async getTokenSupply(tokenAddress: string): Promise<string> {
    try {
      if (!this.validateAddress(tokenAddress)) {
        throw new AppError('Invalid token address', 400);
      }

      const contract = await this.tronWeb.contract().at(tokenAddress);
      const supply = await contract.totalSupply().call();

      return supply.toString();
    } catch (error) {
      this.logger.error('Failed to get token supply:', error);
      throw new AppError('Failed to fetch token supply', 500);
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateFees(): Promise<TronGasFees> {
    try {
      // TRON has fixed network fees for basic operations
      // Network fee: ~0.1 TRX for standard transactions
      const networkFee = 0.1; // TRX

      // Energy pricing (typically 50 SUN per energy in 2024-2026)
      const energyPrice = 50; // SUN

      // Bandwidth pricing (typically 1 SUN per byte)
      const bandwidthPrice = 1; // SUN per byte

      // Estimated energy for a standard TRC20 transfer is ~25,000 energy
      const estimatedEnergyNeeded = 25000;

      return {
        networkFee: networkFee.toString(),
        energyPrice,
        bandwidthPrice,
        estimatedEnergyNeeded
      };
    } catch (error) {
      this.logger.error('Failed to estimate fees:', error);
      // Return default fees on error
      return {
        networkFee: '0.1',
        energyPrice: 50,
        bandwidthPrice: 1,
        estimatedEnergyNeeded: 25000
      };
    }
  }

  /**
   * Get transaction status and details
   */
  async getTransactionStatus(txid: string): Promise<TronTransactionStatus> {
    try {
      const tx = await this.tronWeb.trx.getTransaction(txid);

      if (!tx) {
        throw new AppError('Transaction not found', 404);
      }

      const txInfo = await this.tronWeb.trx.getTransactionInfo(txid);

      const fee = tx.raw_data?.fee || txInfo.fee || 0;
      const energyUsed = txInfo.receipt?.energy_usage || 0;
      const bandwidthUsed = txInfo.receipt?.net_usage || 0;

      // Determine status
      let status: 'pending' | 'confirmed' | 'failed' | 'expired' = 'pending';
      if (txInfo.receipt?.result === 'SUCCESS' || txInfo.receipt?.result === 'SUCESS') {
        status = 'confirmed';
      } else if (txInfo.receipt?.result === 'FAILED') {
        status = 'failed';
      } else if (!txInfo.blockNumber) {
        status = 'pending';
      }

      return {
        txid,
        status,
        timestamp: tx.raw_data?.timestamp || Date.now(),
        fee: fee / 1_000_000, // Convert SUN to TRX
        energyUsed,
        bandwidthUsed,
        confirmations: txInfo.blockNumber ? 1 : 0
      };
    } catch (error) {
      this.logger.error('Failed to get transaction status:', error);
      throw new AppError('Failed to fetch transaction status', 500);
    }
  }

  /**
   * Get recent transactions for an address
   */
  async getRecentTransactions(
    address: string,
    limit: number = 10
  ): Promise<TronTransactionStatus[]> {
    try {
      if (!this.validateAddress(address)) {
        throw new AppError('Invalid TRON address', 400);
      }

      // Limit to max 200 per TRON API
      const maxLimit = Math.min(limit, 200);

      const transactions = await this.tronWeb.trx.getTransactionsByTimestamp(
        address,
        0,
        Date.now()
      );

      // Get detailed status for each transaction
      const results = await Promise.all(
        transactions.slice(0, maxLimit).map((tx: any) => 
          this.getTransactionStatus((tx as any).txID || (tx as any).hash)
            .catch(() => null)
        )
      );

      return results.filter((tx: TronTransactionStatus | null): tx is TronTransactionStatus => tx !== null);
    } catch (error) {
      this.logger.error('Failed to get recent transactions:', error);
      throw new AppError('Failed to fetch transactions', 500);
    }
  }

  /**
   * Validate transfer amount
   */
  validateTransferAmount(amount: string, decimals: number): boolean {
    try {
      const parsed = parseFloat(amount);
      if (parsed <= 0) return false;

      // Check if amount doesn't exceed token decimals precision
      const decimalPlaces = (amount.split('.')[1] || '').length;
      return decimalPlaces <= decimals;
    } catch {
      return false;
    }
  }

  /**
   * Convert UI amount to on-chain amount (considering decimals)
   */
  uiAmountToOnChain(uiAmount: string, decimals: number): string {
    const amount = parseFloat(uiAmount);
    const onChainAmount = Math.floor(amount * Math.pow(10, decimals));
    return onChainAmount.toString();
  }

  /**
   * Convert on-chain amount to UI amount
   */
  onChainToUiAmount(onChainAmount: string, decimals: number): string {
    const amount = parseInt(onChainAmount) / Math.pow(10, decimals);
    return amount.toString();
  }

  /**
   * Check if address has sufficient balance for transaction
   */
  async hassufficientBalance(
    address: string,
    requiredAmount: string,
    tokenAddress?: string
  ): Promise<boolean> {
    try {
      if (tokenAddress) {
        // Check TRC20 balance
        const balance = await this.getTokenBalance(address, tokenAddress);
        return parseFloat(balance) >= parseFloat(requiredAmount);
      } else {
        // Check native TRX balance
        const balance = await this.getBalance(address);
        return parseFloat(balance) >= parseFloat(requiredAmount);
      }
    } catch (error) {
      this.logger.error('Failed to check balance sufficiency:', error);
      return false;
    }
  }

  /**
   * Convert address format (hex to base58 or vice versa)
   */
  convertAddress(address: string): string {
    try {
      // If it's hex, convert to base58
      if (address.startsWith('0x') || address.startsWith('41')) {
        return this.tronWeb.address.fromHex(address);
      }
      // If it's base58, convert to hex
      return this.tronWeb.address.toHex(address);
    } catch (error) {
      this.logger.error('Failed to convert address:', error);
      throw new AppError('Invalid address format', 400);
    }
  }

  /**
   * Get nonce/sequence number for an address (for transaction ordering)
   */
  async getNonce(address: string): Promise<number> {
    try {
      if (!this.validateAddress(address)) {
        throw new AppError('Invalid TRON address', 400);
      }

      // TRON doesn't use nonce like Ethereum, but we can track transaction count
      const transactions = await this.tronWeb.trx.getTransactionsByTimestamp(
        address,
        0,
        Date.now()
      );

      return transactions.length;
    } catch (error) {
      this.logger.error('Failed to get nonce:', error);
      throw new AppError('Failed to fetch nonce', 500);
    }
  }

  /**
   * Check if account is activated (has at least been created on-chain)
   */
  async isAccountActivated(address: string): Promise<boolean> {
    try {
      if (!this.validateAddress(address)) {
        throw new AppError('Invalid TRON address', 400);
      }

      const account = await this.tronWeb.trx.getAccount(address);
      // Account is activated if it exists and has an account_name or has had any transactions
      return !!(account && (account.account_name || account.balance || account.create_time));
    } catch (error) {
      this.logger.error('Failed to check account activation:', error);
      return false;
    }
  }

  /**
   * Get current network chain parameters
   */
  async getChainParameters(): Promise<{
    chainId: number;
    blockTime: number;
    transactionFee: number;
  }> {
    try {
      const chainParameters = await this.tronWeb.trx.getChainParameters();

      let transactionFee = 0;
      let blockTime = 3; // Default 3 second block time

      // Parse chain parameters
      if (Array.isArray(chainParameters)) {
        const transactionFeeParam = chainParameters.find(
          (p: any) => p.key === 'getTransactionFee'
        );
        const blockTimeParam = chainParameters.find(
          (p: any) => p.key === 'getBlockProducedTimeoutNum'
        );

        if (transactionFeeParam) {
          transactionFee = transactionFeeParam.value;
        }
        if (blockTimeParam) {
          blockTime = blockTimeParam.value;
        }
      }

      return {
        chainId: 0, // TRON mainnet is 0
        blockTime,
        transactionFee
      };
    } catch (error) {
      this.logger.error('Failed to get chain parameters:', error);
      return {
        chainId: 0,
        blockTime: 3,
        transactionFee: 0.1
      };
    }
  }
}

// Export singleton instances for mainnet and testnet
export const tronIntegrationService = new TronIntegrationService(
  process.env.TRON_RPC_URL || 'https://api.trongrid.io',
  process.env.TRON_API_KEY
);

export const tronTestnetService = new TronIntegrationService(
  process.env.TRON_TESTNET_RPC_URL || 'https://api.shasta.trongrid.io',
  process.env.TRON_TESTNET_API_KEY
);
