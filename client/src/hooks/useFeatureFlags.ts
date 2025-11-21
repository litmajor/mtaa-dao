import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/pages/hooks/useAuth';

interface FeatureFlags {
  daos: boolean;
  governance: boolean;
  treasury: boolean;
  members: boolean;
  proposals: boolean;
  voting: boolean;
  wallet: boolean;
  tasks: boolean;
  referrals: boolean;
  lockedSavings: boolean;
  investmentPools: boolean;
  vaultYield: boolean;
  aiAssistant: boolean;
  analytics: boolean;
  predictions: boolean;
  elderCouncil: boolean;
  escrow: boolean;
  multiChain: boolean;
  crossChain: boolean;
  nftMarketplace: boolean;
  advancedGovernance: boolean;
  defiIntegration: boolean;
}

interface ReleasePhase {
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface FeaturesResponse {
  features: FeatureFlags;
  user: {
    id: string;
    role: string;
    betaAccess: boolean;
    enabledBetaFeatures: string[]; // Beta features persisted in database
  } | null;
  releaseSchedule: {
    phase1: ReleasePhase;
    phase2: ReleasePhase;
    phase3: ReleasePhase;
    phase4: ReleasePhase;
    phase5: ReleasePhase;
  };
}

const defaultFlags: FeatureFlags = {
  daos: false,
  governance: false,
  treasury: false,
  members: false,
  proposals: false,
  voting: false,
  wallet: false,
  tasks: false,
  referrals: false,
  lockedSavings: false,
  investmentPools: false,
  vaultYield: false,
  aiAssistant: false,
  analytics: false,
  predictions: false,
  elderCouncil: false,
  escrow: false,
  multiChain: false,
  crossChain: false,
  nftMarketplace: false,
  advancedGovernance: false,
  defiIntegration: false,
};

export function useFeatureFlags() {
  const { user } = useAuth();
  
  const { data: response, isLoading, error } = useQuery<FeaturesResponse>({
    queryKey: ['features', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/features');
      if (!res.ok) {
        throw new Error('Failed to fetch feature flags');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes before garbage collection
  });

  const flags = (response?.features as FeatureFlags) || defaultFlags;
  const userBetaFeatures = response?.user?.enabledBetaFeatures || [];
  const releaseSchedule = (response?.releaseSchedule as Record<string, ReleasePhase>) || {};

  return {
    // Loading state
    isLoading,
    error,

    // ========================================
    // PHASE 1: CORE PLATFORM
    // ========================================
    isDaosEnabled: flags.daos === true,
    isGovernanceEnabled: flags.governance === true,
    isTreasuryEnabled: flags.treasury === true,
    isMembersEnabled: flags.members === true,
    isProposalsEnabled: flags.proposals === true,
    isVotingEnabled: flags.voting === true,
    isWalletEnabled: flags.wallet === true,
    isTasksEnabled: flags.tasks === true,
    isReferralsEnabled: flags.referrals === true,

    // ========================================
    // PHASE 2: CAPITAL FEATURES
    // ========================================
    isLockedSavingsEnabled: flags.lockedSavings === true,
    isInvestmentPoolsEnabled: flags.investmentPools === true,
    isVaultYieldEnabled: flags.vaultYield === true,

    // ========================================
    // PHASE 3: AI & ANALYTICS
    // ========================================
    isAiAssistantEnabled: flags.aiAssistant === true,
    isAnalyticsEnabled: flags.analytics === true,
    isPredictionsEnabled: flags.predictions === true,

    // ========================================
    // PHASE 4: GOVERNANCE EVOLUTION
    // ========================================
    isElderCouncilEnabled: flags.elderCouncil === true,
    isEscrowEnabled: flags.escrow === true,

    // ========================================
    // PHASE 5: MULTI-CHAIN & SCALE
    // ========================================
    isMultiChainEnabled: flags.multiChain === true,
    isCrossChainEnabled: flags.crossChain === true,

    // ========================================
    // FUTURE FEATURES
    // ========================================
    isNftMarketplaceEnabled: flags.nftMarketplace === true,
    isAdvancedGovernanceEnabled: flags.advancedGovernance === true,
    isDefiIntegrationEnabled: flags.defiIntegration === true,

    // ========================================
    // BETA ACCESS
    // ========================================
    userBetaFeatures,
    hasBetaAccess: (feature: string) => userBetaFeatures.includes(feature),
    
    // ========================================
    // HELPER METHODS
    // ========================================
    /**
     * Check if any feature in a group is enabled
     */
    isPhaseEnabled: (phase: 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'phase5') => {
      const phaseChecks = {
        phase1: () => flags.daos && flags.governance && flags.treasury,
        phase2: () => flags.lockedSavings || flags.investmentPools,
        phase3: () => flags.aiAssistant || flags.analytics,
        phase4: () => flags.elderCouncil || flags.escrow,
        phase5: () => flags.multiChain || flags.crossChain,
      };
      return phaseChecks[phase]?.() || false;
    },

    /**
     * Get release date for a feature
     */
    getReleaseInfo: (featureName: string) => {
      const phaseMap: Record<string, string> = {
        lockedSavings: 'phase2',
        investmentPools: 'phase2',
        vaultYield: 'phase2',
        aiAssistant: 'phase3',
        analytics: 'phase3',
        elderCouncil: 'phase4',
        escrow: 'phase4',
        multiChain: 'phase5',
        crossChain: 'phase5',
      };
      
      const phase = phaseMap[featureName];
      if (!phase || !releaseSchedule || !(phase in releaseSchedule)) return null;
      return releaseSchedule[phase as keyof typeof releaseSchedule];
    },

    /**
     * Get all enabled features
     */
    getEnabledFeatures: () => {
      return Object.entries(flags)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name);
    },

    /**
     * Get all disabled features
     */
    getDisabledFeatures: () => {
      return Object.entries(flags)
        .filter(([_, enabled]) => !enabled)
        .map(([name]) => name);
    },

    // Raw data for advanced use cases
    rawFlags: flags,
    releaseSchedule,
  };
}

/**
 * Type-safe feature flag names for use with FeatureGate
 */
export type FeatureFlagNameExplicit = 
  // Phase 1
  | 'isDaosEnabled'
  | 'isGovernanceEnabled'
  | 'isTreasuryEnabled'
  | 'isMembersEnabled'
  | 'isProposalsEnabled'
  | 'isVotingEnabled'
  | 'isWalletEnabled'
  | 'isTasksEnabled'
  | 'isReferralsEnabled'
  // Phase 2
  | 'isLockedSavingsEnabled'
  | 'isInvestmentPoolsEnabled'
  | 'isVaultYieldEnabled'
  // Phase 3
  | 'isAiAssistantEnabled'
  | 'isAnalyticsEnabled'
  | 'isPredictionsEnabled'
  // Phase 4
  | 'isElderCouncilEnabled'
  | 'isEscrowEnabled'
  // Phase 5
  | 'isMultiChainEnabled'
  | 'isCrossChainEnabled'
  // Future
  | 'isNftMarketplaceEnabled'
  | 'isAdvancedGovernanceEnabled'
  | 'isDefiIntegrationEnabled';
