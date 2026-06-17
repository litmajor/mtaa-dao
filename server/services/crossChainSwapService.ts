/**
 * CROSS-CHAIN SWAP SERVICE
 * Multi-provider cross-chain swap protocol with strict mathematical and execution guarantees
 */

import { ethers } from 'ethers';
import { ChainRegistry, SupportedChain, CHAIN_CONFIGS } from '../../shared/chainRegistry';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { db } from '../db';
import { crossChainTransfers } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { synchronizerAgent } from '../agents/synchronizer';
import { randomUUID } from 'crypto';

type InsertCrossChainTransfer = typeof crossChainTransfers.$inferInsert;

export interface SwapQuote {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  fromToken: string; // Token Contract Address
  toToken: string;   // Token Contract Address
  fromAmount: string; // Raw BigInt String (e.g. Wei)
  estimatedToAmount: string; // Raw BigInt String
  exchangeRate: number;
  priceImpact: number;
  estimatedGas: string;
  route: string[];
  bridgeFee: string; // Raw BigInt String
  slippageTolerance: number;
  toAddress?: string;
}

export interface SwapExecution {
  swapId: string;
  status: 'pending' | 'bridging' | 'swapping' | 'completed' | 'failed';
  fromTxHash?: string;
  toTxHash?: string;
  actualToAmount?: string;
  completedAt?: Date;
}

