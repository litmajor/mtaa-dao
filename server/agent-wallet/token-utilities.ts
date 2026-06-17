/**
 * Agent Wallet Service - Token Utilities Module
 * 
 * Handles token information retrieval, balance checking, and token metadata
 */

import Web3 from 'web3';
type Web3Type = InstanceType<typeof Web3>;
import { isAddress } from 'web3-validator';
import type { TokenInfo, TokenBalance } from './types';
import { ENHANCED_ERC20_ABI } from './erc20-abi';

/**
 * TokenUtilitiesService - Manages token information and balance operations
 */
export class TokenUtilitiesService {
  private web3: Web3Type;
  private tokenCache: Map<string, TokenInfo> = new Map();
  private balanceCache: Map<string, Map<string, TokenBalance>> = new Map();

  constructor(web3: Web3Type) {
    this.web3 = web3;
  }

  /**
   * Get token information (name, symbol, decimals, etc)
   */
  async getTokenInfo(
    tokenAddress: string,
    accountAddress?: string
  ): Promise<TokenInfo> {
    // Check cache first
    const cacheKey = `${tokenAddress}-${accountAddress || 'general'}`;
    if (this.tokenCache.has(cacheKey)) {
      return this.tokenCache.get(cacheKey)!;
    }

    if (!isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }

    try {
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);

      // Fetch token metadata in parallel
      const [name, symbol, decimals] = await Promise.all([
        (contract.methods as any).name().call().catch(() => 'Unknown'),
        (contract.methods as any).symbol().call().catch(() => 'UNKNOWN'),
        (contract.methods as any).decimals().call().catch(() => '18')
      ]);

      const tokenInfo: TokenInfo = {
        address: tokenAddress,
        name: String(name || 'Unknown'),
        symbol: String(symbol || 'UNKNOWN'),
        decimals: Number(decimals || 18),
        balance: '0'
      };

      // Fetch balance if account is provided
      if (accountAddress && isAddress(accountAddress)) {
        try {
          const balance = await (contract.methods as any).balanceOf(accountAddress).call();
          const balanceBigInt = BigInt(String(balance ?? '0'));
          const balanceFormatted = Number(balanceBigInt) / Math.pow(10, tokenInfo.decimals);

          tokenInfo.balance = balance.toString();
          tokenInfo.balanceFormatted = balanceFormatted;
        } catch (error) {
          console.warn(`Could not fetch balance for ${tokenAddress}:`, error);
        }
      }

      // Cache the result
      this.tokenCache.set(cacheKey, tokenInfo);
      return tokenInfo;
    } catch (error) {
      console.error(`Failed to get token info for ${tokenAddress}:`, error);
      throw new Error(`Failed to fetch token info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get balance of a token for an account
   */
  async getTokenBalance(
    tokenAddress: string,
    accountAddress: string
  ): Promise<TokenBalance> {
    if (!isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    if (!isAddress(accountAddress)) {
      throw new Error('Invalid account address');
    }

    // Check cache
    if (!this.balanceCache.has(accountAddress)) {
      this.balanceCache.set(accountAddress, new Map());
    }
    const accountBalances = this.balanceCache.get(accountAddress)!;
    if (accountBalances.has(tokenAddress)) {
      return accountBalances.get(tokenAddress)!;
    }

    try {
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const [balance, decimals, symbol] = await Promise.all([
        (contract.methods as any).balanceOf(accountAddress).call(),
        (contract.methods as any).decimals().call().catch(() => '18'),
        (contract.methods as any).symbol().call().catch(() => 'UNKNOWN')
      ]);

      const balanceBigInt = BigInt(String(balance ?? '0'));
      const decimalsNum = Number(decimals || 18);
      const balanceFormatted = Number(balanceBigInt) / Math.pow(10, decimalsNum);

      const tokenBalance: TokenBalance = {
        address: tokenAddress,
        balance: balance.toString(),
        balanceFormatted,
        symbol: String(symbol || 'UNKNOWN')
      };

      accountBalances.set(tokenAddress, tokenBalance);
      return tokenBalance;
    } catch (error) {
      console.error(`Failed to get token balance for ${tokenAddress}:`, error);
      throw new Error(
        `Failed to fetch token balance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get balances of multiple tokens for an account
   */
  async getMultipleTokenBalances(
    tokenAddresses: string[],
    accountAddress: string
  ): Promise<TokenBalance[]> {
    if (!isAddress(accountAddress)) {
      throw new Error('Invalid account address');
    }

    const balances = await Promise.all(
      tokenAddresses.map(tokenAddr => this.getTokenBalance(tokenAddr, accountAddress))
    );

    return balances;
  }

  /**
   * Check if an address is a valid ERC-20 contract
   */
  async isValidERC20Contract(contractAddress: string): Promise<boolean> {
    if (!isAddress(contractAddress)) {
      return false;
    }

    try {
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, contractAddress);
      // Try to call a read-only method
      const symbol = await (contract.methods as any).symbol().call();
      return typeof symbol === 'string';
    } catch {
      return false;
    }
  }

  /**
   * Get allowance for a spender
   */
  async getAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<string> {
    if (!isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    if (!isAddress(ownerAddress)) {
      throw new Error('Invalid owner address');
    }
    if (!isAddress(spenderAddress)) {
      throw new Error('Invalid spender address');
    }

    try {
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const allowance = await (contract.methods as any).allowance(ownerAddress, spenderAddress).call();
      return allowance.toString();
    } catch (error) {
      console.error('Failed to get allowance:', error);
      throw new Error(`Failed to fetch allowance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if token needs approval
   */
  async needsApproval(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    requiredAmount: number
  ): Promise<boolean> {
    try {
      const allowance = await this.getAllowance(tokenAddress, ownerAddress, spenderAddress);
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      const requiredAmountWei = BigInt(Math.floor(requiredAmount * Math.pow(10, tokenInfo.decimals)));

      return BigInt(allowance) < requiredAmountWei;
    } catch (error) {
      console.error('Failed to check approval:', error);
      return true; // Assume approval is needed if we can't check
    }
  }

  /**
   * Clear token cache
   */
  clearTokenCache(): void {
    this.tokenCache.clear();
    this.balanceCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { tokensCached: number; accountsCached: number } {
    return {
      tokensCached: this.tokenCache.size,
      accountsCached: this.balanceCache.size
    };
  }
}

// Export singleton instance creator
export const createTokenUtilitiesService = (web3: Web3Type): TokenUtilitiesService => {
  return new TokenUtilitiesService(web3);
};
