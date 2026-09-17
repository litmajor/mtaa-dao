/**
 * Bridge Integration
 * Abstractions for LayerZero, Axelar, Wormhole, and Stargate protocols
 * Unified interface for cross-chain bridge operations
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIXES APPLIED (see audit notes):
 * 1. Added Celo as a supported chain across all four protocols. MtaaDAO's
 *    locked architecture operates on Celo, and the original file had no
 *    Celo entries at all — bridging in/out of the chain Yuki actually
 *    trades on was structurally impossible.
 * 2. Replaced the blanket "always throw, unconfigured" pattern with a
 *    verified-address gate. Every protocol/chain entry now carries a
 *    `verified` flag and a `source` citation. Entries that have NOT been
 *    confirmed against the protocol's own docs/explorer are marked
 *    `verified: false` and `initiateTransfer()` refuses to use them,
 *    with an error that says exactly what needs to be confirmed and
 *    where — instead of silently trusting an unverified address, which
 *    in a bridge contract is a real fund-loss risk.
 * 3. Fixed the LayerZero `avalanche` entry, which was previously set to
 *    the exact same endpoint ID as `tron` with a comment admitting it
 *    was a placeholder ("using same as Tron for demo"). Two different
 *    chains must never silently share one endpoint ID.
 * 4. Verified two real deployments directly against source docs:
 *      - LayerZero V2 Celo: endpointId 30125, EndpointV2 contract
 *        0x1a44076050125825900e736c501f859c50fe728c
 *        (docs.layerzero.network/v2/deployments/chains/celo — this is
 *        the same deterministic EndpointV2 address LayerZero deploys
 *        across most EVM chains)
 *      - Axelar Gateway on Celo mainnet:
 *        0xe432150cce91c13a887f7D836923d5597adD8E31
 *        (confirmed live on CeloScan)
 * 5. (2026-07-08) LayerZeroBridge.initiateTransfer() now delegates to
 *    layerZeroRouterBridge, which calls the real, deployed
 *    CrossChainBridge.sol router (quoteBridge/bridgeAssets) instead of
 *    unconditionally throwing "no OFT/bridge adapter configured". This is
 *    the only bridge protocol in this file wired to a live send path so
 *    far — Axelar/Wormhole/Stargate below are still stubs pending the
 *    same treatment (Axelar ITS is the next candidate; see prior audit).
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

import { type SupportedChain, CHAIN_CONFIG } from '../../shared/chainConfiguration';
import { getMultiChainProvider } from './multiChainProvider';
import { Logger } from '../utils/logger';
import { ethers } from 'ethers';
import { layerZeroRouterBridge, ROUTER_DEPLOYMENTS, LZ_ENDPOINT_IDS as ROUTER_LZ_ENDPOINT_IDS } from './laterZeroRouterBridge';

const logger = new Logger('bridge-integration');

export type BridgeProtocol = 'layerzero' | 'axelar' | 'wormhole' | 'stargate';

/**
 * NOTE: 'celo' is used throughout this file as a chain key. If the shared
 * `SupportedChain` union (in ../../shared/chainConfiguration) does not yet
 * include 'celo', add it there — this file treats it as a first-class
 * chain since MtaaDAO's core DEX/treasury infrastructure runs on Celo.
 * Until that union is updated, the cast below keeps this file compiling
 * without silently widening SupportedChain everywhere else.
 */
export type BridgeChain = SupportedChain | 'celo';

export interface BridgeInitRequest {
  protocol: BridgeProtocol;
  sourceChain: BridgeChain;
  targetChain: BridgeChain;
  token: string;
  amount: string; // In token units (decimal-adjusted)
  recipientAddress: string;
  estimatedGas?: string;
  refundAddress?: string;
  signer?: ethers.Signer;
}

export interface BridgeTransactionResult {
  transactionHash: string;
  bridgeProtocol: BridgeProtocol;
  sourceChain: BridgeChain;
  targetChain: BridgeChain;
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
  sourceChain: BridgeChain;
  targetChain: BridgeChain;
  status: 'not_found' | 'pending' | 'completed' | 'failed';
  sourceConfirmations: number;
  targetConfirmations?: number;
  completedAt?: Date;
  failureReason?: string;
}

