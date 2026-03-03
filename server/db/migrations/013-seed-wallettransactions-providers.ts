import { sql } from 'drizzle-orm';

/**
 * Migration: Seed provider field in walletTransactions.metadata
 *
 * Older transactions did not record the payment provider; add a default
 * "unknown" value so queries that filter on metadata->>provider behave
 * consistently.  New transactions should set this field explicitly in
 * application logic when the wallet event is created.
 */
export async function up(db: any) {
  await db.execute(sql`
    UPDATE wallet_transactions
    SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{provider}', '"unknown"')
    WHERE COALESCE(metadata->>'provider', '') = '';
  `);
}

export async function down(db: any) {
  // Remove provider key from any rows we touched during up()
  await db.execute(sql`
    UPDATE wallet_transactions
    SET metadata = metadata - 'provider'
    WHERE metadata ? 'provider';
  `);
}
