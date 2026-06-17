/**
 * chamaTreasuryDeployer.ts
 *
 * Server-side integration for ChamaTreasuryFactory.
 * Called from dao_deploy.ts after DAO record is created in DB.
 *
 * Flow:
 *   1. dao_deploy.ts creates DAO record in DB → gets daoId
 *   2. Calls deployChämaTreasury(params) → gets treasury address
 *   3. Stores treasury address back in DAO record
 *   4. Returns treasury address to client
 *
 * Environment variables required:
 *   FACTORY_CONTRACT_ADDRESS   — deployed ChamaTreasuryFactory address
 *   PLATFORM_PRIVATE_KEY       — server wallet that calls factory
 *   CELO_RPC_URL               — Celo mainnet or Alfajores testnet
 *   STABLECOIN_ADDRESS         — cUSD address on Celo
 */

import { ethers } from 'ethers';

// ── ABI (minimal — only what the server needs) ──────────────────────────────

const FACTORY_ABI = [
  // Deploy standard treasury
  `function deployTreasury(
    string calldata _chamaName,
    string calldata _daoId,
    address[] calldata _signers,
    string[] calldata _signerNames,
    uint256 _requiredSignatures,
    uint8 _daoType
  ) external returns (address treasury)`,

  // Deploy with custom timelocks
  `function deployTreasuryCustom(
    string calldata _chamaName,
    string calldata _daoId,
    address[] calldata _signers,
    string[] calldata _signerNames,
    uint256 _requiredSignatures,
    uint8 _daoType,
    uint256 _smallTransferLimit,
    uint256 _smallTransferDelay,
    uint256 _largeTransferDelay
  ) external returns (address treasury)`,

  // Views
  `function getTreasuryByDaoId(string calldata daoId) external view returns (address)`,
  `function getLoanFacilityByDaoId(string calldata daoId) external view returns (address)`,
  `function deployLoanFacility(
    string calldata _chamaName,
    string calldata _daoId,
    address _stablecoin,
    address _elderCouncil,
    uint256 _initialFunding
  ) external returns (address loanFacility)`,
  `event LoanFacilityDeployed(address indexed loanFacility, string indexed daoId, string chamaName, address indexed deployer, uint256 initialFunding, uint256 timestamp)`,
  `function hasTreasury(string calldata daoId) external view returns (bool)`,
  `function getDeploymentFee(uint8 daoType) external view returns (uint256 fee, bool active)`,

  // Events
  `event TreasuryDeployed(
    address indexed treasury,
    string indexed daoId,
    string chamaName,
    address indexed deployer,
    uint8 daoType,
    uint256 deploymentFee,
    uint256 timestamp
  )`,
] as const;

const ERC20_ABI = [
  `function approve(address spender, uint256 amount) external returns (bool)`,
  `function allowance(address owner, address spender) external view returns (uint256)`,
  `function balanceOf(address account) external view returns (uint256)`,
] as const;

// ── DAO Type mapping (matches Solidity enum + DAO_TYPE_CONFIG) ───────────────

export const DAO_TYPE_ENUM = {
  harambee:     0,
  shortTerm:    1,
  savings:      2,
  merryGoRound: 3,
  community:    4,
  investment:   5,
} as const;

export type DaoTypeKey = keyof typeof DAO_TYPE_ENUM;

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeployTreasuryParams {
  chamaName: string;
  daoId: string;
  signers: string[];           // wallet addresses of elders/trustees
  signerNames: string[];       // human-readable names (same order as signers)
  requiredSignatures: number;  // min 2
  daoType: DaoTypeKey;

  // Optional overrides (uses factory defaults if not provided)
  smallTransferLimit?: bigint; // default: 50 cUSD (50n * 10n**18n)
  smallTransferDelay?: number; // seconds, default: 3600 (1 hour)
  largeTransferDelay?: number; // seconds, default: 86400 (24 hours)
}

export interface DeployTreasuryResult {
  treasuryAddress: string;
  daoId: string;
  txHash: string;
  blockNumber: number;
  deploymentFee: bigint;
}

// ── Main deployer class ──────────────────────────────────────────────────────

export class ChamaTreasuryDeployer {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private factory: ethers.Contract;
  private stablecoin: ethers.Contract;

