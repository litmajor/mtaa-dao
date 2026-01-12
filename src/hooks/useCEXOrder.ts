/**
 * useCEXOrder Hook
 * 
 * Manage order lifecycle from validation through execution
 */

import { useState, useCallback, useRef } from 'react';

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'idle' | 'validating' | 'validated' | 'placing' | 'placed' | 'failed';

interface OrderData {
  exchange: string;
  symbol: string;
  side: OrderSide;
  amount: number;
  price?: number;
  type?: OrderType;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  market?: {
    symbol: string;
    base: string;
    quote: string;
    maker: number;
    taker: number;
    limits: {
      amount: [number, number];
      price: [number, number];
      cost: [number, number];
    };
  };
}

interface ExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  txHash?: string;
}

interface UseCEXOrderResult {
  status: OrderStatus;
  orderData: OrderData | null;
  validationResult: ValidationResult | null;
  executionResult: ExecutionResult | null;
  
  // Methods
  setOrderData: (data: OrderData) => void;
  validate: () => Promise<void>;
  place: () => Promise<void>;
  cancel: (orderId: string) => Promise<void>;
  reset: () => void;
  
  // Flags
  loading: boolean;
  error: string | null;
}

/**
 * Hook to manage CEX order lifecycle
 * @returns Order management state and methods
 */
export const useCEXOrder = (): UseCEXOrderResult => {
  const [status, setStatus] = useState<OrderStatus>('idle');
  const [orderData, setOrderDataState] = useState<OrderData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef({ orderData: null as OrderData | null });

  /**
   * Set order data
   */
  const setOrderData = useCallback((data: OrderData) => {
    setOrderDataState(data);
    stateRef.current.orderData = data;
    setStatus('idle');
    setValidationResult(null);
    setExecutionResult(null);
    setError(null);
  }, []);

  /**
   * Validate order before execution
   */
  const validate = useCallback(async () => {
    if (!stateRef.current.orderData) {
      setError('No order data set');
      return;
    }

    try {
      setLoading(true);
      setStatus('validating');
      setError(null);

      const data = stateRef.current.orderData;

      const response = await fetch('/api/exchanges/order/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchange: data.exchange,
          symbol: data.symbol,
          side: data.side,
          amount: data.amount,
          price: data.price,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: ValidationResult = await response.json();
      setValidationResult(result);

      if (result.valid) {
        setStatus('validated');
      } else {
        setStatus('failed');
        setError(result.errors.join(', '));
      }

      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setStatus('failed');
      setLoading(false);
      console.error('Validation error:', err);
    }
  }, []);

  /**
   * Place order after validation
   */
  const place = useCallback(async () => {
    if (!stateRef.current.orderData) {
      setError('No order data set');
      return;
    }

    if (status !== 'validated') {
      setError('Order must be validated first');
      return;
    }

    try {
      setLoading(true);
      setStatus('placing');
      setError(null);

      const data = stateRef.current.orderData;

      // Determine order type
      const orderType = data.price ? 'limit' : 'market';

      const response = await fetch('/api/exchanges/order/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          exchange: data.exchange,
          symbol: data.symbol,
          side: data.side,
          type: orderType,
          amount: data.amount,
          price: data.price,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: ExecutionResult = await response.json();
      setExecutionResult(result);

      if (result.success) {
        setStatus('placed');
      } else {
        setStatus('failed');
        setError(result.error || 'Order placement failed');
      }

      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setStatus('failed');
      setLoading(false);
      console.error('Order placement error:', err);
    }
  }, [status]);

  /**
   * Cancel an order
   */
  const cancel = useCallback(async (orderId: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = stateRef.current.orderData;
      if (!data) {
        throw new Error('No order data');
      }

      const response = await fetch(`/api/exchanges/order/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          exchange: data.exchange,
          symbol: data.symbol,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      setStatus('idle');
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setLoading(false);
      console.error('Cancel error:', err);
    }
  }, []);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setOrderDataState(null);
    setValidationResult(null);
    setExecutionResult(null);
    setLoading(false);
    setError(null);
    stateRef.current.orderData = null;
  }, []);

  return {
    status,
    orderData,
    validationResult,
    executionResult,
    setOrderData,
    validate,
    place,
    cancel,
    reset,
    loading,
    error,
  };
};

export default useCEXOrder;
