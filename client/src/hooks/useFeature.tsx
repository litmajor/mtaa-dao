/**
 * useFeature — Frontend feature access hook + components
 * src/hooks/useFeature.tsx
 *
 * Provides:
 *   useFeature(featureId)           — single feature state
 *   useFeatures([...ids])           — batch check
 *   useFeatureManifest()            — full manifest + persona context
 *   <FeatureProvider />             — context root, accepts pre-loaded manifest
 *   <FeatureGate feature="...">     — renders children / locked state / nothing
 *   <LockedFeatureCard />           — default locked UI
 *
 * Integration:
 *   The manifest can be pre-loaded from the dashboard API response (zero extra
 *   fetch) or fetched lazily from GET /api/v1/features/manifest.
 *
 *   // Option A — pre-loaded (recommended, zero latency):
 *   const { data } = useOkediDashboard();
 *   <FeatureProvider initialManifest={data.featureManifest}>
 *
 *   // Option B — lazy fetch:
 *   <FeatureProvider manifestUrl="/api/v1/features/manifest">
 *
 * Usage:
 *   const { accessible, presentation, unlock } = useFeature('treasury.multisig');
 *
 *   <FeatureGate feature="treasury.multisig">
 *     <MultisigSettings />
 *   </FeatureGate>
 *
 *   <FeatureGate feature="bridge.swap" locked={<CustomCTA />} hidden={null}>
 *     <BridgePanel />
 *   </FeatureGate>
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  memo,
} from 'react';
import {
  FEATURES,
  buildFeatureManifest,
  type Persona,
  type PresentationMode,
} from '../../../shared/config/features';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface FeatureState {
  accessible: boolean;
  presentation: PresentationMode;
  reason?: string;
  unlock?: {
    action: string;
    label: string;
    href?: string;
  };
}

export interface FeatureManifest {
  persona: Persona;
  advancedMode: boolean;
  features: Record<string, FeatureState>;
}

interface FeatureContextValue {
  manifest: FeatureManifest | null;
  loading: boolean;
  persona: Persona;
  advancedMode: boolean;
  /** Force a manifest refresh — call after toggling advanced mode */
  refresh: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const FeatureContext = createContext<FeatureContextValue>({
  manifest: null,
  loading: true,
  persona: 'okedi',
  advancedMode: false,
  refresh: async () => {},
});

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureProviderProps {
  children: ReactNode;
  /**
   * Pre-loaded manifest (from dashboard API response).
   * If provided, no fetch occurs. Update this prop after dashboard refresh.
   */
  initialManifest?: FeatureManifest;
  /**
   * Endpoint to fetch the manifest.
   * Only used if initialManifest is not provided.
   * Default: /api/v1/features/manifest
   */
  manifestUrl?: string;
  /** Fallback persona used during loading */
  defaultPersona?: Persona;
}

export function FeatureProvider({
  children,
  initialManifest,
  manifestUrl = '/api/v1/features/manifest',
  defaultPersona = 'okedi',
}: FeatureProviderProps) {
  const [manifest, setManifest] = useState<FeatureManifest | null>(
    initialManifest ?? null,
  );
  const [loading, setLoading] = useState(!initialManifest);

  const fetchManifest = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(manifestUrl, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Manifest ${res.status}`);
      const data: FeatureManifest = await res.json();
      setManifest(data);
    } catch (err) {
      console.warn('[FeatureProvider] Manifest fetch failed, using safe defaults', err);
      // Graceful degradation: non-blocking. Build a basic manifest client-side.
      // This means the user still sees the UI — just without advanced features.
      setManifest(buildFeatureManifest(defaultPersona, false) as FeatureManifest);
    } finally {
      setLoading(false);
    }
  }, [manifestUrl, defaultPersona]);

  // Initial load if no pre-loaded manifest
  useEffect(() => {
    if (!initialManifest) {
      fetchManifest();
    }
  }, []);

  // Sync when initialManifest updates (e.g., dashboard reload)
  useEffect(() => {
    if (initialManifest) {
      setManifest(initialManifest);
      setLoading(false);
    }
  }, [initialManifest]);

  return (
    <FeatureContext.Provider
      value={{
        manifest,
        loading,
        persona: manifest?.persona ?? defaultPersona,
        advancedMode: manifest?.advancedMode ?? false,
        refresh: fetchManifest,
      }}
    >
      {children}
    </FeatureContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useFeature — check a single feature.
 *
 * @example
 * const { accessible, presentation, unlock } = useFeature('treasury.multisig');
 *
 * if (presentation === 'locked') return <LockedFeatureCard unlock={unlock} />;
 * if (!accessible) return null;
 * return <MultisigSetup />;
 */
export function useFeature(featureId: string): FeatureState {
  const { manifest, loading } = useContext(FeatureContext);

  if (loading || !manifest) {
    return { accessible: false, presentation: 'hidden', reason: 'loading' };
  }

  const state = manifest.features[featureId];
  if (!state) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[useFeature] Unknown feature: "${featureId}"`);
    }
    return { accessible: false, presentation: 'hidden', reason: 'unknown_feature' };
  }

  return state;
}

/**
 * useFeatures — check multiple features in one call.
 *
 * @example
 * const features = useFeatures(['treasury.multisig', 'bridge.swap', 'staking']);
 * if (features['staking'].accessible) { ... }
 */
