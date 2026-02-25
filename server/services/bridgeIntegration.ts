/**
 * Bridge Integration
 * Abstractions for LayerZero, Axelar, Wormhole, and Stargate protocols
 * Unified interface for cross-chain bridge operations
 */

import { SupportedChain, CHAIN_CONFIG } from '../../shared/chainConfiguration';
import { getMultiChainProvider } from './multiChainProvider';
import { Logger } from '../utils/logger';
import { ethers } from 'ethers';

const logger = new Logger('bridge-integration');

export type BridgeProtocol = 'layerzero' | 'axelar' | 'wormhole' | 'stargate';

export interface BridgeInitRequest {
  protocol: BridgeProtocol;
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  token: string;
  amount: string;        // In token units (decimal-adjusted)
  recipientAddress: string;
  estimatedGas?: string;
  refundAddress?: string;
}

export interface BridgeTransactionResult {
  transactionHash: string;
  bridgeProtocol: BridgeProtocol;
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  token: string;
  amount: string;
  recipient: string;
  status: 'initiated' | 'pending' | 'confirmed';
  nonce?: number;
  estimatedTime: number; // seconds
  bridgeContractAddress: string;
  details: Record<string, any>;
}

export interface BridgeStatus {
  protocol: BridgeProtocol;
  transactionHash: string;
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  status: 'not_found' | 'pending' | 'completed' | 'failed';
  sourceConfirmations: number;
  targetConfirmations?: number;
  completedAt?: Date;
  failureReason?: string;
}

/**
 * LayerZero Bridge Integration
 * https://layerzero.network
 */
class LayerZeroBridge {
  private readonly LZ_ENDPOINT_IDS: Record<SupportedChain, number> = {
    ethereum: 30101,
    bsc: 30102,
    polygon: 30109,
    arbitrum: 30110,
    optimism: 30111,
    tron: 30106,
    avalanche: 30106, // Using same as Tron for demo
  };

  private readonly LZ_CONTRACTS: Record<SupportedChain, string> = {
    ethereum: '0x66A71Dcef29A0ffBDBE3c6a460a0B5E3b7541e48',
    bsc: '0x3c2269811836af69497E5F486A85D7316753cf62b',
    polygon: '0x3c2269811836af69497E5F486A85D7316753cf62b',
    arbitrum: '0x3c2269811836af69497E5F486A85D7316753cf62b',
    optimism: '0x3c2269811836af69497E5F486A85D7316753cf62b',
    tron: 'TJeYq1F37Z5qb1qcRAKYZ2jQ3fJqQhBHJ1', // Tron format
    avalanche: '0x3c2269811836af69497E5F486A85D7316753cf62b',
  };

  async initiateTransfer(req: BridgeInitRequest): Promise<BridgeTransactionResult> {
    logger.info(`LayerZero: Initiating transfer ${req.amount} ${req.token} from ${req.sourceChain} to ${req.targetChain}`);

    try {
      const provider = getMultiChainProvider();
      
      // Get LayerZero endpoint ID for target chain
      const targetEndpointId = this.LZ_ENDPOINT_IDS[req.targetChain];
      if (!targetEndpointId) {
        throw new Error(`LayerZero not supported on ${req.targetChain}`);
      }

      // In production, would encode the actual message for the OFT (Omnichain Fungible Token)
      // For now, we simulate the bridge call
      const bridgeContract = this.LZ_CONTRACTS[req.sourceChain];

      return {
        transactionHash: `0x${Math.random().toString(16).slice(2)}`, // Mock
        bridgeProtocol: 'layerzero',
        sourceChain: req.sourceChain,
        targetChain: req.targetChain,
        token: req.token,
        amount: req.amount,
        recipient: req.recipientAddress,
        status: 'initiated',
        estimatedTime: 900, // 15 minutes
        bridgeContractAddress: bridgeContract,
        details: {
          lzEndpointId: targetEndpointId,
          messageType: 'OFT_SEND',
          feesInLz: '0.1', // Mock fee
        },
      };
    } catch (error) {
      logger.error(`LayerZero bridge failed: ${(error as any).message}`);
      throw error;
    }
  }

