import { useState, useCallback, useEffect } from 'react';

export interface TradingFilterState {
  exchangeType: 'all' | 'cex' | 'dex';
  regions: string[];
  quality: 'all' | 'premium' | 'established' | 'growing';
  features: string[];
  sortBy: 'price' | 'volume' | 'liquidity' | 'fees' | 'spread' | 'uptime';
  priceRange: number;
  searchQuery: string;
  densityMode: 'focus' | 'analyst' | 'network' | 'treasuryMode' | 'mobile' | 'whale';
}

const DEFAULT_FILTERS: TradingFilterState = {
  exchangeType: 'all',
  regions: [],
  quality: 'all',
  features: [],
  sortBy: 'price',
  priceRange: 5,
  searchQuery: '',
  densityMode: 'analyst',
};

const STORAGE_KEY = 'trading_filters';
const PRESETS_STORAGE_KEY = 'trading_presets';

export interface FilterPreset {
  name: string;
  description?: string;
  filters: Omit<TradingFilterState, 'densityMode'>;
  createdAt: number;
}

/**
 * Custom hook for managing trading filter state
 * 
 * Features:
 * - Local storage persistence
 * - URL state sync (future)
 * - Saved presets with CRUD operations
 * - Profile sync (future)
 */
export function useTradingFilters(initialMode?: TradingFilterState['densityMode']) {
  const [filters, setFilters] = useState<TradingFilterState>(() => {
    // Try to load from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_FILTERS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load trading filters from storage:', e);
    }
    
    return {
      ...DEFAULT_FILTERS,
      densityMode: initialMode || 'analyst',
    };
  });

  // Persist to localStorage whenever filters change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.warn('Failed to save trading filters:', e);
    }
  }, [filters]);

  const updateFilters = useCallback((updates: Partial<TradingFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const setDensityMode = useCallback((mode: TradingFilterState['densityMode']) => {
    setFilters((prev) => ({ ...prev, densityMode: mode }));
  }, []);

  // Preset management
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to load presets:', e);
      return [];
    }
  });

  const savePreset = useCallback(
    (name: string, description?: string) => {
      const newPreset: FilterPreset = {
        name,
        description,
        filters: {
          exchangeType: filters.exchangeType,
          regions: filters.regions,
          quality: filters.quality,
          features: filters.features,
          sortBy: filters.sortBy,
          priceRange: filters.priceRange,
          searchQuery: filters.searchQuery,
        },
        createdAt: Date.now(),
      };

      setPresets((prev) => {
        const updated = [...prev.filter((p) => p.name !== name), newPreset];
        try {
          localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save preset:', e);
        }
        return updated;
      });
    },
    [filters]
  );

  const loadPreset = useCallback((presetName: string) => {
    const preset = presets.find((p) => p.name === presetName);
    if (preset) {
      setFilters((prev) => ({
        ...prev,
        ...preset.filters,
      }));
    }
  }, [presets]);

  const deletePreset = useCallback((presetName: string) => {
    setPresets((prev) => {
      const updated = prev.filter((p) => p.name !== presetName);
      try {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to delete preset:', e);
      }
      return updated;
    });
  }, []);

  return {
    filters,
    updateFilters,
    resetFilters,
    setDensityMode,
    presets,
    savePreset,
    loadPreset,
    deletePreset,
  };
}
