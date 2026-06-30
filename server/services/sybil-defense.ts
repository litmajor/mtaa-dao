/**
 * Multi-Layer Sybil Defense System
 * Purpose: Prevent trivial bot farming of referral rewards
 * Priority: HIGH (deploy within week 2)
 * 
 * Implements 5 gates:
 * 1. 3-day account age minimum
 * 2. SMS phone verification
 * 3. Phone/email uniqueness per referrer
 * 4. IP diversity + datacenter detection
 * 5. Minimum transaction activity
 * 
 * + Real-time anomaly detection for referrer patterns
 */

import { db } from '../db';
import { users } from '../../shared/schema';
import { sql, eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface VerificationGates {
  accountAge: boolean;
  phoneVerified: boolean;
  phoneUniqueness: boolean;
  ipDiversity: boolean;
  minimumActivity: boolean;
}

export interface SybilRiskAssessment {
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  recommendedAction: 'approve' | 'approve_with_monitoring' | 'suspend' | 'manual_review';
}

// ============================================
// GATE 1: Account Age Verification
// ============================================

export const enforceAccountAgeGate = async (
  userId: string,
  minimumAgeHours: number = 72
): Promise<{ passed: boolean; ageHours: number }> => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      return { passed: false, ageHours: 0 };
    }

    if (!user.createdAt) {
      return { passed: false, ageHours: 0 };
    }

    const createdAt = new Date(user.createdAt);
    const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    return {
      passed: ageHours >= minimumAgeHours,
      ageHours
    };
  } catch (err) {
    logger.error('Account age gate check failed', { userId, error: err });
    return { passed: false, ageHours: 0 };
  }
};

// ============================================
// GATE 2: Phone Verification
// ============================================

export const enforcePhoneVerificationGate = async (
  userId: string
): Promise<{ passed: boolean; phoneVerified: boolean; verifiedAt?: Date }> => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      return { passed: false, phoneVerified: false }; // ensures that non-existent users fail this gate
    }

    // Check if phone is verified 
    const phoneVerified = !!(user as any).phoneVerified;
    const verifiedAt = (user as any).phoneVerifiedAt;

    return {
      passed: phoneVerified === true,
      phoneVerified,
      verifiedAt: verifiedAt ? new Date(verifiedAt) : undefined // Include timestamp for monitoring purposes
    };
  } catch (err) {
    logger.error('Phone verification gate check failed', { userId, error: err });
    return { passed: false, phoneVerified: false };
  }
};

// ============================================
// GATE 3: Phone & Email Uniqueness Per Referrer
// ============================================

export const enforcePhoneUniquenessPerReferrer = async (
  referrerId: string,
  newUserId: string,
  maxPhonePerReferrer: number = 3, // Allow some flexibility for shared phones but still catch mass referrals from same number
  maxEmailDomainPerReferrer: number = 3 // Allow some flexibility for shared domains but still catch mass referrals from same domain
): Promise<{
  passed: boolean;
  phoneCount: number;
  emailDomainCount: number;
  violations: string[];
}> => {
  try {
    const newUser = await db.query.users.findFirst({
      where: eq(users.id, newUserId)
    });

    if (!newUser) {
      return { passed: false, phoneCount: 0, emailDomainCount: 0, violations: ['User not found'] };
    }

    const violations: string[] = [];

    // Check phone number uniqueness
    let phoneCount = 0;
    if (newUser.phone) {
      const phoneResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM users u2
        JOIN referrals r ON u2.id = r."referredUserId"
        WHERE r."referrerId" = ${referrerId}
          AND u2.phone = ${newUser.phone}
          AND u2.id != ${newUserId}  -- Exclude self
      `);

      phoneCount = parseInt((phoneResult.rows[0] as any).count || 0);
      if (phoneCount >= maxPhonePerReferrer) {
        violations.push(
          `Too many referrals from same phone (${phoneCount}/${maxPhonePerReferrer})`
        );
      }
    }

    // Check email domain uniqueness
    let emailDomainCount = 0;
    if (newUser.email) {
      const emailDomain = newUser.email.split('@')[1]; // Get the domain part of the email
      const emailResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM users u2
        JOIN referrals r ON u2.id = r."referredUserId"
        WHERE r."referrerId" = ${referrerId}
          AND u2.email LIKE ${'%@' + emailDomain}
          AND u2.id != ${newUserId}
      `);

      emailDomainCount = parseInt((emailResult.rows[0] as any).count || 0);
      if (emailDomainCount >= maxEmailDomainPerReferrer) {
        violations.push(
          `Too many referrals from same email domain (${emailDomainCount}/${maxEmailDomainPerReferrer})`
        );
      }
    }

    return {
      passed: violations.length === 0,
      phoneCount,
      emailDomainCount,
      violations
    };
  } catch (err) {
    logger.error('Phone uniqueness gate check failed', { referrerId, newUserId, error: err });
    return { passed: false, phoneCount: 0, emailDomainCount: 0, violations: ['Check failed'] };
  }
};

