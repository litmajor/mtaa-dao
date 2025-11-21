import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { daos, daoMemberships, vaults, users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { isAddress } from 'viem';
import { Logger } from '../utils/logger';

const logger = new Logger('dao-deploy');

export interface DaoDeployRequest {
  daoData: {
    name: string;
    description?: string;
    daoType: 'shortTerm' | 'collective' | 'governance' | 'short_term' | 'free' | 'meta';
    category?: string;
    treasuryType?: 'cusd' | 'dual' | 'custom';
    durationDays?: number;
    rotationFrequency?: string;
  };
  founderWallet: string;
  invitedMembers: string[];
  selectedElders: string[]; // CRITICAL: Array of user IDs or wallet addresses to be elders
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
        treasuryMultisigEnabled: true,
        treasuryRequiredSignatures: elders.length, // CRITICAL: Set to actual elder count
        treasurySigners: elders, // CRITICAL: Set actual signer list (not empty!)
        treasuryWithdrawalThreshold: '1000.00',
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
        votingPeriod: 72,
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
      }
    }

    // ============================================
    // CREATE INVITED MEMBER MEMBERSHIPS
    // ============================================

    for (const member of invitedMembers || []) {
      if (!elders.includes(member)) {
        // Skip if already an elder
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
      }
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
