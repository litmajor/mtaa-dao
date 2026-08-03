/**
 * Order Repository
 *
 * Encapsulates all database access for the Trade aggregate (limitOrders).
 * Every mutation uses OCC: UPDATE ... SET version = version + 1 WHERE id = ? AND version = ?
 *
 * No other code path should write to limitOrders directly once this repository is adopted.
 */

import { db } from '../../db';
import { limitOrders } from '../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { OrderStatusType } from './OrderStateMachine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderAggregate {
  id: string;
  userId: string;
  exchange: string;
  orderId: string;  // Exchange-side order ID
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  status: OrderStatusType;
  filledAmount: number;
  filledPrice: number | undefined;
  fee: number;
  version: number;
  createdAt: Date;
  expiresAt: Date;
  filledAt: Date | undefined;
  canceledAt: Date | undefined;
  lastCheckedAt: Date | undefined;
}

export interface CreateOrderInput {
  userId: string;
  exchange: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  status: OrderStatusType;
  expiresAt: Date;
}

export interface UpdateOrderFields {
  status?: OrderStatusType;
  filledAmount?: number;
  filledPrice?: number;
  fee?: number;
  filledAt?: Date;
  canceledAt?: Date;
  lastCheckedAt?: Date;
}

export class OptimisticLockError extends Error {
  constructor(
    public readonly aggregateId: string,
    public readonly expectedVersion: number,
  ) {
    super(
      `OCC conflict on limitOrders (id=${aggregateId}, expectedVersion=${expectedVersion}). ` +
      `The aggregate was modified by another process.`
    );
    this.name = 'OptimisticLockError';
  }
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function toAggregate(row: typeof limitOrders.$inferSelect): OrderAggregate {
  return {
    id: row.id,
    userId: row.userId,
    exchange: row.exchange,
    orderId: row.orderId,
    symbol: row.symbol,
    side: row.side as 'buy' | 'sell',
    amount: Number(row.amount),
    price: Number(row.price),
    status: row.status as OrderStatusType,
    filledAmount: Number(row.filledAmount ?? 0),
    filledPrice: row.filledPrice ? Number(row.filledPrice) : undefined,
    fee: Number(row.fee ?? 0),
    version: row.version,
    createdAt: row.createdAt!,
    expiresAt: row.expiresAt,
    filledAt: row.filledAt ?? undefined,
    canceledAt: row.canceledAt ?? undefined,
    lastCheckedAt: row.lastCheckedAt ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class OrderRepository {
  /**
   * Create a new order. Returns the persisted aggregate at version 1.
   */
  async create(input: CreateOrderInput, tx?: any): Promise<OrderAggregate> {
    const conn = tx ?? db;

    const result = await conn
      .insert(limitOrders)
      .values({
        userId: input.userId,
        exchange: input.exchange,
        orderId: input.orderId,
        symbol: input.symbol,
        side: input.side,
        amount: input.amount.toString(),
        price: input.price.toString(),
        status: input.status,
        expiresAt: input.expiresAt,
      })
      .returning();

    return toAggregate(result[0]);
  }

  /**
   * Find an order by its database ID. Returns null if not found.
   */
  async findById(id: string, tx?: any): Promise<OrderAggregate | null> {
    const conn = tx ?? db;

    const result = await conn
      .select()
      .from(limitOrders)
      .where(eq(limitOrders.id, id))
      .limit(1);

    return result.length > 0 ? toAggregate(result[0]) : null;
  }

  /**
   * OCC-protected update. If the version doesn't match, throws OptimisticLockError.
   *
   * Every UPDATE follows the pattern:
   *   UPDATE limit_orders
   *     SET ..., version = version + 1
   *   WHERE id = ? AND version = ?
   *
   * If zero rows are affected, another writer has advanced the version.
   */
  async update(
    id: string,
    expectedVersion: number,
    fields: UpdateOrderFields,
    tx?: any,
  ): Promise<OrderAggregate> {
    const conn = tx ?? db;

    const setClause: Record<string, any> = {
      version: sql`${limitOrders.version} + 1`,
    };

    if (fields.status !== undefined) setClause.status = fields.status;
    if (fields.filledAmount !== undefined) setClause.filledAmount = fields.filledAmount.toString();
    if (fields.filledPrice !== undefined) setClause.filledPrice = fields.filledPrice.toString();
    if (fields.fee !== undefined) setClause.fee = fields.fee.toString();
    if (fields.filledAt !== undefined) setClause.filledAt = fields.filledAt;
    if (fields.canceledAt !== undefined) setClause.canceledAt = fields.canceledAt;
    if (fields.lastCheckedAt !== undefined) setClause.lastCheckedAt = fields.lastCheckedAt;

    const result = await conn
      .update(limitOrders)
      .set(setClause)
      .where(
        and(
          eq(limitOrders.id, id),
          eq(limitOrders.version, expectedVersion),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new OptimisticLockError(id, expectedVersion);
    }

    return toAggregate(result[0]);
  }

  /**
   * Retrieve all orders with a given status (e.g., for polling pending orders).
   */
  async findByStatus(status: OrderStatusType, tx?: any): Promise<OrderAggregate[]> {
    const conn = tx ?? db;

    const results = await conn
      .select()
      .from(limitOrders)
      .where(eq(limitOrders.status, status));

    return results.map(toAggregate);
  }

  /**
   * Retrieve all orders for a given user, optionally filtered by status.
   */
  async findByUser(userId: string, statusFilter?: OrderStatusType, tx?: any): Promise<OrderAggregate[]> {
    const conn = tx ?? db;

    const whereClause = statusFilter
      ? and(eq(limitOrders.userId, userId), eq(limitOrders.status, statusFilter))
      : eq(limitOrders.userId, userId);

    const results = await conn
      .select()
      .from(limitOrders)
      .where(whereClause);

    return results.map(toAggregate);
  }
}
