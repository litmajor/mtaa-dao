CREATE TABLE "agent_performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"date" text NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"success_rate" numeric(5, 2) DEFAULT '0',
	"average_response_time" numeric(10, 2) DEFAULT '0',
	"user_satisfaction" numeric(5, 2) DEFAULT '0',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_usage_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"successful_requests" integer DEFAULT 0 NOT NULL,
	"failed_requests" integer DEFAULT 0 NOT NULL,
	"average_response_time" numeric(10, 2) DEFAULT '0',
	"total_data_transferred" numeric(20, 8) DEFAULT '0',
	"top_endpoints" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "asset_edges" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"source_asset_id" varchar(255) NOT NULL,
	"target_asset_id" varchar(255) NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"edge_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "asset_graph_versions" (
	"version" integer PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"node_hash" varchar(64) NOT NULL,
	"edge_hash" varchar(64) NOT NULL,
	"node_count" integer NOT NULL,
	"edge_count" integer NOT NULL,
	"change_reason" varchar(50),
	"change_details" text,
	"edge_count_by_type" jsonb DEFAULT '{}'::jsonb,
	"edge_count_by_chain" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "asset_nodes" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"node_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "asset_state_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_node_id" varchar(255) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"price_usd" numeric(18, 8),
	"price_confidence" integer,
	"price_sources" jsonb DEFAULT '[]'::jsonb,
	"chain_specific_prices" jsonb DEFAULT '{}'::jsonb,
	"technical_rsi14" numeric(5, 2),
	"technical_macd_value" numeric(18, 8),
	"technical_macd_signal" numeric(18, 8),
	"technical_macd_histogram" numeric(18, 8),
	"technical_trend" varchar(30),
	"technical_momentum" integer,
	"technical_signals" jsonb DEFAULT '{}'::jsonb,
	"yield_data" jsonb DEFAULT '{}'::jsonb,
	"yield_estimate_30d" numeric(18, 8),
	"yield_estimate_1y" numeric(18, 8),
	"risk_smart_contract_score" integer,
	"risk_oracle_score" integer,
	"risk_governance_score" integer,
	"risk_liquidation_risk" integer,
	"risk_overall_score" integer,
	"risk_weighted_by_dao_type" jsonb DEFAULT '{}'::jsonb,
	"liquidity_depth_1pct" numeric(18, 2),
	"liquidity_depth_5pct" numeric(18, 2),
	"liquidity_by_chain" jsonb DEFAULT '{}'::jsonb,
	"graph_version" integer DEFAULT 0 NOT NULL,
	"correlation_version" integer DEFAULT 0 NOT NULL,
	"shard_update_status" jsonb DEFAULT '{}'::jsonb,
	"is_stale" boolean DEFAULT false,
	"completeness" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bill_split_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_split_id" uuid NOT NULL,
	"user_id" varchar,
	"dao_id" uuid,
	"wallet_address" varchar,
	"share_percentage" numeric(5, 2),
	"custom_amount" numeric(18, 8),
	"amount_owed" numeric(18, 8) NOT NULL,
	"amount_paid" numeric(18, 8),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"transaction_hash" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bill_split_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_split_id" uuid NOT NULL,
	"payment_id" uuid,
	"amount" numeric(18, 8) NOT NULL,
	"transaction_hash" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'confirmed' NOT NULL,
	"confirmed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bill_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" varchar NOT NULL,
	"dao_id" uuid,
	"title" varchar NOT NULL,
	"description" text,
	"total_amount" numeric(18, 8) NOT NULL,
	"currency" varchar(10) DEFAULT 'cUSD' NOT NULL,
	"split_method" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "biometric_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"device_id" varchar NOT NULL,
	"device_name" varchar NOT NULL,
	"biometric_type" varchar NOT NULL,
	"biometric_public_key" text,
	"is_enabled" boolean DEFAULT true,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blockchain_health_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_name" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"block_height" integer DEFAULT 0,
	"transaction_count" integer DEFAULT 0,
	"average_block_time" numeric(10, 2) DEFAULT '0',
	"network_health_score" numeric(5, 2) DEFAULT '100',
	"status" varchar DEFAULT 'healthy',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bridge_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_chain" varchar(50) NOT NULL,
	"destination_chain" varchar(50) NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"token_address" varchar(255) NOT NULL,
	"from_address" varchar(255) NOT NULL,
	"to_address" varchar(255) NOT NULL,
	"transaction_hash" varchar(255),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cefi_exchange_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange_name" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"volume_24h" numeric(20, 8) DEFAULT '0',
	"users" integer DEFAULT 0,
	"status" varchar DEFAULT 'active',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "correlation_matrices" (
	"matrix_version" integer PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"computed_against_graph_version" integer NOT NULL,
	"correlation_matrix" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"strong_positive_correlations" jsonb DEFAULT '[]'::jsonb,
	"strong_negative_correlations" jsonb DEFAULT '[]'::jsonb,
	"lookback_period" varchar(10) DEFAULT '30d',
	"completeness" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"date" text NOT NULL,
	"total_members" integer DEFAULT 0 NOT NULL,
	"new_members_today" integer DEFAULT 0 NOT NULL,
	"active_members" integer DEFAULT 0 NOT NULL,
	"members_by_tier" jsonb DEFAULT '{}'::jsonb,
	"total_proposals" integer DEFAULT 0 NOT NULL,
	"active_proposals" integer DEFAULT 0 NOT NULL,
	"total_votes" integer DEFAULT 0 NOT NULL,
	"average_participation" numeric(5, 2) DEFAULT '0',
	"treasury_balance" numeric(20, 8) DEFAULT '0' NOT NULL,
	"inflows" numeric(20, 8) DEFAULT '0' NOT NULL,
	"outflows" numeric(20, 8) DEFAULT '0' NOT NULL,
	"net_flow" numeric(20, 8) DEFAULT '0' NOT NULL,
	"dao_type" varchar,
	"region" varchar,
	"cause_category" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_contribution_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"contribution_id" uuid NOT NULL,
	"approver_id" varchar NOT NULL,
	"approved" boolean NOT NULL,
	"comment" text,
	"approved_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_contribution_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"minimum_amount" numeric(18, 2) DEFAULT '0',
	"maximum_amount" numeric(18, 2),
	"requires_approval" boolean DEFAULT false,
	"approvals_needed" integer DEFAULT 1,
	"allow_recurring" boolean DEFAULT false,
	"track_equity" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"contributor_id" varchar NOT NULL,
	"contribution_type_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" varchar DEFAULT 'cUSD',
	"status" varchar DEFAULT 'pending',
	"approval_status" varchar DEFAULT 'awaiting',
	"approvals_count" integer DEFAULT 0,
	"required_approvals" integer NOT NULL,
	"rejection_reason" text,
	"completed_at" timestamp,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_multisig_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"required_approvals" integer DEFAULT 2 NOT NULL,
	"total_signers" integer NOT NULL,
	"signer_addresses" jsonb DEFAULT '[]'::jsonb,
	"withdrawal_threshold" numeric(18, 2) DEFAULT '1000.00',
	"roles_allowed_to_approve" jsonb DEFAULT '["admin","elder"]'::jsonb,
	"auto_complete_on_threshold" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dao_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"setting_key" varchar(100) NOT NULL,
	"setting_value" jsonb,
	"setting_type" varchar(50),
	"category" varchar(50),
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "defi_protocol_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_name" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"tvl" numeric(20, 8) DEFAULT '0',
	"total_users" integer DEFAULT 0,
	"status" varchar DEFAULT 'active',
	"last_update" timestamp NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "execution_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"order_id" varchar(255) NOT NULL,
	"exchange" varchar(50) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"side" varchar(10) NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"expected_price" numeric(20, 8) NOT NULL,
	"actual_price" numeric(20, 8),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"filled_amount" numeric(20, 8) DEFAULT '0',
	"slippage_percent" numeric(10, 6) DEFAULT '0',
	"accuracy" numeric(5, 2) DEFAULT '100',
	"strategy_used" varchar(50),
	"venue_recommendation" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"executed_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "execution_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(255) NOT NULL,
	"exchange" varchar(50) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"expected_price" numeric(20, 8) NOT NULL,
	"actual_price" numeric(20, 8) NOT NULL,
	"slippage_percent" numeric(10, 6) DEFAULT '0' NOT NULL,
	"filled" numeric(20, 8),
	"fill_time_ms" integer,
	"success" boolean DEFAULT true NOT NULL,
	"accuracy" numeric(5, 2) DEFAULT '100' NOT NULL,
	"strategy" varchar(50) DEFAULT 'unknown',
	"side" varchar(10),
	"amount" numeric(20, 8),
	"recorded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "execution_statistics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange" varchar(50) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"total_executions" integer DEFAULT 0 NOT NULL,
	"successful_executions" integer DEFAULT 0 NOT NULL,
	"success_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"average_slippage" numeric(10, 6) DEFAULT '0' NOT NULL,
	"min_slippage" numeric(10, 6),
	"max_slippage" numeric(10, 6),
	"average_fill_time_ms" integer DEFAULT 0,
	"average_accuracy" numeric(5, 2) DEFAULT '0' NOT NULL,
	"accuracy_trend" numeric(5, 2) DEFAULT '0',
	"improvement_rate" numeric(5, 2) DEFAULT '0',
	"last_updated" timestamp DEFAULT now(),
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	CONSTRAINT "execution_statistics_unique" UNIQUE("exchange","symbol","window_start","window_end")
);
--> statement-breakpoint
CREATE TABLE "leaderboard_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"ranking_type" varchar NOT NULL,
	"date" text NOT NULL,
	"rank" integer NOT NULL,
	"score" numeric(20, 8) DEFAULT '0' NOT NULL,
	"previous_rank" integer DEFAULT 0,
	"rank_change" integer DEFAULT 0,
	"metric_value" numeric(20, 8) DEFAULT '0',
	"tier" varchar DEFAULT 'bronze',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "liquidity_pool_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_address" varchar NOT NULL,
	"chain_id" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"total_liquidity" numeric(20, 8) DEFAULT '0',
	"volume_24h" numeric(20, 8) DEFAULT '0',
	"fee_24h" numeric(20, 8) DEFAULT '0',
	"token_a_balance" numeric(20, 8) DEFAULT '0',
	"token_b_balance" numeric(20, 8) DEFAULT '0',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"address" varchar,
	"stablecoin" varchar,
	"elder_council" varchar,
	"funded_amount" numeric(18, 8) DEFAULT '0',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ml_training_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"order_size" numeric(20, 8) NOT NULL,
	"time_of_day" varchar(20),
	"market_volatility" numeric(5, 2),
	"order_queue_depth" integer,
	"venue_type" varchar(10),
	"exchange" varchar(50),
	"liquidity_score" numeric(5, 2),
	"actual_slippage" numeric(10, 6) NOT NULL,
	"actual_fill_time_ms" integer NOT NULL,
	"execution_success" boolean NOT NULL,
	"model_version" varchar(20),
	"prediction_accuracy" numeric(5, 2),
	"feature_importance" jsonb,
	"recorded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "multisig_creation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"dao_id" uuid NOT NULL,
	"signers" jsonb DEFAULT '[]'::jsonb,
	"required_signatures" integer NOT NULL,
	"chain_id" integer,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"status" varchar DEFAULT 'queued',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "multisig_creation_jobs_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "multisig_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" uuid NOT NULL,
	"signer_id" varchar NOT NULL,
	"signer_role" varchar NOT NULL,
	"signature" text NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar,
	"is_valid" boolean DEFAULT true NOT NULL,
	"verification_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid,
	"user_id" varchar NOT NULL,
	"dao_id" uuid,
	"notification_type" varchar NOT NULL,
	"source_entity_type" varchar,
	"source_entity_id" varchar,
	"action_url" varchar(500),
	"priority" varchar DEFAULT 'normal',
	"is_read" boolean DEFAULT false,
	"delivery_channels" jsonb DEFAULT '[]'::jsonb,
	"delivery_status" jsonb DEFAULT '{}'::jsonb,
	"custom_data" jsonb DEFAULT '{}'::jsonb,
	"expires_at" timestamp,
	"is_actioned" boolean DEFAULT false,
	"actioned_at" timestamp,
	"action_taken" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_provider_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_name" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"success_rate" numeric(5, 2) DEFAULT '0',
	"total_transactions" integer DEFAULT 0,
	"total_volume" numeric(20, 8) DEFAULT '0',
	"status" varchar DEFAULT 'active',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pin_reset_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"wallet_id" uuid NOT NULL,
	"reset_token" varchar NOT NULL,
	"reset_method" varchar NOT NULL,
	"verification_sent" timestamp DEFAULT now(),
	"verification_code" varchar,
	"verification_code_expires_at" timestamp,
	"is_verified" boolean DEFAULT false,
	"verified_at" timestamp,
	"new_pin_hash" varchar,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "pin_reset_requests_reset_token_unique" UNIQUE("reset_token")
);
--> statement-breakpoint
CREATE TABLE "platform_growth_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"total_users" integer DEFAULT 0 NOT NULL,
	"user_retention" numeric(5, 2) DEFAULT '0',
	"new_daos" integer DEFAULT 0 NOT NULL,
	"total_daos" integer DEFAULT 0 NOT NULL,
	"monthly_active_users" integer DEFAULT 0 NOT NULL,
	"weekly_active_users" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"total_daos" integer DEFAULT 0 NOT NULL,
	"active_daos" integer DEFAULT 0 NOT NULL,
	"total_members" integer DEFAULT 0 NOT NULL,
	"total_vaults" integer DEFAULT 0 NOT NULL,
	"active_vaults" integer DEFAULT 0 NOT NULL,
	"total_tvl" numeric(20, 8) DEFAULT '0' NOT NULL,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"total_fees" numeric(20, 8) DEFAULT '0' NOT NULL,
	"total_revenue" numeric(20, 8) DEFAULT '0' NOT NULL,
	"cpu_usage" numeric(5, 2) DEFAULT '0',
	"memory_usage" numeric(5, 2) DEFAULT '0',
	"disk_usage" numeric(5, 2) DEFAULT '0',
	"network_latency" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"total_referrals" integer DEFAULT 0 NOT NULL,
	"new_referrals_today" integer DEFAULT 0 NOT NULL,
	"referred_users_count" integer DEFAULT 0 NOT NULL,
	"referred_users_active" integer DEFAULT 0 NOT NULL,
	"total_referral_rewards" numeric(20, 8) DEFAULT '0' NOT NULL,
	"rewards_distributed_today" numeric(20, 8) DEFAULT '0' NOT NULL,
	"average_reward_per_referral" numeric(20, 8) DEFAULT '0' NOT NULL,
	"top_referrer_count" integer DEFAULT 0,
	"average_referrals_per_user" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "revenue_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"total_revenue" numeric(20, 8) DEFAULT '0' NOT NULL,
	"transaction_fees" numeric(20, 8) DEFAULT '0' NOT NULL,
	"platform_fees" numeric(20, 8) DEFAULT '0' NOT NULL,
	"other_revenue" numeric(20, 8) DEFAULT '0' NOT NULL,
	"revenue_by_source" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reward_distribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" varchar NOT NULL,
	"reward_type" varchar NOT NULL,
	"date" text NOT NULL,
	"amount" numeric(20, 8) DEFAULT '0' NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"distribution_date" timestamp,
	"source" varchar DEFAULT 'activities',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" uuid NOT NULL,
	"notification_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text,
	"device_name" varchar,
	"location" varchar,
	"ip_address" varchar,
	"is_read" boolean DEFAULT false,
	"action_required" boolean DEFAULT false,
	"action_token" varchar,
	"action_expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stable_asset_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain" varchar(50) NOT NULL,
	"chain_id" integer NOT NULL,
	"token_address" varchar(255) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"decimals" integer DEFAULT 6 NOT NULL,
	"risk_score" integer DEFAULT 20 NOT NULL,
	"liquidity_score" integer DEFAULT 70 NOT NULL,
	"depeg_threshold_bps" integer DEFAULT 100 NOT NULL,
	"min_confirmations" integer DEFAULT 3 NOT NULL,
	"max_confirmation_delay_sec" integer DEFAULT 900 NOT NULL,
	"peg_target_usd" numeric(18, 8) DEFAULT '1.00000000' NOT NULL,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stable_inflow_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) DEFAULT 'webhook' NOT NULL,
	"chain" varchar(50) NOT NULL,
	"chain_id" integer NOT NULL,
	"tx_hash" varchar(255) NOT NULL,
	"log_index" integer DEFAULT 0 NOT NULL,
	"token_address" varchar(255) NOT NULL,
	"token_symbol" varchar(20) NOT NULL,
	"token_decimals" integer NOT NULL,
	"to_address" varchar(255) NOT NULL,
	"from_address" varchar(255),
	"raw_amount" numeric(78, 0) NOT NULL,
	"normalized_token_amount" numeric(38, 18) NOT NULL,
	"normalized_amount_usd" numeric(24, 8) NOT NULL,
	"stable_units_microusd" numeric(38, 0) NOT NULL,
	"confirmations" integer DEFAULT 0,
	"min_confirmations" integer DEFAULT 0,
	"confirmation_state" varchar(30) DEFAULT 'pending' NOT NULL,
	"delay_state" varchar(30) DEFAULT 'unknown' NOT NULL,
	"observed_confirmation_delay_sec" integer,
	"peg_target_usd" numeric(18, 8) DEFAULT '1.00000000',
	"observed_price_usd" numeric(24, 8),
	"peg_deviation_bps" integer DEFAULT 0,
	"risk_flags" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(30) DEFAULT 'received' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "support_ticket_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"total_tickets" integer DEFAULT 0 NOT NULL,
	"open_tickets" integer DEFAULT 0 NOT NULL,
	"resolved_tickets" integer DEFAULT 0 NOT NULL,
	"average_resolution_time" numeric(10, 2) DEFAULT '0',
	"customer_satisfaction" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100),
	"file_size" integer,
	"uploaded_by" varchar,
	"attachment_type" varchar(50) DEFAULT 'document',
	"is_proof" boolean DEFAULT false,
	"verification_status" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"transaction_id" varchar,
	"recipient_address" varchar(42) NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"amount_usd" numeric(18, 2) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"required_signatures" integer NOT NULL,
	"signatures" jsonb DEFAULT '[]'::jsonb,
	"rejection_reason" text,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"executed_at" timestamp,
	"executed_by" varchar,
	"expires_at" timestamp NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_health_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"health_status" varchar(20) NOT NULL,
	"health_score" integer NOT NULL,
	"asset_count" integer DEFAULT 0,
	"total_value_usd" numeric(18, 2),
	"stable_exposure_percent" numeric(5, 2),
	"volatile_exposure_percent" numeric(5, 2),
	"yield_exposure_percent" numeric(5, 2),
	"asset_concentration" numeric(5, 4),
	"chain_concentration" numeric(5, 4),
	"chain_count" integer DEFAULT 1,
	"alert_count" integer DEFAULT 0,
	"recommendation_count" integer DEFAULT 0,
	"snapshot_reason" varchar(50),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"recorded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"daily_cap_percentage" numeric(5, 2) DEFAULT '10' NOT NULL,
	"single_transfer_max_percentage" numeric(5, 2) DEFAULT '20' NOT NULL,
	"multisig_threshold_usd" numeric(18, 2) DEFAULT '10000' NOT NULL,
	"multisig_required_signatures" integer DEFAULT 2 NOT NULL,
	"multisig_window_days" integer DEFAULT 7 NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"treasury_vault_id" uuid,
	"asset_node_id" varchar NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"chain" varchar(20) NOT NULL,
	"contract_address" varchar(255) NOT NULL,
	"balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"balance_usd" numeric(18, 2),
	"cost_basis" numeric(18, 2),
	"acquisition_timestamp" timestamp,
	"last_rebalance_timestamp" timestamp,
	"asset_class" varchar(30),
	"risk_level" varchar(20),
	"dao_type" varchar(30),
	"treasury_mode" varchar(30),
	"treasury_size" varchar(30),
	"risk_profile" varchar(30),
	"next_distribution_window" timestamp,
	"needs_liquidity_by" timestamp,
	"yield_earned" numeric(18, 8) DEFAULT '0',
	"yield_strategy" varchar(50),
	"exit_liquidity" varchar(20),
	"exit_time_at_5_percent_slippage" integer,
	"bridge_cost_if_moving" numeric(5, 2),
	"rebalance_deviation" numeric(5, 2),
	"is_locked_until" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_reconciliation_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_type" varchar NOT NULL,
	"entity_id" uuid NOT NULL,
	"computed_value" numeric(20, 8) NOT NULL,
	"on_chain_value" numeric(20, 8) NOT NULL,
	"discrepancy" numeric(20, 8) NOT NULL,
	"discrepancy_percent" numeric(5, 4) NOT NULL,
	"reconciliation_status" varchar DEFAULT 'matched' NOT NULL,
	"last_on_chain_check" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"transaction_id" varchar,
	"recipient_address" varchar(42) NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"amount_usd" numeric(18, 2),
	"description" text,
	"status" varchar(20) NOT NULL,
	"whitelist_approved" boolean DEFAULT false NOT NULL,
	"amount_validated" boolean DEFAULT false NOT NULL,
	"multisig_required" boolean DEFAULT false NOT NULL,
	"multisig_approved" boolean DEFAULT false NOT NULL,
	"executor_user_id" varchar,
	"executor_role" varchar,
	"approval_id" uuid,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_whitelist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"category" varchar(20) NOT NULL,
	"recipient_name" text,
	"description" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"expires_at" timestamp,
	"requested_by" varchar NOT NULL,
	"rejection_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_withdrawal_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dao_id" uuid NOT NULL,
	"withdrawal_id" uuid NOT NULL,
	"approver_id" varchar NOT NULL,
	"approved" boolean NOT NULL,
	"voted_at" timestamp DEFAULT now(),
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_user_id" varchar NOT NULL,
	"profile" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_identities_provider_user_idx" UNIQUE("provider","provider_user_id")
);
--> statement-breakpoint
CREATE TABLE "user_gamification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"total_points" integer DEFAULT 0,
	"weekly_points" integer DEFAULT 0,
	"monthly_points" integer DEFAULT 0,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_activity" timestamp DEFAULT now(),
	"badge" varchar DEFAULT 'Bronze',
	"level" integer DEFAULT 1,
	"next_level_points" integer DEFAULT 100,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_gamification_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "vault_withdrawal_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"date" date NOT NULL,
	"daily_total_withdrawn" numeric(25, 8) DEFAULT '0' NOT NULL,
	"withdrawal_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vault_withdrawal_tracking_vault_id_date_unique" UNIQUE("vault_id","date")
);
--> statement-breakpoint
CREATE TABLE "venue_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_type" varchar(10) NOT NULL,
	"exchange" varchar(50) NOT NULL,
	"symbol" varchar(20),
	"success_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"average_accuracy" numeric(5, 2) DEFAULT '0' NOT NULL,
	"average_slippage" numeric(10, 6) DEFAULT '0' NOT NULL,
	"average_fill_time_ms" integer DEFAULT 0,
	"recent_success_rate" numeric(5, 2) DEFAULT '0',
	"recent_accuracy" numeric(5, 2) DEFAULT '0',
	"uptrend" boolean DEFAULT false,
	"downtrend" boolean DEFAULT false,
	"volatility" numeric(5, 2) DEFAULT '0',
	"last_execution_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "venue_performance_unique" UNIQUE("venue_type","exchange","symbol")
);
--> statement-breakpoint
CREATE TABLE "wallet_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"session_token" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"disconnected_at" timestamp,
	"last_accessed_at" timestamp DEFAULT now(),
	"ip_address" varchar,
	"user_agent" varchar,
	"device_id" varchar,
	"device_name" varchar,
	"expires_at" timestamp NOT NULL,
	"last_activity_at" timestamp DEFAULT now(),
	"auto_extend_enabled" boolean DEFAULT true,
	"warning_shown_at" timestamp,
	"biometric_enabled" boolean DEFAULT false,
	"location" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wallet_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "withdrawal_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"dao_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" numeric(25, 8) NOT NULL,
	"destination" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"required_signatures" integer NOT NULL,
	"current_signatures" integer DEFAULT 0 NOT NULL,
	"signers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"executed_at" timestamp,
	"executed_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" varchar,
	"action" varchar NOT NULL,
	"resource_type" varchar,
	"resource_id" varchar,
	"status" varchar DEFAULT 'success' NOT NULL,
	"error_message" text,
	"ip_address" varchar,
	"user_agent" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"auto_withdraw" boolean DEFAULT false,
	"auto_compound" boolean DEFAULT false,
	"notifications_enabled" boolean DEFAULT true,
	"preferred_language" varchar DEFAULT 'en',
	"timezone" varchar,
	"theme" varchar DEFAULT 'light',
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_settings_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "account_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"statement_period" varchar NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"opening_balance" numeric(18, 8) NOT NULL,
	"closing_balance" numeric(18, 8) NOT NULL,
	"total_deposits" numeric(18, 8) DEFAULT '0',
	"total_withdrawals" numeric(18, 8) DEFAULT '0',
	"total_transfers" numeric(18, 8) DEFAULT '0',
	"total_fees" numeric(18, 8) DEFAULT '0',
	"total_interest" numeric(18, 8) DEFAULT '0',
	"transaction_count" integer DEFAULT 0,
	"generated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"transaction_type" varchar NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" text DEFAULT 'USDC' NOT NULL,
	"description" text,
	"reference" varchar,
	"from_account_id" uuid,
	"to_account_id" uuid,
	"from_user_id" varchar,
	"to_user_id" varchar,
	"status" varchar DEFAULT 'completed' NOT NULL,
	"balance_before" numeric(18, 8),
	"balance_after" numeric(18, 8),
	"transaction_hash" varchar,
	"chain_id" integer,
	"metadata" text,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"account_type" text DEFAULT 'wallet' NOT NULL,
	"account_number" varchar,
	"balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USDC' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"locked" numeric(18, 8) DEFAULT '0' NOT NULL,
	"total_deposited" numeric(18, 8) DEFAULT '0' NOT NULL,
	"total_withdrawn" numeric(18, 8) DEFAULT '0' NOT NULL,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"daily_limit" numeric(18, 8),
	"monthly_limit" numeric(18, 8),
	"max_balance" numeric(18, 8),
	"dao_id" uuid,
	"last_activity_at" timestamp with time zone,
	"is_verified" boolean DEFAULT false,
	"kyc_status" varchar DEFAULT 'pending',
	"verified_at" timestamp with time zone,
	"is_blocked" boolean DEFAULT false,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "chain_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_account_id" uuid NOT NULL,
	"chain" varchar NOT NULL,
	"wallet_address" varchar NOT NULL,
	"balance" numeric(36, 18) DEFAULT '0' NOT NULL,
	"balance_usd" numeric(18, 6) DEFAULT '0' NOT NULL,
	"token_symbol" varchar NOT NULL,
	"token_address" varchar NOT NULL,
	"token_balance" numeric(36, 18) DEFAULT '0' NOT NULL,
	"rpc_url" varchar,
	"block_explorer_url" varchar,
	"last_sync" timestamp with time zone,
	"sync_status" varchar DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chain_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain" varchar NOT NULL,
	"gas_price_low" numeric(18, 9) NOT NULL,
	"gas_price_standard" numeric(18, 9) NOT NULL,
	"gas_price_fast" numeric(18, 9) NOT NULL,
	"base_fee" numeric(18, 9),
	"priority_fee" numeric(18, 9),
	"congestion_level" varchar DEFAULT 'low' NOT NULL,
	"mempool_size" integer,
	"pending_transactions" integer,
	"avg_block_time" numeric(10, 3) NOT NULL,
	"bridge_latency_seconds" integer,
	"failed_bridges" integer DEFAULT 0,
	"native_token_price_usd" numeric(18, 6) NOT NULL,
	"liquidity_index" numeric(10, 2) DEFAULT '0',
	"rpc_health" varchar DEFAULT 'unknown',
	"is_maintenance_mode" boolean DEFAULT false,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"to_account_id" uuid NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_identifier" varchar(255),
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar(10) DEFAULT 'USDC' NOT NULL,
	"fee_amount" numeric(18, 8) DEFAULT '0',
	"stable_inflow_event_id" uuid,
	"normalized_amount_usd" numeric(24, 8),
	"stable_units_microusd" numeric(38, 0),
	"chain_id" integer,
	"token_address" varchar(255),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"transaction_hash" varchar(255),
	"external_reference" varchar(255),
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "internal_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_account_id" uuid NOT NULL,
	"to_account_id" uuid NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar(10) DEFAULT 'USDC' NOT NULL,
	"reason" varchar(50),
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_account_id" uuid NOT NULL,
	"destination" varchar(50) NOT NULL,
	"destination_address" varchar(255),
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar(10) DEFAULT 'USDC' NOT NULL,
	"fee_amount" numeric(18, 8) DEFAULT '0',
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"transaction_hash" varchar(255),
	"external_reference" varchar(255),
	"micro_withdrawal_id" uuid,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "architecture_gaps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"detected_at" timestamp NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"affected_services" jsonb NOT NULL,
	"description" text NOT NULL,
	"impact" text NOT NULL,
	"suggested_remediation" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"target_service" uuid,
	"target_resource" text,
	"previous_state" jsonb,
	"new_state" jsonb,
	"event_hash" text NOT NULL,
	"previous_event_hash" text,
	"description" text,
	"metadata" jsonb,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"approved_by" text,
	"approval_timestamp" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_event_hash_unique" UNIQUE("event_hash")
);
--> statement-breakpoint
CREATE TABLE "drift_detections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"detected_at" timestamp NOT NULL,
	"type" text NOT NULL,
	"location" text NOT NULL,
	"severity" text NOT NULL,
	"remediation" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_state_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"overall_health" text NOT NULL,
	"total_services" integer NOT NULL,
	"healthy_services" integer NOT NULL,
	"degraded_services" integer NOT NULL,
	"offline_services" integer NOT NULL,
	"total_dependencies" integer NOT NULL,
	"broken_dependencies" integer NOT NULL,
	"critical_alerts" jsonb NOT NULL,
	"warning_alerts" jsonb NOT NULL,
	"state_snapshot" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remediation_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"remediation_type" text NOT NULL,
	"target_service_id" uuid NOT NULL,
	"gap_id" uuid NOT NULL,
	"requires_approval" boolean NOT NULL,
	"execution_mode" text NOT NULL,
	"estimated_duration" integer,
	"status" text NOT NULL,
	"initiated_by" text NOT NULL,
	"initiated_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"success" boolean DEFAULT false NOT NULL,
	"output" text,
	"error_message" text,
	"previous_attempts_in_24h" integer NOT NULL,
	"max_attempts_allowed_in_24h" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_topology" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"captured_at" timestamp NOT NULL,
	"services_data" jsonb NOT NULL,
	"dependencies_data" jsonb NOT NULL,
	"privilege_matrix" jsonb NOT NULL,
	"topology_hash" text NOT NULL,
	"previous_topology_hash" text,
	"changes_since_last_capture" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"generated_at" timestamp NOT NULL,
	"health_status" text NOT NULL,
	"total_services" integer NOT NULL,
	"healthy_services" integer NOT NULL,
	"degraded_services" integer NOT NULL,
	"offline_services" integer NOT NULL,
	"total_gaps" integer NOT NULL,
	"critical_gaps" integer NOT NULL,
	"warning_gaps" integer NOT NULL,
	"report_data" jsonb NOT NULL,
	"recommendations" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cross_chain_bridges" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cross_chain_chains" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cross_chain_dexes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cross_chain_swaps" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cross_chain_tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cross_chain_trading_pairs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_reputation" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "cross_chain_bridges" CASCADE;--> statement-breakpoint
