import { pgTable, text, uuid, timestamp, integer, index } from 'drizzle-orm/pg-core';

/**
 * Blind encrypted keystore backup. The server has zero ability to decrypt
 * this — it never sees the passphrase, never derives a key, never runs
 * scrypt. Its only job is: accept an opaque blob, store it, hand it back to
 * the owning user on request. This table is the entire basis for the
 * "we are a storage host, not a custodian" argument — treat every column
 * here as evidence that could be inspected, and keep it that way.
 */
export const walletVaultBackups = pgTable(
  'wallet_vault_backups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletId: uuid('wallet_id').notNull(), // FK to wallets.id
    userId: text('user_id').notNull(),

    // The full Web3 Secret Storage JSON keystore, stored as-is. Never parsed
    // for content beyond structural validation (see walletVaultService.ts) —
    // structural validation checks shape, not correctness of the ciphertext.
    encryptedBlob: text('encrypted_blob').notNull(),

    // Web3 Secret Storage format version (currently always 3). Stored
    // separately so a future ethers/keystore format change doesn't require
    // parsing old blobs to find out what they are.
    keystoreVersion: integer('keystore_version').notNull().default(3),

    // Address is duplicated here (also on `wallets`) purely so a retrieval
    // response can be sanity-checked against the wallet row without a join,
    // and so corruption is detectable (mismatched address = bad backup).
    address: text('address').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    walletIdIdx: index('idx_vault_backup_wallet').on(table.walletId),
    userIdIdx: index('idx_vault_backup_user').on(table.userId),
  })
);

/**
 * Every retrieval of a vault backup is logged. Not optional — this table is
 * what you'd show a regulator or an internal security review to demonstrate
 * exactly who accessed what, when. Retrieval is rare (only happens on
 * IndexedDB loss / new device), so this is cheap and high-value.
 */
export const walletVaultAccessLogs = pgTable(
  'wallet_vault_access_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletId: uuid('wallet_id').notNull(),
    userId: text('user_id').notNull(),
    action: text('action').notNull(), // 'backup_created' | 'backup_retrieved' | 'backup_retrieval_denied'
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    walletIdIdx: index('idx_vault_log_wallet').on(table.walletId),
    userIdIdx: index('idx_vault_log_user').on(table.userId),
  })
);

export type WalletVaultBackup = typeof walletVaultBackups.$inferSelect;
export type InsertWalletVaultBackup = typeof walletVaultBackups.$inferInsert;