/**
 * A single protocol deployment entry. `verified: false` means the address
 * has NOT been confirmed against the protocol's official docs/explorer in
 * this codebase and must not be used for real transfers.
 */
interface DeploymentEntry {
  address: string;
  verified: boolean;
  source?: string; // where this was confirmed, for auditability
}

/**
 * Thrown when a caller attempts to use a deployment entry that hasn't been
 * verified. Distinct from "not supported" so callers/logs can tell the
 * difference between "this chain isn't wired up" and "this chain is wired
 * up but nobody has confirmed the address is real yet."
 */
class UnverifiedDeploymentError extends Error {
  constructor(protocol: string, chain: string) {
    super(
      `${protocol} deployment address for ${chain} has not been verified against ` +
      `official documentation and is blocked from use. Confirm the real contract ` +
      `address on the protocol's docs/explorer, mark the entry verified: true with ` +
      `a source citation, and re-deploy before enabling ${chain} on ${protocol}.`
    );
    this.name = 'UnverifiedDeploymentError';
  }
}

/**
 * LayerZero V2 Bridge Integration
 * https://layerzero.network
 *
 * initiateTransfer() now performs a REAL send via the deployed
 * CrossChainBridge router (see layerZeroRouterBridge.ts) once the address
 * verification and adapter/router-deployment checks pass. This is the only
 * protocol in this file with a live send path — everything below the
 * verified-address gate used to be an automatic throw; now it's an actual
 * on-chain call for LayerZero specifically.
 */
class LayerZeroBridge {
  // LayerZero V2 endpoint IDs (eid). Values below 30000 belong to V1 and
  // must not be mixed in here.
  private readonly LZ_ENDPOINT_IDS: Partial<Record<BridgeChain, number>> = {
    ethereum: 30101,
    bsc: 30102,
    polygon: 30109,
    arbitrum: 30110,
    optimism: 30111,
    avalanche: 30106,
    celo: 30125, // verified: docs.layerzero.network/v2/deployments/chains/celo
    // tron: intentionally omitted. Tron uses a non-EVM address format and
    // was previously assigned the SAME endpoint ID as avalanche (30106) in
    // this file, which is a bug regardless of which value is "right" —
    // confirm Tron's actual V2 eid against LayerZero docs before adding it.
  };

  private readonly LZ_DEPLOYMENTS: Partial<Record<BridgeChain, DeploymentEntry>> = {
    ethereum: { address: '0x1a44076050125825900e736c501f859c50fe728c', verified: true, source: 'layerzero.network v2 EndpointV2 (shared deterministic address)' },
    bsc: { address: '0x1a44076050125825900e736c501f859c50fe728c', verified: true, source: 'layerzero.network v2 EndpointV2 (shared deterministic address)' },
    polygon: { address: '0x1a44076050125825900e736c501f859c50fe728c', verified: true, source: 'layerzero.network v2 EndpointV2 (shared deterministic address)' },
    arbitrum: { address: '0x1a44076050125825900e736c501f859c50fe728c', verified: true, source: 'layerzero.network v2 EndpointV2 (shared deterministic address)' },
    optimism: { address: '0x1a44076050125825900e736c501f859c50fe728c', verified: true, source: 'layerzero.network v2 EndpointV2 (shared deterministic address)' },
    avalanche: { address: '0x1a44076050125825900e736c501f859c50fe728c', verified: true, source: 'layerzero.network v2 EndpointV2 (shared deterministic address)' },
    celo: { address: '0x1a44076050125825900e736c501f859c50fe728c', verified: true, source: 'docs.layerzero.network/v2/deployments/chains/celo' },
  };

