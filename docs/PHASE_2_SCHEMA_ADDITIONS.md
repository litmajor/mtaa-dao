/**
 * SCHEMA ADDITIONS FOR PHASE 2: TREASURY CONTROLS
 * 
 * Add these tables to shared/schema.ts:
 * 
 * 1. treasury_whitelist - Whitelisted recipients by address and category
 * 2. treasury_limits - Per-DAO transfer limits (daily cap, single max, multisig threshold)
 * 3. treasury_approvals - Pending multisig approvals for large transfers
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE 1: Treasury Whitelist
// ═══════════════════════════════════════════════════════════════════════════════

export const treasuryWhitelist = pgTable("treasury_whitelist", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  walletAddress: varchar("wallet_address").notNull(),
  recipientName: varchar("recipient_name"),
  category: varchar("category").notNull(), // 'charity', 'payments', 'team', 'disbursements', 'other'
  requestedBy: varchar("requested_by").references(() => users.id).notNull(),
  approvedBy: varchar("approved_by").references(() => users.id), // NULL = pending
  isApproved: boolean("is_approved").default(false),
  approvalReason: text("approval_reason"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  expiresAt: timestamp("expires_at"), // Optional expiration
});

export type TreasuryWhitelist = typeof treasuryWhitelist.$inferSelect;
export type InsertTreasuryWhitelist = typeof treasuryWhitelist.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE 2: Treasury Limits (Per-DAO Configuration)
// ═══════════════════════════════════════════════════════════════════════════════

export const treasuryLimits = pgTable("treasury_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).unique().notNull(),
  // Amount limits
  dailyCapPercentage: decimal("daily_cap_percentage", { precision: 5, scale: 2 }).default("10"), // % of treasury, e.g., 10.00
  singleTransferMaxPercentage: decimal("single_transfer_max_percentage", { precision: 5, scale: 2 }).default("5"), // % of treasury
  // Multisig requirements
  multisigThresholdUSD: decimal("multisig_threshold_usd", { precision: 18, scale: 2 }).default("10000"), // USD amount
  multisigRequiredSignatures: integer("multisig_required_signatures").default(2), // e.g., 2 of 3
  // Admin settings
  whitelistRequired: boolean("whitelist_required").default(true), // Require recipients on whitelist
  approvalRequired: boolean("approval_required").default(true), // Require admin approval for new recipients
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TreasuryLimits = typeof treasuryLimits.$inferSelect;
export type InsertTreasuryLimits = typeof treasuryLimits.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE 3: Treasury Approvals (Multisig Signatures for Large Transfers)
// ═══════════════════════════════════════════════════════════════════════════════

export const treasuryApprovals = pgTable("treasury_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  transferAmount: decimal("transfer_amount", { precision: 18, scale: 2 }).notNull(),
  recipientAddress: varchar("recipient_address").notNull(),
  description: text("description"),
  status: varchar("status").default("pending"), // pending, approved, rejected, executed
  requiredSignatures: integer("required_signatures").notNull(),
  currentSignatures: integer("current_signatures").default(0),
  // Tracking approvals
  approverIds: jsonb("approver_ids").default([]), // Array of user IDs who need to approve
  approvals: jsonb("approvals").default([]), // [{userId, timestamp, signature}]
  rejections: jsonb("rejections").default([]), // [{userId, timestamp, reason}]
  // Timeline
  requestedBy: varchar("requested_by").references(() => users.id).notNull(),
  requestedAt: timestamp("requested_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  executedAt: timestamp("executed_at"),
  expiresAt: timestamp("expires_at"), // Approval expires after 7 days if not signed
});

export type TreasuryApproval = typeof treasuryApprovals.$inferSelect;
export type InsertTreasuryApproval = typeof treasuryApprovals.$inferInsert;

/**
 * MIGRATION INSTRUCTIONS
 * 
 * Run these SQL commands to create the tables:
 * 
 * CREATE TABLE treasury_whitelist (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   dao_id UUID NOT NULL REFERENCES daos(id),
 *   wallet_address VARCHAR NOT NULL,
 *   recipient_name VARCHAR,
 *   category VARCHAR NOT NULL CHECK (category IN ('charity', 'payments', 'team', 'disbursements', 'other')),
 *   requested_by VARCHAR NOT NULL REFERENCES users(id),
 *   approved_by VARCHAR REFERENCES users(id),
 *   is_approved BOOLEAN DEFAULT FALSE,
 *   approval_reason TEXT,
 *   rejection_reason TEXT,
 *   created_at TIMESTAMP DEFAULT NOW(),
 *   approved_at TIMESTAMP,
 *   expires_at TIMESTAMP,
 *   UNIQUE(dao_id, wallet_address)
 * );
 * 
 * CREATE TABLE treasury_limits (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   dao_id UUID UNIQUE NOT NULL REFERENCES daos(id),
 *   daily_cap_percentage DECIMAL(5,2) DEFAULT 10,
 *   single_transfer_max_percentage DECIMAL(5,2) DEFAULT 5,
 *   multisig_threshold_usd DECIMAL(18,2) DEFAULT 10000,
 *   multisig_required_signatures INT DEFAULT 2,
 *   whitelist_required BOOLEAN DEFAULT TRUE,
 *   approval_required BOOLEAN DEFAULT TRUE,
 *   updated_by VARCHAR REFERENCES users(id),
 *   updated_at TIMESTAMP DEFAULT NOW(),
 *   created_at TIMESTAMP DEFAULT NOW()
 * );
 * 
 * CREATE TABLE treasury_approvals (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   dao_id UUID NOT NULL REFERENCES daos(id),
 *   proposal_id UUID NOT NULL REFERENCES proposals(id),
 *   transfer_amount DECIMAL(18,2) NOT NULL,
 *   recipient_address VARCHAR NOT NULL,
 *   description TEXT,
 *   status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
 *   required_signatures INT NOT NULL,
 *   current_signatures INT DEFAULT 0,
 *   approver_ids JSONB DEFAULT '[]',
 *   approvals JSONB DEFAULT '[]',
 *   rejections JSONB DEFAULT '[]',
 *   requested_by VARCHAR NOT NULL REFERENCES users(id),
 *   requested_at TIMESTAMP DEFAULT NOW(),
 *   approved_at TIMESTAMP,
 *   rejected_at TIMESTAMP,
 *   executed_at TIMESTAMP,
 *   expires_at TIMESTAMP
 * );
 * 
 * CREATE INDEX idx_treasury_whitelist_dao ON treasury_whitelist(dao_id);
 * CREATE INDEX idx_treasury_whitelist_address ON treasury_whitelist(wallet_address);
 * CREATE INDEX idx_treasury_limits_dao ON treasury_limits(dao_id);
 * CREATE INDEX idx_treasury_approvals_dao_status ON treasury_approvals(dao_id, status);
 * CREATE INDEX idx_treasury_approvals_proposal ON treasury_approvals(proposal_id);
 */
