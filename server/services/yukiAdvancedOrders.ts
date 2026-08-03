import { pool } from '../db';

let advancedOrdersTableReady = false;

export async function ensureYukiAdvancedOrdersTable(): Promise<void> {
  if (advancedOrdersTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS yuki_advanced_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      order_type VARCHAR(30) NOT NULL,
      exchange VARCHAR(50),
      symbol VARCHAR(30) NOT NULL,
      side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
      amount NUMERIC(20, 8) NOT NULL,
      price NUMERIC(20, 8),
      stop_price NUMERIC(20, 8),
      take_profit_price NUMERIC(20, 8),
      trail_percent NUMERIC(10, 4),
      trail_amount NUMERIC(20, 8),
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_yuki_advanced_orders_user_id ON yuki_advanced_orders(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_yuki_advanced_orders_status ON yuki_advanced_orders(status);`);

  advancedOrdersTableReady = true;
}

export function serializeAdvancedOrder(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    orderType: row.order_type,
    exchange: row.exchange,
    symbol: row.symbol,
    side: row.side,
    amount: Number(row.amount),
    price: row.price !== null ? Number(row.price) : null,
    stopPrice: row.stop_price !== null ? Number(row.stop_price) : null,
    takeProfitPrice: row.take_profit_price !== null ? Number(row.take_profit_price) : null,
    trailPercent: row.trail_percent !== null ? Number(row.trail_percent) : null,
    trailAmount: row.trail_amount !== null ? Number(row.trail_amount) : null,
    status: row.status,
    metadata: row.metadata || {},
    createdAt: row.created_at?.toISOString ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at?.toISOString ? row.updated_at.toISOString() : row.updated_at,
  };
}
