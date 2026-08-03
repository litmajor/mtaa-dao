import { db } from '../../db';
import { paymentTransactions } from '../../../shared/schema';
import { eq, sql, and } from 'drizzle-orm';

export class OptimisticLockError extends Error {
  constructor(public readonly paymentId: string, public readonly expectedVersion: number) {
    super(`OCC Conflict for payment ${paymentId} (expected version ${expectedVersion})`);
    this.name = 'OptimisticLockError';
  }
}

export type PaymentAggregate = typeof paymentTransactions.$inferSelect;
export type PaymentInsert = typeof paymentTransactions.$inferInsert;

export interface PaymentRepository {
  findById(id: string, tx?: any): Promise<PaymentAggregate | null>;
  findByReference(reference: string, tx?: any): Promise<PaymentAggregate | null>;
  create(payment: PaymentInsert, tx?: any): Promise<PaymentAggregate>;
  update(
    id: string,
    expectedVersion: number,
    changes: Partial<PaymentAggregate>,
    tx?: any
  ): Promise<PaymentAggregate>;
}

export class DrizzlePaymentRepository implements PaymentRepository {
  async findById(id: string, tx: any = db): Promise<PaymentAggregate | null> {
    const [payment] = await tx
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, id))
      .limit(1);
    return payment || null;
  }

  async findByReference(reference: string, tx: any = db): Promise<PaymentAggregate | null> {
    const [payment] = await tx
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.reference, reference))
      .limit(1);
    return payment || null;
  }

  async create(payment: PaymentInsert, tx: any = db): Promise<PaymentAggregate> {
    const [inserted] = await tx
      .insert(paymentTransactions)
      .values(payment)
      .returning();
    return inserted;
  }

  async update(
    id: string,
    expectedVersion: number,
    changes: Partial<PaymentAggregate>,
    tx: any = db
  ): Promise<PaymentAggregate> {
    const [updated] = await tx
      .update(paymentTransactions)
      .set({
        ...changes,
        version: expectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentTransactions.id, id),
          eq(paymentTransactions.version, expectedVersion)
        )
      )
      .returning();

    if (!updated) {
      throw new OptimisticLockError(id, expectedVersion);
    }

    return updated;
  }
}
