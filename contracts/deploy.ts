/**
 * deploy.ts — Full deployment script for MtaaDAO contract suite
 *
 * Deployment order (dependency graph):
 *   1.  ReputationEngine                (no deps)
 *   2.  MultiSigTreasury                (needs MTAA placeholder)
 *   3.  FloatingAPYCalculator           (needs MTAA placeholder)
 *   4.  MTAAToken                       (needs 2 + 1 + 3)
 *   4.5 TokenDistributionInitializer    (needs 4)
 *   5.  Wire MTAAToken into 1, 2, 3
 *   6.  ChamaTreasuryFactory            (needs cUSD, 2)
 *   6.5 RotationModule
 *   7.  GovernanceAccessManager         (needs 4, guardian addresses)  ← NEW
 *   8.  AgentTreasury                   (needs 4)                      ← NEW
 *   9.  AgentPermissionManager          (no constructor deps)          ← NEW
 *   10. Grant roles
 *   11. Authorize reputation recorders
 *   12. Guardian (emergency multisig)
 *
 * Run:
 *   npx hardhat run scripts/deploy.ts --network alfajores   (testnet)
 *   npx hardhat run scripts/deploy.ts --network celo        (mainnet)
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY              — wallet funding the deployment
 *   CELO_RPC_URL                      — Celo mainnet RPC
 *   ALFAJORES_RPC_URL                 — Celo testnet RPC
 *   CHAINLINK_MTAA_USD_FEED           — Chainlink MTAA/USD price feed (mainnet only)
 *   PLATFORM_TREASURY_SIGNERS         — comma-separated list of 5 signer addresses
 *   GUARDIAN_ADDRESSES                — comma-separated list of 3 guardian addresses
 *                                       (shared by GovernanceAccessManager + Guardian contract)
 *
 * Optional env vars:
 *   ORACLE_WALLET                     — dedicated server oracle (defaults to deployer on testnet)
 *   CHAMA_TREASURY_ADDRESS            — existing ChamaTreasury to whitelist RotationModule in
 *   AUTO_EXECUTE_DISTRIBUTION         — "true" to run distribution immediately
 *   DISTRIBUTION_*                    — recipient addresses for auto-distribution
 *   SUBSCRIPTION_MANAGER_ADDRESS      — if already deployed; wired into AgentPermissionManager
 *   REVENUE_DISTRIBUTOR_ADDRESS       — if already deployed; proposed as AgentTreasury distributor
 */

import hre from 'hardhat';
const { ethers } = hre;
import * as fs from 'fs';
import * as path from 'path';

// ── Celo addresses ────────────────────────────────────────────────────────────

