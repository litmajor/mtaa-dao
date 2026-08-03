/**
 * fixtures.ts
 * Shared deployment fixture for all Okedi E2E tests.
 * Deploys the full Okedi contract bundle once per suite via loadFixture().
 */

import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// ── Constants ────────────────────────────────────────────────────────────────

export const DECIMALS = 18n;
export const ONE = 10n ** DECIMALS;

// KES amounts scaled to cUSD (1 cUSD = 1 USD ≈ 130 KES, but we model 1:1 for tests)
export const SPAWN_FEE_SAVINGS    = ethers.parseEther("1000");  // 1000 cUSD ~ 1000 KES
export const SPAWN_FEE_COMMUNITY  = ethers.parseEther("2000");
export const SPAWN_FEE_INVESTMENT = ethers.parseEther("3000");
export const SPAWN_REWARD_MTAA    = ethers.parseEther("100");   // 100 MTAA on spawn

export const INITIAL_TREASURY_FUND = ethers.parseEther("50000"); // seed treasury
export const MEMBER_DEPOSIT        = ethers.parseEther("5000");  // per member
export const LOAN_AMOUNT           = ethers.parseEther("3500");  // 70% of deposit
export const ROTATION_AMOUNT       = ethers.parseEther("10000"); // per rotation cycle

// Subscription tiers (KES expressed in cUSD for test)
export const SUB_TIER_COMMUNITY  = 1n; // 500 cUSD/month
export const SUB_TIER_INVESTMENT = 2n; // 1000 cUSD/month
export const SUB_PRICE_COMMUNITY  = ethers.parseEther("500");
export const SUB_PRICE_INVESTMENT = ethers.parseEther("1000");

// Oracle: 1 MTAA = 15 KES expressed as cUSD (scaled 1e8 Chainlink style)
export const MTAA_PRICE_USD_CENTS = 15n * 10n ** 8n; // $0.15 in 1e8 scaling? No: 15 KES
// We store oracle price as cUSD per MTAA in 1e18 for simplicity in tests
export const MOCK_MTAA_PRICE = ethers.parseEther("0.12"); // $0.12 USDC per MTAA

// Activity fee basis points
export const FEE_DEPOSIT_BPS     = 15n;   // 0.15%
export const FEE_WITHDRAWAL_BPS  = 20n;   // 0.20%
export const FEE_LOAN_BPS        = 40n;   // 0.40%
export const FEE_ROTATION_BPS    = 20n;   // 0.20%

// ── Fixture ──────────────────────────────────────────────────────────────────

export interface OkediFixture {
  // Tokens
  mtaaToken:  any;
  cUSD:       any;

  // Core contracts
  tokenDist:          any;
  factory:            any;
  spawnGateway:       any;
  subscriptionMgr:    any;
  mockOracle:         any;

  // Per-test DAO instances (deployed lazily in tests)
  // helpers return these
  deployers: {
    paySpawnFee: (
      user: SignerWithAddress,
      vaultType: number
    ) => Promise<void>;

    deployMaonoVault: (
      owner: SignerWithAddress,
      vaultType: number,
      assetAddress: string
    ) => Promise<{ vault: any; vaultAddress: string }>;

    deployChamaBundle: (
      admin: SignerWithAddress,
      signers: string[],
      requiredSigs: number
    ) => Promise<{
      treasury:   any;
      governance: any;
      loan:       any;
      rotation:   any;
    }>;
  };

  // Accounts
  owner:        SignerWithAddress;
  platformAdmin: SignerWithAddress;
  alice:        SignerWithAddress; // chama member 1
  bob:          SignerWithAddress; // chama member 2
  carol:        SignerWithAddress; // chama member 3
  dave:         SignerWithAddress; // chama member 4
  eve:          SignerWithAddress; // outside user / referrer
  attacker:     SignerWithAddress;
}

/**
 * deployOkediFixture
 * Full system deployment. Pass to loadFixture() for snapshot-based test isolation.
 */
