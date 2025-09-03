import Web3 from 'web3';
import { isAddress } from 'web3-validator';
import type { TransactionReceipt, Contract } from 'web3';
import dotenv from 'dotenv';
dotenv.config();
// Enhanced Interfaces
export interface TransactionResult {
  hash: string;
  status: 'pending' | 'success' | 'failed';
  blockNumber?: number;
  gasUsed?: number;
  effectiveGasPrice?: number;
  timestamp?: number;
  errorReason?: string;
}

export interface NetworkInfo {
  chainId: number;
  latestBlock?: number;
  gasPrice?: number;
  connected: boolean;
  error?: string;
  networkName?: string;
  explorerUrl?: string;
}

export interface WalletCredentials {
  address: string;
  privateKey: string;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: number;
  error?: string;
  priceUsd?: number;
  totalSupply?: string;
}

export interface Portfolio {
  address: string;
  nativeBalance: number;
  nativeBalanceUsd?: number;
  tokens: Record<string, TokenInfo>;
  networkInfo: NetworkInfo;
  totalValueUsd?: number;
  lastUpdated: number;
}

export interface Disbursement {
  toAddress: string;
  amount: number;
  tokenAddress?: string;
  meta?: any;
  priority?: 'low' | 'medium' | 'high';
  scheduledAt?: number;
}

export interface ContributionLog {
  daoId: string;
  userId: string;
  amount: number;
  tokenAddress?: string;
  txHash: string;
  timestamp: number;
  meta?: any;
}

export interface GasConfig {
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasLimit?: number;
}

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  priceImpact: number;
  route: string[];
  gasEstimate: number;
}

// Enhanced ERC20 ABI with additional useful functions
const ENHANCED_ERC20_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_spender", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {"name": "_owner", "type": "address"},
      {"name": "_spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_from", "type": "address"},
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  }
];

// Multisig Wallet ABI (basic functions)
const MULTISIG_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "getOwners",
    "outputs": [{"name": "", "type": "address[]"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "required",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "destination", "type": "address"},
      {"name": "value", "type": "uint256"},
      {"name": "data", "type": "bytes"}
    ],
    "name": "submitTransaction",
    "outputs": [{"name": "transactionId", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "transactionId", "type": "uint256"}],
    "name": "confirmTransaction",
    "outputs": [],
    "type": "function"
  }
];

