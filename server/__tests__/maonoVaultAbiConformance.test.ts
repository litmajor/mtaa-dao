import { describe, it, expect, beforeAll, vi } from 'vitest';
import path from 'path';
import { ethers } from 'ethers';

/**
 * P2-7: the backend talks to the canonical MaonoVault_Phase1B ABI only.
 *
 * These are static checks against the committed artifact so a drift between
 * contracts/MaonoVault.sol and the server integration fails here rather than as
 * a reverting transaction in production.
 */
const repoRoot = path.resolve(__dirname, '../..');

let artifact: { contractName: string; abi: ethers.InterfaceAbi; bytecode: string };
let iface: ethers.Interface;
let readSource: (relativePath: string) => string;

beforeAll(async () => {
  // The shared test setup mocks fs.readFileSync, so read through the real module.
  const fs = await vi.importActual<typeof import('fs')>('fs');
  readSource = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  artifact = JSON.parse(readSource('contracts/MaonoVault.json'));
  iface = new ethers.Interface(artifact.abi);
});

function hasFunction(name: string): boolean {
  return iface.fragments.some((f) => f.type === 'function' && (f as ethers.FunctionFragment).name === name);
}

describe('MaonoVault artifact conformance', () => {
  it('is the canonical Phase 1B implementation', () => {
    expect(artifact.contractName).toBe('MaonoVault_Phase1B');
    expect(artifact.bytecode.startsWith('0x')).toBe(true);
    expect(artifact.bytecode.length).toBeGreaterThan(2);
  });

  it('exposes no NAV or performance-fee surface', () => {
    for (const obsolete of ['previewNAV', 'updateNAV', 'distributePerformanceFee', 'setNAV']) {
      expect(hasFunction(obsolete), `${obsolete} must not exist on the canonical vault`).toBe(false);
    }
  });

  it('exposes the ERC-4626 and lifecycle surface the backend calls', () => {
    for (const required of [
      'asset',
      'totalAssets',
      'totalSupply',
      'convertToAssets',
      'deposit',
      'withdraw',
      'redeem',
      'mint',
      'getVaultMetrics',
      'getVaultStatus',
      'getMonthlyUpkeepCost',
      'collectMonthlyUpkeep',
      'reactivateFromHibernation',
      'initialize',
    ]) {
      expect(hasFunction(required), `${required} is missing from the artifact`).toBe(true);
    }
  });

  it('takes no constructor arguments, because vaults are initialized clones', () => {
    expect(iface.deploy.inputs).toHaveLength(0);
  });

  it('keeps the platform setters distinct from owner operations', () => {
    for (const platformSetter of [
      'setUpkeepCostAt',
      'setBurnPercentageAt',
      'setDaoTreasury',
      'setPriceOracle',
      'setOracleBounds',
      'setOracleCircuitEnabled',
    ]) {
      expect(hasFunction(platformSetter), `${platformSetter} is missing from the artifact`).toBe(true);
    }
    expect(hasFunction('platformAdmin')).toBe(true);
  });
});

describe('backend integration surface', () => {
  it('no server code calls the removed NAV or performance-fee methods', () => {
    for (const file of ['server/blockchain.ts', 'server/vaultAutomation.ts']) {
      const source = readSource(file);
      for (const obsolete of ['previewNAV', 'updateNAV(', 'distributePerformanceFee']) {
        expect(source.includes(obsolete), `${file} still references ${obsolete}`).toBe(false);
      }
    }
  });

  it('deployment scripts use the factory/clone architecture', () => {
    const deployScript = readSource('scripts/deploy.mjs');
    expect(deployScript).toContain('MaonoVault_Phase1B');
    expect(deployScript).toContain('MaonoVaultFactory_Phase1B');
    // The vault must never be constructed with legacy (asset, treasury, manager) args.
    expect(deployScript).not.toContain('getContractFactory("MaonoVault")');
  });
});
