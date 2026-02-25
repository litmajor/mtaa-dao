/**
 * Exchange Settings Repository
 * Data access layer for exchange-specific configuration settings
 */

import { db } from '../db';
import { ExchangeSetting } from '../../types/cex.types';

export class ExchangeSettingsRepository {
  /**
   * Save or update a setting
   */
  static async setSetting(
    userId: string,
    exchange: string,
    settingKey: string,
    settingValue: string,
    settingType: 'string' | 'number' | 'boolean' | 'json' = 'string'
  ): Promise<ExchangeSetting> {
    const result = await db.query(
      `INSERT INTO exchange_settings (
        user_id, exchange, setting_key, setting_value, setting_type
      ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, exchange, setting_key) DO UPDATE SET
         setting_value = $4,
         setting_type = $5,
         updated_at = NOW()
       RETURNING *`,
      [userId, exchange, settingKey, settingValue, settingType]
    );
    return this.mapToCamelCase(result.rows[0]);
  }

  /**
   * Get a specific setting
   */
  static async getSetting(
    userId: string,
    exchange: string,
    settingKey: string
  ): Promise<ExchangeSetting | null> {
    const result = await db.query(
      `SELECT * FROM exchange_settings
       WHERE user_id = $1 AND exchange = $2 AND setting_key = $3`,
      [userId, exchange, settingKey]
    );
    return result.rows.length > 0 ? this.mapToCamelCase(result.rows[0]) : null;
  }

  /**
   * Get all settings for a user/exchange combination
   */
  static async getExchangeSettings(
    userId: string,
    exchange: string
  ): Promise<ExchangeSetting[]> {
    const result = await db.query(
      `SELECT * FROM exchange_settings
       WHERE user_id = $1 AND exchange = $2
       ORDER BY setting_key`,
      [userId, exchange]
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Get all settings for a user across all exchanges
   */
  static async getUserAllSettings(userId: string): Promise<ExchangeSetting[]> {
    const result = await db.query(
      `SELECT * FROM exchange_settings
       WHERE user_id = $1
       ORDER BY exchange, setting_key`,
      [userId]
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Delete a specific setting
   */
  static async deleteSetting(
    userId: string,
    exchange: string,
    settingKey: string
  ): Promise<void> {
    await db.query(
      `DELETE FROM exchange_settings
       WHERE user_id = $1 AND exchange = $2 AND setting_key = $3`,
      [userId, exchange, settingKey]
    );
  }

  /**
   * Delete all settings for a user/exchange
   */
  static async deleteExchangeSettings(
    userId: string,
    exchange: string
  ): Promise<number> {
    const result = await db.query(
      `DELETE FROM exchange_settings
       WHERE user_id = $1 AND exchange = $2`,
      [userId, exchange]
    );
    return result.rowCount || 0;
  }

  /**
   * Get setting with type parsing
   */
  static async getSettingTyped<T>(
    userId: string,
    exchange: string,
    settingKey: string
  ): Promise<T | null> {
    const setting = await this.getSetting(userId, exchange, settingKey);
    if (!setting) return null;

    switch (setting.settingType) {
      case 'number':
        return (parseFloat(setting.settingValue) as unknown) as T;
      case 'boolean':
        return ((setting.settingValue.toLowerCase() === 'true') as unknown) as T;
      case 'json':
        return (JSON.parse(setting.settingValue) as unknown) as T;
      case 'string':
      default:
        return (setting.settingValue as unknown) as T;
    }
  }

  /**
   * Bulk set multiple settings
   */
  static async setMultiple(
    userId: string,
    exchange: string,
    settings: { key: string; value: string; type?: string }[]
  ): Promise<ExchangeSetting[]> {
    const results: ExchangeSetting[] = [];
    for (const setting of settings) {
      const result = await this.setSetting(
        userId,
        exchange,
        setting.key,
        setting.value,
        (setting.type as any) || 'string'
      );
      results.push(result);
    }
    return results;
  }

  /**
   * Get common settings schema
   * Predefined setting keys used across the system
   */
  static readonly COMMON_SETTINGS = {
    SLIPPAGE_TOLERANCE: 'slippage_tolerance', // Default 0.5%
    MIN_ORDER_AMOUNT: 'min_order_amount',
    MAX_ORDER_AMOUNT: 'max_order_amount',
    AUTO_TRADE_ENABLED: 'auto_trade_enabled',
    ARBITRAGE_MIN_PROFIT: 'arbitrage_min_profit', // Min % to execute
    PREFERRED_BASE_CURRENCY: 'preferred_base_currency', // USDT, USD, etc
    RATE_LIMIT: 'rate_limit', // Requests per minute
    WEBHOOK_URL: 'webhook_url', // For notifications
    API_KEY_SANDBOX: 'api_key_sandbox',
    NOTIFICATION_EMAIL: 'notification_email',
  };

  /**
   * Map snake_case to camelCase
   */
  private static mapToCamelCase(row: any): ExchangeSetting {
    return {
      id: row.id,
      userId: row.user_id,
      exchange: row.exchange,
      settingKey: row.setting_key,
      settingValue: row.setting_value,
      settingType: row.setting_type,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