  constructor() {
    const rpcUrl = process.env.CELO_RPC_URL;
    const privateKey = process.env.PLATFORM_PRIVATE_KEY;
    const factoryAddress = process.env.FACTORY_CONTRACT_ADDRESS;
    const stablecoinAddress = process.env.STABLECOIN_ADDRESS;

    if (!rpcUrl || !privateKey || !factoryAddress || !stablecoinAddress) {
      throw new Error(
        'Missing env: CELO_RPC_URL, PLATFORM_PRIVATE_KEY, ' +
        'FACTORY_CONTRACT_ADDRESS, STABLECOIN_ADDRESS'
      );
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.factory = new ethers.Contract(factoryAddress, FACTORY_ABI, this.signer);
    this.stablecoin = new ethers.Contract(stablecoinAddress, ERC20_ABI, this.signer);
  }

  /**
   * Helper: Propose a withdrawal on a deployed ChamaTreasury.
   * Many caller sites expect the treasury to support a `strategyId` parameter
   * (newer contract ABI). This helper defaults that value to `0` when
   * not applicable.
   */
  async proposeWithdrawalOnTreasury(params: {
    treasuryAddress: string;
    token: string;
    amount: bigint;
    recipient: string;
    reason?: string;
    proposalType?: number;
    strategyId?: bigint;
  }): Promise<{ txHash: string; receiptBlock: number }>
  {
    const {
      treasuryAddress,
      token,
      amount,
      recipient,
      reason = 'Off-chain proposal',
      proposalType = 0,
      strategyId = 0n,
    } = params;

    const TREASURY_PROPOSAL_ABI = [
      `function proposeWithdrawal(address token, uint256 amount, address recipient, string calldata reason, uint8 proposalType, uint256 strategyId) external returns (uint256 proposalId)`,
      `function proposeWithdrawalByModule(address token, uint256 amount, address recipient, bytes calldata data, uint8 proposalType, uint256 strategyId) external returns (uint256 proposalId)`,
    ] as const;

    const treasury = new ethers.Contract(treasuryAddress, TREASURY_PROPOSAL_ABI, this.signer);

    // Prefer the explicit proposeWithdrawal ABI if available.
    try {
      const tx = await treasury.proposeWithdrawal(token, amount, recipient, reason, proposalType, strategyId);
      const receipt = await tx.wait();
      return { txHash: receipt.transactionHash, receiptBlock: receipt.blockNumber };
    } catch (err) {
      // Fallback: try the module variant with empty data
      const emptyData = '0x';
      const tx = await treasury.proposeWithdrawalByModule(token, amount, recipient, emptyData, proposalType, strategyId);
      const receipt = await tx.wait();
      return { txHash: receipt.transactionHash, receiptBlock: receipt.blockNumber };
    }
  }

  /**
   * Deploy a ChamaTreasury for a newly created DAO.
   * Called from dao_deploy.ts after DB record is created.
   */
  async deployTreasury(params: DeployTreasuryParams): Promise<DeployTreasuryResult> {
    const {
      chamaName,
      daoId,
      signers,
      signerNames,
      requiredSignatures,
      daoType,
      smallTransferLimit,
      smallTransferDelay,
      largeTransferDelay,
    } = params;

    // -- Validate params --
    if (signers.length < 2 || signers.length > 10) {
      throw new Error(`Invalid signer count: ${signers.length}. Must be 2-10.`);
    }
    if (signerNames.length !== signers.length) {
      throw new Error('signerNames length must match signers length');
    }
    if (requiredSignatures < 2 || requiredSignatures > signers.length) {
      throw new Error(`Invalid requiredSignatures: ${requiredSignatures}`);
    }
    if (!(daoType in DAO_TYPE_ENUM)) {
      throw new Error(`Unknown daoType: ${daoType}`);
    }

    const daoTypeEnum = DAO_TYPE_ENUM[daoType];

    // -- Check if already deployed (idempotency) --
    const existing = await this.factory.getTreasuryByDaoId(daoId);
    if (existing !== ethers.ZeroAddress) {
      console.warn(`Treasury already deployed for daoId ${daoId}: ${existing}`);
      return {
        treasuryAddress: existing,
        daoId,
        txHash: '',
        blockNumber: 0,
        deploymentFee: 0n,
      };
    }

    // -- Check and handle deployment fee --
    const [fee] = await this.factory.getDeploymentFee(daoTypeEnum) as [bigint, boolean];

    if (fee > 0n) {
      await this._ensureApproval(fee);
    }

    // -- Deploy --
    let tx: ethers.TransactionResponse;

    const useCustom = smallTransferLimit !== undefined ||
                      smallTransferDelay !== undefined ||
                      largeTransferDelay !== undefined;

    if (useCustom) {
      const limit  = smallTransferLimit ?? 50n * 10n ** 18n;
      const sDelay = BigInt(smallTransferDelay ?? 3600);
      const lDelay = BigInt(largeTransferDelay ?? 86400);

      tx = await this.factory.deployTreasuryCustom(
        chamaName,
        daoId,
        signers,
        signerNames,
        requiredSignatures,
        daoTypeEnum,
        limit,
        sDelay,
        lDelay,
      );
    } else {
      tx = await this.factory.deployTreasury(
        chamaName,
        daoId,
        signers,
        signerNames,
        requiredSignatures,
        daoTypeEnum,
      );
    }

    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction receipt not found');

    // -- Parse TreasuryDeployed event --
    const treasuryAddress = this._parseTreasuryAddress(receipt);
    if (!treasuryAddress) {
      throw new Error('TreasuryDeployed event not found in receipt');
    }

    console.log(`✓ ChamaTreasury deployed: ${treasuryAddress} for daoId: ${daoId}`);

    return {
      treasuryAddress,
      daoId,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      deploymentFee: fee,
    };
  }

  /**
   * Deploy a LoanFacility contract via the factory (if supported)
   */
  async deployLoanFacility(params: {
    chamaName: string;
    daoId: string;
    stablecoin: string;
    elderCouncil: string;
    initialFunding?: bigint;
  }): Promise<{ loanFacilityAddress: string; txHash: string; blockNumber: number }> {
    const { chamaName, daoId, stablecoin, elderCouncil, initialFunding } = params;

    // Check existing
    try {
      const existing = await this.factory.getLoanFacilityByDaoId(daoId);
      if (existing !== ethers.ZeroAddress) {
        console.log(`LoanFacility already exists for daoId ${daoId}: ${existing}`);
        return { loanFacilityAddress: existing, txHash: '', blockNumber: 0 };
      }
    } catch {
      // factory may not expose view; continue to attempt deploy
    }

    const initFunding = initialFunding ?? 0n;
    const tx = await this.factory.deployLoanFacility(chamaName, daoId, stablecoin, elderCouncil, initFunding);
    const receipt = await tx.wait();
    if (!receipt) throw new Error('LoanFacility deploy transaction failed');

    // Parse event
    const iface = new ethers.Interface(FACTORY_ABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'LoanFacilityDeployed') {
          return {
            loanFacilityAddress: parsed.args.loanFacility as string,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
          };
        }
      } catch {
        // ignore
      }
    }