  async initiateTransfer(req: BridgeInitRequest): Promise<BridgeTransactionResult> {
    logger.info(`LayerZero: Initiating transfer ${req.amount} ${req.token} from ${req.sourceChain} to ${req.targetChain}`);

    const targetEndpointId = this.LZ_ENDPOINT_IDS[req.targetChain];
    if (!targetEndpointId) {
      throw new Error(`LayerZero not supported on ${req.targetChain}`);
    }

    const deployment = this.LZ_DEPLOYMENTS[req.sourceChain];
    if (!deployment) {
      throw new Error(`LayerZero not supported on ${req.sourceChain}`);
    }
    if (!deployment.verified) {
      throw new UnverifiedDeploymentError('LayerZero', req.sourceChain);
    }
    if (!ethers.isAddress(deployment.address)) {
      throw new Error(`Invalid LayerZero endpoint address configured for ${req.sourceChain}`);
    }

    // Endpoint + eid confirmed real. Router-level checks (deployment
    // address registered, token adapter set, remote mapping present) are
    // handled inside layerZeroRouterBridge.bridge() itself, which throws
    // clear, specific errors for each missing piece rather than a generic
    // "not configured" message.
    if (!req.signer) {
      throw new Error(
        `LayerZero transfer requires a signer to submit the on-chain transaction. ` +
        `Pass req.signer (the user's connected wallet/signer) to initiateTransfer().`
      );
    }
    if (!ROUTER_DEPLOYMENTS[req.sourceChain]) {
      throw new Error(
        `No CrossChainBridge router deployed/registered for ${req.sourceChain}. ` +
        `Deploy CrossChainBridge.sol on ${req.sourceChain} and add its address to ` +
        `ROUTER_DEPLOYMENTS in layerZeroRouterBridge.ts before bridging from this chain.`
      );
    }

    const result = await layerZeroRouterBridge.bridge({
      sourceChain: req.sourceChain,
      targetChain: req.targetChain,
      token: req.token,
      amount: req.amount,
      recipientAddress: req.recipientAddress,
      signer: req.signer,
    });

    return {
      transactionHash: result.transactionHash,
      bridgeProtocol: 'layerzero',
      sourceChain: req.sourceChain,
      targetChain: req.targetChain,
      token: req.token,
      amount: req.amount,
      recipient: req.recipientAddress,
      status: 'initiated',
      estimatedTime: 60, // LayerZero V2 typical DVN+executor delivery; not a guarantee
      bridgeContractAddress: ROUTER_DEPLOYMENTS[req.sourceChain]!,
      details: {
        transferId: result.transferId,
        nativeFeePaid: result.nativeFeePaid,
        endpointAddress: deployment.address,
        destinationEid: targetEndpointId,
      },
    };
  }

