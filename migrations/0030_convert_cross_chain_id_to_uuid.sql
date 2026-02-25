-- Convert cross_chain_transfers.id from text to uuid
ALTER TABLE cross_chain_transfers 
ALTER COLUMN id TYPE uuid USING id::uuid;
