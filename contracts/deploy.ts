/**
 * deploy.ts — Full deployment script for [Platform] contract suite
 *
 * Deployment order (dependency graph):
 *   1. ReputationEngine          (no deps)
 *   2. MultiSigTreasury          (needs MTAA address — deployed as placeholder first)
 *   3. FloatingAPYCalculator     (needs MTAA address)
 *   4. MTAAToken                 (needs MultiSigTreasury, ReputationEngine, FloatingAPYCalculator)
 *   5. Wire MTAAToken address back into FloatingAPYCalculator
 *   6. ChamaTreasuryFactory      (needs cUSD stablecoin, platform treasury)
 *
 * Run:
 *   npx hardhat run scripts/deploy.ts --network alfajores   (testnet)
 *   npx hardhat run scripts/deploy.ts --network celo        (mainnet)
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY     — wallet funding the deployment
 *   CELO_RPC_URL             — Celo mainnet RPC
 *   ALFAJORES_RPC_URL        — Celo testnet RPC
 *   CHAINLINK_MTAA_USD_FEED  — Chainlink MTAA/USD price feed address (mainnet only)
 *   PLATFORM_TREASURY_SIGNERS — comma-separated list of 5 signer addresses
 */

import hre from 'hardhat';
const { ethers } = hre;
import * as fs from 'fs';
import * as path from 'path';

// ── Celo addresses ────────────────────────────────────────────────────────────