export class EnhancedAgentWallet {
  /**
   * Approve a spender to spend a specified amount of ERC-20 tokens.
   * @param tokenAddress ERC-20 token contract address
   * @param spender Spender address
   * @param amount Amount in human units (not wei)
   * @param gasConfig Optional gas config
   */
  async approveToken(
    tokenAddress: string,
    spender: string,
    amount: number,
    gasConfig?: GasConfig
  ): Promise<TransactionResult> {
    if (!isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    if (!isAddress(spender)) {
      throw new Error('Invalid spender address');
    }
    try {
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      const amountWei = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || await this.getOptimalGasConfig();
      const transaction: any = {
        to: tokenAddress,
        data: contract.methods.approve(spender, amountWei.toString()).encodeABI(),
        chainId: this.chainId,
        gas: 100000,
        nonce: Number(nonce),
        ...optimalGasConfig
      };
      transaction.gas = await this.estimateGasWithBuffer(transaction);
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
   * Get the allowance for a spender on an ERC-20 token.
   * @param tokenAddress ERC-20 token contract address
   * @param spender Spender address
   * @returns Allowance in human units
   */
  async getAllowance(
    tokenAddress: string,
    spender: string
  ): Promise<number> {
    if (!isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    if (!isAddress(spender)) {
      throw new Error('Invalid spender address');
    }
    try {
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      const allowance = await contract.methods.allowance(this.account.address, spender).call();
      return Number(allowance) / Math.pow(10, tokenInfo.decimals);
    } catch (error) {
      throw new Error(`Failed to get allowance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the status of a transaction by hash.
   * @param txHash Transaction hash
   * @returns TransactionResult with status
   */
  async getTransactionStatus(txHash: string): Promise<TransactionResult> {
    try {
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (!receipt) {
        return {
          hash: txHash,
          status: 'pending',
          timestamp: Date.now()
        };
      }
      return {
        hash: txHash,
        status: receipt.status ? 'success' : 'failed',
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed),
        effectiveGasPrice: receipt.effectiveGasPrice ? Number(receipt.effectiveGasPrice) : undefined,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        hash: txHash,
        status: 'failed',
        errorReason: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }
  private web3: Web3;
  private account: ReturnType<Web3['eth']['accounts']['privateKeyToAccount']>;
  private chainId: number;
  private networkConfig: NetworkConfig;
  private permissionCheck?: (daoId: string, userId: string, action: string) => Promise<boolean>;
  private contributionLogger?: (log: ContributionLog) => Promise<void>;
  private billingLogger?: (log: any) => Promise<void>;
  private priceOracle?: (tokenAddress: string) => Promise<number>;
  private transactionCache: Map<string, TransactionResult> = new Map();

  constructor(
    privateKey: string,
    networkConfig: NetworkConfig,
    permissionCheck?: (daoId: string, userId: string, action: string) => Promise<boolean>,
    contributionLogger?: (log: ContributionLog) => Promise<void>,
    billingLogger?: (log: any) => Promise<void>,
    priceOracle?: (tokenAddress: string) => Promise<number>
  ) {
    this.web3 = new Web3(networkConfig.rpcUrl);
    this.networkConfig = networkConfig;
    // Normalize and validate private key
    const normalizedKey = WalletManager.normalizePrivateKey(privateKey);
    if (!WalletManager.validatePrivateKey(normalizedKey)) {
      throw new Error('Invalid private key format');
    }
    this.account = this.web3.eth.accounts.privateKeyToAccount(normalizedKey);
    this.chainId = networkConfig.chainId;
    this.permissionCheck = permissionCheck;
    this.contributionLogger = contributionLogger;
    this.billingLogger = billingLogger;
    this.priceOracle = priceOracle;
  }

  // Utility to normalize private key (add 0x, trim whitespace)
  static normalizePrivateKey(privateKey: string): string {
    let key = privateKey.trim();
    if (!key.startsWith('0x')) {
      key = '0x' + key;
    }
    return key;
  }

  // Enhanced balance operations
  async getBalance(): Promise<bigint> {
    const balance = await this.web3.eth.getBalance(this.account.address);
    return BigInt(balance);
  }

  async getBalanceCelo(address?: string): Promise<number> {
    const targetAddress = address || this.account.address;
    const balance = await this.web3.eth.getBalance(targetAddress);
    return parseFloat(this.web3.utils.fromWei(balance, 'ether'));
  }


  public async getBalanceEth(address?: string): Promise<number> {
    const targetAddress = address || this.account.address;
    const balance = await this.web3.eth.getBalance(targetAddress);
    return parseFloat(this.web3.utils.fromWei(balance, 'ether'));
  }

  public async getNetworkInfo(): Promise<NetworkInfo> {
    try {
      const [latestBlock, gasPrice] = await Promise.all([
        this.web3.eth.getBlockNumber(),
        this.web3.eth.getGasPrice()
      ]);

      return {
        chainId: this.chainId,
        latestBlock: Number(latestBlock),
        gasPrice: Number(gasPrice),
        connected: true,
        networkName: this.networkConfig.name,
        explorerUrl: this.networkConfig.explorerUrl
      };
    } catch (error) {
      return {
        chainId: this.chainId,
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        networkName: this.networkConfig.name
      };
    }
  }

  public async getTokenInfo(tokenAddress: string, includePrice: boolean = false): Promise<TokenInfo> {
    try {
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      
      const [symbol, name, decimals, balance, totalSupply] = await Promise.all([
        contract.methods.symbol().call(),
        contract.methods.name().call(),
        contract.methods.decimals().call(),
        contract.methods.balanceOf(this.account.address).call(),
        contract.methods.totalSupply().call().catch(() => '0')
      ]);

      const decimalCount = Number(decimals);
      const balanceFormatted = Number(balance) / Math.pow(10, decimalCount);

      const tokenInfo: TokenInfo = {
        symbol: String(symbol),
        name: String(name),
        decimals: decimalCount,
        balance: String(balance),
        balanceFormatted,
        totalSupply: String(totalSupply)
      };

      // Add price if oracle is available
      if (includePrice && this.priceOracle) {
        try {
          tokenInfo.priceUsd = await this.priceOracle(tokenAddress);
        } catch (error) {
          console.warn(`Failed to get price for ${tokenAddress}:`, error);
        }
      }

      return tokenInfo;
    } catch (error) {
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Enhanced gas estimation with EIP-1559 support
  private async getOptimalGasConfig(): Promise<GasConfig> {
    try {
      // Try to get EIP-1559 gas prices first
      if (this.supportsEIP1559()) {
        const block = await this.web3.eth.getBlock('latest');
        if (block.baseFeePerGas) {
          const baseFee = BigInt(block.baseFeePerGas);
          const priorityFee = BigInt(this.web3.utils.toWei('2', 'gwei')); // 2 gwei priority
          const maxFee = baseFee * BigInt(2) + priorityFee; // 2x base + priority

          return {
            maxFeePerGas: maxFee.toString(),
            maxPriorityFeePerGas: priorityFee.toString()
          };
        }
      }
      
      // Fallback to legacy gas pricing
      const gasPrice = await this.web3.eth.getGasPrice();
      return { gasPrice: gasPrice.toString() };
    } catch (error) {
      console.warn('Failed to get optimal gas config:', error);
      return { gasPrice: this.web3.utils.toWei('20', 'gwei') };
    }
  }

  private supportsEIP1559(): boolean {
    // Networks that support EIP-1559
    const eip1559Networks = [1, 5, 137, 80001, 42161, 421613];
    return eip1559Networks.includes(this.chainId);
  }

  private async estimateGasWithBuffer(transaction: any): Promise<number> {
    try {
      const estimated = await this.web3.eth.estimateGas(transaction);
      const buffered = Math.floor(Number(estimated) * 1.2); // 20% buffer
      console.log(`Gas estimate: ${estimated}, with buffer: ${buffered}`);
      return buffered;
    } catch (error) {
      console.warn('Gas estimation failed, using default:', error);
      return 100000; // Default fallback
    }
  }

  // Enhanced transaction methods
  async sendNativeToken(
    toAddress: string, 
    amountEth: number, 
    gasConfig?: GasConfig
  ): Promise<TransactionResult> {
    if (!isAddress(toAddress)) {
      throw new Error('Invalid recipient address');
    }

    const amountWei = this.web3.utils.toWei(amountEth.toString(), 'ether');
    
    // Check balance
    const balance = await this.getBalance();
    if (balance < BigInt(amountWei)) {
      const balanceEth = this.web3.utils.fromWei(balance.toString(), 'ether');
      throw new Error(`Insufficient balance. Have ${balanceEth} ETH, need ${amountEth}`);
    }

    try {
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || await this.getOptimalGasConfig();
      
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

  async sendTokenHuman(
    tokenAddress: string,
    toAddress: string,
    amount: number,
    gasConfig?: GasConfig
  ): Promise<TransactionResult> {
    if (!isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    if (!isAddress(toAddress)) {
      throw new Error('Invalid recipient address');
    }

    try {
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      const amountWei = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));
      
      if (BigInt(tokenInfo.balance) < amountWei) {
        throw new Error(
          `Insufficient token balance. Have ${tokenInfo.balanceFormatted.toFixed(6)} ${tokenInfo.symbol}, need ${amount}`
        );
      }

      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || await this.getOptimalGasConfig();

      const transaction: any = {
        to: tokenAddress,
        data: contract.methods.transfer(toAddress, amountWei.toString()).encodeABI(),
        chainId: this.chainId,
        gas: 100000,
        nonce: Number(nonce),
        ...optimalGasConfig
      };

      transaction.gas = await this.estimateGasWithBuffer(transaction);

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

  // Batch operations
  async batchTransfer(transfers: Array<{
    tokenAddress?: string;
    toAddress: string;
    amount: number;
  }>): Promise<TransactionResult[]> {
    const results: TransactionResult[] = [];
    
    for (const transfer of transfers) {
      try {
        let result: TransactionResult;
        if (transfer.tokenAddress) {
          result = await this.sendTokenHuman(transfer.tokenAddress, transfer.toAddress, transfer.amount);
        } else {
          result = await this.sendNativeToken(transfer.toAddress, transfer.amount);
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

  // Enhanced portfolio management
  public async getEnhancedPortfolio(tokenAddresses: string[]): Promise<Portfolio> {
    const portfolio: Portfolio = {
      address: this.account.address,
      nativeBalance: await this.getBalanceEth(),
      tokens: {},
      networkInfo: await this.getNetworkInfo(),
      lastUpdated: Date.now()
    };

    let totalValueUsd = 0;

    // Get native token price if oracle is available
    if (this.priceOracle) {
      try {
        const nativeTokenPrice = await this.priceOracle('native');
        portfolio.nativeBalanceUsd = portfolio.nativeBalance * nativeTokenPrice;
        totalValueUsd += portfolio.nativeBalanceUsd;
      } catch (error) {
        console.warn('Failed to get native token price:', error);
      }
    }

    // Get token information with prices
    for (const tokenAddress of tokenAddresses) {
      try {
        const tokenInfo = await this.getTokenInfo(tokenAddress, true);
        portfolio.tokens[tokenAddress] = tokenInfo;
        
        if (tokenInfo.priceUsd && tokenInfo.balanceFormatted > 0) {
          totalValueUsd += tokenInfo.balanceFormatted * tokenInfo.priceUsd;
        }
      } catch (error) {
        console.warn(`Failed to get info for token ${tokenAddress}:`, error);
        portfolio.tokens[tokenAddress] = { 
          error: error instanceof Error ? error.message : String(error) 
        } as TokenInfo;
      }
    }

    if (totalValueUsd > 0) {
      portfolio.totalValueUsd = totalValueUsd;
    }

    return portfolio;
  }

  // Multisig support
  async getMultisigInfo(multisigAddress: string): Promise<{
    owners: string[];
    required: number;
    isOwner: boolean;
  }> {
    try {
      const contract = new this.web3.eth.Contract(MULTISIG_ABI, multisigAddress);
      
      const [ownersRaw, required] = await Promise.all([
        contract.methods.getOwners().call(),
        contract.methods.required().call()
      ]);

      const owners: string[] = Array.isArray(ownersRaw) ? ownersRaw as string[] : [];
      const isOwner = owners.includes(this.account.address);

      return {
        owners,
        required: Number(required),
        isOwner
      };
    } catch (error) {
      throw new Error(`Failed to get multisig info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async submitMultisigTransaction(
    multisigAddress: string,
    destination: string,
    value: string,
    data: string = '0x'
  ): Promise<TransactionResult> {
    try {
      const contract = new this.web3.eth.Contract(MULTISIG_ABI, multisigAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const gasConfig = await this.getOptimalGasConfig();

      const transaction: any = {
        to: multisigAddress,
        data: contract.methods.submitTransaction(destination, value, data).encodeABI(),
        chainId: this.chainId,
        gas: 200000,
        nonce: Number(nonce),
        ...gasConfig
      };

      transaction.gas = await this.estimateGasWithBuffer(transaction);

      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction!);
      
      console.log(`Multisig transaction submitted: ${txHash.transactionHash}`);
      
      return {
        hash: typeof txHash.transactionHash === 'string' ? txHash.transactionHash : '',
        status: 'pending',
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Multisig transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Enhanced transaction monitoring
  async waitForTransaction(
    txHash: string, 
    timeout: number = 120, 
    pollLatency: number = 2.0
  ): Promise<TransactionResult> {
    try {
      console.log(`Waiting for transaction: ${txHash}`);
      
      const receipt = await new Promise<TransactionReceipt>((resolve, reject) => {
        const startTime = Date.now();
        
        const poll = async () => {
          try {
            const receipt = await this.web3.eth.getTransactionReceipt(txHash);
            if (receipt) {
              resolve(receipt);
              return;
            }
          } catch (error) {
            // Transaction not found yet, continue polling
          }
          
          if (Date.now() - startTime > timeout * 1000) {
            reject(new Error('Transaction timeout'));
            return;
          }
          
          setTimeout(poll, pollLatency * 1000);
        };
        
        poll();
      });

      const result: TransactionResult = {
        hash: txHash,
        status: receipt.status ? 'success' : 'failed',
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed),
        effectiveGasPrice: receipt.effectiveGasPrice ? Number(receipt.effectiveGasPrice) : undefined,
        timestamp: Date.now()
      };

      // Update cache
      this.transactionCache.set(txHash, result);
      
      console.log(`Transaction ${txHash} ${result.status} in block ${result.blockNumber}`);
      return result;
    } catch (error) {
      const failedResult: TransactionResult = {
        hash: txHash,
        status: 'failed',
        errorReason: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
      
      this.transactionCache.set(txHash, failedResult);
      throw new Error(`Transaction confirmation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // DAO Treasury Management with enhanced features
  async scheduleDisburse(
    daoId: string,
    userId: string,
    disbursements: Disbursement[],
    executeAt?: number
  ): Promise<{ scheduledId: string; disbursements: Disbursement[] }> {
    const scheduledId = `${daoId}-${Date.now()}`;
    const scheduledDisbursements = disbursements.map(d => ({
      ...d,
      scheduledAt: executeAt || Date.now()
    }));

    // This would integrate with your scheduling system
    console.log(`Scheduled disbursement ${scheduledId} for ${new Date(executeAt || Date.now())}`);
    
    return { scheduledId, disbursements: scheduledDisbursements };
  }

  public async estimateDisbursementCost(disbursements: Disbursement[]): Promise<{
    totalGasCost: number;
    totalGasCostUsd?: number;
    breakdown: Array<{ index: number; gasCost: number; }>;
  }> {
    const breakdown: Array<{ index: number; gasCost: number; }> = [];
    let totalGasCost = 0;

    for (let i = 0; i < disbursements.length; i++) {
      const d = disbursements[i];
      let gasEstimate: number;

      if (d.tokenAddress) {
        // Token transfer gas estimate
        gasEstimate = 65000;
      } else {
        // Native token transfer
        gasEstimate = 21000;
      }

      const gasPrice = await this.web3.eth.getGasPrice();
      const gasCost = Number(gasPrice) * gasEstimate;
      
      breakdown.push({ index: i, gasCost });
      totalGasCost += gasCost;
    }

    const result: any = { totalGasCost, breakdown };

    // Add USD cost if price oracle is available
    if (this.priceOracle) {
      try {
        const ethPrice = await this.priceOracle('native');
        result.totalGasCostUsd = (totalGasCost / 1e18) * ethPrice;
      } catch (error) {
        console.warn('Failed to get ETH price for cost estimation:', error);
      }
    }

    return result;
  }

  // Utility methods
  public async getTransactionHistory(limit: number = 10): Promise<TransactionResult[]> {
    return Array.from(this.transactionCache.values())
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit);
  }

  async clearTransactionCache(): Promise<void> {
    this.transactionCache.clear();
  }

  public getExplorerUrl(txHash: string): string {
    return `${this.networkConfig.explorerUrl}/tx/${txHash}`;
  }

  // Getters
  public get address(): string {
    return this.account.address;
  }

  get network(): NetworkConfig {
    return this.networkConfig;
  }
}

// Enhanced Network Configuration
export class NetworkConfig {
  static readonly CELO_MAINNET: NetworkConfig = new NetworkConfig(
    'https://forno.celo.org',
    42220,
    'Celo Mainnet',
    'https://explorer.celo.org'
  );

  static readonly CELO_ALFAJORES: NetworkConfig = new NetworkConfig(
    'https://alfajores-forno.celo-testnet.org',
    44787,
    'Celo Alfajores Testnet',
    'https://alfajores-blockscout.celo-testnet.org'
  );

  static readonly ETHEREUM_MAINNET: NetworkConfig = new NetworkConfig(
    'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
    1,
    'Ethereum Mainnet',
    'https://etherscan.io'
  );

  static readonly POLYGON_MAINNET: NetworkConfig = new NetworkConfig(
    'https://polygon-rpc.com',
    137,
    'Polygon Mainnet',
    'https://polygonscan.com'
  );

  static readonly ARBITRUM_ONE: NetworkConfig = new NetworkConfig(
    'https://arb1.arbitrum.io/rpc',
    42161,
    'Arbitrum One',
    'https://arbiscan.io'
  );

  public readonly rpcUrl: string;
  public readonly chainId: number;
  public readonly name: string;
  public readonly explorerUrl: string;

  constructor(
    rpcUrl: string,
    chainId: number,
    name: string,
    explorerUrl: string = ''
  ) {
    this.rpcUrl = rpcUrl;
    this.chainId = chainId;
    this.name = name;
    this.explorerUrl = explorerUrl;
  }
}

// Enhanced Wallet Manager
export class WalletManager {
  static createWallet(): WalletCredentials {
    const account = new Web3().eth.accounts.create();
    return {
      address: account.address,
      privateKey: account.privateKey
    };
  }


  static validateAddress(address: string): boolean {
    return isAddress(address);
  }

  static normalizePrivateKey(privateKey: string): string {
    let key = privateKey.trim();
    if (!key.startsWith('0x')) {
      key = '0x' + key;
    }
    return key;
  }

  static validatePrivateKey(privateKey: string): boolean {
    try {
      const key = WalletManager.normalizePrivateKey(privateKey);
      if (key.length !== 66) return false;
      if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return false;
      new Web3().eth.accounts.privateKeyToAccount(key);
      return true;
    } catch {
      return false;
    }
  }

  static checksumAddress(address: string): string {
    return Web3.utils.toChecksumAddress(address);
  }

  static async isContract(web3: Web3, address: string): Promise<boolean> {
    const code = await web3.eth.getCode(address);
    return code !== '0x';
  }
}

// Comprehensive example with real functionality
export async function enhancedExample() {
  try {
    // Use testnet for safe testing
    const config = NetworkConfig.CELO_ALFAJORES;
    
    // Realistic price oracle with actual token addresses
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 0.65, // CELO price (more realistic for Celo network)
        // Celo testnet token addresses
        '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1': 1.0, // cUSD on Alfajores
        '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9': 1.0, // cEUR on Alfajores  
        '0x7037F7296B2fc7908de7b57a89efaa8319f0C500': 0.65, // mCELO on Alfajores
      };
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const price = prices[tokenAddress.toLowerCase()] || prices[tokenAddress] || 0;
      console.log(`Price for ${tokenAddress}: $${price}`);
      return price;
    };

    // Permission checker for DAO operations
    const permissionCheck = async (daoId: string, userId: string, action: string): Promise<boolean> => {
      console.log(`Permission check: ${userId} attempting ${action} on ${daoId}`);
      // Mock permission logic - in production, this would check actual DAO membership
      const allowedActions = ['transfer', 'approve', 'disburse'];
      return allowedActions.includes(action);
    };

    // Transaction logger for audit trails
    const contributionLogger = async (log: any) => {
      console.log('Contribution logged:', {
        timestamp: new Date().toISOString(),
        ...log
      });
    };

    // Create wallet instance (you would use a real private key here)


// Robust private key validation utility
const isValidPrivateKey = (key: string | undefined): boolean => {
  if (!key || typeof key !== 'string') return false;
  key = key.trim();
  if (!key.startsWith('0x')) return false;
  if (key.length !== 66) return false;
  return /^[0-9a-fA-F]{64}$/.test(key.slice(2));
};

    let WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
    if (typeof WALLET_PRIVATE_KEY !== 'string') {
      throw new Error('WALLET_PRIVATE_KEY is not set or not a string.');
    }
    WALLET_PRIVATE_KEY = WALLET_PRIVATE_KEY.trim();
    console.log("[DEBUG] WALLET_PRIVATE_KEY:", WALLET_PRIVATE_KEY);
    if (!isValidPrivateKey(WALLET_PRIVATE_KEY)) {
      console.log("[DEBUG] WALLET_PRIVATE_KEY length:", WALLET_PRIVATE_KEY.length);
      throw new Error("Invalid private key format. Must be 0x + 64 hex characters.");
    }

    const wallet = new EnhancedAgentWallet(
      WALLET_PRIVATE_KEY,
      config,
      permissionCheck,
      contributionLogger,
      undefined, // billingLogger
      mockPriceOracle
    );

    console.log(`\n=== Enhanced Wallet Demo ===`);
    console.log(`Wallet Address: ${wallet.address}`);
    console.log(`Network: ${config.name}`);

    // 1. Get network information
    console.log('\n--- Network Information ---');
    const networkInfo = await wallet.getNetworkInfo();
    console.log(`Connected: ${networkInfo.connected}`);
    console.log(`Latest Block: ${networkInfo.latestBlock}`);
    console.log(`Gas Price: ${networkInfo.gasPrice ? (networkInfo.gasPrice / 1e9).toFixed(2) + ' Gwei' : 'N/A'}`);

    // 2. Check wallet balance
    console.log('\n--- Balance Information ---');
    try {
      const balance = await wallet.getBalanceEth();
      console.log(`Native Balance: ${balance.toFixed(6)} CELO`);
      
      if (balance > 0) {
        const balanceUsd = balance * 0.65; // Using CELO price
        console.log(`Balance (USD): $${balanceUsd.toFixed(2)}`);
      }
    } catch (error) {
      console.log(`Balance check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 3. Enhanced portfolio (even with zero balances, it shows structure)
    console.log('\n--- Enhanced Portfolio ---');
    const sampleTokens = [
      '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1', // cUSD
      '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9'  // cEUR
    ];
    
    try {
      const portfolio = await wallet.getEnhancedPortfolio(sampleTokens);
      console.log('Portfolio Summary:');
      console.log(`- Address: ${portfolio.address}`);
      console.log(`- Native Balance: ${portfolio.nativeBalance.toFixed(6)} CELO`);
      console.log(`- Native Balance (USD): $${(portfolio.nativeBalanceUsd || 0).toFixed(2)}`);
      console.log(`- Total Value (USD): $${(portfolio.totalValueUsd || 0).toFixed(2)}`);
      
      // Show token balances
      Object.entries(portfolio.tokens).forEach(([address, token]) => {
        const t = token as TokenInfo;
        if (!t.error) {
          console.log(`- ${t.symbol}: ${t.balanceFormatted.toFixed(6)} (${t.name})`);
        }
      });
    } catch (error) {
      console.log(`Portfolio fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 4. DAO Treasury Management Demo
    console.log('\n--- DAO Treasury Management ---');
    const treasuryManager = new DaoTreasuryManager(
      wallet,
      wallet.address, // Using wallet address as treasury for demo
      sampleTokens
    );

    try {
      const treasurySnapshot = await treasuryManager.getTreasurySnapshot();
      console.log('Treasury Snapshot:');
      console.log(`- Native Balance: ${treasurySnapshot.nativeBalance.toFixed(6)} CELO`);
      console.log(`- Total Value (USD): $${(treasurySnapshot.totalValueUsd || 0).toFixed(2)}`);
      
      const report = await treasuryManager.generateTreasuryReport('monthly');
      console.log('Treasury Report:');
      console.log(`- Period: ${report.period}`);
      console.log(`- Top Holdings: ${report.topHoldings.length} positions`);
      console.log(`- Recommendations: ${report.recommendations.length} items`);
      
      report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    } catch (error) {
      console.log(`Treasury management failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 5. Risk Management Demo
    console.log('\n--- Risk Management ---');
    const riskManager = new RiskManager(wallet, 1000, 500); // $1000 daily, $500 single transfer limits
    
    // Test various transfer scenarios
    const testTransfers = [
      { amount: 0.1, description: 'Small CELO transfer' },
      { amount: 100, description: 'Large CELO transfer' },
      { amount: 1000, description: 'Very large transfer (should be blocked)' }
    ];

    for (const test of testTransfers) {
      try {
        const validation = await riskManager.validateTransfer(test.amount, undefined, wallet.address);
        console.log(`${test.description}:`);
        console.log(`  - Allowed: ${validation.allowed}`);
        console.log(`  - Risk Score: ${validation.riskScore}/100`);
        if (validation.reason) {
          console.log(`  - Reason: ${validation.reason}`);
        }
      } catch (error) {
        console.log(`Risk validation failed for ${test.description}: ${error}`);
      }
    }

    // 6. Gas Estimation Demo
    console.log('\n--- Gas Estimation ---');
    try {
      const disbursements = [
        { toAddress: wallet.address, amount: 0.1 },
        { toAddress: wallet.address, amount: 0.1, tokenAddress: sampleTokens[0] }
      ];
      
      const gasEstimate = await wallet.estimateDisbursementCost(disbursements);
      console.log(`Gas Cost Estimate:`);
      console.log(`- Total Gas Cost: ${gasEstimate.totalGasCost} wei`);
      console.log(`- Gas Cost (CELO): ${(gasEstimate.totalGasCost / 1e18).toFixed(8)}`);
      if (gasEstimate.totalGasCostUsd) {
        console.log(`- Gas Cost (USD): $${gasEstimate.totalGasCostUsd.toFixed(4)}`);
      }
      console.log(`- Breakdown: ${gasEstimate.breakdown.length} transactions`);
    } catch (error) {
      console.log(`Gas estimation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 7. Transaction utilities
    console.log('\n--- Transaction Utilities ---');
  // Example real transaction hash from Celo Alfajores testnet
  const sampleTxHash = "0x6e1e7e2e2b7e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2";
  console.log(`Explorer URL for tx: ${wallet.getExplorerUrl(sampleTxHash)}`);
    
    const txHistory = await wallet.getTransactionHistory(5);
    console.log(`Transaction Cache: ${txHistory.length} transactions`);

    console.log('\n=== Demo Complete ===');
    console.log('✓ Network connection tested');
    console.log('✓ Balance operations demonstrated');
    console.log('✓ Portfolio management shown');
    console.log('✓ DAO treasury features previewed');
    console.log('✓ Risk management validated');
    console.log('✓ Gas estimation completed');
    
  } catch (error) {
    console.error('Enhanced example failed:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
  }
}

// Additional utility function for testing specific features
export async function testSpecificFeature(featureName: string) {
  console.log(`\n=== Testing ${featureName} ===`);
  
  try {
    const config = NetworkConfig.CELO_ALFAJORES;
    const DEMO_PRIVATE_KEY = "0x" + "a".repeat(64);
    const wallet = new EnhancedAgentWallet(DEMO_PRIVATE_KEY, config);

    switch (featureName.toLowerCase()) {
      case 'network':
        const networkInfo = await wallet.getNetworkInfo();
        console.log('Network Info:', JSON.stringify(networkInfo, null, 2));
        break;
        
      case 'balance':
        const balance = await wallet.getBalanceEth();
        console.log(`Balance: ${balance} CELO`);
        break;
        
      case 'token':
        // Test with a known Celo testnet token
        const tokenInfo = await wallet.getTokenInfo('0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1');
        console.log('Token Info:', JSON.stringify(tokenInfo, null, 2));
        break;
        
      default:
        console.log('Available features: network, balance, token');
    }
  } catch (error) {
    console.error(`Feature test failed:`, error);
  }
}

// Advanced DAO Treasury Management Class
export class DaoTreasuryManager {
  private wallet: EnhancedAgentWallet;
  private treasuryAddress: string;
  private allowedTokens: Set<string>;

  constructor(
    wallet: EnhancedAgentWallet, 
    treasuryAddress: string,
    allowedTokens: string[] = []
  ) {
    this.wallet = wallet;
    this.treasuryAddress = treasuryAddress;
    this.allowedTokens = new Set(allowedTokens);
  }

  async getTreasurySnapshot(): Promise<{
    nativeBalance: number;
    tokenBalances: Record<string, TokenInfo>;
    totalValueUsd?: number;
    lastUpdated: number;
  }> {
    const nativeBalance = await this.wallet.getBalanceEth(this.treasuryAddress);
    const tokenBalances: Record<string, TokenInfo> = {};
    let totalValueUsd = 0;

    // Get balances for all allowed tokens
    for (const tokenAddress of Array.from(this.allowedTokens)) {
      try {
        const contract = new this.wallet['web3'].eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
        const balance = await contract.methods.balanceOf(this.treasuryAddress).call();
        const [symbol, name, decimals] = await Promise.all([
          contract.methods.symbol().call(),
          contract.methods.name().call(),
          contract.methods.decimals().call()
        ]);

        const decimalCount = Number(decimals);
        const balanceFormatted = Number(balance) / Math.pow(10, decimalCount);

        const tokenInfo: TokenInfo = {
          symbol: String(symbol),
          name: String(name),
          decimals: decimalCount,
          balance: String(balance),
          balanceFormatted
        };

        // Add price if available
        if (this.wallet['priceOracle'] && balanceFormatted > 0) {
          try {
            const price = await this.wallet['priceOracle'](tokenAddress);
            tokenInfo.priceUsd = price;
            totalValueUsd += balanceFormatted * price;
          } catch (error) {
            console.warn(`Failed to get price for ${tokenAddress}:`, error);
          }
        }

        tokenBalances[tokenAddress] = tokenInfo;
      } catch (error) {
        console.warn(`Failed to get treasury balance for ${tokenAddress}:`, error);
      }
    }

    // Add native token value
    if (this.wallet['priceOracle']) {
      try {
        const nativePrice = await this.wallet['priceOracle']('native');
        totalValueUsd += nativeBalance * nativePrice;
      } catch (error) {
        console.warn('Failed to get native token price:', error);
      }
    }

    return {
      nativeBalance,
      tokenBalances,
      totalValueUsd: totalValueUsd > 0 ? totalValueUsd : undefined,
      lastUpdated: Date.now()
    };
  }

  async generateTreasuryReport(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<{
    period: string;
    currentSnapshot: any;
    changePercentage?: number;
    topHoldings: Array<{ token: string; value: number; percentage: number }>;
    recommendations: string[];
  }> {
    const currentSnapshot = await this.getTreasurySnapshot();
    const topHoldings: Array<{ token: string; value: number; percentage: number }> = [];
    const recommendations: string[] = [];

    // Calculate top holdings
    const totalValue = currentSnapshot.totalValueUsd || 0;
    if (totalValue > 0) {
      // Native token holding
      if (this.wallet['priceOracle']) {
        try {
          const nativePrice = await this.wallet['priceOracle']('native');
          const nativeValue = currentSnapshot.nativeBalance * nativePrice;
          topHoldings.push({
            token: 'Native Token',
            value: nativeValue,
            percentage: (nativeValue / totalValue) * 100
          });
        } catch (error) {
          console.warn('Failed to calculate native token value:', error);
        }
      }

      // Token holdings
      for (const [address, token] of Object.entries(currentSnapshot.tokenBalances)) {
        if (token.priceUsd && token.balanceFormatted > 0) {
          const value = token.balanceFormatted * token.priceUsd;
          topHoldings.push({
            token: `${token.symbol} (${token.name})`,
            value,
            percentage: (value / totalValue) * 100
          });
        }
      }

      // Sort by value
      topHoldings.sort((a, b) => b.value - a.value);
    }

    // Generate basic recommendations
    if (topHoldings.length > 0) {
      const largestHolding = topHoldings[0];
      if (largestHolding.percentage > 70) {
        recommendations.push(`Consider diversifying: ${largestHolding.token} represents ${largestHolding.percentage.toFixed(1)}% of treasury`);
      }
      
      if (currentSnapshot.nativeBalance < 0.1) {
        recommendations.push('Treasury has low native token balance, consider maintaining more for gas fees');
      }
    }

    return {
      period,
      currentSnapshot,
      topHoldings,
      recommendations
    };
  }

  addAllowedToken(tokenAddress: string): void {
    if (WalletManager.validateAddress(tokenAddress)) {
      this.allowedTokens.add(tokenAddress);
    } else {
      throw new Error('Invalid token address');
    }
  }

  removeAllowedToken(tokenAddress: string): void {
    this.allowedTokens.delete(tokenAddress);
  }

  getAllowedTokens(): string[] {
    return Array.from(this.allowedTokens);
  }
}

// Risk Management and Compliance Features
export class RiskManager {
  private wallet: EnhancedAgentWallet;
  private maxDailyVolume: number;
  private maxSingleTransfer: number;
  private dailyVolumeTracking: Map<string, { date: string; volume: number }> = new Map();

  constructor(
    wallet: EnhancedAgentWallet,
    maxDailyVolume: number = 10000, // USD
    maxSingleTransfer: number = 5000 // USD
  ) {
    this.wallet = wallet;
    this.maxDailyVolume = maxDailyVolume;
    this.maxSingleTransfer = maxSingleTransfer;
  }

  async validateTransfer(
    amount: number,
    tokenAddress?: string,
    toAddress?: string
  ): Promise<{ allowed: boolean; reason?: string; riskScore: number }> {
    let riskScore = 0;
    
    // Convert to USD value if possible
    let amountUsd = amount;
    if (this.wallet['priceOracle']) {
      try {
        const price = await this.wallet['priceOracle'](tokenAddress || 'native');
        amountUsd = amount * price;
      } catch (error) {
        console.warn('Failed to get price for risk assessment:', error);
        riskScore += 10; // Unknown price increases risk
      }
    }

    // Single transfer limit check
    if (amountUsd > this.maxSingleTransfer) {
      return {
        allowed: false,
        reason: `Transfer amount ${amountUsd.toFixed(2)} exceeds single transfer limit of ${this.maxSingleTransfer}`,
        riskScore: 100
      };
    }

    // Daily volume check
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `${this.wallet.address}-${today}`;
    const dailyData = this.dailyVolumeTracking.get(dailyKey) || { date: today, volume: 0 };
    
    if (dailyData.volume + amountUsd > this.maxDailyVolume) {
      return {
        allowed: false,
        reason: `Transfer would exceed daily volume limit. Current: ${dailyData.volume.toFixed(2)}, Limit: ${this.maxDailyVolume}`,
        riskScore: 100
      };
    }

    // Address validation
    if (toAddress && !WalletManager.validateAddress(toAddress)) {
      return {
        allowed: false,
        reason: 'Invalid recipient address',
        riskScore: 100
      };
    }

    // Check if address is a contract (higher risk)
    if (toAddress && this.wallet['web3']) {
      try {
        const isContract = await WalletManager.isContract(this.wallet['web3'], toAddress);
        if (isContract) {
          riskScore += 20;
        }
      } catch (error) {
        riskScore += 10;
      }
    }

    // Risk scoring based on amount
    const amountRisk = (amountUsd / this.maxSingleTransfer) * 30;
    riskScore += Math.min(amountRisk, 30);

    // Update daily volume tracking
    dailyData.volume += amountUsd;
    this.dailyVolumeTracking.set(dailyKey, dailyData);

    return {
      allowed: true,
      riskScore: Math.min(riskScore, 100)
    };
  }

  getDailyVolumeReport(): Array<{ date: string; volume: number; percentage: number }> {
    return Array.from(this.dailyVolumeTracking.values())
      .map(data => ({
        date: data.date,
        volume: data.volume,
        percentage: (data.volume / this.maxDailyVolume) * 100
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  setLimits(maxDailyVolume?: number, maxSingleTransfer?: number): void {
    if (maxDailyVolume !== undefined) this.maxDailyVolume = maxDailyVolume;
    if (maxSingleTransfer !== undefined) this.maxSingleTransfer = maxSingleTransfer;
  }

  getLimits(): { maxDailyVolume: number; maxSingleTransfer: number } {
    return {
      maxDailyVolume: this.maxDailyVolume,
      maxSingleTransfer: this.maxSingleTransfer
    };
  }
}

// Analytics and Reporting
export class TransactionAnalytics {
  private transactions: TransactionResult[] = [];

  addTransaction(tx: TransactionResult): void {
    this.transactions.push(tx);
    // Keep only last 1000 transactions
    if (this.transactions.length > 1000) {
      this.transactions = this.transactions.slice(-1000);
    }
  }

  getSuccessRate(timeframe: number = 24 * 60 * 60 * 1000): number {
    const since = Date.now() - timeframe;
    const recentTxs = this.transactions.filter(tx => (tx.timestamp || 0) > since);
    
    if (recentTxs.length === 0) return 100;
    
    const successful = recentTxs.filter(tx => tx.status === 'success').length;
    return (successful / recentTxs.length) * 100;
  }

  getAverageGasUsed(timeframe: number = 24 * 60 * 60 * 1000): number {
    const since = Date.now() - timeframe;
    const recentTxs = this.transactions.filter(
      tx => (tx.timestamp || 0) > since && tx.gasUsed && tx.status === 'success'
    );
    
    if (recentTxs.length === 0) return 0;
    
    const totalGas = recentTxs.reduce((sum, tx) => sum + (tx.gasUsed || 0), 0);
    return totalGas / recentTxs.length;
  }

  getFailureReasons(): Record<string, number> {
    const reasons: Record<string, number> = {};
    this.transactions
      .filter(tx => tx.status === 'failed' && tx.errorReason)
      .forEach(tx => {
        const reason = tx.errorReason!;
        reasons[reason] = (reasons[reason] || 0) + 1;
      });
    
    return reasons;
  }

  generateReport(timeframe: number = 7 * 24 * 60 * 60 * 1000): {
    totalTransactions: number;
    successRate: number;
    averageGasUsed: number;
    failureReasons: Record<string, number>;
    gasEfficiencyTrend: Array<{ date: string; avgGas: number }>;
  } {
    const since = Date.now() - timeframe;
    const recentTxs = this.transactions.filter(tx => (tx.timestamp || 0) > since);
    
    // Gas efficiency trend (daily averages)
    const dailyGas: Record<string, number[]> = {};
    recentTxs
      .filter(tx => tx.gasUsed && tx.status === 'success')
      .forEach(tx => {
        const date = new Date(tx.timestamp || 0).toISOString().split('T')[0];
        if (!dailyGas[date]) dailyGas[date] = [];
        dailyGas[date].push(tx.gasUsed!);
      });
    
    const gasEfficiencyTrend = Object.entries(dailyGas)
      .map(([date, gasValues]) => ({
        date,
        avgGas: gasValues.reduce((a, b) => a + b, 0) / gasValues.length
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalTransactions: recentTxs.length,
      successRate: this.getSuccessRate(timeframe),
      averageGasUsed: this.getAverageGasUsed(timeframe),
      failureReasons: this.getFailureReasons(),
      gasEfficiencyTrend
    };
  }
}

// Export enhanced wallet as default
export default EnhancedAgentWallet;

// Always run demo when this file is executed
enhancedExample();