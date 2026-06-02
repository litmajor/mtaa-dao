/**
 * Elevation / Shadow tokens
 * Map to CSS variables defined in theme-variables.css
 */
export const elevation = {
  xs: 'var(--shadow-xs)',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
} as const;

export const shadowLevels = elevation;

export default elevation;
