
import { db } from '../storage';
import { kycVerifications, complianceAuditLogs, suspiciousActivities } from '../../shared/kycSchema';
import { users } from '../../shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import crypto from 'crypto';

export interface KYCTier {
  tier: 'none' | 'basic' | 'intermediate' | 'advanced';
  dailyLimit: number;
  monthlyLimit: number;
  annualLimit: number;
  requirements: string[];
}

export const KYC_TIERS: Record<string, KYCTier> = {
  none: {
    tier: 'none',
    dailyLimit: 100,
    monthlyLimit: 500,
    annualLimit: 1000,
    requirements: ['Account registration']
  },
  basic: {
    tier: 'basic',
    dailyLimit: 5000,
    monthlyLimit: 50000,
    annualLimit: 100000,
    requirements: ['Email verification', 'Phone verification']
  },
  intermediate: {
    tier: 'intermediate',
    dailyLimit: 10000,
    monthlyLimit: 100000,
    annualLimit: 500000,
    requirements: ['Email verification', 'Phone verification', 'ID document upload']
  },
  advanced: {
    tier: 'advanced',
    dailyLimit: 100000,
    monthlyLimit: 1000000,
    annualLimit: 10000000,
    requirements: ['Email verification', 'Phone verification', 'ID document upload', 'Proof of address']
  }
};

export class KYCService {
  // Jumio configuration
  private jumioConfig = {
    apiToken: process.env.JUMIO_API_TOKEN || '',
    apiSecret: process.env.JUMIO_API_SECRET || '',
    baseUrl: process.env.JUMIO_BASE_URL || 'https://netverify.com/api/v4',
    enabled: !!process.env.JUMIO_API_TOKEN
  };

  // Onfido configuration
  private onfidoConfig = {
    apiToken: process.env.ONFIDO_API_TOKEN || '',
    baseUrl: process.env.ONFIDO_BASE_URL || 'https://api.onfido.com/v3',
    enabled: !!process.env.ONFIDO_API_TOKEN
  };

  // Chainalysis configuration
  private chainalysisConfig = {
    apiKey: process.env.CHAINALYSIS_API_KEY || '',
    baseUrl: process.env.CHAINALYSIS_BASE_URL || 'https://api.chainalysis.com',
    enabled: !!process.env.CHAINALYSIS_API_KEY
  };

  async getUserKYC(userId: string) {
    const kyc = await db.select()
      .from(kycVerifications)
      .where(eq(kycVerifications.userId, userId))
      .orderBy(kycVerifications.createdAt)
      .limit(1);

    return kyc[0] || null;
  }

  async getCurrentTier(userId: string): Promise<KYCTier> {
    const kyc = await this.getUserKYC(userId);
    
    if (!kyc || kyc.status !== 'approved') {
      return KYC_TIERS.none;
    }

    return KYC_TIERS[kyc.tier] || KYC_TIERS.none;
  }

