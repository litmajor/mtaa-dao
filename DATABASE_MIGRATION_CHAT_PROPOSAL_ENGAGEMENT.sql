-- Migration: DAO Chat Reactions, Attachments, and Proposal Engagement
-- Date: 2025-10-23
-- Description: Complete implementation of DAO chat features and proposal engagement (likes, comments)

-- =====================================================
-- DAO CHAT ENHANCEMENTS
-- =====================================================

-- Message Reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES dao_messages(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL, -- e.g., '👍', '❤️', '😂'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji) -- Prevent duplicate reactions from same user
);

CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);

-- Message Attachments table
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES dao_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(50), -- e.g., 'image/png', 'application/pdf'
    file_size INTEGER, -- in bytes
    uploaded_by VARCHAR(255) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);

-- Add pinning support to existing dao_messages table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='dao_messages' AND column_name='is_pinned') THEN
        ALTER TABLE dao_messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='dao_messages' AND column_name='pinned_at') THEN
        ALTER TABLE dao_messages ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='dao_messages' AND column_name='pinned_by') THEN
        ALTER TABLE dao_messages ADD COLUMN pinned_by VARCHAR(255) REFERENCES users(id);
    END IF;
END
$$;

-- =====================================================
-- PROPOSAL ENGAGEMENT ENHANCEMENTS
-- =====================================================

-- Proposal Comments table (if not exists)
CREATE TABLE IF NOT EXISTS proposal_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES proposal_comments(id) ON DELETE CASCADE, -- For nested comments
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_proposal_comments_proposal_id ON proposal_comments(proposal_id);
CREATE INDEX idx_proposal_comments_user_id ON proposal_comments(user_id);
CREATE INDEX idx_proposal_comments_parent_comment_id ON proposal_comments(parent_comment_id);

-- Proposal Likes table (if not exists)
CREATE TABLE IF NOT EXISTS proposal_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(proposal_id, user_id) -- One like per user per proposal
);

CREATE INDEX idx_proposal_likes_proposal_id ON proposal_likes(proposal_id);
CREATE INDEX idx_proposal_likes_user_id ON proposal_likes(user_id);

-- Comment Likes table (if not exists)
CREATE TABLE IF NOT EXISTS comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES proposal_comments(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(comment_id, user_id) -- One like per user per comment
);

CREATE INDEX idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user_id ON comment_likes(user_id);

-- Add likes count to proposals table for performance (denormalized)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='proposals' AND column_name='likes_count') THEN
        ALTER TABLE proposals ADD COLUMN likes_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='proposals' AND column_name='comments_count') THEN
        ALTER TABLE proposals ADD COLUMN comments_count INTEGER DEFAULT 0;
    END IF;
END
$$;

-- Add likes count to proposal_comments table for performance (denormalized)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='proposal_comments' AND column_name='likes_count') THEN
        ALTER TABLE proposal_comments ADD COLUMN likes_count INTEGER DEFAULT 0;
    END IF;
END
$$;

-- =====================================================
-- TRIGGERS FOR DENORMALIZED COUNTS
-- =====================================================

-- Trigger to update proposal likes_count
CREATE OR REPLACE FUNCTION update_proposal_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE proposals 
        SET likes_count = likes_count + 1 
        WHERE id = NEW.proposal_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE proposals 
        SET likes_count = GREATEST(0, likes_count - 1) 
        WHERE id = OLD.proposal_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_proposal_likes_count
AFTER INSERT OR DELETE ON proposal_likes
FOR EACH ROW EXECUTE FUNCTION update_proposal_likes_count();

-- Trigger to update proposal comments_count
CREATE OR REPLACE FUNCTION update_proposal_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE proposals 
        SET comments_count = comments_count + 1 
        WHERE id = NEW.proposal_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE proposals 
        SET comments_count = GREATEST(0, comments_count - 1) 
        WHERE id = OLD.proposal_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_proposal_comments_count
AFTER INSERT OR DELETE ON proposal_comments
FOR EACH ROW EXECUTE FUNCTION update_proposal_comments_count();

-- Trigger to update comment likes_count
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE proposal_comments 
        SET likes_count = likes_count + 1 
        WHERE id = NEW.comment_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE proposal_comments 
        SET likes_count = GREATEST(0, likes_count - 1) 
        WHERE id = OLD.comment_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_likes_count
AFTER INSERT OR DELETE ON comment_likes
FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- =====================================================
-- INITIALIZE EXISTING COUNTS (if tables have data)
-- =====================================================

-- Update existing proposals with current like counts
UPDATE proposals p
SET likes_count = COALESCE((
    SELECT COUNT(*) 
    FROM proposal_likes pl 
    WHERE pl.proposal_id = p.id
), 0);

-- Update existing proposals with current comment counts
UPDATE proposals p
SET comments_count = COALESCE((
    SELECT COUNT(*) 
    FROM proposal_comments pc 
    WHERE pc.proposal_id = p.id
), 0);

-- Update existing comments with current like counts
UPDATE proposal_comments c
SET likes_count = COALESCE((
    SELECT COUNT(*) 
    FROM comment_likes cl 
    WHERE cl.comment_id = c.id
), 0);

-- =====================================================
-- COMPLETE
-- =====================================================

-- Verify tables were created
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name IN (
        'message_reactions',
        'message_attachments',
        'proposal_comments',
        'proposal_likes',
        'comment_likes'
    );
    
    RAISE NOTICE 'Migration complete! Created/verified % tables for chat and proposal engagement.', table_count;
END
$$;

