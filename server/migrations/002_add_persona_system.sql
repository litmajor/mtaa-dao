/**
 * Database Migration: Add Persona System
 * 
 * Creates tables for:
 * 1. user_personas - Track which persona each user has selected
 * 2. tutorial_progress - Track gating feature understanding via Morio chat
 */

-- Create user_personas table
CREATE TABLE IF NOT EXISTS user_personas (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  persona VARCHAR(50) NOT NULL CHECK (persona IN ('okedi', 'yuki', 'amara')),
  selected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster persona lookups
CREATE INDEX IF NOT EXISTS idx_user_personas_user_id ON user_personas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_personas_persona ON user_personas(persona);

-- Create tutorial_progress table
-- Tracks when users learn about features through Morio conversations
CREATE TABLE IF NOT EXISTS tutorial_progress (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  morio_conversation_id VARCHAR(255),
  understood BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, feature_key)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tutorial_progress_user_id ON tutorial_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_progress_feature ON tutorial_progress(feature_key);
CREATE INDEX IF NOT EXISTS idx_tutorial_progress_completed ON tutorial_progress(completed_at);

-- Add persona-related columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_persona VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS persona_updated_at TIMESTAMP;

-- Migration notes:
-- Run this migration after deploying Phase 3.2 code
-- No data needs to be migrated (fresh start for all users)
-- Users will select persona on first login or signup
