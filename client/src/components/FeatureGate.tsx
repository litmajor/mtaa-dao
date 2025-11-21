import React, { ReactNode } from 'react';
import { useFeatureFlags, FeatureFlagNameExplicit } from '@/hooks/useFeatureFlags';
import { AlertCircle, Clock } from 'lucide-react';

interface FeatureGateProps {
  /**
   * Name of the feature flag to check
   * @example "isLockedSavingsEnabled"
   */
  feature: FeatureFlagNameExplicit;

  /**
   * Content to show if feature is enabled
   */
  children: ReactNode;

  /**
   * Content to show if feature is disabled
   * If not provided and feature is disabled, nothing is rendered
   */
  fallback?: ReactNode;

  /**
   * Show a "Coming Soon" badge with release date when disabled
   * Set to 'auto' to automatically fetch from release schedule
   * Set to a custom date string to override
   * @default 'auto'
   */
  showComingSoon?: 'auto' | false | string;

  /**
   * CSS class to apply to the wrapper
   */
  className?: string;

  /**
   * Show warning message in console if feature is not enabled
   */
  debug?: boolean;
}

/**
 * Feature Gate Component
 *
 * Conditionally renders content based on feature flags.
 * Use this to hide features that aren't enabled in the current phase.
 *
 * @example
 * ```tsx
 * // Simple usage - render nothing if feature is disabled
 * <FeatureGate feature="isLockedSavingsEnabled">
 *   <LockedSavingsUI />
 * </FeatureGate>
 *
 * // With fallback
 * <FeatureGate
 *   feature="isInvestmentPoolsEnabled"
 *   fallback={<div>Coming in Phase 2</div>}
 * >
 *   <InvestmentPoolsUI />
 * </FeatureGate>
 *
 * // With custom coming soon message
 * <FeatureGate
 *   feature="isAiAssistantEnabled"
 *   showComingSoon="January 15, 2026"
 * >
 *   <AiAssistantUI />
 * </FeatureGate>
 * ```
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showComingSoon = 'auto',
  className = '',
  debug = false,
}) => {
  const flags = useFeatureFlags();

  // Check if feature is enabled
  const isEnabled = flags[feature];

  if (debug) {
    console.log(`[FeatureGate] ${feature}: ${isEnabled ? 'enabled' : 'disabled'}`);
  }

  if (isEnabled) {
    return <div className={className}>{children}</div>;
  }

  // Feature is disabled - show fallback or ComingSoon banner
  if (fallback) {
    return <div className={className}>{fallback}</div>;
  }

  if (showComingSoon !== false) {
    const releaseDate = 
      showComingSoon === 'auto' 
        ? getReleaseDate(feature, flags)
        : showComingSoon;

    return (
      <div className={`feature-gate-coming-soon ${className}`}>
        <ComingSoonBanner feature={feature} releaseDate={releaseDate} />
      </div>
    );
  }

  return null;
};

/**
 * Coming Soon Banner Component
 * Displays when a feature is not yet available
 */
