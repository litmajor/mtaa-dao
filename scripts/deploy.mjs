// Canonical MaonoVault deployment: implementation -> factory -> clones.
//
// MaonoVault_Phase1B has no constructor arguments and disables its own
// initializers: it is only ever used as the implementation behind EIP-1167
// clones that MaonoVaultFactory_Phase1B creates and initializes atomically in
// `deployVault()`. Deploying it directly and calling `initialize()` by hand
// would produce a vault whose platform admin is the deployer rather than the
// factory, so this script never does that.
//
// Env:
//   PLATFORM_TREASURY  required — receives the non-burned share of upkeep
//   MTAA_TOKEN         required — MTAA token address
//   PRICE_ORACLE       optional — spawn-cost oracle (address(0) disables it)
//   SUPPORTED_ASSETS   optional — comma-separated allowlist of vault assets
//   SPAWN_GATEWAY      optional — spawn-credit gateway; deployVault() needs it

import hardhat from "hardhat";
const { ethers } = hardhat;

function requiredAddress(name) {
  const value = process.env[name];
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`${name} must be set to a valid address (got: ${value ?? "unset"})`);
  }
  return ethers.getAddress(value);
}

function optionalAddress(name) {
  const value = process.env[name];
  if (!value) return ethers.ZeroAddress;
  if (!ethers.isAddress(value)) throw new Error(`${name} is not a valid address: ${value}`);
  return ethers.getAddress(value);
}

/**
 * The vault reports `totalAssets()` as its own ERC20 balance, so only
 * plain-transfer, non-rebasing, non-fee-on-transfer tokens may be allowlisted
 * (M-2). MTAA itself can never be an asset: the factory rejects it.
 */
function supportedAssets() {
  return (process.env.SUPPORTED_ASSETS || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      if (!ethers.isAddress(a)) throw new Error(`SUPPORTED_ASSETS contains an invalid address: ${a}`);
      return ethers.getAddress(a);
    });
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const platformTreasury = requiredAddress("PLATFORM_TREASURY");
  const mtaaToken = requiredAddress("MTAA_TOKEN");
  const priceOracle = optionalAddress("PRICE_ORACLE");
  const spawnGateway = optionalAddress("SPAWN_GATEWAY");
  const assets = supportedAssets();

  console.log("Deploying with account:", deployer.address);

  const Implementation = await ethers.getContractFactory("MaonoVault_Phase1B");
  const implementation = await Implementation.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();
  console.log("MaonoVault_Phase1B implementation:", implementationAddress);

  const Factory = await ethers.getContractFactory("MaonoVaultFactory_Phase1B");
  const factory = await Factory.deploy(
    implementationAddress,
    platformTreasury,
    mtaaToken,
    priceOracle,
    assets
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("MaonoVaultFactory_Phase1B:", factoryAddress);

  if (spawnGateway !== ethers.ZeroAddress) {
    const tx = await factory.setSpawnGateway(spawnGateway);
    await tx.wait();
    console.log("Spawn gateway:", spawnGateway);
  } else {
    console.log("No SPAWN_GATEWAY set: deployVault() will revert until one is configured.");
  }

  console.log("Supported assets:", assets.length ? assets.join(", ") : "(none yet)");
  console.log("\nVaults are created with factory.deployVault(asset, name, symbol, vaultType).");
  console.log("The factory is the platform admin of every vault it deploys: upkeep pricing,");
  console.log("burn percentages, treasury and oracle configuration are reachable only through");
  console.log("the factory owner, never through a vault owner.");
}

main().catch((error) => {
  console.error("Error deploying contracts:");
  console.error(error);
  process.exitCode = 1;
});
