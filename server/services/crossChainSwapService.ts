
import { ethers } from 'ethers';
import { ChainRegistry, SupportedChain } from '../../shared/chainRegistry';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { db } from '../db';
import { crossChainTransfers } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { synchronizerAgent } from '../agents/synchronizer';

export interface SwapQuote {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount?: string;  // Added for actual/estimated output amount
  estimatedToAmount: string;
  exchangeRate: number;
  priceImpact: number;
  estimatedGas: string;
  route: string[];
  bridgeFee: string;
  slippageTolerance: number;
  toAddress?: string; // Added for recipient address
}

export interface SwapExecution {
  swapId: string;
  status: 'pending' | 'bridging' | 'swapping' | 'completed' | 'failed';
  fromTxHash?: string;
  toTxHash?: string;
  actualToAmount?: string;
  completedAt?: Date;
}

/**
 * Cross-Chain Swap Service
 * Enables token swaps across different blockchains
 */
export class CrossChainSwapService {
  private logger = Logger.getLogger();

  /**
   * Get swap quote for cross-chain token swap
   */
  async getSwapQuote(
    fromChain: SupportedChain,
    toChain: SupportedChain,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    slippageTolerance: number = 1.0
  ): Promise<SwapQuote> {
    try {
      this.logger.info(`Getting swap quote: ${fromChain}:${fromToken} -> ${toChain}:${toToken}`);

      // Get token prices
      const fromTokenPrice = await this.getTokenPrice(fromChain, fromToken);
      const toTokenPrice = await this.getTokenPrice(toChain, toToken);

      // Calculate exchange rate
      const exchangeRate = fromTokenPrice / toTokenPrice;
      const estimatedToAmount = (parseFloat(fromAmount) * exchangeRate).toString();

      // Estimate bridge fee (0.1% of amount)
      const bridgeFee = (parseFloat(fromAmount) * 0.001).toString();

      // Calculate price impact (simplified)
      const priceImpact = this.calculatePriceImpact(fromAmount, fromToken);

      // Estimate gas
      const estimatedGas = await this.estimateSwapGas(fromChain, toChain);

      // Determine route
      const route = this.determineSwapRoute(fromChain, toChain, fromToken, toToken);

      return {
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount,
        estimatedToAmount,
        exchangeRate,
        priceImpact,
        estimatedGas,
        route,
        bridgeFee,
        slippageTolerance
      };
    } catch (error) {
      this.logger.error('Failed to get swap quote:', error);
      throw new AppError('Failed to get swap quote', 500);
    }
  }

  /**
   * Execute cross-chain swap
   */
  async executeSwap(
    userId: string,
    quote: SwapQuote,
    userAddress: string
  ): Promise<SwapExecution> {
    try {
      this.logger.info(`Executing cross-chain swap for user ${userId}`);

      // Create swap record
      const [transfer] = await db.insert(crossChainTransfers).values({
        userId,
        sourceChain: quote.fromChain,
        destinationChain: quote.toChain,
        tokenAddress: quote.fromToken,
        amount: quote.fromAmount,
        destinationAddress: userAddress,
        status: 'pending'
      }).returning();

      const swapExecution: SwapExecution = {
        swapId: transfer.id!,
        status: 'pending'
      };

      // Start async swap execution
      this.processSwap(transfer.id!, quote, userAddress).catch(error => {
        this.logger.error(`Swap ${transfer.id} failed:`, error);
      });

      return swapExecution;
    } catch (error) {
      this.logger.error('Failed to execute swap:', error);
      throw new AppError('Failed to execute swap', 500);
    }
  }

