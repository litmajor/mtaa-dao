import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { daos, daoMemberships, vaults, users, wallets, multisigWallets, multisigSigners } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { evaluateMemberCreationRules, formatRuleRejectionMessage, logRuleEvaluation } from '../services/rules-integration';

// Validate if string is a valid Ethereum address
const isAddress = (address: string): boolean => {
  try {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  } catch {
    return false;
  }
};

const logger = new Logger('dao-deploy');

export interface DaoDeployRequest {
  daoData: {
    name: string;
    description?: string;
    daoType: 'shortTerm' | 'collective' | 'governance' | 'short_term' | 'free' | 'meta';
    category?: string;
    treasuryType?: 'cusd' | 'dual' | 'custom';
    customTokenAddress?: string; // For custom stablecoin treasury
    durationDays?: number;
    rotationFrequency?: string;
  };
  founderWallet: string;
  invitedMembers: string[];
  selectedElders: string[]; // CRITICAL: Array of user IDs or wallet addresses to be elders
  multisig?: {
    enabled?: boolean;
    signers?: string[];
    requiredSignatures?: number;
  };
}


/**
 * Deploy a new DAO with founder wallet and elders
 * CRITICAL FIX: Creates elders properly, founder can withdraw immediately
 */
export async function daoDeployHandler(req: Request, res: Response) {
  try {
    const { daoData, founderWallet, invitedMembers, selectedElders } = req.body as DaoDeployRequest;

    logger.info(`Creating DAO: ${daoData.name} for founder: ${founderWallet}`);

    // ============================================
    // VALIDATION
    // ============================================

    // Validate founder wallet
    if (!founderWallet || !isAddress(founderWallet)) {
      logger.error(`Invalid founder wallet: ${founderWallet}`);
      return res.status(400).json({ error: 'Invalid founder wallet address' });
    }

    // Validate user can create this DAO type based on subscription
    const tierPermissions = {
      free: ['free'],
      growth: ['free', 'shortTerm', 'short_term'],
      professional: ['free', 'shortTerm', 'short_term', 'collective', 'governance'],
      enterprise: ['free', 'shortTerm', 'short_term', 'collective', 'governance', 'meta']
    };

    // Get user's subscription tier
    const userProfile = await db.query.users.findFirst({
      where: eq(users.id, founderWallet)
    });

    const userTier = 'free'; // Default to free tier - subscription system can be enhanced later
    const allowedTypes = tierPermissions[userTier as keyof typeof tierPermissions] || ['free'];

    if (!allowedTypes.includes(daoData.daoType)) {
      logger.error(`User ${founderWallet} attempted to create ${daoData.daoType} DAO without proper tier (has: ${userTier})`);
      return res.status(403).json({ 
        error: 'Insufficient subscription tier',
        message: `${daoData.daoType} DAOs require ${Object.keys(tierPermissions).find(k => tierPermissions[k as keyof typeof tierPermissions].includes(daoData.daoType))} tier or higher`,
        currentTier: userTier,
        requiredTier: Object.keys(tierPermissions).find(k => tierPermissions[k as keyof typeof tierPermissions].includes(daoData.daoType))
      });
    }

    logger.info(`User ${founderWallet} validated for ${daoData.daoType} DAO creation (tier: ${userTier})`);

    // CRITICAL: Validate elders
    if (!selectedElders || selectedElders.length < 2) {
      logger.error(`Insufficient elders: ${selectedElders?.length || 0}`);
      return res.status(400).json({
        error: 'Minimum 2 elders required for treasury multi-sig'
      });
    }

    // Validate selected elders
    for (const elder of selectedElders) {
      const isValid = isAddress(elder) || /^[a-f0-9-]{36}$/.test(elder); // UUID format
      if (!isValid) {
        logger.error(`Invalid elder format: ${elder}`);
        return res.status(400).json({ error: `Invalid elder format: ${elder}` });
      }
    }

    // Ensure founder is in elders list
    const elders = Array.from(new Set([founderWallet, ...selectedElders]));
    if (elders.length > 5) {
      logger.error(`Too many elders: ${elders.length}`);
      return res.status(400).json({ error: 'Maximum 5 elders allowed' });
    }

    // ============================================
    // DETERMINE DAO CONFIGURATION BY TYPE & TREASURY
    // ============================================

    // Normalize daoType (handle both camelCase and snake_case)
    const normalizedDaoType = daoData.daoType.replace('_', '') === 'shortterm' ? 'shortTerm' : daoData.daoType;

    let withdrawalMode = 'multisig';
    let durationModel = 'time';
    let minElders = 2;
    let nextRotationDate: Date | null = null;
    let treasuryConfig: TreasuryConfig | null = null;

    // Get treasury config based on type and treasury type
    const treasuryType = daoData.treasuryType || 'cusd';
    if (TREASURY_CONFIG[normalizedDaoType]) {
      treasuryConfig = TREASURY_CONFIG[normalizedDaoType][treasuryType];
      if (treasuryConfig) {
        withdrawalMode = treasuryConfig.withdrawalMode;
        minElders = treasuryConfig.requiredSignatures;
      }
    }

    if (normalizedDaoType === 'shortTerm' || daoData.daoType === 'short_term') {
      // Short-term DAOs (Chama, Merry-Go-Round)
      durationModel = 'time';
      if (daoData.durationDays) {
        // Store duration for later processing
        logger.info(`Short-term DAO with ${daoData.durationDays} days duration`);
      }

      if (daoData.rotationFrequency) {
        durationModel = 'rotation';
        nextRotationDate = calculateNextRotation(
          new Date(),
          daoData.rotationFrequency as 'weekly' | 'monthly' | 'quarterly'
        );
      }
    } else if (normalizedDaoType === 'collective' || daoData.daoType === 'collective') {
      // Collective DAOs (Harambee, Burial Fund)
      durationModel = 'ongoing';
    } else if (normalizedDaoType === 'governance' || daoData.daoType === 'governance') {
      // Governance DAOs (Community councils, social impact)
      durationModel = 'ongoing';
    }

    logger.info(`DAO Config: type=${normalizedDaoType}, treasuryType=${treasuryType}, withdrawalMode=${withdrawalMode}, elders=${elders.length}`);

    // ============================================
    // CREATE DAO RECORD
    // ============================================

    const daoId = uuidv4();

    // Auto-configure multi-sig based on DAO type
    const multisigConfig = getMultisigConfigForDaoType(daoData.daoType);

    const [dao] = await db
      .insert(daos)
      .values({
        id: daoId,
        name: daoData.name,
        description: daoData.description || '',
        creatorId: founderWallet,
        founderId: founderWallet,
        daoType: daoData.daoType,
        access: 'public',
        memberCount: 1 + elders.filter(e => e !== founderWallet).length,

        // Treasury configuration
        treasuryBalance: '0',
        treasuryMultisigEnabled: multisigConfig.enabled,
        treasuryRequiredSignatures: elders.length, // CRITICAL: Set to actual elder count
        treasurySigners: elders, // CRITICAL: Set actual signer list (not empty!)
        treasuryWithdrawalThreshold: '5000.00',
        treasuryDailyLimit: getDailyLimitByType(daoData.daoType),
        treasuryMonthlyBudget: getMonthlyBudgetByType(daoData.daoType),

        // NEW: Withdrawal and duration configuration
        withdrawalMode,
        durationModel,
        rotationFrequency: daoData.rotationFrequency,
        nextRotationDate,
        minElders,
        maxElders: 5,

        // Governance configuration
        quorumPercentage: daoData.daoType === 'short_term' ? 0 : 20,
        votingPeriod: 48,
        executionDelay: 24,

        plan: daoData.daoType,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    logger.info(`DAO created: ${dao.id}, elders: ${elders.length}`);

    // ============================================
    // CREATE TREASURY VAULT
    // ============================================

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
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    logger.info(`Vault created: ${vault.id}`);

    // ============================================
    // CREATE FOUNDER MEMBERSHIP AS ELDER
    // ============================================

    await db
      .insert(daoMemberships)
      .values({
        userId: founderWallet,
        daoId: dao.id,
        role: 'elder', // CRITICAL FIX: Founder is elder
        status: 'approved',
        isAdmin: true,
        isElder: true, // CRITICAL FIX: Set isElder flag
        canInitiateWithdrawal: withdrawalMode === 'direct', // Can withdraw directly if mode is direct
        canApproveWithdrawal: true, // Can approve multi-sig
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    logger.info(`Founder membership created as elder: ${founderWallet}`);

    // ============================================
    // CREATE ELDER MEMBERSHIPS
    // ============================================

    for (const elder of selectedElders) {
      if (elder !== founderWallet) {
        // Skip founder (already created above)

        // Evaluate member creation rules
        const ruleResult = await evaluateMemberCreationRules(dao.id, {
          memberAddress: elder,
          role: 'elder',
          joinedAt: new Date(),
        });

        if (!ruleResult.approved) {
          logger.warn(`Elder membership rejected by rules: ${elder} - ${formatRuleRejectionMessage(ruleResult.results)}`);
          logRuleEvaluation(dao.id, 'member_create', elder, ruleResult.results);
          continue; // Skip this elder and continue with next
        }

        await db
          .insert(daoMemberships)
          .values({
            userId: elder,
            daoId: dao.id,
            role: 'elder',
            status: 'pending', // Need to accept
            isAdmin: false,
            isElder: true,
            canInitiateWithdrawal: withdrawalMode === 'direct',
            canApproveWithdrawal: true,
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

        logger.info(`Elder membership created (pending): ${elder}`);
        logRuleEvaluation(dao.id, 'member_create', elder, ruleResult.results);
      }
    }

    // ============================================
    // CREATE INVITED MEMBER MEMBERSHIPS
    // ============================================

    for (const member of invitedMembers || []) {
      if (!elders.includes(member)) {
        // Skip if already an elder

        // Evaluate member creation rules
        const ruleResult = await evaluateMemberCreationRules(dao.id, {
          memberAddress: member,
          role: 'member',
          joinedAt: new Date(),
        });

        if (!ruleResult.approved) {
          logger.warn(`Member membership rejected by rules: ${member} - ${formatRuleRejectionMessage(ruleResult.results)}`);
          logRuleEvaluation(dao.id, 'member_create', member, ruleResult.results);
          continue; // Skip this member and continue with next
        }

        await db
          .insert(daoMemberships)
          .values({
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

        logger.info(`Regular member membership created (pending): ${member}`);
        logRuleEvaluation(dao.id, 'member_create', member, ruleResult.results);
      }
    }

        // ============================================
        // CREATE DAO TREASURY WALLET + MULTISIG RECORD
        // ============================================
        try {
          // Create a wallets record for the DAO treasury
          const insertedDaoWallets = await db.insert(wallets).values({
            userId: founderWallet,
            daoId: dao.id,
            currency: treasuryType === 'dual' ? 'CELO' : 'cUSD',
            address: `0x${uuidv4().replace(/-/g, '').slice(0, 40)}`,
            walletType: 'dao',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning();
          const daoWallet = insertedDaoWallets[0];

          // Use client-provided multisig config if present, otherwise fall back to elders
          const clientMultisig = (req.body as any)?.multisig;
          const signersToUse: string[] = (clientMultisig && clientMultisig.enabled && Array.isArray(clientMultisig.signers) && clientMultisig.signers.length)
            ? clientMultisig.signers
            : elders;

          const requestedRequired = clientMultisig && typeof clientMultisig.requiredSignatures === 'number'
            ? Number(clientMultisig.requiredSignatures)
            : elders.length;

          // Ensure requiredSignatures is at least 2 and not greater than signers count
          const requiredSignatures = Math.max(2, Math.min(requestedRequired || elders.length, Math.max(2, signersToUse.length)));

          // Create a multisig wallet record tied to the DAO and wallet
          const multisigAddress = `0x${uuidv4().replace(/-/g, '').slice(0, 40)}`; // placeholder until on-chain deployed
          const insertedMultisigs = await db.insert(multisigWallets).values({
            walletId: daoWallet.id,
            daoId: dao.id,
            contractAddress: multisigAddress,
            chainId: 42220, // default to Celo mainnet; change if needed
            requiredSignatures,
            totalSigners: signersToUse.length,
            walletStandard: 'gnosis',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning();
          const multisig = insertedMultisigs[0];

          logger.info(`Created multisig record: ${multisig.id} contract: ${multisigAddress} required=${requiredSignatures} signers=${signersToUse.length}`);

          // Create multisig signer entries for provided signers; attach userId when user exists
          for (let i = 0; i < signersToUse.length; i++) {
            const signer = signersToUse[i];
            // Check if user exists
            const existing = await db.select().from(users).where(eq(users.id, signer)).limit(1);
            const signerRow: Record<string, any> = {
              multisigWalletId: multisig.id,
              signerAddress: signer,
              signerIndex: i,
              role: i === 0 ? 'lead_signer' : 'signer',
              isActive: true,
              joinedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            };
            if (existing.length) {
              signerRow.userId = signer;
            }
            await db.insert(multisigSigners).values(signerRow);
          }
        } catch (err) {
          logger.error('Failed to create multisig wallet or signers', err);
          // Do not fail DAO creation for multisig creation issues; log and continue
        }

    // ============================================
    // RESPONSE
    // ============================================

    return res.status(201).json({
      success: true,
      dao: {
        id: dao.id,
        name: dao.name,
        founderId: dao.founderId,
        vaultId: vault.id,
        daoType: dao.daoType,
        withdrawalMode,
        durationModel,
        elders: elders.map(e => ({ id: e, role: 'elder' })),
        memberCount: dao.memberCount,
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

// ============================================
// TREASURY CONFIGURATION BY DAO TYPE
// ============================================

interface TreasuryConfig {
  requiredSignatures: number;
  dailyLimit: string;
  monthlyBudget: string;
  withdrawalMode: string;
  supportedTokens: string[];
}

const TREASURY_CONFIG: Record<string, Record<string, TreasuryConfig>> = {
  'shortTerm': {
    'cusd': {
      requiredSignatures: 2,
      dailyLimit: '5000.00',
      monthlyBudget: '50000.00',
      withdrawalMode: 'direct',
      supportedTokens: ['cUSD']
    }
  },
  'collective': {
    'cusd': {
      requiredSignatures: 3,
      dailyLimit: '10000.00',
      monthlyBudget: '100000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD']
    },
    'dual': {
      requiredSignatures: 3,
      dailyLimit: '15000.00',
      monthlyBudget: '150000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD', 'CELO']
    }
  },
  'governance': {
    'cusd': {
      requiredSignatures: 4,
      dailyLimit: '25000.00',
      monthlyBudget: '250000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD']
    },
    'dual': {
      requiredSignatures: 4,
      dailyLimit: '35000.00',
      monthlyBudget: '350000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD', 'CELO']
    },
    'custom': {
      requiredSignatures: 5,
      dailyLimit: '50000.00',
      monthlyBudget: '500000.00',
      withdrawalMode: 'multisig',
      supportedTokens: ['cUSD', 'CELO', 'USDT', 'DAI']
    }
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDailyLimitByType(daoType: string): string {
  switch (daoType) {
    case 'short_term':
      return '5000.00'; // $5K daily for chama
    case 'collective':
      return '10000.00'; // $10K daily for collective
    default:
      return '1000.00';
  }
}

function getMonthlyBudgetByType(daoType: string): string {
  switch (daoType) {
    case 'short_term':
      return '50000.00'; // $50K monthly for chama
    case 'collective':
      return '100000.00'; // $100K monthly for collective
    default:
      return '10000.00';
  }
}

function calculateNextRotation(
  from: Date,
  frequency: 'weekly' | 'monthly' | 'quarterly'
): Date {
  const next = new Date(from);
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
  }
  return next;
}

// Helper: Multi-sig config per DAO type
function getMultisigConfigForDaoType(type: string) {
  if (type === 'free') {
    return {
      enabled: false, // Single-sig for free tier
      requiredSignatures: 1,
      withdrawalThreshold: 500, // $500 threshold
      dailyLimit: 1000 // $1K/day
    };
  } else if (type === 'collective') {
    return {
      enabled: true, // 3-of-5 multi-sig
      requiredSignatures: 3,
      withdrawalThreshold: 1000, // $1K threshold
      dailyLimit: 5000 // $5K/day
    };
  } else { // metadao
    return {
      enabled: true, // 5-of-7 multi-sig
      requiredSignatures: 5,
      withdrawalThreshold: 5000, // $5K threshold
      dailyLimit: 10000 // $10K/day
    };
  }
}