// ============================================
// GATE 4: IP Address Diversity + Datacenter Detection
// ============================================

/**
 * Check if IP address is from a suspicious datacenter/VPN
 * Returns reputation score (0-100, higher = better)
 */
export const checkIPReputation = async (
  ipAddress: string
): Promise<{ score: number; isSuspicious: boolean; reason?: string }> => {
  // TODO: Integrate with IP reputation service (AbuseIPDB, MaxMind, etc.)
  // For now, basic datacenter detection

  const suspiciousPatterns = [
    /^34\.64\.|^35\.184\.|^35\.185\.|^35\.190\./,        // Google Cloud
    /^52\.|^54\./,                                         // AWS
    /^40\.6[5-9]\.|^40\.7[0-9]\./,                         // Azure
    /^207\.246\./,                                         // Linode
    /^23\.92\.|^23\.111\./,                                // Akamai
    /^8\.8\./,                                             // VPN/Proxy known pools
  ]; //The why is that these patterns match IP ranges commonly associated with datacenters and VPN providers. By flagging IPs that fall within these ranges, we can identify potential sources of fraudulent activity where users might be creating multiple accounts from the same location to abuse referral rewards.

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(ipAddress)) {
      return {
        score: 20,
        isSuspicious: true,
        reason: 'Datacenter/VPN IP detected'
      };
    }
  }

  return { score: 80, isSuspicious: false };
};

