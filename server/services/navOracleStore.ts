import type { NavOracleStore, VaultNAVResult } from './navOracleService';

/** In-memory adapter for isolated tests and explicit local use. */
export class InMemoryNavOracleStore implements NavOracleStore {
  private nonces = new Map<string, number>();
  private last = new Map<string, VaultNAVResult>();

  async getNonce(vaultId: string): Promise<number> {
    return this.nonces.get(vaultId) ?? 0;
  }

  async incrementNonce(vaultId: string): Promise<number> {
    const nonce = (this.nonces.get(vaultId) ?? 0) + 1;
    this.nonces.set(vaultId, nonce);
    return nonce;
  }

  async getLastNav(vaultId: string): Promise<VaultNAVResult | null> {
    return this.last.get(vaultId) ?? null;
  }

  async setLastNav(vaultId: string, result: VaultNAVResult): Promise<void> {
    this.last.set(vaultId, result);
  }
}

/**
 * PostgreSQL-backed production store. The nonce update is a single atomic
 * statement so independent service instances cannot issue duplicate nonces.
 */
export class PostgresNavOracleStore implements NavOracleStore {
  private async getPool() {
    const { pool } = await import('../db');
    return pool;
  }

  async getNonce(vaultId: string): Promise<number> {
    const pool = await this.getPool();
    const { rows } = await pool.query<{ nonce: string | number }>(
      'SELECT nonce FROM nav_oracle_state WHERE vault_id = $1',
      [vaultId]
    );
    return this.toSafeNonce(rows[0]?.nonce ?? 0);
  }

  async incrementNonce(vaultId: string): Promise<number> {
    const pool = await this.getPool();
    const { rows } = await pool.query<{ nonce: string | number }>(
      `INSERT INTO nav_oracle_state (vault_id, nonce)
       VALUES ($1, 1)
       ON CONFLICT (vault_id)
       DO UPDATE SET nonce = nav_oracle_state.nonce + 1, updated_at = NOW()
       RETURNING nonce`,
      [vaultId]
    );
    if (!rows[0]) throw new Error('PostgreSQL did not return the incremented NAV nonce');
    return this.toSafeNonce(rows[0].nonce);
  }

  async getLastNav(vaultId: string): Promise<VaultNAVResult | null> {
    const pool = await this.getPool();
    const { rows } = await pool.query<{ last_nav: unknown }>(
      'SELECT last_nav FROM nav_oracle_state WHERE vault_id = $1',
      [vaultId]
    );
    if (!rows[0]?.last_nav) return null;
    const stored = typeof rows[0].last_nav === 'string'
      ? JSON.parse(rows[0].last_nav)
      : rows[0].last_nav;
    return this.deserializeNav(stored) as VaultNAVResult;
  }

  async setLastNav(vaultId: string, result: VaultNAVResult): Promise<void> {
    const pool = await this.getPool();
    const serialized = JSON.stringify(result, (_key, value: unknown) =>
      typeof value === 'bigint' ? { __navBigInt: value.toString() } : value
    );
    await pool.query(
      `INSERT INTO nav_oracle_state (vault_id, nonce, last_nav, last_nav_timestamp)
       VALUES ($1, 0, $2::jsonb, $3)
       ON CONFLICT (vault_id)
       DO UPDATE SET
         last_nav = EXCLUDED.last_nav,
         last_nav_timestamp = EXCLUDED.last_nav_timestamp,
         updated_at = NOW()
       WHERE nav_oracle_state.last_nav_timestamp IS NULL
          OR nav_oracle_state.last_nav_timestamp < EXCLUDED.last_nav_timestamp`,
      [vaultId, serialized, result.timestamp]
    );
  }

  private toSafeNonce(value: string | number): number {
    const nonce = Number(value);
    if (!Number.isSafeInteger(nonce) || nonce < 0) {
      throw new Error(`Stored NAV nonce is outside the safe integer range: ${value}`);
    }
    return nonce;
  }

  private deserializeNav(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.deserializeNav(entry));
    if (!value || typeof value !== 'object') return value;
    const object = value as Record<string, unknown>;
    if (
      Object.keys(object).length === 1 &&
      typeof object.__navBigInt === 'string'
    ) {
      return BigInt(object.__navBigInt);
    }
    return Object.fromEntries(
      Object.entries(object).map(([key, entry]) => [key, this.deserializeNav(entry)])
    );
  }
}
