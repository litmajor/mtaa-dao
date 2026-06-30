import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import {
  daos,
  daoMemberships,
  vaults,
  loanFacilities,
  users,
  wallets,
  multisigWallets,
  multisigSigners,
} from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { DAO_TYPE_CONFIG } from '../config/daoTypes';
import {
  evaluateMemberCreationRules,
  formatRuleRejectionMessage,
  logRuleEvaluation,
} from '../services/rules-integration';
import {
  getChamaTreasuryDeployer,
  DAO_TYPE_ENUM,
  type DaoTypeKey,
} from '../../contracts/chamaTreasuryDeployer';
import { ethers } from 'ethers';
import { createWalletIfValid } from '../utils/cryptoWallet';
import { registerEscrowReferral } from '../services/referral-integration';

const logger = new Logger('dao-deploy');

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Canonical DAO type IDs — must match DAO_TYPE_CONFIG keys and Solidity enum.
 * Old keys (collective, governance, short_term, free, meta, investment_club)
 * are normalized to these before any processing.
 */
type CanonicalDaoType =
  | 'harambee'
  | 'shortTerm'
  | 'savings'
  | 'merryGoRound'
  | 'community'
  | 'investment';

export interface DaoDeployRequest {
  daoData: {
    name: string;
    description?: string;
    /** Accept canonical or legacy type IDs — normalized internally */
    daoType: string;
    category?: string;
    causeTags?: string[];
    primaryCause?: string;
    treasuryType?: 'cusd' | 'dual' | 'custom';
    customTokenAddress?: string;
    durationDays?: number;
    rotationFrequency?: string;
  };
  founderWallet: string;
  invitedMembers: string[];
  /** Wallet addresses or UUIDs of elders/trustees */
  selectedElders: string[];
  multisig?: {
    enabled?: boolean;
    signers?: string[];
    requiredSignatures?: number;
    /** If set, skip on-chain deployment and use this address directly */
    contractAddress?: string;
  };
}

// ── DAO type normalization ────────────────────────────────────────────────────

/**
 * Map any legacy or variant type string to the canonical type ID.
 * Canonical IDs match DAO_TYPE_CONFIG keys and Solidity DAOType enum.
 */
const LEGACY_TYPE_MAP: Record<string, CanonicalDaoType> = {
  // Old keys
  short_term:       'shortTerm',
  shortterm:        'shortTerm',
  collective:       'savings',
  harambee_fund:    'harambee',
  free:             'savings',
  meta:             'community',
  governance:       'community',
  investment_club:  'investment',
  // Already canonical — included for safety
  harambee:         'harambee',
  shortTerm:        'shortTerm',
  savings:          'savings',
  merryGoRound:     'merryGoRound',
  community:        'community',
  investment:       'investment',
};

function normalizeType(raw: string): CanonicalDaoType {
  const key = raw.replace(/-/g, '_').replace(/\s/g, '_').toLowerCase();
  // Try exact match first
  if (LEGACY_TYPE_MAP[raw]) return LEGACY_TYPE_MAP[raw];
  // Try lowercase normalized
  const found = Object.entries(LEGACY_TYPE_MAP).find(
    ([k]) => k.toLowerCase() === key
  );
  if (found) return found[1];
  logger.warn(`Unknown daoType "${raw}" — defaulting to "savings"`);
  return 'savings';
}

// ── Treasury config (aligned to canonical types) ─────────────────────────────

interface TreasuryConfig {
  requiredSignatures: number;
  dailyLimit: string;
  monthlyBudget: string;
  withdrawalMode: 'direct' | 'multisig';
  supportedTokens: string[];
}

