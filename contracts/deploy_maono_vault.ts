import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// --- Config ---
const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const DAO_TREASURY = process.env.DAO_TREASURY || "0x...";
const MANAGER = process.env.MANAGER || "0x...";
const CUSD_ADDRESS = process.env.CUSD_ADDRESS || "0x...";

// --- Load ABI & Bytecode ---
const artifactPath = path.join(__dirname, "./MaonoVault.json");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("Deploying MaonoVault...");
  const contract = await factory.deploy(CUSD_ADDRESS, DAO_TREASURY, MANAGER);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("MaonoVault deployed at:", address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