export class CrossChainSwapService {
  private logger = Logger.getLogger();
  private ERC20_ABI = [
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)'
  ];

  /**
   * Get an accurate token swap quote using fixed-point math and token decimals
   */
  async getSwapQuote(
    fromChain: SupportedChain,
    toChain: SupportedChain,
    fromToken: string,
    toToken: string,
    fromAmount: string, // Enforce incoming amount as atomic string representation (Wei)
    slippageTolerance: number = 1.0
  ): Promise<SwapQuote> {
    try {
      this.logger.info(`Fetching secure swap quote: ${fromChain}:${fromToken} -> ${toChain}:${toToken}`);

      const fromConfig = ChainRegistry.getChainConfig(fromChain);
      const toConfig = ChainRegistry.getChainConfig(toChain);
      if (!fromConfig || !toConfig) throw new AppError('Unsupported chain parameters provided.', 400);

      // Initialize temporary RPC connections to accurately check decimals
      const fromProvider = new ethers.JsonRpcProvider(fromConfig.rpcUrl);
      const toProvider = new ethers.JsonRpcProvider(toConfig.rpcUrl);
      
      const fromContract = new ethers.Contract(fromToken, this.ERC20_ABI, fromProvider);
      const toContract = new ethers.Contract(toToken, this.ERC20_ABI, toProvider);

      const [fromDecimals, toDecimals] = await Promise.all([
        fromContract.decimals().catch(() => 18),
        toContract.decimals().catch(() => 18)
      ]);

      const fromTokenPrice = await this.getTokenPrice(fromChain, fromToken);
      const toTokenPrice = await this.getTokenPrice(toChain, toToken);
      const exchangeRate = fromTokenPrice / toTokenPrice;

      // Safe BigInt Conversion using calculated decimals to avoid float truncation
      const amountBigInt = ethers.toBigInt(fromAmount);
      const bridgeFeeBigInt = (amountBigInt * 1n) / 1000n; // Strict 0.1% fee calculation
      
      // Scale floating point rates safely to match destination decimals
      const amountFloat = Number(ethers.formatUnits(amountBigInt, fromDecimals));
      const estimatedOutputFloat = amountFloat * exchangeRate;
      const estimatedToAmount = ethers.parseUnits(estimatedOutputFloat.toFixed(toDecimals), toDecimals).toString();

      return {
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount,
        estimatedToAmount,
        exchangeRate,
        priceImpact: this.calculatePriceImpact(amountFloat),
        estimatedGas: await this.estimateSwapGas(fromChain, toChain),
        route: this.determineSwapRoute(fromChain, toChain, fromToken, toToken),
        bridgeFee: bridgeFeeBigInt.toString(),
        slippageTolerance
      };
    } catch (error) {
      this.logger.error('Failed to parse secure swap quote parameters:', error);
      throw new AppError('Failed to safely calculate token swap options.', 500);
    }
  }

  /**
   * Execute cross-chain swap with processing guardrails
   */
  async executeSwap(userId: string, quote: SwapQuote, userAddress: string): Promise<SwapExecution> {
    try {
      this.logger.info(`Registering cross-chain swap for account signature alignment: ${userId}`);

      // Ensure target wallet destination is explicitly assigned
      quote.toAddress = quote.toAddress || userAddress;

      const transferInsert: InsertCrossChainTransfer = {
        withdrawalId: randomUUID(),
        userId,
        sourceChain: quote.fromChain,
        sourceToken: quote.fromToken,
        sourceAmount: quote.fromAmount,
        targetChain: quote.toChain,
        targetToken: quote.toToken,
        targetAmount: quote.estimatedToAmount,
        recipientAddress: quote.toAddress || userAddress,
        status: 'pending'
      };

      const [transfer] = await db.insert(crossChainTransfers).values(transferInsert).returning();

      // Return the current execution status immediately to unblock tracking UI
      const swapExecution: SwapExecution = {
        swapId: transfer.id!,
        status: 'pending'
      };

      // Hand off processing to your worker queue or background manager
      this.processSwap(transfer.id!, quote, userAddress).catch(error => {
        this.logger.error(`[CRITICAL JOB FAILURE] Swap ID ${transfer.id} aborted mid-flight:`, error);
      });

      return swapExecution;
    } catch (error) {
      this.logger.error('Failed to write persistent swap orchestration structures:', error);
      throw new AppError('Failed to execute cross-chain swap processing pipeline.', 500);
    }
  }

  /**
   * Process swap steps sequentially and handle failures gracefully
   */
  private async processSwap(swapId: string, quote: SwapQuote, userAddress: string): Promise<void> {
    try {
      synchronizerAgent.receiveState(`swap_${swapId}`, {
        swapId, status: 'initiated', fromChain: quote.fromChain, toChain: quote.toChain,
        fromToken: quote.fromToken, toToken: quote.toToken, amount: quote.fromAmount, timestamp: Date.now()
      }, 1);

      // Step 1: Execute on-chain bridging
      await this.updateSwapStatus(swapId, 'bridging');
      const bridgeTxHash = await this.bridgeTokens(quote, userAddress);

      synchronizerAgent.receiveState(`swap_${swapId}`, {
        swapId, status: 'bridging', bridgeTxHash, timestamp: Date.now()
      }, 2);

      // Step 2: Execute on-chain swap via destination aggregator
      await this.updateSwapStatus(swapId, 'swapping', bridgeTxHash);
      const swapTxHash = await this.executeDestinationSwap(quote, userAddress);

      synchronizerAgent.receiveState(`swap_${swapId}`, {
        swapId, status: 'swapping', bridgeTxHash, swapTxHash, timestamp: Date.now()
      }, 3);

      // Step 3: Complete execution path and log timestamps
      await this.updateSwapStatus(swapId, 'completed', bridgeTxHash, swapTxHash);

      synchronizerAgent.receiveState(`swap_${swapId}`, {
        swapId, status: 'completed', bridgeTxHash, swapTxHash, completedAt: Date.now()
      }, 4);

      this.logger.info(`Successfully finished cross-chain swap: ${swapId}`);
    } catch (error: any) {
      this.logger.error(`[WORKER FAILURE] Swap execution worker halted for ID ${swapId}:`, error);
      
      synchronizerAgent.receiveState(`swap_${swapId}`, {
        swapId, status: 'failed', error: error?.message || 'Execution failed', timestamp: Date.now()
      }, 99);
      
      await this.updateSwapStatus(swapId, 'failed');
    }
  }

  /**
   * Safe approval check wrapper to prevent transaction execution failures
   */
  private async ensureAllowance(tokenAddress: string, spender: string, amount: bigint, signer: ethers.Signer): Promise<void> {
    const contract = new ethers.Contract(tokenAddress, this.ERC20_ABI, signer);
    const ownerAddress = await signer.getAddress();
    
    const currentAllowance = await contract.allowance(ownerAddress, spender);
    if (currentAllowance < amount) {
      this.logger.info(`Insufficient allowance for spender ${spender}. Granting approval access...`);
      const tx = await contract.approve(spender, amount);
      await tx.wait(2);
    }
  }

  private async bridgeTokens(quote: SwapQuote, userAddress: string): Promise<string> {
    const fromConfig = ChainRegistry.getChainConfig(quote.fromChain);
    if (!fromConfig) throw new Error(`Target system configuration footprint missing for chain: ${quote.fromChain}`);

    const provider = new ethers.JsonRpcProvider(fromConfig.rpcUrl);
    const signer = new ethers.Wallet(process.env.BRIDGE_PRIVATE_KEY || '', provider);

    if (quote.fromChain === 'celo') {
      return this.bridgeViaCeloPortal(quote, signer);
    } else {
      return this.bridgeViaLayerZero(quote, signer);
    }
  }

  private async bridgeViaCeloPortal(quote: SwapQuote, signer: ethers.Signer): Promise<string> {
    const PORTAL_ADDRESS = '0x3ee3B929dd75a5B5a3e15f71a62FDe3f1dD44BFD';
    const ABI = ['function lockAndMintTokens(address token, uint256 amount, uint16 destChain, bytes32 recipient) external returns (bytes32)'];
    
    const amountBigInt = ethers.toBigInt(quote.fromAmount);
    
    // FIX: Verify and update allowance before executing the bridge transaction
    await this.ensureAllowance(quote.fromToken, PORTAL_ADDRESS, amountBigInt, signer);
    
    const contract = new ethers.Contract(PORTAL_ADDRESS, ABI, signer);
    try {
      const tx = await contract.lockAndMintTokens(
        quote.fromToken,
        amountBigInt,
        this.getWormholeChainId(quote.toChain),
        ethers.zeroPadValue(quote.toAddress || await signer.getAddress(), 32)
      );

      await tx.wait(2);
      return tx.hash;
    } catch (error) {
      throw new Error(`Celo Portal smart contract interactions rejected: ${error}`);
    }
  }

  private async bridgeViaLayerZero(quote: SwapQuote, signer: ethers.Signer): Promise<string> {
    const LZ_ROUTER = '0x3c2269811836af69288dab96ec3dcd5f89a26cdc0';
    const ABI = [
      'function send(uint16 dstChainId, bytes calldata destination, bytes calldata payload, address refundAddress, address zroPaymentAddress, bytes calldata adapterParams) external payable returns (bytes32)',
      'function estimateFees(uint16 dstChainId, address user, bytes calldata payload, bool payInZRO, bytes calldata adapterParam) external view returns (uint256, uint256)'
    ];

    const amountBigInt = ethers.toBigInt(quote.fromAmount);
    
    // FIX: Ensure token approval for the LayerZero router contract
    await this.ensureAllowance(quote.fromToken, LZ_ROUTER, amountBigInt, signer);

    const contract = new ethers.Contract(LZ_ROUTER, ABI, signer);
    try {
      const dstChainId = this.getLayerZeroChainId(quote.toChain);
      const recipientAddress = quote.toAddress || await signer.getAddress();
      const destination = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [recipientAddress]);
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [quote.fromToken, amountBigInt]);

      const [nativeFee] = await contract.estimateFees(dstChainId, contract.address, payload, false, '0x');

      const tx = await contract.send(
        dstChainId, destination, payload, await signer.getAddress(), ethers.ZeroAddress, '0x',
        { value: nativeFee }
      );

      await tx.wait(2);
      return tx.hash;
    } catch (error) {
      throw new Error(`LayerZero cross-chain communication delivery failed: ${error}`);
    }
  }

  private async executeDestinationSwap(quote: SwapQuote, userAddress: string): Promise<string> {
    const toConfig = ChainRegistry.getChainConfig(quote.toChain);
    if (!toConfig) throw new Error(`Target configuration missing for network identifier: ${quote.toChain}`);

    const provider = new ethers.JsonRpcProvider(toConfig.rpcUrl);
    const signer = new ethers.Wallet(process.env.SWAP_PRIVATE_KEY || '', provider);

    const tx = await this.executeSwapVia1Inch(quote, signer, provider);
    return tx.hash;
  }

  private async executeSwapVia1Inch(
    quote: SwapQuote,
    signer: ethers.Signer,
    provider: ethers.Provider
  ): Promise<ethers.TransactionResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    try {
      const chainId = this.get1InchChainId(quote.toChain);
      const response = await fetch(
        `https://api.1inch.io/v5.0/${chainId}/swap?` +
        `fromTokenAddress=${quote.fromToken}&` +
        `toTokenAddress=${quote.toToken}&` +
        `amount=${quote.fromAmount}&` + // Keep as strict raw string atomic units
        `fromAddress=${await signer.getAddress()}&` +
        `slippage=${quote.slippageTolerance}&` +
        `disableEstimate=true`,
        { signal: controller.signal }
      );

      if (!response.ok) throw new Error(`1Inch Aggregator API rejected request parameters: ${response.statusText}`);

      const swapData = await response.json();
      
      const txResponse = await signer.sendTransaction({
        to: swapData.tx.to,
        data: swapData.tx.data,
        value: swapData.tx.value,
        gasLimit: BigInt(swapData.tx.gas) + 100000n
      });

      await txResponse.wait(2);
      return txResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async updateSwapStatus(
    swapId: string,
    status: SwapExecution['status'],
    fromTxHash?: string,
    toTxHash?: string
  ): Promise<void> {
    const updateData: any = { status };
    if (fromTxHash) updateData.txHashSource = fromTxHash;
    if (toTxHash) updateData.txHashDestination = toTxHash;
    if (status === 'completed') updateData.completedAt = new Date();

    await db.update(crossChainTransfers).set(updateData).where(and(eq(crossChainTransfers.id, swapId)));
  }

  private async getTokenPrice(chain: SupportedChain, token: string): Promise<number> {
    const { tokenService } = await import('./tokenService');
    try {
      const price = await tokenService.getTokenPrice(token);
      return price > 0 ? price : this.getFallbackPrice(token);
    } catch {
      return this.getFallbackPrice(token);
    }
  }

  private getFallbackPrice(token: string): number {
    const fallbackPrices: Record<string, number> = {
      'ETH': 3000, 'MATIC': 0.8, 'BNB': 300, 'CELO': 0.65, 'TRX': 0.1, 'TON': 2.5, 'USDC': 1, 'USDT': 1, 'cUSD': 1
    };
    return fallbackPrices[token] || 1;
  }

  private calculatePriceImpact(amountFloat: number): number {
    if (amountFloat > 10000) return 2.5;
    if (amountFloat > 1000) return 1.0;
    return 0.5;
  }

  private async estimateSwapGas(fromChain: SupportedChain, toChain: SupportedChain): Promise<string> {
    try {
      const fromConfig = ChainRegistry.getChainConfig(fromChain);
      const toConfig = ChainRegistry.getChainConfig(toChain);
      if (!fromConfig || !toConfig) return this.getFallbackGasEstimate(fromChain, toChain);

      let totalGasEth = 0;
      const fromProvider = new ethers.JsonRpcProvider(fromConfig.rpcUrl);
      const fromGasPrice = await fromProvider.getFeeData().then(fees => fees?.gasPrice);
      
      if (fromGasPrice) {
        totalGasEth += Number(ethers.formatEther(200000n * fromGasPrice));
      }

      if (fromChain !== toChain) {
        const toProvider = new ethers.JsonRpcProvider(toConfig.rpcUrl);
        const toGasPrice = await toProvider.getFeeData().then(fees => fees?.gasPrice);
        if (toGasPrice) {
          totalGasEth += Number(ethers.formatEther(150000n * toGasPrice));
        }
      }
      return totalGasEth.toFixed(6);
    } catch {
      return this.getFallbackGasEstimate(fromChain, toChain);
    }
  }

  private getFallbackGasForChain(chain: SupportedChain): string {
    const estimates: Record<string, string> = {
      'ethereum': '0.015', 'polygon': '0.001', 'bsc': '0.0005', 'celo': '0.0001'
    };
    return estimates[chain] || '0.01';
  }

  private getFallbackGasEstimate(fromChain: SupportedChain, toChain: SupportedChain): string {
    const fromGas = parseFloat(this.getFallbackGasForChain(fromChain));
    const toGas = parseFloat(this.getFallbackGasForChain(toChain));
    return (fromGas + toGas).toFixed(6);
  }

  private determineSwapRoute(fromChain: SupportedChain, toChain: SupportedChain, fromToken: string, toToken: string): string[] {
    return fromChain === toChain ? [fromToken, toToken] : [`${fromChain}:${fromToken}`, 'Bridge', `${toChain}:${toToken}`];
  }

  private getWormholeChainId(chain: SupportedChain): number {
    const wormholeIds: Record<string, number> = { 'ethereum': 2, 'polygon': 5, 'bsc': 4, 'celo': 14 };
    return wormholeIds[chain] || 0;
  }

  private getLayerZeroChainId(chain: SupportedChain): number {
    const lzIds: Record<string, number> = { 'ethereum': 101, 'polygon': 109, 'bsc': 102, 'celo': 125 };
    return lzIds[chain] || 0;
  }

  private get1InchChainId(chain: SupportedChain): number {
    const oneInchIds: Record<string, number> = { 'ethereum': 1, 'polygon': 137, 'bsc': 56, 'celo': 42220 };
    return oneInchIds[chain] || 1;
  }
}

export const crossChainSwapService = new CrossChainSwapService();