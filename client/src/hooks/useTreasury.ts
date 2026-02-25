/**
 * useTreasury Hook
 * React hook for managing treasury state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import {
  DAOTreasury,
  DAOType,
  TreasuryAsset,
  ChainType,
  TreasuryValidationResponse
} from '@/types/treasury';
import {
  createDefaultTreasury,
  validateTreasuryConfiguration,
  addCustomTokenToTreasury,
  removeAssetFromTreasury,
  addChainSupportToTreasury,
  getTreasurySummary
} from '@/utils/treasury.service';

interface UseTreasuryReturn {
  treasury: DAOTreasury | null;
  isLoading: boolean;
  error: string | null;
  
  // Initialization
  initializeTreasury: (daoId: string, daoType: DAOType, customAssets?: TreasuryAsset[]) => void;
  
  // Asset Management
  addAsset: (asset: TreasuryAsset) => void;
  removeAsset: (symbol: string, chain: ChainType) => void;
  updateAssetBalance: (symbol: string, chain: ChainType, newBalance: string) => void;
  
  // Chain Management
  addChainSupport: (chain: ChainType) => void;
  
  // Validation & Info
  validate: () => TreasuryValidationResponse | null;
  getSummary: () => ReturnType<typeof getTreasurySummary> | null;
  
  // State setters
  setTreasury: (treasury: DAOTreasury | null) => void;
  setError: (error: string | null) => void;
}

/**
 * Hook for managing DAO treasury
 */
export const useTreasury = (): UseTreasuryReturn => {
  const [treasury, setTreasury] = useState<DAOTreasury | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize treasury for a new DAO
  const initializeTreasury = useCallback(
    (daoId: string, daoType: DAOType, customAssets?: TreasuryAsset[]) => {
      try {
        setIsLoading(true);
        setError(null);
        const newTreasury = createDefaultTreasury(daoId, daoType, customAssets);
        setTreasury(newTreasury);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize treasury';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Add a custom asset
  const addAsset = useCallback(
    (asset: TreasuryAsset) => {
      if (!treasury) {
        setError('Treasury not initialized');
        return;
      }

      try {
        const result = addCustomTokenToTreasury(treasury, asset);
        if (result.success && result.updatedTreasury) {
          setTreasury(result.updatedTreasury);
          setError(null);
        } else {
          setError(result.message);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add asset';
        setError(errorMessage);
      }
    },
    [treasury]
  );

  // Remove an asset
  const removeAsset = useCallback(
    (symbol: string, chain: ChainType) => {
      if (!treasury) {
        setError('Treasury not initialized');
        return;
      }

      try {
        const result = removeAssetFromTreasury(treasury, symbol, chain);
        if (result.success && result.updatedTreasury) {
          setTreasury(result.updatedTreasury);
          setError(null);
        } else {
          setError(result.message);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to remove asset';
        setError(errorMessage);
      }
    },
    [treasury]
  );

  // Update asset balance
  const updateAssetBalance = useCallback(
    (symbol: string, chain: ChainType, newBalance: string) => {
      if (!treasury) {
        setError('Treasury not initialized');
        return;
      }

      try {
        const updatedAssets = treasury.assets.map(asset =>
          asset.symbol === symbol && asset.chain === chain
            ? { ...asset, balance: newBalance }
            : asset
        );

        setTreasury({
          ...treasury,
          assets: updatedAssets,
          lastUpdated: new Date().toISOString()
        });
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update balance';
        setError(errorMessage);
      }
    },
    [treasury]
  );

  // Add chain support
  const addChainSupport = useCallback(
    (chain: ChainType) => {
      if (!treasury) {
        setError('Treasury not initialized');
        return;
      }

      try {
        const result = addChainSupportToTreasury(treasury, chain);
        if (result.success && result.updatedTreasury) {
          setTreasury(result.updatedTreasury);
          setError(null);
        } else {
          setError(result.message);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add chain support';
        setError(errorMessage);
      }
    },
    [treasury]
  );

  // Validate treasury configuration
  const validate = useCallback((): TreasuryValidationResponse | null => {
    if (!treasury) {
      setError('Treasury not initialized');
      return null;
    }

    try {
      const response = validateTreasuryConfiguration({
        daoType: treasury.daoType,
        selectedAssets: treasury.assets.filter(a => a.isActive),
        multisigEnabled: treasury.multisigRequired,
        multisigSigners: [], // This would come from the multisig setup
        multisigRequiredSignatures: treasury.minSigners
      });

      if (!response.isValid || response.errors.length > 0) {
        setError(response.errors.join('; '));
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Validation failed';
      setError(errorMessage);
      return null;
    }
  }, [treasury]);

  // Get treasury summary
  const getSummary = useCallback((): ReturnType<typeof getTreasurySummary> | null => {
    if (!treasury) return null;
    return getTreasurySummary(treasury);
  }, [treasury]);

  return {
    treasury,
    isLoading,
    error,
    initializeTreasury,
    addAsset,
    removeAsset,
    updateAssetBalance,
    addChainSupport,
    validate,
    getSummary,
    setTreasury,
    setError
  };
};