  async checkStatus(req: {
    transactionHash: string;
    sourceChain: SupportedChain;
    targetChain: SupportedChain;
  }): Promise<BridgeStatus> {
    try {
      const provider = getMultiChainProvider();

      // Check source chain transaction
      const receipt = await provider.getTransactionReceipt(req.sourceChain, req.transactionHash);

      if (!receipt) {
        return {
          protocol: 'layerzero',
          transactionHash: req.transactionHash,
          sourceChain: req.sourceChain,
          targetChain: req.targetChain,
          status: 'not_found',
          sourceConfirmations: 0,
        };
      }

      // Check confirmations on source chain
      const blockNumber = await provider.getBlockNumber(req.sourceChain);
      const sourceConfirmations = blockNumber - receipt.blockNumber;

      // In production, would query LayerZero's off-chain relayers for status
      const isConfirmed = sourceConfirmations >= CHAIN_CONFIG[req.sourceChain]!.requiredConfirmations;

      return {
        protocol: 'layerzero',
        transactionHash: req.transactionHash,
        sourceChain: req.sourceChain,
        targetChain: req.targetChain,
        status: isConfirmed ? 'completed' : 'pending',
        sourceConfirmations,
      };
    } catch (error) {
      logger.error(`Failed to check LayerZero status: ${(error as any).message}`);
      throw error;
    }
  }
}

/**
 * Axelar Bridge Integration
 * https://axelar.network
 */
class AxelarBridge {
  private readonly AXELAR_GATEWAY: Record<SupportedChain, string> = {
    ethereum: '0x4F4495243F435e49714a5c46b360900383E486A20F',
    bsc: '0x304acf330bbE08d1e512eefaa92529827c1Eb3b0',
    polygon: '0x6d4A64C57612841b6f5d5476d3510b64F371d1f1',
    arbitrum: '0xe432859B7d5DA5c4f220bBED4261F9952Df56B72',
    optimism: '0xe432859B7d5DA5c4f220bBED4261F9952Df56B72',
    tron: 'TXDdZUV5ztEwQfv7YKDtxKAL8HCkXwhKmn',
    avalanche: '0x5029C0EFf6C34351a0CEc334542cDb22c7928f78',
  };

  async initiateTransfer(req: BridgeInitRequest): Promise<BridgeTransactionResult> {
    logger.info(`Axelar: Initiating transfer ${req.amount} ${req.token} from ${req.sourceChain} to ${req.targetChain}`);

    try {
      const gatewayAddress = this.AXELAR_GATEWAY[req.sourceChain];
      if (!gatewayAddress) {
        throw new Error(`Axelar not supported on ${req.sourceChain}`);
      }

      // In production, would call the Axelar gateway contract
      // For now, we simulate it
      const targetChainName = this.mapChainToAxelarName(req.targetChain);

      return {
        transactionHash: `0x${Math.random().toString(16).slice(2)}`, // Mock
        bridgeProtocol: 'axelar',
        sourceChain: req.sourceChain,
        targetChain: req.targetChain,
        token: req.token,
        amount: req.amount,
        recipient: req.recipientAddress,
        status: 'initiated',
        estimatedTime: 1800, // 30 minutes
        bridgeContractAddress: gatewayAddress,
        details: {
          targetChain: targetChainName,
          messageType: 'SEND_TOKEN',
          cosmosChainId: `axelar-${targetChainName}`,
        },
      };
    } catch (error) {
      logger.error(`Axelar bridge failed: ${(error as any).message}`);
      throw error;
    }
  }

  async checkStatus(req: {
    transactionHash: string;
    sourceChain: SupportedChain;
    targetChain: SupportedChain;
  }): Promise<BridgeStatus> {
    try {
      const provider = getMultiChainProvider();
      const receipt = await provider.getTransactionReceipt(req.sourceChain, req.transactionHash);

      if (!receipt) {
        return {
          protocol: 'axelar',
          transactionHash: req.transactionHash,
          sourceChain: req.sourceChain,
          targetChain: req.targetChain,
          status: 'not_found',
          sourceConfirmations: 0,
        };
      }

      const blockNumber = await provider.getBlockNumber(req.sourceChain);
      const sourceConfirmations = blockNumber - receipt.blockNumber;
      const isConfirmed = sourceConfirmations >= CHAIN_CONFIG[req.sourceChain]!.requiredConfirmations;

      // In production, would query Axelar's network state
      return {
        protocol: 'axelar',
        transactionHash: req.transactionHash,
        sourceChain: req.sourceChain,
        targetChain: req.targetChain,
        status: isConfirmed ? 'completed' : 'pending',
        sourceConfirmations,
      };
    } catch (error) {
      logger.error(`Failed to check Axelar status: ${(error as any).message}`);
      throw error;
    }
  }

