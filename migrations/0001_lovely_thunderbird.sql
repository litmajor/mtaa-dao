CREATE TABLE "activity_feed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid,
	"activity_type" varchar NOT NULL,
	"actor_id" varchar,
	"related_entity_type" varchar,
	"related_entity_id" varchar,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"visibility" varchar DEFAULT 'public',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"key_hash" varchar NOT NULL,
	"name" varchar NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"rate_limit" integer DEFAULT 1000,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"ip_whitelist" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "asset_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_symbol" varchar(10) NOT NULL,
	"price_usd" numeric(18, 2) NOT NULL,
	"market_cap" numeric(20, 2),
	"volume_24h" numeric(20, 2),
	"price_change_24h" numeric(10, 4),
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar,
	"user_email" varchar,
	"action" varchar NOT NULL,
	"resource" varchar NOT NULL,
	"resource_id" varchar,
	"method" varchar NOT NULL,
	"endpoint" varchar NOT NULL,
	"ip_address" varchar NOT NULL,
	"user_agent" varchar NOT NULL,
	"status" integer NOT NULL,
	"details" jsonb,
	"severity" varchar DEFAULT 'low' NOT NULL,
	"category" varchar DEFAULT 'security' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "beta_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"feature_name" varchar NOT NULL,
	"granted_at" timestamp DEFAULT now(),
	"revoked_at" timestamp,
	"granted_by" varchar,
	"revoked_by" varchar,
	"reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "billing_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'KES',
	"status" varchar DEFAULT 'paid',
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chain_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"chain_name" varchar NOT NULL,
	"native_currency" jsonb NOT NULL,
	"rpc_url" varchar NOT NULL,
	"block_explorer_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chains" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"chain_id" integer NOT NULL,
	"rpc_url" varchar NOT NULL,
	"block_explorer_url" varchar,
	"native_currency" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comment_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" varchar NOT NULL,
	"content_type" varchar NOT NULL,
	"content_id" uuid NOT NULL,
	"reason" varchar NOT NULL,
	"description" text,
	"severity" varchar DEFAULT 'medium',
	"status" varchar DEFAULT 'pending',
	"moderator_id" varchar,
	"moderator_action" varchar,
	"moderator_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cross_chain_bridges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_name" varchar(100) NOT NULL,
	"bridge_type" varchar(50) NOT NULL,
	"source_chain" varchar(50) NOT NULL,
	"destination_chain" varchar(50) NOT NULL,
	"bridge_contract_address" varchar(255) NOT NULL,
	"pool_contract_address" varchar(255),
	"token_address" varchar(255) NOT NULL,
	"supported_token" varchar(20) NOT NULL,
	"min_amount" numeric(20, 8),
	"max_amount" numeric(20, 8),
	"bridge_fee_percent" numeric(10, 4) DEFAULT '0.25',
	"estimated_time_minutes" integer DEFAULT 20,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cross_chain_chains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_name" varchar(50) NOT NULL,
	"chain_id" varchar(50) NOT NULL,
	"chain_type" varchar(20) NOT NULL,
	"native_token" varchar(20) NOT NULL,
	"rpc_url" text NOT NULL,
	"rpc_backup" text,
	"explorer_url" text,
	"is_active" boolean DEFAULT true,
	"is_supported" boolean DEFAULT true,
	"min_gas_price" numeric(20, 8),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cross_chain_chains_chain_name_unique" UNIQUE("chain_name")
);
--> statement-breakpoint
CREATE TABLE "cross_chain_dexes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dex_name" varchar(100) NOT NULL,
	"dex_type" varchar(50) NOT NULL,
	"chain_name" varchar(50) NOT NULL,
	"router_contract_address" varchar(255) NOT NULL,
	"factory_contract_address" varchar(255),
	"liquidity_token_symbol" varchar(20),
	"fee_percent" numeric(10, 4) DEFAULT '0.25',
	"tvl" numeric(20, 2),
	"volume24h" numeric(20, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cross_chain_proposals" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"proposal_id" text NOT NULL,
	"chains" text[] NOT NULL,
	"votes_by_chain" jsonb DEFAULT '{}'::jsonb,
	"quorum_by_chain" jsonb DEFAULT '{}'::jsonb,
	"execution_chain" text,
	"bridge_proposal_id" text,
	"sync_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cross_chain_swaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swap_id" varchar(100) NOT NULL,
	"user_id" varchar NOT NULL,
	"source_chain" varchar(50) NOT NULL,
	"destination_chain" varchar(50) NOT NULL,
	"from_token" varchar(20) NOT NULL,
	"to_token" varchar(20) NOT NULL,
	"from_amount" numeric(20, 8) NOT NULL,
	"to_amount_expected" numeric(20, 8) NOT NULL,
	"to_amount_received" numeric(20, 8),
	"user_address" varchar(255) NOT NULL,
	"dex_used" varchar(100),
	"bridge_used" varchar(100),
	"slippage_tolerance" numeric(10, 4) DEFAULT '1',
	"price_impact" numeric(10, 4),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"transaction_hash" varchar(255),
	"swap_transaction_hash" varchar(255),
	"bridge_fee" numeric(20, 8),
	"dex_fee" numeric(20, 8),
	"gas_fee" numeric(20, 8),
	"total_cost" numeric(20, 8),
	"estimated_arrival_time" timestamp,
	"completed_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cross_chain_swaps_swap_id_unique" UNIQUE("swap_id")
);
--> statement-breakpoint
CREATE TABLE "cross_chain_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"chain_name" varchar(50) NOT NULL,
	"contract_address" varchar(255) NOT NULL,
	"decimals" integer DEFAULT 18,
	"logo_url" text,
	"coingecko_id" varchar(100),
	"is_native" boolean DEFAULT false,
	"is_bridgeable" boolean DEFAULT true,
	"is_swappable" boolean DEFAULT true,
	"price" numeric(20, 8),
	"price_updated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cross_chain_trading_pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dex_id" uuid NOT NULL,
	"base_token" varchar(20) NOT NULL,
	"quote_token" varchar(20) NOT NULL,
	"pair_contract_address" varchar(255),
	"liquidity" numeric(20, 8),
	"volume24h" numeric(20, 8),
	"price_base_per_quote" numeric(20, 8),
	"price_updated_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cross_chain_transfers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" varchar(100) NOT NULL,
	"user_id" varchar NOT NULL,
	"source_chain" varchar(50) NOT NULL,
	"destination_chain" varchar(50) NOT NULL,
	"token_symbol" varchar(20) NOT NULL,
	"token_address" varchar(255) NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"source_address" varchar(255) NOT NULL,
	"destination_address" varchar(255) NOT NULL,
	"bridge_used" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"source_transaction_hash" varchar(255),
	"destination_transaction_hash" varchar(255),
	"bridge_fee" numeric(20, 8),
	"gas_fee" numeric(20, 8),
	"estimated_arrival_time" timestamp,
	"completed_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cross_chain_transfers_transfer_id_unique" UNIQUE("transfer_id")
);
--> statement-breakpoint
CREATE TABLE "daily_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"challenge_type" text NOT NULL,
	"target_amount" text,
	"points_reward" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"valid_from" timestamp DEFAULT now(),
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_achievement_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"threshold" integer NOT NULL,
	"mtaa_reward" numeric(18, 8) NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"author_id" varchar NOT NULL,
	"content_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"slug" varchar,
	"content" text NOT NULL,
	"excerpt" text,
	"cover_image" varchar,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" varchar DEFAULT 'draft',
	"view_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dao_content_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "dao_creation_tracker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"verification_method" varchar NOT NULL,
	"verification_data" jsonb DEFAULT '{}'::jsonb,
	"is_verified" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "dao_engagement_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"period" varchar NOT NULL,
	"period_date" timestamp NOT NULL,
	"active_members" integer DEFAULT 0,
	"new_members" integer DEFAULT 0,
	"proposals_created" integer DEFAULT 0,
	"proposals_passed" integer DEFAULT 0,
	"votes_participation" numeric(5, 2) DEFAULT '0',
	"transaction_count" integer DEFAULT 0,
	"transaction_volume" numeric(18, 2) DEFAULT '0',
	"treasury_balance" numeric(18, 2) DEFAULT '0',
	"engagement_score" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_identity_nfts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"nft_token_id" varchar,
	"nft_contract_address" varchar,
	"minted_at" timestamp DEFAULT now(),
	"mint_cost_mtaa" numeric DEFAULT '10',
	"is_verified" boolean DEFAULT false,
	"metadata_uri" varchar,
	CONSTRAINT "dao_identity_nfts_dao_id_unique" UNIQUE("dao_id")
);
--> statement-breakpoint
CREATE TABLE "dao_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"invited_by" varchar,
	"referrer_id" varchar,
	"invited_email" varchar,
	"invited_phone" varchar,
	"recipient_user_id" varchar,
	"role" varchar DEFAULT 'member',
	"invite_link" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"expires_at" timestamp,
	"invitation_sent_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"user_existed_at_invite" boolean DEFAULT false,
	"is_peer_invite" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dao_invitations_invite_link_unique" UNIQUE("invite_link")
);
--> statement-breakpoint
CREATE TABLE "dao_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"inviter_id" varchar NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"accepted_by" varchar,
	"accepted_at" timestamp,
	"revoked" boolean DEFAULT false,
	"revoked_at" timestamp,
	"revoked_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dao_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "dao_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"message_type" varchar DEFAULT 'text',
	"reply_to_message_id" uuid,
	"is_pinned" boolean DEFAULT false,
	"pinned_at" timestamp,
	"pinned_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_of_the_week" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"week_start_date" timestamp NOT NULL,
	"week_end_date" timestamp NOT NULL,
	"rank" integer DEFAULT 1,
	"reasons" text,
	"engagement_score" numeric(10, 2),
	"member_growth" integer,
	"proposal_count" integer,
	"transaction_volume" numeric(18, 2),
	"is_current" boolean DEFAULT false,
	"featured_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dao_of_the_week_dao_id_unique" UNIQUE("dao_id")
);
--> statement-breakpoint
CREATE TABLE "dao_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"review_title" varchar,
	"review_content" text,
	"aspects" jsonb DEFAULT '{}'::jsonb,
	"is_verified_member" boolean DEFAULT false,
	"helpful_count" integer DEFAULT 0,
	"status" varchar DEFAULT 'published',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_rotation_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"cycle_number" integer NOT NULL,
	"recipient_user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"amount_distributed" numeric(18, 8) DEFAULT '0',
	"transaction_hash" varchar,
	"distributed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"template_id" uuid,
	"name" varchar NOT NULL,
	"description" text,
	"event_type" varchar NOT NULL,
	"rule_config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 100,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "dao_social_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"verifier_user_id" varchar NOT NULL,
	"verified_at" timestamp DEFAULT now(),
	"verification_type" varchar DEFAULT 'member_invite',
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "dao_treasury_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"source" varchar(50) NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"user_id" varchar,
	"reason" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"storage_path" varchar NOT NULL,
	"file_hash" varchar,
	"is_public" boolean DEFAULT false,
	"related_entity_type" varchar,
	"related_entity_id" varchar,
	"uploaded_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "investment_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid,
	"name" varchar(255) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"description" text,
	"contract_address" varchar(255),
	"total_value_locked" numeric(18, 8) DEFAULT '0',
	"share_token_supply" numeric(18, 8) DEFAULT '0',
	"share_price" numeric(18, 8) DEFAULT '1.0',
	"performance_fee" integer DEFAULT 200,
	"minimum_investment" numeric(18, 2) DEFAULT '10.00',
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leaderboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"leaderboard_type" varchar NOT NULL,
	"rank" integer,
	"score" numeric(18, 2) NOT NULL,
	"period" varchar DEFAULT 'all_time',
	"period_start_date" timestamp,
	"period_end_date" timestamp,
	"previous_rank" integer,
	"movement_indicator" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "limit_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"exchange" varchar(50) NOT NULL,
	"order_id" varchar(255) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"side" varchar(10) NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"filled_amount" numeric(20, 8) DEFAULT '0',
	"filled_price" numeric(20, 8),
	"fee" numeric(20, 8) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"filled_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"canceled_at" timestamp,
	"last_checked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "locked_savings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"vault_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'cUSD',
	"lock_period" integer NOT NULL,
	"interest_rate" numeric(5, 4) DEFAULT '0.05',
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"unlocks_at" timestamp NOT NULL,
	"status" varchar DEFAULT 'locked',
	"penalty" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"action" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mtaa_distribution_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid,
	"action_type" varchar(50) NOT NULL,
	"user_percentage" integer DEFAULT 90 NOT NULL,
	"dao_percentage" integer DEFAULT 10 NOT NULL,
	"platform_percentage" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "multisig_signer_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"multisig_signer_id" uuid NOT NULL,
	"key_storage_location" varchar NOT NULL,
	"key_management_provider" varchar,
	"public_key_hash" varchar NOT NULL,
	"can_sign" boolean DEFAULT true,
	"last_signed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "multisig_signer_keys_multisig_signer_id_unique" UNIQUE("multisig_signer_id")
);
--> statement-breakpoint
CREATE TABLE "multisig_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"multisig_wallet_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"signer_address" varchar NOT NULL,
	"signer_index" integer NOT NULL,
	"role" varchar DEFAULT 'signer',
	"is_active" boolean DEFAULT true,
	"joined_at" timestamp DEFAULT now(),
	"removed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "multisig_transaction_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"multisig_transaction_id" uuid NOT NULL,
	"multisig_signer_id" uuid NOT NULL,
	"signature" text NOT NULL,
	"signed_at" timestamp DEFAULT now(),
	"signature_valid" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "multisig_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"multisig_wallet_id" uuid NOT NULL,
	"transaction_hash" varchar,
	"recipient" varchar NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar NOT NULL,
	"data" text,
	"status" varchar DEFAULT 'pending',
	"current_signatures" integer DEFAULT 0,
	"required_signatures" integer NOT NULL,
	"proposed_by" varchar NOT NULL,
	"proposed_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"executed_at" timestamp,
	"executed_by" varchar,
	"rejected_at" timestamp,
	"rejected_by" varchar,
	"rejection_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "multisig_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"dao_id" uuid NOT NULL,
	"contract_address" varchar NOT NULL,
	"chain_id" integer NOT NULL,
	"required_signatures" integer NOT NULL,
	"total_signers" integer NOT NULL,
	"wallet_standard" varchar DEFAULT 'gnosis',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "multisig_wallets_wallet_id_unique" UNIQUE("wallet_id"),
	CONSTRAINT "multisig_wallets_contract_address_unique" UNIQUE("contract_address")
);
--> statement-breakpoint
CREATE TABLE "notification_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email_notifications" boolean DEFAULT true,
	"push_notifications" boolean DEFAULT true,
	"dao_updates" boolean DEFAULT true,
	"proposal_updates" boolean DEFAULT true,
	"task_updates" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false,
	"priority" varchar DEFAULT 'medium',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid,
	"payment_request_id" uuid,
	"receipt_number" varchar NOT NULL,
	"pdf_url" text,
	"email_sent" boolean DEFAULT false,
	"email_sent_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" varchar NOT NULL,
	"to_user_id" varchar,
	"to_address" varchar,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar NOT NULL,
	"description" text,
	"qr_code" text,
	"celo_uri" text,
	"status" varchar DEFAULT 'pending',
	"expires_at" timestamp,
	"paid_at" timestamp,
	"transaction_hash" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"reference" text NOT NULL,
	"type" text NOT NULL,
	"amount" text NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_transactions_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "pending_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid,
	"user_id" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"amount" numeric(18, 8),
	"token_symbol" varchar,
	"status" varchar DEFAULT 'pending',
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 5,
	"tx_hash" varchar,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(50) DEFAULT 'info',
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"target_audience" varchar(50) DEFAULT 'all',
	"target_dao_id" uuid,
	"link_url" varchar(500),
	"link_text" varchar(100),
	"starts_at" timestamp,
	"expires_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_revenue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid,
	"user_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'KES',
	"description" text,
	"transaction_type" varchar NOT NULL,
	"status" varchar DEFAULT 'paid',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pool_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"asset_symbol" varchar(10) NOT NULL,
	"asset_name" varchar(100),
	"token_address" varchar(255),
	"network" varchar(50),
	"target_allocation" integer NOT NULL,
	"current_balance" numeric(18, 8) DEFAULT '0',
	"current_value_usd" numeric(18, 2) DEFAULT '0',
	"last_price_usd" numeric(18, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pool_governance_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"default_quorum" numeric(5, 2) DEFAULT '30.00',
	"default_approval_threshold" numeric(5, 2) DEFAULT '51.00',
	"voting_period_days" integer DEFAULT 3,
	"min_shares_to_propose" numeric(18, 8) DEFAULT '1.0',
	"proposal_cooldown_hours" integer DEFAULT 24,
	"timelock_hours" integer DEFAULT 24,
	"governance_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pool_investments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"investment_amount_usd" numeric(18, 2) NOT NULL,
	"shares_minted" numeric(18, 8) NOT NULL,
	"share_price_at_investment" numeric(18, 8) NOT NULL,
	"payment_token" varchar(50),
	"transaction_hash" varchar(255),
	"status" varchar(50) DEFAULT 'pending',
	"investedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pool_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"tvl" numeric(18, 2),
	"share_price" numeric(18, 8),
	"total_return_percentage" numeric(10, 4),
	"btc_price" numeric(18, 2),
	"eth_price" numeric(18, 2),
	"sol_price" numeric(18, 2),
	"bnb_price" numeric(18, 2),
	"xrp_price" numeric(18, 2),
	"ltc_price" numeric(18, 2),
	"volatility" numeric(10, 4),
	"sharpe_ratio" numeric(10, 4),
	"snapshot_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pool_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"proposal_type" varchar(50) NOT NULL,
	"details" jsonb,
	"total_voting_power" numeric(18, 8) DEFAULT '0',
	"votes_for" numeric(18, 8) DEFAULT '0',
	"votes_against" numeric(18, 8) DEFAULT '0',
	"votes_abstain" numeric(18, 8) DEFAULT '0',
	"quorum_required" numeric(5, 2) DEFAULT '30.00',
	"approval_threshold" numeric(5, 2) DEFAULT '51.00',
	"status" varchar(50) DEFAULT 'active',
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"voting_ends_at" timestamp NOT NULL,
	"executed_at" timestamp,
	"execution_tx_hash" varchar(255),
	"execution_result" jsonb
);
--> statement-breakpoint
CREATE TABLE "pool_rebalances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"initiated_by" varchar,
	"tvl_before" numeric(18, 2),
	"tvl_after" numeric(18, 2),
	"assets_changed" jsonb,
	"transaction_hash" varchar(255),
	"reason" text,
	"status" varchar(50) DEFAULT 'completed',
	"rebalancedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pool_swap_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"rebalance_id" uuid,
	"from_asset" varchar(10) NOT NULL,
	"to_asset" varchar(10) NOT NULL,
	"amount_from" numeric(18, 8) NOT NULL,
	"amount_to" numeric(18, 8) NOT NULL,
	"exchange_rate" numeric(18, 8),
	"dex_used" varchar(50),
	"transaction_hash" varchar(255),
	"gas_fee" numeric(18, 8),
	"status" varchar(50) DEFAULT 'pending',
	"swappedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pool_vote_delegations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"delegator_id" varchar NOT NULL,
	"delegate_id" varchar NOT NULL,
	"delegated_shares" numeric(18, 8) NOT NULL,
	"is_active" boolean DEFAULT true,
	"delegatedAt" timestamp DEFAULT now(),
	"revokedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "pool_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"vote" varchar(20) NOT NULL,
	"voting_power" numeric(18, 8) NOT NULL,
	"share_percentage" numeric(10, 6),
	"reason" text,
	"votedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pool_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"shares_burned" numeric(18, 8) NOT NULL,
	"withdrawal_value_usd" numeric(18, 2) NOT NULL,
	"share_price_at_withdrawal" numeric(18, 8) NOT NULL,
	"fee_charged" numeric(18, 2) DEFAULT '0',
	"net_amount" numeric(18, 2),
	"transaction_hash" varchar(255),
	"status" varchar(50) DEFAULT 'pending',
	"withdrawnAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"risk_level" varchar(50) NOT NULL,
	"target_return_annual" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid NOT NULL,
	"content" text NOT NULL,
	"parent_comment_id" uuid,
	"is_edited" boolean DEFAULT false,
	"likes_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_execution_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"dao_id" uuid NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"execution_type" varchar NOT NULL,
	"execution_data" jsonb NOT NULL,
	"status" varchar DEFAULT 'pending',
	"attempts" integer DEFAULT 0,
	"last_attempt" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"description" text NOT NULL,
	"title_template" text NOT NULL,
	"description_template" text NOT NULL,
	"required_fields" jsonb DEFAULT '[]'::jsonb,
	"voting_period" integer DEFAULT 72,
	"quorum_override" integer,
	"is_global" boolean DEFAULT false,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quorum_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"proposal_id" uuid,
	"active_member_count" integer NOT NULL,
	"required_quorum" integer NOT NULL,
	"achieved_quorum" integer DEFAULT 0,
	"quorum_met" boolean DEFAULT false,
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rebalancing_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"auto_rebalance_enabled" boolean DEFAULT false,
	"rebalance_frequency" varchar(50) DEFAULT 'weekly',
	"rebalance_threshold" integer DEFAULT 500,
	"last_rebalance_check" timestamp,
	"next_rebalance_scheduled" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid NOT NULL,
	"tier" varchar NOT NULL,
	"total_referrals" integer DEFAULT 0,
	"active_referrals" integer DEFAULT 0,
	"total_contribution_value" numeric(18, 2) DEFAULT '0',
	"lifetime_earnings" numeric(18, 2) DEFAULT '0',
	"badges" jsonb DEFAULT '[]'::jsonb,
	"last_ping_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rule_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"dao_id" uuid NOT NULL,
	"event_type" varchar NOT NULL,
	"context" jsonb NOT NULL,
	"conditions_met" boolean NOT NULL,
	"actions_executed" jsonb DEFAULT '[]'::jsonb,
	"execution_result" varchar NOT NULL,
	"error_message" text,
	"execution_time_ms" integer,
	"executed_at" timestamp DEFAULT now(),
	"executed_by" varchar
);
--> statement-breakpoint
CREATE TABLE "rule_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"description" text,
	"rule_config" jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rule_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "savings_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"target_amount" numeric(10, 2) NOT NULL,
	"current_amount" numeric(10, 2) DEFAULT '0',
	"currency" varchar DEFAULT 'KES',
	"target_date" timestamp,
	"category" varchar DEFAULT 'general',
	"is_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid NOT NULL,
	"plan" varchar DEFAULT 'free',
	"status" varchar DEFAULT 'active',
	"start_date" timestamp DEFAULT now(),
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "success_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"title" text NOT NULL,
	"story" text NOT NULL,
	"impact" text,
	"metrics" jsonb,
	"status" varchar DEFAULT 'pending_review',
	"created_at" timestamp DEFAULT now(),
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" serial NOT NULL,
	"user_id" varchar,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"category" varchar NOT NULL,
	"priority" varchar DEFAULT 'medium',
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" varchar DEFAULT 'open',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" varchar DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"service" varchar DEFAULT 'api' NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" varchar,
	"action" varchar NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"category" varchar NOT NULL,
	"difficulty" varchar NOT NULL,
	"estimated_hours" integer DEFAULT 1,
	"required_skills" jsonb DEFAULT '[]'::jsonb,
	"bounty_amount" numeric(10, 2) DEFAULT '0',
	"deliverables" jsonb DEFAULT '[]'::jsonb,
	"acceptance_criteria" jsonb DEFAULT '[]'::jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"creator_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reward" numeric(10, 2) NOT NULL,
	"status" varchar DEFAULT 'open',
	"claimer_id" varchar,
	"claimed_by" varchar,
	"category" varchar NOT NULL,
	"difficulty" varchar NOT NULL,
	"estimated_time" varchar,
	"deadline" timestamp,
	"requires_verification" boolean DEFAULT false,
	"proof_url" text,
	"verification_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_asset_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"asset_symbol" varchar(10) NOT NULL,
	"target_allocation" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"actor_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"amount" numeric(18, 2),
	"previous_balance" numeric(18, 2),
	"new_balance" numeric(18, 2),
	"category" varchar,
	"reason" text NOT NULL,
	"multisig_tx_id" uuid,
	"transaction_hash" varchar,
	"ip_address" varchar,
	"metadata" jsonb,
	"severity" varchar DEFAULT 'medium',
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_budget_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"category" varchar NOT NULL,
	"allocated_amount" numeric(18, 2) NOT NULL,
	"spent_amount" numeric(18, 2) DEFAULT '0',
	"remaining_amount" numeric(18, 2) NOT NULL,
	"period" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_multisig_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"proposed_by" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" varchar DEFAULT 'cUSD',
	"recipient" varchar,
	"purpose" text NOT NULL,
	"required_signatures" integer NOT NULL,
	"current_signatures" integer DEFAULT 0,
	"signers" jsonb DEFAULT '[]'::jsonb,
	"status" varchar DEFAULT 'pending',
	"approved_at" timestamp,
	"executed_at" timestamp,
	"execution_tx_hash" varchar,
	"expires_at" timestamp NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"achievement_type" varchar NOT NULL,
	"achievement_name" varchar NOT NULL,
	"description" text,
	"progress" integer DEFAULT 0,
	"target_progress" integer NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"reward_amount" numeric(10, 2) DEFAULT '0',
	"reward_currency" varchar DEFAULT 'MTAA',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid,
	"type" varchar NOT NULL,
	"description" text,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"roles" varchar DEFAULT 'member',
	"total_contributions" numeric(10, 2) DEFAULT '0',
	"current_streak" integer DEFAULT 0,
	"referral_code" varchar,
	"referred_by" varchar,
	"total_referrals" integer DEFAULT 0,
	"dark_mode" boolean DEFAULT false,
	"joined_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"otp" varchar(10),
	"otp_expires_at" timestamp,
	"is_email_verified" boolean DEFAULT false,
	"is_phone_verified" boolean DEFAULT false,
	"is_banned" boolean DEFAULT false,
	"ban_reason" text,
	"is_super_user" boolean DEFAULT false,
	"voting_power" numeric(10, 2) DEFAULT '1.0',
	"telegram_id" varchar,
	"telegram_chat_id" varchar,
	"telegram_username" varchar,
	"activity_type" varchar,
	"metadata" jsonb,
	CONSTRAINT "user_activities_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "user_announcement_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"announcement_id" uuid NOT NULL,
	"viewed_at" timestamp DEFAULT now(),
	"dismissed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"badge_type" varchar NOT NULL,
	"badge_name" varchar NOT NULL,
	"description" text,
	"icon_url" varchar,
	"unlocked_at" timestamp DEFAULT now(),
	"rarity" varchar DEFAULT 'common',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"wallet_id" uuid NOT NULL,
	"balance" numeric(18, 8) DEFAULT '0',
	"currency" varchar NOT NULL,
	"locked_balance" numeric(18, 8) DEFAULT '0',
	"available_balance" numeric(18, 8) DEFAULT '0',
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"challenge_id" uuid,
	"challenge_type" text NOT NULL,
	"target_amount" text,
	"current_progress" text DEFAULT '0',
	"status" text DEFAULT 'in_progress',
	"points_reward" integer DEFAULT 50,
	"reward_claimed" boolean DEFAULT false,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_contexts" (
	"user_id" varchar NOT NULL,
	"dao_id" uuid NOT NULL,
	"role" varchar NOT NULL,
	"wallet_address" varchar,
	"contribution_score" numeric(10, 2) DEFAULT '0',
	"last_interaction" timestamp DEFAULT now(),
	"context" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" varchar NOT NULL,
	"following_id" varchar,
	"following_dao_id" uuid,
	"follow_type" varchar DEFAULT 'user',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_kyc" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"full_name" varchar,
	"date_of_birth" varchar,
	"national_id" varchar,
	"national_id_type" varchar,
	"country" varchar,
	"address" text,
	"city" varchar,
	"postal_code" varchar,
	"verification_status" varchar DEFAULT 'pending',
	"document_hash" varchar,
	"risk_level" varchar DEFAULT 'low',
	"aml_screening_status" varchar,
	"verified_at" timestamp,
	"verified_by" varchar,
	"rejection_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_kyc_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_moderation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"reason" text NOT NULL,
	"severity" varchar DEFAULT 'medium',
	"duration" integer,
	"expires_at" timestamp,
	"moderator_id" varchar NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"revoked_at" timestamp,
	"revoked_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email_notifications" boolean DEFAULT true,
	"push_notifications" boolean DEFAULT true,
	"in_app_notifications" boolean DEFAULT true,
	"sms_notifications" boolean DEFAULT false,
	"proposal_updates" boolean DEFAULT true,
	"treasury_updates" boolean DEFAULT true,
	"membership_updates" boolean DEFAULT true,
	"voting_reminders" boolean DEFAULT true,
	"dao_announcements" boolean DEFAULT true,
	"weekly_digest" boolean DEFAULT false,
	"daily_digest" boolean DEFAULT false,
	"unsubscribe_all" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_reputation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid,
	"total_score" integer DEFAULT 0,
	"proposal_score" integer DEFAULT 0,
	"vote_score" integer DEFAULT 0,
	"contribution_score" integer DEFAULT 0,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vault_governance_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"dao_id" uuid NOT NULL,
	"proposal_id" uuid,
	"governance_type" varchar NOT NULL,
	"proposed_changes" jsonb NOT NULL,
	"current_parameters" jsonb,
	"required_quorum" integer DEFAULT 50,
	"voting_deadline" timestamp NOT NULL,
	"status" varchar DEFAULT 'active',
	"executed_at" timestamp,
	"execution_tx_hash" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vault_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"period" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"starting_value" numeric(18, 8) NOT NULL,
	"ending_value" numeric(18, 8) NOT NULL,
	"yield" numeric(18, 8) DEFAULT '0',
	"yield_percentage" numeric(8, 4) DEFAULT '0',
	"fees_collected" numeric(18, 8) DEFAULT '0',
	"deposits" numeric(18, 8) DEFAULT '0',
	"withdrawals" numeric(18, 8) DEFAULT '0',
	"sharpe_ratio" numeric(8, 4),
	"max_drawdown" numeric(8, 4),
	"volatility" numeric(8, 4),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vault_risk_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"assessment_date" timestamp DEFAULT now(),
	"overall_risk_score" integer NOT NULL,
	"liquidity_risk" integer DEFAULT 0,
	"smart_contract_risk" integer DEFAULT 0,
	"market_risk" integer DEFAULT 0,
	"concentration_risk" integer DEFAULT 0,
	"protocol_risk" integer DEFAULT 0,
	"risk_factors" jsonb,
	"recommendations" jsonb,
	"nextAssessmentDue" timestamp,
	"assessed_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vault_strategy_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"strategy_id" varchar NOT NULL,
	"token_symbol" varchar NOT NULL,
	"allocated_amount" numeric(18, 8) NOT NULL,
	"allocation_percentage" numeric(5, 2) NOT NULL,
	"current_value" numeric(18, 8) DEFAULT '0',
	"yield_earned" numeric(18, 8) DEFAULT '0',
	"last_rebalance" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vault_token_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"token_symbol" varchar NOT NULL,
	"balance" numeric(18, 8) NOT NULL,
	"value_usd" numeric(18, 8) DEFAULT '0',
	"last_price_update" timestamp DEFAULT now(),
	"average_entry_price" numeric(18, 8),
	"total_deposited" numeric(18, 8) DEFAULT '0',
	"total_withdrawn" numeric(18, 8) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vault_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"token_symbol" varchar NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"value_usd" numeric(18, 8) DEFAULT '0',
	"transaction_hash" varchar,
	"block_number" integer,
	"gas_used" numeric(18, 8),
	"gas_fee" numeric(18, 8),
	"status" varchar DEFAULT 'completed',
	"strategy_id" varchar,
	"shares_minted" numeric(18, 8),
	"shares_burned" numeric(18, 8),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"provider" varchar DEFAULT 'unknown',
	"from_address" varchar,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vote_delegations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delegator_id" varchar NOT NULL,
	"delegate_id" varchar NOT NULL,
	"dao_id" uuid NOT NULL,
	"scope" varchar DEFAULT 'all',
	"category" varchar,
	"proposal_id" uuid,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"token" varchar NOT NULL,
	"message" text,
	"expiry_date" timestamp NOT NULL,
	"redeemed_by" varchar,
	"redeemed_at" timestamp,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "vouchers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "wallet_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"ip_address" varchar,
	"user_agent" varchar,
	"device_id" varchar,
	"status" varchar DEFAULT 'success',
	"failure_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallet_private_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"encrypted_private_key" text NOT NULL,
	"encryption_iv" text NOT NULL,
	"encryption_salt" text NOT NULL,
	"auth_tag" text NOT NULL,
	"key_derivation_function" varchar DEFAULT 'pbkdf2',
	"encryption_algorithm" varchar DEFAULT 'aes-256-gcm',
	"is_backed_up" boolean DEFAULT false,
	"backup_verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wallet_private_keys_wallet_id_unique" UNIQUE("wallet_id")
);
--> statement-breakpoint
CREATE TABLE "wallet_public_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"public_key_format" varchar DEFAULT 'uncompressed',
	"derivation_path" varchar DEFAULT 'm/44''/60''/0''/0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wallet_public_keys_wallet_id_unique" UNIQUE("wallet_id")
);
--> statement-breakpoint
CREATE TABLE "wallet_security_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"requires_pin" boolean DEFAULT true,
	"requires_biometric" boolean DEFAULT false,
	"encrypted_pin" text,
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_method" varchar,
	"withdrawal_limit" numeric(18, 8),
	"whitelisted_addresses" jsonb DEFAULT '[]'::jsonb,
	"requires_approval_above_threshold" boolean DEFAULT true,
	"approval_threshold" numeric(18, 8),
	"last_access_at" timestamp,
	"last_modified_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wallet_security_settings_wallet_id_unique" UNIQUE("wallet_id")
);
--> statement-breakpoint
CREATE TABLE "wallet_seed_phrases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"encrypted_seed_phrase" text NOT NULL,
	"word_count" integer DEFAULT 12,
	"encryption_iv" text NOT NULL,
	"encryption_salt" text NOT NULL,
	"auth_tag" text NOT NULL,
	"derivation_path" varchar DEFAULT 'm/44''/60''/0''/0',
	"is_backed_up" boolean DEFAULT false,
	"backup_method" varchar,
	"backup_verified_at" timestamp,
	"backup_location" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wallet_seed_phrases_wallet_id_unique" UNIQUE("wallet_id")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid,
	"currency" varchar NOT NULL,
	"address" varchar NOT NULL,
	"wallet_type" varchar DEFAULT 'personal',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "vesting_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"claimed_amount" numeric(18, 8) NOT NULL,
	"transaction_hash" varchar,
	"claimed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vesting_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"milestone_type" varchar NOT NULL,
	"description" varchar,
	"target_value" numeric(18, 8) NOT NULL,
	"current_value" numeric(18, 8) DEFAULT '0',
	"tokens_to_release" numeric(18, 8) NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "vesting_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"schedule_type" varchar NOT NULL,
	"total_tokens" numeric(18, 8) NOT NULL,
	"vested_tokens" numeric(18, 8) DEFAULT '0',
	"claimed_tokens" numeric(18, 8) DEFAULT '0',
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"cliff_duration" integer DEFAULT 0,
	"vesting_duration" integer NOT NULL,
	"vesting_interval" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"reason" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"ip_address" text,
	"user_agent" text,
	"severity" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false,
	"phone" text,
	"phone_verified" boolean DEFAULT false,
	"id_document_type" text,
	"id_document_number" text,
	"id_document_front_url" text,
	"id_document_back_url" text,
	"id_verification_status" text,
	"proof_of_address_type" text,
	"proof_of_address_url" text,
	"address_verification_status" text,
	"first_name" text,
	"last_name" text,
	"date_of_birth" text,
	"nationality" text,
	"address" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"verification_provider" text,
	"verification_reference" text,
	"verification_data" jsonb,
	"aml_screening_status" text,
	"aml_screening_provider" text,
	"aml_screening_reference" text,
	"aml_screening_data" jsonb,
	"daily_limit" integer DEFAULT 100,
	"monthly_limit" integer DEFAULT 3000,
	"annual_limit" integer DEFAULT 10000,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"notes" text,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suspicious_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"activity_type" text NOT NULL,
	"description" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"detected_by" text,
	"detection_rules" jsonb,
	"related_transactions" jsonb,
	"investigated_by" text,
	"investigation_notes" text,
	"investigated_at" timestamp,
	"resolution" text,
	"resolved_by" text,
	"resolved_at" timestamp,
	"reported_to_authorities" boolean DEFAULT false,
	"report_reference" text,
	"reported_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "escrow_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid,
	"payer_id" varchar NOT NULL,
	"payee_id" varchar NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar DEFAULT 'cUSD' NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"milestones" jsonb DEFAULT '[]'::jsonb,
	"current_milestone" varchar DEFAULT '0',
	"funded_at" timestamp,
	"released_at" timestamp,
	"refunded_at" timestamp,
	"dispute_reason" text,
	"disputed_at" timestamp,
	"resolved_at" timestamp,
	"transaction_hash" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "escrow_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_id" uuid NOT NULL,
	"raised_by" varchar NOT NULL,
	"reason" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb,
	"status" varchar DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "escrow_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_id" uuid NOT NULL,
	"milestone_number" varchar NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"released_at" timestamp,
	"proof_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"payer_id" varchar NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar NOT NULL,
	"payment_method" varchar NOT NULL,
	"transaction_hash" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar NOT NULL,
	"from_user_id" varchar NOT NULL,
	"to_user_id" varchar,
	"dao_id" uuid,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar DEFAULT 'cUSD' NOT NULL,
	"description" text NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"due_date" timestamp,
	"paid_at" timestamp,
	"payment_method" varchar,
	"transaction_hash" varchar,
	"notes" text,
	"terms_and_conditions" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "account_recovery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"recovery_type" varchar NOT NULL,
	"token" varchar NOT NULL,
	"method" varchar NOT NULL,
	"ip_address" varchar NOT NULL,
	"user_agent" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "account_recovery_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "email_delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"to_email" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"template" varchar,
	"status" varchar NOT NULL,
	"provider" varchar,
	"provider_message_id" varchar,
	"error_message" text,
	"metadata" jsonb,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar NOT NULL,
	"user_id" varchar,
	"ip_address" varchar NOT NULL,
	"user_agent" text,
	"attempt_result" varchar NOT NULL,
	"failure_reason" text,
	"location" jsonb,
	"device_fingerprint" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oauth_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"provider_user_id" varchar NOT NULL,
	"provider_email" varchar,
	"provider_username" varchar,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"scope" text,
	"profile_data" jsonb,
	"last_synced_at" timestamp,
	"connected_at" timestamp DEFAULT now(),
	"disconnected_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token_hash" varchar NOT NULL,
	"device_id" uuid,
	"ip_address" varchar NOT NULL,
	"user_agent" text,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" varchar,
	"replaced_by" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"event_type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"ip_address" varchar NOT NULL,
	"user_agent" text,
	"location" jsonb,
	"details" jsonb,
	"resolved" boolean DEFAULT false,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"ip_address" varchar NOT NULL,
	"user_agent" text,
	"location" jsonb,
	"device_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"to_phone" varchar NOT NULL,
	"message" text NOT NULL,
	"template" varchar,
	"status" varchar NOT NULL,
	"provider" varchar,
	"provider_message_id" varchar,
	"cost" varchar,
	"error_message" text,
	"metadata" jsonb,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "two_factor_auth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"method" varchar NOT NULL,
	"enabled" boolean DEFAULT false,
	"secret" text,
	"backup_codes" jsonb,
	"phone_number" varchar,
	"email" varchar,
	"last_used_at" timestamp,
	"enabled_at" timestamp,
	"disabled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "two_factor_auth_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"device_name" varchar,
	"device_fingerprint" text NOT NULL,
	"device_type" varchar,
	"browser" varchar,
	"os" varchar,
	"trusted" boolean DEFAULT false,
	"last_ip_address" varchar,
	"last_location" jsonb,
	"last_used_at" timestamp,
	"trusted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_devices_device_fingerprint_unique" UNIQUE("device_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "currency_swaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid,
	"from_currency" varchar NOT NULL,
	"to_currency" varchar NOT NULL,
	"from_amount" numeric(18, 8) NOT NULL,
	"to_amount" numeric(18, 8) NOT NULL,
	"exchange_rate" numeric(18, 8) NOT NULL,
	"market_rate" numeric(18, 8),
	"spread" numeric(5, 4),
	"slippage" numeric(5, 4),
	"price_impact" numeric(5, 4),
	"platform_fee" numeric(18, 8) DEFAULT '0',
	"network_fee" numeric(18, 8) DEFAULT '0',
	"liquidity_provider_fee" numeric(18, 8) DEFAULT '0',
	"total_fee" numeric(18, 8) DEFAULT '0',
	"provider" varchar NOT NULL,
	"protocol" varchar,
	"route" jsonb,
	"transaction_hash" varchar,
	"block_number" integer,
	"gas_used" numeric(18, 8),
	"status" varchar DEFAULT 'pending',
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dao_treasuries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"vault_id" uuid,
	"total_balance" numeric(18, 8) DEFAULT '0',
	"available_balance" numeric(18, 8) DEFAULT '0',
	"allocated_balance" numeric(18, 8) DEFAULT '0',
	"reserve_balance" numeric(18, 8) DEFAULT '0',
	"minimum_reserve" numeric(18, 8) DEFAULT '0',
	"daily_spending_limit" numeric(18, 8),
	"proposal_threshold" numeric(18, 8),
	"required_signatures" integer DEFAULT 1,
	"signers" jsonb DEFAULT '[]'::jsonb,
	"last_audit_date" timestamp,
	"audited_by" varchar,
	"audit_report" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dao_treasuries_dao_id_unique" UNIQUE("dao_id")
);
--> statement-breakpoint
CREATE TABLE "financial_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid,
	"user_id" varchar,
	"report_type" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"fiscal_year" integer,
	"fiscal_quarter" integer,
	"report_data" jsonb NOT NULL,
	"report_url" text,
	"report_format" varchar DEFAULT 'pdf',
	"total_revenue" numeric(18, 8),
	"total_expenses" numeric(18, 8),
	"net_profit" numeric(18, 8),
	"total_assets" numeric(18, 8),
	"total_liabilities" numeric(18, 8),
	"equity" numeric(18, 8),
	"ai_summary" text,
	"ai_recommendations" jsonb,
	"anomalies_detected" jsonb,
	"generated_by" varchar,
	"generated_by_user_id" varchar,
	"generated_at" timestamp DEFAULT now(),
	"status" varchar DEFAULT 'draft',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"published_at" timestamp,
	"notes" text,
	"tags" jsonb,
	"version" integer DEFAULT 1,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gas_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network" varchar DEFAULT 'celo',
	"gas_price" numeric(18, 8) NOT NULL,
	"base_fee" numeric(18, 8),
	"priority_fee" numeric(18, 8),
	"max_fee" numeric(18, 8),
	"avg_gas_price_1h" numeric(18, 8),
	"avg_gas_price_24h" numeric(18, 8),
	"min_gas_price_24h" numeric(18, 8),
	"max_gas_price_24h" numeric(18, 8),
	"network_congestion" varchar,
	"block_number" integer,
	"block_time" integer,
	"transaction_count" integer,
	"recommended_gas_price" numeric(18, 8),
	"estimated_confirmation_time" integer,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mpesa_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"payment_transaction_id" text,
	"transaction_type" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"account_reference" varchar,
	"transaction_desc" varchar,
	"merchant_request_id" varchar,
	"checkout_request_id" varchar,
	"conversation_id" varchar,
	"originator_conversation_id" varchar,
	"mpesa_receipt_number" varchar,
	"transaction_date" timestamp,
	"result_code" varchar,
	"result_desc" varchar,
	"balance" numeric(10, 2),
	"callback_data" jsonb,
	"callback_received" boolean DEFAULT false,
	"callback_at" timestamp,
	"status" varchar DEFAULT 'pending',
	"failure_reason" text,
	"retry_count" integer DEFAULT 0,
	"last_retry_at" timestamp,
	"ip_address" varchar,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "mpesa_transactions_mpesa_receipt_number_unique" UNIQUE("mpesa_receipt_number")
);
--> statement-breakpoint
CREATE TABLE "recurring_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"dao_id" uuid,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar NOT NULL,
	"description" text,
	"frequency" varchar NOT NULL,
	"interval" integer DEFAULT 1,
	"start_date" timestamp NOT NULL,
	"next_payment_date" timestamp NOT NULL,
	"end_date" timestamp,
	"max_payments" integer,
	"is_active" boolean DEFAULT true,
	"is_paused" boolean DEFAULT false,
	"paused_at" timestamp,
	"paused_reason" text,
	"total_payments" integer DEFAULT 0,
	"successful_payments" integer DEFAULT 0,
	"failed_attempts" integer DEFAULT 0,
	"last_payment_id" uuid,
	"last_payment_date" timestamp,
	"last_failure_date" timestamp,
	"last_failure_reason" text,
	"payment_method" varchar NOT NULL,
	"payment_method_details" jsonb,
	"notify_on_success" boolean DEFAULT true,
	"notify_on_failure" boolean DEFAULT true,
	"notify_before_payment" boolean DEFAULT true,
	"notify_days_before" integer DEFAULT 3,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"cancelled_at" timestamp,
	"cancelled_reason" text
);
--> statement-breakpoint
CREATE TABLE "referral_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_reward_id" uuid NOT NULL,
	"referrer_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'MTAA',
	"payout_method" varchar NOT NULL,
	"destination_address" varchar,
	"destination_phone" varchar,
	"destination_account" varchar,
	"status" varchar DEFAULT 'pending',
	"transaction_id" uuid,
	"transaction_hash" varchar,
	"requested_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	"completed_at" timestamp,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid,
	"transaction_type" varchar NOT NULL,
	"fee_type" varchar NOT NULL,
	"fee_category" varchar NOT NULL,
	"base_amount" numeric(18, 8) NOT NULL,
	"fee_amount" numeric(18, 8) NOT NULL,
	"fee_percentage" numeric(5, 4),
	"currency" varchar NOT NULL,
	"paid_by" varchar,
	"dao_id" uuid,
	"collected_by" varchar DEFAULT 'platform',
	"platform_revenue" numeric(18, 8) DEFAULT '0',
	"dao_revenue" numeric(18, 8) DEFAULT '0',
	"protocol_revenue" numeric(18, 8) DEFAULT '0',
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"current_step" varchar NOT NULL,
	"completed_steps" jsonb DEFAULT '[]'::jsonb,
	"skipped_steps" jsonb DEFAULT '[]'::jsonb,
	"progress" integer DEFAULT 0,
	"is_completed" boolean DEFAULT false,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"last_activity_at" timestamp DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "onboarding_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" varchar,
	"order" integer NOT NULL,
	"is_required" boolean DEFAULT true,
	"category" varchar DEFAULT 'general',
	"estimated_minutes" integer DEFAULT 5,
	"icon" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "onboarding_steps_step_id_unique" UNIQUE("step_id")
);
--> statement-breakpoint
DROP INDEX "IDX_session_expire";--> statement-breakpoint
ALTER TABLE "referral_rewards" ALTER COLUMN "reward_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "referral_rewards" ALTER COLUMN "reward_amount" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vaults" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vaults" ALTER COLUMN "balance" SET DATA TYPE numeric(18, 8);--> statement-breakpoint
ALTER TABLE "vaults" ALTER COLUMN "monthly_goal" SET DATA TYPE numeric(18, 8);--> statement-breakpoint
ALTER TABLE "contributions" ADD COLUMN "proposal_id" uuid;--> statement-breakpoint
ALTER TABLE "contributions" ADD COLUMN "dao_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "contributions" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "contributions" ADD COLUMN "vault" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "status" varchar DEFAULT 'approved';--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "is_banned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "is_elder" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "is_admin" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "last_active" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "can_initiate_withdrawal" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "can_approve_withdrawal" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "is_rotation_recipient" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dao_memberships" ADD COLUMN "rotation_recipient_date" timestamp;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "access" varchar DEFAULT 'public';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "invite_only" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "invite_code" varchar;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "plan" varchar DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "dao_type" varchar DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "plan_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "billing_status" varchar DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "next_billing_date" timestamp;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "extension_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "original_duration" integer;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "current_extension_duration" integer;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "image_url" varchar;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "banner_url" varchar;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "is_archived" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "archived_by" varchar;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "is_featured" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "feature_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "quorum_percentage" integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "voting_period" integer DEFAULT 72;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "execution_delay" integer DEFAULT 24;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "token_holdings" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "status" varchar DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "subscription_plan" varchar DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "founder_id" varchar;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "max_delegation_percentage" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "treasury_multisig_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "treasury_required_signatures" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "treasury_signers" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "treasury_withdrawal_threshold" numeric(18, 2) DEFAULT '1000.00';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "treasury_daily_limit" numeric(18, 2) DEFAULT '10000.00';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "treasury_monthly_budget" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "withdrawal_mode" varchar DEFAULT 'multisig';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "duration_model" varchar DEFAULT 'time';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "rotation_frequency" varchar;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "rotation_selection_method" varchar DEFAULT 'sequential';--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "next_rotation_date" timestamp;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "current_rotation_cycle" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "total_rotation_cycles" integer;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "estimated_cycle_duration" integer;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "min_elders" integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "max_elders" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "primary_cause" varchar;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "cause_tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "proposal_type" varchar DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "image_url" varchar;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "poll_options" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "allow_multiple_choices" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "proposer" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "user_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "for_votes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "against_votes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "total_voting_power" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "execution_data" jsonb;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "executed_at" timestamp;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "executed_by" varchar;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "execution_tx_hash" varchar;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "is_featured" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "likes_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "comments_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD COLUMN "dao_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD COLUMN "status" varchar DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD COLUMN "awarded_at" timestamp;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "session_token" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "expires_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_accessed_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ip_address" varchar;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_agent" varchar;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "session_data" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_token" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verification_token" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verification_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_token" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_picture" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_rewards" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wallet_address" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "website" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reputation_score" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "roles" varchar DEFAULT 'member';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "otp" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "otp_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_email_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_phone_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_banned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_super_user" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voting_token_balance" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mtaa_token_balance" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voting_power" numeric(10, 2) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_chat_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_username" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_currency" varchar DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "encrypted_wallet" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wallet_salt" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wallet_iv" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wallet_auth_tag" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_backed_up_mnemonic" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "enabled_beta_features" text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "dao_id" uuid;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "name" varchar DEFAULT 'Personal Vault';--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "chain_id" integer DEFAULT 42220 NOT NULL;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "address" varchar;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "vault_type" varchar DEFAULT 'regular';--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "lock_duration" integer;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "interest_rate" numeric(5, 4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "risk_level" varchar DEFAULT 'low';--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "min_deposit" numeric(18, 8) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "max_deposit" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "total_value_locked" numeric(18, 8) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "yield_generated" numeric(18, 8) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "yield_strategy" varchar;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "performance_fee" numeric(5, 4) DEFAULT '0.1';--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "management_fee" numeric(5, 4) DEFAULT '0.02';--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "dao_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "voting_power" numeric(10, 2) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "is_delegated" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "delegated_by" varchar;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "vault_id" uuid;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "wallet_address" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "dao_id" uuid;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "disbursement_id" varchar;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_access" ADD CONSTRAINT "beta_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_access" ADD CONSTRAINT "beta_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_access" ADD CONSTRAINT "beta_access_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_proposal_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."proposal_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_bridges" ADD CONSTRAINT "cross_chain_bridges_source_chain_cross_chain_chains_chain_name_fk" FOREIGN KEY ("source_chain") REFERENCES "public"."cross_chain_chains"("chain_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_bridges" ADD CONSTRAINT "cross_chain_bridges_destination_chain_cross_chain_chains_chain_name_fk" FOREIGN KEY ("destination_chain") REFERENCES "public"."cross_chain_chains"("chain_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_bridges" ADD CONSTRAINT "cross_chain_bridges_token_address_cross_chain_tokens_contract_address_fk" FOREIGN KEY ("token_address") REFERENCES "public"."cross_chain_tokens"("contract_address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_dexes" ADD CONSTRAINT "cross_chain_dexes_chain_name_cross_chain_chains_chain_name_fk" FOREIGN KEY ("chain_name") REFERENCES "public"."cross_chain_chains"("chain_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_swaps" ADD CONSTRAINT "cross_chain_swaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_swaps" ADD CONSTRAINT "cross_chain_swaps_source_chain_cross_chain_chains_chain_name_fk" FOREIGN KEY ("source_chain") REFERENCES "public"."cross_chain_chains"("chain_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_swaps" ADD CONSTRAINT "cross_chain_swaps_destination_chain_cross_chain_chains_chain_name_fk" FOREIGN KEY ("destination_chain") REFERENCES "public"."cross_chain_chains"("chain_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_tokens" ADD CONSTRAINT "cross_chain_tokens_chain_name_cross_chain_chains_chain_name_fk" FOREIGN KEY ("chain_name") REFERENCES "public"."cross_chain_chains"("chain_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_trading_pairs" ADD CONSTRAINT "cross_chain_trading_pairs_dex_id_cross_chain_dexes_id_fk" FOREIGN KEY ("dex_id") REFERENCES "public"."cross_chain_dexes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD CONSTRAINT "cross_chain_transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD CONSTRAINT "cross_chain_transfers_source_chain_cross_chain_chains_chain_name_fk" FOREIGN KEY ("source_chain") REFERENCES "public"."cross_chain_chains"("chain_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD CONSTRAINT "cross_chain_transfers_destination_chain_cross_chain_chains_chain_name_fk" FOREIGN KEY ("destination_chain") REFERENCES "public"."cross_chain_chains"("chain_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_achievement_milestones" ADD CONSTRAINT "dao_achievement_milestones_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_content" ADD CONSTRAINT "dao_content_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_content" ADD CONSTRAINT "dao_content_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_creation_tracker" ADD CONSTRAINT "dao_creation_tracker_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_creation_tracker" ADD CONSTRAINT "dao_creation_tracker_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_engagement_metrics" ADD CONSTRAINT "dao_engagement_metrics_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_identity_nfts" ADD CONSTRAINT "dao_identity_nfts_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_invitations" ADD CONSTRAINT "dao_invitations_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_invitations" ADD CONSTRAINT "dao_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_invitations" ADD CONSTRAINT "dao_invitations_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_invitations" ADD CONSTRAINT "dao_invitations_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_invites" ADD CONSTRAINT "dao_invites_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_invites" ADD CONSTRAINT "dao_invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_invites" ADD CONSTRAINT "dao_invites_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_invites" ADD CONSTRAINT "dao_invites_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_messages" ADD CONSTRAINT "dao_messages_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_messages" ADD CONSTRAINT "dao_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_messages" ADD CONSTRAINT "dao_messages_reply_to_message_id_dao_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."dao_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_messages" ADD CONSTRAINT "dao_messages_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_of_the_week" ADD CONSTRAINT "dao_of_the_week_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_ratings" ADD CONSTRAINT "dao_ratings_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_ratings" ADD CONSTRAINT "dao_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_rotation_cycles" ADD CONSTRAINT "dao_rotation_cycles_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_rotation_cycles" ADD CONSTRAINT "dao_rotation_cycles_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_rules" ADD CONSTRAINT "dao_rules_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_rules" ADD CONSTRAINT "dao_rules_template_id_rule_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."rule_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_rules" ADD CONSTRAINT "dao_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_rules" ADD CONSTRAINT "dao_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_social_verifications" ADD CONSTRAINT "dao_social_verifications_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_social_verifications" ADD CONSTRAINT "dao_social_verifications_verifier_user_id_users_id_fk" FOREIGN KEY ("verifier_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_treasury_credits" ADD CONSTRAINT "dao_treasury_credits_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_treasury_credits" ADD CONSTRAINT "dao_treasury_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_pools" ADD CONSTRAINT "investment_pools_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_pools" ADD CONSTRAINT "investment_pools_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboards" ADD CONSTRAINT "leaderboards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD CONSTRAINT "limit_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locked_savings" ADD CONSTRAINT "locked_savings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locked_savings" ADD CONSTRAINT "locked_savings_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_dao_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."dao_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_dao_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."dao_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mtaa_distribution_rules" ADD CONSTRAINT "mtaa_distribution_rules_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_signer_keys" ADD CONSTRAINT "multisig_signer_keys_multisig_signer_id_multisig_signers_id_fk" FOREIGN KEY ("multisig_signer_id") REFERENCES "public"."multisig_signers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_signers" ADD CONSTRAINT "multisig_signers_multisig_wallet_id_multisig_wallets_id_fk" FOREIGN KEY ("multisig_wallet_id") REFERENCES "public"."multisig_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_signers" ADD CONSTRAINT "multisig_signers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_transaction_signatures" ADD CONSTRAINT "multisig_transaction_signatures_multisig_transaction_id_multisig_transactions_id_fk" FOREIGN KEY ("multisig_transaction_id") REFERENCES "public"."multisig_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_transaction_signatures" ADD CONSTRAINT "multisig_transaction_signatures_multisig_signer_id_multisig_signers_id_fk" FOREIGN KEY ("multisig_signer_id") REFERENCES "public"."multisig_signers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_transactions" ADD CONSTRAINT "multisig_transactions_multisig_wallet_id_multisig_wallets_id_fk" FOREIGN KEY ("multisig_wallet_id") REFERENCES "public"."multisig_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_transactions" ADD CONSTRAINT "multisig_transactions_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_transactions" ADD CONSTRAINT "multisig_transactions_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_transactions" ADD CONSTRAINT "multisig_transactions_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_wallets" ADD CONSTRAINT "multisig_wallets_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_wallets" ADD CONSTRAINT "multisig_wallets_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_transaction_id_wallet_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_request_id_payment_requests_id_fk" FOREIGN KEY ("payment_request_id") REFERENCES "public"."payment_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_transactions" ADD CONSTRAINT "pending_transactions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_transactions" ADD CONSTRAINT "pending_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_announcements" ADD CONSTRAINT "platform_announcements_target_dao_id_daos_id_fk" FOREIGN KEY ("target_dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_announcements" ADD CONSTRAINT "platform_announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_assets" ADD CONSTRAINT "pool_assets_pool_id_investment_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."investment_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_governance_settings" ADD CONSTRAINT "pool_governance_settings_pool_id_investment_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."investment_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_investments" ADD CONSTRAINT "pool_investments_pool_id_investment_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."investment_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_investments" ADD CONSTRAINT "pool_investments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_performance" ADD CONSTRAINT "pool_performance_pool_id_investment_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."investment_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_proposals" ADD CONSTRAINT "pool_proposals_pool_id_investment_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."investment_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_proposals" ADD CONSTRAINT "pool_proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_rebalances" ADD CONSTRAINT "pool_rebalances_pool_id_investment_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."investment_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_rebalances" ADD CONSTRAINT "pool_rebalances_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_swap_transactions" ADD CONSTRAINT "pool_swap_transactions_pool_id_investment_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."investment_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_swap_transactions" ADD CONSTRAINT "pool_swap_transactions_rebalance_id_pool_rebalances_id_fk" FOREIGN KEY ("rebalance_id") REFERENCES "public"."pool_rebalances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_vote_delegations" ADD CONSTRAINT "pool_vote_delegations_pool_id_investment_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."investment_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_vote_delegations" ADD CONSTRAINT "pool_vote_delegations_delegator_id_users_id_fk" FOREIGN KEY ("delegator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_vote_delegations" ADD CONSTRAINT "pool_vote_delegations_delegate_id_users_id_fk" FOREIGN KEY ("delegate_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_votes" ADD CONSTRAINT "pool_votes_proposal_id_pool_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."pool_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_votes" ADD CONSTRAINT "pool_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_withdrawals" ADD CONSTRAINT "pool_withdrawals_pool_id_investment_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."investment_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_withdrawals" ADD CONSTRAINT "pool_withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_parent_comment_id_proposal_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."proposal_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_execution_queue" ADD CONSTRAINT "proposal_execution_queue_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_execution_queue" ADD CONSTRAINT "proposal_execution_queue_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_likes" ADD CONSTRAINT "proposal_likes_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_likes" ADD CONSTRAINT "proposal_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_likes" ADD CONSTRAINT "proposal_likes_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_templates" ADD CONSTRAINT "proposal_templates_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_templates" ADD CONSTRAINT "proposal_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quorum_history" ADD CONSTRAINT "quorum_history_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quorum_history" ADD CONSTRAINT "quorum_history_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_settings" ADD CONSTRAINT "rebalancing_settings_pool_id_investment_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."investment_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_tiers" ADD CONSTRAINT "referral_tiers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_tiers" ADD CONSTRAINT "referral_tiers_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_rule_id_dao_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."dao_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "success_stories" ADD CONSTRAINT "success_stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_claimer_id_users_id_fk" FOREIGN KEY ("claimer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_asset_allocations" ADD CONSTRAINT "template_asset_allocations_template_id_portfolio_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."portfolio_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_audit_log" ADD CONSTRAINT "treasury_audit_log_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_audit_log" ADD CONSTRAINT "treasury_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_audit_log" ADD CONSTRAINT "treasury_audit_log_multisig_tx_id_treasury_multisig_transactions_id_fk" FOREIGN KEY ("multisig_tx_id") REFERENCES "public"."treasury_multisig_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_budget_allocations" ADD CONSTRAINT "treasury_budget_allocations_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_budget_allocations" ADD CONSTRAINT "treasury_budget_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_multisig_transactions" ADD CONSTRAINT "treasury_multisig_transactions_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_multisig_transactions" ADD CONSTRAINT "treasury_multisig_transactions_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_announcement_views" ADD CONSTRAINT "user_announcement_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_announcement_views" ADD CONSTRAINT "user_announcement_views_announcement_id_platform_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."platform_announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_balances" ADD CONSTRAINT "user_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_balances" ADD CONSTRAINT "user_balances_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_challenge_id_daily_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."daily_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contexts" ADD CONSTRAINT "user_contexts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contexts" ADD CONSTRAINT "user_contexts_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_dao_id_daos_id_fk" FOREIGN KEY ("following_dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_kyc" ADD CONSTRAINT "user_kyc_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_kyc" ADD CONSTRAINT "user_kyc_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_moderation_log" ADD CONSTRAINT "user_moderation_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_moderation_log" ADD CONSTRAINT "user_moderation_log_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_moderation_log" ADD CONSTRAINT "user_moderation_log_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reputation" ADD CONSTRAINT "user_reputation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reputation" ADD CONSTRAINT "user_reputation_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_governance_proposals" ADD CONSTRAINT "vault_governance_proposals_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_governance_proposals" ADD CONSTRAINT "vault_governance_proposals_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_governance_proposals" ADD CONSTRAINT "vault_governance_proposals_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_governance_proposals" ADD CONSTRAINT "vault_governance_proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_performance" ADD CONSTRAINT "vault_performance_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_risk_assessments" ADD CONSTRAINT "vault_risk_assessments_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_risk_assessments" ADD CONSTRAINT "vault_risk_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_strategy_allocations" ADD CONSTRAINT "vault_strategy_allocations_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_token_holdings" ADD CONSTRAINT "vault_token_holdings_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_transactions" ADD CONSTRAINT "vault_transactions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_transactions" ADD CONSTRAINT "vault_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_delegations" ADD CONSTRAINT "vote_delegations_delegator_id_users_id_fk" FOREIGN KEY ("delegator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_delegations" ADD CONSTRAINT "vote_delegations_delegate_id_users_id_fk" FOREIGN KEY ("delegate_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_delegations" ADD CONSTRAINT "vote_delegations_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_delegations" ADD CONSTRAINT "vote_delegations_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_access_log" ADD CONSTRAINT "wallet_access_log_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_access_log" ADD CONSTRAINT "wallet_access_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_private_keys" ADD CONSTRAINT "wallet_private_keys_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_public_keys" ADD CONSTRAINT "wallet_public_keys_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_security_settings" ADD CONSTRAINT "wallet_security_settings_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_seed_phrases" ADD CONSTRAINT "wallet_seed_phrases_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vesting_claims" ADD CONSTRAINT "vesting_claims_schedule_id_vesting_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."vesting_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vesting_claims" ADD CONSTRAINT "vesting_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vesting_milestones" ADD CONSTRAINT "vesting_milestones_schedule_id_vesting_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."vesting_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vesting_schedules" ADD CONSTRAINT "vesting_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_payee_id_users_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_disputes" ADD CONSTRAINT "escrow_disputes_escrow_id_escrow_accounts_id_fk" FOREIGN KEY ("escrow_id") REFERENCES "public"."escrow_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_disputes" ADD CONSTRAINT "escrow_disputes_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_disputes" ADD CONSTRAINT "escrow_disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_milestones" ADD CONSTRAINT "escrow_milestones_escrow_id_escrow_accounts_id_fk" FOREIGN KEY ("escrow_id") REFERENCES "public"."escrow_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_milestones" ADD CONSTRAINT "escrow_milestones_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_recovery" ADD CONSTRAINT "account_recovery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_log" ADD CONSTRAINT "email_delivery_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_user_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."user_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audits" ADD CONSTRAINT "session_audits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audits" ADD CONSTRAINT "session_audits_device_id_user_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."user_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_delivery_log" ADD CONSTRAINT "sms_delivery_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor_auth" ADD CONSTRAINT "two_factor_auth_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_swaps" ADD CONSTRAINT "currency_swaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_swaps" ADD CONSTRAINT "currency_swaps_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_treasuries" ADD CONSTRAINT "dao_treasuries_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_treasuries" ADD CONSTRAINT "dao_treasuries_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_treasuries" ADD CONSTRAINT "dao_treasuries_audited_by_users_id_fk" FOREIGN KEY ("audited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_transactions" ADD CONSTRAINT "mpesa_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payouts" ADD CONSTRAINT "referral_payouts_referral_reward_id_referral_rewards_id_fk" FOREIGN KEY ("referral_reward_id") REFERENCES "public"."referral_rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payouts" ADD CONSTRAINT "referral_payouts_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_fees" ADD CONSTRAINT "transaction_fees_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_fees" ADD CONSTRAINT "transaction_fees_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_contexts_dao_id_idx" ON "user_contexts" USING btree ("dao_id");--> statement-breakpoint
CREATE INDEX "user_contexts_last_interaction_idx" ON "user_contexts" USING btree ("last_interaction");--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daos" ADD CONSTRAINT "daos_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_template_id_proposal_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."proposal_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_proposer_users_id_fk" FOREIGN KEY ("proposer") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_delegated_by_users_id_fk" FOREIGN KEY ("delegated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "sid";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "sess";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "expire";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vault_owner_check" CHECK ((("user_id" IS NOT NULL AND "dao_id" IS NULL) OR ("user_id" IS NULL AND "dao_id" IS NOT NULL)));