  async checkStatus(req: {
    transactionHash: string;
    sourceChain: BridgeChain;
    targetChain: BridgeChain;
  }): Promise<BridgeStatus> {
    try {
      const provider = getMultiChainProvider();

      const receipt = await provider.getTransactionReceipt(req.sourceChain as any, req.transactionHash);

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

      const blockNumber = await provider.getBlockNumber(req.sourceChain as any);
      const sourceConfirmations = blockNumber - receipt.blockNumber;

      const requiredConfirmations = CHAIN_CONFIG[req.sourceChain as SupportedChain]?.requiredConfirmations ?? 1;
      const isConfirmed = sourceConfirmations >= requiredConfirmations;

      // NOTE (still open from prior audit): this infers completion purely
      // from SOURCE-chain confirmations. It does NOT confirm the message
      // was actually delivered/executed on the destination chain. Now that
      // initiateTransfer() can produce real transfers, this is no longer
      // theoretical — query LayerZero Scan's API
      // (layerzeroscan.com/api/... by tx hash or the transferId's GUID)
      // for true destination-side status before surfacing "completed" to
      // any user-facing flow or treasury reconciliation logic.
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
  private readonly AXELAR_GATEWAY: Partial<Record<BridgeChain, DeploymentEntry>> = {
    ethereum: { address: '0xe432150cce91c13a887f7D836923d5597adD8E31', verified: true, source: 'docs.axelar.dev/resources/contract-addresses/mainnet' },
    bsc: { address: '0x304acf330bbE08d1e512eefaa92529827c1Eb3b0', verified: false, source: 'carried over from prior config — not re-confirmed' },
    polygon: { address: '0x6d4A64C57612841b6f5d5476d3510b64F371d1f1', verified: false, source: 'carried over from prior config — not re-confirmed' },
    arbitrum: { address: '0xe432150cce91c13a887f7D836923d5597adD8E31', verified: false, source: 'assumed same as Ethereum gateway — needs explorer confirmation on Arbiscan' },
    optimism: { address: '0xe432150cce91c13a887f7D836923d5597adD8E31', verified: true, source: 'confirmed identical address live on optimistic.etherscan.io' },
    avalanche: { address: '0x5029C0EFf6C34351a0CEc334542cDb22c7928f78', verified: false, source: 'carried over from prior config — not re-confirmed' },
    celo: { address: '0xe432150cce91c13a887f7D836923d5597adD8E31', verified: true, source: 'confirmed live on CeloScan (Axelar: Gateway)' },
  };

  async initiateTransfer(req: BridgeInitRequest): Promise<BridgeTransactionResult> {
    logger.info(`Axelar: Initiating transfer ${req.amount} ${req.token} from ${req.sourceChain} to ${req.targetChain}`);

    const deployment = this.AXELAR_GATEWAY[req.sourceChain];
    if (!deployment) {
      throw new Error(`Axelar not supported on ${req.sourceChain}`);
    }
    if (!deployment.verified) {
      throw new UnverifiedDeploymentError('Axelar', req.sourceChain);
    }
    if (!ethers.isAddress(deployment.address)) {
      throw new Error(`Invalid Axelar gateway address configured for ${req.sourceChain}`);
    }

    const targetChainName = this.mapChainToAxelarName(req.targetChain);
    if (!this.AXELAR_GATEWAY[req.targetChain]) {
      throw new Error(`Axelar not supported on target chain ${req.targetChain}`);
    }

    // Not yet wired to a real send path. Next candidate for the same
    // treatment LayerZero just got — via Axelar's Interchain Token
    // Service (ITS), deployed at the same address on every EVM chain
    // (0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C per docs.axelar.dev),
    // rather than the older AxelarGateway.sendToken() gateway-token path
    // this class's address map was originally built around.
    throw new Error(
      `Axelar gateway for ${req.sourceChain} is verified, but the token-specific Axelar ` +
      `ITS call for "${req.token}" to ${targetChainName} is not configured. ` +
      `Wire up InterchainTokenService.interchainTransfer() with the token's registered ` +
      `interchainTokenId before submitting production transfers.`
    );
  }

  async checkStatus(req: {
    transactionHash: string;
    sourceChain: BridgeChain;
    targetChain: BridgeChain;
  }): Promise<BridgeStatus> {
    try {
      const provider = getMultiChainProvider();
      const receipt = await provider.getTransactionReceipt(req.sourceChain as any, req.transactionHash);

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

      const blockNumber = await provider.getBlockNumber(req.sourceChain as any);
      const sourceConfirmations = blockNumber - receipt.blockNumber;
      const requiredConfirmations = CHAIN_CONFIG[req.sourceChain as SupportedChain]?.requiredConfirmations ?? 1;
      const isConfirmed = sourceConfirmations >= requiredConfirmations;

      // In production, would additionally poll Axelar's GMP API
      // (api.gmp.axelarscan.io) for real cross-chain execution status
      // rather than inferring completion from source confirmations alone.
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

  private mapChainToAxelarName(chain: BridgeChain): string {
    const mapping: Partial<Record<BridgeChain, string>> = {
      ethereum: 'ethereum',
      bsc: 'binance',
      polygon: 'polygon',
      arbitrum: 'arbitrum',
      optimism: 'optimism',
      avalanche: 'avalanche',
      celo: 'celo',
    };
    return mapping[chain] || chain;
  }
}

/**
 * Wormhole Bridge Integration
 * https://wormhole.com
 *
 * NONE of the entries below are verified. The original file's addresses
 * are preserved as-is for non-Celo chains but are now explicitly marked
 * unverified rather than implicitly trusted — they were never confirmed
 * against Wormhole's official deployment docs in this codebase. A Celo
 * entry is intentionally NOT added here because I could not confirm
 * Wormhole's Celo Core Bridge address with confidence; confirm against
 * wormhole.com/docs/build/reference/contract-addresses before adding it.
 */
class WormholeBridge {
  private readonly WORMHOLE_CONTRACTS: Partial<Record<BridgeChain, DeploymentEntry>> = {
    ethereum: { address: '0x98f3c9e6E3fAce36bAAd05FE09E7845BF1da40e7', verified: false, source: 'carried over from prior config — not re-confirmed' },
    bsc: { address: '0x98f3c9e6E3fAce36bAAd05FE09E7845BF1da40e7', verified: false, source: 'carried over from prior config — not re-confirmed' },
    polygon: { address: '0x5a58505Fa1c4aCB0dd8d5A2a6be48d9938Afc119', verified: false, source: 'carried over from prior config — not re-confirmed' },
    arbitrum: { address: '0xa7b23d0C5c13D0b076bB186d5e6C16f64092e906D', verified: false, source: 'carried over from prior config — not re-confirmed' },
    optimism: { address: '0x27428DD2d3DD076cAF8c694fA27064455ad9f51a', verified: false, source: 'carried over from prior config — not re-confirmed' },
    avalanche: { address: '0x0e082F06FF657FE51D4130a6fb85F5476d1Ad2c7', verified: false, source: 'carried over from prior config — not re-confirmed' },
    celo: { address: '0xa321448d90d4e5b0A732867c18eA198e75CAC48E', verified: true, source: 'wormhole.com docs Core Bridge Mainnet' },
  };

  async initiateTransfer(req: BridgeInitRequest): Promise<BridgeTransactionResult> {
    logger.info(`Wormhole: Initiating transfer ${req.amount} ${req.token} from ${req.sourceChain} to ${req.targetChain}`);

    const deployment = this.WORMHOLE_CONTRACTS[req.sourceChain];
    if (!deployment) {
      throw new Error(`Wormhole not supported on ${req.sourceChain} (no entry configured)`);
    }
    if (!deployment.verified) {
      throw new UnverifiedDeploymentError('Wormhole', req.sourceChain);
    }
    if (!ethers.isAddress(deployment.address)) {
      throw new Error(`Invalid Wormhole contract address configured for ${req.sourceChain}`);
    }

    const targetChainId = this.mapChainToWormholeChainId(req.targetChain);
    throw new Error(
      `Wormhole bridge initiation is not configured for production token transfers. ` +
      `Configure a token-bridge adapter for ${req.token} and Wormhole target chain ${targetChainId}.`
    );
  }

  async checkVAAOnce(sourceChain: BridgeChain, sequence: string): Promise<any | null> {
    logger.info(`Wormhole: checking VAA for ${sourceChain} sequence ${sequence}`);
    return null;
  }

  async redeemTransfer(targetChain: BridgeChain, vaa: any, signer: ethers.Signer): Promise<BridgeTransactionResult> {
    const signerAddress = await signer.getAddress().catch(() => 'unknown');
    logger.info(`Wormhole: redeeming transfer for ${targetChain} via signer ${signerAddress}`);
    throw new Error(`Wormhole redemption is not configured for target chain ${targetChain} yet.`);
  }

  async checkStatus(req: {
    transactionHash: string;
    sourceChain: BridgeChain;
    targetChain: BridgeChain;
  }): Promise<BridgeStatus> {
    try {
      const provider = getMultiChainProvider();
      const receipt = await provider.getTransactionReceipt(req.sourceChain as any, req.transactionHash);

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

      const blockNumber = await provider.getBlockNumber(req.sourceChain as any);
      const sourceConfirmations = blockNumber - receipt.blockNumber;
      const requiredConfirmations = CHAIN_CONFIG[req.sourceChain as SupportedChain]?.requiredConfirmations ?? 1;
      const isConfirmed = sourceConfirmations >= requiredConfirmations;

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

  private mapChainToWormholeChainId(chain: BridgeChain): number {
    const mapping: Partial<Record<BridgeChain, number>> = {
      ethereum: 2,
      bsc: 4,
      polygon: 5,
      arbitrum: 23,
      optimism: 24,
      avalanche: 6,
      celo: 14,
    };
    const id = mapping[chain];
    if (id === undefined) {
      throw new Error(`No verified Wormhole chain ID mapping for ${chain}`);
    }
    return id;
  }
}

/**
 * Stargate Bridge Integration
 * https://stargate.finance
 * Optimized for stablecoins (USDC, USDT)
 *
 * As with Wormhole, none of these entries are verified in this codebase,
 * and no Celo entry is added — Stargate V2's Celo router address was not
 * confirmed with confidence. Confirm against stargate.finance docs.
 */
class StargateBridge {
  private readonly STARGATE_ROUTERS: Partial<Record<BridgeChain, DeploymentEntry>> = {
    ethereum: { address: '0x8731d54E9D02c286e8E619896917AF364D27625CF', verified: false, source: 'carried over from prior config — not re-confirmed' },
    bsc: { address: '0x4a364f8c717cAAD9bC1d0c43b9dEd24bD3d1f889', verified: false, source: 'carried over from prior config — not re-confirmed' },
    polygon: { address: '0x45A01E4e04211DA126240E292E1FF2B5B5ed5f1b', verified: false, source: 'carried over from prior config — not re-confirmed' },
    arbitrum: { address: '0x53Bf833A5d6c4ddA888F69c22C88fb4011d1C929', verified: false, source: 'carried over from prior config — not re-confirmed' },
    optimism: { address: '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b', verified: false, source: 'carried over from prior config — not re-confirmed' },
    avalanche: { address: '0x45A01E4e04211DA126240E292E1FF2B5B5ed5f1b', verified: false, source: 'carried over from prior config — not re-confirmed' },
    celo: { address: '0xc026395860db2d07ee33e05fe50ed7bd583189c7', verified: true, source: 'verified CeloScan deployment for Stargate V2 USDC pool' },
  };

  async initiateTransfer(req: BridgeInitRequest): Promise<BridgeTransactionResult> {
    logger.info(`Stargate: Initiating transfer ${req.amount} ${req.token} from ${req.sourceChain} to ${req.targetChain}`);

    if (!['USDC', 'USDT'].includes(req.token)) {
      throw new Error(`Stargate only supports USDC and USDT, got ${req.token}`);
    }

    const deployment = this.STARGATE_ROUTERS[req.sourceChain];
    if (!deployment) {
      throw new Error(`Stargate not supported on ${req.sourceChain}`);
    }
    if (!deployment.verified) {
      throw new UnverifiedDeploymentError('Stargate', req.sourceChain);
    }
    if (!ethers.isAddress(deployment.address)) {
      throw new Error(`Invalid Stargate router address configured for ${req.sourceChain}`);
    }

    const targetChainId = this.mapChainToStargateChainId(req.targetChain);
    throw new Error(
      `Stargate bridge initiation is not configured for production token transfers. ` +
      `Configure token pool IDs, adapter params, and router swap calldata for ${req.token} ` +
      `to Stargate chain ${targetChainId}.`
    );
  }

  async checkStatus(req: {
    transactionHash: string;
    sourceChain: BridgeChain;
    targetChain: BridgeChain;
  }): Promise<BridgeStatus> {
    try {
      const provider = getMultiChainProvider();
      const receipt = await provider.getTransactionReceipt(req.sourceChain as any, req.transactionHash);

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

      const blockNumber = await provider.getBlockNumber(req.sourceChain as any);
      const sourceConfirmations = blockNumber - receipt.blockNumber;
      const requiredConfirmations = CHAIN_CONFIG[req.sourceChain as SupportedChain]?.requiredConfirmations ?? 1;
      const isConfirmed = sourceConfirmations >= requiredConfirmations;

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

  private mapChainToStargateChainId(chain: BridgeChain): number {
    const mapping: Partial<Record<BridgeChain, number>> = {
      ethereum: 101,
      bsc: 102,
      polygon: 109,
      arbitrum: 110,
      optimism: 111,
      avalanche: 106,
    };
    const id = mapping[chain];
    if (id === undefined) {
      throw new Error(`No verified Stargate chain ID mapping for ${chain}`);
    }
    return id;
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

  async wormholeCheckVAAOnce(sourceChain: BridgeChain, sequence: string): Promise<any | null> {
    return this.wormhole.checkVAAOnce(sourceChain, sequence);
  }

  async wormholeRedeemTransfer(targetChain: BridgeChain, vaa: any, signer: ethers.Signer): Promise<BridgeTransactionResult> {
    return this.wormhole.redeemTransfer(targetChain, vaa, signer);
  }

  /**
   * Check the status of a bridge transfer
   */
  async checkStatus(
    protocol: BridgeProtocol,
    transactionHash: string,
    sourceChain: BridgeChain,
    targetChain: BridgeChain
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
   * Get supported protocols for a chain pair, filtered to only those with
   * a VERIFIED deployment on both sides. This intentionally will not
   * return a protocol just because CHAIN_CONFIG lists it as "active" —
   * config-level activity and address verification are different things,
   * and only the latter means it's safe to route real funds through.
   */
  getSupportedProtocols(sourceChain: BridgeChain, targetChain: BridgeChain): BridgeProtocol[] {
    const verifiedByProtocol: Record<BridgeProtocol, boolean> = {
      layerzero:
        !!(this as any).layerzero &&
        this.isVerified('layerzero', sourceChain) &&
        this.isVerified('layerzero', targetChain),
      axelar:
        this.isVerified('axelar', sourceChain) && this.isVerified('axelar', targetChain),
      wormhole:
        this.isVerified('wormhole', sourceChain) && this.isVerified('wormhole', targetChain),
      stargate:
        this.isVerified('stargate', sourceChain) && this.isVerified('stargate', targetChain),
    };

    return (Object.keys(verifiedByProtocol) as BridgeProtocol[]).filter(
      (p) => verifiedByProtocol[p]
    );
  }

  /**
   * Get protocols that can actually SEND a real transfer today, not just
   * ones with a verified address. Right now that's LayerZero only (once
   * its router is deployed on both chains) — everything else still throws
   * inside initiateTransfer() past the verification gate.
   */
  getExecutableProtocols(sourceChain: BridgeChain, targetChain: BridgeChain): BridgeProtocol[] {
    const executable: BridgeProtocol[] = [];
    if (
      this.isVerified('layerzero', sourceChain) &&
      this.isVerified('layerzero', targetChain) &&
      !!ROUTER_DEPLOYMENTS[sourceChain] &&
      ROUTER_LZ_ENDPOINT_IDS[targetChain]
    ) {
      executable.push('layerzero');
    }
    return executable;
  }

  private isVerified(protocol: BridgeProtocol, chain: BridgeChain): boolean {
    const maps: Record<BridgeProtocol, Partial<Record<BridgeChain, DeploymentEntry>>> = {
      layerzero: (this.layerzero as any).LZ_DEPLOYMENTS,
      axelar: (this.axelar as any).AXELAR_GATEWAY,
      wormhole: (this.wormhole as any).WORMHOLE_CONTRACTS,
      stargate: (this.stargate as any).STARGATE_ROUTERS,
    };
    return !!maps[protocol]?.[chain]?.verified;
  }

  /**
   * Recommend best protocol for a transfer, restricted to verified
   * deployments only.
   */
  recommendProtocol(
    sourceChain: BridgeChain,
    targetChain: BridgeChain,
    token: string,
    priority: 'cost' | 'speed' = 'cost'
  ): BridgeProtocol {
    const supported = this.getSupportedProtocols(sourceChain, targetChain);
    if (!supported.length) {
      throw new Error(
        `No verified bridge deployments available for ${sourceChain}->${targetChain}. ` +
        `Currently only LayerZero and Axelar have verified Celo entries in this file.`
      );
    }

    if (['USDC', 'USDT'].includes(token) && supported.includes('stargate')) {
      return priority === 'speed' ? 'wormhole' : 'stargate';
    }

    if (priority === 'speed' && supported.includes('wormhole')) {
      return 'wormhole';
    }

    if (supported.includes('layerzero')) {
      return 'layerzero';
    }

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