  private mapChainToAxelarName(chain: SupportedChain): string {
    const mapping: Record<SupportedChain, string> = {
      ethereum: 'ethereum',
      bsc: 'binance',
      polygon: 'polygon',
      arbitrum: 'arbitrum',
      optimism: 'optimism',
      tron: 'tron',
      avalanche: 'avalanche',
    };
    return mapping[chain] || chain;
  }
}

/**
 * Wormhole Bridge Integration
 * https://wormhole.com
 */
class WormholeBridge {
  private readonly WORMHOLE_CONTRACTS: Record<SupportedChain, string> = {
    ethereum: '0x98f3c9e6E3fAce36bAAd05FE09E7845BF1da40e7',
    bsc: '0x98f3c9e6E3fAce36bAAd05FE09E7845BF1da40e7',
    polygon: '0x5a58505Fa1c4aCB0dd8d5A2a6be48d9938Afc119',
    arbitrum: '0xa7b23d0C5c13D0b076bB186d5e6C16f64092e906D',
    optimism: '0x27428DD2d3DD076cAF8c694fA27064455ad9f51a',
    tron: 'TrojeXvgmF5eb2zkeJBXXiriNzrRy6XR9L',
    avalanche: '0x0e082F06FF657FE51D4130a6fb85F5476d1Ad2c7',
  };

  async initiateTransfer(req: BridgeInitRequest): Promise<BridgeTransactionResult> {
    logger.info(`Wormhole: Initiating transfer ${req.amount} ${req.token} from ${req.sourceChain} to ${req.targetChain}`);

    try {
      const contractAddress = this.WORMHOLE_CONTRACTS[req.sourceChain];
      if (!contractAddress) {
        throw new Error(`Wormhole not supported on ${req.sourceChain}`);
      }

      // In production, would call Wormhole's core bridge contract
      const targetChainId = this.mapChainToWormholeChainId(req.targetChain);

      return {
        transactionHash: `0x${Math.random().toString(16).slice(2)}`, // Mock
        bridgeProtocol: 'wormhole',
        sourceChain: req.sourceChain,
        targetChain: req.targetChain,
        token: req.token,
        amount: req.amount,
        recipient: req.recipientAddress,
        status: 'initiated',
        estimatedTime: 600, // 10 minutes
        bridgeContractAddress: contractAddress,
        details: {
          wormholeChainId: targetChainId,
          messageType: 'ATTESTATION',
          fee: '0.01', // Wormhole fee in source token
        },
      };
    } catch (error) {
      logger.error(`Wormhole bridge failed: ${(error as any).message}`);
      throw error;
    }
  }

  async checkStatus(req: {
    transactionHash: string;
    sourceChain: SupportedChain;
    targetChain: SupportedChain;
  }): Promise<BridgeStatus> {
    try {
      const provider = getMultiChainProvider();
      const receipt = await provider.getTransactionReceipt(req.sourceChain, req.transactionHash);

      if (!receipt) {
        return {
          protocol: 'wormhole',
          transactionHash: req.transactionHash,
          sourceChain: req.sourceChain,
          targetChain: req.targetChain,
          status: 'not_found',
          sourceConfirmations: 0,
        };
      }

      const blockNumber = await provider.getBlockNumber(req.sourceChain);
      const sourceConfirmations = blockNumber - receipt.blockNumber;
      const isConfirmed = sourceConfirmations >= CHAIN_CONFIG[req.sourceChain]!.requiredConfirmations;

      return {
        protocol: 'wormhole',
        transactionHash: req.transactionHash,
        sourceChain: req.sourceChain,
        targetChain: req.targetChain,
        status: isConfirmed ? 'completed' : 'pending',
        sourceConfirmations,
      };
    } catch (error) {
      logger.error(`Failed to check Wormhole status: ${(error as any).message}`);
      throw error;
    }
  }

