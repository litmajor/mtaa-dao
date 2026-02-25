/**
 * CEX Price Repository
 * Data access layer for price-related database operations
 */

import { pool } from '../db';
import { CEXPrice, QueryResult } from '../../types/cex.types';

export class CEXPriceRepository {
  /**
   * Store a price record
   */
  static async createPrice(
    exchange: string,
    tradingPair: string,
    price: string,
    bid?: string,
    ask?: string,
    volume?: string
  ): Promise<CEXPrice> {
    const result = await pool.query(
      `INSERT INTO cex_prices (exchange, trading_pair, price, bid, ask, volume, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (exchange, trading_pair) DO UPDATE SET
         price = $3, bid = $4, ask = $5, volume = $6, updated_at = NOW()
       RETURNING *`,
      [exchange, tradingPair, price, bid, ask, volume]
    );
    return this.mapToCamelCase(result.rows[0]);
  }

  /**
   * Get latest price for a trading pair
   */
  static async getLatestPrice(
    exchange: string,
    tradingPair: string
  ): Promise<CEXPrice | null> {
    const result = await pool.query(
      `SELECT * FROM cex_prices
       WHERE exchange = $1 AND trading_pair = $2
       ORDER BY timestamp DESC
       LIMIT 1`,
      [exchange, tradingPair]
    );
    return result.rows.length > 0 ? this.mapToCamelCase(result.rows[0]) : null;
  }

  /**
   * Get prices for a trading pair from multiple exchanges
   */
  static async getPricesByPair(
    tradingPair: string,
    limit: number = 10
  ): Promise<CEXPrice[]> {
    const result = await pool.query(
      `SELECT * FROM cex_prices
       WHERE trading_pair = $1
       ORDER BY exchange, timestamp DESC
       LIMIT $2`,
      [tradingPair, limit]
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Get historical price data
   */
  static async getPriceHistory(
    exchange: string,
    tradingPair: string,
    startTime: Date,
    endTime: Date,
    limit: number = 1000
  ): Promise<CEXPrice[]> {
    const result = await pool.query(
      `SELECT * FROM cex_prices
       WHERE exchange = $1 AND trading_pair = $2
         AND timestamp BETWEEN $3 AND $4
       ORDER BY timestamp DESC
       LIMIT $5`,
      [exchange, tradingPair, startTime, endTime, limit]
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Get price comparison for a pair across all exchanges
   */
  static async getPriceComparison(
    tradingPair: string
  ): Promise<CEXPrice[]> {
    const result = await pool.query(
      `SELECT DISTINCT ON (exchange) * FROM cex_prices
       WHERE trading_pair = $1
       ORDER BY exchange, timestamp DESC`,
      [tradingPair]
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Delete old price data (older than specified days)
   */
  static async deleteOldPrices(daysOld: number = 30): Promise<number> {
    const result = await pool.query(
      `DELETE FROM cex_prices
       WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [daysOld]
    );
    return result.rowCount || 0;
  }

  /**
   * Map snake_case from database to camelCase for TypeScript
   */
  private static mapToCamelCase(row: any): CEXPrice {
    return {
      id: row.id,
      exchange: row.exchange,
      tradingPair: row.trading_pair,
      price: row.price,
      bid: row.bid,
      ask: row.ask,
      volume: row.volume,
      timestamp: new Date(row.timestamp),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
