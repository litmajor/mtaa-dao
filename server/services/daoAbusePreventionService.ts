
import { db } from '../db';
import { users, daos, daoCreationTracker, daoSocialVerifications, daoIdentityNfts } from '../../shared/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError, ValidationError } from '../middleware/errorHandler';
import { ethers } from 'ethers';

const COOLDOWN_DAYS = 7;
const MIN_SOCIAL_PROOF = 2; // Minimum verifiers needed
const DAO_NFT_COST_MTAA = 10;

interface DaoCreationCheck {
  canCreate: boolean;
  reason?: string;
  cooldownEndsAt?: Date;
  verificationsNeeded?: number;
}

interface SocialVerificationRequest {
  daoId: string;
  verifierUserId: string;
  verificationType: 'member_invite' | 'community_vouch';
}

export class DaoAbusePreventionService {
  private logger = Logger.getLogger();

  /**
   * Check if user can create a new DAO
   */
  async canUserCreateDao(userId: string): Promise<DaoCreationCheck> {
    try {
      // 1. Check phone/wallet verification
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user || (!user.phoneVerified && !user.walletAddress)) {
        return {
          canCreate: false,
          reason: 'Phone number or wallet verification required before creating a DAO'
        };
      }

      // 2. Check cooldown period - get last DAO creation from tracker
      const lastCreation = await db.query.daoCreationTracker.findFirst({
        where: eq(daoCreationTracker.userId, userId),
        orderBy: [desc(daoCreationTracker.createdAt)]
      });

      if (lastCreation?.createdAt) {
        const cooldownEnd = new Date(lastCreation.createdAt);
        cooldownEnd.setDate(cooldownEnd.getDate() + COOLDOWN_DAYS);

        if (new Date() < cooldownEnd) {
          return {
            canCreate: false,
            reason: `DAO creation cooldown active. Try again after ${cooldownEnd.toLocaleDateString()}`,
            cooldownEndsAt: cooldownEnd
          };
        }
      }

      return { canCreate: true };
    } catch (error: any) {
      this.logger.error('Error checking DAO creation eligibility', error);
      throw new AppError('Failed to verify DAO creation eligibility', 500);
    }
  }

  /**
   * Record DAO creation and enforce limits
   */
  async recordDaoCreation(userId: string, daoId: string, verificationMethod: 'phone' | 'wallet') {
    try {
      // Record in creation tracker
      await db.insert(daoCreationTracker).values({
        userId,
        daoId,
        verificationMethod,
        isVerified: true
      });

      this.logger.info(`DAO creation recorded for user ${userId}`, { daoId, verificationMethod });
    } catch (error: any) {
      this.logger.error('Error recording DAO creation', error);
      throw error;
    }
  }

  /**
   * Add social proof verification
   */
  async addSocialVerification(request: SocialVerificationRequest) {
    try {
      const { daoId, verifierUserId, verificationType } = request;

      // Check if already verified
      const existing = await db.query.daoSocialVerifications.findFirst({
        where: and(
          eq(daoSocialVerifications.daoId, daoId),
          eq(daoSocialVerifications.verifierUserId, verifierUserId)
        )
      });

      if (existing) {
        throw new ValidationError('You have already verified this DAO');
      }

      // Add verification
      await db.insert(daoSocialVerifications).values({
        daoId,
        verifierUserId,
        verificationType,
        metadata: { verifiedAt: new Date() }
      });

      // Check if DAO now meets verification threshold
      const verificationCount = await this.getSocialProofCount(daoId);
      
      if (verificationCount >= MIN_SOCIAL_PROOF) {
        await this.markDaoAsVerified(daoId);
      }

      this.logger.info(`Social verification added for DAO ${daoId} by ${verifierUserId}`);

      return { verificationCount, verified: verificationCount >= MIN_SOCIAL_PROOF };
    } catch (error: any) {
      this.logger.error('Error adding social verification', error);
      throw error;
    }
  }

  /**
   * Get social proof count for a DAO
   */
  async getSocialProofCount(daoId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoSocialVerifications)
      .where(eq(daoSocialVerifications.daoId, daoId));

    return Number(result[0]?.count || 0);
  }

  /**
   * Mark DAO as verified after meeting requirements
   */
  async markDaoAsVerified(daoId: string) {
    // Update the creation tracker to mark as verified
    const creationRecord = await db.query.daoCreationTracker.findFirst({
      where: eq(daoCreationTracker.daoId, daoId)
    });

    if (creationRecord) {
      await db.update(daoCreationTracker)
        .set({ isVerified: true })
        .where(eq(daoCreationTracker.id, creationRecord.id));
    }

    this.logger.info(`DAO ${daoId} marked as verified`);
  }

  /**
   * Mint DAO Identity NFT (symbolic on-chain proof)
   */
  async mintDaoIdentityNft(daoId: string, userId: string) {
    try {
      // Check if NFT already minted
      const existing = await db.query.daoIdentityNfts.findFirst({
        where: eq(daoIdentityNfts.daoId, daoId)
      });

      if (existing) {
        throw new ValidationError('DAO Identity NFT already minted');
      }

      // Generate NFT token ID and metadata
      const nftTokenId = `DAO-NFT-${daoId}-${Date.now()}`;
      const nftContractAddress = process.env.DAO_NFT_CONTRACT_ADDRESS || 'contract-placeholder';
      const metadataUri = `ipfs://dao-identity/${daoId}`;

      // Record NFT in database
      await db.insert(daoIdentityNfts).values({
        daoId,
        nftTokenId,
        nftContractAddress,
        mintCostMtaa: DAO_NFT_COST_MTAA.toString(),
        isVerified: true,
        metadataUri
      });

      this.logger.info(`DAO Identity NFT recorded for ${daoId}`, { tokenId: nftTokenId });

      return { tokenId: nftTokenId, cost: DAO_NFT_COST_MTAA };
    } catch (error: any) {
      this.logger.error('Error minting DAO Identity NFT', error);
      throw error;
    }
  }

  /**
   * Get DAO verification status
   */
  async getDaoVerificationStatus(daoId: string) {
    const socialProofCount = await this.getSocialProofCount(daoId);
    
    const creationRecord = await db.query.daoCreationTracker.findFirst({
      where: eq(daoCreationTracker.daoId, daoId)
    });

    const nft = await db.query.daoIdentityNfts.findFirst({
      where: eq(daoIdentityNfts.daoId, daoId)
    });

    return {
      isVerified: creationRecord?.isVerified || false,
      socialProofCount,
      requiredSocialProof: MIN_SOCIAL_PROOF,
      hasIdentityNft: !!nft,
      nftDetails: nft
    };
  }

  /**
   * Get user's DAO creation history
   */
  async getUserDaoCreationHistory(userId: string) {
    const history = await db.query.daoCreationTracker.findMany({
      where: eq(daoCreationTracker.userId, userId),
      orderBy: [desc(daoCreationTracker.createdAt)],
      limit: 10
    });

    const daoCount = history.length;
    const lastCreation = history.length > 0 ? history[0]?.createdAt : null;

    return {
      totalDaosCreated: daoCount,
      lastDaoCreation: lastCreation,
      recentDaos: history
    };
  }
}

export const daoAbusePreventionService = new DaoAbusePreventionService();