export async function deployOkediFixture(): Promise<OkediFixture> {
  const [owner, platformAdmin, alice, bob, carol, dave, eve, attacker] =
    await ethers.getSigners();

  // ── 1. Tokens ──────────────────────────────────────────────────────────────
  const ERC20 = await ethers.getContractFactory("MockERC20");

  const mtaaToken = await ERC20.deploy("MTAA Token", "MTAA", 18);
  await mtaaToken.waitForDeployment();

  const cUSD = await ERC20.deploy("Celo Dollar", "cUSD", 18);
  await cUSD.waitForDeployment();

  // Mint generous supply to all participants
  const participants = [owner, platformAdmin, alice, bob, carol, dave, eve, attacker];
  for (const p of participants) {
    await mtaaToken.mint(p.address, ethers.parseEther("1000000"));
    await cUSD.mint(p.address,       ethers.parseEther("1000000"));
  }

  // ── 2. Mock Oracle ─────────────────────────────────────────────────────────
  // Minimal oracle returning MOCK_MTAA_PRICE for any token
  const MockOracle = await ethers.getContractFactory("MockPriceOracle");
  const mockOracle = await MockOracle.deploy(MOCK_MTAA_PRICE);
  await mockOracle.waitForDeployment();

  // ── 3. TokenDistributionInitializer ───────────────────────────────────────
  const TokenDist = await ethers.getContractFactory("TokenDistributionInitializer");
  const tokenDist = await TokenDist.deploy(
    await mtaaToken.getAddress(),
    owner.address // protocol treasury receives vested allocations
  );
  await tokenDist.waitForDeployment();

  // ── 4. MaonoVaultFactory ──────────────────────────────────────────────────
  // Deploy implementation first
  const VaultImpl = await ethers.getContractFactory("MaonoVault_Phase1B");
  const vaultImpl = await VaultImpl.deploy();
  await vaultImpl.waitForDeployment();

  const Factory = await ethers.getContractFactory("MaonoVaultFactory_Phase1B");
  const factory = await Factory.deploy(
    await vaultImpl.getAddress(),
    platformAdmin.address,        // platformTreasury
    await mtaaToken.getAddress(),
    await mockOracle.getAddress(),
    [await cUSD.getAddress()]     // initial supported assets
  );
  await factory.waitForDeployment();

  // Fund factory reward reserve with MTAA
  await mtaaToken
    .connect(owner)
    .transfer(await factory.getAddress(), ethers.parseEther("500000"));

  // ── 5. Spawn gateway ─────────────────────────────────────────────────────
  const SpawnGateway = await ethers.getContractFactory("DAOSpawnGateway");
  const spawnGateway = await SpawnGateway.deploy();
  await spawnGateway.waitForDeployment();
  await spawnGateway.initialize(await mtaaToken.getAddress(), platformAdmin.address);
  await spawnGateway.connect(owner).setApprovedFactory(await factory.getAddress(), true);
  await factory.connect(owner).setSpawnGateway(await spawnGateway.getAddress());

  // ── 6. DAOSubscriptionManager ──────────────────────────────────────────────
  const SubMgr = await ethers.getContractFactory("DAOSubscriptionManager");
  const subscriptionMgr = await SubMgr.deploy(
    await cUSD.getAddress(),
    await mockOracle.getAddress(),
    platformAdmin.address
  );
  await subscriptionMgr.waitForDeployment();

  // Set tier prices
  await subscriptionMgr
    .connect(platformAdmin)
    .setTierPrice(SUB_TIER_COMMUNITY, SUB_PRICE_COMMUNITY);
  await subscriptionMgr
    .connect(platformAdmin)
    .setTierPrice(SUB_TIER_INVESTMENT, SUB_PRICE_INVESTMENT);

  // ── 7. Helper: pay spawn fee and mint a credit in the gateway ───────────
  async function paySpawnFee(
    user: SignerWithAddress,
    vaultType: number
  ) {
    const config = await spawnGateway.getVaultConfig(vaultType);
    await mtaaToken.connect(user).approve(await spawnGateway.getAddress(), config.spawnCost);
    await spawnGateway.connect(user).paySpawnFee(vaultType);
  }

  // ── 8. Helper: deploy MaonoVault clone via factory ─────────────────────────
  async function deployMaonoVault(
    vaultOwner: SignerWithAddress,
    vaultType: number,       // 0=SAVINGS 1=ESCROW 2=BUSINESS 3=INVESTING 4=CUSTOM
    assetAddress: string
  ) {
    await paySpawnFee(vaultOwner, vaultType);

    const tx = await factory
      .connect(vaultOwner)
      .deployVault(
        assetAddress,
        `TestVault-${vaultType}`,
        `TV${vaultType}`,
        vaultType
      );
    const receipt = await tx.wait();

    // Extract vault address from VaultDeployed event
    const event = receipt!.logs
      .map((l: any) => {
        try { return factory.interface.parseLog(l); } catch { return null; }
      })
      .find((e: any) => e?.name === "VaultDeployed");

    const vaultAddress: string = event!.args.vault;
    const vault = await ethers.getContractAt("MaonoVault_Phase1B", vaultAddress);
    return { vault, vaultAddress };
  }

  // ── 9. Helper: deploy ChamaTreasury + Governance + Loan + Rotation ─────────
  async function deployChamaBundle(
    admin: SignerWithAddress,
    signerAddresses: string[],
    requiredSigs: number
  ) {
    // GovernanceAccessManager
    const GovAM = await ethers.getContractFactory("GovernanceAccessManager");
    const governance = await GovAM.connect(admin).deploy(
      admin.address,
      signerAddresses,
      requiredSigs
    );
    await governance.waitForDeployment();

    // ChamaTreasury
    const CT = await ethers.getContractFactory("ChamaTreasury");
    const treasury = await CT.connect(admin).deploy(
      await cUSD.getAddress(),
      await mtaaToken.getAddress(),
      signerAddresses,
      requiredSigs,
      await governance.getAddress(),
      platformAdmin.address  // protocol fee recipient
    );
    await treasury.waitForDeployment();

    // LoanFacility
    const LF = await ethers.getContractFactory("LoanFacility");
    const loan = await LF.connect(admin).deploy(
      await cUSD.getAddress(),
      await mtaaToken.getAddress(),
      await treasury.getAddress(),
      await governance.getAddress(),
      platformAdmin.address  // fee collector
    );
    await loan.waitForDeployment();

    // RotationModule
    const RM = await ethers.getContractFactory("RotationModule");
    const rotation = await RM.connect(admin).deploy(
      await cUSD.getAddress(),
      await treasury.getAddress(),
      await governance.getAddress()
    );
    await rotation.waitForDeployment();

    // Wire: grant LoanFacility and RotationModule roles in treasury
    await treasury
      .connect(admin)
      .grantModuleRole(await loan.getAddress());
    await treasury
      .connect(admin)
      .grantModuleRole(await rotation.getAddress());

    return { treasury, governance, loan, rotation };
  }

  return {
    mtaaToken,
    cUSD,
    tokenDist,
    factory,
    spawnGateway,
    subscriptionMgr,
    mockOracle,
    deployers: { paySpawnFee, deployMaonoVault, deployChamaBundle },
    owner,
    platformAdmin,
    alice,
    bob,
    carol,
    dave,
    eve,
    attacker,
  };
}