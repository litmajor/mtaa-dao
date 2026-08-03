/**
 * Initialize User Accounts Migration
 * Creates default multi-account structure for all existing users
 * Runs once during deployment
 */

import { db } from '../db';
import { accounts as accountsTable, ACCOUNT_TYPES, ACCOUNT_STATUSES, type AccountType, type AccountStatus } from '../../shared/accountSchema';
import { sql } from 'drizzle-orm';

const CURRENCY = 'USDC';

/**
 * Initialize accounts for all users
 * Creates 4 default accounts per user: wallet, trading, vault, escrow
 */
export async function initializeUserAccounts() {
  console.log('🚀 Starting user accounts initialization...');

  try {
    // Get all users that don't have accounts yet
    const usersWithoutAccounts = await db.execute(
      sql`
        SELECT u.id 
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id
        WHERE a.id IS NULL
        GROUP BY u.id
      `
    );

    console.log(`📊 Found ${usersWithoutAccounts.rows.length} users without accounts`);

    if (usersWithoutAccounts.rows.length === 0) {
      console.log('✅ All users already have accounts initialized');
      return;
    }

    let createdCount = 0;

    // For each user, create 4 default accounts
    const accountTypeValues = Object.values(ACCOUNT_TYPES) as AccountType[];

    for (const row of usersWithoutAccounts.rows) {
      const userId = String(row.id);

      // Create all 4 account types for this user
      for (const accountType of accountTypeValues) {
        try {
          await db.insert(accountsTable).values({
            userId,
            accountType,
            balance: '0',
            currency: CURRENCY,
            status: ACCOUNT_STATUSES.ACTIVE,
            locked: '0',
          });

          createdCount++;
        } catch (error) {
          console.error(`❌ Error creating ${accountType} account for user ${userId}:`, error);
        }
      }
    }

    console.log(`✅ Successfully created ${createdCount} accounts`);
    console.log(`📈 Initialized ${createdCount / accountTypeValues.length} users with multi-account structure`);

  } catch (error) {
    console.error('❌ Error during account initialization:', error);
    throw error;
  }
}

/**
 * Get summary of account initialization
 */
export async function getAccountInitializationSummary() {
  try {
    const userCount = await db.execute(
      sql`SELECT COUNT(DISTINCT user_id) as total FROM accounts`
    );

    const accountStats = await db.execute(
      sql`
        SELECT account_type, COUNT(*) as count 
        FROM accounts 
        GROUP BY account_type
        ORDER BY account_type
      `
    );

    return {
      usersWithAccounts: userCount.rows[0]?.total || 0,
      accountsByType: accountStats.rows,
    };
  } catch (error) {
    console.error('Error getting account summary:', error);
    throw error;
  }
}

export default initializeUserAccounts;
