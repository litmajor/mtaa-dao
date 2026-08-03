import { pool } from '../db';
import { priceOracle } from './priceOracle';
import { logger } from '../utils/logger';

/**
 * Minimal shared account balance service.
 *
 * NOTE: this mirrors logic previously inline in v1/yuki/exchanges.ts route
 * handlers. It's intentionally conservative: it returns `undefined` when it
 * cannot compute balances reliably rather than fabricating data.
 */
export async function getAccountBalancesForUserExchange(userId: string, exchangeAccountId: string) {
  try {
    const result = await pool.query(
      `SELECT id, user_id, exchange FROM cex_credentials WHERE id = $1 AND user_id = $2`,
      [exchangeAccountId, userId]
    );
    if (result.rows.length === 0) return undefined;

    const exchange = result.rows[0].exchange?.toLowerCase();

    // CCXT call is still the source of truth; defer to ccxtService if present.
    const ccxtServiceModule = await import('./ccxtService').catch(() => null);
    if (!ccxtServiceModule || !ccxtServiceModule.ccxtService) {
      return { unavailableReason: 'CCXT service not initialized' };
    }

    const ccxtService = ccxtServiceModule.ccxtService;
    const balances = await ccxtService.getBalances(exchange);
    if (!balances) return { unavailableReason: 'No balances returned from exchange adapter' };

    // Aggregate total value in USD using price oracle
    const symbols = Object.keys(balances).map(s => s.toUpperCase());
    const prices = await priceOracle.getPrices(symbols).catch(() => new Map());

    const holdings = Object.entries(balances).map(([sym, data]: any) => {
      const total = data.total ?? 0;
      const pd = prices.get(sym.toUpperCase());
      const price = pd?.priceUsd ?? null;
      const value = price ? total * price : 0;
      return { symbol: sym, amount: total, value, valueReliable: !!price };
    }).filter(h => h.amount > 0);

    const totalValue = holdings.reduce((s, h) => s + (h.value || 0), 0);

    return {
      exchange,
      holdings,
      totalValue,
    };
  } catch (err) {
    logger.warn('[accountBalanceService] Failed to compute balances', { error: err });
    return { unavailableReason: (err as Error).message || 'Failed to compute balances' };
  }
}
