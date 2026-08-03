/**
 * scripts/wire-peers-and-register.ts
 *
 * Run AFTER deploy-crosschain-bridge.ts has been run on BOTH the source
 * and destination network, so both deployments/crosschain/<network>.json
 * files exist. This script must be run once per direction (source and
 * destination each need to know about the other), and it needs a signer
 * with a funded wallet on whichever network you pass via --network — so
 * you'll invoke it twice, once per network, pointing at the same pair:
 *
 *   npx hardhat run scripts/wire-peers-and-register.ts --network celo
 *   npx hardhat run scripts/wire-peers-and-register.ts --network <target>
 *
 * Set SOURCE_CHAIN / TARGET_CHAIN below to the pair you're wiring.
 *
 * What it does on whichever network you run it against:
 *   1. Reads the OTHER chain's deployment file to get its adapter address
 *   2. Calls setPeer(remoteEid, remoteAdapterAddressAsBytes32) on THIS
 *      chain's OFTAdapter — this is the actual LayerZero routing config;
 *      the router's tokenMappings is a separate audit-trail allowlist
 *   3. Calls mapToken(cusd, remoteEid, remoteAdapterAddress) on THIS
 *      chain's CrossChainBridge router, so bridgeAssets() will allow it
 */

import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// ── Config: the pair being wired in this run ────────────────────────────
const CHAIN_PAIR: [string, string] = ['celo', 'PLACEHOLDER_TARGET_CHAIN'];

const LZ_ENDPOINT_IDS: Record<string, number> = {
  celo: 30125,
  // PLACEHOLDER_TARGET_CHAIN: <verified eid here>,
};

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments', 'crosschain');

interface ChainDeployment {
  network: string;
  crossChainBridge: string;
  cusdOFTAdapter?: string;
  cusdToken?: string;
  deployedAt: string;
}

function loadDeployment(networkKey: string): ChainDeployment {
  const filePath = path.join(DEPLOYMENTS_DIR, `${networkKey}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `No deployment file found for "${networkKey}" at ${filePath}. ` +
      `Run deploy-crosschain-bridge.ts on that network first.`
    );
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function addressToBytes32(addr: string): string {
  return ethers.zeroPadValue(ethers.getAddress(addr), 32);
}

async function main() {
  const currentNetwork = network.name;
  if (!CHAIN_PAIR.includes(currentNetwork)) {
    throw new Error(
      `Current network "${currentNetwork}" is not part of CHAIN_PAIR ${JSON.stringify(CHAIN_PAIR)}. ` +
      `Update CHAIN_PAIR at the top of this script before running.`
    );
  }

  const otherNetwork = CHAIN_PAIR.find((c) => c !== currentNetwork)!;

  const thisDeployment = loadDeployment(currentNetwork);
  const otherDeployment = loadDeployment(otherNetwork);

  if (!thisDeployment.cusdOFTAdapter || !otherDeployment.cusdOFTAdapter) {
    throw new Error(
      `Both chains need a deployed cUSD OFTAdapter before wiring peers. ` +
      `Missing on: ${!thisDeployment.cusdOFTAdapter ? currentNetwork : otherNetwork}.`
    );
  }
  if (!thisDeployment.cusdToken) {
    throw new Error(`Missing cusdToken address for ${currentNetwork} in its deployment file.`);
  }

  const otherEid = LZ_ENDPOINT_IDS[otherNetwork];
  if (!otherEid) {
    throw new Error(
      `No LayerZero eid configured for "${otherNetwork}" in this script's LZ_ENDPOINT_IDS. ` +
      `Fill it in (verified against LayerZero docs) before wiring.`
    );
  }

  console.log(`[wire] Wiring ${currentNetwork} -> ${otherNetwork} (eid ${otherEid})`);

  const [signer] = await ethers.getSigners();

  // ── 1. setPeer on THIS chain's adapter, pointing at the OTHER chain's adapter ──
  const adapter = await ethers.getContractAt(
    '@layerzerolabs/oft-evm/contracts/OFTAdapter.sol:OFTAdapter',
    thisDeployment.cusdOFTAdapter,
    signer
  );

  const remotePeerBytes32 = addressToBytes32(otherDeployment.cusdOFTAdapter);
  const setPeerTx = await adapter.setPeer(otherEid, remotePeerBytes32);
  await setPeerTx.wait();
  console.log(`[wire] setPeer(${otherEid}, ${remotePeerBytes32}) on adapter ${thisDeployment.cusdOFTAdapter}`);

  // ── 2. mapToken on THIS chain's router — audit-trail allowlist gate ──────
  const router = await ethers.getContractAt('CrossChainBridge', thisDeployment.crossChainBridge, signer);

  const mapTx = await router.mapToken(thisDeployment.cusdToken, otherEid, otherDeployment.cusdOFTAdapter);
  await mapTx.wait();
  console.log(`[wire] mapToken(${thisDeployment.cusdToken}, ${otherEid}, ${otherDeployment.cusdOFTAdapter}) on router`);

  console.log(
    `\n[wire] Done for ${currentNetwork} -> ${otherNetwork}. ` +
    `Now run this same script with --network ${otherNetwork} to wire the reverse direction, ` +
    `then update ROUTER_DEPLOYMENTS in layerZeroRouterBridge.ts with both router addresses.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});