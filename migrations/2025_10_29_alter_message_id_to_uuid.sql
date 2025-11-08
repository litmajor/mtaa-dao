-- Migration: Change message_id type to uuid in message_reactions table

ALTER TABLE message_reactions
ALTER COLUMN message_id TYPE uuid USING message_id::uuid;
