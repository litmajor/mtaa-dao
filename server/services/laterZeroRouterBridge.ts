/**
 * LayerZeroBridge — wired to the deployed CrossChainBridge.sol router
 *
 * ─────────────────────────────────────────────────────────────────────────
 * This replaces the previous stub, which verified the LayerZero endpoint
 * address/eid but then unconditionally threw ("no OFT/bridge adapter
 * configured") since it had no actual contract to call. Now that
 * CrossChainBridge.sol is deployed per-chain, this class calls it for real.
 *
 * IMPORTANT — still required before this can move real funds:
 *   1. `ROUTER_DEPLOYMENTS` below must be filled in with the actual
 *      deployed CrossChainBridge address per chain. Left empty/undefined
 *      until you deploy — initiateTransfer() will refuse to proceed
 *      rather than guess.
 *   2. For each token you want to bridge (cUSD, MTAA, USDC...), deploy an
 *      OFTAdapter (or confirm it's natively OFT) on both source and
 *      destination chains, call setPeer() on the adapter itself, then
 *      call CrossChainBridge.setTokenAdapter(token, adapterAddress) and
 *      .mapToken(token, remoteEid, remoteAdapterAddress) on the router.
 *      This class does not do that setup — it only calls bridgeAssets()
 *      assuming setup is already done, and will surface the contract's
 *      own AdapterNotSet/TokenNotMapped reverts clearly if not.
 *   3. lzOptions: built here via a minimal manual encoding of LayerZero's
 *      "type 3" executor option for lzReceive gas. If you pull in
 *      `@layerzerolabs/lz-v2-utilities`, prefer its `Options` builder
 *      instead of the manual encoding below — it's less error-prone.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { ethers } from 'ethers';
import { getMultiChainProvider } from './multiChainProvider';
import { Logger } from '../utils/logger';

const logger = new Logger('bridge-integration:layerzero');

// Minimal ABI — only the functions/events this class actually calls.
const CROSS_CHAIN_BRIDGE_ABI = [
  'function quoteBridge(address token, uint256 amount, uint32 destinationEid, address destinationAddress, uint256 minAmountLDZ, bytes lzOptions) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee))',
  'function bridgeAssets(address token, uint256 amount, uint32 destinationEid, address destinationAddress, uint256 minAmountLDZ, bytes lzOptions) payable returns (bytes32 transferId)',
  'function recommendedGasLimit(uint32 eid) view returns (uint256)',
  'function tokenAdapters(address token) view returns (address)',
  'function tokenMappings(address token, uint32 eid) view returns (address)',
  'function supportedChains(uint32 eid) view returns (bool)',
  'event TransferInitiated(bytes32 indexed transferId, address indexed user, address indexed token, address adapter, uint256 amount, uint32 destinationEid, address destinationAddress, uint256 timestamp)',
];

// LayerZero V2 endpoint IDs — kept in sync with bridgeIntegration.ts's
// LZ_ENDPOINT_IDS. Consolidating these into one shared constants file is
// a good follow-up so the two don't drift.
export const LZ_ENDPOINT_IDS: Record<string, number> = {
  ethereum: 30101,
  bsc: 30102,
  polygon: 30109,
  arbitrum: 30110,
  optimism: 30111,
  avalanche: 30106,
  celo: 30125,
};

/**
 * Deployed CrossChainBridge router address per chain. Empty until you
 * actually deploy — every entry here should be filled in with a real
 * address and cross-checked against the chain's block explorer before
 * this is used for anything beyond testnet.
 */
export const ROUTER_DEPLOYMENTS: Partial<Record<string, string>> = {
  // celo: '0x...',      // NEEDS DEPLOYMENT
  // ethereum: '0x...',  // NEEDS DEPLOYMENT
};

export interface LzBridgeParams {
  sourceChain: string;
  targetChain: string;
  token: string; // underlying ERC20 address on sourceChain (e.g. cUSD)
  amount: string; // in token's smallest unit (respecting its decimals)
  recipientAddress: string;
  maxSlippageBps?: number; // used to compute minAmountLDZ; default matches contract's 500 (5%)
  signer: ethers.Signer;
}

export interface LzBridgeResult {
  transactionHash: string;
  transferId: string;
  sourceChain: string;
  targetChain: string;
  token: string;
  amount: string;
  recipient: string;
  nativeFeePaid: string;
}

export class LayerZeroRouterBridge {
  private getRouterAddress(chain: string): string {
    const addr = ROUTER_DEPLOYMENTS[chain];
    if (!addr) {
      throw new Error(
        `No CrossChainBridge router deployed/registered for chain "${chain}". ` +
        `Add its address to ROUTER_DEPLOYMENTS before bridging from/to this chain.`
      );
    }
    return addr;
  }

  private getEndpointId(chain: string): number {
    const eid = LZ_ENDPOINT_IDS[chain];
    if (!eid) {
      throw new Error(`No LayerZero V2 endpoint ID configured for chain "${chain}".`);
    }
    return eid;
  }

  private getContract(chain: string, signerOrProvider: ethers.Signer | ethers.Provider | any): ethers.Contract {
    const address = this.getRouterAddress(chain);
    return new ethers.Contract(address, CROSS_CHAIN_BRIDGE_ABI, signerOrProvider);
  }

