/**
 * Visual tokens: opacity and blur intensity
 * These map to CSS variable fallbacks when appropriate
 */
export const opacity = {
  none: '0',
  xs: '0.02',
  sm: '0.08',
  md: '0.15',
  lg: '0.3',
  xl: '0.5',
  full: '1',
} as const;

export const blur = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '16px',
  xl: '24px',
  '2xl': '40px',
} as const;

export default { opacity, blur };
