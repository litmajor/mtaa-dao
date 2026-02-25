/**
 * Blockchain Withdrawal Service
 * Handles real blockchain transactions for micro-withdrawal batches
 * Uses existing tokenService infrastructure for multi-token support
 */

import { ethers } from 'ethers';
import { tokenService } from './tokenService';
import { TokenRegistry } from '../../shared/tokenRegistry';
import { Logger } from '../utils/logger';

const logger = new Logger('blockchain-withdrawal');

// Price feed configuration - use real price oracles where possible
const PRICE_FEED_CONFIG = {
  USDC: 'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd',
  USDT: 'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd',
  cUSD: 'https://api.coingecko.com/api/v3/simple/price?ids=celo-dollar&vs_currencies=usd',
  ETH: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
  CELO: 'https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd',
};

// Cache for price data with 5-minute TTL
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Retry configuration for production reliability
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Baseline gas estimates for different currencies (fallback when simulation fails)
 */
const GAS_ESTIMATES = {
  ETH: { base: BigInt(21000), perTransfer: BigInt(60000) },
  CELO: { base: BigInt(21000), perTransfer: BigInt(60000) },
  USDC: { base: BigInt(65000), perTransfer: BigInt(60000) },
  USDT: { base: BigInt(65000), perTransfer: BigInt(60000) },
  cUSD: { base: BigInt(65000), perTransfer: BigInt(60000) },
};

/**
 * Get native token decimals for the current chain (used for gas fee calculation)
 */