  /**
   * Build minimal LayerZero V2 "type 3" executor options requesting a
   * fixed lzReceive gas limit. Encodes:
   *   uint16 TYPE_3 (=3)
   *   uint8  WORKER_ID (=1, executor)
   *   uint16 optionLength (=17: 1 byte optionType + 16 bytes params)
   *   uint8  OPTION_TYPE_LZRECEIVE (=1)
   *   uint128 gasLimit
   * See LayerZero's OptionsBuilder.sol for the canonical encoding this
   * mirrors — prefer swapping this for @layerzerolabs/lz-v2-utilities's
   * Options builder if/when it's added as a dependency.
   */
  private buildExecutorLzReceiveOption(gasLimit: bigint): string {
    const TYPE_3 = 3;
    const WORKER_ID_EXECUTOR = 1;
    const OPTION_TYPE_LZRECEIVE = 1;

    const gasLimitHex = gasLimit.toString(16).padStart(32, '0'); // uint128 = 16 bytes = 32 hex chars

    const optionPayload = `01${gasLimitHex}`; // optionType (1 byte) + gasLimit (16 bytes)
    const optionLength = optionPayload.length / 2; // bytes

    const encoded =
      TYPE_3.toString(16).padStart(4, '0') +
      WORKER_ID_EXECUTOR.toString(16).padStart(2, '0') +
      optionLength.toString(16).padStart(4, '0') +
      optionPayload;

    return '0x' + encoded;
  }

  /**
   * Quote the native fee required to bridge, without sending anything.
   */
  async quote(params: Omit<LzBridgeParams, 'signer'>): Promise<{ nativeFee: bigint }> {
    const provider = getMultiChainProvider().getProvider(params.sourceChain as any) as unknown as ethers.Provider;
    const contract = this.getContract(params.sourceChain, provider);
    const destinationEid = this.getEndpointId(params.targetChain);

    const recommendedGas: bigint = await contract.recommendedGasLimit(destinationEid);
    const lzOptions = this.buildExecutorLzReceiveOption(recommendedGas > 0n ? recommendedGas : 200000n);

    const minAmountLDZ = this.computeMinAmount(params.amount, params.maxSlippageBps ?? 500);

    const fee = await contract.quoteBridge(
      params.token,
      params.amount,
      destinationEid,
      params.recipientAddress,
      minAmountLDZ,
      lzOptions
    );

    return { nativeFee: fee.nativeFee };
  }

  /**
   * Execute a real cross-chain transfer through the deployed router.
   * Requires the user (via `params.signer`) to have already approved
   * the router to spend `params.token` — this class does not submit an
   * ERC20 approve transaction on the caller's behalf.
   */
  async bridge(params: LzBridgeParams): Promise<LzBridgeResult> {
    const { sourceChain, targetChain, token, amount, recipientAddress, signer } = params;

    logger.info(`[LayerZero] Bridging ${amount} of ${token} from ${sourceChain} to ${targetChain} -> ${recipientAddress}`);

    const contract = this.getContract(sourceChain, signer);
    const destinationEid = this.getEndpointId(targetChain);

    // Fail fast with a clear message instead of letting the chain revert
    // surface as an opaque "execution reverted" to the caller.
    const adapter: string = await contract.tokenAdapters(token);
    if (!adapter || adapter === ethers.ZeroAddress) {
      throw new Error(
        `No OFT/adapter registered for token ${token} on ${sourceChain}. ` +
        `Call CrossChainBridge.setTokenAdapter() first.`
      );
    }
    const remoteMapping: string = await contract.tokenMappings(token, destinationEid);
    if (!remoteMapping || remoteMapping === ethers.ZeroAddress) {
      throw new Error(
        `Token ${token} is not mapped for destination chain ${targetChain} (eid ${destinationEid}). ` +
        `Call CrossChainBridge.mapToken() first.`
      );
    }

    const recommendedGas: bigint = await contract.recommendedGasLimit(destinationEid);
    const lzOptions = this.buildExecutorLzReceiveOption(recommendedGas > 0n ? recommendedGas : 200000n);
    const minAmountLDZ = this.computeMinAmount(amount, params.maxSlippageBps ?? 500);

    const fee = await contract.quoteBridge(token, amount, destinationEid, recipientAddress, minAmountLDZ, lzOptions);

    const tx = await contract.bridgeAssets(
      token,
      amount,
      destinationEid,
      recipientAddress,
      minAmountLDZ,
      lzOptions,
      { value: fee.nativeFee }
    );

    const receipt = await tx.wait();

    const transferEvent = receipt.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === 'TransferInitiated');

    const transferId = transferEvent?.args?.transferId ?? ethers.ZeroHash;

    logger.info(`[LayerZero] Transfer initiated: ${receipt.hash} (transferId=${transferId})`);

    return {
      transactionHash: receipt.hash,
      transferId,
      sourceChain,
      targetChain,
      token,
      amount,
      recipient: recipientAddress,
      nativeFeePaid: fee.nativeFee.toString(),
    };
  }

  private computeMinAmount(amount: string, slippageBps: number): bigint {
    const amountBn = BigInt(amount);
    const bps = BigInt(Math.max(0, Math.min(10000, slippageBps)));
    return (amountBn * (10000n - bps)) / 10000n;
  }
}

export const layerZeroRouterBridge = new LayerZeroRouterBridge();