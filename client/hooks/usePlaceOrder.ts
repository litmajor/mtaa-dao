/**
 * usePlaceOrder Hook
 * Order placement and execution with validation for all order types
 * Supports market, limit, stop-loss, take-profit, and OCO orders
 */

'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

interface PlaceOrderRequest {
  pair: string;
  side: 'BUY' | 'SELL';
  market: 'spot' | 'margin' | 'futures' | 'swap';
  type: 'market' | 'limit' | 'stop-loss' | 'take-profit' | 'oco';
  quantity: number;
  price?: number;
  stopPrice?: number;
  leverage?: number;
  exchange?: string;
  smartRoute?: boolean;
}

interface OrderValidation {
  valid: boolean;
  errors: string[];
}

interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

interface OrderImpact {
  fee: number;
  slippage: number;
  total: number;
  savingsBySmartRoute?: number;
}

export function usePlaceOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeOrder = useCallback(
    async (orderData: PlaceOrderRequest): Promise<OrderResult> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/orders', {
          ...orderData,
          timestamp: new Date().toISOString(),
        });

        if (response.success) {
          return {
            success: true,
            orderId: response.data?.id,
          };
        } else {
          const errorMsg = response.error || 'Failed to place order';
          setError(errorMsg);
          return {
            success: false,
            error: errorMsg,
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err) || 'Error placing order';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { placeOrder, loading, error };
}

/**
 * Market Order Hook
 * Place immediate market orders at current market price
 */
export function useMarketOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeMarketOrder = useCallback(
    async (
      pair: string,
      side: 'BUY' | 'SELL',
      quantity: number,
      exchange?: string,
      market: 'spot' | 'margin' | 'futures' | 'swap' = 'spot',
      leverage?: number
    ): Promise<OrderResult> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/orders/market', {
          pair,
          side,
          quantity,
          market,
          exchange,
          leverage: leverage || 1,
          timestamp: new Date().toISOString(),
        });

        if (response.success) {
          return {
            success: true,
            orderId: response.data?.id,
          };
        } else {
          const errorMsg = response.error || 'Failed to place market order';
          setError(errorMsg);
          return {
            success: false,
            error: errorMsg,
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err) || 'Error placing market order';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { placeMarketOrder, loading, error };
}

/**
 * Limit Order Hook
 * Place limit orders at specific price levels
 */
export function useLimitOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeLimitOrder = useCallback(
    async (
      pair: string,
      side: 'BUY' | 'SELL',
      quantity: number,
      price: number,
      exchange?: string,
      market: 'spot' | 'margin' | 'futures' | 'swap' = 'spot',
      leverage?: number,
      timeInForce: 'GTC' | 'IOC' | 'FOK' = 'GTC'
    ): Promise<OrderResult> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/orders/limit', {
          pair,
          side,
          quantity,
          price,
          market,
          exchange,
          leverage: leverage || 1,
          timeInForce,
          timestamp: new Date().toISOString(),
        });

        if (response.success) {
          return {
            success: true,
            orderId: response.data?.id,
          };
        } else {
          const errorMsg = response.error || 'Failed to place limit order';
          setError(errorMsg);
          return {
            success: false,
            error: errorMsg,
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err) || 'Error placing limit order';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { placeLimitOrder, loading, error };
}

/**
 * Stop Loss Order Hook
 * Place stop-loss orders to limit losses
 */
export function useStopLossOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeStopLossOrder = useCallback(
    async (
      pair: string,
      side: 'BUY' | 'SELL',
      quantity: number,
      stopPrice: number,
      limitPrice?: number,
      exchange?: string,
      market: 'spot' | 'margin' | 'futures' | 'swap' = 'spot',
      leverage?: number
    ): Promise<OrderResult> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/orders/stop-loss', {
          pair,
          side,
          quantity,
          stopPrice,
          limitPrice: limitPrice || stopPrice,
          market,
          exchange,
          leverage: leverage || 1,
          timestamp: new Date().toISOString(),
        });

        if (response.success) {
          return {
            success: true,
            orderId: response.data?.id,
          };
        } else {
          const errorMsg = response.error || 'Failed to place stop-loss order';
          setError(errorMsg);
          return {
            success: false,
            error: errorMsg,
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err) || 'Error placing stop-loss order';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { placeStopLossOrder, loading, error };
}

/**
 * Take Profit Order Hook
 * Place take-profit orders to lock in gains
 */