const TREASURY_CONFIG: Record<CanonicalDaoType, Record<string, TreasuryConfig>> = {
  harambee: {
    cusd: {
      requiredSignatures: 2,
      dailyLimit: '5000.00',
      monthlyBudget: '20000.00',
      withdrawalMode: 'direct',
      supportedTokens: ['cUSD'],
    },
  },
  shortTerm: {
    cusd: {
      requiredSignatures: 2,
      dailyLimit: '5000.00',
      monthlyBudget: '50000.00',
      withdrawalMode: 'direct',
      supportedTokens: ['cUSD'],
    },
  },
  savings: {
    cusd: {
      requiredSignatures: 2,
      dailyLimit: '10000.00',
      monthlyBudget: '100000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD'],
    },
    dual: {
      requiredSignatures: 2,
      dailyLimit: '15000.00',
      monthlyBudget: '150000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD', 'CELO'],
    },
  },
  merryGoRound: {
    cusd: {
      requiredSignatures: 2,
      dailyLimit: '10000.00',
      monthlyBudget: '100000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD'],
    },
  },
  community: {
    cusd: {
      requiredSignatures: 3,
      dailyLimit: '25000.00',
      monthlyBudget: '250000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD'],
    },
    dual: {
      requiredSignatures: 3,
      dailyLimit: '35000.00',
      monthlyBudget: '350000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD', 'CELO'],
    },
    custom: {
      requiredSignatures: 4,
      dailyLimit: '50000.00',
      monthlyBudget: '500000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD', 'CELO', 'USDT', 'DAI'],
    },
  },
  investment: {
    cusd: {
      requiredSignatures: 3,
      dailyLimit: '20000.00',
      monthlyBudget: '200000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD'],
    },
    dual: {
      requiredSignatures: 3,
      dailyLimit: '30000.00',
      monthlyBudget: '300000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD', 'CELO'],
    },
    custom: {
      requiredSignatures: 4,
      dailyLimit: '50000.00',
      monthlyBudget: '500000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD', 'CELO', 'USDT', 'DAI'],
    },
  },
};

// ── Validation helpers ────────────────────────────────────────────────────────

const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);

function resolveUserTier(
  userProfile: any
): 'free' | 'growth' | 'professional' | 'enterprise' {
  const raw = String(
    userProfile?.subscriptionPlan ||
    userProfile?.plan ||
    userProfile?.billingStatus ||
    'free'
  ).toLowerCase().replace(/[\s-]/g, '_');

  if (['enterprise', 'meta', 'metadao'].includes(raw)) return 'enterprise';
  if (['professional', 'pro', 'business'].includes(raw)) return 'professional';
  if (['growth', 'premium', 'starter_plus'].includes(raw)) return 'growth';
  return 'free';
}

const TIER_HIERARCHY = ['free', 'growth', 'professional', 'enterprise'];

// ── Main handler ──────────────────────────────────────────────────────────────

