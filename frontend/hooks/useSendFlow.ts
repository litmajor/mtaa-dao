import { useState, useCallback } from 'react';

interface SendTransactionData {
  amount: number;
  recipientAddress: string;
  recipientName: string;
}

interface SendFlowState {
  step: 'amount' | 'preview' | 'confirm' | 'sending' | 'success' | 'error';
  data?: SendTransactionData;
  error?: string;
  estimatedFee?: number;
  estimatedTime?: string;
  transactionId?: string;
}

export const useSendFlow = () => {
  const [state, setState] = useState<SendFlowState>({ step: 'amount' });

  const estimateFee = useCallback(async (amount: number) => {
    try {
      // In production, call API
      // const response = await fetch(`/api/transactions/estimate-fee?amount=${amount}`);
      // const data = await response.json();
      // return data.fee;
      
      // Mock for now
      return Math.ceil(amount * 0.002); // 0.2% fee
    } catch (error) {
      console.error('Error estimating fee:', error);
      return 2;
    }
  }, []);

  const estimateTime = useCallback(async () => {
    // In production, call API
    return '30 seconds';
  }, []);

  const submitTransaction = useCallback(async (data: SendTransactionData) => {
    setState((prev) => ({ ...prev, step: 'sending' }));
    try {
      const fee = await estimateFee(data.amount);
      
      // In production, call API
      // const response = await fetch('/api/transactions/send', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ ...data, fee })
      // });
      // const result = await response.json();
      
      // Mock for now - simulate success after 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setState((prev) => ({
        ...prev,
        step: 'success',
        transactionId: `tx_${Date.now()}`
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: (error as Error).message
      }));
    }
  }, [estimateFee]);

  const goToPreview = useCallback((data: SendTransactionData) => {
    setState((prev) => ({
      ...prev,
      step: 'preview',
      data
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 'amount',
      data: undefined,
      error: undefined
    }));
  }, []);

  const reset = useCallback(() => {
    setState({ step: 'amount' });
  }, []);

  return {
    ...state,
    estimateFee,
    estimateTime,
    submitTransaction,
    goToPreview,
    goBack,
    reset
  };
};
