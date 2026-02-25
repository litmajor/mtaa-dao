import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface SolanaTransferRequest {
  fromAddress: string;
  toAddress: string;
  tokenMint: string; // Token contract address (mint)
  amount: string;
  decimals: number;
}

export interface SolanaTransactionStatus {
  signature: string;
  status: 'confirmed' | 'finalized' | 'failed';
  timestamp: number;
  fee: number; // in lamports
}

export interface SolanaTokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
}

export class SolanaIntegrationService {
  private logger = Logger.getLogger();
  private connection: Connection;

  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com') {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Get token information from Solana
   */
  async getTokenInfo(tokenMint: string): Promise<SolanaTokenInfo> {
    try {
      const mintPublicKey = new PublicKey(tokenMint);
      const mintInfo = await this.connection.getParsedAccountInfo(mintPublicKey);

      if (!mintInfo.value || !('parsed' in mintInfo.value.data)) {
        throw new AppError('Invalid token mint', 400);
      }

      const data = mintInfo.value.data.parsed.info;

      return {
        mint: tokenMint,
        symbol: '', // Solana doesn't store symbol on-chain, requires external data
        name: '',
        decimals: data.decimals,
        totalSupply: data.supply
      };
    } catch (error) {
      this.logger.error('Failed to get Solana token info:', error);
      throw new AppError('Failed to fetch token information', 500);
    }
  }

  /**
   * Get SOL balance for an address
   */
  async getBalance(address: string): Promise<string> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return (balance / 1e9).toString(); // Convert lamports to SOL
    } catch (error) {
      this.logger.error('Failed to get Solana balance:', error);
      throw new AppError('Failed to fetch balance', 500);
    }
  }

  /**
   * Get SPL token balance for an address
   */
  async getTokenBalance(address: string, tokenMint: string): Promise<string> {
    try {
      const ownerPublicKey = new PublicKey(address);
      const tokenMintPublicKey = new PublicKey(tokenMint);

      // Get associated token account
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        ownerPublicKey
      );

      const tokenAccount = await this.connection.getParsedAccountInfo(associatedTokenAddress);

      if (!tokenAccount.value || !('parsed' in tokenAccount.value.data)) {
        return '0'; // Account doesn't exist
      }

      const tokenBalance = tokenAccount.value.data.parsed.info.tokenAmount.uiAmount;
      return tokenBalance.toString();
    } catch (error) {
      this.logger.error('Failed to get SPL token balance:', error);
      throw new AppError('Failed to fetch token balance', 500);
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateFees(): Promise<{ networkFee: string; priorityFee: string }> {
    try {
      const recentBlockhash = await this.connection.getLatestBlockhash('confirmed');
      const feeCalculator = await this.connection.getFeeForMessage(
        Transaction.from(Buffer.from([]))
      );

      // Solana base fee is usually 5000 lamports
      const baseNetworkFee = recentBlockhash.feeCalculator?.lamportsPerSignature || 5000;
      const priorityFee = 1000; // Optional additional fee

      return {
        networkFee: (baseNetworkFee / 1e9).toFixed(9), // Convert to SOL
        priorityFee: (priorityFee / 1e9).toFixed(9)
      };
    } catch (error) {
      this.logger.error('Failed to estimate Solana fees:', error);
      // Return default fees on error
      return {
        networkFee: '0.000005', // ~5000 lamports
        priorityFee: '0.000001'
      };
    }
  }

  /**
   * Validate Solana address format
   */
  validateAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate token mint address
   */
  async validateTokenMint(mint: string): Promise<boolean> {
    try {
      const mintPublicKey = new PublicKey(mint);
      const mintInfo = await this.connection.getParsedAccountInfo(mintPublicKey);
      return !!(mintInfo.value && 'parsed' in mintInfo.value.data);
    } catch {
      return false;
    }
  }

  /**
   * Get token supply
   */
  async getTokenSupply(tokenMint: string): Promise<string> {
    try {
      const tokenMintPublicKey = new PublicKey(tokenMint);
      const supplyInfo = await this.connection.getTokenSupply(tokenMintPublicKey);
      return supplyInfo.value.uiAmount?.toString() || '0';
    } catch (error) {
      this.logger.error('Failed to get token supply:', error);
      throw new AppError('Failed to fetch token supply', 500);
    }
  }

  /**
   * Get transaction details and status
   */
  async getTransactionStatus(signature: string): Promise<SolanaTransactionStatus> {
    try {
      const tx = await this.connection.getParsedTransaction(signature, 'finalized');

      if (!tx) {
        throw new AppError('Transaction not found', 404);
      }

      const fee = tx.meta?.fee || 0;
      const status = tx.meta?.err ? 'failed' : (tx.blockTime ? 'finalized' : 'confirmed');

      return {
        signature,
        status: status as 'confirmed' | 'finalized' | 'failed',
        timestamp: tx.blockTime || Date.now() / 1000,
        fee
      };
    } catch (error) {
      this.logger.error('Failed to get transaction status:', error);
      throw new AppError('Failed to fetch transaction status', 500);
    }
  }

  /**
   * Get recent transactions for an address
   */
  async getRecentTransactions(address: string, limit: number = 10): Promise<any[]> {
    try {
      const publicKey = new PublicKey(address);
      const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit });

      const transactions = await Promise.all(
        signatures.map(sig => this.connection.getParsedTransaction(sig.signature, 'confirmed'))
      );

      return transactions.filter(tx => tx !== null);
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
}

// Export singleton instance
export const solanaIntegrationService = new SolanaIntegrationService();