export const enforceIPDiversityGate = async (
  referrerId: string,
  newUserIpAddress: string,
  maxFromSameIP: number = 5
): Promise<{
  passed: boolean;
  sameIpCount: number;
  ipReputation: { score: number; isSuspicious: boolean };
  violations: string[];
}> => {
  try {
    const violations: string[] = [];
    let sameIpCount = 0;

    // Check how many referrals from SAME IP
    if (newUserIpAddress) {
      const ipResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM referral_signup_context rsc
        JOIN referrals r ON rsc.referral_id = r.id
        WHERE r."referrerId" = ${referrerId}
          AND rsc.signup_ip_address = ${newUserIpAddress}
      `);

      sameIpCount = parseInt((ipResult.rows[0] as any).count || 0);
      if (sameIpCount >= maxFromSameIP) {
        violations.push(
          `Too many referrals from same IP: ${sameIpCount}/${maxFromSameIP}`
        );
      }
    }

    // Check IP reputation
    const ipReputation = await checkIPReputation(newUserIpAddress);
    if (ipReputation.isSuspicious) {
      violations.push(`Suspicious IP: ${ipReputation.reason}`);
    }

    return {
      passed: violations.length === 0,
      sameIpCount,
      ipReputation,
      violations
    };
  } catch (err) {
    logger.error('IP diversity gate check failed', { referrerId, error: err });
    return {
      passed: false,
      sameIpCount: 0,
      ipReputation: { score: 0, isSuspicious: true },
      violations: ['Check failed']
    };
  }
};

// ============================================
// GATE 5: Minimum Transaction Activity
// ============================================

export const enforceMinimumActivityGate = async (
  userId: string,
  minimumScore: number = 1
): Promise<{
  passed: boolean;
  activityScore: number;
  breakdown: { transactions: number; votes: number; comments: number; govToken: boolean };
}> => {
  try {
    // Check transactions (original metric)
    const txResult = await db.execute(sql`
      SELECT COUNT(*) as tx_count
      FROM wallet_transactions
      WHERE ("toUserId" = ${userId} OR "fromUserId" = ${userId})
    `);
    const txCount = parseInt((txResult.rows[0] as any).tx_count || 0);

    // Check governance participation (Okedi-native)
    const voteResult = await db.execute(sql`
      SELECT COUNT(*) as vote_count
      FROM proposal_votes
      WHERE user_id = ${userId}
    `).catch(() => ({ rows: [{ vote_count: 0 }] })); // Graceful fallback if table doesn't exist
    const voteCount = parseInt((voteResult.rows[0] as any).vote_count || 0);

    // Check DAO comments  
    const commentResult = await db.execute(sql`
      SELECT COUNT(*) as comment_count
      FROM dao_comments
      WHERE user_id = ${userId}
    `).catch(() => ({ rows: [{ comment_count: 0 }] }));
    const commentCount = parseInt((commentResult.rows[0] as any).comment_count || 0);

    // Check governance activity in DAO (voting)
    // Governance tokens check would go here if schema supports it
    const hasGovToken = voteCount > 0; // If they voted, they likely have token engagement

    // Activity scoring: any legitimate action counts
    // Transactions: 1 point, Votes: 1 point, Comments (2+): 0.5 points, Gov participation: 0.5 points
    const isActive = txCount >= 1 || voteCount >= 1 || commentCount >= 2 || hasGovToken;
    const activityScore = Math.min(
      3,
      (txCount > 0 ? 1 : 0) +
      (voteCount > 0 ? 1 : 0) +
      (commentCount >= 2 ? 0.5 : 0) +
      (hasGovToken ? 0.5 : 0)
    );

    return {
      passed: isActive && activityScore >= minimumScore,
      activityScore,
      breakdown: { transactions: txCount, votes: voteCount, comments: commentCount, govToken: hasGovToken }
    };
  } catch (err) {
    logger.error('Activity gate check failed', { userId, error: err });
    return {
      passed: false,
      activityScore: 0,
      breakdown: { transactions: 0, votes: 0, comments: 0, govToken: false }
    };
  }
};

// ============================================
// COMPOSITE: Run All Gates
// ============================================

export const runAllVerificationGates = async (
  referrerId: string,
  newUserId: string,
  signupContext: {
    ipAddress: string;
    userAgent?: string;
  }
): Promise<{
  allPassed: boolean;
  results: VerificationGates;
  failedGates: string[];
}> => {
  logger.info('Running verification gates', { referrerId, newUserId });

  const [accountAge, phoneVerif, phoneUniq, ipDiversity, activity] = await Promise.all([
    enforceAccountAgeGate(newUserId),
    enforcePhoneVerificationGate(newUserId),
    enforcePhoneUniquenessPerReferrer(referrerId, newUserId),
    enforceIPDiversityGate(referrerId, signupContext.ipAddress),
    enforceMinimumActivityGate(newUserId)
  ]);

  const results: VerificationGates = {
    accountAge: accountAge.passed,
    phoneVerified: phoneVerif.passed,
    phoneUniqueness: phoneUniq.passed,
    ipDiversity: ipDiversity.passed,
    minimumActivity: activity.passed
  };

  const failedGates = Object.entries(results)
    .filter(([_, passed]) => !passed)
    .map(([gate]) => gate);

  const allPassed = failedGates.length === 0;

  logger.info('Gate verification complete', {
    referrerId,
    newUserId,
    allPassed,
    results,
    failedGates
  });

  return { allPassed, results, failedGates };
};

// ============================================
// ANOMALY DETECTION: Referrer Pattern Analysis
// ============================================

export const detectReferrerAnomalies = async (
  referrerId: string,
  timeWindowHours: number = 24
): Promise<SybilRiskAssessment> => {
  try {
    // Collect referrer statistics
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_referrals,
        COUNT(CASE WHEN r.is_active = true THEN 1 END) as active_referrals,
        COUNT(DISTINCT SUBSTRING(u.email FROM '@(.*)')) as unique_email_domains,
        COUNT(DISTINCT u.phone) as unique_phones,
        COUNT(CASE WHEN r.created_at > NOW() - INTERVAL '${timeWindowHours} hours' THEN 1 END) as referrals_recent,
        MIN(u.created_at) as oldest_referral_age,
        MAX(u.created_at) as newest_referral_age
      FROM referrals r
      JOIN users u ON r.referred_user_id = u.id
      WHERE r.referrer_id = ${referrerId}
    `);

    const stats = statsResult.rows[0] as any;
    const flags: string[] = [];
    let riskScore = 0;

    // FLAG 1: High referral velocity
    if (stats.referrals_recent > 50) {
      flags.push('HIGH_VOLUME_RECENT');
      riskScore += 25;
    }

    // FLAG 2: Single email domain
    if (stats.unique_email_domains === 1 && stats.total_referrals > 3) {
      flags.push('SINGLE_EMAIL_DOMAIN');
      riskScore += 30;
    }

    // FLAG 3: All from same geographic area (limited phone area codes)
    if (stats.unique_phones && stats.total_referrals > 10) {
      const phoneAreaCodeResult = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT SUBSTRING(u.phone FROM 1 FOR 3)) as unique_area_codes
        FROM referrals r
        JOIN users u ON r.referred_user_id = u.id
        WHERE r.referrer_id = ${referrerId}
          AND u.phone IS NOT NULL
      `);

      const uniqueAreaCodes = parseInt((phoneAreaCodeResult.rows[0] as any).unique_area_codes || 1);
      if (uniqueAreaCodes <= 2 && stats.total_referrals > 10) {
        flags.push('LIMITED_GEOGRAPHIC_DIVERSITY');
        riskScore += 20;
      }
    }

    // FLAG 4: Suspicious IP pattern (all from same IP)
    const ipResult = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT rsc.signup_ip_address) as unique_ips,
        COUNT(*) as total
      FROM referral_signup_context rsc
      JOIN referrals r ON rsc.referral_id = r.id
      WHERE r.referrer_id = ${referrerId}
    `);

    const ipStats = ipResult.rows[0] as any;
    if (ipStats.unique_ips === 1 && ipStats.total > 3) {
      flags.push('SINGLE_IP_ADDRESS');
      riskScore += 35;
    }

    // FLAG 5: Unusual referral timing (all created within hours)
    const timingResult = await db.execute(sql`
      SELECT
        EXTRACT(EPOCH FROM (MAX(r.created_at) - MIN(r.created_at))) / 3600 as age_range_hours,
        COUNT(*) as total
      FROM referrals r
      WHERE r.referrer_id = ${referrerId}
        AND r.created_at > NOW() - INTERVAL '${timeWindowHours} hours'
    `);

    const timingStats = timingResult.rows[0] as any;
    if (timingStats.age_range_hours < 1 && timingStats.total > 5) {
      flags.push('BURST_CREATION_PATTERN');
      riskScore += 30;
    }

    // Determine risk level and action
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    let recommendedAction: 'approve' | 'approve_with_monitoring' | 'suspend' | 'manual_review';

    if (riskScore >= 80) {
      riskLevel = 'critical';
      recommendedAction = 'suspend';
    } else if (riskScore >= 60) {
      riskLevel = 'high';
      recommendedAction = 'manual_review';
    } else if (riskScore >= 40) {
      riskLevel = 'medium';
      recommendedAction = 'approve_with_monitoring';
    } else {
      riskLevel = 'low';
      recommendedAction = 'approve';
    }

    const assessment: SybilRiskAssessment = {
      riskScore,
      riskLevel,
      flags,
      recommendedAction
    };

    // Log and alert if suspicious
    if (riskLevel !== 'low') {
      logger.warn('Referrer anomaly detected', {
        referrerId,
        assessment,
        stats
      });

      if (riskLevel === 'critical' || riskLevel === 'high') {
        // Admin alert deferred to Phase 2
        // await sendAdminAlert(
        //   `⚠️ SYBIL ALERT: Referrer ${referrerId}\n` +
        //   `Risk Score: ${riskScore}/100 (${riskLevel})\n` +
        //   `Flags: ${flags.join(', ')}\n` +
        //   `Action: ${recommendedAction}`
        // );
        logger.warn('High sybil risk detected', { referrerId, riskScore, riskLevel, flags });
      }
    }

    return assessment;
  } catch (err) {
    logger.error('Anomaly detection failed', { referrerId, error: err });

    return {
      riskScore: 0,
      riskLevel: 'low',
      flags: ['DETECTION_ERROR'],
      recommendedAction: 'approve'
    };
  }
};

