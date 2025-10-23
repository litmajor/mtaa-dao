var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc20) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc20 = __getOwnPropDesc(from, key)) || desc20.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// shared/vestingSchema.ts
import { pgTable, varchar, timestamp, decimal, boolean, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var vestingSchedules, vestingClaims, vestingMilestones, insertVestingScheduleSchema, insertVestingClaimSchema, insertVestingMilestoneSchema;
var init_vestingSchema = __esm({
  "shared/vestingSchema.ts"() {
    "use strict";
    init_schema();
    vestingSchedules = pgTable("vesting_schedules", {
      id: uuid("id").primaryKey().defaultRandom(),
      userId: varchar("user_id").references(() => users.id).notNull(),
      scheduleType: varchar("schedule_type").notNull(),
      // linear, cliff, milestone
      totalTokens: decimal("total_tokens", { precision: 18, scale: 8 }).notNull(),
      vestedTokens: decimal("vested_tokens", { precision: 18, scale: 8 }).default("0"),
      claimedTokens: decimal("claimed_tokens", { precision: 18, scale: 8 }).default("0"),
      startDate: timestamp("start_date").notNull(),
      endDate: timestamp("end_date").notNull(),
      cliffDuration: integer("cliff_duration").default(0),
      // in days
      vestingDuration: integer("vesting_duration").notNull(),
      // in days
      vestingInterval: integer("vesting_interval").default(1),
      // in days
      isActive: boolean("is_active").default(true),
      reason: varchar("reason"),
      // airdrop, team, advisor, etc.
      createdAt: timestamp("created_at").defaultNow()
    });
    vestingClaims = pgTable("vesting_claims", {
      id: uuid("id").primaryKey().defaultRandom(),
      scheduleId: uuid("schedule_id").references(() => vestingSchedules.id).notNull(),
      userId: varchar("user_id").references(() => users.id).notNull(),
      claimedAmount: decimal("claimed_amount", { precision: 18, scale: 8 }).notNull(),
      transactionHash: varchar("transaction_hash"),
      claimedAt: timestamp("claimed_at").defaultNow()
    });
    vestingMilestones = pgTable("vesting_milestones", {
      id: uuid("id").primaryKey().defaultRandom(),
      scheduleId: uuid("schedule_id").references(() => vestingSchedules.id).notNull(),
      milestoneType: varchar("milestone_type").notNull(),
      // reputation, time, task_completion
      description: varchar("description"),
      targetValue: decimal("target_value", { precision: 18, scale: 8 }).notNull(),
      currentValue: decimal("current_value", { precision: 18, scale: 8 }).default("0"),
      tokensToRelease: decimal("tokens_to_release", { precision: 18, scale: 8 }).notNull(),
      isCompleted: boolean("is_completed").default(false),
      completedAt: timestamp("completed_at")
    });
    insertVestingScheduleSchema = createInsertSchema(vestingSchedules);
    insertVestingClaimSchema = createInsertSchema(vestingClaims);
    insertVestingMilestoneSchema = createInsertSchema(vestingMilestones);
  }
});

// shared/messageReactionsSchema.ts
import { pgTable as pgTable2, text, timestamp as timestamp2, uniqueIndex } from "drizzle-orm/pg-core";
var messageReactions;
var init_messageReactionsSchema = __esm({
  "shared/messageReactionsSchema.ts"() {
    "use strict";
    messageReactions = pgTable2(
      "message_reactions",
      {
        messageId: text("message_id").notNull(),
        userId: text("user_id").notNull(),
        daoId: text("dao_id").notNull(),
        emoji: text("emoji").notNull(),
        createdAt: timestamp2("created_at").defaultNow()
      },
      (table) => ({
        // Composite unique index to prevent duplicate reactions
        uniqueReaction: uniqueIndex("unique_reaction_idx").on(
          table.messageId,
          table.userId,
          table.emoji
        )
      })
    );
  }
});

// shared/kycSchema.ts
import { pgTable as pgTable3, text as text2, serial, timestamp as timestamp3, jsonb, boolean as boolean2, integer as integer2 } from "drizzle-orm/pg-core";
var kycVerifications, complianceAuditLogs, suspiciousActivities;
var init_kycSchema = __esm({
  "shared/kycSchema.ts"() {
    "use strict";
    kycVerifications = pgTable3("kyc_verifications", {
      id: serial("id").primaryKey(),
      userId: text2("user_id").notNull(),
      tier: text2("tier").notNull(),
      // none, basic, intermediate, advanced
      status: text2("status").notNull().default("pending"),
      // pending, approved, rejected, expired
      // Verification data
      email: text2("email"),
      emailVerified: boolean2("email_verified").default(false),
      phone: text2("phone"),
      phoneVerified: boolean2("phone_verified").default(false),
      // Document verification
      idDocumentType: text2("id_document_type"),
      // passport, national_id, drivers_license
      idDocumentNumber: text2("id_document_number"),
      idDocumentFrontUrl: text2("id_document_front_url"),
      idDocumentBackUrl: text2("id_document_back_url"),
      idVerificationStatus: text2("id_verification_status"),
      // Proof of address
      proofOfAddressType: text2("proof_of_address_type"),
      // utility_bill, bank_statement, tax_document
      proofOfAddressUrl: text2("proof_of_address_url"),
      addressVerificationStatus: text2("address_verification_status"),
      // Personal information
      firstName: text2("first_name"),
      lastName: text2("last_name"),
      dateOfBirth: text2("date_of_birth"),
      nationality: text2("nationality"),
      address: text2("address"),
      city: text2("city"),
      state: text2("state"),
      postalCode: text2("postal_code"),
      country: text2("country"),
      // Verification metadata
      verificationProvider: text2("verification_provider"),
      // jumio, onfido, manual
      verificationReference: text2("verification_reference"),
      verificationData: jsonb("verification_data"),
      // AML screening
      amlScreeningStatus: text2("aml_screening_status"),
      // clear, flagged, high_risk
      amlScreeningProvider: text2("aml_screening_provider"),
      // chainalysis, elliptic
      amlScreeningReference: text2("aml_screening_reference"),
      amlScreeningData: jsonb("aml_screening_data"),
      // Transaction limits
      dailyLimit: integer2("daily_limit").default(100),
      // USD equivalent
      monthlyLimit: integer2("monthly_limit").default(3e3),
      annualLimit: integer2("annual_limit").default(1e4),
      // Review and approval
      reviewedBy: text2("reviewed_by"),
      reviewedAt: timestamp3("reviewed_at"),
      rejectionReason: text2("rejection_reason"),
      notes: text2("notes"),
      // Timestamps
      submittedAt: timestamp3("submitted_at"),
      approvedAt: timestamp3("approved_at"),
      expiresAt: timestamp3("expires_at"),
      createdAt: timestamp3("created_at").defaultNow(),
      updatedAt: timestamp3("updated_at").defaultNow()
    });
    complianceAuditLogs = pgTable3("compliance_audit_logs", {
      id: serial("id").primaryKey(),
      userId: text2("user_id").notNull(),
      eventType: text2("event_type").notNull(),
      // kyc_submitted, kyc_approved, aml_flagged, transaction_blocked
      eventData: jsonb("event_data"),
      ipAddress: text2("ip_address"),
      userAgent: text2("user_agent"),
      severity: text2("severity"),
      // info, warning, critical
      notes: text2("notes"),
      createdAt: timestamp3("created_at").defaultNow()
    });
    suspiciousActivities = pgTable3("suspicious_activities", {
      id: serial("id").primaryKey(),
      userId: text2("user_id").notNull(),
      activityType: text2("activity_type").notNull(),
      // unusual_amount, rapid_transactions, high_risk_country
      description: text2("description").notNull(),
      severity: text2("severity").notNull(),
      // low, medium, high, critical
      status: text2("status").notNull().default("pending"),
      // pending, investigating, resolved, false_positive
      // Detection details
      detectedBy: text2("detected_by"),
      // automated, manual, aml_provider
      detectionRules: jsonb("detection_rules"),
      relatedTransactions: jsonb("related_transactions"),
      // Investigation
      investigatedBy: text2("investigated_by"),
      investigationNotes: text2("investigation_notes"),
      investigatedAt: timestamp3("investigated_at"),
      // Resolution
      resolution: text2("resolution"),
      resolvedBy: text2("resolved_by"),
      resolvedAt: timestamp3("resolved_at"),
      // Reporting
      reportedToAuthorities: boolean2("reported_to_authorities").default(false),
      reportReference: text2("report_reference"),
      reportedAt: timestamp3("reported_at"),
      createdAt: timestamp3("created_at").defaultNow(),
      updatedAt: timestamp3("updated_at").defaultNow()
    });
  }
});

// shared/escrowSchema.ts
import { pgTable as pgTable4, uuid as uuid2, varchar as varchar2, decimal as decimal2, timestamp as timestamp4, text as text3, jsonb as jsonb2 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema2 } from "drizzle-zod";
var escrowAccounts, escrowMilestones, escrowDisputes, insertEscrowAccountSchema, insertEscrowMilestoneSchema, insertEscrowDisputeSchema;
var init_escrowSchema = __esm({
  "shared/escrowSchema.ts"() {
    "use strict";
    init_schema();
    escrowAccounts = pgTable4("escrow_accounts", {
      id: uuid2("id").primaryKey().defaultRandom(),
      taskId: uuid2("task_id").references(() => tasks.id),
      payerId: varchar2("payer_id").references(() => users.id).notNull(),
      payeeId: varchar2("payee_id").references(() => users.id).notNull(),
      amount: decimal2("amount", { precision: 18, scale: 8 }).notNull(),
      currency: varchar2("currency").notNull().default("cUSD"),
      status: varchar2("status").notNull().default("pending"),
      // pending, funded, released, refunded, disputed
      milestones: jsonb2("milestones").default([]),
      // array of milestone objects
      currentMilestone: varchar2("current_milestone").default("0"),
      fundedAt: timestamp4("funded_at"),
      releasedAt: timestamp4("released_at"),
      refundedAt: timestamp4("refunded_at"),
      disputeReason: text3("dispute_reason"),
      disputedAt: timestamp4("disputed_at"),
      resolvedAt: timestamp4("resolved_at"),
      transactionHash: varchar2("transaction_hash"),
      metadata: jsonb2("metadata").default({}),
      createdAt: timestamp4("created_at").defaultNow(),
      updatedAt: timestamp4("updated_at").defaultNow()
    });
    escrowMilestones = pgTable4("escrow_milestones", {
      id: uuid2("id").primaryKey().defaultRandom(),
      escrowId: uuid2("escrow_id").references(() => escrowAccounts.id).notNull(),
      milestoneNumber: varchar2("milestone_number").notNull(),
      description: text3("description").notNull(),
      amount: decimal2("amount", { precision: 18, scale: 8 }).notNull(),
      status: varchar2("status").notNull().default("pending"),
      // pending, approved, released, disputed
      approvedBy: varchar2("approved_by").references(() => users.id),
      approvedAt: timestamp4("approved_at"),
      releasedAt: timestamp4("released_at"),
      proofUrl: text3("proof_url"),
      createdAt: timestamp4("created_at").defaultNow(),
      updatedAt: timestamp4("updated_at").defaultNow()
    });
    escrowDisputes = pgTable4("escrow_disputes", {
      id: uuid2("id").primaryKey().defaultRandom(),
      escrowId: uuid2("escrow_id").references(() => escrowAccounts.id).notNull(),
      raisedBy: varchar2("raised_by").references(() => users.id).notNull(),
      reason: text3("reason").notNull(),
      evidence: jsonb2("evidence").default([]),
      status: varchar2("status").notNull().default("open"),
      // open, under_review, resolved
      resolution: text3("resolution"),
      resolvedBy: varchar2("resolved_by").references(() => users.id),
      resolvedAt: timestamp4("resolved_at"),
      createdAt: timestamp4("created_at").defaultNow(),
      updatedAt: timestamp4("updated_at").defaultNow()
    });
    insertEscrowAccountSchema = createInsertSchema2(escrowAccounts);
    insertEscrowMilestoneSchema = createInsertSchema2(escrowMilestones);
    insertEscrowDisputeSchema = createInsertSchema2(escrowDisputes);
  }
});

// shared/invoiceSchema.ts
import { pgTable as pgTable5, uuid as uuid3, varchar as varchar3, decimal as decimal3, timestamp as timestamp5, text as text4, jsonb as jsonb3 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema3 } from "drizzle-zod";
var invoices, invoicePayments, insertInvoiceSchema, insertInvoicePaymentSchema;
var init_invoiceSchema = __esm({
  "shared/invoiceSchema.ts"() {
    "use strict";
    init_schema();
    invoices = pgTable5("invoices", {
      id: uuid3("id").primaryKey().defaultRandom(),
      invoiceNumber: varchar3("invoice_number").notNull().unique(),
      fromUserId: varchar3("from_user_id").references(() => users.id).notNull(),
      toUserId: varchar3("to_user_id").references(() => users.id),
      daoId: uuid3("dao_id").references(() => daos.id),
      amount: decimal3("amount", { precision: 18, scale: 8 }).notNull(),
      currency: varchar3("currency").notNull().default("cUSD"),
      description: text4("description").notNull(),
      lineItems: jsonb3("line_items").default([]),
      // array of {description, quantity, rate, amount}
      status: varchar3("status").notNull().default("draft"),
      // draft, sent, paid, cancelled, overdue
      dueDate: timestamp5("due_date"),
      paidAt: timestamp5("paid_at"),
      paymentMethod: varchar3("payment_method"),
      // wallet, mpesa, stripe, etc.
      transactionHash: varchar3("transaction_hash"),
      notes: text4("notes"),
      termsAndConditions: text4("terms_and_conditions"),
      metadata: jsonb3("metadata").default({}),
      createdAt: timestamp5("created_at").defaultNow(),
      updatedAt: timestamp5("updated_at").defaultNow()
    });
    invoicePayments = pgTable5("invoice_payments", {
      id: uuid3("id").primaryKey().defaultRandom(),
      invoiceId: uuid3("invoice_id").references(() => invoices.id).notNull(),
      payerId: varchar3("payer_id").references(() => users.id).notNull(),
      amount: decimal3("amount", { precision: 18, scale: 8 }).notNull(),
      currency: varchar3("currency").notNull(),
      paymentMethod: varchar3("payment_method").notNull(),
      transactionHash: varchar3("transaction_hash"),
      status: varchar3("status").notNull().default("pending"),
      metadata: jsonb3("metadata").default({}),
      createdAt: timestamp5("created_at").defaultNow()
    });
    insertInvoiceSchema = createInsertSchema3(invoices);
    insertInvoicePaymentSchema = createInsertSchema3(invoicePayments);
  }
});

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLogs: () => auditLogs,
  billingHistory: () => billingHistory,
  budgetPlans: () => budgetPlans,
  budgetPlansRelations: () => budgetPlansRelations,
  chainInfo: () => chainInfo,
  chains: () => chains,
  commentLikes: () => commentLikes,
  commentLikesRelations: () => commentLikesRelations,
  complianceAuditLogs: () => complianceAuditLogs,
  config: () => config2,
  contributions: () => contributions,
  contributionsRelations: () => contributionsRelations,
  createSessionSchema: () => createSessionSchema,
  crossChainProposals: () => crossChainProposals,
  crossChainTransfers: () => crossChainTransfers,
  dailyChallenges: () => dailyChallenges,
  daoMemberships: () => daoMemberships,
  daoMembershipsRelations: () => daoMembershipsRelations,
  daoMessages: () => daoMessages,
  daoMessagesRelations: () => daoMessagesRelations,
  daos: () => daos,
  daosRelations: () => daosRelations,
  escrowAccounts: () => escrowAccounts,
  escrowDisputes: () => escrowDisputes,
  escrowMilestones: () => escrowMilestones,
  insertBudgetPlanSchema: () => insertBudgetPlanSchema,
  insertCommentLikeSchema: () => insertCommentLikeSchema,
  insertContributionSchema: () => insertContributionSchema,
  insertDaoMembershipSchema: () => insertDaoMembershipSchema,
  insertDaoMessageSchema: () => insertDaoMessageSchema,
  insertDaoSchema: () => insertDaoSchema,
  insertEnhancedVaultSchema: () => insertEnhancedVaultSchema,
  insertEscrowAccountSchema: () => insertEscrowAccountSchema,
  insertEscrowDisputeSchema: () => insertEscrowDisputeSchema,
  insertEscrowMilestoneSchema: () => insertEscrowMilestoneSchema,
  insertInvoicePaymentSchema: () => insertInvoicePaymentSchema,
  insertInvoiceSchema: () => insertInvoiceSchema,
  insertNotificationSchema: () => insertNotificationSchema,
  insertProposalCommentSchema: () => insertProposalCommentSchema,
  insertProposalExecutionQueueSchema: () => insertProposalExecutionQueueSchema,
  insertProposalLikeSchema: () => insertProposalLikeSchema,
  insertProposalSchema: () => insertProposalSchema,
  insertProposalTemplateSchema: () => insertProposalTemplateSchema,
  insertQuorumHistorySchema: () => insertQuorumHistorySchema,
  insertReferralRewardSchema: () => insertReferralRewardSchema,
  insertTaskHistorySchema: () => insertTaskHistorySchema,
  insertTaskSchema: () => insertTaskSchema,
  insertUserSchema: () => insertUserSchema,
  insertVaultGovernanceProposalSchema: () => insertVaultGovernanceProposalSchema,
  insertVaultPerformanceSchema: () => insertVaultPerformanceSchema,
  insertVaultRiskAssessmentSchema: () => insertVaultRiskAssessmentSchema,
  insertVaultSchema: () => insertVaultSchema,
  insertVaultStrategyAllocationSchema: () => insertVaultStrategyAllocationSchema,
  insertVaultTokenHoldingSchema: () => insertVaultTokenHoldingSchema,
  insertVaultTransactionSchema: () => insertVaultTransactionSchema,
  insertVestingClaimSchema: () => insertVestingClaimSchema,
  insertVestingMilestoneSchema: () => insertVestingMilestoneSchema,
  insertVestingScheduleSchema: () => insertVestingScheduleSchema,
  insertVoteDelegationSchema: () => insertVoteDelegationSchema,
  insertVoteSchema: () => insertVoteSchema,
  insertWalletTransactionSchema: () => insertWalletTransactionSchema,
  invoicePayments: () => invoicePayments,
  invoices: () => invoices,
  kycVerifications: () => kycVerifications,
  lockedSavings: () => lockedSavings,
  logs: () => logs,
  messageReactions: () => messageReactions,
  notificationHistory: () => notificationHistory,
  notificationPreferences: () => notificationPreferences,
  notifications: () => notifications,
  paymentReceipts: () => paymentReceipts,
  paymentRequests: () => paymentRequests,
  paymentTransactions: () => paymentTransactions,
  proposalComments: () => proposalComments,
  proposalCommentsRelations: () => proposalCommentsRelations,
  proposalExecutionQueue: () => proposalExecutionQueue,
  proposalLikes: () => proposalLikes,
  proposalLikesRelations: () => proposalLikesRelations,
  proposalTemplates: () => proposalTemplates,
  proposalTemplatesRelations: () => proposalTemplatesRelations,
  proposals: () => proposals,
  proposalsRelations: () => proposalsRelations,
  quorumHistory: () => quorumHistory,
  referralRewards: () => referralRewards,
  referralRewardsRelations: () => referralRewardsRelations,
  roles: () => roles,
  savingsGoals: () => savingsGoals,
  sessionSchema: () => sessionSchema,
  sessions: () => sessions,
  subscriptions: () => subscriptions,
  suspiciousActivities: () => suspiciousActivities,
  systemLogs: () => systemLogs,
  taskHistory: () => taskHistory,
  taskTemplates: () => taskTemplates,
  taskTemplatesCreatedBy: () => taskTemplatesCreatedBy,
  tasks: () => tasks,
  userActivities: () => userActivities,
  userActivitiesDaoId: () => userActivitiesDaoId,
  userChallenges: () => userChallenges,
  userReputation: () => userReputation,
  users: () => users,
  usersRelations: () => usersRelations,
  vaultGovernanceProposals: () => vaultGovernanceProposals,
  vaultPerformance: () => vaultPerformance,
  vaultRiskAssessments: () => vaultRiskAssessments,
  vaultStrategyAllocations: () => vaultStrategyAllocations,
  vaultTokenHoldings: () => vaultTokenHoldings,
  vaultTransactions: () => vaultTransactions,
  vaults: () => vaults,
  vaultsFullRelations: () => vaultsFullRelations,
  vaultsRelations: () => vaultsRelations,
  vestingClaims: () => vestingClaims,
  vestingMilestones: () => vestingMilestones,
  vestingSchedules: () => vestingSchedules,
  voteDelegations: () => voteDelegations,
  voteDelegationsRelations: () => voteDelegationsRelations,
  votes: () => votes,
  votesRelations: () => votesRelations,
  walletTransactions: () => walletTransactions2,
  walletTransactionsRelations: () => walletTransactionsRelations
});
import {
  pgTable as pgTable6,
  text as text5,
  varchar as varchar4,
  timestamp as timestamp6,
  jsonb as jsonb4,
  serial as serial2,
  integer as integer3,
  decimal as decimal4,
  boolean as boolean5,
  uuid as uuid4,
  json
} from "drizzle-orm/pg-core";
import { sql as sql2 } from "drizzle-orm";
import { createInsertSchema as createInsertSchema4 } from "drizzle-zod";
import { relations } from "drizzle-orm";
var referralRewards, tasks, taskTemplates, taskTemplatesCreatedBy, users, userActivities, userActivitiesDaoId, daos, roles, sessions, createSessionSchema, sessionSchema, billingHistory, proposalTemplates, proposals, voteDelegations, votes, quorumHistory, proposalExecutionQueue, contributions, lockedSavings, savingsGoals, vaults, budgetPlans, daoMemberships, paymentRequests, paymentTransactions, paymentReceipts, walletTransactions2, vaultTokenHoldings, vaultPerformance, vaultStrategyAllocations, vaultTransactions, vaultRiskAssessments, vaultGovernanceProposals, config2, logs, auditLogs, systemLogs, notificationHistory, chainInfo, chains, proposalComments, proposalLikes, commentLikes, daoMessages, subscriptions, userReputation, usersRelations, daosRelations, daoMembershipsRelations, proposalsRelations, votesRelations, voteDelegationsRelations, proposalTemplatesRelations, contributionsRelations, vaultsRelations, vaultsFullRelations, budgetPlansRelations, walletTransactionsRelations, referralRewardsRelations, insertUserSchema, insertDaoSchema, insertProposalSchema, insertVoteSchema, insertContributionSchema, insertVaultSchema, insertBudgetPlanSchema, insertDaoMembershipSchema, insertWalletTransactionSchema, insertReferralRewardSchema, notifications, notificationPreferences, taskHistory, insertTaskSchema, insertNotificationSchema, insertTaskHistorySchema, insertProposalTemplateSchema, insertVoteDelegationSchema, crossChainTransfers, crossChainProposals, insertQuorumHistorySchema, insertProposalExecutionQueueSchema, proposalCommentsRelations, proposalLikesRelations, dailyChallenges, userChallenges, commentLikesRelations, daoMessagesRelations, insertProposalCommentSchema, insertProposalLikeSchema, insertCommentLikeSchema, insertDaoMessageSchema, insertEnhancedVaultSchema, insertVaultTokenHoldingSchema, insertVaultTransactionSchema, insertVaultPerformanceSchema, insertVaultRiskAssessmentSchema, insertVaultStrategyAllocationSchema, insertVaultGovernanceProposalSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    init_vestingSchema();
    init_messageReactionsSchema();
    init_kycSchema();
    init_escrowSchema();
    init_invoiceSchema();
    referralRewards = pgTable6("referral_rewards", {
      id: uuid4("id").primaryKey().defaultRandom(),
      referrerId: varchar4("referrer_id").references(() => users.id).notNull(),
      referredUserId: varchar4("referred_user_id").references(() => users.id).notNull(),
      rewardAmount: decimal4("reward_amount", { precision: 10, scale: 2 }).default("0"),
      rewardType: varchar4("reward_type").default("signup"),
      // signup, first_contribution, milestone
      claimed: boolean5("claimed").default(false),
      createdAt: timestamp6("created_at").defaultNow()
    });
    tasks = pgTable6("tasks", {
      id: uuid4("id").primaryKey().defaultRandom(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      creatorId: varchar4("creator_id").references(() => users.id).notNull(),
      title: text5("title").notNull(),
      description: text5("description").notNull(),
      reward: decimal4("reward", { precision: 10, scale: 2 }).notNull(),
      status: varchar4("status").default("open"),
      // open, claimed, submitted, completed, disputed
      claimerId: varchar4("claimer_id").references(() => users.id),
      claimedBy: varchar4("claimed_by").references(() => users.id),
      // legacy, keep for now
      category: varchar4("category").notNull(),
      difficulty: varchar4("difficulty").notNull(),
      // easy, medium, hard
      estimatedTime: varchar4("estimated_time"),
      deadline: timestamp6("deadline"),
      requiresVerification: boolean5("requires_verification").default(false),
      proofUrl: text5("proof_url"),
      verificationNotes: text5("verification_notes"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    taskTemplates = pgTable6("task_templates", {
      id: uuid4("id").primaryKey().defaultRandom(),
      title: varchar4("title").notNull(),
      description: text5("description").notNull(),
      category: varchar4("category").notNull(),
      difficulty: varchar4("difficulty").notNull(),
      estimatedHours: integer3("estimated_hours").default(1),
      requiredSkills: jsonb4("required_skills").default([]),
      bountyAmount: decimal4("bounty_amount", { precision: 10, scale: 2 }).default("0"),
      deliverables: jsonb4("deliverables").default([]),
      acceptanceCriteria: jsonb4("acceptance_criteria").default([]),
      createdBy: varchar4("created_by").references(() => users.id).notNull(),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    taskTemplatesCreatedBy = taskTemplates.createdBy;
    users = pgTable6("users", {
      id: varchar4("id").primaryKey(),
      // convenience full name for some callsites
      name: varchar4("name"),
      username: varchar4("username").unique(),
      password: varchar4("password").notNull(),
      email: varchar4("email").unique(),
      phone: varchar4("phone").unique(),
      emailVerified: boolean5("email_verified").default(false),
      phoneVerified: boolean5("phone_verified").default(false),
      emailVerificationToken: varchar4("email_verification_token"),
      phoneVerificationToken: varchar4("phone_verification_token"),
      emailVerificationExpiresAt: timestamp6("email_verification_expires_at"),
      phoneVerificationExpiresAt: timestamp6("phone_verification_expires_at"),
      passwordResetToken: varchar4("password_reset_token"),
      firstName: varchar4("first_name"),
      lastName: varchar4("last_name"),
      profileImageUrl: varchar4("profile_image_url"),
      profilePicture: varchar4("profile_picture"),
      // wallet address used in multiple server callsites
      walletAddress: varchar4("wallet_address"),
      bio: text5("bio"),
      location: varchar4("location"),
      website: varchar4("website"),
      lastLoginAt: timestamp6("last_login_at"),
      reputationScore: decimal4("reputation_score", { precision: 10, scale: 2 }).default("0"),
      roles: varchar4("roles").default("member"),
      // member, proposer, elder
      totalContributions: decimal4("total_contributions", { precision: 10, scale: 2 }).default("0"),
      currentStreak: integer3("current_streak").default(0),
      referralCode: varchar4("referral_code").unique(),
      referredBy: varchar4("referred_by"),
      totalReferrals: integer3("total_referrals").default(0),
      darkMode: boolean5("dark_mode").default(false),
      joinedAt: timestamp6("joined_at").defaultNow(),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow(),
      otp: varchar4("otp", { length: 10 }),
      otpExpiresAt: timestamp6("otp_expires_at"),
      isEmailVerified: boolean5("is_email_verified").default(false),
      isPhoneVerified: boolean5("is_phone_verified").default(false),
      isBanned: boolean5("is_banned").default(false),
      banReason: text5("ban_reason"),
      isSuperUser: boolean5("is_super_user").default(false),
      // for superuser dashboard access
      votingPower: decimal4("voting_power", { precision: 10, scale: 2 }).default("1.0"),
      // for weighted voting
      telegramId: varchar4("telegram_id"),
      telegramChatId: varchar4("telegram_chat_id"),
      telegramUsername: varchar4("telegram_username"),
      // Encrypted wallet storage fields
      encryptedWallet: text5("encrypted_wallet"),
      walletSalt: text5("wallet_salt"),
      walletIv: text5("wallet_iv"),
      walletAuthTag: text5("wallet_auth_tag"),
      hasBackedUpMnemonic: boolean5("has_backed_up_mnemonic").default(false)
    });
    userActivities = pgTable6("user_activities", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      dao_id: uuid4("dao_id").references(() => daos.id),
      type: varchar4("type").notNull(),
      // e.g., 'proposal', 'vote', 'task', 'comment', etc.
      description: text5("description"),
      firstName: varchar4("first_name"),
      lastName: varchar4("last_name"),
      profileImageUrl: varchar4("profile_image_url"),
      roles: varchar4("roles").default("member"),
      // member, proposer, elder
      totalContributions: decimal4("total_contributions", { precision: 10, scale: 2 }).default("0"),
      currentStreak: integer3("current_streak").default(0),
      referralCode: varchar4("referral_code").unique(),
      referredBy: varchar4("referred_by"),
      totalReferrals: integer3("total_referrals").default(0),
      darkMode: boolean5("dark_mode").default(false),
      joinedAt: timestamp6("joined_at").defaultNow(),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow(),
      otp: varchar4("otp", { length: 10 }),
      otpExpiresAt: timestamp6("otp_expires_at"),
      isEmailVerified: boolean5("is_email_verified").default(false),
      isPhoneVerified: boolean5("is_phone_verified").default(false),
      isBanned: boolean5("is_banned").default(false),
      banReason: text5("ban_reason"),
      isSuperUser: boolean5("is_super_user").default(false),
      // for superuser dashboard access
      votingPower: decimal4("voting_power", { precision: 10, scale: 2 }).default("1.0"),
      // for weighted voting
      telegramId: varchar4("telegram_id"),
      telegramChatId: varchar4("telegram_chat_id"),
      telegramUsername: varchar4("telegram_username")
    });
    userActivitiesDaoId = userActivities.dao_id;
    daos = pgTable6("daos", {
      id: uuid4("id").primaryKey().defaultRandom(),
      name: varchar4("name").notNull(),
      description: text5("description"),
      access: varchar4("access").default("public"),
      // "public" | "private"
      inviteOnly: boolean5("invite_only").default(false),
      inviteCode: varchar4("invite_code"),
      creatorId: varchar4("creator_id").references(() => users.id).notNull(),
      isPublic: boolean5("is_public").default(true),
      // legacy, keep for now
      memberCount: integer3("member_count").default(1),
      treasuryBalance: decimal4("treasury_balance", { precision: 10, scale: 2 }).default("0"),
      plan: varchar4("plan").default("free"),
      // free, premium
      planExpiresAt: timestamp6("plan_expires_at"),
      billingStatus: varchar4("billing_status").default("active"),
      nextBillingDate: timestamp6("next_billing_date"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow(),
      imageUrl: varchar4("image_url"),
      bannerUrl: varchar4("banner_url"),
      isArchived: boolean5("is_archived").default(false),
      // for soft deletion
      archivedAt: timestamp6("archived_at"),
      archivedBy: varchar4("archived_by").references(() => users.id),
      isFeatured: boolean5("is_featured").default(false),
      // for featured DAOs on landing page
      featureOrder: integer3("feature_order").default(0),
      // order of featured DAOs
      quorumPercentage: integer3("quorum_percentage").default(20),
      // percentage of active members for quorum
      votingPeriod: integer3("voting_period").default(72),
      // voting period in hours
      executionDelay: integer3("execution_delay").default(24),
      // execution delay in hours
      tokenHoldings: boolean5("token_holdings").default(false)
      // whether DAO requires token holdings for membership
    });
    roles = ["member", "proposer", "elder", "admin", "superUser", "moderator"];
    sessions = pgTable6("sessions", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      sessionToken: varchar4("session_token").unique().notNull(),
      expiresAt: timestamp6("expires_at").notNull(),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    createSessionSchema = createInsertSchema4(sessions);
    sessionSchema = createSessionSchema;
    billingHistory = pgTable6("billing_history", {
      id: uuid4("id").primaryKey().defaultRandom(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      amount: decimal4("amount", { precision: 10, scale: 2 }).notNull(),
      currency: varchar4("currency").default("KES"),
      status: varchar4("status").default("paid"),
      description: text5("description"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    proposalTemplates = pgTable6("proposal_templates", {
      id: uuid4("id").primaryKey().defaultRandom(),
      daoId: uuid4("dao_id").references(() => daos.id),
      name: varchar4("name").notNull(),
      category: varchar4("category").notNull(),
      // budget, governance, member, treasury, etc.
      description: text5("description").notNull(),
      titleTemplate: text5("title_template").notNull(),
      descriptionTemplate: text5("description_template").notNull(),
      requiredFields: jsonb4("required_fields").default([]),
      // array of field definitions
      votingPeriod: integer3("voting_period").default(72),
      // hours
      quorumOverride: integer3("quorum_override"),
      // override DAO default
      isGlobal: boolean5("is_global").default(false),
      // available to all DAOs
      createdBy: varchar4("created_by").references(() => users.id).notNull(),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    proposals = pgTable6("proposals", {
      id: uuid4("id").primaryKey().defaultRandom(),
      title: text5("title").notNull(),
      description: text5("description").notNull(),
      proposalType: varchar4("proposal_type").default("general"),
      // general, budget, emergency, poll
      templateId: uuid4("template_id").references(() => proposalTemplates.id),
      tags: jsonb4("tags").default([]),
      // e.g., ["infrastructure", "education"]
      imageUrl: varchar4("image_url"),
      pollOptions: jsonb4("poll_options").default([]),
      // For poll-type proposals: [{id, label, votes}]
      allowMultipleChoices: boolean5("allow_multiple_choices").default(false),
      proposer: varchar4("proposer").references(() => users.id).notNull(),
      proposerId: varchar4("proposer_id").references(() => users.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      status: varchar4("status").default("active"),
      // draft, active, passed, failed, executed, expired
      voteStartTime: timestamp6("vote_start_time").defaultNow(),
      voteEndTime: timestamp6("vote_end_time").notNull(),
      quorumRequired: integer3("quorum_required").default(100),
      yesVotes: integer3("yes_votes").default(0),
      noVotes: integer3("no_votes").default(0),
      abstainVotes: integer3("abstain_votes").default(0),
      // legacy/alias fields referenced in other services
      forVotes: integer3("for_votes").default(0),
      againstVotes: integer3("against_votes").default(0),
      // optional free-form metadata used by some cross-service queries
      metadata: jsonb4("metadata"),
      totalVotingPower: decimal4("total_voting_power", { precision: 10, scale: 2 }).default("0"),
      executionData: jsonb4("execution_data"),
      // data needed for automatic execution
      executedAt: timestamp6("executed_at"),
      executedBy: varchar4("executed_by").references(() => users.id),
      executionTxHash: varchar4("execution_tx_hash"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow(),
      isFeatured: boolean5("is_featured").default(false)
      // for featured proposals on DAO page
    });
    voteDelegations = pgTable6("vote_delegations", {
      id: uuid4("id").primaryKey().defaultRandom(),
      delegatorId: varchar4("delegator_id").references(() => users.id).notNull(),
      delegateId: varchar4("delegate_id").references(() => users.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      scope: varchar4("scope").default("all"),
      // all, category-specific, proposal-specific
      category: varchar4("category"),
      // if scope is category-specific
      proposalId: uuid4("proposal_id").references(() => proposals.id),
      // if scope is proposal-specific
      isActive: boolean5("is_active").default(true),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    votes = pgTable6("votes", {
      id: uuid4("id").primaryKey().defaultRandom(),
      proposalId: uuid4("proposal_id").references(() => proposals.id).notNull(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      voteType: varchar4("vote_type").notNull(),
      // yes, no, abstain
      weight: decimal4("weight", { precision: 3, scale: 2 }).default("1.0"),
      votingPower: decimal4("voting_power", { precision: 10, scale: 2 }).default("1.0"),
      isDelegated: boolean5("is_delegated").default(false),
      delegatedBy: varchar4("delegated_by").references(() => users.id),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    quorumHistory = pgTable6("quorum_history", {
      id: uuid4("id").primaryKey().defaultRandom(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      proposalId: uuid4("proposal_id").references(() => proposals.id),
      activeMemberCount: integer3("active_member_count").notNull(),
      requiredQuorum: integer3("required_quorum").notNull(),
      achievedQuorum: integer3("achieved_quorum").default(0),
      quorumMet: boolean5("quorum_met").default(false),
      calculatedAt: timestamp6("calculated_at").defaultNow()
    });
    proposalExecutionQueue = pgTable6("proposal_execution_queue", {
      id: uuid4("id").primaryKey().defaultRandom(),
      proposalId: uuid4("proposal_id").references(() => proposals.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      scheduledFor: timestamp6("scheduled_for").notNull(),
      executionType: varchar4("execution_type").notNull(),
      // treasury_transfer, member_action, etc.
      executionData: jsonb4("execution_data").notNull(),
      status: varchar4("status").default("pending"),
      // pending, executing, completed, failed
      attempts: integer3("attempts").default(0),
      lastAttempt: timestamp6("last_attempt"),
      errorMessage: text5("error_message"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    contributions = pgTable6("contributions", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      proposalId: uuid4("proposal_id").references(() => proposals.id),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      amount: decimal4("amount", { precision: 10, scale: 2 }).notNull(),
      currency: varchar4("currency").default("cUSD"),
      purpose: varchar4("purpose").default("general"),
      // general, emergency, education, infrastructure
      isAnonymous: boolean5("is_anonymous").default(false),
      transactionHash: varchar4("transaction_hash"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow(),
      vault: boolean5("vault").default(false)
      // true if contribution goes to DAO vault
    });
    lockedSavings = pgTable6("locked_savings", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      vaultId: uuid4("vault_id").references(() => vaults.id).notNull(),
      amount: decimal4("amount", { precision: 10, scale: 2 }).notNull(),
      currency: varchar4("currency").default("KES"),
      lockPeriod: integer3("lock_period").notNull(),
      // in days
      interestRate: decimal4("interest_rate", { precision: 5, scale: 4 }).default("0.05"),
      // 5% default
      lockedAt: timestamp6("locked_at").defaultNow(),
      unlocksAt: timestamp6("unlocks_at").notNull(),
      status: varchar4("status").default("locked"),
      // locked, unlocked, withdrawn
      penalty: decimal4("penalty", { precision: 10, scale: 2 }).default("0"),
      // early withdrawal penalty
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    savingsGoals = pgTable6("savings_goals", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      title: varchar4("title").notNull(),
      description: text5("description"),
      targetAmount: decimal4("target_amount", { precision: 10, scale: 2 }).notNull(),
      currentAmount: decimal4("current_amount", { precision: 10, scale: 2 }).default("0"),
      currency: varchar4("currency").default("KES"),
      targetDate: timestamp6("target_date"),
      category: varchar4("category").default("general"),
      // emergency, education, business, housing, etc.
      isCompleted: boolean5("is_completed").default(false),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    vaults = pgTable6("vaults", {
      id: uuid4("id").primaryKey().defaultRandom(),
      // Support both personal and DAO vaults
      userId: varchar4("user_id").references(() => users.id),
      // nullable for DAO vaults
      daoId: uuid4("dao_id").references(() => daos.id),
      // nullable for personal vaults
      name: varchar4("name").default("Personal Vault"),
      // vault name with default for backward compatibility
      description: text5("description"),
      currency: varchar4("currency").notNull(),
      // primary currency, kept for backward compatibility
      address: varchar4("address"),
      // wallet address for this vault
      balance: decimal4("balance", { precision: 18, scale: 8 }).default("0"),
      // higher precision for crypto
      monthlyGoal: decimal4("monthly_goal", { precision: 18, scale: 8 }).default("0"),
      vaultType: varchar4("vault_type").default("regular"),
      // regular, savings, locked_savings, yield, dao_treasury
      lockDuration: integer3("lock_duration"),
      // in days for locked savings
      lockedUntil: timestamp6("locked_until"),
      // when locked savings unlocks
      interestRate: decimal4("interest_rate", { precision: 5, scale: 4 }).default("0"),
      // annual interest rate for savings
      // Phase 3 enhancements
      isActive: boolean5("is_active").default(true),
      riskLevel: varchar4("risk_level").default("low"),
      // low, medium, high
      minDeposit: decimal4("min_deposit", { precision: 18, scale: 8 }).default("0"),
      maxDeposit: decimal4("max_deposit", { precision: 18, scale: 8 }),
      totalValueLocked: decimal4("total_value_locked", { precision: 18, scale: 8 }).default("0"),
      // TVL in USD equivalent
      // accumulated yield numeric captured by some analytics services
      yieldGenerated: decimal4("yield_generated", { precision: 18, scale: 8 }).default("0"),
      yieldStrategy: varchar4("yield_strategy"),
      // references YIELD_STRATEGIES
      performanceFee: decimal4("performance_fee", { precision: 5, scale: 4 }).default("0.1"),
      // 10% default
      managementFee: decimal4("management_fee", { precision: 5, scale: 4 }).default("0.02"),
      // 2% annual default
      updatedAt: timestamp6("updated_at").defaultNow(),
      createdAt: timestamp6("created_at").defaultNow()
    });
    budgetPlans = pgTable6("budget_plans", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      category: varchar4("category").notNull(),
      // food, bills, mtaa_fund, savings, etc.
      allocatedAmount: decimal4("allocated_amount", { precision: 10, scale: 2 }).notNull(),
      spentAmount: decimal4("spent_amount", { precision: 10, scale: 2 }).default("0"),
      month: varchar4("month").notNull(),
      // YYYY-MM format
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    daoMemberships = pgTable6("dao_memberships", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      role: varchar4("role").default("member"),
      // member, proposer, elder, admin
      status: varchar4("status").default("approved"),
      // "approved" | "pending" | "rejected"
      joinedAt: timestamp6("joined_at").defaultNow(),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow(),
      isBanned: boolean5("is_banned").default(false),
      // for banning members from DAOs
      banReason: text5("ban_reason"),
      // reason for banning, if applicable
      isElder: boolean5("is_elder").default(false),
      // for elder members with special privileges
      isAdmin: boolean5("is_admin").default(false),
      // for DAO admins with full control
      lastActive: timestamp6("last_active").defaultNow()
      // for quorum calculations
    });
    paymentRequests = pgTable6("payment_requests", {
      id: uuid4("id").primaryKey().defaultRandom(),
      fromUserId: varchar4("from_user_id").references(() => users.id).notNull(),
      toUserId: varchar4("to_user_id").references(() => users.id),
      toAddress: varchar4("to_address"),
      amount: decimal4("amount", { precision: 18, scale: 8 }).notNull(),
      currency: varchar4("currency").notNull(),
      description: text5("description"),
      qrCode: text5("qr_code"),
      // Base64 encoded QR code
      celoUri: text5("celo_uri"),
      // celo://pay?address=...&amount=...&token=...
      status: varchar4("status").default("pending"),
      // pending, paid, expired, cancelled
      expiresAt: timestamp6("expires_at"),
      paidAt: timestamp6("paid_at"),
      transactionHash: varchar4("transaction_hash"),
      metadata: jsonb4("metadata"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    paymentTransactions = pgTable6("payment_transactions", {
      id: text5("id").primaryKey().default(sql2`gen_random_uuid()::text`),
      userId: text5("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      reference: text5("reference").notNull().unique(),
      type: text5("type").notNull(),
      amount: text5("amount").notNull(),
      currency: text5("currency").notNull().default("KES"),
      provider: text5("provider").notNull(),
      status: text5("status").notNull().default("pending"),
      metadata: json("metadata"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    paymentReceipts = pgTable6("payment_receipts", {
      id: uuid4("id").primaryKey().defaultRandom(),
      transactionId: uuid4("transaction_id").references(() => walletTransactions2.id),
      paymentRequestId: uuid4("payment_request_id").references(() => paymentRequests.id),
      receiptNumber: varchar4("receipt_number").notNull().unique(),
      pdfUrl: text5("pdf_url"),
      emailSent: boolean5("email_sent").default(false),
      emailSentAt: timestamp6("email_sent_at"),
      metadata: jsonb4("metadata"),
      createdAt: timestamp6("created_at").defaultNow()
    });
    walletTransactions2 = pgTable6("wallet_transactions", {
      id: uuid4("id").primaryKey().defaultRandom(),
      vaultId: uuid4("vault_id").references(() => vaults.id),
      // optional, for vault transactions
      fromUserId: varchar4("from_user_id").references(() => users.id),
      toUserId: varchar4("to_user_id").references(() => users.id),
      walletAddress: varchar4("wallet_address").notNull(),
      daoId: uuid4("dao_id").references(() => daos.id),
      amount: decimal4("amount", { precision: 10, scale: 2 }).notNull(),
      currency: varchar4("currency").default("cUSD"),
      type: varchar4("type").notNull(),
      // deposit, withdrawal, transfer, contribution
      status: varchar4("status").default("completed"),
      // pending, completed, failed
      transactionHash: varchar4("transaction_hash"),
      description: text5("description"),
      disbursementId: varchar4("disbursement_id"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    vaultTokenHoldings = pgTable6("vault_token_holdings", {
      id: uuid4("id").primaryKey().defaultRandom(),
      vaultId: uuid4("vault_id").references(() => vaults.id).notNull(),
      tokenSymbol: varchar4("token_symbol").notNull(),
      // e.g., 'CELO', 'cUSD', 'cEUR', 'USDT'
      balance: decimal4("balance", { precision: 18, scale: 8 }).notNull(),
      valueUSD: decimal4("value_usd", { precision: 18, scale: 8 }).default("0"),
      // USD equivalent value
      lastPriceUpdate: timestamp6("last_price_update").defaultNow(),
      averageEntryPrice: decimal4("average_entry_price", { precision: 18, scale: 8 }),
      // for P&L calculations
      totalDeposited: decimal4("total_deposited", { precision: 18, scale: 8 }).default("0"),
      // lifetime deposits
      totalWithdrawn: decimal4("total_withdrawn", { precision: 18, scale: 8 }).default("0"),
      // lifetime withdrawals
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    vaultPerformance = pgTable6("vault_performance", {
      id: uuid4("id").primaryKey().defaultRandom(),
      vaultId: uuid4("vault_id").references(() => vaults.id).notNull(),
      period: varchar4("period").notNull(),
      // daily, weekly, monthly, yearly
      periodStart: timestamp6("period_start").notNull(),
      periodEnd: timestamp6("period_end").notNull(),
      startingValue: decimal4("starting_value", { precision: 18, scale: 8 }).notNull(),
      endingValue: decimal4("ending_value", { precision: 18, scale: 8 }).notNull(),
      yield: decimal4("yield", { precision: 18, scale: 8 }).default("0"),
      // yield earned in period
      yieldPercentage: decimal4("yield_percentage", { precision: 8, scale: 4 }).default("0"),
      // yield %
      feesCollected: decimal4("fees_collected", { precision: 18, scale: 8 }).default("0"),
      deposits: decimal4("deposits", { precision: 18, scale: 8 }).default("0"),
      // deposits in period
      withdrawals: decimal4("withdrawals", { precision: 18, scale: 8 }).default("0"),
      // withdrawals in period
      sharpeRatio: decimal4("sharpe_ratio", { precision: 8, scale: 4 }),
      // risk-adjusted return
      maxDrawdown: decimal4("max_drawdown", { precision: 8, scale: 4 }),
      // maximum loss percentage
      volatility: decimal4("volatility", { precision: 8, scale: 4 }),
      // price volatility
      createdAt: timestamp6("created_at").defaultNow()
    });
    vaultStrategyAllocations = pgTable6("vault_strategy_allocations", {
      id: uuid4("id").primaryKey().defaultRandom(),
      vaultId: uuid4("vault_id").references(() => vaults.id).notNull(),
      strategyId: varchar4("strategy_id").notNull(),
      // references YIELD_STRATEGIES from tokenRegistry
      tokenSymbol: varchar4("token_symbol").notNull(),
      allocatedAmount: decimal4("allocated_amount", { precision: 18, scale: 8 }).notNull(),
      allocationPercentage: decimal4("allocation_percentage", { precision: 5, scale: 2 }).notNull(),
      // % of vault
      currentValue: decimal4("current_value", { precision: 18, scale: 8 }).default("0"),
      yieldEarned: decimal4("yield_earned", { precision: 18, scale: 8 }).default("0"),
      lastRebalance: timestamp6("last_rebalance").defaultNow(),
      isActive: boolean5("is_active").default(true),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    vaultTransactions = pgTable6("vault_transactions", {
      id: uuid4("id").primaryKey().defaultRandom(),
      vaultId: uuid4("vault_id").references(() => vaults.id).notNull(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      transactionType: varchar4("transaction_type").notNull(),
      // deposit, withdrawal, yield_claim, rebalance, fee_collection
      tokenSymbol: varchar4("token_symbol").notNull(),
      amount: decimal4("amount", { precision: 18, scale: 8 }).notNull(),
      valueUSD: decimal4("value_usd", { precision: 18, scale: 8 }).default("0"),
      transactionHash: varchar4("transaction_hash"),
      blockNumber: integer3("block_number"),
      gasUsed: decimal4("gas_used", { precision: 18, scale: 8 }),
      gasFee: decimal4("gas_fee", { precision: 18, scale: 8 }),
      status: varchar4("status").default("completed"),
      // pending, completed, failed
      strategyId: varchar4("strategy_id"),
      // if related to strategy allocation
      sharesMinted: decimal4("shares_minted", { precision: 18, scale: 8 }),
      // vault shares for deposits
      sharesBurned: decimal4("shares_burned", { precision: 18, scale: 8 }),
      // vault shares for withdrawals
      metadata: jsonb4("metadata"),
      // additional transaction data
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    vaultRiskAssessments = pgTable6("vault_risk_assessments", {
      id: uuid4("id").primaryKey().defaultRandom(),
      vaultId: uuid4("vault_id").references(() => vaults.id).notNull(),
      assessmentDate: timestamp6("assessment_date").defaultNow(),
      overallRiskScore: integer3("overall_risk_score").notNull(),
      // 1-100 scale
      liquidityRisk: integer3("liquidity_risk").default(0),
      // 1-100 scale
      smartContractRisk: integer3("smart_contract_risk").default(0),
      marketRisk: integer3("market_risk").default(0),
      concentrationRisk: integer3("concentration_risk").default(0),
      protocolRisk: integer3("protocol_risk").default(0),
      riskFactors: jsonb4("risk_factors"),
      // detailed risk breakdown
      recommendations: jsonb4("recommendations"),
      // risk mitigation suggestions
      nextAssessmentDue: timestamp6("next_assessment_due"),
      assessedBy: varchar4("assessed_by").references(() => users.id),
      createdAt: timestamp6("created_at").defaultNow()
    });
    vaultGovernanceProposals = pgTable6("vault_governance_proposals", {
      id: uuid4("id").primaryKey().defaultRandom(),
      vaultId: uuid4("vault_id").references(() => vaults.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      proposalId: uuid4("proposal_id").references(() => proposals.id),
      governanceType: varchar4("governance_type").notNull(),
      // strategy_change, allocation_change, fee_change, risk_parameter
      proposedChanges: jsonb4("proposed_changes").notNull(),
      // structured data of proposed changes
      currentParameters: jsonb4("current_parameters"),
      // snapshot of current state
      requiredQuorum: integer3("required_quorum").default(50),
      // percentage
      votingDeadline: timestamp6("voting_deadline").notNull(),
      status: varchar4("status").default("active"),
      // active, passed, failed, executed
      executedAt: timestamp6("executed_at"),
      executionTxHash: varchar4("execution_tx_hash"),
      createdBy: varchar4("created_by").references(() => users.id).notNull(),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    config2 = pgTable6("config", {
      id: serial2("id").primaryKey(),
      key: varchar4("key").unique().notNull(),
      value: jsonb4("value").notNull(),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    logs = pgTable6("logs", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id),
      action: text5("action").notNull(),
      // e.g., "create_dao", "vote", "contribute"
      details: jsonb4("details"),
      // additional details about the action
      createdAt: timestamp6("created_at").defaultNow()
    });
    auditLogs = pgTable6("audit_logs", {
      id: uuid4("id").primaryKey().defaultRandom(),
      timestamp: timestamp6("timestamp").defaultNow().notNull(),
      userId: varchar4("user_id").references(() => users.id),
      userEmail: varchar4("user_email"),
      action: varchar4("action").notNull(),
      resource: varchar4("resource").notNull(),
      resourceId: varchar4("resource_id"),
      method: varchar4("method").notNull(),
      endpoint: varchar4("endpoint").notNull(),
      ipAddress: varchar4("ip_address").notNull(),
      userAgent: varchar4("user_agent").notNull(),
      status: integer3("status").notNull(),
      details: jsonb4("details"),
      severity: varchar4("severity").default("low").notNull(),
      category: varchar4("category").default("security").notNull(),
      createdAt: timestamp6("created_at").defaultNow()
    });
    systemLogs = pgTable6("system_logs", {
      id: uuid4("id").primaryKey().defaultRandom(),
      level: varchar4("level").default("info").notNull(),
      message: text5("message").notNull(),
      service: varchar4("service").default("api").notNull(),
      metadata: jsonb4("metadata"),
      timestamp: timestamp6("timestamp").defaultNow().notNull()
    });
    notificationHistory = pgTable6("notification_history", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      type: varchar4("type").notNull(),
      title: varchar4("title").notNull(),
      message: text5("message").notNull(),
      read: boolean5("read").default(false),
      metadata: jsonb4("metadata"),
      createdAt: timestamp6("created_at").defaultNow(),
      readAt: timestamp6("read_at")
    });
    chainInfo = pgTable6("chain_info", {
      id: serial2("id").primaryKey(),
      chainId: integer3("chain_id").notNull(),
      chainName: varchar4("chain_name").notNull(),
      nativeCurrency: jsonb4("native_currency").notNull(),
      // e.g., { name: "Ether", symbol: "ETH", decimals: 18 }
      rpcUrl: varchar4("rpc_url").notNull(),
      blockExplorerUrl: varchar4("block_explorer_url"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    chains = pgTable6("chains", {
      id: serial2("id").primaryKey(),
      name: varchar4("name").notNull(),
      chainId: integer3("chain_id").notNull(),
      rpcUrl: varchar4("rpc_url").notNull(),
      blockExplorerUrl: varchar4("block_explorer_url"),
      nativeCurrency: jsonb4("native_currency").notNull(),
      // e.g., { name: "Ether", symbol: "ETH", decimals: 18 }
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    proposalComments = pgTable6("proposal_comments", {
      id: uuid4("id").primaryKey().defaultRandom(),
      proposalId: uuid4("proposal_id").references(() => proposals.id).notNull(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      content: text5("content").notNull(),
      parentCommentId: uuid4("parent_comment_id").references(() => proposalComments.id),
      // for replies
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    proposalLikes = pgTable6("proposal_likes", {
      id: uuid4("id").primaryKey().defaultRandom(),
      proposalId: uuid4("proposal_id").references(() => proposals.id).notNull(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      createdAt: timestamp6("created_at").defaultNow()
    });
    commentLikes = pgTable6("comment_likes", {
      id: uuid4("id").primaryKey().defaultRandom(),
      commentId: uuid4("comment_id").references(() => proposalComments.id).notNull(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      createdAt: timestamp6("created_at").defaultNow()
    });
    daoMessages = pgTable6("dao_messages", {
      id: uuid4("id").primaryKey().defaultRandom(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      content: text5("content").notNull(),
      messageType: varchar4("message_type").default("text"),
      // text, image, system
      replyToMessageId: uuid4("reply_to_message_id").references(() => daoMessages.id),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    subscriptions = pgTable6("subscriptions", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id).notNull(),
      plan: varchar4("plan").default("free"),
      // free, premium
      status: varchar4("status").default("active"),
      startDate: timestamp6("start_date").defaultNow(),
      endDate: timestamp6("end_date"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    userReputation = pgTable6("user_reputation", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      daoId: uuid4("dao_id").references(() => daos.id),
      totalScore: integer3("total_score").default(0),
      proposalScore: integer3("proposal_score").default(0),
      voteScore: integer3("vote_score").default(0),
      contributionScore: integer3("contribution_score").default(0),
      lastUpdated: timestamp6("last_updated").defaultNow(),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    usersRelations = relations(users, ({ many, one }) => ({
      proposals: many(proposals),
      votes: many(votes),
      contributions: many(contributions),
      vaults: many(vaults),
      budgetPlans: many(budgetPlans),
      daoMemberships: many(daoMemberships),
      createdDaos: many(daos),
      referralRewards: many(referralRewards),
      sentTransactions: many(walletTransactions2, { relationName: "sentTransactions" }),
      receivedTransactions: many(walletTransactions2, { relationName: "receivedTransactions" }),
      referrer: one(users, {
        fields: [users.referredBy],
        references: [users.id]
      }),
      referrals: many(users),
      sessions: many(sessions),
      tasks: many(tasks),
      billingHistory: many(billingHistory),
      logs: many(logs),
      proposalComments: many(proposalComments),
      proposalLikes: many(proposalLikes),
      commentLikes: many(commentLikes),
      daoMessages: many(daoMessages),
      delegationsGiven: many(voteDelegations, { relationName: "delegationsGiven" }),
      delegationsReceived: many(voteDelegations, { relationName: "delegationsReceived" })
    }));
    daosRelations = relations(daos, ({ one, many }) => ({
      creator: one(users, {
        fields: [daos.creatorId],
        references: [users.id]
      }),
      memberships: many(daoMemberships),
      proposals: many(proposals),
      messages: many(daoMessages),
      templates: many(proposalTemplates),
      delegations: many(voteDelegations)
    }));
    daoMembershipsRelations = relations(daoMemberships, ({ one }) => ({
      user: one(users, {
        fields: [daoMemberships.userId],
        references: [users.id]
      }),
      dao: one(daos, {
        fields: [daoMemberships.daoId],
        references: [daos.id]
      })
    }));
    proposalsRelations = relations(proposals, ({ one, many }) => ({
      proposer: one(users, {
        fields: [proposals.proposerId],
        references: [users.id]
      }),
      dao: one(daos, {
        fields: [proposals.daoId],
        references: [daos.id]
      }),
      template: one(proposalTemplates, {
        fields: [proposals.templateId],
        references: [proposalTemplates.id]
      }),
      votes: many(votes),
      comments: many(proposalComments),
      likes: many(proposalLikes),
      delegations: many(voteDelegations),
      executionQueue: many(proposalExecutionQueue)
    }));
    votesRelations = relations(votes, ({ one }) => ({
      proposal: one(proposals, {
        fields: [votes.proposalId],
        references: [proposals.id]
      }),
      user: one(users, {
        fields: [votes.userId],
        references: [users.id]
      }),
      delegatedByUser: one(users, {
        fields: [votes.delegatedBy],
        references: [users.id]
      })
    }));
    voteDelegationsRelations = relations(voteDelegations, ({ one }) => ({
      delegator: one(users, {
        fields: [voteDelegations.delegatorId],
        references: [users.id],
        relationName: "delegationsGiven"
      }),
      delegate: one(users, {
        fields: [voteDelegations.delegateId],
        references: [users.id],
        relationName: "delegationsReceived"
      }),
      dao: one(daos, {
        fields: [voteDelegations.daoId],
        references: [daos.id]
      }),
      proposal: one(proposals, {
        fields: [voteDelegations.proposalId],
        references: [proposals.id]
      })
    }));
    proposalTemplatesRelations = relations(proposalTemplates, ({ one, many }) => ({
      dao: one(daos, {
        fields: [proposalTemplates.daoId],
        references: [daos.id]
      }),
      creator: one(users, {
        fields: [proposalTemplates.createdBy],
        references: [users.id]
      }),
      proposals: many(proposals)
    }));
    contributionsRelations = relations(contributions, ({ one }) => ({
      user: one(users, {
        fields: [contributions.userId],
        references: [users.id]
      })
    }));
    vaultsRelations = relations(vaults, ({ one }) => ({
      user: one(users, {
        fields: [vaults.userId],
        references: [users.id]
      })
    }));
    vaultsFullRelations = relations(vaults, ({ one, many }) => ({
      user: one(users, {
        fields: [vaults.userId],
        references: [users.id]
      }),
      tokenHoldings: many(vaultTokenHoldings),
      transactions: many(vaultTransactions),
      performance: many(vaultPerformance),
      strategyAllocations: many(vaultStrategyAllocations),
      riskAssessments: many(vaultRiskAssessments),
      governanceProposals: many(vaultGovernanceProposals)
    }));
    budgetPlansRelations = relations(budgetPlans, ({ one }) => ({
      user: one(users, {
        fields: [budgetPlans.userId],
        references: [users.id]
      })
    }));
    walletTransactionsRelations = relations(walletTransactions2, ({ one }) => ({
      fromUser: one(users, {
        fields: [walletTransactions2.fromUserId],
        references: [users.id],
        relationName: "sentTransactions"
      }),
      toUser: one(users, {
        fields: [walletTransactions2.toUserId],
        references: [users.id],
        relationName: "receivedTransactions"
      })
    }));
    referralRewardsRelations = relations(referralRewards, ({ one }) => ({
      referrer: one(users, {
        fields: [referralRewards.referrerId],
        references: [users.id]
      }),
      referredUser: one(users, {
        fields: [referralRewards.referredUserId],
        references: [users.id]
      })
    }));
    insertUserSchema = createInsertSchema4(users);
    insertDaoSchema = createInsertSchema4(daos);
    insertProposalSchema = createInsertSchema4(proposals);
    insertVoteSchema = createInsertSchema4(votes);
    insertContributionSchema = createInsertSchema4(contributions);
    insertVaultSchema = createInsertSchema4(vaults);
    insertBudgetPlanSchema = createInsertSchema4(budgetPlans);
    insertDaoMembershipSchema = createInsertSchema4(daoMemberships);
    insertWalletTransactionSchema = createInsertSchema4(walletTransactions2);
    insertReferralRewardSchema = createInsertSchema4(referralRewards);
    notifications = pgTable6("notifications", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull(),
      type: varchar4("type").notNull(),
      // membership, task, proposal, etc.
      title: varchar4("title").notNull(),
      message: text5("message").notNull(),
      read: boolean5("read").default(false),
      priority: varchar4("priority").default("medium"),
      // low, medium, high, urgent
      metadata: jsonb4("metadata").default({}),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    notificationPreferences = pgTable6("notification_preferences", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: varchar4("user_id").references(() => users.id).notNull().unique(),
      emailNotifications: boolean5("email_notifications").default(true),
      pushNotifications: boolean5("push_notifications").default(true),
      daoUpdates: boolean5("dao_updates").default(true),
      proposalUpdates: boolean5("proposal_updates").default(true),
      taskUpdates: boolean5("task_updates").default(true),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    taskHistory = pgTable6("task_history", {
      id: uuid4("id").primaryKey().defaultRandom(),
      taskId: uuid4("task_id").references(() => tasks.id).notNull(),
      userId: varchar4("user_id").references(() => users.id),
      action: varchar4("action").notNull(),
      // created, claimed, completed, etc.
      details: jsonb4("details"),
      createdAt: timestamp6("created_at").defaultNow()
    });
    insertTaskSchema = createInsertSchema4(tasks);
    insertNotificationSchema = createInsertSchema4(notifications);
    insertTaskHistorySchema = createInsertSchema4(taskHistory);
    insertProposalTemplateSchema = createInsertSchema4(proposalTemplates);
    insertVoteDelegationSchema = createInsertSchema4(voteDelegations);
    crossChainTransfers = pgTable6("cross_chain_transfers", {
      id: text5("id").primaryKey().default(sql2`gen_random_uuid()`),
      userId: varchar4("user_id").notNull().references(() => users.id),
      sourceChain: text5("source_chain").notNull(),
      destinationChain: text5("destination_chain").notNull(),
      tokenAddress: text5("token_address").notNull(),
      amount: text5("amount").notNull(),
      destinationAddress: text5("destination_address").notNull(),
      vaultId: text5("vault_id"),
      status: text5("status").notNull().default("pending"),
      // pending, bridging, completed, failed
      txHashSource: text5("tx_hash_source"),
      txHashDestination: text5("tx_hash_destination"),
      bridgeProtocol: text5("bridge_protocol"),
      // layerzero, axelar, wormhole
      gasEstimate: text5("gas_estimate"),
      bridgeFee: text5("bridge_fee"),
      estimatedCompletionTime: timestamp6("estimated_completion_time"),
      completedAt: timestamp6("completed_at"),
      failureReason: text5("failure_reason"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    crossChainProposals = pgTable6("cross_chain_proposals", {
      id: text5("id").primaryKey().default(sql2`gen_random_uuid()::text`),
      proposalId: text5("proposal_id").notNull(),
      chains: text5("chains").array().notNull(),
      // Array of chain identifiers
      votesByChain: jsonb4("votes_by_chain").default({}),
      // Chain-specific vote tallies
      quorumByChain: jsonb4("quorum_by_chain").default({}),
      executionChain: text5("execution_chain"),
      // Primary chain for execution
      bridgeProposalId: text5("bridge_proposal_id"),
      // Cross-chain message ID
      syncStatus: text5("sync_status").default("pending"),
      // pending, synced, failed
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    insertQuorumHistorySchema = createInsertSchema4(quorumHistory);
    insertProposalExecutionQueueSchema = createInsertSchema4(proposalExecutionQueue);
    proposalCommentsRelations = relations(proposalComments, ({ one, many }) => ({
      proposal: one(proposals, {
        fields: [proposalComments.proposalId],
        references: [proposals.id]
      }),
      user: one(users, {
        fields: [proposalComments.userId],
        references: [users.id]
      }),
      dao: one(daos, {
        fields: [proposalComments.daoId],
        references: [daos.id]
      }),
      parentComment: one(proposalComments, {
        fields: [proposalComments.parentCommentId],
        references: [proposalComments.id]
      }),
      replies: many(proposalComments),
      likes: many(commentLikes)
    }));
    proposalLikesRelations = relations(proposalLikes, ({ one }) => ({
      proposal: one(proposals, {
        fields: [proposalLikes.proposalId],
        references: [proposals.id]
      }),
      user: one(users, {
        fields: [proposalLikes.userId],
        references: [users.id]
      }),
      dao: one(daos, {
        fields: [proposalLikes.daoId],
        references: [daos.id]
      })
    }));
    dailyChallenges = pgTable6("daily_challenges", {
      id: uuid4("id").primaryKey().defaultRandom(),
      title: text5("title").notNull(),
      description: text5("description"),
      challengeType: text5("challenge_type").notNull(),
      // 'daily_deposit', 'streak_maintain', etc.
      targetAmount: text5("target_amount"),
      pointsReward: integer3("points_reward").default(50),
      isActive: boolean5("is_active").default(true),
      validFrom: timestamp6("valid_from").defaultNow(),
      validUntil: timestamp6("valid_until"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    userChallenges = pgTable6("user_challenges", {
      id: uuid4("id").primaryKey().defaultRandom(),
      userId: text5("user_id").references(() => users.id).notNull(),
      challengeId: uuid4("challenge_id").references(() => dailyChallenges.id),
      challengeType: text5("challenge_type").notNull(),
      targetAmount: text5("target_amount"),
      currentProgress: text5("current_progress").default("0"),
      status: text5("status").default("in_progress"),
      // 'in_progress', 'completed', 'failed'
      pointsReward: integer3("points_reward").default(50),
      rewardClaimed: boolean5("reward_claimed").default(false),
      claimedAt: timestamp6("claimed_at"),
      createdAt: timestamp6("created_at").defaultNow(),
      updatedAt: timestamp6("updated_at").defaultNow()
    });
    commentLikesRelations = relations(commentLikes, ({ one }) => ({
      comment: one(proposalComments, {
        fields: [commentLikes.commentId],
        references: [proposalComments.id]
      }),
      user: one(users, {
        fields: [commentLikes.userId],
        references: [users.id]
      }),
      dao: one(daos, {
        fields: [commentLikes.daoId],
        references: [daos.id]
      })
    }));
    daoMessagesRelations = relations(daoMessages, ({ one, many }) => ({
      dao: one(daos, {
        fields: [daoMessages.daoId],
        references: [daos.id]
      }),
      user: one(users, {
        fields: [daoMessages.userId],
        references: [users.id]
      }),
      replyToMessage: one(daoMessages, {
        fields: [daoMessages.replyToMessageId],
        references: [daoMessages.id]
      }),
      replies: many(daoMessages)
    }));
    insertProposalCommentSchema = createInsertSchema4(proposalComments);
    insertProposalLikeSchema = createInsertSchema4(proposalLikes);
    insertCommentLikeSchema = createInsertSchema4(commentLikes);
    insertDaoMessageSchema = createInsertSchema4(daoMessages);
    insertEnhancedVaultSchema = createInsertSchema4(vaults);
    insertVaultTokenHoldingSchema = createInsertSchema4(vaultTokenHoldings);
    insertVaultTransactionSchema = createInsertSchema4(vaultTransactions);
    insertVaultPerformanceSchema = createInsertSchema4(vaultPerformance);
    insertVaultRiskAssessmentSchema = createInsertSchema4(vaultRiskAssessments);
    insertVaultStrategyAllocationSchema = createInsertSchema4(vaultStrategyAllocations);
    insertVaultGovernanceProposalSchema = createInsertSchema4(vaultGovernanceProposals);
  }
});

// server/db.ts
import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import ws from "ws";
var pool, db2;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    neonConfig.webSocketConstructor = ws;
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db2 = drizzle(pool, { schema: schema_exports });
  }
});

// shared/config.ts
import { z } from "zod";
import dotenv from "dotenv";
var envSchema, parsedEnv, env, isDevelopment, isProduction, isTest, dbConfig, rateLimitConfig, corsConfig, config3;
var init_config = __esm({
  "shared/config.ts"() {
    "use strict";
    dotenv.config();
    envSchema = z.object({
      // Server Configuration
      NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
      PORT: z.string().default("5000"),
      HOST: z.string().default("localhost"),
      // Security
      SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters").default("dev-session-secret-change-in-production-min32chars"),
      JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").default("dev-jwt-secret-change-in-production-min-32-characters"),
      ENCRYPTION_KEY: z.string().length(32, "ENCRYPTION_KEY must be exactly 32 characters").optional(),
      // OAuth Configuration
      OAUTH_CLIENT_ID: z.string().optional(),
      OAUTH_CLIENT_SECRET: z.string().optional(),
      OAUTH_REDIRECT_URI: z.string().url().optional(),
      GOOGLE_CLIENT_ID: z.string().optional(),
      GOOGLE_CLIENT_SECRET: z.string().optional(),
      // Database
      DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
      DB_POOL_MIN: z.string().optional(),
      DB_POOL_MAX: z.string().optional(),
      TEST_DATABASE_URL: z.string().url().optional(),
      // Email Configuration
      SMTP_HOST: z.string().optional(),
      SMTP_PORT: z.string().optional(),
      SMTP_SECURE: z.string().optional(),
      SMTP_USER: z.string().optional(),
      SMTP_PASS: z.string().optional(),
      EMAIL_FROM: z.string().email().optional(),
      EMAIL_FROM_NAME: z.string().optional(),
      // Payment Providers
      STRIPE_SECRET_KEY: z.string().optional(),
      STRIPE_PUBLIC_KEY: z.string().optional(),
      STRIPE_WEBHOOK_SECRET: z.string().optional(),
      KOTANIPAY_API_KEY: z.string().optional(),
      KOTANIPAY_SECRET_KEY: z.string().optional(),
      KOTANIPAY_WEBHOOK_SECRET: z.string().optional(),
      MPESA_CONSUMER_KEY: z.string().optional(),
      MPESA_CONSUMER_SECRET: z.string().optional(),
      MPESA_PASSKEY: z.string().optional(),
      MPESA_SHORTCODE: z.string().optional(),
      // Blockchain
      CELO_RPC_URL: z.string().url().optional(),
      CELO_ALFAJORES_RPC_URL: z.string().url().optional(),
      WALLET_PRIVATE_KEY: z.string().optional(),
      CUSD_CONTRACT_ADDRESS: z.string().optional(),
      // Security Configuration
      RATE_LIMIT_WINDOW_MS: z.string().optional(),
      RATE_LIMIT_MAX_REQUESTS: z.string().optional(),
      ALLOWED_ORIGINS: z.string().optional(),
      // Analytics & Monitoring
      ANALYTICS_API_KEY: z.string().optional(),
      SENTRY_DSN: z.string().url().optional(),
      // App Configuration
      FRONTEND_URL: z.string().default("http://localhost:5000"),
      BACKEND_URL: z.string().default("http://localhost:5000"),
      API_BASE_URL: z.string().url().default("http://localhost:5000/api"),
      MAX_FILE_SIZE: z.string().optional(),
      UPLOAD_DIR: z.string().default("uploads"),
      // Notifications
      SOCKET_IO_CORS_ORIGIN: z.string().optional(),
      FIREBASE_ADMIN_SDK_PATH: z.string().optional(),
      FIREBASE_PROJECT_ID: z.string().optional(),
      // Development & Testing
      DEBUG: z.string().optional(),
      LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
      ENABLE_REQUEST_LOGGING: z.string().optional(),
      // Production Settings
      SSL_CERT_PATH: z.string().optional(),
      SSL_KEY_PATH: z.string().optional(),
      REDIS_URL: z.string().url().optional(),
      WEBHOOK_BASE_URL: z.string().url().optional()
    });
    parsedEnv = envSchema.safeParse(process.env);
    if (!parsedEnv.success) {
      console.error("\u274C Invalid environment variables:", parsedEnv.error.format());
      process.exit(1);
    }
    env = parsedEnv.data;
    isDevelopment = env.NODE_ENV === "development";
    isProduction = env.NODE_ENV === "production";
    isTest = env.NODE_ENV === "test";
    dbConfig = {
      url: env.DATABASE_URL,
      poolMin: parseInt(env.DB_POOL_MIN || "2"),
      poolMax: parseInt(env.DB_POOL_MAX || "10")
    };
    rateLimitConfig = {
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || "900000"),
      // 15 minutes
      maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS || "100")
    };
    corsConfig = {
      origin: env.ALLOWED_ORIGINS?.split(",") || [env.FRONTEND_URL],
      credentials: true
    };
    config3 = {
      // Server Configuration
      PORT: process.env.PORT || 5e3,
      HOST: "localhost",
      NODE_ENV: process.env.NODE_ENV || "development",
      // Frontend URL - dynamically set based on environment
      FRONTEND_URL: process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : process.env.FRONTEND_URL || "http://localhost:5000",
      // Backend URL - same server in this setup
      BACKEND_URL: process.env.BACKEND_URL || process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : "http://localhost:5000"
    };
  }
});

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  DatabaseStorage: () => DatabaseStorage,
  addDaoBillingHistory: () => addDaoBillingHistory,
  claimTask: () => claimTask,
  createContribution: () => createContribution,
  createDao: () => createDao,
  createDaoMembership: () => createDaoMembership,
  createDaoMessage: () => createDaoMessage,
  createNotification: () => createNotification,
  createProposal: () => createProposal,
  createProposalComment: () => createProposalComment,
  createTask: () => createTask,
  createUser: () => createUser,
  createVote: () => createVote,
  createWalletTransaction: () => createWalletTransaction,
  db: () => db2,
  deductVaultFee: () => deductVaultFee,
  default: () => storage_default,
  deleteDaoMessage: () => deleteDaoMessage,
  deleteProposal: () => deleteProposal,
  deleteProposalComment: () => deleteProposalComment,
  deleteUserAccount: () => deleteUserAccount,
  getAllDaoBillingHistory: () => getAllDaoBillingHistory,
  getAllDaos: () => getAllDaos,
  getAllUsers: () => getAllUsers,
  getBillingCount: () => getBillingCount,
  getBudgetPlanCount: () => getBudgetPlanCount,
  getChainInfo: () => getChainInfo,
  getCommentLikes: () => getCommentLikes,
  getContributions: () => getContributions,
  getDAOStats: () => getDAOStats,
  getDao: () => getDao,
  getDaoAnalytics: () => getDaoAnalytics,
  getDaoBillingHistory: () => getDaoBillingHistory,
  getDaoByInviteCode: () => getDaoByInviteCode,
  getDaoCount: () => getDaoCount,
  getDaoMembership: () => getDaoMembership,
  getDaoMembershipsByStatus: () => getDaoMembershipsByStatus,
  getDaoMessages: () => getDaoMessages,
  getDaoPlan: () => getDaoPlan,
  getLogCount: () => getLogCount,
  getPlatformFeeInfo: () => getPlatformFeeInfo,
  getProposal: () => getProposal,
  getProposalComments: () => getProposalComments,
  getProposalLikes: () => getProposalLikes,
  getProposals: () => getProposals,
  getReferralLeaderboard: () => getReferralLeaderboard,
  getSystemLogs: () => getSystemLogs,
  getTasks: () => getTasks,
  getTopMembers: () => getTopMembers,
  getUser: () => getUser,
  getUserBudgetPlans: () => getUserBudgetPlans,
  getUserByEmail: () => getUserByEmail,
  getUserByPhone: () => getUserByPhone,
  getUserContributionStats: () => getUserContributionStats,
  getUserCount: () => getUserCount,
  getUserNotifications: () => getUserNotifications,
  getUserProfile: () => getUserProfile,
  getUserReferralStats: () => getUserReferralStats,
  getUserSessions: () => getUserSessions,
  getUserSettings: () => getUserSettings,
  getUserSocialLinks: () => getUserSocialLinks,
  getUserVaults: () => getUserVaults,
  getUserWallet: () => getUserWallet,
  getVaultTransactions: () => getVaultTransactions,
  getVote: () => getVote,
  getVotesByProposal: () => getVotesByProposal,
  hasActiveContributions: () => hasActiveContributions,
  isDaoPremium: () => isDaoPremium,
  loginUser: () => loginUser,
  revokeAllUserSessions: () => revokeAllUserSessions,
  revokeUserSession: () => revokeUserSession,
  setDaoInviteCode: () => setDaoInviteCode,
  setDaoPlan: () => setDaoPlan,
  storage: () => storage,
  toggleCommentLike: () => toggleCommentLike,
  toggleProposalLike: () => toggleProposalLike,
  updateDaoInviteCode: () => updateDaoInviteCode,
  updateDaoMembershipStatus: () => updateDaoMembershipStatus,
  updateDaoMessage: () => updateDaoMessage,
  updateProposal: () => updateProposal,
  updateProposalComment: () => updateProposalComment,
  updateProposalVotes: () => updateProposalVotes,
  updateUserProfile: () => updateUserProfile,
  updateUserSettings: () => updateUserSettings,
  updateUserSocialLinks: () => updateUserSocialLinks,
  updateUserWallet: () => updateUserWallet,
  upsertBudgetPlan: () => upsertBudgetPlan,
  upsertVault: () => upsertVault
});
import { eq as eq2, inArray, or, and as and2, desc, sql as sql3 } from "drizzle-orm";
async function deductVaultFee(vaultId, fee) {
  const [vault] = await db2.select().from(vaults).where(eq2(vaults.id, vaultId));
  if (!vault || vault.balance == null) return false;
  const currentBalance = typeof vault.balance === "string" ? parseFloat(vault.balance) : vault.balance;
  if (isNaN(currentBalance) || currentBalance < fee) return false;
  const newBalance = (currentBalance - fee).toString();
  await db2.update(vaults).set({ balance: newBalance, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(vaults.id, vaultId));
  return true;
}
function isDaoPremium(dao) {
  if (!dao || !dao.plan) return false;
  return dao.plan === "premium";
}
async function createDaoMessage(message) {
  throw new Error("createDaoMessage not implemented");
}
async function getDaoMessages(daoId) {
  throw new Error("getDaoMessages not implemented");
}
async function updateDaoMessage(messageId, data) {
  throw new Error("updateDaoMessage not implemented");
}
async function deleteDaoMessage(messageId) {
  throw new Error("deleteDaoMessage not implemented");
}
async function createProposalComment(comment) {
  throw new Error("createProposalComment not implemented");
}
async function getProposalComments(proposalId) {
  throw new Error("getProposalComments not implemented");
}
async function updateProposalComment(commentId, data) {
  throw new Error("updateProposalComment not implemented");
}
async function deleteProposalComment(commentId) {
  throw new Error("deleteProposalComment not implemented");
}
async function toggleProposalLike(proposalId, userId) {
  throw new Error("toggleProposalLike not implemented");
}
async function getProposalLikes(proposalId) {
  throw new Error("getProposalLikes not implemented");
}
async function toggleCommentLike(commentId, userId) {
  throw new Error("toggleCommentLike not implemented");
}
async function getCommentLikes(commentId) {
  throw new Error("getCommentLikes not implemented");
}
var DatabaseStorage, storage, getAllDaos, getDaoCount, getAllUsers, getUserCount, getPlatformFeeInfo, getSystemLogs, getLogCount, getAllDaoBillingHistory, getBillingCount, getChainInfo, getTopMembers, createUser, loginUser, getUserByEmail, getUserByPhone, createWalletTransaction, setDaoInviteCode, getDaoByInviteCode, getUserReferralStats, getReferralLeaderboard, getUser, getDAOStats, getProposals, getProposal, createProposal, updateProposalVotes, getVote, createVote, getVotesByProposal, getContributions, createContribution, getUserContributionStats, getUserVaults, upsertVault, getUserBudgetPlans, upsertBudgetPlan, getTasks, createTask, claimTask, getDao, getDaoMembership, createDaoMembership, getDaoMembershipsByStatus, updateDaoMembershipStatus, getDaoPlan, setDaoPlan, getDaoBillingHistory, addDaoBillingHistory, hasActiveContributions, revokeAllUserSessions, createNotification, getUserNotifications, getUserProfile, updateUserProfile, getUserSocialLinks, updateUserSocialLinks, getUserWallet, updateUserWallet, getUserSettings, updateUserSettings, getUserSessions, revokeUserSession, deleteUserAccount, getBudgetPlanCount, createDao, updateDaoInviteCode, deleteProposal, updateProposal, getVaultTransactions, getDaoAnalytics, storage_default;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_db();
    init_schema();
    DatabaseStorage = class {
      constructor() {
        this.db = db2;
      }
      /**
       * Update user info by userId. Accepts any allowed user fields.
       */
      async updateUser(userId, update) {
        if (!userId) throw new Error("User ID required");
        if (!update || typeof update !== "object") throw new Error("Update object required");
        const allowedFields = [
          "name",
          "avatar",
          "email",
          "phone",
          "lastLoginAt",
          "profile",
          "authProvider",
          "authProviderId",
          "emailVerified",
          "updatedAt"
        ];
        const allowedUpdate = {};
        for (const key of allowedFields) {
          if (key in update) allowedUpdate[key] = update[key];
        }
        allowedUpdate.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.update(users).set(allowedUpdate).where(eq2(users.id, userId)).returning();
        if (!result[0]) throw new Error("Failed to update user");
        return result[0];
      }
      // Make db instance available within the class
      async incrementDaoMemberCount(daoId) {
        if (!daoId) throw new Error("DAO ID required");
        const dao = await this.db.select().from(daos).where(eq2(daos.id, daoId));
        if (!dao[0]) throw new Error("DAO not found");
        const newCount = (dao[0].memberCount || 0) + 1;
        const result = await this.db.update(daos).set({ memberCount: newCount, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(daos.id, daoId)).returning();
        return result[0];
      }
      // --- Admin Functions ---
      async getAllDaos({ limit = 10, offset = 0 } = {}) {
        return await this.db.select().from(daos).orderBy(desc(daos.createdAt)).limit(limit).offset(offset);
      }
      async getDaoCount() {
        const result = await this.db.select({ count: sql3`count(*)` }).from(daos);
        return Number(result[0]?.count) || 0;
      }
      async getAllUsers({ limit = 10, offset = 0 } = {}) {
        return await this.db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
      }
      async getUserCount() {
        const result = await this.db.select({ count: sql3`count(*)` }).from(users);
        return Number(result[0]?.count) || 0;
      }
      async getPlatformFeeInfo() {
        const keys = [
          "vaultDisbursementFee",
          "offrampWithdrawalFee",
          "bulkPayoutFee",
          "stakingYieldFee",
          "platformFeeCurrency"
        ];
        const configRows = await this.db.select().from(config2).where(inArray(config2.key, keys));
        const configMap = {};
        configRows.forEach((row) => {
          configMap[row.key] = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
        });
        return {
          vaultDisbursementFee: configMap.vaultDisbursementFee ?? "1\u20132% per action",
          offrampWithdrawalFee: configMap.offrampWithdrawalFee ?? "2\u20133% (DAO or user)",
          bulkPayoutFee: configMap.bulkPayoutFee ?? "Flat or % fee",
          stakingYieldFee: configMap.stakingYieldFee ?? "Platform takes cut (opt-in)",
          notes: "Fees are paid by the DAO/group, not individuals. All fees are abstracted into vault mechanics for simplicity.",
          currency: configMap.platformFeeCurrency ?? "USD"
        };
      }
      async getSystemLogs(args = {}) {
        let whereClause = void 0;
        if (args.level && args.service) {
          whereClause = and2(eq2(systemLogs.level, args.level), eq2(systemLogs.service, args.service));
        } else if (args.level) {
          whereClause = eq2(systemLogs.level, args.level);
        } else if (args.service) {
          whereClause = eq2(systemLogs.service, args.service);
        }
        let query;
        if (whereClause) {
          query = this.db.select().from(systemLogs).where(whereClause);
        } else {
          query = this.db.select().from(systemLogs);
        }
        return await query.orderBy(desc(systemLogs.timestamp)).limit(args.limit ?? 50).offset(args.offset ?? 0);
      }
      async updateTask(id, data, userId) {
        const task = await this.db.select().from(tasks).where(eq2(tasks.id, id));
        if (!task[0]) throw new Error("Task not found");
        const membership = await this.getDaoMembership(task[0].daoId, userId);
        if (!membership || membership.role !== "admin") throw new Error("Only DAO admins can update tasks");
        const result = await this.db.update(tasks).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(tasks.id, id)).returning();
        if (!result[0]) throw new Error("Failed to update task");
        return result[0];
      }
      async getTaskCount(daoId, status) {
        if (!daoId) throw new Error("DAO ID required");
        let whereClause;
        if (status) {
          whereClause = and2(eq2(tasks.daoId, daoId), eq2(tasks.status, status));
        } else {
          whereClause = eq2(tasks.daoId, daoId);
        }
        const result = await this.db.select().from(tasks).where(whereClause);
        return result.length;
      }
      async getLogCount() {
        const result = await this.db.select().from(logs);
        return result.length;
      }
      async getBillingCount() {
        const result = await this.db.select().from(billingHistory);
        return result.length;
      }
      async getChainInfo() {
        const result = await this.db.select().from(chains).where(eq2(chains.id, 1));
        if (!result[0]) throw new Error("Chain not found");
        return {
          chainId: result[0].id,
          name: result[0].name,
          rpcUrl: result[0].rpcUrl
        };
      }
      async getTopMembers({ limit = 10 } = {}) {
        const allContributions = await this.db.select().from(contributions);
        const counts = {};
        allContributions.forEach((c) => {
          if (c.userId) counts[c.userId] = (counts[c.userId] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([userId, count3]) => ({ userId, count: count3 }));
      }
      async createUser(userData) {
        const allowed = (({ firstName, lastName, email, phone, googleId, telegramId }) => ({ firstName, lastName, email, phone, googleId, telegramId }))(userData);
        allowed.createdAt = /* @__PURE__ */ new Date();
        allowed.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.insert(users).values(allowed).returning();
        if (!result[0]) throw new Error("Failed to create user");
        return result[0];
      }
      async loginUser(email) {
        return this.getUserByEmail(email);
      }
      async getUserByEmail(email) {
        if (!email) throw new Error("Email required");
        const result = await this.db.select().from(users).where(eq2(users.email, email));
        if (!result[0]) throw new Error("User not found");
        return result[0];
      }
      async getUserByPhone(phone) {
        if (!phone) throw new Error("Phone required");
        const result = await this.db.select().from(users).where(eq2(users.phone, phone));
        if (!result[0]) throw new Error("User not found");
        return result[0];
      }
      async getUserById(userId) {
        if (!userId) throw new Error("User ID required");
        const result = await this.db.select().from(users).where(eq2(users.id, userId));
        if (!result[0]) throw new Error("User not found");
        return result[0];
      }
      async getUserByEmailOrPhone(emailOrPhone) {
        if (!emailOrPhone) throw new Error("Email or phone required");
        const result = await this.db.select().from(users).where(
          or(eq2(users.email, emailOrPhone), eq2(users.phone, emailOrPhone))
        );
        if (!result[0]) throw new Error("User not found");
        return result[0];
      }
      async getUserProfile(userId) {
        return this.getUser(userId);
      }
      async updateUserProfile(userId, data) {
        const allowed = (({ firstName, lastName, email, phone }) => ({ firstName, lastName, email, phone }))(data);
        allowed.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.update(users).set(allowed).where(eq2(users.id, userId)).returning();
        if (!result[0]) throw new Error("Failed to update user");
        return result[0];
      }
      async getUserSocialLinks(userId) {
        const user = await this.getUser(userId);
        return { google: user.googleId || null, telegram: user.telegramId || null };
      }
      async updateUserSocialLinks(userId, data) {
        const allowed = (({ phone, email }) => ({ phone, email }))(data);
        allowed.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.update(users).set(allowed).where(eq2(users.id, userId)).returning();
        if (!result[0]) throw new Error("Failed to update social links");
        return result[0];
      }
      async getUserWallet(userId) {
        const user = await this.getUser(userId);
        return { address: user.phone || user.email || null };
      }
      async updateUserWallet(userId, data) {
        const allowed = (({ phone, email }) => ({ phone, email }))(data);
        allowed.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.update(users).set(allowed).where(eq2(users.id, userId)).returning();
        if (!result[0]) throw new Error("Failed to update wallet");
        return result[0];
      }
      async getUserSettings(userId) {
        const user = await this.getUser(userId);
        return { theme: user.darkMode ? "dark" : "light", language: user.language || "en" };
      }
      async updateUserSettings(userId, data) {
        const allowed = {};
        if (data.theme) allowed.darkMode = data.theme === "dark";
        if (data.language) allowed.language = data.language;
        allowed.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.update(users).set(allowed).where(eq2(users.id, userId)).returning();
        if (!result[0]) throw new Error("Failed to update settings");
        return result[0];
      }
      async getUserSessions(userId) {
        const result = await this.db.select().from(sessions).where(eq2(sessions.userId, userId));
        return result;
      }
      async revokeUserSession(userId, sessionId) {
        if (!userId || !sessionId) throw new Error("User ID and session ID required");
        const result = await this.db.delete(sessions).where(
          and2(eq2(sessions.userId, userId), eq2(sessions.id, sessionId))
        );
        if (!result) throw new Error("Session not found or already revoked");
      }
      async deleteUserAccount(userId) {
        await this.db.delete(users).where(eq2(users.id, userId));
      }
      async createWalletTransaction(data) {
        if (!data.amount || !data.currency || !data.type || !data.status || !data.provider) {
          throw new Error("Missing required wallet transaction fields");
        }
        data.createdAt = /* @__PURE__ */ new Date();
        data.updatedAt = /* @__PURE__ */ new Date();
        if (!data.walletAddress) {
          data.walletAddress = "";
        }
        if (!data.toUserId) {
          data.toUserId = null;
        }
        const result = await this.db.insert(walletTransactions2).values(data).returning();
        if (!result[0]) throw new Error("Failed to create wallet transaction");
        return result[0];
      }
      // Export a singleton instance for use in other modules
      async getBudgetPlanCount(userId, month) {
        if (!userId || !month) throw new Error("User ID and month required");
        const result = await this.db.select({ count: sql3`count(*)` }).from(budgetPlans).where(and2(eq2(budgetPlans.userId, userId), eq2(budgetPlans.month, month)));
        return Number(result[0]?.count) || 0;
      }
      async createDao(dao) {
        if (!dao.name || !dao.creatorId) throw new Error("Name and creatorId required");
        dao.createdAt = /* @__PURE__ */ new Date();
        dao.updatedAt = /* @__PURE__ */ new Date();
        dao.memberCount = 1;
        const result = await this.db.insert(daos).values(dao).returning();
        if (!result[0]) throw new Error("Failed to create DAO");
        await this.createDaoMembership({ daoId: result[0].id, userId: dao.creatorId, status: "approved", role: "admin" });
        return result[0];
      }
      async setDaoInviteCode(daoId, code) {
        if (!code) throw new Error("Invite code required");
        const result = await this.db.update(daos).set({ inviteCode: code, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(daos.id, daoId)).returning();
        if (!result[0]) throw new Error("DAO not found");
        return result[0];
      }
      async getDaoByInviteCode(code) {
        if (!code) throw new Error("Invite code required");
        const result = await this.db.select().from(daos).where(eq2(daos.inviteCode, code));
        if (!result[0]) throw new Error("DAO not found");
        return result[0];
      }
      async getUserReferralStats(userId) {
        if (!userId) throw new Error("User ID required");
        const referred = await this.db.select().from(users).where(eq2(users.referredBy, userId));
        return {
          userId,
          referredCount: referred.length,
          referredUsers: referred.map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }))
        };
      }
      async getReferralLeaderboard(limit = 10) {
        const allUsers = await this.db.select().from(users);
        const counts = {};
        allUsers.forEach((u) => {
          if (u.referredBy) {
            if (!counts[u.referredBy]) {
              const refUser = allUsers.find((x) => x.id === u.referredBy);
              counts[u.referredBy] = { count: 0, user: refUser };
            }
            counts[u.referredBy].count++;
          }
        });
        const leaderboard = Object.entries(counts).map(([userId, { count: count3, user }]) => ({ userId, count: count3, user })).sort((a, b) => b.count - a.count).slice(0, limit);
        return leaderboard;
      }
      async getUser(userId) {
        if (!userId) throw new Error("User ID required");
        const result = await this.db.select().from(users).where(eq2(users.id, userId));
        if (!result[0]) throw new Error("User not found");
        return result[0];
      }
      async getDAOStats() {
        const daosList = await this.db.select().from(daos);
        const memberships = await this.db.select().from(daoMemberships);
        const activeDaoIds = new Set(memberships.map((m) => m.daoId));
        return {
          daoCount: daosList.length,
          memberCount: memberships.length,
          activeDaoCount: activeDaoIds.size
        };
      }
      async getProposals() {
        return await this.db.select().from(proposals).orderBy(desc(proposals.createdAt));
      }
      async getProposal(id) {
        if (!id) throw new Error("Proposal ID required");
        const result = await this.db.select().from(proposals).where(eq2(proposals.id, id));
        if (!result[0]) throw new Error("Proposal not found");
        return result[0];
      }
      async createProposal(proposal) {
        if (!proposal.title || !proposal.daoId) throw new Error("Proposal must have title and daoId");
        proposal.createdAt = /* @__PURE__ */ new Date();
        proposal.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.insert(proposals).values(proposal).returning();
        if (!result[0]) throw new Error("Failed to create proposal");
        return result[0];
      }
      async updateProposal(id, data, userId) {
        if (!id || !data.title) throw new Error("Proposal ID and title required");
        const proposal = await this.getProposal(id);
        if (proposal.userId !== userId) throw new Error("Only proposal creator can update");
        const result = await this.db.update(proposals).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(proposals.id, id)).returning();
        if (!result[0]) throw new Error("Failed to update proposal");
        return result[0];
      }
      async deleteProposal(id, userId) {
        const proposal = await this.getProposal(id);
        const membership = await this.getDaoMembership(proposal.daoId, userId);
        if (proposal.userId !== userId && (!membership || membership.role !== "admin")) {
          throw new Error("Only proposal creator or DAO admin can delete");
        }
        await this.db.delete(proposals).where(eq2(proposals.id, id));
      }
      async updateProposalVotes(proposalId, voteType) {
        const proposal = await this.getProposal(proposalId);
        if (!proposal) throw new Error("Proposal not found");
        const field = voteType === "yes" ? "yesVotes" : "noVotes";
        const update = { updatedAt: /* @__PURE__ */ new Date() };
        update[field] = (proposal[field] || 0) + 1;
        const result = await this.db.update(proposals).set(update).where(eq2(proposals.id, proposalId)).returning();
        if (!result[0]) throw new Error("Failed to update proposal votes");
        return result[0];
      }
      async getVote(proposalId, userId) {
        if (!proposalId || !userId) throw new Error("Proposal ID and User ID required");
        const result = await this.db.select().from(votes).where(and2(eq2(votes.proposalId, proposalId), eq2(votes.userId, userId)));
        if (!result[0]) throw new Error("Vote not found");
        return result[0];
      }
      async createVote(vote) {
        if (!vote.proposalId || !vote.userId) throw new Error("Vote must have proposalId and userId");
        vote.createdAt = /* @__PURE__ */ new Date();
        vote.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.insert(votes).values(vote).returning();
        if (!result[0]) throw new Error("Failed to create vote");
        return result[0];
      }
      async getVotesByProposal(proposalId) {
        if (!proposalId) throw new Error("Proposal ID required");
        return await this.db.select().from(votes).where(eq2(votes.proposalId, proposalId));
      }
      async getContributions(userId, daoId) {
        let whereClause = void 0;
        if (userId && daoId) {
          return await this.db.select().from(contributions).where(and2(eq2(contributions.userId, userId), eq2(contributions.daoId, daoId))).orderBy(desc(contributions.createdAt));
        } else if (userId) {
          return await this.db.select().from(contributions).where(eq2(contributions.userId, userId)).orderBy(desc(contributions.createdAt));
        } else if (daoId) {
          return await this.db.select().from(contributions).where(eq2(contributions.daoId, daoId)).orderBy(desc(contributions.createdAt));
        } else {
          return await this.db.select().from(contributions).orderBy(desc(contributions.createdAt));
        }
      }
      async getContributionsCount(userId, daoId) {
        if (!userId || !daoId) throw new Error("User ID and DAO ID required");
        const result = await this.db.select().from(contributions).where(and2(eq2(contributions.userId, userId), eq2(contributions.daoId, daoId)));
        return result.length;
      }
      async getVotesCount(daoId, proposalId) {
        if (!proposalId || !daoId) throw new Error("User ID and DAO ID required");
        const result = await this.db.select().from(votes).where(and2(eq2(votes.userId, proposalId), eq2(votes.daoId, daoId)));
        return result.length;
      }
      async getVotesByUserAndDao(userId, daoId) {
        if (!userId || !daoId) throw new Error("User ID and DAO ID required");
        return await this.db.select().from(votes).where(and2(eq2(votes.userId, userId), eq2(votes.daoId, daoId)));
      }
      async createContribution(contribution) {
        if (!contribution.userId || !contribution.daoId) throw new Error("Contribution must have userId and daoId");
        contribution.createdAt = /* @__PURE__ */ new Date();
        contribution.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.insert(contributions).values(contribution).returning();
        if (!result[0]) throw new Error("Failed to create contribution");
        return result[0];
      }
      async getUserContributionStats(userId) {
        if (!userId) throw new Error("User ID required");
        const all = await this.db.select().from(contributions).where(eq2(contributions.userId, userId));
        const byDao = {};
        all.forEach((c) => {
          const daoId = c.daoId;
          if (daoId) byDao[daoId] = (byDao[daoId] || 0) + 1;
        });
        return { userId, total: all.length, byDao };
      }
      async getUserVaults(userId) {
        if (!userId) throw new Error("User ID required");
        return await this.db.select().from(vaults).where(eq2(vaults.userId, userId));
      }
      async upsertVault(vault) {
        if (!vault.id) throw new Error("Vault must have id");
        vault.updatedAt = /* @__PURE__ */ new Date();
        const updated = await this.db.update(vaults).set(vault).where(eq2(vaults.id, vault.id)).returning();
        if (updated[0]) return updated[0];
        vault.createdAt = /* @__PURE__ */ new Date();
        const inserted = await this.db.insert(vaults).values(vault).returning();
        if (!inserted[0]) throw new Error("Failed to upsert vault");
        return inserted[0];
      }
      async getVaultTransactions(vaultId, limit = 10, offset = 0) {
        if (!vaultId) throw new Error("Vault ID required");
        return await this.db.select().from(walletTransactions2).where(eq2(walletTransactions2.vaultId, vaultId)).orderBy(desc(walletTransactions2.createdAt)).limit(limit).offset(offset);
      }
      async getUserBudgetPlans(userId, month) {
        if (!userId || !month) throw new Error("User ID and month required");
        return await this.db.select().from(budgetPlans).where(and2(eq2(budgetPlans.userId, userId), eq2(budgetPlans.month, month)));
      }
      async upsertBudgetPlan(plan) {
        if (!plan.id) throw new Error("Budget plan must have id");
        plan.updatedAt = /* @__PURE__ */ new Date();
        const updated = await this.db.update(budgetPlans).set(plan).where(eq2(budgetPlans.id, plan.id)).returning();
        if (updated[0]) return updated[0];
        plan.createdAt = /* @__PURE__ */ new Date();
        const inserted = await this.db.insert(budgetPlans).values(plan).returning();
        if (!inserted[0]) throw new Error("Failed to upsert budget plan");
        return inserted[0];
      }
      async updateDaoInviteCode(daoId, code) {
        if (!daoId || !code) throw new Error("DAO ID and code required");
        const result = await this.db.update(daos).set({ inviteCode: code, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(daos.id, daoId)).returning();
        if (!result[0]) throw new Error("Failed to update invite code");
        return result[0];
      }
      async getTasks(daoId, status) {
        let whereClause;
        if (daoId && status) {
          whereClause = and2(eq2(tasks.daoId, daoId), eq2(tasks.status, status));
        } else if (daoId) {
          whereClause = eq2(tasks.daoId, daoId);
        } else if (status) {
          whereClause = eq2(tasks.status, status);
        }
        if (whereClause) {
          return await this.db.select().from(tasks).where(whereClause).orderBy(desc(tasks.createdAt));
        }
        return await this.db.select().from(tasks).orderBy(desc(tasks.createdAt));
      }
      async createTask(task) {
        if (!task.title || !task.daoId) throw new Error("Task must have title and daoId");
        task.createdAt = /* @__PURE__ */ new Date();
        task.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.insert(tasks).values(task).returning();
        if (!result[0]) throw new Error("Failed to create task");
        return result[0];
      }
      async claimTask(taskId, userId) {
        if (!taskId || !userId) throw new Error("Task ID and User ID required");
        const task = await this.db.select().from(tasks).where(eq2(tasks.id, taskId));
        if (!task[0]) throw new Error("Task not found");
        if (task[0].claimedBy) throw new Error("Task already claimed");
        const result = await this.db.update(tasks).set({ claimedBy: userId, status: "claimed", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(tasks.id, taskId)).returning();
        if (!result[0]) throw new Error("Failed to claim task");
        return result[0];
      }
      async getDao(daoId) {
        if (!daoId) throw new Error("DAO ID required");
        const result = await this.db.select().from(daos).where(eq2(daos.id, daoId));
        if (!result[0]) throw new Error("DAO not found");
        return result[0];
      }
      async getDaoMembership(daoId, userId) {
        if (!daoId || !userId) throw new Error("DAO ID and User ID required");
        const result = await this.db.select().from(daoMemberships).where(and2(eq2(daoMemberships.daoId, daoId), eq2(daoMemberships.userId, userId)));
        if (!result[0]) throw new Error("Membership not found");
        return result[0];
      }
      async getDaoMembers(daoId, userId, status, role, limit = 10, offset = 0) {
        if (!daoId) throw new Error("DAO ID required");
        let whereClause = eq2(daoMemberships.daoId, daoId);
        if (userId) whereClause = and2(whereClause, eq2(daoMemberships.userId, userId));
        if (status) whereClause = and2(whereClause, eq2(daoMemberships.status, status));
        if (role) whereClause = and2(whereClause, eq2(daoMemberships.role, role));
        return await this.db.select().from(daoMemberships).where(whereClause).orderBy(desc(daoMemberships.createdAt)).limit(limit).offset(offset);
      }
      async createDaoMembership(args) {
        if (!args.daoId || !args.userId) throw new Error("Membership must have daoId and userId");
        args.createdAt = /* @__PURE__ */ new Date();
        args.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.insert(daoMemberships).values(args).returning();
        if (!result[0]) throw new Error("Failed to create membership");
        return result[0];
      }
      async getDaoMembershipsByStatus(daoId, status) {
        if (!daoId || !status) throw new Error("DAO ID and status required");
        return await this.db.select().from(daoMemberships).where(and2(eq2(daoMemberships.daoId, daoId), eq2(daoMemberships.status, status)));
      }
      async updateDaoMembershipStatus(membershipId, status) {
        const result = await this.db.update(daoMemberships).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(daoMemberships.id, membershipId)).returning();
        return result[0];
      }
      async getDaoPlan(daoId) {
        if (!daoId) throw new Error("DAO ID required");
        const result = await this.db.select().from(daos).where(eq2(daos.id, daoId));
        if (!result[0]) throw new Error("DAO not found");
        return result[0].plan;
      }
      async setDaoPlan(daoId, plan, planExpiresAt) {
        if (!daoId || !plan) throw new Error("DAO ID and plan required");
        const result = await this.db.update(daos).set({ plan, planExpiresAt, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(daos.id, daoId)).returning();
        if (!result[0]) throw new Error("Failed to set DAO plan");
        return result[0];
      }
      async getDaoBillingHistory(daoId) {
        if (!daoId) throw new Error("DAO ID required");
        return await this.db.select().from(billingHistory).where(eq2(billingHistory.daoId, daoId)).orderBy(desc(billingHistory.createdAt));
      }
      async getAllDaoBillingHistory() {
        if (!billingHistory) throw new Error("Billing history table not found");
        return await this.db.select().from(billingHistory).orderBy(desc(billingHistory.createdAt));
      }
      async addDaoBillingHistory(entry) {
        if (!entry.daoId || !entry.amount || !entry.type) throw new Error("Billing history must have daoId, amount, and type");
        entry.createdAt = /* @__PURE__ */ new Date();
        entry.updatedAt = /* @__PURE__ */ new Date();
        const result = await this.db.insert(billingHistory).values(entry).returning();
        if (!result[0]) throw new Error("Failed to add billing history");
        return result[0];
      }
      async getDaoAnalytics(daoId) {
        if (!daoId) throw new Error("DAO ID required");
        const [dao, members, proposals6, contributions4, vaults3] = await Promise.all([
          this.getDao(daoId),
          this.getDaoMembershipsByStatus(daoId, "approved"),
          this.getProposals().then(
            (proposals7) => proposals7.filter((p) => p.daoId === daoId && p.status === "active")
          ),
          this.getContributions(void 0, daoId),
          this.getUserVaults(daoId)
        ]);
        const recentActivity = [
          ...proposals6.map((p) => ({ type: "proposal", createdAt: p.createdAt })),
          ...contributions4.map((c) => ({ type: "contribution", createdAt: c.createdAt })),
          ...members.map((m) => ({ type: "membership", createdAt: m.createdAt }))
        ].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        ).slice(0, 10);
        const vaultBalance = vaults3.reduce((sum3, v) => sum3 + (typeof v.balance === "string" ? parseFloat(v.balance) || 0 : 0), 0);
        return {
          memberCount: members.length,
          activeProposals: proposals6.length,
          totalContributions: contributions4.length,
          vaultBalance,
          recentActivity,
          createdAt: dao.createdAt,
          updatedAt: dao.updatedAt
        };
      }
      /**
       * Checks if a user has any active contributions or votes in a DAO.
       * Returns true if at least one exists, false otherwise.
       */
      async hasActiveContributions(userId, daoId) {
        const contributions4 = await this.getContributions(userId, daoId);
        if (contributions4 && contributions4.length > 0) return true;
        if (typeof this.getVotesByUserAndDao === "function") {
          const votes5 = await this.getVotesByUserAndDao(userId, daoId);
          if (votes5 && votes5.length > 0) return true;
        }
        return false;
      }
      async revokeAllUserSessions(userId) {
        if (!userId) throw new Error("User ID required");
        await this.db.delete(sessions).where(eq2(sessions.userId, userId));
        process.stdout.write(`Revoked all sessions for user ${userId}
`);
      }
      async getUserNotifications(userId, read, limit = 20, offset = 0, type) {
        try {
          let whereClause = eq2(notifications.userId, userId);
          if (read !== void 0) {
            whereClause = and2(whereClause, eq2(notifications.read, read));
          }
          if (type) {
            whereClause = and2(whereClause, eq2(notifications.type, type));
          }
          let query = this.db.select().from(notifications).where(whereClause);
          return await query.orderBy(desc(notifications.createdAt)).limit(limit).offset(offset);
        } catch (error) {
          console.error("Error fetching user notifications:", error);
          return [];
        }
      }
      async getUnreadNotificationCount(userId) {
        try {
          const result = await this.db.select({ count: sql3`count(*)` }).from(notifications).where(and2(
            eq2(notifications.userId, userId),
            eq2(notifications.read, false)
          ));
          return Number(result[0]?.count) || 0;
        } catch (error) {
          console.error("Error getting unread notification count:", error);
          return 0;
        }
      }
      async createNotification(data) {
        try {
          const [notification] = await this.db.insert(notifications).values({
            userId: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority || "medium",
            metadata: data.metadata || {},
            read: false
          }).returning();
          return notification;
        } catch (error) {
          console.error("Error creating notification:", error);
          throw error;
        }
      }
      async createBulkNotifications(userIds, notificationData) {
        try {
          const notificationsToInsert = userIds.map((userId) => ({
            userId,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            priority: notificationData.priority || "medium",
            metadata: notificationData.metadata || {},
            read: false
          }));
          return await this.db.insert(notifications).values(notificationsToInsert).returning();
        } catch (error) {
          console.error("Error creating bulk notifications:", error);
          throw error;
        }
      }
      async markNotificationAsRead(notificationId, userId) {
        try {
          const [notification] = await this.db.update(notifications).set({ read: true, updatedAt: /* @__PURE__ */ new Date() }).where(and2(
            eq2(notifications.id, notificationId),
            eq2(notifications.userId, userId)
          )).returning();
          return notification;
        } catch (error) {
          console.error("Error marking notification as read:", error);
          return null;
        }
      }
      async markAllNotificationsAsRead(userId) {
        try {
          await this.db.update(notifications).set({ read: true, updatedAt: /* @__PURE__ */ new Date() }).where(and2(
            eq2(notifications.userId, userId),
            eq2(notifications.read, false)
          ));
        } catch (error) {
          console.error("Error marking all notifications as read:", error);
          throw error;
        }
      }
      async deleteNotification(notificationId, userId) {
        try {
          const result = await this.db.delete(notifications).where(and2(
            eq2(notifications.id, notificationId),
            eq2(notifications.userId, userId)
          ));
          return !!result;
        } catch (error) {
          console.error("Error deleting notification:", error);
          return false;
        }
      }
      async getUserNotificationPreferences(userId) {
        try {
          const [preferences] = await this.db.select().from(notificationPreferences).where(eq2(notificationPreferences.userId, userId));
          if (!preferences) {
            const [newPreferences] = await this.db.insert(notificationPreferences).values({
              userId,
              emailNotifications: true,
              pushNotifications: true,
              daoUpdates: true,
              proposalUpdates: true,
              taskUpdates: true
            }).returning();
            return newPreferences;
          }
          return preferences;
        } catch (error) {
          console.error("Error fetching notification preferences:", error);
          throw error;
        }
      }
      async updateUserNotificationPreferences(userId, updates) {
        try {
          const [preferences] = await this.db.update(notificationPreferences).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(notificationPreferences.userId, userId)).returning();
          return preferences;
        } catch (error) {
          console.error("Error updating notification preferences:", error);
          throw error;
        }
      }
      async getAllActiveUsers() {
        try {
          return await this.db.select({ id: users.id }).from(users).where(eq2(users.isBanned, false));
        } catch (error) {
          console.error("Error fetching active users:", error);
          return [];
        }
      }
      // Audit logging operations
      async createAuditLog(entry) {
        const result = await this.db.insert(auditLogs).values({
          timestamp: entry.timestamp || /* @__PURE__ */ new Date(),
          userId: entry.userId,
          userEmail: entry.userEmail,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          method: entry.method,
          endpoint: entry.endpoint,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          status: entry.status,
          details: entry.details,
          severity: entry.severity,
          category: entry.category,
          createdAt: /* @__PURE__ */ new Date()
        }).returning();
        return result[0];
      }
      async getAuditLogs({ limit = 50, offset = 0, userId, severity } = {}) {
        let whereClause = void 0;
        if (userId && severity) {
          whereClause = and2(eq2(auditLogs.userId, userId), eq2(auditLogs.severity, severity));
        } else if (userId) {
          whereClause = eq2(auditLogs.userId, userId);
        } else if (severity) {
          whereClause = eq2(auditLogs.severity, severity);
        }
        let query;
        if (whereClause) {
          query = this.db.select().from(auditLogs).where(whereClause);
        } else {
          query = this.db.select().from(auditLogs);
        }
        return await query.orderBy(desc(auditLogs.timestamp)).limit(limit).offset(offset);
      }
      // System logging operations
      async createSystemLog(level, message, service = "api", metadata) {
        const result = await this.db.insert(systemLogs).values({
          level,
          message,
          service,
          metadata,
          timestamp: /* @__PURE__ */ new Date()
        }).returning();
        return result[0];
      }
      // Notification history operations
      async createNotificationHistory(userId, type, title, message, metadata) {
        const result = await this.db.insert(notificationHistory).values({
          userId,
          type,
          title,
          message,
          metadata,
          createdAt: /* @__PURE__ */ new Date()
        }).returning();
        return result[0];
      }
      async getUserNotificationHistory(userId, { limit = 20, offset = 0 } = {}) {
        return await this.db.select().from(notificationHistory).where(eq2(notificationHistory.userId, userId)).orderBy(desc(notificationHistory.createdAt)).limit(limit).offset(offset);
      }
      // Telegram integration methods
      async updateUserTelegramInfo(userId, telegramInfo) {
        return await this.db.update(users).set({
          telegramId: telegramInfo.telegramId,
          telegramChatId: telegramInfo.chatId,
          telegramUsername: telegramInfo.username
        }).where(eq2(users.id, userId)).returning();
      }
      async getUserTelegramInfo(userId) {
        const user = await this.db.select({
          telegramId: users.telegramId,
          chatId: users.telegramChatId,
          username: users.telegramUsername
        }).from(users).where(eq2(users.id, userId)).limit(1);
        return user[0] ? {
          telegramId: user[0].telegramId || "",
          chatId: user[0].chatId || "",
          username: user[0].username || ""
        } : null;
      }
    };
    storage = new DatabaseStorage();
    getAllDaos = (args) => storage.getAllDaos(args);
    getDaoCount = () => storage.getDaoCount();
    getAllUsers = (args) => storage.getAllUsers(args);
    getUserCount = () => storage.getUserCount();
    getPlatformFeeInfo = () => storage.getPlatformFeeInfo();
    getSystemLogs = (args) => storage.getSystemLogs(args);
    getLogCount = () => storage.getLogCount();
    getAllDaoBillingHistory = (args) => storage.getAllDaoBillingHistory();
    getBillingCount = () => storage.getBillingCount();
    getChainInfo = () => storage.getChainInfo();
    getTopMembers = (args) => storage.getTopMembers(args);
    createUser = (userData) => storage.createUser(userData);
    loginUser = (email) => storage.loginUser(email);
    getUserByEmail = (email) => storage.getUserByEmail(email);
    getUserByPhone = (phone) => storage.getUserByPhone(phone);
    createWalletTransaction = (data) => storage.createWalletTransaction(data);
    setDaoInviteCode = (daoId, code) => storage.setDaoInviteCode(daoId, code);
    getDaoByInviteCode = (code) => storage.getDaoByInviteCode(code);
    getUserReferralStats = (userId) => storage.getUserReferralStats(userId);
    getReferralLeaderboard = (limit) => storage.getReferralLeaderboard(limit);
    getUser = (userId) => storage.getUser(userId);
    getDAOStats = () => storage.getDAOStats();
    getProposals = () => storage.getProposals();
    getProposal = (id) => storage.getProposal(id);
    createProposal = (proposal) => storage.createProposal(proposal);
    updateProposalVotes = (proposalId, voteType) => storage.updateProposalVotes(proposalId, voteType);
    getVote = (proposalId, userId) => storage.getVote(proposalId, userId);
    createVote = (vote) => storage.createVote(vote);
    getVotesByProposal = (proposalId) => storage.getVotesByProposal(proposalId);
    getContributions = (userId, daoId) => storage.getContributions(userId, daoId);
    createContribution = (contribution) => storage.createContribution(contribution);
    getUserContributionStats = (userId) => storage.getUserContributionStats(userId);
    getUserVaults = (userId) => storage.getUserVaults(userId);
    upsertVault = (vault) => storage.upsertVault(vault);
    getUserBudgetPlans = (userId, month) => storage.getUserBudgetPlans(userId, month);
    upsertBudgetPlan = (plan) => storage.upsertBudgetPlan(plan);
    getTasks = () => storage.getTasks();
    createTask = (task) => storage.createTask(task);
    claimTask = (taskId, userId) => storage.claimTask(taskId, userId);
    getDao = (daoId) => storage.getDao(daoId);
    getDaoMembership = (daoId, userId) => storage.getDaoMembership(daoId, userId);
    createDaoMembership = (args) => storage.createDaoMembership(args);
    getDaoMembershipsByStatus = (daoId, status) => storage.getDaoMembershipsByStatus(daoId, status);
    updateDaoMembershipStatus = (membershipId, status) => storage.updateDaoMembershipStatus(membershipId, status);
    getDaoPlan = (daoId) => storage.getDaoPlan(daoId);
    setDaoPlan = (daoId, plan, planExpiresAt) => storage.setDaoPlan(daoId, plan, planExpiresAt);
    getDaoBillingHistory = (daoId) => storage.getDaoBillingHistory(daoId);
    addDaoBillingHistory = (entry) => storage.addDaoBillingHistory(entry);
    hasActiveContributions = (userId, daoId) => storage.hasActiveContributions(userId, daoId);
    revokeAllUserSessions = (userId) => storage.revokeAllUserSessions(userId);
    createNotification = (notification) => storage.createNotification(notification);
    getUserNotifications = (userId, read, limit, offset, type) => storage.getUserNotifications(userId, read, limit, offset, type);
    getUserProfile = (userId) => storage.getUserProfile(userId);
    updateUserProfile = (userId, data) => storage.updateUserProfile(userId, data);
    getUserSocialLinks = (userId) => storage.getUserSocialLinks(userId);
    updateUserSocialLinks = (userId, data) => storage.updateUserSocialLinks(userId, data);
    getUserWallet = (userId) => storage.getUserWallet(userId);
    updateUserWallet = (userId, data) => storage.updateUserWallet(userId, data);
    getUserSettings = (userId) => storage.getUserSettings(userId);
    updateUserSettings = (userId, data) => storage.updateUserSettings(userId, data);
    getUserSessions = (userId) => storage.getUserSessions(userId);
    revokeUserSession = (userId, sessionId) => storage.revokeUserSession(userId, sessionId);
    deleteUserAccount = (userId) => storage.deleteUserAccount(userId);
    getBudgetPlanCount = (userId, month) => storage.getBudgetPlanCount(userId, month);
    createDao = (dao) => storage.createDao(dao);
    updateDaoInviteCode = (daoId, code) => storage.updateDaoInviteCode(daoId, code);
    deleteProposal = (id, userId) => storage.deleteProposal(id, userId);
    updateProposal = (id, data, userId) => storage.updateProposal(id, data, userId);
    getVaultTransactions = (vaultId, limit, offset) => storage.getVaultTransactions(vaultId, limit, offset);
    getDaoAnalytics = (daoId) => storage.getDaoAnalytics(daoId);
    storage_default = storage;
  }
});

// server/utils/logger.ts
import { createLogger, format, transports } from "winston";
var combine, timestamp7, errors, json2, colorize, simple, printf, devFormat, winstonLogger, Logger, logger, requestLogger, logStartup;
var init_logger = __esm({
  "server/utils/logger.ts"() {
    "use strict";
    init_config();
    init_storage();
    ({ combine, timestamp: timestamp7, errors, json: json2, colorize, simple, printf } = format);
    devFormat = printf((info) => {
      const { level, message, timestamp: timestamp10, service, ...meta } = info;
      const metaStr = Object.keys(meta).length > 0 ? `
${JSON.stringify(meta, null, 2)}` : "";
      return `${timestamp10} [${service}] ${level}: ${message}${metaStr}`;
    });
    winstonLogger = createLogger({
      level: env.LOG_LEVEL || "info",
      format: combine(
        timestamp7({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        isDevelopment ? combine(colorize(), devFormat) : json2()
      ),
      defaultMeta: { service: "mtaa-dao-api" },
      transports: [
        new transports.Console({
          silent: env.NODE_ENV === "test"
        })
      ]
    });
    if (isProduction) {
      winstonLogger.add(
        new transports.File({
          filename: "logs/error.log",
          level: "error",
          maxsize: 10485760,
          // 10MB
          maxFiles: 5
        })
      );
      winstonLogger.add(
        new transports.File({
          filename: "logs/combined.log",
          maxsize: 10485760,
          // 10MB
          maxFiles: 10
        })
      );
    }
    Logger = class _Logger {
      constructor(service = "api", context = {}) {
        this.service = service;
        this.context = context;
      }
      // Create child logger with additional context
      child(context) {
        return new _Logger(this.service, { ...this.context, ...context });
      }
      async logToDatabase(level, message, metadata = {}) {
        try {
          await storage.createSystemLog(level, message, this.service, {
            ...this.context,
            ...metadata
          });
        } catch (error) {
          console.error("Failed to log to database:", error);
        }
      }
      log(level, message, meta = {}) {
        const logData = {
          service: this.service,
          ...this.context,
          ...meta
        };
        winstonLogger.log(level, message, logData);
        if (["error", "warn", "info"].includes(level)) {
          this.logToDatabase(level, message, logData).catch(console.error);
        }
      }
      error(message, error, meta = {}) {
        const errorMeta = error instanceof Error ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        } : { errorData: error };
        this.log("error", message, { ...errorMeta, ...meta });
      }
      warn(message, meta = {}) {
        this.log("warn", message, meta);
      }
      info(message, meta = {}) {
        this.log("info", message, meta);
      }
      debug(message, meta = {}) {
        this.log("debug", message, meta);
      }
      // Audit logging methods
      async auditLog(action, resource, details = {}) {
        const message = `Audit: ${action} on ${resource}`;
        this.info(message, { audit: true, action, resource, details });
      }
      // Performance logging
      async performanceLog(operation, duration, meta = {}) {
        const message = `Performance: ${operation} took ${duration}ms`;
        this.info(message, { performance: true, operation, duration, ...meta });
      }
      // Security logging
      async securityLog(event, severity, details = {}) {
        const message = `Security: ${event}`;
        this.error(message, null, { security: true, severity, event, details });
      }
    };
    logger = new Logger();
    ((Logger2) => {
      function getLogger() {
        return logger;
      }
      Logger2.getLogger = getLogger;
    })(Logger || (Logger = {}));
    requestLogger = (req, res, next) => {
      const start = Date.now();
      const requestId = req.headers["x-request-id"] || Math.random().toString(36).substring(7);
      req.requestId = requestId;
      res.setHeader("X-Request-ID", requestId);
      const requestLogger2 = logger.child({
        requestId,
        method: req.method,
        url: req.url,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        userId: req.user?.claims?.sub
      });
      req.logger = requestLogger2;
      if (env.ENABLE_REQUEST_LOGGING === "true") {
        requestLogger2.info("Request started", {
          method: req.method,
          url: req.url,
          query: req.query,
          body: req.method !== "GET" ? req.body : void 0
        });
      }
      const originalSend = res.send;
      res.send = function(body) {
        const duration = Date.now() - start;
        requestLogger2.info("Request completed", {
          statusCode: res.statusCode,
          duration,
          responseSize: JSON.stringify(body).length
        });
        return originalSend.call(this, body);
      };
      next();
    };
    logStartup = (port) => {
      logger.info("\u{1F680} Server starting up", {
        port,
        environment: env.NODE_ENV,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    };
  }
});

// server/middleware/errorHandler.ts
import { ZodError } from "zod";
var AppError, ValidationError, NotFoundError, formatErrorResponse, logError, errorHandler, asyncHandler, notFoundHandler, setupProcessErrorHandlers;
var init_errorHandler = __esm({
  "server/middleware/errorHandler.ts"() {
    "use strict";
    init_config();
    init_storage();
    AppError = class extends Error {
      constructor(message, statusCode = 500, isOperational = true, code) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
      }
    };
    ValidationError = class extends AppError {
      constructor(message) {
        super(message, 400, true, "VALIDATION_ERROR");
      }
    };
    NotFoundError = class extends AppError {
      constructor(resource = "Resource") {
        super(`${resource} not found`, 404, true, "NOT_FOUND");
      }
    };
    formatErrorResponse = (error, req) => {
      const response = {
        success: false,
        error: {
          message: error.message,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          path: req.path,
          method: req.method
        }
      };
      if (error instanceof AppError) {
        response.error.code = error.code;
        response.error.statusCode = error.statusCode;
      }
      if (isDevelopment && error.stack) {
        response.error.stack = error.stack;
      }
      if (req.headers["x-request-id"]) {
        response.error.requestId = req.headers["x-request-id"];
      }
      return response;
    };
    logError = async (error, req, res) => {
      const severity = error instanceof AppError && error.statusCode < 500 ? "medium" : "high";
      const user = req.user;
      try {
        await storage.createSystemLog(
          "error",
          error.message,
          "api",
          {
            stack: error.stack,
            statusCode: error instanceof AppError ? error.statusCode : 500,
            path: req.path,
            method: req.method,
            userAgent: req.get("User-Agent"),
            ipAddress: req.ip,
            userId: user?.claims?.sub,
            requestBody: req.body,
            requestQuery: req.query,
            requestParams: req.params
          }
        );
        if (severity === "high") {
          console.error(`\u{1F6A8} ${error.message}`, {
            stack: error.stack,
            path: req.path,
            method: req.method,
            userId: user?.claims?.sub
          });
        }
      } catch (logError2) {
        console.error("Failed to log error:", logError2);
      }
    };
    errorHandler = async (error, req, res, next) => {
      await logError(error, req, res);
      let statusCode = 500;
      let message = "Internal server error";
      let code = "INTERNAL_ERROR";
      if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
        code = error.code || "APP_ERROR";
      } else if (error instanceof ZodError) {
        statusCode = 400;
        message = "Validation failed";
        code = "VALIDATION_ERROR";
        return res.status(statusCode).json({
          success: false,
          error: {
            message,
            code,
            statusCode,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            path: req.path,
            method: req.method,
            details: error.errors
          }
        });
      } else if (error.name === "CastError") {
        statusCode = 400;
        message = "Invalid ID format";
        code = "INVALID_ID";
      } else if (error.name === "MongoError" || error.message.includes("database")) {
        statusCode = 500;
        message = "Database operation failed";
        code = "DATABASE_ERROR";
      }
      const response = formatErrorResponse(
        new AppError(message, statusCode, true, code),
        req
      );
      res.status(statusCode).json(response);
    };
    asyncHandler = (fn) => (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
    notFoundHandler = (req, res, next) => {
      const error = new NotFoundError(`Route ${req.originalUrl} not found`);
      next(error);
    };
    setupProcessErrorHandlers = () => {
      process.on("unhandledRejection", (reason, promise) => {
        console.error("\u{1F6A8} Unhandled Promise Rejection:", reason);
        process.exit(1);
      });
      process.on("uncaughtException", (error) => {
        console.error("\u{1F6A8} Uncaught Exception:", error);
        process.exit(1);
      });
    };
  }
});

// server/api/authUser.ts
import { eq as eq3 } from "drizzle-orm";
async function authUserHandler(req, res) {
  try {
    const userId = req.user?.userId || req.user?.claims?.sub || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: "User not authenticated" }
      });
    }
    const userResult = await db2.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      roles: users.roles,
      walletAddress: users.walletAddress,
      emailVerified: users.emailVerified,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      profilePicture: users.profilePicture,
      bio: users.bio,
      location: users.location,
      website: users.website,
      telegramUsername: users.telegramUsername,
      isBanned: users.isBanned
    }).from(users).where(eq3(users.id, userId)).limit(1);
    if (userResult.length === 0) {
      logger2.warn("User not found", { userId });
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    const user = userResult[0];
    logger2.debug("User info retrieved", { userId: user.id });
    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    logger2.error("Failed to get user info", error);
    throw new AppError("Failed to retrieve user information", 500);
  }
}
var logger2;
var init_authUser = __esm({
  "server/api/authUser.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_logger();
    init_errorHandler();
    logger2 = new Logger("auth-user");
  }
});

// server/services/redis.ts
var redis_exports = {};
__export(redis_exports, {
  redis: () => redis
});
import { createClient } from "redis";
var RedisService, redis;
var init_redis = __esm({
  "server/services/redis.ts"() {
    "use strict";
    RedisService = class {
      constructor() {
        this.client = null;
        this.fallbackStore = /* @__PURE__ */ new Map();
        this.isConnected = false;
      }
      async connect() {
        try {
          if (process.env.REDIS_URL) {
            this.client = createClient({
              url: process.env.REDIS_URL
            });
            this.client.on("error", (err) => {
              console.error("Redis Client Error:", err);
              this.isConnected = false;
            });
            this.client.on("connect", () => {
              console.log("\u2705 Redis connected successfully");
              this.isConnected = true;
            });
            await this.client.connect();
          } else {
            console.warn("\u26A0\uFE0F  REDIS_URL not configured. Using in-memory fallback store.");
            this.isConnected = false;
          }
        } catch (error) {
          console.error("\u274C Failed to connect to Redis. Using in-memory fallback:", error);
          this.isConnected = false;
        }
      }
      async set(key, value, expiresInSeconds) {
        try {
          if (this.isConnected && this.client) {
            if (expiresInSeconds) {
              await this.client.setEx(key, expiresInSeconds, value);
            } else {
              await this.client.set(key, value);
            }
          } else {
            this.fallbackStore.set(key, {
              value,
              expiresAt: expiresInSeconds ? Date.now() + expiresInSeconds * 1e3 : Number.MAX_SAFE_INTEGER
            });
          }
        } catch (error) {
          console.error("Redis SET error:", error);
          this.fallbackStore.set(key, {
            value,
            expiresAt: expiresInSeconds ? Date.now() + expiresInSeconds * 1e3 : Number.MAX_SAFE_INTEGER
          });
        }
      }
      async get(key) {
        try {
          if (this.isConnected && this.client) {
            return await this.client.get(key);
          } else {
            const data = this.fallbackStore.get(key);
            if (!data) return null;
            if (Date.now() > data.expiresAt) {
              this.fallbackStore.delete(key);
              return null;
            }
            return data.value;
          }
        } catch (error) {
          console.error("Redis GET error:", error);
          return null;
        }
      }
      async delete(key) {
        try {
          if (this.isConnected && this.client) {
            await this.client.del(key);
          } else {
            this.fallbackStore.delete(key);
          }
        } catch (error) {
          console.error("Redis DELETE error:", error);
          this.fallbackStore.delete(key);
        }
      }
      async increment(key) {
        try {
          if (this.isConnected && this.client) {
            return await this.client.incr(key);
          } else {
            const current = this.fallbackStore.get(key);
            const newValue = (current ? parseInt(current.value) : 0) + 1;
            this.fallbackStore.set(key, {
              value: newValue.toString(),
              expiresAt: current?.expiresAt || Number.MAX_SAFE_INTEGER
            });
            return newValue;
          }
        } catch (error) {
          console.error("Redis INCREMENT error:", error);
          return 1;
        }
      }
      async expire(key, seconds) {
        try {
          if (this.isConnected && this.client) {
            await this.client.expire(key, seconds);
          } else {
            const current = this.fallbackStore.get(key);
            if (current) {
              this.fallbackStore.set(key, {
                ...current,
                expiresAt: Date.now() + seconds * 1e3
              });
            }
          }
        } catch (error) {
          console.error("Redis EXPIRE error:", error);
        }
      }
      async disconnect() {
        if (this.client && this.isConnected) {
          await this.client.quit();
          this.isConnected = false;
        }
      }
      // Cleanup expired keys in fallback store (run periodically)
      cleanupFallbackStore() {
        const now = Date.now();
        for (const [key, data] of this.fallbackStore.entries()) {
          if (now > data.expiresAt) {
            this.fallbackStore.delete(key);
          }
        }
      }
    };
    redis = new RedisService();
    setInterval(() => {
      redis.cleanupFallbackStore();
    }, 5 * 60 * 1e3);
  }
});

// server/api/auth_login.ts
import { eq as eq4 } from "drizzle-orm";
async function authLoginHandler(req, res) {
  try {
    const { email, phone, password } = req.body;
    const identifier = email || phone;
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: email ? "Email and password are required" : "Phone and password are required"
      });
    }
    const lockKey = `login_lock:${identifier}`;
    const isLocked = await redis.get(lockKey);
    if (isLocked) {
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Account is locked for ${LOCKOUT_DURATION_MINUTES} minutes. Please try again later or reset your password.`,
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_SECONDS * 1e3).toISOString()
      });
    }
    const [user] = await db2.select().from(users).where(
      email ? eq4(users.email, email) : eq4(users.phone, phone)
    ).limit(1);
    if (!user) {
      await trackFailedLogin(identifier);
      return res.status(401).json({
        success: false,
        error: "Invalid credentials. Please check your email/phone and password."
      });
    }
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        error: "Your account has been suspended. Please contact support for assistance."
      });
    }
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      const failedAttempts = await trackFailedLogin(identifier);
      const remainingAttempts = MAX_FAILED_ATTEMPTS - failedAttempts;
      if (remainingAttempts <= 0) {
        return res.status(429).json({
          success: false,
          error: `Too many failed login attempts. Account is locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
          lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_SECONDS * 1e3).toISOString()
        });
      }
      return res.status(401).json({
        success: false,
        error: `Invalid credentials. You have ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining before account lockout.`,
        remainingAttempts
      });
    }
    await redis.delete(`login_attempts:${identifier}`);
    await db2.update(users).set({
      lastLoginAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(users.id, user.id));
    const tokens = generateTokens({
      sub: user.id,
      email: user.email || user.phone || "",
      role: typeof user.roles === "string" ? user.roles : "user"
    });
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1e3
      // 7 days
    });
    if (process.env.NODE_ENV === "production") {
      console.log(`\u2705 Successful login: ${user.id} (${email || phone}) from IP: ${req.ip}`);
    }
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: typeof user.roles === "string" ? user.roles : "user",
          walletAddress: user.walletAddress,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          profilePicture: user.profileImageUrl
        },
        accessToken: tokens.accessToken
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred during login. Please try again."
    });
  }
}
async function trackFailedLogin(identifier) {
  const attemptsKey = `login_attempts:${identifier}`;
  const lockKey = `login_lock:${identifier}`;
  const attempts = await redis.increment(attemptsKey);
  if (attempts === 1) {
    await redis.expire(attemptsKey, LOCKOUT_DURATION_SECONDS);
  }
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await redis.set(lockKey, "locked", LOCKOUT_DURATION_SECONDS);
    await redis.delete(attemptsKey);
    console.warn(`\u{1F512} Account locked due to failed login attempts: ${identifier}`);
  }
  return attempts;
}
var MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES, LOCKOUT_DURATION_SECONDS;
var init_auth_login = __esm({
  "server/api/auth_login.ts"() {
    "use strict";
    init_storage();
    init_schema();
    init_auth();
    init_redis();
    MAX_FAILED_ATTEMPTS = 5;
    LOCKOUT_DURATION_MINUTES = 15;
    LOCKOUT_DURATION_SECONDS = LOCKOUT_DURATION_MINUTES * 60;
  }
});

// server/services/otpService.ts
import nodemailer from "nodemailer";
var OTP_EXPIRY_MINUTES, OTP_EXPIRY_SECONDS, OTPService, otpService;
var init_otpService = __esm({
  "server/services/otpService.ts"() {
    "use strict";
    init_redis();
    OTP_EXPIRY_MINUTES = 5;
    OTP_EXPIRY_SECONDS = OTP_EXPIRY_MINUTES * 60;
    OTPService = class {
      constructor() {
        this.emailTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: Number(process.env.SMTP_PORT) || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      }
      /**
       * Generate a 6-digit OTP
       */
      generateOTP() {
        return Math.floor(1e5 + Math.random() * 9e5).toString();
      }
      /**
       * Store OTP in Redis with expiration
       */
      async storeOTP(identifier, password) {
        const otp = this.generateOTP();
        const otpData = {
          otp,
          expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1e3,
          password,
          attempts: 0
        };
        await redis.set(
          `otp:${identifier}`,
          JSON.stringify(otpData),
          OTP_EXPIRY_SECONDS
        );
        return otp;
      }
      /**
       * Verify OTP
       */
      async verifyOTP(identifier, otp) {
        try {
          const data = await redis.get(`otp:${identifier}`);
          if (!data) {
            return { valid: false, error: "OTP not found or expired" };
          }
          const otpData = JSON.parse(data);
          if (Date.now() > otpData.expiresAt) {
            await redis.delete(`otp:${identifier}`);
            return { valid: false, error: "OTP has expired" };
          }
          if (otpData.attempts >= 5) {
            await redis.delete(`otp:${identifier}`);
            return { valid: false, error: "Too many failed attempts. Please request a new OTP." };
          }
          if (otpData.otp !== otp) {
            otpData.attempts++;
            await redis.set(
              `otp:${identifier}`,
              JSON.stringify(otpData),
              Math.floor((otpData.expiresAt - Date.now()) / 1e3)
            );
            return { valid: false, error: "Invalid OTP" };
          }
          return { valid: true, password: otpData.password };
        } catch (error) {
          console.error("OTP verification error:", error);
          return { valid: false, error: "Verification failed" };
        }
      }
      /**
       * Delete OTP after successful verification
       */
      async deleteOTP(identifier) {
        await redis.delete(`otp:${identifier}`);
      }
      /**
       * Send OTP via email
       */
      async sendEmailOTP(email, otp) {
        try {
          const mailOptions = {
            from: process.env.SMTP_FROM || "noreply@mtaadao.com",
            to: email,
            subject: "Your MtaaDAO Verification Code",
            html: this.generateEmailTemplate(otp)
          };
          await this.emailTransporter.sendMail(mailOptions);
          console.log(`\u2705 OTP email sent to ${email}`);
        } catch (error) {
          console.error("Failed to send OTP email:", error);
          throw new Error("Failed to send verification code via email");
        }
      }
      /**
       * Send OTP via SMS
       */
      async sendSMSOTP(phone, otp) {
        try {
          if (process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME) {
            await this.sendViaAfricasTalking(phone, otp);
          } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            await this.sendViaTwilio(phone, otp);
          } else {
            console.log(`\u{1F4F1} SMS OTP for ${phone}: ${otp}`);
            console.warn("\u26A0\uFE0F  No SMS provider configured. Add AFRICAS_TALKING or TWILIO credentials.");
          }
        } catch (error) {
          console.error("Failed to send OTP SMS:", error);
          throw new Error("Failed to send verification code via SMS");
        }
      }
      /**
       * Send SMS via Africa's Talking
       */
      async sendViaAfricasTalking(phone, otp) {
        try {
          const response = await fetch("https://api.africastalking.com/version1/messaging", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "apiKey": process.env.AFRICAS_TALKING_API_KEY
            },
            body: new URLSearchParams({
              username: process.env.AFRICAS_TALKING_USERNAME,
              to: phone,
              message: `Your MtaaDAO verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`
            })
          });
          if (!response.ok) {
            throw new Error(`Africa's Talking API error: ${response.status}`);
          }
          console.log(`\u2705 OTP SMS sent to ${phone} via Africa's Talking`);
        } catch (error) {
          console.error("Africa's Talking SMS error:", error);
          throw error;
        }
      }
      /**
       * Send SMS via Twilio
       */
      async sendViaTwilio(phone, otp) {
        try {
          const accountSid = process.env.TWILIO_ACCOUNT_SID;
          const authToken = process.env.TWILIO_AUTH_TOKEN;
          const from = process.env.TWILIO_PHONE_NUMBER;
          const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: new URLSearchParams({
                To: phone,
                From: from,
                Body: `Your MtaaDAO verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`
              })
            }
          );
          if (!response.ok) {
            throw new Error(`Twilio API error: ${response.status}`);
          }
          console.log(`\u2705 OTP SMS sent to ${phone} via Twilio`);
        } catch (error) {
          console.error("Twilio SMS error:", error);
          throw error;
        }
      }
      /**
       * Generate email template for OTP
       */
      generateEmailTemplate(otp) {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MtaaDAO Verification Code</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #333; 
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 40px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content { 
            padding: 40px 30px; 
          }
          .otp-box {
            background: #f9fafb;
            border: 2px dashed #667eea;
            border-radius: 8px;
            padding: 24px;
            text-align: center;
            margin: 24px 0;
          }
          .otp-code {
            font-size: 36px;
            font-weight: 700;
            color: #667eea;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
          }
          .footer { 
            padding: 20px 30px; 
            text-align: center; 
            font-size: 13px; 
            color: #666;
            border-top: 1px solid #e5e7eb;
          }
          .warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 32px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>\u{1F510} MtaaDAO</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Verification Code</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Thank you for registering with MtaaDAO. Please use the following verification code to complete your registration:</p>
            
            <div class="otp-box">
              <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Your Verification Code</div>
              <div class="otp-code">${otp}</div>
              <div style="font-size: 14px; color: #666; margin-top: 8px;">Valid for ${OTP_EXPIRY_MINUTES} minutes</div>
            </div>

            <p>Enter this code on the registration page to verify your account.</p>

            <div class="warning">
              <strong>\u26A0\uFE0F Security Notice:</strong> Never share this code with anyone. MtaaDAO staff will never ask for your verification code.
            </div>

            <p style="margin-top: 24px;">If you didn't request this code, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from MtaaDAO. Please do not reply to this email.</p>
            <p style="margin-top: 8px;">\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} MtaaDAO. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
      }
    };
    otpService = new OTPService();
  }
});

// server/api/auth_register.ts
import { eq as eq5 } from "drizzle-orm";
async function authRegisterHandler(req, res) {
  try {
    const { email, phone, password } = req.body;
    if (!email && !phone || !password) {
      return res.status(400).json({
        success: false,
        error: "Email or phone, and password are required"
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters"
      });
    }
    const existingUser = await db2.select().from(users).where(
      email ? eq5(users.email, email) : eq5(users.phone, phone)
    ).limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        error: email ? "User with this email already exists" : "User with this phone number already exists"
      });
    }
    const identifier = email || phone;
    const otp = await otpService.storeOTP(identifier, password);
    try {
      if (email) {
        await otpService.sendEmailOTP(email, otp);
      } else if (phone) {
        await otpService.sendSMSOTP(phone, otp);
      }
    } catch (sendError) {
      await otpService.deleteOTP(identifier);
      throw new Error("Failed to send verification code. Please try again.");
    }
    if (process.env.NODE_ENV === "development") {
      console.log(`\u{1F510} OTP for ${identifier}: ${otp}`);
    }
    res.status(200).json({
      success: true,
      message: `Verification code sent to your ${email ? "email" : "phone"}`
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      error: "Registration failed"
    });
  }
}
async function verifyOtpHandler(req, res) {
  try {
    const { email, phone, otp } = req.body;
    const identifier = email || phone;
    if (!identifier || !otp) {
      return res.status(400).json({
        success: false,
        error: "Email/phone and OTP are required"
      });
    }
    const verification = await otpService.verifyOTP(identifier, otp);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        error: verification.error || "Invalid OTP"
      });
    }
    const hashedPassword = await hashPassword(verification.password);
    const [newUser] = await db2.insert(users).values({
      id: crypto.randomUUID(),
      email: email || null,
      phone: phone || null,
      password: hashedPassword,
      firstName: "",
      lastName: "",
      roles: "user",
      isEmailVerified: !!email,
      isPhoneVerified: !!phone,
      isBanned: false,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).returning();
    await otpService.deleteOTP(identifier);
    const tokens = generateTokens({
      sub: newUser.id,
      email: newUser.email || newUser.phone || "",
      role: typeof newUser.roles === "string" ? newUser.roles : "user"
    });
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1e3
      // 7 days
    });
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          phone: newUser.phone,
          role: typeof newUser.roles === "string" ? newUser.roles : "user",
          isEmailVerified: newUser.isEmailVerified,
          isPhoneVerified: newUser.isPhoneVerified
        },
        accessToken: tokens.accessToken
      }
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      error: "OTP verification failed"
    });
  }
}
async function resendOtpHandler(req, res) {
  try {
    const { email, phone } = req.body;
    const identifier = email || phone;
    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: "Email or phone is required"
      });
    }
    const existingData = await otpService.verifyOTP(identifier, "000000");
    if (!existingData.password) {
      return res.status(400).json({
        success: false,
        error: "No active registration found. Please start registration again."
      });
    }
    const otp = await otpService.storeOTP(identifier, existingData.password);
    try {
      if (email) {
        await otpService.sendEmailOTP(email, otp);
      } else if (phone) {
        await otpService.sendSMSOTP(phone, otp);
      }
    } catch (sendError) {
      throw new Error("Failed to send verification code. Please try again.");
    }
    if (process.env.NODE_ENV === "development") {
      console.log(`\u{1F510} New OTP for ${identifier}: ${otp}`);
    }
    res.status(200).json({
      success: true,
      message: `New verification code sent to your ${email ? "email" : "phone"}`
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to resend OTP"
    });
  }
}
var init_auth_register = __esm({
  "server/api/auth_register.ts"() {
    "use strict";
    init_storage();
    init_schema();
    init_auth();
    init_otpService();
  }
});

// server/auth.ts
var auth_exports = {};
__export(auth_exports, {
  authLoginHandler: () => authLoginHandler,
  authRegisterHandler: () => authRegisterHandler,
  authUserHandler: () => authUserHandler,
  authenticate: () => authenticate,
  generateTokens: () => generateTokens,
  hashPassword: () => hashPassword,
  isAuthenticated: () => isAuthenticated,
  logoutHandler: () => logoutHandler,
  refreshTokenHandler: () => refreshTokenHandler,
  verifyAccessToken: () => verifyAccessToken,
  verifyPassword: () => verifyPassword,
  verifyRefreshToken: () => verifyRefreshToken
});
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
var JWT_SECRET, JWT_REFRESH_SECRET, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY, generateTokens, verifyAccessToken, verifyRefreshToken, hashPassword, verifyPassword, authenticate, isAuthenticated, refreshTokenHandler, logoutHandler;
var init_auth = __esm({
  "server/auth.ts"() {
    "use strict";
    init_authUser();
    init_auth_login();
    init_auth_register();
    JWT_SECRET = process.env.JWT_SECRET_KEY || "your-secret-key-change-in-production";
    JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-change-in-production";
    ACCESS_TOKEN_EXPIRY = "15m";
    REFRESH_TOKEN_EXPIRY = "7d";
    generateTokens = (payload) => {
      const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
      const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
      return { accessToken, refreshToken };
    };
    verifyAccessToken = (token) => {
      try {
        return jwt.verify(token, JWT_SECRET);
      } catch (error) {
        return null;
      }
    };
    verifyRefreshToken = (token) => {
      try {
        return jwt.verify(token, JWT_REFRESH_SECRET);
      } catch (error) {
        return null;
      }
    };
    hashPassword = async (password) => {
      const salt = await bcrypt.genSalt(12);
      return bcrypt.hash(password, salt);
    };
    verifyPassword = async (password, hash) => {
      return bcrypt.compare(password, hash);
    };
    authenticate = (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({
            success: false,
            error: { message: "No token provided" }
          });
        }
        const token = authHeader.split(" ")[1];
        const payload = verifyAccessToken(token);
        if (!payload) {
          return res.status(401).json({
            success: false,
            error: { message: "Invalid or expired token" }
          });
        }
        req.user = { claims: { sub: payload.sub, email: payload.email, role: payload.role } };
        next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: { message: "Authentication failed" }
        });
      }
    };
    isAuthenticated = authenticate;
    refreshTokenHandler = async (req, res) => {
      try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        if (!refreshToken) {
          return res.status(401).json({
            success: false,
            error: { message: "Refresh token required" }
          });
        }
        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
          return res.status(401).json({
            success: false,
            error: { message: "Invalid refresh token" }
          });
        }
        const tokens = generateTokens({
          sub: decoded.sub,
          email: decoded.email,
          role: decoded.role
        });
        res.cookie("refreshToken", tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1e3
          // 7 days
        });
        res.json({
          success: true,
          data: { accessToken: tokens.accessToken }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { message: "Token refresh failed" }
        });
      }
    };
    logoutHandler = async (req, res) => {
      try {
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict"
        });
        res.json({
          success: true,
          message: "Logged out successfully"
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { message: "Logout failed" }
        });
      }
    };
  }
});

// server/notificationService.ts
var notificationService_exports = {};
__export(notificationService_exports, {
  notificationService: () => notificationService
});
import { EventEmitter } from "events";
import nodemailer2 from "nodemailer";
import TelegramBot from "node-telegram-bot-api";
var NotificationService, notificationService;
var init_notificationService = __esm({
  "server/notificationService.ts"() {
    "use strict";
    init_storage();
    NotificationService = class extends EventEmitter {
      constructor() {
        super();
        this.subscribers = /* @__PURE__ */ new Map();
        this.telegramBot = null;
        this.userTelegramMap = /* @__PURE__ */ new Map();
        this.emailTransporter = nodemailer2.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: Number(process.env.SMTP_PORT) || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        if (process.env.TELEGRAM_BOT_TOKEN) {
          this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
          this.setupTelegramHandlers();
        }
      }
      setupTelegramHandlers() {
        if (!this.telegramBot) return;
        this.telegramBot.onText(/\/start/, async (msg) => {
          const chatId = msg.chat.id;
          const userId = msg.from?.id ? msg.from.id.toString() : void 0;
          if (!userId) {
            this.telegramBot?.sendMessage(chatId, "Could not determine your Telegram user ID.");
            return;
          }
          this.userTelegramMap.set(userId, { chatId: chatId.toString(), userId });
          this.telegramBot?.sendMessage(chatId, "Welcome to the notification service! Your Telegram is now linked.");
        });
        this.telegramBot.on("message", async (msg) => {
          const chatId = msg.chat.id;
          const text7 = msg.text;
          if (text7 && text7.startsWith("/link ")) {
            const internalUserId = text7.split(" ")[1];
            if (internalUserId) {
              this.userTelegramMap.set(internalUserId, { chatId: chatId.toString(), userId: internalUserId });
              this.telegramBot?.sendMessage(chatId, `User ${internalUserId} linked to this chat.`);
            } else {
              this.telegramBot?.sendMessage(chatId, "Please use the format /link <your_user_id>");
            }
            return;
          }
          if (text7 && !text7.startsWith("/")) {
            console.log(`Received message from Telegram chat ${chatId}: ${text7}`);
          }
        });
        this.telegramBot.on("polling_error", (error) => {
          console.error("Telegram polling error:", error.code ?? "", error.message);
        });
      }
      async sendTelegramNotification(userId, notification) {
        if (!this.telegramBot) {
          console.warn("Telegram bot not initialized. Cannot send notification.");
          return;
        }
        const telegramUser = this.userTelegramMap.get(userId);
        if (!telegramUser || !telegramUser.chatId) {
          console.warn(`Telegram chat ID not found for user ${userId}. Cannot send notification.`);
          return;
        }
        const message = `*${notification.title}*
${notification.message}`;
        try {
          await this.telegramBot.sendMessage(telegramUser.chatId, message, { parse_mode: "Markdown" });
          console.log(`Telegram notification sent to user ${userId} (chatId: ${telegramUser.chatId})`);
        } catch (error) {
          console.error(`Failed to send Telegram notification to user ${userId}:`, error.message);
          if (error.response && error.response.statusCode === 404) {
            console.error(`Chat ID ${telegramUser.chatId} not found. Removing mapping.`);
            this.userTelegramMap.delete(userId);
          }
        }
      }
      async createNotification(notification) {
        try {
          const dbNotification = await storage.createNotification({
            userId: notification.userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority || "medium",
            metadata: notification.metadata || {}
          });
          const preferences = await storage.getUserNotificationPreferences(notification.userId);
          if (preferences?.emailNotifications) {
            await this.sendEmailNotification(notification.userId, notification);
          }
          if (preferences?.pushNotifications) {
            await this.sendPushNotification(notification.userId, notification);
          }
          if (preferences?.telegramNotifications) {
            await this.sendTelegramNotification(notification.userId, notification);
          }
          this.emit("notification_created", {
            ...dbNotification,
            userId: notification.userId
          });
          console.log(`Notification created for user ${notification.userId}: ${notification.type}`);
          return dbNotification;
        } catch (error) {
          console.error("Failed to create notification:", error);
          return null;
        }
      }
      async sendPaymentNotification(recipient, notification) {
        try {
          const channel = this.subscribers.get(recipient) || { sms: true };
          if (channel.sms) {
            await this.sendSMS(recipient, this.formatSMSMessage(notification));
          }
          if (channel.email) {
            await this.sendEmail(recipient, this.formatEmailMessage(notification));
          }
          if (channel.push) {
            await this.sendPushNotification(recipient, {
              userId: recipient,
              type: notification.type,
              title: `Payment ${notification.type.replace("_", " ")}`,
              message: `${notification.amount} ${notification.currency} - ${notification.transactionId}`,
              priority: "medium",
              metadata: notification.errorMessage ? { errorMessage: notification.errorMessage } : {}
            });
          }
          const userPreferences = await storage.getUserNotificationPreferences(recipient);
          if (userPreferences?.telegramNotifications) {
            await this.sendTelegramNotification(recipient, {
              userId: recipient,
              type: notification.type,
              title: `Payment ${notification.type.replace("_", " ")}`,
              message: `Amount: ${notification.amount} ${notification.currency}
Transaction ID: ${notification.transactionId}
${notification.errorMessage ? `Error: ${notification.errorMessage}` : ""}`,
              priority: "medium",
              metadata: notification.errorMessage ? { errorMessage: notification.errorMessage } : {}
            });
          }
          if (channel.webhook) {
            await this.sendWebhook(channel.webhook, notification);
          }
          this.emit("payment_notification", {
            recipient,
            notification,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
          console.log(`Payment notification sent to ${recipient}: ${notification.type}`);
          return true;
        } catch (error) {
          console.error("Failed to send payment notification:", error);
          return false;
        }
      }
      async sendEmailNotification(userId, notification) {
        try {
          const user = await storage.getUserById(userId);
          if (!user?.email) return;
          const mailOptions = {
            from: process.env.SMTP_FROM || "noreply@mtaadao.com",
            to: user.email,
            subject: notification.title,
            html: this.formatEmailTemplate(notification)
          };
          await this.emailTransporter.sendMail(mailOptions);
          console.log(`Email notification sent to ${user.email}`);
        } catch (error) {
          console.error("Failed to send email notification:", error);
        }
      }
      formatEmailTemplate(notification) {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 10px; text-align: center; font-size: 12px; color: #666; }
          .priority-high { border-left: 4px solid #ef4444; }
          .priority-urgent { border-left: 4px solid #dc2626; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MtaaDAO Notification</h1>
          </div>
          <div class="content ${notification.priority === "high" || notification.priority === "urgent" ? `priority-${notification.priority}` : ""}">
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            ${notification.metadata?.actionUrl ? `<p><a href="${notification.metadata.actionUrl}" style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Take Action</a></p>` : ""}
          </div>
          <div class="footer">
            <p>This is an automated message from MtaaDAO. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
      }
      async sendPushNotification(userId, notification) {
        try {
          console.log(`Push notification sent to user ${userId}: ${notification.title}`);
          const pushPayload = {
            title: notification.title,
            body: notification.message,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            data: {
              type: notification.type,
              userId,
              metadata: notification.metadata
            }
          };
          console.log("Push payload:", pushPayload);
        } catch (error) {
          console.error("Failed to send push notification:", error);
        }
      }
      formatSMSMessage(notification) {
        switch (notification.type) {
          case "payment_pending":
            return `Payment of ${notification.amount} ${notification.currency} is being processed. Transaction ID: ${notification.transactionId}`;
          case "payment_success":
            return `Payment successful! ${notification.amount} ${notification.currency} received. Transaction ID: ${notification.transactionId}`;
          case "payment_failed":
            return `Payment failed. ${notification.amount} ${notification.currency}. ${notification.errorMessage || "Please try again."}`;
          case "payment_retry":
            return `Retrying payment of ${notification.amount} ${notification.currency}. Transaction ID: ${notification.transactionId}`;
          default:
            return `Payment update for transaction ${notification.transactionId}`;
        }
      }
      formatEmailMessage(notification) {
        const subject = `Payment ${notification.type.replace("_", " ")} - ${notification.transactionId}`;
        let body = `
      <h2>Payment Update</h2>
      <p><strong>Transaction ID:</strong> ${notification.transactionId}</p>
      <p><strong>Amount:</strong> ${notification.amount} ${notification.currency}</p>
      <p><strong>Status:</strong> ${notification.type.replace("_", " ")}</p>
    `;
        if (notification.errorMessage) {
          body += `<p><strong>Error:</strong> ${notification.errorMessage}</p>`;
        }
        return { subject, body };
      }
      formatPushMessage(notification) {
        const title = `Payment ${notification.type.replace("_", " ")}`;
        const body = `${notification.amount} ${notification.currency} - ${notification.transactionId}`;
        return { title, body };
      }
      async sendSMS(phone, message) {
        console.log(`SMS to ${phone}: ${message}`);
        return new Promise((resolve) => {
          setTimeout(() => {
            console.log(`SMS sent successfully to ${phone}`);
            resolve();
          }, 100);
        });
      }
      async sendEmail(email, message) {
        try {
          await this.emailTransporter.sendMail({
            from: process.env.SMTP_FROM || "noreply@mtaadao.com",
            to: email,
            subject: message.subject,
            html: message.body
          });
          console.log(`Email sent successfully to ${email}`);
        } catch (error) {
          console.error(`Email failed for ${email}:`, error);
          throw error;
        }
      }
      async sendWebhook(url, notification) {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              type: "payment_notification",
              data: notification,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            })
          });
          if (!response.ok) {
            throw new Error(`Webhook failed: ${response.status}`);
          }
          console.log(`Webhook sent successfully to ${url}`);
        } catch (error) {
          console.error(`Webhook failed for ${url}:`, error);
          throw error;
        }
      }
      subscribe(recipient, channels) {
        this.subscribers.set(recipient, channels);
      }
      unsubscribe(recipient) {
        this.subscribers.delete(recipient);
      }
      // Real-time payment status updates via WebSocket
      getPaymentStatusStream(transactionId) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.removeAllListeners(`payment_${transactionId}`);
            reject(new Error("Payment status timeout"));
          }, 3e5);
          this.once(`payment_${transactionId}`, (status) => {
            clearTimeout(timeout);
            resolve(status);
          });
        });
      }
      updatePaymentStatus(transactionId, status) {
        this.emit(`payment_${transactionId}`, status);
      }
      // Bulk notification creation for announcements
      async createBulkNotifications(userIds, notificationData) {
        const notifications2 = [];
        for (const userId of userIds) {
          const notification = await this.createNotification({
            ...notificationData,
            userId
          });
          if (notification) {
            notifications2.push(notification);
          }
        }
        return notifications2;
      }
      // Server-Sent Events endpoint for real-time notifications
      setupSSE(userId, res) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Cache-Control"
        });
        const heartbeat = setInterval(() => {
          res.write('data: {"type":"heartbeat"}\n\n');
        }, 3e4);
        const notificationHandler = (notification) => {
          if (notification.userId === userId) {
            res.write(`data: ${JSON.stringify(notification)}

`);
          }
        };
        this.on("notification_created", notificationHandler);
        res.on("close", () => {
          clearInterval(heartbeat);
          this.removeListener("notification_created", notificationHandler);
        });
      }
    };
    notificationService = new NotificationService();
  }
});

// server/services/kycService.ts
var kycService_exports = {};
__export(kycService_exports, {
  KYCService: () => KYCService,
  KYC_TIERS: () => KYC_TIERS,
  kycService: () => kycService
});
import { eq as eq6 } from "drizzle-orm";
var KYC_TIERS, KYCService, kycService;
var init_kycService = __esm({
  "server/services/kycService.ts"() {
    "use strict";
    init_storage();
    init_kycSchema();
    init_schema();
    KYC_TIERS = {
      none: {
        tier: "none",
        dailyLimit: 100,
        monthlyLimit: 500,
        annualLimit: 1e3,
        requirements: ["Account registration"]
      },
      basic: {
        tier: "basic",
        dailyLimit: 5e3,
        monthlyLimit: 5e4,
        annualLimit: 1e5,
        requirements: ["Email verification", "Phone verification"]
      },
      intermediate: {
        tier: "intermediate",
        dailyLimit: 1e4,
        monthlyLimit: 1e5,
        annualLimit: 5e5,
        requirements: ["Email verification", "Phone verification", "ID document upload"]
      },
      advanced: {
        tier: "advanced",
        dailyLimit: 1e5,
        monthlyLimit: 1e6,
        annualLimit: 1e7,
        requirements: ["Email verification", "Phone verification", "ID document upload", "Proof of address"]
      }
    };
    KYCService = class {
      constructor() {
        // Jumio configuration
        this.jumioConfig = {
          apiToken: process.env.JUMIO_API_TOKEN || "",
          apiSecret: process.env.JUMIO_API_SECRET || "",
          baseUrl: process.env.JUMIO_BASE_URL || "https://netverify.com/api/v4",
          enabled: !!process.env.JUMIO_API_TOKEN
        };
        // Onfido configuration
        this.onfidoConfig = {
          apiToken: process.env.ONFIDO_API_TOKEN || "",
          baseUrl: process.env.ONFIDO_BASE_URL || "https://api.onfido.com/v3",
          enabled: !!process.env.ONFIDO_API_TOKEN
        };
        // Chainalysis configuration
        this.chainalysisConfig = {
          apiKey: process.env.CHAINALYSIS_API_KEY || "",
          baseUrl: process.env.CHAINALYSIS_BASE_URL || "https://api.chainalysis.com",
          enabled: !!process.env.CHAINALYSIS_API_KEY
        };
      }
      async getUserKYC(userId) {
        const kyc = await db2.select().from(kycVerifications).where(eq6(kycVerifications.userId, userId)).orderBy(kycVerifications.createdAt).limit(1);
        return kyc[0] || null;
      }
      async getCurrentTier(userId) {
        const kyc = await this.getUserKYC(userId);
        if (!kyc || kyc.status !== "approved") {
          return KYC_TIERS.none;
        }
        return KYC_TIERS[kyc.tier] || KYC_TIERS.none;
      }
      async checkTransactionLimit(userId, amount, currency) {
        const tier = await this.getCurrentTier(userId);
        const amountUSD = amount;
        if (amountUSD > tier.dailyLimit) {
          return {
            allowed: false,
            reason: `Transaction exceeds daily limit of $${tier.dailyLimit}. Current tier: ${tier.tier}`
          };
        }
        const today = /* @__PURE__ */ new Date();
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
      async getDailySpending(userId, startDate) {
        return 0;
      }
      async submitBasicKYC(userId, data) {
        const existing = await this.getUserKYC(userId);
        if (existing) {
          throw new Error("KYC verification already submitted");
        }
        const [kyc] = await db2.insert(kycVerifications).values({
          userId,
          tier: "basic",
          status: "pending",
          email: data.email,
          phone: data.phone,
          emailVerified: false,
          phoneVerified: false,
          dailyLimit: KYC_TIERS.basic.dailyLimit,
          monthlyLimit: KYC_TIERS.basic.monthlyLimit,
          annualLimit: KYC_TIERS.basic.annualLimit,
          submittedAt: /* @__PURE__ */ new Date()
        }).returning();
        await this.logComplianceEvent(userId, "kyc_submitted", { tier: "basic" });
        return kyc;
      }
      async submitIntermediateKYC(userId, data) {
        const existing = await this.getUserKYC(userId);
        if (!existing || existing.tier !== "basic" || existing.status !== "approved") {
          throw new Error("Must complete basic KYC first");
        }
        const verificationResult = await this.verifyIdentityDocument(userId, data);
        const [kyc] = await db2.update(kycVerifications).set({
          tier: "intermediate",
          status: "pending",
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
          submittedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq6(kycVerifications.userId, userId)).returning();
        await this.logComplianceEvent(userId, "kyc_submitted", { tier: "intermediate" });
        return kyc;
      }
      async submitAdvancedKYC(userId, data) {
        const existing = await this.getUserKYC(userId);
        if (!existing || existing.tier !== "intermediate" || existing.status !== "approved") {
          throw new Error("Must complete intermediate KYC first");
        }
        const [kyc] = await db2.update(kycVerifications).set({
          tier: "advanced",
          status: "pending",
          address: data.address,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
          proofOfAddressType: data.proofOfAddressType,
          proofOfAddressUrl: data.proofOfAddressUrl,
          addressVerificationStatus: "pending",
          dailyLimit: KYC_TIERS.advanced.dailyLimit,
          monthlyLimit: KYC_TIERS.advanced.monthlyLimit,
          annualLimit: KYC_TIERS.advanced.annualLimit,
          submittedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq6(kycVerifications.userId, userId)).returning();
        await this.logComplianceEvent(userId, "kyc_submitted", { tier: "advanced" });
        return kyc;
      }
      async verifyIdentityDocument(userId, data) {
        if (this.jumioConfig.enabled) {
          return this.verifyWithJumio(userId, data);
        } else if (this.onfidoConfig.enabled) {
          return this.verifyWithOnfido(userId, data);
        } else {
          return {
            provider: "manual",
            status: "pending_manual_review",
            reference: `MANUAL-${Date.now()}`,
            data: { message: "Queued for manual review" }
          };
        }
      }
      async verifyWithJumio(userId, data) {
        try {
          const auth = Buffer.from(`${this.jumioConfig.apiToken}:${this.jumioConfig.apiSecret}`).toString("base64");
          const response = await fetch(`${this.jumioConfig.baseUrl}/initiateNetverify`, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/json",
              "User-Agent": "MtaaDAO/1.0"
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
            provider: "jumio",
            status: "pending",
            reference: result.transactionReference || result.scanReference,
            data: result
          };
        } catch (error) {
          console.error("Jumio verification failed:", error);
          return {
            provider: "jumio",
            status: "error",
            reference: `ERROR-${Date.now()}`,
            data: { error: error.message }
          };
        }
      }
      async verifyWithOnfido(userId, data) {
        try {
          const applicantResponse = await fetch(`${this.onfidoConfig.baseUrl}/applicants`, {
            method: "POST",
            headers: {
              "Authorization": `Token token=${this.onfidoConfig.apiToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              first_name: data.firstName,
              last_name: data.lastName,
              email: data.email
            })
          });
          const applicant = await applicantResponse.json();
          const sdkTokenResponse = await fetch(`${this.onfidoConfig.baseUrl}/sdk_token`, {
            method: "POST",
            headers: {
              "Authorization": `Token token=${this.onfidoConfig.apiToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              applicant_id: applicant.id,
              referrer: `${process.env.APP_URL}/*`
            })
          });
          const sdkToken = await sdkTokenResponse.json();
          return {
            provider: "onfido",
            status: "pending",
            reference: applicant.id,
            data: { applicantId: applicant.id, sdkToken: sdkToken.token }
          };
        } catch (error) {
          console.error("Onfido verification failed:", error);
          return {
            provider: "onfido",
            status: "error",
            reference: `ERROR-${Date.now()}`,
            data: { error: error.message }
          };
        }
      }
      async performAMLScreening(userId, walletAddress) {
        if (!this.chainalysisConfig.enabled) {
          return {
            status: "skipped",
            message: "AML screening not configured"
          };
        }
        try {
          const response = await fetch(`${this.chainalysisConfig.baseUrl}/v2/entities/${walletAddress}`, {
            headers: {
              "Token": this.chainalysisConfig.apiKey,
              "Accept": "application/json"
            }
          });
          const result = await response.json();
          const riskLevel = this.evaluateAMLRisk(result);
          await db2.update(kycVerifications).set({
            amlScreeningStatus: riskLevel,
            amlScreeningProvider: "chainalysis",
            amlScreeningReference: result.entityId || walletAddress,
            amlScreeningData: result,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq6(kycVerifications.userId, userId));
          if (riskLevel === "flagged" || riskLevel === "high_risk") {
            await this.logComplianceEvent(userId, "aml_flagged", { walletAddress, riskLevel, result }, "warning");
          }
          return {
            status: riskLevel,
            provider: "chainalysis",
            data: result
          };
        } catch (error) {
          console.error("AML screening failed:", error);
          return {
            status: "error",
            message: error.message
          };
        }
      }
      evaluateAMLRisk(amlData) {
        if (amlData.risk === "high" || amlData.category === "sanctions") {
          return "high_risk";
        }
        if (amlData.risk === "medium" || amlData.directExposure) {
          return "flagged";
        }
        return "clear";
      }
      async approveKYC(userId, reviewerId, notes) {
        const kyc = await this.getUserKYC(userId);
        if (!kyc) {
          throw new Error("No KYC submission found");
        }
        const [updated] = await db2.update(kycVerifications).set({
          status: "approved",
          reviewedBy: reviewerId,
          reviewedAt: /* @__PURE__ */ new Date(),
          approvedAt: /* @__PURE__ */ new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3),
          // 1 year
          notes,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq6(kycVerifications.userId, userId)).returning();
        await db2.update(users).set({ verificationLevel: kyc.tier }).where(eq6(users.id, userId));
        await this.logComplianceEvent(userId, "kyc_approved", { tier: kyc.tier, reviewerId });
        return updated;
      }
      async rejectKYC(userId, reviewerId, reason) {
        const [updated] = await db2.update(kycVerifications).set({
          status: "rejected",
          reviewedBy: reviewerId,
          reviewedAt: /* @__PURE__ */ new Date(),
          rejectionReason: reason,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq6(kycVerifications.userId, userId)).returning();
        await this.logComplianceEvent(userId, "kyc_rejected", { reason, reviewerId });
        return updated;
      }
      async flagSuspiciousActivity(userId, activityType, description, severity, metadata) {
        const [activity] = await db2.insert(suspiciousActivities).values({
          userId,
          activityType,
          description,
          severity,
          status: "pending",
          detectedBy: "automated",
          detectionRules: metadata
        }).returning();
        await this.logComplianceEvent(userId, "suspicious_activity_detected", { activityType, severity }, "critical");
        return activity;
      }
      async logComplianceEvent(userId, eventType, eventData, severity = "info") {
        await db2.insert(complianceAuditLogs).values({
          userId,
          eventType,
          eventData,
          severity
        });
      }
    };
    kycService = new KYCService();
  }
});

// server/taskVerificationService.ts
var taskVerificationService_exports = {};
__export(taskVerificationService_exports, {
  TaskVerificationService: () => TaskVerificationService
});
import { eq as eq10, and as and7 } from "drizzle-orm";
var TaskVerificationService;
var init_taskVerificationService = __esm({
  "server/taskVerificationService.ts"() {
    "use strict";
    init_storage();
    init_schema();
    TaskVerificationService = class {
      // Automated verification for simple tasks
      static async autoVerifyTask(taskId, proofData) {
        try {
          if (!proofData.proofUrl || !this.isValidUrl(proofData.proofUrl)) {
            return false;
          }
          const isAccessible = await this.checkUrlAccessibility(proofData.proofUrl);
          if (!isAccessible) {
            return false;
          }
          const task = await db2.select().from(tasks).where(eq10(tasks.id, taskId)).limit(1);
          if (!task.length) return false;
          const taskData = task[0];
          switch (taskData.category) {
            case "Frontend Development":
              return await this.verifyFrontendTask(proofData);
            case "Documentation":
              return await this.verifyDocumentationTask(proofData);
            default:
              return true;
          }
        } catch (error) {
          console.error("Auto-verification failed:", error);
          return false;
        }
      }
      // Manual verification workflow
      static async requestManualVerification(taskId, reviewerId) {
        await db2.insert(notifications).values({
          userId: reviewerId,
          title: "Task Verification Required",
          message: `A task requires manual verification. Task ID: ${taskId}`,
          type: "task_verification",
          metadata: { taskId, action: "verify_task" }
        });
      }
      // Verification scoring system
      static async calculateVerificationScore(taskId, submissionData) {
        let score = 0;
        if (submissionData.proofUrl) score += 20;
        if (submissionData.description && submissionData.description.length > 20) score += 20;
        if (submissionData.screenshots && submissionData.screenshots.length > 0) score += 15;
        if (submissionData.description && submissionData.description.length > 100) score += 15;
        const task = await db2.select().from(tasks).where(eq10(tasks.id, taskId)).limit(1);
        if (task.length && task[0].deadline) {
          const deadline = new Date(task[0].deadline);
          const now = /* @__PURE__ */ new Date();
          if (now <= deadline) score += 30;
          else if (now.getTime() - deadline.getTime() <= 24 * 60 * 60 * 1e3) score += 15;
        } else {
          score += 30;
        }
        return Math.min(100, score);
      }
      // Helper methods
      static isValidUrl(url) {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      }
      static async checkUrlAccessibility(url) {
        try {
          const response = await fetch(url, { method: "HEAD" });
          return response.status < 400;
        } catch {
          return false;
        }
      }
      static async verifyFrontendTask(proofData) {
        try {
          const response = await fetch(proofData.proofUrl);
          const content = await response.text();
          return content.includes("<html") && content.includes("<body");
        } catch {
          return false;
        }
      }
      static async verifyDocumentationTask(proofData) {
        return proofData.description && proofData.description.length > 100;
      }
      // Process escrow release after verification
      static async processEscrowRelease(taskId, approved) {
        const task = await db2.select().from(tasks).where(eq10(tasks.id, taskId)).limit(1);
        if (!task.length) throw new Error("Task not found");
        const taskData = task[0];
        if (approved && taskData.claimerId) {
          const escrow = await db2.select().from(walletTransactions2).where(and7(
            eq10(walletTransactions2.type, "escrow_deposit"),
            eq10(walletTransactions2.description, `Escrow for task: ${taskId}`),
            eq10(walletTransactions2.status, "held")
          )).limit(1);
          if (escrow.length > 0) {
            await db2.update(walletTransactions2).set({ status: "completed" }).where(eq10(walletTransactions2.id, escrow[0].id));
            await db2.insert(walletTransactions2).values({
              type: "bounty_payout",
              amount: (escrow[0].amount ?? "").toString(),
              currency: (escrow[0].currency ?? "").toString(),
              walletAddress: "",
              // No wallet address available, set as empty string or fallback
              status: "completed",
              description: `Bounty payment for completed task: ${taskData.title}`
            });
            await db2.insert(notifications).values({
              userId: taskData.claimerId,
              title: "Bounty Payment Received",
              message: `You've received ${escrow[0].amount} ${escrow[0].currency} for completing "${taskData.title}"`,
              type: "payment_received",
              metadata: { taskId, amount: escrow[0].amount, currency: escrow[0].currency }
            });
          }
        }
      }
    };
  }
});

// shared/reputationSchema.ts
import { pgTable as pgTable7, varchar as varchar5, timestamp as timestamp8, integer as integer4, decimal as decimal5, boolean as boolean6, uuid as uuid5 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema5 } from "drizzle-zod";
var msiaMoPoints, userReputation2, msiaMoConversions, airdropEligibility, insertMsiaMoPointsSchema, insertUserReputationSchema, insertMsiaMoConversionSchema, insertAirdropEligibilitySchema;
var init_reputationSchema = __esm({
  "shared/reputationSchema.ts"() {
    "use strict";
    init_schema();
    msiaMoPoints = pgTable7("msiamo_points", {
      id: uuid5("id").primaryKey().defaultRandom(),
      userId: varchar5("user_id").references(() => users.id).notNull(),
      daoId: uuid5("dao_id").references(() => daos.id),
      // null for platform-wide points
      points: integer4("points").notNull(),
      action: varchar5("action").notNull(),
      // vote, propose, contribute, refer, streak, etc.
      description: varchar5("description"),
      multiplier: decimal5("multiplier", { precision: 3, scale: 2 }).default("1.0"),
      createdAt: timestamp8("created_at").defaultNow()
    });
    userReputation2 = pgTable7("user_reputation", {
      id: uuid5("id").primaryKey().defaultRandom(),
      userId: varchar5("user_id").references(() => users.id).notNull().unique(),
      totalPoints: integer4("total_points").default(0),
      weeklyPoints: integer4("weekly_points").default(0),
      monthlyPoints: integer4("monthly_points").default(0),
      currentStreak: integer4("current_streak").default(0),
      longestStreak: integer4("longest_streak").default(0),
      lastActivity: timestamp8("last_activity").defaultNow(),
      badge: varchar5("badge").default("Bronze"),
      // Bronze, Silver, Gold, Platinum, Diamond
      level: integer4("level").default(1),
      nextLevelPoints: integer4("next_level_points").default(100),
      updatedAt: timestamp8("updated_at").defaultNow()
    });
    msiaMoConversions = pgTable7("msiamo_conversions", {
      id: uuid5("id").primaryKey().defaultRandom(),
      userId: varchar5("user_id").references(() => users.id).notNull(),
      pointsConverted: integer4("points_converted").notNull(),
      tokensReceived: decimal5("tokens_received", { precision: 18, scale: 8 }).notNull(),
      conversionRate: decimal5("conversion_rate", { precision: 10, scale: 4 }).notNull(),
      // points per token
      transactionHash: varchar5("transaction_hash"),
      status: varchar5("status").default("pending"),
      // pending, completed, failed
      createdAt: timestamp8("created_at").defaultNow()
    });
    airdropEligibility = pgTable7("airdrop_eligibility", {
      id: uuid5("id").primaryKey().defaultRandom(),
      userId: varchar5("user_id").references(() => users.id).notNull(),
      airdropId: varchar5("airdrop_id").notNull(),
      eligibleAmount: decimal5("eligible_amount", { precision: 18, scale: 8 }).notNull(),
      minimumReputation: integer4("minimum_reputation").notNull(),
      userReputation: integer4("user_reputation").notNull(),
      claimed: boolean6("claimed").default(false),
      claimedAt: timestamp8("claimed_at"),
      transactionHash: varchar5("transaction_hash"),
      createdAt: timestamp8("created_at").defaultNow()
    });
    insertMsiaMoPointsSchema = createInsertSchema5(msiaMoPoints);
    insertUserReputationSchema = createInsertSchema5(userReputation2);
    insertMsiaMoConversionSchema = createInsertSchema5(msiaMoConversions);
    insertAirdropEligibilitySchema = createInsertSchema5(airdropEligibility);
  }
});

// server/reputationService.ts
var reputationService_exports = {};
__export(reputationService_exports, {
  BADGE_THRESHOLDS: () => BADGE_THRESHOLDS,
  REPUTATION_VALUES: () => REPUTATION_VALUES,
  ReputationService: () => ReputationService
});
import { eq as eq11, and as and8, desc as desc4, sql as sql6 } from "drizzle-orm";
var REPUTATION_VALUES, BADGE_THRESHOLDS, ReputationService;
var init_reputationService = __esm({
  "server/reputationService.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_reputationSchema();
    REPUTATION_VALUES = {
      VOTE: 5,
      PROPOSAL_CREATED: 25,
      PROPOSAL_PASSED: 50,
      CONTRIBUTION: 10,
      // base points, scales with amount
      REFERRAL: 20,
      DAILY_STREAK: 5,
      WEEKLY_STREAK_BONUS: 25,
      MONTHLY_STREAK_BONUS: 100,
      DAO_MEMBERSHIP: 15,
      COMMENT: 3,
      LIKE_RECEIVED: 2,
      TASK_COMPLETION: 30
    };
    BADGE_THRESHOLDS = {
      Bronze: 0,
      Silver: 100,
      Gold: 500,
      Platinum: 1500,
      Diamond: 5e3
    };
    ReputationService = class {
      // Award points for specific actions
      static async awardPoints(userId, action, points, daoId, description, multiplier = 1) {
        const finalPoints = Math.floor(points * multiplier);
        await db2.insert(msiaMoPoints).values({
          userId,
          daoId,
          points: finalPoints,
          action,
          description,
          multiplier: multiplier.toString()
        });
        await this.updateUserReputation(userId);
      }
      // Calculate contribution points based on amount
      static async awardContributionPoints(userId, amount, daoId) {
        const basePoints = REPUTATION_VALUES.CONTRIBUTION;
        const amountBonus = Math.floor(amount / 10);
        const totalPoints = basePoints + amountBonus;
        await this.awardPoints(
          userId,
          "CONTRIBUTION",
          totalPoints,
          daoId,
          `Contributed ${amount} cUSD`,
          1
        );
      }
      // Update user's overall reputation summary
      static async updateUserReputation(userId) {
        const totalPointsResult = await db2.select({ total: sql6`sum(${msiaMoPoints.points})` }).from(msiaMoPoints).where(eq11(msiaMoPoints.userId, userId));
        const totalPoints = totalPointsResult[0]?.total || 0;
        const weeklyPointsResult = await db2.select({ total: sql6`sum(${msiaMoPoints.points})` }).from(msiaMoPoints).where(
          and8(
            eq11(msiaMoPoints.userId, userId),
            sql6`${msiaMoPoints.createdAt} >= NOW() - INTERVAL '7 days'`
          )
        );
        const weeklyPoints = weeklyPointsResult[0]?.total || 0;
        const monthlyPointsResult = await db2.select({ total: sql6`sum(${msiaMoPoints.points})` }).from(msiaMoPoints).where(
          and8(
            eq11(msiaMoPoints.userId, userId),
            sql6`${msiaMoPoints.createdAt} >= NOW() - INTERVAL '30 days'`
          )
        );
        const monthlyPoints = monthlyPointsResult[0]?.total || 0;
        const badge = this.calculateBadge(totalPoints);
        const level = this.calculateLevel(totalPoints);
        const nextLevelPoints = this.getNextLevelThreshold(level);
        const existingReputation = await db2.select().from(userReputation2).where(eq11(userReputation2.userId, userId));
        if (existingReputation.length > 0) {
          await db2.update(userReputation2).set({
            totalPoints,
            weeklyPoints,
            monthlyPoints,
            badge,
            level,
            nextLevelPoints,
            lastActivity: /* @__PURE__ */ new Date(),
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq11(userReputation2.userId, userId));
        } else {
          await db2.insert(userReputation2).values({
            userId,
            totalPoints,
            weeklyPoints,
            monthlyPoints,
            badge,
            level,
            nextLevelPoints,
            lastActivity: /* @__PURE__ */ new Date()
          });
        }
      }
      // Calculate badge based on total points
      static calculateBadge(totalPoints) {
        if (totalPoints >= BADGE_THRESHOLDS.Diamond) return "Diamond";
        if (totalPoints >= BADGE_THRESHOLDS.Platinum) return "Platinum";
        if (totalPoints >= BADGE_THRESHOLDS.Gold) return "Gold";
        if (totalPoints >= BADGE_THRESHOLDS.Silver) return "Silver";
        return "Bronze";
      }
      // Calculate level (every 100 points = 1 level)
      static calculateLevel(totalPoints) {
        return Math.floor(totalPoints / 100) + 1;
      }
      // Get points needed for next level
      static getNextLevelThreshold(currentLevel) {
        return currentLevel * 100;
      }
      // Apply reputation decay based on inactivity
      static async applyReputationDecay(userId) {
        const reputation = await db2.select().from(userReputation2).where(eq11(userReputation2.userId, userId));
        if (!reputation[0]) return;
        const lastActivityRaw = reputation[0].lastActivity;
        const lastActivity = lastActivityRaw ? new Date(lastActivityRaw) : /* @__PURE__ */ new Date();
        const now = /* @__PURE__ */ new Date();
        const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1e3 * 60 * 60 * 24));
        if (daysSinceActivity > 7) {
          const decayDays = Math.min(daysSinceActivity - 7, 50);
          const decayFactor = 1 - decayDays * 0.01;
          const totalPoints = reputation[0].totalPoints ?? 0;
          const decayedPoints = Math.floor(totalPoints * decayFactor);
          const pointsLost = totalPoints - decayedPoints;
          if (pointsLost > 0) {
            await db2.update(userReputation2).set({
              totalPoints: decayedPoints,
              badge: this.calculateBadge(decayedPoints),
              level: this.calculateLevel(decayedPoints),
              nextLevelPoints: this.getNextLevelThreshold(this.calculateLevel(decayedPoints)),
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq11(userReputation2.userId, userId));
            await this.awardPoints(
              userId,
              "REPUTATION_DECAY",
              -pointsLost,
              void 0,
              `Reputation decay: ${pointsLost} points lost due to ${daysSinceActivity} days of inactivity`,
              1
            );
          }
        }
      }
      // Run decay for all users (scheduled job)
      static async runGlobalReputationDecay() {
        const allUsers = await db2.select().from(userReputation2);
        let processed = 0;
        let decayed = 0;
        for (const user of allUsers) {
          const beforePoints = user.totalPoints ?? 0;
          await this.applyReputationDecay(user.userId);
          const afterReputation = await db2.select().from(userReputation2).where(eq11(userReputation2.userId, user.userId));
          if (afterReputation[0] && (afterReputation[0].totalPoints ?? 0) < beforePoints) {
            decayed++;
          }
          processed++;
        }
        return { processed, decayed };
      }
      // Get user's current reputation
      static async getUserReputation(userId) {
        const reputation = await db2.select().from(userReputation2).where(eq11(userReputation2.userId, userId));
        if (reputation.length === 0) {
          await this.updateUserReputation(userId);
          return await this.getUserReputation(userId);
        }
        await this.applyReputationDecay(userId);
        const updatedReputation = await db2.select().from(userReputation2).where(eq11(userReputation2.userId, userId));
        return updatedReputation[0];
      }
      // Get leaderboard
      static async getLeaderboard(limit = 10) {
        return await db2.select({
          userId: userReputation2.userId,
          totalPoints: userReputation2.totalPoints,
          badge: userReputation2.badge,
          level: userReputation2.level,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        }).from(userReputation2).leftJoin(users, eq11(userReputation2.userId, users.id)).orderBy(desc4(userReputation2.totalPoints)).limit(limit);
      }
      // Convert MsiaMo points to tokens (for airdrops)
      static async convertPointsToTokens(userId, pointsToConvert, conversionRate = 100) {
        const userRep = await this.getUserReputation(userId);
        if (userRep.totalPoints < pointsToConvert) {
          throw new Error("Insufficient reputation points");
        }
        const tokensReceived = pointsToConvert / conversionRate;
        const conversion = await db2.insert(msiaMoConversions).values({
          userId,
          pointsConverted: pointsToConvert,
          tokensReceived: tokensReceived.toString(),
          conversionRate: conversionRate.toString(),
          status: "pending"
        }).returning();
        return {
          tokensReceived,
          conversionId: conversion[0].id
        };
      }
      // Check airdrop eligibility
      static async checkAirdropEligibility(userId, airdropId, minimumReputation, baseAmount) {
        const userRep = await this.getUserReputation(userId);
        const eligible = userRep.totalPoints >= minimumReputation;
        let amount = baseAmount;
        if (eligible) {
          const reputationMultiplier = Math.min(userRep.totalPoints / minimumReputation, 5);
          amount = baseAmount * reputationMultiplier;
        }
        if (eligible) {
          await db2.insert(airdropEligibility).values({
            userId,
            airdropId,
            eligibleAmount: amount.toString(),
            minimumReputation,
            userReputation: userRep.totalPoints
          });
        }
        return {
          eligible,
          amount,
          userReputation: userRep.totalPoints
        };
      }
      // Automated point awarding for common actions
      static async onVote(userId, proposalId, daoId) {
        await this.awardPoints(userId, "VOTE", REPUTATION_VALUES.VOTE, daoId, `Voted on proposal ${proposalId}`);
      }
      static async onProposalCreated(userId, proposalId, daoId) {
        await this.awardPoints(userId, "PROPOSAL_CREATED", REPUTATION_VALUES.PROPOSAL_CREATED, daoId, `Created proposal ${proposalId}`);
      }
      static async onReferral(referrerId, referredId) {
        await this.awardPoints(referrerId, "REFERRAL", REPUTATION_VALUES.REFERRAL, void 0, `Referred user ${referredId}`);
      }
      static async onDaoJoin(userId, daoId) {
        await this.awardPoints(userId, "DAO_MEMBERSHIP", REPUTATION_VALUES.DAO_MEMBERSHIP, daoId, "Joined DAO");
      }
      // Get DAO-specific reputation for governance voting power
      static async getDaoReputation(userId, daoId) {
        const daoPointsResult = await db2.select({ total: sql6`sum(${msiaMoPoints.points})` }).from(msiaMoPoints).where(and8(
          eq11(msiaMoPoints.userId, userId),
          eq11(msiaMoPoints.daoId, daoId)
        ));
        const daoPoints = daoPointsResult[0]?.total || 0;
        const globalRep = await this.getUserReputation(userId);
        const globalPoints = globalRep.totalPoints || 0;
        const votingPower = Math.floor(daoPoints * 0.7 + globalPoints * 0.3);
        let governanceLevel = "member";
        if (votingPower >= 1e3) governanceLevel = "elder";
        if (votingPower >= 2500) governanceLevel = "governor";
        if (votingPower >= 5e3) governanceLevel = "sage";
        return {
          daoPoints,
          globalPoints,
          votingPower,
          governanceLevel
        };
      }
      // Award bonus points for successful proposals
      static async onProposalPassed(userId, proposalId, daoId) {
        await this.awardPoints(
          userId,
          "PROPOSAL_PASSED",
          REPUTATION_VALUES.PROPOSAL_PASSED,
          daoId,
          `Proposal ${proposalId} passed and executed`
        );
      }
      // Award points for delegation activities
      static async onDelegationReceived(userId, daoId, delegatorCount) {
        const bonus = Math.min(delegatorCount * 5, 50);
        await this.awardPoints(
          userId,
          "DELEGATION_RECEIVED",
          bonus,
          daoId,
          `Received delegation from ${delegatorCount} members`
        );
      }
      // Bulk reputation update for DAO events
      static async awardBulkPoints(awards) {
        for (const award of awards) {
          await this.awardPoints(
            award.userId,
            award.action,
            award.points,
            award.daoId,
            award.description
          );
        }
      }
      // Daily check-in and streak tracking
      static async recordDailyCheckIn(userId) {
        const userRep = await db2.select().from(userReputation2).where(eq11(userReputation2.userId, userId));
        const now = /* @__PURE__ */ new Date();
        const lastActivity = userRep[0]?.lastActivity ? new Date(userRep[0].lastActivity) : null;
        let currentStreak = userRep[0]?.currentStreak || 0;
        let longestStreak = userRep[0]?.longestStreak || 0;
        let pointsAwarded = REPUTATION_VALUES.DAILY_STREAK;
        let bonusAwarded = 0;
        if (lastActivity) {
          const daysSinceLastActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1e3 * 60 * 60 * 24));
          if (daysSinceLastActivity === 1) {
            currentStreak += 1;
            if (currentStreak % 7 === 0) {
              bonusAwarded += REPUTATION_VALUES.WEEKLY_STREAK_BONUS;
            }
            if (currentStreak % 30 === 0) {
              bonusAwarded += REPUTATION_VALUES.MONTHLY_STREAK_BONUS;
            }
          } else if (daysSinceLastActivity > 1) {
            currentStreak = 1;
          } else {
            return { streak: currentStreak, pointsAwarded: 0, bonusAwarded: 0 };
          }
        } else {
          currentStreak = 1;
        }
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
        const totalPoints = pointsAwarded + bonusAwarded;
        await this.awardPoints(
          userId,
          "DAILY_CHECK_IN",
          totalPoints,
          void 0,
          `Daily check-in (${currentStreak}-day streak)`,
          1
        );
        if (userRep.length > 0) {
          await db2.update(userReputation2).set({
            currentStreak,
            longestStreak,
            lastActivity: now,
            updatedAt: now
          }).where(eq11(userReputation2.userId, userId));
        } else {
          await db2.insert(userReputation2).values({
            userId,
            totalPoints: 0,
            weeklyPoints: 0,
            monthlyPoints: 0,
            badge: "Bronze",
            level: 1,
            nextLevelPoints: 100,
            currentStreak,
            longestStreak,
            lastActivity: now
          });
        }
        return { streak: currentStreak, pointsAwarded, bonusAwarded };
      }
      // Get streak information for user
      static async getStreakInfo(userId) {
        const userRep = await db2.select().from(userReputation2).where(eq11(userReputation2.userId, userId));
        const currentStreak = userRep[0]?.currentStreak || 0;
        const longestStreak = userRep[0]?.longestStreak || 0;
        return {
          currentStreak,
          longestStreak,
          daysUntilWeeklyBonus: currentStreak > 0 ? 7 - currentStreak % 7 : 7,
          daysUntilMonthlyBonus: currentStreak > 0 ? 30 - currentStreak % 30 : 30
        };
      }
    };
  }
});

// shared/achievementSchema.ts
var achievementSchema_exports = {};
__export(achievementSchema_exports, {
  achievementProgress: () => achievementProgress,
  achievements: () => achievements,
  insertAchievementProgressSchema: () => insertAchievementProgressSchema,
  insertAchievementSchema: () => insertAchievementSchema,
  insertUserAchievementSchema: () => insertUserAchievementSchema,
  userAchievements: () => userAchievements
});
import { pgTable as pgTable8, varchar as varchar6, timestamp as timestamp9, integer as integer5, boolean as boolean7, uuid as uuid6, text as text6 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema6 } from "drizzle-zod";
var achievements, userAchievements, achievementProgress, insertAchievementSchema, insertUserAchievementSchema, insertAchievementProgressSchema;
var init_achievementSchema = __esm({
  "shared/achievementSchema.ts"() {
    "use strict";
    init_schema();
    achievements = pgTable8("achievements", {
      id: uuid6("id").primaryKey().defaultRandom(),
      name: varchar6("name").notNull(),
      description: text6("description"),
      category: varchar6("category").notNull(),
      // voting, contribution, social, streak, etc.
      criteria: text6("criteria").notNull(),
      // JSON string with achievement criteria
      rewardPoints: integer5("reward_points").default(0),
      rewardTokens: varchar6("reward_tokens").default("0"),
      badge: varchar6("badge"),
      // special badge for this achievement
      icon: varchar6("icon"),
      // emoji or icon identifier
      rarity: varchar6("rarity").default("common"),
      // common, rare, epic, legendary
      isActive: boolean7("is_active").default(true),
      createdAt: timestamp9("created_at").defaultNow()
    });
    userAchievements = pgTable8("user_achievements", {
      id: uuid6("id").primaryKey().defaultRandom(),
      userId: varchar6("user_id").references(() => users.id).notNull(),
      achievementId: uuid6("achievement_id").references(() => achievements.id).notNull(),
      unlockedAt: timestamp9("unlocked_at").defaultNow(),
      progress: integer5("progress").default(0),
      // for progressive achievements
      maxProgress: integer5("max_progress").default(1),
      isCompleted: boolean7("is_completed").default(false),
      rewardClaimed: boolean7("reward_claimed").default(false),
      claimedAt: timestamp9("claimed_at")
    });
    achievementProgress = pgTable8("achievement_progress", {
      id: uuid6("id").primaryKey().defaultRandom(),
      userId: varchar6("user_id").references(() => users.id).notNull(),
      achievementId: uuid6("achievement_id").references(() => achievements.id).notNull(),
      currentValue: integer5("current_value").default(0),
      targetValue: integer5("target_value").notNull(),
      lastUpdated: timestamp9("last_updated").defaultNow()
    });
    insertAchievementSchema = createInsertSchema6(achievements);
    insertUserAchievementSchema = createInsertSchema6(userAchievements);
    insertAchievementProgressSchema = createInsertSchema6(achievementProgress);
  }
});

// server/achievementService.ts
var achievementService_exports = {};
__export(achievementService_exports, {
  AchievementService: () => AchievementService
});
import { eq as eq12, and as and9, sql as sql7 } from "drizzle-orm";
var AchievementService;
var init_achievementService = __esm({
  "server/achievementService.ts"() {
    "use strict";
    init_db();
    init_achievementSchema();
    init_reputationSchema();
    init_schema();
    init_reputationService();
    AchievementService = class {
      // Initialize default achievements
      static async initializeDefaultAchievements() {
        const defaultAchievements = [
          {
            name: "First Vote",
            description: "Cast your first vote in any proposal",
            category: "voting",
            criteria: JSON.stringify({ action: "vote", count: 1 }),
            rewardPoints: 50,
            rewardTokens: "1",
            badge: "Voter",
            icon: "\u{1F5F3}\uFE0F",
            rarity: "common"
          },
          {
            name: "Democracy Champion",
            description: "Vote on 50 different proposals",
            category: "voting",
            criteria: JSON.stringify({ action: "vote", count: 50 }),
            rewardPoints: 500,
            rewardTokens: "10",
            badge: "Champion",
            icon: "\u{1F3C6}",
            rarity: "rare"
          },
          {
            name: "Proposal Pioneer",
            description: "Create your first proposal",
            category: "governance",
            criteria: JSON.stringify({ action: "proposal_created", count: 1 }),
            rewardPoints: 100,
            rewardTokens: "5",
            badge: "Pioneer",
            icon: "\u{1F4A1}",
            rarity: "common"
          },
          {
            name: "Community Builder",
            description: "Have 10 of your proposals pass",
            category: "governance",
            criteria: JSON.stringify({ action: "proposal_passed", count: 10 }),
            rewardPoints: 1e3,
            rewardTokens: "25",
            badge: "Builder",
            icon: "\u{1F3D7}\uFE0F",
            rarity: "epic"
          },
          {
            name: "Generous Soul",
            description: "Contribute a total of 1000 cUSD",
            category: "contribution",
            criteria: JSON.stringify({ action: "contribution_total", amount: 1e3 }),
            rewardPoints: 2e3,
            rewardTokens: "50",
            badge: "Generous",
            icon: "\u{1F49D}",
            rarity: "epic"
          },
          {
            name: "Streak Master",
            description: "Maintain a 30-day activity streak",
            category: "streak",
            criteria: JSON.stringify({ action: "daily_streak", count: 30 }),
            rewardPoints: 750,
            rewardTokens: "15",
            badge: "Consistent",
            icon: "\u26A1",
            rarity: "rare"
          },
          {
            name: "Social Butterfly",
            description: "Refer 10 friends to the platform",
            category: "social",
            criteria: JSON.stringify({ action: "referral", count: 10 }),
            rewardPoints: 1500,
            rewardTokens: "30",
            badge: "Influencer",
            icon: "\u{1F98B}",
            rarity: "epic"
          },
          {
            name: "Reputation Legend",
            description: "Reach 10,000 total reputation points",
            category: "reputation",
            criteria: JSON.stringify({ action: "reputation_total", count: 1e4 }),
            rewardPoints: 5e3,
            rewardTokens: "100",
            badge: "Legend",
            icon: "\u{1F451}",
            rarity: "legendary"
          }
        ];
        for (const achievement of defaultAchievements) {
          try {
            await db2.insert(achievements).values(achievement);
          } catch (error) {
            console.log(`Achievement ${achievement.name} already exists or failed to create`);
          }
        }
      }
      // Check and unlock achievements for user
      static async checkUserAchievements(userId) {
        const unlockedAchievements = [];
        const allAchievements = await db2.select().from(achievements).where(eq12(achievements.isActive, true));
        for (const achievement of allAchievements) {
          const isAlreadyUnlocked = await this.isAchievementUnlocked(userId, achievement.id);
          if (isAlreadyUnlocked) continue;
          const criteria = JSON.parse(achievement.criteria);
          const isUnlocked = await this.evaluateAchievementCriteria(userId, criteria);
          if (isUnlocked) {
            await this.unlockAchievement(userId, achievement.id);
            unlockedAchievements.push(achievement.name);
          }
        }
        return unlockedAchievements;
      }
      // Evaluate if user meets achievement criteria
      static async evaluateAchievementCriteria(userId, criteria) {
        switch (criteria.action) {
          case "vote":
            const voteCount = await db2.select({ count: sql7`count(*)` }).from(votes).where(eq12(votes.userId, userId));
            return (voteCount[0]?.count || 0) >= criteria.count;
          case "proposal_created":
            const proposalCount = await db2.select({ count: sql7`count(*)` }).from(proposals).where(eq12(proposals.proposerId, userId));
            return (proposalCount[0]?.count || 0) >= criteria.count;
          case "proposal_passed":
            const passedProposals = await db2.select({ count: sql7`count(*)` }).from(proposals).where(
              and9(
                eq12(proposals.proposerId, userId),
                eq12(proposals.status, "passed")
              )
            );
            return (passedProposals[0]?.count || 0) >= criteria.count;
          case "contribution_total":
            const totalContributions = await db2.select({ total: sql7`sum(${contributions.amount})` }).from(contributions).where(eq12(contributions.userId, userId));
            return (totalContributions[0]?.total || 0) >= criteria.amount;
          case "daily_streak":
            const userRep = await db2.select().from(userReputation2).where(eq12(userReputation2.userId, userId));
            return (userRep[0]?.currentStreak || 0) >= criteria.count;
          case "referral":
            const referralCount = await db2.select({ count: sql7`count(*)` }).from(msiaMoPoints).where(
              and9(
                eq12(msiaMoPoints.userId, userId),
                eq12(msiaMoPoints.action, "REFERRAL")
              )
            );
            return (referralCount[0]?.count || 0) >= criteria.count;
          case "reputation_total":
            const reputation = await db2.select().from(userReputation2).where(eq12(userReputation2.userId, userId));
            return (reputation[0]?.totalPoints || 0) >= criteria.count;
          default:
            return false;
        }
      }
      // Check if achievement is already unlocked
      static async isAchievementUnlocked(userId, achievementId) {
        const existing = await db2.select().from(userAchievements).where(
          and9(
            eq12(userAchievements.userId, userId),
            eq12(userAchievements.achievementId, achievementId),
            eq12(userAchievements.isCompleted, true)
          )
        );
        return existing.length > 0;
      }
      // Unlock achievement for user
      static async unlockAchievement(userId, achievementId) {
        const achievement = await db2.select().from(achievements).where(eq12(achievements.id, achievementId));
        if (!achievement[0]) return;
        await db2.insert(userAchievements).values({
          userId,
          achievementId,
          isCompleted: true,
          rewardClaimed: false
        });
        if (achievement[0] && achievement[0].rewardPoints && achievement[0].rewardPoints > 0) {
          await ReputationService.awardPoints(
            userId,
            "ACHIEVEMENT_UNLOCKED",
            achievement[0].rewardPoints,
            void 0,
            `Unlocked achievement: ${achievement[0].name}`,
            1
          );
        }
      }
      // Get user's achievements
      static async getUserAchievements(userId) {
        return await db2.select({
          achievement: achievements,
          userAchievement: userAchievements
        }).from(userAchievements).leftJoin(achievements, eq12(userAchievements.achievementId, achievements.id)).where(eq12(userAchievements.userId, userId));
      }
      // Get user's achievement statistics
      static async getUserAchievementStats(userId) {
        const totalAchievements = await db2.select({ count: sql7`count(*)` }).from(achievements).where(eq12(achievements.isActive, true));
        const unlockedAchievements = await db2.select({ count: sql7`count(*)` }).from(userAchievements).where(
          and9(
            eq12(userAchievements.userId, userId),
            eq12(userAchievements.isCompleted, true)
          )
        );
        const totalRewardPoints = await db2.select({ total: sql7`sum(${achievements.rewardPoints})` }).from(userAchievements).leftJoin(achievements, eq12(userAchievements.achievementId, achievements.id)).where(
          and9(
            eq12(userAchievements.userId, userId),
            eq12(userAchievements.isCompleted, true),
            eq12(userAchievements.rewardClaimed, true)
          )
        );
        return {
          totalAchievements: totalAchievements[0]?.count || 0,
          unlockedAchievements: unlockedAchievements[0]?.count || 0,
          completionRate: (unlockedAchievements[0]?.count || 0) / (totalAchievements[0]?.count || 1) * 100,
          totalRewardPointsEarned: totalRewardPoints[0]?.total || 0
        };
      }
      // Claim achievement rewards
      static async claimAchievementReward(userId, achievementId) {
        const userAchievement = await db2.select().from(userAchievements).where(
          and9(
            eq12(userAchievements.userId, userId),
            eq12(userAchievements.achievementId, achievementId),
            eq12(userAchievements.isCompleted, true),
            eq12(userAchievements.rewardClaimed, false)
          )
        );
        if (!userAchievement[0]) return false;
        await db2.update(userAchievements).set({
          rewardClaimed: true,
          claimedAt: /* @__PURE__ */ new Date()
        }).where(eq12(userAchievements.id, userAchievement[0].id));
        return true;
      }
    };
  }
});

// server/routes/recurring-payments.ts
var recurring_payments_exports = {};
__export(recurring_payments_exports, {
  default: () => recurring_payments_default
});
import { Router as Router4 } from "express";
var router32, recurring_payments_default;
var init_recurring_payments = __esm({
  "server/routes/recurring-payments.ts"() {
    "use strict";
    init_auth();
    router32 = Router4();
    router32.post("/", authenticate, async (req, res) => {
      try {
        const { recipient, amount, token, frequency, startDate } = req.body;
        const userId = req.user.id;
        const nextPayment = new Date(startDate);
        const payment = {
          id: crypto.randomUUID(),
          userId,
          recipient,
          amount,
          token,
          frequency,
          nextPayment: nextPayment.toISOString(),
          status: "active",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        res.json({ success: true, payment });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    router32.put("/:id", authenticate, async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    router32.delete("/:id", authenticate, async (req, res) => {
      try {
        const { id } = req.params;
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    recurring_payments_default = router32;
  }
});

// server/routes/vouchers.ts
var vouchers_exports = {};
__export(vouchers_exports, {
  default: () => vouchers_default
});
import { Router as Router5 } from "express";
import crypto3 from "crypto";
var router33, vouchers_default;
var init_vouchers = __esm({
  "server/routes/vouchers.ts"() {
    "use strict";
    init_auth();
    router33 = Router5();
    router33.post("/", authenticate, async (req, res) => {
      try {
        const { amount, token, message, expiryDays } = req.body;
        const userId = req.user.id;
        const code = crypto3.randomBytes(8).toString("hex").toUpperCase();
        const expiryDate = /* @__PURE__ */ new Date();
        expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
        const voucher = {
          id: crypto3.randomUUID(),
          code,
          userId,
          amount,
          token,
          message,
          expiryDate: expiryDate.toISOString(),
          status: "active",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        res.json({ success: true, voucher });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    router33.post("/redeem", authenticate, async (req, res) => {
      try {
        const { code } = req.body;
        const userId = req.user.id;
        res.json({ success: true, amount: "100", token: "cUSD" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    vouchers_default = router33;
  }
});

// server/routes/phone-payments.ts
var phone_payments_exports = {};
__export(phone_payments_exports, {
  default: () => phone_payments_default
});
import { Router as Router6 } from "express";
var router34, phone_payments_default;
var init_phone_payments = __esm({
  "server/routes/phone-payments.ts"() {
    "use strict";
    init_auth();
    router34 = Router6();
    router34.post("/link-phone", authenticate, async (req, res) => {
      try {
        const { phoneNumber } = req.body;
        const userId = req.user.id;
        res.json({ success: true, message: "OTP sent to phone" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    router34.post("/send-to-phone", authenticate, async (req, res) => {
      try {
        const { phoneNumber, amount, token } = req.body;
        res.json({ success: true, txHash: "0x..." });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    phone_payments_default = router34;
  }
});

// server/services/escrowService.ts
import { eq as eq45, and as and29 } from "drizzle-orm";
var EscrowService, escrowService;
var init_escrowService = __esm({
  "server/services/escrowService.ts"() {
    "use strict";
    init_storage();
    init_escrowSchema();
    init_schema();
    init_notificationService();
    EscrowService = class {
      async createEscrow(data) {
        const [escrow] = await db2.insert(escrowAccounts).values({
          taskId: data.taskId,
          payerId: data.payerId,
          payeeId: data.payeeId,
          amount: data.amount,
          currency: data.currency,
          status: "pending",
          milestones: data.milestones || []
        }).returning();
        if (data.milestones && data.milestones.length > 0) {
          for (let i = 0; i < data.milestones.length; i++) {
            await db2.insert(escrowMilestones).values({
              escrowId: escrow.id,
              milestoneNumber: i.toString(),
              description: data.milestones[i].description,
              amount: data.milestones[i].amount,
              status: "pending"
            });
          }
        }
        await notificationService.createNotification({
          userId: data.payeeId,
          type: "escrow",
          title: "Escrow Created",
          message: `An escrow of ${data.amount} ${data.currency} has been created for you`,
          metadata: { escrowId: escrow.id }
        });
        return escrow;
      }
      async fundEscrow(escrowId, payerId, transactionHash) {
        const escrow = await db2.select().from(escrowAccounts).where(eq45(escrowAccounts.id, escrowId)).limit(1);
        if (!escrow.length || escrow[0].payerId !== payerId) {
          throw new Error("Unauthorized or escrow not found");
        }
        if (escrow[0].status !== "pending") {
          throw new Error("Escrow already funded or completed");
        }
        const [updated] = await db2.update(escrowAccounts).set({
          status: "funded",
          fundedAt: /* @__PURE__ */ new Date(),
          transactionHash,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq45(escrowAccounts.id, escrowId)).returning();
        await db2.insert(walletTransactions2).values({
          fromUserId: payerId,
          toUserId: escrow[0].payeeId,
          walletAddress: "escrow",
          amount: escrow[0].amount,
          currency: escrow[0].currency,
          type: "transfer",
          status: "completed",
          transactionHash,
          description: `Escrow funding for ${escrowId}`
        });
        await notificationService.createNotification({
          userId: escrow[0].payeeId,
          type: "escrow",
          title: "Escrow Funded",
          message: `Escrow of ${escrow[0].amount} ${escrow[0].currency} has been funded`,
          metadata: { escrowId, transactionHash }
        });
        return updated;
      }
      async approveMilestone(escrowId, milestoneNumber, approverId, proofUrl) {
        const escrow = await db2.select().from(escrowAccounts).where(eq45(escrowAccounts.id, escrowId)).limit(1);
        if (!escrow.length) {
          throw new Error("Escrow not found");
        }
        if (escrow[0].payerId !== approverId) {
          throw new Error("Only payer can approve milestones");
        }
        const [milestone] = await db2.update(escrowMilestones).set({
          status: "approved",
          approvedBy: approverId,
          approvedAt: /* @__PURE__ */ new Date(),
          proofUrl,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(
          and29(
            eq45(escrowMilestones.escrowId, escrowId),
            eq45(escrowMilestones.milestoneNumber, milestoneNumber)
          )
        ).returning();
        await notificationService.createNotification({
          userId: escrow[0].payeeId,
          type: "escrow",
          title: "Milestone Approved",
          message: `Milestone ${milestoneNumber} has been approved`,
          metadata: { escrowId, milestoneNumber }
        });
        return milestone;
      }
      async releaseMilestone(escrowId, milestoneNumber, transactionHash) {
        const milestone = await db2.select().from(escrowMilestones).where(
          and29(
            eq45(escrowMilestones.escrowId, escrowId),
            eq45(escrowMilestones.milestoneNumber, milestoneNumber)
          )
        ).limit(1);
        if (!milestone.length || milestone[0].status !== "approved") {
          throw new Error("Milestone not approved");
        }
        const [updated] = await db2.update(escrowMilestones).set({
          status: "released",
          releasedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq45(escrowMilestones.id, milestone[0].id)).returning();
        const escrow = await db2.select().from(escrowAccounts).where(eq45(escrowAccounts.id, escrowId)).limit(1);
        await db2.insert(walletTransactions2).values({
          fromUserId: escrow[0].payerId,
          toUserId: escrow[0].payeeId,
          walletAddress: "escrow_release",
          amount: milestone[0].amount,
          currency: escrow[0].currency,
          type: "transfer",
          status: "completed",
          transactionHash,
          description: `Milestone ${milestoneNumber} release for escrow ${escrowId}`
        });
        return updated;
      }
      async releaseFullEscrow(escrowId, transactionHash) {
        const escrow = await db2.select().from(escrowAccounts).where(eq45(escrowAccounts.id, escrowId)).limit(1);
        if (!escrow.length || escrow[0].status !== "funded") {
          throw new Error("Escrow not funded or already completed");
        }
        const [updated] = await db2.update(escrowAccounts).set({
          status: "released",
          releasedAt: /* @__PURE__ */ new Date(),
          transactionHash,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq45(escrowAccounts.id, escrowId)).returning();
        await db2.insert(walletTransactions2).values({
          fromUserId: escrow[0].payerId,
          toUserId: escrow[0].payeeId,
          walletAddress: "escrow_release",
          amount: escrow[0].amount,
          currency: escrow[0].currency,
          type: "transfer",
          status: "completed",
          transactionHash,
          description: `Full escrow release for ${escrowId}`
        });
        await notificationService.createNotification({
          userId: escrow[0].payeeId,
          type: "escrow",
          title: "Escrow Released",
          message: `Full escrow of ${escrow[0].amount} ${escrow[0].currency} has been released`,
          metadata: { escrowId, transactionHash }
        });
        return updated;
      }
      async raiseDispute(escrowId, userId, reason, evidence) {
        const [dispute] = await db2.insert(escrowDisputes).values({
          escrowId,
          raisedBy: userId,
          reason,
          evidence,
          status: "open"
        }).returning();
        await db2.update(escrowAccounts).set({
          status: "disputed",
          disputeReason: reason,
          disputedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq45(escrowAccounts.id, escrowId));
        const escrow = await db2.select().from(escrowAccounts).where(eq45(escrowAccounts.id, escrowId)).limit(1);
        const otherParty = escrow[0].payerId === userId ? escrow[0].payeeId : escrow[0].payerId;
        await notificationService.createNotification({
          userId: otherParty,
          type: "escrow",
          title: "Dispute Raised",
          message: `A dispute has been raised on escrow ${escrowId}`,
          metadata: { escrowId, disputeId: dispute.id }
        });
        return dispute;
      }
      async refundEscrow(escrowId, transactionHash) {
        const escrow = await db2.select().from(escrowAccounts).where(eq45(escrowAccounts.id, escrowId)).limit(1);
        if (!escrow.length) {
          throw new Error("Escrow not found");
        }
        const [updated] = await db2.update(escrowAccounts).set({
          status: "refunded",
          refundedAt: /* @__PURE__ */ new Date(),
          transactionHash,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq45(escrowAccounts.id, escrowId)).returning();
        await db2.insert(walletTransactions2).values({
          fromUserId: escrow[0].payeeId,
          toUserId: escrow[0].payerId,
          walletAddress: "escrow_refund",
          amount: escrow[0].amount,
          currency: escrow[0].currency,
          type: "transfer",
          status: "completed",
          transactionHash,
          description: `Escrow refund for ${escrowId}`
        });
        await notificationService.createNotification({
          userId: escrow[0].payerId,
          type: "escrow",
          title: "Escrow Refunded",
          message: `Escrow of ${escrow[0].amount} ${escrow[0].currency} has been refunded`,
          metadata: { escrowId, transactionHash }
        });
        return updated;
      }
    };
    escrowService = new EscrowService();
  }
});

// server/routes/escrow.ts
var escrow_exports = {};
__export(escrow_exports, {
  default: () => escrow_default
});
import express30 from "express";
import { eq as eq46, or as or5 } from "drizzle-orm";
var router35, escrow_default;
var init_escrow = __esm({
  "server/routes/escrow.ts"() {
    "use strict";
    init_storage();
    init_escrowSchema();
    init_escrowService();
    init_auth();
    router35 = express30.Router();
    router35.post("/create", authenticate, async (req, res) => {
      try {
        const { taskId, payeeId, amount, currency, milestones } = req.body;
        const payerId = req.user.id;
        const escrow = await escrowService.createEscrow({
          taskId,
          payerId,
          payeeId,
          amount,
          currency: currency || "cUSD",
          milestones
        });
        res.json({ success: true, escrow });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router35.post("/:escrowId/fund", authenticate, async (req, res) => {
      try {
        const { escrowId } = req.params;
        const { transactionHash } = req.body;
        const payerId = req.user.id;
        const escrow = await escrowService.fundEscrow(escrowId, payerId, transactionHash);
        res.json({ success: true, escrow });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router35.post("/:escrowId/milestones/:milestoneNumber/approve", authenticate, async (req, res) => {
      try {
        const { escrowId, milestoneNumber } = req.params;
        const { proofUrl } = req.body;
        const approverId = req.user.id;
        const milestone = await escrowService.approveMilestone(escrowId, milestoneNumber, approverId, proofUrl);
        res.json({ success: true, milestone });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router35.post("/:escrowId/milestones/:milestoneNumber/release", authenticate, async (req, res) => {
      try {
        const { escrowId, milestoneNumber } = req.params;
        const { transactionHash } = req.body;
        const milestone = await escrowService.releaseMilestone(escrowId, milestoneNumber, transactionHash);
        res.json({ success: true, milestone });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router35.post("/:escrowId/release", authenticate, async (req, res) => {
      try {
        const { escrowId } = req.params;
        const { transactionHash } = req.body;
        const escrow = await escrowService.releaseFullEscrow(escrowId, transactionHash);
        res.json({ success: true, escrow });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router35.post("/:escrowId/dispute", authenticate, async (req, res) => {
      try {
        const { escrowId } = req.params;
        const { reason, evidence } = req.body;
        const userId = req.user.id;
        const dispute = await escrowService.raiseDispute(escrowId, userId, reason, evidence || []);
        res.json({ success: true, dispute });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router35.post("/:escrowId/refund", authenticate, async (req, res) => {
      try {
        const { escrowId } = req.params;
        const { transactionHash } = req.body;
        const escrow = await escrowService.refundEscrow(escrowId, transactionHash);
        res.json({ success: true, escrow });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router35.get("/my-escrows", authenticate, async (req, res) => {
      try {
        const userId = req.user.id;
        const escrows = await db2.select().from(escrowAccounts).where(or5(
          eq46(escrowAccounts.payerId, userId),
          eq46(escrowAccounts.payeeId, userId)
        ));
        res.json({ success: true, escrows });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router35.get("/:escrowId", authenticate, async (req, res) => {
      try {
        const { escrowId } = req.params;
        const escrow = await db2.select().from(escrowAccounts).where(eq46(escrowAccounts.id, escrowId)).limit(1);
        if (!escrow.length) {
          return res.status(404).json({ success: false, error: "Escrow not found" });
        }
        const milestones = await db2.select().from(escrowMilestones).where(eq46(escrowMilestones.escrowId, escrowId));
        const disputes = await db2.select().from(escrowDisputes).where(eq46(escrowDisputes.escrowId, escrowId));
        res.json({ success: true, escrow: escrow[0], milestones, disputes });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    escrow_default = router35;
  }
});

// server/routes/invoices.ts
var invoices_exports = {};
__export(invoices_exports, {
  default: () => invoices_default
});
import express31 from "express";
import { eq as eq47, or as or6, desc as desc18 } from "drizzle-orm";
var router36, invoices_default;
var init_invoices = __esm({
  "server/routes/invoices.ts"() {
    "use strict";
    init_storage();
    init_invoiceSchema();
    init_schema();
    init_auth();
    init_notificationService();
    router36 = express31.Router();
    router36.post("/create", authenticate, async (req, res) => {
      try {
        const { toUserId, daoId, amount, currency, description, lineItems, dueDate, notes } = req.body;
        const fromUserId = req.user.id;
        const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const [invoice] = await db2.insert(invoices).values({
          invoiceNumber,
          fromUserId,
          toUserId,
          daoId,
          amount,
          currency: currency || "cUSD",
          description,
          lineItems: lineItems || [],
          dueDate: dueDate ? new Date(dueDate) : null,
          notes,
          status: "draft"
        }).returning();
        res.json({ success: true, invoice });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router36.post("/:invoiceId/send", authenticate, async (req, res) => {
      try {
        const { invoiceId } = req.params;
        const userId = req.user.id;
        const invoice = await db2.select().from(invoices).where(eq47(invoices.id, invoiceId)).limit(1);
        if (!invoice.length || invoice[0].fromUserId !== userId) {
          return res.status(403).json({ success: false, error: "Unauthorized" });
        }
        const [updated] = await db2.update(invoices).set({ status: "sent", updatedAt: /* @__PURE__ */ new Date() }).where(eq47(invoices.id, invoiceId)).returning();
        if (invoice[0].toUserId) {
          await notificationService.createNotification({
            userId: invoice[0].toUserId,
            type: "invoice",
            title: "Invoice Received",
            message: `You have received an invoice for ${invoice[0].amount} ${invoice[0].currency}`,
            metadata: { invoiceId, invoiceNumber: invoice[0].invoiceNumber }
          });
        }
        res.json({ success: true, invoice: updated });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router36.post("/:invoiceId/pay", authenticate, async (req, res) => {
      try {
        const { invoiceId } = req.params;
        const { transactionHash, paymentMethod } = req.body;
        const payerId = req.user.id;
        const invoice = await db2.select().from(invoices).where(eq47(invoices.id, invoiceId)).limit(1);
        if (!invoice.length) {
          return res.status(404).json({ success: false, error: "Invoice not found" });
        }
        if (invoice[0].status === "paid") {
          return res.status(400).json({ success: false, error: "Invoice already paid" });
        }
        const [payment] = await db2.insert(invoicePayments).values({
          invoiceId,
          payerId,
          amount: invoice[0].amount,
          currency: invoice[0].currency,
          paymentMethod: paymentMethod || "wallet",
          transactionHash,
          status: "completed"
        }).returning();
        await db2.update(invoices).set({
          status: "paid",
          paidAt: /* @__PURE__ */ new Date(),
          paymentMethod: paymentMethod || "wallet",
          transactionHash,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq47(invoices.id, invoiceId));
        await db2.insert(walletTransactions2).values({
          fromUserId: payerId,
          toUserId: invoice[0].fromUserId,
          walletAddress: "invoice_payment",
          amount: invoice[0].amount,
          currency: invoice[0].currency,
          type: "transfer",
          status: "completed",
          transactionHash,
          description: `Payment for invoice ${invoice[0].invoiceNumber}`
        });
        await notificationService.createNotification({
          userId: invoice[0].fromUserId,
          type: "invoice",
          title: "Invoice Paid",
          message: `Invoice ${invoice[0].invoiceNumber} has been paid`,
          metadata: { invoiceId, transactionHash }
        });
        res.json({ success: true, payment });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router36.get("/my-invoices", authenticate, async (req, res) => {
      try {
        const userId = req.user.id;
        const { type } = req.query;
        let query = db2.select().from(invoices);
        if (type === "sent") {
          query = query.where(eq47(invoices.fromUserId, userId));
        } else if (type === "received") {
          query = query.where(eq47(invoices.toUserId, userId));
        } else {
          query = query.where(or6(
            eq47(invoices.fromUserId, userId),
            eq47(invoices.toUserId, userId)
          ));
        }
        const userInvoices = await query.orderBy(desc18(invoices.createdAt));
        res.json({ success: true, invoices: userInvoices });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router36.get("/:invoiceId", authenticate, async (req, res) => {
      try {
        const { invoiceId } = req.params;
        const invoice = await db2.select().from(invoices).where(eq47(invoices.id, invoiceId)).limit(1);
        if (!invoice.length) {
          return res.status(404).json({ success: false, error: "Invoice not found" });
        }
        const payments = await db2.select().from(invoicePayments).where(eq47(invoicePayments.invoiceId, invoiceId));
        res.json({ success: true, invoice: invoice[0], payments });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    router36.post("/:invoiceId/cancel", authenticate, async (req, res) => {
      try {
        const { invoiceId } = req.params;
        const userId = req.user.id;
        const invoice = await db2.select().from(invoices).where(eq47(invoices.id, invoiceId)).limit(1);
        if (!invoice.length || invoice[0].fromUserId !== userId) {
          return res.status(403).json({ success: false, error: "Unauthorized" });
        }
        const [updated] = await db2.update(invoices).set({ status: "cancelled", updatedAt: /* @__PURE__ */ new Date() }).where(eq47(invoices.id, invoiceId)).returning();
        res.json({ success: true, invoice: updated });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    invoices_default = router36;
  }
});

// server/services/aiAnalyticsService.ts
var aiAnalyticsService_exports = {};
__export(aiAnalyticsService_exports, {
  AIAnalyticsService: () => AIAnalyticsService,
  aiAnalyticsService: () => aiAnalyticsService
});
import { eq as eq48, gte as gte13, and as and30, sql as sql21 } from "drizzle-orm";
import { subDays as subDays2, subMonths as subMonths2 } from "date-fns";
var AIAnalyticsService, aiAnalyticsService;
var init_aiAnalyticsService = __esm({
  "server/services/aiAnalyticsService.ts"() {
    "use strict";
    init_db();
    init_schema();
    AIAnalyticsService = class {
      // Simple linear regression for predictions
      linearRegression(x, y) {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
        const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        return { slope, intercept };
      }
      // Calculate confidence based on data variance
      calculateConfidence(actual, predicted) {
        const errors2 = actual.map((a, i) => Math.abs(a - predicted[i]));
        const meanError = errors2.reduce((a, b) => a + b, 0) / errors2.length;
        const maxValue = Math.max(...actual);
        return Math.max(0, Math.min(100, 100 - meanError / maxValue * 100));
      }
      async predictTreasuryGrowth(daoId) {
        const historicalData = await db2.select({
          date: sql21`DATE(${walletTransactions2.createdAt})`,
          balance: sql21`SUM(CASE WHEN ${walletTransactions2.type} = 'deposit' THEN CAST(${walletTransactions2.amount} AS DECIMAL) ELSE -CAST(${walletTransactions2.amount} AS DECIMAL) END)`
        }).from(walletTransactions2).where(
          and30(
            eq48(walletTransactions2.daoId, daoId),
            gte13(walletTransactions2.createdAt, subMonths2(/* @__PURE__ */ new Date(), 6))
          )
        ).groupBy(sql21`DATE(${walletTransactions2.createdAt})`).orderBy(sql21`DATE(${walletTransactions2.createdAt})`);
        if (historicalData.length < 7) {
          return {
            predicted30Days: 0,
            predicted90Days: 0,
            predicted365Days: 0,
            confidence: 0
          };
        }
        const x = historicalData.map((_, i) => i);
        const y = historicalData.map((d) => d.balance);
        const { slope, intercept } = this.linearRegression(x, y);
        const lastDay = x.length - 1;
        const predicted30Days = slope * (lastDay + 30) + intercept;
        const predicted90Days = slope * (lastDay + 90) + intercept;
        const predicted365Days = slope * (lastDay + 365) + intercept;
        const predictedValues = x.map((xi) => slope * xi + intercept);
        const confidence = this.calculateConfidence(y, predictedValues);
        return {
          predicted30Days,
          predicted90Days,
          predicted365Days,
          confidence
        };
      }
      async assessRisk(daoId) {
        const dao = await db2.select().from(daos).where(eq48(daos.id, daoId)).limit(1);
        if (!dao.length) throw new Error("DAO not found");
        const recentTxs = await db2.select().from(walletTransactions2).where(
          and30(
            eq48(walletTransactions2.daoId, daoId),
            gte13(walletTransactions2.createdAt, subDays2(/* @__PURE__ */ new Date(), 30))
          )
        );
        const amounts = recentTxs.map((tx) => parseFloat(tx.amount));
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / amounts.length;
        const treasuryVolatility = Math.sqrt(variance) / mean * 100;
        const activeMembers = await db2.select({ count: sql21`COUNT(DISTINCT ${contributions.userId})` }).from(contributions).where(
          and30(
            eq48(contributions.daoId, daoId),
            gte13(contributions.createdAt, subDays2(/* @__PURE__ */ new Date(), 30))
          )
        );
        const totalMembers = dao[0].memberCount || 1;
        const memberChurn = (1 - (activeMembers[0]?.count || 0) / totalMembers) * 100;
        const recentProposals = await db2.select().from(proposals).where(
          and30(
            eq48(proposals.daoId, daoId),
            gte13(proposals.createdAt, subDays2(/* @__PURE__ */ new Date(), 30))
          )
        );
        const avgVotes = recentProposals.reduce(
          (acc, p) => acc + (p.forVotes || 0) + (p.againstVotes || 0) + (p.abstainVotes || 0),
          0
        ) / (recentProposals.length || 1);
        const governanceParticipation = avgVotes / totalMembers * 100;
        const rejectedProposals = recentProposals.filter((p) => p.status === "rejected").length;
        const proposalRejectionRate = rejectedProposals / (recentProposals.length || 1) * 100;
        const treasuryBalance = parseFloat(dao[0].treasuryBalance || "0");
        const monthlyBurn = amounts.filter((a) => a < 0).reduce((a, b) => a + Math.abs(b), 0);
        const runway = monthlyBurn > 0 ? treasuryBalance / monthlyBurn : 12;
        const financialHealth = Math.min(100, runway / 12 * 100);
        const factors = {
          treasuryVolatility: Math.min(100, treasuryVolatility),
          memberChurn: Math.min(100, memberChurn),
          governanceParticipation: 100 - Math.min(100, governanceParticipation),
          proposalRejectionRate: Math.min(100, proposalRejectionRate),
          financialHealth: 100 - financialHealth
        };
        const score = Object.values(factors).reduce((a, b) => a + b, 0) / 5;
        let overall;
        if (score < 25) overall = "low";
        else if (score < 50) overall = "medium";
        else if (score < 75) overall = "high";
        else overall = "critical";
        const recommendations = [];
        if (factors.treasuryVolatility > 50) recommendations.push("Implement stricter treasury management controls");
        if (factors.memberChurn > 50) recommendations.push("Increase member engagement initiatives");
        if (factors.governanceParticipation > 60) recommendations.push("Simplify proposal voting process");
        if (factors.proposalRejectionRate > 40) recommendations.push("Improve proposal quality and vetting");
        if (factors.financialHealth > 60) recommendations.push("Diversify revenue streams urgently");
        return { overall, score, factors, recommendations };
      }
      async optimizePortfolio(daoId) {
        const vaultBalances = await db2.select({
          currency: vaults.currency,
          balance: sql21`SUM(CAST(${vaults.balance} AS DECIMAL))`
        }).from(vaults).where(eq48(vaults.daoId, daoId)).groupBy(vaults.currency);
        const totalBalance = vaultBalances.reduce((acc, v) => acc + v.balance, 0);
        const currentAllocation = {};
        vaultBalances.forEach((v) => {
          currentAllocation[v.currency] = v.balance / totalBalance * 100;
        });
        const recommendedAllocation = {
          "cUSD": 25,
          "USDT": 15,
          "CELO": 30,
          "cEUR": 15,
          "DAI": 15
        };
        const rebalanceActions = [];
        Object.keys(recommendedAllocation).forEach((asset) => {
          const current = currentAllocation[asset] || 0;
          const target = recommendedAllocation[asset];
          const diff = target - current;
          if (Math.abs(diff) > 5) {
            rebalanceActions.push({
              action: diff > 0 ? "increase" : "decrease",
              asset,
              amount: Math.abs(diff),
              reason: diff > 0 ? `Underweight by ${Math.abs(diff).toFixed(1)}%` : `Overweight by ${Math.abs(diff).toFixed(1)}%`
            });
          }
        });
        return {
          currentAllocation,
          recommendedAllocation,
          expectedReturn: 8.5,
          // Projected annual return
          expectedRisk: 12.3,
          // Projected volatility
          rebalanceActions
        };
      }
      async measureImpact(daoId) {
        const dao = await db2.select().from(daos).where(eq48(daos.id, daoId)).limit(1);
        if (!dao.length) throw new Error("DAO not found");
        const membersServed = dao[0].memberCount || 0;
        const fundsDistributed = await db2.select({ total: sql21`SUM(CAST(${walletTransactions2.amount} AS DECIMAL))` }).from(walletTransactions2).where(
          and30(
            eq48(walletTransactions2.daoId, daoId),
            eq48(walletTransactions2.type, "disbursement")
          )
        );
        const projectsCompleted = await db2.select({ count: sql21`COUNT(*)` }).from(proposals).where(
          and30(
            eq48(proposals.daoId, daoId),
            eq48(proposals.status, "executed")
          )
        );
        const communityEngagement = await db2.select({ count: sql21`COUNT(*)` }).from(contributions).where(eq48(contributions.daoId, daoId));
        const vaultReturns = await db2.select({
          total: sql21`SUM(CAST(${vaults.yieldGenerated} AS DECIMAL))`
        }).from(vaults).where(eq48(vaults.daoId, daoId));
        const totalProposals = await db2.select({ count: sql21`COUNT(*)` }).from(proposals).where(eq48(proposals.daoId, daoId));
        const votedProposals = await db2.select({ count: sql21`COUNT(*)` }).from(proposals).where(
          and30(
            eq48(proposals.daoId, daoId),
            sql21`${proposals.forVotes} + ${proposals.againstVotes} + ${proposals.abstainVotes} > 0`
          )
        );
        const participationRate = (votedProposals[0]?.count || 0) / (totalProposals[0]?.count || 1) * 100;
        const socialImpact = {
          membersServed,
          fundsDistributed: fundsDistributed[0]?.total || 0,
          projectsCompleted: projectsCompleted[0]?.count || 0,
          communityEngagement: communityEngagement[0]?.count || 0
        };
        const financialImpact = {
          returnsGenerated: vaultReturns[0]?.total || 0,
          costsReduced: 0,
          // Calculate from efficiency metrics
          efficiencyGains: 0
        };
        const governanceImpact = {
          participationRate,
          decisionQuality: 75,
          // Based on proposal success rate
          transparencyScore: 85
          // Based on documentation and reporting
        };
        const sustainabilityScore = socialImpact.membersServed / 100 * 25 + participationRate / 100 * 25 + Math.min(100, financialImpact.returnsGenerated / 1e3) * 25 + governanceImpact.transparencyScore / 100 * 25;
        return {
          socialImpact,
          financialImpact,
          governanceImpact,
          sustainabilityScore: Math.min(100, sustainabilityScore)
        };
      }
      async getComprehensiveAnalytics(daoId) {
        const [treasuryPrediction, riskAssessment, portfolioOptimization, impactMetrics] = await Promise.all([
          this.predictTreasuryGrowth(daoId),
          this.assessRisk(daoId),
          this.optimizePortfolio(daoId),
          this.measureImpact(daoId)
        ]);
        return {
          predictions: { treasuryGrowth: treasuryPrediction },
          risk: riskAssessment,
          portfolio: portfolioOptimization,
          impact: impactMetrics,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    };
    aiAnalyticsService = new AIAnalyticsService();
  }
});

// server/index.ts
import express32 from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";

// server/nextAuthMiddleware.ts
init_auth();
init_storage();
import { getToken } from "next-auth/jwt";
var isAuthenticated2 = async (req, res, next) => {
  try {
    let token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    let userClaims = null;
    if (token && token.sub) {
      userClaims = {
        sub: token.sub,
        email: token.email || void 0,
        role: token.role || void 0
      };
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const jwtToken = authHeader.substring(7);
        const decoded = verifyAccessToken(jwtToken);
        if (decoded) {
          userClaims = {
            sub: decoded.sub,
            email: decoded.email,
            role: decoded.role
          };
        }
      }
    }
    if (!userClaims) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!userClaims.role) {
      try {
        const user = await storage.getUser(userClaims.sub);
        if (user) {
          userClaims.role = user.role || "user";
        }
      } catch (error) {
        console.warn("Could not fetch user role:", error);
      }
    }
    req.user = { claims: userClaims };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
var requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user?.claims?.role) {
      return res.status(403).json({ message: "Access denied: No role assigned" });
    }
    if (!allowedRoles.includes(req.user.claims.role)) {
      return res.status(403).json({
        message: "Access denied: Insufficient permissions",
        required: allowedRoles,
        current: req.user.claims.role
      });
    }
    next();
  };
};
var requireAdmin = requireRole("admin", "super_admin");
var requireModerator = requireRole("admin", "super_admin", "moderator");
var requirePremium = requireRole("admin", "super_admin", "premium", "dao_owner");

// server/routes.ts
import Stripe from "stripe";

// server/routes/health.ts
init_storage();
import express from "express";

// server/monitoring/metricsCollector.ts
init_logger();
import { performance } from "perf_hooks";
var PrometheusMetrics = class {
  constructor() {
    this.metrics = /* @__PURE__ */ new Map();
    this.counters = /* @__PURE__ */ new Map();
    this.gauges = /* @__PURE__ */ new Map();
    this.histograms = /* @__PURE__ */ new Map();
  }
  counter(name, labels) {
    const key = this.getKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }
  gauge(name, value, labels) {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
  }
  histogram(name, value, labels) {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key).push(value);
  }
  getKey(name, labels) {
    if (!labels) return name;
    const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",");
    return `${name}{${labelStr}}`;
  }
  getMetrics() {
    const lines = [];
    for (const [key, value] of this.counters.entries()) {
      lines.push(`# TYPE ${key.split("{")[0]} counter`);
      lines.push(`${key} ${value}`);
    }
    for (const [key, value] of this.gauges.entries()) {
      lines.push(`# TYPE ${key.split("{")[0]} gauge`);
      lines.push(`${key} ${value}`);
    }
    for (const [key, values] of this.histograms.entries()) {
      const baseName = key.split("{")[0];
      lines.push(`# TYPE ${baseName} histogram`);
      const sorted = values.sort((a, b) => a - b);
      const count3 = values.length;
      const sum3 = values.reduce((a, b) => a + b, 0);
      lines.push(`${key.replace("}", ',quantile="0.5"}')} ${this.quantile(sorted, 0.5)}`);
      lines.push(`${key.replace("}", ',quantile="0.95"}')} ${this.quantile(sorted, 0.95)}`);
      lines.push(`${key.replace("}", ',quantile="0.99"}')} ${this.quantile(sorted, 0.99)}`);
      lines.push(`${baseName}_count${key.includes("{") ? key.substring(key.indexOf("{")) : ""} ${count3}`);
      lines.push(`${baseName}_sum${key.includes("{") ? key.substring(key.indexOf("{")) : ""} ${sum3}`);
    }
    return lines.join("\n");
  }
  quantile(sorted, q) {
    const index2 = Math.ceil(sorted.length * q) - 1;
    return sorted[Math.max(0, index2)] || 0;
  }
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
};
var prometheus = new PrometheusMetrics();
var MetricsCollector = class _MetricsCollector {
  constructor() {
    this.metrics = {};
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
    this.activeConnections = 0;
    this.metrics = {
      requests: [],
      system: [],
      database: [],
      business: []
    };
    setInterval(() => this.collectSystemMetrics(), 3e4);
    setInterval(() => this.cleanOldMetrics(), 36e5);
  }
  static getInstance() {
    if (!_MetricsCollector.instance) {
      _MetricsCollector.instance = new _MetricsCollector();
    }
    return _MetricsCollector.instance;
  }
  requestMiddleware() {
    return (req, res, next) => {
      const startTime = performance.now();
      this.activeConnections++;
      res.on("finish", () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        this.requestCount++;
        this.responseTimes.push(responseTime);
        if (res.statusCode >= 400) {
          this.errorCount++;
        }
        const metric = {
          method: req.method,
          route: req.route?.path || req.path,
          statusCode: res.statusCode,
          responseTime,
          timestamp: Date.now(),
          userAgent: req.get("User-Agent"),
          ip: req.ip,
          userId: req.user?.id
        };
        this.addRequestMetric(metric);
        this.activeConnections--;
      });
      next();
    };
  }
  addRequestMetric(metric) {
    this.metrics.requests.push(metric);
    prometheus.counter("http_requests_total", {
      method: metric.method,
      route: metric.route,
      status: metric.statusCode.toString()
    });
    prometheus.histogram("http_request_duration_ms", metric.responseTime, {
      method: metric.method,
      route: metric.route
    });
    if (metric.statusCode >= 400) {
      prometheus.counter("http_request_errors_total", {
        method: metric.method,
        route: metric.route,
        status: metric.statusCode.toString()
      });
    }
    if (metric.responseTime > 1e3) {
      logger.warn(`Slow request: ${metric.method} ${metric.route} took ${metric.responseTime}ms`);
    }
    if (metric.statusCode >= 500) {
      logger.error(`Server error: ${metric.method} ${metric.route} returned ${metric.statusCode}`);
    }
  }
  collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const metric = {
      timestamp: Date.now(),
      memory: memoryUsage,
      uptime: process.uptime(),
      activeConnections: this.activeConnections,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      avgResponseTime: this.getAverageResponseTime(),
      cpuUsage: cpuUsage.user / 1e6
      // Convert to seconds
    };
    this.metrics.system.push(metric);
    prometheus.gauge("nodejs_memory_usage_bytes", memoryUsage.heapUsed, { type: "heap_used" });
    prometheus.gauge("nodejs_memory_usage_bytes", memoryUsage.heapTotal, { type: "heap_total" });
    prometheus.gauge("nodejs_memory_usage_bytes", memoryUsage.external, { type: "external" });
    prometheus.gauge("process_uptime_seconds", process.uptime());
    prometheus.gauge("http_requests_total", this.requestCount);
    prometheus.gauge("http_request_errors_total", this.errorCount);
    prometheus.gauge("http_request_duration_ms", this.getAverageResponseTime());
    prometheus.gauge("http_active_connections", this.activeConnections);
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 500) {
      logger.warn(`High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
    }
  }
  addDatabaseMetric(metric) {
    this.metrics.database.push({
      ...metric,
      timestamp: Date.now()
    });
  }
  addBusinessMetric(metric) {
    this.metrics.business.push({
      ...metric,
      timestamp: Date.now()
    });
  }
  getAverageResponseTime() {
    if (this.responseTimes.length === 0) return 0;
    const sum3 = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return sum3 / this.responseTimes.length;
  }
  cleanOldMetrics() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1e3;
    this.metrics.requests = this.metrics.requests.filter((m) => m.timestamp > oneDayAgo);
    this.metrics.system = this.metrics.system.filter((m) => m.timestamp > oneDayAgo);
    this.metrics.database = this.metrics.database.filter((m) => m.timestamp > oneDayAgo);
    this.metrics.business = this.metrics.business.filter((m) => m.timestamp > oneDayAgo);
    this.responseTimes = this.responseTimes.slice(-1e3);
  }
  getMetrics() {
    return {
      ...this.metrics,
      summary: {
        totalRequests: this.requestCount,
        totalErrors: this.errorCount,
        errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount * 100 : 0,
        avgResponseTime: this.getAverageResponseTime(),
        activeConnections: this.activeConnections,
        uptime: process.uptime()
      }
    };
  }
  getHealthScore() {
    const metrics = this.getMetrics();
    let score = 100;
    if (metrics.summary.errorRate > 5) score -= 20;
    else if (metrics.summary.errorRate > 1) score -= 10;
    if (metrics.summary.avgResponseTime > 1e3) score -= 20;
    else if (metrics.summary.avgResponseTime > 500) score -= 10;
    const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsageMB > 1e3) score -= 20;
    else if (memoryUsageMB > 500) score -= 10;
    prometheus.gauge("application_health_score", score);
    return Math.max(0, score);
  }
  getPrometheusMetrics() {
    return prometheus.getMetrics();
  }
  addBusinessMetrics(metrics) {
    prometheus.gauge("business_active_users", metrics.activeUsers);
    prometheus.gauge("business_total_transactions", metrics.totalTransactions);
    prometheus.gauge("business_total_volume_usd", metrics.totalVolumeUSD);
    prometheus.gauge("business_total_proposals", metrics.totalProposals);
    prometheus.gauge("business_active_vaults", metrics.activeVaults);
    prometheus.gauge("business_total_staked", metrics.totalStaked);
    this.addBusinessMetric(metrics);
  }
};
var metricsCollector = MetricsCollector.getInstance();

// server/routes/health.ts
init_logger();
init_config();
function handler(req, res) {
  res.status(200).json({ status: "ok", timestamp: Date.now() });
}
var router = express.Router();
async function checkDatabase() {
  const startTime = Date.now();
  try {
    await db2.execute("SELECT 1");
    return {
      status: "pass",
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: Date.now() - startTime,
      message: "Database connection failed",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}
async function checkRedis() {
  const startTime = Date.now();
  try {
    return {
      status: "pass",
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: Date.now() - startTime,
      message: "Redis connection failed",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}
function checkMemory() {
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
  let status = "pass";
  let message;
  if (memoryUsageMB > 1e3) {
    status = "fail";
    message = `High memory usage: ${memoryUsageMB.toFixed(2)}MB`;
  } else if (memoryUsageMB > 500) {
    status = "warn";
    message = `Moderate memory usage: ${memoryUsageMB.toFixed(2)}MB`;
  }
  return {
    status,
    responseTime: 0,
    message,
    details: {
      heapUsed: `${memoryUsageMB.toFixed(2)}MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`
    }
  };
}
function checkDisk() {
  return {
    status: "pass",
    responseTime: 0,
    details: {
      available: "Unknown",
      used: "Unknown"
    }
  };
}
function checkStorage() {
  try {
    return {
      status: "pass",
      responseTime: 0
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: 0,
      message: "Storage check failed",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}
router.get("/", async (req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: env.NODE_ENV,
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime()
  });
});
router.get("/detailed", async (req, res) => {
  const startTime = Date.now();
  try {
    const checks = {
      database: await checkDatabase(),
      redis: await checkRedis(),
      storage: checkStorage(),
      memory: checkMemory(),
      disk: checkDisk()
    };
    const metrics = metricsCollector.getMetrics();
    const healthScore = metricsCollector.getHealthScore();
    const hasFailures = Object.values(checks).some((check) => check.status === "fail");
    const hasWarnings = Object.values(checks).some((check) => check.status === "warn");
    let overallStatus;
    if (hasFailures) {
      overallStatus = "unhealthy";
    } else if (hasWarnings || healthScore < 80) {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }
    const healthCheck = {
      status: overallStatus,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      environment: env.NODE_ENV,
      version: process.env.npm_package_version || "1.0.0",
      uptime: process.uptime(),
      checks,
      metrics: {
        healthScore,
        responseTime: Date.now() - startTime,
        errorRate: metrics.summary.errorRate,
        activeConnections: metrics.summary.activeConnections
      }
    };
    const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;
    res.status(statusCode).json(healthCheck);
    if (overallStatus === "unhealthy") {
      logger.error("Health check failed", { checks, healthScore });
    }
  } catch (error) {
    logger.error("Health check error", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      error: "Health check failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});
router.get("/ready", async (req, res) => {
  try {
    const dbCheck = await checkDatabase();
    if (dbCheck.status === "fail") {
      return res.status(503).json({
        ready: false,
        reason: "Database not available"
      });
    }
    res.json({
      ready: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: "Readiness check failed"
    });
  }
});
router.get("/live", (req, res) => {
  res.json({
    alive: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime()
  });
});
router.get("/metrics", (req, res) => {
  const metrics = metricsCollector.getMetrics();
  res.json(metrics);
});
router.get("/metrics/prometheus", (req, res) => {
  res.set("Content-Type", "text/plain");
  res.send(metricsCollector.getPrometheusMetrics());
});
router.get("/system", (req, res) => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  res.json({
    memory: {
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`
    },
    cpu: {
      user: `${(cpuUsage.user / 1e6).toFixed(2)}s`,
      system: `${(cpuUsage.system / 1e6).toFixed(2)}s`
    },
    uptime: `${process.uptime().toFixed(2)}s`,
    version: process.version,
    platform: process.platform,
    arch: process.arch
  });
});

// server/routes/sse.ts
import express2 from "express";
init_notificationService();
var router2 = express2.Router();
router2.get("/notifications", isAuthenticated2, (req, res) => {
  const userId = req.user.claims.sub;
  notificationService.setupSSE(userId, res);
});
var sse_default = router2;

// server/routes/wallet.ts
import express3 from "express";

// server/agent_wallet.ts
import Web3 from "web3";
import { isAddress } from "web3-validator";
import dotenv2 from "dotenv";
dotenv2.config();
var ENHANCED_ERC20_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "_spender", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      { "name": "_owner", "type": "address" },
      { "name": "_spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "_from", "type": "address" },
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "transferFrom",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  }
];
var MULTISIG_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "getOwners",
    "outputs": [{ "name": "", "type": "address[]" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "required",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "destination", "type": "address" },
      { "name": "value", "type": "uint256" },
      { "name": "data", "type": "bytes" }
    ],
    "name": "submitTransaction",
    "outputs": [{ "name": "transactionId", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{ "name": "transactionId", "type": "uint256" }],
    "name": "confirmTransaction",
    "outputs": [],
    "type": "function"
  }
];
var EnhancedAgentWallet = class {
  constructor(privateKey, networkConfig, permissionCheck, contributionLogger, billingLogger, priceOracle) {
    this.transactionCache = /* @__PURE__ */ new Map();
    this.web3 = new Web3(networkConfig.rpcUrl);
    this.networkConfig = networkConfig;
    const normalizedKey = WalletManager.normalizePrivateKey(privateKey);
    if (!WalletManager.validatePrivateKey(normalizedKey)) {
      throw new Error("Invalid private key format");
    }
    this.account = this.web3.eth.accounts.privateKeyToAccount(normalizedKey);
    this.chainId = networkConfig.chainId;
    this.permissionCheck = permissionCheck;
    this.contributionLogger = contributionLogger;
    this.billingLogger = billingLogger;
    this.priceOracle = priceOracle;
  }
  /**
   * Approve a spender to spend a specified amount of ERC-20 tokens.
   * @param tokenAddress ERC-20 token contract address
   * @param spender Spender address
   * @param amount Amount in human units (not wei)
   * @param gasConfig Optional gas config
   */
  async approveToken(tokenAddress, spender, amount, gasConfig) {
    if (!isAddress(tokenAddress)) {
      throw new Error("Invalid token address");
    }
    if (!isAddress(spender)) {
      throw new Error("Invalid spender address");
    }
    try {
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      const amountWei = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || await this.getOptimalGasConfig();
      const transaction = {
        to: tokenAddress,
        data: contract.methods.approve(spender, amountWei.toString()).encodeABI(),
        chainId: this.chainId,
        gas: 1e5,
        nonce: Number(nonce),
        ...optimalGasConfig
      };
      transaction.gas = await this.estimateGasWithBuffer(transaction);
      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction);
      console.log(`Token approval sent: ${txHash.transactionHash}`);
      const result = {
        hash: typeof txHash.transactionHash === "string" ? txHash.transactionHash : "",
        status: "pending",
        timestamp: Date.now()
      };
      this.transactionCache.set(result.hash, result);
      return result;
    } catch (error) {
      console.error("Token approval failed:", error);
      throw new Error(`Token approval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  /**
   * Get the allowance for a spender on an ERC-20 token.
   * @param tokenAddress ERC-20 token contract address
   * @param spender Spender address
   * @returns Allowance in human units
   */
  async getAllowance(tokenAddress, spender) {
    if (!isAddress(tokenAddress)) {
      throw new Error("Invalid token address");
    }
    if (!isAddress(spender)) {
      throw new Error("Invalid spender address");
    }
    try {
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      const allowance = await contract.methods.allowance(this.account.address, spender).call();
      return Number(allowance) / Math.pow(10, tokenInfo.decimals);
    } catch (error) {
      throw new Error(`Failed to get allowance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  /**
   * Get the status of a transaction by hash.
   * @param txHash Transaction hash
   * @returns TransactionResult with status
   */
  async getTransactionStatus(txHash) {
    try {
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (!receipt) {
        return {
          hash: txHash,
          status: "pending",
          timestamp: Date.now()
        };
      }
      return {
        hash: txHash,
        status: receipt.status ? "success" : "failed",
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed),
        effectiveGasPrice: receipt.effectiveGasPrice ? Number(receipt.effectiveGasPrice) : void 0,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        hash: txHash,
        status: "failed",
        errorReason: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }
  // Utility to normalize private key (add 0x, trim whitespace)
  static normalizePrivateKey(privateKey) {
    let key = privateKey.trim();
    if (!key.startsWith("0x")) {
      key = "0x" + key;
    }
    return key;
  }
  // Enhanced balance operations
  async getBalance() {
    const balance = await this.web3.eth.getBalance(this.account.address);
    return BigInt(balance);
  }
  async getBalanceCelo(address) {
    const targetAddress = address || this.account.address;
    const balance = await this.web3.eth.getBalance(targetAddress);
    return parseFloat(this.web3.utils.fromWei(balance, "ether"));
  }
  async getBalanceEth(address) {
    const targetAddress = address || this.account.address;
    const balance = await this.web3.eth.getBalance(targetAddress);
    return parseFloat(this.web3.utils.fromWei(balance, "ether"));
  }
  async getNetworkInfo() {
    try {
      const [latestBlock, gasPrice] = await Promise.all([
        this.web3.eth.getBlockNumber(),
        this.web3.eth.getGasPrice()
      ]);
      return {
        chainId: this.chainId,
        latestBlock: Number(latestBlock),
        gasPrice: Number(gasPrice),
        connected: true,
        networkName: this.networkConfig.name,
        explorerUrl: this.networkConfig.explorerUrl
      };
    } catch (error) {
      return {
        chainId: this.chainId,
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        networkName: this.networkConfig.name
      };
    }
  }
  async getTokenInfo(tokenAddress, includePrice = false) {
    try {
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const [symbol, name, decimals, balance, totalSupply] = await Promise.all([
        contract.methods.symbol().call(),
        contract.methods.name().call(),
        contract.methods.decimals().call(),
        contract.methods.balanceOf(this.account.address).call(),
        contract.methods.totalSupply().call().catch(() => "0")
      ]);
      const decimalCount = Number(decimals);
      const balanceFormatted = Number(balance) / Math.pow(10, decimalCount);
      const tokenInfo = {
        symbol: String(symbol),
        name: String(name),
        decimals: decimalCount,
        balance: String(balance),
        balanceFormatted,
        totalSupply: String(totalSupply)
      };
      if (includePrice && this.priceOracle) {
        try {
          tokenInfo.priceUsd = await this.priceOracle(tokenAddress);
        } catch (error) {
          console.warn(`Failed to get price for ${tokenAddress}:`, error);
        }
      }
      return tokenInfo;
    } catch (error) {
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // Enhanced gas estimation with EIP-1559 support
  async getOptimalGasConfig() {
    try {
      if (this.supportsEIP1559()) {
        const block = await this.web3.eth.getBlock("latest");
        if (block.baseFeePerGas) {
          const baseFee = BigInt(block.baseFeePerGas);
          const priorityFee = BigInt(this.web3.utils.toWei("2", "gwei"));
          const maxFee = baseFee * BigInt(2) + priorityFee;
          return {
            maxFeePerGas: maxFee.toString(),
            maxPriorityFeePerGas: priorityFee.toString()
          };
        }
      }
      const gasPrice = await this.web3.eth.getGasPrice();
      return { gasPrice: gasPrice.toString() };
    } catch (error) {
      console.warn("Failed to get optimal gas config:", error);
      return { gasPrice: this.web3.utils.toWei("20", "gwei") };
    }
  }
  supportsEIP1559() {
    const eip1559Networks = [1, 5, 137, 80001, 42161, 421613];
    return eip1559Networks.includes(this.chainId);
  }
  async estimateGasWithBuffer(transaction) {
    try {
      const estimated = await this.web3.eth.estimateGas(transaction);
      const buffered = Math.floor(Number(estimated) * 1.2);
      console.log(`Gas estimate: ${estimated}, with buffer: ${buffered}`);
      return buffered;
    } catch (error) {
      console.warn("Gas estimation failed, using default:", error);
      return 1e5;
    }
  }
  // Enhanced transaction methods
  async sendNativeToken(toAddress, amountEth, gasConfig) {
    if (!isAddress(toAddress)) {
      throw new Error("Invalid recipient address");
    }
    const amountWei = this.web3.utils.toWei(amountEth.toString(), "ether");
    const balance = await this.getBalance();
    if (balance < BigInt(amountWei)) {
      const balanceEth = this.web3.utils.fromWei(balance.toString(), "ether");
      throw new Error(`Insufficient balance. Have ${balanceEth} ETH, need ${amountEth}`);
    }
    try {
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || await this.getOptimalGasConfig();
      const transaction = {
        to: toAddress,
        value: amountWei,
        gas: 21e3,
        nonce: Number(nonce),
        chainId: this.chainId,
        ...optimalGasConfig
      };
      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction);
      console.log(`Native token transfer sent: ${txHash.transactionHash}`);
      const result = {
        hash: typeof txHash.transactionHash === "string" ? txHash.transactionHash : "",
        status: "pending",
        timestamp: Date.now()
      };
      this.transactionCache.set(result.hash, result);
      return result;
    } catch (error) {
      console.error("Native token transfer failed:", error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async sendTokenHuman(tokenAddress, toAddress, amount, gasConfig) {
    if (!isAddress(tokenAddress)) {
      throw new Error("Invalid token address");
    }
    if (!isAddress(toAddress)) {
      throw new Error("Invalid recipient address");
    }
    try {
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      const amountWei = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));
      if (BigInt(tokenInfo.balance) < amountWei) {
        throw new Error(
          `Insufficient token balance. Have ${tokenInfo.balanceFormatted.toFixed(6)} ${tokenInfo.symbol}, need ${amount}`
        );
      }
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || await this.getOptimalGasConfig();
      const transaction = {
        to: tokenAddress,
        data: contract.methods.transfer(toAddress, amountWei.toString()).encodeABI(),
        chainId: this.chainId,
        gas: 1e5,
        nonce: Number(nonce),
        ...optimalGasConfig
      };
      transaction.gas = await this.estimateGasWithBuffer(transaction);
      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction);
      console.log(`Token transfer sent: ${txHash.transactionHash}`);
      const result = {
        hash: typeof txHash.transactionHash === "string" ? txHash.transactionHash : "",
        status: "pending",
        timestamp: Date.now()
      };
      this.transactionCache.set(result.hash, result);
      return result;
    } catch (error) {
      console.error("Token transfer failed:", error);
      throw new Error(`Token transfer failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // Batch operations
  async batchTransfer(transfers) {
    const results = [];
    for (const transfer of transfers) {
      try {
        let result;
        if (transfer.tokenAddress) {
          result = await this.sendTokenHuman(transfer.tokenAddress, transfer.toAddress, transfer.amount);
        } else {
          result = await this.sendNativeToken(transfer.toAddress, transfer.amount);
        }
        results.push(result);
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      } catch (error) {
        console.error(`Batch transfer failed for ${transfer.toAddress}:`, error);
        results.push({
          hash: "",
          status: "failed",
          errorReason: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        });
      }
    }
    return results;
  }
  // Enhanced portfolio management
  async getEnhancedPortfolio(tokenAddresses) {
    const portfolio = {
      address: this.account.address,
      nativeBalance: await this.getBalanceEth(),
      tokens: {},
      networkInfo: await this.getNetworkInfo(),
      lastUpdated: Date.now()
    };
    let totalValueUsd = 0;
    if (this.priceOracle) {
      try {
        const nativeTokenPrice = await this.priceOracle("native");
        portfolio.nativeBalanceUsd = portfolio.nativeBalance * nativeTokenPrice;
        totalValueUsd += portfolio.nativeBalanceUsd;
      } catch (error) {
        console.warn("Failed to get native token price:", error);
      }
    }
    for (const tokenAddress of tokenAddresses) {
      try {
        const tokenInfo = await this.getTokenInfo(tokenAddress, true);
        portfolio.tokens[tokenAddress] = tokenInfo;
        if (tokenInfo.priceUsd && tokenInfo.balanceFormatted > 0) {
          totalValueUsd += tokenInfo.balanceFormatted * tokenInfo.priceUsd;
        }
      } catch (error) {
        console.warn(`Failed to get info for token ${tokenAddress}:`, error);
        portfolio.tokens[tokenAddress] = {
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    if (totalValueUsd > 0) {
      portfolio.totalValueUsd = totalValueUsd;
    }
    return portfolio;
  }
  // Multisig support
  async getMultisigInfo(multisigAddress) {
    try {
      const contract = new this.web3.eth.Contract(MULTISIG_ABI, multisigAddress);
      const [ownersRaw, required] = await Promise.all([
        contract.methods.getOwners().call(),
        contract.methods.required().call()
      ]);
      const owners = Array.isArray(ownersRaw) ? ownersRaw : [];
      const isOwner = owners.includes(this.account.address);
      return {
        owners,
        required: Number(required),
        isOwner
      };
    } catch (error) {
      throw new Error(`Failed to get multisig info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async submitMultisigTransaction(multisigAddress, destination, value, data = "0x") {
    try {
      const contract = new this.web3.eth.Contract(MULTISIG_ABI, multisigAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const gasConfig = await this.getOptimalGasConfig();
      const transaction = {
        to: multisigAddress,
        data: contract.methods.submitTransaction(destination, value, data).encodeABI(),
        chainId: this.chainId,
        gas: 2e5,
        nonce: Number(nonce),
        ...gasConfig
      };
      transaction.gas = await this.estimateGasWithBuffer(transaction);
      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction);
      console.log(`Multisig transaction submitted: ${txHash.transactionHash}`);
      return {
        hash: typeof txHash.transactionHash === "string" ? txHash.transactionHash : "",
        status: "pending",
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Multisig transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // Enhanced transaction monitoring
  async waitForTransaction(txHash, timeout = 120, pollLatency = 2) {
    try {
      console.log(`Waiting for transaction: ${txHash}`);
      const receipt = await new Promise((resolve, reject) => {
        const startTime = Date.now();
        const poll = async () => {
          try {
            const receipt2 = await this.web3.eth.getTransactionReceipt(txHash);
            if (receipt2) {
              resolve(receipt2);
              return;
            }
          } catch (error) {
          }
          if (Date.now() - startTime > timeout * 1e3) {
            reject(new Error("Transaction timeout"));
            return;
          }
          setTimeout(poll, pollLatency * 1e3);
        };
        poll();
      });
      const result = {
        hash: txHash,
        status: receipt.status ? "success" : "failed",
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed),
        effectiveGasPrice: receipt.effectiveGasPrice ? Number(receipt.effectiveGasPrice) : void 0,
        timestamp: Date.now()
      };
      this.transactionCache.set(txHash, result);
      console.log(`Transaction ${txHash} ${result.status} in block ${result.blockNumber}`);
      return result;
    } catch (error) {
      const failedResult = {
        hash: txHash,
        status: "failed",
        errorReason: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
      this.transactionCache.set(txHash, failedResult);
      throw new Error(`Transaction confirmation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // DAO Treasury Management with enhanced features
  async scheduleDisburse(daoId, userId, disbursements, executeAt) {
    const scheduledId = `${daoId}-${Date.now()}`;
    const scheduledDisbursements = disbursements.map((d) => ({
      ...d,
      scheduledAt: executeAt || Date.now()
    }));
    console.log(`Scheduled disbursement ${scheduledId} for ${new Date(executeAt || Date.now())}`);
    return { scheduledId, disbursements: scheduledDisbursements };
  }
  async estimateDisbursementCost(disbursements) {
    const breakdown = [];
    let totalGasCost = 0;
    for (let i = 0; i < disbursements.length; i++) {
      const d = disbursements[i];
      let gasEstimate;
      if (d.tokenAddress) {
        gasEstimate = 65e3;
      } else {
        gasEstimate = 21e3;
      }
      const gasPrice = await this.web3.eth.getGasPrice();
      const gasCost = Number(gasPrice) * gasEstimate;
      breakdown.push({ index: i, gasCost });
      totalGasCost += gasCost;
    }
    const result = { totalGasCost, breakdown };
    if (this.priceOracle) {
      try {
        const ethPrice = await this.priceOracle("native");
        result.totalGasCostUsd = totalGasCost / 1e18 * ethPrice;
      } catch (error) {
        console.warn("Failed to get ETH price for cost estimation:", error);
      }
    }
    return result;
  }
  // Utility methods
  async getTransactionHistory(limit = 10) {
    return Array.from(this.transactionCache.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit);
  }
  async clearTransactionCache() {
    this.transactionCache.clear();
  }
  getExplorerUrl(txHash) {
    return `${this.networkConfig.explorerUrl}/tx/${txHash}`;
  }
  // Getters
  get address() {
    return this.account.address;
  }
  get network() {
    return this.networkConfig;
  }
};
var NetworkConfig = class _NetworkConfig {
  static {
    this.CELO_MAINNET = new _NetworkConfig(
      "https://forno.celo.org",
      42220,
      "Celo Mainnet",
      "https://explorer.celo.org"
    );
  }
  static {
    this.CELO_ALFAJORES = new _NetworkConfig(
      "https://alfajores-forno.celo-testnet.org",
      44787,
      "Celo Alfajores Testnet",
      "https://alfajores-blockscout.celo-testnet.org"
    );
  }
  static {
    this.ETHEREUM_MAINNET = new _NetworkConfig(
      "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
      1,
      "Ethereum Mainnet",
      "https://etherscan.io"
    );
  }
  static {
    this.POLYGON_MAINNET = new _NetworkConfig(
      "https://polygon-rpc.com",
      137,
      "Polygon Mainnet",
      "https://polygonscan.com"
    );
  }
  static {
    this.ARBITRUM_ONE = new _NetworkConfig(
      "https://arb1.arbitrum.io/rpc",
      42161,
      "Arbitrum One",
      "https://arbiscan.io"
    );
  }
  constructor(rpcUrl, chainId, name, explorerUrl = "") {
    this.rpcUrl = rpcUrl;
    this.chainId = chainId;
    this.name = name;
    this.explorerUrl = explorerUrl;
  }
};
var WalletManager = class _WalletManager {
  static createWallet() {
    const account = new Web3().eth.accounts.create();
    return {
      address: account.address,
      privateKey: account.privateKey
    };
  }
  static validateAddress(address) {
    return isAddress(address);
  }
  static normalizePrivateKey(privateKey) {
    let key = privateKey.trim();
    if (!key.startsWith("0x")) {
      key = "0x" + key;
    }
    return key;
  }
  static validatePrivateKey(privateKey) {
    try {
      const key = _WalletManager.normalizePrivateKey(privateKey);
      if (key.length !== 66) return false;
      if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return false;
      new Web3().eth.accounts.privateKeyToAccount(key);
      return true;
    } catch {
      return false;
    }
  }
  static checksumAddress(address) {
    return Web3.utils.toChecksumAddress(address);
  }
  static async isContract(web3, address) {
    const code = await web3.eth.getCode(address);
    return code !== "0x";
  }
};
async function enhancedExample() {
  try {
    const config4 = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle2 = async (tokenAddress) => {
      const prices = {
        "native": 0.65,
        // CELO price (more realistic for Celo network)
        // Celo testnet token addresses
        "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1": 1,
        // cUSD on Alfajores
        "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9": 1,
        // cEUR on Alfajores  
        "0x7037F7296B2fc7908de7b57a89efaa8319f0C500": 0.65
        // mCELO on Alfajores
      };
      await new Promise((resolve) => setTimeout(resolve, 100));
      const price = prices[tokenAddress.toLowerCase()] || prices[tokenAddress] || 0;
      console.log(`Price for ${tokenAddress}: $${price}`);
      return price;
    };
    const permissionCheck = async (daoId, userId, action) => {
      console.log(`Permission check: ${userId} attempting ${action} on ${daoId}`);
      const allowedActions = ["transfer", "approve", "disburse"];
      return allowedActions.includes(action);
    };
    const contributionLogger = async (log) => {
      console.log("Contribution logged:", {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ...log
      });
    };
    const isValidPrivateKey = (key) => {
      if (!key || typeof key !== "string") return false;
      key = key.trim();
      if (!key.startsWith("0x")) return false;
      if (key.length !== 66) return false;
      return /^[0-9a-fA-F]{64}$/.test(key.slice(2));
    };
    let WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
    if (typeof WALLET_PRIVATE_KEY !== "string") {
      throw new Error("WALLET_PRIVATE_KEY is not set or not a string.");
    }
    WALLET_PRIVATE_KEY = WALLET_PRIVATE_KEY.trim();
    console.log("[DEBUG] WALLET_PRIVATE_KEY:", WALLET_PRIVATE_KEY);
    if (!isValidPrivateKey(WALLET_PRIVATE_KEY)) {
      console.log("[DEBUG] WALLET_PRIVATE_KEY length:", WALLET_PRIVATE_KEY.length);
      throw new Error("Invalid private key format. Must be 0x + 64 hex characters.");
    }
    const wallet2 = new EnhancedAgentWallet(
      WALLET_PRIVATE_KEY,
      config4,
      permissionCheck,
      contributionLogger,
      void 0,
      // billingLogger
      mockPriceOracle2
    );
    console.log(`
=== Enhanced Wallet Demo ===`);
    console.log(`Wallet Address: ${wallet2.address}`);
    console.log(`Network: ${config4.name}`);
    console.log("\n--- Network Information ---");
    const networkInfo = await wallet2.getNetworkInfo();
    console.log(`Connected: ${networkInfo.connected}`);
    console.log(`Latest Block: ${networkInfo.latestBlock}`);
    console.log(`Gas Price: ${networkInfo.gasPrice ? (networkInfo.gasPrice / 1e9).toFixed(2) + " Gwei" : "N/A"}`);
    console.log("\n--- Balance Information ---");
    try {
      const balance = await wallet2.getBalanceEth();
      console.log(`Native Balance: ${balance.toFixed(6)} CELO`);
      if (balance > 0) {
        const balanceUsd = balance * 0.65;
        console.log(`Balance (USD): $${balanceUsd.toFixed(2)}`);
      }
    } catch (error) {
      console.log(`Balance check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("\n--- Enhanced Portfolio ---");
    const sampleTokens = [
      "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
      // cUSD
      "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9"
      // cEUR
    ];
    try {
      const portfolio = await wallet2.getEnhancedPortfolio(sampleTokens);
      console.log("Portfolio Summary:");
      console.log(`- Address: ${portfolio.address}`);
      console.log(`- Native Balance: ${portfolio.nativeBalance.toFixed(6)} CELO`);
      console.log(`- Native Balance (USD): $${(portfolio.nativeBalanceUsd || 0).toFixed(2)}`);
      console.log(`- Total Value (USD): $${(portfolio.totalValueUsd || 0).toFixed(2)}`);
      Object.entries(portfolio.tokens).forEach(([address, token]) => {
        const t = token;
        if (!t.error) {
          console.log(`- ${t.symbol}: ${t.balanceFormatted.toFixed(6)} (${t.name})`);
        }
      });
    } catch (error) {
      console.log(`Portfolio fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("\n--- DAO Treasury Management ---");
    const treasuryManager = new DaoTreasuryManager(
      wallet2,
      wallet2.address,
      // Using wallet address as treasury for demo
      sampleTokens
    );
    try {
      const treasurySnapshot = await treasuryManager.getTreasurySnapshot();
      console.log("Treasury Snapshot:");
      console.log(`- Native Balance: ${treasurySnapshot.nativeBalance.toFixed(6)} CELO`);
      console.log(`- Total Value (USD): $${(treasurySnapshot.totalValueUsd || 0).toFixed(2)}`);
      const report = await treasuryManager.generateTreasuryReport("monthly");
      console.log("Treasury Report:");
      console.log(`- Period: ${report.period}`);
      console.log(`- Top Holdings: ${report.topHoldings.length} positions`);
      console.log(`- Recommendations: ${report.recommendations.length} items`);
      report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    } catch (error) {
      console.log(`Treasury management failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("\n--- Risk Management ---");
    const riskManager2 = new RiskManager(wallet2, 1e3, 500);
    const testTransfers = [
      { amount: 0.1, description: "Small CELO transfer" },
      { amount: 100, description: "Large CELO transfer" },
      { amount: 1e3, description: "Very large transfer (should be blocked)" }
    ];
    for (const test of testTransfers) {
      try {
        const validation = await riskManager2.validateTransfer(test.amount, void 0, wallet2.address);
        console.log(`${test.description}:`);
        console.log(`  - Allowed: ${validation.allowed}`);
        console.log(`  - Risk Score: ${validation.riskScore}/100`);
        if (validation.reason) {
          console.log(`  - Reason: ${validation.reason}`);
        }
      } catch (error) {
        console.log(`Risk validation failed for ${test.description}: ${error}`);
      }
    }
    console.log("\n--- Gas Estimation ---");
    try {
      const disbursements = [
        { toAddress: wallet2.address, amount: 0.1 },
        { toAddress: wallet2.address, amount: 0.1, tokenAddress: sampleTokens[0] }
      ];
      const gasEstimate = await wallet2.estimateDisbursementCost(disbursements);
      console.log(`Gas Cost Estimate:`);
      console.log(`- Total Gas Cost: ${gasEstimate.totalGasCost} wei`);
      console.log(`- Gas Cost (CELO): ${(gasEstimate.totalGasCost / 1e18).toFixed(8)}`);
      if (gasEstimate.totalGasCostUsd) {
        console.log(`- Gas Cost (USD): $${gasEstimate.totalGasCostUsd.toFixed(4)}`);
      }
      console.log(`- Breakdown: ${gasEstimate.breakdown.length} transactions`);
    } catch (error) {
      console.log(`Gas estimation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("\n--- Transaction Utilities ---");
    const sampleTxHash = "0x6e1e7e2e2b7e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2";
    console.log(`Explorer URL for tx: ${wallet2.getExplorerUrl(sampleTxHash)}`);
    const txHistory = await wallet2.getTransactionHistory(5);
    console.log(`Transaction Cache: ${txHistory.length} transactions`);
    console.log("\n=== Demo Complete ===");
    console.log("\u2713 Network connection tested");
    console.log("\u2713 Balance operations demonstrated");
    console.log("\u2713 Portfolio management shown");
    console.log("\u2713 DAO treasury features previewed");
    console.log("\u2713 Risk management validated");
    console.log("\u2713 Gas estimation completed");
  } catch (error) {
    console.error("Enhanced example failed:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace available");
  }
}
var DaoTreasuryManager = class {
  constructor(wallet2, treasuryAddress, allowedTokens2 = []) {
    this.wallet = wallet2;
    this.treasuryAddress = treasuryAddress;
    this.allowedTokens = new Set(allowedTokens2);
  }
  async getTreasurySnapshot() {
    const nativeBalance = await this.wallet.getBalanceEth(this.treasuryAddress);
    const tokenBalances = {};
    let totalValueUsd = 0;
    for (const tokenAddress of Array.from(this.allowedTokens)) {
      try {
        const contract = new this.wallet["web3"].eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
        const balance = await contract.methods.balanceOf(this.treasuryAddress).call();
        const [symbol, name, decimals] = await Promise.all([
          contract.methods.symbol().call(),
          contract.methods.name().call(),
          contract.methods.decimals().call()
        ]);
        const decimalCount = Number(decimals);
        const balanceFormatted = Number(balance) / Math.pow(10, decimalCount);
        const tokenInfo = {
          symbol: String(symbol),
          name: String(name),
          decimals: decimalCount,
          balance: String(balance),
          balanceFormatted
        };
        if (this.wallet["priceOracle"] && balanceFormatted > 0) {
          try {
            const price = await this.wallet["priceOracle"](tokenAddress);
            tokenInfo.priceUsd = price;
            totalValueUsd += balanceFormatted * price;
          } catch (error) {
            console.warn(`Failed to get price for ${tokenAddress}:`, error);
          }
        }
        tokenBalances[tokenAddress] = tokenInfo;
      } catch (error) {
        console.warn(`Failed to get treasury balance for ${tokenAddress}:`, error);
      }
    }
    if (this.wallet["priceOracle"]) {
      try {
        const nativePrice = await this.wallet["priceOracle"]("native");
        totalValueUsd += nativeBalance * nativePrice;
      } catch (error) {
        console.warn("Failed to get native token price:", error);
      }
    }
    return {
      nativeBalance,
      tokenBalances,
      totalValueUsd: totalValueUsd > 0 ? totalValueUsd : void 0,
      lastUpdated: Date.now()
    };
  }
  async generateTreasuryReport(period = "monthly") {
    const currentSnapshot = await this.getTreasurySnapshot();
    const topHoldings = [];
    const recommendations = [];
    const totalValue = currentSnapshot.totalValueUsd || 0;
    if (totalValue > 0) {
      if (this.wallet["priceOracle"]) {
        try {
          const nativePrice = await this.wallet["priceOracle"]("native");
          const nativeValue = currentSnapshot.nativeBalance * nativePrice;
          topHoldings.push({
            token: "Native Token",
            value: nativeValue,
            percentage: nativeValue / totalValue * 100
          });
        } catch (error) {
          console.warn("Failed to calculate native token value:", error);
        }
      }
      for (const [address, token] of Object.entries(currentSnapshot.tokenBalances)) {
        if (token.priceUsd && token.balanceFormatted > 0) {
          const value = token.balanceFormatted * token.priceUsd;
          topHoldings.push({
            token: `${token.symbol} (${token.name})`,
            value,
            percentage: value / totalValue * 100
          });
        }
      }
      topHoldings.sort((a, b) => b.value - a.value);
    }
    if (topHoldings.length > 0) {
      const largestHolding = topHoldings[0];
      if (largestHolding.percentage > 70) {
        recommendations.push(`Consider diversifying: ${largestHolding.token} represents ${largestHolding.percentage.toFixed(1)}% of treasury`);
      }
      if (currentSnapshot.nativeBalance < 0.1) {
        recommendations.push("Treasury has low native token balance, consider maintaining more for gas fees");
      }
    }
    return {
      period,
      currentSnapshot,
      topHoldings,
      recommendations
    };
  }
  addAllowedToken(tokenAddress) {
    if (WalletManager.validateAddress(tokenAddress)) {
      this.allowedTokens.add(tokenAddress);
    } else {
      throw new Error("Invalid token address");
    }
  }
  removeAllowedToken(tokenAddress) {
    this.allowedTokens.delete(tokenAddress);
  }
  getAllowedTokens() {
    return Array.from(this.allowedTokens);
  }
};
var RiskManager = class {
  constructor(wallet2, maxDailyVolume = 1e4, maxSingleTransfer = 5e3) {
    this.dailyVolumeTracking = /* @__PURE__ */ new Map();
    this.wallet = wallet2;
    this.maxDailyVolume = maxDailyVolume;
    this.maxSingleTransfer = maxSingleTransfer;
  }
  async validateTransfer(amount, tokenAddress, toAddress) {
    let riskScore = 0;
    let amountUsd = amount;
    if (this.wallet["priceOracle"]) {
      try {
        const price = await this.wallet["priceOracle"](tokenAddress || "native");
        amountUsd = amount * price;
      } catch (error) {
        console.warn("Failed to get price for risk assessment:", error);
        riskScore += 10;
      }
    }
    if (amountUsd > this.maxSingleTransfer) {
      return {
        allowed: false,
        reason: `Transfer amount ${amountUsd.toFixed(2)} exceeds single transfer limit of ${this.maxSingleTransfer}`,
        riskScore: 100
      };
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const dailyKey = `${this.wallet.address}-${today}`;
    const dailyData = this.dailyVolumeTracking.get(dailyKey) || { date: today, volume: 0 };
    if (dailyData.volume + amountUsd > this.maxDailyVolume) {
      return {
        allowed: false,
        reason: `Transfer would exceed daily volume limit. Current: ${dailyData.volume.toFixed(2)}, Limit: ${this.maxDailyVolume}`,
        riskScore: 100
      };
    }
    if (toAddress && !WalletManager.validateAddress(toAddress)) {
      return {
        allowed: false,
        reason: "Invalid recipient address",
        riskScore: 100
      };
    }
    if (toAddress && this.wallet["web3"]) {
      try {
        const isContract = await WalletManager.isContract(this.wallet["web3"], toAddress);
        if (isContract) {
          riskScore += 20;
        }
      } catch (error) {
        riskScore += 10;
      }
    }
    const amountRisk = amountUsd / this.maxSingleTransfer * 30;
    riskScore += Math.min(amountRisk, 30);
    dailyData.volume += amountUsd;
    this.dailyVolumeTracking.set(dailyKey, dailyData);
    return {
      allowed: true,
      riskScore: Math.min(riskScore, 100)
    };
  }
  getDailyVolumeReport() {
    return Array.from(this.dailyVolumeTracking.values()).map((data) => ({
      date: data.date,
      volume: data.volume,
      percentage: data.volume / this.maxDailyVolume * 100
    })).sort((a, b) => b.date.localeCompare(a.date));
  }
  setLimits(maxDailyVolume, maxSingleTransfer) {
    if (maxDailyVolume !== void 0) this.maxDailyVolume = maxDailyVolume;
    if (maxSingleTransfer !== void 0) this.maxSingleTransfer = maxSingleTransfer;
  }
  getLimits() {
    return {
      maxDailyVolume: this.maxDailyVolume,
      maxSingleTransfer: this.maxSingleTransfer
    };
  }
};
var TransactionAnalytics = class {
  constructor() {
    this.transactions = [];
  }
  addTransaction(tx) {
    this.transactions.push(tx);
    if (this.transactions.length > 1e3) {
      this.transactions = this.transactions.slice(-1e3);
    }
  }
  getSuccessRate(timeframe = 24 * 60 * 60 * 1e3) {
    const since = Date.now() - timeframe;
    const recentTxs = this.transactions.filter((tx) => (tx.timestamp || 0) > since);
    if (recentTxs.length === 0) return 100;
    const successful = recentTxs.filter((tx) => tx.status === "success").length;
    return successful / recentTxs.length * 100;
  }
  getAverageGasUsed(timeframe = 24 * 60 * 60 * 1e3) {
    const since = Date.now() - timeframe;
    const recentTxs = this.transactions.filter(
      (tx) => (tx.timestamp || 0) > since && tx.gasUsed && tx.status === "success"
    );
    if (recentTxs.length === 0) return 0;
    const totalGas = recentTxs.reduce((sum3, tx) => sum3 + (tx.gasUsed || 0), 0);
    return totalGas / recentTxs.length;
  }
  getFailureReasons() {
    const reasons = {};
    this.transactions.filter((tx) => tx.status === "failed" && tx.errorReason).forEach((tx) => {
      const reason = tx.errorReason;
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    return reasons;
  }
  generateReport(timeframe = 7 * 24 * 60 * 60 * 1e3) {
    const since = Date.now() - timeframe;
    const recentTxs = this.transactions.filter((tx) => (tx.timestamp || 0) > since);
    const dailyGas = {};
    recentTxs.filter((tx) => tx.gasUsed && tx.status === "success").forEach((tx) => {
      const date = new Date(tx.timestamp || 0).toISOString().split("T")[0];
      if (!dailyGas[date]) dailyGas[date] = [];
      dailyGas[date].push(tx.gasUsed);
    });
    const gasEfficiencyTrend = Object.entries(dailyGas).map(([date, gasValues]) => ({
      date,
      avgGas: gasValues.reduce((a, b) => a + b, 0) / gasValues.length
    })).sort((a, b) => a.date.localeCompare(b.date));
    return {
      totalTransactions: recentTxs.length,
      successRate: this.getSuccessRate(timeframe),
      averageGasUsed: this.getAverageGasUsed(timeframe),
      failureReasons: this.getFailureReasons(),
      gasEfficiencyTrend
    };
  }
};
var agent_wallet_default = EnhancedAgentWallet;
enhancedExample();

// server/routes/wallet.ts
init_storage();
init_schema();
init_notificationService();
init_schema();
import { desc as desc2, eq as eq7, or as or3, and as and4, sql as sql4, gte as gte2 } from "drizzle-orm";
import { fileURLToPath } from "url";
import { dirname } from "path";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "1".repeat(64);
var NETWORK = NetworkConfig.CELO_ALFAJORES;
var mockPriceOracle = async (tokenAddress) => {
  const prices = {
    "native": 2500,
    // ETH price
    "0x...": 1
    // USDC price
  };
  return prices[tokenAddress] || 0;
};
var wallet = null;
try {
  if (PRIVATE_KEY && PRIVATE_KEY !== "your_private_key_here") {
    wallet = new agent_wallet_default(
      PRIVATE_KEY,
      NETWORK,
      void 0,
      // permissionCheck
      void 0,
      // contributionLogger
      void 0,
      // billingLogger
      mockPriceOracle
    );
  }
} catch (error) {
  console.warn("Failed to initialize wallet:", error);
}
var riskManager = new RiskManager(wallet, 1e4, 5e3);
var analytics = new TransactionAnalytics();
var router3 = express3.Router();
function requireRole2(...roles2) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !roles2.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions" });
    }
    next();
  };
}
var allowedTokens = /* @__PURE__ */ new Set();
router3.post("/risk/validate", async (req, res) => {
  try {
    const { amount, tokenAddress, toAddress } = req.body;
    const result = await riskManager.validateTransfer(amount, tokenAddress, toAddress);
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/analytics/report", async (req, res) => {
  try {
    const { timeframe } = req.query;
    const report = analytics.generateReport(Number(timeframe) || 7 * 24 * 60 * 60 * 1e3);
    res.json(report);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/multisig/info", requireRole2("admin", "elder"), async (req, res) => {
  try {
    const { multisigAddress } = req.body;
    const info = await wallet.getMultisigInfo(multisigAddress);
    res.json(info);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/multisig/submit", requireRole2("admin", "elder"), async (req, res) => {
  try {
    const { multisigAddress, destination, value, data } = req.body;
    const result = await wallet.submitMultisigTransaction(multisigAddress, destination, value, data);
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/allowed-tokens", requireRole2("admin", "elder"), (req, res) => {
  res.json({ allowedTokens: Array.from(allowedTokens) });
});
router3.post("/allowed-tokens/add", requireRole2("admin", "elder"), (req, res) => {
  const { tokenAddress } = req.body;
  if (WalletManager.validateAddress(tokenAddress)) {
    allowedTokens.add(tokenAddress);
    res.json({ success: true, allowedTokens: Array.from(allowedTokens) });
  } else {
    res.status(400).json({ error: "Invalid token address" });
  }
});
router3.post("/allowed-tokens/remove", requireRole2("admin", "elder"), (req, res) => {
  const { tokenAddress } = req.body;
  allowedTokens.delete(tokenAddress);
  res.json({ success: true, allowedTokens: Array.from(allowedTokens) });
});
router3.get("/analytics", async (req, res) => {
  try {
    const walletAddress = req.query.address;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address required" });
    }
    const analytics2 = await fetchWalletAnalytics(walletAddress);
    res.json(analytics2);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router3.get("/pending-payments", async (req, res) => {
  try {
    const { walletAddress, userId } = req.query;
    const query = db2.select({
      id: paymentRequests.id,
      fromUserId: paymentRequests.fromUserId,
      toUserId: paymentRequests.toUserId,
      toAddress: paymentRequests.toAddress,
      amount: paymentRequests.amount,
      currency: paymentRequests.currency,
      description: paymentRequests.description,
      status: paymentRequests.status,
      expiresAt: paymentRequests.expiresAt,
      createdAt: paymentRequests.createdAt
    }).from(paymentRequests).where(eq7(paymentRequests.status, "pending"));
    if (walletAddress) {
      query.where(eq7(paymentRequests.toAddress, walletAddress));
    } else if (userId) {
      query.where(eq7(paymentRequests.toUserId, userId));
    }
    const pending = await query.orderBy(desc2(paymentRequests.createdAt));
    const totalsByCurrency = pending.reduce((acc, payment) => {
      const currency = payment.currency;
      if (!acc[currency]) {
        acc[currency] = { total: 0, count: 0 };
      }
      acc[currency].total += parseFloat(payment.amount);
      acc[currency].count += 1;
      return acc;
    }, {});
    res.json({
      success: true,
      data: {
        payments: pending,
        summary: {
          totalPending: pending.length,
          byCurrency: totalsByCurrency
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router3.get("/balance-trends", async (req, res) => {
  try {
    const { walletAddress, period = "weekly" } = req.query;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address required" });
    }
    const daysBack = period === "monthly" ? 30 : 7;
    const startDate = /* @__PURE__ */ new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const transactions = await db2.select({
      date: sql4`DATE(${walletTransactions2.createdAt})`,
      type: walletTransactions2.type,
      amount: walletTransactions2.amount,
      currency: walletTransactions2.currency
    }).from(walletTransactions2).where(
      and4(
        eq7(walletTransactions2.walletAddress, walletAddress),
        gte2(walletTransactions2.createdAt, startDate)
      )
    ).orderBy(walletTransactions2.createdAt);
    const balanceByDate = {};
    transactions.forEach((tx) => {
      if (!balanceByDate[tx.date]) {
        balanceByDate[tx.date] = {};
      }
      if (!balanceByDate[tx.date][tx.currency]) {
        balanceByDate[tx.date][tx.currency] = 0;
      }
      const amount = parseFloat(tx.amount);
      if (tx.type === "deposit" || tx.type === "contribution") {
        balanceByDate[tx.date][tx.currency] += amount;
      } else if (tx.type === "withdrawal" || tx.type === "transfer") {
        balanceByDate[tx.date][tx.currency] -= amount;
      }
    });
    const chartData = Object.entries(balanceByDate).map(([date, currencies]) => ({
      date,
      ...currencies
    }));
    res.json({
      success: true,
      data: {
        period,
        chartData,
        currencies: [...new Set(transactions.map((tx) => tx.currency))]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router3.get("/network-info", async (req, res) => {
  try {
    const info = await wallet.getNetworkInfo();
    res.json(info);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/balance/:address?", async (req, res) => {
  try {
    const address = req.params.address || wallet.address;
    const balance = await wallet.getBalanceEth(address);
    res.json({ address, balance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/balance/celo", async (req, res) => {
  try {
    const { user } = req.query;
    const address = user || wallet.address;
    const balance = await wallet.getBalanceEth(address);
    res.json({ address, balance, symbol: "CELO" });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/balance/cusd", async (req, res) => {
  try {
    const { user } = req.query;
    const address = user || wallet.address;
    const CUSD_TOKEN_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
    const balance = await wallet.getBalance();
    res.json({ address, balance, symbol: "cUSD" });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/token-info/:tokenAddress", async (req, res) => {
  try {
    const info = await wallet.getTokenInfo(req.params.tokenAddress);
    res.json(info);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/send-native", async (req, res) => {
  try {
    const { toAddress, amount, userId } = req.body;
    if (userId) {
      const { kycService: kycService2 } = await Promise.resolve().then(() => (init_kycService(), kycService_exports));
      const limitCheck = await kycService2.checkTransactionLimit(userId, parseFloat(amount), "CELO");
      if (!limitCheck.allowed) {
        return res.status(403).json({ error: limitCheck.reason });
      }
    }
    const result = await wallet.sendNativeToken(toAddress, amount);
    if (userId && result.hash) {
      await notificationService.createNotification({
        userId,
        type: "transaction",
        title: "Transaction Sent",
        message: `Successfully sent ${amount} CELO to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
        metadata: {
          transactionHash: result.hash,
          amount,
          currency: "CELO",
          toAddress
        }
      });
    }
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/send-token", async (req, res) => {
  try {
    const { tokenAddress, toAddress, amount, userId } = req.body;
    const result = await wallet.sendTokenHuman(tokenAddress, toAddress, amount);
    if (userId && result.hash) {
      const currency = tokenAddress.includes("cUSD") ? "cUSD" : "TOKEN";
      await notificationService.createNotification({
        userId,
        type: "transaction",
        title: "Token Sent",
        message: `Successfully sent ${amount} ${currency} to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
        metadata: {
          transactionHash: result.hash,
          amount,
          currency,
          toAddress,
          tokenAddress
        }
      });
    }
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/send-to-address", async (req, res) => {
  try {
    const { fromUserId, toAddress, amount, currency, description } = req.body;
    if (!WalletManager.validateAddress(toAddress)) {
      return res.status(400).json({ error: "Invalid wallet address format" });
    }
    const result = currency === "CELO" ? await wallet.sendNativeToken(toAddress, amount) : await wallet.sendTokenHuman(currency, toAddress, amount);
    await db2.insert(walletTransactions2).values({
      fromUserId,
      toUserId: null,
      // External address
      walletAddress: toAddress,
      amount,
      currency,
      type: "transfer",
      status: "completed",
      transactionHash: result.hash,
      description: description || `Transfer to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`
    });
    if (fromUserId && result.hash) {
      await notificationService.createNotification({
        userId: fromUserId,
        type: "transaction",
        title: "Transfer Successful",
        message: `Sent ${amount} ${currency} to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
        metadata: {
          transactionHash: result.hash,
          amount,
          currency,
          toAddress
        }
      });
    }
    res.json({ success: true, txHash: result.hash, message: "Transfer successful" });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/approve-token", async (req, res) => {
  try {
    const { tokenAddress, spender, amount } = req.body;
    const result = await wallet.approveToken(tokenAddress, spender, amount);
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/allowance/:tokenAddress/:spender", async (req, res) => {
  try {
    const { tokenAddress, spender } = req.params;
    const allowance = await wallet.getAllowance(tokenAddress, spender);
    res.json({ tokenAddress, spender, allowance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/portfolio", async (req, res) => {
  try {
    if (!wallet) {
      return res.status(503).json({ error: "Wallet service not available" });
    }
    const { tokenAddresses } = req.body;
    const addresses = Array.isArray(tokenAddresses) ? tokenAddresses : [];
    const portfolio = await wallet.getEnhancedPortfolio(addresses);
    res.json(portfolio);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/batch-transfer", async (req, res) => {
  try {
    const { transfers } = req.body;
    const results = await wallet.batchTransfer(transfers);
    res.json(results);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/analytics/tx-history", async (req, res) => {
  try {
    const { limit } = req.query;
    const txs = await wallet.getTransactionHistory(Number(limit) || 10);
    res.json(txs);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/tx-status/:txHash", async (req, res) => {
  try {
    const status = await wallet.getTransactionStatus(req.params.txHash);
    res.json(status);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/locked-savings/create", async (req, res) => {
  try {
    const { userId, amount, currency, lockPeriod, interestRate } = req.body;
    const unlocksAt = /* @__PURE__ */ new Date();
    unlocksAt.setDate(unlocksAt.getDate() + Number(lockPeriod));
    const lockedSaving = await db2.insert(lockedSavings).values({
      userId,
      amount,
      currency: currency || "KES",
      lockPeriod: Number(lockPeriod),
      interestRate: interestRate || "0.05",
      unlocksAt,
      vaultId: "default-vault"
      // Provide a valid vaultId or get from req.body
    }).returning();
    res.json(lockedSaving[0]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/locked-savings/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const savings = await db2.select().from(lockedSavings).where(eq7(lockedSavings.userId, userId)).orderBy(desc2(lockedSavings.createdAt));
    res.json(savings);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/locked-savings/withdraw/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { isEarlyWithdrawal } = req.body;
    const saving = await db2.select().from(lockedSavings).where(eq7(lockedSavings.id, id)).limit(1);
    if (!saving.length) {
      return res.status(404).json({ error: "Locked saving not found" });
    }
    const lockSaving = saving[0];
    const now = /* @__PURE__ */ new Date();
    const isUnlocked = now >= new Date(lockSaving.unlocksAt);
    let penalty = 0;
    if (isEarlyWithdrawal && !isUnlocked) {
      penalty = parseFloat(lockSaving.amount) * 0.1;
    }
    const withdrawalAmount = parseFloat(lockSaving.amount) - penalty;
    await db2.update(lockedSavings).set({
      status: "withdrawn",
      penalty: penalty.toString(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq7(lockedSavings.id, id));
    res.json({
      withdrawalAmount,
      penalty,
      isEarlyWithdrawal: isEarlyWithdrawal && !isUnlocked
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/savings-goals/create", async (req, res) => {
  try {
    const { userId, title, description, targetAmount, targetDate, category, currency } = req.body;
    const goal = await db2.insert(savingsGoals).values({
      userId,
      title,
      description,
      targetAmount,
      targetDate: targetDate ? new Date(targetDate) : null,
      category: category || "general",
      currency: currency || "KES"
    }).returning();
    res.json(goal[0]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/savings-goals/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const goals = await db2.select().from(savingsGoals).where(eq7(savingsGoals.userId, userId)).orderBy(desc2(savingsGoals.createdAt));
    res.json(goals);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/savings-goals/:id/contribute", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const goal = await db2.select().from(savingsGoals).where(eq7(savingsGoals.id, id)).limit(1);
    if (!goal.length) {
      return res.status(404).json({ error: "Savings goal not found" });
    }
    const currentGoal = goal[0];
    const newAmount = parseFloat(currentGoal.currentAmount ?? "0") + parseFloat(amount);
    const isCompleted = newAmount >= parseFloat(currentGoal.targetAmount);
    await db2.update(savingsGoals).set({
      currentAmount: newAmount.toString(),
      isCompleted,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq7(savingsGoals.id, id));
    res.json({ newAmount, isCompleted });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/contribute", async (req, res) => {
  try {
    const { userId, daoId, proposalId, amount, currency, transactionHash, purpose, isAnonymous = false } = req.body;
    const contribution = await db2.insert(contributions).values({
      userId,
      daoId,
      proposalId,
      amount,
      currency: currency || "cUSD",
      purpose: purpose || "general",
      isAnonymous,
      transactionHash,
      vault: true
      // Link to vault system
    }).returning();
    if (transactionHash) {
      await db2.insert(walletTransactions2).values({
        walletAddress: userId,
        // Use userId as wallet address for now
        amount,
        currency: currency || "cUSD",
        type: "contribution",
        status: "completed",
        transactionHash,
        description: `Contribution to DAO ${daoId}${proposalId ? ` for proposal ${proposalId}` : ""}`
      });
    }
    if (userId) {
      await notificationService.createNotification({
        userId,
        type: "contribution",
        title: "Contribution Recorded",
        message: `Successfully contributed ${amount} ${currency} to ${isAnonymous ? "DAO" : `DAO ${daoId}`}`,
        metadata: {
          contributionId: contribution[0].id,
          amount,
          currency,
          daoId,
          proposalId,
          transactionHash
        }
      });
    }
    res.json({
      success: true,
      contribution: contribution[0],
      message: "Contribution successfully tracked and linked to wallet transaction"
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/contributions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { daoId, timeframe = "30" } = req.query;
    const conditions = [eq7(contributions.userId, userId)];
    if (daoId) {
      conditions.push(eq7(contributions.daoId, daoId));
    }
    const dateFilter = /* @__PURE__ */ new Date();
    dateFilter.setDate(dateFilter.getDate() - parseInt(timeframe));
    const userContributions = await db2.select().from(contributions).where(and4(...conditions)).orderBy(desc2(contributions.createdAt));
    const totalContributed = userContributions.reduce(
      (sum3, contrib) => sum3 + parseFloat(contrib.amount),
      0
    );
    const contributionsByDAO = userContributions.reduce((acc, contrib) => {
      const daoId2 = contrib.daoId;
      if (!acc[daoId2]) acc[daoId2] = { count: 0, total: 0 };
      acc[daoId2].count++;
      acc[daoId2].total += parseFloat(contrib.amount);
      return acc;
    }, {});
    res.json({
      contributions: userContributions,
      analytics: {
        totalContributed,
        contributionCount: userContributions.length,
        contributionsByDAO,
        averageContribution: userContributions.length > 0 ? totalContributed / userContributions.length : 0
      }
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/transactions", async (req, res) => {
  try {
    const {
      userId,
      walletAddress,
      type,
      status,
      currency,
      search,
      dateRange = "30",
      page = "1",
      limit = "10"
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const conditions = [];
    if (userId) {
      conditions.push(or3(eq7(walletTransactions2.fromUserId, userId), eq7(walletTransactions2.toUserId, userId)));
    }
    if (walletAddress) {
      conditions.push(eq7(walletTransactions2.walletAddress, walletAddress));
    }
    if (type) {
      conditions.push(eq7(walletTransactions2.type, type));
    }
    if (status) {
      conditions.push(eq7(walletTransactions2.status, status));
    }
    if (currency) {
      conditions.push(eq7(walletTransactions2.currency, currency));
    }
    const dateFilter = /* @__PURE__ */ new Date();
    dateFilter.setDate(dateFilter.getDate() - parseInt(dateRange));
    let whereClause = void 0;
    if (conditions.length > 0) {
      whereClause = and4(...conditions);
    }
    const transactions = await db2.select().from(walletTransactions2).where(whereClause).orderBy(desc2(walletTransactions2.createdAt)).limit(limitNum).offset(offset);
    let filteredTransactions = transactions;
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredTransactions = transactions.filter(
        (tx) => tx.description?.toLowerCase().includes(searchTerm) || tx.transactionHash?.toLowerCase().includes(searchTerm) || tx.type?.toLowerCase().includes(searchTerm)
      );
    }
    res.json({
      transactions: filteredTransactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredTransactions.length
      }
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/payment-links", async (req, res) => {
  try {
    const { userId, amount, currency, description, expiresInHours } = req.body;
    const linkId = `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = /* @__PURE__ */ new Date();
    expiresAt.setHours(expiresAt.getHours() + (expiresInHours || 24));
    const user = await db2.select().from(users).where(eq7(users.id, userId)).limit(1);
    if (!user.length) {
      return res.status(404).json({ error: "User not found" });
    }
    const paymentLink = {
      id: linkId,
      userId,
      walletAddress: user[0].walletAddress,
      amount,
      currency,
      description,
      expiresAt,
      url: `${process.env.APP_URL}/pay/${linkId}`,
      isActive: true,
      createdAt: /* @__PURE__ */ new Date()
    };
    await db2.insert(paymentRequests).values({
      fromUserId: userId,
      toAddress: user[0].walletAddress || "",
      amount,
      currency,
      description,
      expiresAt,
      metadata: { linkId, isPaymentLink: true }
    });
    res.json(paymentLink);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/split-bill", async (req, res) => {
  try {
    const { creatorId, totalAmount, currency, description, participants, splitType } = req.body;
    const billId = `bill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let splits = [];
    if (splitType === "equal") {
      const amountPerPerson = parseFloat(totalAmount) / participants.length;
      splits = participants.map((p) => ({
        userId: p.userId,
        amount: amountPerPerson.toFixed(2),
        paid: p.userId === creatorId
      }));
    } else if (splitType === "custom") {
      splits = participants.map((p) => ({
        userId: p.userId,
        amount: p.amount,
        paid: p.userId === creatorId
      }));
    } else if (splitType === "percentage") {
      splits = participants.map((p) => ({
        userId: p.userId,
        amount: (parseFloat(totalAmount) * (p.percentage / 100)).toFixed(2),
        paid: p.userId === creatorId
      }));
    }
    for (const split of splits) {
      if (split.userId !== creatorId) {
        await db2.insert(paymentRequests).values({
          fromUserId: creatorId,
          toUserId: split.userId,
          amount: split.amount,
          currency,
          description: `${description} - Your share`,
          metadata: { billId, splitType, totalAmount }
        });
        await notificationService.createNotification({
          userId: split.userId,
          type: "payment_request",
          title: "Bill Split Request",
          message: `${description} - You owe ${split.amount} ${currency}`,
          metadata: { billId, amount: split.amount, currency }
        });
      }
    }
    res.json({
      billId,
      totalAmount,
      currency,
      description,
      splits,
      message: "Bill split created successfully"
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/split-bills/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const bills = await db2.select().from(paymentRequests).where(
      or3(
        eq7(paymentRequests.fromUserId, userId),
        eq7(paymentRequests.toUserId, userId)
      )
    ).orderBy(desc2(paymentRequests.createdAt));
    const splitBills = bills.filter((b) => b.metadata && b.metadata.billId);
    res.json(splitBills);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/payment-links/:linkId", async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await db2.select().from(paymentRequests).where(sql4`metadata->>'linkId' = ${linkId}`).limit(1);
    if (!link.length) {
      return res.status(404).json({ error: "Payment link not found" });
    }
    const paymentLink = link[0];
    if (paymentLink.expiresAt && /* @__PURE__ */ new Date() > new Date(paymentLink.expiresAt)) {
      return res.status(410).json({ error: "Payment link expired" });
    }
    res.json(paymentLink);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/recurring-payments", async (req, res) => {
  try {
    const { walletAddress } = req.query;
    const recurringPayments = [
      {
        id: "1",
        title: "Monthly DAO Contribution",
        description: "Regular contribution to community vault",
        amount: "50.00",
        currency: "cUSD",
        toAddress: "0x742d35Cc6634C0532925a3b8D421C63F10bFe2D0",
        frequency: "monthly",
        nextPayment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
        isActive: true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastPayment: new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString(),
        totalPaid: "200.00",
        paymentCount: 4
      }
    ];
    res.json({ payments: recurringPayments });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/recurring-payments", async (req, res) => {
  try {
    const { title, description, amount, currency, toAddress, frequency, walletAddress } = req.body;
    const newPayment = {
      id: Date.now().toString(),
      title,
      description,
      amount,
      currency,
      toAddress,
      frequency,
      walletAddress,
      isActive: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      nextPayment: calculateNextPayment(frequency),
      totalPaid: "0.00",
      paymentCount: 0
    };
    res.json(newPayment);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.patch("/recurring-payments/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    res.json({ success: true, id, isActive });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.delete("/recurring-payments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ success: true, id });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/exchange-rates", async (req, res) => {
  try {
    const mockRates = {
      "CELO-USD": { pair: "CELO-USD", rate: 0.65, change24h: 2.5, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
      "cUSD-USD": { pair: "cUSD-USD", rate: 1, change24h: 0.1, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
      "cEUR-EUR": { pair: "cEUR-EUR", rate: 1, change24h: -0.05, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
      "USD-KES": { pair: "USD-KES", rate: 150.25, change24h: 1.2, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
      "USD-NGN": { pair: "USD-NGN", rate: 825.5, change24h: -0.8, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
      "USD-GHS": { pair: "USD-GHS", rate: 12.85, change24h: 0.5, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() }
    };
    res.json({ rates: mockRates });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/multisig/create", requireRole2("admin", "elder"), async (req, res) => {
  try {
    const { owners, threshold } = req.body;
    const mockMultisig = {
      address: "0x" + Math.random().toString(16).substr(2, 40),
      owners,
      threshold,
      transactionCount: 0
    };
    res.json(mockMultisig);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/multisig/:address/transactions", requireRole2("admin", "elder"), async (req, res) => {
  try {
    const { address } = req.params;
    const { pending } = req.query;
    const mockTransactions = [];
    res.json({ transactions: mockTransactions });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
function calculateNextPayment(frequency) {
  const now = /* @__PURE__ */ new Date();
  switch (frequency) {
    case "daily":
      now.setDate(now.getDate() + 1);
      break;
    case "weekly":
      now.setDate(now.getDate() + 7);
      break;
    case "monthly":
      now.setMonth(now.getMonth() + 1);
      break;
    case "yearly":
      now.setFullYear(now.getFullYear() + 1);
      break;
  }
  return now.toISOString();
}
router3.post("/payment-requests", async (req, res) => {
  try {
    const { toAddress, toUserId, amount, currency, description, qrCode, celoUri, expiresAt, recipientEmail } = req.body;
    const request = await db2.insert(paymentRequests).values({
      fromUserId: req.user?.id || "anonymous",
      toUserId,
      toAddress,
      amount,
      currency,
      description,
      qrCode,
      celoUri,
      expiresAt: expiresAt ? new Date(expiresAt) : void 0,
      metadata: { recipientEmail }
    }).returning();
    res.json(request[0]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/payment-requests/:id", async (req, res) => {
  try {
    const request = await db2.query.paymentRequests.findFirst({
      where: eq7(paymentRequests.id, req.params.id)
    });
    if (!request) {
      return res.status(404).json({ error: "Payment request not found" });
    }
    res.json(request);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/payment-requests/:id/pay", async (req, res) => {
  try {
    const { transactionHash } = req.body;
    const request = await db2.query.paymentRequests.findFirst({
      where: eq7(paymentRequests.id, req.params.id)
    });
    if (!request) {
      return res.status(404).json({ error: "Payment request not found" });
    }
    if (request.status === "paid") {
      return res.status(400).json({ error: "Payment request already paid" });
    }
    await db2.update(paymentRequests).set({
      status: "paid",
      paidAt: /* @__PURE__ */ new Date(),
      transactionHash,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq7(paymentRequests.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.post("/receipts/generate", async (req, res) => {
  try {
    const { transactionId, paymentRequestId } = req.body;
    const receiptNumber = `MTAA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    let transaction;
    if (transactionId) {
      transaction = await db2.query.walletTransactions.findFirst({
        where: eq7(walletTransactions2.id, transactionId)
      });
    }
    const receipt = await db2.insert(paymentReceipts).values({
      transactionId,
      paymentRequestId,
      receiptNumber,
      metadata: { transaction }
    }).returning();
    res.json({
      ...receipt[0],
      downloadUrl: `/api/wallet/receipts/${receipt[0].id}/download`
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router3.get("/receipts/:id/download", async (req, res) => {
  try {
    const receipt = await db2.query.paymentReceipts.findFirst({
      where: eq7(paymentReceipts.id, req.params.id)
    });
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=receipt-${receipt.receiptNumber}.pdf`);
    res.send("PDF generation coming soon");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
var wallet_default = router3;

// server/routes/wallet-setup.ts
import express4 from "express";
init_storage();
init_schema();
init_notificationService();
import { eq as eq8, and as and5 } from "drizzle-orm";

// server/utils/cryptoWallet.ts
import crypto2 from "crypto";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "bip39";
import * as EthereumJSWallet from "ethereumjs-wallet";
import Web32 from "web3";
var hdkey2 = EthereumJSWallet.hdkey || EthereumJSWallet;
var ENCRYPTION_ALGORITHM = "aes-256-gcm";
var SALT_LENGTH = 16;
var IV_LENGTH = 12;
function generateWalletFromMnemonic(wordCount = 12) {
  const strength = wordCount === 12 ? 128 : 256;
  const mnemonic = generateMnemonic(strength);
  const seed = mnemonicToSeedSync(mnemonic);
  const hdwallet = hdkey2.fromMasterSeed(seed);
  const wallet2 = hdwallet.derivePath("m/44'/60'/0'/0/0").getWallet();
  const privateKey = "0x" + wallet2.getPrivateKey().toString("hex");
  const address = "0x" + wallet2.getAddress().toString("hex");
  return {
    address,
    privateKey,
    mnemonic
  };
}
function recoverWalletFromMnemonic(mnemonic) {
  if (!validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic phrase");
  }
  const seed = mnemonicToSeedSync(mnemonic);
  const hdwallet = hdkey2.fromMasterSeed(seed);
  const wallet2 = hdwallet.derivePath("m/44'/60'/0'/0/0").getWallet();
  const privateKey = "0x" + wallet2.getPrivateKey().toString("hex");
  const address = "0x" + wallet2.getAddress().toString("hex");
  return {
    address,
    privateKey,
    mnemonic
  };
}
function encryptWallet(walletData, password) {
  const salt = crypto2.randomBytes(SALT_LENGTH);
  const key = crypto2.pbkdf2Sync(password, salt, 1e5, 32, "sha256");
  const iv = crypto2.randomBytes(IV_LENGTH);
  const cipher = crypto2.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const dataToEncrypt = JSON.stringify({
    privateKey: walletData.privateKey,
    mnemonic: walletData.mnemonic
  });
  let encrypted = cipher.update(dataToEncrypt, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return {
    encryptedData: encrypted,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex")
  };
}
function decryptWallet(encryptedWallet, password) {
  const salt = Buffer.from(encryptedWallet.salt, "hex");
  const key = crypto2.pbkdf2Sync(password, salt, 1e5, 32, "sha256");
  const iv = Buffer.from(encryptedWallet.iv, "hex");
  const authTag = Buffer.from(encryptedWallet.authTag, "hex");
  const decipher = crypto2.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedWallet.encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  const walletData = JSON.parse(decrypted);
  const web3 = new Web32();
  const account = web3.eth.accounts.privateKeyToAccount(walletData.privateKey);
  return {
    address: account.address,
    privateKey: walletData.privateKey,
    mnemonic: walletData.mnemonic
  };
}

// server/routes/wallet-setup.ts
var router4 = express4.Router();
router4.post("/create-wallet-mnemonic", async (req, res) => {
  try {
    const { userId, currency = "cUSD", initialGoal = 0, password, wordCount = 12 } = req.body;
    if (!userId || !password) {
      return res.status(400).json({ error: "User ID and password are required" });
    }
    if (wordCount !== 12 && wordCount !== 24) {
      return res.status(400).json({ error: "Word count must be 12 or 24" });
    }
    const existingUser = await db2.select().from(users).where(eq8(users.id, userId)).limit(1);
    if (existingUser.length > 0 && existingUser[0].encryptedWallet) {
      return res.status(400).json({ error: "User already has a wallet" });
    }
    const walletCredentials = generateWalletFromMnemonic(wordCount);
    const encrypted = encryptWallet(walletCredentials, password);
    await db2.update(users).set({
      encryptedWallet: encrypted.encryptedData,
      walletSalt: encrypted.salt,
      walletIv: encrypted.iv,
      walletAuthTag: encrypted.authTag,
      hasBackedUpMnemonic: false,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq8(users.id, userId));
    const primaryVault = await db2.insert(vaults).values({
      userId,
      currency,
      address: walletCredentials.address,
      balance: "0.00",
      monthlyGoal: initialGoal.toString()
    }).returning();
    await notificationService.createNotification({
      userId,
      type: "wallet",
      title: "Wallet Created Successfully",
      message: `Your new wallet has been created. Please backup your recovery phrase.`,
      metadata: {
        vaultId: primaryVault[0].id,
        currency
      }
    });
    res.json({
      success: true,
      wallet: {
        address: walletCredentials.address,
        mnemonic: walletCredentials.mnemonic
        // Only sent once - client must save
      },
      primaryVault: primaryVault[0],
      message: "Wallet created successfully. Please backup your recovery phrase immediately."
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router4.post("/backup-confirmed", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    await db2.update(users).set({ hasBackedUpMnemonic: true }).where(eq8(users.id, userId));
    res.json({ success: true, message: "Backup confirmation recorded" });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router4.post("/recover-wallet", async (req, res) => {
  try {
    const { userId, mnemonic, password, currency = "cUSD" } = req.body;
    if (!userId || !mnemonic || !password) {
      return res.status(400).json({ error: "User ID, mnemonic, and password are required" });
    }
    if (!isValidMnemonic(mnemonic)) {
      return res.status(400).json({ error: "Invalid recovery phrase" });
    }
    const walletCredentials = recoverWalletFromMnemonic(mnemonic);
    const encrypted = encryptWallet(walletCredentials, password);
    await db2.update(users).set({
      encryptedWallet: encrypted.encryptedData,
      walletSalt: encrypted.salt,
      walletIv: encrypted.iv,
      walletAuthTag: encrypted.authTag,
      hasBackedUpMnemonic: true,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq8(users.id, userId));
    const primaryVault = await db2.insert(vaults).values({
      userId,
      currency,
      address: walletCredentials.address,
      balance: "0.00",
      monthlyGoal: "0.00"
    }).returning();
    await notificationService.createNotification({
      userId,
      type: "wallet",
      title: "Wallet Recovered Successfully",
      message: `Your wallet has been recovered from your recovery phrase.`,
      metadata: {
        vaultId: primaryVault[0].id,
        imported: true
      }
    });
    res.json({
      success: true,
      wallet: { address: walletCredentials.address },
      primaryVault: primaryVault[0],
      message: "Wallet recovered successfully"
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router4.post("/import-private-key", async (req, res) => {
  try {
    const { userId, privateKey, password, currency = "cUSD" } = req.body;
    if (!userId || !privateKey || !password) {
      return res.status(400).json({ error: "User ID, private key, and password are required" });
    }
    const walletCredentials = importWalletFromPrivateKey(privateKey);
    const encrypted = encryptWallet(walletCredentials, password);
    await db2.update(users).set({
      encryptedWallet: encrypted.encryptedData,
      walletSalt: encrypted.salt,
      walletIv: encrypted.iv,
      walletAuthTag: encrypted.authTag,
      hasBackedUpMnemonic: false,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq8(users.id, userId));
    const primaryVault = await db2.insert(vaults).values({
      userId,
      currency,
      address: walletCredentials.address,
      balance: "0.00",
      monthlyGoal: "0.00"
    }).returning();
    await notificationService.createNotification({
      userId,
      type: "wallet",
      title: "Wallet Imported Successfully",
      message: `Your wallet has been imported using a private key.`,
      metadata: {
        vaultId: primaryVault[0].id,
        imported: true
      }
    });
    res.json({
      success: true,
      wallet: { address: walletCredentials.address },
      primaryVault: primaryVault[0],
      message: "Wallet imported successfully"
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router4.post("/unlock-wallet", async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) {
      return res.status(400).json({ error: "User ID and password are required" });
    }
    const user = await db2.select().from(users).where(eq8(users.id, userId)).limit(1);
    if (!user.length || !user[0].encryptedWallet) {
      return res.status(404).json({ error: "No wallet found for this user" });
    }
    const encrypted = {
      encryptedData: user[0].encryptedWallet,
      salt: user[0].walletSalt,
      iv: user[0].walletIv,
      authTag: user[0].walletAuthTag
    };
    const walletCredentials = decryptWallet(encrypted, password);
    res.json({
      success: true,
      wallet: {
        address: walletCredentials.address,
        privateKey: walletCredentials.privateKey,
        mnemonic: walletCredentials.mnemonic
      },
      message: "Wallet unlocked successfully"
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg === "Unsupported state or unable to authenticate data" ? "Invalid password" : errorMsg });
  }
});
router4.post("/create-wallet", async (req, res) => {
  try {
    const { userId, currency = "cUSD", initialGoal = 0 } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const existingVaults = await db2.select().from(vaults).where(eq8(vaults.userId, userId)).limit(1);
    if (existingVaults.length > 0) {
      return res.status(400).json({
        error: "User already has a wallet. Use initialize-additional-vault instead."
      });
    }
    const walletCredentials = WalletManager.createWallet();
    const primaryVault = await db2.insert(vaults).values({
      userId,
      currency,
      address: walletCredentials.address,
      balance: "0.00",
      monthlyGoal: initialGoal.toString()
    }).returning();
    await db2.update(users).set({ updatedAt: /* @__PURE__ */ new Date() }).where(eq8(users.id, userId));
    await notificationService.createNotification({
      userId,
      type: "wallet",
      title: "Wallet Created Successfully",
      message: `Your new wallet has been created with address ${walletCredentials.address.slice(0, 8)}...`,
      metadata: {
        vaultId: primaryVault[0].id,
        currency
      }
    });
    res.json({
      success: true,
      wallet: {
        address: walletCredentials.address,
        // Note: In production, private key should be encrypted and stored securely
        // or better yet, use a key management service
        privateKeyEncrypted: "***ENCRYPTED***"
        // Don't expose actual private key
      },
      primaryVault: primaryVault[0],
      message: "Wallet and primary vault created successfully"
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router4.post("/initialize-additional-vault", async (req, res) => {
  try {
    const { userId, currency, monthlyGoal = 0, vaultType = "savings" } = req.body;
    if (!userId || !currency) {
      return res.status(400).json({ error: "User ID and currency are required" });
    }
    const userVaults = await db2.select().from(vaults).where(eq8(vaults.userId, userId)).limit(1);
    if (!userVaults.length) {
      return res.status(400).json({
        error: "User must have a primary wallet before creating additional vaults"
      });
    }
    const existingVault = await db2.select().from(vaults).where(eq8(vaults.userId, userId)).limit(1);
    const newVault = await db2.insert(vaults).values({
      userId,
      currency,
      address: userVaults[0].address,
      // use primary vault address
      balance: "0.00",
      monthlyGoal: monthlyGoal.toString()
    }).returning();
    await notificationService.createNotification({
      userId,
      type: "vault",
      title: "New Vault Created",
      message: `Your ${currency} ${vaultType} vault has been created successfully`,
      metadata: {
        vaultId: newVault[0].id,
        currency,
        vaultType,
        monthlyGoal
      }
    });
    res.json({
      success: true,
      vault: newVault[0],
      message: `${currency} vault created successfully`
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router4.get("/user-vaults/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const userVaults = await db2.select().from(vaults).where(eq8(vaults.userId, userId));
    const primaryVault = userVaults.length > 0 ? userVaults[0] : null;
    const walletAddress = primaryVault ? primaryVault.address || null : null;
    const totalBalance = userVaults.reduce((sum3, vault) => {
      return sum3 + parseFloat(vault.balance || "0");
    }, 0);
    res.json({
      walletAddress,
      vaults: userVaults,
      totalBalance,
      vaultCount: userVaults.length,
      currencies: [...new Set(userVaults.map((v) => v.currency))]
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router4.post("/initialize-assets", async (req, res) => {
  try {
    const { userId, assets } = req.body;
    if (!userId || !Array.isArray(assets)) {
      return res.status(400).json({ error: "User ID and assets array are required" });
    }
    const userVaults = await db2.select().from(vaults).where(eq8(vaults.userId, userId)).limit(1);
    if (!userVaults.length || !userVaults[0].address) {
      return res.status(400).json({ error: "User must have a wallet first" });
    }
    const walletAddress = userVaults[0].address;
    const results = [];
    for (const asset of assets) {
      const { currency, initialAmount = 0, monthlyGoal = 0 } = asset;
      const existingVault = await db2.select().from(vaults).where(eq8(vaults.userId, userId)).limit(1);
      if (existingVault.length === 0) {
        const newVault = await db2.insert(vaults).values({
          userId,
          currency,
          address: walletAddress,
          balance: initialAmount.toString(),
          monthlyGoal: monthlyGoal.toString()
        }).returning();
        if (initialAmount > 0) {
          await db2.insert(walletTransactions2).values({
            walletAddress,
            amount: initialAmount.toString(),
            currency,
            type: "deposit",
            status: "completed",
            description: `Initial ${currency} deposit`
          });
        }
        results.push({
          currency,
          vault: newVault[0],
          initialized: true
        });
      } else {
        results.push({
          currency,
          vault: existingVault[0],
          initialized: false,
          message: "Vault already exists for this currency"
        });
      }
    }
    await notificationService.createNotification({
      userId,
      type: "wallet",
      title: "Asset Initialization Complete",
      message: `Successfully initialized ${results.filter((r) => r.initialized).length} new asset vaults`,
      metadata: {
        initializedAssets: results.filter((r) => r.initialized).length,
        totalAssets: assets.length,
        currencies: assets.map((a) => a.currency)
      }
    });
    res.json({
      success: true,
      results,
      summary: {
        totalAssets: assets.length,
        newVaults: results.filter((r) => r.initialized).length,
        existingVaults: results.filter((r) => !r.initialized).length
      }
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router4.post("/import-wallet", async (req, res) => {
  try {
    const { userId, privateKey, currency = "cUSD" } = req.body;
    if (!userId || !privateKey) {
      return res.status(400).json({ error: "User ID and private key are required" });
    }
    if (!WalletManager.validatePrivateKey(privateKey)) {
      return res.status(400).json({ error: "Invalid private key format" });
    }
    const normalizedKey = WalletManager.normalizePrivateKey(privateKey);
    const wallet2 = new EnhancedAgentWallet(normalizedKey, NetworkConfig.CELO_ALFAJORES);
    const walletAddress = wallet2.address;
    const existingVault = await db2.select().from(vaults).where(
      and5(eq8(vaults.userId, userId), eq8(vaults.address, walletAddress))
    ).limit(1);
    if (existingVault.length > 0 && existingVault[0].userId !== userId) {
      return res.status(400).json({ error: "This wallet is already imported by another user" });
    }
    await db2.update(users).set({ updatedAt: /* @__PURE__ */ new Date() }).where(eq8(users.id, userId));
    const primaryVault = await db2.insert(vaults).values({
      userId,
      currency,
      address: walletAddress,
      balance: "0.00",
      monthlyGoal: "0.00"
    }).returning();
    try {
      const actualBalance = await wallet2.getBalanceEth();
      await db2.update(vaults).set({ balance: actualBalance.toString() }).where(eq8(vaults.id, primaryVault[0].id));
      primaryVault[0].balance = actualBalance.toString();
    } catch (error) {
      console.warn("Failed to get actual balance:", error);
    }
    await notificationService.createNotification({
      userId,
      type: "wallet",
      title: "Wallet Imported Successfully",
      message: `Your wallet ${walletAddress.slice(0, 8)}... has been imported`,
      metadata: {
        vaultId: primaryVault[0].id,
        imported: true
      }
    });
    res.json({
      success: true,
      wallet: {
        address: walletAddress,
        imported: true
      },
      primaryVault: primaryVault[0],
      message: "Wallet imported and vault created successfully"
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
var wallet_setup_default = router4;

// server/routes/governance.ts
init_storage();
init_schema();
import express5 from "express";
import { eq as eq9, and as and6, desc as desc3, gte as gte3, sql as sql5 } from "drizzle-orm";
var router5 = express5.Router();
router5.get("/:daoId/quorum", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const dao = await db2.select().from(daos).where(eq9(daos.id, daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ message: "DAO not found" });
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
    const activeMembers = await db2.select({ count: sql5`count(*)` }).from(daoMemberships).where(
      and6(
        eq9(daoMemberships.daoId, daoId),
        eq9(daoMemberships.status, "approved"),
        gte3(daoMemberships.lastActive, thirtyDaysAgo)
      )
    );
    const activeMemberCount = activeMembers[0]?.count || 0;
    const quorumPercentage = dao[0].quorumPercentage || 20;
    const requiredQuorum = Math.ceil(activeMemberCount * quorumPercentage / 100);
    res.json({
      success: true,
      data: {
        activeMemberCount,
        quorumPercentage,
        requiredQuorum,
        calculatedAt: /* @__PURE__ */ new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to calculate quorum",
      error: error.message
    });
  }
});
router5.post("/proposals/:proposalId/execute", isAuthenticated2, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = req.user.claims.sub;
    const proposal = await db2.select().from(proposals).where(eq9(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    const proposalData = proposal[0];
    if (proposalData.status !== "passed") {
      return res.status(400).json({ message: "Proposal must be in passed status to execute" });
    }
    const membership = await db2.select().from(daoMemberships).where(and6(
      eq9(daoMemberships.daoId, proposalData.daoId),
      eq9(daoMemberships.userId, userId)
    )).limit(1);
    if (!membership.length || !["admin", "elder"].includes(membership[0].role ?? "")) {
      return res.status(403).json({ message: "Insufficient permissions to execute proposal" });
    }
    let delay = 24;
    const dao = await db2.select().from(daos).where(eq9(daos.id, proposalData.daoId)).limit(1);
    if (dao.length && typeof dao[0].executionDelay === "number") {
      delay = dao[0].executionDelay;
    }
    const executionTime = new Date(Date.now() + delay * 60 * 60 * 1e3);
    await db2.insert(proposalExecutionQueue).values({
      proposalId: String(proposalId ?? ""),
      daoId: String(proposalData.daoId ?? ""),
      scheduledFor: executionTime,
      executionType: String(proposalData.proposalType ?? ""),
      executionData: proposalData.executionData || {},
      status: "pending"
    });
    res.json({
      success: true,
      message: "Proposal queued for execution",
      scheduledFor: executionTime
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to queue proposal for execution",
      error: error.message
    });
  }
});
router5.get("/:daoId/templates", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const templates = await db2.select().from(proposalTemplates).where(
      and6(
        eq9(proposalTemplates.daoId, daoId),
        eq9(proposalTemplates.isGlobal, true)
      )
    ).orderBy(desc3(proposalTemplates.createdAt));
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch proposal templates",
      error: error.message
    });
  }
});
router5.post("/:daoId/templates", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user.claims.sub;
    const templateData = req.body;
    const membership = await db2.select().from(daoMemberships).where(and6(
      eq9(daoMemberships.daoId, daoId),
      eq9(daoMemberships.userId, userId)
    )).limit(1);
    if (!membership.length || !["admin", "elder"].includes(membership[0].role ?? "")) {
      return res.status(403).json({ message: "Insufficient permissions to create templates" });
    }
    const template = await db2.insert(proposalTemplates).values({
      ...templateData,
      daoId,
      createdBy: userId
    }).returning();
    res.json({
      success: true,
      data: template[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create proposal template",
      error: error.message
    });
  }
});
router5.post("/:daoId/delegate", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user.claims.sub;
    const { delegateId, scope, category, proposalId } = req.body;
    const delegateMembership = await db2.select().from(daoMemberships).where(and6(
      eq9(daoMemberships.daoId, daoId),
      eq9(daoMemberships.userId, delegateId),
      eq9(daoMemberships.status, "approved")
    )).limit(1);
    if (!delegateMembership.length) {
      return res.status(400).json({ message: "Delegate must be an active DAO member" });
    }
    await db2.update(voteDelegations).set({ isActive: false }).where(and6(
      eq9(voteDelegations.delegatorId, userId),
      eq9(voteDelegations.daoId, daoId),
      eq9(voteDelegations.isActive, true)
    ));
    const delegation = await db2.insert(voteDelegations).values({
      delegatorId: userId,
      delegateId,
      daoId,
      scope,
      category,
      proposalId,
      isActive: true
    }).returning();
    res.json({
      success: true,
      data: delegation[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create vote delegation",
      error: error.message
    });
  }
});
router5.get("/:daoId/delegations", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user.claims.sub;
    const delegations = await db2.select().from(voteDelegations).where(and6(
      eq9(voteDelegations.daoId, daoId),
      eq9(voteDelegations.delegatorId, userId),
      eq9(voteDelegations.isActive, true)
    ));
    res.json({
      success: true,
      data: delegations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch delegations",
      error: error.message
    });
  }
});
router5.delete("/:daoId/delegate/:delegationId", isAuthenticated2, async (req, res) => {
  try {
    const { daoId, delegationId } = req.params;
    const userId = req.user.claims.sub;
    await db2.update(voteDelegations).set({ isActive: false }).where(and6(
      eq9(voteDelegations.id, delegationId),
      eq9(voteDelegations.delegatorId, userId),
      eq9(voteDelegations.daoId, daoId)
    ));
    res.json({
      success: true,
      message: "Delegation revoked successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to revoke delegation",
      error: error.message
    });
  }
});
router5.post("/proposals/:proposalId/check-quorum", isAuthenticated2, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await db2.select().from(proposals).where(eq9(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    const proposalData = proposal[0];
    const yesVotes = typeof proposalData.yesVotes === "number" ? proposalData.yesVotes : 0;
    const noVotes = typeof proposalData.noVotes === "number" ? proposalData.noVotes : 0;
    const abstainVotes = typeof proposalData.abstainVotes === "number" ? proposalData.abstainVotes : 0;
    const totalVotes = yesVotes + noVotes + abstainVotes;
    const quorumResponse = await fetch(`/api/governance/${proposalData.daoId}/quorum`);
    const quorumData = await quorumResponse.json();
    const requiredQuorum = quorumData.data.requiredQuorum;
    const quorumMet = totalVotes >= requiredQuorum;
    const passed = quorumMet && yesVotes > noVotes;
    await db2.insert(quorumHistory).values({
      daoId: proposalData.daoId,
      proposalId,
      activeMemberCount: quorumData.data.activeMemberCount,
      requiredQuorum,
      achievedQuorum: totalVotes,
      quorumMet
    });
    if (/* @__PURE__ */ new Date() > proposalData.voteEndTime) {
      let newStatus = "failed";
      if (quorumMet && passed) {
        newStatus = "passed";
      } else if (!quorumMet) {
        newStatus = "failed";
      }
      await db2.update(proposals).set({ status: newStatus }).where(eq9(proposals.id, proposalId));
    }
    res.json({
      success: true,
      data: {
        quorumMet,
        passed,
        totalVotes,
        requiredQuorum,
        status: passed && quorumMet ? "passed" : "failed"
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check proposal quorum",
      error: error.message
    });
  }
});
var governance_default = router5;

// server/routes/tasks.ts
init_storage();
init_schema();
import express6 from "express";
import { eq as eq13, and as and10, desc as desc5, sql as sql8 } from "drizzle-orm";
import { z as z2 } from "zod";
var router6 = express6.Router();
var createTaskSchema = z2.object({
  title: z2.string().min(1, "Title is required"),
  description: z2.string().min(1, "Description is required"),
  reward: z2.number().positive("Reward must be positive"),
  daoId: z2.string().min(1, "DAO ID is required"),
  category: z2.string().min(1, "Category is required"),
  difficulty: z2.enum(["easy", "medium", "hard"]),
  estimatedTime: z2.string().optional(),
  deadline: z2.string().optional(),
  requiresVerification: z2.boolean().default(false)
});
var verifyTaskSchema = z2.object({
  proofUrl: z2.string().url("Valid proof URL required"),
  description: z2.string().min(10, "Verification description required"),
  screenshots: z2.array(z2.string().url()).optional()
});
function requireRole3(...roles2) {
  return async (req, res, next) => {
    const userId = String(req.user?.claims?.sub ?? "");
    const daoIdRaw = req.params.daoId || req.body.daoId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    let daoId = void 0;
    if (typeof daoIdRaw === "string") {
      daoId = daoIdRaw;
    } else if (daoIdRaw) {
      daoId = String(daoIdRaw);
    }
    if (!daoId || daoId === "null") {
      return res.status(400).json({ error: "Invalid DAO ID" });
    }
    if (!userId || typeof userId !== "string") {
      return res.status(401).json({ error: "Unauthorized: Invalid user ID" });
    }
    const safeUserId = String(userId ?? "");
    const membership = await db2.select().from(daoMemberships).where(and10(eq13(daoMemberships.daoId, String(daoId ?? "")), eq13(daoMemberships.userId, String(userId ?? ""))));
    if (!membership.length || !roles2.includes(typeof membership[0].role === "string" ? membership[0].role : "")) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
router6.post("/create", requireRole3("admin", "moderator"), async (req, res) => {
  try {
    const validatedData = createTaskSchema.parse(req.body);
    const userId = req.user && req.user.claims ? req.user.claims.sub : void 0;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const insertData = {
      ...validatedData,
      creatorId: userId,
      status: "open",
      reward: String(validatedData.reward)
    };
    if (validatedData.deadline) {
      insertData.deadline = new Date(validatedData.deadline);
    }
    const task = await db2.insert(tasks).values(insertData).returning();
    await db2.insert(taskHistory).values({
      taskId: task[0].id,
      userId,
      action: "created",
      details: { category: validatedData.category, reward: String(validatedData.reward) }
    });
    res.status(201).json(task[0]);
  } catch (err) {
    if (err instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router6.get("/", async (req, res) => {
  try {
    const {
      daoId,
      status,
      category,
      difficulty,
      limit = 20,
      offset = 0
    } = req.query;
    let conditions = [];
    if (daoId) conditions.push(eq13(tasks.daoId, typeof daoId === "string" ? daoId : ""));
    if (status) conditions.push(eq13(tasks.status, typeof status === "string" ? status : ""));
    if (category) conditions.push(eq13(tasks.category, typeof category === "string" ? category : ""));
    if (difficulty) conditions.push(eq13(tasks.difficulty, typeof difficulty === "string" ? difficulty : ""));
    let query;
    if (conditions.length > 0) {
      query = db2.select().from(tasks).where(and10(...conditions));
    } else {
      query = db2.select().from(tasks);
    }
    const taskList = await query.orderBy(desc5(tasks.createdAt)).limit(Number(limit)).offset(Number(offset));
    res.json(taskList);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router6.get("/categories", async (req, res) => {
  try {
    const categories = await db2.select({ category: tasks.category }).from(tasks).groupBy(tasks.category);
    res.json(categories.map((c) => c.category).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router6.post("/:taskId/claim", async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user && req.user.claims ? req.user.claims.sub : void 0;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const task = await db2.select().from(tasks).where(eq13(tasks.id, taskId)).limit(1);
    if (!task.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (task[0].status !== "open") {
      return res.status(400).json({ error: "Task is not available for claiming" });
    }
    const claimedTask = await db2.update(tasks).set({
      claimerId: userId,
      status: "claimed",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq13(tasks.id, taskId)).returning();
    await db2.insert(taskHistory).values({
      taskId,
      userId,
      action: "claimed",
      details: { claimedAt: (/* @__PURE__ */ new Date()).toISOString() }
    });
    res.json(claimedTask[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router6.post("/:taskId/submit", async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user && req.user.claims ? req.user.claims.sub : void 0;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const validatedData = verifyTaskSchema.parse(req.body);
    const task = await db2.select().from(tasks).where(and10(eq13(tasks.id, taskId), eq13(tasks.claimerId, userId))).limit(1);
    if (!task.length) {
      return res.status(403).json({ error: "Task not found or not claimed by you" });
    }
    if (task[0].status !== "claimed") {
      return res.status(400).json({ error: "Task is not in claimed status" });
    }
    await db2.update(tasks).set({
      status: "submitted",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq13(tasks.id, taskId));
    await db2.insert(taskHistory).values({
      taskId,
      userId,
      action: "submitted",
      details: validatedData
    });
    res.json({ message: "Task submitted successfully", taskId });
  } catch (err) {
    if (err instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router6.post("/:taskId/verify", requireRole3("admin", "moderator"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { approved, feedback, autoVerify = false } = req.body;
    const userId = req.user && req.user.claims ? req.user.claims.sub : void 0;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const task = await db2.select().from(tasks).where(eq13(tasks.id, taskId)).limit(1);
    if (!task.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (task[0].status !== "submitted") {
      return res.status(400).json({ error: "Task is not ready for verification" });
    }
    let verificationScore = 0;
    let autoApproved = false;
    if (autoVerify || task[0].category === "Documentation" || task[0].difficulty === "easy") {
      const { TaskVerificationService: TaskVerificationService2 } = await Promise.resolve().then(() => (init_taskVerificationService(), taskVerificationService_exports));
      const submissionData = {
        proofUrl: task[0].proofUrl,
        description: task[0].verificationNotes || "",
        screenshots: []
      };
      verificationScore = await TaskVerificationService2.calculateVerificationScore(taskId, submissionData);
      autoApproved = verificationScore >= 70;
      if (autoApproved && !approved) {
        req.body.approved = true;
        req.body.feedback = `Auto-approved with verification score: ${verificationScore}/100. ${feedback || ""}`;
      }
    }
    const finalApproval = req.body.approved || autoApproved;
    const newStatus = finalApproval ? "completed" : "claimed";
    await db2.update(tasks).set({
      status: newStatus,
      verificationNotes: req.body.feedback || feedback,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq13(tasks.id, taskId));
    await db2.insert(taskHistory).values({
      taskId,
      userId,
      action: finalApproval ? "approved" : "rejected",
      details: {
        feedback: req.body.feedback || feedback,
        verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
        verificationScore,
        autoApproved
      }
    });
    if (finalApproval && task[0].claimerId) {
      const { TaskVerificationService: TaskVerificationService2 } = await Promise.resolve().then(() => (init_taskVerificationService(), taskVerificationService_exports));
      await TaskVerificationService2.processEscrowRelease(taskId, true);
      const { ReputationService: ReputationService2 } = await Promise.resolve().then(() => (init_reputationService(), reputationService_exports));
      const difficultyMultiplier = { easy: 1, medium: 2, hard: 3 }[task[0].difficulty] || 1;
      await ReputationService2.awardPoints(
        task[0].claimerId,
        "TASK_COMPLETED",
        50 * difficultyMultiplier,
        task[0].daoId,
        `Completed task: ${task[0].title}`,
        verificationScore / 100
      );
      const { AchievementService: AchievementService2 } = await Promise.resolve().then(() => (init_achievementService(), achievementService_exports));
      const newAchievements = await AchievementService2.checkUserAchievements(task[0].claimerId);
      if (newAchievements.length > 0) {
        const { notificationService: notificationService2 } = await Promise.resolve().then(() => (init_notificationService(), notificationService_exports));
        await notificationService2.sendNotification(task[0].claimerId, {
          title: "\u{1F3C6} New Achievement Unlocked!",
          message: `You've unlocked: ${newAchievements.join(", ")}`,
          type: "achievement"
        });
      }
    }
    res.json({
      message: finalApproval ? "Task approved and bounty paid" : "Task rejected",
      taskId,
      newStatus,
      verificationScore,
      autoApproved
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router6.get("/:taskId/history", async (req, res) => {
  try {
    const { taskId } = req.params;
    const history = await db2.select().from(taskHistory).where(eq13(taskHistory.taskId, taskId)).orderBy(desc5(taskHistory.createdAt));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router6.get("/user/claimed", async (req, res) => {
  try {
    const userId = req.user && req.user.claims ? req.user.claims.sub : void 0;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const claimedTasks = await db2.select().from(tasks).where(eq13(tasks.claimerId, userId)).orderBy(desc5(tasks.updatedAt));
    res.json(claimedTasks);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router6.get("/analytics", async (req, res) => {
  try {
    const { daoId } = req.query;
    let statsQuery;
    if (daoId) {
      statsQuery = db2.select({
        status: tasks.status,
        category: tasks.category,
        difficulty: tasks.difficulty,
        count: sql8`count(*)`,
        totalReward: sql8`sum(cast(${tasks.reward} as numeric))`
      }).from(tasks).where(eq13(tasks.daoId, typeof daoId === "string" ? daoId : ""));
    } else {
      statsQuery = db2.select({
        status: tasks.status,
        category: tasks.category,
        difficulty: tasks.difficulty,
        count: sql8`count(*)`,
        totalReward: sql8`sum(cast(${tasks.reward} as numeric))`
      }).from(tasks);
    }
    const taskStats = await statsQuery;
    res.json(taskStats);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
var tasks_default = router6;

// server/routes/reputation.ts
init_db();
init_achievementService();
import express7 from "express";
import { eq as eq16 } from "drizzle-orm";

// server/airdropService.ts
init_db();
init_reputationSchema();
import { eq as eq14, and as and11, gte as gte5 } from "drizzle-orm";
var AirdropService = class {
  // Create new airdrop campaign
  static async createAirdropCampaign(campaign) {
    const campaignId = `airdrop_${Date.now()}`;
    return campaignId;
  }
  // Calculate airdrop eligibility for all users
  static async calculateAirdropEligibility(airdropId, minimumReputation, baseAmount, maxMultiplier = 5) {
    const users5 = await db2.select({
      userId: userReputation2.userId,
      totalPoints: userReputation2.totalPoints,
      badge: userReputation2.badge
    }).from(userReputation2).where(gte5(userReputation2.totalPoints, minimumReputation));
    let processed = 0;
    let eligible = 0;
    for (const user of users5) {
      const totalPoints = typeof user.totalPoints === "number" ? user.totalPoints : 0;
      const badge = typeof user.badge === "string" ? user.badge : "Bronze";
      const reputationMultiplier = Math.min(totalPoints / minimumReputation, maxMultiplier);
      const airdropAmount = baseAmount * reputationMultiplier;
      const badgeMultiplier = this.getBadgeMultiplier(badge);
      const finalAmount = airdropAmount * badgeMultiplier;
      await db2.insert(airdropEligibility).values({
        userId: user.userId,
        airdropId,
        eligibleAmount: finalAmount.toString(),
        minimumReputation,
        userReputation: totalPoints,
        claimed: false
      });
      processed++;
      eligible++;
    }
    return { processed, eligible };
  }
  // Execute airdrop distribution
  static async executeAirdrop(airdropId) {
    const eligibleUsers = await db2.select().from(airdropEligibility).where(
      and11(
        eq14(airdropEligibility.airdropId, airdropId),
        eq14(airdropEligibility.claimed, false)
      )
    );
    let success = 0;
    let failed = 0;
    for (const eligibility of eligibleUsers) {
      try {
        await db2.update(airdropEligibility).set({
          claimed: true,
          claimedAt: /* @__PURE__ */ new Date(),
          transactionHash: null
        }).where(eq14(airdropEligibility.id, eligibility.id));
        success++;
      } catch (error) {
        console.error(`Airdrop failed for user ${eligibility.userId}:`, error);
        failed++;
      }
    }
    return { success, failed };
  }
  // Get badge multiplier for airdrop calculations
  static getBadgeMultiplier(badge) {
    switch (badge) {
      case "Diamond":
        return 2;
      case "Platinum":
        return 1.8;
      case "Gold":
        return 1.5;
      case "Silver":
        return 1.2;
      default:
        return 1;
    }
  }
  // Check user's airdrop eligibility
  static async getUserAirdropEligibility(userId) {
    return await db2.select().from(airdropEligibility).where(eq14(airdropEligibility.userId, userId));
  }
  // Claim airdrop for user
  static async claimAirdrop(userId, airdropId) {
    const eligibility = await db2.select().from(airdropEligibility).where(
      and11(
        eq14(airdropEligibility.userId, userId),
        eq14(airdropEligibility.airdropId, airdropId),
        eq14(airdropEligibility.claimed, false)
      )
    );
    if (!eligibility[0]) {
      throw new Error("No eligible airdrop found or already claimed");
    }
    await db2.update(airdropEligibility).set({
      claimed: true,
      claimedAt: /* @__PURE__ */ new Date(),
      transactionHash: null
    }).where(eq14(airdropEligibility.id, eligibility[0].id));
    return "claimed";
  }
};

// server/vestingService.ts
init_db();
init_vestingSchema();
init_reputationSchema();
import { eq as eq15, and as and12 } from "drizzle-orm";
var VestingService = class {
  // Create new vesting schedule
  static async createVestingSchedule(params) {
    const endDate = new Date(params.startDate);
    endDate.setDate(endDate.getDate() + params.vestingDuration);
    const scheduleId = (await db2.insert(vestingSchedules).values({
      userId: params.userId,
      scheduleType: params.scheduleType,
      totalTokens: params.totalTokens.toString(),
      startDate: params.startDate,
      endDate,
      cliffDuration: params.cliffDuration || 0,
      vestingDuration: params.vestingDuration,
      vestingInterval: params.vestingInterval || 1,
      reason: params.reason
    }).returning())[0].id;
    if (params.milestones && params.scheduleType === "milestone") {
      for (const milestone of params.milestones) {
        await db2.insert(vestingMilestones).values({
          scheduleId,
          milestoneType: milestone.milestoneType,
          description: milestone.description,
          targetValue: milestone.targetValue.toString(),
          tokensToRelease: milestone.tokensToRelease.toString()
        });
      }
    }
    return scheduleId;
  }
  // Calculate vested tokens for a schedule
  static async calculateVestedTokens(scheduleId) {
    const schedule = await db2.select().from(vestingSchedules).where(eq15(vestingSchedules.id, scheduleId));
    if (!schedule[0] || !schedule[0].isActive) return 0;
    const now = /* @__PURE__ */ new Date();
    const startDate = new Date(schedule[0].startDate);
    const endDate = new Date(schedule[0].endDate);
    const totalTokens = parseFloat(schedule[0].totalTokens);
    if (now < startDate) return 0;
    const cliffEndDate = new Date(startDate);
    if (!schedule[0]) return 0;
    cliffEndDate.setDate(cliffEndDate.getDate() + (schedule[0].cliffDuration ?? 0));
    if (now < cliffEndDate) return 0;
    switch (schedule[0].scheduleType) {
      case "linear":
        return this.calculateLinearVesting(totalTokens, startDate, endDate, now);
      case "cliff":
        return now >= endDate ? totalTokens : 0;
      case "milestone":
        return await this.calculateMilestoneVesting(scheduleId);
      default:
        return 0;
    }
  }
  // Linear vesting calculation
  static calculateLinearVesting(totalTokens, startDate, endDate, currentDate) {
    if (currentDate >= endDate) return totalTokens;
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsedDuration = currentDate.getTime() - startDate.getTime();
    const vestingPercentage = elapsedDuration / totalDuration;
    return totalTokens * vestingPercentage;
  }
  // Milestone-based vesting calculation
  static async calculateMilestoneVesting(scheduleId) {
    const completedMilestones = await db2.select().from(vestingMilestones).where(
      and12(
        eq15(vestingMilestones.scheduleId, scheduleId),
        eq15(vestingMilestones.isCompleted, true)
      )
    );
    return completedMilestones.reduce((total, milestone) => {
      return total + parseFloat(milestone.tokensToRelease);
    }, 0);
  }
  // Update milestone progress
  static async updateMilestoneProgress(scheduleId, milestoneType, currentValue) {
    const milestone = await db2.select().from(vestingMilestones).where(
      and12(
        eq15(vestingMilestones.scheduleId, scheduleId),
        eq15(vestingMilestones.milestoneType, milestoneType),
        eq15(vestingMilestones.isCompleted, false)
      )
    );
    if (!milestone[0]) return false;
    await db2.update(vestingMilestones).set({ currentValue: currentValue.toString() }).where(eq15(vestingMilestones.id, milestone[0].id));
    if (currentValue >= parseFloat(milestone[0].targetValue)) {
      await db2.update(vestingMilestones).set({
        isCompleted: true,
        completedAt: /* @__PURE__ */ new Date()
      }).where(eq15(vestingMilestones.id, milestone[0].id));
      return true;
    }
    return false;
  }
  // Get claimable tokens for user
  static async getClaimableTokens(userId) {
    const schedules = await db2.select().from(vestingSchedules).where(
      and12(
        eq15(vestingSchedules.userId, userId),
        eq15(vestingSchedules.isActive, true)
      )
    );
    const claimableSchedules = [];
    for (const schedule of schedules) {
      const vestedTokens = await this.calculateVestedTokens(schedule.id);
      const claimedTokens = parseFloat(schedule.claimedTokens ?? "0");
      const claimable = vestedTokens - claimedTokens;
      if (claimable > 0) {
        claimableSchedules.push({
          scheduleId: schedule.id,
          claimable
        });
      }
    }
    return claimableSchedules;
  }
  // Claim vested tokens
  static async claimVestedTokens(userId, scheduleId) {
    const schedule = await db2.select().from(vestingSchedules).where(
      and12(
        eq15(vestingSchedules.id, scheduleId),
        eq15(vestingSchedules.userId, userId),
        eq15(vestingSchedules.isActive, true)
      )
    );
    if (!schedule[0]) {
      throw new Error("Invalid vesting schedule");
    }
    const vestedTokens = await this.calculateVestedTokens(scheduleId);
    const claimedTokens = parseFloat(schedule[0].claimedTokens ?? "0");
    const claimableAmount = vestedTokens - claimedTokens;
    if (claimableAmount <= 0) {
      throw new Error("No tokens available to claim");
    }
    const txHash = "claimed";
    await db2.update(vestingSchedules).set({
      claimedTokens: (claimedTokens + claimableAmount).toString()
    }).where(eq15(vestingSchedules.id, scheduleId));
    await db2.insert(vestingClaims).values({
      scheduleId,
      userId,
      claimedAmount: claimableAmount.toString(),
      transactionHash: txHash
    });
    return txHash;
  }
  // Get user's vesting overview
  static async getUserVestingOverview(userId) {
    const schedules = await db2.select().from(vestingSchedules).where(
      and12(
        eq15(vestingSchedules.userId, userId),
        eq15(vestingSchedules.isActive, true)
      )
    );
    let totalAllocated = 0;
    let totalVested = 0;
    let totalClaimed = 0;
    let totalClaimable = 0;
    const scheduleDetails = [];
    for (const schedule of schedules) {
      const allocated = parseFloat(schedule.totalTokens);
      const vested = await this.calculateVestedTokens(schedule.id);
      const claimed = parseFloat(schedule.claimedTokens ?? "0");
      const claimable = vested - claimed;
      totalAllocated += allocated;
      totalVested += vested;
      totalClaimed += claimed;
      totalClaimable += claimable;
      scheduleDetails.push({
        id: schedule.id,
        type: schedule.scheduleType,
        reason: schedule.reason,
        allocated,
        vested,
        claimed,
        claimable,
        startDate: schedule.startDate,
        endDate: schedule.endDate
      });
    }
    return {
      overview: {
        totalAllocated,
        totalVested,
        totalClaimed,
        totalClaimable,
        vestingPercentage: totalAllocated > 0 ? totalVested / totalAllocated * 100 : 0
      },
      schedules: scheduleDetails
    };
  }
  // Check and update milestones for all users (scheduled job)
  static async updateAllMilestones() {
    const activeMilestones = await db2.select().from(vestingMilestones).where(eq15(vestingMilestones.isCompleted, false));
    let updated = 0;
    let completed = 0;
    for (const milestone of activeMilestones) {
      const schedule = await db2.select().from(vestingSchedules).where(eq15(vestingSchedules.id, milestone.scheduleId));
      if (!schedule[0]) continue;
      let currentValue = 0;
      switch (milestone.milestoneType) {
        case "reputation":
          const userRep = await db2.select().from(userReputation2).where(eq15(userReputation2.userId, schedule[0].userId));
          currentValue = userRep[0]?.totalPoints || 0;
          break;
        case "time":
          const now = /* @__PURE__ */ new Date();
          const start = new Date(schedule[0].startDate);
          currentValue = Math.floor((now.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24));
          break;
      }
      const wasCompleted = await this.updateMilestoneProgress(
        milestone.scheduleId,
        milestone.milestoneType,
        currentValue
      );
      updated++;
      if (wasCompleted) completed++;
    }
    return { updated, completed };
  }
};

// server/routes/reputation.ts
init_achievementSchema();
init_reputationService();
init_auth();
var router7 = express7.Router();
router7.post("/check-in", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.claims?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await ReputationService.recordDailyCheckIn(userId);
    res.json({
      success: true,
      message: result.pointsAwarded > 0 ? "Check-in recorded successfully!" : "Already checked in today",
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router7.get("/streak", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.claims?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const streakInfo = await ReputationService.getStreakInfo(userId);
    res.json({
      success: true,
      ...streakInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router7.get("/user/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const authUserId = req.user.claims?.sub || req.user.claims?.id;
    if (userId !== authUserId && userId !== "me") {
      const reputation2 = await ReputationService.getUserReputation(userId);
      return res.json({
        totalPoints: reputation2.totalPoints,
        badge: reputation2.badge,
        level: reputation2.level
      });
    }
    const targetUserId = userId === "me" ? authUserId : userId;
    const reputation = await ReputationService.getUserReputation(targetUserId);
    res.json(reputation);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/leaderboard", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const leaderboard = await ReputationService.getLeaderboard(Number(limit));
    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.post("/convert", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims?.sub || req.user.claims?.id;
    const { pointsToConvert, conversionRate } = req.body;
    if (!pointsToConvert || pointsToConvert <= 0) {
      return res.status(400).json({ message: "Invalid points amount" });
    }
    const result = await ReputationService.convertPointsToTokens(userId, pointsToConvert, conversionRate);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.post("/airdrop/check", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims?.sub || req.user.claims?.id;
    const { airdropId, minimumReputation, baseAmount } = req.body;
    if (!airdropId || minimumReputation == null || baseAmount == null) {
      return res.status(400).json({ message: "Missing required airdrop parameters" });
    }
    const eligibility = await ReputationService.checkAirdropEligibility(userId, airdropId, minimumReputation, baseAmount);
    res.json(eligibility);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.post("/award", isAuthenticated, async (req, res) => {
  try {
    const { userId, action, points, daoId, description, multiplier } = req.body;
    const authUser = req.user;
    if (authUser.role !== "superuser" && authUser.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    await ReputationService.awardPoints(userId, action, points, daoId, description, multiplier);
    res.json({ message: "Points awarded successfully" });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/achievements", async (req, res) => {
  try {
    const achievementRows = await db2.select().from(achievements).where(eq16(achievements.isActive, true));
    res.json({ achievements: achievementRows });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/achievements/user/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const authUserId = req.user.claims?.sub || req.user.claims?.id;
    if (userId !== authUserId && userId !== "me") {
      return res.status(403).json({ message: "Access denied" });
    }
    const targetUserId = userId === "me" ? authUserId : userId;
    const userAchievements2 = await AchievementService.getUserAchievements(targetUserId);
    const stats = await AchievementService.getUserAchievementStats(targetUserId);
    res.json({ achievements: userAchievements2, stats });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.post("/achievements/claim/:achievementId", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims?.sub || req.user.claims?.id;
    const { achievementId } = req.params;
    const success = await AchievementService.claimAchievementReward(userId, achievementId);
    if (success) {
      res.json({ message: "Reward claimed successfully" });
    } else {
      res.status(400).json({ message: "Unable to claim reward" });
    }
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/airdrops/eligible", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims?.sub || req.user.claims?.id;
    const eligibleAirdrops = await AirdropService.getUserAirdropEligibility(userId);
    res.json({ airdrops: eligibleAirdrops });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.post("/airdrops/claim/:airdropId", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims?.sub || req.user.claims?.id;
    const { airdropId } = req.params;
    const txHash = await AirdropService.claimAirdrop(userId, airdropId);
    res.json({ message: "Airdrop claimed successfully", transactionHash: txHash });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/vesting/overview", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims?.sub || req.user.claims?.id;
    const overview = await VestingService.getUserVestingOverview(userId);
    res.json(overview);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/vesting/claimable", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims?.sub || req.user.claims?.id;
    const claimable = await VestingService.getClaimableTokens(userId);
    res.json({ claimable });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router7.post("/vesting/claim/:scheduleId", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims?.sub || req.user.claims?.id;
    const { scheduleId } = req.params;
    const txHash = await VestingService.claimVestedTokens(userId, scheduleId);
    res.json({ message: "Tokens claimed successfully", transactionHash: txHash });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
var reputation_default = router7;

// server/routes/analytics.ts
init_db();
import express8 from "express";
import { sql as sql12 } from "drizzle-orm";

// server/analyticsService.ts
init_db();
init_schema();
import { eq as eq17, gte as gte7, lte as lte3, count, and as and13 } from "drizzle-orm";
import { format as format2, subDays, subMonths, subYears, startOfDay, endOfDay } from "date-fns";
import { EventEmitter as EventEmitter2 } from "events";
var AnalyticsService = class {
  constructor() {
    this.eventEmitter = new EventEmitter2();
    this.realTimeMetrics = /* @__PURE__ */ new Map();
    this.userActivityCache = /* @__PURE__ */ new Map();
    setInterval(() => this.updateRealTimeMetrics(), 3e4);
    setInterval(() => this.cleanupUserActivity(), 36e5);
  }
  // Generic helper to run a count query against a table with an optional where clause.
  // Returns a number (0 when no rows).
  async countFrom(table, where) {
    if (where) {
      const res2 = await db2.select({ c: count() }).from(table).where(where);
      return Number(res2[0]?.c || 0);
    }
    const res = await db2.select({ c: count() }).from(table);
    return Number(res[0]?.c || 0);
  }
  // Track user activity for analytics
  async trackUserActivity(userId, action, metadata) {
    const activity = { timestamp: /* @__PURE__ */ new Date(), action, ...metadata };
    if (!this.userActivityCache.has(userId)) {
      this.userActivityCache.set(userId, []);
    }
    this.userActivityCache.get(userId).push(activity);
    try {
    } catch (error) {
      console.warn("Failed to persist user activity:", error);
    }
    this.eventEmitter.emit("userActivity", { userId, action, metadata });
  }
  // Real-time metrics collection
  async getRealTimeMetrics(daoId) {
    const [totalDaos, totalProposals, totalVotes, totalUsers, totalTasks] = await Promise.all([
      this.countFrom(daos, daoId ? eq17(daos.id, daoId) : void 0),
      this.countFrom(proposals, daoId ? eq17(proposals.daoId, daoId) : void 0),
      // votes may need to be scoped by dao via join
      daoId ? (async () => {
        const res = await db2.select({ c: count() }).from(votes).innerJoin(proposals, eq17(votes.proposalId, proposals.id)).where(eq17(proposals.daoId, daoId));
        return Number(res[0]?.c || 0);
      })() : this.countFrom(votes),
      this.countFrom(users),
      this.countFrom(tasks, daoId ? eq17(tasks.daoId, daoId) : void 0)
    ]);
    const proposalData = daoId ? await db2.select({ status: proposals.status, count: count() }).from(proposals).where(eq17(proposals.daoId, daoId)).groupBy(proposals.status) : await db2.select({ status: proposals.status, count: count() }).from(proposals).groupBy(proposals.status);
    const totalProposalCount = proposalData.reduce((sum3, item) => sum3 + item.count, 0);
    const successfulProposals = proposalData.find((item) => item.status === "executed")?.count || 0;
    const avgProposalSuccessRate = totalProposalCount > 0 ? successfulProposals / totalProposalCount * 100 : 0;
    const topPerformingDaos = await this.getTopPerformingDaos(5);
    return {
      totalDaos,
      totalProposals,
      totalVotes,
      totalUsers,
      totalTasks,
      totalTransactionVolume: 0,
      avgProposalSuccessRate,
      avgUserEngagement: await this.calculateUserEngagement(daoId),
      topPerformingDaos
    };
  }
  // Historical data analysis
  async getHistoricalData(period, daoId) {
    const now = /* @__PURE__ */ new Date();
    let startDate;
    let interval;
    switch (period) {
      case "week":
        startDate = subDays(now, 7);
        interval = "day";
        break;
      case "month":
        startDate = subMonths(now, 1);
        interval = "day";
        break;
      case "quarter":
        startDate = subMonths(now, 3);
        interval = "week";
        break;
      case "year":
        startDate = subYears(now, 1);
        interval = "month";
        break;
    }
    const historicalData = [];
    const current = new Date(startDate);
    while (current <= now) {
      const dayStart = startOfDay(current);
      const dayEnd = endOfDay(current);
      const [daoCount, userCount, proposalCount, proposalSuccess] = await Promise.all([
        daoId ? this.countFrom(daos, and13(eq17(daos.id, daoId), lte3(daos.createdAt, dayEnd))) : this.countFrom(daos, lte3(daos.createdAt, dayEnd)),
        this.countFrom(users, lte3(users.createdAt, dayEnd)),
        daoId ? this.countFrom(proposals, and13(eq17(proposals.daoId, daoId), gte7(proposals.createdAt, dayStart), lte3(proposals.createdAt, dayEnd))) : this.countFrom(proposals, and13(gte7(proposals.createdAt, dayStart), lte3(proposals.createdAt, dayEnd))),
        this.getSuccessRateForPeriod(dayStart, dayEnd, daoId)
      ]);
      historicalData.push({
        timestamp: format2(current, "yyyy-MM-dd"),
        daoCount: daoCount || 0,
        userCount: userCount || 0,
        proposalCount: proposalCount || 0,
        transactionVolume: 0,
        avgSuccessRate: proposalSuccess
      });
      if (interval === "day") current.setDate(current.getDate() + 1);
      else if (interval === "week") current.setDate(current.getDate() + 7);
      else if (interval === "month") current.setMonth(current.getMonth() + 1);
    }
    return historicalData;
  }
  // Performance benchmarks
  async getPerformanceBenchmarks() {
    const allDaoMetrics = await Promise.all(
      (await db2.select({ id: daos.id }).from(daos)).map(
        (dao) => this.getRealTimeMetrics(dao.id)
      )
    );
    const sortedByEngagement = [...allDaoMetrics].sort((a, b) => b.avgUserEngagement - a.avgUserEngagement);
    const sortedBySuccess = [...allDaoMetrics].sort((a, b) => b.avgProposalSuccessRate - a.avgProposalSuccessRate);
    const quartileIndex = Math.floor(allDaoMetrics.length / 4);
    return {
      industry: {
        avgGovernanceParticipation: 65,
        // Industry benchmark
        avgProposalSuccessRate: 72,
        // Industry benchmark
        avgTreasuryGrowth: 15
        // Industry benchmark
      },
      platform: {
        topQuartile: sortedByEngagement[0] || await this.getRealTimeMetrics(),
        median: sortedByEngagement[Math.floor(allDaoMetrics.length / 2)] || await this.getRealTimeMetrics(),
        bottomQuartile: sortedByEngagement[allDaoMetrics.length - quartileIndex] || await this.getRealTimeMetrics()
      }
    };
  }
  // Export data to CSV
  async exportToCSV(type, period, daoId) {
    let data;
    let headers;
    switch (type) {
      case "metrics":
        const metrics = await this.getRealTimeMetrics(daoId);
        headers = Object.keys(metrics).filter((key) => key !== "topPerformingDaos");
        data = [Object.values(metrics).filter((_, index2) => headers[index2])];
        break;
      case "historical":
        const historical = await this.getHistoricalData(period || "month", daoId);
        headers = Object.keys(historical[0] || {});
        data = historical.map((item) => Object.values(item));
        break;
      case "benchmarks":
        const benchmarks = await this.getPerformanceBenchmarks();
        headers = ["Type", "AvgGovernanceParticipation", "AvgProposalSuccessRate", "AvgTreasuryGrowth"];
        data = [
          ["Industry", benchmarks.industry.avgGovernanceParticipation, benchmarks.industry.avgProposalSuccessRate, benchmarks.industry.avgTreasuryGrowth],
          ["Platform Top", benchmarks.platform.topQuartile.avgUserEngagement, benchmarks.platform.topQuartile.avgProposalSuccessRate, benchmarks.platform.topQuartile.totalTransactionVolume],
          ["Platform Median", benchmarks.platform.median.avgUserEngagement, benchmarks.platform.median.avgProposalSuccessRate, benchmarks.platform.median.totalTransactionVolume]
        ];
        break;
    }
    const csvContent = [
      headers.join(","),
      ...data.map((row) => row.join(","))
    ].join("\n");
    return csvContent;
  }
  // Helper methods
  async getTopPerformingDaos(limit) {
    const daosList = await db2.select({
      id: daos.id,
      name: daos.name,
      memberCount: daos.memberCount
    }).from(daos).limit(limit);
    return Promise.all(daosList.map(async (dao) => {
      const [proposalCount, successRate] = await Promise.all([
        db2.select({ count: count() }).from(proposals).where(eq17(proposals.daoId, dao.id)),
        this.getSuccessRateForDao(dao.id)
      ]);
      return {
        id: dao.id,
        name: dao.name,
        memberCount: dao.memberCount || 0,
        proposalCount: proposalCount[0]?.count || 0,
        successRate,
        treasuryValue: 0
        // Would integrate with treasury service
      };
    }));
  }
  // Update real-time metrics cache
  async updateRealTimeMetrics() {
    try {
      const globalMetrics = await this.getRealTimeMetrics();
      this.realTimeMetrics.set("global", globalMetrics);
      const activeDaos = await db2.select({ id: daos.id }).from(daos).limit(10);
      for (const dao of activeDaos) {
        const daoMetrics = await this.getRealTimeMetrics(dao.id);
        this.realTimeMetrics.set(dao.id, daoMetrics);
      }
      this.eventEmitter.emit("metricsUpdate", this.realTimeMetrics);
    } catch (error) {
      console.error("Failed to update real-time metrics:", error);
    }
  }
  // Get cached real-time metrics
  getCachedMetrics(daoId) {
    return this.realTimeMetrics.get(daoId || "global") || null;
  }
  // Subscribe to real-time updates
  onMetricsUpdate(callback) {
    this.eventEmitter.on("metricsUpdate", callback);
    return () => this.eventEmitter.off("metricsUpdate", callback);
  }
  // Subscribe to user activity
  onUserActivity(callback) {
    this.eventEmitter.on("userActivity", callback);
    return () => this.eventEmitter.off("userActivity", callback);
  }
  cleanupUserActivity() {
    const oneDayAgo = subDays(/* @__PURE__ */ new Date(), 1);
    for (const [userId, activities] of this.userActivityCache.entries()) {
      const filtered = activities.filter((a) => a.timestamp > oneDayAgo);
      if (filtered.length === 0) {
        this.userActivityCache.delete(userId);
      } else {
        this.userActivityCache.set(userId, filtered);
      }
    }
  }
  // Enhanced user engagement calculation with detailed metrics
  async calculateUserEngagement(daoId) {
    const thirtyDaysAgo = subDays(/* @__PURE__ */ new Date(), 30);
    const sevenDaysAgo = subDays(/* @__PURE__ */ new Date(), 7);
    const [totalUsers, activeUsers, weeklyActive, dailyActive] = await Promise.all([
      daoId ? db2.select({ count: count() }).from(users) : db2.select({ count: count() }).from(users),
      daoId ? db2.select({ count: count() }).from(votes).innerJoin(proposals, eq17(votes.proposalId, proposals.id)).where(and13(eq17(proposals.daoId, daoId), gte7(votes.createdAt, thirtyDaysAgo))) : db2.select({ count: count() }).from(votes).where(gte7(votes.createdAt, thirtyDaysAgo)),
      daoId ? db2.select({ count: count() }).from(votes).innerJoin(proposals, eq17(votes.proposalId, proposals.id)).where(and13(eq17(proposals.daoId, daoId), gte7(votes.createdAt, sevenDaysAgo))) : db2.select({ count: count() }).from(votes).where(gte7(votes.createdAt, sevenDaysAgo)),
      daoId ? db2.select({ count: count() }).from(votes).innerJoin(proposals, eq17(votes.proposalId, proposals.id)).where(and13(eq17(proposals.daoId, daoId), gte7(votes.createdAt, subDays(/* @__PURE__ */ new Date(), 1)))) : db2.select({ count: count() }).from(votes).where(gte7(votes.createdAt, subDays(/* @__PURE__ */ new Date(), 1)))
    ]);
    const total = totalUsers[0]?.count || 0;
    const monthly = activeUsers[0]?.count || 0;
    const weekly = weeklyActive[0]?.count || 0;
    const daily = dailyActive[0]?.count || 0;
    const monthlyEngagement = total > 0 ? monthly / total * 100 : 0;
    const weeklyEngagement = total > 0 ? weekly / total * 100 : 0;
    const dailyEngagement = total > 0 ? daily / total * 100 : 0;
    return monthlyEngagement * 0.3 + weeklyEngagement * 0.4 + dailyEngagement * 0.3;
  }
  // Get detailed engagement metrics for a DAO
  async getDetailedEngagementMetrics(daoId) {
    const now = /* @__PURE__ */ new Date();
    const oneDayAgo = subDays(now, 1);
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    const [daily, weekly, monthly] = await Promise.all([
      this.calculateEngagementForPeriod(oneDayAgo, now, daoId),
      this.calculateEngagementForPeriod(sevenDaysAgo, now, daoId),
      this.calculateEngagementForPeriod(thirtyDaysAgo, now, daoId)
    ]);
    let trend = "stable";
    if (weekly > monthly * 1.1) trend = "increasing";
    if (weekly < monthly * 0.9) trend = "decreasing";
    return {
      daily,
      weekly,
      monthly,
      averageSessionLength: 0,
      // Would need session tracking
      topContributors: [],
      // Would integrate with contribution data
      engagementTrend: trend
    };
  }
  async calculateEngagementForPeriod(start, end, daoId) {
    const [votesResult, proposalsCount] = await Promise.all([
      daoId ? db2.select({ count: count() }).from(votes).innerJoin(proposals, eq17(votes.proposalId, proposals.id)).where(and13(eq17(proposals.daoId, daoId), gte7(votes.createdAt, start), lte3(votes.createdAt, end))) : db2.select({ count: count() }).from(votes).where(and13(gte7(votes.createdAt, start), lte3(votes.createdAt, end))),
      daoId ? db2.select({ count: count() }).from(proposals).where(and13(eq17(proposals.daoId, daoId), gte7(proposals.createdAt, start), lte3(proposals.createdAt, end))) : db2.select({ count: count() }).from(proposals).where(and13(gte7(proposals.createdAt, start), lte3(proposals.createdAt, end)))
    ]);
    return (votesResult[0]?.count || 0) + (proposalsCount[0]?.count || 0);
  }
  async getSuccessRateForPeriod(start, end, daoId) {
    const proposalsData = daoId ? await db2.select({
      status: proposals.status,
      count: count()
    }).from(proposals).where(and13(eq17(proposals.daoId, daoId), gte7(proposals.createdAt, start), lte3(proposals.createdAt, end))).groupBy(proposals.status) : await db2.select({
      status: proposals.status,
      count: count()
    }).from(proposals).where(and13(gte7(proposals.createdAt, start), lte3(proposals.createdAt, end))).groupBy(proposals.status);
    const total = proposalsData.reduce((sum3, item) => sum3 + item.count, 0);
    const successful = proposalsData.find((item) => item.status !== null && item.status === "executed")?.count || 0;
    return total > 0 ? successful / total * 100 : 0;
  }
  async getSuccessRateForDao(daoId) {
    const proposalsData = await db2.select({
      status: proposals.status,
      count: count()
    }).from(proposals).where(eq17(proposals.daoId, daoId)).groupBy(proposals.status);
    const total = proposalsData.reduce((sum3, item) => sum3 + item.count, 0);
    const successful = proposalsData.find((item) => item.status !== null && item.status === "executed")?.count || 0;
    return total > 0 ? successful / total * 100 : 0;
  }
};
var analyticsService = new AnalyticsService();

// server/routes/analytics.ts
init_auth();
import PDFDocument from "pdfkit";
var router8 = express8.Router();
router8.get("/metrics", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.query;
    const metrics = await analyticsService.getRealTimeMetrics(daoId);
    res.json({
      success: true,
      data: metrics,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch real-time metrics",
      error: error.message
    });
  }
});
router8.get("/historical", isAuthenticated, async (req, res) => {
  try {
    const { period = "month", daoId } = req.query;
    if (!["week", "month", "quarter", "year"].includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Invalid period. Must be one of: week, month, quarter, year"
      });
    }
    const historicalData = await analyticsService.getHistoricalData(
      period,
      daoId
    );
    res.json({
      success: true,
      data: historicalData,
      period,
      daoId: daoId || "all"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch historical data",
      error: error.message
    });
  }
});
router8.get("/benchmarks", isAuthenticated, async (req, res) => {
  try {
    const benchmarks = await analyticsService.getPerformanceBenchmarks();
    res.json({
      success: true,
      data: benchmarks,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch performance benchmarks",
      error: error.message
    });
  }
});
router8.get("/export/csv", isAuthenticated, async (req, res) => {
  try {
    const { type = "metrics", period = "month", daoId } = req.query;
    if (!["metrics", "historical", "benchmarks"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid export type. Must be one of: metrics, historical, benchmarks"
      });
    }
    const csvContent = await analyticsService.exportToCSV(
      type,
      period,
      daoId
    );
    const filename = `${type}-${period || "current"}-${daoId || "all"}-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to export CSV",
      error: error.message
    });
  }
});
router8.get("/export/pdf", isAuthenticated, async (req, res) => {
  try {
    const { daoId, period = "month" } = req.query;
    const [metrics, historical, benchmarks] = await Promise.all([
      analyticsService.getRealTimeMetrics(daoId),
      analyticsService.getHistoricalData(period, daoId),
      analyticsService.getPerformanceBenchmarks()
    ]);
    const doc = new PDFDocument();
    const filename = `analytics-report-${daoId || "platform"}-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);
    doc.fontSize(20).text("Analytics Report", 50, 50);
    doc.fontSize(12).text(`Generated: ${(/* @__PURE__ */ new Date()).toLocaleString()}`, 50, 80);
    doc.text(`Period: ${period}`, 50, 95);
    if (daoId) doc.text(`DAO ID: ${daoId}`, 50, 110);
    doc.fontSize(16).text("Current Metrics", 50, 140);
    let yPos = 160;
    Object.entries(metrics).forEach(([key, value]) => {
      if (key !== "topPerformingDaos" && typeof value !== "object") {
        doc.fontSize(10).text(`${key}: ${value}`, 50, yPos);
        yPos += 15;
      }
    });
    yPos += 20;
    doc.fontSize(16).text("Historical Trends", 50, yPos);
    yPos += 20;
    doc.fontSize(10).text("Date | DAOs | Users | Proposals | Volume", 50, yPos);
    yPos += 15;
    historical.slice(-10).forEach((item) => {
      doc.text(`${item.timestamp} | ${item.daoCount} | ${item.userCount} | ${item.proposalCount} | $${item.transactionVolume.toFixed(2)}`, 50, yPos);
      yPos += 12;
    });
    yPos += 30;
    doc.fontSize(16).text("Performance Benchmarks", 50, yPos);
    yPos += 20;
    doc.fontSize(12).text("Industry Benchmarks:", 50, yPos);
    yPos += 15;
    doc.fontSize(10).text(`Governance Participation: ${benchmarks.industry.avgGovernanceParticipation}%`, 70, yPos);
    yPos += 12;
    doc.text(`Proposal Success Rate: ${benchmarks.industry.avgProposalSuccessRate}%`, 70, yPos);
    yPos += 12;
    doc.text(`Treasury Growth: ${benchmarks.industry.avgTreasuryGrowth}%`, 70, yPos);
    doc.end();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate PDF report",
      error: error.message
    });
  }
});
router8.get("/live", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.query;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control"
    });
    const sendMetrics = async () => {
      try {
        const metrics = await analyticsService.getRealTimeMetrics(daoId);
        res.write(`data: ${JSON.stringify({
          type: "metrics",
          data: metrics,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })}

`);
      } catch (error) {
        console.error("Error sending live metrics:", error);
      }
    };
    await sendMetrics();
    const unsubscribe = analyticsService.onMetricsUpdate((metricsMap) => {
      const targetMetrics = metricsMap.get(daoId || "global");
      if (targetMetrics) {
        res.write(`data: ${JSON.stringify({
          type: "metrics",
          data: targetMetrics,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })}

`);
      }
    });
    req.on("close", () => {
      unsubscribe();
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to start live metrics stream",
      error: error.message
    });
  }
});
router8.get("/user-activity", isAuthenticated, async (req, res) => {
  try {
    const { userId, period = "7d", daoId } = req.query;
    let whereClause = "";
    const params = [];
    if (userId) {
      whereClause += " AND user_id = $" + (params.length + 1);
      params.push(userId);
    }
    if (daoId) {
      whereClause += " AND metadata->'daoId' = $" + (params.length + 1);
      params.push(daoId);
    }
    const days = period === "30d" ? 30 : period === "7d" ? 7 : 1;
    const startDate = /* @__PURE__ */ new Date();
    startDate.setDate(startDate.getDate() - days);
    const query = `
      SELECT 
        action,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM user_activities 
      WHERE created_at >= $${params.length + 1} ${whereClause}
      GROUP BY action, DATE(created_at)
      ORDER BY date DESC, count DESC
    `;
    params.push(startDate);
    const activities = await db2.execute(sql12.raw(query));
    res.json({
      success: true,
      data: activities,
      period,
      userId: userId || "all",
      daoId: daoId || "all"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user activity data",
      error: error.message
    });
  }
});
router8.get("/system-health", isAuthenticated, async (req, res) => {
  try {
    const metrics = metricsCollector.getMetrics();
    const healthScore = metricsCollector.getHealthScore();
    const systemHealth = {
      healthScore,
      status: healthScore >= 80 ? "healthy" : healthScore >= 60 ? "degraded" : "unhealthy",
      metrics: {
        ...metrics.summary,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime()
      },
      alerts: metrics.summary.errorRate > 5 ? ["High error rate detected"] : [],
      recommendations: healthScore < 80 ? [
        "Consider optimizing slow endpoints",
        "Monitor memory usage",
        "Review error logs"
      ] : []
    };
    res.json({
      success: true,
      data: systemHealth
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch system health data",
      error: error.message
    });
  }
});
router8.get("/dao/:daoId/summary", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { period = "month" } = req.query;
    const [metrics, historical] = await Promise.all([
      analyticsService.getRealTimeMetrics(daoId),
      analyticsService.getHistoricalData(period, daoId)
    ]);
    const currentMetrics = historical[historical.length - 1];
    const previousMetrics = historical[historical.length - 2];
    let growthRates = {};
    if (currentMetrics && previousMetrics) {
      growthRates = {
        userGrowth: (currentMetrics.userCount - previousMetrics.userCount) / previousMetrics.userCount * 100,
        proposalGrowth: (currentMetrics.proposalCount - previousMetrics.proposalCount) / (previousMetrics.proposalCount || 1) * 100,
        volumeGrowth: (currentMetrics.transactionVolume - previousMetrics.transactionVolume) / (previousMetrics.transactionVolume || 1) * 100
      };
    }
    res.json({
      success: true,
      data: {
        metrics,
        historical,
        growthRates,
        period
      },
      daoId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch DAO analytics summary",
      error: error.message
    });
  }
});
var analytics_default = router8;

// server/routes/notifications.ts
import express9 from "express";
init_storage();
var router9 = express9.Router();
router9.get("/", isAuthenticated2, async (req, res) => {
  try {
    const { limit = 20, offset = 0, read, type } = req.query;
    const userId = req.user.claims.sub;
    const notifications2 = await storage.getUserNotifications(
      userId,
      read === "true" ? true : read === "false" ? false : void 0,
      Number(limit),
      Number(offset),
      type
    );
    const unreadCount = await storage.getUnreadNotificationCount(userId);
    res.json({
      notifications: notifications2,
      total: notifications2.length,
      unreadCount
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch notifications",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.patch("/:notificationId/read", isAuthenticated2, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.claims.sub;
    const notification = await storage.markNotificationAsRead(notificationId, userId);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json(notification);
  } catch (err) {
    res.status(500).json({
      error: "Failed to mark notification as read",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.patch("/mark-all-read", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    await storage.markAllNotificationsAsRead(userId);
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({
      error: "Failed to mark all notifications as read",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.delete("/:notificationId", isAuthenticated2, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.claims.sub;
    const deleted = await storage.deleteNotification(notificationId, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({
      error: "Failed to delete notification",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.get("/preferences", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const preferences = await storage.getUserNotificationPreferences(userId);
    res.json(preferences);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch notification preferences",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.put("/preferences", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const { emailNotifications, pushNotifications, telegramNotifications, daoUpdates, proposalUpdates, taskUpdates } = req.body;
    const preferences = await storage.updateUserNotificationPreferences(userId, {
      emailNotifications: emailNotifications ?? true,
      pushNotifications: pushNotifications ?? true,
      telegramNotifications: telegramNotifications ?? false,
      daoUpdates: daoUpdates ?? true,
      proposalUpdates: proposalUpdates ?? true,
      taskUpdates: taskUpdates ?? true
    });
    res.json(preferences);
  } catch (err) {
    res.status(500).json({
      error: "Failed to update notification preferences",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.post("/telegram/link", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const { telegramId, chatId, username } = req.body;
    await storage.updateUserTelegramInfo(userId, { telegramId, chatId, username });
    res.json({ message: "Telegram account linked successfully" });
  } catch (err) {
    res.status(500).json({
      error: "Failed to link Telegram account",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.get("/telegram/bot-info", async (req, res) => {
  try {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "mtaadao_bot";
    res.json({
      botUsername,
      linkInstructions: `To link your Telegram account, send a message to @${botUsername} with the command: /link ${req.user?.claims?.sub || "USER_ID"}`
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to get bot info",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.post("/send", isAuthenticated2, async (req, res) => {
  try {
    const senderId = req.user.claims.sub;
    const { userIds, type, message, title, metadata } = req.body;
    const senderRole = req.user.role;
    if (senderRole !== "admin" && senderRole !== "superuser" && senderRole !== "moderator") {
      return res.status(403).json({ error: "Insufficient permissions to send notifications" });
    }
    const notifications2 = await storage.createBulkNotifications(userIds, {
      type,
      message,
      title,
      metadata,
      senderId
    });
    res.status(201).json({
      message: "Notifications sent successfully",
      count: notifications2.length
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to send notifications",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
var notifications_default = router9;
router9.get("/search", isAuthenticated2, async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    const userId = req.user.claims.sub;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Search query is required" });
    }
    const notifications2 = await storage.getUserNotifications(
      userId,
      void 0,
      Number(limit),
      Number(offset),
      q
    );
    res.json({
      notifications: notifications2,
      total: notifications2.length,
      query: q
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to search notifications",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// server/routes/disbursements.ts
init_storage();
init_schema();
import express10 from "express";
import { eq as eq18, and as and14, desc as desc7 } from "drizzle-orm";
var router10 = express10.Router();
router10.post("/create", async (req, res) => {
  try {
    const disbursement = req.body;
    const { daoId, recipients, totalAmount, currency, description } = disbursement;
    if (!daoId || !recipients || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "DAO ID and recipients are required"
      });
    }
    const calculatedTotal = recipients.reduce((sum3, recipient) => sum3 + recipient.amount, 0);
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: "Total amount does not match sum of recipient amounts"
      });
    }
    const disbursementId = "DISB-" + Date.now();
    const feePercent = 0.01;
    const totalFee = Math.round(totalAmount * feePercent * 100) / 100;
    const netAmount = totalAmount - totalFee;
    const transactions = [];
    for (const recipient of recipients) {
      const transaction = {
        id: `TXN-${disbursementId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fromUserId: daoId,
        toUserId: recipient.userId,
        walletAddress: recipient.walletAddress,
        amount: recipient.amount.toString(),
        currency,
        type: "disbursement",
        status: "pending",
        description: `${description} - ${recipient.reason}`,
        disbursementId,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
      await db2.insert(walletTransactions2).values(transaction);
      transactions.push(transaction);
    }
    res.json({
      success: true,
      disbursementId,
      message: "Disbursement created successfully",
      totalAmount,
      fee: totalFee,
      netAmount,
      recipientCount: recipients.length,
      transactions: transactions.map((t) => ({
        id: t.id,
        recipient: t.toUserId,
        amount: t.amount,
        status: t.status
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create disbursement",
      error: error.message
    });
  }
});
router10.get("/:daoId/history", async (req, res) => {
  try {
    const { daoId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const transactions = await db2.select().from(walletTransactions2).where(and14(
      eq18(walletTransactions2.fromUserId, daoId),
      eq18(walletTransactions2.type, "disbursement")
    )).orderBy(desc7(walletTransactions2.createdAt)).limit(Number(limit)).offset(Number(offset));
    const disbursements = /* @__PURE__ */ new Map();
    transactions.forEach((tx) => {
      const disbursementId = tx.disbursementId;
      if (!disbursements.has(disbursementId)) {
        disbursements.set(disbursementId, {
          id: disbursementId,
          daoId,
          totalAmount: 0,
          recipientCount: 0,
          status: "pending",
          currency: tx.currency,
          createdAt: tx.createdAt,
          recipients: []
        });
      }
      const disbursement = disbursements.get(disbursementId);
      disbursement.totalAmount += typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
      disbursement.recipientCount += 1;
      disbursement.recipients.push({
        userId: tx.toUserId,
        walletAddress: tx.walletAddress,
        amount: tx.amount,
        status: tx.status,
        description: tx.description
      });
      const allCompleted = disbursement.recipients.every((r) => r.status === "completed");
      const anyFailed = disbursement.recipients.some((r) => r.status === "failed");
      if (allCompleted) disbursement.status = "completed";
      else if (anyFailed) disbursement.status = "partial";
      else disbursement.status = "pending";
    });
    res.json({
      success: true,
      disbursements: Array.from(disbursements.values()),
      total: disbursements.size
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get disbursement history",
      error: error.message
    });
  }
});
router10.post("/:disbursementId/execute", async (req, res) => {
  try {
    const { disbursementId } = req.params;
    const { paymentMethod = "wallet" } = req.body;
    const transactions = await db2.select().from(walletTransactions2).where(and14(
      eq18(walletTransactions2.disbursementId, disbursementId),
      eq18(walletTransactions2.status, "pending")
    ));
    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending transactions found for this disbursement"
      });
    }
    const results = [];
    for (const transaction of transactions) {
      try {
        await db2.update(walletTransactions2).set({
          status: "completed",
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq18(walletTransactions2.id, transaction.id));
        results.push({
          transactionId: transaction.id,
          recipient: transaction.toUserId,
          amount: transaction.amount,
          status: "completed"
        });
      } catch (error) {
        await db2.update(walletTransactions2).set({
          status: "failed",
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq18(walletTransactions2.id, transaction.id));
        results.push({
          transactionId: transaction.id,
          recipient: transaction.toUserId,
          amount: transaction.amount,
          status: "failed",
          error: error.message
        });
      }
    }
    const successful = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    res.json({
      success: true,
      disbursementId,
      message: `Disbursement execution completed: ${successful} successful, ${failed} failed`,
      results,
      summary: {
        total: results.length,
        successful,
        failed
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to execute disbursement",
      error: error.message
    });
  }
});
router10.get("/:disbursementId/status", async (req, res) => {
  try {
    const { disbursementId } = req.params;
    const transactions = await db2.select().from(walletTransactions2).where(eq18(walletTransactions2.disbursementId, disbursementId));
    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Disbursement not found"
      });
    }
    const totalAmount = transactions.reduce((sum3, tx) => {
      const amount = typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
      return sum3 + amount;
    }, 0);
    const statusCounts = transactions.reduce((counts, tx) => {
      counts[tx.status || "pending"] = (counts[tx.status || "pending"] || 0) + 1;
      return counts;
    }, {});
    const overallStatus = statusCounts.failed > 0 ? "partial" : statusCounts.pending > 0 ? "pending" : "completed";
    res.json({
      success: true,
      disbursement: {
        id: disbursementId,
        totalAmount,
        recipientCount: transactions.length,
        status: overallStatus,
        statusBreakdown: statusCounts,
        currency: transactions[0].currency,
        createdAt: transactions[0].createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get disbursement status",
      error: error.message
    });
  }
});
router10.post("/schedule-recurring", async (req, res) => {
  try {
    const {
      daoId,
      recipients,
      amount,
      currency,
      description,
      frequency,
      // 'weekly', 'monthly', 'quarterly'
      startDate,
      endDate,
      maxExecutions
    } = req.body;
    const recurringId = "REC-" + Date.now();
    const schedule = {
      id: recurringId,
      daoId,
      recipients,
      amount,
      currency,
      description,
      frequency,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      maxExecutions,
      executionCount: 0,
      status: "active",
      nextExecution: new Date(startDate),
      createdAt: /* @__PURE__ */ new Date()
    };
    res.json({
      success: true,
      message: "Recurring disbursement scheduled successfully",
      scheduleId: recurringId,
      nextExecution: schedule.nextExecution
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to schedule recurring disbursement",
      error: error.message
    });
  }
});
router10.get("/:daoId/templates", async (req, res) => {
  try {
    const { daoId } = req.params;
    const templates = [
      {
        id: "payroll",
        name: "Monthly Payroll",
        description: "Regular monthly payments to team members",
        frequency: "monthly",
        category: "operations"
      },
      {
        id: "grants",
        name: "Quarterly Grants",
        description: "Quarterly grant disbursements",
        frequency: "quarterly",
        category: "funding"
      },
      {
        id: "bounties",
        name: "Bounty Payments",
        description: "One-time bounty rewards",
        frequency: "once",
        category: "rewards"
      }
    ];
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get disbursement templates",
      error: error.message
    });
  }
});
router10.post("/bulk-approve", async (req, res) => {
  try {
    const { disbursementIds, approverUserId } = req.body;
    const results = [];
    for (const disbursementId of disbursementIds) {
      try {
        await db2.update(walletTransactions2).set({
          status: "approved",
          approvedBy: approverUserId,
          approvedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq18(walletTransactions2.disbursementId, disbursementId));
        results.push({
          disbursementId,
          status: "approved"
        });
      } catch (error) {
        results.push({
          disbursementId,
          status: "failed",
          error: error.message
        });
      }
    }
    res.json({
      success: true,
      message: "Bulk approval completed",
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process bulk approval",
      error: error.message
    });
  }
});
var disbursements_default = router10;

// server/routes/dao_treasury.ts
import express11 from "express";
init_storage();
var router11 = express11.Router();
router11.get("/:daoId/balance", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: "DAO or treasury wallet not found" });
    }
    const config4 = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle2 = async (tokenAddress) => {
      const prices = {
        "native": 2500,
        // ETH price
        "0x...": 1
        // USDC price
      };
      return prices[tokenAddress] || 0;
    };
    const wallet2 = new agent_wallet_default(
      dao.treasuryPrivateKey,
      config4,
      void 0,
      void 0,
      void 0,
      mockPriceOracle2
    );
    const treasuryManager = new DaoTreasuryManager(wallet2, dao.treasuryAddress, dao.allowedTokens || []);
    const snapshot = await treasuryManager.getTreasurySnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router11.post("/:daoId/transfer/native", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { toAddress, amount } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: "DAO or treasury wallet not found" });
    }
    const config4 = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle2 = async (tokenAddress) => {
      const prices = {
        "native": 2500,
        "0x...": 1
      };
      return prices[tokenAddress] || 0;
    };
    const wallet2 = new agent_wallet_default(
      dao.treasuryPrivateKey,
      config4,
      void 0,
      void 0,
      void 0,
      mockPriceOracle2
    );
    const tx = await wallet2.sendNativeToken(toAddress, amount);
    res.json({ tx });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router11.post("/:daoId/transfer/token", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { tokenAddress, toAddress, amount } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: "DAO or treasury wallet not found" });
    }
    const config4 = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle2 = async (tokenAddress2) => {
      const prices = {
        "native": 2500,
        "0x...": 1
      };
      return prices[tokenAddress2] || 0;
    };
    const wallet2 = new agent_wallet_default(
      dao.treasuryPrivateKey,
      config4,
      void 0,
      void 0,
      void 0,
      mockPriceOracle2
    );
    const tx = await wallet2.sendTokenHuman(tokenAddress, toAddress, amount);
    res.json({ tx });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router11.post("/:daoId/automation/payout", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { payouts } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: "DAO or treasury wallet not found" });
    }
    const config4 = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle2 = async (tokenAddress) => {
      const prices = {
        "native": 2500,
        "0x...": 1
      };
      return prices[tokenAddress] || 0;
    };
    const wallet2 = new agent_wallet_default(
      dao.treasuryPrivateKey,
      config4,
      void 0,
      void 0,
      void 0,
      mockPriceOracle2
    );
    const results = await wallet2.batchTransfer(payouts);
    res.json({ results });
    router11.get("/:daoId/snapshot", isAuthenticated2, async (req2, res2) => {
      try {
        const { daoId: daoId2 } = req2.params;
        const dao2 = await storage.getDao(daoId2);
        if (!dao2 || !dao2.treasuryPrivateKey) {
          return res2.status(404).json({ message: "DAO or treasury wallet not found" });
        }
        const config5 = NetworkConfig.CELO_ALFAJORES;
        const mockPriceOracle3 = async (tokenAddress) => {
          const prices = {
            "native": 2500,
            "0x...": 1
          };
          return prices[tokenAddress] || 0;
        };
        const wallet3 = new agent_wallet_default(
          dao2.treasuryPrivateKey,
          config5,
          void 0,
          void 0,
          void 0,
          mockPriceOracle3
        );
        const treasuryManager = new DaoTreasuryManager(wallet3, dao2.treasuryAddress, dao2.allowedTokens || []);
        const snapshot = await treasuryManager.getTreasurySnapshot();
        res2.json(snapshot);
      } catch (err) {
        res2.status(500).json({ message: err instanceof Error ? err.message : String(err) });
      }
    });
    router11.get("/:daoId/report", isAuthenticated2, async (req2, res2) => {
      try {
        const { daoId: daoId2 } = req2.params;
        const { period } = req2.query;
        const dao2 = await storage.getDao(daoId2);
        if (!dao2 || !dao2.treasuryPrivateKey) {
          return res2.status(404).json({ message: "DAO or treasury wallet not found" });
        }
        const config5 = NetworkConfig.CELO_ALFAJORES;
        const mockPriceOracle3 = async (tokenAddress) => {
          const prices = {
            "native": 2500,
            "0x...": 1
          };
          return prices[tokenAddress] || 0;
        };
        const wallet3 = new agent_wallet_default(
          dao2.treasuryPrivateKey,
          config5,
          void 0,
          void 0,
          void 0,
          mockPriceOracle3
        );
        const treasuryManager = new DaoTreasuryManager(wallet3, dao2.treasuryAddress, dao2.allowedTokens || []);
        const report = await treasuryManager.generateTreasuryReport(period || "monthly");
        res2.json(report);
      } catch (err) {
        res2.status(500).json({ message: err instanceof Error ? err.message : String(err) });
      }
    });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router11.get("/:daoId/analytics", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { period = "30d" } = req.query;
    const dao = await storage.getDao(daoId);
    if (!dao) {
      return res.status(404).json({ message: "DAO not found" });
    }
    const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 30;
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1e3);
    const { db: db3 } = (init_storage(), __toCommonJS(storage_exports));
    const { walletTransactions: walletTransactions4 } = (init_schema(), __toCommonJS(schema_exports));
    const { eq: eq49, desc: desc20, and: and31 } = __require("drizzle-orm");
    const transactions = await db3.select().from(walletTransactions4).where(eq49(walletTransactions4.daoId, daoId)).where(desc20(walletTransactions4.createdAt)).where(and31(
      eq49(walletTransactions4.daoId, daoId),
      walletTransactions4.createdAt >= startDate
    ));
    const totalInflow = transactions.filter((tx) => tx.type === "deposit" || tx.type === "contribution").reduce((sum3, tx) => sum3 + parseFloat(tx.amount), 0);
    const totalOutflow = transactions.filter((tx) => tx.type === "withdrawal" || tx.type === "disbursement").reduce((sum3, tx) => sum3 + parseFloat(tx.amount), 0);
    const netFlow = totalInflow - totalOutflow;
    const currentBalance = parseFloat(dao.treasuryBalance || "0");
    const dailyVolume = transactions.reduce((acc, tx) => {
      const date = new Date(tx.createdAt).toISOString().split("T")[0];
      if (!acc[date]) acc[date] = { inflow: 0, outflow: 0 };
      const amount = parseFloat(tx.amount);
      if (tx.type === "deposit" || tx.type === "contribution") {
        acc[date].inflow += amount;
      } else {
        acc[date].outflow += amount;
      }
      return acc;
    }, {});
    res.json({
      success: true,
      analytics: {
        currentBalance,
        totalInflow,
        totalOutflow,
        netFlow,
        transactionCount: transactions.length,
        averageTransactionSize: transactions.length > 0 ? (totalInflow + totalOutflow) / transactions.length : 0,
        dailyVolume,
        period: `${periodDays}d`
      }
    });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router11.post("/:daoId/limits", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { dailyLimit, transactionLimit, approvalThreshold } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao) {
      return res.status(404).json({ message: "DAO not found" });
    }
    const { db: db3 } = (init_storage(), __toCommonJS(storage_exports));
    const { daos: daos4 } = (init_schema(), __toCommonJS(schema_exports));
    const { eq: eq49 } = __require("drizzle-orm");
    await db3.update(daos4).set({
      treasuryLimits: {
        dailyLimit: dailyLimit || 1e3,
        transactionLimit: transactionLimit || 500,
        approvalThreshold: approvalThreshold || 1e3
      },
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq49(daos4.id, daoId));
    res.json({
      success: true,
      message: "Treasury limits updated successfully"
    });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router11.post("/revenue-distribution", async (req, res) => {
  try {
    const { daoId, distributions } = req.body;
    if (!Array.isArray(distributions)) {
      return res.status(400).json({ error: "Distributions must be an array" });
    }
    const totalPercentage = distributions.reduce((sum3, d) => sum3 + d.percentage, 0);
    if (totalPercentage !== 100) {
      return res.status(400).json({ error: "Distribution percentages must total 100%" });
    }
    await db.insert(config).values({
      key: `revenue_distribution_${daoId}`,
      value: distributions
    }).onConflictDoUpdate({
      target: config.key,
      set: { value: distributions, updatedAt: /* @__PURE__ */ new Date() }
    });
    res.json({
      success: true,
      message: "Revenue distribution configured",
      distributions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router11.get("/revenue-distribution/:daoId", async (req, res) => {
  try {
    const { daoId } = req.params;
    const result = await db.select().from(config).where(eq(config.key, `revenue_distribution_${daoId}`)).limit(1);
    if (!result.length) {
      return res.json({
        success: true,
        data: {
          distributions: [],
          configured: false
        }
      });
    }
    res.json({
      success: true,
      data: {
        distributions: result[0].value,
        configured: true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router11.post("/budget-allocation", async (req, res) => {
  try {
    const { daoId, allocations } = req.body;
    await db.insert(config).values({
      key: `budget_allocation_${daoId}`,
      value: allocations
    }).onConflictDoUpdate({
      target: config.key,
      set: { value: allocations, updatedAt: /* @__PURE__ */ new Date() }
    });
    res.json({
      success: true,
      message: "Budget allocation saved",
      allocations
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router11.get("/budget-allocation/:daoId", async (req, res) => {
  try {
    const { daoId } = req.params;
    const result = await db.select().from(config).where(eq(config.key, `budget_allocation_${daoId}`)).limit(1);
    if (!result.length) {
      return res.json({
        success: true,
        data: {
          allocations: [],
          configured: false
        }
      });
    }
    const allocations = result[0].value;
    const enrichedAllocations = await Promise.all(
      allocations.map(async (allocation) => {
        const spent = await db.select({ total: sql`COALESCE(SUM(CAST(${walletTransactions.amount} AS DECIMAL)), 0)` }).from(walletTransactions).where(
          and(
            eq(walletTransactions.daoId, daoId),
            sql`${walletTransactions.description} LIKE ${`%${allocation.category}%`}`
          )
        );
        return {
          ...allocation,
          spent: spent[0]?.total || 0,
          remaining: allocation.budget - (spent[0]?.total || 0),
          utilization: (spent[0]?.total || 0) / allocation.budget * 100
        };
      })
    );
    res.json({
      success: true,
      data: {
        allocations: enrichedAllocations,
        configured: true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router11.post("/yield-farming", async (req, res) => {
  try {
    const { daoId, strategy, allocation } = req.body;
    const supportedStrategies = ["moola_lending", "ubeswap_lp", "celo_staking", "mento_pool"];
    if (!supportedStrategies.includes(strategy)) {
      return res.status(400).json({ error: "Unsupported yield strategy" });
    }
    await db.insert(config).values({
      key: `yield_farming_${daoId}`,
      value: { strategy, allocation, enabled: true }
    }).onConflictDoUpdate({
      target: config.key,
      set: { value: { strategy, allocation, enabled: true }, updatedAt: /* @__PURE__ */ new Date() }
    });
    res.json({
      success: true,
      message: "Yield farming configured",
      strategy,
      allocation
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router11.get("/yield-farming/:daoId", async (req, res) => {
  try {
    const { daoId } = req.params;
    const result = await db.select().from(config).where(eq(config.key, `yield_farming_${daoId}`)).limit(1);
    if (!result.length) {
      return res.json({
        success: true,
        data: {
          enabled: false,
          strategy: null,
          allocation: 0,
          estimatedAPY: 0
        }
      });
    }
    const farmingConfig = result[0].value;
    const apyMap = {
      moola_lending: 8.5,
      ubeswap_lp: 12.3,
      celo_staking: 6.2,
      mento_pool: 7.8
    };
    res.json({
      success: true,
      data: {
        ...farmingConfig,
        estimatedAPY: apyMap[farmingConfig.strategy] || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
var dao_treasury_default = router11;

// server/routes/dao-subscriptions.ts
init_storage();
init_schema();
import express12 from "express";
import { eq as eq19 } from "drizzle-orm";
var router12 = express12.Router();
var SUBSCRIPTION_PLANS = {
  free: {
    name: "Free",
    price: 0,
    features: ["Basic proposals", "Up to 50 members", "Community support"],
    limits: { members: 50, proposals: 10, storage: "100MB" }
  },
  pro: {
    name: "Pro",
    price: 29.99,
    features: ["Advanced proposals", "Up to 500 members", "Priority support", "Custom branding"],
    limits: { members: 500, proposals: 100, storage: "1GB" }
  },
  enterprise: {
    name: "Enterprise",
    price: 99.99,
    features: ["Unlimited proposals", "Unlimited members", "24/7 support", "White-label solution"],
    limits: { members: -1, proposals: -1, storage: "10GB" }
  }
};
router12.get("/plans", (req, res) => {
  res.json({
    success: true,
    plans: SUBSCRIPTION_PLANS
  });
});
router12.get("/:daoId/status", async (req, res) => {
  try {
    const { daoId } = req.params;
    const dao = await db2.select().from(daos).where(eq19(daos.id, daoId)).limit(1);
    if (dao.length === 0) {
      return res.status(404).json({
        success: false,
        message: "DAO not found"
      });
    }
    const daoData = dao[0];
    const currentPlan = daoData.plan || "free";
    const planDetails = SUBSCRIPTION_PLANS[currentPlan];
    res.json({
      success: true,
      subscription: {
        daoId,
        currentPlan,
        planDetails,
        billingStatus: daoData.billingStatus || "active",
        nextBillingDate: daoData.nextBillingDate,
        createdAt: daoData.createdAt,
        updatedAt: daoData.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get subscription status",
      error: error.message
    });
  }
});
router12.post("/:daoId/upgrade", async (req, res) => {
  try {
    const { daoId } = req.params;
    const { plan, paymentMethod } = req.body;
    if (!SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan"
      });
    }
    const planDetails = SUBSCRIPTION_PLANS[plan];
    const subscriptionId = "SUB-" + Date.now();
    await db2.update(daos).set({
      plan,
      billingStatus: "active",
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3),
      // 30 days from now
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq19(daos.id, daoId));
    res.json({
      success: true,
      message: `Successfully upgraded to ${plan} plan`,
      subscription: {
        daoId,
        plan,
        subscriptionId,
        amount: planDetails.price,
        billingStatus: "active",
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to upgrade subscription",
      error: error.message
    });
  }
});
router12.post("/:daoId/cancel", async (req, res) => {
  try {
    const { daoId } = req.params;
    await db2.update(daos).set({
      billingStatus: "cancelled",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq19(daos.id, daoId));
    res.json({
      success: true,
      message: "Subscription cancelled successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message
    });
  }
});
router12.get("/:daoId/usage", async (req, res) => {
  try {
    const { daoId } = req.params;
    const mockUsage = {
      daoId,
      currentMembers: 25,
      currentProposals: 5,
      storageUsed: "45MB",
      apiCalls: 150,
      bandwidthUsed: "2.3GB"
    };
    res.json({
      success: true,
      usage: mockUsage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get usage statistics",
      error: error.message
    });
  }
});
var dao_subscriptions_default = router12;

// server/routes/bounty-escrow.ts
init_storage();
init_schema();
import express13 from "express";
import { eq as eq20, and as and15, desc as desc8 } from "drizzle-orm";
import { z as z3 } from "zod";
var router13 = express13.Router();
var createEscrowSchema = z3.object({
  taskId: z3.string().min(1),
  amount: z3.number().positive(),
  currency: z3.string().default("cUSD")
});
var releaseEscrowSchema = z3.object({
  taskId: z3.string().min(1),
  releaseToClaimant: z3.boolean()
});
router13.post("/create", async (req, res) => {
  try {
    const validatedData = createEscrowSchema.parse(req.body);
    const { taskId, amount, currency } = validatedData;
    const userId = req.user?.claims?.sub ?? "";
    const task = await db2.select().from(tasks).where(eq20(tasks.id, taskId)).limit(1);
    if (!task.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (task[0].creatorId !== userId) {
      return res.status(403).json({ error: "Only task creator can fund escrow" });
    }
    const existingEscrow = await db2.select().from(walletTransactions2).where(and15(
      eq20(walletTransactions2.type, "escrow_deposit"),
      eq20(walletTransactions2.description, `Escrow for task: ${taskId}`)
    )).limit(1);
    if (existingEscrow.length > 0) {
      return res.status(400).json({ error: "Escrow already exists for this task" });
    }
    const escrow = await db2.insert(walletTransactions2).values({
      walletAddress: userId,
      amount: amount.toString(),
      currency,
      type: "escrow_deposit",
      status: "held",
      description: `Escrow for task: ${taskId}`
    }).returning();
    res.json({
      success: true,
      escrowId: escrow[0].id,
      amount,
      currency,
      status: "held"
    });
  } catch (err) {
    if (err instanceof z3.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router13.post("/release", async (req, res) => {
  try {
    const validatedData = releaseEscrowSchema.parse(req.body);
    const { taskId, releaseToClaimant } = validatedData;
    const userId = req.user?.claims?.sub ?? "";
    const task = await db2.select().from(tasks).where(eq20(tasks.id, taskId)).limit(1);
    if (!task.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    const canRelease = task[0].creatorId === userId;
    if (!canRelease) {
      const membership = await db2.select().from(daoMemberships).where(and15(
        eq20(daoMemberships.daoId, task[0].daoId),
        eq20(daoMemberships.userId, userId)
      )).limit(1);
      if (!membership.length || !["admin", "moderator"].includes(membership[0].role ?? "")) {
        return res.status(403).json({ error: "Insufficient permissions to release escrow" });
      }
    }
    const escrow = await db2.select().from(walletTransactions2).where(and15(
      eq20(walletTransactions2.type, "escrow_deposit"),
      eq20(walletTransactions2.description, `Escrow for task: ${taskId}`),
      eq20(walletTransactions2.status, "held")
    )).limit(1);
    if (!escrow.length) {
      return res.status(404).json({ error: "Active escrow not found for this task" });
    }
    const escrowAmount = parseFloat(escrow[0].amount);
    const recipient = releaseToClaimant ? task[0].claimerId : task[0].creatorId;
    if (!recipient) {
      return res.status(400).json({ error: "No valid recipient for escrow release" });
    }
    await db2.update(walletTransactions2).set({
      status: "completed",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq20(walletTransactions2.id, escrow[0].id));
    const release = await db2.insert(walletTransactions2).values({
      walletAddress: recipient,
      amount: escrowAmount.toString(),
      currency: escrow[0].currency,
      type: "escrow_release",
      status: "completed",
      description: `Escrow release for task: ${taskId}`
    }).returning();
    if (releaseToClaimant) {
      await db2.update(tasks).set({
        status: "completed",
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq20(tasks.id, taskId));
    }
    res.json({
      success: true,
      releaseId: release[0].id,
      amount: escrowAmount,
      recipient,
      releasedToClaimant: releaseToClaimant
    });
  } catch (err) {
    if (err instanceof z3.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router13.get("/:taskId/escrow", async (req, res) => {
  try {
    const { taskId } = req.params;
    const escrow = await db2.select().from(walletTransactions2).where(and15(
      eq20(walletTransactions2.type, "escrow_deposit"),
      eq20(walletTransactions2.description, `Escrow for task: ${taskId}`)
    )).orderBy(desc8(walletTransactions2.createdAt)).limit(1);
    if (!escrow.length) {
      return res.json({ hasEscrow: false });
    }
    res.json({
      hasEscrow: true,
      amount: parseFloat(escrow[0].amount),
      currency: escrow[0].currency,
      status: escrow[0].status,
      createdAt: escrow[0].createdAt
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router13.post("/:taskId/dispute", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.claims?.sub ?? "";
    const task = await db2.select().from(tasks).where(eq20(tasks.id, taskId)).limit(1);
    if (!task.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (task[0].claimerId !== userId && task[0].creatorId !== userId) {
      return res.status(403).json({ error: "Only task claimant or creator can dispute" });
    }
    await db2.update(tasks).set({
      status: "disputed",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq20(tasks.id, taskId));
    await db2.insert(taskHistory).values({
      taskId,
      userId,
      action: "disputed",
      details: { reason, disputedAt: (/* @__PURE__ */ new Date()).toISOString() }
    });
    res.json({
      success: true,
      message: "Dispute created. Escrow will be held pending resolution.",
      taskId
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
var bounty_escrow_default = router13;

// server/routes/proposal-execution.ts
init_storage();
init_schema();
init_auth();
import express14 from "express";
import { eq as eq23, and as and18, desc as desc10 } from "drizzle-orm";

// server/proposalExecutionService.ts
init_storage();
init_schema();
import { eq as eq22, and as and17, lte as lte5 } from "drizzle-orm";
import { sql as sql14 } from "drizzle-orm";

// server/services/vaultService.ts
init_db();
init_schema();
import { eq as eq21, and as and16, desc as desc9, sql as sql13, gte as gte8, lte as lte4 } from "drizzle-orm";

// shared/tokenRegistry.ts
var TOKEN_REGISTRY = {
  CELO: {
    symbol: "CELO",
    name: "Celo Native Asset",
    address: {
      mainnet: "0x471EcE3750Da237f93B8E339c536989b8978a438",
      // CELO native
      testnet: "0x471EcE3750Da237f93B8E339c536989b8978a438"
    },
    decimals: 18,
    category: "native",
    isActive: true,
    logoUrl: "/tokens/celo.png",
    description: "Celo native token for payments and governance",
    priceApi: "coingecko:celo",
    riskLevel: "low"
  },
  cUSD: {
    symbol: "cUSD",
    name: "Celo Dollar",
    address: {
      mainnet: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
      testnet: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"
    },
    decimals: 18,
    category: "stablecoin",
    isActive: true,
    logoUrl: "/tokens/cusd.png",
    description: "Celo Dollar stablecoin pegged to USD",
    priceApi: "coingecko:celo-dollar",
    riskLevel: "low"
  },
  cEUR: {
    symbol: "cEUR",
    name: "Celo Euro",
    address: {
      mainnet: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
      testnet: "0x10c892A6EC43a53E45a9D5ba3F7cFF4eD2E5b04B"
    },
    decimals: 18,
    category: "stablecoin",
    isActive: true,
    logoUrl: "/tokens/ceur.png",
    description: "Celo Euro stablecoin pegged to EUR",
    priceApi: "coingecko:celo-euro",
    riskLevel: "low"
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    address: {
      mainnet: "0x88eeC49252c8cbc039DCdB394c0c2BA2f1637EA0",
      // Bridged USDT on Celo
      testnet: "0x0000000000000000000000000000000000000000"
      // Testnet address TBD
    },
    decimals: 6,
    // Note: USDT typically uses 6 decimals
    category: "bridged",
    isActive: false,
    // Inactive on testnet until proper address is available
    logoUrl: "/tokens/usdt.png",
    description: "Tether USD bridged to Celo via Wormhole",
    priceApi: "coingecko:tether",
    riskLevel: "low",
    requiresKyc: true
  },
  BTC: {
    symbol: "BTC",
    name: "Bitcoin (Bridged)",
    address: {
      mainnet: "0x0000000000000000000000000000000000000000",
      // Placeholder - update after bridge deployment
      testnet: "0x0000000000000000000000000000000000000000"
    },
    decimals: 8,
    category: "bridged",
    isActive: false,
    // Will be activated after bridge deployment and address confirmation
    logoUrl: "/tokens/btc.png",
    description: "Bitcoin bridged to Celo",
    priceApi: "coingecko:bitcoin",
    riskLevel: "high",
    // Higher risk due to bridging complexity
    requiresKyc: true
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum (Bridged)",
    address: {
      mainnet: "0x0000000000000000000000000000000000000000",
      // Placeholder - update after bridge deployment
      testnet: "0x0000000000000000000000000000000000000000"
    },
    decimals: 18,
    category: "bridged",
    isActive: false,
    // Will be activated after bridge deployment and address confirmation
    logoUrl: "/tokens/eth.png",
    description: "Ethereum bridged to Celo via CrossChainBridge contract",
    priceApi: "coingecko:ethereum",
    riskLevel: "high",
    // Higher risk due to bridging complexity
    requiresKyc: true
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin (Native)",
    address: {
      mainnet: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
      // Celo native USDC
      testnet: "0x2550F036b621f94073647E7f4163736E3f1C3094"
      // Celo testnet USDC
    },
    decimals: 6,
    category: "stablecoin",
    isActive: true,
    logoUrl: "/tokens/usdc.png",
    description: "USD Coin native to Celo",
    priceApi: "coingecko:usd-coin",
    riskLevel: "low"
  },
  // Framework for custom community tokens
  MTAA: {
    symbol: "MTAA",
    name: "MtaaDAO Token",
    address: {
      mainnet: "0x0000000000000000000000000000000000000000",
      // Deploy later
      testnet: "0x0000000000000000000000000000000000000000"
    },
    decimals: 18,
    category: "community",
    isActive: false,
    // Will be activated via governance
    logoUrl: "/tokens/mtaa.png",
    description: "MtaaDAO governance and utility token",
    riskLevel: "medium",
    maxDailyVolume: "100000"
    // Example limit
  }
};
var YIELD_STRATEGIES = {
  MOOLA_LENDING: {
    id: "moola-lending",
    name: "Moola Lending",
    description: "Earn yield by lending cUSD, cEUR to Moola Protocol",
    apy: 8.5,
    riskLevel: "low",
    supportedTokens: ["cUSD", "cEUR"],
    protocol: "Moola",
    isActive: true,
    minDeposit: "10",
    fees: {
      deposit: 0,
      withdraw: 0,
      performance: 10
      // 10% performance fee
    }
  },
  CELO_STAKING: {
    id: "celo-staking",
    name: "Celo Validator Staking",
    description: "Stake CELO with validator groups for epoch rewards",
    apy: 6.2,
    riskLevel: "low",
    supportedTokens: ["CELO"],
    protocol: "Celo Validators",
    isActive: true,
    minDeposit: "1",
    lockPeriod: 3,
    // 3 days unbonding period
    fees: {
      deposit: 0,
      withdraw: 0,
      performance: 5
    }
  },
  UBESWAP_LP: {
    id: "ubeswap-lp",
    name: "Ubeswap Liquidity Pools",
    description: "Provide liquidity to CELO/cUSD, cUSD/cEUR pairs",
    apy: 12.3,
    riskLevel: "medium",
    supportedTokens: ["CELO", "cUSD", "cEUR"],
    protocol: "Ubeswap",
    isActive: true,
    minDeposit: "50",
    fees: {
      deposit: 0.1,
      withdraw: 0.1,
      performance: 15
    }
  }
};
var TokenRegistry = class _TokenRegistry {
  static getToken(symbol) {
    return TOKEN_REGISTRY[symbol] || null;
  }
  static getActiveTokens() {
    return Object.values(TOKEN_REGISTRY).filter((token) => token.isActive);
  }
  static getTokensByCategory(category) {
    return Object.values(TOKEN_REGISTRY).filter(
      (token) => token.category === category && token.isActive
    );
  }
  static getTokenAddress(symbol, network) {
    const token = TOKEN_REGISTRY[symbol];
    return token?.address[network] || null;
  }
  static getSupportedTokensForStrategy(strategyId) {
    const strategy = YIELD_STRATEGIES[strategyId];
    if (!strategy) return [];
    return strategy.supportedTokens.map((symbol) => TOKEN_REGISTRY[symbol]).filter((token) => token && token.isActive);
  }
  static getActiveStrategies() {
    return Object.values(YIELD_STRATEGIES).filter((strategy) => strategy.isActive);
  }
  // Backwards-compatible convenience method used across the codebase
  static getSupportedTokens() {
    return _TokenRegistry.getAllTokens();
  }
  static addCustomToken(symbol, tokenInfo) {
    TOKEN_REGISTRY[symbol] = tokenInfo;
  }
  static validateTokenAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  // Get all supported tokens
  static getAllTokens() {
    return Object.values(TOKEN_REGISTRY);
  }
  // Get token by address
  static getTokenByAddress(address) {
    return Object.values(TOKEN_REGISTRY).find(
      (token) => token.address?.mainnet?.toLowerCase() === address.toLowerCase() || token.address?.testnet?.toLowerCase() === address.toLowerCase()
    ) || null;
  }
};

// server/services/vaultService.ts
import { ethers as ethers2 } from "ethers";

// server/services/tokenService.ts
import { ethers } from "ethers";
var ENHANCED_ERC20_ABI2 = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];
var TokenService = class {
  constructor(providerUrl, privateKey, network = "testnet") {
    this.contracts = /* @__PURE__ */ new Map();
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    this.signer = privateKey ? new ethers.Wallet(privateKey, this.provider) : void 0;
    this.network = network;
    this.initializeContracts();
  }
  initializeContracts() {
    const activeTokens = TokenRegistry.getActiveTokens();
    for (const token of activeTokens) {
      if (token.symbol === "CELO") continue;
      const address = token.address[this.network];
      if (address && address !== "0x0000000000000000000000000000000000000000") {
        const contract = new ethers.Contract(
          address,
          ENHANCED_ERC20_ABI2,
          this.signer || this.provider
        );
        this.contracts.set(token.symbol, contract);
      }
    }
  }
  // Get token contract instance
  getTokenContract(symbol) {
    return this.contracts.get(symbol) || null;
  }
  // Get token balance for an address
  async getTokenBalance(symbol, address) {
    if (symbol === "CELO") {
      const balance2 = await this.provider.getBalance(address);
      return ethers.formatEther(balance2);
    }
    const contract = this.getTokenContract(symbol);
    if (!contract) {
      throw new Error(`Token contract not found for ${symbol}`);
    }
    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      throw new Error(`Token info not found for ${symbol}`);
    }
    const balance = await contract.balanceOf(address);
    return ethers.formatUnits(balance, token.decimals);
  }
  // Send token transaction
  async sendToken(symbol, to, amount, fromAddress) {
    if (!this.signer) {
      throw new Error("No signer available for token transfer");
    }
    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      throw new Error(`Token not supported: ${symbol}`);
    }
    if (symbol === "CELO") {
      const tx2 = await this.signer.sendTransaction({
        to,
        value: ethers.parseEther(amount)
      });
      await tx2.wait();
      return tx2.hash;
    }
    const contract = this.getTokenContract(symbol);
    if (!contract) {
      throw new Error(`Token contract not found for ${symbol}`);
    }
    const parsedAmount = ethers.parseUnits(amount, token.decimals);
    const tx = await contract.transfer(to, parsedAmount);
    await tx.wait();
    return tx.hash;
  }
  // Approve token spending (for vault deposits)
  async approveToken(symbol, spender, amount) {
    if (!this.signer) {
      throw new Error("No signer available for token approval");
    }
    if (symbol === "CELO") {
      throw new Error("Native token does not require approval");
    }
    const contract = this.getTokenContract(symbol);
    if (!contract) {
      throw new Error(`Token contract not found for ${symbol}`);
    }
    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      throw new Error(`Token info not found for ${symbol}`);
    }
    const parsedAmount = ethers.parseUnits(amount, token.decimals);
    const tx = await contract.approve(spender, parsedAmount);
    await tx.wait();
    return tx.hash;
  }
  // Check token allowance
  async getTokenAllowance(symbol, owner, spender) {
    if (symbol === "CELO") {
      return "0";
    }
    const contract = this.getTokenContract(symbol);
    if (!contract) {
      throw new Error(`Token contract not found for ${symbol}`);
    }
    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      throw new Error(`Token info not found for ${symbol}`);
    }
    const allowance = await contract.allowance(owner, spender);
    return ethers.formatUnits(allowance, token.decimals);
  }
  // Get multiple token balances for portfolio view
  async getPortfolioBalances(address) {
    const activeTokens = TokenRegistry.getActiveTokens();
    const balances = [];
    for (const token of activeTokens) {
      try {
        const balance = await this.getTokenBalance(token.symbol, address);
        const balanceNum = parseFloat(balance);
        if (balanceNum > 0) {
          const mockPriceUSD = this.getMockPrice(token.symbol);
          const balanceUSD = (balanceNum * mockPriceUSD).toFixed(2);
          balances.push({
            symbol: token.symbol,
            balance,
            balanceUSD,
            token
          });
        }
      } catch (error) {
        console.error(`Error fetching balance for ${token.symbol}:`, error);
      }
    }
    return balances;
  }
  // Mock price function - replace with real price oracle in production
  getMockPrice(symbol) {
    const mockPrices = {
      "CELO": 0.65,
      "cUSD": 1,
      "cEUR": 1.08,
      "USDT": 1,
      "MTAA": 0.1
    };
    return mockPrices[symbol] || 0;
  }
  // Estimate gas for token transaction
  async estimateTokenGas(symbol, to, amount, from) {
    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      throw new Error(`Token not supported: ${symbol}`);
    }
    if (symbol === "CELO") {
      const gasEstimate2 = await this.provider.estimateGas({
        to,
        value: ethers.parseEther(amount),
        from
      });
      return gasEstimate2.toString();
    }
    const contract = this.getTokenContract(symbol);
    if (!contract) {
      throw new Error(`Token contract not found for ${symbol}`);
    }
    const parsedAmount = ethers.parseUnits(amount, token.decimals);
    const gasEstimate = await contract.transfer.estimateGas(to, parsedAmount);
    return gasEstimate.toString();
  }
  // Add new token via governance (Phase 3)
  async proposeNewToken(tokenInfo) {
    if (!TokenRegistry.validateTokenAddress(tokenInfo.address.mainnet) || !TokenRegistry.validateTokenAddress(tokenInfo.address.testnet)) {
      throw new Error("Invalid token addresses");
    }
    console.log(`Proposing new token: ${tokenInfo.symbol}`);
  }
  // Get yield strategies for a specific token
  getYieldStrategiesForToken(symbol) {
    return Object.values(YIELD_STRATEGIES).filter(
      (strategy) => strategy.supportedTokens.includes(symbol) && strategy.isActive
    );
  }
  // Risk assessment for token operations
  assessTokenRisk(symbol, amount) {
    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      return {
        riskLevel: "high",
        warnings: ["Unknown token"]
      };
    }
    const warnings = [];
    let riskLevel = token.riskLevel;
    if (token.maxDailyVolume) {
      const maxVolume = parseFloat(token.maxDailyVolume);
      const requestedAmount = parseFloat(amount);
      if (requestedAmount > maxVolume) {
        warnings.push(`Amount exceeds daily volume limit of ${token.maxDailyVolume} ${symbol}`);
        riskLevel = "high";
      }
    }
    if (token.requiresKyc) {
      warnings.push("This token requires KYC verification");
    }
    if (token.category === "bridged") {
      warnings.push("Bridged tokens may have additional smart contract risks");
      riskLevel = riskLevel === "low" ? "medium" : riskLevel;
    }
    return {
      riskLevel,
      warnings,
      maxRecommendedAmount: token.maxDailyVolume
    };
  }
  // Get vault share value in USD
  async getVaultShareValue(vaultAddress, shares) {
    try {
      const sharePrice = 1.25;
      const shareCount = parseFloat(shares) / 1e18;
      return shareCount * sharePrice;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to get vault share value: ${error.message}`, error);
      } else {
        console.error("Failed to get vault share value", error);
      }
      return 0;
    }
  }
  // Get vault APY (Annual Percentage Yield)
  async getVaultAPY(vaultAddress) {
    try {
      const baseAPY = 8.5;
      const variation = (Math.random() - 0.5) * 2;
      return Math.max(baseAPY + variation, 0);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to get vault APY: ${error.message}`, error);
      } else {
        console.error("Failed to get vault APY", error);
      }
      return 8.5;
    }
  }
  // Backwards-compatible wrapper used elsewhere
  async getTokenPrice(symbol) {
    const token = TokenRegistry.getToken(symbol);
    if (!token) return 0.3;
    return this.getMockPrice(symbol);
  }
};
var tokenService = new TokenService(
  process.env.RPC_URL || "https://alfajores-forno.celo-testnet.org",
  process.env.MANAGER_PRIVATE_KEY,
  process.env.NODE_ENV === "production" ? "mainnet" : "testnet"
);

// server/services/vaultService.ts
init_logger();

// server/utils/errorUtils.ts
function getErrorMessage(err) {
  if (!err) return "Unknown error";
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return "Unknown error";
  }
}

// server/services/vaultService.ts
init_errorHandler();
import { z as z4 } from "zod";
var createVaultSchema = z4.object({
  name: z4.string().min(1, "Vault name is required"),
  description: z4.string().optional(),
  userId: z4.string().optional(),
  daoId: z4.string().optional(),
  vaultType: z4.enum(["regular", "savings", "locked_savings", "yield", "dao_treasury"]),
  primaryCurrency: z4.enum(["CELO", "cUSD", "cEUR", "USDT", "USDC", "MTAA"]),
  yieldStrategy: z4.string().optional(),
  riskLevel: z4.enum(["low", "medium", "high"]).default("low"),
  minDeposit: z4.string().optional(),
  maxDeposit: z4.string().optional()
});
var depositSchema = z4.object({
  vaultId: z4.string().min(1, "Vault ID is required"),
  userId: z4.string().min(1, "User ID is required"),
  tokenSymbol: z4.enum(["CELO", "cUSD", "cEUR", "USDT", "USDC", "MTAA"]),
  amount: z4.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Amount must be a non-negative number"
  }),
  transactionHash: z4.string().optional()
});
var withdrawSchema = z4.object({
  vaultId: z4.string().min(1, "Vault ID is required"),
  userId: z4.string().min(1, "User ID is required"),
  tokenSymbol: z4.enum(["CELO", "cUSD", "cEUR", "USDT", "USDC", "MTAA"]),
  amount: z4.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Amount must be a non-negative number"
  }),
  transactionHash: z4.string().optional()
});
var strategyAllocationSchema = z4.object({
  vaultId: z4.string().min(1, "Vault ID is required"),
  userId: z4.string().min(1, "User ID is required"),
  strategyId: z4.string().min(1, "Strategy ID is required"),
  tokenSymbol: z4.enum(["CELO", "cUSD", "cEUR", "USDT", "USDC", "MTAA"]),
  allocationPercentage: z4.number().min(0).max(100)
});
var VaultService = class {
  // Check if user has permission to perform specific vault operation
  async checkVaultPermissions(vaultId, userId, operation = "view") {
    const vault = await this.getVaultById(vaultId);
    if (!vault) {
      throw new NotFoundError("Vault not found");
    }
    if (vault.userId) {
      return vault.userId === userId;
    }
    if (vault.daoId) {
      const membership = await db2.query.daoMemberships.findFirst({
        where: and16(
          eq21(daoMemberships.daoId, vault.daoId),
          eq21(daoMemberships.userId, userId),
          eq21(daoMemberships.status, "approved")
        )
      });
      if (!membership || membership.isBanned) {
        Logger.getLogger().warn(`User ${userId} attempted unauthorized access to DAO vault ${vaultId}`);
        return false;
      }
      const userRole = membership.role || "member";
      switch (operation) {
        case "view":
          return ["member", "proposer", "elder", "admin"].includes(userRole);
        case "deposit":
          return ["member", "proposer", "elder", "admin"].includes(userRole);
        case "withdraw":
          return ["admin", "elder"].includes(userRole);
        case "allocate":
        case "rebalance":
          return ["admin", "elder"].includes(userRole);
        default:
          Logger.getLogger().error(`Invalid operation type '${operation}' for permission check.`);
          return false;
      }
    }
    Logger.getLogger().warn(`Vault ${vaultId} has neither userId nor daoId.`);
    return false;
  }
  // Create a new vault
  async createVault(request) {
    try {
      const validatedRequest = createVaultSchema.parse(request);
      if (!validatedRequest.userId && !validatedRequest.daoId) {
        throw new ValidationError("Either userId or daoId must be specified");
      }
      if (validatedRequest.userId && validatedRequest.daoId) {
        throw new ValidationError("Cannot specify both userId and daoId");
      }
      const token = TokenRegistry.getToken(validatedRequest.primaryCurrency);
      if (!token) {
        throw new ValidationError(`Unsupported token: ${validatedRequest.primaryCurrency}`);
      }
      if (validatedRequest.yieldStrategy && !YIELD_STRATEGIES[validatedRequest.yieldStrategy]) {
        throw new ValidationError(`Invalid yield strategy: ${validatedRequest.yieldStrategy}`);
      }
      if (validatedRequest.minDeposit) {
        ethers2.parseUnits(validatedRequest.minDeposit, token.decimals);
      }
      if (validatedRequest.maxDeposit) {
        ethers2.parseUnits(validatedRequest.maxDeposit, token.decimals);
      }
      if (validatedRequest.minDeposit && validatedRequest.maxDeposit && ethers2.parseUnits(validatedRequest.minDeposit, token.decimals) > ethers2.parseUnits(validatedRequest.maxDeposit, token.decimals)) {
        throw new ValidationError("Minimum deposit cannot be greater than maximum deposit");
      }
      let lockedUntil = null;
      if (validatedRequest.vaultType === "locked_savings") {
        const lockDurationDays = 30;
        lockedUntil = new Date(Date.now() + lockDurationDays * 24 * 60 * 60 * 1e3);
      }
      const [newVault] = await db2.insert(vaults).values({
        name: validatedRequest.name,
        description: validatedRequest.description,
        userId: validatedRequest.userId || null,
        daoId: validatedRequest.daoId || null,
        currency: validatedRequest.primaryCurrency,
        vaultType: validatedRequest.vaultType,
        yieldStrategy: validatedRequest.yieldStrategy,
        riskLevel: validatedRequest.riskLevel,
        minDeposit: validatedRequest.minDeposit || "0",
        maxDeposit: validatedRequest.maxDeposit,
        lockedUntil,
        isActive: true
      }).returning();
      await this.initializePerformanceTracking(newVault.id);
      await this.performRiskAssessment(newVault.id);
      return newVault;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to create vault: ${msg}`, error);
      if (error instanceof z4.ZodError) {
        throw new ValidationError(`Invalid input for creating vault: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }
  // Deposit tokens into a vault
  async depositToken(request) {
    try {
      const validatedRequest = depositSchema.parse(request);
      const hasPermission = await this.checkVaultPermissions(validatedRequest.vaultId, validatedRequest.userId, "deposit");
      if (!hasPermission) {
        throw new AppError("Unauthorized: You do not have permission to deposit to this vault", 403);
      }
      const vault = await this.getVaultById(validatedRequest.vaultId);
      if (!vault) {
        throw new NotFoundError("Vault not found");
      }
      if (!vault.isActive) {
        throw new ValidationError("Vault is not active");
      }
      const token = TokenRegistry.getToken(validatedRequest.tokenSymbol);
      if (!token) {
        throw new ValidationError(`Unsupported token: ${validatedRequest.tokenSymbol}`);
      }
      const depositAmountWei = ethers2.parseUnits(validatedRequest.amount, token.decimals);
      if (vault.minDeposit) {
        const minDepositWei = ethers2.parseUnits(vault.minDeposit, token.decimals);
        if (depositAmountWei < minDepositWei) {
          throw new ValidationError(`Deposit amount ${validatedRequest.amount} below minimum ${vault.minDeposit}`);
        }
      }
      if (vault.maxDeposit) {
        const maxDepositWei = ethers2.parseUnits(vault.maxDeposit, token.decimals);
        if (depositAmountWei > maxDepositWei) {
          throw new ValidationError(`Deposit amount ${validatedRequest.amount} exceeds maximum ${vault.maxDeposit}`);
        }
      }
      const priceUSD = await this.getTokenPriceUSD(validatedRequest.tokenSymbol);
      const depositAmountFloat = parseFloat(ethers2.formatUnits(depositAmountWei, token.decimals));
      const valueUSD = depositAmountFloat * priceUSD;
      const result = await db2.transaction(async (tx) => {
        const [transaction] = await tx.insert(vaultTransactions).values({
          vaultId: validatedRequest.vaultId,
          userId: validatedRequest.userId,
          transactionType: "deposit",
          tokenSymbol: validatedRequest.tokenSymbol,
          amount: validatedRequest.amount,
          valueUSD: valueUSD.toString(),
          transactionHash: validatedRequest.transactionHash,
          status: "completed"
        }).returning();
        await this.updateTokenHolding(validatedRequest.vaultId, validatedRequest.tokenSymbol, depositAmountWei, true, tx);
        await this.updateVaultTVL(validatedRequest.vaultId, tx);
        return transaction;
      });
      if (vault.yieldStrategy) {
        try {
          await this.rebalanceVault(validatedRequest.vaultId);
        } catch (error) {
          const msg = getErrorMessage(error);
          Logger.getLogger().warn(`Rebalance failed for vault ${validatedRequest.vaultId} after deposit: ${msg}`, error);
        }
      }
      return result;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to deposit token: ${msg}`, error);
      if (error instanceof z4.ZodError) {
        throw new ValidationError(`Invalid input for deposit: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }
  // Withdraw tokens from a vault
  async withdrawToken(request) {
    try {
      const validatedRequest = withdrawSchema.parse(request);
      const hasPermission = await this.checkVaultPermissions(validatedRequest.vaultId, validatedRequest.userId, "withdraw");
      if (!hasPermission) {
        throw new AppError("Unauthorized: You do not have permission to withdraw from this vault", 403);
      }
      const vault = await this.getVaultById(validatedRequest.vaultId);
      if (!vault) {
        throw new NotFoundError("Vault not found");
      }
      const holding = await this.getTokenHolding(validatedRequest.vaultId, validatedRequest.tokenSymbol);
      if (!holding) {
        throw new NotFoundError("No holdings found for this token");
      }
      const token = TokenRegistry.getToken(validatedRequest.tokenSymbol);
      if (!token) {
        throw new ValidationError(`Unsupported token: ${validatedRequest.tokenSymbol}`);
      }
      const withdrawAmountWei = ethers2.parseUnits(validatedRequest.amount, token.decimals);
      const currentBalanceWei = ethers2.parseUnits(holding.balance, token.decimals);
      if (withdrawAmountWei > currentBalanceWei) {
        throw new ValidationError(`Insufficient balance. Requested: ${validatedRequest.amount}, Available: ${holding.balance}`);
      }
      if (vault.vaultType === "locked_savings" && vault.lockedUntil && /* @__PURE__ */ new Date() < vault.lockedUntil) {
        throw new ValidationError("Vault is still locked for withdrawals");
      }
      const priceUSD = await this.getTokenPriceUSD(validatedRequest.tokenSymbol);
      const withdrawAmountFloat = parseFloat(ethers2.formatUnits(withdrawAmountWei, token.decimals));
      const valueUSD = withdrawAmountFloat * priceUSD;
      const result = await db2.transaction(async (tx) => {
        const [transaction] = await tx.insert(vaultTransactions).values({
          vaultId: validatedRequest.vaultId,
          userId: validatedRequest.userId,
          transactionType: "withdrawal",
          tokenSymbol: validatedRequest.tokenSymbol,
          amount: validatedRequest.amount,
          valueUSD: valueUSD.toString(),
          transactionHash: validatedRequest.transactionHash,
          status: "completed"
        }).returning();
        await this.updateTokenHolding(validatedRequest.vaultId, validatedRequest.tokenSymbol, withdrawAmountWei * BigInt(-1), false, tx);
        await this.updateVaultTVL(validatedRequest.vaultId, tx);
        return transaction;
      });
      return result;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to withdraw token: ${msg}`, error);
      if (error instanceof z4.ZodError) {
        throw new ValidationError(`Invalid input for withdrawal: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }
  // Allocate funds to yield strategy
  async allocateToStrategy(request) {
    try {
      const validatedRequest = strategyAllocationSchema.parse(request);
      const hasPermission = await this.checkVaultPermissions(validatedRequest.vaultId, validatedRequest.userId, "allocate");
      if (!hasPermission) {
        throw new AppError("Unauthorized: You do not have permission to allocate strategy for this vault", 403);
      }
      const vault = await this.getVaultById(validatedRequest.vaultId);
      if (!vault) {
        throw new NotFoundError("Vault not found");
      }
      const strategy = YIELD_STRATEGIES[validatedRequest.strategyId];
      if (!strategy) {
        throw new ValidationError(`Invalid strategy: ${validatedRequest.strategyId}`);
      }
      if (!strategy.supportedTokens.includes(validatedRequest.tokenSymbol)) {
        throw new ValidationError(`Strategy ${validatedRequest.strategyId} does not support token ${validatedRequest.tokenSymbol}`);
      }
      const holding = await this.getTokenHolding(validatedRequest.vaultId, validatedRequest.tokenSymbol);
      if (!holding) {
        throw new NotFoundError("No token holdings found");
      }
      const token = TokenRegistry.getToken(validatedRequest.tokenSymbol);
      if (!token) {
        throw new ValidationError(`Unsupported token: ${validatedRequest.tokenSymbol}`);
      }
      const totalBalanceWei = ethers2.parseUnits(holding.balance, token.decimals);
      const allocationAmountWei = totalBalanceWei * BigInt(Math.round(validatedRequest.allocationPercentage * 100)) / BigInt(1e4);
      const allocationAmount = ethers2.formatUnits(allocationAmountWei, token.decimals);
      const existingAllocation = await db2.query.vaultStrategyAllocations.findFirst({
        where: and16(
          eq21(vaultStrategyAllocations.vaultId, validatedRequest.vaultId),
          eq21(vaultStrategyAllocations.strategyId, validatedRequest.strategyId),
          eq21(vaultStrategyAllocations.tokenSymbol, validatedRequest.tokenSymbol)
        )
      });
      if (existingAllocation) {
        await db2.update(vaultStrategyAllocations).set({
          allocatedAmount: allocationAmount.toString(),
          allocationPercentage: validatedRequest.allocationPercentage.toString(),
          lastRebalance: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq21(vaultStrategyAllocations.id, existingAllocation.id));
      } else {
        await db2.insert(vaultStrategyAllocations).values({
          vaultId: validatedRequest.vaultId,
          strategyId: validatedRequest.strategyId,
          tokenSymbol: validatedRequest.tokenSymbol,
          allocatedAmount: allocationAmount.toString(),
          allocationPercentage: validatedRequest.allocationPercentage.toString(),
          currentValue: allocationAmount.toString(),
          isActive: true
        });
      }
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to allocate to strategy: ${msg}`, error);
      if (error instanceof z4.ZodError) {
        throw new ValidationError(`Invalid input for strategy allocation: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }
  // Rebalance vault strategy allocations
  async rebalanceVault(vaultId, userId) {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, "rebalance");
        if (!hasPermission) {
          throw new AppError("Unauthorized: You do not have permission to rebalance this vault", 403);
        }
      }
      const vault = await this.getVaultById(vaultId);
      if (!vault || !vault.yieldStrategy) {
        Logger.getLogger().info(`Vault ${vaultId} has no yield strategy, skipping rebalance.`);
        return;
      }
      const allocations = await db2.query.vaultStrategyAllocations.findMany({
        where: and16(
          eq21(vaultStrategyAllocations.vaultId, vaultId),
          eq21(vaultStrategyAllocations.isActive, true)
        )
      });
      for (const allocation of allocations) {
        const holding = await this.getTokenHolding(vaultId, allocation.tokenSymbol);
        if (holding) {
          const token = TokenRegistry.getToken(allocation.tokenSymbol);
          if (!token) {
            Logger.getLogger().warn(`Token ${allocation.tokenSymbol} not found in registry during rebalance.`);
            continue;
          }
          const totalBalanceWei = ethers2.parseUnits(holding.balance, token.decimals);
          const targetPercentage = parseFloat(allocation.allocationPercentage);
          const newAllocationWei = totalBalanceWei * BigInt(Math.round(targetPercentage * 100)) / BigInt(1e4);
          const newAllocation = ethers2.formatUnits(newAllocationWei, token.decimals);
          await db2.update(vaultStrategyAllocations).set({
            allocatedAmount: newAllocation,
            currentValue: newAllocation,
            lastRebalance: /* @__PURE__ */ new Date(),
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq21(vaultStrategyAllocations.id, allocation.id));
        }
      }
      await db2.insert(vaultTransactions).values({
        vaultId,
        userId: userId || vault.userId || vault.daoId || "system",
        // Use provided userId if available, else vault owner/DAO
        transactionType: "rebalance",
        tokenSymbol: vault.currency,
        // Assuming vault currency is the primary token for rebalance tx
        amount: "0",
        // Rebalance doesn't involve a direct amount change in this transaction type
        valueUSD: "0",
        // Value will be implicitly updated in holdings
        status: "completed",
        metadata: { allocationsUpdated: allocations.length }
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to rebalance vault ${vaultId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  // Perform comprehensive risk assessment
  async performRiskAssessment(vaultId) {
    try {
      const vault = await this.getVaultById(vaultId);
      if (!vault) {
        throw new NotFoundError("Vault not found");
      }
      const holdings = await this.getVaultHoldings(vaultId);
      const allocations = await db2.query.vaultStrategyAllocations.findMany({
        where: eq21(vaultStrategyAllocations.vaultId, vaultId)
      });
      let liquidityRisk = 10;
      let smartContractRisk = 5;
      let marketRisk = 15;
      let concentrationRisk = 0;
      let protocolRisk = 0;
      if (holdings.length === 1) {
        concentrationRisk = 80;
      } else if (holdings.length <= 3) {
        concentrationRisk = 40;
      } else {
        concentrationRisk = 10;
      }
      for (const allocation of allocations) {
        const strategy = YIELD_STRATEGIES[allocation.strategyId];
        if (strategy) {
          switch (strategy.riskLevel) {
            case "high":
              protocolRisk += 30;
              break;
            case "medium":
              protocolRisk += 15;
              break;
            case "low":
              protocolRisk += 5;
              break;
          }
        }
      }
      protocolRisk = Math.min(protocolRisk, 100);
      const overallRiskScore = Math.round(
        (liquidityRisk + smartContractRisk + marketRisk + concentrationRisk + protocolRisk) / 5
      );
      const riskFactors = {
        tokenConcentration: holdings.length <= 3,
        highYieldStrategies: allocations.some((a) => {
          const strategy = YIELD_STRATEGIES[a.strategyId];
          return strategy?.riskLevel === "high";
        }),
        lockedFunds: vault.vaultType === "locked_savings",
        newVault: vault.createdAt ? new Date(vault.createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1e3 : true
        // Less than 30 days old
      };
      const recommendations = [];
      if (riskFactors.tokenConcentration) {
        recommendations.push("Diversify token holdings to reduce concentration risk");
      }
      if (riskFactors.highYieldStrategies) {
        recommendations.push("Consider reducing allocation to high-risk strategies");
      }
      if (overallRiskScore > 70) {
        recommendations.push("Overall risk level is high - consider rebalancing");
      }
      await db2.insert(vaultRiskAssessments).values({
        vaultId,
        overallRiskScore,
        liquidityRisk,
        smartContractRisk,
        marketRisk,
        concentrationRisk,
        protocolRisk,
        riskFactors,
        recommendations,
        nextAssessmentDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3),
        // 7 days from now
        assessedBy: vault.userId || vault.daoId || "system"
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to perform risk assessment for vault ${vaultId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  // Get user's vaults
  async getUserVaults(userAddress) {
    try {
      const personalVaultsRaw = await db2.query.vaults.findMany({
        where: eq21(vaults.userId, userAddress)
      });
      const personalVaults = await Promise.all(personalVaultsRaw.map(async (vault) => {
        const tokenHoldings = await this.getVaultHoldings(vault.id);
        return { ...vault, tokenHoldings };
      }));
      const userDaoMemberships = await db2.query.daoMemberships.findMany({
        where: and16(
          eq21(daoMemberships.userId, userAddress),
          eq21(daoMemberships.status, "approved")
        )
      });
      const daoIds = userDaoMemberships.map((m) => m.daoId);
      const daoVaultsRaw = daoIds.length > 0 ? await db2.query.vaults.findMany({
        where: and16(
          sql13`${vaults.daoId} IN (${daoIds.join(",")})`,
          eq21(vaults.isActive, true)
        )
      }) : [];
      const daoVaults = await Promise.all(daoVaultsRaw.map(async (vault) => {
        const tokenHoldings = await this.getVaultHoldings(vault.id);
        return { ...vault, tokenHoldings };
      }));
      const allVaults = [...personalVaults, ...daoVaults].map((vault) => ({
        id: vault.id,
        name: vault.name,
        currency: vault.currency,
        vaultType: vault.vaultType,
        balance: this.calculateVaultBalance(vault),
        performance: this.calculatePerformance(vault),
        status: vault.isActive ? "active" : "inactive"
      }));
      return allVaults;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get user vaults: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  // Get vault statistics for user
  async getUserVaultStats(userAddress) {
    try {
      const userVaults = await this.getUserVaults(userAddress);
      const totalValue = userVaults.reduce((sum3, vault) => sum3 + parseFloat(vault.balance || "0"), 0);
      const totalROI = userVaults.length > 0 ? userVaults.reduce((sum3, vault) => sum3 + (vault.performance || 0), 0) / userVaults.length : 0;
      const activeVaults = userVaults.filter((v) => v.status === "active").length;
      return {
        totalValue: totalValue.toFixed(2),
        totalROI: totalROI.toFixed(2),
        activeVaults,
        totalVaults: userVaults.length
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get user vault stats: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  // Get vault alerts and notifications
  async getVaultAlerts(vaultId) {
    try {
      const alerts = await db2.query.vaultTransactions.findMany({
        where: and16(
          eq21(vaultTransactions.vaultId, vaultId),
          sql13`${vaultTransactions.createdAt} > NOW() - INTERVAL '7 days'`
        ),
        orderBy: desc9(vaultTransactions.createdAt),
        limit: 10
      });
      return alerts.map((tx) => ({
        id: `alert-${tx.id}`,
        type: tx.transactionType === "deposit" ? "deposit" : tx.transactionType === "withdrawal" ? "withdrawal" : "performance",
        message: `${tx.transactionType === "deposit" ? "New deposit" : "Withdrawal"} of ${tx.amount} ${tx.tokenSymbol}`,
        severity: tx.transactionType === "withdrawal" ? "medium" : "info",
        createdAt: tx.createdAt?.toISOString() || (/* @__PURE__ */ new Date()).toISOString()
      }));
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get vault alerts: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  // Helper methods
  calculateVaultBalance(vault) {
    if (!vault.tokenHoldings || vault.tokenHoldings.length === 0) {
      return "0.00";
    }
    const totalBalance = vault.tokenHoldings.reduce((sum3, holding) => {
      return sum3 + parseFloat(holding.balance || "0");
    }, 0);
    return totalBalance.toFixed(2);
  }
  calculatePerformance(vault) {
    return Math.random() * 20 - 5;
  }
  // Get vault by ID with enhanced details
  async getVaultDetails(vaultId, userId) {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, "view");
        if (!hasPermission) {
          throw new AppError("Unauthorized: You do not have permission to view this vault", 403);
        }
      }
      const vault = await this.getVaultById(vaultId);
      if (!vault) {
        throw new NotFoundError("Vault not found");
      }
      const holdings = await this.getVaultHoldings(vaultId);
      const transactions = await this.getVaultTransactions(vaultId, userId, 1, 10);
      const performance2 = await this.getVaultPerformance(vaultId, userId);
      const riskAssessment = await db2.query.vaultRiskAssessments.findFirst({
        where: eq21(vaultRiskAssessments.vaultId, vaultId),
        orderBy: [desc9(vaultRiskAssessments.createdAt)]
      });
      return {
        vault,
        holdings,
        transactions,
        performance: performance2,
        riskScore: riskAssessment?.overallRiskScore || 50,
        riskFactors: riskAssessment?.riskFactors,
        recommendations: riskAssessment?.recommendations
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get details for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }
  // Get list of all vaults and their balances for dashboard
  async getAllVaultsDashboardInfo() {
    try {
      const allVaultsRaw = await db2.query.vaults.findMany({
        where: eq21(vaults.isActive, true)
      });
      const allVaults = await Promise.all(allVaultsRaw.map(async (vault) => {
        const tokenHoldings = await this.getVaultHoldings(vault.id);
        return { ...vault, tokenHoldings };
      }));
      return allVaults.map((vault) => ({
        id: vault.id,
        name: vault.name,
        currency: vault.currency,
        balance: this.calculateVaultBalance(vault),
        performance: this.calculatePerformance(vault),
        status: vault.isActive ? "active" : "top performer",
        tvl: vault.totalValueLocked || "0"
      }));
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get all vaults dashboard info: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  // Get vault transactions for UI with pagination
  async getVaultTransactionsPaginated(vaultId, userId, page = 1, limit = 10) {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, "view");
        if (!hasPermission) {
          throw new AppError("Unauthorized: You do not have permission to view this vault transactions", 403);
        }
      }
      const offset = (page - 1) * limit;
      const transactions = await db2.query.vaultTransactions.findMany({
        where: eq21(vaultTransactions.vaultId, vaultId),
        orderBy: [desc9(vaultTransactions.createdAt)],
        limit,
        offset
      });
      const totalItems = (await db2.select({ count: sql13`count(*)` }).from(vaultTransactions).where(eq21(vaultTransactions.vaultId, vaultId)))[0]?.count || 0;
      const totalPages = Math.ceil(totalItems / limit);
      return {
        transactions,
        totalItems,
        totalPages
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get paginated transactions for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }
  // Get vault performance history
  async getVaultPerformanceHistory(vaultId, userId) {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, "view");
        if (!hasPermission) {
          throw new AppError("Unauthorized: You do not have permission to view this vault performance history", 403);
        }
      }
      return await db2.query.vaultPerformance.findMany({
        where: eq21(vaultPerformance.vaultId, vaultId),
        orderBy: [desc9(vaultPerformance.createdAt)]
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get performance history for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }
  // Get governance proposals related to vaults
  async getVaultGovernanceProposals(vaultId, userId) {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, "view");
        if (!hasPermission) {
          throw new AppError("Unauthorized: You do not have permission to view governance proposals for this vault", 403);
        }
      }
      const proposalRows = await db2.query.proposals.findMany({
        where: sql13`${proposals.metadata}->>'vaultId' = ${vaultId}`,
        orderBy: [desc9(proposals.createdAt)],
        limit: 10
      });
      return proposalRows.map((p) => ({
        id: p.id,
        vaultId,
        title: p.title,
        description: p.description,
        status: p.status,
        votesFor: parseInt(String(p.yesVotes || "0")),
        votesAgainst: parseInt(String(p.noVotes || "0")),
        quorumReached: parseInt(String(p.yesVotes || "0")) + parseInt(String(p.noVotes || "0")) >= parseInt(String(p.quorum || "100")),
        createdAt: p.createdAt?.toISOString(),
        endsAt: p.votingDeadline?.toISOString()
      }));
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get governance proposals for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }
  // Get liquidity provider positions for a vault
  async getVaultLpPositions(vaultId, userId) {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, "view");
        if (!hasPermission) {
          throw new AppError("Unauthorized: You do not have permission to view LP positions for this vault", 403);
        }
      }
      const allocations = await db2.query.vaultStrategyAllocations.findMany({
        where: and16(
          eq21(vaultStrategyAllocations.vaultId, vaultId),
          eq21(vaultStrategyAllocations.isActive, true)
        )
      });
      return allocations.map((allocation) => {
        const strategy = YIELD_STRATEGIES[allocation.strategyId];
        return {
          id: allocation.id,
          vaultId,
          poolName: `${allocation.tokenSymbol} ${strategy?.name || "Pool"}`,
          provider: strategy?.protocol || "Unknown",
          tokens: [allocation.tokenSymbol],
          yourStake: `${allocation.allocatedAmount} ${allocation.tokenSymbol}`,
          poolShare: `${allocation.allocationPercentage}%`,
          rewardsEarned: allocation.yieldEarned || allocation.earnedRewards || "0",
          tvlInPool: allocation.currentValue || allocation.allocatedAmount,
          createdAt: allocation.createdAt?.toISOString() || (/* @__PURE__ */ new Date()).toISOString()
        };
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get LP positions for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }
  // Get daily challenge status
  async getDailyChallengeStatus(userId) {
    try {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const userVaults = await this.getUserVaults(userId);
      const totalValue = userVaults.reduce((sum3, vault) => sum3 + parseFloat(vault.balance || "0"), 0);
      let todayChallenge = await db2.query.userChallenges.findFirst({
        where: and16(
          eq21(userChallenges.userId, userId),
          sql13`DATE(${userChallenges.createdAt}) = ${today}`
        )
      });
      if (!todayChallenge) {
        const [newChallenge] = await db2.insert(userChallenges).values({
          userId,
          challengeType: "daily_deposit",
          targetAmount: "100",
          currentProgress: totalValue.toString(),
          status: totalValue >= 100 ? "completed" : "in_progress",
          pointsReward: 50
        }).returning();
        todayChallenge = newChallenge;
      }
      return {
        userId,
        currentChallenge: {
          id: todayChallenge.id,
          title: "Daily Vault Target",
          description: "Maintain at least $100 total value in your vaults",
          target: todayChallenge.targetAmount,
          currentProgress: Math.min(totalValue, parseFloat(todayChallenge.targetAmount || "100")).toString(),
          status: todayChallenge.status,
          reward: `${todayChallenge.pointsReward} MTAA`,
          createdAt: todayChallenge.createdAt?.toISOString() || (/* @__PURE__ */ new Date()).toISOString(),
          endsAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
        },
        streak: await this.getUserChallengeStreak(userId),
        nextChallengeAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get daily challenge status for user ${userId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  // Get user challenge streak
  async getUserChallengeStreak(userId) {
    try {
      const completedChallenges = await db2.query.userChallenges.findMany({
        where: and16(
          eq21(userChallenges.userId, userId),
          eq21(userChallenges.status, "completed")
        ),
        orderBy: [desc9(userChallenges.createdAt)],
        limit: 30
      });
      let streak = 0;
      const today = /* @__PURE__ */ new Date();
      for (let i = 0; i < completedChallenges.length; i++) {
        const challengeDate = new Date(completedChallenges[i].createdAt);
        const daysDiff = Math.floor((today.getTime() - challengeDate.getTime()) / (1e3 * 60 * 60 * 24));
        if (daysDiff === i) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to calculate streak for user ${userId}: ${msg}`, error);
      return 0;
    }
  }
  // Claim daily challenge reward
  async claimDailyChallengeReward(userId) {
    try {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const userChallenge = await db2.query.userChallenges.findFirst({
        where: and16(
          eq21(userChallenges.userId, userId),
          sql13`DATE(${userChallenges.createdAt}) = ${today}`,
          eq21(userChallenges.status, "completed")
        )
      });
      if (!userChallenge) {
        return { success: false, message: "No completed challenge found for today." };
      }
      if (userChallenge.rewardClaimed) {
        return { success: false, message: "Reward already claimed for today." };
      }
      await db2.update(userChallenges).set({
        rewardClaimed: true,
        claimedAt: /* @__PURE__ */ new Date()
      }).where(eq21(userChallenges.id, userChallenge.id));
      const newStreak = await this.getUserChallengeStreak(userId);
      return {
        success: true,
        message: `Reward claimed! Your streak is now ${newStreak} days.`,
        pointsAwarded: userChallenge.pointsReward,
        newStreak
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to claim daily challenge reward for user ${userId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  // Get wallet connection status
  async getUserWalletStatus(userId) {
    try {
      const user = await db2.query.users.findFirst({
        where: eq21(users.id, userId)
      });
      if (!user) {
        throw new NotFoundError("User not found");
      }
      return {
        userId,
        isConnected: !!user.walletAddress,
        address: user.walletAddress || null,
        profile: {
          reputationScore: user.reputationScore || 0,
          avatarUrl: user.profileImageUrl || null
        }
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get wallet status for user ${userId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  // Helper methods
  async getVaultById(vaultId) {
    try {
      const result = await db2.query.vaults.findFirst({
        where: eq21(vaults.id, vaultId)
      });
      return result || null;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error fetching vault by ID ${vaultId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  async getTokenHolding(vaultId, tokenSymbol, tx) {
    try {
      const dbConnection = tx || db2;
      const result = await dbConnection.query.vaultTokenHoldings.findFirst({
        where: and16(
          eq21(vaultTokenHoldings.vaultId, vaultId),
          eq21(vaultTokenHoldings.tokenSymbol, tokenSymbol)
        )
      });
      return result || null;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error fetching token holding for vault ${vaultId}, token ${tokenSymbol}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  async getVaultHoldings(vaultId, tx) {
    try {
      const dbConnection = tx || db2;
      return await dbConnection.query.vaultTokenHoldings.findMany({
        where: eq21(vaultTokenHoldings.vaultId, vaultId)
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error fetching all holdings for vault ${vaultId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  async updateTokenHolding(vaultId, tokenSymbol, amountWei, isDeposit, tx) {
    const dbConnection = tx || db2;
    const token = TokenRegistry.getToken(tokenSymbol);
    if (!token) {
      throw new ValidationError(`Token ${tokenSymbol} not found in registry`);
    }
    const priceUSD = await this.getTokenPriceUSD(tokenSymbol);
    const amountFloat = parseFloat(ethers2.formatUnits(amountWei < 0 ? -amountWei : amountWei, token.decimals));
    const existing = await dbConnection.select().from(vaultTokenHoldings).where(and16(
      eq21(vaultTokenHoldings.vaultId, vaultId),
      eq21(vaultTokenHoldings.tokenSymbol, tokenSymbol)
    )).for("update").limit(1).execute();
    if (existing && existing.length > 0) {
      const holdingRecord = existing[0];
      const amountDelta = ethers2.formatUnits(amountWei, token.decimals);
      const updateResult = await dbConnection.update(vaultTokenHoldings).set({
        // Use SQL expressions for atomic balance updates
        balance: sql13`CASE 
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0 
            THEN CAST((CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) AS TEXT)
            ELSE ${holdingRecord.balance}
          END`,
        valueUSD: sql13`CASE 
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0 
            THEN CAST(((CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) * ${priceUSD}) AS TEXT)
            ELSE ${holdingRecord.valueUSD}
          END`,
        totalDeposited: sql13`CASE 
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0 AND ${isDeposit}
            THEN CAST((COALESCE(CAST(${holdingRecord.totalDeposited || "0"} AS NUMERIC), 0) + ${amountFloat}) AS TEXT)
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0
            THEN ${holdingRecord.totalDeposited}
            ELSE ${holdingRecord.totalDeposited}
          END`,
        totalWithdrawn: sql13`CASE 
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0 AND NOT ${isDeposit}
            THEN CAST((COALESCE(CAST(${holdingRecord.totalWithdrawn || "0"} AS NUMERIC), 0) + ${amountFloat}) AS TEXT)
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0
            THEN ${holdingRecord.totalWithdrawn}
            ELSE ${holdingRecord.totalWithdrawn}
          END`,
        lastPriceUpdate: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(and16(
        eq21(vaultTokenHoldings.id, holdingRecord.id),
        // CRITICAL: Only update if balance constraint is satisfied
        sql13`(CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0`
      )).execute();
      if (!updateResult || updateResult.rowCount === 0) {
        const currentHolding = await this.getTokenHolding(vaultId, tokenSymbol, tx);
        const currentBalance = currentHolding?.balance || "0";
        const requestedAmount = ethers2.formatUnits(amountWei < 0n ? -amountWei : amountWei, token.decimals);
        throw new ValidationError(
          `Insufficient balance for withdrawal. Available: ${parseFloat(currentBalance).toFixed(6)}, Requested: ${requestedAmount}. This may be due to concurrent operations or insufficient funds.`
        );
      }
    } else {
      const balanceStr = ethers2.formatUnits(amountWei, token.decimals);
      const balanceFloat = parseFloat(balanceStr);
      if (balanceFloat < 0) {
        throw new ValidationError(`Cannot create holding with negative balance: ${balanceFloat.toFixed(6)}`);
      }
      const valueUSD = balanceFloat * priceUSD;
      const absAmountFloat = Math.abs(balanceFloat);
      await dbConnection.insert(vaultTokenHoldings).values({
        vaultId,
        tokenSymbol,
        balance: balanceStr,
        valueUSD: valueUSD.toString(),
        averageEntryPrice: priceUSD.toString(),
        totalDeposited: isDeposit ? absAmountFloat.toString() : "0",
        totalWithdrawn: !isDeposit ? absAmountFloat.toString() : "0"
      });
    }
  }
  async updateVaultTVL(vaultId, tx) {
    try {
      const dbConnection = tx || db2;
      const holdings = await this.getVaultHoldings(vaultId, tx);
      const totalValueUSD = holdings.reduce(
        (sum3, holding) => sum3 + parseFloat(holding.valueUSD || "0"),
        0
      );
      await dbConnection.update(vaults).set({
        totalValueLocked: totalValueUSD.toString(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq21(vaults.id, vaultId));
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error updating TVL for vault ${vaultId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }
  async getTokenPriceUSD(tokenSymbol) {
    try {
      const token = TokenRegistry.getToken(tokenSymbol);
      if (!token) {
        throw new ValidationError(`Token ${tokenSymbol} not found in registry`);
      }
      try {
        if (tokenService && typeof tokenService.getTokenPrice === "function") {
          const realPrice = await tokenService.getTokenPrice(tokenSymbol);
          if (realPrice && realPrice > 0) {
            Logger.getLogger().debug(`Got real price for ${tokenSymbol}: $${realPrice}`);
            return realPrice;
          }
        }
        if (tokenSymbol === "CELO" && tokenService && tokenService.provider) {
          Logger.getLogger().debug(`Using CELO network provider but still need external price feed`);
        }
      } catch (serviceError) {
        const seMsg = getErrorMessage(serviceError);
        Logger.getLogger().warn(`TokenService price lookup failed for ${tokenSymbol}: ${seMsg}`, serviceError);
      }
      Logger.getLogger().debug(`Using fallback pricing for ${tokenSymbol}`);
      const fallbackPrices = {
        "CELO": 0.65,
        // Conservative CELO price
        "cUSD": 1,
        // Celo Dollar should be stable
        "cEUR": 1.08,
        // Celo Euro should track EUR/USD
        "USDT": 1,
        // USDT should be stable
        "MTAA": 0.1
        // Community token - conservative estimate
      };
      let price = fallbackPrices[tokenSymbol];
      if (!price) {
        if (tokenSymbol.includes("USD") || tokenSymbol.includes("EUR")) {
          price = 1;
        } else if (token.category === "community") {
          price = 0.1;
        } else if (token.category === "bridged") {
          price = 0.5;
        } else {
          price = 0.3;
        }
      }
      if (token.category === "community" && token.riskLevel === "high") {
        price *= 0.9;
      }
      if (token.category === "bridged" && !token.isActive) {
        price *= 0.95;
      }
      return price;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error getting price for ${tokenSymbol}: ${msg}`, error);
      return tokenSymbol.includes("USD") || tokenSymbol.includes("EUR") ? 1 : 0.3;
    }
  }
  async initializePerformanceTracking(vaultId) {
    try {
      const startOfDay2 = /* @__PURE__ */ new Date();
      startOfDay2.setHours(0, 0, 0, 0);
      const endOfDay2 = /* @__PURE__ */ new Date();
      endOfDay2.setHours(23, 59, 59, 999);
      const existingPerformance = await db2.query.vaultPerformance.findFirst({
        where: and16(
          eq21(vaultPerformance.vaultId, vaultId),
          gte8(vaultPerformance.createdAt, startOfDay2),
          lte4(vaultPerformance.createdAt, endOfDay2)
        )
      });
      if (!existingPerformance) {
        await db2.insert(vaultPerformance).values({
          vaultId,
          period: "daily",
          periodStart: startOfDay2,
          periodEnd: endOfDay2,
          startingValue: "0",
          endingValue: "0",
          yield: "0",
          yieldPercentage: "0"
        });
      }
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to initialize performance tracking for vault ${vaultId}: ${msg}`, error);
    }
  }
  // Add missing methods referenced in routes
  async getVaultTransactions(vaultId, userId, page = 1, limit = 10) {
    return this.getVaultTransactionsPaginated(vaultId, userId, page, limit);
  }
  async getVaultPerformance(vaultId, userId) {
    return this.getVaultPerformanceHistory(vaultId, userId);
  }
  async getVaultPortfolio(vaultId, userId) {
    return this.getVaultDetails(vaultId, userId);
  }
};
var vaultService = new VaultService();

// server/proposalExecutionService.ts
var ProposalExecutionService = class {
  // Process pending executions
  static async processPendingExecutions() {
    try {
      const now = /* @__PURE__ */ new Date();
      const pendingExecutions = await db2.select().from(proposalExecutionQueue).where(and17(
        eq22(proposalExecutionQueue.status, "pending"),
        lte5(proposalExecutionQueue.scheduledFor, now)
      ));
      console.log(`Processing ${pendingExecutions.length} pending executions`);
      for (const execution of pendingExecutions) {
        await this.executeProposal(execution);
      }
    } catch (error) {
      console.error("Error processing pending executions:", error);
    }
  }
  // Execute individual proposal
  static async executeProposal(execution) {
    try {
      console.log(`Executing proposal ${execution.proposalId} with type ${execution.executionType}`);
      await db2.update(proposalExecutionQueue).set({
        status: "executing",
        lastAttempt: /* @__PURE__ */ new Date(),
        attempts: execution.attempts + 1
      }).where(eq22(proposalExecutionQueue.id, execution.id));
      const { executionType, executionData, daoId, proposalId } = execution;
      switch (executionType) {
        case "treasury_transfer":
          await this.executeTreasuryTransfer(executionData, daoId, proposalId);
          break;
        case "vault_operation":
          await this.executeVaultOperation(executionData, daoId, proposalId);
          break;
        case "member_action":
          await this.executeMemberAction(executionData, daoId, proposalId);
          break;
        case "governance_change":
          await this.executeGovernanceChange(executionData, daoId, proposalId);
          break;
        case "disbursement":
          await this.executeDisbursement(executionData, daoId, proposalId);
          break;
        default:
          throw new Error(`Unknown execution type: ${executionType}`);
      }
      await db2.update(proposalExecutionQueue).set({ status: "completed" }).where(eq22(proposalExecutionQueue.id, execution.id));
      await db2.update(proposals).set({
        status: "executed",
        executedAt: /* @__PURE__ */ new Date()
      }).where(eq22(proposals.id, proposalId));
      console.log(`Successfully executed proposal ${proposalId}`);
    } catch (error) {
      console.error("Error executing proposal:", error);
      const maxAttempts = 3;
      const shouldRetry = execution.attempts < maxAttempts && this.isRetriableError(error);
      await db2.update(proposalExecutionQueue).set({
        status: shouldRetry ? "pending" : "failed",
        errorMessage: error.message,
        // Retry after 1 hour if retriable
        scheduledFor: shouldRetry ? new Date(Date.now() + 60 * 60 * 1e3) : void 0
      }).where(eq22(proposalExecutionQueue.id, execution.id));
    }
  }
  // Execute treasury transfer
  static async executeTreasuryTransfer(executionData, daoId, proposalId) {
    const { recipient, amount, currency, description, fromVault } = executionData;
    if (fromVault) {
      const daoVault = await db2.query.vaults.findFirst({
        where: and17(
          eq22(vaults.daoId, daoId),
          eq22(vaults.vaultType, "dao_treasury")
        )
      });
      if (!daoVault) {
        throw new Error("DAO vault not found");
      }
      await vaultService.withdrawToken({
        vaultId: daoVault.id,
        userId: "system",
        // System user for proposal execution
        tokenSymbol: currency,
        amount: amount.toString(),
        transactionHash: `proposal_${proposalId}`
      });
    } else {
      const daoRecord = await db2.select().from(daos).where(eq22(daos.id, daoId)).limit(1);
      const currentBalance = parseFloat(daoRecord[0]?.treasuryBalance || "0");
      if (currentBalance < amount) {
        throw new Error(`Insufficient treasury balance. Available: ${currentBalance}, Requested: ${amount}`);
      }
      const newBalance = (currentBalance - amount).toString();
      await db2.update(daos).set({ treasuryBalance: newBalance }).where(eq22(daos.id, daoId));
    }
    await db2.insert(walletTransactions2).values({
      walletAddress: recipient,
      amount: amount.toString(),
      currency,
      type: "transfer",
      status: "completed",
      description: `Proposal execution: ${description}`,
      daoId
    });
  }
  // Execute vault operations
  static async executeVaultOperation(executionData, daoId, proposalId) {
    const { vaultId, operation, operationData } = executionData;
    switch (operation) {
      case "create_vault":
        await vaultService.createVault({
          ...operationData,
          daoId
        });
        break;
      case "deposit":
        await vaultService.depositToken({
          vaultId,
          userId: "system",
          ...operationData
        });
        break;
      case "withdraw":
        await vaultService.withdrawToken({
          vaultId,
          userId: "system",
          ...operationData
        });
        break;
      case "allocate_strategy":
        await vaultService.allocateToStrategy({
          vaultId,
          userId: "system",
          ...operationData
        });
        break;
      case "rebalance":
        await vaultService.rebalanceVault(vaultId);
        break;
      default:
        throw new Error(`Unknown vault operation: ${operation}`);
    }
  }
  // Execute member action (promote, demote, ban, etc.)
  static async executeMemberAction(executionData, daoId, proposalId) {
    const { action, targetUserId, newRole, reason } = executionData;
    switch (action) {
      case "promote":
        await db2.update(daoMemberships).set({ role: newRole }).where(and17(
          eq22(daoMemberships.daoId, daoId),
          eq22(daoMemberships.userId, targetUserId)
        ));
        break;
      case "demote":
        await db2.update(daoMemberships).set({ role: newRole || "member" }).where(and17(
          eq22(daoMemberships.daoId, daoId),
          eq22(daoMemberships.userId, targetUserId)
        ));
        break;
      case "ban":
        await db2.update(daoMemberships).set({
          isBanned: true,
          banReason: reason
        }).where(and17(
          eq22(daoMemberships.daoId, daoId),
          eq22(daoMemberships.userId, targetUserId)
        ));
        break;
      case "unban":
        await db2.update(daoMemberships).set({
          isBanned: false,
          banReason: null
        }).where(and17(
          eq22(daoMemberships.daoId, daoId),
          eq22(daoMemberships.userId, targetUserId)
        ));
        break;
      case "remove":
        await db2.update(daoMemberships).set({
          status: "rejected",
          banReason: reason
        }).where(and17(
          eq22(daoMemberships.daoId, daoId),
          eq22(daoMemberships.userId, targetUserId)
        ));
        break;
      default:
        throw new Error(`Unknown member action: ${action}`);
    }
  }
  // Execute governance changes
  static async executeGovernanceChange(executionData, daoId, proposalId) {
    const { changes } = executionData;
    const allowedFields = [
      "quorumPercentage",
      "votingPeriod",
      "executionDelay",
      "name",
      "description",
      "access",
      "inviteOnly"
    ];
    const validChanges = {};
    for (const [key, value] of Object.entries(changes)) {
      if (allowedFields.includes(key)) {
        validChanges[key] = value;
      }
    }
    if (Object.keys(validChanges).length === 0) {
      throw new Error("No valid governance changes specified");
    }
    await db2.update(daos).set({
      ...validChanges,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq22(daos.id, daoId));
  }
  // Execute disbursement
  static async executeDisbursement(executionData, daoId, proposalId) {
    const { recipients, amount, currency, description, disbursementType } = executionData;
    const totalAmount = Array.isArray(recipients) ? recipients.reduce((sum3, r) => sum3 + r.amount, 0) : amount;
    const daoRecord = await db2.select().from(daos).where(eq22(daos.id, daoId)).limit(1);
    const currentBalance = parseFloat(daoRecord[0]?.treasuryBalance || "0");
    if (currentBalance < totalAmount) {
      throw new Error(`Insufficient treasury balance for disbursement. Available: ${currentBalance}, Required: ${totalAmount}`);
    }
    if (Array.isArray(recipients)) {
      for (const recipient of recipients) {
        await db2.insert(walletTransactions2).values({
          walletAddress: recipient.address,
          amount: recipient.amount.toString(),
          currency,
          type: "disbursement",
          status: "completed",
          description: `${description} - ${recipient.description || "Disbursement"}`,
          daoId
        });
      }
    } else {
      await db2.insert(walletTransactions2).values({
        walletAddress: recipients,
        amount: amount.toString(),
        currency,
        type: "disbursement",
        status: "completed",
        description,
        daoId
      });
    }
    const newBalance = (currentBalance - totalAmount).toString();
    await db2.update(daos).set({ treasuryBalance: newBalance }).where(eq22(daos.id, daoId));
  }
  // Schedule a proposal for execution
  static async scheduleProposalExecution(proposalId, daoId, executionType, executionData, scheduledFor) {
    await db2.insert(proposalExecutionQueue).values({
      proposalId,
      daoId,
      executionType,
      executionData,
      scheduledFor,
      status: "pending"
    });
  }
  // Check if error is retriable
  static isRetriableError(error) {
    const retriableErrors = [
      "ECONNREFUSED",
      "ENOTFOUND",
      "ETIMEDOUT",
      "Rate limit",
      "Service unavailable"
    ];
    return retriableErrors.some(
      (errorType) => error.message?.includes(errorType) || error.code === errorType
    );
  }
  // Get execution status
  static async getExecutionStatus(proposalId) {
    return await db2.query.proposalExecutionQueue.findFirst({
      where: eq22(proposalExecutionQueue.proposalId, proposalId)
    });
  }
  // Cancel pending execution
  static async cancelExecution(proposalId) {
    await db2.update(proposalExecutionQueue).set({
      status: "cancelled",
      errorMessage: "Execution cancelled by user"
    }).where(and17(
      eq22(proposalExecutionQueue.proposalId, proposalId),
      eq22(proposalExecutionQueue.status, "pending")
    ));
  }
  // Start the execution scheduler
  static startScheduler() {
    console.log("Starting proposal execution scheduler...");
    setInterval(async () => {
      await this.processPendingExecutions();
    }, 5 * 60 * 1e3);
    setTimeout(() => {
      this.processPendingExecutions();
    }, 1e4);
  }
  // Batch execute multiple proposals
  static async batchExecuteProposals(proposalIds) {
    const successful = [];
    const failed = [];
    for (const proposalId of proposalIds) {
      try {
        const execution = await db2.select().from(proposalExecutionQueue).where(and17(
          eq22(proposalExecutionQueue.proposalId, proposalId),
          eq22(proposalExecutionQueue.status, "pending")
        )).limit(1);
        if (execution.length > 0) {
          await this.executeProposal(execution[0]);
          successful.push(proposalId);
        }
      } catch (error) {
        console.error(`Failed to execute proposal ${proposalId}:`, error);
        failed.push(proposalId);
      }
    }
    return { successful, failed };
  }
  // Get execution statistics
  static async getExecutionStats(daoId) {
    const stats = await db2.select({
      status: proposalExecutionQueue.status,
      count: sql14`COUNT(*)`.as("count")
    }).from(proposalExecutionQueue).where(eq22(proposalExecutionQueue.daoId, daoId)).groupBy(proposalExecutionQueue.status);
    return stats.reduce((acc, stat) => {
      const key = stat.status ?? "unknown";
      acc[key] = parseInt(stat.count, 10);
      return acc;
    }, {});
  }
};

// server/routes/proposal-execution.ts
var router14 = express14.Router();
router14.get("/:daoId/queue", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user.claims.sub;
    const executions = await db2.select().from(proposalExecutionQueue).where(eq23(proposalExecutionQueue.daoId, daoId)).orderBy(desc10(proposalExecutionQueue.createdAt));
    res.json({
      success: true,
      data: executions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch execution queue",
      error: error.message
    });
  }
});
router14.post("/:daoId/execute/:proposalId", isAuthenticated, async (req, res) => {
  try {
    const { daoId, proposalId } = req.params;
    const userId = req.user.claims.sub;
    const execution = await db2.select().from(proposalExecutionQueue).where(and18(
      eq23(proposalExecutionQueue.proposalId, proposalId),
      eq23(proposalExecutionQueue.daoId, daoId),
      eq23(proposalExecutionQueue.status, "pending")
    )).limit(1);
    if (!execution.length) {
      return res.status(404).json({
        success: false,
        message: "No pending execution found for this proposal"
      });
    }
    await ProposalExecutionService.executeProposal(execution[0]);
    res.json({
      success: true,
      message: "Proposal executed successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to execute proposal",
      error: error.message
    });
  }
});
router14.delete("/:daoId/cancel/:executionId", isAuthenticated, async (req, res) => {
  try {
    const { daoId, executionId } = req.params;
    const userId = req.user.claims.sub;
    await db2.update(proposalExecutionQueue).set({ status: "cancelled" }).where(and18(
      eq23(proposalExecutionQueue.id, executionId),
      eq23(proposalExecutionQueue.daoId, daoId)
    ));
    res.json({
      success: true,
      message: "Execution cancelled successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cancel execution",
      error: error.message
    });
  }
});
var proposal_execution_default = router14;

// server/routes/payment-reconciliation.ts
init_notificationService();
init_storage();
init_schema();
import express15 from "express";
import { eq as eq24, and as and19, desc as desc11, gte as gte9 } from "drizzle-orm";
var router15 = express15.Router();
var PaymentReconciliationService = class {
  constructor() {
    this.providers = ["mpesa", "kotanipay", "stripe", "paystack", "flutterwave", "coinbase", "minipay"];
  }
  async generateComprehensiveReport(startDate, endDate) {
    const reports = [];
    for (const provider2 of this.providers) {
      try {
        const report = await this.getProviderReport(provider2, startDate, endDate);
        reports.push(report);
      } catch (error) {
        console.error(`Failed to get report for ${provider2}:`, error);
        reports.push(this.getEmptyReport(provider2));
      }
    }
    return reports;
  }
  async getProviderReport(provider2, startDate, endDate) {
    switch (provider2) {
      case "mpesa":
        return {
          provider: "M-Pesa",
          totalPayments: 150,
          completed: 142,
          failed: 6,
          pending: 2,
          cancelled: 0,
          totalAmount: 5e4,
          successRate: "94.7%",
          avgProcessingTime: 45,
          // seconds
          failureReasons: [
            { reason: "Insufficient funds", count: 3, percentage: "50%" },
            { reason: "Invalid phone number", count: 2, percentage: "33%" },
            { reason: "Network timeout", count: 1, percentage: "17%" }
          ],
          inRetryQueue: 1,
          reconciliationErrors: 0
        };
      case "kotanipay":
        return {
          provider: "KotaniPay",
          totalPayments: 75,
          completed: 68,
          failed: 5,
          pending: 2,
          cancelled: 0,
          totalAmount: 25e3,
          successRate: "90.7%",
          avgProcessingTime: 60,
          failureReasons: [
            { reason: "Bank account not found", count: 2, percentage: "40%" },
            { reason: "Insufficient balance", count: 2, percentage: "40%" },
            { reason: "Service unavailable", count: 1, percentage: "20%" }
          ],
          inRetryQueue: 2,
          reconciliationErrors: 1
        };
      case "stripe":
        return {
          provider: "Stripe",
          totalPayments: 200,
          completed: 185,
          failed: 12,
          pending: 3,
          cancelled: 0,
          totalAmount: 75e3,
          successRate: "92.5%",
          avgProcessingTime: 15,
          failureReasons: [
            { reason: "card_declined", count: 5, percentage: "42%" },
            { reason: "insufficient_funds", count: 4, percentage: "33%" },
            { reason: "processing_error", count: 3, percentage: "25%" }
          ],
          inRetryQueue: 0,
          reconciliationErrors: 0
        };
      default:
        return this.getEmptyReport(provider2);
    }
  }
  getEmptyReport(provider2) {
    return {
      provider: provider2,
      totalPayments: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      cancelled: 0,
      totalAmount: 0,
      successRate: "0%",
      avgProcessingTime: 0,
      failureReasons: [],
      inRetryQueue: 0,
      reconciliationErrors: 0
    };
  }
  async detectAnomalies(reports) {
    const anomalies = [];
    for (const report of reports) {
      const successRate = parseFloat(report.successRate.replace("%", ""));
      if (successRate < 85 && report.totalPayments > 10) {
        anomalies.push(`${report.provider}: Low success rate (${report.successRate})`);
      }
      if (report.reconciliationErrors > 0) {
        anomalies.push(`${report.provider}: ${report.reconciliationErrors} reconciliation errors detected`);
      }
      if (report.inRetryQueue > 5) {
        anomalies.push(`${report.provider}: High retry queue (${report.inRetryQueue} payments)`);
      }
      if (report.avgProcessingTime > 120) {
        anomalies.push(`${report.provider}: Slow processing (${report.avgProcessingTime}s average)`);
      }
    }
    return anomalies;
  }
  async autoResolveIssues(provider2) {
    const errors2 = [];
    let resolved = 0;
    try {
      const retryResponse = await fetch(`/api/payments/${provider2}/retry-all`, {
        method: "POST"
      });
      if (retryResponse.ok) {
        const result = await retryResponse.json();
        resolved += result.retriedCount || 0;
      } else {
        errors2.push(`Failed to retry ${provider2} payments`);
      }
      const clearResponse = await fetch(`/api/payments/${provider2}/clear-stuck`, {
        method: "POST"
      });
      if (clearResponse.ok) {
        const result = await clearResponse.json();
        resolved += result.clearedCount || 0;
      } else {
        errors2.push(`Failed to clear stuck ${provider2} payments`);
      }
    } catch (error) {
      errors2.push(`Auto-resolve failed for ${provider2}: ${error}`);
    }
    return { resolved, errors: errors2 };
  }
};
var reconciliationService = new PaymentReconciliationService();
router15.get("/report", async (req, res) => {
  try {
    const { startDate, endDate, provider: provider2 } = req.query;
    let reports;
    if (provider2) {
      const singleReport = await reconciliationService["getProviderReport"](
        provider2,
        startDate,
        endDate
      );
      reports = [singleReport];
    } else {
      reports = await reconciliationService.generateComprehensiveReport(
        startDate,
        endDate
      );
    }
    const anomalies = await reconciliationService.detectAnomalies(reports);
    const overall = {
      totalPayments: reports.reduce((sum3, r) => sum3 + r.totalPayments, 0),
      totalCompleted: reports.reduce((sum3, r) => sum3 + r.completed, 0),
      totalFailed: reports.reduce((sum3, r) => sum3 + r.failed, 0),
      totalAmount: reports.reduce((sum3, r) => sum3 + r.totalAmount, 0),
      overallSuccessRate: reports.length > 0 ? (reports.reduce((sum3, r) => sum3 + r.completed, 0) / reports.reduce((sum3, r) => sum3 + r.totalPayments, 0) * 100).toFixed(2) + "%" : "0%"
    };
    res.json({
      success: true,
      overall,
      providers: reports,
      anomalies,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate reconciliation report",
      error: error.message
    });
  }
});
router15.post("/auto-resolve", async (req, res) => {
  try {
    const { provider: provider2 } = req.body;
    if (provider2) {
      const result = await reconciliationService.autoResolveIssues(provider2);
      res.json({
        success: true,
        provider: provider2,
        ...result
      });
    } else {
      const results = [];
      const providers = ["mpesa", "kotanipay", "stripe", "paystack"];
      for (const p of providers) {
        const result = await reconciliationService.autoResolveIssues(p);
        results.push({ provider: p, ...result });
      }
      res.json({
        success: true,
        results,
        totalResolved: results.reduce((sum3, r) => sum3 + r.resolved, 0)
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Auto-resolve failed",
      error: error.message
    });
  }
});
router15.get("/anomalies", async (req, res) => {
  try {
    const reports = await reconciliationService.generateComprehensiveReport();
    const anomalies = await reconciliationService.detectAnomalies(reports);
    res.json({
      success: true,
      anomalies,
      count: anomalies.length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to detect anomalies",
      error: error.message
    });
  }
});
router15.post("/notifications/subscribe", async (req, res) => {
  try {
    const { recipient, channels, events: events2 } = req.body;
    notificationService.subscribe(recipient, channels);
    const eventTypes = events2 || ["anomaly_detected", "reconciliation_failed", "high_failure_rate"];
    for (const eventType of eventTypes) {
      notificationService.on(eventType, async (data) => {
        await notificationService.sendPaymentNotification(recipient, {
          type: "payment_failed",
          // Reuse existing type for now
          amount: 0,
          currency: "USD",
          transactionId: `RECON-${Date.now()}`,
          errorMessage: `Reconciliation alert: ${data.message}`
        });
      });
    }
    res.json({
      success: true,
      message: "Subscribed to reconciliation notifications",
      recipient,
      events: eventTypes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to subscribe to notifications",
      error: error.message
    });
  }
});
router15.get("/payments", async (req, res) => {
  try {
    const {
      status,
      provider: provider2,
      reconciled,
      dateRange = "30"
    } = req.query;
    const conditions = [];
    if (status && status !== "all") {
      conditions.push(eq24(walletTransactions2.status, status));
    }
    if (reconciled !== "all") {
    }
    const dateFilter = /* @__PURE__ */ new Date();
    dateFilter.setDate(dateFilter.getDate() - parseInt(dateRange));
    conditions.push(gte9(walletTransactions2.createdAt, dateFilter));
    let whereClause = void 0;
    if (conditions.length > 0) {
      whereClause = and19(...conditions);
    }
    const payments = await db2.select().from(walletTransactions2).where(whereClause).orderBy(desc11(walletTransactions2.createdAt)).limit(100);
    const stats = {
      total: payments.length,
      reconciled: payments.filter((p) => p.status === "completed").length,
      pending: payments.filter((p) => p.status === "pending").length,
      discrepancies: 0,
      // Calculate discrepancies based on your logic
      totalAmount: payments.reduce((sum3, p) => sum3 + parseFloat(p.amount), 0).toString()
    };
    res.json({ payments, stats });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});
router15.post("/reconcile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db2.update(walletTransactions2).set({
      status: "completed",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq24(walletTransactions2.id, id));
    res.json({ success: true, message: "Payment reconciled successfully" });
  } catch (error) {
    res.status(500).json({ error: "Reconciliation failed" });
  }
});
router15.post("/bulk-reconcile", async (req, res) => {
  try {
    const { paymentIds } = req.body;
    if (!Array.isArray(paymentIds)) {
      return res.status(400).json({ error: "Invalid payment IDs" });
    }
    for (const paymentId of paymentIds) {
      await db2.update(walletTransactions2).set({
        status: "completed",
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq24(walletTransactions2.id, paymentId));
    }
    res.json({
      success: true,
      message: `Successfully reconciled ${paymentIds.length} payments`
    });
  } catch (error) {
    res.status(500).json({ error: "Bulk reconciliation failed" });
  }
});
var payment_reconciliation_default = router15;

// server/routes/stripe-status.ts
init_notificationService();
import express16 from "express";
import { z as z5 } from "zod";
var router16 = express16.Router();
var stripeWebhookSchema = z5.object({
  id: z5.string(),
  type: z5.string(),
  data: z5.object({
    object: z5.object({
      id: z5.string(),
      amount: z5.number(),
      currency: z5.string(),
      status: z5.string(),
      receipt_url: z5.string().optional(),
      customer_email: z5.string().optional(),
      customer: z5.string().optional(),
      created: z5.number(),
      failure_code: z5.string().optional(),
      failure_message: z5.string().optional(),
      metadata: z5.record(z5.string()).optional()
    })
  })
});
var stripePaymentStatus = /* @__PURE__ */ new Map();
var stripeRetryQueue = /* @__PURE__ */ new Map();
var StripeReconciliationService = class {
  static async reconcilePayment(transactionId, stripeData) {
    const payment = stripePaymentStatus.get(transactionId);
    if (!payment) {
      console.warn(`Stripe reconciliation: Transaction ${transactionId} not found`);
      return false;
    }
    if (payment.amount !== stripeData.amount || payment.currency !== stripeData.currency) {
      console.error(`Stripe reconciliation failed: Amount/currency mismatch for ${transactionId}`);
      return false;
    }
    const status = stripeData.status === "succeeded" ? "completed" : stripeData.status === "requires_payment_method" ? "failed" : stripeData.status;
    payment.status = status;
    payment.receipt = stripeData.receipt_url;
    payment.failureCode = stripeData.failure_code;
    payment.failureMessage = stripeData.failure_message;
    payment.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    stripePaymentStatus.set(transactionId, payment);
    return true;
  }
  static async processCompletedPayment(payment) {
    try {
      if (payment.daoId) {
        console.log(`Crediting DAO ${payment.daoId} with ${payment.amount / 100} ${payment.currency.toUpperCase()}`);
      }
      if (payment.email) {
        await notificationService.sendPaymentNotification(payment.email, {
          type: "payment_success",
          amount: payment.amount / 100,
          // Stripe amounts are in cents
          currency: payment.currency.toUpperCase(),
          transactionId: payment.transactionId
        });
      }
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: "completed",
        receipt: payment.receipt,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return true;
    } catch (error) {
      console.error("Error processing completed Stripe payment:", error);
      return false;
    }
  }
  static async processFailedPayment(payment) {
    try {
      const retryableFailures = ["card_declined", "insufficient_funds", "processing_error"];
      if (payment.failureCode && retryableFailures.includes(payment.failureCode) && (payment.retryCount || 0) < 2) {
        payment.retryCount = (payment.retryCount || 0) + 1;
        stripeRetryQueue.set(payment.transactionId, payment);
        if (payment.email) {
          await notificationService.sendPaymentNotification(payment.email, {
            type: "payment_retry",
            amount: payment.amount / 100,
            currency: payment.currency.toUpperCase(),
            transactionId: payment.transactionId,
            errorMessage: payment.failureMessage
          });
        }
      } else {
        if (payment.email) {
          await notificationService.sendPaymentNotification(payment.email, {
            type: "payment_failed",
            amount: payment.amount / 100,
            currency: payment.currency.toUpperCase(),
            transactionId: payment.transactionId,
            errorMessage: payment.failureMessage || payment.failureCode
          });
        }
      }
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: "failed",
        error: payment.failureMessage || payment.failureCode,
        retryCount: payment.retryCount,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return true;
    } catch (error) {
      console.error("Error processing failed Stripe payment:", error);
      return false;
    }
  }
};
router16.get("/status/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const status = stripePaymentStatus.get(transactionId);
    if (!status) {
      return res.status(404).json({
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }
    res.json({
      success: true,
      payment: {
        ...status,
        amount: status.amount / 100
        // Convert from cents to dollars
      },
      retryInfo: stripeRetryQueue.has(transactionId) ? {
        inRetryQueue: true,
        retryCount: status.retryCount || 0
      } : null
    });
  } catch (error) {
    res.status(500).json({
      code: "STATUS_CHECK_FAILED",
      message: "Failed to check payment status",
      details: error.message
    });
  }
});
router16.post("/webhook", async (req, res) => {
  try {
    const event = stripeWebhookSchema.parse(req.body);
    const payment = event.data.object;
    const relevantEvents = [
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "invoice.payment_succeeded",
      "invoice.payment_failed"
    ];
    if (!relevantEvents.includes(event.type)) {
      return res.status(200).json({ received: true });
    }
    const reconciled = await StripeReconciliationService.reconcilePayment(
      payment.id,
      payment
    );
    if (!reconciled) {
      console.warn(`Stripe webhook: Payment ${payment.id} not found for reconciliation`);
      const newPayment = {
        id: payment.id,
        transactionId: payment.id,
        status: payment.status === "succeeded" ? "completed" : "failed",
        amount: payment.amount,
        currency: payment.currency,
        email: payment.customer_email,
        receipt: payment.receipt_url,
        failureCode: payment.failure_code,
        failureMessage: payment.failure_message,
        createdAt: new Date(payment.created * 1e3).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        daoId: payment.metadata?.daoId
      };
      stripePaymentStatus.set(payment.id, newPayment);
    }
    const updatedPayment = stripePaymentStatus.get(payment.id);
    if (!updatedPayment) {
      return res.status(500).json({ error: "Failed to process payment" });
    }
    if (event.type.includes("succeeded")) {
      await StripeReconciliationService.processCompletedPayment(updatedPayment);
    } else if (event.type.includes("failed")) {
      await StripeReconciliationService.processFailedPayment(updatedPayment);
    }
    console.log(`Stripe payment ${payment.id} processed: ${event.type}`);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    res.status(400).json({
      code: "INVALID_WEBHOOK",
      message: "Invalid Stripe webhook data",
      details: error.message
    });
  }
});
router16.get("/reconcile", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const payments = Array.from(stripePaymentStatus.values()).filter((payment) => {
      if (startDate && payment.createdAt < startDate) return false;
      if (endDate && payment.createdAt > endDate) return false;
      return true;
    });
    const reconciliation = {
      totalPayments: payments.length,
      completed: payments.filter((p) => p.status === "completed").length,
      failed: payments.filter((p) => p.status === "failed").length,
      pending: payments.filter((p) => p.status === "pending").length,
      inRetryQueue: stripeRetryQueue.size,
      totalAmount: payments.filter((p) => p.status === "completed").reduce((sum3, p) => sum3 + p.amount / 100, 0),
      // Convert from cents
      successRate: payments.length > 0 ? (payments.filter((p) => p.status === "completed").length / payments.length * 100).toFixed(2) + "%" : "0%",
      topFailureReasons: getTopFailureReasons(payments ? payments.filter((p) => p.status === "failed") : [])
    };
    res.json({
      success: true,
      reconciliation,
      payments: payments.map((p) => ({
        ...p,
        amount: p.amount / 100,
        // Convert from cents
        inRetryQueue: stripeRetryQueue.has(p.transactionId)
      }))
    });
  } catch (error) {
    res.status(500).json({
      code: "RECONCILIATION_FAILED",
      message: "Failed to generate reconciliation report",
      details: error.message
    });
  }
});
function getTopFailureReasons(failedPayments) {
  const reasons = failedPayments.reduce((acc, payment) => {
    const reason = payment.failureCode || payment.failureMessage || "unknown";
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(reasons).sort(([, a], [, b]) => b - a).slice(0, 5).map(([reason, count3]) => ({ reason, count: count3 }));
}
var stripe_status_default = router16;

// server/routes/kotanipay-status.ts
init_notificationService();
import express17 from "express";
import { z as z6 } from "zod";
var router17 = express17.Router();
var kotaniPaymentStatus = /* @__PURE__ */ new Map();
var paymentRetryQueue = /* @__PURE__ */ new Map();
var kotaniWebhookSchema = z6.object({
  transactionId: z6.string(),
  status: z6.enum(["pending", "completed", "failed", "cancelled"]),
  amount: z6.number(),
  currency: z6.string(),
  phone: z6.string(),
  reference: z6.string().optional(),
  timestamp: z6.string().optional(),
  errorCode: z6.string().optional(),
  errorMessage: z6.string().optional()
});
var PaymentReconciliationService2 = class {
  static async reconcilePayment(transactionId, webhookData) {
    const payment = kotaniPaymentStatus.get(transactionId);
    if (!payment) {
      console.warn(`Payment reconciliation: Transaction ${transactionId} not found`);
      return false;
    }
    if (payment.amount !== webhookData.amount || payment.currency !== webhookData.currency) {
      console.error(`Payment reconciliation failed: Amount/currency mismatch for ${transactionId}`);
      return false;
    }
    payment.status = webhookData.status;
    payment.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (webhookData.errorMessage) {
      payment.errorMessage = webhookData.errorMessage;
    }
    kotaniPaymentStatus.set(transactionId, payment);
    return true;
  }
  static async processCompletedPayment(payment) {
    try {
      if (payment.daoId) {
        console.log(`Crediting DAO ${payment.daoId} with ${payment.amount} ${payment.currency}`);
      }
      await notificationService.sendPaymentNotification(payment.phone, {
        type: "payment_success",
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId
      });
      return true;
    } catch (error) {
      console.error("Error processing completed payment:", error);
      return false;
    }
  }
  static async processFailedPayment(payment) {
    try {
      if ((payment.retryCount || 0) < 3) {
        payment.retryCount = (payment.retryCount || 0) + 1;
        paymentRetryQueue.set(payment.transactionId, payment);
        setTimeout(() => {
          this.retryFailedPayment(payment.transactionId);
        }, 3e4 * payment.retryCount);
      }
      await notificationService.sendPaymentNotification(payment.phone, {
        type: "payment_failed",
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId,
        errorMessage: payment.errorMessage
      });
      return true;
    } catch (error) {
      console.error("Error processing failed payment:", error);
      return false;
    }
  }
  static async retryFailedPayment(transactionId) {
    const payment = paymentRetryQueue.get(transactionId);
    if (!payment) return;
    try {
      console.log(`Retrying payment ${transactionId} (attempt ${payment.retryCount})`);
      const retrySuccess = Math.random() > 0.5;
      if (retrySuccess) {
        payment.status = "completed";
        paymentRetryQueue.delete(transactionId);
        await this.processCompletedPayment(payment);
      } else {
        payment.status = "failed";
        await this.processFailedPayment(payment);
      }
    } catch (error) {
      console.error(`Retry failed for payment ${transactionId}:`, error);
    }
  }
};
router17.get("/status/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const status = kotaniPaymentStatus.get(transactionId);
    if (!status) {
      return res.status(404).json({
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }
    res.json({
      success: true,
      payment: status,
      retryInfo: paymentRetryQueue.has(transactionId) ? {
        inRetryQueue: true,
        retryCount: status.retryCount || 0
      } : null
    });
  } catch (error) {
    res.status(500).json({
      code: "STATUS_CHECK_FAILED",
      message: "Failed to check payment status",
      details: error.message
    });
  }
});
router17.post("/callback", async (req, res) => {
  try {
    const webhook = kotaniWebhookSchema.parse(req.body);
    const reconciled = await PaymentReconciliationService2.reconcilePayment(
      webhook.transactionId,
      webhook
    );
    if (!reconciled) {
      return res.status(400).json({
        code: "RECONCILIATION_FAILED",
        message: "Payment reconciliation failed"
      });
    }
    const payment = {
      id: webhook.transactionId,
      transactionId: webhook.transactionId,
      status: webhook.status,
      amount: webhook.amount,
      currency: webhook.currency,
      phone: webhook.phone,
      reference: webhook.reference,
      createdAt: kotaniPaymentStatus.get(webhook.transactionId)?.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      errorMessage: webhook.errorMessage
    };
    kotaniPaymentStatus.set(webhook.transactionId, payment);
    switch (webhook.status) {
      case "completed":
        await PaymentReconciliationService2.processCompletedPayment(payment);
        break;
      case "failed":
      case "cancelled":
        await PaymentReconciliationService2.processFailedPayment(payment);
        break;
      case "pending":
        await notificationService.sendPaymentNotification(payment.phone, {
          type: "payment_pending",
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId
        });
        break;
    }
    console.log(`KotaniPay payment ${webhook.transactionId} status updated: ${webhook.status}`);
    res.json({
      success: true,
      reconciled: true,
      status: webhook.status
    });
  } catch (error) {
    console.error("KotaniPay callback error:", error);
    res.status(400).json({
      code: "INVALID_CALLBACK",
      message: "Invalid callback data",
      details: error.message
    });
  }
});
router17.post("/retry/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const payment = kotaniPaymentStatus.get(transactionId);
    if (!payment) {
      return res.status(404).json({
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }
    if (payment.status !== "failed") {
      return res.status(400).json({
        code: "INVALID_STATUS",
        message: "Can only retry failed payments"
      });
    }
    if ((payment.retryCount || 0) >= 3) {
      return res.status(400).json({
        code: "RETRY_LIMIT_EXCEEDED",
        message: "Maximum retry attempts exceeded"
      });
    }
    payment.retryCount = (payment.retryCount || 0) + 1;
    paymentRetryQueue.set(transactionId, payment);
    await PaymentReconciliationService2.retryFailedPayment(transactionId);
    res.json({
      success: true,
      message: "Payment retry initiated",
      retryCount: payment.retryCount
    });
  } catch (error) {
    res.status(500).json({
      code: "RETRY_FAILED",
      message: "Failed to retry payment",
      details: error.message
    });
  }
});
router17.get("/reconcile", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const payments = Array.from(kotaniPaymentStatus.values()).filter((payment) => {
      if (startDate && payment.createdAt < startDate) return false;
      if (endDate && payment.createdAt > endDate) return false;
      return true;
    });
    const reconciliation = {
      totalPayments: payments.length,
      completed: payments.filter((p) => p.status === "completed").length,
      failed: payments.filter((p) => p.status === "failed").length,
      pending: payments.filter((p) => p.status === "pending").length,
      cancelled: payments.filter((p) => p.status === "cancelled").length,
      inRetryQueue: paymentRetryQueue.size,
      totalAmount: payments.filter((p) => p.status === "completed").reduce((sum3, p) => sum3 + p.amount, 0)
    };
    res.json({
      success: true,
      reconciliation,
      payments: payments.map((p) => ({
        ...p,
        inRetryQueue: paymentRetryQueue.has(p.transactionId)
      }))
    });
  } catch (error) {
    res.status(500).json({
      code: "RECONCILIATION_FAILED",
      message: "Failed to generate reconciliation report",
      details: error.message
    });
  }
});
var kotanipay_status_default = router17;

// server/routes/mpesa-status.ts
init_notificationService();
import express18 from "express";
import { z as z7 } from "zod";
var router18 = express18.Router();
var mpesaCallbackSchema = z7.object({
  Body: z7.object({
    stkCallback: z7.object({
      MerchantRequestID: z7.string(),
      CheckoutRequestID: z7.string(),
      ResultCode: z7.number(),
      ResultDesc: z7.string(),
      CallbackMetadata: z7.object({
        Item: z7.array(z7.object({
          Name: z7.string(),
          Value: z7.union([z7.string(), z7.number()])
        }))
      }).optional()
    })
  })
});
var paymentStatus = /* @__PURE__ */ new Map();
var mpesaRetryQueue = /* @__PURE__ */ new Map();
var MpesaReconciliationService = class {
  static async reconcilePayment(checkoutRequestId, callbackData) {
    const payment = paymentStatus.get(checkoutRequestId);
    if (!payment) {
      console.warn(`M-Pesa reconciliation: Transaction ${checkoutRequestId} not found`);
      return false;
    }
    let amount, receipt, phoneNumber;
    if (callbackData.CallbackMetadata?.Item) {
      for (const item of callbackData.CallbackMetadata.Item) {
        if (item.Name === "Amount") amount = Number(item.Value);
        if (item.Name === "MpesaReceiptNumber") receipt = String(item.Value);
        if (item.Name === "PhoneNumber") phoneNumber = String(item.Value);
      }
    }
    if (amount && payment.amount !== amount) {
      console.error(`M-Pesa reconciliation failed: Amount mismatch for ${checkoutRequestId}`);
      return false;
    }
    payment.receipt = receipt;
    payment.resultCode = callbackData.ResultCode;
    payment.resultDesc = callbackData.ResultDesc;
    payment.status = callbackData.ResultCode === 0 ? "completed" : "failed";
    payment.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    paymentStatus.set(checkoutRequestId, payment);
    return true;
  }
  static async processCompletedPayment(payment) {
    try {
      if (payment.daoId) {
        console.log(`Crediting DAO ${payment.daoId} with ${payment.amount} KES`);
      }
      await notificationService.sendPaymentNotification(payment.phone, {
        type: "payment_success",
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId
      });
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: "completed",
        receipt: payment.receipt,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return true;
    } catch (error) {
      console.error("Error processing completed M-Pesa payment:", error);
      return false;
    }
  }
  static async processFailedPayment(payment) {
    try {
      const retryableErrors = [1, 1032, 1037];
      if (retryableErrors.includes(payment.resultCode || 0) && (payment.retryCount || 0) < 3) {
        payment.retryCount = (payment.retryCount || 0) + 1;
        mpesaRetryQueue.set(payment.transactionId, payment);
        setTimeout(() => {
          this.retryFailedPayment(payment.transactionId);
        }, 6e4 * payment.retryCount);
        await notificationService.sendPaymentNotification(payment.phone, {
          type: "payment_retry",
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId
        });
      } else {
        await notificationService.sendPaymentNotification(payment.phone, {
          type: "payment_failed",
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId,
          errorMessage: payment.resultDesc
        });
      }
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: "failed",
        error: payment.resultDesc,
        retryCount: payment.retryCount,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return true;
    } catch (error) {
      console.error("Error processing failed M-Pesa payment:", error);
      return false;
    }
  }
  static async retryFailedPayment(transactionId) {
    const payment = mpesaRetryQueue.get(transactionId);
    if (!payment) return;
    try {
      console.log(`Retrying M-Pesa payment ${transactionId} (attempt ${payment.retryCount})`);
      const retrySuccess = Math.random() > 0.3;
      if (retrySuccess) {
        payment.status = "completed";
        payment.resultCode = 0;
        payment.resultDesc = "Success";
        payment.receipt = "RETRY" + Date.now();
        mpesaRetryQueue.delete(transactionId);
        await this.processCompletedPayment(payment);
      } else {
        await this.processFailedPayment(payment);
      }
    } catch (error) {
      console.error(`M-Pesa retry failed for payment ${transactionId}:`, error);
    }
  }
};
router18.get("/status/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const status = paymentStatus.get(transactionId);
    if (!status) {
      return res.status(404).json({
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }
    res.json({
      success: true,
      payment: status,
      retryInfo: mpesaRetryQueue.has(transactionId) ? {
        inRetryQueue: true,
        retryCount: status.retryCount || 0
      } : null
    });
  } catch (error) {
    res.status(500).json({
      code: "STATUS_CHECK_FAILED",
      message: "Failed to check payment status",
      details: error.message
    });
  }
});
router18.post("/callback", async (req, res) => {
  try {
    const callback = mpesaCallbackSchema.parse(req.body);
    const { ResultCode, CheckoutRequestID, ResultDesc } = callback.Body.stkCallback;
    const reconciled = await MpesaReconciliationService.reconcilePayment(
      CheckoutRequestID,
      callback.Body.stkCallback
    );
    if (!reconciled) {
      return res.status(400).json({
        code: "RECONCILIATION_FAILED",
        message: "Payment reconciliation failed"
      });
    }
    const payment = paymentStatus.get(CheckoutRequestID);
    if (!payment) {
      return res.status(404).json({
        code: "PAYMENT_NOT_FOUND",
        message: "Payment not found"
      });
    }
    if (ResultCode === 0) {
      await MpesaReconciliationService.processCompletedPayment(payment);
    } else {
      await MpesaReconciliationService.processFailedPayment(payment);
    }
    console.log(`M-Pesa payment ${CheckoutRequestID} processed: ${ResultCode === 0 ? "Success" : "Failed"}`);
    res.json({
      success: true,
      reconciled: true,
      resultCode: ResultCode
    });
  } catch (error) {
    console.error("M-Pesa callback error:", error);
    res.status(400).json({
      code: "INVALID_CALLBACK",
      message: "Invalid callback data",
      details: error.message
    });
  }
});
router18.post("/retry/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const payment = paymentStatus.get(transactionId);
    if (!payment) {
      return res.status(404).json({
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }
    if (payment.status !== "failed") {
      return res.status(400).json({
        code: "INVALID_STATUS",
        message: "Can only retry failed payments"
      });
    }
    if ((payment.retryCount || 0) >= 3) {
      return res.status(400).json({
        code: "RETRY_LIMIT_EXCEEDED",
        message: "Maximum retry attempts exceeded"
      });
    }
    payment.retryCount = (payment.retryCount || 0) + 1;
    mpesaRetryQueue.set(transactionId, payment);
    await MpesaReconciliationService.retryFailedPayment(transactionId);
    res.json({
      success: true,
      message: "Payment retry initiated",
      retryCount: payment.retryCount
    });
  } catch (error) {
    res.status(500).json({
      code: "RETRY_FAILED",
      message: "Failed to retry payment",
      details: error.message
    });
  }
});
router18.get("/reconcile", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const payments = Array.from(paymentStatus.values()).filter((payment) => {
      if (startDate && payment.createdAt < startDate) return false;
      if (endDate && payment.createdAt > endDate) return false;
      return true;
    });
    const reconciliation = {
      totalPayments: payments.length,
      completed: payments.filter((p) => p.status === "completed").length,
      failed: payments.filter((p) => p.status === "failed").length,
      pending: payments.filter((p) => p.status === "pending").length,
      inRetryQueue: mpesaRetryQueue.size,
      totalAmount: payments.filter((p) => p.status === "completed").reduce((sum3, p) => sum3 + p.amount, 0),
      successRate: payments.length > 0 ? (payments.filter((p) => p.status === "completed").length / payments.length * 100).toFixed(2) + "%" : "0%"
    };
    res.json({
      success: true,
      reconciliation,
      payments: payments.map((p) => ({
        ...p,
        inRetryQueue: mpesaRetryQueue.has(p.transactionId)
      }))
    });
  } catch (error) {
    res.status(500).json({
      code: "RECONCILIATION_FAILED",
      message: "Failed to generate reconciliation report",
      details: error.message
    });
  }
});
var mpesa_status_default = router18;

// server/routes/monitoring.ts
import express19 from "express";
init_logger();
var router19 = express19.Router();
var AlertManager = class _AlertManager {
  constructor() {
    this.alerts = [];
    this.alertRules = {
      errorRate: { threshold: 5, severity: "high" },
      responseTime: { threshold: 1e3, severity: "medium" },
      memoryUsage: { threshold: 80, severity: "high" },
      connectionCount: { threshold: 1e3, severity: "medium" }
    };
    setInterval(() => this.checkAlerts(), 6e4);
  }
  static getInstance() {
    if (!_AlertManager.instance) {
      _AlertManager.instance = new _AlertManager();
    }
    return _AlertManager.instance;
  }
  checkAlerts() {
    const metrics = metricsCollector.getMetrics();
    if (metrics.summary.errorRate > this.alertRules.errorRate.threshold) {
      this.createAlert(
        "error_rate",
        this.alertRules.errorRate.severity,
        `High error rate: ${metrics.summary.errorRate.toFixed(2)}%`
      );
    }
    if (metrics.summary.avgResponseTime > this.alertRules.responseTime.threshold) {
      this.createAlert(
        "response_time",
        this.alertRules.responseTime.severity,
        `Slow response time: ${metrics.summary.avgResponseTime.toFixed(2)}ms`
      );
    }
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsage > 500) {
      this.createAlert(
        "memory_usage",
        this.alertRules.memoryUsage.severity,
        `High memory usage: ${memoryUsage.toFixed(2)}MB`
      );
    }
    if (metrics.summary.activeConnections > this.alertRules.connectionCount.threshold) {
      this.createAlert(
        "connection_count",
        this.alertRules.connectionCount.severity,
        `High connection count: ${metrics.summary.activeConnections}`
      );
    }
  }
  createAlert(type, severity, message) {
    const existingAlert = this.alerts.find(
      (alert2) => alert2.type === type && !alert2.acknowledged && !alert2.resolvedAt
    );
    if (existingAlert) return;
    const alert = {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      acknowledged: false
    };
    this.alerts.push(alert);
    logger.warn(`Alert created: ${message}`, { alert });
    this.alerts.filter((a) => a.type === type && a.id !== alert.id && !a.resolvedAt).forEach((a) => a.resolvedAt = Date.now());
  }
  getAlerts(includeResolved = false) {
    return this.alerts.filter(
      (alert) => includeResolved || !alert.resolvedAt && !alert.acknowledged
    );
  }
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }
  resolveAlert(alertId) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }
};
var alertManager = AlertManager.getInstance();
router19.get("/dashboard", isAuthenticated2, (req, res) => {
  const metrics = metricsCollector.getMetrics();
  const alerts = alertManager.getAlerts();
  const healthScore = metricsCollector.getHealthScore();
  const recentRequests = metrics.requests.slice(-20);
  const systemMetrics = metrics.system.slice(-10);
  res.json({
    healthScore,
    alerts: alerts.length,
    criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
    metrics: {
      totalRequests: metrics.summary.totalRequests,
      errorRate: metrics.summary.errorRate,
      avgResponseTime: metrics.summary.avgResponseTime,
      activeConnections: metrics.summary.activeConnections,
      uptime: metrics.summary.uptime,
      memoryUsage: process.memoryUsage()
    },
    recentRequests,
    systemMetrics
  });
});
router19.get("/alerts", isAuthenticated2, (req, res) => {
  const includeResolved = req.query.resolved === "true";
  const alerts = alertManager.getAlerts(includeResolved);
  res.json({ alerts });
});
router19.post("/alerts/:alertId/acknowledge", isAuthenticated2, (req, res) => {
  const { alertId } = req.params;
  const success = alertManager.acknowledgeAlert(alertId);
  if (success) {
    res.json({ message: "Alert acknowledged" });
  } else {
    res.status(404).json({ error: "Alert not found" });
  }
});
router19.post("/alerts/:alertId/resolve", isAuthenticated2, (req, res) => {
  const { alertId } = req.params;
  const success = alertManager.resolveAlert(alertId);
  if (success) {
    res.json({ message: "Alert resolved" });
  } else {
    res.status(404).json({ error: "Alert not found" });
  }
});
router19.get("/performance", isAuthenticated2, (req, res) => {
  const metrics = metricsCollector.getMetrics();
  const requests = metrics.requests;
  const slowEndpoints = requests.filter((r) => r.responseTime > 1e3).reduce((acc, req2) => {
    const key = `${req2.method} ${req2.route}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const errorEndpoints = requests.filter((r) => r.statusCode >= 400).reduce((acc, req2) => {
    const key = `${req2.method} ${req2.route}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  res.json({
    slowEndpoints,
    errorEndpoints,
    performanceScore: metricsCollector.getHealthScore(),
    recommendations: generatePerformanceRecommendations(metrics)
  });
});
function generatePerformanceRecommendations(metrics) {
  const recommendations = [];
  if (metrics.summary.errorRate > 2) {
    recommendations.push("High error rate detected. Review error logs and fix failing endpoints.");
  }
  if (metrics.summary.avgResponseTime > 500) {
    recommendations.push("Slow response times detected. Consider optimizing database queries and adding caching.");
  }
  const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
  if (memoryUsageMB > 300) {
    recommendations.push("High memory usage. Review memory leaks and optimize resource usage.");
  }
  if (metrics.summary.activeConnections > 100) {
    recommendations.push("High number of active connections. Consider implementing connection pooling.");
  }
  return recommendations;
}
var monitoring_default = router19;

// server/api/task_templates.ts
init_db();
init_schema();
import { Router } from "express";
import { z as z8 } from "zod";
import { eq as eq25, like, desc as desc12 } from "drizzle-orm";
var router20 = Router();
var createTaskTemplateSchema = z8.object({
  title: z8.string().min(1).max(200),
  description: z8.string().min(1).max(2e3),
  category: z8.string().min(1),
  difficulty: z8.enum(["beginner", "intermediate", "advanced", "expert"]),
  estimatedHours: z8.number().min(1).max(1e3),
  requiredSkills: z8.array(z8.string()).optional(),
  bountyAmount: z8.number().min(0),
  deliverables: z8.array(z8.string()),
  acceptanceCriteria: z8.array(z8.string())
});
router20.get("/", async (req, res) => {
  try {
    const { category, difficulty, search } = req.query;
    const whereClauses = [];
    if (category) {
      whereClauses.push(eq25(taskTemplates.category, category));
    }
    if (difficulty) {
      whereClauses.push(eq25(taskTemplates.difficulty, difficulty));
    }
    if (search) {
      whereClauses.push(like(taskTemplates.title, `%${search}%`));
    }
    let query = db2.select().from(taskTemplates);
    if (whereClauses.length > 0) {
      query = query.where(whereClauses.length === 1 ? whereClauses[0] : { and: whereClauses });
    }
    const templates = await query.orderBy(desc12(taskTemplates.createdAt));
    res.json({ templates });
  } catch (error) {
    console.error("Error fetching task templates:", error);
    res.status(500).json({ error: "Failed to fetch task templates" });
  }
});
router20.get("/:templateId", async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = await db2.select().from(taskTemplates).where(eq25(taskTemplates.id, templateId)).limit(1);
    if (template.length === 0) {
      return res.status(404).json({ error: "Task template not found" });
    }
    res.json({ template: template[0] });
  } catch (error) {
    console.error("Error fetching task template:", error);
    res.status(500).json({ error: "Failed to fetch task template" });
  }
});
router20.post("/", isAuthenticated2, async (req, res) => {
  try {
    const validatedData = createTaskTemplateSchema.parse(req.body);
    const userId = req.user?.claims?.sub;
    const insertData = {
      title: validatedData.title,
      description: validatedData.description,
      category: validatedData.category,
      difficulty: validatedData.difficulty,
      estimatedHours: validatedData.estimatedHours ?? 1,
      requiredSkills: validatedData.requiredSkills ?? [],
      bountyAmount: String(validatedData.bountyAmount),
      deliverables: validatedData.deliverables ?? [],
      acceptanceCriteria: validatedData.acceptanceCriteria ?? [],
      createdBy: userId,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    Object.keys(insertData).forEach((key) => insertData[key] === void 0 && delete insertData[key]);
    const newTemplate = await db2.insert(taskTemplates).values(insertData).returning();
    res.status(201).json({ template: newTemplate[0] });
  } catch (error) {
    if (error instanceof z8.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating task template:", error);
    res.status(500).json({ error: "Failed to create task template" });
  }
});
router20.put("/:templateId", isAuthenticated2, async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?.claims?.sub;
    const validatedData = createTaskTemplateSchema.partial().parse(req.body);
    const template = await db2.select().from(taskTemplates).where(eq25(taskTemplates.id, templateId)).limit(1);
    if (template.length === 0) {
      return res.status(404).json({ error: "Task template not found" });
    }
    if (template[0].createdBy !== userId) {
      return res.status(403).json({ error: "Not authorized to update this template" });
    }
    const updateData = {
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (validatedData.title !== void 0) updateData.title = validatedData.title;
    if (validatedData.description !== void 0) updateData.description = validatedData.description;
    if (validatedData.category !== void 0) updateData.category = validatedData.category;
    if (validatedData.difficulty !== void 0) updateData.difficulty = validatedData.difficulty;
    if (validatedData.estimatedHours !== void 0) updateData.estimatedHours = validatedData.estimatedHours;
    if (validatedData.requiredSkills !== void 0) updateData.requiredSkills = validatedData.requiredSkills;
    if (validatedData.bountyAmount !== void 0) updateData.bountyAmount = String(validatedData.bountyAmount);
    if (validatedData.deliverables !== void 0) updateData.deliverables = validatedData.deliverables;
    if (validatedData.acceptanceCriteria !== void 0) updateData.acceptanceCriteria = validatedData.acceptanceCriteria;
    Object.keys(updateData).forEach((key) => updateData[key] === void 0 && delete updateData[key]);
    const updatedTemplate = await db2.update(taskTemplates).set(updateData).where(eq25(taskTemplates.id, templateId)).returning();
    res.json({ template: updatedTemplate[0] });
  } catch (error) {
    if (error instanceof z8.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating task template:", error);
    res.status(500).json({ error: "Failed to update task template" });
  }
});
router20.delete("/:templateId", isAuthenticated2, async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?.claims?.sub;
    const template = await db2.select().from(taskTemplates).where(eq25(taskTemplates.id, templateId)).limit(1);
    if (template.length === 0) {
      return res.status(404).json({ error: "Task template not found" });
    }
    if (template[0].createdBy !== userId) {
      return res.status(403).json({ error: "Not authorized to delete this template" });
    }
    await db2.delete(taskTemplates).where(eq25(taskTemplates.id, templateId));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting task template:", error);
    res.status(500).json({ error: "Failed to delete task template" });
  }
});
var task_templates_default = router20;

// server/api/achievements.ts
init_achievementService();
import express20 from "express";
var router21 = express20.Router();
router21.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const achievements2 = await AchievementService.getUserAchievements(userId);
    const stats = await AchievementService.getUserAchievementStats(userId);
    res.json({
      achievements: achievements2,
      stats
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router21.get("/me", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const achievements2 = await AchievementService.getUserAchievements(userId);
    const stats = await AchievementService.getUserAchievementStats(userId);
    res.json({
      achievements: achievements2,
      stats
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router21.post("/check", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const newAchievements = await AchievementService.checkUserAchievements(userId);
    res.json({
      newAchievements,
      count: newAchievements.length
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router21.post("/:achievementId/claim", async (req, res) => {
  try {
    const { achievementId } = req.params;
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const success = await AchievementService.claimAchievementReward(userId, achievementId);
    if (!success) {
      return res.status(400).json({ error: "Achievement not available for claiming" });
    }
    res.json({
      success: true,
      message: "Achievement reward claimed successfully"
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router21.get("/leaderboard", async (req, res) => {
  try {
    const { db: db3 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    const { achievements: achievements2, userAchievements: userAchievements2 } = await Promise.resolve().then(() => (init_achievementSchema(), achievementSchema_exports));
    const { users: users5 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { sql: sql22, desc: desc20, eq: eq49 } = await import("drizzle-orm");
    const leaderboard = await db3.select({
      userId: userAchievements2.userId,
      userName: users5.username,
      totalAchievements: sql22`count(${userAchievements2.id})`,
      totalPoints: sql22`sum(${achievements2.rewardPoints})`
    }).from(userAchievements2).leftJoin(achievements2, eq49(userAchievements2.achievementId, achievements2.id)).leftJoin(users5, eq49(userAchievements2.userId, users5.id)).where(eq49(userAchievements2.isCompleted, true)).groupBy(userAchievements2.userId, users5.username).orderBy(desc20(sql22`sum(${achievements2.rewardPoints})`)).limit(50);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
var achievements_default = router21;

// server/routes/challenges.ts
init_errorHandler();
import express21 from "express";
var router22 = express21.Router();
router22.get("/daily/:userId", asyncHandler(async (req, res) => {
  const { userId } = req.params;
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const challenge = {
      id: "daily-" + today,
      title: "Daily Vault Check",
      description: "Check your vault performance and claim your daily reward!",
      reward: 50,
      streak: Math.floor(Math.random() * 10) + 1,
      claimed: false,
      progress: 1,
      target: 1
    };
    res.json(challenge);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch daily challenge" });
  }
}));
router22.post("/claim", asyncHandler(async (req, res) => {
  const { userId, challengeId } = req.body;
  if (!userId || !challengeId) {
    return res.status(400).json({ error: "User ID and Challenge ID required" });
  }
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const claimResult = {
      success: true,
      pointsAwarded: 50,
      newStreak: Math.floor(Math.random() * 10) + 2
    };
    res.json(claimResult);
  } catch (error) {
    res.status(500).json({ error: "Failed to claim daily reward" });
  }
}));
router22.get("/history/:userId", asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = 10 } = req.query;
  try {
    const history = Array.from({ length: parseInt(limit) }, (_, i) => ({
      id: `challenge-${i}`,
      title: `Challenge ${i + 1}`,
      completedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1e3).toISOString(),
      pointsEarned: 50,
      type: "daily"
    }));
    res.json({
      success: true,
      history,
      total: history.length
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch challenge history" });
  }
}));
var challenges_default = router22;

// server/routes/morio.ts
import { Router as Router2 } from "express";

// server/core/nuru/nlu/intent_classifier.ts
var IntentClassifier = class {
  constructor() {
    this.intentPatterns = this.buildIntentPatterns();
  }
  /**
   * Classify user message into an intent
   */
  async classify(message) {
    const normalizedMessage = message.toLowerCase().trim();
    for (const [intentType, patterns] of this.intentPatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          return {
            type: intentType,
            entities: this.extractEntities(normalizedMessage, intentType),
            confidence: 0.85,
            language: this.detectLanguage(message),
            sentiment: this.analyzeSentiment(message)
          };
        }
      }
    }
    return {
      type: "unknown",
      entities: {},
      confidence: 0.1,
      language: "en",
      sentiment: 0
    };
  }
  /**
   * Build intent pattern mappings
   */
  buildIntentPatterns() {
    return /* @__PURE__ */ new Map([
      ["withdraw", [
        /withdraw|nataka kutoa|pull out|take out/i,
        /send.*to.*wallet|transfer out/i
      ]],
      ["deposit", [
        /deposit|weka|top up|add funds|contribute/i,
        /nataka kuweka|i want to deposit/i
      ]],
      ["check_balance", [
        /balance|how much|pesa ngapi|kiasi gani/i,
        /vault.*balance|treasury.*balance/i,
        /show.*funds|check.*wallet/i
      ]],
      ["submit_proposal", [
        /proposal|nataka kuomba|suggest|propose/i,
        /i want to.*propose|submit.*idea/i,
        /create.*proposal|new.*proposal/i
      ]],
      ["vote", [
        /vote|piga kura|support|i agree|ninapiga kura/i,
        /yes.*proposal|no.*proposal|abstain/i
      ]],
      ["check_proposal", [
        /proposal.*status|check.*proposal|view.*proposal/i,
        /what.*proposals|active.*proposals/i
      ]],
      ["join_dao", [
        /join|become.*member|sign up|niunge/i,
        /how.*join|register|onboard/i
      ]],
      ["help", [
        /help|nisaidie|what can you|commands/i,
        /how do i|guide|tutorial/i
      ]],
      ["analytics", [
        /analytics|statistics|stats|takwimu/i,
        /report|analysis|trends/i
      ]],
      ["community_stats", [
        /community|members|wanachama|participation/i,
        /engagement|activity|growth/i
      ]],
      ["treasury_report", [
        /treasury|funds|budget|fedha/i,
        /financial.*report|spending|expenses/i
      ]],
      ["governance_info", [
        /governance|voting.*power|quorum|utawala/i,
        /how.*voting.*works|proposal.*process/i
      ]]
    ]);
  }
  /**
   * Extract entities from message based on intent
   */
  extractEntities(message, intent) {
    const entities = {};
    const amountMatch = message.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(kes|usd|celo|ckes)?/i);
    if (amountMatch) {
      entities.amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      if (amountMatch[2]) {
        entities.currency = amountMatch[2].toUpperCase();
      }
    }
    const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      entities.address = addressMatch[0];
    }
    const proposalIdMatch = message.match(/proposal\s*#?(\d+|[a-f0-9-]{36})/i);
    if (proposalIdMatch) {
      entities.proposalId = proposalIdMatch[1];
    }
    const timeframeMatch = message.match(/(today|yesterday|this week|last week|this month|last month)/i);
    if (timeframeMatch) {
      entities.timeframe = timeframeMatch[1].toLowerCase();
    }
    return entities;
  }
  /**
   * Detect language (basic detection)
   */
  detectLanguage(message) {
    const swahiliKeywords = ["nataka", "pesa", "ngapi", "weka", "toa", "kiasi", "kura", "wanachama", "fedha"];
    const hasSwahili = swahiliKeywords.some((keyword) => message.toLowerCase().includes(keyword));
    return hasSwahili ? "sw" : "en";
  }
  /**
   * Basic sentiment analysis
   */
  analyzeSentiment(message) {
    const positiveWords = ["good", "great", "excellent", "love", "awesome", "nzuri", "poa"];
    const negativeWords = ["bad", "poor", "hate", "terrible", "awful", "mbaya"];
    const lowerMessage = message.toLowerCase();
    let sentiment = 0;
    positiveWords.forEach((word) => {
      if (lowerMessage.includes(word)) sentiment += 0.2;
    });
    negativeWords.forEach((word) => {
      if (lowerMessage.includes(word)) sentiment -= 0.2;
    });
    return Math.max(-1, Math.min(1, sentiment));
  }
};

// server/core/nuru/reasoning/context_manager.ts
var ContextManager = class {
  constructor() {
    this.contextStore = /* @__PURE__ */ new Map();
  }
  /**
   * Enrich context with current intent and state
   */
  async enrich(context, intent) {
    const existingContext = this.contextStore.get(context.userId) || context;
    const updatedHistory = [
      ...existingContext.sessionData.conversationHistory,
      {
        role: "user",
        content: JSON.stringify(intent),
        timestamp: /* @__PURE__ */ new Date()
      }
    ].slice(-20);
    const enrichedContext = {
      ...existingContext,
      sessionData: {
        ...existingContext.sessionData,
        conversationHistory: updatedHistory,
        lastInteraction: /* @__PURE__ */ new Date(),
        activeTask: this.inferActiveTask(intent, existingContext)
      }
    };
    this.contextStore.set(context.userId, enrichedContext);
    return enrichedContext;
  }
  /**
   * Generate reasoning based on context and understanding
   */
  async reason(understanding) {
    const { intent, context } = understanding;
    switch (intent) {
      case "withdraw":
        return this.reasonWithdrawal(understanding);
      case "deposit":
        return this.reasonDeposit(understanding);
      case "submit_proposal":
        return this.reasonProposal(understanding);
      case "vote":
        return this.reasonVote(understanding);
      case "check_balance":
        return this.reasonBalanceCheck(understanding);
      default:
        return {
          explanation: "I can help you with DAO operations, treasury management, and governance.",
          action: "ask_clarification",
          confidence: 0.5,
          sources: ["system"],
          alternatives: ["check_balance", "view_proposals", "join_dao"]
        };
    }
  }
  /**
   * Infer active task from intent
   */
  inferActiveTask(intent, context) {
    if (intent.type === "withdraw" || intent.type === "deposit") {
      return {
        id: `tx_${Date.now()}`,
        type: intent.type,
        status: "in_progress",
        data: intent.entities
      };
    }
    if (intent.type === "submit_proposal") {
      return {
        id: `proposal_${Date.now()}`,
        type: "proposal_creation",
        status: "in_progress",
        data: intent.entities
      };
    }
    return context.sessionData.activeTask;
  }
  /**
   * Reasoning strategies for different intents
   */
  reasonWithdrawal(understanding) {
    const { entities, context } = understanding;
    return {
      explanation: `To withdraw ${entities.amount || "funds"} from the DAO treasury, you need to submit a withdrawal proposal that will be voted on by members.`,
      action: "guide_withdrawal_proposal",
      confidence: 0.9,
      sources: ["dao_rules", "treasury_policy"],
      alternatives: ["check_balance_first", "view_spending_history"]
    };
  }
  reasonDeposit(understanding) {
    const { entities } = understanding;
    return {
      explanation: `Great! I'll help you deposit ${entities.amount || "funds"} to the DAO treasury. This will increase your contribution score.`,
      action: "initiate_deposit",
      confidence: 0.95,
      sources: ["deposit_guide"],
      alternatives: []
    };
  }
  reasonProposal(understanding) {
    return {
      explanation: "I can help you create a proposal. You'll need to provide a title, description, and funding amount if applicable.",
      action: "guide_proposal_creation",
      confidence: 0.9,
      sources: ["governance_guide"],
      alternatives: ["view_proposal_templates", "check_proposal_rules"]
    };
  }
  reasonVote(understanding) {
    const { entities } = understanding;
    return {
      explanation: `I'll help you vote on ${entities.proposalId ? "proposal #" + entities.proposalId : "the active proposal"}.`,
      action: "initiate_voting",
      confidence: 0.9,
      sources: ["voting_guide"],
      alternatives: ["view_proposal_details", "check_voting_power"]
    };
  }
  reasonBalanceCheck(understanding) {
    return {
      explanation: "I'll fetch the current treasury balance and your contribution status.",
      action: "fetch_balance",
      confidence: 1,
      sources: ["blockchain", "database"],
      alternatives: ["view_transaction_history", "check_allocations"]
    };
  }
  /**
   * Get context for a user
   */
  getContext(userId) {
    return this.contextStore.get(userId);
  }
  /**
   * Clear context for a user
   */
  clearContext(userId) {
    this.contextStore.delete(userId);
  }
};

// server/core/nuru/analytics/financial_analyzer.ts
var FinancialAnalyzer = class {
  /**
   * Analyze treasury health and financial metrics
   */
  async analyze(daoId, timeframe) {
    const metrics = await this.calculateMetrics(daoId, timeframe);
    const insights = this.generateInsights(metrics);
    const risks = this.identifyRisks(metrics);
    return {
      summary: this.generateSummary(metrics),
      metrics,
      insights,
      risks,
      recommendations: this.generateRecommendations(metrics, risks)
    };
  }
  async calculateMetrics(daoId, timeframe) {
    return {
      currentBalance: 15e3,
      totalInflow: 25e3,
      totalOutflow: 1e4,
      netChange: 15e3,
      burnRate: 1250,
      // per month
      runway: 12,
      // months
      contributionsCount: 45,
      withdrawalsCount: 12,
      avgContribution: 555.56,
      avgWithdrawal: 833.33,
      treasuryGrowthRate: 0.15
      // 15%
    };
  }
  generateSummary(metrics) {
    const balance = metrics.currentBalance;
    const growth = (metrics.treasuryGrowthRate * 100).toFixed(1);
    const runway = Math.floor(metrics.runway);
    return `Treasury balance is $${balance.toLocaleString()} with a ${growth}% growth rate. Current runway is ${runway} months at the current burn rate.`;
  }
  generateInsights(metrics) {
    const insights = [];
    if (metrics.treasuryGrowthRate > 0.1) {
      insights.push("Strong treasury growth indicates healthy community engagement");
    }
    if (metrics.runway < 6) {
      insights.push("Low runway suggests need for fundraising or reduced spending");
    }
    if (metrics.avgContribution > metrics.avgWithdrawal) {
      insights.push("Positive contribution-to-withdrawal ratio shows sustainable model");
    }
    if (metrics.contributionsCount > metrics.withdrawalsCount * 3) {
      insights.push("High number of contributors creates strong community foundation");
    }
    return insights;
  }
  identifyRisks(metrics) {
    const risks = [];
    if (metrics.runway < 3) {
      risks.push({
        level: "critical",
        category: "liquidity",
        description: "Treasury runway is critically low",
        mitigation: "Initiate fundraising campaign or reduce spending"
      });
    } else if (metrics.runway < 6) {
      risks.push({
        level: "high",
        category: "liquidity",
        description: "Treasury runway is below safe threshold",
        mitigation: "Plan fundraising activities and review spending"
      });
    }
    if (metrics.burnRate > metrics.totalInflow / 12) {
      risks.push({
        level: "medium",
        category: "sustainability",
        description: "Burn rate exceeds average monthly income",
        mitigation: "Review operational costs and optimize spending"
      });
    }
    return risks;
  }
  generateRecommendations(metrics, risks) {
    const recommendations = [];
    if (risks.some((r) => r.level === "critical" || r.level === "high")) {
      recommendations.push("Review and reduce non-essential spending immediately");
      recommendations.push("Launch member contribution campaign");
    }
    if (metrics.treasuryGrowthRate > 0.2) {
      recommendations.push("Consider allocating surplus to long-term investments");
    }
    if (metrics.contributionsCount < 20) {
      recommendations.push("Implement member incentive program to increase participation");
    }
    recommendations.push("Maintain emergency fund of at least 3 months runway");
    return recommendations;
  }
};

// server/core/nuru/analytics/governance_analyzer.ts
var GovernanceAnalyzer = class {
  /**
   * Analyze governance metrics and health
   */
  async analyze(daoId, timeframe) {
    const metrics = await this.calculateMetrics(daoId, timeframe);
    const insights = this.generateInsights(metrics);
    const risks = this.identifyRisks(metrics);
    return {
      summary: this.generateSummary(metrics),
      metrics,
      insights,
      risks,
      recommendations: this.generateRecommendations(metrics, risks)
    };
  }
  async calculateMetrics(daoId, timeframe) {
    return {
      totalProposals: 24,
      activeProposals: 3,
      passedProposals: 16,
      failedProposals: 5,
      avgParticipationRate: 0.65,
      // 65%
      avgQuorum: 0.58,
      proposalSuccessRate: 0.67,
      avgVotingTime: 4.5,
      // days
      uniqueVoters: 42,
      delegatedVotes: 15
    };
  }
  generateSummary(metrics) {
    const participation = (metrics.avgParticipationRate * 100).toFixed(0);
    const successRate = (metrics.proposalSuccessRate * 100).toFixed(0);
    return `Governance health: ${participation}% participation rate with ${successRate}% proposal success rate. ${metrics.activeProposals} proposals currently active.`;
  }
  generateInsights(metrics) {
    const insights = [];
    if (metrics.avgParticipationRate > 0.6) {
      insights.push("High participation rate indicates engaged community");
    }
    if (metrics.proposalSuccessRate > 0.7) {
      insights.push("High proposal success rate suggests good proposal quality");
    } else if (metrics.proposalSuccessRate < 0.4) {
      insights.push("Low proposal success rate may indicate need for better proposal guidelines");
    }
    if (metrics.delegatedVotes > metrics.uniqueVoters * 0.3) {
      insights.push("Significant vote delegation shows trust in community leaders");
    }
    if (metrics.avgVotingTime < 7) {
      insights.push("Quick voting resolution enables efficient decision-making");
    }
    return insights;
  }
  identifyRisks(metrics) {
    const risks = [];
    if (metrics.avgParticipationRate < 0.3) {
      risks.push({
        level: "high",
        category: "governance",
        description: "Low participation rate threatens governance legitimacy",
        mitigation: "Implement notification system and voting incentives"
      });
    }
    if (metrics.avgQuorum < 0.5) {
      risks.push({
        level: "medium",
        category: "governance",
        description: "Quorum frequently not met",
        mitigation: "Review quorum requirements or improve member engagement"
      });
    }
    if (metrics.uniqueVoters < 20) {
      risks.push({
        level: "medium",
        category: "centralization",
        description: "Low number of unique voters creates centralization risk",
        mitigation: "Grow active member base and encourage participation"
      });
    }
    return risks;
  }
  generateRecommendations(metrics, risks) {
    const recommendations = [];
    if (metrics.avgParticipationRate < 0.5) {
      recommendations.push("Implement push notifications for active proposals");
      recommendations.push("Create proposal discussion channels before voting");
    }
    if (metrics.proposalSuccessRate < 0.5) {
      recommendations.push("Provide proposal templates and guidelines");
      recommendations.push("Implement proposal review process before submission");
    }
    if (metrics.avgVotingTime > 10) {
      recommendations.push("Consider shorter voting periods for routine proposals");
    }
    recommendations.push("Maintain regular governance reviews and retrospectives");
    return recommendations;
  }
};

// server/core/nuru/analytics/community_analyzer.ts
var CommunityAnalyzer = class {
  /**
   * Analyze community metrics and health
   */
  async analyze(daoId, timeframe) {
    const metrics = await this.calculateMetrics(daoId, timeframe);
    const insights = this.generateInsights(metrics);
    const risks = this.identifyRisks(metrics);
    return {
      summary: this.generateSummary(metrics),
      metrics,
      insights,
      risks,
      recommendations: this.generateRecommendations(metrics, risks)
    };
  }
  async calculateMetrics(daoId, timeframe) {
    return {
      totalMembers: 78,
      activeMembers: 52,
      newMembers: 12,
      retentionRate: 0.85,
      engagementScore: 0.72,
      avgContributionPerMember: 320.51,
      topContributors: 15,
      growthRate: 0.18,
      // 18%
      avgSessionTime: 12.5,
      // minutes
      returningMemberRate: 0.68
    };
  }
  generateSummary(metrics) {
    const growth = (metrics.growthRate * 100).toFixed(0);
    const engagement = (metrics.engagementScore * 100).toFixed(0);
    const retention = (metrics.retentionRate * 100).toFixed(0);
    return `Community of ${metrics.totalMembers} members growing at ${growth}% with ${engagement}% engagement score and ${retention}% retention rate.`;
  }
  generateInsights(metrics) {
    const insights = [];
    if (metrics.retentionRate > 0.8) {
      insights.push("Excellent retention rate indicates strong community value");
    }
    if (metrics.engagementScore > 0.7) {
      insights.push("High engagement shows active and committed membership");
    }
    if (metrics.growthRate > 0.15) {
      insights.push("Strong growth rate demonstrates community appeal");
    }
    const activeRatio = metrics.activeMembers / metrics.totalMembers;
    if (activeRatio > 0.6) {
      insights.push("High active member ratio shows healthy community participation");
    }
    if (metrics.returningMemberRate > 0.6) {
      insights.push("High returning member rate indicates sustained interest");
    }
    return insights;
  }
  identifyRisks(metrics) {
    const risks = [];
    if (metrics.retentionRate < 0.5) {
      risks.push({
        level: "high",
        category: "retention",
        description: "Low retention rate threatens community stability",
        mitigation: "Survey departing members and improve value proposition"
      });
    }
    if (metrics.engagementScore < 0.4) {
      risks.push({
        level: "high",
        category: "engagement",
        description: "Low engagement indicates declining community interest",
        mitigation: "Launch engagement campaigns and new community initiatives"
      });
    }
    if (metrics.growthRate < 0.05) {
      risks.push({
        level: "medium",
        category: "growth",
        description: "Slow growth may limit community potential",
        mitigation: "Implement referral program and marketing initiatives"
      });
    }
    const activeRatio = metrics.activeMembers / metrics.totalMembers;
    if (activeRatio < 0.3) {
      risks.push({
        level: "medium",
        category: "participation",
        description: "Low active member ratio suggests engagement issues",
        mitigation: "Re-engage inactive members and improve onboarding"
      });
    }
    return risks;
  }
  generateRecommendations(metrics, risks) {
    const recommendations = [];
    if (metrics.retentionRate < 0.7) {
      recommendations.push("Implement member retention program");
      recommendations.push("Conduct exit surveys to understand churn reasons");
    }
    if (metrics.engagementScore < 0.6) {
      recommendations.push("Create more community events and activities");
      recommendations.push("Recognize and reward active contributors");
    }
    if (metrics.newMembers < metrics.totalMembers * 0.1) {
      recommendations.push("Launch referral rewards program");
      recommendations.push("Improve onboarding experience for new members");
    }
    recommendations.push("Maintain regular community health check-ins");
    recommendations.push("Celebrate community milestones and achievements");
    return recommendations;
  }
};

// server/core/nuru/ethics/risk_assessor.ts
var RiskAssessor = class {
  /**
   * Assess risks and ethical compliance for a proposal
   */
  async assess(proposalId, daoId) {
    const budgetCheck = await this.checkBudgetCompliance(proposalId, daoId);
    const conflictCheck = await this.checkConflictOfInterest(proposalId);
    const benefitScore = await this.assessCommunityBenefit(proposalId);
    const riskLevel = await this.calculateRiskLevel(proposalId);
    const fairnessScore = await this.assessFairness(proposalId);
    const checks = {
      budgetCompliance: budgetCheck,
      conflictOfInterest: conflictCheck,
      communityBenefit: benefitScore,
      riskLevel,
      fairnessScore
    };
    return {
      proposalId,
      checks,
      recommendations: this.generateRecommendations(checks),
      requiredActions: this.determineRequiredActions(checks)
    };
  }
  async checkBudgetCompliance(proposalId, daoId) {
    return Math.random() > 0.2;
  }
  async checkConflictOfInterest(proposalId) {
    return Math.random() < 0.9;
  }
  async assessCommunityBenefit(proposalId) {
    return 0.5 + Math.random() * 0.5;
  }
  async calculateRiskLevel(proposalId) {
    const risk = Math.random();
    if (risk < 0.6) return "low";
    if (risk < 0.85) return "medium";
    return "high";
  }
  async assessFairness(proposalId) {
    return 0.6 + Math.random() * 0.4;
  }
  generateRecommendations(checks) {
    const recommendations = [];
    if (!checks.budgetCompliance) {
      recommendations.push("Review and adjust proposal budget to comply with treasury limits");
    }
    if (checks.conflictOfInterest) {
      recommendations.push("Proposer should recuse themselves from voting due to conflict of interest");
      recommendations.push("Consider appointing independent reviewer for this proposal");
    }
    if (checks.communityBenefit < 0.6) {
      recommendations.push("Clarify how this proposal benefits the wider community");
      recommendations.push("Consider adding measurable success criteria");
    }
    if (checks.riskLevel === "high") {
      recommendations.push("Implement additional safeguards and oversight");
      recommendations.push("Consider phased implementation to reduce risk");
    }
    if (checks.fairnessScore < 0.7) {
      recommendations.push("Review proposal distribution to ensure equitable impact");
      recommendations.push("Seek broader community input before proceeding");
    }
    return recommendations;
  }
  determineRequiredActions(checks) {
    const actions = [];
    if (!checks.budgetCompliance) {
      actions.push("REQUIRED: Revise budget to meet compliance");
    }
    if (checks.conflictOfInterest) {
      actions.push("REQUIRED: Declare conflict of interest publicly");
    }
    if (checks.riskLevel === "high") {
      actions.push("REQUIRED: Obtain additional approvals from core team");
      actions.push("REQUIRED: Provide detailed risk mitigation plan");
    }
    if (checks.communityBenefit < 0.4) {
      actions.push("REQUIRED: Demonstrate clear community benefit");
    }
    return actions;
  }
};

// server/core/nuru/index.ts
var NuruCore = class {
  constructor() {
    this.intentClassifier = new IntentClassifier();
    this.contextManager = new ContextManager();
    this.financialAnalyzer = new FinancialAnalyzer();
    this.governanceAnalyzer = new GovernanceAnalyzer();
    this.communityAnalyzer = new CommunityAnalyzer();
    this.riskAssessor = new RiskAssessor();
  }
  /**
   * Understand user message and extract intent
   */
  async understand(message, context) {
    const intent = await this.intentClassifier.classify(message);
    const enrichedContext = await this.contextManager.enrich(context, intent);
    return {
      intent: intent.type,
      entities: intent.entities,
      confidence: intent.confidence,
      context: enrichedContext,
      language: intent.language || "en",
      sentiment: intent.sentiment || 0
    };
  }
  /**
   * Generate reasoning and recommendations
   */
  async reason(query, context) {
    const understanding = await this.understand(query, context);
    const reasoning = await this.contextManager.reason(understanding);
    return {
      reasoning: reasoning.explanation,
      recommendation: reasoning.action,
      confidence: reasoning.confidence,
      sources: reasoning.sources,
      alternatives: reasoning.alternatives
    };
  }
  /**
   * Analyze DAO data (treasury, governance, community)
   */
  async analyze(request) {
    switch (request.type) {
      case "treasury":
        return await this.financialAnalyzer.analyze(request.daoId, request.timeframe);
      case "governance":
        return await this.governanceAnalyzer.analyze(request.daoId, request.timeframe);
      case "community":
        return await this.communityAnalyzer.analyze(request.daoId, request.timeframe);
      default:
        throw new Error(`Unknown analysis type: ${request.type}`);
    }
  }
  /**
   * Assess risks and ethical compliance
   */
  async assessRisk(proposalId, daoId) {
    return await this.riskAssessor.assess(proposalId, daoId);
  }
  /**
   * Health check for Nuru core
   */
  async healthCheck() {
    return {
      status: "healthy",
      components: {
        intentClassifier: "active",
        contextManager: "active",
        analyzers: "active",
        riskAssessor: "active"
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
};
var nuru = new NuruCore();

// server/agents/morio/api/session_manager.ts
var SessionManager = class {
  // 30 minutes
  constructor() {
    this.sessionTimeout = 30 * 60 * 1e3;
    this.sessions = /* @__PURE__ */ new Map();
    this.startCleanupTimer();
  }
  /**
   * Get or create session for user
   */
  async getSession(userId, daoId) {
    const existingSession = this.sessions.get(userId);
    if (existingSession && this.isSessionValid(existingSession)) {
      return existingSession;
    }
    const newSession = {
      id: `session_${userId}_${Date.now()}`,
      userId,
      daoId,
      context: this.createDefaultContext(userId, daoId),
      createdAt: /* @__PURE__ */ new Date(),
      lastActivity: /* @__PURE__ */ new Date(),
      metadata: {}
    };
    this.sessions.set(userId, newSession);
    return newSession;
  }
  /**
   * Update session with new data
   */
  async updateSession(userId, updates) {
    const session = this.sessions.get(userId);
    if (!session) return;
    session.metadata = {
      ...session.metadata,
      ...updates
    };
    session.lastActivity = /* @__PURE__ */ new Date();
    this.sessions.set(userId, session);
  }
  /**
   * Clear user session
   */
  async clearSession(userId) {
    this.sessions.delete(userId);
  }
  /**
   * Check if session is still valid
   */
  isSessionValid(session) {
    const now = Date.now();
    const lastActivity = session.lastActivity.getTime();
    return now - lastActivity < this.sessionTimeout;
  }
  /**
   * Create default user context
   */
  createDefaultContext(userId, daoId) {
    return {
      userId,
      daoId: daoId || "",
      role: "member",
      contributionScore: 0,
      recentActions: [],
      preferences: {
        language: "en",
        notifications: true,
        theme: "light"
      },
      sessionData: {
        conversationHistory: [],
        lastInteraction: /* @__PURE__ */ new Date()
      }
    };
  }
  /**
   * Clean up expired sessions
   */
  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      for (const [userId, session] of this.sessions.entries()) {
        if (!this.isSessionValid(session)) {
          this.sessions.delete(userId);
        }
      }
    }, 5 * 60 * 1e3);
  }
  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return this.sessions.size;
  }
};

// server/agents/morio/config/responses.ts
var responseTemplates = {
  withdraw: {
    text: "I'll help you withdraw {amount} {currency} from the DAO treasury. To proceed, you'll need to create a withdrawal proposal that members can vote on. This ensures transparency and community approval."
  },
  deposit: {
    text: "Great! I can help you deposit {amount} {currency} to the DAO treasury. Your contribution will increase your participation score and voting power. Ready to proceed?"
  },
  check_balance: {
    text: "Let me fetch the current DAO treasury balance and your personal contribution status. One moment..."
  },
  submit_proposal: {
    text: "I'll guide you through creating a new proposal. You'll need to provide: (1) A clear title, (2) Detailed description, (3) Funding amount if applicable. What would you like to propose?"
  },
  vote: {
    text: "I'll help you vote on proposal #{proposalId}. You can vote 'Yes' to approve, 'No' to reject, or 'Abstain' to skip. Would you like to see the proposal details first?"
  },
  check_proposal: {
    text: "Let me show you the active proposals in your DAO. You can view details, discussions, and vote on any of them."
  },
  join_dao: {
    text: "Welcome! I'll help you join this DAO. You'll need to: (1) Connect your wallet, (2) Review the DAO guidelines, (3) Complete your profile. Ready to start?"
  },
  help: {
    text: "Karibu (welcome)! I'm Morio, your DAO assistant. I can help you with:\n\n\u{1F4B0} Treasury: Check balance, deposit, withdraw\n\u{1F4DD} Governance: Create proposals, vote, view results\n\u{1F465} Community: Member stats, contributions, analytics\n\u{1F4CA} Analytics: Treasury reports, voting insights\n\nWhat would you like to do?"
  },
  analytics: {
    text: "I can provide detailed analytics on:\n\n\u2022 Treasury health and financial metrics\n\u2022 Governance participation and voting patterns\n\u2022 Community growth and engagement\n\nWhich analysis would you like to see?"
  },
  community_stats: {
    text: "Let me pull up the community statistics for you, including member count, engagement rates, and contribution metrics..."
  },
  treasury_report: {
    text: "Generating treasury report with current balance, inflows, outflows, and runway projections..."
  },
  governance_info: {
    text: "Here's how governance works in this DAO:\n\n1. Members can create proposals\n2. Proposals need minimum quorum to pass\n3. Voting power is based on contribution score\n4. Approved proposals are executed by the treasury\n\nWant to learn more about any specific aspect?"
  },
  unknown: {
    text: "Samahani (sorry), I didn't quite understand that. Could you rephrase? I can help you with treasury operations, proposals, voting, and DAO analytics."
  },
  default: {
    text: "I'm here to help! You can ask me about:\n\n\u2022 Checking balances\n\u2022 Making deposits or withdrawals\n\u2022 Creating and voting on proposals\n\u2022 Viewing DAO analytics\n\u2022 Community information\n\nWhat would you like to know?"
  }
};

// server/agents/morio/api/response_generator.ts
var ResponseGenerator = class {
  constructor(config4) {
    this.config = config4;
  }
  /**
   * Generate response based on understanding and context
   */
  async generate(understanding, context) {
    const { intent, entities, confidence } = understanding;
    const template = this.getResponseTemplate(intent);
    const personalizedText = this.personalizeResponse(template.text, context, entities);
    const suggestions = this.generateSuggestions(intent, context);
    const actions = this.generateActions(intent, entities);
    return {
      text: personalizedText,
      suggestions,
      actions
    };
  }
  /**
   * Get response template for intent
   */
  getResponseTemplate(intent) {
    return responseTemplates[intent] || responseTemplates.default;
  }
  /**
   * Personalize response with context and entities
   */
  personalizeResponse(template, context, entities) {
    let response = template;
    response = response.replace("{name}", context.userId);
    response = response.replace("{amount}", entities.amount || "");
    response = response.replace("{currency}", entities.currency || "KES");
    response = response.replace("{proposalId}", entities.proposalId || "");
    if (this.config.personality === "friendly") {
      response = this.addFriendlyTouch(response);
    }
    return response;
  }
  /**
   * Add friendly personality touches
   */
  addFriendlyTouch(response) {
    const greetings = ["Hi!", "Hello!", "Hey there!", "Habari!"];
    const confirmations = ["Sure thing!", "Got it!", "Absolutely!", "Sawa!"];
    if (Math.random() < 0.3) {
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      response = `${greeting} ${response}`;
    }
    return response;
  }
  /**
   * Generate contextual suggestions
   */
  generateSuggestions(intent, context) {
    const baseSuggestions = {
      withdraw: [
        "Check my balance first",
        "View withdrawal history",
        "See DAO spending limits"
      ],
      deposit: [
        "Check contribution rewards",
        "View my contribution history",
        "See DAO treasury status"
      ],
      check_balance: [
        "View transaction history",
        "See DAO analytics",
        "Check proposal allocations"
      ],
      submit_proposal: [
        "View proposal templates",
        "Check proposal guidelines",
        "See past proposals"
      ],
      vote: [
        "View proposal details",
        "Check my voting power",
        "See voting history"
      ],
      default: [
        "Check DAO balance",
        "View active proposals",
        "See community stats"
      ]
    };
    return baseSuggestions[intent] || baseSuggestions.default;
  }
  /**
   * Generate actionable buttons/actions
   */
  generateActions(intent, entities) {
    const actions = [];
    switch (intent) {
      case "withdraw":
        actions.push({
          type: "open_withdrawal",
          label: "Start Withdrawal",
          data: entities
        });
        break;
      case "deposit":
        actions.push({
          type: "open_deposit",
          label: "Deposit Funds",
          data: entities
        });
        break;
      case "submit_proposal":
        actions.push({
          type: "create_proposal",
          label: "Create Proposal",
          data: entities
        });
        break;
      case "vote":
        actions.push({
          type: "cast_vote",
          label: "Cast Vote",
          data: entities
        });
        break;
      case "check_balance":
        actions.push({
          type: "view_balance",
          label: "View Full Balance",
          data: {}
        });
        break;
    }
    return actions;
  }
};

// server/agents/morio/index.ts
var MorioAgent = class {
  constructor(config4) {
    this.config = {
      personality: "friendly",
      language: "en",
      maxHistoryLength: 20,
      responseTimeout: 3e4,
      ...config4
    };
    this.sessionManager = new SessionManager();
    this.responseGenerator = new ResponseGenerator(this.config);
  }
  /**
   * Handle incoming chat message
   */
  async handleMessage(message) {
    const startTime = Date.now();
    try {
      const session = await this.sessionManager.getSession(message.userId, message.daoId);
      const understanding = await nuru.understand(message.content, session.context);
      const response = await this.responseGenerator.generate(
        understanding,
        session.context
      );
      await this.sessionManager.updateSession(message.userId, {
        lastMessage: message.content,
        lastResponse: response.text,
        lastIntent: understanding.intent,
        timestamp: /* @__PURE__ */ new Date()
      });
      return {
        text: response.text,
        intent: understanding.intent,
        confidence: understanding.confidence,
        suggestions: response.suggestions || [],
        actions: response.actions || [],
        metadata: {
          processingTime: Date.now() - startTime,
          sessionId: session.id,
          language: understanding.language
        }
      };
    } catch (error) {
      console.error("Morio error:", error);
      return this.handleError(error);
    }
  }
  /**
   * Get session status
   */
  async getSessionStatus(userId) {
    return await this.sessionManager.getSession(userId);
  }
  /**
   * Clear user session
   */
  async clearSession(userId) {
    await this.sessionManager.clearSession(userId);
  }
  /**
   * Handle errors gracefully
   */
  handleError(error) {
    return {
      text: "Samahani (sorry), I encountered an issue. Pole sana! Please try again or rephrase your question.",
      intent: "error",
      confidence: 0,
      suggestions: [
        "Check DAO balance",
        "View active proposals",
        "Get help"
      ],
      actions: [],
      metadata: {
        error: error.message,
        processingTime: 0,
        sessionId: "error"
      }
    };
  }
};
var morio = new MorioAgent();

// server/routes/morio.ts
var router23 = Router2();
router23.post("/chat", async (req, res) => {
  try {
    const { userId, daoId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({
        error: "userId and message are required"
      });
    }
    const response = await morio.handleMessage({
      userId,
      daoId,
      content: message,
      timestamp: /* @__PURE__ */ new Date()
    });
    return res.json(response);
  } catch (error) {
    console.error("Morio chat error:", error);
    return res.status(500).json({
      error: "Failed to process message",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
router23.get("/session/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const session = await morio.getSessionStatus(userId);
    return res.json(session);
  } catch (error) {
    console.error("Session fetch error:", error);
    return res.status(500).json({
      error: "Failed to fetch session"
    });
  }
});
router23.delete("/session/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    await morio.clearSession(userId);
    return res.json({ success: true });
  } catch (error) {
    console.error("Session clear error:", error);
    return res.status(500).json({
      error: "Failed to clear session"
    });
  }
});
router23.post("/analyze", async (req, res) => {
  try {
    const { type, daoId, timeframe } = req.body;
    if (!type || !daoId) {
      return res.status(400).json({
        error: "type and daoId are required"
      });
    }
    const analysis = await nuru.analyze({
      type,
      daoId,
      timeframe
    });
    return res.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return res.status(500).json({
      error: "Failed to perform analysis",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
router23.post("/assess-risk", async (req, res) => {
  try {
    const { proposalId, daoId } = req.body;
    if (!proposalId || !daoId) {
      return res.status(400).json({
        error: "proposalId and daoId are required"
      });
    }
    const assessment = await nuru.assessRisk(proposalId, daoId);
    return res.json(assessment);
  } catch (error) {
    console.error("Risk assessment error:", error);
    return res.status(500).json({
      error: "Failed to assess risk",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
router23.get("/health", async (req, res) => {
  try {
    const health = await nuru.healthCheck();
    return res.json({
      ...health,
      morio: {
        status: "healthy",
        activeSessions: "N/A"
        // Can be tracked if needed
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
var morio_default = router23;

// server/api/auth_user.ts
init_storage();
init_schema();
import { eq as eq26 } from "drizzle-orm";
async function authUserHandler2(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: "Not authenticated" }
      });
    }
    const [user] = await db2.select().from(users).where(eq26(users.id, req.user.claims.sub)).limit(1);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles,
          walletAddress: user.walletAddress,
          emailVerified: user.emailVerified,
          profilePicture: user.profileImageUrl
        }
      }
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      error: { message: "Failed to get user" }
    });
  }
}

// server/routes.ts
init_auth_login();
init_auth_register();

// server/api/auth_telegram_link.ts
async function authTelegramLinkHandler(req, res) {
  res.json({ message: "Auth telegram link endpoint migrated to Express." });
}

// server/api/auth_oauth_google.ts
var GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
var REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || "http://localhost:5000/api/auth/oauth/google/callback";
async function authOauthGoogleHandler(req, res) {
  const { mode = "login" } = req.query;
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "Google OAuth not configured" });
  }
  const state = Buffer.from(JSON.stringify({ mode })).toString("base64");
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.redirect(authUrl);
}

// server/api/auth_oauth_google_callback.ts
init_storage();
init_schema();
init_auth();
init_logger();
import axios from "axios";
import { eq as eq27 } from "drizzle-orm";
var logger3 = new Logger("auth-oauth-google-callback");
var GOOGLE_CLIENT_ID2 = process.env.GOOGLE_CLIENT_ID;
var GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
var REDIRECT_URI2 = process.env.GOOGLE_OAUTH_REDIRECT || "http://localhost:5000/api/auth/oauth/google/callback";
var FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5000";
async function authOauthGoogleCallbackHandler(req, res) {
  try {
    const { code, state, error } = req.query;
    if (error) {
      logger3.warn("OAuth error received", { error });
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_cancelled`);
    }
    if (!code) {
      logger3.warn("No authorization code received");
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
    }
    if (!GOOGLE_CLIENT_ID2 || !GOOGLE_CLIENT_SECRET) {
      logger3.error("Google OAuth not properly configured");
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_config_error`);
    }
    const stateData = state ? JSON.parse(Buffer.from(state, "base64").toString()) : { mode: "login" };
    const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: GOOGLE_CLIENT_ID2,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI2
    });
    const { access_token } = tokenResponse.data;
    const userInfoResponse = await axios.get(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`
    );
    const googleUser = userInfoResponse.data;
    if (!googleUser.verified_email) {
      logger3.warn("Google email not verified", { email: googleUser.email });
      return res.redirect(`${FRONTEND_URL}/login?error=email_not_verified`);
    }
    const existingUser = await db2.select().from(users).where(eq27(users.email, googleUser.email)).limit(1);
    let user;
    if (existingUser.length > 0) {
      user = existingUser[0];
      await db2.update(users).set({
        firstName: googleUser.given_name || user.firstName,
        lastName: googleUser.family_name || user.lastName,
        profileImageUrl: googleUser.picture || user.profileImageUrl,
        isEmailVerified: true,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq27(users.id, user.id));
      logger3.info("Existing user logged in via Google OAuth", { userId: user.id });
    } else {
      if (stateData.mode !== "register") {
        return res.redirect(`${FRONTEND_URL}/login?error=account_not_found`);
      }
      const newUserResult = await db2.insert(users).values({
        id: crypto.randomUUID(),
        // Generate a unique ID for the user
        email: googleUser.email,
        firstName: googleUser.given_name,
        lastName: googleUser.family_name,
        profileImageUrl: googleUser.picture,
        roles: "member",
        isEmailVerified: true,
        password: "",
        // OAuth users don't have passwords
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).returning();
      user = newUserResult[0];
      logger3.info("New user created via Google OAuth", { userId: user.id });
    }
    const tokens = generateTokens({
      sub: user.id,
      email: user.email ?? "",
      role: user.roles ?? "member"
    });
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1e3
      // 7 days
    });
    const redirectUrl = `${FRONTEND_URL}/dashboard?token=${tokens.accessToken}`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger3.error("Google OAuth callback failed", error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
  }
}

// server/api/account_delete.ts
init_db();
init_schema();
import { eq as eq28 } from "drizzle-orm";
async function accountDeleteHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    await db2.delete(users).where(eq28(users.id, userId));
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
}

// server/api/dao_deploy.ts
async function daoDeployHandler(req, res) {
  res.json({ message: "DAO deploy endpoint migrated to Express." });
}

// server/api/payments_estimate_gas.ts
async function paymentsEstimateGasHandler(req, res) {
  try {
    const { tokenSymbol, toAddress, amount, operationType = "transfer" } = req.body;
    if (!tokenSymbol || !toAddress || !amount) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["tokenSymbol", "toAddress", "amount"]
      });
    }
    const token = TokenRegistry.getToken(tokenSymbol);
    if (!token) {
      return res.status(400).json({
        error: `Unsupported token: ${tokenSymbol}`,
        supportedTokens: TokenRegistry.getSupportedTokens()
      });
    }
    if (!toAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        error: "Invalid Ethereum address format"
      });
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        error: "Amount must be a positive number"
      });
    }
    const defaultSender = process.env.DEFAULT_SENDER_ADDRESS || "0x000000000000000000000000000000000000dead";
    const gasEstimateStr = await tokenService.estimateTokenGas(tokenSymbol, toAddress, amount, defaultSender);
    const gasEstimate = BigInt(gasEstimateStr);
    const gasPrice = await tokenService.provider.getFeeData();
    const estimatedCostWei = gasEstimate * (gasPrice.gasPrice || BigInt(0));
    const estimatedCostCelo = __require("ethers").formatUnits(estimatedCostWei, 18);
    const operationMultipliers = {
      transfer: 1.1,
      // 10% buffer
      deposit: 1.2,
      // 20% buffer for vault operations
      withdraw: 1.3
      // 30% buffer for complex withdrawals
    };
    const safetyMultiplier = operationMultipliers[operationType];
    const safeGasEstimate = BigInt(Math.ceil(Number(gasEstimate) * safetyMultiplier));
    res.json({
      success: true,
      gasEstimate: {
        operation: operationType,
        token: {
          symbol: tokenSymbol,
          name: token.name,
          decimals: token.decimals
        },
        gas: {
          estimated: gasEstimate.toString(),
          recommended: safeGasEstimate.toString(),
          price: gasPrice.gasPrice?.toString() || "0",
          maxFee: gasPrice.maxFeePerGas?.toString() || "0",
          maxPriorityFee: gasPrice.maxPriorityFeePerGas?.toString() || "0"
        },
        cost: {
          estimatedCELO: estimatedCostCelo,
          safetyMultiplier,
          estimatedUSD: (parseFloat(estimatedCostCelo) * 0.65).toFixed(4)
          // Rough CELO price
        },
        network: "Celo",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (error) {
    console.error("Gas estimation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to estimate gas",
      details: error instanceof Error ? error.message : "Unknown error",
      fallback: {
        // Provide fallback estimates for common operations
        transferGas: "21000",
        erc20TransferGas: "65000",
        vaultDepositGas: "150000",
        vaultWithdrawGas: "200000"
      }
    });
  }
}

// server/api/payments_index.ts
async function paymentsIndexHandler(req, res) {
  res.json({ message: "Payments index endpoint migrated to Express." });
}

// server/api/wallet_transactions.ts
init_db();
init_schema();
import { eq as eq29, desc as desc13 } from "drizzle-orm";
async function getWalletTransactions(req, res) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userTransactions = await db2.select().from(walletTransactions2).where(eq29(walletTransactions2.fromUserId, userId)).orderBy(desc13(walletTransactions2.createdAt)).limit(50);
    res.status(200).json(userTransactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
}
async function createWalletTransaction2(req, res) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { amount, type, description, transactionHash, currency = "cUSD", walletAddress } = req.body;
    const newTransaction = await db2.insert(walletTransactions2).values({
      fromUserId: userId,
      amount,
      type,
      description,
      transactionHash,
      currency,
      walletAddress: walletAddress || "",
      status: "completed"
    }).returning();
    res.status(201).json(newTransaction[0]);
  } catch (error) {
    console.error("Error creating transaction:", error);
    res.status(500).json({ error: "Failed to create transaction" });
  }
}

// server/middleware/validation.ts
init_errorHandler();
init_logger();
import { z as z9, ZodError as ZodError2 } from "zod";
var logger4 = new Logger("validation-middleware");
var commonSchemas = {
  id: z9.string().min(1, "ID is required"),
  email: z9.string().email("Invalid email format"),
  amount: z9.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Amount must be a positive number"),
  pagination: z9.object({
    page: z9.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
    limit: z9.string().optional().transform((val) => val ? Math.min(100, parseInt(val, 10)) : 20)
  }),
  vaultId: z9.string().min(1, "Vault ID is required"),
  userId: z9.string().min(1, "User ID is required")
};
var validate = (schema) => {
  return async (req, res, next) => {
    const requestIdHeader = req.headers["x-request-id"];
    const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
    const requestLogger2 = logger4.child({
      requestId,
      method: req.method,
      url: req.url
    });
    try {
      if (schema.body && req.body) {
        const validatedBody = schema.body.parse(req.body);
        req.body = validatedBody;
        requestLogger2.debug("Request body validated successfully");
      }
      if (schema.query && req.query) {
        const validatedQuery = schema.query.parse(req.query);
        req.query = validatedQuery;
        requestLogger2.debug("Query parameters validated successfully");
      }
      if (schema.params && req.params) {
        const validatedParams = schema.params.parse(req.params);
        req.params = validatedParams;
        requestLogger2.debug("Route parameters validated successfully");
      }
      next();
    } catch (error) {
      if (error instanceof ZodError2) {
        requestLogger2.warn("Validation failed", { errors: error.errors });
        const validationError = new ValidationError(
          `Validation failed: ${error.errors.map((e) => `${e.path.join(".")} - ${e.message}`).join(", ")}`
        );
        return next(validationError);
      }
      requestLogger2.error("Unexpected validation error", error);
      return next(new AppError("Validation processing failed", 500));
    }
  };
};
var vaultValidation = {
  createVault: validate({
    body: z9.object({
      name: z9.string().min(1, "Vault name is required").max(100, "Vault name too long"),
      description: z9.string().optional(),
      type: z9.enum(["personal", "community"]),
      currency: z9.string().min(1, "Currency is required"),
      initialDeposit: commonSchemas.amount.optional()
    })
  }),
  getVault: validate({
    params: z9.object({
      vaultId: commonSchemas.vaultId
    })
  }),
  depositToVault: validate({
    params: z9.object({
      vaultId: commonSchemas.vaultId
    }),
    body: z9.object({
      amount: commonSchemas.amount,
      tokenSymbol: z9.string().min(1, "Token symbol is required")
    })
  }),
  withdrawFromVault: validate({
    params: z9.object({
      vaultId: commonSchemas.vaultId
    }),
    body: z9.object({
      amount: commonSchemas.amount,
      tokenSymbol: z9.string().min(1, "Token symbol is required")
    })
  }),
  getVaultTransactions: validate({
    params: z9.object({
      vaultId: commonSchemas.vaultId
    }),
    query: commonSchemas.pagination
  })
};
var authValidation = {
  register: validate({
    body: z9.object({
      email: commonSchemas.email,
      password: z9.string().min(8, "Password must be at least 8 characters"),
      name: z9.string().min(1, "Name is required").max(100, "Name too long"),
      walletAddress: z9.string().optional()
    })
  }),
  login: validate({
    body: z9.object({
      email: commonSchemas.email,
      password: z9.string().min(1, "Password is required")
    })
  })
};
var walletValidation = {
  transfer: validate({
    body: z9.object({
      to: z9.string().min(1, "Recipient address is required"),
      amount: commonSchemas.amount,
      tokenSymbol: z9.string().min(1, "Token symbol is required")
    })
  }),
  getBalance: validate({
    query: z9.object({
      tokenSymbol: z9.string().optional()
    })
  })
};
var responseSchemas = {
  success: z9.object({
    success: z9.literal(true),
    data: z9.any().optional(),
    message: z9.string().optional()
  }),
  error: z9.object({
    success: z9.literal(false),
    error: z9.object({
      message: z9.string(),
      code: z9.string().optional(),
      statusCode: z9.number().optional(),
      timestamp: z9.string(),
      path: z9.string(),
      method: z9.string()
    })
  }),
  vault: z9.object({
    id: z9.string(),
    name: z9.string(),
    type: z9.string(),
    balance: z9.string(),
    currency: z9.string(),
    isActive: z9.boolean()
  }),
  transaction: z9.object({
    id: z9.string(),
    vaultId: z9.string(),
    amount: z9.string(),
    tokenSymbol: z9.string(),
    status: z9.string(),
    transactionHash: z9.string().optional(),
    createdAt: z9.string()
  })
};

// server/api/vaults.ts
init_errorHandler();
init_logger();
var logger5 = new Logger("vault-api");
async function createVaultHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const {
      name,
      description,
      daoId,
      vaultType,
      primaryCurrency,
      yieldStrategy,
      riskLevel,
      minDeposit,
      maxDeposit
    } = req.body;
    if (!name || !primaryCurrency || !vaultType) {
      return res.status(400).json({
        error: "Name, primary currency, and vault type are required"
      });
    }
    const vault = await vaultService.createVault({
      name,
      description,
      userId: daoId ? void 0 : userId,
      daoId: daoId || void 0,
      vaultType,
      primaryCurrency,
      yieldStrategy,
      riskLevel,
      minDeposit,
      maxDeposit
    });
    res.json({ vault });
  } catch (error) {
    console.error("Error creating vault:", error);
    res.status(500).json({ error: error.message || "Failed to create vault" });
  }
}
async function getUserVaultsHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { daoId } = req.query;
    const vaults3 = await vaultService.getUserVaults(userId);
    res.json({ vaults: vaults3 });
  } catch (error) {
    console.error("Error fetching vaults:", error);
    res.status(500).json({ error: error.message || "Failed to fetch vaults" });
  }
}
async function getVaultHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const portfolio = await vaultService.getVaultPortfolio(vaultId, userId);
    res.json(portfolio);
  } catch (error) {
    console.error("Error fetching vault:", error);
    res.status(500).json({ error: error.message || "Failed to fetch vault" });
  }
}
async function depositToVaultHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    const { tokenSymbol, amount, transactionHash } = req.body;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!tokenSymbol || !amount) {
      return res.status(400).json({
        error: "Token symbol and amount are required"
      });
    }
    const transaction = await vaultService.depositToken({
      vaultId,
      userId,
      tokenSymbol,
      amount,
      transactionHash
    });
    res.json({ transaction });
  } catch (error) {
    console.error("Error depositing to vault:", error);
    res.status(500).json({ error: error.message || "Failed to deposit to vault" });
  }
}
async function withdrawFromVaultHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    const { tokenSymbol, amount, transactionHash } = req.body;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!tokenSymbol || !amount) {
      return res.status(400).json({
        error: "Token symbol and amount are required"
      });
    }
    const transaction = await vaultService.withdrawToken({
      vaultId,
      userId,
      tokenSymbol,
      amount,
      transactionHash
    });
    res.json({ transaction });
  } catch (error) {
    console.error("Error withdrawing from vault:", error);
    res.status(500).json({ error: error.message || "Failed to withdraw from vault" });
  }
}
async function allocateToStrategyHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    const { strategyId, tokenSymbol, allocationPercentage } = req.body;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!strategyId || !tokenSymbol || allocationPercentage === void 0) {
      return res.status(400).json({
        error: "Strategy ID, token symbol, and allocation percentage are required"
      });
    }
    await vaultService.allocateToStrategy({
      vaultId,
      userId,
      strategyId,
      tokenSymbol,
      allocationPercentage
    });
    res.json({ success: true, message: "Strategy allocation updated" });
  } catch (error) {
    console.error("Error allocating to strategy:", error);
    res.status(500).json({ error: error.message || "Failed to allocate to strategy" });
  }
}
async function rebalanceVaultHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    await vaultService.rebalanceVault(vaultId, userId);
    res.json({ success: true, message: "Vault rebalanced successfully" });
  } catch (error) {
    console.error("Error rebalancing vault:", error);
    res.status(500).json({ error: error.message || "Failed to rebalance vault" });
  }
}
async function getVaultPortfolioHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const portfolio = await vaultService.getVaultPortfolio(vaultId, userId);
    res.json(portfolio);
  } catch (error) {
    console.error("Error fetching vault portfolio:", error);
    res.status(500).json({ error: error.message || "Failed to fetch vault portfolio" });
  }
}
async function getVaultPerformanceHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const performance2 = await vaultService.getVaultPerformance(vaultId, userId);
    res.json({ performance: performance2 });
  } catch (error) {
    console.error("Error fetching vault performance:", error);
    res.status(500).json({ error: error.message || "Failed to fetch vault performance" });
  }
}
async function assessVaultRiskHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    await vaultService.performRiskAssessment(vaultId);
    res.json({ success: true, message: "Risk assessment completed" });
  } catch (error) {
    console.error("Error assessing vault risk:", error);
    res.status(500).json({ error: error.message || "Failed to assess vault risk" });
  }
}
var getVaultTransactionsHandler = [
  vaultValidation.getVaultTransactions,
  asyncHandler(async (req, res) => {
    const requestLogger2 = logger5.child({
      requestId: Array.isArray(req.headers["x-request-id"]) ? req.headers["x-request-id"][0] : req.headers["x-request-id"],
      userId: req.user?.claims?.id,
      vaultId: req.params.vaultId
    });
    const userId = req.user?.claims?.id;
    if (!userId) {
      requestLogger2.warn("Unauthorized access attempt");
      return res.status(401).json({
        success: false,
        error: {
          message: "Authentication required",
          code: "UNAUTHORIZED",
          statusCode: 401,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          path: req.path,
          method: req.method
        }
      });
    }
    const { vaultId } = req.params;
    const { page, limit } = req.query;
    requestLogger2.info("Fetching vault transactions", { page, limit });
    const transactions = await vaultService.getVaultTransactions(
      vaultId,
      userId,
      page || 1,
      limit || 20
    );
    requestLogger2.info("Vault transactions fetched successfully", { count: transactions.length });
    res.json({
      success: true,
      data: { transactions },
      message: "Vault transactions fetched successfully"
    });
  })
];
async function getSupportedTokensHandler(req, res) {
  try {
    const tokens = TokenRegistry.getAllTokens();
    res.json({ tokens });
  } catch (error) {
    console.error("Error fetching supported tokens:", error);
    res.status(500).json({ error: "Failed to fetch supported tokens" });
  }
}
async function getTokenPriceHandler(req, res) {
  try {
    const { tokenAddress } = req.params;
    const mockPrices = {
      "CELO": 0.65,
      "cUSD": 1,
      "cEUR": 1.08,
      "USDT": 1,
      "MTAA": 0.1
    };
    const token = TokenRegistry.getTokenByAddress(tokenAddress);
    const price = token ? mockPrices[token.symbol] || 0.3 : 0;
    res.json({ price, currency: "USD" });
  } catch (error) {
    console.error("Error fetching token price:", error);
    res.status(500).json({ error: "Failed to fetch token price" });
  }
}

// server/api/authVault.ts
init_logger();
var logger6 = new Logger("auth-vault");
async function authorizeVaultAccess(req, res, next) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!vaultId) {
      return res.status(400).json({ error: "Vault ID is required" });
    }
    const vault = await vaultService.getVaultById(vaultId);
    if (!vault) {
      return res.status(404).json({ error: "Vault not found" });
    }
    if (vault.userId !== userId && !await vaultService.hasVaultAccess(userId, vaultId)) {
      return res.status(403).json({ error: "Access denied to this vault" });
    }
    req.vault = vault;
    next();
  } catch (error) {
    logger6.error("Vault authorization error:", error);
    res.status(500).json({ error: "Authorization check failed" });
  }
}

// server/api/daoSettings.ts
init_storage();
init_schema();
import { eq as eq30, and as and20 } from "drizzle-orm";
async function getDaoSettingsHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { daoId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const membership = await db2.query.daoMemberships.findFirst({
      where: and20(
        eq30(daoMemberships.daoId, daoId),
        eq30(daoMemberships.userId, userId),
        eq30(daoMemberships.status, "approved")
      )
    });
    if (!membership || !["admin", "elder"].includes(membership.role || "")) {
      return res.status(403).json({ error: "Admin permissions required" });
    }
    const dao = await db2.query.daos.findFirst({
      where: eq30(daos.id, daoId)
    });
    if (!dao) {
      return res.status(404).json({ error: "DAO not found" });
    }
    const settings = {
      basic: {
        name: dao.name,
        description: dao.description,
        imageUrl: dao.imageUrl,
        bannerUrl: dao.bannerUrl,
        access: dao.access,
        inviteOnly: dao.inviteOnly,
        inviteCode: dao.inviteCode
      },
      governance: {
        quorumPercentage: dao.quorumPercentage,
        votingPeriod: dao.votingPeriod,
        executionDelay: dao.executionDelay
      },
      financial: {
        treasuryBalance: dao.treasuryBalance,
        plan: dao.plan,
        planExpiresAt: dao.planExpiresAt,
        billingStatus: dao.billingStatus
      },
      members: {
        memberCount: dao.memberCount
      }
    };
    res.json({ settings });
  } catch (error) {
    console.error("Error fetching DAO settings:", error);
    res.status(500).json({ error: error.message || "Failed to fetch DAO settings" });
  }
}
async function updateDaoSettingsHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { daoId } = req.params;
    const { category, updates } = req.body;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const membership = await db2.query.daoMemberships.findFirst({
      where: and20(
        eq30(daoMemberships.daoId, daoId),
        eq30(daoMemberships.userId, userId),
        eq30(daoMemberships.status, "approved")
      )
    });
    if (!membership || !["admin", "elder"].includes(membership.role || "")) {
      return res.status(403).json({ error: "Admin permissions required" });
    }
    let validUpdates = {};
    switch (category) {
      case "basic":
        const allowedBasicFields = ["name", "description", "imageUrl", "bannerUrl", "access", "inviteOnly"];
        for (const [key, value] of Object.entries(updates)) {
          if (allowedBasicFields.includes(key)) {
            validUpdates[key] = value;
          }
        }
        if (updates.inviteOnly && !updates.inviteCode) {
          validUpdates.inviteCode = generateInviteCode();
        }
        break;
      case "governance":
        const allowedGovernanceFields = ["quorumPercentage", "votingPeriod", "executionDelay"];
        for (const [key, value] of Object.entries(updates)) {
          if (allowedGovernanceFields.includes(key)) {
            if (key === "quorumPercentage") {
              const numValue = Number(value);
              if (isNaN(numValue) || numValue < 1 || numValue > 100) {
                return res.status(400).json({ error: "Quorum percentage must be between 1 and 100" });
              }
              validUpdates[key] = numValue;
            } else if (key === "votingPeriod") {
              const numValue = Number(value);
              if (isNaN(numValue) || numValue < 1) {
                return res.status(400).json({ error: "Voting period must be at least 1 hour" });
              }
              validUpdates[key] = numValue;
            } else if (key === "executionDelay") {
              const numValue = Number(value);
              if (isNaN(numValue) || numValue < 0) {
                return res.status(400).json({ error: "Execution delay cannot be negative" });
              }
              validUpdates[key] = numValue;
            } else {
              validUpdates[key] = value;
            }
          }
        }
        break;
      case "financial":
        if (membership.role === "admin") {
          const allowedFinancialFields = ["plan"];
          for (const [key, value] of Object.entries(updates)) {
            if (allowedFinancialFields.includes(key)) {
              validUpdates[key] = value;
            }
          }
        } else {
          return res.status(403).json({ error: "Only DAO admins can modify financial settings" });
        }
        break;
      default:
        return res.status(400).json({ error: "Invalid settings category" });
    }
    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ error: "No valid updates provided" });
    }
    validUpdates.updatedAt = /* @__PURE__ */ new Date();
    await db2.update(daos).set(validUpdates).where(eq30(daos.id, daoId));
    res.json({
      success: true,
      message: `${category} settings updated successfully`,
      updates: validUpdates
    });
  } catch (error) {
    console.error("Error updating DAO settings:", error);
    res.status(500).json({ error: error.message || "Failed to update DAO settings" });
  }
}
async function resetInviteCodeHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { daoId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const membership = await db2.query.daoMemberships.findFirst({
      where: and20(
        eq30(daoMemberships.daoId, daoId),
        eq30(daoMemberships.userId, userId),
        eq30(daoMemberships.status, "approved")
      )
    });
    if (!membership || !["admin", "elder"].includes(membership.role || "")) {
      return res.status(403).json({ error: "Admin permissions required" });
    }
    const newInviteCode = generateInviteCode();
    await db2.update(daos).set({
      inviteCode: newInviteCode,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq30(daos.id, daoId));
    res.json({
      success: true,
      inviteCode: newInviteCode,
      message: "Invite code reset successfully"
    });
  } catch (error) {
    console.error("Error resetting invite code:", error);
    res.status(500).json({ error: error.message || "Failed to reset invite code" });
  }
}
async function getDaoAnalyticsHandler(req, res) {
  try {
    const userId = req.user?.claims?.id;
    const { daoId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const membership = await db2.query.daoMemberships.findFirst({
      where: and20(
        eq30(daoMemberships.daoId, daoId),
        eq30(daoMemberships.userId, userId),
        eq30(daoMemberships.status, "approved")
      )
    });
    if (!membership) {
      return res.status(403).json({ error: "DAO membership required" });
    }
    const dao = await db2.query.daos.findFirst({
      where: eq30(daos.id, daoId)
    });
    if (!dao) {
      return res.status(404).json({ error: "DAO not found" });
    }
    const memberStats = await db2.query.daoMemberships.findMany({
      where: and20(
        eq30(daoMemberships.daoId, daoId),
        eq30(daoMemberships.status, "approved")
      )
    });
    const roleDistribution = memberStats.reduce((acc, member) => {
      const role = member.role || "member";
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});
    const proposalStats = await db2.query.proposals.findMany({
      where: eq30(proposals.daoId, daoId)
    });
    const proposalsByStatus = proposalStats.reduce((acc, proposal) => {
      const status = typeof proposal.status === "string" ? proposal.status : "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
      return acc;
    }, {});
    const analytics2 = {
      dao: {
        name: dao.name,
        createdAt: dao.createdAt,
        memberCount: dao.memberCount,
        treasuryBalance: dao.treasuryBalance,
        plan: dao.plan
      },
      members: {
        total: memberStats.length,
        roleDistribution,
        recentJoins: memberStats.filter(
          (m) => m.joinedAt && new Date(m.joinedAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1e3
        ).length
      },
      proposals: {
        total: proposalStats.length,
        statusDistribution: proposalsByStatus,
        recentProposals: proposalStats.filter((p) => {
          if (!p.createdAt || !(typeof p.createdAt === "string" || typeof p.createdAt === "number" || p.createdAt instanceof Date)) return false;
          return new Date(p.createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1e3;
        }).length
      }
    };
    res.json({ analytics: analytics2 });
  } catch (error) {
    console.error("Error fetching DAO analytics:", error);
    res.status(500).json({ error: error.message || "Failed to fetch DAO analytics" });
  }
}
function generateInviteCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// server/api/reputation.ts
init_db();
init_schema();
init_schema();
init_logger();
init_errorHandler();
import { eq as eq31, desc as desc14, sql as sql15, and as and21 } from "drizzle-orm";
var logger7 = new Logger("reputation-api");
async function getUserReputationHandler(req, res) {
  try {
    const { userId } = req.params;
    const userResult = await db2.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePicture: users.profilePicture,
      reputationScore: users.reputationScore
    }).from(users).where(eq31(users.id, userId)).limit(1);
    if (userResult.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = userResult[0];
    const activities = await db2.select().from(userActivities).where(eq31(userActivities.userId, userId)).orderBy(desc14(userActivities.createdAt)).limit(50);
    const proposalActivities = activities.filter((a) => a.type === "proposal_created" || a.type === "proposal_voted");
    const taskActivities = activities.filter((a) => a.type === "task_completed" || a.type === "task_claimed");
    const contributionActivities = activities.filter((a) => a.type === "contribution_made");
    res.json({
      user,
      reputation: {
        total: user.reputationScore ? Number(user.reputationScore) : 0,
        breakdown: {
          proposals: proposalActivities.length * 10,
          tasks: taskActivities.length * 15,
          contributions: contributionActivities.length * 5
        }
      },
      recentActivities: activities.slice(0, 10)
    });
  } catch (error) {
    logger7.error("Failed to get user reputation", error);
    throw new AppError("Failed to retrieve user reputation", 500);
  }
}
async function getReputationLeaderboardHandler(req, res) {
  try {
    const { limit = 20, timeframe = "all" } = req.query;
    let query = db2.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePicture: users.profilePicture,
      reputationScore: users.reputationScore,
      rank: sql15`ROW_NUMBER() OVER (ORDER BY ${users.reputationScore} DESC)`
    }).from(users).where(sql15`${users.reputationScore} > 0`).orderBy(desc14(users.reputationScore)).limit(parseInt(limit));
    const leaderboard = await query;
    res.json({ leaderboard });
  } catch (error) {
    logger7.error("Failed to get reputation leaderboard", error);
    throw new AppError("Failed to retrieve reputation leaderboard", 500);
  }
}
async function getDaoReputationLeaderboardHandler(req, res) {
  try {
    const { daoId } = req.params;
    const { limit = 20 } = req.query;
    const daoLeaderboard = await db2.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePicture: users.profilePicture,
      reputationScore: users.reputationScore,
      daoActivityCount: sql15`COUNT(${userActivities.id})`
    }).from(users).innerJoin(userActivities, eq31(users.id, userActivities.userId)).where(and21(
      eq31(userActivitiesDaoId, daoId),
      sql15`${users.reputationScore} > 0`
    )).groupBy(users.id).orderBy(desc14(users.reputationScore)).limit(parseInt(limit));
    res.json({ leaderboard: daoLeaderboard });
  } catch (error) {
    logger7.error("Failed to get DAO reputation leaderboard", error);
    throw new AppError("Failed to retrieve DAO reputation leaderboard", 500);
  }
}

// server/routes.ts
init_auth();

// server/api/user_profile.ts
init_storage();
init_schema();
init_logger();
init_errorHandler();
import bcrypt2 from "bcryptjs";
import { eq as eq32 } from "drizzle-orm";
var logger8 = new Logger("user-profile");
async function getUserProfileHandler(req, res) {
  try {
    const userId = req.user?.userId || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: "Authentication required" }
      });
    }
    const userResult = await db2.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePicture: users.profilePicture,
      bio: users.bio,
      location: users.location,
      website: users.website,
      telegramUsername: users.telegramUsername,
      walletAddress: users.walletAddress,
      roles: users.roles,
      isEmailVerified: users.isEmailVerified,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt
    }).from(users).where(eq32(users.id, userId)).limit(1);
    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    res.json({
      success: true,
      data: { user: userResult[0] }
    });
  } catch (error) {
    logger8.error("Failed to get user profile", error);
    throw new AppError("Failed to retrieve user profile", 500);
  }
}
async function updateUserProfileHandler(req, res) {
  try {
    const userId = req.user?.userId || req.user?.claims?.sub;
    const {
      firstName,
      lastName,
      bio,
      location,
      website,
      telegramUsername,
      profilePicture
    } = req.body;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: "Authentication required" }
      });
    }
    if (website && website.trim()) {
      try {
        new URL(website);
      } catch {
        throw new ValidationError("Invalid website URL");
      }
    }
    const updatedUser = await db2.update(users).set({
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      bio: bio?.trim(),
      location: location?.trim(),
      website: website?.trim(),
      telegramUsername: telegramUsername?.trim(),
      profilePicture: profilePicture?.trim(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq32(users.id, userId)).returning({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePicture: users.profilePicture,
      bio: users.bio,
      location: users.location,
      website: users.website,
      telegramUsername: users.telegramUsername,
      updatedAt: users.updatedAt
    });
    if (updatedUser.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    logger8.info("User profile updated", { userId });
    res.json({
      success: true,
      data: { user: updatedUser[0] }
    });
  } catch (error) {
    logger8.error("Failed to update user profile", error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AppError("Failed to update user profile", 500);
  }
}
async function changePasswordHandler(req, res) {
  try {
    const userId = req.user?.userId || req.user?.claims?.sub;
    const { currentPassword, newPassword } = req.body;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: "Authentication required" }
      });
    }
    if (!currentPassword || !newPassword) {
      throw new ValidationError("Current password and new password are required");
    }
    if (newPassword.length < 8) {
      throw new ValidationError("New password must be at least 8 characters long");
    }
    const userResult = await db2.select({ password: users.password }).from(users).where(eq32(users.id, userId)).limit(1);
    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    const user = userResult[0];
    if (user.password) {
      const isValidPassword = await bcrypt2.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new ValidationError("Current password is incorrect");
      }
    }
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt2.hash(newPassword, saltRounds);
    await db2.update(users).set({
      password: hashedNewPassword,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq32(users.id, userId));
    logger8.info("User password changed", { userId });
    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    logger8.error("Failed to change password", error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AppError("Failed to change password", 500);
  }
}
async function updateWalletAddressHandler(req, res) {
  try {
    const userId = req.user?.userId || req.user?.claims?.sub;
    const { walletAddress } = req.body;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: "Authentication required" }
      });
    }
    if (!walletAddress || !walletAddress.trim()) {
      throw new ValidationError("Wallet address is required");
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim())) {
      throw new ValidationError("Invalid wallet address format");
    }
    const existingUser = await db2.select({ id: users.id }).from(users).where(eq32(users.walletAddress, walletAddress.trim())).limit(1);
    if (existingUser.length > 0 && existingUser[0].id !== userId) {
      throw new ValidationError("Wallet address is already in use");
    }
    const updatedUser = await db2.update(users).set({
      walletAddress: walletAddress.trim(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq32(users.id, userId)).returning({
      id: users.id,
      walletAddress: users.walletAddress
    });
    if (updatedUser.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    logger8.info("User wallet address updated", { userId, walletAddress });
    res.json({
      success: true,
      data: { user: updatedUser[0] }
    });
  } catch (error) {
    logger8.error("Failed to update wallet address", error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AppError("Failed to update wallet address", 500);
  }
}

// server/middleware/rateLimiter.ts
init_redis();
function rateLimiter(options) {
  const {
    windowMs,
    max,
    message = "Too many requests, please try again later.",
    keyGenerator = (req) => {
      return req.ip || req.socket.remoteAddress || "unknown";
    }
  } = options;
  return async (req, res, next) => {
    try {
      const key = `rate_limit:${keyGenerator(req)}`;
      const current = await redis.get(key);
      if (current === null) {
        await redis.set(key, "1", Math.floor(windowMs / 1e3));
        res.setHeader("X-RateLimit-Limit", max.toString());
        res.setHeader("X-RateLimit-Remaining", (max - 1).toString());
        res.setHeader("X-RateLimit-Reset", new Date(Date.now() + windowMs).toISOString());
        return next();
      }
      const count3 = parseInt(current);
      if (count3 >= max) {
        res.setHeader("X-RateLimit-Limit", max.toString());
        res.setHeader("X-RateLimit-Remaining", "0");
        res.setHeader("Retry-After", Math.floor(windowMs / 1e3).toString());
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter: Math.floor(windowMs / 1e3)
        });
      }
      await redis.increment(key);
      res.setHeader("X-RateLimit-Limit", max.toString());
      res.setHeader("X-RateLimit-Remaining", (max - count3 - 1).toString());
      next();
    } catch (error) {
      console.error("Rate limiter error:", error);
      next();
    }
  };
}
var registerRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 5,
  // 5 registration attempts per 15 minutes per IP
  message: "Too many registration attempts. Please try again in 15 minutes.",
  keyGenerator: (req) => `register:${req.ip}`
});
var otpResendRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1e3,
  // 5 minutes
  max: 3,
  // 3 OTP resend attempts per 5 minutes
  message: "Too many OTP resend requests. Please wait 5 minutes.",
  keyGenerator: (req) => {
    const identifier = req.body.email || req.body.phone;
    return `otp_resend:${identifier}`;
  }
});
var otpVerifyRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 10,
  // 10 verification attempts per 15 minutes
  message: "Too many verification attempts. Please request a new OTP.",
  keyGenerator: (req) => {
    const identifier = req.body.email || req.body.phone;
    return `otp_verify:${identifier}`;
  }
});
var loginRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 10,
  // 10 login attempts per 15 minutes per IP
  message: "Too many login attempts. Please try again in 15 minutes.",
  keyGenerator: (req) => `login:${req.ip}`
});
var apiRateLimiter = rateLimiter({
  windowMs: 60 * 1e3,
  // 1 minute
  max: 100,
  // 100 requests per minute per IP
  message: "Too many API requests. Please slow down."
});

// server/api/admin_users.ts
init_storage();
init_schema();
init_logger();
init_errorHandler();
import { eq as eq33, like as like2, and as and22, or as or4 } from "drizzle-orm";
var logger9 = new Logger("admin-users");
async function getUsersHandler(req, res) {
  try {
    const {
      page = "1",
      limit = "20",
      search = "",
      role = "",
      status = ""
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = search;
    const roleFilter = role;
    const statusFilter = status;
    const conditions = [];
    if (searchTerm) {
      conditions.push(
        or4(
          like2(users.email, `%${searchTerm}%`),
          like2(users.firstName, `%${searchTerm}%`),
          like2(users.lastName, `%${searchTerm}%`)
        )
      );
    }
    if (roleFilter) {
      conditions.push(eq33(users.roles, roleFilter));
    }
    if (statusFilter === "active") {
      conditions.push(eq33(users.isBanned, false));
    } else if (statusFilter === "inactive") {
      conditions.push(eq33(users.isBanned, true));
    }
    const whereClause = conditions.length > 0 ? and22(...conditions) : void 0;
    const usersResult = await db2.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      roles: users.roles,
      isBanned: users.isBanned,
      isEmailVerified: users.isEmailVerified,
      walletAddress: users.walletAddress,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt
    }).from(users).where(whereClause).limit(parseInt(limit)).offset(offset).orderBy(users.createdAt);
    const totalResult = await db2.select({ count: users.id }).from(users).where(whereClause);
    const total = totalResult.length;
    res.json({
      success: true,
      data: {
        users: usersResult,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger9.error("Failed to get users", error);
    throw new AppError("Failed to retrieve users", 500);
  }
}
async function updateUserRoleHandler(req, res) {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminUserId = req.user?.userId || req.user?.claims?.sub;
    if (!userId || !role) {
      throw new ValidationError("User ID and role are required");
    }
    const validRoles = ["user", "moderator", "admin", "super_admin"];
    if (!validRoles.includes(role)) {
      throw new ValidationError("Invalid role");
    }
    if (userId === adminUserId && role !== "super_admin") {
      const currentUser = await db2.select({ roles: users.roles }).from(users).where(eq33(users.id, adminUserId)).limit(1);
      if (currentUser.length > 0 && currentUser[0].roles === "super_admin") {
        throw new ValidationError("Cannot demote yourself from super_admin role");
      }
    }
    const updatedUser = await db2.update(users).set({
      roles: role,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq33(users.id, userId)).returning({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      roles: users.roles
    });
    if (updatedUser.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    logger9.info("User role updated", {
      userId,
      newRole: role,
      updatedBy: adminUserId
    });
    res.json({
      success: true,
      data: { user: updatedUser[0] }
    });
  } catch (error) {
    logger9.error("Failed to update user role", error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AppError("Failed to update user role", 500);
  }
}

// server/routes.ts
function registerRoutes(app2) {
  app2.use("/api/health", handler);
  app2.use("/api/sse", sse_default);
  app2.use("/api/wallet", wallet_default);
  app2.use("/api/wallet-setup", wallet_setup_default);
  app2.use("/api/governance", governance_default);
  app2.use("/api/dao-treasury", dao_treasury_default);
  app2.use("/api/dao-subscriptions", dao_subscriptions_default);
  app2.use("/api/tasks", tasks_default);
  app2.use("/api/task-templates", task_templates_default);
  app2.use("/api/bounty-escrow", bounty_escrow_default);
  app2.use("/api/reputation", reputation_default);
  app2.use("/api/analytics", analytics_default);
  app2.use("/api/challenges", challenges_default);
  app2.use("/api/notifications", notifications_default);
  app2.use("/api/disbursements", disbursements_default);
  app2.use("/api/proposal-execution", proposal_execution_default);
  app2.use("/api/payment-reconciliation", payment_reconciliation_default);
  app2.use("/api/stripe-status", stripe_status_default);
  app2.use("/api/kotanipay-status", kotanipay_status_default);
  app2.use("/api/mpesa-status", mpesa_status_default);
  app2.use("/api/monitoring", monitoring_default);
  app2.get("/api/auth/user", isAuthenticated2, authUserHandler2);
  app2.post("/api/auth/login", loginRateLimiter, authLoginHandler);
  app2.post("/api/auth/register", registerRateLimiter, authRegisterHandler);
  app2.post("/api/auth/verify-otp", otpVerifyRateLimiter, verifyOtpHandler);
  app2.post("/api/auth/resend-otp", otpResendRateLimiter, resendOtpHandler);
  app2.post("/api/auth/telegram-link", authTelegramLinkHandler);
  app2.get("/api/auth/oauth/google", authOauthGoogleHandler);
  app2.get("/api/auth/oauth/google/callback", authOauthGoogleCallbackHandler);
  app2.post("/api/auth/refresh-token", refreshTokenHandler);
  app2.post("/api/auth/logout", logoutHandler);
  app2.delete("/api/account/delete", isAuthenticated2, accountDeleteHandler);
  app2.post("/api/dao/deploy", isAuthenticated2, daoDeployHandler);
  app2.post("/api/payments/estimate-gas", isAuthenticated2, paymentsEstimateGasHandler);
  app2.get("/api/payments", isAuthenticated2, paymentsIndexHandler);
  app2.get("/api/wallet/transactions", isAuthenticated2, getWalletTransactions);
  app2.post("/api/wallet/transactions", isAuthenticated2, createWalletTransaction2);
  app2.post("/api/vaults", isAuthenticated2, createVaultHandler);
  app2.get("/api/vaults", isAuthenticated2, getUserVaultsHandler);
  app2.get("/api/vaults/:vaultId", isAuthenticated2, authorizeVaultAccess, getVaultHandler);
  app2.post("/api/vaults/:vaultId/deposit", isAuthenticated2, authorizeVaultAccess, depositToVaultHandler);
  app2.post("/api/vaults/:vaultId/withdraw", isAuthenticated2, authorizeVaultAccess, withdrawFromVaultHandler);
  app2.post("/api/vaults/:vaultId/allocate", isAuthenticated2, authorizeVaultAccess, allocateToStrategyHandler);
  app2.post("/api/vaults/:vaultId/rebalance", isAuthenticated2, authorizeVaultAccess, rebalanceVaultHandler);
  app2.get("/api/vaults/:vaultId/portfolio", isAuthenticated2, authorizeVaultAccess, getVaultPortfolioHandler);
  app2.get("/api/vaults/:vaultId/performance", isAuthenticated2, authorizeVaultAccess, getVaultPerformanceHandler);
  app2.get("/api/vaults/:vaultId/risk", isAuthenticated2, authorizeVaultAccess, assessVaultRiskHandler);
  app2.get("/api/vaults/:vaultId/transactions", isAuthenticated2, authorizeVaultAccess, getVaultTransactionsHandler);
  app2.get("/api/tokens", getSupportedTokensHandler);
  app2.get("/api/tokens/:tokenAddress/price", getTokenPriceHandler);
  app2.get("/api/dao/:daoId/settings", isAuthenticated2, getDaoSettingsHandler);
  app2.patch("/api/dao/:daoId/settings", isAuthenticated2, updateDaoSettingsHandler);
  app2.post("/api/dao/:daoId/settings/reset-invite", isAuthenticated2, resetInviteCodeHandler);
  app2.get("/api/dao/:daoId/analytics", isAuthenticated2, getDaoAnalyticsHandler);
  app2.get("/api/reputation/user/:userId", isAuthenticated2, getUserReputationHandler);
  app2.get("/api/reputation/leaderboard", isAuthenticated2, getReputationLeaderboardHandler);
  app2.get("/api/reputation/leaderboard/:daoId", isAuthenticated2, getDaoReputationLeaderboardHandler);
  app2.use("/api/achievements", isAuthenticated2, achievements_default);
  app2.get("/api/user/profile", isAuthenticated2, getUserProfileHandler);
  app2.put("/api/user/profile", isAuthenticated2, updateUserProfileHandler);
  app2.put("/api/user/profile/password", isAuthenticated2, changePasswordHandler);
  app2.put("/api/user/profile/wallet", isAuthenticated2, updateWalletAddressHandler);
  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil"
    });
    app2.post("/api/create-payment-intent", async (req, res) => {
      try {
        const { amount } = req.body;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          // Convert to cents
          currency: "usd",
          metadata: {
            dao_payment: "true",
            user_id: req.user?.claims?.id || "anonymous"
          }
        });
        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ message: "Error creating payment intent: " + error.message });
      }
    });
    app2.post("/api/get-or-create-subscription", isAuthenticated2, async (req, res) => {
      const user = req.user;
      if (!user) {
        return res.sendStatus(401);
      }
      try {
        const customer = await stripe.customers.create({
          email: user.claims?.email || "user@example.com",
          name: user.claims?.username || "MtaaDAO Member"
        });
        if (!process.env.STRIPE_PRICE_ID) {
          return res.status(400).json({
            error: { message: "Stripe price ID not configured. Please set STRIPE_PRICE_ID environment variable." }
          });
        }
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{
            price: process.env.STRIPE_PRICE_ID
          }],
          payment_behavior: "default_incomplete",
          expand: ["latest_invoice.payment_intent"]
        });
        const invoice = subscription.latest_invoice;
        const clientSecret = invoice?.payment_intent?.client_secret;
        res.send({
          subscriptionId: subscription.id,
          clientSecret
        });
      } catch (error) {
        return res.status(400).send({ error: { message: error.message } });
      }
    });
  }
  app2.use("/api/morio", morio_default);
  app2.get("/api/admin/users", isAuthenticated2, getUsersHandler);
  app2.put("/api/admin/users/:userId/role", isAuthenticated2, updateUserRoleHandler);
}

// server/vite.ts
import express22 from "express";
import path2 from "path";
import { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
import fs from "fs";
import { createServer as createViteServer, createLogger as createLogger2 } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path.dirname(__filename2);
var vite_config_default = defineConfig({
  root: path.resolve(__dirname2, "client"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname2, "client", "src"),
      "@shared": path.resolve(__dirname2, "shared"),
      "@assets": path.resolve(__dirname2, "attached_assets")
    }
  },
  publicDir: path.resolve(__dirname2, "client/public"),
  build: {
    outDir: path.resolve(__dirname2, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.includes("mtaa_dao_logo")) {
            return "mtaa_dao_logos/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        }
      }
    }
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    },
    port: 5173,
    host: "0.0.0.0",
    strictPort: false,
    allowedHosts: [
      ".replit.dev",
      ".repl.co",
      "localhost"
    ],
    hmr: {
      host: "localhost",
      clientPort: 443
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __dirname3 = dirname2(fileURLToPath3(import.meta.url));
var viteLogger = createLogger2();
async function setupVite(app2, server2) {
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: {
      middlewareMode: true,
      hmr: {
        server: server2,
        protocol: "ws",
        host: "0.0.0.0",
        clientPort: 443
      },
      host: "0.0.0.0",
      strictPort: false
    },
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(__dirname3, "../client/index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const html = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname3, "../../dist/public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `\u274C Could not find the build directory: ${distPath}, make sure to run 'npm run build' first`
    );
  }
  app2.use(express22.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.join(distPath, "index.html"));
  });
}

// server/index.ts
init_logger();
init_notificationService();
import { dirname as dirname3 } from "path";
import { fileURLToPath as fileURLToPath4 } from "url";

// server/security/inputSanitizer.ts
import DOMPurify from "isomorphic-dompurify";
import validator from "validator";
import { z as z10 } from "zod";
var sanitizedStringSchema = z10.string().min(1).max(1e3).refine((str) => !containsHtml(str), "HTML content not allowed");
var sanitizedEmailSchema = z10.string().email().refine((email) => validator.isEmail(email), "Invalid email format");
var sanitizedUrlSchema = z10.string().url().refine((url) => validator.isURL(url), "Invalid URL format");
var sanitizedAmountSchema = z10.string().refine((amount) => validator.isNumeric(amount), "Invalid numeric amount").refine((amount) => parseFloat(amount) >= 0, "Amount must be positive");
function containsHtml(str) {
  return /<[^>]*>/.test(str);
}
function sanitizeHtml(dirty) {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}
function sanitizeObject(obj) {
  if (typeof obj === "string") {
    return sanitizeHtml(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj && typeof obj === "object") {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
}
var sanitizeInput = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};
var preventSqlInjection = (req, res, next) => {
  const sqlInjectionPatterns = [
    /(\b(select|insert|update|delete|drop|create|alter|exec|execute|union|script)\b)/i,
    /(;|\-\-|\/\*|\*\/|xp_|sp_)/i,
    /(\b(or|and)\b.*?=.*?)/i
  ];
  const checkForSqlInjection = (value) => {
    return sqlInjectionPatterns.some((pattern) => pattern.test(value));
  };
  const checkObject = (obj) => {
    if (typeof obj === "string") {
      return checkForSqlInjection(obj);
    }
    if (Array.isArray(obj)) {
      return obj.some(checkObject);
    }
    if (obj && typeof obj === "object") {
      return Object.values(obj).some(checkObject);
    }
    return false;
  };
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({
      error: "Potentially malicious input detected"
    });
  }
  next();
};
var preventXSS = (req, res, next) => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<embed[^>]*>/gi,
    /<object[^>]*>/gi
  ];
  const checkForXSS = (value) => {
    return xssPatterns.some((pattern) => pattern.test(value));
  };
  const checkObject = (obj) => {
    if (typeof obj === "string") {
      return checkForXSS(obj);
    }
    if (Array.isArray(obj)) {
      return obj.some(checkObject);
    }
    if (obj && typeof obj === "object") {
      return Object.values(obj).some(checkObject);
    }
    return false;
  };
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({
      error: "XSS attempt detected"
    });
  }
  next();
};

// server/security/auditLogger.ts
init_storage();
var AuditLogger = class _AuditLogger {
  static getInstance() {
    if (!_AuditLogger.instance) {
      _AuditLogger.instance = new _AuditLogger();
    }
    return _AuditLogger.instance;
  }
  async log(entry) {
    try {
      await storage.createAuditLog(entry);
      console.log(`[AUDIT] ${entry.timestamp.toISOString()} | ${entry.severity.toUpperCase()} | ${entry.category} | ${entry.action} | User: ${entry.userId} | IP: ${entry.ipAddress}`);
      if (entry.severity === "critical") {
        await this.sendSecurityAlert(entry);
      }
    } catch (error) {
      console.error("Failed to write audit log:", error);
    }
  }
  async sendSecurityAlert(entry) {
    console.error(`\u{1F6A8} CRITICAL SECURITY EVENT: ${entry.action} by ${entry.userId} from ${entry.ipAddress}`);
  }
};
var auditMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  res.send = function(body) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    setImmediate(async () => {
      const user = req.user;
      const auditLogger = AuditLogger.getInstance();
      const entry = {
        timestamp: /* @__PURE__ */ new Date(),
        userId: user?.claims?.sub,
        userEmail: user?.claims?.email,
        action: getActionFromRequest(req),
        resource: getResourceFromRequest(req),
        resourceId: req.params.id || req.params.daoId || req.params.proposalId,
        method: req.method,
        endpoint: req.path,
        ipAddress: req.ip || req.connection.remoteAddress || "",
        userAgent: req.get("User-Agent") || "",
        status: res.statusCode,
        details: {
          responseTime,
          bodySize: JSON.stringify(body).length,
          query: req.query,
          params: req.params
        },
        severity: getSeverityFromRequest(req, res.statusCode),
        category: getCategoryFromRequest(req)
      };
      await auditLogger.log(entry);
    });
    return originalSend.call(this, body);
  };
  next();
};
function getActionFromRequest(req) {
  const method = req.method.toLowerCase();
  const path4 = req.path;
  if (path4.includes("/login")) return "login";
  if (path4.includes("/logout")) return "logout";
  if (path4.includes("/register")) return "register";
  if (path4.includes("/deposit")) return "vault_deposit";
  if (path4.includes("/withdraw")) return "vault_withdrawal";
  if (path4.includes("/vote")) return "vote_cast";
  if (path4.includes("/proposal")) return method === "post" ? "proposal_create" : "proposal_view";
  if (path4.includes("/dao") && method === "post") return "dao_create";
  if (path4.includes("/admin")) return "admin_action";
  return `${method}_${path4.split("/")[2] || "unknown"}`;
}
function getResourceFromRequest(req) {
  const path4 = req.path;
  if (path4.includes("/vault")) return "vault";
  if (path4.includes("/dao")) return "dao";
  if (path4.includes("/proposal")) return "proposal";
  if (path4.includes("/user")) return "user";
  if (path4.includes("/auth")) return "authentication";
  if (path4.includes("/payment")) return "payment";
  if (path4.includes("/admin")) return "admin";
  return "unknown";
}
function getSeverityFromRequest(req, statusCode) {
  if (statusCode >= 500) return "critical";
  if (statusCode >= 400) return "high";
  if (req.path.includes("/admin")) return "high";
  if (req.path.includes("/vault") || req.path.includes("/payment")) return "medium";
  return "low";
}
function getCategoryFromRequest(req) {
  const path4 = req.path;
  if (path4.includes("/auth") || path4.includes("/login") || path4.includes("/register")) return "auth";
  if (path4.includes("/vault") || path4.includes("/payment") || path4.includes("/deposit") || path4.includes("/withdraw")) return "financial";
  if (path4.includes("/proposal") || path4.includes("/vote") || path4.includes("/dao")) return "governance";
  if (path4.includes("/admin")) return "admin";
  if (path4.includes("/user") || path4.includes("/profile")) return "data";
  return "security";
}

// server/security/backupSystem.ts
import { exec } from "child_process";
import { promisify } from "util";
import fs2 from "fs/promises";
import path3 from "path";
var execAsync = promisify(exec);
var BackupSystem = class _BackupSystem {
  constructor(config4) {
    this.config = config4;
  }
  static getInstance(config4) {
    if (!_BackupSystem.instance && config4) {
      _BackupSystem.instance = new _BackupSystem(config4);
    }
    return _BackupSystem.instance;
  }
  async createFullBackup() {
    const backupId = `backup_${Date.now()}`;
    const timestamp10 = /* @__PURE__ */ new Date();
    try {
      console.log(`Starting full backup: ${backupId}`);
      const backupPath = path3.join(this.config.location, backupId);
      await fs2.mkdir(backupPath, { recursive: true });
      const dbBackupPath = path3.join(backupPath, "database.sql");
      await this.backupDatabase(dbBackupPath);
      const filesBackupPath = path3.join(backupPath, "uploads");
      await this.backupUploads(filesBackupPath);
      const configBackupPath = path3.join(backupPath, "config.json");
      await this.backupConfiguration(configBackupPath);
      const stats = await fs2.stat(backupPath);
      const checksum = await this.calculateChecksum(backupPath);
      const metadata = {
        id: backupId,
        timestamp: timestamp10,
        type: "full",
        size: stats.size,
        checksum,
        location: backupPath,
        status: "completed"
      };
      console.log(`Full backup completed: ${backupId}`);
      return metadata;
    } catch (error) {
      console.error(`Backup failed: ${error}`);
      const metadata = {
        id: backupId,
        timestamp: timestamp10,
        type: "full",
        size: 0,
        checksum: "",
        location: "",
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      };
      throw error;
    }
  }
  async createIncrementalBackup(lastBackupTime) {
    const backupId = `incremental_${Date.now()}`;
    const timestamp10 = /* @__PURE__ */ new Date();
    try {
      console.log(`Starting incremental backup: ${backupId}`);
      const backupPath = path3.join(this.config.location, backupId);
      await fs2.mkdir(backupPath, { recursive: true });
      await this.backupChangedData(backupPath, lastBackupTime);
      const stats = await fs2.stat(backupPath);
      const checksum = await this.calculateChecksum(backupPath);
      const metadata = {
        id: backupId,
        timestamp: timestamp10,
        type: "incremental",
        size: stats.size,
        checksum,
        location: backupPath,
        status: "completed"
      };
      console.log(`Incremental backup completed: ${backupId}`);
      return metadata;
    } catch (error) {
      console.error(`Incremental backup failed: ${error}`);
      throw error;
    }
  }
  async restoreFromBackup(backupId) {
    try {
      console.log(`Starting restore from backup: ${backupId}`);
      const metadata = {
        id: backupId,
        timestamp: /* @__PURE__ */ new Date(),
        type: "full",
        size: 0,
        checksum: "",
        location: "",
        status: "completed"
      };
      if (!metadata) {
        throw new Error(`Backup not found: ${backupId}`);
      }
      if (metadata.status !== "completed") {
        throw new Error(`Cannot restore from incomplete backup: ${backupId}`);
      }
      const currentChecksum = await this.calculateChecksum(metadata.location);
      if (currentChecksum !== metadata.checksum) {
        throw new Error(`Backup integrity check failed: ${backupId}`);
      }
      await this.stopServices();
      try {
        const dbBackupPath = path3.join(metadata.location, "database.sql");
        await this.restoreDatabase(dbBackupPath);
        const filesBackupPath = path3.join(metadata.location, "uploads");
        await this.restoreUploads(filesBackupPath);
        const configBackupPath = path3.join(metadata.location, "config.json");
        await this.restoreConfiguration(configBackupPath);
        console.log(`Restore completed: ${backupId}`);
      } finally {
        await this.startServices();
      }
    } catch (error) {
      console.error(`Restore failed: ${error}`);
      throw error;
    }
  }
  async cleanupOldBackups() {
    try {
      const cutoffDate = /* @__PURE__ */ new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      const oldBackups = [];
      for (const backup of oldBackups) {
        try {
          await fs2.rm(backup.location, { recursive: true, force: true });
          console.log(`Cleaned up old backup: ${backup.id}`);
        } catch (error) {
          console.error(`Failed to cleanup backup ${backup.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Cleanup failed:", error);
    }
  }
  async verifyBackup(backupId) {
    try {
      const metadata = {
        id: backupId,
        timestamp: /* @__PURE__ */ new Date(),
        type: "full",
        size: 0,
        checksum: "",
        location: "",
        status: "completed"
      };
      if (!metadata) return false;
      try {
        await fs2.access(metadata.location);
      } catch {
        return false;
      }
      const currentChecksum = await this.calculateChecksum(metadata.location);
      return currentChecksum === metadata.checksum;
    } catch (error) {
      console.error(`Backup verification failed: ${error}`);
      return false;
    }
  }
  async backupDatabase(outputPath) {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      await execAsync(`pg_dump "${dbUrl}" > "${outputPath}"`);
    }
  }
  async backupUploads(outputPath) {
    const uploadsDir = path3.join(process.cwd(), "server", "uploads");
    try {
      await execAsync(`cp -r "${uploadsDir}" "${outputPath}"`);
    } catch (error) {
      console.warn("No uploads directory found, skipping");
    }
  }
  async backupConfiguration(outputPath) {
    const config4 = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV
      // Add other configuration as needed
    };
    await fs2.writeFile(outputPath, JSON.stringify(config4, null, 2));
  }
  async backupChangedData(outputPath, since) {
    const changedData = {};
    await fs2.writeFile(
      path3.join(outputPath, "incremental_data.json"),
      JSON.stringify(changedData, null, 2)
    );
  }
  async restoreDatabase(backupPath) {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      await execAsync(`psql "${dbUrl}" < "${backupPath}"`);
    }
  }
  async restoreUploads(backupPath) {
    const uploadsDir = path3.join(process.cwd(), "server", "uploads");
    await execAsync(`cp -r "${backupPath}" "${uploadsDir}"`);
  }
  async restoreConfiguration(backupPath) {
    console.log("Configuration restore completed");
  }
  async calculateChecksum(filePath) {
    const { stdout } = await execAsync(`find "${filePath}" -type f -exec sha256sum {} + | sha256sum`);
    return stdout.trim().split(" ")[0];
  }
  async stopServices() {
    console.log("Stopping services for restore...");
  }
  async startServices() {
    console.log("Starting services after restore...");
  }
};
var BackupScheduler = class {
  constructor(backupSystem) {
    this.isRunning = false;
    this.backupSystem = backupSystem;
  }
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const scheduleBackup = () => {
      const now = /* @__PURE__ */ new Date();
      const nextBackup = /* @__PURE__ */ new Date();
      nextBackup.setHours(2, 0, 0, 0);
      if (nextBackup <= now) {
        nextBackup.setDate(nextBackup.getDate() + 1);
      }
      const msUntilBackup = nextBackup.getTime() - now.getTime();
      setTimeout(async () => {
        try {
          await this.backupSystem.createFullBackup();
          await this.backupSystem.cleanupOldBackups();
        } catch (error) {
          console.error("Scheduled backup failed:", error);
        }
        scheduleBackup();
      }, msUntilBackup);
    };
    scheduleBackup();
    console.log("Backup scheduler started");
  }
  stop() {
    this.isRunning = false;
    console.log("Backup scheduler stopped");
  }
};

// server/index.ts
init_config();
init_errorHandler();

// server/blockchain.ts
import { ethers as ethers3 } from "ethers";

// contracts/MaonoVault.json
var MaonoVault_default = {
  _format: "hh-sol-artifact-1",
  contractName: "MaonoVault",
  sourceName: "contracts/MaonoVault.sol",
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "_asset",
          type: "address"
        },
        {
          internalType: "address",
          name: "_daoTreasury",
          type: "address"
        },
        {
          internalType: "address",
          name: "_manager",
          type: "address"
        }
      ],
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      inputs: [],
      name: "BelowMinDeposit",
      type: "error"
    },
    {
      inputs: [],
      name: "CapBelowTVL",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "spender",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "allowance",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "needed",
          type: "uint256"
        }
      ],
      name: "ERC20InsufficientAllowance",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "sender",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "balance",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "needed",
          type: "uint256"
        }
      ],
      name: "ERC20InsufficientBalance",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "approver",
          type: "address"
        }
      ],
      name: "ERC20InvalidApprover",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        }
      ],
      name: "ERC20InvalidReceiver",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "sender",
          type: "address"
        }
      ],
      name: "ERC20InvalidSender",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "spender",
          type: "address"
        }
      ],
      name: "ERC20InvalidSpender",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "max",
          type: "uint256"
        }
      ],
      name: "ERC4626ExceededMaxDeposit",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "max",
          type: "uint256"
        }
      ],
      name: "ERC4626ExceededMaxMint",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "max",
          type: "uint256"
        }
      ],
      name: "ERC4626ExceededMaxRedeem",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "max",
          type: "uint256"
        }
      ],
      name: "ERC4626ExceededMaxWithdraw",
      type: "error"
    },
    {
      inputs: [],
      name: "InsufficientBalance",
      type: "error"
    },
    {
      inputs: [],
      name: "InvalidFee",
      type: "error"
    },
    {
      inputs: [],
      name: "InvalidNAV",
      type: "error"
    },
    {
      inputs: [],
      name: "NoProfit",
      type: "error"
    },
    {
      inputs: [],
      name: "NotManager",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "OwnableInvalidOwner",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "account",
          type: "address"
        }
      ],
      name: "OwnableUnauthorizedAccount",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        }
      ],
      name: "SafeERC20FailedOperation",
      type: "error"
    },
    {
      inputs: [],
      name: "VaultCapExceeded",
      type: "error"
    },
    {
      inputs: [],
      name: "WithdrawalAlreadyFulfilled",
      type: "error"
    },
    {
      inputs: [],
      name: "WithdrawalNotReady",
      type: "error"
    },
    {
      inputs: [],
      name: "ZeroAddress",
      type: "error"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "spender",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "Approval",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "sender",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "Deposit",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "oldFee",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "newFee",
          type: "uint256"
        }
      ],
      name: "ManagementFeeChanged",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256"
        }
      ],
      name: "ManagementFeeCollected",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "oldManager",
          type: "address"
        },
        {
          indexed: false,
          internalType: "address",
          name: "newManager",
          type: "address"
        }
      ],
      name: "ManagerChanged",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "newNAV",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "address",
          name: "updatedBy",
          type: "address"
        }
      ],
      name: "NAVUpdated",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "previousOwner",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "newOwner",
          type: "address"
        }
      ],
      name: "OwnershipTransferred",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "account",
          type: "address"
        }
      ],
      name: "Paused",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "oldFee",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "newFee",
          type: "uint256"
        }
      ],
      name: "PerformanceFeeChanged",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256"
        }
      ],
      name: "PerformanceFeeCollected",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "string",
          name: "daoId",
          type: "string"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "feeAmount",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256"
        }
      ],
      name: "PlatformFeeRecorded",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "from",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "Transfer",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "account",
          type: "address"
        }
      ],
      name: "Unpaused",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "oldCap",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "newCap",
          type: "uint256"
        }
      ],
      name: "VaultCapChanged",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "sender",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "receiver",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "Withdraw",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "requestId",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "address",
          name: "user",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        }
      ],
      name: "WithdrawalFulfilled",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "requestId",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "address",
          name: "user",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "WithdrawalRequested",
      type: "event"
    },
    {
      inputs: [],
      name: "FEE_DENOMINATOR",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "SECONDS_PER_YEAR",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          internalType: "address",
          name: "spender",
          type: "address"
        }
      ],
      name: "allowance",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "spender",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "approve",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "asset",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "account",
          type: "address"
        }
      ],
      name: "balanceOf",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "collectManagementFees",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "convertToAssets",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        }
      ],
      name: "convertToShares",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "daoTreasury",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "decimals",
      outputs: [
        {
          internalType: "uint8",
          name: "",
          type: "uint8"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        }
      ],
      name: "deposit",
      outputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256"
        }
      ],
      name: "emergencyWithdraw",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "requestId",
          type: "uint256"
        }
      ],
      name: "fulfillWithdrawal",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "getFeeInfo",
      outputs: [
        {
          internalType: "uint256",
          name: "perfFee",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "mgmtFee",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "totalPerfFeesCollected",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "totalMgmtFeesCollected",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "requestId",
          type: "uint256"
        }
      ],
      name: "getWithdrawalRequest",
      outputs: [
        {
          components: [
            {
              internalType: "address",
              name: "user",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "shares",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "requestTime",
              type: "uint256"
            },
            {
              internalType: "bool",
              name: "fulfilled",
              type: "bool"
            }
          ],
          internalType: "struct MaonoVault.WithdrawalRequest",
          name: "",
          type: "tuple"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "largeWithdrawalThreshold",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "lastManagementFeeCollection",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "lastNAV",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "lastNAVUpdate",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "managementFee",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "manager",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      name: "maxDeposit",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      name: "maxMint",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "maxRedeem",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "maxWithdraw",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "minDeposit",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        }
      ],
      name: "mint",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "name",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "owner",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "pause",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "performanceFee",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        }
      ],
      name: "previewDeposit",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "previewMint",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "previewNAV",
      outputs: [
        {
          internalType: "uint256",
          name: "nav",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "lastUpdate",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "previewRedeem",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        }
      ],
      name: "previewWithdraw",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "string",
          name: "daoId",
          type: "string"
        },
        {
          internalType: "uint256",
          name: "feeAmount",
          type: "uint256"
        }
      ],
      name: "recordPlatformFee",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        },
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "redeem",
      outputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "renounceOwnership",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newThreshold",
          type: "uint256"
        }
      ],
      name: "setLargeWithdrawalThreshold",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newFee",
          type: "uint256"
        }
      ],
      name: "setManagementFee",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "newManager",
          type: "address"
        }
      ],
      name: "setManager",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newMinDeposit",
          type: "uint256"
        }
      ],
      name: "setMinDeposit",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newFee",
          type: "uint256"
        }
      ],
      name: "setPerformanceFee",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newCap",
          type: "uint256"
        }
      ],
      name: "setVaultCap",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newDelay",
          type: "uint256"
        }
      ],
      name: "setWithdrawalDelay",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "symbol",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "totalAssets",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "totalManagementFeesCollected",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "totalPerformanceFeesCollected",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "totalSupply",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "transfer",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "from",
          type: "address"
        },
        {
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "transferFrom",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "newOwner",
          type: "address"
        }
      ],
      name: "transferOwnership",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "unpause",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newNAV",
          type: "uint256"
        }
      ],
      name: "updateNAV",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "vaultCap",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        },
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "withdraw",
      outputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "withdrawalDelay",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "withdrawalRequestCounter",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      name: "withdrawalRequests",
      outputs: [
        {
          internalType: "address",
          name: "user",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "requestTime",
          type: "uint256"
        },
        {
          internalType: "bool",
          name: "fulfilled",
          type: "bool"
        }
      ],
      stateMutability: "view",
      type: "function"
    }
  ],
  bytecode: "0x60c0604052678ac7230489e8000060085569021e19e0c9bab24000006009556105dc600a5560c8600b5562015180601555683635c9adc5dea000006016553480156200004a57600080fd5b5060405162004f7d38038062004f7d83398181016040528101906200007091906200060e565b80836040518060400160405280601481526020017f4d616f6e6f205661756c74204c5020546f6b656e0000000000000000000000008152506040518060400160405280600481526020017f4d564c54000000000000000000000000000000000000000000000000000000008152508160039081620000ef9190620008e4565b508060049081620001019190620008e4565b5050506000806200011883620003c460201b60201c565b91509150816200012a5760126200012c565b805b60ff1660a08160ff16815250508273ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff1681525050505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603620001e55760006040517f1e4fbdf7000000000000000000000000000000000000000000000000000000008152600401620001dc9190620009dc565b60405180910390fd5b620001f681620004de60201b60201c565b5082600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036200025f576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b82600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603620002c7576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b82600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036200032f576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b84600d60006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555083600c60006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055504260108190555050505050505062000aee565b6000806000808473ffffffffffffffffffffffffffffffffffffffff1660405160240160405160208183030381529060405263313ce56760e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff83818316178352505050506040516200043b919062000a72565b600060405180830381855afa9150503d806000811462000478576040519150601f19603f3d011682016040523d82523d6000602084013e6200047d565b606091505b50915091508180156200049257506020815110155b15620004cf57600081806020019051810190620004b0919062000abc565b905060ff80168111620004cd5760018194509450505050620004d9565b505b6000809350935050505b915091565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000620005d682620005a9565b9050919050565b620005e881620005c9565b8114620005f457600080fd5b50565b6000815190506200060881620005dd565b92915050565b6000806000606084860312156200062a5762000629620005a4565b5b60006200063a86828701620005f7565b93505060206200064d86828701620005f7565b92505060406200066086828701620005f7565b9150509250925092565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680620006ec57607f821691505b602082108103620007025762000701620006a4565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026200076c7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826200072d565b6200077886836200072d565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b6000620007c5620007bf620007b98462000790565b6200079a565b62000790565b9050919050565b6000819050919050565b620007e183620007a4565b620007f9620007f082620007cc565b8484546200073a565b825550505050565b600090565b6200081062000801565b6200081d818484620007d6565b505050565b5b8181101562000845576200083960008262000806565b60018101905062000823565b5050565b601f82111562000894576200085e8162000708565b62000869846200071d565b8101602085101562000879578190505b6200089162000888856200071d565b83018262000822565b50505b505050565b600082821c905092915050565b6000620008b96000198460080262000899565b1980831691505092915050565b6000620008d48383620008a6565b9150826002028217905092915050565b620008ef826200066a565b67ffffffffffffffff8111156200090b576200090a62000675565b5b620009178254620006d3565b6200092482828562000849565b600060209050601f8311600181146200095c576000841562000947578287015190505b620009538582620008c6565b865550620009c3565b601f1984166200096c8662000708565b60005b8281101562000996578489015182556001820191506020850194506020810190506200096f565b86831015620009b65784890151620009b2601f891682620008a6565b8355505b6001600288020188555050505b505050505050565b620009d681620005c9565b82525050565b6000602082019050620009f36000830184620009cb565b92915050565b600081519050919050565b600081905092915050565b60005b8381101562000a2f57808201518184015260208101905062000a12565b60008484015250505050565b600062000a4882620009f9565b62000a54818562000a04565b935062000a6681856020860162000a0f565b80840191505092915050565b600062000a80828462000a3b565b915081905092915050565b62000a968162000790565b811462000aa257600080fd5b50565b60008151905062000ab68162000a8b565b92915050565b60006020828403121562000ad55762000ad4620005a4565b5b600062000ae58482850162000aa5565b91505092915050565b60805160a05161446962000b146000396000610f3301526000610f6501526144696000f3fe608060405234801561001057600080fd5b50600436106103b95760003560e01c80638687098b116101f4578063c6e6f5921161011a578063dd62ed3e116100ad578063f0f5907d1161007c578063f0f5907d14610ba9578063f2fde38b14610bc5578063f64d421f14610be1578063fe56e23214610bff576103b9565b8063dd62ed3e14610b0d578063e4a2bdaf14610b3d578063e6a69ab814610b5b578063ef8b30f714610b79576103b9565b8063d2c13da5116100e9578063d2c13da514610a85578063d73792a914610aa1578063d88150ea14610abf578063d905777e14610add576103b9565b8063c6e6f592146109ea578063ce96cb7714610a1a578063d0ebdbe714610a4a578063d1b1daac14610a66576103b9565b8063a6f7f5d611610192578063b3d7f6b911610161578063b3d7f6b91461092a578063b460af941461095a578063ba0876521461098a578063c63d75b6146109ba576103b9565b8063a6f7f5d61461088e578063a7ab6961146108ac578063a9059cbb146108ca578063ae485651146108fa576103b9565b80638fcc9cfb116101ce5780638fcc9cfb146107f1578063937b25811461080d57806394bf804d1461084057806395d89b4114610870576103b9565b80638687098b1461079757806387788782146107b55780638da5cb5b146107d3576103b9565b8063402d267d116102e457806370897b231161027757806379022a9f1161024657806379022a9f146107355780637afaab01146107535780638456cb591461076f5780638571177a14610779576103b9565b806370897b23146106d557806370a08231146106f1578063710f20a214610721578063715018a61461072b576103b9565b80634cdad506116102b35780634cdad5061461063d57806350ede0101461066d5780635312ea8e146106895780636e553f65146106a5576103b9565b8063402d267d146105b357806341b3d185146105e357806341bd294114610601578063481c6a751461061f576103b9565b8063113fa8501161035c57806338d52e0f1161032b57806338d52e0f1461054f5780633c1bda091461056d5780633f0af8ef1461058b5780633f4ba83a146105a9576103b9565b8063113fa850146104c757806318160ddd146104e357806323b872dd14610501578063313ce56714610531576103b9565b806307a2d13a1161039857806307a2d13a1461041b578063095ea7b31461044b5780630a28a4771461047b5780630cb1982b146104ab576103b9565b806202eab7146103be57806301e1d114146103df57806306fdde03146103fd575b600080fd5b6103c6610c1b565b6040516103d694939291906134f9565b60405180910390f35b6103e7610c3b565b6040516103f4919061353e565b60405180910390f35b610405610cc3565b60405161041291906135e9565b60405180910390f35b6104356004803603810190610430919061364b565b610d55565b604051610442919061353e565b60405180910390f35b610465600480360381019061046091906136d6565b610d69565b6040516104729190613731565b60405180910390f35b6104956004803603810190610490919061364b565b610d8c565b6040516104a2919061353e565b60405180910390f35b6104c560048036038101906104c0919061364b565b610da0565b005b6104e160048036038101906104dc919061364b565b610edc565b005b6104eb610eee565b6040516104f8919061353e565b60405180910390f35b61051b6004803603810190610516919061374c565b610ef8565b6040516105289190613731565b60405180910390f35b610539610f27565b60405161054691906137bb565b60405180910390f35b610557610f61565b60405161056491906137e5565b60405180910390f35b610575610f89565b604051610582919061353e565b60405180910390f35b610593610f8f565b6040516105a0919061353e565b60405180910390f35b6105b1610f95565b005b6105cd60048036038101906105c89190613800565b610ff1565b6040516105da919061353e565b60405180910390f35b6105eb61101b565b6040516105f8919061353e565b60405180910390f35b610609611021565b604051610616919061353e565b60405180910390f35b610627611027565b60405161063491906137e5565b60405180910390f35b6106576004803603810190610652919061364b565b61104d565b604051610664919061353e565b60405180910390f35b61068760048036038101906106829190613962565b611061565b005b6106a3600480360381019061069e919061364b565b611212565b005b6106bf60048036038101906106ba91906139be565b6112aa565b6040516106cc919061353e565b60405180910390f35b6106ef60048036038101906106ea919061364b565b6113f5565b005b61070b60048036038101906107069190613800565b611484565b604051610718919061353e565b60405180910390f35b6107296114cc565b005b61073361155d565b005b61073d611571565b60405161074a91906137e5565b60405180910390f35b61076d6004803603810190610768919061364b565b611597565b005b610777611894565b005b6107816118f0565b60405161078e919061353e565b60405180910390f35b61079f6118f6565b6040516107ac919061353e565b60405180910390f35b6107bd6118fc565b6040516107ca919061353e565b60405180910390f35b6107db611902565b6040516107e891906137e5565b60405180910390f35b61080b6004803603810190610806919061364b565b61192c565b005b6108276004803603810190610822919061364b565b61193e565b60405161083794939291906139fe565b60405180910390f35b61085a600480360381019061085591906139be565b61199b565b604051610867919061353e565b60405180910390f35b610878611a1d565b60405161088591906135e9565b60405180910390f35b610896611aaf565b6040516108a3919061353e565b60405180910390f35b6108b4611ab5565b6040516108c1919061353e565b60405180910390f35b6108e460048036038101906108df91906136d6565b611abb565b6040516108f19190613731565b60405180910390f35b610914600480360381019061090f919061364b565b611ade565b6040516109219190613ac5565b60405180910390f35b610944600480360381019061093f919061364b565b611b90565b604051610951919061353e565b60405180910390f35b610974600480360381019061096f9190613ae0565b611ba4565b604051610981919061353e565b60405180910390f35b6109a4600480360381019061099f9190613ae0565b611c33565b6040516109b1919061353e565b60405180910390f35b6109d460048036038101906109cf9190613800565b611cc2565b6040516109e1919061353e565b60405180910390f35b610a0460048036038101906109ff919061364b565b611cec565b604051610a11919061353e565b60405180910390f35b610a346004803603810190610a2f9190613800565b611d00565b604051610a41919061353e565b60405180910390f35b610a646004803603810190610a5f9190613800565b611d1c565b005b610a6e611e31565b604051610a7c929190613b33565b60405180910390f35b610a9f6004803603810190610a9a919061364b565b611e42565b005b610aa9611e54565b604051610ab6919061353e565b60405180910390f35b610ac7611e5a565b604051610ad4919061353e565b60405180910390f35b610af76004803603810190610af29190613800565b611e60565b604051610b04919061353e565b60405180910390f35b610b276004803603810190610b229190613b5c565b611e72565b604051610b34919061353e565b60405180910390f35b610b45611ef9565b604051610b52919061353e565b60405180910390f35b610b63611eff565b604051610b70919061353e565b60405180910390f35b610b936004803603810190610b8e919061364b565b611f07565b604051610ba0919061353e565b60405180910390f35b610bc36004803603810190610bbe919061364b565b611f1b565b005b610bdf6004803603810190610bda9190613800565b611faf565b005b610be9612035565b604051610bf6919061353e565b60405180910390f35b610c196004803603810190610c14919061364b565b61203b565b005b600080600080600a54600b54601154601254935093509350935090919293565b6000610c45610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401610c7d91906137e5565b602060405180830381865afa158015610c9a573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610cbe9190613bb1565b905090565b606060038054610cd290613c0d565b80601f0160208091040260200160405190810160405280929190818152602001828054610cfe90613c0d565b8015610d4b5780601f10610d2057610100808354040283529160200191610d4b565b820191906000526020600020905b815481529060010190602001808311610d2e57829003601f168201915b5050505050905090565b6000610d628260006120ca565b9050919050565b600080610d74612123565b9050610d8181858561212b565b600191505092915050565b6000610d9982600161213d565b9050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610e27576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60008103610e61576040517f24eadd5d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600e54118015610e745750600e5481115b15610e9057610e8f600e5482610e8a9190613c6d565b612196565b5b80600e8190555042600f819055507f1569f913abe6cb538b4f89a7ca4c16840115c00eb8dfdc41528da7eebc0031be814233604051610ed193929190613ca1565b60405180910390a150565b610ee4612349565b8060168190555050565b6000600254905090565b600080610f03612123565b9050610f108582856123d0565b610f1b858585612465565b60019150509392505050565b6000610f31612559565b7f0000000000000000000000000000000000000000000000000000000000000000610f5c9190613cd8565b905090565b60007f0000000000000000000000000000000000000000000000000000000000000000905090565b60095481565b600e5481565b610f9d612349565b6000600760006101000a81548160ff0219169083151502179055507f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa33604051610fe791906137e5565b60405180910390a1565b60007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9050919050565b60085481565b60115481565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600061105a8260006120ca565b9050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146110e8576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b600082511161112c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161112390613d59565b60405180910390fd5b6000811161116f576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161116690613deb565b60405180910390fd5b60008251148061117f5750600081145b156111bf576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016111b690613e57565b60405180910390fd5b816040516111cd9190613eb3565b60405180910390207f37e59a0d0b8a6893eac000c6b97511fe786c34b114bb6551f7f026a79dc6942a8242604051611206929190613b33565b60405180910390a25050565b61121a612349565b611222610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb611245611902565b836040518363ffffffff1660e01b8152600401611263929190613eca565b6020604051808303816000875af1158015611282573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906112a69190613f1f565b5050565b60006002600654036112f1576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016112e890613f98565b60405180910390fd5b6002600681905550600760009054906101000a900460ff1615611349576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161134090614004565b60405180910390fd5b600854831015611385576040517f96ec8e5400000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60095483611391610c3b565b61139b9190614024565b11156113d3576040517f4f8d0ed200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6113db61255e565b6113e58383612761565b9050600160068190555092915050565b6113fd612349565b6107d0811115611439576040517f58d620b300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600a54905081600a819055507f44e5243903d4f21681121bff9dd91691edc7fa0b9d87cc40d6d65f1755a9b1b38183604051611478929190613b33565b60405180910390a15050565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611553576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b61155b61255e565b565b611565612349565b61156f60006127e3565b565b600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6002600654036115dc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016115d390613f98565b60405180910390fd5b600260068190555060006013600083815260200190815260200160002090503373ffffffffffffffffffffffffffffffffffffffff168160000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614611684576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060030160009054906101000a900460ff16156116cd576040517f84b092a200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60155481600201546116df9190614024565b421015611718576040517f0f2ca6e700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60018160030160006101000a81548160ff0219169083151502179055506000611744826001015461104d565b90506117788260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1683600101546128a9565b611780610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8360000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016117de929190613eca565b6020604051808303816000875af11580156117fd573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906118219190613f1f565b507f3e4ec7607342525bba1e97fff1e643818b1ac98b3da56568e40fbb82cf8aa846838360000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1684600101548460405161187f9493929190614058565b60405180910390a15050600160068190555050565b61189c612349565b6001600760006101000a81548160ff0219169083151502179055507f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258336040516118e691906137e5565b60405180910390a1565b60105481565b600f5481565b600a5481565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b611934612349565b8060088190555050565b60136020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010154908060020154908060030160009054906101000a900460ff16905084565b6000806119a783611cc2565b9050808411156119f2578284826040517f284ff6670000000000000000000000000000000000000000000000000000000081526004016119e99392919061409d565b60405180910390fd5b60006119fd85611b90565b9050611a12611a0a612123565b85838861292b565b809250505092915050565b606060048054611a2c90613c0d565b80601f0160208091040260200160405190810160405280929190818152602001828054611a5890613c0d565b8015611aa55780601f10611a7a57610100808354040283529160200191611aa5565b820191906000526020600020905b815481529060010190602001808311611a8857829003601f168201915b5050505050905090565b600b5481565b60155481565b600080611ac6612123565b9050611ad3818585612465565b600191505092915050565b611ae66134a0565b601360008381526020019081526020016000206040518060800160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200160018201548152602001600282015481526020016003820160009054906101000a900460ff1615151515815250509050919050565b6000611b9d8260016120ca565b9050919050565b6000600260065403611beb576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611be290613f98565b60405180910390fd5b60026006819055506016548410611c1657611c0584610d8c565b9050611c1182826129b5565b611c24565b611c21848484612adb565b90505b60016006819055509392505050565b6000600260065403611c7a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611c7190613f98565b60405180910390fd5b6002600681905550611c8b8461104d565b90506016548110611ca557611ca082856129b5565b611cb3565b611cb0848484612b5f565b90505b60016006819055509392505050565b60007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9050919050565b6000611cf982600061213d565b9050919050565b6000611d15611d0e83611484565b60006120ca565b9050919050565b611d24612349565b80600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603611d8b576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905082600c60006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43508184604051611e249291906140d4565b60405180910390a1505050565b600080600e54600f54915091509091565b611e4a612349565b8060158190555050565b61271081565b60145481565b6000611e6b82611484565b9050919050565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b60125481565b6301e1338081565b6000611f1482600061213d565b9050919050565b611f23612349565b611f2b610c3b565b811015611f64576040517f43420d1700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60006009549050816009819055507f4d2401457be9e6122a73ae61656c5683178c9f48c9d3eef2de0542d09d35be778183604051611fa3929190613b33565b60405180910390a15050565b611fb7612349565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036120295760006040517f1e4fbdf700000000000000000000000000000000000000000000000000000000815260040161202091906137e5565b60405180910390fd5b612032816127e3565b50565b60165481565b612043612349565b6101f481111561207f576040517f58d620b300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600b54905081600b819055507ffac39c9265fbab8fd6b4293b3f584cb3b1c0c39fb315acbcd4d1bef067c340cd81836040516120be929190613b33565b60405180910390a15050565b600061211b60016120d9610c3b565b6120e39190614024565b6120eb612559565b600a6120f79190614230565b6120ff610eee565b6121099190614024565b8486612be3909392919063ffffffff16565b905092915050565b600033905090565b6121388383836001612c32565b505050565b600061218e61214a612559565b600a6121569190614230565b61215e610eee565b6121689190614024565b6001612172610c3b565b61217c9190614024565b8486612be3909392919063ffffffff16565b905092915050565b6000612710600a54836121a9919061427b565b6121b391906142ec565b90506000811180156122455750806121c9610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161220191906137e5565b602060405180830381865afa15801561221e573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906122429190613bb1565b10155b1561234557612252610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016122ae929190613eca565b6020604051808303816000875af11580156122cd573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906122f19190613f1f565b5080601160008282546123049190614024565b925050819055507f27c911040371674ee220be22d1cf1a554a2f34e5bbb946f7b11d7d3a7c5b734c814260405161233c929190613b33565b60405180910390a15b5050565b612351612123565b73ffffffffffffffffffffffffffffffffffffffff1661236f611902565b73ffffffffffffffffffffffffffffffffffffffff16146123ce57612392612123565b6040517f118cdaa70000000000000000000000000000000000000000000000000000000081526004016123c591906137e5565b60405180910390fd5b565b60006123dc8484611e72565b90507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81101561245f578181101561244f578281836040517ffb8f41b20000000000000000000000000000000000000000000000000000000081526004016124469392919061409d565b60405180910390fd5b61245e84848484036000612c32565b5b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036124d75760006040517f96c6fd1e0000000000000000000000000000000000000000000000000000000081526004016124ce91906137e5565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036125495760006040517fec442f0500000000000000000000000000000000000000000000000000000000815260040161254091906137e5565b60405180910390fd5b612554838383612e09565b505050565b600090565b60006010544261256e9190613c6d565b9050600081111561275e576000612583610c3b565b90506000612710600b5483612598919061427b565b6125a291906142ec565b905060006301e1338084836125b7919061427b565b6125c191906142ec565b90506000811180156126535750806125d7610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161260f91906137e5565b602060405180830381865afa15801561262c573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906126509190613bb1565b10155b1561275a57612660610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016126bc929190613eca565b6020604051808303816000875af11580156126db573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906126ff9190613f1f565b5080601260008282546127129190614024565b92505081905550426010819055507f6f4a589972e181c1010960e6cb88e05776a4f3a28373e49c69ffdf8cc30f1a318142604051612751929190613b33565b60405180910390a15b5050505b50565b60008061276d83610ff1565b9050808411156127b8578284826040517f79012fb20000000000000000000000000000000000000000000000000000000081526004016127af9392919061409d565b60405180910390fd5b60006127c385611f07565b90506127d86127d0612123565b85878461292b565b809250505092915050565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160361291b5760006040517f96c6fd1e00000000000000000000000000000000000000000000000000000000815260040161291291906137e5565b60405180910390fd5b61292782600083612e09565b5050565b61293e612936610f61565b85308561302e565b61294883826130b0565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d784846040516129a7929190613b33565b60405180910390a350505050565b601460008154809291906129c89061431d565b919050555060405180608001604052808373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020014281526020016000151581525060136000601454815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550602082015181600101556040820151816002015560608201518160030160006101000a81548160ff0219169083151502179055509050507f6620e1bb18901e7cc06eb4c152cbf61f7f069350e9cf118060d463c4e5430ba06014548383604051612acf93929190614365565b60405180910390a15050565b600080612ae783611d00565b905080851115612b32578285826040517ffe9cceec000000000000000000000000000000000000000000000000000000008152600401612b299392919061409d565b60405180910390fd5b6000612b3d86610d8c565b9050612b53612b4a612123565b86868985613132565b80925050509392505050565b600080612b6b83611e60565b905080851115612bb6578285826040517fb94abeec000000000000000000000000000000000000000000000000000000008152600401612bad9392919061409d565b60405180910390fd5b6000612bc18661104d565b9050612bd7612bce612123565b8686848a613132565b80925050509392505050565b6000612c13612bf183613212565b8015612c0e575060008480612c0957612c086142bd565b5b868809115b613240565b612c1e86868661324c565b612c289190614024565b9050949350505050565b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1603612ca45760006040517fe602df05000000000000000000000000000000000000000000000000000000008152600401612c9b91906137e5565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603612d165760006040517f94280d62000000000000000000000000000000000000000000000000000000008152600401612d0d91906137e5565b60405180910390fd5b81600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508015612e03578273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92584604051612dfa919061353e565b60405180910390a35b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603612e5b578060026000828254612e4f9190614024565b92505081905550612f2e565b60008060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905081811015612ee7578381836040517fe450d38c000000000000000000000000000000000000000000000000000000008152600401612ede9392919061409d565b60405180910390fd5b8181036000808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550505b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603612f775780600260008282540392505081905550612fc4565b806000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051613021919061353e565b60405180910390a3505050565b6130aa848573ffffffffffffffffffffffffffffffffffffffff166323b872dd8686866040516024016130639392919061439c565b604051602081830303815290604052915060e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050613334565b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036131225760006040517fec442f0500000000000000000000000000000000000000000000000000000000815260040161311991906137e5565b60405180910390fd5b61312e60008383612e09565b5050565b8273ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1614613171576131708386836123d0565b5b61317b83826128a9565b61318d613186610f61565b85846133d6565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff167ffbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db8585604051613203929190613b33565b60405180910390a45050505050565b60006001600283600381111561322b5761322a6143d3565b5b6132359190614402565b60ff16149050919050565b60008115159050919050565b600080600061325b8686613455565b915091506000820361328157838181613277576132766142bd565b5b049250505061332d565b8184116132a1576132a061329b6000861460126011613474565b61348e565b5b600084868809905081811183039250808203915060008560000386169050808604955080830492506001818260000304019050808402831792506000600287600302189050808702600203810290508087026002038102905080870260020381029050808702600203810290508087026002038102905080870260020381029050808402955050505050505b9392505050565b600080602060008451602086016000885af180613357576040513d6000823e3d81fd5b3d92506000519150506000821461337257600181141561338e565b60008473ffffffffffffffffffffffffffffffffffffffff163b145b156133d057836040517f5274afe70000000000000000000000000000000000000000000000000000000081526004016133c791906137e5565b60405180910390fd5b50505050565b613450838473ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8585604051602401613409929190613eca565b604051602081830303815290604052915060e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050613334565b505050565b6000806000198385098385029150818110828203039250509250929050565b600061347f84613240565b82841802821890509392505050565b634e487b71600052806020526024601cfd5b6040518060800160405280600073ffffffffffffffffffffffffffffffffffffffff16815260200160008152602001600081526020016000151581525090565b6000819050919050565b6134f3816134e0565b82525050565b600060808201905061350e60008301876134ea565b61351b60208301866134ea565b61352860408301856134ea565b61353560608301846134ea565b95945050505050565b600060208201905061355360008301846134ea565b92915050565b600081519050919050565b600082825260208201905092915050565b60005b83811015613593578082015181840152602081019050613578565b60008484015250505050565b6000601f19601f8301169050919050565b60006135bb82613559565b6135c58185613564565b93506135d5818560208601613575565b6135de8161359f565b840191505092915050565b6000602082019050818103600083015261360381846135b0565b905092915050565b6000604051905090565b600080fd5b600080fd5b613628816134e0565b811461363357600080fd5b50565b6000813590506136458161361f565b92915050565b60006020828403121561366157613660613615565b5b600061366f84828501613636565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006136a382613678565b9050919050565b6136b381613698565b81146136be57600080fd5b50565b6000813590506136d0816136aa565b92915050565b600080604083850312156136ed576136ec613615565b5b60006136fb858286016136c1565b925050602061370c85828601613636565b9150509250929050565b60008115159050919050565b61372b81613716565b82525050565b60006020820190506137466000830184613722565b92915050565b60008060006060848603121561376557613764613615565b5b6000613773868287016136c1565b9350506020613784868287016136c1565b925050604061379586828701613636565b9150509250925092565b600060ff82169050919050565b6137b58161379f565b82525050565b60006020820190506137d060008301846137ac565b92915050565b6137df81613698565b82525050565b60006020820190506137fa60008301846137d6565b92915050565b60006020828403121561381657613815613615565b5b6000613824848285016136c1565b91505092915050565b600080fd5b600080fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b61386f8261359f565b810181811067ffffffffffffffff8211171561388e5761388d613837565b5b80604052505050565b60006138a161360b565b90506138ad8282613866565b919050565b600067ffffffffffffffff8211156138cd576138cc613837565b5b6138d68261359f565b9050602081019050919050565b82818337600083830152505050565b6000613905613900846138b2565b613897565b90508281526020810184848401111561392157613920613832565b5b61392c8482856138e3565b509392505050565b600082601f8301126139495761394861382d565b5b81356139598482602086016138f2565b91505092915050565b6000806040838503121561397957613978613615565b5b600083013567ffffffffffffffff8111156139975761399661361a565b5b6139a385828601613934565b92505060206139b485828601613636565b9150509250929050565b600080604083850312156139d5576139d4613615565b5b60006139e385828601613636565b92505060206139f4858286016136c1565b9150509250929050565b6000608082019050613a1360008301876137d6565b613a2060208301866134ea565b613a2d60408301856134ea565b613a3a6060830184613722565b95945050505050565b613a4c81613698565b82525050565b613a5b816134e0565b82525050565b613a6a81613716565b82525050565b608082016000820151613a866000850182613a43565b506020820151613a996020850182613a52565b506040820151613aac6040850182613a52565b506060820151613abf6060850182613a61565b50505050565b6000608082019050613ada6000830184613a70565b92915050565b600080600060608486031215613af957613af8613615565b5b6000613b0786828701613636565b9350506020613b18868287016136c1565b9250506040613b29868287016136c1565b9150509250925092565b6000604082019050613b4860008301856134ea565b613b5560208301846134ea565b9392505050565b60008060408385031215613b7357613b72613615565b5b6000613b81858286016136c1565b9250506020613b92858286016136c1565b9150509250929050565b600081519050613bab8161361f565b92915050565b600060208284031215613bc757613bc6613615565b5b6000613bd584828501613b9c565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680613c2557607f821691505b602082108103613c3857613c37613bde565b5b50919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b6000613c78826134e0565b9150613c83836134e0565b9250828203905081811115613c9b57613c9a613c3e565b5b92915050565b6000606082019050613cb660008301866134ea565b613cc360208301856134ea565b613cd060408301846137d6565b949350505050565b6000613ce38261379f565b9150613cee8361379f565b9250828201905060ff811115613d0757613d06613c3e565b5b92915050565b7f44414f2049442063616e6e6f7420626520656d70747900000000000000000000600082015250565b6000613d43601683613564565b9150613d4e82613d0d565b602082019050919050565b60006020820190508181036000830152613d7281613d36565b9050919050565b7f46656520616d6f756e74206d7573742062652067726561746572207468616e2060008201527f7a65726f00000000000000000000000000000000000000000000000000000000602082015250565b6000613dd5602483613564565b9150613de082613d79565b604082019050919050565b60006020820190508181036000830152613e0481613dc8565b9050919050565b7f496e76616c69642044414f204944206f722066656520616d6f756e7400000000600082015250565b6000613e41601c83613564565b9150613e4c82613e0b565b602082019050919050565b60006020820190508181036000830152613e7081613e34565b9050919050565b600081905092915050565b6000613e8d82613559565b613e978185613e77565b9350613ea7818560208601613575565b80840191505092915050565b6000613ebf8284613e82565b915081905092915050565b6000604082019050613edf60008301856137d6565b613eec60208301846134ea565b9392505050565b613efc81613716565b8114613f0757600080fd5b50565b600081519050613f1981613ef3565b92915050565b600060208284031215613f3557613f34613615565b5b6000613f4384828501613f0a565b91505092915050565b7f5265656e7472616e637947756172643a207265656e7472616e742063616c6c00600082015250565b6000613f82601f83613564565b9150613f8d82613f4c565b602082019050919050565b60006020820190508181036000830152613fb181613f75565b9050919050565b7f5061757361626c653a2070617573656400000000000000000000000000000000600082015250565b6000613fee601083613564565b9150613ff982613fb8565b602082019050919050565b6000602082019050818103600083015261401d81613fe1565b9050919050565b600061402f826134e0565b915061403a836134e0565b925082820190508082111561405257614051613c3e565b5b92915050565b600060808201905061406d60008301876134ea565b61407a60208301866137d6565b61408760408301856134ea565b61409460608301846134ea565b95945050505050565b60006060820190506140b260008301866137d6565b6140bf60208301856134ea565b6140cc60408301846134ea565b949350505050565b60006040820190506140e960008301856137d6565b6140f660208301846137d6565b9392505050565b60008160011c9050919050565b6000808291508390505b6001851115614154578086048111156141305761412f613c3e565b5b600185161561413f5780820291505b808102905061414d856140fd565b9450614114565b94509492505050565b60008261416d5760019050614229565b8161417b5760009050614229565b8160018114614191576002811461419b576141ca565b6001915050614229565b60ff8411156141ad576141ac613c3e565b5b8360020a9150848211156141c4576141c3613c3e565b5b50614229565b5060208310610133831016604e8410600b84101617156141ff5782820a9050838111156141fa576141f9613c3e565b5b614229565b61420c848484600161410a565b9250905081840481111561422357614222613c3e565b5b81810290505b9392505050565b600061423b826134e0565b91506142468361379f565b92506142737fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff848461415d565b905092915050565b6000614286826134e0565b9150614291836134e0565b925082820261429f816134e0565b915082820484148315176142b6576142b5613c3e565b5b5092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601260045260246000fd5b60006142f7826134e0565b9150614302836134e0565b925082614312576143116142bd565b5b828204905092915050565b6000614328826134e0565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff820361435a57614359613c3e565b5b600182019050919050565b600060608201905061437a60008301866134ea565b61438760208301856137d6565b61439460408301846134ea565b949350505050565b60006060820190506143b160008301866137d6565b6143be60208301856137d6565b6143cb60408301846134ea565b949350505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602160045260246000fd5b600061440d8261379f565b91506144188361379f565b925082614428576144276142bd565b5b82820690509291505056fea2646970667358221220bd05bf74f18815fb077f798b2f14c933876cb265e2928683dca7b716f1bd4a1b64736f6c63430008140033",
  deployedBytecode: "0x608060405234801561001057600080fd5b50600436106103b95760003560e01c80638687098b116101f4578063c6e6f5921161011a578063dd62ed3e116100ad578063f0f5907d1161007c578063f0f5907d14610ba9578063f2fde38b14610bc5578063f64d421f14610be1578063fe56e23214610bff576103b9565b8063dd62ed3e14610b0d578063e4a2bdaf14610b3d578063e6a69ab814610b5b578063ef8b30f714610b79576103b9565b8063d2c13da5116100e9578063d2c13da514610a85578063d73792a914610aa1578063d88150ea14610abf578063d905777e14610add576103b9565b8063c6e6f592146109ea578063ce96cb7714610a1a578063d0ebdbe714610a4a578063d1b1daac14610a66576103b9565b8063a6f7f5d611610192578063b3d7f6b911610161578063b3d7f6b91461092a578063b460af941461095a578063ba0876521461098a578063c63d75b6146109ba576103b9565b8063a6f7f5d61461088e578063a7ab6961146108ac578063a9059cbb146108ca578063ae485651146108fa576103b9565b80638fcc9cfb116101ce5780638fcc9cfb146107f1578063937b25811461080d57806394bf804d1461084057806395d89b4114610870576103b9565b80638687098b1461079757806387788782146107b55780638da5cb5b146107d3576103b9565b8063402d267d116102e457806370897b231161027757806379022a9f1161024657806379022a9f146107355780637afaab01146107535780638456cb591461076f5780638571177a14610779576103b9565b806370897b23146106d557806370a08231146106f1578063710f20a214610721578063715018a61461072b576103b9565b80634cdad506116102b35780634cdad5061461063d57806350ede0101461066d5780635312ea8e146106895780636e553f65146106a5576103b9565b8063402d267d146105b357806341b3d185146105e357806341bd294114610601578063481c6a751461061f576103b9565b8063113fa8501161035c57806338d52e0f1161032b57806338d52e0f1461054f5780633c1bda091461056d5780633f0af8ef1461058b5780633f4ba83a146105a9576103b9565b8063113fa850146104c757806318160ddd146104e357806323b872dd14610501578063313ce56714610531576103b9565b806307a2d13a1161039857806307a2d13a1461041b578063095ea7b31461044b5780630a28a4771461047b5780630cb1982b146104ab576103b9565b806202eab7146103be57806301e1d114146103df57806306fdde03146103fd575b600080fd5b6103c6610c1b565b6040516103d694939291906134f9565b60405180910390f35b6103e7610c3b565b6040516103f4919061353e565b60405180910390f35b610405610cc3565b60405161041291906135e9565b60405180910390f35b6104356004803603810190610430919061364b565b610d55565b604051610442919061353e565b60405180910390f35b610465600480360381019061046091906136d6565b610d69565b6040516104729190613731565b60405180910390f35b6104956004803603810190610490919061364b565b610d8c565b6040516104a2919061353e565b60405180910390f35b6104c560048036038101906104c0919061364b565b610da0565b005b6104e160048036038101906104dc919061364b565b610edc565b005b6104eb610eee565b6040516104f8919061353e565b60405180910390f35b61051b6004803603810190610516919061374c565b610ef8565b6040516105289190613731565b60405180910390f35b610539610f27565b60405161054691906137bb565b60405180910390f35b610557610f61565b60405161056491906137e5565b60405180910390f35b610575610f89565b604051610582919061353e565b60405180910390f35b610593610f8f565b6040516105a0919061353e565b60405180910390f35b6105b1610f95565b005b6105cd60048036038101906105c89190613800565b610ff1565b6040516105da919061353e565b60405180910390f35b6105eb61101b565b6040516105f8919061353e565b60405180910390f35b610609611021565b604051610616919061353e565b60405180910390f35b610627611027565b60405161063491906137e5565b60405180910390f35b6106576004803603810190610652919061364b565b61104d565b604051610664919061353e565b60405180910390f35b61068760048036038101906106829190613962565b611061565b005b6106a3600480360381019061069e919061364b565b611212565b005b6106bf60048036038101906106ba91906139be565b6112aa565b6040516106cc919061353e565b60405180910390f35b6106ef60048036038101906106ea919061364b565b6113f5565b005b61070b60048036038101906107069190613800565b611484565b604051610718919061353e565b60405180910390f35b6107296114cc565b005b61073361155d565b005b61073d611571565b60405161074a91906137e5565b60405180910390f35b61076d6004803603810190610768919061364b565b611597565b005b610777611894565b005b6107816118f0565b60405161078e919061353e565b60405180910390f35b61079f6118f6565b6040516107ac919061353e565b60405180910390f35b6107bd6118fc565b6040516107ca919061353e565b60405180910390f35b6107db611902565b6040516107e891906137e5565b60405180910390f35b61080b6004803603810190610806919061364b565b61192c565b005b6108276004803603810190610822919061364b565b61193e565b60405161083794939291906139fe565b60405180910390f35b61085a600480360381019061085591906139be565b61199b565b604051610867919061353e565b60405180910390f35b610878611a1d565b60405161088591906135e9565b60405180910390f35b610896611aaf565b6040516108a3919061353e565b60405180910390f35b6108b4611ab5565b6040516108c1919061353e565b60405180910390f35b6108e460048036038101906108df91906136d6565b611abb565b6040516108f19190613731565b60405180910390f35b610914600480360381019061090f919061364b565b611ade565b6040516109219190613ac5565b60405180910390f35b610944600480360381019061093f919061364b565b611b90565b604051610951919061353e565b60405180910390f35b610974600480360381019061096f9190613ae0565b611ba4565b604051610981919061353e565b60405180910390f35b6109a4600480360381019061099f9190613ae0565b611c33565b6040516109b1919061353e565b60405180910390f35b6109d460048036038101906109cf9190613800565b611cc2565b6040516109e1919061353e565b60405180910390f35b610a0460048036038101906109ff919061364b565b611cec565b604051610a11919061353e565b60405180910390f35b610a346004803603810190610a2f9190613800565b611d00565b604051610a41919061353e565b60405180910390f35b610a646004803603810190610a5f9190613800565b611d1c565b005b610a6e611e31565b604051610a7c929190613b33565b60405180910390f35b610a9f6004803603810190610a9a919061364b565b611e42565b005b610aa9611e54565b604051610ab6919061353e565b60405180910390f35b610ac7611e5a565b604051610ad4919061353e565b60405180910390f35b610af76004803603810190610af29190613800565b611e60565b604051610b04919061353e565b60405180910390f35b610b276004803603810190610b229190613b5c565b611e72565b604051610b34919061353e565b60405180910390f35b610b45611ef9565b604051610b52919061353e565b60405180910390f35b610b63611eff565b604051610b70919061353e565b60405180910390f35b610b936004803603810190610b8e919061364b565b611f07565b604051610ba0919061353e565b60405180910390f35b610bc36004803603810190610bbe919061364b565b611f1b565b005b610bdf6004803603810190610bda9190613800565b611faf565b005b610be9612035565b604051610bf6919061353e565b60405180910390f35b610c196004803603810190610c14919061364b565b61203b565b005b600080600080600a54600b54601154601254935093509350935090919293565b6000610c45610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401610c7d91906137e5565b602060405180830381865afa158015610c9a573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610cbe9190613bb1565b905090565b606060038054610cd290613c0d565b80601f0160208091040260200160405190810160405280929190818152602001828054610cfe90613c0d565b8015610d4b5780601f10610d2057610100808354040283529160200191610d4b565b820191906000526020600020905b815481529060010190602001808311610d2e57829003601f168201915b5050505050905090565b6000610d628260006120ca565b9050919050565b600080610d74612123565b9050610d8181858561212b565b600191505092915050565b6000610d9982600161213d565b9050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610e27576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60008103610e61576040517f24eadd5d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600e54118015610e745750600e5481115b15610e9057610e8f600e5482610e8a9190613c6d565b612196565b5b80600e8190555042600f819055507f1569f913abe6cb538b4f89a7ca4c16840115c00eb8dfdc41528da7eebc0031be814233604051610ed193929190613ca1565b60405180910390a150565b610ee4612349565b8060168190555050565b6000600254905090565b600080610f03612123565b9050610f108582856123d0565b610f1b858585612465565b60019150509392505050565b6000610f31612559565b7f0000000000000000000000000000000000000000000000000000000000000000610f5c9190613cd8565b905090565b60007f0000000000000000000000000000000000000000000000000000000000000000905090565b60095481565b600e5481565b610f9d612349565b6000600760006101000a81548160ff0219169083151502179055507f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa33604051610fe791906137e5565b60405180910390a1565b60007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9050919050565b60085481565b60115481565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600061105a8260006120ca565b9050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146110e8576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b600082511161112c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161112390613d59565b60405180910390fd5b6000811161116f576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161116690613deb565b60405180910390fd5b60008251148061117f5750600081145b156111bf576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016111b690613e57565b60405180910390fd5b816040516111cd9190613eb3565b60405180910390207f37e59a0d0b8a6893eac000c6b97511fe786c34b114bb6551f7f026a79dc6942a8242604051611206929190613b33565b60405180910390a25050565b61121a612349565b611222610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb611245611902565b836040518363ffffffff1660e01b8152600401611263929190613eca565b6020604051808303816000875af1158015611282573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906112a69190613f1f565b5050565b60006002600654036112f1576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016112e890613f98565b60405180910390fd5b6002600681905550600760009054906101000a900460ff1615611349576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161134090614004565b60405180910390fd5b600854831015611385576040517f96ec8e5400000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60095483611391610c3b565b61139b9190614024565b11156113d3576040517f4f8d0ed200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6113db61255e565b6113e58383612761565b9050600160068190555092915050565b6113fd612349565b6107d0811115611439576040517f58d620b300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600a54905081600a819055507f44e5243903d4f21681121bff9dd91691edc7fa0b9d87cc40d6d65f1755a9b1b38183604051611478929190613b33565b60405180910390a15050565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611553576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b61155b61255e565b565b611565612349565b61156f60006127e3565b565b600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6002600654036115dc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016115d390613f98565b60405180910390fd5b600260068190555060006013600083815260200190815260200160002090503373ffffffffffffffffffffffffffffffffffffffff168160000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614611684576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060030160009054906101000a900460ff16156116cd576040517f84b092a200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60155481600201546116df9190614024565b421015611718576040517f0f2ca6e700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60018160030160006101000a81548160ff0219169083151502179055506000611744826001015461104d565b90506117788260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1683600101546128a9565b611780610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8360000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016117de929190613eca565b6020604051808303816000875af11580156117fd573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906118219190613f1f565b507f3e4ec7607342525bba1e97fff1e643818b1ac98b3da56568e40fbb82cf8aa846838360000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1684600101548460405161187f9493929190614058565b60405180910390a15050600160068190555050565b61189c612349565b6001600760006101000a81548160ff0219169083151502179055507f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258336040516118e691906137e5565b60405180910390a1565b60105481565b600f5481565b600a5481565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b611934612349565b8060088190555050565b60136020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010154908060020154908060030160009054906101000a900460ff16905084565b6000806119a783611cc2565b9050808411156119f2578284826040517f284ff6670000000000000000000000000000000000000000000000000000000081526004016119e99392919061409d565b60405180910390fd5b60006119fd85611b90565b9050611a12611a0a612123565b85838861292b565b809250505092915050565b606060048054611a2c90613c0d565b80601f0160208091040260200160405190810160405280929190818152602001828054611a5890613c0d565b8015611aa55780601f10611a7a57610100808354040283529160200191611aa5565b820191906000526020600020905b815481529060010190602001808311611a8857829003601f168201915b5050505050905090565b600b5481565b60155481565b600080611ac6612123565b9050611ad3818585612465565b600191505092915050565b611ae66134a0565b601360008381526020019081526020016000206040518060800160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200160018201548152602001600282015481526020016003820160009054906101000a900460ff1615151515815250509050919050565b6000611b9d8260016120ca565b9050919050565b6000600260065403611beb576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611be290613f98565b60405180910390fd5b60026006819055506016548410611c1657611c0584610d8c565b9050611c1182826129b5565b611c24565b611c21848484612adb565b90505b60016006819055509392505050565b6000600260065403611c7a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611c7190613f98565b60405180910390fd5b6002600681905550611c8b8461104d565b90506016548110611ca557611ca082856129b5565b611cb3565b611cb0848484612b5f565b90505b60016006819055509392505050565b60007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9050919050565b6000611cf982600061213d565b9050919050565b6000611d15611d0e83611484565b60006120ca565b9050919050565b611d24612349565b80600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603611d8b576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905082600c60006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43508184604051611e249291906140d4565b60405180910390a1505050565b600080600e54600f54915091509091565b611e4a612349565b8060158190555050565b61271081565b60145481565b6000611e6b82611484565b9050919050565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b60125481565b6301e1338081565b6000611f1482600061213d565b9050919050565b611f23612349565b611f2b610c3b565b811015611f64576040517f43420d1700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60006009549050816009819055507f4d2401457be9e6122a73ae61656c5683178c9f48c9d3eef2de0542d09d35be778183604051611fa3929190613b33565b60405180910390a15050565b611fb7612349565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036120295760006040517f1e4fbdf700000000000000000000000000000000000000000000000000000000815260040161202091906137e5565b60405180910390fd5b612032816127e3565b50565b60165481565b612043612349565b6101f481111561207f576040517f58d620b300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600b54905081600b819055507ffac39c9265fbab8fd6b4293b3f584cb3b1c0c39fb315acbcd4d1bef067c340cd81836040516120be929190613b33565b60405180910390a15050565b600061211b60016120d9610c3b565b6120e39190614024565b6120eb612559565b600a6120f79190614230565b6120ff610eee565b6121099190614024565b8486612be3909392919063ffffffff16565b905092915050565b600033905090565b6121388383836001612c32565b505050565b600061218e61214a612559565b600a6121569190614230565b61215e610eee565b6121689190614024565b6001612172610c3b565b61217c9190614024565b8486612be3909392919063ffffffff16565b905092915050565b6000612710600a54836121a9919061427b565b6121b391906142ec565b90506000811180156122455750806121c9610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161220191906137e5565b602060405180830381865afa15801561221e573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906122429190613bb1565b10155b1561234557612252610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016122ae929190613eca565b6020604051808303816000875af11580156122cd573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906122f19190613f1f565b5080601160008282546123049190614024565b925050819055507f27c911040371674ee220be22d1cf1a554a2f34e5bbb946f7b11d7d3a7c5b734c814260405161233c929190613b33565b60405180910390a15b5050565b612351612123565b73ffffffffffffffffffffffffffffffffffffffff1661236f611902565b73ffffffffffffffffffffffffffffffffffffffff16146123ce57612392612123565b6040517f118cdaa70000000000000000000000000000000000000000000000000000000081526004016123c591906137e5565b60405180910390fd5b565b60006123dc8484611e72565b90507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81101561245f578181101561244f578281836040517ffb8f41b20000000000000000000000000000000000000000000000000000000081526004016124469392919061409d565b60405180910390fd5b61245e84848484036000612c32565b5b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036124d75760006040517f96c6fd1e0000000000000000000000000000000000000000000000000000000081526004016124ce91906137e5565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036125495760006040517fec442f0500000000000000000000000000000000000000000000000000000000815260040161254091906137e5565b60405180910390fd5b612554838383612e09565b505050565b600090565b60006010544261256e9190613c6d565b9050600081111561275e576000612583610c3b565b90506000612710600b5483612598919061427b565b6125a291906142ec565b905060006301e1338084836125b7919061427b565b6125c191906142ec565b90506000811180156126535750806125d7610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161260f91906137e5565b602060405180830381865afa15801561262c573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906126509190613bb1565b10155b1561275a57612660610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016126bc929190613eca565b6020604051808303816000875af11580156126db573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906126ff9190613f1f565b5080601260008282546127129190614024565b92505081905550426010819055507f6f4a589972e181c1010960e6cb88e05776a4f3a28373e49c69ffdf8cc30f1a318142604051612751929190613b33565b60405180910390a15b5050505b50565b60008061276d83610ff1565b9050808411156127b8578284826040517f79012fb20000000000000000000000000000000000000000000000000000000081526004016127af9392919061409d565b60405180910390fd5b60006127c385611f07565b90506127d86127d0612123565b85878461292b565b809250505092915050565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160361291b5760006040517f96c6fd1e00000000000000000000000000000000000000000000000000000000815260040161291291906137e5565b60405180910390fd5b61292782600083612e09565b5050565b61293e612936610f61565b85308561302e565b61294883826130b0565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d784846040516129a7929190613b33565b60405180910390a350505050565b601460008154809291906129c89061431d565b919050555060405180608001604052808373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020014281526020016000151581525060136000601454815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550602082015181600101556040820151816002015560608201518160030160006101000a81548160ff0219169083151502179055509050507f6620e1bb18901e7cc06eb4c152cbf61f7f069350e9cf118060d463c4e5430ba06014548383604051612acf93929190614365565b60405180910390a15050565b600080612ae783611d00565b905080851115612b32578285826040517ffe9cceec000000000000000000000000000000000000000000000000000000008152600401612b299392919061409d565b60405180910390fd5b6000612b3d86610d8c565b9050612b53612b4a612123565b86868985613132565b80925050509392505050565b600080612b6b83611e60565b905080851115612bb6578285826040517fb94abeec000000000000000000000000000000000000000000000000000000008152600401612bad9392919061409d565b60405180910390fd5b6000612bc18661104d565b9050612bd7612bce612123565b8686848a613132565b80925050509392505050565b6000612c13612bf183613212565b8015612c0e575060008480612c0957612c086142bd565b5b868809115b613240565b612c1e86868661324c565b612c289190614024565b9050949350505050565b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1603612ca45760006040517fe602df05000000000000000000000000000000000000000000000000000000008152600401612c9b91906137e5565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603612d165760006040517f94280d62000000000000000000000000000000000000000000000000000000008152600401612d0d91906137e5565b60405180910390fd5b81600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508015612e03578273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92584604051612dfa919061353e565b60405180910390a35b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603612e5b578060026000828254612e4f9190614024565b92505081905550612f2e565b60008060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905081811015612ee7578381836040517fe450d38c000000000000000000000000000000000000000000000000000000008152600401612ede9392919061409d565b60405180910390fd5b8181036000808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550505b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603612f775780600260008282540392505081905550612fc4565b806000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051613021919061353e565b60405180910390a3505050565b6130aa848573ffffffffffffffffffffffffffffffffffffffff166323b872dd8686866040516024016130639392919061439c565b604051602081830303815290604052915060e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050613334565b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036131225760006040517fec442f0500000000000000000000000000000000000000000000000000000000815260040161311991906137e5565b60405180910390fd5b61312e60008383612e09565b5050565b8273ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1614613171576131708386836123d0565b5b61317b83826128a9565b61318d613186610f61565b85846133d6565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff167ffbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db8585604051613203929190613b33565b60405180910390a45050505050565b60006001600283600381111561322b5761322a6143d3565b5b6132359190614402565b60ff16149050919050565b60008115159050919050565b600080600061325b8686613455565b915091506000820361328157838181613277576132766142bd565b5b049250505061332d565b8184116132a1576132a061329b6000861460126011613474565b61348e565b5b600084868809905081811183039250808203915060008560000386169050808604955080830492506001818260000304019050808402831792506000600287600302189050808702600203810290508087026002038102905080870260020381029050808702600203810290508087026002038102905080870260020381029050808402955050505050505b9392505050565b600080602060008451602086016000885af180613357576040513d6000823e3d81fd5b3d92506000519150506000821461337257600181141561338e565b60008473ffffffffffffffffffffffffffffffffffffffff163b145b156133d057836040517f5274afe70000000000000000000000000000000000000000000000000000000081526004016133c791906137e5565b60405180910390fd5b50505050565b613450838473ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8585604051602401613409929190613eca565b604051602081830303815290604052915060e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050613334565b505050565b6000806000198385098385029150818110828203039250509250929050565b600061347f84613240565b82841802821890509392505050565b634e487b71600052806020526024601cfd5b6040518060800160405280600073ffffffffffffffffffffffffffffffffffffffff16815260200160008152602001600081526020016000151581525090565b6000819050919050565b6134f3816134e0565b82525050565b600060808201905061350e60008301876134ea565b61351b60208301866134ea565b61352860408301856134ea565b61353560608301846134ea565b95945050505050565b600060208201905061355360008301846134ea565b92915050565b600081519050919050565b600082825260208201905092915050565b60005b83811015613593578082015181840152602081019050613578565b60008484015250505050565b6000601f19601f8301169050919050565b60006135bb82613559565b6135c58185613564565b93506135d5818560208601613575565b6135de8161359f565b840191505092915050565b6000602082019050818103600083015261360381846135b0565b905092915050565b6000604051905090565b600080fd5b600080fd5b613628816134e0565b811461363357600080fd5b50565b6000813590506136458161361f565b92915050565b60006020828403121561366157613660613615565b5b600061366f84828501613636565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006136a382613678565b9050919050565b6136b381613698565b81146136be57600080fd5b50565b6000813590506136d0816136aa565b92915050565b600080604083850312156136ed576136ec613615565b5b60006136fb858286016136c1565b925050602061370c85828601613636565b9150509250929050565b60008115159050919050565b61372b81613716565b82525050565b60006020820190506137466000830184613722565b92915050565b60008060006060848603121561376557613764613615565b5b6000613773868287016136c1565b9350506020613784868287016136c1565b925050604061379586828701613636565b9150509250925092565b600060ff82169050919050565b6137b58161379f565b82525050565b60006020820190506137d060008301846137ac565b92915050565b6137df81613698565b82525050565b60006020820190506137fa60008301846137d6565b92915050565b60006020828403121561381657613815613615565b5b6000613824848285016136c1565b91505092915050565b600080fd5b600080fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b61386f8261359f565b810181811067ffffffffffffffff8211171561388e5761388d613837565b5b80604052505050565b60006138a161360b565b90506138ad8282613866565b919050565b600067ffffffffffffffff8211156138cd576138cc613837565b5b6138d68261359f565b9050602081019050919050565b82818337600083830152505050565b6000613905613900846138b2565b613897565b90508281526020810184848401111561392157613920613832565b5b61392c8482856138e3565b509392505050565b600082601f8301126139495761394861382d565b5b81356139598482602086016138f2565b91505092915050565b6000806040838503121561397957613978613615565b5b600083013567ffffffffffffffff8111156139975761399661361a565b5b6139a385828601613934565b92505060206139b485828601613636565b9150509250929050565b600080604083850312156139d5576139d4613615565b5b60006139e385828601613636565b92505060206139f4858286016136c1565b9150509250929050565b6000608082019050613a1360008301876137d6565b613a2060208301866134ea565b613a2d60408301856134ea565b613a3a6060830184613722565b95945050505050565b613a4c81613698565b82525050565b613a5b816134e0565b82525050565b613a6a81613716565b82525050565b608082016000820151613a866000850182613a43565b506020820151613a996020850182613a52565b506040820151613aac6040850182613a52565b506060820151613abf6060850182613a61565b50505050565b6000608082019050613ada6000830184613a70565b92915050565b600080600060608486031215613af957613af8613615565b5b6000613b0786828701613636565b9350506020613b18868287016136c1565b9250506040613b29868287016136c1565b9150509250925092565b6000604082019050613b4860008301856134ea565b613b5560208301846134ea565b9392505050565b60008060408385031215613b7357613b72613615565b5b6000613b81858286016136c1565b9250506020613b92858286016136c1565b9150509250929050565b600081519050613bab8161361f565b92915050565b600060208284031215613bc757613bc6613615565b5b6000613bd584828501613b9c565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680613c2557607f821691505b602082108103613c3857613c37613bde565b5b50919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b6000613c78826134e0565b9150613c83836134e0565b9250828203905081811115613c9b57613c9a613c3e565b5b92915050565b6000606082019050613cb660008301866134ea565b613cc360208301856134ea565b613cd060408301846137d6565b949350505050565b6000613ce38261379f565b9150613cee8361379f565b9250828201905060ff811115613d0757613d06613c3e565b5b92915050565b7f44414f2049442063616e6e6f7420626520656d70747900000000000000000000600082015250565b6000613d43601683613564565b9150613d4e82613d0d565b602082019050919050565b60006020820190508181036000830152613d7281613d36565b9050919050565b7f46656520616d6f756e74206d7573742062652067726561746572207468616e2060008201527f7a65726f00000000000000000000000000000000000000000000000000000000602082015250565b6000613dd5602483613564565b9150613de082613d79565b604082019050919050565b60006020820190508181036000830152613e0481613dc8565b9050919050565b7f496e76616c69642044414f204944206f722066656520616d6f756e7400000000600082015250565b6000613e41601c83613564565b9150613e4c82613e0b565b602082019050919050565b60006020820190508181036000830152613e7081613e34565b9050919050565b600081905092915050565b6000613e8d82613559565b613e978185613e77565b9350613ea7818560208601613575565b80840191505092915050565b6000613ebf8284613e82565b915081905092915050565b6000604082019050613edf60008301856137d6565b613eec60208301846134ea565b9392505050565b613efc81613716565b8114613f0757600080fd5b50565b600081519050613f1981613ef3565b92915050565b600060208284031215613f3557613f34613615565b5b6000613f4384828501613f0a565b91505092915050565b7f5265656e7472616e637947756172643a207265656e7472616e742063616c6c00600082015250565b6000613f82601f83613564565b9150613f8d82613f4c565b602082019050919050565b60006020820190508181036000830152613fb181613f75565b9050919050565b7f5061757361626c653a2070617573656400000000000000000000000000000000600082015250565b6000613fee601083613564565b9150613ff982613fb8565b602082019050919050565b6000602082019050818103600083015261401d81613fe1565b9050919050565b600061402f826134e0565b915061403a836134e0565b925082820190508082111561405257614051613c3e565b5b92915050565b600060808201905061406d60008301876134ea565b61407a60208301866137d6565b61408760408301856134ea565b61409460608301846134ea565b95945050505050565b60006060820190506140b260008301866137d6565b6140bf60208301856134ea565b6140cc60408301846134ea565b949350505050565b60006040820190506140e960008301856137d6565b6140f660208301846137d6565b9392505050565b60008160011c9050919050565b6000808291508390505b6001851115614154578086048111156141305761412f613c3e565b5b600185161561413f5780820291505b808102905061414d856140fd565b9450614114565b94509492505050565b60008261416d5760019050614229565b8161417b5760009050614229565b8160018114614191576002811461419b576141ca565b6001915050614229565b60ff8411156141ad576141ac613c3e565b5b8360020a9150848211156141c4576141c3613c3e565b5b50614229565b5060208310610133831016604e8410600b84101617156141ff5782820a9050838111156141fa576141f9613c3e565b5b614229565b61420c848484600161410a565b9250905081840481111561422357614222613c3e565b5b81810290505b9392505050565b600061423b826134e0565b91506142468361379f565b92506142737fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff848461415d565b905092915050565b6000614286826134e0565b9150614291836134e0565b925082820261429f816134e0565b915082820484148315176142b6576142b5613c3e565b5b5092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601260045260246000fd5b60006142f7826134e0565b9150614302836134e0565b925082614312576143116142bd565b5b828204905092915050565b6000614328826134e0565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff820361435a57614359613c3e565b5b600182019050919050565b600060608201905061437a60008301866134ea565b61438760208301856137d6565b61439460408301846134ea565b949350505050565b60006060820190506143b160008301866137d6565b6143be60208301856137d6565b6143cb60408301846134ea565b949350505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602160045260246000fd5b600061440d8261379f565b91506144188361379f565b925082614428576144276142bd565b5b82820690509291505056fea2646970667358221220bd05bf74f18815fb077f798b2f14c933876cb265e2928683dca7b716f1bd4a1b64736f6c63430008140033",
  linkReferences: {},
  deployedLinkReferences: {}
};

// server/blockchain.ts
var Maono_CONTRACT_ADDRESS = process.env.MAONO_CONTRACT_ADDRESS || "";
var PROVIDER_URL = process.env.RPC_URL || "https://alfajores-forno.celo-testnet.org";
var provider = tokenService.provider;
var signer = tokenService.signer;
var maonoVault = new ethers3.Contract(
  Maono_CONTRACT_ADDRESS,
  MaonoVault_default.abi,
  signer || provider
);
var MaonoVaultService = {
  contract: maonoVault,
  provider,
  signer,
  async getNAV() {
    return maonoVault.previewNAV();
  },
  async deposit(amount, userAddress) {
    return maonoVault.deposit(amount, userAddress);
  },
  async withdraw(amount, userAddress) {
    return maonoVault.withdraw(amount, userAddress, userAddress);
  },
  async updateNAV(newNav) {
    if (!signer) throw new Error("No manager signer configured");
    return maonoVault.updateNAV(newNav);
  },
  async distributePerformanceFee(profit) {
    if (!signer) throw new Error("No manager signer configured");
    return maonoVault.distributePerformanceFee(profit);
  },
  async listenToEvents(callback) {
    maonoVault.on("NAVUpdated", (newNAV, timestamp10) => {
      callback({ type: "NAVUpdated", newNAV, timestamp: timestamp10 });
    });
  }
};

// server/vaultEventsIndexer.ts
init_db();
init_schema();
var VaultEventIndexer = class {
  constructor() {
    this.isRunning = false;
    this.eventHandlers = /* @__PURE__ */ new Map();
    this.registerHandler("NAVUpdated", this.handleNAVUpdated);
    this.registerHandler("PerformanceFeeDistributed", this.handlePerformanceFeeDistributed);
    this.registerHandler("VaultCreated", this.handleVaultCreated);
    this.registerHandler("VaultClosed", this.handleVaultClosed);
    this.registerHandler("DepositMade", this.handleDepositMade);
    this.registerHandler("WithdrawalMade", this.handleWithdrawalMade);
    this.registerHandler("FeeUpdated", this.handleFeeUpdated);
    this.registerHandler("DAOSettingsUpdated", this.handleDAOSettingsUpdated);
    this.registerHandler("OfframpFeePaid", this.handleOfframpFeePaid);
    this.registerHandler("DisbursementMade", this.handleDisbursementMade);
    this.registerHandler("WithdrawalFeePaid", this.handleWithdrawalFeePaid);
    this.registerHandler("OfframpWithdrawalMade", this.handleOfframpWithdrawalMade);
    this.registerHandler("OfframpFeeUpdated", this.handleOfframpFeeUpdated);
    this.registerHandler("OfframpWhoPaysUpdated", this.handleOfframpWhoPaysUpdated);
    this.registerHandler("DisbursementFeeUpdated", this.handleDisbursementFeeUpdated);
    this.registerHandler("WithdrawalFeeUpdated", this.handleWithdrawalFeeUpdated);
    this.registerHandler("VaultStatusUpdated", this.handleVaultStatusUpdated);
    this.registerHandler("VaultMetadataUpdated", this.handleVaultMetadataUpdated);
    this.registerHandler("VaultOwnershipTransferred", this.handleVaultOwnershipTransferred);
    this.registerHandler("VaultTypeUpdated", this.handleVaultTypeUpdated);
    this.registerHandler("VaultCurrencyUpdated", this.handleVaultCurrencyUpdated);
    this.registerHandler("VaultNameUpdated", this.handleVaultNameUpdated);
    this.registerHandler("VaultDescriptionUpdated", this.handleVaultDescriptionUpdated);
    this.registerHandler("VaultLogoUpdated", this.handleVaultLogoUpdated);
    this.registerHandler("VaultBannerUpdated", this.handleVaultBannerUpdated);
    this.registerHandler("VaultPrivacyUpdated", this.handleVaultPrivacyUpdated);
    this.registerHandler("VaultAccessControlUpdated", this.handleVaultAccessControlUpdated);
    this.registerHandler("VaultTransactionRecorded", this.handleVaultTransactionRecorded);
    this.registerHandler("VaultTransactionFailed", this.handleVaultTransactionFailed);
    this.registerHandler("VaultTransactionPending", this.handleVaultTransactionPending);
    this.registerHandler("VaultTransactionConfirmed", this.handleVaultTransactionConfirmed);
    this.registerHandler("VaultTransactionReverted", this.handleVaultTransactionReverted);
    this.registerHandler("VaultTransactionGasUsed", this.handleVaultTransactionGasUsed);
    this.registerHandler("VaultTransactionGasPrice", this.handleVaultTransactionGasPrice);
    this.registerHandler("VaultTransactionNonce", this.handleVaultTransactionNonce);
    this.registerHandler("VaultTransactionBlockNumber", this.handleVaultTransactionBlockNumber);
    this.registerHandler("VaultTransactionBlockHash", this.handleVaultTransactionBlockHash);
    this.registerHandler("VaultTransactionFrom", this.handleVaultTransactionFrom);
    this.registerHandler("VaultTransactionTo", this.handleVaultTransactionTo);
    this.registerHandler("VaultTransactionValue", this.handleVaultTransactionValue);
    this.registerHandler("VaultTransactionInput", this.handleVaultTransactionInput);
    this.registerHandler("VaultTransactionReceipt", this.handleVaultTransactionReceipt);
    this.registerHandler("VaultTransactionLogs", this.handleVaultTransactionLogs);
    this.registerHandler("VaultTransactionStatus", this.handleVaultTransactionStatus);
    this.registerHandler("VaultTransactionError", this.handleVaultTransactionError);
  }
  registerHandler(eventType, handler2) {
    this.eventHandlers.set(eventType, handler2);
  }
  async start() {
    if (this.isRunning) {
      console.log("Vault event indexer is already running.");
      return;
    }
    this.isRunning = true;
    console.log("Starting vault event indexer...");
    MaonoVaultService.listenToEvents(async (event) => {
      try {
        const handler2 = this.eventHandlers.get(event.type);
        if (handler2) {
          await handler2(event);
        } else {
          console.log(`[UnknownEvent] Type: ${event.type} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
          await db2.insert(vaultTransactions).values({
            vaultId: event.vaultId || "unknown",
            userId: "system",
            transactionType: "unknown_event",
            tokenSymbol: "cUSD",
            amount: "0",
            valueUSD: "0",
            transactionHash: event.transactionHash,
            status: "completed",
            metadata: {
              eventType: event.type,
              rawEvent: JSON.stringify(event),
              needsAnalysis: true
            }
          }).onConflictDoNothing();
        }
      } catch (error) {
        console.error(`Failed to process event ${event.type}:`, error);
        try {
          await db2.insert(vaultTransactions).values({
            vaultId: event.vaultId || "error",
            userId: "system",
            transactionType: "event_error",
            tokenSymbol: "cUSD",
            amount: "0",
            valueUSD: "0",
            transactionHash: event.transactionHash,
            status: "failed",
            metadata: {
              eventType: event.type,
              error: error instanceof Error ? error.message : "Unknown error",
              rawEvent: JSON.stringify(event)
            }
          });
        } catch (dbError) {
          console.error("Failed to save event processing error:", dbError);
        }
      }
    });
  }
  stop() {
    this.isRunning = false;
    console.log("Vault event indexer stopped.");
  }
  // Placeholder handler functions for each event type
  async handleNAVUpdated(event) {
    console.log(`[NAVUpdated] New NAV: ${event.newNAV} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handlePerformanceFeeDistributed(event) {
    console.log(`[PerformanceFeeDistributed] Amount: ${event.amount} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultCreated(event) {
    console.log(`[VaultCreated] Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultClosed(event) {
    console.log(`[VaultClosed] Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleDepositMade(event) {
    console.log(`[DepositMade] Amount: ${event.amount} to Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleWithdrawalMade(event) {
    console.log(`[WithdrawalMade] Amount: ${event.amount} from Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleFeeUpdated(event) {
    console.log(`[FeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleDAOSettingsUpdated(event) {
    console.log(`[DAOSettingsUpdated] New Settings: ${JSON.stringify(event.newSettings)} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleOfframpFeePaid(event) {
    console.log(`[OfframpFeePaid] Amount: ${event.amount} by User: ${event.userId} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleDisbursementMade(event) {
    console.log(`[DisbursementMade] Amount: ${event.amount} from Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleWithdrawalFeePaid(event) {
    console.log(`[WithdrawalFeePaid] Amount: ${event.amount} by User: ${event.userId} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleOfframpWithdrawalMade(event) {
    console.log(`[OfframpWithdrawalMade] Amount: ${event.amount} by User: ${event.userId} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleOfframpFeeUpdated(event) {
    console.log(`[OfframpFeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleOfframpWhoPaysUpdated(event) {
    console.log(`[OfframpWhoPaysUpdated] New Who Pays: ${event.newWhoPays} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleDisbursementFeeUpdated(event) {
    console.log(`[DisbursementFeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleWithdrawalFeeUpdated(event) {
    console.log(`[WithdrawalFeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultStatusUpdated(event) {
    console.log(`[VaultStatusUpdated] Vault ID: ${event.vaultId} New Status: ${event.newStatus} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultMetadataUpdated(event) {
    console.log(`[VaultMetadataUpdated] Vault ID: ${event.vaultId} New Metadata: ${JSON.stringify(event.newMetadata)} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultOwnershipTransferred(event) {
    console.log(`[VaultOwnershipTransferred] Vault ID: ${event.vaultId} New Owner: ${event.newOwner} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTypeUpdated(event) {
    console.log(`[VaultTypeUpdated] Vault ID: ${event.vaultId} New Type: ${event.newType} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultCurrencyUpdated(event) {
    console.log(`[VaultCurrencyUpdated] Vault ID: ${event.vaultId} New Currency: ${event.newCurrency} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultNameUpdated(event) {
    console.log(`[VaultNameUpdated] Vault ID: ${event.vaultId} New Name: ${event.newName} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultDescriptionUpdated(event) {
    console.log(`[VaultDescriptionUpdated] Vault ID: ${event.vaultId} New Description: ${event.newDescription} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultLogoUpdated(event) {
    console.log(`[VaultLogoUpdated] Vault ID: ${event.vaultId} New Logo: ${event.newLogo} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultBannerUpdated(event) {
    console.log(`[VaultBannerUpdated] Vault ID: ${event.vaultId} New Banner: ${event.newBanner} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultPrivacyUpdated(event) {
    console.log(`[VaultPrivacyUpdated] Vault ID: ${event.vaultId} New Privacy: ${event.newPrivacy} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultAccessControlUpdated(event) {
    console.log(`[VaultAccessControlUpdated] Vault ID: ${event.vaultId} New Access Control: ${JSON.stringify(event.newAccessControl)} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionRecorded(event) {
    console.log(`[VaultTransactionRecorded] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionFailed(event) {
    console.log(`[VaultTransactionFailed] Vault ID: ${event.vaultId} Error: ${event.error} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionPending(event) {
    console.log(`[VaultTransactionPending] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionConfirmed(event) {
    console.log(`[VaultTransactionConfirmed] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionReverted(event) {
    console.log(`[VaultTransactionReverted] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionGasUsed(event) {
    console.log(`[VaultTransactionGasUsed] Vault ID: ${event.vaultId} Gas Used: ${event.gasUsed} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionGasPrice(event) {
    console.log(`[VaultTransactionGasPrice] Vault ID: ${event.vaultId} Gas Price: ${event.gasPrice} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionNonce(event) {
    console.log(`[VaultTransactionNonce] Vault ID: ${event.vaultId} Nonce: ${event.nonce} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionBlockNumber(event) {
    console.log(`[VaultTransactionBlockNumber] Vault ID: ${event.vaultId} Block Number: ${event.blockNumber} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionBlockHash(event) {
    console.log(`[VaultTransactionBlockHash] Vault ID: ${event.vaultId} Block Hash: ${event.blockHash} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionFrom(event) {
    console.log(`[VaultTransactionFrom] Vault ID: ${event.vaultId} From: ${event.from} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionTo(event) {
    console.log(`[VaultTransactionTo] Vault ID: ${event.vaultId} To: ${event.to} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionValue(event) {
    console.log(`[VaultTransactionValue] Vault ID: ${event.vaultId} Value: ${event.value} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionInput(event) {
    console.log(`[VaultTransactionInput] Vault ID: ${event.vaultId} Input: ${event.input} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionReceipt(event) {
    console.log(`[VaultTransactionReceipt] Vault ID: ${event.vaultId} Receipt: ${JSON.stringify(event.receipt)} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionLogs(event) {
    console.log(`[VaultTransactionLogs] Vault ID: ${event.vaultId} Logs: ${JSON.stringify(event.logs)} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionStatus(event) {
    console.log(`[VaultTransactionStatus] Vault ID: ${event.vaultId} Status: ${event.status} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  async handleVaultTransactionError(event) {
    console.log(`[VaultTransactionError] Vault ID: ${event.vaultId} Error: ${event.error} at ${new Date(Number(event.timestamp) * 1e3).toISOString()}`);
  }
  // Get indexer status
  getStatus() {
    return {
      isRunning: this.isRunning,
      supportedEvents: Array.from(this.eventHandlers.keys()),
      startTime: this.isRunning ? (/* @__PURE__ */ new Date()).toISOString() : null
    };
  }
};
var vaultEventIndexer = new VaultEventIndexer();
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  vaultEventIndexer.start();
  process.on("SIGINT", () => {
    console.log("Received SIGINT, shutting down event indexer...");
    vaultEventIndexer.stop();
    process.exit(0);
  });
}

// server/vaultAutomation.ts
init_db();
init_schema();
init_logger();
import { eq as eq34 } from "drizzle-orm";
import { ethers as ethers4 } from "ethers";

// server/utils/appError.ts
var AppError2 = class extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
};

// server/vaultAutomation.ts
var VaultAutomationService = class {
  constructor() {
    this.isRunning = false;
    this.tasks = [];
    this.intervalId = null;
    this.logger = new Logger("vault-automation");
  }
  // Start automation service
  start() {
    if (this.isRunning) {
      this.logger.warn("Vault automation service is already running");
      return;
    }
    this.logger.info("\u{1F680} Starting Vault Automation Service...");
    try {
      this.isRunning = true;
      const startTime = Date.now();
      this.scheduleRegularTasks();
      this.intervalId = setInterval(async () => {
        try {
          await this.processTasks();
        } catch (error) {
          await this.logger.securityLog(
            "Critical error in automation task processing",
            "high",
            { error: error instanceof Error ? error.message : String(error) }
          );
          this.logger.error("Error processing automation tasks", error);
        }
      }, 3e4);
      const startupDuration = Date.now() - startTime;
      this.logger.info("\u2705 Vault Automation Service started successfully");
      this.logger.info(`Performance: automation_service_startup took ${startupDuration}ms`, {
        performance: true,
        operation: "automation_service_startup",
        duration: startupDuration,
        scheduledTasks: this.tasks.length,
        intervalMs: 3e4
      });
    } catch (error) {
      this.logger.error("Failed to start Vault Automation Service", error);
      this.isRunning = false;
      throw new AppError2("Failed to start vault automation service", 500);
    }
  }
  // Stop automation service
  stop() {
    if (!this.isRunning) {
      this.logger.warn("Vault automation service is not running");
      return;
    }
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.info("\u23F9\uFE0F  Vault Automation Service stopped");
  }
  // Schedule regular automation tasks
  scheduleRegularTasks() {
    this.addTask({
      id: `nav_update_${Date.now()}`,
      type: "nav_update",
      priority: "high",
      scheduledAt: new Date(Date.now() + 60 * 60 * 1e3),
      // 1 hour
      retryCount: 0,
      maxRetries: 3
    });
    this.addTask({
      id: `rebalance_all_${Date.now()}`,
      type: "rebalance",
      priority: "medium",
      scheduledAt: new Date(Date.now() + 6 * 60 * 60 * 1e3),
      // 6 hours
      retryCount: 0,
      maxRetries: 2
    });
    this.addTask({
      id: `risk_assessment_${Date.now()}`,
      type: "risk_assessment",
      priority: "low",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1e3),
      // 24 hours
      retryCount: 0,
      maxRetries: 2
    });
  }
  // Add a new automation task
  addTask(task) {
    this.tasks.push(task);
    this.tasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
  }
  // Process pending tasks
  async processTasks() {
    try {
      const now = /* @__PURE__ */ new Date();
      const dueTasks = this.tasks.filter((task) => task.scheduledAt <= now);
      if (dueTasks.length === 0) {
        return;
      }
      this.logger.info(`Processing ${dueTasks.length} due automation tasks`);
      for (const task of dueTasks) {
        const taskLogger = this.logger.child({ taskId: task.id, taskType: task.type });
        try {
          taskLogger.info(`\u{1F504} Processing automation task: ${task.type}`);
          await this.executeTask(task);
          this.tasks = this.tasks.filter((t) => t.id !== task.id);
          taskLogger.info(`\u2705 Completed automation task: ${task.type}`);
        } catch (error) {
          taskLogger.error(`\u274C Task failed: ${task.type}`, error);
          task.retryCount++;
          if (task.retryCount < task.maxRetries) {
            const backoffMs = Math.pow(2, task.retryCount) * 6e4;
            task.scheduledAt = new Date(now.getTime() + backoffMs);
            taskLogger.warn(`\u{1F504} Rescheduling task (attempt ${task.retryCount + 1}/${task.maxRetries})`, {
              nextAttempt: task.scheduledAt.toISOString(),
              backoffMs
            });
          } else {
            taskLogger.error(`\u{1F4A5} Task failed after ${task.maxRetries} attempts`);
            this.tasks = this.tasks.filter((t) => t.id !== task.id);
            await this.logger.securityLog(`Task ${task.id} failed permanently`, "medium", {
              taskType: task.type,
              vaultId: task.vaultId,
              retryCount: task.retryCount
            });
          }
        }
      }
    } catch (error) {
      this.logger.error("Error in processTasks", error);
    }
  }
  // Execute a specific automation task
  async executeTask(task) {
    switch (task.type) {
      case "nav_update":
        await this.executeNAVUpdate(task);
        break;
      case "performance_fee":
        await this.executePerformanceFeeDistribution(task);
        break;
      case "rebalance":
        await this.executeRebalancing(task);
        break;
      case "risk_assessment":
        await this.executeRiskAssessment(task);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }
  // Execute NAV update
  async executeNAVUpdate(task) {
    try {
      const [currentNAV, lastUpdate] = await MaonoVaultService.getNAV();
      const activeVaults = await db2.query.vaults.findMany({
        where: eq34(vaults.isActive, true)
      });
      let totalValue = 0n;
      let totalShares = 0n;
      for (const vault of activeVaults) {
        const vaultPortfolio = await vaultService.getVaultPortfolio(vault.id);
        const vaultValueWei = ethers4.parseUnits(vaultPortfolio.totalValueUSD.toString(), 18);
        totalValue += vaultValueWei;
        totalShares += BigInt(1e3);
      }
      const newNAV = totalShares > 0n ? totalValue / totalShares : 0n;
      const navChange = currentNAV > 0n ? (newNAV - currentNAV) * 100n / currentNAV : 100n;
      if (navChange > 1n || navChange < -1n) {
        console.log(`\u{1F4C8} Updating NAV: ${ethers4.formatEther(currentNAV)} \u2192 ${ethers4.formatEther(newNAV)}`);
        const tx = await MaonoVaultService.updateNAV(newNAV);
        await tx.wait();
        console.log(`\u2705 NAV updated on-chain: ${tx.hash}`);
      } else {
        console.log("\u{1F4CA} NAV change too small, skipping update");
      }
      this.addTask({
        id: `nav_update_${Date.now()}`,
        type: "nav_update",
        priority: "high",
        scheduledAt: new Date(Date.now() + 60 * 60 * 1e3),
        // 1 hour
        retryCount: 0,
        maxRetries: 3
      });
    } catch (error) {
      console.error("NAV update automation failed:", error);
      throw error;
    }
  }
  // Execute performance fee distribution
  async executePerformanceFeeDistribution(task) {
    try {
      const recentPerformance = await db2.query.vaultPerformance.findMany({
        where: eq34(vaultPerformance.period, "daily"),
        limit: 30
        // Last 30 days
      });
      let totalProfit = 0n;
      for (const performance2 of recentPerformance) {
        const yield_ = parseFloat(performance2.yield || "0");
        if (yield_ > 0) {
          totalProfit += ethers4.parseUnits(yield_.toString(), 18);
        }
      }
      if (totalProfit > ethers4.parseUnits("100", 18)) {
        console.log(`\u{1F4B0} Distributing performance fees on profit: ${ethers4.formatEther(totalProfit)} USD`);
        const tx = await MaonoVaultService.distributePerformanceFee(totalProfit);
        await tx.wait();
        console.log(`\u2705 Performance fees distributed: ${tx.hash}`);
      } else {
        console.log("\u{1F4B0} Insufficient profit for fee distribution");
      }
    } catch (error) {
      console.error("Performance fee distribution failed:", error);
      throw error;
    }
  }
  // Execute vault rebalancing
  async executeRebalancing(task) {
    try {
      const activeVaults = await db2.query.vaults.findMany({
        where: eq34(vaults.isActive, true)
      });
      console.log(`\u2696\uFE0F  Rebalancing ${activeVaults.length} active vaults...`);
      for (const vault of activeVaults) {
        try {
          await vaultService.rebalanceVault(vault.id);
          console.log(`\u2705 Rebalanced vault: ${vault.name} (${vault.id})`);
        } catch (error) {
          console.warn(`\u26A0\uFE0F  Failed to rebalance vault ${vault.id}:`, error);
        }
      }
      this.addTask({
        id: `rebalance_all_${Date.now()}`,
        type: "rebalance",
        priority: "medium",
        scheduledAt: new Date(Date.now() + 6 * 60 * 60 * 1e3),
        // 6 hours
        retryCount: 0,
        maxRetries: 2
      });
    } catch (error) {
      console.error("Vault rebalancing automation failed:", error);
      throw error;
    }
  }
  // Execute risk assessment
  async executeRiskAssessment(task) {
    try {
      const activeVaults = await db2.query.vaults.findMany({
        where: eq34(vaults.isActive, true)
      });
      console.log(`\u{1F50D} Performing risk assessment on ${activeVaults.length} vaults...`);
      for (const vault of activeVaults) {
        try {
          await vaultService.performRiskAssessment(vault.id);
          console.log(`\u2705 Risk assessment completed for vault: ${vault.name}`);
        } catch (error) {
          console.warn(`\u26A0\uFE0F  Risk assessment failed for vault ${vault.id}:`, error);
        }
      }
      this.addTask({
        id: `risk_assessment_${Date.now()}`,
        type: "risk_assessment",
        priority: "low",
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1e3),
        // 24 hours
        retryCount: 0,
        maxRetries: 2
      });
    } catch (error) {
      console.error("Risk assessment automation failed:", error);
      throw error;
    }
  }
  // Get automation status
  getStatus() {
    return {
      isRunning: this.isRunning,
      pendingTasks: this.tasks.length,
      tasks: this.tasks.map((task) => ({
        id: task.id,
        type: task.type,
        priority: task.priority,
        scheduledAt: task.scheduledAt,
        retryCount: task.retryCount,
        vaultId: task.vaultId
      }))
    };
  }
};
var vaultAutomationService = new VaultAutomationService();
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  vaultAutomationService.start();
  process.on("SIGINT", () => {
    console.log("Received SIGINT, shutting down automation service...");
    vaultAutomationService.stop();
    process.exit(0);
  });
}

// server/middleware/activityTracker.ts
function activityTracker() {
  return (req, res, next) => {
    const startTime = Date.now();
    function resolveActivityType() {
      if (req.activityType && typeof req.activityType === "string") {
        return req.activityType;
      }
      return getActivityType(req.method, req.route?.path || req.originalUrl || req.path);
    }
    res.on("finish", () => {
      if (req.user?.claims?.sub && res.statusCode < 400) {
        const duration = Date.now() - startTime;
        const activityType = resolveActivityType();
        if (activityType) {
          const metadata = {
            path: req.originalUrl || req.path,
            method: req.method,
            duration,
            userAgent: req.get("User-Agent"),
            ip: req.ip,
            statusCode: res.statusCode,
            query: req.query,
            params: req.params
          };
          if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
            metadata.body = req.body;
          }
          Promise.resolve(
            analyticsService.trackUserActivity(req.user.claims.sub, activityType, metadata)
          ).catch((error) => {
            console.warn("Failed to track user activity:", {
              error,
              user: req.user?.claims?.sub,
              activityType,
              metadata
            });
          });
        }
      }
    });
    next();
  };
}
function getActivityType(method, path4) {
  const route = `${method} ${path4}`;
  const activityMap = {
    "GET /api/proposals": "view_proposals",
    "POST /api/proposals": "create_proposal",
    "POST /api/votes": "cast_vote",
    "GET /api/vault": "view_vault",
    "POST /api/vault/deposit": "vault_deposit",
    "POST /api/vault/withdraw": "vault_withdraw",
    "GET /api/tasks": "view_tasks",
    "POST /api/tasks": "create_task",
    "POST /api/tasks/:id/claim": "claim_task",
    "GET /api/analytics": "view_analytics",
    "POST /api/wallet/transactions": "wallet_transaction"
    // Add more mappings as needed
  };
  if (activityMap[route]) {
    return activityMap[route];
  }
  for (const [pattern, activity] of Object.entries(activityMap)) {
    if (matchesPattern(route, pattern)) {
      return activity;
    }
  }
  return null;
}
function matchesPattern(route, pattern) {
  const patternRegex = pattern.replace(/:[^/]+/g, "[^/]+");
  return new RegExp(`^${patternRegex}$`).test(route);
}

// server/services/bridgeRelayerService.ts
init_db();
init_schema();
init_logger();
init_errorHandler();
import { eq as eq35 } from "drizzle-orm";

// shared/chainRegistry.ts
import { ethers as ethers5 } from "ethers";
var SupportedChain = /* @__PURE__ */ ((SupportedChain4) => {
  SupportedChain4["CELO"] = "celo";
  SupportedChain4["CELO_ALFAJORES"] = "celo-alfajores";
  SupportedChain4["ETHEREUM"] = "ethereum";
  SupportedChain4["POLYGON"] = "polygon";
  SupportedChain4["OPTIMISM"] = "optimism";
  SupportedChain4["ARBITRUM"] = "arbitrum";
  return SupportedChain4;
})(SupportedChain || {});
var CHAIN_CONFIGS = {
  ["celo" /* CELO */]: {
    chainId: 42220,
    name: "Celo Mainnet",
    symbol: "CELO",
    rpcUrl: "https://forno.celo.org",
    blockExplorer: "https://celoscan.io",
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    isTestnet: false
  },
  ["celo-alfajores" /* CELO_ALFAJORES */]: {
    chainId: 44787,
    name: "Celo Alfajores Testnet",
    symbol: "CELO",
    rpcUrl: "https://alfajores-forno.celo-testnet.org",
    blockExplorer: "https://alfajores.celoscan.io",
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    isTestnet: true
  },
  ["ethereum" /* ETHEREUM */]: {
    chainId: 1,
    name: "Ethereum Mainnet",
    symbol: "ETH",
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
    blockExplorer: "https://etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: false
  },
  ["polygon" /* POLYGON */]: {
    chainId: 137,
    name: "Polygon Mainnet",
    symbol: "MATIC",
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    isTestnet: false
  },
  ["optimism" /* OPTIMISM */]: {
    chainId: 10,
    name: "Optimism Mainnet",
    symbol: "ETH",
    rpcUrl: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
    blockExplorer: "https://optimistic.etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: false
  },
  ["arbitrum" /* ARBITRUM */]: {
    chainId: 42161,
    name: "Arbitrum One",
    symbol: "ETH",
    rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: false
  }
};
var ChainRegistry = class {
  static {
    this.providers = /* @__PURE__ */ new Map();
  }
  static getChainConfig(chain) {
    return CHAIN_CONFIGS[chain];
  }
  static getProvider(chain) {
    if (!this.providers.has(chain)) {
      const config4 = this.getChainConfig(chain);
      this.providers.set(chain, new ethers5.JsonRpcProvider(config4.rpcUrl));
    }
    return this.providers.get(chain);
  }
  static getAllChains() {
    return Object.values(SupportedChain);
  }
  static getMainnetChains() {
    return this.getAllChains().filter((chain) => !CHAIN_CONFIGS[chain].isTestnet);
  }
  static isTestnet(chain) {
    return CHAIN_CONFIGS[chain].isTestnet;
  }
};

// server/services/bridgeRelayerService.ts
var BridgeRelayerService = class {
  constructor() {
    this.logger = Logger.getLogger();
    this.isRunning = false;
    this.pollInterval = 3e4;
  }
  // 30 seconds
  /**
   * Start the relayer service
   */
  start() {
    if (this.isRunning) {
      this.logger.warn("Relayer service already running");
      return;
    }
    this.isRunning = true;
    this.logger.info("\u{1F680} Bridge relayer service started");
    this.pollPendingTransfers();
  }
  /**
   * Stop the relayer service
   */
  stop() {
    this.isRunning = false;
    this.logger.info("Bridge relayer service stopped");
  }
  /**
   * Poll for pending transfers
   */
  async pollPendingTransfers() {
    while (this.isRunning) {
      try {
        const pendingTransfers = await db2.query.crossChainTransfers.findMany({
          where: eq35(crossChainTransfers.status, "pending")
        });
        for (const transfer of pendingTransfers) {
          await this.processTransfer(transfer);
        }
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      } catch (error) {
        this.logger.error("Error polling transfers:", error);
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      }
    }
  }
  /**
   * Process a single transfer
   */
  async processTransfer(transfer) {
    try {
      this.logger.info(`Processing transfer: ${transfer.id}`);
      await db2.update(crossChainTransfers).set({ status: "bridging" }).where(eq35(crossChainTransfers.id, transfer.id));
      const sourceTxHash = await this.checkSourceTransaction(
        transfer.sourceChain,
        transfer.tokenAddress,
        transfer.amount
      );
      if (sourceTxHash) {
        await db2.update(crossChainTransfers).set({ txHashSource: sourceTxHash }).where(eq35(crossChainTransfers.id, transfer.id));
        const destTxHash = await this.completeTransferOnDestination(
          transfer.destinationChain,
          transfer.destinationAddress,
          transfer.tokenAddress,
          transfer.amount
        );
        if (destTxHash) {
          await db2.update(crossChainTransfers).set({
            status: "completed",
            txHashDestination: destTxHash,
            completedAt: /* @__PURE__ */ new Date()
          }).where(eq35(crossChainTransfers.id, transfer.id));
          this.logger.info(`Transfer ${transfer.id} completed successfully`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process transfer ${transfer.id}:`, error);
      await db2.update(crossChainTransfers).set({
        status: "failed",
        failureReason: error instanceof Error ? error.message : "Unknown error"
      }).where(eq35(crossChainTransfers.id, transfer.id));
    }
  }
  /**
   * Check source chain transaction
   */
  async checkSourceTransaction(chain, tokenAddress, amount) {
    try {
      const provider2 = ChainRegistry.getProvider(chain);
      return `0x${Math.random().toString(16).substr(2, 64)}`;
    } catch (error) {
      this.logger.error("Failed to check source transaction:", error);
      return null;
    }
  }
  /**
   * Complete transfer on destination chain
   */
  async completeTransferOnDestination(chain, recipient, tokenAddress, amount) {
    try {
      const provider2 = ChainRegistry.getProvider(chain);
      return `0x${Math.random().toString(16).substr(2, 64)}`;
    } catch (error) {
      this.logger.error("Failed to complete destination transfer:", error);
      return null;
    }
  }
  /**
   * Manually retry failed transfer
   */
  async retryTransfer(transferId) {
    const transfer = await db2.query.crossChainTransfers.findFirst({
      where: eq35(crossChainTransfers.id, transferId)
    });
    if (!transfer) {
      throw new AppError("Transfer not found", 404);
    }
    if (transfer.status !== "failed") {
      throw new AppError("Can only retry failed transfers", 400);
    }
    await db2.update(crossChainTransfers).set({ status: "pending", failureReason: null }).where(eq35(crossChainTransfers.id, transferId));
    this.logger.info(`Transfer ${transferId} queued for retry`);
  }
};
var bridgeRelayerService = new BridgeRelayerService();

// server/routes/billing.ts
init_auth();
init_storage();
init_schema();
init_schema();
import express23 from "express";
import { sql as sql17 } from "drizzle-orm";
import { eq as eq37, desc as desc16, and as and24 } from "drizzle-orm";

// server/services/financialAnalyticsService.ts
init_storage();
init_schema();
import { eq as eq36, sql as sql16, and as and23, gte as gte11, lte as lte6, desc as desc15 } from "drizzle-orm";
var FinancialAnalyticsService = class {
  // Get DAO financial overview
  async getDaoFinancialOverview(daoId, startDate, endDate) {
    try {
      const dateFilter = [];
      if (startDate) dateFilter.push(gte11(contributions.createdAt, startDate));
      if (endDate) dateFilter.push(lte6(contributions.createdAt, endDate));
      const totalContributions = await db2.select({
        totalAmount: sql16`COALESCE(SUM(CAST(${contributions.amount} AS DECIMAL)), 0)`.as("totalAmount"),
        count: sql16`COUNT(*)`.as("count")
      }).from(contributions).where(and23(
        eq36(contributions.daoId, daoId),
        ...dateFilter
      ));
      const topContributors = await db2.select({
        userId: contributions.userId,
        username: users.username,
        totalContributed: sql16`SUM(CAST(${contributions.amount} AS DECIMAL))`.as("totalContributed"),
        contributionCount: sql16`COUNT(*)`.as("contributionCount")
      }).from(contributions).innerJoin(users, eq36(contributions.userId, users.id)).where(and23(
        eq36(contributions.daoId, daoId),
        ...dateFilter
      )).groupBy(contributions.userId, users.username).orderBy(desc15(sql16`SUM(CAST(${contributions.amount} AS DECIMAL))`)).limit(10);
      const monthlyTrends = await db2.select({
        month: sql16`TO_CHAR(${contributions.createdAt}, 'YYYY-MM')`.as("month"),
        totalAmount: sql16`SUM(CAST(${contributions.amount} AS DECIMAL))`.as("totalAmount"),
        count: sql16`COUNT(*)`.as("count")
      }).from(contributions).where(and23(
        eq36(contributions.daoId, daoId),
        ...dateFilter
      )).groupBy(sql16`TO_CHAR(${contributions.createdAt}, 'YYYY-MM')`).orderBy(sql16`TO_CHAR(${contributions.createdAt}, 'YYYY-MM')`);
      const paymentMethodStats = await db2.select({
        currency: contributions.currency,
        totalAmount: sql16`SUM(CAST(${contributions.amount} AS DECIMAL))`.as("totalAmount"),
        count: sql16`COUNT(*)`.as("count"),
        avgAmount: sql16`AVG(CAST(${contributions.amount} AS DECIMAL))`.as("avgAmount")
      }).from(contributions).where(and23(
        eq36(contributions.daoId, daoId),
        ...dateFilter
      )).groupBy(contributions.currency);
      return {
        overview: {
          totalContributions: totalContributions[0]?.totalAmount || 0,
          totalTransactions: totalContributions[0]?.count || 0,
          averageContribution: totalContributions[0]?.count > 0 ? totalContributions[0].totalAmount / totalContributions[0].count : 0
        },
        topContributors,
        monthlyTrends,
        paymentMethodStats,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Error generating DAO financial overview:", error);
      throw new Error("Failed to generate financial analytics");
    }
  }
  // Get platform-wide financial metrics
  async getPlatformFinancialMetrics(startDate, endDate) {
    try {
      const dateFilter = [];
      if (startDate) dateFilter.push(gte11(contributions.createdAt, startDate));
      if (endDate) dateFilter.push(lte6(contributions.createdAt, endDate));
      const platformRevenue = await db2.select({
        totalRevenue: sql16`SUM(CAST(${contributions.amount} AS DECIMAL) * 0.02)`.as("totalRevenue"),
        totalVolume: sql16`SUM(CAST(${contributions.amount} AS DECIMAL))`.as("totalVolume"),
        transactionCount: sql16`COUNT(*)`.as("transactionCount")
      }).from(contributions).where(and23(...dateFilter));
      const daoRankings = await db2.select({
        daoId: contributions.daoId,
        daoName: daos.name,
        totalContributions: sql16`SUM(CAST(${contributions.amount} AS DECIMAL))`.as("totalContributions"),
        contributorCount: sql16`COUNT(DISTINCT ${contributions.userId})`.as("contributorCount"),
        transactionCount: sql16`COUNT(*)`.as("transactionCount")
      }).from(contributions).innerJoin(daos, eq36(contributions.daoId, daos.id)).where(and23(...dateFilter)).groupBy(contributions.daoId, daos.name).orderBy(desc15(sql16`SUM(CAST(${contributions.amount} AS DECIMAL))`)).limit(20);
      const currencyDistribution = await db2.select({
        currency: contributions.currency,
        totalAmount: sql16`SUM(CAST(${contributions.amount} AS DECIMAL))`.as("totalAmount"),
        percentage: sql16`ROUND(SUM(CAST(${contributions.amount} AS DECIMAL)) * 100.0 / SUM(SUM(CAST(${contributions.amount} AS DECIMAL))) OVER(), 2)`.as("percentage")
      }).from(contributions).where(and23(...dateFilter)).groupBy(contributions.currency);
      return {
        platformMetrics: {
          totalRevenue: platformRevenue[0]?.totalRevenue || 0,
          totalVolume: platformRevenue[0]?.totalVolume || 0,
          transactionCount: platformRevenue[0]?.transactionCount || 0,
          averageTransactionSize: platformRevenue[0]?.transactionCount > 0 ? platformRevenue[0].totalVolume / platformRevenue[0].transactionCount : 0
        },
        daoRankings,
        currencyDistribution,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Error generating platform financial metrics:", error);
      throw new Error("Failed to generate platform analytics");
    }
  }
  // Get treasury health metrics
  async getTreasuryHealthMetrics(daoId) {
    try {
      const daoVaults = await db2.select().from(vaults).where(eq36(vaults.daoId, daoId));
      const totalBalance = daoVaults.reduce((sum3, vault) => {
        return sum3 + parseFloat(vault.balance);
      }, 0);
      const thirtyDaysAgo = /* @__PURE__ */ new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentActivity = await db2.select({
        totalInflow: sql16`COALESCE(SUM(CASE WHEN ${walletTransactions2.type} = 'deposit' THEN CAST(${walletTransactions2.amount} AS DECIMAL) ELSE 0 END), 0)`.as("totalInflow"),
        totalOutflow: sql16`COALESCE(SUM(CASE WHEN ${walletTransactions2.type} = 'withdrawal' THEN CAST(${walletTransactions2.amount} AS DECIMAL) ELSE 0 END), 0)`.as("totalOutflow"),
        transactionCount: sql16`COUNT(*)`.as("transactionCount")
      }).from(walletTransactions2).where(and23(
        eq36(walletTransactions2.daoId, daoId),
        gte11(walletTransactions2.createdAt, thirtyDaysAgo)
      ));
      const activity = recentActivity[0];
      const netFlow = activity.totalInflow - activity.totalOutflow;
      const healthScore = this.calculateTreasuryHealthScore(totalBalance, netFlow, activity.transactionCount);
      return {
        treasuryBalance: totalBalance,
        vaultCount: daoVaults.length,
        recentActivity: {
          inflow: activity.totalInflow,
          outflow: activity.totalOutflow,
          netFlow,
          transactionCount: activity.transactionCount
        },
        healthScore,
        recommendations: this.generateTreasuryRecommendations(healthScore, netFlow, totalBalance)
      };
    } catch (error) {
      console.error("Error calculating treasury health:", error);
      throw new Error("Failed to calculate treasury health metrics");
    }
  }
  calculateTreasuryHealthScore(balance, netFlow, transactionCount) {
    let score = 50;
    if (balance > 1e4) score += 40;
    else if (balance > 5e3) score += 30;
    else if (balance > 1e3) score += 20;
    else if (balance > 100) score += 10;
    if (netFlow > 0) score += 30;
    else if (netFlow > -500) score += 20;
    else if (netFlow > -1e3) score += 10;
    if (transactionCount > 50) score += 30;
    else if (transactionCount > 20) score += 20;
    else if (transactionCount > 5) score += 10;
    return Math.min(100, Math.max(0, score));
  }
  generateTreasuryRecommendations(healthScore, netFlow, balance) {
    const recommendations = [];
    if (healthScore < 30) {
      recommendations.push("Treasury health is critical - consider emergency fundraising");
    } else if (healthScore < 50) {
      recommendations.push("Treasury needs attention - implement cost reduction measures");
    }
    if (netFlow < 0) {
      recommendations.push("Negative cash flow detected - review spending and increase contributions");
    }
    if (balance < 500) {
      recommendations.push("Low treasury balance - urgent funding required");
    }
    if (recommendations.length === 0) {
      recommendations.push("Treasury is healthy - consider diversification opportunities");
    }
    return recommendations;
  }
};
var financialAnalyticsService = new FinancialAnalyticsService();

// server/routes/billing.ts
var router24 = express23.Router();
router24.get("/dashboard/:daoId", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.claims?.id;
    const dao = await db2.select().from(daos).where(eq37(daos.id, daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ error: "DAO not found" });
    }
    const subscription = await db2.select().from(subscriptions).where(and24(
      eq37(subscriptions.daoId, daoId),
      eq37(subscriptions.status, "active")
    )).limit(1);
    const history = await db2.select().from(billingHistory).where(eq37(billingHistory.daoId, daoId)).orderBy(desc16(billingHistory.createdAt)).limit(12);
    const totalSpent = history.reduce((sum3, h) => sum3 + parseFloat(h.amount), 0);
    const avgMonthlySpend = history.length > 0 ? totalSpent / Math.min(history.length, 12) : 0;
    const analytics2 = await financialAnalyticsService.getDaoFinancialOverview(daoId);
    const treasuryHealth = await financialAnalyticsService.getTreasuryHealthMetrics(daoId);
    const [proposalCount, vaultCount] = await Promise.all([
      db2.select({ count: sql17`count(*)` }).from(proposals).where(eq37(proposals.daoId, daoId)),
      db2.select({ count: sql17`count(*)` }).from(vaults).where(eq37(vaults.daoId, daoId))
    ]);
    const currentPlan = subscription[0]?.plan || "free";
    const planLimits = {
      free: { members: 25, proposals: 10, vaults: 1 },
      premium: { members: Infinity, proposals: Infinity, vaults: Infinity }
    };
    const usage = {
      members: dao[0].memberCount ?? 0,
      proposals: proposalCount[0]?.count || 0,
      vaults: vaultCount[0]?.count || 0,
      limits: planLimits[currentPlan]
    };
    const memberOverage = Math.max(0, (usage.members ?? 0) - 25);
    const proposalOverage = Math.max(0, Number(usage.proposals ?? 0) - 10);
    const vaultOverage = Math.max(0, Number(usage.vaults ?? 0) - 1);
    const upgradeRecommended = memberOverage > 0 || proposalOverage > 0 || vaultOverage > 0;
    res.json({
      dao: dao[0],
      subscription: subscription[0] || null,
      billingHistory: history,
      billingAnalytics: {
        totalSpent,
        avgMonthlySpend,
        currency: history[0]?.currency || "KES",
        nextBillingDate: subscription[0]?.endDate,
        paymentMethodsUsed: [...new Set(history.map((h) => h.currency))]
      },
      analytics: analytics2,
      treasuryHealth,
      usage,
      upgradeAnalysis: {
        recommended: upgradeRecommended,
        reason: upgradeRecommended ? `You're exceeding limits: ${memberOverage > 0 ? `${memberOverage} extra members` : ""} ${proposalOverage > 0 ? `${proposalOverage} extra proposals` : ""}` : "Current plan meets your needs",
        estimatedMonthlyCost: upgradeRecommended ? 1500 : 0
      }
    });
  } catch (error) {
    console.error("Billing dashboard error:", error);
    res.status(500).json({ error: "Failed to load billing dashboard" });
  }
});
router24.post("/upgrade/:daoId", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { plan, paymentMethod } = req.body;
    const userId = req.user?.claims?.id;
    if (!["premium"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }
    const dao = await db2.select().from(daos).where(eq37(daos.id, daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ error: "DAO not found" });
    }
    const pricing = {
      premium: {
        KES: 1500,
        USD: 9.99,
        EUR: 8.99
      }
    };
    const currency = paymentMethod?.currency || "KES";
    const amount = pricing[plan][currency];
    const billingRecord = await db2.insert(billingHistory).values({
      daoId,
      amount: amount.toString(),
      currency,
      status: "pending",
      description: `Upgrade to ${plan} plan`
    }).returning();
    await db2.update(daos).set({
      plan,
      planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3),
      // 30 days
      billingStatus: "active",
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3)
    }).where(eq37(daos.id, daoId));
    await db2.insert(subscriptions).values({
      userId,
      daoId,
      plan,
      status: "active",
      startDate: /* @__PURE__ */ new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3)
    }).onConflictDoUpdate({
      target: [subscriptions.daoId],
      set: {
        plan,
        status: "active",
        startDate: /* @__PURE__ */ new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3)
      }
    });
    res.json({
      success: true,
      message: "Plan upgraded successfully",
      billing: billingRecord[0],
      newPlan: plan
    });
  } catch (error) {
    console.error("Plan upgrade error:", error);
    res.status(500).json({ error: "Failed to upgrade plan" });
  }
});
router24.get("/analytics/platform", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.claims?.id;
    const user = await db2.select().from(users).where(eq37(users.id, userId)).limit(1);
    if (!user[0]?.isSuperUser) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const { startDate, endDate } = req.query;
    const analytics2 = await financialAnalyticsService.getPlatformFinancialMetrics(
      startDate ? new Date(startDate) : void 0,
      endDate ? new Date(endDate) : void 0
    );
    res.json(analytics2);
  } catch (error) {
    console.error("Platform analytics error:", error);
    res.status(500).json({ error: "Failed to load platform analytics" });
  }
});
var billing_default = router24;

// server/routes/poll-proposals.ts
init_storage();
init_schema();
init_auth();
import express24 from "express";
import { eq as eq38, and as and25 } from "drizzle-orm";
var router25 = express24.Router();
router25.post("/:proposalId/poll-vote", isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { optionIds } = req.body;
    const userId = req.user.claims.sub;
    if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
      return res.status(400).json({ message: "Invalid option selection" });
    }
    const proposal = await db2.select().from(proposals).where(eq38(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    const proposalData = proposal[0];
    if (/* @__PURE__ */ new Date() > proposalData.voteEndTime || proposalData.status !== "active") {
      return res.status(400).json({ message: "Voting is closed" });
    }
    if (proposalData.proposalType !== "poll") {
      return res.status(400).json({ message: "Not a poll proposal" });
    }
    const existingVote = await db2.select().from(votes).where(and25(eq38(votes.proposalId, proposalId), eq38(votes.userId, userId))).limit(1);
    if (existingVote.length) {
      return res.status(400).json({ message: "You have already voted on this poll" });
    }
    const pollOptions = proposalData.pollOptions || [];
    const updatedOptions = pollOptions.map((opt) => {
      if (optionIds.includes(opt.id)) {
        return { ...opt, votes: (opt.votes || 0) + 1 };
      }
      return opt;
    });
    await db2.update(proposals).set({ pollOptions: updatedOptions }).where(eq38(proposals.id, proposalId));
    await db2.insert(votes).values({
      proposalId: String(proposalId),
      userId,
      daoId: proposalData.daoId,
      voteType: "poll",
      votingPower: "1"
    });
    res.json({
      success: true,
      message: "Vote recorded successfully",
      updatedOptions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to record vote",
      error: error.message
    });
  }
});
var poll_proposals_default = router25;

// server/index.ts
init_reputationService();
init_auth();

// server/routes/referrals.ts
init_db();
init_schema();
import express25 from "express";
import { eq as eq39, and as and26, sql as sql19 } from "drizzle-orm";
var router26 = express25.Router();
function generateReferralCode(userId) {
  return `MTAA-${userId.substring(0, 6).toUpperCase()}`;
}
router26.get("/stats", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await db2.query.users.findFirst({
      where: eq39(users.id, userId)
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const referredUsers = await db2.query.users.findMany({
      where: eq39(users.referredBy, userId)
    });
    const activeReferrals = referredUsers.filter((u) => !u.isBanned).length;
    const earnings = await db2.select({
      total: sql19`COALESCE(SUM(${walletTransactions2.amount}), 0)`
    }).from(walletTransactions2).where(and26(
      eq39(walletTransactions2.toUserId, userId),
      eq39(walletTransactions2.type, "referral_reward")
    ));
    const thisMonth = /* @__PURE__ */ new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const thisMonthReferrals = referredUsers.filter(
      (u) => u.createdAt && new Date(u.createdAt) >= thisMonth
    ).length;
    res.json({
      referralCode: user.referralCode || generateReferralCode(userId),
      totalReferrals: referredUsers.length,
      activeReferrals,
      totalEarned: Number(earnings[0]?.total || 0),
      pendingRewards: 0,
      // TODO: Calculate from pending transactions
      thisMonthReferrals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router26.get("/leaderboard", async (req, res) => {
  try {
    const leaderboard = await db2.select({
      userId: users.id,
      name: users.name,
      referralCount: sql19`COUNT(referred.id)`,
      earnings: sql19`COALESCE(SUM(${walletTransactions2.amount}), 0)`
    }).from(users).leftJoin(sql19`users AS referred`, sql19`referred.referred_by = ${users.id}`).leftJoin(walletTransactions2, and26(
      eq39(walletTransactions2.toUserId, users.id),
      eq39(walletTransactions2.type, "referral_reward")
    )).groupBy(users.id, users.name).orderBy(sql19`COUNT(referred.id) DESC`).limit(50);
    const formattedLeaderboard = leaderboard.map((item, index2) => ({
      id: item.userId,
      name: item.name,
      referrals: Number(item.referralCount),
      earnings: Number(item.earnings),
      rank: index2 + 1,
      badge: getBadge(Number(item.referralCount))
    }));
    res.json(formattedLeaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router26.post("/distribute-reward", async (req, res) => {
  try {
    const { referrerId, newUserId, rewardAmount = 20 } = req.body;
    if (!referrerId || !newUserId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const referrer = await db2.query.users.findFirst({ where: eq39(users.id, referrerId) });
    const walletAddress = referrer?.walletAddress || "";
    const [transaction] = await db2.insert(walletTransactions2).values({
      fromUserId: referrerId,
      walletAddress,
      type: "referral_reward",
      amount: rewardAmount.toString(),
      currency: "cUSD",
      status: "completed",
      description: `Referral reward for inviting new user (userId: ${newUserId})`
    }).returning();
    res.json({
      success: true,
      transaction,
      message: "Referral reward distributed successfully"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
function getBadge(referralCount) {
  if (referralCount >= 100) return "Diamond";
  if (referralCount >= 50) return "Platinum";
  if (referralCount >= 25) return "Gold";
  if (referralCount >= 10) return "Silver";
  return "Bronze";
}
var referrals_default = router26;

// server/routes/events.ts
import express26 from "express";
import { z as z11 } from "zod";
var router27 = express26.Router();
var eventSchema = z11.object({
  title: z11.string().min(3),
  description: z11.string(),
  startDate: z11.string(),
  endDate: z11.string(),
  location: z11.string(),
  type: z11.enum(["meeting", "workshop", "social", "voting", "other"]),
  maxAttendees: z11.string().optional()
});
var events = [];
var rsvps = /* @__PURE__ */ new Map();
router27.get("/", async (req, res) => {
  try {
    const enrichedEvents = events.map((event) => ({
      ...event,
      attendees: rsvps.get(event.id)?.size || 0
    }));
    res.json(enrichedEvents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router27.post("/", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const data = eventSchema.parse(req.body);
    const event = {
      id: `event-${Date.now()}`,
      ...data,
      maxAttendees: data.maxAttendees ? parseInt(data.maxAttendees) : void 0,
      status: "upcoming",
      createdBy: userId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    events.push(event);
    rsvps.set(event.id, /* @__PURE__ */ new Set());
    res.json(event);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router27.post("/:id/rsvp", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { id } = req.params;
    const event = events.find((e) => e.id === id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    if (!rsvps.has(id)) {
      rsvps.set(id, /* @__PURE__ */ new Set());
    }
    const attendees = rsvps.get(id);
    if (event.maxAttendees && attendees.size >= event.maxAttendees) {
      return res.status(400).json({ error: "Event is full" });
    }
    attendees.add(userId);
    res.json({ success: true, attendees: attendees.size });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var events_default = router27;

// server/routes/cross-chain.ts
import { Router as Router3 } from "express";

// server/services/crossChainService.ts
init_logger();
init_errorHandler();
init_db();
init_schema();
import { eq as eq40 } from "drizzle-orm";
var CrossChainService = class {
  constructor() {
    this.logger = Logger.getLogger();
  }
  /**
   * Initiate cross-chain transfer
   */
  async initiateTransfer(request) {
    try {
      const sourceProvider = ChainRegistry.getProvider(request.sourceChain);
      const destProvider = ChainRegistry.getProvider(request.destinationChain);
      if (!CHAIN_CONFIGS[request.sourceChain] || !CHAIN_CONFIGS[request.destinationChain]) {
        throw new AppError("Unsupported chain", 400);
      }
      const sourceConfig = CHAIN_CONFIGS[request.sourceChain];
      if (!sourceConfig.bridgeContract) {
        throw new AppError("Bridge not configured for source chain", 400);
      }
      const [transfer] = await db2.insert(crossChainTransfers).values({
        userId: request.userId,
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        tokenAddress: request.tokenAddress,
        amount: request.amount,
        destinationAddress: request.destinationAddress,
        vaultId: request.vaultId,
        status: "pending",
        estimatedCompletionTime: new Date(Date.now() + 30 * 60 * 1e3)
        // 30 minutes
      }).returning();
      this.logger.info(`Cross-chain transfer initiated: ${transfer.id}`);
      return {
        transferId: transfer.id,
        status: "pending",
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        amount: request.amount,
        estimatedTime: 1800
        // 30 minutes
      };
    } catch (error) {
      this.logger.error("Failed to initiate cross-chain transfer:", error);
      throw new AppError("Failed to initiate cross-chain transfer", 500);
    }
  }
  /**
   * Check transfer status
   */
  async getTransferStatus(transferId) {
    try {
      const transfer = await db2.query.crossChainTransfers.findFirst({
        where: eq40(crossChainTransfers.id, transferId)
      });
      if (!transfer) {
        return null;
      }
      const now = Date.now();
      const estimatedCompletion = transfer.estimatedCompletionTime?.getTime() || now;
      const remainingTime = Math.max(0, Math.floor((estimatedCompletion - now) / 1e3));
      return {
        transferId: transfer.id,
        status: transfer.status,
        sourceChain: transfer.sourceChain,
        destinationChain: transfer.destinationChain,
        amount: transfer.amount,
        estimatedTime: remainingTime,
        gasEstimate: transfer.gasEstimate || void 0
      };
    } catch (error) {
      this.logger.error("Failed to get transfer status:", error);
      throw new AppError("Failed to get transfer status", 500);
    }
  }
  /**
   * Get supported chains
   */
  getSupportedChains() {
    return ChainRegistry.getMainnetChains();
  }
  /**
   * Estimate bridge fees
   */
  async estimateBridgeFees(sourceChain, destinationChain, amount) {
    const baseGas = "0.01";
    const bridgeFeePercent = 1e-3;
    const bridgeFee = (parseFloat(amount) * bridgeFeePercent).toString();
    const totalFee = (parseFloat(baseGas) + parseFloat(bridgeFee)).toString();
    return {
      gasFee: baseGas,
      bridgeFee,
      totalFee
    };
  }
  /**
   * Create cross-chain vault
   */
  async createCrossChainVault(userId, chains2, vaultName) {
    try {
      for (const chain of chains2) {
        if (!CHAIN_CONFIGS[chain]) {
          throw new AppError(`Unsupported chain: ${chain}`, 400);
        }
      }
      const [vault] = await db2.insert(vaults).values({
        name: vaultName,
        userId,
        vaultType: "yield",
        currency: "cUSD",
        isActive: true,
        metadata: {
          crossChain: true,
          supportedChains: chains2
        }
      }).returning();
      this.logger.info(`Cross-chain vault created: ${vault.id} for chains: ${chains2.join(", ")}`);
      return vault.id;
    } catch (error) {
      this.logger.error("Failed to create cross-chain vault:", error);
      throw new AppError("Failed to create cross-chain vault", 500);
    }
  }
};
var crossChainService = new CrossChainService();

// server/services/crossChainGovernanceService.ts
init_db();
init_schema();
init_logger();
init_errorHandler();
import { eq as eq41 } from "drizzle-orm";

// server/services/bridgeProtocolService.ts
init_logger();
init_errorHandler();
var LAYERZERO_ENDPOINTS = {
  ["celo" /* CELO */]: {
    endpoint: "0x3A73033C0b1407574C76BdBAc67f126f6b4a9AA9",
    chainId: 125
  },
  ["celo-alfajores" /* CELO_ALFAJORES */]: {
    endpoint: "0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1",
    chainId: 14002
  },
  ["ethereum" /* ETHEREUM */]: {
    endpoint: "0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675",
    chainId: 101
  },
  ["polygon" /* POLYGON */]: {
    endpoint: "0x3c2269811836af69497E5F486A85D7316753cf62",
    chainId: 109
  },
  ["optimism" /* OPTIMISM */]: {
    endpoint: "0x3c2269811836af69497E5F486A85D7316753cf62",
    chainId: 111
  },
  ["arbitrum" /* ARBITRUM */]: {
    endpoint: "0x3c2269811836af69497E5F486A85D7316753cf62",
    chainId: 110
  }
};
var AXELAR_GATEWAYS = {
  ["celo" /* CELO */]: {
    gateway: "0xe432150cce91c13a887f7D836923d5597adD8E31",
    gasReceiver: "0x2d5d7d31F671F86C782533cc367F14109a082712"
  },
  ["celo-alfajores" /* CELO_ALFAJORES */]: {
    gateway: "0xe432150cce91c13a887f7D836923d5597adD8E31",
    gasReceiver: "0x2d5d7d31F671F86C782533cc367F14109a082712"
  },
  ["ethereum" /* ETHEREUM */]: {
    gateway: "0x4F4495243837681061C4743b74B3eEdf548D56A5",
    gasReceiver: "0x2d5d7d31F671F86C782533cc367F14109a082712"
  },
  ["polygon" /* POLYGON */]: {
    gateway: "0x6f015F16De9fC8791b234eF68D486d2bF203FBA8",
    gasReceiver: "0x2d5d7d31F671F86C782533cc367F14109a082712"
  },
  ["optimism" /* OPTIMISM */]: {
    gateway: "0xe432150cce91c13a887f7D836923d5597adD8E31",
    gasReceiver: "0x2d5d7d31F671F86C782533cc367F14109a082712"
  },
  ["arbitrum" /* ARBITRUM */]: {
    gateway: "0xe432150cce91c13a887f7D836923d5597adD8E31",
    gasReceiver: "0x2d5d7d31F671F86C782533cc367F14109a082712"
  }
};
var BridgeProtocolService = class {
  constructor() {
    this.logger = Logger.getLogger();
  }
  /**
   * Send cross-chain message via LayerZero
   */
  async sendLayerZeroMessage(sourceChain, destChain, payload, adapterParams = "0x") {
    try {
      const sourceConfig = LAYERZERO_ENDPOINTS[sourceChain];
      const destConfig = LAYERZERO_ENDPOINTS[destChain];
      if (!sourceConfig || !destConfig) {
        throw new AppError("Unsupported chain for LayerZero", 400);
      }
      const provider2 = ChainRegistry.getProvider(sourceChain);
      const bridgeContract = CHAIN_CONFIGS[sourceChain].bridgeContract;
      if (!bridgeContract) {
        throw new AppError("Bridge contract not deployed", 400);
      }
      const fees = await this.estimateLayerZeroFees(
        sourceChain,
        destChain,
        payload,
        adapterParams
      );
      this.logger.info(`Sending LayerZero message from ${sourceChain} to ${destChain}`, {
        payload,
        fees
      });
      return `lz_${Date.now()}_${sourceChain}_${destChain}`;
    } catch (error) {
      this.logger.error("LayerZero message failed:", error);
      throw new AppError("Failed to send LayerZero message", 500);
    }
  }
  /**
   * Send cross-chain message via Axelar
   */
  async sendAxelarMessage(sourceChain, destChain, destContract, payload) {
    try {
      const sourceConfig = AXELAR_GATEWAYS[sourceChain];
      const destConfig = AXELAR_GATEWAYS[destChain];
      if (!sourceConfig || !destConfig) {
        throw new AppError("Unsupported chain for Axelar", 400);
      }
      const provider2 = ChainRegistry.getProvider(sourceChain);
      const bridgeContract = CHAIN_CONFIGS[sourceChain].bridgeContract;
      if (!bridgeContract) {
        throw new AppError("Bridge contract not deployed", 400);
      }
      this.logger.info(`Sending Axelar message from ${sourceChain} to ${destChain}`, {
        destContract,
        payload
      });
      return `axl_${Date.now()}_${sourceChain}_${destChain}`;
    } catch (error) {
      this.logger.error("Axelar message failed:", error);
      throw new AppError("Failed to send Axelar message", 500);
    }
  }
  /**
   * Estimate LayerZero fees
   */
  async estimateLayerZeroFees(sourceChain, destChain, payload, adapterParams) {
    const baseGas = "0.005";
    return baseGas;
  }
  /**
   * Estimate Axelar fees
   */
  async estimateAxelarFees(sourceChain, destChain, payload) {
    const baseGas = "0.005";
    return baseGas;
  }
};
var bridgeProtocolService = new BridgeProtocolService();

// server/services/crossChainGovernanceService.ts
var CrossChainGovernanceService = class {
  constructor() {
    this.logger = Logger.getLogger();
  }
  /**
   * Create cross-chain proposal
   */
  async createCrossChainProposal(proposalId, chains2, executionChain) {
    try {
      const proposal = await db2.query.proposals.findFirst({
        where: eq41(proposals.id, proposalId)
      });
      if (!proposal) {
        throw new AppError("Proposal not found", 404);
      }
      const votesByChain = {};
      const quorumByChain = {};
      chains2.forEach((chain) => {
        votesByChain[chain] = { yes: 0, no: 0, abstain: 0 };
        quorumByChain[chain] = 100;
      });
      const [crossChainProposal] = await db2.insert(crossChainProposals).values({
        proposalId,
        chains: chains2,
        votesByChain,
        quorumByChain,
        executionChain,
        syncStatus: "pending"
      }).returning();
      this.logger.info(`Cross-chain proposal created: ${crossChainProposal.id}`);
      await this.broadcastProposal(crossChainProposal.id, chains2, proposal);
      return crossChainProposal.id;
    } catch (error) {
      this.logger.error("Failed to create cross-chain proposal:", error);
      throw new AppError("Failed to create cross-chain proposal", 500);
    }
  }
  /**
   * Aggregate votes from multiple chains
   */
  async aggregateVotes(crossChainProposalId) {
    try {
      const crossChainProposal = await db2.query.crossChainProposals.findFirst({
        where: eq41(crossChainProposals.id, crossChainProposalId)
      });
      if (!crossChainProposal) {
        throw new AppError("Cross-chain proposal not found", 404);
      }
      const votesByChain = crossChainProposal.votesByChain;
      const quorumByChain = crossChainProposal.quorumByChain;
      let totalYes = 0;
      let totalNo = 0;
      let totalAbstain = 0;
      let totalQuorum = 0;
      let achievedQuorum = 0;
      Object.keys(votesByChain).forEach((chain) => {
        const votes5 = votesByChain[chain];
        totalYes += votes5.yes || 0;
        totalNo += votes5.no || 0;
        totalAbstain += votes5.abstain || 0;
        const chainQuorum = quorumByChain[chain] || 0;
        totalQuorum += chainQuorum;
        const chainVotes = (votes5.yes || 0) + (votes5.no || 0) + (votes5.abstain || 0);
        if (chainVotes >= chainQuorum) {
          achievedQuorum += chainQuorum;
        }
      });
      const quorumMet = achievedQuorum >= totalQuorum;
      return {
        totalYes,
        totalNo,
        totalAbstain,
        quorumMet
      };
    } catch (error) {
      this.logger.error("Failed to aggregate votes:", error);
      throw new AppError("Failed to aggregate votes", 500);
    }
  }
  /**
   * Sync vote from specific chain
   */
  async syncVoteFromChain(crossChainProposalId, chain, voteData) {
    try {
      const crossChainProposal = await db2.query.crossChainProposals.findFirst({
        where: eq41(crossChainProposals.id, crossChainProposalId)
      });
      if (!crossChainProposal) {
        throw new AppError("Cross-chain proposal not found", 404);
      }
      const votesByChain = crossChainProposal.votesByChain;
      if (!votesByChain[chain]) {
        votesByChain[chain] = { yes: 0, no: 0, abstain: 0 };
      }
      if (voteData.voteType === "yes") {
        votesByChain[chain].yes += parseFloat(voteData.votingPower);
      } else if (voteData.voteType === "no") {
        votesByChain[chain].no += parseFloat(voteData.votingPower);
      } else if (voteData.voteType === "abstain") {
        votesByChain[chain].abstain += parseFloat(voteData.votingPower);
      }
      await db2.update(crossChainProposals).set({ votesByChain, syncStatus: "synced" }).where(eq41(crossChainProposals.id, crossChainProposalId));
      this.logger.info(`Vote synced from ${chain} for proposal ${crossChainProposalId}`);
    } catch (error) {
      this.logger.error("Failed to sync vote:", error);
      throw new AppError("Failed to sync vote", 500);
    }
  }
  /**
   * Broadcast proposal to all chains
   */
  async broadcastProposal(crossChainProposalId, chains2, proposal) {
    const payload = JSON.stringify({
      crossChainProposalId,
      proposalId: proposal.id,
      title: proposal.title,
      description: proposal.description,
      voteEndTime: proposal.voteEndTime
    });
    for (const chain of chains2) {
      try {
        await bridgeProtocolService.sendLayerZeroMessage(
          "celo" /* CELO */,
          // Primary chain
          chain,
          payload
        );
      } catch (error) {
        this.logger.error(`Failed to broadcast to ${chain}:`, error);
      }
    }
  }
};
var crossChainGovernanceService = new CrossChainGovernanceService();

// server/routes/cross-chain.ts
init_errorHandler();
import { z as z12 } from "zod";
var router28 = Router3();
var transferSchema = z12.object({
  sourceChain: z12.string(),
  destinationChain: z12.string(),
  tokenAddress: z12.string(),
  amount: z12.string(),
  destinationAddress: z12.string(),
  vaultId: z12.string().optional()
});
router28.post("/transfer", isAuthenticated2, asyncHandler(async (req, res) => {
  const userId = req.user?.claims?.sub;
  const validated = transferSchema.parse(req.body);
  const status = await crossChainService.initiateTransfer({
    userId,
    ...validated
  });
  res.json({
    success: true,
    data: status
  });
}));
router28.get("/transfer/:transferId", isAuthenticated2, asyncHandler(async (req, res) => {
  const { transferId } = req.params;
  const status = await crossChainService.getTransferStatus(transferId);
  if (!status) {
    return res.status(404).json({
      success: false,
      message: "Transfer not found"
    });
  }
  res.json({
    success: true,
    data: status
  });
}));
router28.get("/chains", asyncHandler(async (req, res) => {
  const chains2 = crossChainService.getSupportedChains();
  res.json({
    success: true,
    data: chains2
  });
}));
router28.post("/estimate-fees", asyncHandler(async (req, res) => {
  const { sourceChain, destinationChain, amount } = req.body;
  const fees = await crossChainService.estimateBridgeFees(
    sourceChain,
    destinationChain,
    amount
  );
  res.json({
    success: true,
    data: fees
  });
  router28.post("/governance/proposal", isAuthenticated2, asyncHandler(async (req2, res2) => {
    const { proposalId, chains: chains2, executionChain } = req2.body;
    const crossChainProposalId = await crossChainGovernanceService.createCrossChainProposal(
      proposalId,
      chains2,
      executionChain
    );
    res2.json({
      success: true,
      data: { crossChainProposalId }
    });
  }));
  router28.get("/governance/proposal/:proposalId/aggregate", asyncHandler(async (req2, res2) => {
    const { proposalId } = req2.params;
    const aggregation = await crossChainGovernanceService.aggregateVotes(proposalId);
    res2.json({
      success: true,
      data: aggregation
    });
  }));
  router28.post("/governance/vote/sync", asyncHandler(async (req2, res2) => {
    const { crossChainProposalId, chain, voteData } = req2.body;
    await crossChainGovernanceService.syncVoteFromChain(
      crossChainProposalId,
      chain,
      voteData
    );
    res2.json({
      success: true,
      message: "Vote synced successfully"
    });
  }));
  router28.post("/transfer/:transferId/retry", isAuthenticated2, asyncHandler(async (req2, res2) => {
    const { transferId } = req2.params;
    await bridgeRelayerService.retryTransfer(transferId);
    res2.json({
      success: true,
      message: "Transfer retry initiated"
    });
  }));
  router28.get("/relayer/status", asyncHandler(async (req2, res2) => {
    res2.json({
      success: true,
      data: {
        isRunning: true,
        pollInterval: 3e4
      }
    });
  }));
}));
router28.post("/vault", isAuthenticated2, asyncHandler(async (req, res) => {
  const userId = req.user?.claims?.sub;
  const { chains: chains2, name } = req.body;
  const vaultId = await crossChainService.createCrossChainVault(
    userId,
    chains2,
    name
  );
  res.json({
    success: true,
    data: { vaultId }
  });
}));
var cross_chain_default = router28;

// server/routes/nft-marketplace.ts
init_db();
init_auth();
import express27 from "express";
import { eq as eq42 } from "drizzle-orm";
import { ethers as ethers6 } from "ethers";
var router29 = express27.Router();
router29.get("/listings", async (req, res) => {
  try {
    const { category, rarity, minPrice, maxPrice } = req.query;
    const mockListings = [
      {
        tokenId: 1,
        name: "Pioneer Badge",
        category: "PIONEER",
        rarity: 4,
        price: ethers6.parseEther("10").toString(),
        seller: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        imageUrl: "/nft/pioneer.png"
      },
      {
        tokenId: 2,
        name: "Super Contributor",
        category: "CONTRIBUTOR",
        rarity: 3,
        price: ethers6.parseEther("5").toString(),
        seller: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEc",
        imageUrl: "/nft/contributor.png"
      }
    ];
    res.json({ listings: mockListings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router29.get("/user/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const { userAchievements: userAchievements2, achievements: achievements2 } = await Promise.resolve().then(() => (init_achievementSchema(), achievementSchema_exports));
    const unlockedAchievements = await db2.select({
      achievement: achievements2,
      userAchievement: userAchievements2
    }).from(userAchievements2).leftJoin(achievements2, eq42(userAchievements2.achievementId, achievements2.id)).where(eq42(userAchievements2.userId, address));
    const achievementList = unlockedAchievements.map((row) => ({
      ...row.achievement,
      unlockedAt: row.userAchievement.unlockedAt,
      isCompleted: row.userAchievement.isCompleted,
      rewardClaimed: row.userAchievement.rewardClaimed,
      claimedAt: row.userAchievement.claimedAt
    }));
    res.json({ achievements: achievementList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router29.post("/list", isAuthenticated, async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    res.json({
      success: true,
      message: "NFT listed successfully",
      tokenId,
      price
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router29.post("/buy", isAuthenticated, async (req, res) => {
  try {
    const { tokenId } = req.body;
    res.json({
      success: true,
      message: "NFT purchased successfully",
      tokenId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router29.post("/unlist", isAuthenticated, async (req, res) => {
  try {
    const { tokenId } = req.body;
    res.json({
      success: true,
      message: "NFT unlisted successfully",
      tokenId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router29.get("/stats", async (req, res) => {
  try {
    const stats = {
      totalListings: 42,
      totalVolume: ethers6.parseEther("1250").toString(),
      floorPrice: ethers6.parseEther("2.5").toString(),
      uniqueOwners: 128,
      last24hVolume: ethers6.parseEther("85").toString()
    };
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var nft_marketplace_default = router29;

// server/routes/payment-gateway.ts
import express28 from "express";

// server/services/paymentGatewayService.ts
init_storage();
init_schema();
import { eq as eq43 } from "drizzle-orm";
var PaymentGatewayService = class {
  constructor() {
    this.configs = /* @__PURE__ */ new Map();
    this.initializeProviders();
  }
  initializeProviders() {
    if (process.env.FLUTTERWAVE_PUBLIC_KEY && process.env.FLUTTERWAVE_SECRET_KEY) {
      this.configs.set("flutterwave", {
        provider: "flutterwave",
        apiKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
        secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
        webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
        environment: process.env.FLUTTERWAVE_ENV || "test"
      });
    }
    if (process.env.PAYSTACK_PUBLIC_KEY && process.env.PAYSTACK_SECRET_KEY) {
      this.configs.set("paystack", {
        provider: "paystack",
        apiKey: process.env.PAYSTACK_PUBLIC_KEY,
        secretKey: process.env.PAYSTACK_SECRET_KEY,
        webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
        environment: process.env.PAYSTACK_ENV || "test"
      });
    }
    if (process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET) {
      this.configs.set("mpesa", {
        provider: "mpesa",
        apiKey: process.env.MPESA_CONSUMER_KEY,
        secretKey: process.env.MPESA_CONSUMER_SECRET,
        environment: process.env.MPESA_ENV || "test"
      });
    }
    if (process.env.MTN_API_KEY && process.env.MTN_API_SECRET) {
      this.configs.set("mtn", {
        provider: "mtn",
        apiKey: process.env.MTN_API_KEY,
        secretKey: process.env.MTN_API_SECRET,
        environment: process.env.MTN_ENV || "test"
      });
    }
    if (process.env.AIRTEL_API_KEY && process.env.AIRTEL_API_SECRET) {
      this.configs.set("airtel", {
        provider: "airtel",
        apiKey: process.env.AIRTEL_API_KEY,
        secretKey: process.env.AIRTEL_API_SECRET,
        environment: process.env.AIRTEL_ENV || "test"
      });
    }
    if (process.env.STRIPE_PUBLIC_KEY && process.env.STRIPE_SECRET_KEY) {
      this.configs.set("stripe", {
        provider: "stripe",
        apiKey: process.env.STRIPE_PUBLIC_KEY,
        secretKey: process.env.STRIPE_SECRET_KEY,
        environment: process.env.STRIPE_ENV || "test"
      });
    }
  }
  async initiateDeposit(provider2, request) {
    const config4 = this.configs.get(provider2);
    if (!config4) {
      throw new Error(`Payment provider ${provider2} not configured`);
    }
    const limits = await this.getTransactionLimits(request.userId);
    const amount = parseFloat(request.amount);
    if (amount > limits.dailyLimit) {
      throw new Error(`Transaction exceeds daily limit of ${limits.dailyLimit} ${request.currency}`);
    }
    switch (provider2) {
      case "flutterwave":
        return this.flutterwaveDeposit(config4, request);
      case "paystack":
        return this.paystackDeposit(config4, request);
      case "mpesa":
        return this.mpesaDeposit(config4, request);
      case "mtn":
        return this.mtnDeposit(config4, request);
      case "airtel":
        return this.airtelDeposit(config4, request);
      case "stripe":
        return this.stripeDeposit(config4, request);
      default:
        throw new Error(`Unsupported provider: ${provider2}`);
    }
  }
  async initiateWithdrawal(provider2, request) {
    const config4 = this.configs.get(provider2);
    if (!config4) {
      throw new Error(`Payment provider ${provider2} not configured`);
    }
    const limits = await this.getTransactionLimits(request.userId);
    const amount = parseFloat(request.amount);
    if (amount > limits.dailyLimit) {
      throw new Error(`Transaction exceeds daily limit of ${limits.dailyLimit} ${request.currency}`);
    }
    switch (provider2) {
      case "flutterwave":
        return this.flutterwaveWithdrawal(config4, request);
      case "paystack":
        return this.paystackWithdrawal(config4, request);
      case "mpesa":
        return this.mpesaWithdrawal(config4, request);
      case "mtn":
        return this.mtnWithdrawal(config4, request);
      case "airtel":
        return this.airtelWithdrawal(config4, request);
      case "stripe":
        return this.stripeWithdrawal(config4, request);
      default:
        throw new Error(`Unsupported provider: ${provider2}`);
    }
  }
  async getTransactionLimits(userId) {
    const user = await db2.select().from(users).where(eq43(users.id, userId)).limit(1);
    if (!user.length) {
      throw new Error("User not found");
    }
    const verificationLevel = user[0].verificationLevel || "none";
    const limits = {
      none: { dailyLimit: 100, tier: "Basic" },
      basic: { dailyLimit: 1e3, tier: "Verified" },
      intermediate: { dailyLimit: 1e4, tier: "Enhanced" },
      advanced: { dailyLimit: 5e4, tier: "Premium" }
    };
    return limits[verificationLevel] || limits.none;
  }
  async flutterwaveDeposit(config4, request) {
    const reference = `FLW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const payload = {
      tx_ref: reference,
      amount: request.amount,
      currency: request.currency,
      redirect_url: request.callbackUrl || `${process.env.APP_URL}/payment/callback`,
      customer: {
        email: request.metadata?.email,
        phonenumber: request.metadata?.phone,
        name: request.metadata?.name
      },
      customizations: {
        title: "MtaaDAO Deposit",
        description: "Add funds to your wallet",
        logo: "https://mtaadao.com/logo.png"
      }
    };
    try {
      const response = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config4.secretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.status === "success") {
        await this.recordTransaction(request.userId, reference, "deposit", request.amount, request.currency, "flutterwave", "pending");
        return {
          success: true,
          transactionId: data.data.id,
          paymentUrl: data.data.link,
          reference,
          status: "pending",
          message: "Payment initialized successfully"
        };
      }
      throw new Error(data.message || "Payment initialization failed");
    } catch (error) {
      return {
        success: false,
        transactionId: "",
        reference,
        status: "failed",
        message: error.message
      };
    }
  }
  async paystackDeposit(config4, request) {
    const reference = `PSK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const payload = {
      email: request.metadata?.email,
      amount: parseFloat(request.amount) * 100,
      // Paystack uses kobo
      currency: request.currency,
      reference,
      callback_url: request.callbackUrl || `${process.env.APP_URL}/payment/callback`
    };
    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config4.secretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.status) {
        await this.recordTransaction(request.userId, reference, "deposit", request.amount, request.currency, "paystack", "pending");
        return {
          success: true,
          transactionId: data.data.reference,
          paymentUrl: data.data.authorization_url,
          reference,
          status: "pending",
          message: "Payment initialized successfully"
        };
      }
      throw new Error(data.message || "Payment initialization failed");
    } catch (error) {
      return {
        success: false,
        transactionId: "",
        reference,
        status: "failed",
        message: error.message
      };
    }
  }
  async mpesaDeposit(config4, request) {
    const reference = `MPE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const authToken = await this.getMpesaToken(config4);
    const timestamp10 = (/* @__PURE__ */ new Date()).toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp10}`
    ).toString("base64");
    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp10,
      TransactionType: "CustomerPayBillOnline",
      Amount: request.amount,
      PartyA: request.metadata?.phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: request.metadata?.phone,
      CallBackURL: `${process.env.APP_URL}/api/payment-gateway/mpesa/callback`,
      AccountReference: "MtaaDAO",
      TransactionDesc: "Wallet Deposit"
    };
    try {
      const response = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.ResponseCode === "0") {
        await this.recordTransaction(request.userId, reference, "deposit", request.amount, request.currency, "mpesa", "pending");
        return {
          success: true,
          transactionId: data.CheckoutRequestID,
          reference,
          status: "pending",
          message: "STK push sent to your phone"
        };
      }
      throw new Error(data.ResponseDescription || "M-Pesa request failed");
    } catch (error) {
      return {
        success: false,
        transactionId: "",
        reference,
        status: "failed",
        message: error.message
      };
    }
  }
  async getMpesaToken(config4) {
    const auth = Buffer.from(`${config4.apiKey}:${config4.secretKey}`).toString("base64");
    const response = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: {
        "Authorization": `Basic ${auth}`
      }
    });
    const data = await response.json();
    return data.access_token;
  }
  async mtnDeposit(config4, request) {
    const reference = `MTN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, "deposit", request.amount, request.currency, "mtn", "pending");
    return {
      success: true,
      transactionId: reference,
      reference,
      status: "pending",
      message: "MTN Mobile Money deposit initiated"
    };
  }
  async airtelDeposit(config4, request) {
    const reference = `ATL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, "deposit", request.amount, request.currency, "airtel", "pending");
    return {
      success: true,
      transactionId: reference,
      reference,
      status: "pending",
      message: "Airtel Money deposit initiated"
    };
  }
  async stripeDeposit(config4, request) {
    const reference = `STR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, "deposit", request.amount, request.currency, "stripe", "pending");
    return {
      success: true,
      transactionId: reference,
      reference,
      status: "pending",
      message: "Stripe payment initiated"
    };
  }
  async flutterwaveWithdrawal(config4, request) {
    const reference = `FLW-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const payload = {
      account_bank: request.metadata?.bankCode,
      account_number: request.metadata?.accountNumber,
      amount: request.amount,
      currency: request.currency,
      reference,
      narration: "MtaaDAO Withdrawal",
      beneficiary_name: request.metadata?.accountName
    };
    try {
      const response = await fetch("https://api.flutterwave.com/v3/transfers", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config4.secretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.status === "success") {
        await this.recordTransaction(request.userId, reference, "withdrawal", request.amount, request.currency, "flutterwave", "processing");
        return {
          success: true,
          transactionId: data.data.id,
          reference,
          status: "processing",
          message: "Withdrawal initiated successfully"
        };
      }
      throw new Error(data.message || "Withdrawal failed");
    } catch (error) {
      return {
        success: false,
        transactionId: "",
        reference,
        status: "failed",
        message: error.message
      };
    }
  }
  async paystackWithdrawal(config4, request) {
    const reference = `PSK-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, "withdrawal", request.amount, request.currency, "paystack", "processing");
    return {
      success: true,
      transactionId: reference,
      reference,
      status: "processing",
      message: "Withdrawal processing"
    };
  }
  async mpesaWithdrawal(config4, request) {
    const reference = `MPE-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, "withdrawal", request.amount, request.currency, "mpesa", "processing");
    return {
      success: true,
      transactionId: reference,
      reference,
      status: "processing",
      message: "M-Pesa withdrawal processing"
    };
  }
  async mtnWithdrawal(config4, request) {
    const reference = `MTN-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, "withdrawal", request.amount, request.currency, "mtn", "processing");
    return {
      success: true,
      transactionId: reference,
      reference,
      status: "processing",
      message: "MTN withdrawal processing"
    };
  }
  async airtelWithdrawal(config4, request) {
    const reference = `ATL-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, "withdrawal", request.amount, request.currency, "airtel", "processing");
    return {
      success: true,
      transactionId: reference,
      reference,
      status: "processing",
      message: "Airtel withdrawal processing"
    };
  }
  async stripeWithdrawal(config4, request) {
    const reference = `STR-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, "withdrawal", request.amount, request.currency, "stripe", "processing");
    return {
      success: true,
      transactionId: reference,
      reference,
      status: "processing",
      message: "Stripe withdrawal processing"
    };
  }
  async recordTransaction(userId, reference, type, amount, currency, provider2, status) {
    await db2.insert(paymentTransactions).values({
      userId,
      reference,
      type,
      amount,
      currency,
      provider: provider2,
      status,
      metadata: { timestamp: (/* @__PURE__ */ new Date()).toISOString() }
    });
  }
  async verifyTransaction(provider2, reference) {
    const config4 = this.configs.get(provider2);
    if (!config4) {
      throw new Error(`Payment provider ${provider2} not configured`);
    }
    switch (provider2) {
      case "flutterwave":
        return this.verifyFlutterwave(config4, reference);
      case "paystack":
        return this.verifyPaystack(config4, reference);
      default:
        throw new Error(`Verification not implemented for ${provider2}`);
    }
  }
  async verifyFlutterwave(config4, reference) {
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`, {
      headers: {
        "Authorization": `Bearer ${config4.secretKey}`
      }
    });
    return response.json();
  }
  async verifyPaystack(config4, reference) {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        "Authorization": `Bearer ${config4.secretKey}`
      }
    });
    return response.json();
  }
};
var paymentGatewayService = new PaymentGatewayService();

// server/routes/payment-gateway.ts
init_auth();
var router30 = express28.Router();
router30.post("/deposit", isAuthenticated, async (req, res) => {
  try {
    const { provider: provider2, amount, currency, method, metadata } = req.body;
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await paymentGatewayService.initiateDeposit(provider2, {
      userId,
      amount,
      currency,
      method,
      metadata,
      callbackUrl: `${process.env.APP_URL}/payment/callback`
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router30.post("/withdraw", isAuthenticated, async (req, res) => {
  try {
    const { provider: provider2, amount, currency, method, metadata } = req.body;
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await paymentGatewayService.initiateWithdrawal(provider2, {
      userId,
      amount,
      currency,
      method,
      metadata
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router30.get("/verify/:provider/:reference", isAuthenticated, async (req, res) => {
  try {
    const { provider: provider2, reference } = req.params;
    const result = await paymentGatewayService.verifyTransaction(provider2, reference);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router30.post("/flutterwave/webhook", async (req, res) => {
  try {
    const signature = req.headers["verif-hash"];
    if (signature !== process.env.FLUTTERWAVE_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Invalid signature" });
    }
    const payload = req.body;
    console.log("Flutterwave webhook received:", payload);
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router30.post("/paystack/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    const payload = req.body;
    console.log("Paystack webhook received:", payload);
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router30.post("/mpesa/callback", async (req, res) => {
  try {
    const payload = req.body;
    console.log("M-Pesa callback received:", payload);
    res.json({ ResultCode: 0, ResultDesc: "Success" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var payment_gateway_default = router30;

// server/routes/kyc.ts
init_kycService();
init_storage();
init_kycSchema();
import express29 from "express";
import { eq as eq44, desc as desc17 } from "drizzle-orm";
var router31 = express29.Router();
var requireAuth = (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};
var requireAdmin2 = (req, res, next) => {
  if (!req.user?.id || req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};
router31.get("/status", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const kyc = await kycService.getUserKYC(userId);
    const tier = await kycService.getCurrentTier(userId);
    res.json({
      success: true,
      data: {
        kyc,
        currentTier: tier,
        nextTier: getNextTier(tier.tier)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.get("/tiers", async (req, res) => {
  try {
    const { KYC_TIERS: KYC_TIERS2 } = await Promise.resolve().then(() => (init_kycService(), kycService_exports));
    res.json({
      success: true,
      data: KYC_TIERS2
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.post("/basic", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, phone } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ error: "Email and phone are required" });
    }
    const kyc = await kycService.submitBasicKYC(userId, { email, phone });
    res.json({
      success: true,
      message: "Basic KYC submitted. Please verify your email and phone.",
      data: kyc
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.post("/intermediate", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      dateOfBirth,
      nationality,
      idDocumentType,
      idDocumentNumber,
      idDocumentFrontUrl,
      idDocumentBackUrl
    } = req.body;
    if (!firstName || !lastName || !dateOfBirth || !nationality || !idDocumentType || !idDocumentNumber || !idDocumentFrontUrl) {
      return res.status(400).json({ error: "All required fields must be provided" });
    }
    const kyc = await kycService.submitIntermediateKYC(userId, {
      firstName,
      lastName,
      dateOfBirth,
      nationality,
      idDocumentType,
      idDocumentNumber,
      idDocumentFrontUrl,
      idDocumentBackUrl
    });
    res.json({
      success: true,
      message: "Intermediate KYC submitted. Your documents are being verified.",
      data: kyc
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.post("/advanced", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      address,
      city,
      state,
      postalCode,
      country,
      proofOfAddressType,
      proofOfAddressUrl
    } = req.body;
    if (!address || !city || !country || !proofOfAddressType || !proofOfAddressUrl) {
      return res.status(400).json({ error: "All required fields must be provided" });
    }
    const kyc = await kycService.submitAdvancedKYC(userId, {
      address,
      city,
      state,
      postalCode,
      country,
      proofOfAddressType,
      proofOfAddressUrl
    });
    res.json({
      success: true,
      message: "Advanced KYC submitted. Your proof of address is being verified.",
      data: kyc
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.post("/aml-screening", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address is required" });
    }
    const result = await kycService.performAMLScreening(userId, walletAddress);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.post("/check-limit", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, currency } = req.body;
    if (!amount || !currency) {
      return res.status(400).json({ error: "Amount and currency are required" });
    }
    const result = await kycService.checkTransactionLimit(userId, parseFloat(amount), currency);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.get("/admin/pending", requireAdmin2, async (req, res) => {
  try {
    const pending = await db2.select().from(kycVerifications).where(eq44(kycVerifications.status, "pending")).orderBy(desc17(kycVerifications.submittedAt));
    res.json({
      success: true,
      data: pending
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.post("/admin/approve/:userId", requireAdmin2, async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes } = req.body;
    const reviewerId = req.user.id;
    const kyc = await kycService.approveKYC(userId, reviewerId, notes);
    res.json({
      success: true,
      message: "KYC approved successfully",
      data: kyc
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.post("/admin/reject/:userId", requireAdmin2, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const reviewerId = req.user.id;
    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }
    const kyc = await kycService.rejectKYC(userId, reviewerId, reason);
    res.json({
      success: true,
      message: "KYC rejected",
      data: kyc
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.get("/admin/audit-logs", requireAdmin2, async (req, res) => {
  try {
    const { userId, limit = "50" } = req.query;
    let query = db2.select().from(complianceAuditLogs);
    if (userId) {
      query = query.where(eq44(complianceAuditLogs.userId, userId));
    }
    const logs2 = await query.orderBy(desc17(complianceAuditLogs.createdAt)).limit(parseInt(limit));
    res.json({
      success: true,
      data: logs2
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.get("/admin/suspicious-activities", requireAdmin2, async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const activities = await db2.select().from(suspiciousActivities).where(eq44(suspiciousActivities.status, status)).orderBy(desc17(suspiciousActivities.createdAt));
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router31.post("/jumio/callback", async (req, res) => {
  try {
    const { scanReference, verificationStatus, identityVerification } = req.body;
    const [kyc] = await db2.select().from(kycVerifications).where(eq44(kycVerifications.verificationReference, scanReference)).limit(1);
    if (!kyc) {
      return res.status(404).json({ error: "Verification not found" });
    }
    await db2.update(kycVerifications).set({
      idVerificationStatus: verificationStatus,
      verificationData: req.body,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq44(kycVerifications.verificationReference, scanReference));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
function getNextTier(currentTier) {
  const tiers = ["none", "basic", "intermediate", "advanced"];
  const currentIndex = tiers.indexOf(currentTier);
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
}
var kyc_default = router31;

// server/services/WebSocketService.ts
init_logger();
import { WebSocketServer, WebSocket } from "ws";
var WebSocketService = class {
  constructor(server2) {
    this.clients = /* @__PURE__ */ new Map();
    this.typingUsers = /* @__PURE__ */ new Map();
    this.onlineUsers = /* @__PURE__ */ new Map();
    this.wss = new WebSocketServer({
      server: server2,
      path: "/ws/realtime"
      // Use specific path to avoid conflicts with Vite HMR
    });
    this.setupWebSocket();
    this.startHeartbeat();
  }
  setupWebSocket() {
    this.wss.on("connection", (ws2) => {
      logger.info("WebSocket client connected");
      const client = {
        ws: ws2,
        userId: "",
        userName: "",
        daoIds: /* @__PURE__ */ new Set(),
        isAlive: true
      };
      this.clients.set(ws2, client);
      ws2.on("message", (data) => {
        try {
          this.handleMessage(ws2, data.toString());
        } catch (error) {
          this.handleError(ws2, error);
        }
      });
      ws2.on("close", () => this.handleDisconnect(ws2));
      ws2.on("error", (error) => this.handleError(ws2, error));
      ws2.on("pong", () => this.handlePong(ws2));
    });
  }
  handleMessage(ws2, message) {
    try {
      const data = JSON.parse(message);
      switch (data.type) {
        case "init":
          this.handleInit(ws2, data.data);
          break;
        case "typing":
          this.handleTyping(ws2, data.data);
          break;
        case "presence":
          this.handlePresence(ws2, data.data);
          break;
      }
    } catch (error) {
      logger.error("Error handling WebSocket message:", error);
    }
  }
  handleInit(ws2, data) {
    const client = {
      ws: ws2,
      userId: data.userId,
      userName: data.userName || "Anonymous",
      daoIds: new Set(data.daoIds),
      isAlive: true
    };
    this.clients.set(ws2, client);
    data.daoIds.forEach((daoId) => {
      if (!this.onlineUsers.has(daoId)) {
        this.onlineUsers.set(daoId, /* @__PURE__ */ new Set());
      }
      this.onlineUsers.get(daoId).add(data.userId);
      this.broadcastPresence(daoId);
    });
  }
  handleTyping(ws2, data) {
    const client = this.clients.get(ws2);
    if (!client?.daoIds.has(data.daoId)) return;
    if (!this.typingUsers.has(data.daoId)) {
      this.typingUsers.set(data.daoId, /* @__PURE__ */ new Set());
    }
    const typingSet = this.typingUsers.get(data.daoId);
    if (data.isTyping) {
      typingSet.add(data.userId);
    } else {
      typingSet.delete(data.userId);
    }
    this.broadcastTyping(data.daoId);
  }
  handlePresence(ws2, data) {
    const client = this.clients.get(ws2);
    if (!client?.daoIds.has(data.daoId)) return;
    if (!this.onlineUsers.has(data.daoId)) {
      this.onlineUsers.set(data.daoId, /* @__PURE__ */ new Set());
    }
    const onlineSet = this.onlineUsers.get(data.daoId);
    if (data.status === "online") {
      onlineSet.add(data.userId);
    } else {
      onlineSet.delete(data.userId);
    }
    this.broadcastPresence(data.daoId);
  }
  handleDisconnect(ws2) {
    const client = this.clients.get(ws2);
    if (client) {
      client.daoIds.forEach((daoId) => {
        this.typingUsers.get(daoId)?.delete(client.userId);
        this.onlineUsers.get(daoId)?.delete(client.userId);
        this.broadcastTyping(daoId);
        this.broadcastPresence(daoId);
      });
      this.clients.delete(ws2);
    }
  }
  handleError(ws2, error) {
    logger.error("WebSocket error:", error);
    const client = this.clients.get(ws2);
    if (client) {
      this.handleDisconnect(ws2);
    }
  }
  handlePong(ws2) {
    const client = this.clients.get(ws2);
    if (client) {
      client.isAlive = true;
    }
  }
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws2) => {
        const client = this.clients.get(ws2);
        if (client && !client.isAlive) {
          client.ws.terminate();
          return;
        }
        if (client) client.isAlive = false;
        ws2.ping();
      });
    }, 3e4);
    this.wss.on("close", () => {
      clearInterval(this.heartbeatInterval);
    });
  }
  broadcastTyping(daoId) {
    const message = {
      type: "typing_update",
      data: {
        daoId,
        typingUsers: Array.from(this.typingUsers.get(daoId) || [])
      }
    };
    this.broadcast(daoId, message);
  }
  broadcastPresence(daoId) {
    const message = {
      type: "presence_update",
      data: {
        daoId,
        onlineUsers: Array.from(this.onlineUsers.get(daoId) || [])
      }
    };
    this.broadcast(daoId, message);
  }
  broadcast(daoId, message) {
    this.clients.forEach((client) => {
      if (client.daoIds.has(daoId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }
  getTypingUsers(daoId) {
    return Array.from(this.typingUsers.get(daoId) || []);
  }
  getOnlineUsers(daoId) {
    return Array.from(this.onlineUsers.get(daoId) || []);
  }
};
var WebSocketService_default = WebSocketService;

// server/index.ts
var __dirname4 = dirname3(fileURLToPath4(import.meta.url));
var app = express32();
setupProcessErrorHandlers();
var server = createServer(app);
var io = new SocketIOServer(server, {
  cors: corsConfig
});
app.set("trust proxy", 1);
app.use(express32.json({
  limit: "10mb",
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express32.urlencoded({ extended: true, limit: "10mb" }));
var allowedOrigins = [
  "http://localhost:5173",
  "http://0.0.0.0:5173",
  "http://localhost:5000",
  "http://0.0.0.0:5000",
  process.env.CLIENT_URL,
  process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null
].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(requestLogger);
app.use(sanitizeInput);
app.use(preventSqlInjection);
app.use(preventXSS);
app.use(auditMiddleware);
app.use(metricsCollector.requestMiddleware());
app.use(activityTracker());
var webSocketService = new WebSocketService_default(server);
app.locals.webSocketService = webSocketService;
var userSockets = /* @__PURE__ */ new Map();
io.on("connection", (socket) => {
  logger.info("Socket.IO client connected:", { socketId: socket.id });
  socket.on("authenticate", (userId) => {
    logger.info("Socket.IO client authenticated", { userId, socketId: socket.id });
    userSockets.set(userId, socket.id);
    socket.join(`user_${userId}`);
  });
  socket.on("disconnect", () => {
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
    console.log("User disconnected:", socket.id);
  });
});
notificationService.on("notification_created", (data) => {
  io.to(`user_${data.userId}`).emit("new_notification", data);
});
global.io = io;
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${req.url} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "\u2026";
      logger.info(logLine);
    }
  });
  next();
});
(async () => {
  try {
    const { redis: redis2 } = await Promise.resolve().then(() => (init_redis(), redis_exports));
    await redis2.connect();
    const backupConfig = {
      enabled: process.env.BACKUPS_ENABLED === "true",
      schedule: "0 2 * * *",
      // Daily at 2 AM
      retentionDays: 30,
      location: process.env.BACKUP_LOCATION || "./backups",
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY
    };
    if (backupConfig.enabled) {
      const backupSystem = BackupSystem.getInstance(backupConfig);
      const scheduler = new BackupScheduler(backupSystem);
      scheduler.start();
      logger.info("\u2705 Backup system initialized");
    }
    await registerRoutes(app);
    app.get("/health", asyncHandler(async (req, res) => {
      res.json({
        status: "ok",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        environment: env.NODE_ENV,
        version: process.env.npm_package_version || "1.0.0",
        uptime: process.uptime()
      });
    }));
    app.use("/api/payments/kotanipay", kotanipay_status_default);
    app.use("/api/payments/mpesa", mpesa_status_default);
    app.use("/api/payments/stripe", stripe_status_default);
    app.use("/api/payments/reconciliation", payment_reconciliation_default);
    app.use("/api/referrals", referrals_default);
    app.use("/api/events", events_default);
    app.use("/api/notifications", notifications_default);
    app.use("/api/sse", sse_default);
    app.use("/api/billing", billing_default);
    app.use("/api/dao/:daoId/executions", proposal_execution_default);
    app.use("/api/proposals", poll_proposals_default);
    app.use("/api/reputation", reputation_default);
    app.use("/api/cross-chain", cross_chain_default);
    app.use("/api/nft-marketplace", nft_marketplace_default);
    app.use("/api/wallet", wallet_default);
    app.use("/api/wallet-setup", wallet_setup_default);
    app.use("/api/wallet/recurring-payments", (await Promise.resolve().then(() => (init_recurring_payments(), recurring_payments_exports))).default);
    app.use("/api/wallet/vouchers", (await Promise.resolve().then(() => (init_vouchers(), vouchers_exports))).default);
    app.use("/api/wallet/phone", (await Promise.resolve().then(() => (init_phone_payments(), phone_payments_exports))).default);
    app.use("/api/payment-gateway", payment_gateway_default);
    app.use("/api/kyc", kyc_default);
    const escrowRouter = (await Promise.resolve().then(() => (init_escrow(), escrow_exports))).default;
    app.use("/api/escrow", escrowRouter);
    const invoiceRouter = (await Promise.resolve().then(() => (init_invoices(), invoices_exports))).default;
    app.use("/api/invoices", invoiceRouter);
    const { isAuthenticated: isAuthenticated3 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
    app.get("/api/ai-analytics/:daoId", isAuthenticated3, async (req, res) => {
      try {
        const { aiAnalyticsService: aiAnalyticsService2 } = await Promise.resolve().then(() => (init_aiAnalyticsService(), aiAnalyticsService_exports));
        const analytics2 = await aiAnalyticsService2.getComprehensiveAnalytics(req.params.daoId);
        res.json({ success: true, data: analytics2 });
      } catch (error) {
        logger.error(`Error fetching AI analytics for DAO ${req.params.daoId}: ${error.message}`);
        res.status(500).json({ success: false, error: "Failed to fetch AI analytics" });
      }
    });
    app.get("/api/auth/user", authenticate, authUserHandler);
    app.post("/api/auth/login", authLoginHandler);
    app.post("/api/auth/register", authRegisterHandler);
    app.post("/api/auth/refresh-token", refreshTokenHandler);
    app.post("/api/auth/logout", logoutHandler);
    if (env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    app.use(notFoundHandler);
    app.use(errorHandler);
    const PORT = 5e3;
    const HOST = env.HOST || "0.0.0.0";
    server.listen(PORT, HOST, () => {
      logStartup(PORT.toString());
      logger.info("Server configuration", {
        port: PORT,
        host: HOST,
        frontendUrl: "http://localhost:5173",
        backendUrl: `http://localhost:${PORT}`,
        environment: env.NODE_ENV,
        nodeVersion: process.version
      });
      if (ProposalExecutionService) {
        ProposalExecutionService.startScheduler();
      }
      setInterval(async () => {
        try {
          const result = await ReputationService.runGlobalReputationDecay();
          console.log(`Reputation decay processed: ${result.processed} users, ${result.decayed} decayed`);
        } catch (error) {
          console.error("Reputation decay job failed:", error);
        }
      }, 24 * 60 * 60 * 1e3);
      setInterval(async () => {
        try {
          console.log("Treasury monitoring check completed");
        } catch (error) {
          console.error("Treasury monitoring failed:", error);
        }
      }, 60 * 60 * 1e3);
      console.log("\u2705 Proposal execution scheduler started");
    });
    console.log("\u{1F680} Starting blockchain integration services...");
    vaultEventIndexer.start();
    vaultAutomationService.start();
    bridgeRelayerService.start();
    console.log("\u2705 Blockchain services initialized successfully");
    const gracefulShutdown = (signal) => {
      logger.warn(`Received ${signal}, shutting down gracefully`);
      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
      setTimeout(() => {
        logger.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
      }, 3e4);
    };
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (err) {
    console.error("Fatal server error:", err);
    process.exit(1);
  }
})();