export function useFeatures(featureIds: string[]): Record<string, FeatureState> {
  const { manifest, loading } = useContext(FeatureContext);

  if (loading || !manifest) {
    return Object.fromEntries(
      featureIds.map((id) => [
        id,
        { accessible: false, presentation: 'hidden' as PresentationMode, reason: 'loading' },
      ]),
    );
  }

  return Object.fromEntries(
    featureIds.map((id) => [
      id,
      manifest.features[id] ?? {
        accessible: false,
        presentation: 'hidden' as PresentationMode,
        reason: 'unknown_feature',
      },
    ]),
  );
}

/**
 * useFeatureManifest — access the full manifest + persona context.
 * Useful for building dynamic nav, admin panels, or feature lists.
 *
 * @example
 * const { persona, advancedMode, manifest, refresh } = useFeatureManifest();
 */
export function useFeatureManifest(): FeatureContextValue {
  return useContext(FeatureContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE GATE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureGateProps {
  /** Feature ID from shared/config/features.ts FEATURES registry */
  feature: string;
  /** Content to render when feature is accessible */
  children: ReactNode;
  /**
   * What to render when feature is 'locked'.
   * Defaults to <LockedFeatureCard /> with registry label/description/unlock.
   * Pass null to render nothing when locked.
   */
  locked?: ReactNode | null;
  /**
   * What to render when feature is 'hidden' (not relevant for this persona).
   * Defaults to null — hidden means don't render at all.
   */
  hidden?: ReactNode | null;
  /** What to render while manifest is loading. Defaults to null. */
  loading?: ReactNode | null;
}

export const FeatureGate = memo(function FeatureGate({
  feature,
  children,
  locked,
  hidden = null,
  loading: loadingNode = null,
}: FeatureGateProps) {
  const { loading } = useContext(FeatureContext);
  const state = useFeature(feature);

  if (loading) return <>{loadingNode}</>;

  if (state.presentation === 'hidden') return <>{hidden}</>;

  if (state.presentation === 'locked' || !state.accessible) {
    if (locked !== undefined) return <>{locked}</>;

    const featureDef = FEATURES[feature];
    return (
      <LockedFeatureCard
        label={featureDef?.label ?? feature}
        description={featureDef?.description}
        unlock={state.unlock}
        reason={state.reason}
      />
    );
  }

  return <>{children}</>;
});

// ─────────────────────────────────────────────────────────────────────────────
// LOCKED FEATURE CARD
// ─────────────────────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  advanced_mode_required: 'Requires Advanced Mode',
  not_available_for_persona: 'Not available in this view',
  complete_kyc: 'Identity verification required',
  feature_disabled: 'Coming soon',
  loading: 'Loading...',
};

interface LockedFeatureCardProps {
  label: string;
  description?: string;
  unlock?: FeatureState['unlock'];
  reason?: string;
  /** Inline compact version — for use inside lists or nav items */
  compact?: boolean;
}

export function LockedFeatureCard({
  label,
  description,
  unlock,
  reason,
  compact = false,
}: LockedFeatureCardProps) {
  const handleUnlock = useCallback(() => {
    if (!unlock?.href) return;
    if (unlock.href.startsWith('/api')) {
      // API action — e.g., enable advanced mode
      fetch(unlock.href, { method: 'POST', credentials: 'include' })
        .then(() => window.location.reload())
        .catch(console.error);
    } else {
      window.location.href = unlock.href;
    }
  }, [unlock]);

  if (compact) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-500 text-sm flex-shrink-0">🔒</span>
          <span className="text-sm text-slate-400 truncate">{label}</span>
        </div>
        {unlock && (
          <button
            onClick={handleUnlock}
            className="ml-2 flex-shrink-0 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            {unlock.label} →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      {/* Subtle blur hint — suggests content beneath is real */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] rounded-xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center gap-3 p-6 py-7">
        {/* Lock icon */}
        <div className="w-11 h-11 rounded-full bg-slate-700/50 border border-slate-600/40 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Label + description */}
        <div className="space-y-1">
          <p className="text-white font-semibold text-sm">{label}</p>
          {description && (
            <p className="text-slate-400 text-xs leading-relaxed max-w-[220px]">
              {description}
            </p>
          )}
        </div>

        {/* Reason badge */}
        {reason && REASON_LABELS[reason] && (
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-700/50 border border-slate-600/30 text-slate-300">
            {REASON_LABELS[reason]}
          </span>
        )}

        {/* Unlock CTA */}
        {unlock && (
          <button
            onClick={handleUnlock}
            className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg
              bg-amber-600/15 border border-amber-600/30 text-amber-300
              text-xs font-medium hover:bg-amber-600/25 hover:border-amber-600/50
              transition-all duration-150 active:scale-95"
          >
            {unlock.label}
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED MODE TOGGLE HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useAdvancedMode
 *
 * Toggles advanced mode via the API and refreshes the feature manifest.
 * Use in the Settings page or the Advanced Mode toggle button.
 *
 * @example
 * const { advancedMode, toggle, loading } = useAdvancedMode();
 * <Switch checked={advancedMode} onChange={toggle} disabled={loading} />
 */
export function useAdvancedMode() {
  const { advancedMode, refresh } = useFeatureManifest();
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    setToggling(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/settings/advanced-mode', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !advancedMode }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Toggle failed: ${res.status}`);
      }

      // Refresh the manifest so all FeatureGate components re-render
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Toggle failed';
      setError(message);
      console.error('[useAdvancedMode] Toggle error:', err);
    } finally {
      setToggling(false);
    }
  }, [advancedMode, refresh]);

  return { advancedMode, toggle, toggling, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export { buildFeatureManifest };
export type { Persona, PresentationMode };
