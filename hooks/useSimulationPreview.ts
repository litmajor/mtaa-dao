/**
 * useSimulationPreview.ts
 * 
 * Custom React hook for simulator API integration
 * Handles simulation execution, result management, and modal state
 * Reusable across all components (Trading, Treasury, Governance, Agent)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { SimulationResult } from '../server/services/simulationFramework';

interface UseSimulationPreviewOptions {
  /** Auto-close modal after successful action */
  autoClose?: boolean;

  /** Auto-close delay in milliseconds */
  autoCloseDelay?: number;

  /** Error callback handler */
  onError?: (error: Error | string) => void;

  /** Success callback handler */
  onSuccess?: (result: SimulationResult) => void;
}

interface UseSimulationPreviewReturn {
  // State
  simulationResult: SimulationResult | null;
  isLoading: boolean;
  isModalOpen: boolean;
  error: string | null;

  // Actions
  runSimulation: (simulatorType: string, params: Record<string, any>, userId: string) => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  resetState: () => void;
}

/**
 * Hook for running simulations and managing modal state
 * 
 * Usage:
 * const { simulationResult, isLoading, isModalOpen, runSimulation, closeModal } = useSimulationPreview();
 * 
 * // Call simulator
 * await runSimulation('SPOT_TRADE', { side: 'BUY', ... }, userId);
 * 
 * // Show modal
 * <SimulationResultModal
 *   result={simulationResult}
 *   isOpen={isModalOpen}
 *   onClose={closeModal}
 * />
 */
export function useSimulationPreview(
  options: UseSimulationPreviewOptions = {}
): UseSimulationPreviewReturn {
  const { autoClose = false, autoCloseDelay = 3000, onError, onSuccess } = options;

  // State
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Open modal
  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    setSimulationResult(null);
    setError(null);
    setIsLoading(false);
    setIsModalOpen(false);
    // Clear any pending timeout and abort pending requests
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current as number);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Run simulation
  const runSimulation = useCallback(
    async (simulatorType: string, params: Record<string, any>, userId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // Validate inputs
        if (!simulatorType || !params) {
          throw new Error('simulatorType and params are required');
        }

        // Abort any prior in-flight request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Call API
        const response = await fetch('/api/simulate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            simulatorType,
            params,
            userId, // For audit trail
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Simulation failed');
        }

        // Update state
        setSimulationResult(data.result);
        setIsModalOpen(true);

        // Call success callback
        onSuccess?.(data.result);

        // Auto-close if enabled
        if (autoClose) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current as number);
          }
          timeoutRef.current = window.setTimeout(() => {
            closeModal();
            timeoutRef.current = null;
          }, autoCloseDelay);
        }
      } catch (err) {
        // Handle aborts gracefully
        const isAbort = (err as any)?.name === 'AbortError';
        const errorMessage = isAbort ? 'Request aborted' : (err instanceof Error ? err.message : String(err));
        setError(errorMessage);

        // Call error callback
        onError?.(err instanceof Error ? err : new Error(errorMessage));

        if (!isAbort) console.error('Simulation failed:', errorMessage);
      } finally {
        setIsLoading(false);
        // clear abort controller if request finished
        if (abortControllerRef.current) {
          abortControllerRef.current = null;
        }
      }
    },
    [autoClose, autoCloseDelay, onError, onSuccess, closeModal]
  );

  // Cleanup on unmount: abort pending requests and clear timeouts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current as number);
        timeoutRef.current = null;
      }
    };
  }, []);

  return {
    simulationResult,
    isLoading,
    isModalOpen,
    error,
    runSimulation,
    openModal,
    closeModal,
    resetState,
  };
}

export default useSimulationPreview;