  /**
   * Process swap asynchronously
   */
  private async processSwap(
    swapId: string,
    quote: SwapQuote,
    userAddress: string
  ): Promise<void> {
    try {
      // Sync state to Synchronizer before bridging
      synchronizerAgent.receiveState(`swap_${swapId}`, {
        swapId,
        status: 'initiated',
        fromChain: quote.fromChain,
        toChain: quote.toChain,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        amount: quote.fromAmount,
        timestamp: Date.now()
      }, 1);

      // Step 1: Bridge tokens from source chain
      await this.updateSwapStatus(swapId, 'bridging');
      const bridgeTxHash = await this.bridgeTokens(quote, userAddress);

      // Sync bridging state
      synchronizerAgent.receiveState(`swap_${swapId}`, {
        swapId,
        status: 'bridging',
        bridgeTxHash,
        timestamp: Date.now()
      }, 2);

      // Step 2: Execute swap on destination chain
      await this.updateSwapStatus(swapId, 'swapping', bridgeTxHash);
      const swapTxHash = await this.executeDestinationSwap(quote, userAddress);

      // Sync swapping state
      synchronizerAgent.receiveState(`swap_${swapId}`, {
        swapId,
        status: 'swapping',
        bridgeTxHash,
        swapTxHash,
        timestamp: Date.now()
      }, 3);

      // Step 3: Complete swap
      await this.updateSwapStatus(swapId, 'completed', bridgeTxHash, swapTxHash);

      // Final state sync
      synchronizerAgent.receiveState(`swap_${swapId}`, {
        swapId,
        status: 'completed',
        bridgeTxHash,
        swapTxHash,
        completedAt: Date.now()
      }, 4);

      this.logger.info(`Swap ${swapId} completed successfully`);
    } catch (error) {
      this.logger.error(`Swap ${swapId} processing failed:`, error);
      
      // Sync failure state
      synchronizerAgent.receiveState(`swap_${swapId}`, {
        swapId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      }, 99);
      
      await this.updateSwapStatus(swapId, 'failed');
    }
  }

  /**
   * Bridge tokens to destination chain using real bridge protocol
   */
  private async bridgeTokens(
    quote: SwapQuote,
    userAddress: string
  ): Promise<string> {
    const { CHAIN_CONFIGS } = await import('../../shared/chainRegistry');
    const fromConfig = CHAIN_CONFIGS[quote.fromChain as SupportedChain];

    if (!fromConfig) {
      throw new Error(`No chain config for ${quote.fromChain}`);
    }

    const provider = new ethers.JsonRpcProvider(fromConfig.rpcUrl);
    const signer = new ethers.Wallet(process.env.BRIDGE_PRIVATE_KEY || '', provider);

    // Determine bridge protocol based on chains
    let txHash: string;

    if (quote.fromChain === 'celo') {
      // Use Celo native bridge for Celo → other chains
      txHash = await this.bridgeViaCeloPortal(quote, signer);
    } else {
      // Use LayerZero for general cross-chain bridging
      txHash = await this.bridgeViaLayerZero(quote, signer);
    }

    this.logger.info(`Bridge initiated: ${quote.fromToken} from ${quote.fromChain} to ${quote.toChain}`, {
      txHash,
      amount: quote.fromAmount
    });

    return txHash;
  }

  /**
   * Bridge via Celo Portal (native Celo bridge)
   */
  private async bridgeViaCeloPortal(quote: SwapQuote, signer: ethers.Signer): Promise<string> {
    const PORTAL_ADDRESS = '0x3ee3B929dd75a5B5a3e15f71a62FDe3f1dD44BFD'; // Celo Portal on mainnet
    const ABI = [
      'function lockAndMintTokens(address token, uint256 amount, uint16 destChain, bytes32 recipient) external returns (bytes32)'
    ];

    const contract = new ethers.Contract(PORTAL_ADDRESS, ABI, signer);

    try {
      const tx = await contract.lockAndMintTokens(
        quote.fromToken,
        ethers.parseEther(quote.fromAmount),
        this.getWormholeChainId(quote.toChain),
        ethers.zeroPadValue(quote.toAddress || await signer.getAddress(), 32)
      );

      await tx.wait(2); // Wait for 2 confirmations
      return tx.hash;
    } catch (error) {
      throw new Error(`Celo Portal bridge failed: ${error}`);
    }
  }

