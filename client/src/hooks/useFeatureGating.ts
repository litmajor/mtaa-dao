import { useQuery } from '@tanstack/react-query';

export interface GatingStatus {
  isAvailable: boolean;
  reason?: string;
  daysUntilAvailable?: number;
  amountNeeded?: number;
  currency?: string; // User's preferred currency for display
}

/**
 * useFeatureGating
 * Check if a specific feature is available for the current user
 * Takes into account gating rules (age, balance, reputation, manual opt-in)
 *
 * @param featureKey - The feature key to check (e.g., 'trading.dex', 'vault.yield')
 * @returns Gating status with availability and reason
 *
 * @example
 * const { isAvailable, reason, getMessage } = useFeatureGating('trading.dex');
 * if (!isAvailable) return <div>{getMessage()}</div>;
 */
export function useFeatureGating(featureKey: string) {
  const { data, isLoading, error } = useQuery<Record<string, GatingStatus>>({
    queryKey: ['gating-status'],
    queryFn: async () => {
      const res = await fetch('/api/features/gating-status');
      if (!res.ok) {
        throw new Error('Failed to fetch gating status');
      }
      const json = await res.json();
      return json.status;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const status = data?.[featureKey] || { isAvailable: true };

  return {
    isAvailable: status.isAvailable,
    reason: status.reason,
    daysUntilAvailable: status.daysUntilAvailable,
    amountNeeded: status.amountNeeded,
    isLoading,
    error: error ? (error as Error).message : null,

    /**
     * Helper function to format unlock message for UI
     */
    getMessage(): string {
      if (status.isAvailable) return '';
      
      if (status.daysUntilAvailable) {
        const days = status.daysUntilAvailable;
        return `Available in ${days} day${days > 1 ? 's' : ''}`;
      }
      
      if (status.amountNeeded) {
        const currency = status.currency || 'KES';
        return `Deposit ${(status.amountNeeded).toLocaleString()} ${currency} more to unlock`;
      }
      
      return status.reason || 'Not available yet';
    },

    /**
     * Helper to get icon for the gating type
     */
    getIcon(): string {
      if (status.isAvailable) return '✅';
      if (status.daysUntilAvailable) return '⏱️';
      if (status.amountNeeded) return '💰';
      return '🔒';
    },
  };
}
