/**
 * Feature Flags - Control feature availability globally
 * Toggle flags in environment or code
 */

export const featureFlags = {
  // Social features
  ENABLE_USER_FOLLOWS: process.env.FEATURE_USER_FOLLOWS === 'true' || false,
  ENABLE_USER_PROFILES: process.env.FEATURE_USER_PROFILES === 'true' || true,
  
  // Platform features
  ENABLE_CUSTOM_TREASURIES: process.env.FEATURE_CUSTOM_TREASURIES === 'true' || true,
  ENABLE_REFERRAL_SYSTEM: process.env.FEATURE_REFERRAL_SYSTEM === 'true' || true,
};

export function isFeatureEnabled(flag: keyof typeof featureFlags): boolean {
  return featureFlags[flag];
}
