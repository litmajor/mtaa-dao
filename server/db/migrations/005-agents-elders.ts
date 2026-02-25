/**
 * Migration: Create Elders & Agents Tables
 * Phase 5.1 - Database Integration
 */

import { sql } from 'drizzle-orm';
import { pgTable, text, varchar, numeric, integer, timestamp, json, boolean, index, foreignKey } from 'drizzle-orm/pg-core';

export async function up(db: any) {
  // Create Elders table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS elders (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      emoji VARCHAR(10) NOT NULL,
      role VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      capabilities JSON NOT NULL DEFAULT '[]',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      uptime NUMERIC(5,4) NOT NULL DEFAULT 0.99,
      last_heartbeat TIMESTAMP NOT NULL DEFAULT NOW(),
      proposals_analyzed INTEGER DEFAULT 0,
      optimizations_suggested INTEGER DEFAULT 0,
      implementation_rate NUMERIC(5,4) DEFAULT 0.72,
      threats_detected INTEGER DEFAULT 0,
      risks_identified INTEGER DEFAULT 0,
      compliance_issues INTEGER DEFAULT 0,
      proposals_reviewed INTEGER DEFAULT 0,
      ethical_concerns INTEGER DEFAULT 0,
      approval_rate NUMERIC(5,4) DEFAULT 0.91,
      color VARCHAR(7) NOT NULL,
      configuration JSON NOT NULL DEFAULT '{}',
      tags JSON DEFAULT '[]',
      metadata JSON DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_elders_status ON elders(status);
    CREATE INDEX IF NOT EXISTS idx_elders_lastHeartbeat ON elders(last_heartbeat);
  `);

  // Create Agents table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agents (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      type VARCHAR(64) NOT NULL,
      emoji VARCHAR(10) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'online',
      uptime NUMERIC(5,4) NOT NULL DEFAULT 0.995,
      last_heartbeat TIMESTAMP NOT NULL DEFAULT NOW(),
      messages_processed INTEGER DEFAULT 0,
      average_response_time INTEGER DEFAULT 0,
      error_rate NUMERIC(5,4) DEFAULT 0.01,
      capabilities JSON NOT NULL DEFAULT '[]',
      version VARCHAR(20) DEFAULT '1.0.0',
      last_deployed_at TIMESTAMP DEFAULT NOW(),
      configuration JSON NOT NULL DEFAULT '{}',
      tags JSON DEFAULT '[]',
      metadata JSON DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
    CREATE INDEX IF NOT EXISTS idx_agents_lastHeartbeat ON agents(last_heartbeat);
  `);

  // Create Elder Activity table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS elder_activity (
      id VARCHAR(64) PRIMARY KEY,
      elder_id VARCHAR(64) NOT NULL REFERENCES elders(id),
      activity_type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      impact VARCHAR(255),
      severity VARCHAR(20) DEFAULT 'info',
      status VARCHAR(20) DEFAULT 'pending',
      related_proposal_id VARCHAR(64),
      data JSON DEFAULT '{}',
      occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_elder_activity_elderId ON elder_activity(elder_id);
    CREATE INDEX IF NOT EXISTS idx_elder_activity_type ON elder_activity(activity_type);
    CREATE INDEX IF NOT EXISTS idx_elder_activity_occurredAt ON elder_activity(occurred_at);
  `);

  // Create Agent Logs table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_logs (
      id VARCHAR(64) PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL REFERENCES agents(id),
      action VARCHAR(255) NOT NULL,
      operation_type VARCHAR(64) NOT NULL,
      description TEXT,
      result VARCHAR(20) NOT NULL DEFAULT 'success',
      result_details JSON DEFAULT '{}',
      response_time INTEGER DEFAULT 0,
      related_entity_type VARCHAR(64),
      related_entity_id VARCHAR(64),
      metadata JSON DEFAULT '{}',
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_agent_logs_agentId ON agent_logs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_logs_result ON agent_logs(result);
    CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp);
  `);

  // Create Elder-Agent Interaction table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS elder_agent_interaction (
      id VARCHAR(64) PRIMARY KEY,
      elder_id VARCHAR(64) NOT NULL REFERENCES elders(id),
      agent_id VARCHAR(64) NOT NULL REFERENCES agents(id),
      interaction_type VARCHAR(64) NOT NULL,
      direction VARCHAR(20) NOT NULL,
      message TEXT,
      data JSON DEFAULT '{}',
      status VARCHAR(20) DEFAULT 'completed',
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_elder_agent_elderId ON elder_agent_interaction(elder_id);
    CREATE INDEX IF NOT EXISTS idx_elder_agent_agentId ON elder_agent_interaction(agent_id);
    CREATE INDEX IF NOT EXISTS idx_elder_agent_timestamp ON elder_agent_interaction(timestamp);
  `);

  // Create System Configuration table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS system_configuration (
      id VARCHAR(64) PRIMARY KEY,
      elder_settings JSON NOT NULL DEFAULT '{}',
      agent_settings JSON NOT NULL DEFAULT '{}',
      system_settings JSON NOT NULL DEFAULT '{}',
      elder_feature_flags JSON DEFAULT '{}',
      agent_feature_flags JSON DEFAULT '{}',
      version VARCHAR(20) DEFAULT '1.0.0',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Create Performance Metrics table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS performance_metrics (
      id VARCHAR(64) PRIMARY KEY,
      entity_type VARCHAR(20) NOT NULL,
      entity_id VARCHAR(64) NOT NULL,
      uptime NUMERIC(5,4),
      response_time INTEGER,
      throughput INTEGER,
      error_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      custom_metrics JSON DEFAULT '{}',
      recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
      period_start TIMESTAMP,
      period_end TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_metrics_entityType_entityId ON performance_metrics(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_recordedAt ON performance_metrics(recorded_at);
  `);
}

export async function down(db: any) {
  // Drop tables in reverse order of creation (due to foreign keys)
  await db.execute(sql`DROP TABLE IF EXISTS performance_metrics;`);
  await db.execute(sql`DROP TABLE IF EXISTS system_configuration;`);
  await db.execute(sql`DROP TABLE IF EXISTS elder_agent_interaction;`);
  await db.execute(sql`DROP TABLE IF EXISTS agent_logs;`);
  await db.execute(sql`DROP TABLE IF EXISTS elder_activity;`);
  await db.execute(sql`DROP TABLE IF EXISTS agents;`);
  await db.execute(sql`DROP TABLE IF EXISTS elders;`);
}
