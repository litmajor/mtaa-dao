/**
 * Agent Wallet Service - Wallet Operations Module
 * 
 * Handles wallet transactions: sending tokens, approvals, transfers, batch operations
 */

import Web3 from 'web3';
import { isAddress } from 'web3-validator';
import type { TransactionResult, GasConfig, TokenInfo } from './types';
import { ENHANCED_ERC20_ABI } from './erc20-abi';

/**
 * WalletOperationsService - Handles all wallet transaction operations
 */
export class WalletOperationsService {
  private web3: Web3;
  private account: any;
  private chainId: number;
  private transactionCache: Map<string, TransactionResult> = new Map();

  constructor(web3: Web3, account: any, chainId: number) {
    this.web3 = web3;
    this.account = account;
    this.chainId = chainId;
  }

  /**
   * Approve a spender to spend tokens
   */
  async approveToken(
    tokenAddress: string,
    spender: string,
    amount: number,
    gasConfig?: GasConfig,
    getTokenInfo?: (addr: string) => Promise<TokenInfo>,
    getOptimalGasConfig?: () => Promise<GasConfig>,
    estimateGasWithBuffer?: (tx: any) => Promise<number>
  ): Promise<TransactionResult> {
    if (!isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    if (!isAddress(spender)) {
      throw new Error('Invalid spender address');
    }

    try {
      const tokenInfo = await (getTokenInfo?.(tokenAddress) || { decimals: 18 } as any);
      const amountWei = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals || 18)));
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || (await getOptimalGasConfig?.()) || {};

      const transaction: any = {
        to: tokenAddress,
        data: contract.methods.approve(spender, amountWei.toString()).encodeABI(),
        chainId: this.chainId,
        gas: 100000,
        nonce: Number(nonce),
        ...optimalGasConfig
      };

      transaction.gas = (await estimateGasWithBuffer?.(transaction)) || 100000;

      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction!);

      console.log(`Token approval sent: ${txHash.transactionHash}`);

      const result: TransactionResult = {
        hash: typeof txHash.transactionHash === 'string' ? txHash.transactionHash : '',
        status: 'pending',
        timestamp: Date.now()
      };

      this.transactionCache.set(result.hash, result);
      return result;
    } catch (error) {
      console.error('Token approval failed:', error);
      throw new Error(`Token approval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send native tokens (ETH/CELO)
   */
  async sendNativeToken(
    toAddress: string,
    amountEth: number,
    gasConfig?: GasConfig,
    getBalance?: () => Promise<bigint>,
    getOptimalGasConfig?: () => Promise<GasConfig>
  ): Promise<TransactionResult> {
    if (!isAddress(toAddress)) {
      throw new Error('Invalid recipient address');
    }

    const amountWei = this.web3.utils.toWei(amountEth.toString(), 'ether');

    // Check balance
    const balance = await (getBalance?.() || BigInt(0));
    if (balance < BigInt(amountWei)) {
      const balanceEth = this.web3.utils.fromWei(balance.toString(), 'ether');
      throw new Error(`Insufficient balance. Have ${balanceEth} ETH, need ${amountEth}`);
    }

    try {
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || (await getOptimalGasConfig?.()) || {};

      const transaction: any = {
        to: toAddress,
        value: amountWei,
        gas: 21000,
        nonce: Number(nonce),
        chainId: this.chainId,
        ...optimalGasConfig
      };

      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction!);

      console.log(`Native token transfer sent: ${txHash.transactionHash}`);

      const result: TransactionResult = {
        hash: typeof txHash.transactionHash === 'string' ? txHash.transactionHash : '',
        status: 'pending',
        timestamp: Date.now()
      };

      this.transactionCache.set(result.hash, result);
      return result;
    } catch (error) {
      console.error('Native token transfer failed:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send ERC-20 tokens (human-readable amounts)
   */
  async sendTokenHuman(
    tokenAddress: string,
    toAddress: string,
    amount: number,
    gasConfig?: GasConfig,
    getTokenInfo?: (addr: string) => Promise<TokenInfo>,
    getOptimalGasConfig?: () => Promise<GasConfig>,
    estimateGasWithBuffer?: (tx: any) => Promise<number>
  ): Promise<TransactionResult> {
    if (!isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    if (!isAddress(toAddress)) {
      throw new Error('Invalid recipient address');
    }

    try {
      const tokenInfo = await (getTokenInfo?.(tokenAddress) || { decimals: 18, balance: '0', balanceFormatted: 0 } as any);
      const amountWei = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals || 18)));

      if (BigInt(tokenInfo.balance || 0) < amountWei) {
        throw new Error(
          `Insufficient token balance. Have ${tokenInfo.balanceFormatted?.toFixed(6) || '0'} ${tokenInfo.symbol || 'tokens'}, need ${amount}`
        );
      }

      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || (await getOptimalGasConfig?.()) || {};

      const transaction: any = {
        to: tokenAddress,
        data: contract.methods.transfer(toAddress, amountWei.toString()).encodeABI(),
        chainId: this.chainId,
        gas: 100000,
        nonce: Number(nonce),
        ...optimalGasConfig
      };

      transaction.gas = (await estimateGasWithBuffer?.(transaction)) || 100000;

      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction!);

      console.log(`Token transfer sent: ${txHash.transactionHash}`);

      const result: TransactionResult = {
        hash: typeof txHash.transactionHash === 'string' ? txHash.transactionHash : '',
        status: 'pending',
        timestamp: Date.now()
      };

      this.transactionCache.set(result.hash, result);
      return result;
    } catch (error) {
      console.error('Token transfer failed:', error);
      throw new Error(`Token transfer failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Batch transfer multiple recipients
   */
  async batchTransfer(
    transfers: Array<{
      tokenAddress?: string;
      toAddress: string;
      amount: number;
    }>,
    sendNativeToken?: (to: string, amount: number) => Promise<TransactionResult>,
    sendTokenHuman?: (token: string, to: string, amount: number) => Promise<TransactionResult>
  ): Promise<TransactionResult[]> {
    const results: TransactionResult[] = [];

    for (const transfer of transfers) {
      try {
        let result: TransactionResult;
        if (transfer.tokenAddress) {
          result = await (sendTokenHuman?.(transfer.tokenAddress, transfer.toAddress, transfer.amount) || { hash: '', status: 'failed' as const, timestamp: Date.now() });
        } else {
          result = await (sendNativeToken?.(transfer.toAddress, transfer.amount) || { hash: '', status: 'failed' as const, timestamp: Date.now() });
        }
        results.push(result);

        // Small delay between transactions to avoid nonce issues
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Batch transfer failed for ${transfer.toAddress}:`, error);
        results.push({
          hash: '',
          status: 'failed',
          errorReason: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        });
      }
    }

    return results;
  }

  /**
   * Get transaction cache
   */
  getTransactionCache(): Map<string, TransactionResult> {
    return this.transactionCache;
  }

  /**
   * Clear transaction cache
   */
  clearTransactionCache(): void {
    this.transactionCache.clear();
  }
}

// Export singleton instance creator
export const createWalletOperationsService = (web3: Web3, account: any, chainId: number): WalletOperationsService => {
  return new WalletOperationsService(web3, account, chainId);
};
