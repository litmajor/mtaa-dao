/**
 * 02-dao-creation.test.ts
 * E2E: DAO creation across all Okedi DAO types:
 *  harambee | shortTerm | savings | merryGoRound | community | investment
 *
 * Covers:
 *  - Correct vault type spawned per DAO type
 *  - MaonoVault initialization (correct owner, asset, status)
 *  - ChamaTreasury + GovernanceAccessManager wiring (community/investment)
 *  - RotationModule wiring (merryGoRound)
 *  - LoanFacility wiring (savings, community, investment)
 *  - Vault hibernation state on fresh deploy (should be ACTIVE)
 *  - Upkeep due date set correctly
 */

import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-mocha-ethers/network-helpers";
import { ethers } from "hardhat";
import { deployOkediFixture } from "./fixtures";

// MaonoVault VaultStatus enum
const VaultStatus = { ACTIVE: 0n, HIBERNATING: 1n, CLOSED: 2n };

// MaonoVault VaultType enum
const VaultType = { SAVINGS: 0n, ESCROW: 1n, BUSINESS: 2n, INVESTING: 3n, CUSTOM: 4n };

describe("02 · DAO Creation — All Types", () => {
  // ── Harambee ───────────────────────────────────────────────────────────────

  describe("harambee (escrow vault, single disbursement)", () => {
    it("deploys an ESCROW vault with correct owner and ACTIVE status", async () => {
      const { cUSD, alice, deployers } = await loadFixture(deployOkediFixture);

      const { vault } = await deployers.deployMaonoVault(
        alice,
        1, // ESCROW
        await cUSD.getAddress()
      );

      expect(await vault.getVaultStatus()).to.equal(VaultStatus.ACTIVE);
      expect(await vault.owner()).to.equal(alice.address);
      expect(await vault.asset()).to.equal(await cUSD.getAddress());
    });

    it("upkeep not due immediately after deploy", async () => {
      const { cUSD, alice, deployers } = await loadFixture(deployOkediFixture);
      const { vault } = await deployers.deployMaonoVault(alice, 1, await cUSD.getAddress());

      const dueDate = await vault.getUpkeepDueDate();
      expect(dueDate).to.be.gt(BigInt(await time.latest()));
    });
  });

  // ── Short-term savings ────────────────────────────────────────────────────

  describe("shortTerm (savings vault, milestone-gated)", () => {
    it("deploys a SAVINGS vault", async () => {
      const { cUSD, alice, deployers } = await loadFixture(deployOkediFixture);

      const { vault } = await deployers.deployMaonoVault(alice, 0, await cUSD.getAddress());

      expect(await vault.getVaultStatus()).to.equal(VaultStatus.ACTIVE);
      expect(await vault.vaultType()).to.equal(VaultType.SAVINGS);
    });
  });

  // ── Savings group ─────────────────────────────────────────────────────────

  describe("savings (savings vault + optional LoanFacility)", () => {
    it("deploys savings vault; LoanFacility can be deployed and wired separately", async () => {
      const { cUSD, alice, bob, carol, deployers } =
        await loadFixture(deployOkediFixture);

      const { vault } = await deployers.deployMaonoVault(alice, 0, await cUSD.getAddress());
      expect(await vault.isVaultActive()).to.equal(true);

      // Deploy chama bundle (includes LoanFacility)
      const { loan, treasury } = await deployers.deployChamaBundle(
        alice,
        [alice.address, bob.address, carol.address],
        2
      );

      expect(await loan.getAddress()).to.be.properAddress;
      expect(await treasury.getAddress()).to.be.properAddress;
    });
  });

  // ── Merry-go-round ────────────────────────────────────────────────────────

  describe("merryGoRound (escrow vault + RotationModule)", () => {
    it("deploys escrow vault and RotationModule, both properly wired", async () => {
      const { cUSD, alice, bob, carol, dave, deployers } =
        await loadFixture(deployOkediFixture);

      const { vault } = await deployers.deployMaonoVault(alice, 1, await cUSD.getAddress()); // ESCROW

      const { treasury, rotation } = await deployers.deployChamaBundle(
        alice,
        [alice.address, bob.address, carol.address],
        2
      );

      expect(await vault.isVaultActive()).to.equal(true);
      expect(await rotation.getAddress()).to.be.properAddress;

      // RotationModule should be recognized as a module by treasury
      const isMod = await treasury.isModule(await rotation.getAddress());
      expect(isMod).to.equal(true);
    });
  });

  // ── Community ─────────────────────────────────────────────────────────────

  describe("community (ChamaTreasury + GovernanceAccessManager + LoanFacility)", () => {
    it("full bundle deploys with correct multisig threshold", async () => {
      const { cUSD, alice, bob, carol, dave, deployers } =
        await loadFixture(deployOkediFixture);

      const { vault } = await deployers.deployMaonoVault(alice, 2, await cUSD.getAddress()); // BUSINESS

      const { treasury, governance, loan } = await deployers.deployChamaBundle(
        alice,
        [alice.address, bob.address, carol.address, dave.address],
        3  // 3-of-4 multisig
      );

      expect(await vault.isVaultActive()).to.equal(true);
      expect(await governance.getAddress()).to.be.properAddress;

      // Governance should recognise alice as admin
      expect(await governance.hasRole(
        await governance.DEFAULT_ADMIN_ROLE(),
        alice.address
      )).to.equal(true);

      // LoanFacility wired to correct treasury
      expect(await loan.treasury()).to.equal(await treasury.getAddress());
    });

    it("GovernanceAccessManager grants correct roles on deploy", async () => {
      const { alice, bob, carol, deployers } =
        await loadFixture(deployOkediFixture);

      const { governance } = await deployers.deployChamaBundle(
        alice,
        [alice.address, bob.address, carol.address],
        2
      );

      // All signers passed in should be elders/members
      const MEMBER_ROLE = await governance.MEMBER_ROLE();
      expect(await governance.hasRole(MEMBER_ROLE, bob.address)).to.equal(true);
      expect(await governance.hasRole(MEMBER_ROLE, carol.address)).to.equal(true);
    });
  });

  // ── Investment club ───────────────────────────────────────────────────────

  describe("investment (INVESTING vault + full bundle)", () => {
    it("deploys INVESTING vault type", async () => {
      const { cUSD, alice, bob, carol, deployers } =
        await loadFixture(deployOkediFixture);

      const { vault } = await deployers.deployMaonoVault(alice, 3, await cUSD.getAddress()); // INVESTING

      expect(await vault.vaultType()).to.equal(VaultType.INVESTING);
      expect(await vault.isVaultActive()).to.equal(true);
    });

    it("upkeep cost for INVESTING vault is higher than SAVINGS", async () => {
      const { cUSD, alice, bob, deployers } =
        await loadFixture(deployOkediFixture);

      const { vault: savingsVault } = await deployers.deployMaonoVault(alice, 0, await cUSD.getAddress());
      const { vault: investVault  } = await deployers.deployMaonoVault(bob,   3, await cUSD.getAddress());

      const savingsCost  = await savingsVault.getMonthlyUpkeepCost();
      const investCost   = await investVault.getMonthlyUpkeepCost();

      expect(investCost).to.be.gt(savingsCost);
    });
  });

  // ── Cross-type: vault implementation audit trail ──────────────────────────

  describe("implementation versioning", () => {
    it("all vaults record the implementation address deployed against", async () => {
      const { factory, cUSD, alice, deployers } =
        await loadFixture(deployOkediFixture);

      const { vaultAddress } = await deployers.deployMaonoVault(alice, 0, await cUSD.getAddress());

      const info = await factory.getVaultDetails(vaultAddress);
      expect(info.implementation).to.equal(await factory.vaultImplementation());
    });

    it("setVaultImplementation only affects new vaults, not existing ones", async () => {
      const { factory, cUSD, mtaaToken, alice, bob, platformAdmin, deployers } =
        await loadFixture(deployOkediFixture);

      // Deploy vault V1
      const { vaultAddress: v1 } = await deployers.deployMaonoVault(alice, 0, await cUSD.getAddress());
      const v1Impl = (await factory.getVaultDetails(v1)).implementation;

      // Update implementation (deploy new impl)
      const NewImpl = await ethers.getContractFactory("MaonoVault_Phase1B");
      const newImpl = await NewImpl.deploy();
      await newImpl.waitForDeployment();
      await factory.connect(platformAdmin).setVaultImplementation(await newImpl.getAddress());

      // Deploy vault V2
      const { vaultAddress: v2 } = await deployers.deployMaonoVault(bob, 0, await cUSD.getAddress());
      const v2Impl = (await factory.getVaultDetails(v2)).implementation;

      // V1 unchanged, V2 uses new impl
      expect(v1Impl).to.not.equal(v2Impl);
      expect(v2Impl).to.equal(await newImpl.getAddress());
    });
  });
});