  private mapChainToWormholeChainId(chain: SupportedChain): number {
    const mapping: Record<SupportedChain, number> = {
      ethereum: 2,
      bsc: 4,
      polygon: 5,
      arbitrum: 23,
      optimism: 24,
      tron: 25,
      avalanche: 6,
    };
    return mapping[chain] || 0;
  }
}

/**
 * Stargate Bridge Integration
 * https://stargate.finance
 * Optimized for stablecoins (USDC, USDT)
 */
class StargateBridge {
  private readonly STARGATE_ROUTERS: Record<SupportedChain, string> = {
    ethereum: '0x8731d54E9D02c286e8E619896917AF364D27625CF',
    bsc: '0x4a364f8c717cAAD9bC1d0c43b9dEd24bD3d1f889',
    polygon: '0x45A01E4e04211DA126240E292E1FF2B5B5ed5f1b',
    arbitrum: '0x53Bf833A5d6c4ddA888F69c22C88fb4011d1C929',
    optimism: '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b',
    tron: 'TXqohXshx1bDPJ3pP7xDk7MK2ERvDGhP1R',
    avalanche: '0x45A01E4e04211DA126240E292E1FF2B5B5ed5f1b',
  };

  async initiateTransfer(req: BridgeInitRequest): Promise<BridgeTransactionResult> {
    logger.info(`Stargate: Initiating transfer ${req.amount} ${req.token} from ${req.sourceChain} to ${req.targetChain}`);

    try {
      // Stargate is optimized for stablecoins
      if (!['USDC', 'USDT'].includes(req.token)) {
        throw new Error(`Stargate only supports USDC and USDT, got ${req.token}`);
      }

      const routerAddress = this.STARGATE_ROUTERS[req.sourceChain];
      if (!routerAddress) {
        throw new Error(`Stargate not supported on ${req.sourceChain}`);
      }

      const targetChainId = this.mapChainToStargateChainId(req.targetChain);

      return {
        transactionHash: `0x${Math.random().toString(16).slice(2)}`, // Mock
        bridgeProtocol: 'stargate',
        sourceChain: req.sourceChain,
        targetChain: req.targetChain,
        token: req.token,
        amount: req.amount,
        recipient: req.recipientAddress,
        status: 'initiated',
        estimatedTime: 300, // 5 minutes - fastest bridge
        bridgeContractAddress: routerAddress,
        details: {
          stargateChainId: targetChainId,
          poolId: req.token === 'USDC' ? 1 : 2,
          messageType: 'SWAP_REMOTE',
          swapFee: '0.0001', // 0.01% - cheapest option
        },
      };
    } catch (error) {
      logger.error(`Stargate bridge failed: ${(error as any).message}`);
      throw error;
    }
  }

  async checkStatus(req: {
    transactionHash: string;
    sourceChain: SupportedChain;
    targetChain: SupportedChain;
  }): Promise<BridgeStatus> {
    try {
      const provider = getMultiChainProvider();
      const receipt = await provider.getTransactionReceipt(req.sourceChain, req.transactionHash);

      if (!receipt) {
        return {
          protocol: 'stargate',
          transactionHash: req.transactionHash,
          sourceChain: req.sourceChain,
          targetChain: req.targetChain,
          status: 'not_found',
          sourceConfirmations: 0,
        };
      }

      const blockNumber = await provider.getBlockNumber(req.sourceChain);
      const sourceConfirmations = blockNumber - receipt.blockNumber;
      const isConfirmed = sourceConfirmations >= CHAIN_CONFIG[req.sourceChain]!.requiredConfirmations;

      return {
        protocol: 'stargate',
        transactionHash: req.transactionHash,
        sourceChain: req.sourceChain,
        targetChain: req.targetChain,
        status: isConfirmed ? 'completed' : 'pending',
        sourceConfirmations,
      };
    } catch (error) {
      logger.error(`Failed to check Stargate status: ${(error as any).message}`);
      throw error;
    }
  }

  private mapChainToStargateChainId(chain: SupportedChain): number {
    const mapping: Record<SupportedChain, number> = {
      ethereum: 101,
      bsc: 102,
      polygon: 109,
      arbitrum: 110,
      optimism: 111,
      tron: 108,
      avalanche: 106,
    };
    return mapping[chain] || 0;
  }
}

/**
 * Unified Bridge Interface
 */
export class BridgeIntegration {
  private layerzero = new LayerZeroBridge();
  private axelar = new AxelarBridge();
  private wormhole = new WormholeBridge();
  private stargate = new StargateBridge();

  /**
   * Initiate a bridge transfer using the specified protocol
   */
  async initiate(req: BridgeInitRequest): Promise<BridgeTransactionResult> {
    logger.info(`Initiating ${req.protocol} bridge: ${req.amount} ${req.token} ${req.sourceChain} → ${req.targetChain}`);

    switch (req.protocol) {
      case 'layerzero':
        return this.layerzero.initiateTransfer(req);
      case 'axelar':
        return this.axelar.initiateTransfer(req);
      case 'wormhole':
        return this.wormhole.initiateTransfer(req);
      case 'stargate':
        return this.stargate.initiateTransfer(req);
      default:
        throw new Error(`Unknown bridge protocol: ${req.protocol}`);
    }
  }

  /**
   * Check the status of a bridge transfer
   */
  async checkStatus(
    protocol: BridgeProtocol,
    transactionHash: string,
    sourceChain: SupportedChain,
    targetChain: SupportedChain
  ): Promise<BridgeStatus> {
    const statusReq = { transactionHash, sourceChain, targetChain };

    switch (protocol) {
      case 'layerzero':
        return this.layerzero.checkStatus(statusReq);
      case 'axelar':
        return this.axelar.checkStatus(statusReq);
      case 'wormhole':
        return this.wormhole.checkStatus(statusReq);
      case 'stargate':
        return this.stargate.checkStatus(statusReq);
      default:
        throw new Error(`Unknown bridge protocol: ${protocol}`);
    }
  }

  /**
   * Get supported protocols for a chain pair
   */
  getSupportedProtocols(sourceChain: SupportedChain, targetChain: SupportedChain): BridgeProtocol[] {
    const sourceConfig = CHAIN_CONFIG[sourceChain];
    const targetConfig = CHAIN_CONFIG[targetChain];
    
    if (!sourceConfig || !targetConfig) return [];

    // Find protocols supported by both source and target
    const sourceProtocols = new Set(sourceConfig.bridges.filter(b => b.active).map(b => b.protocol));
    const targetProtocols = new Set(targetConfig.bridges.filter(b => b.active).map(b => b.protocol));

    const supported: BridgeProtocol[] = [];
    sourceProtocols.forEach(protocol => {
      if (targetProtocols.has(protocol)) {
        supported.push(protocol as BridgeProtocol);
      }
    });

    return supported;
  }

  /**
   * Recommend best protocol for a transfer
   */
  recommendProtocol(
    sourceChain: SupportedChain,
    targetChain: SupportedChain,
    token: string,
    priority: 'cost' | 'speed' = 'cost'
  ): BridgeProtocol {
    const supported = this.getSupportedProtocols(sourceChain, targetChain);
    if (!supported.length) throw new Error('No bridges available for this pair');

    // Stargate for stablecoins (cheapest)
    if (['USDC', 'USDT'].includes(token) && supported.includes('stargate')) {
      return priority === 'speed' ? 'wormhole' : 'stargate';
    }

    // Wormhole for speed
    if (priority === 'speed' && supported.includes('wormhole')) {
      return 'wormhole';
    }

    // LayerZero for general tokens
    if (supported.includes('layerzero')) {
      return 'layerzero';
    }

    // Fallback to first available
    return supported[0];
  }
}

/**
 * Singleton instance
 */
let instance: BridgeIntegration | null = null;

export function initializeBridgeIntegration(): BridgeIntegration {
  if (!instance) {
    instance = new BridgeIntegration();
  }
  return instance;
}

export function getBridgeIntegration(): BridgeIntegration {
  if (!instance) {
    instance = new BridgeIntegration();
  }
  return instance;
}

export function destroyBridgeIntegration(): void {
  instance = null;
}
