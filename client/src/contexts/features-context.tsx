/**
 * Features Context
 * React context for consuming feature visibility flags
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

export interface FeatureConfig {
  name: string;
  enabled: boolean;
  releaseDate: string;
  phase: number;
  description: string;
  category?: string;
  dependencies?: string[];
}

export interface FeaturesContextType {
  features: Record<string, FeatureConfig>;
  isFeatureEnabled: (featureKey: string) => boolean;
  getFeature: (featureKey: string) => FeatureConfig | undefined;
  getFeaturesByCategory: (category: string) => Record<string, FeatureConfig>;
  loading: boolean;
  error: string | null;
  refreshFeatures: () => Promise<void>;
}

const FeaturesContext = createContext<FeaturesContextType | undefined>(undefined);

/**
 * Feature Provider Component
 */
export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<Record<string, FeatureConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/features');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setFeatures(data.features || {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load features';
      setError(message);
      console.error('Error fetching features:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const isFeatureEnabled = useCallback(
    (featureKey: string): boolean => {
      return features[featureKey]?.enabled ?? false;
    },
    [features]
  );

  const getFeature = useCallback(
    (featureKey: string): FeatureConfig | undefined => {
      return features[featureKey];
    },
    [features]
  );

  const getFeaturesByCategory = useCallback(
    (category: string): Record<string, FeatureConfig> => {
      const result: Record<string, FeatureConfig> = {};
      Object.entries(features).forEach(([key, feature]) => {
        if (feature.category === category) {
          result[key] = feature;
        }
      });
      return result;
    },
    [features]
  );

  const refreshFeatures = useCallback(async () => {
    await fetchFeatures();
  }, [fetchFeatures]);

  const value: FeaturesContextType = {
    features,
    isFeatureEnabled,
    getFeature,
    getFeaturesByCategory,
    loading,
    error,
    refreshFeatures,
  };

  return (
    <FeaturesContext.Provider value={value}>
      {children}
    </FeaturesContext.Provider>
  );
}

/**
 * Hook to use features context
 */
export function useFeatures(): FeaturesContextType {
  const context = useContext(FeaturesContext);
  if (!context) {
    console.warn('useFeatures called outside FeaturesProvider, returning default context');
    // Return a safe default that won't crash the component
    return {
      features: {},
      isFeatureEnabled: () => false,
      getFeature: () => undefined,
      getFeaturesByCategory: () => ({}),
      loading: true,
      error: 'Features context not available',
      refreshFeatures: async () => {},
    };
  }
  return context;
}

/**
 * Hook to check if a specific feature is enabled
 */
export function useFeatureEnabled(featureKey: string): boolean {
  const { isFeatureEnabled } = useFeatures();
  return isFeatureEnabled(featureKey);
}

/**
 * Hook to get feature data
 */
export function useFeature(featureKey: string): FeatureConfig | undefined {
  const { getFeature } = useFeatures();
  return getFeature(featureKey);
}

/**
 * Hook to get features by category
 */
export function useFeaturesByCategory(category: string): Record<string, FeatureConfig> {
  const { getFeaturesByCategory } = useFeatures();
  return getFeaturesByCategory(category);
}

export default FeaturesProvider;