export async function daoDeployHandler(req: Request, res: Response) {
  const { daoData, founderWallet, invitedMembers, selectedElders } =
    req.body as DaoDeployRequest;

  try {
    logger.info(`Creating DAO: "${daoData.name}" for founder: ${founderWallet}`);

    // ── 1. Validate inputs ──────────────────────────────────────────────────

    if (!founderWallet || !isAddress(founderWallet)) {
      return res.status(400).json({ error: 'Invalid founder wallet address' });
    }

    // Normalize DAO type early — used in all subsequent logic
    const daoType = normalizeType(daoData.daoType);

    // Tier check
    const userProfile = await db.query.users.findFirst({
      where: eq(users.id, founderWallet),
    });
    const userTier = resolveUserTier(userProfile);
    const requiredTier =
      (DAO_TYPE_CONFIG[daoType]?.requiredTier as string) || 'free';

    if (
      TIER_HIERARCHY.indexOf(userTier) <
      TIER_HIERARCHY.indexOf(requiredTier)
    ) {
      return res.status(403).json({
        error: 'Insufficient subscription tier',
        message: `${daoType} requires ${requiredTier} tier or higher`,
        currentTier: userTier,
        requiredTier,
      });
    }

    // Elder validation
    if (!selectedElders || selectedElders.length < 1) {
      return res.status(400).json({
        error: 'At least 1 elder required (founder is added automatically)',
      });
    }

    for (const elder of selectedElders) {
      const validFormat =
        isAddress(elder) || /^[a-f0-9-]{36}$/.test(elder);
      if (!validFormat) {
        return res.status(400).json({ error: `Invalid elder format: ${elder}` });
      }
    }

    // Build final signer list: founder always first, deduped, max 10
    const signers = Array.from(
      new Set([founderWallet, ...selectedElders])
    ).slice(0, 10);

    if (signers.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 signers allowed' });
    }

    // ── 2. Resolve treasury config ──────────────────────────────────────────

    const treasuryType = daoData.treasuryType || 'cusd';
    const treasuryConfig =
      TREASURY_CONFIG[daoType]?.[treasuryType] ??
      TREASURY_CONFIG[daoType]?.cusd ??
      TREASURY_CONFIG.savings.cusd; // safe fallback

    const requiredSignatures = Math.max(
      2,
      Math.min(treasuryConfig.requiredSignatures, signers.length)
    );

    // ── 3. Duration / rotation ──────────────────────────────────────────────

    let durationModel: 'time' | 'rotation' | 'ongoing' = 'ongoing';
    let nextRotationDate: Date | null = null;

    if (daoType === 'harambee' || daoType === 'shortTerm') {
      durationModel = 'time';
    } else if (daoType === 'merryGoRound') {
      durationModel = 'rotation';
      if (daoData.rotationFrequency) {
        nextRotationDate = calculateNextRotation(
          new Date(),
          daoData.rotationFrequency as 'weekly' | 'monthly' | 'quarterly'
        );
      }
    }

    // ── 4. Create DAO record ────────────────────────────────────────────────

    const daoId = uuidv4();

    const [dao] = await db
      .insert(daos)
      .values({
        id: daoId,
        name: daoData.name,
        description: daoData.description || '',
        creatorId: founderWallet,
        founderId: founderWallet,
        daoType,
        access: 'public',
        memberCount: signers.length,

        primaryCause: daoData.primaryCause || '',
        causeTags: daoData.causeTags || [],

        treasuryBalance: '0',
        treasuryMultisigEnabled: true,
        treasuryRequiredSignatures: requiredSignatures,
        treasurySigners: signers,
        treasuryWithdrawalThreshold: String(treasuryConfig.dailyLimit),
        treasuryDailyLimit: treasuryConfig.dailyLimit,
        treasuryMonthlyBudget: treasuryConfig.monthlyBudget,

        withdrawalMode: treasuryConfig.withdrawalMode,
        durationModel,
        rotationFrequency: daoData.rotationFrequency,
        nextRotationDate,
        minElders: 2,
        maxElders: 10,

        // Governance defaults — deferred to Settings post-creation
        quorumPercentage: 50,
        votingPeriod: 48,
        executionDelay: 24,

        plan: daoType,
        metadata: {
          features: DAO_TYPE_CONFIG[daoType]?.features || {},
          durationDays: daoData.durationDays || null,
          createdFromTemplate: daoType,
          treasuryType,
          customTokenAddress: daoData.customTokenAddress || null,
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    logger.info(`DAO DB record created: ${dao.id}`);

    // Wire referral service: if a referrer was supplied, register it
    const referrerId = (req.body as any).referrerId || (daoData as any).referrerId;
    if (referrerId) {
      try {
        // Use daoId as escrowId surrogate for referral registration
        await registerEscrowReferral(referrerId, founderWallet, dao.id);
        logger.info(`Referral registered: ${referrerId} -> ${founderWallet}`);
      } catch (err) {
        logger.warn('Referral registration failed', err);
      }
    }

    // ── 5. Deploy ChamaTreasury on-chain ────────────────────────────────────

    let treasuryAddress: string | null = null;

    // If client provided a pre-deployed contract address, use it directly
    const clientContractAddress = req.body?.multisig?.contractAddress;
    if (clientContractAddress) {
      if (!isAddress(clientContractAddress)) {
        return res.status(400).json({
          error: `Invalid multisig contractAddress: ${clientContractAddress}`,
        });
      }
      treasuryAddress = clientContractAddress;
      logger.info(`Using client-provided treasury address: ${treasuryAddress}`);
    } else {
      // Primary path: deploy via ChamaTreasuryFactory
      const factoryConfigured = !!process.env.CHAMA_FACTORY_CONTRACT_ADDRESS;

      if (factoryConfigured) {
        try {
          const signerNames = signers.map((s, i) =>
            i === 0 ? 'Founder' : `Elder ${i}`
          );

          const deployer = getChamaTreasuryDeployer();
          const result = await deployer.deployTreasury({
            chamaName: daoData.name,
            daoId: dao.id,
            signers,
            signerNames,
            requiredSignatures,
            daoType: daoType as DaoTypeKey,
          });

          treasuryAddress = result.treasuryAddress;

          logger.info(
            `ChamaTreasury deployed: ${treasuryAddress} ` +
            `tx: ${result.txHash} fee: ${result.deploymentFee}`
          );
        } catch (err) {
          // Don't fail the whole DAO creation if on-chain deploy fails.
          // Treasury can be deployed later. Log and continue.
          logger.error('ChamaTreasury on-chain deployment failed', err);
          treasuryAddress = null;
        }
      } else {
        // Factory not configured — log warning, continue without on-chain treasury.
        // Set CHAMA_FACTORY_CONTRACT_ADDRESS to enable on-chain deployment.
        logger.warn(
          'CHAMA_FACTORY_CONTRACT_ADDRESS not set — ' +
          'skipping on-chain ChamaTreasury deployment. ' +
          'DAO will use off-chain ledger only until factory is configured.'
        );
      }
    }

    // ── 6. Create vault record ──────────────────────────────────────────────

    const vaultId = uuidv4();

    const [vault] = await db
      .insert(vaults)
      .values({
        id: vaultId,
        daoId: dao.id,
        vaultType: 'dao_treasury',
        name: `${dao.name} Treasury`,
        balance: '0',
        currency: treasuryType === 'dual' ? 'CELO' : 'cUSD',
        address: treasuryAddress || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    logger.info(`Vault record created: ${vault.id}`);

    // ── 6.a Grant roles on an existing MultiAssetVault to the ChamaTreasury
    // If the client provided a `multiAssetVaultAddress` (or daoData.vaultAddress),
    // attempt to grant MANAGER_ROLE and REBALANCER_ROLE to the deployed ChamaTreasury.
    // This is idempotent: we first check hasRole before calling grantRole.
    const multiAssetVaultAddress = (req.body as any).multiAssetVaultAddress || (daoData as any).vaultAddress || null;
    if (multiAssetVaultAddress && treasuryAddress) {
      try {
        const rpcUrl = process.env.CELO_RPC_URL || process.env.RPC_URL;
        const pk = process.env.PLATFORM_PRIVATE_KEY;
        if (!rpcUrl || !pk) throw new Error('Missing PLATFORM_PRIVATE_KEY or RPC URL for role grants');

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = createWalletIfValid(pk, provider);
        if (!wallet) throw new Error('Invalid PLATFORM_PRIVATE_KEY; cannot perform on-chain role grants');

        const VAULT_ABI = [
          'function hasRole(bytes32 role, address account) view returns (bool)',
          'function grantRole(bytes32 role, address account)'
        ];

        const vaultContract = new ethers.Contract(multiAssetVaultAddress, VAULT_ABI, wallet);

        const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MANAGER_ROLE'));
        const REBALANCER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('REBALANCER_ROLE'));

        // Helper to grant if missing. Returns txHash string when granted, null otherwise.
        async function ensureGrant(role: string, subject: string): Promise<string | null> {
          try {
            const has = await vaultContract.hasRole(role, subject);
            if (has) {
              logger.info(`Vault ${multiAssetVaultAddress} already has role ${role} for ${subject}`);
              return null;
            }
            const tx = await vaultContract.grantRole(role, subject);
            const receipt = await tx.wait();
            logger.info(`Granted role ${role} to ${subject} on vault ${multiAssetVaultAddress} tx=${receipt.transactionHash}`);
            return receipt.transactionHash as string;
          } catch (err) {
            logger.warn(`Could not grant role ${role} to ${subject} on ${multiAssetVaultAddress}`, err);
            return null;
          }
        }

        // Perform grants but do not fail the overall DAO creation if they fail
        const managerTx = await ensureGrant(MANAGER_ROLE, treasuryAddress);
        if (managerTx) {
          try {
            await db.update(vaults).set({ managerRoleGrantTx: managerTx, updatedAt: new Date() } as any).where(eq(vaults.id, vault.id));
          } catch (err) {
            logger.warn('Failed to persist manager role grant tx in DB', err);
          }
        }

        const rebalancerTx = await ensureGrant(REBALANCER_ROLE, treasuryAddress);
        if (rebalancerTx) {
          try {
            await db.update(vaults).set({ rebalancerRoleGrantTx: rebalancerTx, updatedAt: new Date() } as any).where(eq(vaults.id, vault.id));
          } catch (err) {
            logger.warn('Failed to persist rebalancer role grant tx in DB', err);
          }
        }
      } catch (err) {
        logger.warn('Role grant flow skipped or failed', err);
      }
    }

    // Update DAO record with treasury address if we got one
    if (treasuryAddress) {
      await db
        .update(daos)
        .set({ treasuryAddress, updatedAt: new Date() } as any)
        .where(eq(daos.id, dao.id));
    }

    // ── 7. Create wallet + multisig records ─────────────────────────────────

    const resolvedTreasuryAddress =
      treasuryAddress || `pending-${dao.id}`; // placeholder if not yet deployed

    const [daoWallet] = await db
      .insert(wallets)
      .values({
        userId: founderWallet,
        daoId: dao.id,
        currency: treasuryType === 'dual' ? 'CELO' : 'cUSD',
        address: resolvedTreasuryAddress,
        walletType: 'dao',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const chainId = Number(process.env.MULTISIG_CHAIN_ID || '42220');
    const chainName =
      chainId === 42220 ? 'celo' : chainId === 1 ? 'ethereum' : String(chainId);

    const [multisig] = await db
      .insert(multisigWallets)
      .values({
        walletId: daoWallet.id,
        daoId: dao.id,
        contractAddress: resolvedTreasuryAddress,
        chain: chainName,
        chainId,
        requiredSignatures,
        totalSigners: signers.length,
        walletStandard: 'chama',   // distinguish from Gnosis
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    // Signer records
    for (let i = 0; i < signers.length; i++) {
      await db.insert(multisigSigners).values({
        multisigWalletId: multisig.id,
        signerAddress: signers[i],
        userId: signers[i],
        signerIndex: i,
        role: i === 0 ? 'lead_signer' : 'signer',
        isActive: true,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }

    logger.info(
      `Multisig record created: ${multisig.id} ` +
      `required=${requiredSignatures} signers=${signers.length}`
    );

    // ── Optional: deploy LoanFacility contract and record it ───────────────
    const wantLoanFacility = Boolean(
      (daoData as any).enableLoanFacility || (daoData as any).loanFacility?.enabled
    );

    if (wantLoanFacility) {
      const initialFundingStr = (daoData as any).loanFacility?.initialFunding || (daoData as any).initialLoanFund || '0';
      const initialFunding = Number(initialFundingStr) || 0;
      const stablecoinAddr = process.env.STABLECOIN_ADDRESS || null;
      const elderCouncilAddr = resolvedTreasuryAddress; // multisig as elder council

      if (!stablecoinAddr) {
        logger.warn('STABLECOIN_ADDRESS not configured; skipping LoanFacility deploy');
      } else {
        try {
          const deployer = getChamaTreasuryDeployer();
          const fundingAtomic = BigInt(Math.round(initialFunding * 1e18));
          const result = await deployer.deployLoanFacility({
            chamaName: daoData.name,
            daoId: dao.id,
            stablecoin: stablecoinAddr,
            elderCouncil: elderCouncilAddr,
            initialFunding: fundingAtomic,
          });

          // Record in DB
          await db.insert(loanFacilities).values({
            id: uuidv4(),
            daoId: dao.id,
            address: result.loanFacilityAddress,
            stablecoin: stablecoinAddr,
            elderCouncil: elderCouncilAddr,
            fundedAmount: String(initialFunding),
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);

          logger.info(`LoanFacility deployed: ${result.loanFacilityAddress}`);
        } catch (err) {
          logger.error('LoanFacility deployment failed', err);
        }
      }
    }

    // ── Optional: fund rewards manager by pulling from multisig treasury ────
    // If frontend provided rewardsManagerAddress and initialFunding in MTAA (decimal), attempt pull
    const rewardsManagerAddress = (daoData as any).rewardsManagerAddress || (req.body as any).rewardsManagerAddress;
    const rewardsInitialFunding = Number((daoData as any).rewards?.initialFunding || (req.body as any).rewardsInitialFunding || 0);
    if (rewardsManagerAddress && rewardsInitialFunding > 0) {
      try {
        const rpcUrl = process.env.CELO_RPC_URL || process.env.RPC_URL;
        const pk = process.env.PLATFORM_PRIVATE_KEY;
        if (!rpcUrl || !pk) throw new Error('Missing PLATFORM_PRIVATE_KEY or RPC URL');

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = createWalletIfValid(pk, provider);
        if (!wallet) throw new Error('Invalid PLATFORM_PRIVATE_KEY; cannot perform on-chain reward pull');

        const REWARDS_ABI = [
          'function pullRewardsFrom(address from, uint256 amount) external',
        ];

        const contract = new ethers.Contract(rewardsManagerAddress, REWARDS_ABI, wallet);
        const amountWei = ethers.parseUnits(String(rewardsInitialFunding), 18);

        // Attempt pull; this requires the multisig (treasury) to have approved the wallet to spend MTAA,
        // or the wallet to be owner of rewards manager. If it fails, log and continue.
        const tx = await contract.pullRewardsFrom(resolvedTreasuryAddress, amountWei);
        const receipt = await tx.wait();
        logger.info(`pullRewardsFrom executed tx: ${receipt.transactionHash}`);
      } catch (err) {
        logger.warn('Could not pull rewards automatically; ensure multisig approved or call pullRewardsFrom manually', err);
      }
    }

    // ── 8. Create memberships ───────────────────────────────────────────────

    // Founder — always elder, always approved
    await db.insert(daoMemberships).values({
      userId: founderWallet,
      daoId: dao.id,
      role: 'elder',
      status: 'approved',
      isAdmin: true,
      isElder: true,
      canInitiateWithdrawal: true,
      canApproveWithdrawal: true,
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Selected elders (excluding founder)
    for (const elder of selectedElders) {
      if (elder === founderWallet) continue;

      const ruleResult = await evaluateMemberCreationRules(dao.id, {
        memberAddress: elder,
        role: 'elder',
        joinedAt: new Date(),
      });

      if (!ruleResult.approved) {
        logger.warn(
          `Elder rejected by rules: ${elder} — ` +
          formatRuleRejectionMessage(ruleResult.results)
        );
        logRuleEvaluation(dao.id, 'member_create', elder, ruleResult.results);
        continue;
      }

      await db.insert(daoMemberships).values({
        userId: elder,
        daoId: dao.id,
        role: 'elder',
        status: 'pending',
        isAdmin: false,
        isElder: true,
        canInitiateWithdrawal: false,
        canApproveWithdrawal: true,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      logRuleEvaluation(dao.id, 'member_create', elder, ruleResult.results);
    }

    // Regular invited members
    for (const member of invitedMembers || []) {
      if (signers.includes(member)) continue; // already an elder

      const ruleResult = await evaluateMemberCreationRules(dao.id, {
        memberAddress: member,
        role: 'member',
        joinedAt: new Date(),
      });

      if (!ruleResult.approved) {
        logger.warn(
          `Member rejected by rules: ${member} — ` +
          formatRuleRejectionMessage(ruleResult.results)
        );
        logRuleEvaluation(dao.id, 'member_create', member, ruleResult.results);
        continue;
      }

      await db.insert(daoMemberships).values({
        userId: member,
        daoId: dao.id,
        role: 'member',
        status: 'pending',
        isAdmin: false,
        isElder: false,
        canInitiateWithdrawal: false,
        canApproveWithdrawal: false,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    logger.info(`Memberships created for DAO: ${dao.id}`);

    // ── 9. Respond ──────────────────────────────────────────────────────────

    return res.status(201).json({
      success: true,
      daoId: dao.id,
      daoAddress: dao.id,
      vaultId: vault.id,
      vaultAddress: treasuryAddress || null,
      treasuryAddress: treasuryAddress || null,
      treasuryPending: !treasuryAddress,
      dao: {
        id: dao.id,
        name: dao.name,
        founderId: dao.founderId,
        daoType,
        vaultId: vault.id,
        withdrawalMode: treasuryConfig.withdrawalMode,
        durationModel,
        signers: signers.map((s, i) => ({
          address: s,
          role: i === 0 ? 'founder' : 'elder',
        })),
        requiredSignatures,
        memberCount: dao.memberCount,
        capabilities: getDaoCapabilities(daoType),
      },
    });

  } catch (error) {
    logger.error('DAO creation failed', error);
    return res.status(500).json({
      error: 'Failed to create DAO',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateNextRotation(
  from: Date,
  frequency: 'weekly' | 'monthly' | 'quarterly'
): Date {
  const next = new Date(from);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  else next.setMonth(next.getMonth() + 3);
  return next;
}

function getDaoCapabilities(daoType: CanonicalDaoType): string[] {
  const common = [
    'Pooled treasury with transparent records',
    'Multi-signature approvals for withdrawals',
    'Member contribution tracking',
    'Group proposals and voting',
  ];

  const extras: Record<CanonicalDaoType, string[]> = {
    harambee:     ['Fast collection and single disbursement', 'Auto-close after goal reached'],
    shortTerm:    ['Milestone tracking', 'Time-bounded with configurable duration'],
    savings:      ['Recurring contribution cycles', 'Weekly reconciliation digest'],
    merryGoRound: ['Rotation schedule', 'Automated payout order tracking'],
    community:    ['Governance proposals', 'Committee support', 'Elections'],
    investment:   ['Portfolio tracking', 'Yield strategies', 'Dividend distribution', 'Performance reports'],
  };

  return [...common, ...(extras[daoType] || [])];
}