const ADDRESSES = {
  alfajores: {
    cUSD: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
    chainlinkFeed: ethers.ZeroAddress,
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
  console.log(`  ✓ ${name.padEnd(35)} ${address}`);
}

function logWarning(msg: string) {
  console.log(`  ⚠ ${msg}`);
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
  log(`Deployer:             ${deployer.address}`);
  log(`Balance:              ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} CELO`);
  console.log('');

  const netAddresses = network === 'celo' ? ADDRESSES.celo : ADDRESSES.alfajores;

  // ── Validate guardian addresses (shared by GovernanceAccessManager + Guardian contract)
  const guardianEnv = process.env.GUARDIAN_ADDRESSES || '';
  const guardianSigners = guardianEnv
    .split(',')
    .map(s => s.trim())
    .filter(s => ethers.isAddress(s));

  if (guardianSigners.length < 2) {
    throw new Error(
      `GUARDIAN_ADDRESSES must contain at least 2 valid addresses (GovernanceAccessManager requires GUARDIAN_THRESHOLD=2). Got: ${guardianSigners.length}`
    );
  }
  if (guardianSigners.length !== 3) {
    logWarning('GUARDIAN_ADDRESSES has fewer than 3 addresses — Guardian multisig contract requires exactly 3. Continuing, but Guardian deploy in Step 12 may fail.');
  }

  // ── Validate protocol treasury signers
  const signerEnv = process.env.PLATFORM_TREASURY_SIGNERS || '';
  const protocolSigners: string[] = signerEnv
    .split(',')
    .map(s => s.trim())
    .filter(s => ethers.isAddress(s));

  if (protocolSigners.length < 5) {
    throw new Error(
      `PLATFORM_TREASURY_SIGNERS must contain exactly 5 valid addresses. Got: ${protocolSigners.length}`
    );
  }

  // ── Step 1: ReputationEngine ───────────────────────────────────────────────

  log('Step 1: Deploying ReputationEngine...');
  const ReputationEngine = await ethers.getContractFactory('ReputationEngine');
  const reputationEngine = await ReputationEngine.deploy(
    ethers.ZeroAddress, // placeholder MTAA — wired in Step 5
    deployer.address
  );
  await reputationEngine.waitForDeployment();
  logAddress('ReputationEngine', await reputationEngine.getAddress());

  // ── Step 2: MultiSigTreasury ───────────────────────────────────────────────

  log('Step 2: Deploying MultiSigTreasury (protocol)...');
  const MultiSigTreasury = await ethers.getContractFactory('MultiSigTreasury');
  const multiSigTreasury = await MultiSigTreasury.deploy(
    ethers.ZeroAddress,
    protocolSigners as [string, string, string, string, string]
  );
  await multiSigTreasury.waitForDeployment();
  logAddress('MultiSigTreasury', await multiSigTreasury.getAddress());

  // ── Step 3: FloatingAPYCalculator ─────────────────────────────────────────

  log('Step 3: Deploying FloatingAPYCalculator...');
  const FloatingAPYCalculator = await ethers.getContractFactory('FloatingAPYCalculator');
  const floatingAPY = await FloatingAPYCalculator.deploy(ethers.ZeroAddress);
  await floatingAPY.waitForDeployment();
  logAddress('FloatingAPYCalculator', await floatingAPY.getAddress());

  // ── Step 4: MTAAToken ──────────────────────────────────────────────────────

  log('Step 4: Deploying MTAAToken...');
  const MTAAToken = await ethers.getContractFactory('MTAAToken');
  const mtaaToken = await MTAAToken.deploy(
    deployer.address,
    await multiSigTreasury.getAddress(),
    await reputationEngine.getAddress(),
    await floatingAPY.getAddress()
  );
  await mtaaToken.waitForDeployment();
  const mtaaAddress = await mtaaToken.getAddress();
  logAddress('MTAAToken', mtaaAddress);

  // ── Step 4.5: TokenDistributionInitializer ────────────────────────────────

  log('Step 4.5: Deploying TokenDistributionInitializer...');
  const TokenDistributionInitializer = await ethers.getContractFactory('TokenDistributionInitializer');
  const distributor = await TokenDistributionInitializer.deploy(mtaaAddress, deployer.address);
  await distributor.waitForDeployment();
  logAddress('TokenDistributionInitializer', await distributor.getAddress());

  try {
    const DISTRIBUTOR_ROLE = await mtaaToken.DISTRIBUTOR_ROLE();
    const grantDistTx = await mtaaToken.grantRole(DISTRIBUTOR_ROLE, await distributor.getAddress());
    await grantDistTx.wait();
    log(`  ✓ DISTRIBUTOR_ROLE granted to initializer`);
  } catch {
    logWarning('Failed to grant DISTRIBUTOR_ROLE automatically — grant manually before distribution');
  }

  try {
    const approveAmount = ethers.parseUnits('375000000', 18);
    const approveTx = await mtaaToken.approve(await distributor.getAddress(), approveAmount);
    await approveTx.wait();
    log(`  ✓ Approved 375M MTAA for initializer`);
  } catch {
    logWarning('Failed to auto-approve initializer — ensure owner approves before executeDistribution');
  }

  const autoExec = process.env.AUTO_EXECUTE_DISTRIBUTION === 'true';
  if (autoExec) {
    const distRecipients = [
      process.env.DISTRIBUTION_TREASURY_DAO,
      process.env.DISTRIBUTION_PARTNER_FUND,
      process.env.DISTRIBUTION_TEAM_MULTISIG,
      process.env.DISTRIBUTION_AIRDROP_FUND,
      process.env.DISTRIBUTION_LIQUIDITY_FUND,
      process.env.DISTRIBUTION_PUBLIC_SALE_FUND,
      process.env.DISTRIBUTION_DAO_RESERVE_FUND,
    ];
    if (distRecipients.every(a => a && ethers.isAddress(a))) {
      try {
        log('  Auto-executing full distribution...');
        const execTx = await distributor.executeDistribution(...distRecipients);
        await execTx.wait();
        log('  ✓ executeDistribution completed');
      } catch {
        logWarning('executeDistribution failed — check approvals and balances');
      }
    } else {
      logWarning('AUTO_EXECUTE_DISTRIBUTION set but recipient addresses are missing — skipping');
    }
  }

  // ── Step 5: Wire MTAAToken into supporting contracts ──────────────────────

  log('Step 5: Wiring MTAAToken address into supporting contracts...');

  try {
    const setMtaaTx = await floatingAPY.setMtaaToken(mtaaAddress);
    await setMtaaTx.wait();
    log(`  ✓ FloatingAPYCalculator.mtaaToken → ${mtaaAddress}`);
  } catch {
    logWarning('Failed to set MTAAToken on FloatingAPYCalculator — add setMtaaToken() to contract');
  }

  if (netAddresses.chainlinkFeed !== ethers.ZeroAddress) {
    const setFeedTx = await mtaaToken.setPriceFeed(netAddresses.chainlinkFeed);
    await setFeedTx.wait();
    log(`  ✓ Chainlink price feed set: ${netAddresses.chainlinkFeed}`);
  } else {
    logWarning('No Chainlink feed configured — USD-denominated fees disabled until set');
  }

  // ── Step 6: ChamaTreasuryFactory ──────────────────────────────────────────

  log('Step 6: Deploying ChamaTreasuryFactory...');
  const ChamaTreasuryFactory = await ethers.getContractFactory('ChamaTreasuryFactory');
  const chamaTreasuryFactory = await ChamaTreasuryFactory.deploy(
    netAddresses.cUSD,
    await multiSigTreasury.getAddress()
  );
  await chamaTreasuryFactory.waitForDeployment();
  logAddress('ChamaTreasuryFactory', await chamaTreasuryFactory.getAddress());

  try {
    const setFactoryApyTx = await chamaTreasuryFactory.setApyCalculator(await floatingAPY.getAddress());
    await setFactoryApyTx.wait();
    log(`  ✓ ChamaTreasuryFactory APY calculator set`);
  } catch {
    logWarning('Failed to set APY calculator on ChamaTreasuryFactory — call setApyCalculator manually');
  }

  // ── Step 6.5: RotationModule ───────────────────────────────────────────────

  log('Step 6.5: Deploying RotationModule...');
  const RotationModule = await ethers.getContractFactory('RotationModule');
  const rotationModule = await RotationModule.deploy();
  await rotationModule.waitForDeployment();
  logAddress('RotationModule', await rotationModule.getAddress());

  const chamaAddrEnv = process.env.CHAMA_TREASURY_ADDRESS || '';
  if (chamaAddrEnv && ethers.isAddress(chamaAddrEnv)) {
    const ChamaTreasury = await ethers.getContractFactory('ChamaTreasury');
    const chama = ChamaTreasury.attach(chamaAddrEnv);
    try {
      const tx = await chama.setApprovedProposer(await rotationModule.getAddress(), true);
      await tx.wait();
      log(`  ✓ RotationModule whitelisted in ChamaTreasury: ${chamaAddrEnv}`);
    } catch {
      logWarning('Failed to whitelist RotationModule — call setApprovedProposer manually');
    }
    try {
      const setApyTx = await chama.setApyCalculator(await floatingAPY.getAddress());
      await setApyTx.wait();
      log(`  ✓ APY calculator set on ChamaTreasury`);
    } catch {
      logWarning('Failed to set APY calculator on ChamaTreasury — call setApyCalculator manually');
    }
  } else {
    logWarning('No CHAMA_TREASURY_ADDRESS provided — RotationModule not whitelisted. Call setApprovedProposer manually.');
  }

  // ── Step 7: GovernanceAccessManager ─────────────────────────────────────── ← NEW

  log('Step 7: Deploying GovernanceAccessManager...');
  const GovernanceAccessManager = await ethers.getContractFactory('GovernanceAccessManager');
  const governanceAccessManager = await GovernanceAccessManager.deploy(
    mtaaAddress,
    guardianSigners  // reuses GUARDIAN_ADDRESSES — same set as Step 12
  );
  await governanceAccessManager.waitForDeployment();
  const govAddress = await governanceAccessManager.getAddress();
  logAddress('GovernanceAccessManager', govAddress);

  // ── Step 8: AgentTreasury ─────────────────────────────────────────────────  ← NEW

  log('Step 8: Deploying AgentTreasury...');
  const AgentTreasury = await ethers.getContractFactory('AgentTreasury');
  const agentTreasury = await AgentTreasury.deploy(mtaaAddress);
  await agentTreasury.waitForDeployment();
  const agentTreasuryAddress = await agentTreasury.getAddress();
  logAddress('AgentTreasury', agentTreasuryAddress);

  // Wire RevenueDistributor if already deployed (e.g. upgrading into existing env)
  const revenueDistributorEnv = process.env.REVENUE_DISTRIBUTOR_ADDRESS || '';
  if (revenueDistributorEnv && ethers.isAddress(revenueDistributorEnv)) {
    try {
      const proposeTx = await agentTreasury.proposeDistributor(revenueDistributorEnv);
      await proposeTx.wait();
      log(`  ✓ Distributor proposed: ${revenueDistributorEnv}`);
      logWarning('RevenueDistributor must call acceptDistributorRole() to activate — this is intentional (two-step)');
    } catch {
      logWarning('Failed to propose distributor — call proposeDistributor() manually after deploy');
    }
  } else {
    logWarning('REVENUE_DISTRIBUTOR_ADDRESS not set — call AgentTreasury.proposeDistributor() manually');
  }

  // ── Step 9: AgentPermissionManager ───────────────────────────────────────  ← NEW

  log('Step 9: Deploying AgentPermissionManager...');
  const AgentPermissionManager = await ethers.getContractFactory('AgentPermissionManager');
  const agentPermissionManager = await AgentPermissionManager.deploy();
  await agentPermissionManager.waitForDeployment();
  const agentPermMgrAddress = await agentPermissionManager.getAddress();
  logAddress('AgentPermissionManager', agentPermMgrAddress);

  // Wire SubscriptionManager if already deployed
  const subscriptionMgrEnv = process.env.SUBSCRIPTION_MANAGER_ADDRESS || '';
  if (subscriptionMgrEnv && ethers.isAddress(subscriptionMgrEnv)) {
    try {
      const setSubMgrTx = await agentPermissionManager.setSubscriptionManager(subscriptionMgrEnv);
      await setSubMgrTx.wait();
      log(`  ✓ SubscriptionManager wired: ${subscriptionMgrEnv}`);
    } catch {
      logWarning('Failed to set SubscriptionManager — call setSubscriptionManager() manually');
    }
  } else {
    logWarning('SUBSCRIPTION_MANAGER_ADDRESS not set — call AgentPermissionManager.setSubscriptionManager() manually');
  }

  // ── Step 10: Grant roles ──────────────────────────────────────────────────
  
    // Optional: Auto-register a sample agent on-chain and configure its payment settings
    // Trigger by setting AUTO_REGISTER_SAMPLE_AGENT=true and providing AGENT_REGISTRY_ADDRESS and AGENT_PAYMENT_GATEWAY_ADDR
    if (process.env.AUTO_REGISTER_SAMPLE_AGENT === 'true') {
      const onChainRegistryAddr = process.env.AGENT_REGISTRY_ADDRESS || process.env.AGENT_REGISTRY_ADDR || '';
      const onChainGatewayAddr = process.env.AGENT_PAYMENT_GATEWAY_ADDR || process.env.AGENT_GATEWAY_ADDR || '';

      const sampleAgentAddress = process.env.AGENT_SAMPLE_ADDRESS || '';
      const sampleAgentName = process.env.AGENT_SAMPLE_NAME || 'SampleAgent';
      const sampleAgentDescription = process.env.AGENT_SAMPLE_DESCRIPTION || 'Auto-registered sample agent';
      const sampleCategory = Number(process.env.AGENT_SAMPLE_CATEGORY || '0');
      const sampleAutonomy = Number(process.env.AGENT_SAMPLE_AUTONOMY || '2');

      if (!onChainRegistryAddr || !onChainGatewayAddr || !sampleAgentAddress) {
        logWarning('AUTO_REGISTER_SAMPLE_AGENT enabled but AGENT_REGISTRY_ADDRESS or AGENT_PAYMENT_GATEWAY_ADDR or AGENT_SAMPLE_ADDRESS missing - skipping');
      } else {
        try {
          log('Auto-registering sample agent on-chain...');

          const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
          const registry = AgentRegistry.attach(onChainRegistryAddr);

          // Preview agentId with callStatic
          let previewId: string | undefined;
          try {
            previewId = await registry.callStatic.registerAgent(sampleAgentAddress, sampleAgentName, sampleAgentDescription, sampleCategory, sampleAutonomy);
            log(`  ✓ Preview agentId: ${previewId}`);
          } catch {
            logWarning('callStatic preview failed; will attempt registration anyway');
          }

          const regTx = await registry.registerAgent(sampleAgentAddress, sampleAgentName, sampleAgentDescription, sampleCategory, sampleAutonomy);
          await regTx.wait();
          log(`  ✓ Agent registered transaction: ${regTx.hash}`);

          const agentIdToUse = previewId || (await registry.callStatic.registerAgent(sampleAgentAddress, sampleAgentName, sampleAgentDescription, sampleCategory, sampleAutonomy));

          // Configure payment settings on the AgentPaymentGateway
          try {
            const Gateway = await ethers.getContractFactory('AgentPaymentGateway');
            const gateway = Gateway.attach(onChainGatewayAddr);

            const feeInKES = BigInt(process.env.AGENT_SAMPLE_FEE_KES || '0');
            const feeInUSD = BigInt(process.env.AGENT_SAMPLE_FEE_USD || '0');
            const defaultTier = Number(process.env.AGENT_SAMPLE_DEFAULT_TIER || '0');
            const defaultSubDuration = BigInt(process.env.AGENT_SAMPLE_SUB_DURATION || '0');
            const payoutPct = Number(process.env.AGENT_SAMPLE_PAYOUT_PCT || '100');
            const treasuryPct = BigInt(process.env.AGENT_SAMPLE_TREASURY_PCT || '0');
            const communityPct = BigInt(process.env.AGENT_SAMPLE_COMMUNITY_PCT || '0');
            const acceptsMTAA = (process.env.AGENT_SAMPLE_ACCEPTS_MTAA || 'true') === 'true';
            const acceptsKES = (process.env.AGENT_SAMPLE_ACCEPTS_KES || 'true') === 'true';

            const cfgTx = await gateway.configureAgent(
              agentIdToUse,
              sampleAgentAddress,
              feeInKES,
              feeInUSD,
              defaultTier,
              defaultSubDuration,
              payoutPct,
              treasuryPct,
              communityPct,
              acceptsMTAA,
              acceptsKES
            );
            await cfgTx.wait();
            log(`  ✓ Configured AgentPaymentGateway for agent ${agentIdToUse}`);
          } catch (cfgErr) {
            logWarning(`Failed to configure AgentPaymentGateway: ${(cfgErr as Error).message}`);
          }
        } catch (err) {
          logWarning(`Auto-register sample agent failed: ${(err as Error).message}`);
        }
      }
    }

  log('Step 10: Granting roles...');
  const oracleWallet = process.env.ORACLE_WALLET || deployer.address;
  const ORACLE_ROLE = await mtaaToken.ORACLE_ROLE();
  const grantTx = await mtaaToken.grantRole(ORACLE_ROLE, oracleWallet);
  await grantTx.wait();
  log(`  ✓ ORACLE_ROLE granted to: ${oracleWallet}`);

  if (network === 'celo' && oracleWallet !== deployer.address) {
    const revokeTx = await mtaaToken.revokeRole(ORACLE_ROLE, deployer.address);
    await revokeTx.wait();
    log(`  ✓ ORACLE_ROLE revoked from deployer`);
  }

  // ── Step 11: Authorize reputation recorders ───────────────────────────────

  log('Step 11: Authorizing reputation recorders...');
  const authTx = await reputationEngine.setAuthorizedRecorder(oracleWallet, true);
  await authTx.wait();
  log(`  ✓ Oracle authorized as reputation recorder: ${oracleWallet}`);

  // ── Step 12: Guardian (emergency multisig) ────────────────────────────────

  log('Step 12: Deploying Guardian (emergency multisig)...');
  if (guardianSigners.length !== 3) {
    logWarning('Skipping Guardian deploy — requires exactly 3 addresses in GUARDIAN_ADDRESSES');
  } else {
    const Guardian = await ethers.getContractFactory('Guardian');
    const guardian = await Guardian.deploy(guardianSigners);
    await guardian.waitForDeployment();
    logAddress('Guardian', await guardian.getAddress());

    // ── Summary ───────────────────────────────────────────────────────────────

    const deployedAddresses: Record<string, string> = {
      ReputationEngine:              await reputationEngine.getAddress(),
      MultiSigTreasury:              await multiSigTreasury.getAddress(),
      FloatingAPYCalculator:         await floatingAPY.getAddress(),
      MTAAToken:                     mtaaAddress,
      TokenDistributionInitializer:  await distributor.getAddress(),
      ChamaTreasuryFactory:          await chamaTreasuryFactory.getAddress(),
      RotationModule:                await rotationModule.getAddress(),
      GovernanceAccessManager:       govAddress,
      AgentTreasury:                 agentTreasuryAddress,
      AgentPermissionManager:        agentPermMgrAddress,
      Guardian:                      await guardian.getAddress(),
      cUSD:                          netAddresses.cUSD,
      chainlinkFeed:                 netAddresses.chainlinkFeed,
    };

    console.log('\n── Deployment complete ──────────────────────────────');
    Object.entries(deployedAddresses).forEach(([name, addr]) => logAddress(name, addr));

    console.log('\n── Add to .env ──────────────────────────────────────');
    console.log(`MTAA_TOKEN_ADDRESS=${mtaaAddress}`);
    console.log(`CHAMA_FACTORY_CONTRACT_ADDRESS=${deployedAddresses.ChamaTreasuryFactory}`);
    console.log(`GOVERNANCE_CONTRACT_ADDRESS=${govAddress}`);
    console.log(`AGENT_TREASURY_ADDRESS=${agentTreasuryAddress}`);
    console.log(`AGENT_PERMISSION_MANAGER_ADDRESS=${agentPermMgrAddress}`);
    console.log(`STABLECOIN_ADDRESS=${netAddresses.cUSD}`);
    console.log(`MULTISIG_CHAIN_ID=${network === 'celo' ? 42220 : 44787}`);
    console.log('');

    console.log('── Pending manual steps ─────────────────────────────');
    console.log('1. RevenueDistributor must call AgentTreasury.acceptDistributorRole()');
    console.log('   (two-step pattern — cannot be done in deploy script)');
    console.log('2. Call AgentPermissionManager.setSubscriptionManager() if not set above');
    console.log('3. Call AgentTreasury.setAgentWithdrawalAddress(agentId, addr) per agent');
    console.log('4. Add setMtaaToken() to FloatingAPYCalculator if not already present');
    console.log('5. Set ORACLE_WALLET in .env to a dedicated server wallet (not deployer)');
    console.log('6. Transfer MultiSigTreasury admin to multisig once signers confirm');
    console.log('7. Verify contracts on Celoscan:');
    console.log(`   npx hardhat verify --network ${network} ${mtaaAddress} "${deployer.address}" "${deployedAddresses.MultiSigTreasury}" "${deployedAddresses.ReputationEngine}" "${deployedAddresses.FloatingAPYCalculator}"`);
    console.log(`   npx hardhat verify --network ${network} ${govAddress} "${mtaaAddress}" "[${guardianSigners.join(',')}]"`);
    console.log(`   npx hardhat verify --network ${network} ${agentTreasuryAddress} "${mtaaAddress}"`);
    console.log(`   npx hardhat verify --network ${network} ${agentPermMgrAddress}`);

    await saveDeployment(network, deployedAddresses);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });