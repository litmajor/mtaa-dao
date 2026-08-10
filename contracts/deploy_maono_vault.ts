// Deploys the MaonoVault_Phase1B *implementation* from the committed artifact.
//
// The implementation takes no constructor arguments and disables its own
// initializers. Usable vaults are EIP-1167 clones created and initialized by
// MaonoVaultFactory_Phase1B.deployVault(); pass the address printed here as the
// factory's `_vaultImplementation`. See scripts/deploy.mjs for the full stack.

import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

const artifactPath = path.join(__dirname, "./MaonoVault.json");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

async function main() {
  if (!PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY must be set");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log(`Deploying ${artifact.contractName} implementation...`);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("Implementation deployed at:", address);
  console.log("Pass this address to MaonoVaultFactory_Phase1B as _vaultImplementation.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