function getNativeTokenDecimals(currency: string): number {
  // Gas is always paid in native token: 18 decimals for ETH, also 18 for CELO
  return 18;
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  operationName: string,
  maxAttempts: number = RETRY_CONFIG.maxAttempts
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on permanent errors (invalid address, insufficient balance, etc)
      if (error.message?.includes('Invalid address') || 
          error.message?.includes('Insufficient balance') ||
          error.message?.includes('not supported')) {
        throw error;
      }

      if (attempt < maxAttempts) {
        const delayMs = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
          RETRY_CONFIG.maxDelayMs
        );
        logger.warn(
          `${operationName} attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Fetch real-time token price from CoinGecko API
 */
async function fetchTokenPrice(currency: string): Promise<number> {
  try {
    // Check cache first
    const cached = priceCache.get(currency);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
      return cached.price;
    }

    const url = PRICE_FEED_CONFIG[currency as keyof typeof PRICE_FEED_CONFIG];
    if (!url) {
      logger.warn(`No price feed configured for ${currency}`);
      return 1; // Default to 1:1 for unknown tokens
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch price for ${currency}: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse CoinGecko response
    let price = 1;
    if (currency === 'USDC') {
      price = data['usd-coin'].usd;
    } else if (currency === 'USDT') {
      price = data['tether'].usd;
    } else if (currency === 'cUSD') {
      price = data['celo-dollar'].usd;
    } else if (currency === 'ETH') {
      price = data['ethereum'].usd;
    } else if (currency === 'CELO') {
      price = data['celo'].usd;
    }

    // Cache the price
    priceCache.set(currency, { price, timestamp: Date.now() });
    logger.debug(`Fetched price for ${currency}: $${price}`);

    return price;
  } catch (error: any) {
    logger.warn(`Price fetch failed for ${currency}: ${error.message}. Using default price of 1.`);
    return 1; // Fallback to 1:1 ratio
  }
}

/**
 * Detect network congestion and return dynamic gas buffer
 * Returns multiplier (1.1 for low, 1.3 for medium, 1.5 for high congestion)
 */
async function getDynamicGasBuffer(): Promise<number> {
  try {
    const feeData = await tokenService.provider.getFeeData();
    
    // Get base fee from recent blocks
    const blockNumber = await tokenService.provider.getBlockNumber();
    const block = await tokenService.provider.getBlock(blockNumber);
    
    if (!block) {
      return 1.15; // Default buffer
    }

    const baseFee = block.baseFeePerGas || BigInt(0);
    
    // If baseFee is very high (>100 Gwei), we're in congestion
    const baseFeeGwei = Number(baseFee) / 1e9;
    
    if (baseFeeGwei > 100) {
      logger.warn(`High network congestion detected: ${baseFeeGwei.toFixed(2)} Gwei base fee`);
      return 1.5; // 50% buffer for high congestion
    } else if (baseFeeGwei > 50) {
      logger.info(`Medium network congestion: ${baseFeeGwei.toFixed(2)} Gwei base fee`);
      return 1.3; // 30% buffer for medium congestion
    } else {
      logger.info(`Low network congestion: ${baseFeeGwei.toFixed(2)} Gwei base fee`);
      return 1.1; // 10% buffer for low congestion
    }
  } catch (error: any) {
    logger.warn(`Failed to detect network congestion: ${error.message}. Using default buffer.`);
    return 1.15; // Default buffer
  }
}

/**
 * Simulate transaction to get accurate gas estimate
 */
async function simulateTransfer(
  currency: string,
  recipients: Array<{ address: string; amount: string }>
): Promise<bigint> {
  try {
    if (!tokenService.signer) {
      throw new Error('No signer available for simulation');
    }

    let totalGas = BigInt(0);

    if (currency === 'ETH' || currency === 'CELO') {
      // Simulate native token transfers
      for (const recipient of recipients) {
        const estimateGas = await tokenService.provider.estimateGas({
          from: tokenService.signer.address,
          to: recipient.address,
          value: ethers.parseEther(recipient.amount),
        });
        totalGas += estimateGas;
      }
    } else {
      // Simulate ERC20 transfers
      const token = TokenRegistry.getToken(currency);
      if (!token) {
        throw new Error(`Token not supported: ${currency}`);
      }

      const tokenAddress = typeof token.address === 'string' 
        ? token.address 
        : token.address.testnet;
      
      const contract = new ethers.Contract(
        tokenAddress,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
        ],
        tokenService.signer
      );

      for (const recipient of recipients) {
        const parsedAmount = ethers.parseUnits(recipient.amount, token.decimals);
        
        const estimateGas = await contract.transfer.estimateGas(
          recipient.address,
          parsedAmount
        );
        totalGas += estimateGas;
      }
    }

    logger.debug(`Simulated gas for ${recipients.length} transfers: ${totalGas.toString()}`);
    return totalGas;
  } catch (error: any) {
    logger.warn(`Transaction simulation failed: ${error.message}. Using baseline estimates.`);
    // Fall back to baseline calculation if simulation fails
    const baseEstimate = GAS_ESTIMATES[currency as keyof typeof GAS_ESTIMATES];
    if (baseEstimate) {
      return baseEstimate.base + baseEstimate.perTransfer * BigInt(recipients.length);
    }
    // Default fallback
    return BigInt(65000 + 60000 * recipients.length);
  }
}


export async function estimateGasFee(
  currency: string,
  recipients: Array<{ address: string; amount: string }>
): Promise<{
  estimatedGas: string;
  estimatedGasUSD: string;
  gasPrice: string;
  breakdown: {
    simulatedGas: string;
    buffer: number;
    bufferedGas: string;
    baseFeePerGas: string;
    tokenPrice: number;
  };
}> {
  try {
    // Validate recipients
    if (!recipients || recipients.length === 0) {
      throw new Error('No recipients provided for gas estimation');
    }

    // Get current fee data from network
    const feeData = await tokenService.provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(1000000000); // Default 1 Gwei

    // Simulate actual transaction to get real gas usage
    const simulatedGas = await simulateTransfer(currency, recipients);
    logger.debug(`Simulated gas: ${simulatedGas.toString()}`);

    // Get dynamic buffer based on network congestion
    const bufferMultiplier = await getDynamicGasBuffer();
    const bufferedGas = BigInt(Math.ceil(Number(simulatedGas) * bufferMultiplier));

    logger.info(`Gas buffer: ${(bufferMultiplier * 100 - 100).toFixed(1)}% due to network conditions`);

    // Calculate gas fee in wei
    const gasFeeWei = gasPrice * bufferedGas;

    // Get accurate token price
    const tokenPrice = await fetchTokenPrice(currency);

    // Convert gas fee to token units
    let gasFeeToken = ethers.formatUnits(gasFeeWei, 18); // Default for ETH
    
    if (currency !== 'ETH' && currency !== 'CELO') {
      const token = TokenRegistry.getToken(currency);
      if (token) {
        gasFeeToken = ethers.formatUnits(gasFeeWei, token.decimals);
      }
    }

    // Convert to USD using actual token price
    const gasFeeUSD = (Number(gasFeeToken) * tokenPrice).toFixed(6);

    logger.info(
      `⛽ Accurate gas estimate: ${currency} - ${gasFeeToken} tokens ($${gasFeeUSD} USD) for ${recipients.length} transfers`
    );

    return {
      estimatedGas: gasFeeToken,
      estimatedGasUSD: gasFeeUSD,
      gasPrice: ethers.formatUnits(gasPrice, 9), // In Gwei
      breakdown: {
        simulatedGas: simulatedGas.toString(),
        buffer: bufferMultiplier,
        bufferedGas: bufferedGas.toString(),
        baseFeePerGas: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 9) : '0',
        tokenPrice,
      },
    };
  } catch (error: any) {
    logger.error(`❌ Gas estimation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Quick gas estimation helper accepting count (for backward compatibility)
 * Returns simplified gas estimate without detailed breakdown
 */
export async function estimateGasFeeBatch(
  currency: string,
  requestCount: number
): Promise<{
  estimatedGas: string;
  estimatedGasUSD: string;
  gasPrice: string;
}> {
  try {
    // Create dummy recipients for simulation
    const mockRecipients = Array(requestCount).fill(null).map((_, i) => ({
      address: '0x' + '0'.repeat(40), // Dummy address for simulation
      amount: '0', // Minimal amount for simulation
    }));

    const estimate = await estimateGasFee(currency, mockRecipients);

    return {
      estimatedGas: estimate.estimatedGas,
      estimatedGasUSD: estimate.estimatedGasUSD,
      gasPrice: estimate.gasPrice,
    };
  } catch (error: any) {
    logger.error(`❌ Batch gas estimation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Execute batch transfer transaction (production-ready version)
 * Handles multiple transactions efficiently with proper tracking
 */
export async function executeBatchTransfer(
  currency: string,
  recipients: Array<{ address: string; amount: string }>
): Promise<{
  transactionHashes: string[];
  totalGasUsed: string;
  totalGasFeeNative: string; // Fee in native token (ETH/CELO)
  totalGasFeeUSD: string;
  blockNumbers: number[];
  timestamp: Date;
  recipientCount: number;
}> {
  try {
    if (!tokenService.signer) {
      throw new Error('No signer available for transactions');
    }

    if (recipients.length === 0) {
      throw new Error('No recipients provided');
    }

    // Validate all addresses
    for (const recipient of recipients) {
      if (!ethers.isAddress(recipient.address)) {
        throw new Error(`Invalid address: ${recipient.address}`);
      }
    }

    logger.info(
      `🔄 Processing batch transfer: ${currency} to ${recipients.length} recipients`
    );

    // Execute transfers and collect all transaction hashes and receipts
    const txResults = await (currency === 'ETH' || currency === 'CELO'
      ? executeNativeTransferBatch(recipients)
      : executeERC20TransferBatch(currency, recipients));

    // Wait for all transaction confirmations in parallel
    const receipts = await Promise.all(
      txResults.hashes.map((txHash) =>
        retryWithBackoff(
          () => tokenService.provider.waitForTransaction(txHash, 1),
          `Confirm transaction ${txHash}`
        )
      )
    );

    // Calculate totals from all receipts
    let totalGasUsed = BigInt(0);
    const blockNumbers: number[] = [];

    for (let i = 0; i < receipts.length; i++) {
      const receipt = receipts[i];
      if (!receipt) {
        throw new Error(`Transaction ${txResults.hashes[i]} failed to confirm`);
      }
      totalGasUsed += receipt.gasUsed;
      blockNumbers.push(receipt.blockNumber);
    }

    // Get native token price for USD conversion
    const nativeTokenPrice = await fetchTokenPrice(currency === 'CELO' ? 'CELO' : 'ETH');
    
    // Calculate gas fee in native token (always 18 decimals for ETH/CELO)
    const gasPriceWei = receipts[0]!.gasPrice || BigInt(0);
    const gasFeeWei = totalGasUsed * gasPriceWei;
    const gasFeeNative = ethers.formatUnits(gasFeeWei, getNativeTokenDecimals(currency));
    const gasFeeUSD = (Number(gasFeeNative) * nativeTokenPrice).toFixed(6);

    logger.info(
      `✅ Batch transfer completed: ${txResults.hashes.length} transactions - Total gas: ${totalGasUsed}, Fee: ${gasFeeNative} ${currency === 'CELO' ? 'CELO' : 'ETH'} ($${gasFeeUSD} USD)`
    );

    return {
      transactionHashes: txResults.hashes,
      totalGasUsed: totalGasUsed.toString(),
      totalGasFeeNative: gasFeeNative,
      totalGasFeeUSD: gasFeeUSD,
      blockNumbers,
      timestamp: new Date(),
      recipientCount: recipients.length,
    };
  } catch (error: any) {
    logger.error(`❌ Batch transfer failed: ${error.message}`);
    throw error;
  }
}

/**
 * Execute native token (ETH/CELO) batch transfers
 * Uses sequential execution with proper nonce management for reliability
 */
async function executeNativeTransferBatch(
  recipients: Array<{ address: string; amount: string }>
): Promise<{ hashes: string[] }> {
  const hashes: string[] = [];
  
  return retryWithBackoff(
    async () => {
      // Get initial nonce
      let nonce = await tokenService.signer!.getNonce();
      
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        
        try {
          // Build transaction with explicit nonce
          const tx = await retryWithBackoff(
            async () => {
              const txResponse = await tokenService.signer!.sendTransaction({
                to: recipient.address,
                value: ethers.parseEther(recipient.amount),
                nonce,
              });
              return txResponse;
            },
            `Native transfer to ${recipient.address}`
          );

          hashes.push(tx.hash);
          logger.debug(
            `📤 Native transfer [${i + 1}/${recipients.length}]: ${recipient.amount} ETH → ${recipient.address} (${tx.hash})`
          );

          // Increment nonce for next transaction
          nonce++;
        } catch (error) {
          logger.error(
            `❌ Native transfer failed for ${recipient.address}: ${(error as any).message}`
          );
          throw error;
        }
      }

      return { hashes };
    },
    'Native batch transfer'
  );
}

/**
 * Execute ERC20 token batch transfers
 * Collects all transaction hashes for proper tracking and confirmation
 */
async function executeERC20TransferBatch(
  currency: string,
  recipients: Array<{ address: string; amount: string }>
): Promise<{ hashes: string[] }> {
  const hashes: string[] = [];

  return retryWithBackoff(
    async () => {
      const token = TokenRegistry.getToken(currency);
      if (!token) {
        throw new Error(`Token not supported: ${currency}`);
      }

      let nonce = await tokenService.signer!.getNonce();

      const tokenAddress = typeof token.address === 'string' 
        ? token.address 
        : token.address.testnet; // Use testnet for now
      
      const contract = new ethers.Contract(
        tokenAddress,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address owner) view returns (uint256)',
        ],
        tokenService.signer!
      );

      // Check balance before proceeding
      const totalNeeded = recipients.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      const balance = await contract.balanceOf(tokenService.signer!.address);
      const balanceFormatted = ethers.formatUnits(balance, token.decimals);

      if (parseFloat(balanceFormatted) < totalNeeded) {
        throw new Error(
          `Insufficient balance: have ${balanceFormatted} ${currency}, need ${totalNeeded}`
        );
      }

      // Execute transfers with retry logic per recipient
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        
        try {
          const parsedAmount = ethers.parseUnits(recipient.amount, token.decimals);

          const txResponse = await retryWithBackoff(
            async () => {
              return await contract.transfer(recipient.address, parsedAmount, {
                nonce,
              });
            },
            `ERC20 transfer to ${recipient.address}`
          );

          hashes.push(txResponse.hash);
          logger.debug(
            `📤 ERC20 transfer [${i + 1}/${recipients.length}]: ${recipient.amount} ${currency} → ${recipient.address} (${txResponse.hash})`
          );

          // Increment nonce for next transaction
          nonce++;
        } catch (error) {
          logger.error(
            `❌ ERC20 transfer failed for ${recipient.address}: ${(error as any).message}`
          );
          throw error;
        }
      }

      return { hashes };
    },
    'ERC20 batch transfer'
  );
}

/**
 * Verify transaction on blockchain with retry logic
 */
export async function verifyTransaction(
  txHash: string
): Promise<{
  confirmed: boolean;
  blockNumber: number;
  gasUsed: string;
  status: 'success' | 'failed' | 'pending';
  confirmations: number;
}> {
  return retryWithBackoff(
    async () => {
      const receipt = await tokenService.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return {
          confirmed: false,
          blockNumber: 0,
          gasUsed: '0',
          status: 'pending',
          confirmations: 0,
        };
      }

      const currentBlock = await tokenService.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      return {
        confirmed: confirmations >= 1,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed',
        confirmations,
      };
    },
    `Verify transaction ${txHash}`
  );
}

/**
 * Get token balance for withdrawal service account with retry logic
 */
export async function getServiceAccountBalance(currency: string): Promise<string> {
  return retryWithBackoff(
    async () => {
      if (!tokenService.signer) {
        throw new Error('No signer available');
      }

      if (currency === 'ETH' || currency === 'CELO') {
        const balance = await tokenService.provider.getBalance(
          tokenService.signer.address
        );
        return ethers.formatEther(balance);
      }

      const balance = await tokenService.getTokenBalance(currency, tokenService.signer.address);
      return balance;
    },
    `Get ${currency} balance`
  );
}

/**
 * Check if service account has sufficient balance for batch
 */
export async function validateSufficientBalance(
  currency: string,
  totalAmount: string
): Promise<{
  sufficient: boolean;
  available: string;
  required: string;
  shortfall: string | null;
}> {
  return retryWithBackoff(
    async () => {
      const available = await getServiceAccountBalance(currency);
      const required = totalAmount;
      const availableNum = parseFloat(available);
      const requiredNum = parseFloat(required);

      const sufficient = availableNum >= requiredNum;
      const shortfall = sufficient ? null : (requiredNum - availableNum).toString();

      return {
        sufficient,
        available,
        required,
        shortfall,
      };
    },
    `Validate ${currency} balance for ${totalAmount}`
  );
}

/**
 * Poll for transaction confirmation with timeout and retry logic
 */
export async function pollForConfirmation(
  txHash: string,
  maxWaitBlocks: number = 100,
  checkIntervalMs: number = 3000
): Promise<{
  confirmed: boolean;
  blockNumber: number;
  confirmations: number;
  status: 'success' | 'failed' | 'timeout';
}> {
  return retryWithBackoff(
    async () => {
      const startBlock = await tokenService.provider.getBlockNumber();
      const deadline = startBlock + maxWaitBlocks;

      while (true) {
        const receipt = await tokenService.provider.getTransactionReceipt(txHash);

        if (receipt) {
          const currentBlock = await tokenService.provider.getBlockNumber();
          const confirmations = currentBlock - receipt.blockNumber;

          return {
            confirmed: true,
            blockNumber: receipt.blockNumber,
            confirmations,
            status: receipt.status === 1 ? 'success' : 'failed',
          };
        }

        const currentBlock = await tokenService.provider.getBlockNumber();
        if (currentBlock > deadline) {
          logger.warn(`⏱️ Transaction ${txHash} still not confirmed after ${maxWaitBlocks} blocks`);
          return {
            confirmed: false,
            blockNumber: currentBlock,
            confirmations: 0,
            status: 'timeout',
          };
        }

        await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
      }
    },
    `Poll for confirmation of ${txHash}`
  );
}

export const blockchainWithdrawalService = {
  estimateGasFee,
  estimateGasFeeBatch,
  executeBatchTransfer,
  verifyTransaction,
  getServiceAccountBalance,
  validateSufficientBalance,
  pollForConfirmation,
  // Helper functions
  fetchTokenPrice,
  getDynamicGasBuffer,
  simulateTransfer,
};
