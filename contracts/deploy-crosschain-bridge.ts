/**
 * scripts/deploy-crosschain-bridge.ts
 *
 * Run once PER CHAIN (Celo first, then whichever target chain you're
 * bridging cUSD to first):
 *
 *   npx hardhat run scripts/deploy-crosschain-bridge.ts --network celo
 *   npx hardhat run scripts/deploy-crosschain-bridge.ts --network <target>
 *
 * This does NOT wire cross-chain peers (that requires both sides to be
 * deployed first — see wire-peers-and-register.ts, run after this on
 * both networks). This script only:
 *   1. Deploys CrossChainBridge.sol on the current network
 *   2. Deploys an OFTAdapter wrapping cUSD on the current network
 *      (cUSD already exists and can't be modified, so it needs the
 *      lockbox pattern — unlike MTAA, which should be deployed as a
 *      native OFT directly, see deploy-mtaa-oft.ts once that contract
 *      exists)
 *   3. Registers known destination chains on the router
 *   4. Writes deployed addresses to deployments/<network>.json so the
 *      wiring script can pick them up
 *
 * Requires @layerzerolabs/oft-evm installed (provides the reference
 * OFTAdapter.sol) alongside your existing @layerzerolabs/lz-evm-oapp-v2.
 */

import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ──────────────────────────────────────────────────────────────
// LayerZero V2 endpoint per chain. Only Celo's is verified in this repo so
// far (see bridgeIntegration.ts LZ_DEPLOYMENTS) — confirm any other chain's
// endpoint against docs.layerzero.network/v2/deployments/chains/<chain>
// before deploying there for real.
const LZ_ENDPOINTS: Record<string, string> = {
  celo: '0x1a44076050125825900e736c501f859c50fe728c',
  // base: '0x1a44076050125825900e736c501f859c50fe728c', // verify before use
};

const LZ_ENDPOINT_IDS: Record<string, number> = {
  celo: 30125,
  // base: 30184, // verify against LayerZero docs before use
};

// cUSD mainnet address on Celo. If deploying the adapter on a NON-Celo
// chain, this should be that chain's bridged/native cUSD address instead
// (confirm — cUSD is a Mento stablecoin native to Celo; whether it has a
// canonical presence on other chains needs its own verification pass).
const CUSD_ADDRESS: Record<string, string> = {
  celo: '0x765DE816845861e75A25fCA122bb6898B8B1282',
};

// Chains this router should know about (for configureSupportedChain).
// Add entries here as you verify + deploy to more chains.
const SUPPORTED_CHAINS: Array<{ key: string; eid: number; gasLimit: number }> = [
  { key: 'celo', eid: 30125, gasLimit: 200_000 },
];

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments', 'crosschain');

interface ChainDeployment {
  network: string;
  crossChainBridge: string;
  cusdOFTAdapter?: string;
  cusdToken?: string;
  deployedAt: string;
}

function saveDeployment(data: ChainDeployment) {
  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  }
  const filePath = path.join(DEPLOYMENTS_DIR, `${data.network}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`[deploy] Wrote ${filePath}`);
}

async function main() {
  const networkName = network.name;
  console.log(`[deploy] Deploying to network: ${networkName}`);

  const endpoint = LZ_ENDPOINTS[networkName];
  const eid = LZ_ENDPOINT_IDS[networkName];
  if (!endpoint || !eid) {
    throw new Error(
      `No verified LayerZero endpoint/eid configured for "${networkName}" in this script. ` +
      `Confirm against docs.layerzero.network before adding it to LZ_ENDPOINTS/LZ_ENDPOINT_IDS.`
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log(`[deploy] Deployer: ${deployer.address}`);

  // ── 1. Deploy CrossChainBridge ─────────────────────────────────────────
  const CrossChainBridge = await ethers.getContractFactory('CrossChainBridge');
  const bridge = await CrossChainBridge.deploy(eid, networkName);
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();
  console.log(`[deploy] CrossChainBridge deployed: ${bridgeAddress}`);

  // ── 2. Register known destination chains on the router ─────────────────
  for (const chain of SUPPORTED_CHAINS) {
    if (chain.key === networkName) continue; // current chain already set in constructor
    const tx = await bridge.configureSupportedChain(chain.eid, chain.key, chain.gasLimit);
    await tx.wait();
    console.log(`[deploy] Registered destination chain ${chain.key} (eid ${chain.eid}) on router`);
  }

  const result: ChainDeployment = {
    network: networkName,
    crossChainBridge: bridgeAddress,
    deployedAt: new Date().toISOString(),
  };

  // ── 3. Deploy OFTAdapter for cUSD, if this chain has a known cUSD address ──
  const cusdAddress = CUSD_ADDRESS[networkName];
  if (cusdAddress) {
    // @layerzerolabs/oft-evm ships the reference OFTAdapter contract.
    // Constructor signature: (address token, address lzEndpoint, address delegate)
    const OFTAdapter = await ethers.getContractFactory(
      '@layerzerolabs/oft-evm/contracts/OFTAdapter.sol:OFTAdapter'
    );
    const adapter = await OFTAdapter.deploy(cusdAddress, endpoint, deployer.address);
    await adapter.waitForDeployment();
    const adapterAddress = await adapter.getAddress();
    console.log(`[deploy] cUSD OFTAdapter deployed: ${adapterAddress}`);

    // Register it with the router immediately — peer wiring (setPeer) and
    // mapToken() still need to happen in wire-peers-and-register.ts once
    // BOTH chains' adapters are deployed and their addresses are known to
    // each other.
    const setAdapterTx = await bridge.setTokenAdapter(cusdAddress, adapterAddress);
    await setAdapterTx.wait();
    console.log(`[deploy] Registered cUSD -> adapter on router`);

    result.cusdOFTAdapter = adapterAddress;
    result.cusdToken = cusdAddress;
  } else {
    console.log(`[deploy] No cUSD address configured for ${networkName} — skipping adapter deployment`);
  }

  saveDeployment(result);

  console.log(`\n[deploy] Done. Next: deploy on the OTHER chain, then run wire-peers-and-register.ts.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});