/**
 * Initialize User Accounts Migration
 * Creates default multi-account structure for all existing users
 * Runs once during deployment
 */

import { fileURLToPath } from 'url';
import { db } from '../db';
import { users, accounts } from '../../shared/schema';
import { accounts as accountsTable } from '../../shared/accountSchema';
import { sql } from 'drizzle-orm';

const ACCOUNT_TYPES = ['wallet', 'trading', 'vault', 'escrow'];
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
    for (const row of usersWithoutAccounts.rows) {
      const userId = row.id;

      // Create all 4 account types for this user
      for (const accountType of ACCOUNT_TYPES) {
        try {
          await db.insert(accountsTable).values({
            userId,
            accountType,
            balance: '0',
            currency: CURRENCY,
            status: 'active',
            locked: '0',
          });

          createdCount++;
        } catch (error) {
          console.error(`❌ Error creating ${accountType} account for user ${userId}:`, error);
        }
      }
    }

    console.log(`✅ Successfully created ${createdCount} accounts`);
    console.log(`📈 Initialized ${createdCount / ACCOUNT_TYPES.length} users with multi-account structure`);

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

// Run migration if this file is executed directly
const __filename = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] === __filename;

if (isDirectExecution) {
  initializeUserAccounts()
    .then(async () => {
      const summary = await getAccountInitializationSummary();
      console.log('\n📋 Account Initialization Summary:');
      console.log(`   Total Users with Accounts: ${summary.usersWithAccounts}`);
      console.log('   Accounts by Type:');
      summary.accountsByType.forEach((row: any) => {
        console.log(`     - ${row.account_type}: ${row.count}`);
      });
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default initializeUserAccounts;