export const ComingSoonBanner: React.FC<{
  feature: string;
  releaseDate?: string;
}> = ({ feature, releaseDate }) => {
  const featureNames: Record<string, string> = {
    isLockedSavingsEnabled: '💰 Locked Savings',
    isInvestmentPoolsEnabled: '📊 Investment Pools',
    isVaultYieldEnabled: '📈 Vault Yield',
    isAiAssistantEnabled: '🤖 AI Assistant',
    isAnalyticsEnabled: '📊 Advanced Analytics',
    isElderCouncilEnabled: '👑 Elder Council',
    isEscrowEnabled: '🔒 Escrow',
    isMultiChainEnabled: '🌍 Multi-Chain',
    isCrossChainEnabled: '🌉 Cross-Chain',
    isNftMarketplaceEnabled: '🎨 NFT Marketplace',
  };

  const displayName = featureNames[feature] || feature.replace(/^is|Enabled$/g, '');

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
      <Clock className="h-5 w-5 text-blue-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-blue-900">
          {displayName} is coming soon
        </p>
        {releaseDate && (
          <p className="text-sm text-blue-700 mt-1">
            Available: {releaseDate}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * ComingSoon Placeholder Component
 *
 * Use this to show a placeholder for features that aren't available yet.
 * Useful for menu items, cards, etc.
 *
 * @example
 * ```tsx
 * <FeatureGate
 *   feature="isLockedSavingsEnabled"
 *   fallback={<ComingSoonPlaceholder feature="isLockedSavingsEnabled" />}
 * >
 *   <LockedSavingsUI />
 * </FeatureGate>
 * ```
 */
export const ComingSoonPlaceholder: React.FC<{
  feature: FeatureFlagNameExplicit;
  height?: string;
}> = ({ feature, height = 'h-32' }) => {
  const flags = useFeatureFlags();
  const releaseDate = getReleaseDate(feature, flags);

  return (
    <div className={`${height} flex items-center justify-center rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300`}>
      <div className="text-center">
        <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-600">Coming Soon</p>
        {releaseDate && (
          <p className="text-xs text-gray-500 mt-1">{releaseDate}</p>
        )}
      </div>
    </div>
  );
};

/**
 * Disabled Feature Alert Component
 *
 * Shows an alert when a feature is disabled in production.
 * Useful for debugging/admin views.
 */
export const DisabledFeatureAlert: React.FC<{
  feature: FeatureFlagNameExplicit;
}> = ({ feature }) => {
  const flags = useFeatureFlags();

  const flagValue = flags[feature as keyof ReturnType<typeof useFeatureFlags>];
  
  if (flagValue === true) {
    return null; // Feature is enabled, don't show alert
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-200 mb-4">
      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-yellow-800">
          {feature} is disabled
        </p>
        <p className="text-sm text-yellow-700 mt-1">
          To enable this feature, set the environment variable and redeploy.
        </p>
      </div>
    </div>
  );
};

/**
 * Feature Badge Component
 *
 * Shows a "Coming Soon" or "New" badge next to feature names
 *
 * @example
 * ```tsx
 * <h2>
 *   Locked Savings
 *   <FeatureBadge feature="isLockedSavingsEnabled" />
 * </h2>
 * ```
 */
export const FeatureBadge: React.FC<{
  feature: FeatureFlagNameExplicit;
  variant?: 'coming-soon' | 'new' | 'beta';
}> = ({ feature, variant = 'coming-soon' }) => {
  const flags = useFeatureFlags();
  const isEnabled = flags[feature];

  if (isEnabled) {
    return (
      <span className="inline-block ml-2 px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
        Live
      </span>
    );
  }

  const variants = {
    'coming-soon': 'bg-blue-100 text-blue-800',
    'new': 'bg-purple-100 text-purple-800',
    'beta': 'bg-orange-100 text-orange-800',
  };

  return (
    <span className={`inline-block ml-2 px-2 py-1 text-xs font-semibold rounded-full ${variants[variant]}`}>
      {variant === 'coming-soon' ? 'Coming Soon' : variant === 'new' ? 'New' : 'Beta'}
    </span>
  );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract release date from feature flag
 */
function getReleaseDate(
  feature: FeatureFlagNameExplicit,
  flags: ReturnType<typeof useFeatureFlags>
): string | undefined {
  const featurePhaseMap: Record<FeatureFlagNameExplicit, string> = {
    // Phase 1
    isDaosEnabled: 'December 1, 2025',
    isGovernanceEnabled: 'December 1, 2025',
    isTreasuryEnabled: 'December 1, 2025',
    isMembersEnabled: 'December 1, 2025',
    isProposalsEnabled: 'December 1, 2025',
    isVotingEnabled: 'December 1, 2025',
    isWalletEnabled: 'December 1, 2025',
    isTasksEnabled: 'December 1, 2025',
    isReferralsEnabled: 'December 1, 2025',
    
    // Phase 2
    isLockedSavingsEnabled: 'January 15, 2026',
    isInvestmentPoolsEnabled: 'January 20, 2026',
    isVaultYieldEnabled: 'February 1, 2026',
    
    // Phase 3
    isAiAssistantEnabled: 'March 1, 2026',
    isAnalyticsEnabled: 'March 15, 2026',
    isPredictionsEnabled: 'March 30, 2026',
    
    // Phase 4
    isElderCouncilEnabled: 'April 15, 2026',
    isEscrowEnabled: 'May 1, 2026',
    
    // Phase 5
    isMultiChainEnabled: 'June 1, 2026',
    isCrossChainEnabled: 'June 15, 2026',
    
    // Future
    isNftMarketplaceEnabled: 'TBD',
    isAdvancedGovernanceEnabled: 'TBD',
    isDefiIntegrationEnabled: 'TBD',
  };

  const releaseInfo = flags.getReleaseInfo(feature.replace(/^is|Enabled$/g, ''));
  return (releaseInfo as any)?.startDate || featurePhaseMap[feature];
}

export default FeatureGate;
