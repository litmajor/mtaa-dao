import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
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
  status: 'processed' | 'confirmed' | 'finalized' | 'failed';
  timestamp?: number;
  fee: number; // in lamports
}

export interface SolanaTokenInfo {
  mint: string;
  decimals: number;
  totalSupply: string;
}

export class SolanaIntegrationService {
  private logger = Logger.getLogger();
  private connection: Connection;

  constructor(rpcUrl: string = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com') {
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

      if (mintInfo.value.data.parsed.type !== 'mint') {
        throw new AppError('Address is not an SPL token mint', 400);
      }
      const data = mintInfo.value.data.parsed.info;
      const supply = await this.connection.getTokenSupply(mintPublicKey, 'confirmed');

      return {
        mint: tokenMint,
        decimals: data.decimals,
        totalSupply: supply.value.amount,
      };
    } catch (error) {
      this.logger.error('Failed to get Solana token info:', error);
      if (error instanceof AppError) throw error;
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
      return formatBaseUnits(BigInt(balance), 9);
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
        return '0';
      }

      const tokenAccountInfo = tokenAccount.value.data.parsed.info;
      if (tokenAccount.value.data.parsed.type !== 'account' || tokenAccountInfo.mint !== tokenMint || tokenAccountInfo.owner !== address) {
        throw new AppError('RPC returned a token account that does not match the requested owner and mint', 503);
      }
      const tokenAmount = tokenAccountInfo.tokenAmount;
      if (!Number.isInteger(tokenAmount.decimals) || tokenAmount.amount === undefined) {
        throw new AppError('RPC returned incomplete SPL token balance data', 503);
      }
      return formatBaseUnits(BigInt(tokenAmount.amount), tokenAmount.decimals);
    } catch (error) {
      this.logger.error('Failed to get SPL token balance:', error);
      throw new AppError('Failed to fetch token balance', 500);
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateFees(address: string): Promise<{ networkFee: string }> {
    try {
      const feePayer = new PublicKey(address);
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      const message = new Transaction({ feePayer, recentBlockhash: blockhash })
        .add(SystemProgram.transfer({ fromPubkey: feePayer, toPubkey: feePayer, lamports: 1 }))
        .compileMessage();
      const fee = await this.connection.getFeeForMessage(message, 'confirmed');
      if (fee.value === null) throw new AppError('Solana RPC could not estimate the transfer fee', 503);

      return {
        networkFee: (fee.value / 1e9).toFixed(9),
      };
    } catch (error) {
      this.logger.error('Failed to estimate Solana fees:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to estimate Solana fees from the configured RPC', 503);
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
    let mintPublicKey: PublicKey;
    try {
      mintPublicKey = new PublicKey(mint);
    } catch {
      return false;
    }

    try {
      const mintInfo = await this.connection.getParsedAccountInfo(mintPublicKey, 'confirmed');
      return !!(
        mintInfo.value &&
        'parsed' in mintInfo.value.data &&
        mintInfo.value.data.parsed.type === 'mint'
      );
    } catch (error) {
      this.logger.error('Failed to validate SPL mint against Solana RPC:', error);
      throw new AppError('Solana RPC unavailable while validating token mint', 503);
    }
  }

  /**
   * Get token supply
   */
  async getTokenSupply(tokenMint: string): Promise<string> {
    try {
      const tokenMintPublicKey = new PublicKey(tokenMint);
      const supplyInfo = await this.connection.getTokenSupply(tokenMintPublicKey);
      return supplyInfo.value.amount;
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
      const status = tx.meta?.err ? 'failed' : 'finalized';

      return {
        signature,
        status,
        timestamp: tx.blockTime ?? undefined,
        fee,
      };
    } catch (error) {
      this.logger.error('Failed to get transaction status:', error);
      if (error instanceof AppError) throw error;
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
export const solanaDevnetIntegrationService = new SolanaIntegrationService(
  process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com'
);

function formatBaseUnits(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
