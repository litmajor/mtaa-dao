import { pool } from '../../db';

export async function migrateProposalExecutionSafety() {
  const duplicateActive = await pool.query(`
    SELECT dao_id, proposal_id, COUNT(*) AS row_count
    FROM proposal_execution_queue
    WHERE status IN ('pending', 'executing', 'settlement_pending', 'submitted', 'reconciliation_required')
    GROUP BY dao_id, proposal_id
    HAVING COUNT(*) > 1
    LIMIT 1
  `);
  if (duplicateActive.rows.length > 0) {
    const duplicate = duplicateActive.rows[0];
    throw new Error(
      `Cannot enforce one active execution per proposal: DAO ${duplicate.dao_id}, proposal ${duplicate.proposal_id} has ${duplicate.row_count} active queue rows`,
    );
  }

  const duplicateKeys = await pool.query(`
    SELECT idempotency_key, COUNT(*) AS row_count
    FROM proposal_execution_queue
    WHERE idempotency_key IS NOT NULL
    GROUP BY idempotency_key
    HAVING COUNT(*) > 1
    LIMIT 1
  `);
  if (duplicateKeys.rows.length > 0) {
    throw new Error(
      `Cannot enforce proposal execution idempotency: duplicate key ${duplicateKeys.rows[0].idempotency_key}`,
    );
  }

  const duplicateMultisigLinks = await pool.query(`
    SELECT dao_id, metadata->>'proposalId' AS proposal_id, COUNT(*) AS row_count
    FROM treasury_multisig_transactions
    WHERE metadata ? 'proposalId'
    GROUP BY dao_id, metadata->>'proposalId'
    HAVING COUNT(*) > 1
    LIMIT 1
  `);
  if (duplicateMultisigLinks.rows.length > 0) {
    const duplicate = duplicateMultisigLinks.rows[0];
    throw new Error(
      `Cannot enforce one multisig link per proposal: DAO ${duplicate.dao_id}, proposal ${duplicate.proposal_id} has ${duplicate.row_count} linked transactions`,
    );
  }

  await pool.query(`
    ALTER TABLE proposal_execution_queue
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200),
      ADD COLUMN IF NOT EXISTS execution_result JSONB,
      ADD COLUMN IF NOT EXISTS external_reference TEXT,
      ADD COLUMN IF NOT EXISTS external_tx_hash VARCHAR(255);

    CREATE UNIQUE INDEX IF NOT EXISTS proposal_execution_queue_idempotency_key_uq
      ON proposal_execution_queue (idempotency_key)
      WHERE idempotency_key IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS proposal_execution_queue_active_proposal_uq
      ON proposal_execution_queue (dao_id, proposal_id)
      WHERE status IN ('pending', 'executing', 'settlement_pending', 'submitted', 'reconciliation_required');

    CREATE UNIQUE INDEX IF NOT EXISTS treasury_multisig_proposal_link_uq
      ON treasury_multisig_transactions (dao_id, (metadata->>'proposalId'))
      WHERE metadata ? 'proposalId';
  `);
}

export async function rollbackProposalExecutionSafety() {
  await pool.query(`
    DROP INDEX IF EXISTS proposal_execution_queue_active_proposal_uq;
    DROP INDEX IF EXISTS proposal_execution_queue_idempotency_key_uq;
    DROP INDEX IF EXISTS treasury_multisig_proposal_link_uq;
    ALTER TABLE proposal_execution_queue
      DROP COLUMN IF EXISTS external_tx_hash,
      DROP COLUMN IF EXISTS external_reference,
      DROP COLUMN IF EXISTS execution_result,
      DROP COLUMN IF EXISTS idempotency_key;
  `);
}
