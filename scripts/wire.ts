/**
 * wire.ts — Idempotent post-deployment wiring for MtaaDAO contracts
 *
 * Reads the deployment JSON produced by deploy.ts and performs all
 * cross-contract wiring. Safe to re-run: each step reads on-chain
 * state before writing and skips if already set.
 *
 * Fills the gap left by deploy.ts: ReputationEngine and MultiSigTreasury
 * were deployed with ZeroAddress placeholders for MTAAToken — this script
 * wires those in, along with all other cross-contract dependencies.
 *
 * Usage:
 *   npx hardhat run scripts/wire.ts --network alfajores
 *   npx hardhat run scripts/wire.ts --network celo
 *   DRY_RUN=true npx hardhat run scripts/wire.ts --network alfajores
 *
 * Optional env vars:
 *   ORACLE_WALLET                   — address for ORACLE_ROLE (defaults to deployer)
 *   CHAMA_TREASURY_ADDRESS          — per-instance: whitelist RotationModule + APY
 *   DRY_RUN=true                    — print all pending steps without sending txns
 *   AUTO_EXECUTE_DISTRIBUTION=true  — trigger TokenDistributionInitializer
 *   DISTRIBUTION_TREASURY_DAO
 *   DISTRIBUTION_PARTNER_FUND
 *   DISTRIBUTION_TEAM_MULTISIG
 *   DISTRIBUTION_AIRDROP_FUND
 *   DISTRIBUTION_LIQUIDITY_FUND
 *   DISTRIBUTION_PUBLIC_SALE_FUND
 *   DISTRIBUTION_DAO_RESERVE_FUND
 */

import hre from 'hardhat';
import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeploymentState {
  ReputationEngine?: string;
  MultiSigTreasury?: string;
  FloatingAPYCalculator?: string;
  MTAAToken?: string;
  ChamaTreasuryFactory?: string;
  TokenDistributionInitializer?: string;
  RotationModule?: string;
  Guardian?: string;
  cUSD?: string;
  chainlinkFeed?: string;
  network?: string;
  deployedAt?: string;
  wiredAt?: string;
  wiringSteps?: Record<string, boolean>;
}

type StepStatus = 'done' | 'skipped' | 'failed';