// ============================================
// MAIN: Create Referral with Full Verification
// ============================================

export const createReferralWithFullVerification = async (
  referrerId: string,
  referredUserId: string,
  signupContext: {
    ipAddress: string;
    country?: string;
    deviceFingerprint?: string;
    userAgent?: string;
  }
): Promise<{
  created: boolean;
  isActive: boolean;
  verification: {
    gateResults: VerificationGates;
    failedGates: string[];
  };
  referrerRisk?: SybilRiskAssessment;
  message: string;
}> => {
  logger.info('Creating referral with verification', {
    referrerId,
    referredUserId,
    signupContext
  });

  try {
    // Step 1: Run all verification gates
    const gateVerification = await runAllVerificationGates(
      referrerId,
      referredUserId,
      signupContext
    );

    // Step 2: Analyze referrer for sybil patterns
    const referrerRisk = await detectReferrerAnomalies(referrerId);

    // Step 3: Determine if referral should be active
    const isActive = gateVerification.allPassed && referrerRisk.riskLevel !== 'critical';

    // Note: Referral record storage is handled by referral_service.ts
    // This verification layer only checks eligibility and returns results
    const referralId = `verified_${Date.now()}_${referrerId}`;

    // Step 4: Handle suspension if needed
    if (referrerRisk.recommendedAction === 'suspend') {
      logger.warn('Referrer payouts suspended due to sybil risk', {
        referrerId,
        riskScore: referrerRisk.riskScore
      });

      // Suspend pending payouts for this referrer
      await db.execute(sql`
        UPDATE referral_rewards
        SET status = 'pending_review',
            metadata = jsonb_set(
              metadata,
              '{suspension_reason}',
              '"Sybil risk detected"'::jsonb
            )
        WHERE user_id = ${referrerId}
          AND status = 'pending'
      `);

      // Admin alert deferred to Phase 2
      // await sendAdminAlert(
      //   `🚨 SYBIL SUSPENSION: Referrer ${referrerId} suspended. ` +
      //   `Risk: ${referrerRisk.riskScore}/100. Manual review required.`
      // );
      logger.error('Referrer suspended due to sybil risk', { referrerId, riskScore: referrerRisk.riskScore });
    }

    return {
      created: true,
      isActive,
      verification: {
        gateResults: gateVerification.results,
        failedGates: gateVerification.failedGates
      },
      referrerRisk,
      message: isActive
        ? 'Referral created and activated'
        : `Referral created but inactive (failed: ${gateVerification.failedGates.join(', ')})`
    };
  } catch (err) {
    logger.error('Referral creation failed', {
      referrerId,
      referredUserId,
      error: err
    });

    throw err;
  }
};

export default {
  enforceAccountAgeGate,
  enforcePhoneVerificationGate,
  enforcePhoneUniquenessPerReferrer,
  enforceIPDiversityGate,
  enforceMinimumActivityGate,
  runAllVerificationGates,
  detectReferrerAnomalies,
  createReferralWithFullVerification
};
