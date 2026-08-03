import { db } from '../../db';
import { vaults } from '../../../shared/schema';
import { eq, sql, and } from 'drizzle-orm';

export class VaultOptimisticLockError extends Error {
  constructor(public readonly vaultId: string, public readonly expectedVersion: number) {
    super(`OCC Conflict for vault ${vaultId} (expected version ${expectedVersion})`);
    this.name = 'VaultOptimisticLockError';
  }
}

export type VaultAggregate = typeof vaults.$inferSelect;
export type VaultInsert = typeof vaults.$inferInsert;

export interface VaultRepository {
  findById(id: string, tx?: any): Promise<VaultAggregate | null>;
  create(vault: VaultInsert, tx?: any): Promise<VaultAggregate>;
  update(
    id: string,
    expectedVersion: number,
    changes: Partial<VaultAggregate>,
    tx?: any
  ): Promise<VaultAggregate>;
}

export class DrizzleVaultRepository implements VaultRepository {
  async findById(id: string, tx: any = db): Promise<VaultAggregate | null> {
    const [vault] = await tx
      .select()
      .from(vaults)
      .where(eq(vaults.id, id))
      .limit(1);
    return vault || null;
  }

  async create(vault: VaultInsert, tx: any = db): Promise<VaultAggregate> {
    const [inserted] = await tx
      .insert(vaults)
      .values(vault)
      .returning();
    return inserted;
  }

  async update(
    id: string,
    expectedVersion: number,
    changes: Partial<VaultAggregate>,
    tx: any = db
  ): Promise<VaultAggregate> {
    const [updated] = await tx
      .update(vaults)
      .set({
        ...changes,
        version: sql`${vaults.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(vaults.id, id), eq(vaults.version, expectedVersion)))
      .returning();

    if (!updated) {
      throw new VaultOptimisticLockError(id, expectedVersion);
    }

    return updated;
  }
}
