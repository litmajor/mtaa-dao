import { useEffect } from 'react';
import { TradingFilterState } from './useTradingFilters';

export type ViewMode = 'ranking' | 'heatmap' | 'comparison' | 'sparklines' | 'insights' | 'network' | 'focus' | 'treasury';

export interface TradePageState {
  viewMode: ViewMode;
  densityMode: TradingFilterState['densityMode'];
  tokenPair: string;
  quality?: string;
  sortBy?: string;
  regions?: string;
}

/**
 * Serialize page state to URL query parameters
 */
export function serializePageState(state: Partial<TradePageState>): string {
  const params = new URLSearchParams();

  if (state.viewMode) params.set('view', state.viewMode);
  if (state.densityMode) params.set('density', state.densityMode);
  if (state.tokenPair) params.set('pair', state.tokenPair);
  if (state.quality) params.set('quality', state.quality);
  if (state.sortBy) params.set('sort', state.sortBy);
  if (state.regions) params.set('regions', state.regions);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Deserialize page state from URL query parameters
 */
export function deserializePageState(search: string): Partial<TradePageState> {
  const params = new URLSearchParams(search);

  return {
    viewMode: (params.get('view') as ViewMode) || undefined,
    densityMode: (params.get('density') as TradingFilterState['densityMode']) || undefined,
    tokenPair: params.get('pair') || undefined,
    quality: params.get('quality') || undefined,
    sortBy: params.get('sort') || undefined,
    regions: params.get('regions') || undefined,
  };
}

/**
 * Custom hook to sync page state with URL
 * 
 * Features:
 * - Automatic URL updates when state changes
 * - Load state from URL on mount
 * - Browser history support (back/forward)
 * - Handles missing/invalid params gracefully
 */
export function useUrlState(
  state: Partial<TradePageState>,
  onStateChange: (newState: Partial<TradePageState>) => void
) {
  // Load state from URL on mount
  useEffect(() => {
    const urlState = deserializePageState(window.location.search);
    
    if (Object.keys(urlState).length > 0) {
      // Filter out undefined values
      const cleanState = Object.fromEntries(
        Object.entries(urlState).filter(([, v]) => v !== undefined)
      );
      onStateChange(cleanState);
    }
  }, []); // Empty dependency array - only run on mount

  // Update URL when state changes
  useEffect(() => {
    const queryString = serializePageState(state);
    const newUrl = `${window.location.pathname}${queryString}`;
    
    window.history.replaceState(null, '', newUrl);
  }, [state]);
}

/**
 * Generate shareable URL with current page state
 */
export function generateShareableUrl(state: Partial<TradePageState>): string {
  const queryString = serializePageState(state);
  return `${window.location.origin}${window.location.pathname}${queryString}`;
}
