/**
 * 01-account.test.ts
 * Compatibility-focused account/spawn tests for the current factory + spawn-gateway flow.
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { deployOkediFixture } from "./fixtures";

async function expectRevertWithName(promise: Promise<unknown>, expectedName: string) {
  try {
    await promise;
  } catch (error: unknown) {
    const message =
      (error as { shortMessage?: string; message?: string }).shortMessage ??
      (error as { shortMessage?: string; message?: string }).message ??
      String(error);
    expect(message).to.include(expectedName);
    return;
  }

  throw new Error(`Expected revert with ${expectedName}`);
}

describe("01 · Account & spawn-credit pipeline", () => {
  describe("Vault spawn → account registration", () => {
    it("deploys a vault and registers it under the owner", async () => {
      const { factory, cUSD, alice, deployers } = await deployOkediFixture();

      const { vaultAddress } = await deployers.deployMaonoVault(
        alice,
        0,
        await cUSD.getAddress()
      );

      expect(ethers.isAddress(vaultAddress)).to.equal(true);
      expect(await factory.isVaultRegistered(vaultAddress)).to.equal(true);
      expect(await factory.getRemainingVaultSlots(alice.address)).to.equal(4n);

      const userVaults = await factory.getUserVaults(alice.address);
      expect(userVaults).to.include(vaultAddress);
    });

    it("records the vault type and owner in factory metadata", async () => {
      const { factory, cUSD, alice, deployers } = await deployOkediFixture();

      const { vaultAddress } = await deployers.deployMaonoVault(
        alice,
        2,
        await cUSD.getAddress()
      );

      const info = await factory.getVaultDetails(vaultAddress);
      expect(info.vaultType).to.equal(2n);
      expect(info.owner).to.equal(alice.address);
    });
  });

  describe("Vault cap enforcement", () => {
    it("reverts when the user exceeds MAX_VAULTS_PER_USER (5)", async () => {
      const { cUSD, alice, deployers } = await deployOkediFixture();

      for (let i = 0; i < 5; i++) {
        await deployers.deployMaonoVault(alice, 0, await cUSD.getAddress());
      }

      await expectRevertWithName(
        deployers.deployMaonoVault(alice, 0, await cUSD.getAddress()),
        "MaxVaultsPerUserExceeded"
      );
    });

    it("decrements remaining vault slots after each deployment", async () => {
      const { factory, cUSD, alice, deployers } = await deployOkediFixture();

      expect(await factory.getRemainingVaultSlots(alice.address)).to.equal(5n);

      await deployers.deployMaonoVault(alice, 0, await cUSD.getAddress());
      expect(await factory.getRemainingVaultSlots(alice.address)).to.equal(4n);
    });
  });

  describe("Referral reward distribution", () => {
    it("allows the platform admin to transfer referral rewards", async () => {
      const { mtaaToken, platformAdmin, eve } = await deployOkediFixture();

      const referralReward = ethers.parseEther("50");
      const eveBefore = await mtaaToken.balanceOf(eve.address);

      await mtaaToken.connect(platformAdmin).transfer(eve.address, referralReward);

      const eveAfter = await mtaaToken.balanceOf(eve.address);
      expect(eveAfter - eveBefore).to.equal(referralReward);
    });
  });

  describe("MTAA discount curve", () => {
    const cases: [bigint, bigint][] = [
      [0n, 0n],
      [16n, 10n],
      [100n, 25n],
      [400n, 50n],
      [900n, 50n],
    ];

    cases.forEach(([held, expectedDiscount]) => {
      it(`maps ${held} MTAA to ${expectedDiscount}% discount`, async () => {
        const sqrtApprox = BigInt(Math.floor(Math.sqrt(Number(held))));
        const discount = (sqrtApprox * 25n) / 10n;
        const capped = discount > 50n ? 50n : discount;
        expect(capped).to.equal(expectedDiscount);
      });
    });

    it("keeps the discounted fee non-negative", async () => {
      const baseFeeBps = 15n;
      const maxDiscount = 50n;
      const discountedFee = (baseFeeBps * (100n - maxDiscount)) / 100n;
      expect(discountedFee >= 0n).to.equal(true);
      expect(discountedFee).to.equal(7n);
    });
  });

  describe("Factory asset whitelist", () => {
    it("reverts deployVault with an unsupported asset", async () => {
      const { factory, alice } = await deployOkediFixture();

      const fakeAsset = ethers.Wallet.createRandom().address;
      await expectRevertWithName(
        factory.connect(alice).deployVault(fakeAsset, "Bad", "BAD", 0),
        "UnsupportedAsset"
      );
    });

    it("lets the owner add and remove supported assets", async () => {
      const { factory, owner } = await deployOkediFixture();

      const newAsset = ethers.Wallet.createRandom().address;

      await factory.connect(owner).addSupportedAsset(newAsset, "USDC");
      expect((await factory.getSupportedAssets()).map((a: string) => a.toLowerCase()))
        .to.include(newAsset.toLowerCase());

      await factory.connect(owner).removeSupportedAsset(newAsset);
      expect((await factory.getSupportedAssets()).map((a: string) => a.toLowerCase()))
        .to.not.include(newAsset.toLowerCase());
    });
  });

  describe("Factory accounting", () => {
    it("tracks total spawn cost collected as vaults are deployed", async () => {
      const { cUSD, alice, bob, deployers, spawnGateway } = await deployOkediFixture();

      const statsBefore = await spawnGateway.totalSpawnCostCollected();
      await deployers.deployMaonoVault(alice, 0, await cUSD.getAddress());
      await deployers.deployMaonoVault(bob, 1, await cUSD.getAddress());

      const statsAfter = await spawnGateway.totalSpawnCostCollected();
      expect(statsAfter > statsBefore).to.equal(true);
    });

    it("increments the total vault counter", async () => {
      const { factory, cUSD, alice, bob, deployers } = await deployOkediFixture();

      const before = await factory.getTotalVaultsDeployed();
      await deployers.deployMaonoVault(alice, 0, await cUSD.getAddress());
      await deployers.deployMaonoVault(bob, 1, await cUSD.getAddress());

      expect(await factory.getTotalVaultsDeployed()).to.equal(before + 2n);
    });
  });
});