DROP TABLE "cross_chain_chains" CASCADE;--> statement-breakpoint
DROP TABLE "cross_chain_dexes" CASCADE;--> statement-breakpoint
DROP TABLE "cross_chain_swaps" CASCADE;--> statement-breakpoint
DROP TABLE "cross_chain_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "cross_chain_trading_pairs" CASCADE;--> statement-breakpoint
DROP TABLE "user_reputation" CASCADE;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP CONSTRAINT "cross_chain_transfers_transfer_id_unique";--> statement-breakpoint
ALTER TABLE "user_activities" DROP CONSTRAINT "user_activities_referral_code_unique";--> statement-breakpoint
ALTER TABLE "vaults" DROP CONSTRAINT "vault_owner_check";--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP CONSTRAINT "cross_chain_transfers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP CONSTRAINT "cross_chain_transfers_source_chain_cross_chain_chains_chain_name_fk";
--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP CONSTRAINT "cross_chain_transfers_destination_chain_cross_chain_chains_chain_name_fk";
--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "source_chain" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "status" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "bridge_fee" SET DATA TYPE numeric(18, 6);--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "bridge_fee" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "bridge_fee" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_contexts" ADD CONSTRAINT "user_contexts_user_id_dao_id_pk" PRIMARY KEY("user_id","dao_id");--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "key_prefix" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_used_ip" varchar;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "revoked_reason" text;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "withdrawal_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "source_token" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "source_amount" numeric(36, 18) NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "source_tx_hash" varchar;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "target_chain" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "target_token" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "target_amount" numeric(36, 18) NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "target_tx_hash" varchar;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "recipient_address" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "bridge_protocol" varchar DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "bridge_tx_hash" varchar;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "gas_fee_source" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "gas_fee_target" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "swap_slippage" numeric(18, 6) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "total_cost_usd" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "estimated_time" integer;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "bridge_initiated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "deleted_by" varchar;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "daos" ADD COLUMN "deleted_recovery_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD COLUMN "dao_id" uuid;--> statement-breakpoint
ALTER TABLE "multisig_wallets" ADD COLUMN "chain" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "multisig_wallets" ADD COLUMN "deployed_at" timestamp;--> statement-breakpoint
ALTER TABLE "multisig_wallets" ADD COLUMN "deployment_tx_hash" varchar;--> statement-breakpoint
ALTER TABLE "proposal_comments" ADD COLUMN "edit_history" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "proposal_comments" ADD COLUMN "last_edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "proposal_comments" ADD COLUMN "last_edited_by" varchar;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "is_draft" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "treasury_multisig_transactions" ADD COLUMN "multisig_wallet_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "treasury_multisig_transactions" ADD COLUMN "contract_function" varchar;--> statement-breakpoint
ALTER TABLE "treasury_multisig_transactions" ADD COLUMN "params" jsonb;--> statement-breakpoint
ALTER TABLE "treasury_multisig_transactions" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "treasury_multisig_transactions" ADD COLUMN "submitted_tx_hash" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "advanced_mode" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reputation" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "balance" numeric(20, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active_subprofile" varchar DEFAULT 'okedi';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_method" varchar DEFAULT 'totp';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_backup_codes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_setup_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_recovery_email" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_by" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_recovery_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "creator_id" varchar;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "owner_type" varchar;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "treasury_id" uuid;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "vault_config" jsonb;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "stable_inflow_event_id" uuid;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "stable_units_microusd" numeric(38, 0);--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "chain_id" integer;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "token_address" varchar(255);--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "dao_id" uuid;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "mediator_id" varchar;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "mediator_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "dispute_winner" varchar;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "dispute_percentages" jsonb DEFAULT '{"payer":0,"payee":100}'::jsonb;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "guardians" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recipient_email" varchar;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recipient_name" varchar;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "subtotal" numeric(18, 8) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "tax" numeric(18, 8) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "total" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "bill_split_participants" ADD CONSTRAINT "bill_split_participants_bill_split_id_bill_splits_id_fk" FOREIGN KEY ("bill_split_id") REFERENCES "public"."bill_splits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_split_payments" ADD CONSTRAINT "bill_split_payments_bill_split_id_bill_splits_id_fk" FOREIGN KEY ("bill_split_id") REFERENCES "public"."bill_splits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_split_payments" ADD CONSTRAINT "bill_split_payments_payment_id_bill_split_participants_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."bill_split_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_settings" ADD CONSTRAINT "biometric_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_analytics" ADD CONSTRAINT "dao_analytics_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_contribution_approvals" ADD CONSTRAINT "dao_contribution_approvals_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_contribution_approvals" ADD CONSTRAINT "dao_contribution_approvals_contribution_id_dao_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."dao_contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_contribution_approvals" ADD CONSTRAINT "dao_contribution_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_contribution_types" ADD CONSTRAINT "dao_contribution_types_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_contributions" ADD CONSTRAINT "dao_contributions_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_contributions" ADD CONSTRAINT "dao_contributions_contributor_id_users_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_contributions" ADD CONSTRAINT "dao_contributions_contribution_type_id_dao_contribution_types_id_fk" FOREIGN KEY ("contribution_type_id") REFERENCES "public"."dao_contribution_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_multisig_config" ADD CONSTRAINT "dao_multisig_config_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dao_settings" ADD CONSTRAINT "dao_settings_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_facilities" ADD CONSTRAINT "loan_facilities_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_creation_jobs" ADD CONSTRAINT "multisig_creation_jobs_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_signatures" ADD CONSTRAINT "multisig_signatures_approval_id_withdrawal_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."withdrawal_approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multisig_signatures" ADD CONSTRAINT "multisig_signatures_signer_id_users_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_metadata" ADD CONSTRAINT "notification_metadata_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_metadata" ADD CONSTRAINT "notification_metadata_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_reset_requests" ADD CONSTRAINT "pin_reset_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_reset_requests" ADD CONSTRAINT "pin_reset_requests_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notifications" ADD CONSTRAINT "session_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notifications" ADD CONSTRAINT "session_notifications_session_id_wallet_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wallet_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_approvals" ADD CONSTRAINT "treasury_approvals_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_approvals" ADD CONSTRAINT "treasury_approvals_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_approvals" ADD CONSTRAINT "treasury_approvals_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_approvals" ADD CONSTRAINT "treasury_approvals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_health_history" ADD CONSTRAINT "treasury_health_history_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_limits" ADD CONSTRAINT "treasury_limits_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_limits" ADD CONSTRAINT "treasury_limits_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_positions" ADD CONSTRAINT "treasury_positions_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_positions" ADD CONSTRAINT "treasury_positions_treasury_vault_id_vaults_id_fk" FOREIGN KEY ("treasury_vault_id") REFERENCES "public"."vaults"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_executor_user_id_users_id_fk" FOREIGN KEY ("executor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_approval_id_treasury_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."treasury_approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_whitelist" ADD CONSTRAINT "treasury_whitelist_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_whitelist" ADD CONSTRAINT "treasury_whitelist_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_whitelist" ADD CONSTRAINT "treasury_whitelist_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_withdrawal_approvals" ADD CONSTRAINT "treasury_withdrawal_approvals_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_withdrawal_approvals" ADD CONSTRAINT "treasury_withdrawal_approvals_withdrawal_id_wallet_transactions_id_fk" FOREIGN KEY ("withdrawal_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_withdrawal_approvals" ADD CONSTRAINT "treasury_withdrawal_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_gamification" ADD CONSTRAINT "user_gamification_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_withdrawal_tracking" ADD CONSTRAINT "vault_withdrawal_tracking_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_sessions" ADD CONSTRAINT "wallet_sessions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_sessions" ADD CONSTRAINT "wallet_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_approvals" ADD CONSTRAINT "withdrawal_approvals_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_approvals" ADD CONSTRAINT "withdrawal_approvals_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_approvals" ADD CONSTRAINT "withdrawal_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_approvals" ADD CONSTRAINT "withdrawal_approvals_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_access_logs" ADD CONSTRAINT "account_access_logs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_settings" ADD CONSTRAINT "account_settings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_statements" ADD CONSTRAINT "account_statements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_edges_version_idx" ON "asset_edges" USING btree ("version");--> statement-breakpoint
CREATE INDEX "asset_edges_source_idx" ON "asset_edges" USING btree ("source_asset_id");--> statement-breakpoint
CREATE INDEX "asset_edges_type_idx" ON "asset_edges" USING btree ("relationship_type");--> statement-breakpoint
CREATE INDEX "asset_edges_version_type_idx" ON "asset_edges" USING btree ("version","relationship_type");--> statement-breakpoint
CREATE INDEX "asset_graph_versions_timestamp_idx" ON "asset_graph_versions" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "asset_graph_versions_node_hash_idx" ON "asset_graph_versions" USING btree ("node_hash");--> statement-breakpoint
CREATE INDEX "asset_nodes_version_idx" ON "asset_nodes" USING btree ("version");--> statement-breakpoint
CREATE INDEX "asset_nodes_id_version_idx" ON "asset_nodes" USING btree ("id","version");--> statement-breakpoint
CREATE INDEX "asset_state_snapshots_asset_node_id_idx" ON "asset_state_snapshots" USING btree ("asset_node_id");--> statement-breakpoint
CREATE INDEX "asset_state_snapshots_symbol_idx" ON "asset_state_snapshots" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "asset_state_snapshots_timestamp_idx" ON "asset_state_snapshots" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "asset_state_snapshots_graph_version_idx" ON "asset_state_snapshots" USING btree ("graph_version");--> statement-breakpoint
CREATE INDEX "correlation_matrices_matrix_version_idx" ON "correlation_matrices" USING btree ("matrix_version");--> statement-breakpoint
CREATE INDEX "correlation_matrices_graph_version_idx" ON "correlation_matrices" USING btree ("computed_against_graph_version");--> statement-breakpoint
CREATE INDEX "correlation_matrices_timestamp_idx" ON "correlation_matrices" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_execution_history_user_id" ON "execution_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_execution_history_status" ON "execution_history" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_execution_history_symbol" ON "execution_history" USING btree ("symbol","created_at");--> statement-breakpoint
CREATE INDEX "idx_execution_metrics_exchange_symbol" ON "execution_metrics" USING btree ("exchange","symbol","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_execution_metrics_recorded_at" ON "execution_metrics" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_execution_metrics_order_id" ON "execution_metrics" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_execution_metrics_success" ON "execution_metrics" USING btree ("success","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_execution_statistics_exchange_symbol" ON "execution_statistics" USING btree ("exchange","symbol");--> statement-breakpoint
CREATE INDEX "idx_execution_statistics_window" ON "execution_statistics" USING btree ("window_start","window_end");--> statement-breakpoint
CREATE INDEX "idx_ml_training_data_symbol_time" ON "ml_training_data" USING btree ("symbol","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_ml_training_data_venue" ON "ml_training_data" USING btree ("venue_type","exchange");--> statement-breakpoint
CREATE INDEX "idx_ml_training_data_success" ON "ml_training_data" USING btree ("execution_success","recorded_at");--> statement-breakpoint
CREATE INDEX "stable_asset_registry_chain_token_idx" ON "stable_asset_registry" USING btree ("chain_id","token_address");--> statement-breakpoint
CREATE INDEX "stable_asset_registry_symbol_idx" ON "stable_asset_registry" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "stable_asset_registry_active_idx" ON "stable_asset_registry" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "stable_inflow_events_idempotency_idx" ON "stable_inflow_events" USING btree ("chain_id","tx_hash","log_index","token_address","to_address");--> statement-breakpoint
CREATE INDEX "stable_inflow_events_status_idx" ON "stable_inflow_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stable_inflow_events_symbol_idx" ON "stable_inflow_events" USING btree ("token_symbol");--> statement-breakpoint
CREATE INDEX "stable_inflow_events_created_at_idx" ON "stable_inflow_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "treasury_approvals_dao_id_idx" ON "treasury_approvals" USING btree ("dao_id");--> statement-breakpoint
CREATE INDEX "treasury_approvals_status_idx" ON "treasury_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "treasury_approvals_expires_at_idx" ON "treasury_approvals" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "treasury_approvals_recipient_idx" ON "treasury_approvals" USING btree ("recipient_address");--> statement-breakpoint
CREATE INDEX "treasury_limits_dao_id_idx" ON "treasury_limits" USING btree ("dao_id");--> statement-breakpoint
CREATE INDEX "treasury_positions_dao_id_idx" ON "treasury_positions" USING btree ("dao_id");--> statement-breakpoint
CREATE INDEX "treasury_positions_symbol_idx" ON "treasury_positions" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "treasury_positions_chain_idx" ON "treasury_positions" USING btree ("chain");--> statement-breakpoint
CREATE INDEX "treasury_positions_dao_type_idx" ON "treasury_positions" USING btree ("dao_type");--> statement-breakpoint
CREATE INDEX "treasury_positions_next_distribution_idx" ON "treasury_positions" USING btree ("next_distribution_window");--> statement-breakpoint
CREATE INDEX "treasury_transactions_dao_id_idx" ON "treasury_transactions" USING btree ("dao_id");--> statement-breakpoint
CREATE INDEX "treasury_transactions_status_idx" ON "treasury_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "treasury_transactions_created_at_idx" ON "treasury_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "treasury_transactions_recipient_idx" ON "treasury_transactions" USING btree ("recipient_address");--> statement-breakpoint
CREATE INDEX "treasury_whitelist_dao_id_idx" ON "treasury_whitelist" USING btree ("dao_id");--> statement-breakpoint
CREATE INDEX "treasury_whitelist_wallet_address_idx" ON "treasury_whitelist" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "treasury_whitelist_status_idx" ON "treasury_whitelist" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_venue_performance_type_exchange" ON "venue_performance" USING btree ("venue_type","exchange");--> statement-breakpoint
CREATE INDEX "idx_venue_performance_updated_at" ON "venue_performance" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_log_account_id" ON "account_access_logs" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_log_user_id" ON "account_access_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_log_action" ON "account_access_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_log_created" ON "account_access_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_stmt_account_id" ON "account_statements" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_stmt_period" ON "account_statements" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_account_tx_account_id" ON "account_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_tx_type" ON "account_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "idx_account_tx_from" ON "account_transactions" USING btree ("from_account_id");--> statement-breakpoint
CREATE INDEX "idx_account_tx_to" ON "account_transactions" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX "idx_account_tx_created" ON "account_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_user_account_type" ON "accounts" USING btree ("user_id","account_type","currency");--> statement-breakpoint
CREATE INDEX "idx_user_balance" ON "accounts" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_account_status" ON "accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_account_number" ON "accounts" USING btree ("account_number");--> statement-breakpoint
CREATE INDEX "idx_dao_id" ON "accounts" USING btree ("dao_id");--> statement-breakpoint
CREATE INDEX "idx_chain_account" ON "chain_accounts" USING btree ("service_account_id","chain");--> statement-breakpoint
CREATE INDEX "idx_wallet_address" ON "chain_accounts" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_chain" ON "chain_accounts" USING btree ("chain");--> statement-breakpoint
CREATE INDEX "idx_token_chain" ON "chain_accounts" USING btree ("token_symbol","chain");--> statement-breakpoint
CREATE INDEX "idx_metrics_chain" ON "chain_metrics" USING btree ("chain");--> statement-breakpoint
CREATE INDEX "idx_metrics_recorded_at" ON "chain_metrics" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_congestion_level" ON "chain_metrics" USING btree ("congestion_level");--> statement-breakpoint
CREATE INDEX "idx_deposits_user_id" ON "deposits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_to_account_id" ON "deposits" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_status" ON "deposits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_deposits_source" ON "deposits" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_deposits_created_at" ON "deposits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_deposits_user_status" ON "deposits" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_deposits_stable_inflow_event_id" ON "deposits" USING btree ("stable_inflow_event_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_chain_token" ON "deposits" USING btree ("chain_id","token_address");--> statement-breakpoint
CREATE INDEX "idx_transfers_user_id" ON "internal_transfers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_from_account_id" ON "internal_transfers" USING btree ("from_account_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_to_account_id" ON "internal_transfers" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_created_at" ON "internal_transfers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_transfers_user_from_to" ON "internal_transfers" USING btree ("user_id","from_account_id","to_account_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_reason" ON "internal_transfers" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_user_id" ON "withdrawals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_from_account_id" ON "withdrawals" USING btree ("from_account_id");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_status" ON "withdrawals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_destination" ON "withdrawals" USING btree ("destination");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_created_at" ON "withdrawals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_user_status" ON "withdrawals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_micro_withdrawal_id" ON "withdrawals" USING btree ("micro_withdrawal_id");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_multisig_transactions" ADD CONSTRAINT "treasury_multisig_transactions_multisig_wallet_id_multisig_wallets_id_fk" FOREIGN KEY ("multisig_wallet_id") REFERENCES "public"."multisig_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_treasury_id_daos_id_fk" FOREIGN KEY ("treasury_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_dao_id_daos_id_fk" FOREIGN KEY ("dao_id") REFERENCES "public"."daos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_mediator_id_users_id_fk" FOREIGN KEY ("mediator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_withdrawal_id" ON "cross_chain_transfers" USING btree ("withdrawal_id");--> statement-breakpoint
CREATE INDEX "idx_source_chain" ON "cross_chain_transfers" USING btree ("source_chain");--> statement-breakpoint
CREATE INDEX "idx_target_chain" ON "cross_chain_transfers" USING btree ("target_chain");--> statement-breakpoint
CREATE INDEX "idx_transfer_status" ON "cross_chain_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_source_tx" ON "cross_chain_transfers" USING btree ("source_tx_hash");--> statement-breakpoint
CREATE INDEX "idx_target_tx" ON "cross_chain_transfers" USING btree ("target_tx_hash");--> statement-breakpoint
CREATE INDEX "idx_created_at" ON "cross_chain_transfers" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "transfer_id";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "destination_chain";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "token_symbol";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "token_address";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "source_address";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "destination_address";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "bridge_used";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "source_transaction_hash";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "destination_transaction_hash";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "gas_fee";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "estimated_arrival_time";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "failure_reason";--> statement-breakpoint
ALTER TABLE "cross_chain_transfers" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "first_name";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "last_name";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "profile_image_url";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "roles";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "total_contributions";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "current_streak";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "referral_code";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "referred_by";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "total_referrals";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "dark_mode";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "joined_at";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "otp";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "otp_expires_at";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "is_email_verified";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "is_phone_verified";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "is_banned";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "ban_reason";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "is_super_user";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "voting_power";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "telegram_id";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "telegram_chat_id";--> statement-breakpoint
ALTER TABLE "user_activities" DROP COLUMN "telegram_username";--> statement-breakpoint
ALTER TABLE "vaults" DROP COLUMN "chain_id";--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "unique_reaction_idx" UNIQUE("message_id","user_id","emoji");