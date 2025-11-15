/**
 * Spacing System - MtaaDAO Design System
 * 12 spacing values following 4px base unit
 * Used for padding, margins, gaps, and sizing
 */

export const spacing = {
  // Fractional: 2px, 3px, 4px
  '0.5': '2px',
  '0.75': '3px',
  xs: '4px',

  // Small: 8px, 12px
  sm: '8px',
  md: '12px',

  // Medium: 16px, 20px, 24px
  lg: '16px',
  xl: '20px',
  '2xl': '24px',

  // Large: 28px, 32px, 36px
  '3xl': '28px',
  '4xl': '32px',
  '5xl': '36px',

  // Extra large: 40px, 48px
  '6xl': '40px',
  '7xl': '48px',

  // Massive: 56px, 64px
  '8xl': '56px',
  '9xl': '64px',

  // Aliases for semantic usage
  none: '0px',
  auto: 'auto',
  inherit: 'inherit',
} as const;

/**
 * Spacing scale as numeric map for arrays/objects
 */
export const spacingScale = [
  0,    // 0px
  2,    // 0.5 (2px)
  3,    // 0.75 (3px)
  4,    // xs (4px)
  8,    // sm (8px)
  12,   // md (12px)
  16,   // lg (16px)
  20,   // xl (20px)
  24,   // 2xl (24px)
  28,   // 3xl (28px)
  32,   // 4xl (32px)
  36,   // 5xl (36px)
  40,   // 6xl (40px)
  48,   // 7xl (48px)
  56,   // 8xl (56px)
  64,   // 9xl (64px)
] as const;

/**
 * Container padding for responsive design
 * Automatically adjusted based on viewport
 */
export const containerPadding = {
  mobile: '1rem',      // 16px - phones
  tablet: '1.5rem',    // 24px - tablets
  desktop: '2rem',     // 32px - desktops
  wide: '2.5rem',      // 40px - ultra-wide
} as const;

/**
 * Gap utilities for grid and flex layouts
 */
export const gaps = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
} as const;

/**
 * Padding utilities - commonly used combinations
 */
export const paddings = {
  // Minimal
  compact: '8px 12px',        // 8px vertical, 12px horizontal
  cozy: '12px 16px',          // 12px vertical, 16px horizontal

  // Standard
  normal: '16px',             // All sides
  '2x': '16px 24px',          // 16px vertical, 24px horizontal
  '3x': '24px',               // All sides

  // Spacious
  comfortable: '24px',        // All sides
  spacious: '32px',           // All sides

  // By direction
  'x-sm': '0 8px',           // Horizontal small
  'x-md': '0 16px',          // Horizontal medium
  'x-lg': '0 24px',          // Horizontal large
  'y-sm': '8px 0',           // Vertical small
  'y-md': '16px 0',          // Vertical medium
  'y-lg': '24px 0',          // Vertical large
} as const;

/**
 * Margin utilities - commonly used combinations
 */
export const margins = {
  none: '0',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  auto: 'auto',
} as const;

/**
 * Sizing utilities based on spacing scale
 */
export const sizes = {
  // Touch targets
  'touch-sm': '40px',
  'touch-md': '44px',
  'touch-lg': '48px',

  // Component sizes
  'icon-sm': '16px',
  'icon-md': '24px',
  'icon-lg': '32px',
  'icon-xl': '48px',

  // Button sizes
  'btn-sm': '32px',
  'btn-md': '40px',
  'btn-lg': '48px',

  // Container widths
  'container-xs': '320px',
  'container-sm': '640px',
  'container-md': '768px',
  'container-lg': '1024px',
  'container-xl': '1280px',
  'container-2xl': '1536px',

  // Max widths
  'max-prose': '65ch',
  'max-content': '80rem',
} as const;

/**
 * Responsive spacing helper
 * Provides consistent spacing across breakpoints
 */
export const responsiveSpacing = {
  // Mobile-first approach
  'xs-mobile': spacing.sm,        // 8px
  'sm-mobile': spacing.md,        // 12px
  'md-mobile': spacing.lg,        // 16px
  'lg-mobile': spacing.xl,        // 20px

  // Tablet
  'xs-tablet': spacing.md,        // 12px
  'sm-tablet': spacing.lg,        // 16px
  'md-tablet': spacing.xl,        // 20px
  'lg-tablet': spacing['2xl'],    // 24px

  // Desktop
  'xs-desktop': spacing.lg,       // 16px
  'sm-desktop': spacing.xl,       // 20px
  'md-desktop': spacing['2xl'],   // 24px
  'lg-desktop': spacing['3xl'],   // 28px
} as const;
