/**
 * CROSS-CHAIN MESSAGING PROTOCOL SERVICE
 * Multi-protocol interchain messaging pipeline supporting LayerZero V1 and Axelar GMP
 */

import { ethers } from 'ethers';
import { createWalletIfValid } from '../utils/cryptoWallet';
import { ChainRegistry, SupportedChain, CHAIN_CONFIGS } from '../../shared/chainRegistry';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { resolveProviderUrls } from './providerBootstrap';
import { ResilientRpcProvider } from './resilientRpcProvider';

export interface LayerZeroConfig {
  endpoint: string;
  chainId: number;
}

export interface AxelarConfig {
  gateway: string;
  gasReceiver: string;
}

export interface BridgeProtocolDependencies {
  createWallet?: (privateKey: string, provider: ethers.Provider) => any;
  createContract?: (address: string, abi: string[], signer: ethers.Signer | ethers.Provider) => any;
  createResilientProvider?: (providerUrl: string) => { call: (callback: (provider: ethers.Provider) => Promise<any>) => Promise<any> };
  // Optional test-time overrides to avoid relying on global CHAIN_CONFIGS or env state
  providerUrl?: string;
  destinationAppAddress?: string;
}

// Hardened Endpoint Registries (EVM Target Routing Only)
export const LAYERZERO_ENDPOINTS: Record<string, LayerZeroConfig> = {
  [SupportedChain.CELO]: { endpoint: '0x3A73033C0b1407574C76BdBAc67f126f6b4a9AA9', chainId: 125 },
  [SupportedChain.ETHEREUM]: { endpoint: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675', chainId: 101 },
  [SupportedChain.POLYGON]: { endpoint: '0x3c2269811836af69497E5F486A85D7316753cf62', chainId: 109 },
  [SupportedChain.BSC]: { endpoint: '0x3c2269811836af69497E5F486A85D7316753cf62', chainId: 102 },
  [SupportedChain.OPTIMISM]: { endpoint: '0x3c2269811836af69497E5F486A85D7316753cf62', chainId: 111 },
  [SupportedChain.ARBITRUM]: { endpoint: '0x3c2269811836af69497E5F486A85D7316753cf62', chainId: 110 }
};

// Fixed Axelar Gateways to remove copy-paste configuration hazards
export const AXELAR_GATEWAYS: Record<string, AxelarConfig> = {
  [SupportedChain.CELO]: { gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31', gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712' },
  [SupportedChain.ETHEREUM]: { gateway: '0x4F4495243837681061C4743b74B3eEdf548D56A5', gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712' },
  [SupportedChain.POLYGON]: { gateway: '0x6f015F16De9fC8791b234eF68D486d2bF203FBA8', gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712' },
  [SupportedChain.BSC]: { gateway: '0x3005B0e230aa31b26569ecAcb9D3325c345Fa7E8', gasReceiver: '0x2d5d7d31F671F86C782533cc367F14109a082712' }
};

export class BridgeProtocolService {
  private logger = Logger.getLogger();
  // Lightweight shape describing both the real ResilientRpcProvider and test doubles
  private typeResilient = undefined as unknown as {
    call: (callback: (provider: ethers.Provider) => Promise<any>) => Promise<any>;
  };
  
  private createResilientProvider(providerUrl: string): ResilientRpcProvider {
    const providerUrls = resolveProviderUrls();
    return new ResilientRpcProvider({
      primary: { name: 'primary-rpc', httpUrl: providerUrl },
      fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
      cooldownMs: 60_000,
      onFailover: (from, to, reason) => this.logger.warn(`Bridge RPC failover ${from} -> ${to}: ${reason}`),
    });
  }
  
  // Minimal ABIs required to execute actual on-chain cross-chain messaging
  private LZ_ENDPOINT_ABI = [
    'function send(uint16 _dstChainId, bytes calldata _destination, bytes calldata _payload, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) external payable',
    'function estimateFees(uint16 _dstChainId, address _userApplication, bytes calldata _payload, bool _payInZRO, bytes calldata _adapterParam) external view returns (uint256 nativeFee, uint256 zroFee)'
  ];

  private AXELAR_GATEWAY_ABI = [
    'function callContract(string calldata destinationChain, string calldata destinationAddress, bytes calldata payload) external'
  ];

  /**
   * Dispatches an absolute cross-chain message execution payload via LayerZero Endpoint
   */
  async sendLayerZeroMessage(
    sourceChain: SupportedChain,
    destChain: SupportedChain,
    payload: string,
    adapterParams: string = '0x',
    deps?: BridgeProtocolDependencies
  ): Promise<string> {
    try {
      const sourceConfig = LAYERZERO_ENDPOINTS[sourceChain];
      const destConfig = LAYERZERO_ENDPOINTS[destChain];

      // FIX: Block invalid configurations or non-EVM runtimes early
      if (!sourceConfig || !destConfig) {
        throw new AppError(`Target system runtime limits match boundaries: ${sourceChain} -> ${destChain}`, 400);
      }

      // Initialize provider connections dynamically
      const providerUrl = deps?.providerUrl || CHAIN_CONFIGS[sourceChain]?.rpcUrl || resolveProviderUrls().rpcUrl;
      if (!providerUrl) throw new AppError(`No RPC provider found for source chain: ${sourceChain}`, 400);
      
      const resilientProvider: { call: (callback: (provider: ethers.Provider) => Promise<any>) => Promise<any> } =
        deps?.createResilientProvider?.(providerUrl) ?? this.createResilientProvider(providerUrl);
      if (!resilientProvider) throw new AppError('Resilient provider unavailable', 500);
      const receipt = await resilientProvider.call(async (provider) => {
        const signer = deps?.createWallet
          ? deps.createWallet(process.env.BRIDGE_PRIVATE_KEY || '', provider)
          : createWalletIfValid(process.env.BRIDGE_PRIVATE_KEY, provider);
        if (!signer) throw new AppError('Missing or invalid BRIDGE_PRIVATE_KEY for bridge protocol operations', 500);

        const contractFactory = deps?.createContract ?? ((address: string, abi: string[], signerOrProvider: ethers.Signer | ethers.Provider) => new ethers.Contract(address, abi, signerOrProvider as any));
        const lzEndpointContract = contractFactory(sourceConfig.endpoint, this.LZ_ENDPOINT_ABI, signer);
        const payloadBytes = ethers.toUtf8Bytes(payload);
        
        // Target application contract configuration details
        const destinationAppAddress = deps?.destinationAppAddress || CHAIN_CONFIGS[destChain]?.bridgeContract;
        if (!destinationAppAddress) throw new AppError(`Destination system module tracking address missing on: ${destChain}`, 400);
        
        const destinationPacked = ethers.solidityPacked(['address', 'address'], [destinationAppAddress, sourceConfig.endpoint]);

        // FIX: Accurate live gas estimation instead of hardcoded strings
        const [nativeFee] = await lzEndpointContract.estimateFees(
          destConfig.chainId,
          signer.address,
          payloadBytes,
          false,
          adapterParams
        );

        this.logger.info(`Dispatching LayerZero cross-chain payload transaction via RPC: ${sourceChain} -> ${destChain}`);

        // Dispatch execution payload to target network endpoint router
        const tx = await lzEndpointContract.send(
          destConfig.chainId,
          destinationPacked,
          payloadBytes,
          signer.address, // Fee refund destination address
          ethers.ZeroAddress,
          adapterParams,
          { value: nativeFee }
        );

        const receipt = await tx.wait(2);
        return receipt.hash;
      });
      return receipt;
    } catch (error) {
      this.logger.error('LayerZero transaction dispatch execution halted:', error);
      throw new AppError('Failed to complete interchain verification payload delivery.', 500);
    }
  }

  /**
   * Dispatches an absolute cross-chain message execution payload via Axelar GMP Gateway
   */
  async sendAxelarMessage(
    sourceChain: SupportedChain,
    destChain: SupportedChain,
    destContract: string,
    payload: string,
    deps?: BridgeProtocolDependencies
  ): Promise<string> {
    try {
      const sourceConfig = AXELAR_GATEWAYS[sourceChain];
      const destConfig = AXELAR_GATEWAYS[destChain];

      if (!sourceConfig || !destConfig) {
        throw new AppError(`Target routing boundaries lack Axelar deployments: ${sourceChain} -> ${destChain}`, 400);
      }

      const providerUrl = CHAIN_CONFIGS[sourceChain]?.rpcUrl || resolveProviderUrls().rpcUrl;
      if (!providerUrl) throw new AppError(`No RPC configuration discovered: ${sourceChain}`, 400);
      
      const resilientProvider: { call: (callback: (provider: ethers.Provider) => Promise<any>) => Promise<any> } =
        deps?.createResilientProvider?.(providerUrl) ?? this.createResilientProvider(providerUrl);
      if (!resilientProvider) throw new AppError('Resilient provider unavailable', 500);
      const receiptHash = await resilientProvider.call(async (provider) => {
        const signer = deps?.createWallet
          ? deps.createWallet(process.env.BRIDGE_PRIVATE_KEY || '', provider)
          : createWalletIfValid(process.env.BRIDGE_PRIVATE_KEY, provider);
        if (!signer) throw new AppError('Missing or invalid BRIDGE_PRIVATE_KEY for bridge protocol operations', 500);

        const contractFactory = deps?.createContract ?? ((address: string, abi: string[], signerOrProvider: ethers.Signer | ethers.Provider) => new ethers.Contract(address, abi, signerOrProvider as any));
        const gatewayContract = contractFactory(sourceConfig.gateway, this.AXELAR_GATEWAY_ABI, signer);
        const payloadBytes = ethers.toUtf8Bytes(payload);

        this.logger.info(`Dispatching Axelar General Message Passing transaction...`);

        // Execute cross-chain application call across network identifiers
        const tx = await gatewayContract.callContract(
          destChain.toString(), // Axelar chain identifier string
          destContract,
          payloadBytes
        );

        const receipt = await tx.wait(2);
        return receipt.hash;
      });
      return receiptHash;
    } catch (error) {
      this.logger.error('Axelar contract communication delivery execution failed:', error);
      throw new AppError('Failed to execute Axelar message call.', 500);
    }
  }

  /**
   * Fetch live LayerZero gas estimations
   */
  async estimateLayerZeroFees(
    sourceChain: SupportedChain,
    destChain: SupportedChain,
    payload: string,
    adapterParams: string = '0x'
  , deps?: BridgeProtocolDependencies
  ): Promise<string> {
    const sourceConfig = LAYERZERO_ENDPOINTS[sourceChain];
    const destConfig = LAYERZERO_ENDPOINTS[destChain];
    if (!sourceConfig || !destConfig) return '0';

    try {
      const providerUrl = CHAIN_CONFIGS[sourceChain]?.rpcUrl || resolveProviderUrls().rpcUrl;
      if (!providerUrl) return ethers.parseEther('0.005').toString();

      const resilientProvider: { call: (callback: (provider: ethers.Provider) => Promise<any>) => Promise<any> } =
        deps?.createResilientProvider?.(providerUrl) ?? this.createResilientProvider(providerUrl);

      if (!resilientProvider) throw new AppError('Resilient provider unavailable', 500);
      const fees = await resilientProvider.call(async (provider) => {
        const contractForFees = new ethers.Contract(sourceConfig.endpoint, this.LZ_ENDPOINT_ABI, provider);
        return contractForFees.estimateFees(
          destConfig.chainId,
          ethers.ZeroAddress,
          ethers.toUtf8Bytes(payload),
          false,
          adapterParams
        );
      });

      // `fees` is expected to be a tuple [nativeFee, zroFee]
      const nativeFee = Array.isArray(fees) ? fees[0] : fees;
      return (nativeFee as bigint).toString();
    } catch {
      return ethers.parseEther('0.005').toString(); // Safely formatted fallback
    }
  }
}

export const bridgeProtocolService = new BridgeProtocolService();