interface StepResult {
  status: StepStatus;
  detail: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === 'true';

// ── ANSI colours (degrade gracefully in CI) ───────────────────────────────────

const NO_COLOR = !process.stdout.isTTY;
const c = {
  green:  (s: string) => NO_COLOR ? s : `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => NO_COLOR ? s : `\x1b[33m${s}\x1b[0m`,
  red:    (s: string) => NO_COLOR ? s : `\x1b[31m${s}\x1b[0m`,
  cyan:   (s: string) => NO_COLOR ? s : `\x1b[36m${s}\x1b[0m`,
  dim:    (s: string) => NO_COLOR ? s : `\x1b[2m${s}\x1b[0m`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Load deployment state from deployments/<network>.json.
 * Uses hre.network.name (the --network flag value) to find the file,
 * which is consistent regardless of what ethers.provider.getNetwork()
 * returns for custom chains like Celo.
 */
function loadState(networkName: string): DeploymentState {
  const file = path.join(__dirname, '..', 'deployments', `${networkName}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No deployment state found for "${networkName}" at ${file}\n` +
      `Run deploy.ts first: npx hardhat run scripts/deploy.ts --network ${networkName}`
    );
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(c.dim(`  Loaded: ${file} (deployed ${raw.deployedAt ?? 'unknown'})`));
  return raw;
}

function saveState(networkName: string, state: DeploymentState): void {
  const dir  = path.join(__dirname, '..', 'deployments');
  const file = path.join(dir, `${networkName}.json`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...state, wiredAt: new Date().toISOString() }, null, 2));
}

function logStep(label: string, result: StepResult): void {
  const icon   = result.status === 'done' ? '✓' : result.status === 'skipped' ? '–' : '✗';
  const colorFn =
    result.status === 'done'    ? c.green  :
    result.status === 'skipped' ? c.dim    : c.red;
  console.log(`  ${colorFn(icon)} ${label.padEnd(52)} ${c.dim(result.detail)}`);
}

/**
 * Execute or preview a transaction.
 * - In DRY_RUN mode: prints the action and returns without sending.
 * - Otherwise:       calls fn(), awaits the tx, returns.
 */
async function exec(label: string, fn: () => Promise<any>): Promise<void> {
  if (DRY_RUN) {
    console.log(`  ${c.yellow('[dry]')} ${label}`);
    return;
  }
  const tx = await fn();
  if (tx && typeof tx.wait === 'function') await tx.wait();
}

/**
 * Silently try to read a public getter; return ZeroAddress if the call
 * reverts (e.g. getter doesn't exist on this version of the contract).
 */
async function tryRead(fn: () => Promise<string>): Promise<string> {
  try { return await fn(); } catch { return ethers.ZeroAddress; }
}

/**
 * Silently try to read a boolean getter; return false on revert.
 */
async function tryReadBool(fn: () => Promise<boolean>): Promise<boolean> {
  try { return await fn(); } catch { return false; }
}

// ── Step runner ───────────────────────────────────────────────────────────────

/**
 * Runs a single wiring step with full error isolation.
 * Returns a StepResult regardless of outcome.
 */
async function runStep(
  label:    string,
  stepKey:  string,
  results:  Record<string, StepResult>,
  wired:    Record<string, boolean>,
  fn:       () => Promise<StepResult>
): Promise<StepResult> {
  let result: StepResult;
  try {
    result = await fn();
  } catch (e: any) {
    result = { status: 'failed', detail: e?.shortMessage ?? e?.message ?? String(e) };
  }
  results[stepKey] = result;
  if (result.status === 'done') wired[stepKey] = true;
  logStep(label, result);
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer]    = await ethers.getSigners();
  const networkInfo   = await ethers.provider.getNetwork();
  const networkName   = (hre.network as any).name ?? String(networkInfo.chainId); // matches --network flag when available
  const isMainnet     = networkName === 'celo' || networkInfo.chainId === 42220;
  const oracleWallet  = (process.env.ORACLE_WALLET || deployer.address).trim();
  const chamaAddr     = (process.env.CHAMA_TREASURY_ADDRESS || '').trim();

  console.log(`\n${c.cyan('══ MtaaDAO Wire ════════════════════════════════════════')}`);
  console.log(`  Network:   ${networkName}${isMainnet ? c.yellow(' ⚠ MAINNET') : ' (testnet)'}`);
  console.log(`  Deployer:  ${deployer.address}`);
  console.log(`  Oracle:    ${oracleWallet}${oracleWallet === deployer.address ? c.dim(' (= deployer)') : ''}`);
  if (DRY_RUN) console.log(`  ${c.yellow('Mode: DRY RUN — no transactions will be sent')}`);
  console.log('');

  const state   = loadState(networkName);
  const results: Record<string, StepResult> = {};
  const wired:  Record<string, boolean>     = { ...(state.wiringSteps ?? {}) };

  console.log('');

  // ── 1. FloatingAPYCalculator ← MTAAToken ────────────────────────────────
  // Deployed with ZeroAddress in deploy.ts; Step 5 of deploy.ts already calls
  // setMtaaToken but may have been skipped or re-deploy needed.

  if (state.FloatingAPYCalculator && state.MTAAToken) {
    await runStep(
      'FloatingAPYCalculator ← MTAAToken',
      'floatingAPY.setMtaaToken',
      results, wired,
      async () => {
        const apy     = await ethers.getContractAt('FloatingAPYCalculator', state.FloatingAPYCalculator!);
        const current = await tryRead(() => apy.mtaaToken());
        if (current.toLowerCase() === state.MTAAToken!.toLowerCase()) {
          return { status: 'skipped', detail: 'already set' };
        }
        await exec(
          `floatingAPY.setMtaaToken(${state.MTAAToken})`,
          () => apy.setMtaaToken(state.MTAAToken!)
        );
        return { status: 'done', detail: state.MTAAToken! };
      }
    );
  }

  // ── 2. ReputationEngine ← MTAAToken ─────────────────────────────────────
  // NOTE: deploy.ts deploys ReputationEngine with ZeroAddress and NEVER wires
  // in the real MTAA address. This step fills that gap.

  if (state.ReputationEngine && state.MTAAToken) {
    await runStep(
      'ReputationEngine ← MTAAToken',
      'reputationEngine.setMtaaToken',
      results, wired,
      async () => {
        const rep     = await ethers.getContractAt('ReputationEngine', state.ReputationEngine!);
        const current = await tryRead(() => rep.mtaaToken());
        if (current.toLowerCase() === state.MTAAToken!.toLowerCase()) {
          return { status: 'skipped', detail: 'already set' };
        }
        await exec(
          `reputationEngine.setMtaaToken(${state.MTAAToken})`,
          () => rep.setMtaaToken(state.MTAAToken!)
        );
        return { status: 'done', detail: state.MTAAToken! };
      }
    );
  }

  // ── 3. MultiSigTreasury ← MTAAToken ─────────────────────────────────────
  // Also deployed with ZeroAddress in deploy.ts, never explicitly updated.

  if (state.MultiSigTreasury && state.MTAAToken) {
    await runStep(
      'MultiSigTreasury ← MTAAToken',
      'multiSigTreasury.setMtaaToken',
      results, wired,
      async () => {
        const treasury = await ethers.getContractAt('MultiSigTreasury', state.MultiSigTreasury!);
        const current  = await tryRead(() => treasury.mtaaToken());
        if (current.toLowerCase() === state.MTAAToken!.toLowerCase()) {
          return { status: 'skipped', detail: 'already set' };
        }
        await exec(
          `multiSigTreasury.setMtaaToken(${state.MTAAToken})`,
          () => treasury.setMtaaToken(state.MTAAToken!)
        );
        return { status: 'done', detail: state.MTAAToken! };
      }
    );
  }

  // ── 4. MTAAToken ← Chainlink price feed (mainnet only) ──────────────────

  const feed = state.chainlinkFeed;
  if (state.MTAAToken && feed && feed !== ethers.ZeroAddress && isMainnet) {
    await runStep(
      'MTAAToken ← Chainlink price feed',
      'mtaaToken.setPriceFeed',
      results, wired,
      async () => {
        const mtaa    = await ethers.getContractAt('MTAAToken', state.MTAAToken!);
        const current = await tryRead(() => mtaa.priceFeed());
        if (current.toLowerCase() === feed.toLowerCase()) {
          return { status: 'skipped', detail: 'already set' };
        }
        await exec(
          `mtaaToken.setPriceFeed(${feed})`,
          () => mtaa.setPriceFeed(feed)
        );
        return { status: 'done', detail: feed };
      }
    );
  } else {
    logStep('MTAAToken ← Chainlink price feed', {
      status: 'skipped',
      detail: isMainnet ? 'no CHAINLINK_MTAA_USD_FEED configured' : 'testnet — no feed needed',
    });
  }

  // ── 5. ChamaTreasuryFactory ← FloatingAPYCalculator ─────────────────────

  if (state.ChamaTreasuryFactory && state.FloatingAPYCalculator) {
    await runStep(
      'ChamaTreasuryFactory ← APY calculator',
      'chamaTreasuryFactory.setApyCalculator',
      results, wired,
      async () => {
        const factory = await ethers.getContractAt('ChamaTreasuryFactory', state.ChamaTreasuryFactory!);
        const current = await tryRead(() => factory.apyCalculator());
        if (current.toLowerCase() === state.FloatingAPYCalculator!.toLowerCase()) {
          return { status: 'skipped', detail: 'already set' };
        }
        await exec(
          `chamaTreasuryFactory.setApyCalculator(${state.FloatingAPYCalculator})`,
          () => factory.setApyCalculator(state.FloatingAPYCalculator!)
        );
        return { status: 'done', detail: state.FloatingAPYCalculator! };
      }
    );
  }

  // ── 6. MTAAToken — grant ORACLE_ROLE ─────────────────────────────────────

  if (state.MTAAToken) {
    await runStep(
      'MTAAToken — grant ORACLE_ROLE',
      'mtaaToken.grantOracleRole',
      results, wired,
      async () => {
        const mtaa       = await ethers.getContractAt('MTAAToken', state.MTAAToken!);
        const ORACLE_ROLE = await mtaa.ORACLE_ROLE();
        const hasRole    = await tryReadBool(() => mtaa.hasRole(ORACLE_ROLE, oracleWallet));
        if (hasRole) {
          return { status: 'skipped', detail: `${oracleWallet} already has ORACLE_ROLE` };
        }
        await exec(
          `mtaaToken.grantRole(ORACLE_ROLE, ${oracleWallet})`,
          () => mtaa.grantRole(ORACLE_ROLE, oracleWallet)
        );
        return { status: 'done', detail: oracleWallet };
      }
    );

    // On mainnet with a dedicated oracle: revoke from deployer
    if (isMainnet && oracleWallet !== deployer.address) {
      await runStep(
        'MTAAToken — revoke ORACLE_ROLE from deployer',
        'mtaaToken.revokeOracleFromDeployer',
        results, wired,
        async () => {
          const mtaa        = await ethers.getContractAt('MTAAToken', state.MTAAToken!);
          const ORACLE_ROLE = await mtaa.ORACLE_ROLE();
          const stillHas    = await tryReadBool(() => mtaa.hasRole(ORACLE_ROLE, deployer.address));
          if (!stillHas) {
            return { status: 'skipped', detail: 'deployer already lacks ORACLE_ROLE' };
          }
          await exec(
            `mtaaToken.revokeRole(ORACLE_ROLE, ${deployer.address})`,
            () => mtaa.revokeRole(ORACLE_ROLE, deployer.address)
          );
          return { status: 'done', detail: `revoked from ${deployer.address}` };
        }
      );
    }
  }

  // ── 7. MTAAToken — grant DISTRIBUTOR_ROLE to initializer ─────────────────

  if (state.MTAAToken && state.TokenDistributionInitializer) {
    await runStep(
      'MTAAToken — grant DISTRIBUTOR_ROLE',
      'mtaaToken.grantDistributorRole',
      results, wired,
      async () => {
        const mtaa             = await ethers.getContractAt('MTAAToken', state.MTAAToken!);
        const DISTRIBUTOR_ROLE = await mtaa.DISTRIBUTOR_ROLE();
        const hasRole          = await tryReadBool(
          () => mtaa.hasRole(DISTRIBUTOR_ROLE, state.TokenDistributionInitializer!)
        );
        if (hasRole) {
          return { status: 'skipped', detail: 'initializer already has DISTRIBUTOR_ROLE' };
        }
        await exec(
          `mtaaToken.grantRole(DISTRIBUTOR_ROLE, ${state.TokenDistributionInitializer})`,
          () => mtaa.grantRole(DISTRIBUTOR_ROLE, state.TokenDistributionInitializer!)
        );
        return { status: 'done', detail: state.TokenDistributionInitializer! };
      }
    );
  }

  // ── 8. ReputationEngine — authorize oracle as recorder ───────────────────

  if (state.ReputationEngine) {
    await runStep(
      'ReputationEngine — authorize oracle recorder',
      'reputationEngine.authorizeRecorder',
      results, wired,
      async () => {
        const rep          = await ethers.getContractAt('ReputationEngine', state.ReputationEngine!);
        const isAuthorized = await tryReadBool(() => rep.authorizedRecorders(oracleWallet));
        if (isAuthorized) {
          return { status: 'skipped', detail: `${oracleWallet} already authorized` };
        }
        await exec(
          `reputationEngine.setAuthorizedRecorder(${oracleWallet}, true)`,
          () => rep.setAuthorizedRecorder(oracleWallet, true)
        );
        return { status: 'done', detail: oracleWallet };
      }
    );
  }

  // ── 9. Per-ChamaTreasury instance (optional) ─────────────────────────────

  if (chamaAddr && ethers.isAddress(chamaAddr)) {
    console.log(`\n  ${c.cyan('Per-ChamaTreasury')} [${chamaAddr}]`);

    // 9a. Whitelist RotationModule as approved proposer
    if (state.RotationModule) {
      await runStep(
        '  ChamaTreasury ← RotationModule',
        'chamaTreasury.whitelistRotationModule',
        results, wired,
        async () => {
          const chama      = await ethers.getContractAt('ChamaTreasury', chamaAddr);
          const isApproved = await tryReadBool(
            () => chama.approvedProposers(state.RotationModule!)
          );
          if (isApproved) {
            return { status: 'skipped', detail: 'RotationModule already approved' };
          }
          await exec(
            `chama.setApprovedProposer(${state.RotationModule}, true)`,
            () => chama.setApprovedProposer(state.RotationModule!, true)
          );
          return { status: 'done', detail: state.RotationModule! };
        }
      );
    }

    // 9b. Set APY calculator on this chama instance
    if (state.FloatingAPYCalculator) {
      await runStep(
        '  ChamaTreasury ← APY calculator',
        'chamaTreasury.setApyCalculator',
        results, wired,
        async () => {
          const chama   = await ethers.getContractAt('ChamaTreasury', chamaAddr);
          const current = await tryRead(() => chama.apyCalculator());
          if (current.toLowerCase() === state.FloatingAPYCalculator!.toLowerCase()) {
            return { status: 'skipped', detail: 'already set' };
          }
          await exec(
            `chama.setApyCalculator(${state.FloatingAPYCalculator})`,
            () => chama.setApyCalculator(state.FloatingAPYCalculator!)
          );
          return { status: 'done', detail: state.FloatingAPYCalculator! };
        }
      );
    }
  }

  // ── 10. Token distribution (opt-in) ──────────────────────────────────────

  if (process.env.AUTO_EXECUTE_DISTRIBUTION === 'true' && state.TokenDistributionInitializer) {
    console.log('');
    const recipients = {
      treas:      process.env.DISTRIBUTION_TREASURY_DAO,
      partner:    process.env.DISTRIBUTION_PARTNER_FUND,
      team:       process.env.DISTRIBUTION_TEAM_MULTISIG,
      airdrop:    process.env.DISTRIBUTION_AIRDROP_FUND,
      liquidity:  process.env.DISTRIBUTION_LIQUIDITY_FUND,
      publicSale: process.env.DISTRIBUTION_PUBLIC_SALE_FUND,
      daoReserve: process.env.DISTRIBUTION_DAO_RESERVE_FUND,
    };
    const allValid = Object.values(recipients).every(a => a && ethers.isAddress(a));

    await runStep(
      'TokenDistributionInitializer.executeDistribution',
      'distributor.executeDistribution',
      results, wired,
      async () => {
        if (!allValid) {
          const missing = Object.entries(recipients)
            .filter(([, v]) => !v || !ethers.isAddress(v!))
            .map(([k]) => `DISTRIBUTION_${k.toUpperCase()}`);
          return { status: 'skipped', detail: `missing env vars: ${missing.join(', ')}` };
        }
        const dist = await ethers.getContractAt(
          'TokenDistributionInitializer',
          state.TokenDistributionInitializer!
        );
        const alreadyExecuted = await tryReadBool(() => dist.executed());
        if (alreadyExecuted) {
          return { status: 'skipped', detail: 'distribution already executed (dist.executed() == true)' };
        }
        await exec('distributor.executeDistribution(...)', () =>
          dist.executeDistribution(
            recipients.treas!, recipients.partner!, recipients.team!,
            recipients.airdrop!, recipients.liquidity!, recipients.publicSale!, recipients.daoReserve!
          )
        );
        return { status: 'done', detail: '7 recipients funded' };
      }
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const counts = {
    done:    Object.values(results).filter(r => r.status === 'done').length,
    skipped: Object.values(results).filter(r => r.status === 'skipped').length,
    failed:  Object.values(results).filter(r => r.status === 'failed').length,
  };

  console.log(`\n${c.cyan('══ Summary ═════════════════════════════════════════════')}`);
  console.log(
    `  ${c.green(`${counts.done} executed`)}` +
    `   ${c.dim(`${counts.skipped} skipped`)}` +
    `   ${counts.failed > 0 ? c.red(`${counts.failed} failed`) : '0 failed'}`
  );

  if (counts.failed > 0) {
    console.log(`\n  ${c.red('Failed steps — investigate before mainnet:')}`);
    Object.entries(results)
      .filter(([, r]) => r.status === 'failed')
      .forEach(([name, r]) => console.log(`    ${c.red('✗')} ${name}: ${r.detail}`));
    console.log('');
  }

  if (counts.done > 0 && !DRY_RUN) {
    saveState(networkName, { ...state, wiringSteps: wired });
    console.log(c.dim(`  wiredAt timestamp saved to deployments/${networkName}.json`));
  }

  if (DRY_RUN) {
    console.log(c.yellow('\n  DRY RUN complete — re-run without DRY_RUN=true to execute.'));
  }

  console.log('');
  if (counts.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(c.red('\nWire script failed:'), err);
  process.exit(1);
});