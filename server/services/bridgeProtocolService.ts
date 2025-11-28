
import { ethers } from 'ethers';
import { ChainRegistry, SupportedChain, CHAIN_CONFIGS } from '../../shared/chainRegistry';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface LayerZeroConfig {
  endpoint: string;
  chainId: number;
}

export interface AxelarConfig {
  gateway: string;
  gasReceiver: string;
}

export const LAYERZERO_ENDPOINTS: Record<SupportedChain, LayerZeroConfig> = {
  [SupportedChain.CELO]: {
    endpoint: '0x3A73033C0b1407574C76BdBAc67f126f6b4a9AA9',
    chainId: 125
  },
  [SupportedChain.CELO_ALFAJORES]: {
    endpoint: '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1',
    chainId: 14002
  },
  [SupportedChain.ETHEREUM]: {
    endpoint: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675',
    chainId: 101
  },
  [SupportedChain.POLYGON]: {
    endpoint: '0x3c2269811836af69497E5F486A85D7316753cf62',
    chainId: 109
  },
  [SupportedChain.POLYGON_MUMBAI]: {
    endpoint: '0x6edce65f5bc78db0899dc2813cac82f8bb6e6a72',
    chainId: 10109
  },
  [SupportedChain.BSC]: {
    endpoint: '0x3c2269811836af69497E5F486A85D7316753cf62',
    chainId: 102
  },
  [SupportedChain.BSC_TESTNET]: {
    endpoint: '0x6edce65f5bc78db0899dc2813cac82f8bb6e6a72',
    chainId: 10102
  },
  [SupportedChain.OPTIMISM]: {
    endpoint: '0x3c2269811836af69497E5F486A85D7316753cf62',
    chainId: 111
  },
  [SupportedChain.ARBITRUM]: {
    endpoint: '0x3c2269811836af69497E5F486A85D7316753cf62',
    chainId: 110
  },
  [SupportedChain.TRON]: {
    endpoint: '0x3c2269811836af69497E5F486A85D7316753cf62',
    chainId: 199
  },
  [SupportedChain.TRON_SHASTA]: {
    endpoint: '0x6edce65f5bc78db0899dc2813cac82f8bb6e6a72',
    chainId: 10199
  },
  [SupportedChain.TON]: {
    endpoint: '0x3c2269811836af69497E5F486A85D7316753cf62',
    chainId: 198
  },
  [SupportedChain.TON_TESTNET]: {
    endpoint: '0x6edce65f5bc78db0899dc2813cac82f8bb6e6a72',
    chainId: 10198
  }
};

export const AXELAR_GATEWAYS: Record<SupportedChain, AxelarConfig> = {
  [SupportedChain.CELO]: {
    gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.CELO_ALFAJORES]: {
    gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.ETHEREUM]: {
    gateway: '0x4F4495243837681061C4743b74B3eEdf548D56A5',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.POLYGON]: {
    gateway: '0x6f015F16De9fC8791b234eF68D486d2bF203FBA8',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.POLYGON_MUMBAI]: {
    gateway: '0x6f015F16De9fC8791b234eF68D486d2bF203FBA8',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.BSC]: {
    gateway: '0x4F4495243837681061C4743b74B3eEdf548D56A5',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.BSC_TESTNET]: {
    gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.OPTIMISM]: {
    gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.ARBITRUM]: {
    gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.TRON]: {
    gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.TRON_SHASTA]: {
    gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.TON]: {
    gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  },
  [SupportedChain.TON_TESTNET]: {
    gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31',
    gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712'
  }
};

export class BridgeProtocolService {
  private logger = Logger.getLogger();

  /**
   * Send cross-chain message via LayerZero
   */
  async sendLayerZeroMessage(
    sourceChain: SupportedChain,
    destChain: SupportedChain,
    payload: string,
    adapterParams: string = '0x'
  ): Promise<string> {
    try {
      const sourceConfig = LAYERZERO_ENDPOINTS[sourceChain];
      const destConfig = LAYERZERO_ENDPOINTS[destChain];

      if (!sourceConfig || !destConfig) {
        throw new AppError('Unsupported chain for LayerZero', 400);
      }

      const provider = ChainRegistry.getProvider(sourceChain);
      const bridgeContract = CHAIN_CONFIGS[sourceChain].bridgeContract;

      if (!bridgeContract) {
        throw new AppError('Bridge contract not deployed', 400);
      }

      // Estimate fees
      const fees = await this.estimateLayerZeroFees(
        sourceChain,
        destChain,
        payload,
        adapterParams
      );

      this.logger.info(`Sending LayerZero message from ${sourceChain} to ${destChain}`, {
        payload,
        fees
      });

      return `lz_${Date.now()}_${sourceChain}_${destChain}`;
    } catch (error) {
      this.logger.error('LayerZero message failed:', error);
      throw new AppError('Failed to send LayerZero message', 500);
    }
  }

  /**
   * Send cross-chain message via Axelar
   */
  async sendAxelarMessage(
    sourceChain: SupportedChain,
    destChain: SupportedChain,
    destContract: string,
    payload: string
  ): Promise<string> {
    try {
      const sourceConfig = AXELAR_GATEWAYS[sourceChain];
      const destConfig = AXELAR_GATEWAYS[destChain];

      if (!sourceConfig || !destConfig) {
        throw new AppError('Unsupported chain for Axelar', 400);
      }

      const provider = ChainRegistry.getProvider(sourceChain);
      const bridgeContract = CHAIN_CONFIGS[sourceChain].bridgeContract;

      if (!bridgeContract) {
        throw new AppError('Bridge contract not deployed', 400);
      }

      this.logger.info(`Sending Axelar message from ${sourceChain} to ${destChain}`, {
        destContract,
        payload
      });

      return `axl_${Date.now()}_${sourceChain}_${destChain}`;
    } catch (error) {
      this.logger.error('Axelar message failed:', error);
      throw new AppError('Failed to send Axelar message', 500);
    }
  }

  /**
   * Estimate LayerZero fees
   */
  private async estimateLayerZeroFees(
    sourceChain: SupportedChain,
    destChain: SupportedChain,
    payload: string,
    adapterParams: string
  ): Promise<string> {
    // Mock estimation - replace with actual LayerZero endpoint call
    const baseGas = '0.005'; // ETH/MATIC/etc
    return baseGas;
  }

  /**
   * Estimate Axelar fees
   */
  async estimateAxelarFees(
    sourceChain: SupportedChain,
    destChain: SupportedChain,
    payload: string
  ): Promise<string> {
    // Mock estimation - replace with actual Axelar gas service call
    const baseGas = '0.005'; // ETH/MATIC/etc
    return baseGas;
  }
}

export const bridgeProtocolService = new BridgeProtocolService();