  async checkTransactionLimit(userId: string, amount: number, currency: string): Promise<{ allowed: boolean; reason?: string }> {
    const tier = await this.getCurrentTier(userId);
    
    // Convert amount to USD (simplified - should use real exchange rates)
    const amountUSD = amount; // Assume amount is already in USD equivalent

    if (amountUSD > tier.dailyLimit) {
      return {
        allowed: false,
        reason: `Transaction exceeds daily limit of $${tier.dailyLimit}. Current tier: ${tier.tier}`
      };
    }

    // Check daily spending
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailySpending = await this.getDailySpending(userId, today);

    if (dailySpending + amountUSD > tier.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily limit exceeded. Spent: $${dailySpending.toFixed(2)}, Limit: $${tier.dailyLimit}`
      };
    }

    return { allowed: true };
  }

  private async getDailySpending(userId: string, startDate: Date): Promise<number> {
    // Query wallet transactions for today
    // Simplified implementation - should query actual transaction table
    return 0;
  }

  async submitBasicKYC(userId: string, data: { email: string; phone: string }) {
    // Check if KYC already exists
    const existing = await this.getUserKYC(userId);

    if (existing) {
      throw new Error('KYC verification already submitted');
    }

    // Create KYC record
    const [kyc] = await db.insert(kycVerifications).values({
      userId,
      tier: 'basic',
      status: 'pending',
      email: data.email,
      phone: data.phone,
      emailVerified: false,
      phoneVerified: false,
      dailyLimit: KYC_TIERS.basic.dailyLimit,
      monthlyLimit: KYC_TIERS.basic.monthlyLimit,
      annualLimit: KYC_TIERS.basic.annualLimit,
      submittedAt: new Date()
    }).returning();

    // Log audit trail
    await this.logComplianceEvent(userId, 'kyc_submitted', { tier: 'basic' });

    return kyc;
  }

  async submitIntermediateKYC(userId: string, data: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string;
    idDocumentType: string;
    idDocumentNumber: string;
    idDocumentFrontUrl: string;
    idDocumentBackUrl?: string;
  }) {
    const existing = await this.getUserKYC(userId);

    if (!existing || existing.tier !== 'basic' || existing.status !== 'approved') {
      throw new Error('Must complete basic KYC first');
    }

    // Use Jumio or Onfido for ID verification
    const verificationResult = await this.verifyIdentityDocument(userId, data);

    // Update KYC record
    const [kyc] = await db.update(kycVerifications)
      .set({
        tier: 'intermediate',
        status: 'pending',
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        nationality: data.nationality,
        idDocumentType: data.idDocumentType,
        idDocumentNumber: data.idDocumentNumber,
        idDocumentFrontUrl: data.idDocumentFrontUrl,
        idDocumentBackUrl: data.idDocumentBackUrl,
        idVerificationStatus: verificationResult.status,
        verificationProvider: verificationResult.provider,
        verificationReference: verificationResult.reference,
        verificationData: verificationResult.data,
        dailyLimit: KYC_TIERS.intermediate.dailyLimit,
        monthlyLimit: KYC_TIERS.intermediate.monthlyLimit,
        annualLimit: KYC_TIERS.intermediate.annualLimit,
        submittedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(kycVerifications.userId, userId))
      .returning();

    await this.logComplianceEvent(userId, 'kyc_submitted', { tier: 'intermediate' });

    return kyc;
  }

  async submitAdvancedKYC(userId: string, data: {
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    proofOfAddressType: string;
    proofOfAddressUrl: string;
  }) {
    const existing = await this.getUserKYC(userId);

    if (!existing || existing.tier !== 'intermediate' || existing.status !== 'approved') {
      throw new Error('Must complete intermediate KYC first');
    }

    // Update KYC record
    const [kyc] = await db.update(kycVerifications)
      .set({
        tier: 'advanced',
        status: 'pending',
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        proofOfAddressType: data.proofOfAddressType,
        proofOfAddressUrl: data.proofOfAddressUrl,
        addressVerificationStatus: 'pending',
        dailyLimit: KYC_TIERS.advanced.dailyLimit,
        monthlyLimit: KYC_TIERS.advanced.monthlyLimit,
        annualLimit: KYC_TIERS.advanced.annualLimit,
        submittedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(kycVerifications.userId, userId))
      .returning();

    await this.logComplianceEvent(userId, 'kyc_submitted', { tier: 'advanced' });

    return kyc;
  }

  private async verifyIdentityDocument(userId: string, data: any) {
    // Try Jumio first, fallback to Onfido
    if (this.jumioConfig.enabled) {
      return this.verifyWithJumio(userId, data);
    } else if (this.onfidoConfig.enabled) {
      return this.verifyWithOnfido(userId, data);
    } else {
      // Manual verification fallback
      return {
        provider: 'manual',
        status: 'pending_manual_review',
        reference: `MANUAL-${Date.now()}`,
        data: { message: 'Queued for manual review' }
      };
    }
  }

  private async verifyWithJumio(userId: string, data: any) {
    try {
      const auth = Buffer.from(`${this.jumioConfig.apiToken}:${this.jumioConfig.apiSecret}`).toString('base64');

      const response = await fetch(`${this.jumioConfig.baseUrl}/initiateNetverify`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'MtaaDAO/1.0'
        },
        body: JSON.stringify({
          customerInternalReference: userId,
          userReference: userId,
          successUrl: `${process.env.APP_URL}/kyc/success`,
          errorUrl: `${process.env.APP_URL}/kyc/error`,
          callbackUrl: `${process.env.APP_URL}/api/kyc/jumio/callback`
        })
      });

      const result = await response.json();

      return {
        provider: 'jumio',
        status: 'pending',
        reference: result.transactionReference || result.scanReference,
        data: result
      };
    } catch (error: any) {
      console.error('Jumio verification failed:', error);
      return {
        provider: 'jumio',
        status: 'error',
        reference: `ERROR-${Date.now()}`,
        data: { error: error.message }
      };
    }
  }

  private async verifyWithOnfido(userId: string, data: any) {
    try {
      // Create applicant
      const applicantResponse = await fetch(`${this.onfidoConfig.baseUrl}/applicants`, {
        method: 'POST',
        headers: {
          'Authorization': `Token token=${this.onfidoConfig.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email
        })
      });

      const applicant = await applicantResponse.json();

      // Create SDK token
      const sdkTokenResponse = await fetch(`${this.onfidoConfig.baseUrl}/sdk_token`, {
        method: 'POST',
        headers: {
          'Authorization': `Token token=${this.onfidoConfig.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          applicant_id: applicant.id,
          referrer: `${process.env.APP_URL}/*`
        })
      });

      const sdkToken = await sdkTokenResponse.json();

      return {
        provider: 'onfido',
        status: 'pending',
        reference: applicant.id,
        data: { applicantId: applicant.id, sdkToken: sdkToken.token }
      };
    } catch (error: any) {
      console.error('Onfido verification failed:', error);
      return {
        provider: 'onfido',
        status: 'error',
        reference: `ERROR-${Date.now()}`,
        data: { error: error.message }
      };
    }
  }

  async performAMLScreening(userId: string, walletAddress: string) {
    if (!this.chainalysisConfig.enabled) {
      return {
        status: 'skipped',
        message: 'AML screening not configured'
      };
    }

    try {
      const response = await fetch(`${this.chainalysisConfig.baseUrl}/v2/entities/${walletAddress}`, {
        headers: {
          'Token': this.chainalysisConfig.apiKey,
          'Accept': 'application/json'
        }
      });

      const result = await response.json();

      const riskLevel = this.evaluateAMLRisk(result);

      // Update KYC record
      await db.update(kycVerifications)
        .set({
          amlScreeningStatus: riskLevel,
          amlScreeningProvider: 'chainalysis',
          amlScreeningReference: result.entityId || walletAddress,
          amlScreeningData: result,
          updatedAt: new Date()
        })
        .where(eq(kycVerifications.userId, userId));

      // Log if flagged
      if (riskLevel === 'flagged' || riskLevel === 'high_risk') {
        await this.logComplianceEvent(userId, 'aml_flagged', { walletAddress, riskLevel, result }, 'warning');
      }

      return {
        status: riskLevel,
        provider: 'chainalysis',
        data: result
      };
    } catch (error: any) {
      console.error('AML screening failed:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  private evaluateAMLRisk(amlData: any): string {
    // Simplified risk evaluation
    if (amlData.risk === 'high' || amlData.category === 'sanctions') {
      return 'high_risk';
    }
    if (amlData.risk === 'medium' || amlData.directExposure) {
      return 'flagged';
    }
    return 'clear';
  }

  async approveKYC(userId: string, reviewerId: string, notes?: string) {
    const kyc = await this.getUserKYC(userId);

    if (!kyc) {
      throw new Error('No KYC submission found');
    }

    const [updated] = await db.update(kycVerifications)
      .set({
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        notes,
        updatedAt: new Date()
      })
      .where(eq(kycVerifications.userId, userId))
      .returning();

    // Update user verification level
    await db.update(users)
      .set({ verificationLevel: kyc.tier })
      .where(eq(users.id, userId));

    await this.logComplianceEvent(userId, 'kyc_approved', { tier: kyc.tier, reviewerId });

    return updated;
  }

  async rejectKYC(userId: string, reviewerId: string, reason: string) {
    const [updated] = await db.update(kycVerifications)
      .set({
        status: 'rejected',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date()
      })
      .where(eq(kycVerifications.userId, userId))
      .returning();

    await this.logComplianceEvent(userId, 'kyc_rejected', { reason, reviewerId });

    return updated;
  }

  async flagSuspiciousActivity(userId: string, activityType: string, description: string, severity: string, metadata: any) {
    const [activity] = await db.insert(suspiciousActivities).values({
      userId,
      activityType,
      description,
      severity,
      status: 'pending',
      detectedBy: 'automated',
      detectionRules: metadata
    }).returning();

    await this.logComplianceEvent(userId, 'suspicious_activity_detected', { activityType, severity }, 'critical');

    return activity;
  }

  private async logComplianceEvent(userId: string, eventType: string, eventData: any, severity: string = 'info') {
    await db.insert(complianceAuditLogs).values({
      userId,
      eventType,
      eventData,
      severity
    });
  }
}

export const kycService = new KYCService();
