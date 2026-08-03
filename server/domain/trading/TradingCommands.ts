/**
 * Trading Command Definitions
 *
 * Strongly-typed commands for the Trade aggregate.
 * These flow through the CommandBus middleware pipeline (Auth → Validation → Idempotency → Audit)
 * before reaching their handler.
 */

import type { Command } from '../commands/Command';

// ---------------------------------------------------------------------------
// Command Type Constants
// ---------------------------------------------------------------------------

export const TradingCommandTypes = {
  CreateOrder: 'CreateOrder',
  UpdateOrderFill: 'UpdateOrderFill',
  CancelOrder: 'CancelOrder',
  ExpireOrder: 'ExpireOrder',
  TransitionOrderStatus: 'TransitionOrderStatus',
} as const;

// ---------------------------------------------------------------------------
// Command Payloads
// ---------------------------------------------------------------------------

export interface CreateOrderPayload {
  userId: string;
  exchange: string;
  exchangeOrderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  expiresAt: string; // ISO-8601
}

export interface UpdateOrderFillPayload {
  orderId: string;
  filledAmount: number;
  filledPrice: number;
  fee: number;
  isFinalFill: boolean; // true = transition to FILLED
}

export interface CancelOrderPayload {
  orderId: string;
  reason?: string;
}

export interface ExpireOrderPayload {
  orderId: string;
}

export interface TransitionOrderStatusPayload {
  orderId: string;
  targetStatus: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Typed Command Aliases
// ---------------------------------------------------------------------------

export type CreateOrderCommand = Command<CreateOrderPayload>;
export type UpdateOrderFillCommand = Command<UpdateOrderFillPayload>;
export type CancelOrderCommand = Command<CancelOrderPayload>;
export type ExpireOrderCommand = Command<ExpireOrderPayload>;
export type TransitionOrderStatusCommand = Command<TransitionOrderStatusPayload>;