export function useTakeProfitOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeTakeProfitOrder = useCallback(
    async (
      pair: string,
      side: 'BUY' | 'SELL',
      quantity: number,
      targetPrice: number,
      limitPrice?: number,
      exchange?: string,
      market: 'spot' | 'margin' | 'futures' | 'swap' = 'spot',
      leverage?: number
    ): Promise<OrderResult> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/orders/take-profit', {
          pair,
          side,
          quantity,
          targetPrice,
          limitPrice: limitPrice || targetPrice,
          market,
          exchange,
          leverage: leverage || 1,
          timestamp: new Date().toISOString(),
        });

        if (response.success) {
          return {
            success: true,
            orderId: response.data?.id,
          };
        } else {
          const errorMsg = response.error || 'Failed to place take-profit order';
          setError(errorMsg);
          return {
            success: false,
            error: errorMsg,
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err) || 'Error placing take-profit order';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { placeTakeProfitOrder, loading, error };
}

/**
 * OCO (One-Cancels-Other) Order Hook
 * Place simultaneous stop-loss and take-profit orders
 */
export function useOCOOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeOCOOrder = useCallback(
    async (
      pair: string,
      side: 'BUY' | 'SELL',
      quantity: number,
      entryPrice: number,
      stopLossPrice: number,
      takeProfitPrice: number,
      exchange?: string,
      market: 'spot' | 'margin' | 'futures' | 'swap' = 'spot',
      leverage?: number
    ): Promise<OrderResult> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/orders/oco', {
          pair,
          side,
          quantity,
          entryPrice,
          stopLossPrice,
          takeProfitPrice,
          market,
          exchange,
          leverage: leverage || 1,
          timestamp: new Date().toISOString(),
        });

        if (response.success) {
          return {
            success: true,
            orderId: response.data?.id,
          };
        } else {
          const errorMsg = response.error || 'Failed to place OCO order';
          setError(errorMsg);
          return {
            success: false,
            error: errorMsg,
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err) || 'Error placing OCO order';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { placeOCOOrder, loading, error };
}

/**
 * Validate Order Hook
 * Validate order data before submission
 */
export function useValidateOrder() {
  const validateOrder = useCallback((order: PlaceOrderRequest): OrderValidation => {
    const errors: string[] = [];

    // Basic validation
    if (!order.pair || !order.pair.includes('/')) {
      errors.push('Invalid trading pair');
    }
    if (!order.side || !['BUY', 'SELL'].includes(order.side)) {
      errors.push('Invalid order side');
    }
    if (order.quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    // Type-specific validation
    if (order.type === 'limit' && (!order.price || order.price <= 0)) {
      errors.push('Limit price is required and must be greater than 0');
    }
    if ((order.type === 'stop-loss' || order.type === 'take-profit') && (!order.stopPrice || order.stopPrice <= 0)) {
      errors.push('Stop price is required and must be greater than 0');
    }

    // Leverage validation
    if (order.leverage) {
      const maxLeverage = order.market === 'margin' ? 10 : order.market === 'futures' ? 125 : order.market === 'swap' ? 125 : 1;
      if (order.leverage < 1 || order.leverage > maxLeverage) {
        errors.push(`Leverage must be between 1 and ${maxLeverage}x for ${order.market}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }, []);

  return { validateOrder };
}

/**
 * Calculate Order Impact Hook
 * Calculate fees, slippage, and total cost
 */
export function useCalculateOrderImpact() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateImpact = useCallback(
    async (
      pair: string,
      quantity: number,
      side: 'BUY' | 'SELL',
      exchange?: string,
      market: 'spot' | 'margin' | 'futures' | 'swap' = 'spot'
    ): Promise<OrderImpact | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/calculate-impact', {
          pair,
          quantity,
          side,
          exchange,
          market,
        });

        if (response.success) {
          return response.data as OrderImpact;
        } else {
          const errorMsg = response.error || 'Failed to calculate impact';
          setError(errorMsg);
          return null;
        }
      } catch (err: any) {
        const errorMsg = err.message || 'Error calculating impact';
        setError(errorMsg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { calculateImpact, loading, error };
}

/**
 * Multi-Exchange Order Hook
 * Place simultaneous orders on multiple exchanges
 */
export function useMultiExchangeOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeMultiExchangeOrder = useCallback(
    async (
      orders: Array<{
        exchange: string;
        pair: string;
        side: 'BUY' | 'SELL';
        quantity: number;
        price?: number;
        type: 'market' | 'limit';
      }>
    ): Promise<{ success: boolean; orderIds?: string[]; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/orders/multi-exchange', {
          orders,
          timestamp: new Date().toISOString(),
        });

        if (response.success) {
          return {
            success: true,
            orderIds: response.data?.orderIds,
          };
        } else {
          const errorMsg = response.error || 'Failed to place multi-exchange orders';
          setError(errorMsg);
          return {
            success: false,
            error: errorMsg,
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err) || 'Error placing multi-exchange orders';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { placeMultiExchangeOrder, loading, error };
}