const ADDRESSES = {
  alfajores: {
    cUSD: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
    chainlinkFeed: ethers.ZeroAddress, // No MTAA feed on testnet — use ZeroAddress
  },
  celo: {
    cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    chainlinkFeed: process.env.CHAINLINK_MTAA_USD_FEED || ethers.ZeroAddress,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[deploy] ${msg}`);
}

function logAddress(name: string, address: string) {
  console.log(`  ✓ ${name.padEnd(30)} ${address}`);
}

async function saveDeployment(network: string, addresses: Record<string, string>) {
  const outDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, `${network}.json`);
  const existing = fs.existsSync(outFile)
    ? JSON.parse(fs.readFileSync(outFile, 'utf8'))
    : {};

  const updated = {
    ...existing,
    ...addresses,
    deployedAt: new Date().toISOString(),
    network,
  };

  fs.writeFileSync(outFile, JSON.stringify(updated, null, 2));
  log(`Deployment addresses saved to deployments/${network}.json`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  log(`Deploying on network: ${network}`);
  log(`Deployer: ${deployer.address}`);
  log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} CELO`);
  console.log('');

  const netAddresses = network === 'celo'
    ? ADDRESSES.celo
    : ADDRESSES.alfajores;

  // Parse signers for MultiSigTreasury (protocol treasury, not chama treasury)
  const signerEnv = process.env.PLATFORM_TREASURY_SIGNERS || '';
  const protocolSigners: string[] = signerEnv
    .split(',')
    .map(s => s.trim())
    .filter(s => ethers.isAddress(s));

  if (protocolSigners.length < 5) {
    throw new Error(
      `PLATFORM_TREASURY_SIGNERS must contain exactly 5 valid addresses. ` +
      `Got: ${protocolSigners.length}`
    );
  }

  // ── Step 1: ReputationEngine ───────────────────────────────────────────────
  // Needs MTAA address — deploy with placeholder (deployer), update after step 4

  log('Step 1: Deploying ReputationEngine...');
  const ReputationEngine = await ethers.getContractFactory('ReputationEngine');
  const reputationEngine = await ReputationEngine.deploy(
    ethers.ZeroAddress, // placeholder MTAA address
    deployer.address    // owner
  );
  await reputationEngine.waitForDeployment();
  logAddress('ReputationEngine', await reputationEngine.getAddress());

  // ── Step 2: MultiSigTreasury (protocol treasury) ───────────────────────────

  log('Step 2: Deploying MultiSigTreasury (protocol)...');
  const MultiSigTreasury = await ethers.getContractFactory('MultiSigTreasury');
  const multiSigTreasury = await MultiSigTreasury.deploy(
    ethers.ZeroAddress,               // placeholder MTAA — updated after step 4
    protocolSigners as [string, string, string, string, string]
  );
  await multiSigTreasury.waitForDeployment();
  logAddress('MultiSigTreasury', await multiSigTreasury.getAddress());

  // ── Step 3: FloatingAPYCalculator ─────────────────────────────────────────

  log('Step 3: Deploying FloatingAPYCalculator...');
  const FloatingAPYCalculator = await ethers.getContractFactory('FloatingAPYCalculator');
  const floatingAPY = await FloatingAPYCalculator.deploy(
    ethers.ZeroAddress // placeholder MTAA — wired in step 5
  );
  await floatingAPY.waitForDeployment();
  logAddress('FloatingAPYCalculator', await floatingAPY.getAddress());

  // ── Step 4: MTAAToken ──────────────────────────────────────────────────────

  log('Step 4: Deploying MTAAToken...');
  const MTAAToken = await ethers.getContractFactory('MTAAToken');
  const mtaaToken = await MTAAToken.deploy(
    deployer.address,                          // owner
    await multiSigTreasury.getAddress(),        // multiSigTreasury
    await reputationEngine.getAddress(),        // reputationEngine
    await floatingAPY.getAddress()              // apyCalculator
  );
  await mtaaToken.waitForDeployment();
  logAddress('MTAAToken', await mtaaToken.getAddress());

    // ── Step 4.5: Deploy TokenDistributionInitializer and grant distributor role ─
    log('Step 4.5: Deploying TokenDistributionInitializer (one-shot distributor)...');
    const TokenDistributionInitializer = await ethers.getContractFactory('TokenDistributionInitializer');
    const distributor = await TokenDistributionInitializer.deploy(await mtaaToken.getAddress(), deployer.address);
    await distributor.waitForDeployment();
    logAddress('TokenDistributionInitializer', await distributor.getAddress());

    // Grant DISTRIBUTOR_ROLE to initializer so it can create vesting schedules
    try {
      const DISTRIBUTOR_ROLE = await mtaaToken.DISTRIBUTOR_ROLE();
      const grantDistTx = await mtaaToken.grantRole(DISTRIBUTOR_ROLE, await distributor.getAddress());
      await grantDistTx.wait();
      log(`  ✓ DISTRIBUTOR_ROLE granted to initializer: ${await distributor.getAddress()}`);
    } catch (e) {
      log('  ⚠ Warning: failed to grant DISTRIBUTOR_ROLE automatically — grant manually before distribution');
    }

    // Ensure deployer (owner) approves the initializer to pull the on-chain transfer amounts
    try {
      log('  Approving initializer to pull distribution transfers...');
      // Approve maximum expected immediate transfers: airdrop + liquidity + public sale + dao reserve
      const approveAmount = ethers.parseUnits('375000000', 18); // 50M + 75M + 50M + 200M = 375M
      const approveTx = await mtaaToken.approve(await distributor.getAddress(), approveAmount);
      await approveTx.wait();
      log(`  ✓ Approved ${approveAmount} MTAA for initializer: ${await distributor.getAddress()}`);
    } catch (e) {
      log('  ⚠ Warning: failed to auto-approve initializer — ensure owner approves token transfers before calling executeDistribution');
    }

    // Optional: auto-run executeDistribution if all recipient addresses are provided via env
    const autoExec = process.env.AUTO_EXECUTE_DISTRIBUTION === 'true';
    if (autoExec) {
      const treas = process.env.DISTRIBUTION_TREASURY_DAO || '';
      const partner = process.env.DISTRIBUTION_PARTNER_FUND || '';
      const team = process.env.DISTRIBUTION_TEAM_MULTISIG || '';
      const airdrop = process.env.DISTRIBUTION_AIRDROP_FUND || '';
      const liquidity = process.env.DISTRIBUTION_LIQUIDITY_FUND || '';
      const publicSale = process.env.DISTRIBUTION_PUBLIC_SALE_FUND || '';
      const daoReserve = process.env.DISTRIBUTION_DAO_RESERVE_FUND || '';

      if ([treas, partner, team, airdrop, liquidity, publicSale, daoReserve].every(a => ethers.isAddress(a))) {
        try {
          log('  Auto-executing full distribution via initializer...');
          const execTx = await distributor.executeDistribution(
            treas,
            partner,
            team,
            airdrop,
            liquidity,
            publicSale,
            daoReserve
          );
          await execTx.wait();
          log('  ✓ executeDistribution completed');
        } catch (e) {
          log('  ⚠ Warning: executeDistribution failed — check approvals and balances');
        }
      } else {
        log('  ⚠ AUTO_EXECUTE_DISTRIBUTION set but recipient addresses are missing or invalid — skipping auto-execute');
      }
    }

  // ── Step 5: Wire MTAA address into supporting contracts ───────────────────

  log('Step 5: Wiring MTAAToken address into supporting contracts...');

  // FloatingAPYCalculator needs MTAAToken to call getTotalStaked()
  // The contract uses mtaaToken address directly — update it
  // Note: FloatingAPYCalculator.mtaaToken is public but has no setter
  // You need to add a setter or re-deploy with correct address.
  // Recommended: add this to FloatingAPYCalculator before deploying:
  //
  //   function setMtaaToken(address _mtaaToken) external {
  //     require(msg.sender == admin, "Only admin");
  //     require(mtaaToken == address(0) || mtaaToken == address(this), "Already set");
  //     mtaaToken = _mtaaToken;
  //   }
  //
  // For now we log a warning — add the setter and uncomment:
  // Wire MTAA into FloatingAPYCalculator (setter added in contract)
  log('  Wiring MTAAToken into FloatingAPYCalculator...');
  const setMtaaTx = await floatingAPY.setMtaaToken(await mtaaToken.getAddress());
  await setMtaaTx.wait();
  log(`  ✓ FloatingAPYCalculator.mtaaToken set to ${await mtaaToken.getAddress()}`);
  log('  ⚠ FloatingAPYCalculator.mtaaToken needs a setter — add setMtaaToken() before mainnet');

  // Set price feed on MTAAToken (mainnet only)
  if (netAddresses.chainlinkFeed !== ethers.ZeroAddress) {
    log('  Setting Chainlink price feed on MTAAToken...');
    const setFeedTx = await mtaaToken.setPriceFeed(netAddresses.chainlinkFeed);
    await setFeedTx.wait();
    log(`  ✓ Price feed set: ${netAddresses.chainlinkFeed}`);
  } else {
    log('  ⚠ No Chainlink feed configured — USD-denominated fees disabled until set');
  }

  // ── Step 6: ChamaTreasuryFactory ──────────────────────────────────────────

  log('Step 6: Deploying ChamaTreasuryFactory...');
  const ChamaTreasuryFactory = await ethers.getContractFactory('ChamaTreasuryFactory');
  const chamaTreasuryFactory = await ChamaTreasuryFactory.deploy(
    netAddresses.cUSD,                        // stablecoin (cUSD on Celo)
    await multiSigTreasury.getAddress()        // platform treasury receives fees
  );
  await chamaTreasuryFactory.waitForDeployment();
  logAddress('ChamaTreasuryFactory', await chamaTreasuryFactory.getAddress());

  // Configure factory to use the deployed FloatingAPYCalculator for all new treasuries
  try {
    log('  Setting APY calculator on ChamaTreasuryFactory...');
    const setFactoryApyTx = await chamaTreasuryFactory.setApyCalculator(await floatingAPY.getAddress());
    await setFactoryApyTx.wait();
    log(`  ✓ ChamaTreasuryFactory configured with APY calculator: ${await floatingAPY.getAddress()}`);
  } catch (e) {
    log('  ⚠ Warning: failed to set APY calculator on ChamaTreasuryFactory — call setApyCalculator manually');
  }

  // ── Step 6.5: Deploy RotationModule (optional) and whitelist in ChamaTreasury ─
  log('Step 6.5: Deploying RotationModule...');
  const RotationModule = await ethers.getContractFactory('RotationModule');
  const rotationModule = await RotationModule.deploy();
  await rotationModule.waitForDeployment();
  logAddress('RotationModule', await rotationModule.getAddress());

  // If a specific ChamaTreasury address is provided, whitelist the RotationModule
  const chamaAddrEnv = process.env.CHAMA_TREASURY_ADDRESS || '';
  if (chamaAddrEnv && ethers.isAddress(chamaAddrEnv)) {
    log(`  Whitelisting RotationModule in ChamaTreasury ${chamaAddrEnv}...`);
    const ChamaTreasury = await ethers.getContractFactory('ChamaTreasury');
    const chama = ChamaTreasury.attach(chamaAddrEnv);
    try {
      const tx = await chama.setApprovedProposer(await rotationModule.getAddress(), true);
      await tx.wait();
      log(`  ✓ RotationModule whitelisted in ChamaTreasury: ${chamaAddrEnv}`);
    } catch (e) {
      log('  ⚠ Warning: failed to whitelist RotationModule automatically — setApprovedProposer manually');
    }
    // Also set FloatingAPYCalculator as the APY oracle on the ChamaTreasury if desired
    try {
      log(`  Setting APY calculator on ChamaTreasury ${chamaAddrEnv}...`);
      const setApyTx = await chama.setApyCalculator(await floatingAPY.getAddress());
      await setApyTx.wait();
      log(`  ✓ APY calculator set on ChamaTreasury: ${await floatingAPY.getAddress()}`);
    } catch (e) {
      log('  ⚠ Warning: failed to set APY calculator on ChamaTreasury — call setApyCalculator manually');
    }
  } else {
    log('  ⚠ No CHAMA_TREASURY_ADDRESS provided — skipping automatic whitelist. Call setApprovedProposer manually.');
  }

  // ── Step 7: Grant roles ───────────────────────────────────────────────────

  log('Step 7: Granting roles...');

  // Grant ORACLE_ROLE to a designated server oracle wallet
  // Set ORACLE_WALLET in env, or use deployer for testnet
  const oracleWallet = process.env.ORACLE_WALLET || deployer.address;
  const ORACLE_ROLE = await mtaaToken.ORACLE_ROLE();
  const grantTx = await mtaaToken.grantRole(ORACLE_ROLE, oracleWallet);
  await grantTx.wait();
  log(`  ✓ ORACLE_ROLE granted to: ${oracleWallet}`);

  // On mainnet: revoke ORACLE_ROLE from deployer after granting to oracle
  if (network === 'celo' && oracleWallet !== deployer.address) {
    const revokeTx = await mtaaToken.revokeRole(ORACLE_ROLE, deployer.address);
    await revokeTx.wait();
    log(`  ✓ ORACLE_ROLE revoked from deployer`);
  }

  // ── Step 8: Authorize ReputationEngine recorders ─────────────────────────

  log('Step 8: Authorizing reputation recorders...');
  // Server oracle wallet can record reputation events
  const authTx = await reputationEngine.setAuthorizedRecorder(oracleWallet, true);
  await authTx.wait();
  log(`  ✓ Oracle authorized as reputation recorder: ${oracleWallet}`);

  // ── Step 9: Deploy Guardian (emergency multisig) ─────────────────────────

  log('Step 9: Deploying Guardian (emergency multisig override)...');
  const guardianEnv = process.env.GUARDIAN_ADDRESSES || '';
  const guardianSigners = guardianEnv
    .split(',')
    .map(s => s.trim())
    .filter(s => ethers.isAddress(s));

  if (guardianSigners.length !== 3) {
    throw new Error('GUARDIAN_ADDRESSES must contain exactly 3 valid addresses');
  }

  const Guardian = await ethers.getContractFactory('Guardian');
  const guardian = await Guardian.deploy(guardianSigners);
  await guardian.waitForDeployment();
  logAddress('Guardian', await guardian.getAddress());

  // ── Summary ───────────────────────────────────────────────────────────────

  const deployedAddresses: Record<string, string> = {
    ReputationEngine:       await reputationEngine.getAddress(),
    MultiSigTreasury:       await multiSigTreasury.getAddress(),
    FloatingAPYCalculator:  await floatingAPY.getAddress(),
    MTAAToken:              await mtaaToken.getAddress(),
    ChamaTreasuryFactory:   await chamaTreasuryFactory.getAddress(),
    TokenDistributionInitializer: await distributor.getAddress(),
    RotationModule:         await rotationModule.getAddress(),
    Guardian:               await guardian.getAddress(),
    cUSD:                   netAddresses.cUSD,
    chainlinkFeed:          netAddresses.chainlinkFeed,
  };

  console.log('\n── Deployment complete ──────────────────────────────');
  Object.entries(deployedAddresses).forEach(([name, addr]) => {
    logAddress(name, addr);
  });

  console.log('\n── Add to .env ──────────────────────────────────────');
  console.log(`MTAA_TOKEN_ADDRESS=${deployedAddresses.MTAAToken}`);
  console.log(`CHAMA_FACTORY_CONTRACT_ADDRESS=${deployedAddresses.ChamaTreasuryFactory}`);
  console.log(`STABLECOIN_ADDRESS=${deployedAddresses.cUSD}`);
  console.log(`MULTISIG_CHAIN_ID=${network === 'celo' ? 42220 : 44787}`);
  console.log('');

  console.log('── Pending manual steps ─────────────────────────────');
  console.log('1. Add setMtaaToken() to FloatingAPYCalculator and call it');
  console.log('2. Verify contracts on Celoscan:');
  console.log(`   npx hardhat verify --network ${network} ${deployedAddresses.MTAAToken} "${deployer.address}" "${deployedAddresses.MultiSigTreasury}" "${deployedAddresses.ReputationEngine}" "${deployedAddresses.FloatingAPYCalculator}"`);
  console.log('3. Transfer MultiSigTreasury admin to multisig once signers confirm');
  console.log('4. Set ORACLE_WALLET in env to a dedicated server wallet (not deployer)');
  console.log('5. Add GUARDIAN_ADDRESSES to .env (3 comma-separated addresses)');

  await saveDeployment(network, deployedAddresses);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });