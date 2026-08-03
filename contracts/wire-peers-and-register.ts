/**
 * scripts/wire-peers-and-register.ts
 *
 * Run ONCE both chains have CrossChainBridge + OFTAdapter deployed
 * (via deploy-crosschain-bridge.ts on both networks):
 *
 *   npx hardhat run scripts/wire-peers-and-register.ts --network celo
 *
 * This script:
 *   1. Reads deployed addresses from deployments/<source-network>.json and
 *      deployments/<target-network>.json
 *   2. Wires OFT adapters as peers to each other (setPeer on both chains)
 *   3. Registers token mappings on the routers (mapToken on both chains)
 *
 * Requires both deployments/<celo>.json and deployments/<target>.json to
 * exist and contain valid addresses from prior deploy-crosschain-bridge.ts
 * runs. Both scripts are idempotent — re-running this is safe if a peer
 * wiring fails partway through.
 */

import { ethers, network } from 'hardhat';
import type { Network } from 'hardhat/types';
import * as fs from 'fs';
import * as path from 'path';

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments', 'crosschain');

interface ChainDeployment {
  network: string;
  crossChainBridge: string;
  cusdOFTAdapter?: string;
  cusdToken?: string;
  deployedAt: string;
}

function loadDeployment(networkName: string): ChainDeployment {
  const filePath = path.join(DEPLOYMENTS_DIR, `${networkName}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `No deployment found for ${networkName} at ${filePath}. ` +
      `Run deploy-crosschain-bridge.ts on both Celo and target chain first.`
    );
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// LayerZero V2 chain IDs — must match deploy-crosschain-bridge.ts's LZ_ENDPOINT_IDS
const LZ_ENDPOINT_IDS: Record<string, number> = {
  celo: 30125,
  ethereum: 30101,
  polygon: 30109,
  arbitrum: 30110,
  optimism: 30111,
  base: 30184,
};

async function main() {
  const sourceChain = network.name;
  console.log(`[wire] Wiring from ${sourceChain}`);

  // Determine target chain from TARGET_CHAIN env var, or default based on source
  let targetChain = process.env.TARGET_CHAIN;
  if (!targetChain) {
    // Default routing: celo <-> ethereum, all others <-> celo
    targetChain = sourceChain === 'celo' ? 'ethereum' : 'celo';
  }
  console.log(`[wire] Targeting ${targetChain} (set via TARGET_CHAIN env var if needed)`);

  const sourceDeployment = loadDeployment(sourceChain);
  const targetDeployment = loadDeployment(targetChain);

  console.log(`[wire] Source deployment (${sourceChain}):`, sourceDeployment);
  console.log(`[wire] Target deployment (${targetChain}):`, targetDeployment);

  if (!sourceDeployment.cusdOFTAdapter || !targetDeployment.cusdOFTAdapter) {
    throw new Error(
      `One or both chains missing OFTAdapter. ` +
      `Ensure deploy-crosschain-bridge.ts was run on both ${sourceChain} and ${targetChain}.`
    );
  }

  const [deployer] = await ethers.getSigners();
  const sourceProvider = ethers.provider;

  // Map chain names to RPC URL env vars and fallback URLs
  const RPC_URLS: Record<string, string> = {
    ethereum: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    polygon: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
    arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arbitrum.llamarpc.com',
    optimism: process.env.OPTIMISM_RPC_URL || 'https://optimism.llamarpc.com',
    base: process.env.BASE_RPC_URL || 'https://base.llamarpc.com',
    celo: process.env.CELO_RPC_URL || 'https://forno.celo.org',
  };

  const targetRpcUrl = RPC_URLS[targetChain as keyof typeof RPC_URLS];
  if (!targetRpcUrl) {
    throw new Error(`No RPC URL configured for chain ${targetChain}`);
  }
  const targetProvider = new ethers.JsonRpcProvider(targetRpcUrl);

  // ── 1. Wire OFT adapter peers ────────────────────────────────────────────
  // Each adapter must know about its remote counterpart.

  const OFT_ADAPTER_ABI = [
    'function setPeer(uint32 _eid, bytes32 _peer) public',
  ];

  const sourceAdapter = new ethers.Contract(
    sourceDeployment.cusdOFTAdapter,
    OFT_ADAPTER_ABI,
    deployer
  );

  const targetEid = LZ_ENDPOINT_IDS[targetChain];
  if (!targetEid) {
    throw new Error(`No LayerZero endpoint ID configured for ${targetChain}`);
  }

  // Convert target adapter address to bytes32 peer format (left-padded hex).
  const targetAdapterBytes32 = ethers.zeroPadValue(targetDeployment.cusdOFTAdapter, 32);

  console.log(
    `[wire] Setting source adapter (${sourceDeployment.cusdOFTAdapter}) ` +
    `peer to target (${targetDeployment.cusdOFTAdapter}) on endpoint ${targetEid}`
  );

  let tx = await sourceAdapter.setPeer(targetEid, targetAdapterBytes32);
  await tx.wait();
  console.log(`[wire] Source peer wiring confirmed: ${tx.hash}`);

  // Wire the remote adapter back to source (must be done from target chain)
  const targetAdapter = new ethers.Contract(
    targetDeployment.cusdOFTAdapter,
    OFT_ADAPTER_ABI,
    new ethers.Wallet(process.env.STRATEGY_EXECUTOR_PRIVATE_KEY || '', targetProvider)
  );

  const sourceEid = LZ_ENDPOINT_IDS[sourceChain];
  if (!sourceEid) {
    throw new Error(`No LayerZero endpoint ID configured for ${sourceChain}`);
  }

  const sourceAdapterBytes32 = ethers.zeroPadValue(sourceDeployment.cusdOFTAdapter, 32);

  console.log(
    `[wire] Setting target adapter (${targetDeployment.cusdOFTAdapter}) ` +
    `peer back to source (${sourceDeployment.cusdOFTAdapter}) on endpoint ${sourceEid}`
  );

  tx = await targetAdapter.setPeer(sourceEid, sourceAdapterBytes32);
  await tx.wait();
  console.log(`[wire] Target peer wiring confirmed: ${tx.hash}`);

  // ── 2. Register token mapping on routers ────────────────────────────────
  // Each router must know: "cUSD on my chain is at this adapter, and maps
  // to that remote adapter on the remote chain."

  const BRIDGE_ABI = [
    'function mapToken(address token, uint32 remoteEid, address remoteAdapter) external',
  ];

  const sourceBridge = new ethers.Contract(
    sourceDeployment.crossChainBridge,
    BRIDGE_ABI,
    deployer
  );

  console.log(
    `[wire] Mapping cUSD (${sourceDeployment.cusdToken}) on source router ` +
    `to remote adapter (${targetDeployment.cusdOFTAdapter}) on endpoint ${targetEid}`
  );

  tx = await sourceBridge.mapToken(sourceDeployment.cusdToken, targetEid, targetDeployment.cusdOFTAdapter);
  await tx.wait();
  console.log(`[wire] Source token mapping confirmed: ${tx.hash}`);

  const targetBridge = new ethers.Contract(
    targetDeployment.crossChainBridge,
    BRIDGE_ABI,
    new ethers.Wallet(process.env.STRATEGY_EXECUTOR_PRIVATE_KEY || '', targetProvider)
  );

  console.log(
    `[wire] Mapping cUSD (${targetDeployment.cusdToken}) on target router ` +
    `to remote adapter (${sourceDeployment.cusdOFTAdapter}) on endpoint ${sourceEid}`
  );

  tx = await targetBridge.mapToken(targetDeployment.cusdToken, sourceEid, sourceDeployment.cusdOFTAdapter);
  await tx.wait();
  console.log(`[wire] Target token mapping confirmed: ${tx.hash}`);

  console.log(`\n[wire] ✅ Dual-chain peer wiring complete!`);
  console.log(`[wire] cUSD can now bridge: ${sourceChain} ↔ ${targetChain}`);
  console.log(`[wire] Next: Update layerZeroRouterBridge.ts ROUTER_DEPLOYMENTS with:
    ${sourceChain}: '${sourceDeployment.crossChainBridge}'
    ${targetChain}: '${targetDeployment.crossChainBridge}'
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