    throw new Error('LoanFacilityDeployed event not found in receipt');
  }

  /**
   * Look up an existing treasury by daoId.
   * Use this to recover address if DB record was lost.
   */
  async getTreasuryAddress(daoId: string): Promise<string | null> {
    const address = await this.factory.getTreasuryByDaoId(daoId);
    return address === ethers.ZeroAddress ? null : address;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _ensureApproval(amount: bigint): Promise<void> {
    const factoryAddress = await this.factory.getAddress();
    const signerAddress = await this.signer.getAddress();

    const currentAllowance = await this.stablecoin.allowance(
      signerAddress,
      factoryAddress
    ) as bigint;

    if (currentAllowance < amount) {
      console.log(`Approving ${amount} stablecoin for factory...`);
      const approveTx = await this.stablecoin.approve(factoryAddress, amount);
      await approveTx.wait();
    }
  }

  private _parseTreasuryAddress(
    receipt: ethers.TransactionReceipt
  ): string | null {
    const iface = new ethers.Interface(FACTORY_ABI);

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'TreasuryDeployed') {
          return parsed.args.treasury as string;
        }
      } catch {
        // Not this ABI — skip
      }
    }
    return null;
  }
}

// ── Singleton for use across server ─────────────────────────────────────────

let _instance: ChamaTreasuryDeployer | null = null;

export function getChamaTreasuryDeployer(): ChamaTreasuryDeployer {
  if (!_instance) {
    _instance = new ChamaTreasuryDeployer();
  }
  return _instance;
}

// ── Integration snippet for dao_deploy.ts ────────────────────────────────────
//
// import { getChamaTreasuryDeployer } from './chamaTreasuryDeployer';
//
// export const daoDeployHandler = async (req, res) => {
//   const { daoData, founderWallet, invitedMembers, selectedElders } = req.body;
//
//   // 1. Create DAO in DB (existing logic)
//   const dao = await createDAO(daoData, founderWallet);
//
//   // 2. Build signer list: founder + selected elders
//   const signers = [founderWallet, ...selectedElders].slice(0, 10);
//   const signerNames = signers.map((s, i) => i === 0 ? 'Founder' : `Elder ${i}`);
//   const requiredSigs = Math.max(2, Math.ceil(signers.length * 0.6)); // 60% threshold
//
//   // 3. Deploy treasury
//   const deployer = getChamaTreasuryDeployer();
//   const { treasuryAddress } = await deployer.deployTreasury({
//     chamaName: daoData.name,
//     daoId: dao.id,
//     signers,
//     signerNames,
//     requiredSignatures: requiredSigs,
//     daoType: daoData.daoType,
//   });
//
//   // 4. Store treasury address in DAO record
//   await updateDAO(dao.id, { treasuryAddress });
//
//   // 5. Return to client
//   res.json({ daoAddress: dao.id, treasuryAddress });
// };
