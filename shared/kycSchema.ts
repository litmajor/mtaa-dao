
import { pgTable, text, serial, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

export const kycVerifications = pgTable('kyc_verifications', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  tier: text('tier').notNull(), // none, basic, intermediate, advanced
  status: text('status').notNull().default('pending'), // pending, approved, rejected, expired
  
  // Verification data
  email: text('email'),
  emailVerified: boolean('email_verified').default(false),
  phone: text('phone'),
  phoneVerified: boolean('phone_verified').default(false),
  
  // Document verification
  idDocumentType: text('id_document_type'), // passport, national_id, drivers_license
  idDocumentNumber: text('id_document_number'),
  idDocumentFrontUrl: text('id_document_front_url'),
  idDocumentBackUrl: text('id_document_back_url'),
  idVerificationStatus: text('id_verification_status'),
  
  // Proof of address
  proofOfAddressType: text('proof_of_address_type'), // utility_bill, bank_statement, tax_document
  proofOfAddressUrl: text('proof_of_address_url'),
  addressVerificationStatus: text('address_verification_status'),
  
  // Personal information
  firstName: text('first_name'),
  lastName: text('last_name'),
  dateOfBirth: text('date_of_birth'),
  nationality: text('nationality'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country'),
  
  // Verification metadata
  verificationProvider: text('verification_provider'), // jumio, onfido, manual
  verificationReference: text('verification_reference'),
  verificationData: jsonb('verification_data'),
  
  // AML screening
  amlScreeningStatus: text('aml_screening_status'), // clear, flagged, high_risk
  amlScreeningProvider: text('aml_screening_provider'), // chainalysis, elliptic
  amlScreeningReference: text('aml_screening_reference'),
  amlScreeningData: jsonb('aml_screening_data'),
  
  // Transaction limits
  dailyLimit: integer('daily_limit').default(100), // USD equivalent
  monthlyLimit: integer('monthly_limit').default(3000),
  annualLimit: integer('annual_limit').default(10000),
  
  // Review and approval
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  notes: text('notes'),
  
  // Timestamps
  submittedAt: timestamp('submitted_at'),
  approvedAt: timestamp('approved_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const complianceAuditLogs = pgTable('compliance_audit_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  eventType: text('event_type').notNull(), // kyc_submitted, kyc_approved, aml_flagged, transaction_blocked
  eventData: jsonb('event_data'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  severity: text('severity'), // info, warning, critical
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const suspiciousActivities = pgTable('suspicious_activities', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  activityType: text('activity_type').notNull(), // unusual_amount, rapid_transactions, high_risk_country
  description: text('description').notNull(),
  severity: text('severity').notNull(), // low, medium, high, critical
  status: text('status').notNull().default('pending'), // pending, investigating, resolved, false_positive
  
  // Detection details
  detectedBy: text('detected_by'), // automated, manual, aml_provider
  detectionRules: jsonb('detection_rules'),
  relatedTransactions: jsonb('related_transactions'),
  
  // Investigation
  investigatedBy: text('investigated_by'),
  investigationNotes: text('investigation_notes'),
  investigatedAt: timestamp('investigated_at'),
  
  // Resolution
  resolution: text('resolution'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at'),
  
  // Reporting
  reportedToAuthorities: boolean('reported_to_authorities').default(false),
  reportReference: text('report_reference'),
  reportedAt: timestamp('reported_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