  /**
   * Bridge via LayerZero (general purpose cross-chain)
   */
  private async bridgeViaLayerZero(quote: SwapQuote, signer: ethers.Signer): Promise<string> {
    const LZ_ROUTER = '0x3c2269811836af69288dab96ec3dcd5f89a26cdc0'; // LayerZero endpoint (varies by chain)
    
    const ABI = [
      'function send(uint16 dstChainId, bytes calldata destination, bytes calldata payload, address refundAddress, address zroPaymentAddress, bytes calldata adapterParams) external payable returns (bytes32)'
    ];

    const contract = new ethers.Contract(LZ_ROUTER, ABI, signer);

    try {
      const dstChainId = this.getLayerZeroChainId(quote.toChain);
      const recipientAddress = quote.toAddress || await signer.getAddress();
      const destination = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [recipientAddress]);
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [quote.fromToken, ethers.parseEther(quote.fromAmount)]
      );

      // Estimate LayerZero fees
      const [nativeFee, zroFee] = await (contract as any).estimateFees(dstChainId, contract.address, payload, false, '0x');

      const tx = await contract.send(
        dstChainId,
        destination,
        payload,
        await signer.getAddress(),
        ethers.ZeroAddress,
        '0x',
        { value: nativeFee }
      );

      await tx.wait(2);
      return tx.hash;
    } catch (error) {
      throw new Error(`LayerZero bridge failed: ${error}`);
    }
  }

  /**
   * Execute swap on destination chain via DEX aggregator
   */
  private async executeDestinationSwap(
    quote: SwapQuote,
    userAddress: string
  ): Promise<string> {
    const { CHAIN_CONFIGS } = await import('../../shared/chainRegistry');
    const toConfig = CHAIN_CONFIGS[quote.toChain as SupportedChain];

    if (!toConfig) {
      throw new Error(`No chain config for ${quote.toChain}`);
    }

    const provider = new ethers.JsonRpcProvider(toConfig.rpcUrl);
    const signer = new ethers.Wallet(process.env.SWAP_PRIVATE_KEY || '', provider);

    // Use 1Inch aggregator for best route
    const tx = await this.executeSwapVia1Inch(quote, signer, provider);

    this.logger.info(`Destination swap executed on ${quote.toChain}`, {
      txHash: tx.hash,
      fromToken: quote.fromToken,
      toToken: quote.toToken,
      outputAmount: quote.estimatedToAmount
    });

    return tx.hash;
  }

  /**
   * Execute swap via 1Inch DEX Aggregator
   */
  private async executeSwapVia1Inch(
    quote: SwapQuote,
    signer: ethers.Signer,
    provider: ethers.Provider
  ): Promise<ethers.ContractTransactionResponse> {
    const ROUTER_V5 = '0x1111111254fb6c44bac0bed2854e76f90643097d'; // 1Inch router (universal)

    // Get swap data from 1Inch API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(
        `https://api.1inch.io/v5.0/${this.get1InchChainId(quote.toChain)}/swap?` +
        `fromTokenAddress=${quote.fromToken}&` +
        `toTokenAddress=${quote.toToken}&` +
        `amount=${ethers.parseEther(quote.fromAmount)}&` +
        `fromAddress=${await signer.getAddress()}&` +
        `slippage=1&` +
        `disableEstimate=true`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error(`1Inch API error: ${response.statusText}`);
      }

      const swapData = await response.json();

      // Execute swap
      const txResponse = await signer.sendTransaction({
        to: swapData.tx.to,
        data: swapData.tx.data,
        value: swapData.tx.value,
        gasLimit: BigInt(swapData.tx.gas) + BigInt(100000) // Add buffer
      });

      await txResponse.wait(2);
      return txResponse as unknown as ethers.ContractTransactionResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Update swap status
   */
  private async updateSwapStatus(
    swapId: string,
    status: SwapExecution['status'],
    fromTxHash?: string,
    toTxHash?: string
  ): Promise<void> {
    const updateData: any = { 
      status: status === 'completed' || status === 'failed' ? status : 'bridging'
    };
    
    if (fromTxHash) updateData.txHashSource = fromTxHash;
    if (toTxHash) updateData.txHashDestination = toTxHash;
    if (status === 'completed') updateData.completedAt = new Date();

    await db.update(crossChainTransfers)
      .set(updateData)
      .where(eq(crossChainTransfers.id, swapId));
  }

  /**
   * Get real token price from multiple sources
   */
  private async getTokenPrice(chain: SupportedChain, token: string): Promise<number> {
    // Import tokenService dynamically to avoid circular dependencies
    const { tokenService } = await import('./tokenService');
    
    try {
      const price = await tokenService.getTokenPrice(token);
      return price > 0 ? price : this.getFallbackPrice(token);
    } catch (error) {
      console.warn(`Failed to get price for ${token}, using fallback:`, error);
      return this.getFallbackPrice(token);
    }
  }

  /**
   * Fallback prices if oracle fails
   */
  private getFallbackPrice(token: string): number {
    const fallbackPrices: Record<string, number> = {
      'ETH': 3000,
      'MATIC': 0.8,
      'BNB': 300,
      'CELO': 0.65,
      'TRX': 0.1,
      'TON': 2.5,
      'USDC': 1,
      'USDT': 1,
      'cUSD': 1,
      'cEUR': 1.09
    };
    return fallbackPrices[token] || 1;
  }

  /**
   * Calculate price impact
   */
  private calculatePriceImpact(amount: string, token: string): number {
    // Simplified price impact calculation
    const amountNum = parseFloat(amount);
    if (amountNum > 10000) return 2.5;
    if (amountNum > 1000) return 1.0;
    return 0.5;
  }

  /**
   * Estimate swap gas costs using real provider calls
   */
  private async estimateSwapGas(
    fromChain: SupportedChain,
    toChain: SupportedChain
  ): Promise<string> {
    try {
      // Get providers for both chains
      const { CHAIN_CONFIGS } = await import('../../shared/chainRegistry');
      const fromConfig = CHAIN_CONFIGS[fromChain as SupportedChain];
      const toConfig = CHAIN_CONFIGS[toChain as SupportedChain];

      if (!fromConfig || !toConfig) {
        console.warn(`Chain config not found for ${fromChain} or ${toChain}, using fallback`);
        return this.getFallbackGasEstimate(fromChain, toChain);
      }

      // Estimate gas for swap on source chain
      let totalGasEth = 0;

      try {
        const fromProvider = new ethers.JsonRpcProvider(fromConfig.rpcUrl);
        const fromGasPrice = await fromProvider.getFeeData().then(fees => fees?.gasPrice || null);
        if (fromGasPrice) {
          // Typical swap: 150k-200k gas
          const swapGas = BigInt('200000');
          const swapCostWei = swapGas * fromGasPrice;
          totalGasEth += Number(ethers.formatEther(swapCostWei));
        } else {
          throw new Error('Could not fetch gas price');
        }
      } catch (error) {
        console.warn(`Failed to estimate gas on ${fromChain}:`, error);
        totalGasEth += parseFloat(this.getFallbackGasForChain(fromChain));
      }

      // If cross-chain, estimate bridge gas
      if (fromChain !== toChain) {
        try {
          const toProvider = new ethers.JsonRpcProvider(toConfig.rpcUrl);
          const toGasPrice = await toProvider.getFeeData().then(fees => fees?.gasPrice || null);
          if (toGasPrice) {
            // Bridge receipt: 100k-150k gas
            const bridgeGas = BigInt('150000');
            const bridgeCostWei = bridgeGas * toGasPrice;
            totalGasEth += Number(ethers.formatEther(bridgeCostWei));
          } else {
            throw new Error('Could not fetch gas price');
          }
        } catch (error) {
          console.warn(`Failed to estimate bridge gas on ${toChain}:`, error);
          totalGasEth += parseFloat(this.getFallbackGasForChain(toChain));
        }
      }

      return totalGasEth.toFixed(6);
    } catch (error) {
      console.error('Gas estimation failed:', error);
      return this.getFallbackGasEstimate(fromChain, toChain);
    }
  }

  /**
   * Fallback gas estimate by chain
   */
  private getFallbackGasForChain(chain: SupportedChain): string {
    const estimates: Record<string, string> = {
      'ethereum': '0.015',
      'polygon': '0.001',
      'bsc': '0.0005',
      'celo': '0.0001',
      'tron': '0.00001',
      'ton': '0.0001',
      'optimism': '0.001',
      'arbitrum': '0.001'
    };
    return estimates[chain] || '0.01';
  }

  /**
   * Fallback gas estimate for cross-chain swap
   */
  private getFallbackGasEstimate(
    fromChain: SupportedChain,
    toChain: SupportedChain
  ): string {
    const fromGas = parseFloat(this.getFallbackGasForChain(fromChain));
    const toGas = parseFloat(this.getFallbackGasForChain(toChain));
    return (fromGas + toGas).toFixed(6);
  }

  /**
   * Determine swap route
   */
  private determineSwapRoute(
    fromChain: SupportedChain,
    toChain: SupportedChain,
    fromToken: string,
    toToken: string
  ): string[] {
    if (fromChain === toChain) {
      return [fromToken, toToken];
    }

    // Cross-chain route includes bridging
    return [
      `${fromChain}:${fromToken}`,
      'Bridge',
      `${toChain}:${toToken}`
    ];
  }

  /**
   * Get swap status
   */
  async getSwapStatus(swapId: string): Promise<SwapExecution | null> {
    try {
      const transfer = await db.query.crossChainTransfers.findFirst({
        where: eq(crossChainTransfers.id, swapId)
      });

      if (!transfer) return null;

      return {
        swapId: transfer.id,
        status: transfer.status as SwapExecution['status'],
        fromTxHash: transfer.txHashSource || undefined,
        toTxHash: transfer.txHashDestination || undefined,
        actualToAmount: undefined, // Not tracked in this schema
        completedAt: transfer.completedAt || undefined
      };
    } catch (error) {
      this.logger.error('Failed to get swap status:', error);
      return null;
    }
  }

  /**
   * Get Wormhole chain ID for bridge protocol
   */
  private getWormholeChainId(chain: SupportedChain): number {
    const wormholeIds: Record<string, number> = {
      'ethereum': 2,
      'polygon': 5,
      'bsc': 4,
      'celo': 14,
      'arbitrum': 23,
      'optimism': 24,
      'ton': 30,
      'tron': 25
    };
    return wormholeIds[chain] || 0;
  }

  /**
   * Get LayerZero chain ID for bridge protocol
   */
  private getLayerZeroChainId(chain: SupportedChain): number {
    const lzIds: Record<string, number> = {
      'ethereum': 101,
      'polygon': 109,
      'bsc': 102,
      'celo': 125,
      'arbitrum': 110,
      'optimism': 111,
      'avalanche': 106,
      'fantom': 112
    };
    return lzIds[chain] || 0;
  }

  /**
   * Get 1Inch chain ID for DEX aggregator
   */
  private get1InchChainId(chain: SupportedChain): number {
    const oneInchIds: Record<string, number> = {
      'ethereum': 1,
      'polygon': 137,
      'bsc': 56,
      'celo': 42220,
      'arbitrum': 42161,
      'optimism': 10,
      'avalanche': 43114,
      'fantom': 250,
      'ton': 0,
      'tron': 0
    };
    return oneInchIds[chain] || 1;
  }
}

export const crossChainSwapService = new CrossChainSwapService();
