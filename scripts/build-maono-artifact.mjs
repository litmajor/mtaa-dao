#!/usr/bin/env node
// Regenerates contracts/MaonoVault.json from contracts/MaonoVault.sol.
//
// The committed artifact is what server/blockchain.ts binds to and what
// contracts/deploy_maono_vault.ts deploys, so it must always correspond to the
// current Solidity source. Foundry compiles the vault as part of the security
// suite (foundry.toml), so the artifact is derived from that build output and
// re-emitted in the Hardhat artifact shape the TypeScript consumers expect.
//
//   node scripts/build-maono-artifact.mjs           # write the artifact
//   node scripts/build-maono-artifact.mjs --check   # fail if it is stale
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORGE_OUT = join(ROOT, "out-security/MaonoVault.sol/MaonoVault_Phase1B.json");
const ARTIFACT = join(ROOT, "contracts/MaonoVault.json");

const check = process.argv.includes("--check");

execFileSync("forge", ["build", "--skip", "test"], { cwd: ROOT, stdio: "inherit" });

if (!existsSync(FORGE_OUT)) {
  throw new Error(`forge did not produce ${FORGE_OUT}`);
}

const compiled = JSON.parse(readFileSync(FORGE_OUT, "utf8"));
const artifact = {
  _format: "hh-sol-artifact-1",
  contractName: "MaonoVault_Phase1B",
  sourceName: "contracts/MaonoVault.sol",
  abi: compiled.abi,
  bytecode: compiled.bytecode.object,
  deployedBytecode: compiled.deployedBytecode.object,
  linkReferences: compiled.bytecode.linkReferences ?? {},
  deployedLinkReferences: compiled.deployedBytecode.linkReferences ?? {},
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;

if (check) {
  const current = existsSync(ARTIFACT) ? readFileSync(ARTIFACT, "utf8") : "";
  if (current !== serialized) {
    console.error("contracts/MaonoVault.json is stale — run: node scripts/build-maono-artifact.mjs");
    process.exit(1);
  }
  console.log("contracts/MaonoVault.json matches contracts/MaonoVault.sol");
} else {
  writeFileSync(ARTIFACT, serialized);
  console.log(`wrote ${ARTIFACT} (${artifact.abi.length} ABI entries)`);
}
