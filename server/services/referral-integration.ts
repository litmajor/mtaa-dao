/**
 * Referral Integration Service
 * Bridges escrow system with existing referral tracking service
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface ReferralData {
  referrerId: string;
  refereeId: string;
  source: 'escrow_invite' | 'direct_signup' | 'promotional';
  escrowId?: string;
  metadata?: Record<string, any>;
}

/**
 * Register a referral (called when user accepts escrow invite)
 */
export async function registerEscrowReferral(
  referrerId: string,
  refereeId: string,
  escrowId: string
): Promise<any> {
  try {
    // Call existing referral service API
    const referralService = process.env.REFERRAL_SERVICE_URL || 'http://localhost:3001';
    
    const response = await fetch(`${referralService}/api/referrals/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REFERRAL_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        referrerId,
        refereeId,
        source: 'escrow_invite',
        escrowId,
        metadata: {
          invitationType: 'escrow_payment',
          timestamp: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Referral service error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Referral registered: ${referrerId} -> ${refereeId}`);
    return result;
  } catch (error) {
    console.error('Error registering referral:', error);
    throw error;
  }
}

/**
 * Check if user has earned referral tokens
 */
export async function checkReferralTokens(userId: string): Promise<any> {
  try {
    const referralService = process.env.REFERRAL_SERVICE_URL || 'http://localhost:3001';
    
    const response = await fetch(
      `${referralService}/api/referrals/tokens/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.REFERRAL_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Referral service error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking referral tokens:', error);
    return null;
  }
}

/**
 * Get referral stats for a user
 */
export async function getReferralStats(userId: string): Promise<any> {
  try {
    const referralService = process.env.REFERRAL_SERVICE_URL || 'http://localhost:3001';
    
    const response = await fetch(
      `${referralService}/api/referrals/stats/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.REFERRAL_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Referral service error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting referral stats:', error);
    return null;
  }
}

/**
 * Track escrow referral in local database
 */
export async function trackEscrowReferral(
  referrerId: string,
  refereeId: string,
  escrowId: string
): Promise<any> {
  try {
    // Store in local database for historical tracking
    const result = await (db as any).execute(sql`
      INSERT INTO escrow_referrals (referrer_id, referee_id, escrow_id, created_at)
      VALUES (${referrerId}, ${refereeId}, ${escrowId}, NOW())
      RETURNING *
    `);

    return result.rows?.[0] || null;
  } catch (error) {
    console.error('Error tracking escrow referral:', error);
    return null;
  }
}

/**
 * Get all referrals from escrows for a user
 */
export async function getEscrowReferrals(userId: string): Promise<any[]> {
  try {
    const result = await (db as any).execute(sql`
      SELECT 
        er.*,
        u.username as referee_username,
        u.email as referee_email,
        ea.amount,
        ea.currency,
        ea.status as escrow_status
      FROM escrow_referrals er
      JOIN users u ON u.id = er.referee_id
      JOIN escrow_accounts ea ON ea.id = er.escrow_id
      WHERE er.referrer_id = ${userId}
      ORDER BY er.created_at DESC
    `);

    return result.rows || [];
  } catch (error) {
    console.error('Error getting escrow referrals:', error);
    return [];
  }
}

/**
 * Calculate referral conversion metrics
 */
export async function getConversionMetrics(userId: string): Promise<any> {
  try {
    const result = await (db as any).execute(sql`
      SELECT 
        COUNT(*) as total_referrals,
        SUM(CASE WHEN escrow_status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN escrow_status = 'funded' THEN 1 ELSE 0 END) as funded,
        SUM(CASE WHEN escrow_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN escrow_status = 'disputed' THEN 1 ELSE 0 END) as disputed,
        AVG(CAST(amount AS FLOAT)) as average_escrow_amount
      FROM (
        SELECT 
          er.referrer_id,
          ea.status as escrow_status,
          ea.amount
        FROM escrow_referrals er
        JOIN escrow_accounts ea ON ea.id = er.escrow_id
        WHERE er.referrer_id = ${userId}
      ) subquery
    `);

    return result.rows?.[0] || null;
  } catch (error) {
    console.error('Error calculating conversion metrics:', error);
    return null;
  }
}
