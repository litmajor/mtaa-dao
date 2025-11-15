/**
 * Typography Scale - MtaaDAO Design System
 * Uses clamp() for fluid, responsive typography
 * Scales automatically from mobile (small) to large desktop
 */

export const typography = {
  // Captions and small text (11-13px)
  caption: {
    fontSize: 'clamp(0.6875rem, 1.5vw, 0.8125rem)',
    lineHeight: '1.4',
    fontWeight: '400',
  } as const,

  // Extra small text (12-14px)
  xs: {
    fontSize: 'clamp(0.75rem, 1.75vw, 0.875rem)',
    lineHeight: '1.4',
    fontWeight: '400',
  } as const,

  // Small text (13-15px)
  sm: {
    fontSize: 'clamp(0.8125rem, 2vw, 0.9375rem)',
    lineHeight: '1.5',
    fontWeight: '400',
  } as const,

  // Base/Body text (14-16px) - Most common
  base: {
    fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
    lineHeight: '1.6',
    fontWeight: '400',
  } as const,

  // Large text (16-18px)
  lg: {
    fontSize: 'clamp(1rem, 2.5vw, 1.125rem)',
    lineHeight: '1.6',
    fontWeight: '500',
  } as const,

  // Extra large text (18-20px)
  xl: {
    fontSize: 'clamp(1.125rem, 2.75vw, 1.25rem)',
    lineHeight: '1.5',
    fontWeight: '500',
  } as const,

  // Heading 3 (20-24px)
  '2xl': {
    fontSize: 'clamp(1.25rem, 3.5vw, 1.5rem)',
    lineHeight: '1.4',
    fontWeight: '600',
  } as const,

  // Heading 2 (24-32px)
  '3xl': {
    fontSize: 'clamp(1.5rem, 4vw, 2rem)',
    lineHeight: '1.3',
    fontWeight: '600',
  } as const,

  // Heading 1 (30-40px)
  '4xl': {
    fontSize: 'clamp(1.875rem, 4.5vw, 2.5rem)',
    lineHeight: '1.2',
    fontWeight: '700',
  } as const,

  // Display text (40-56px)
  display: {
    fontSize: 'clamp(2.5rem, 5.5vw, 3.5rem)',
    lineHeight: '1.1',
    fontWeight: '700',
  } as const,
} as const;

/**
 * Font weights
 */
export const fontWeights = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
} as const;

/**
 * Font family configuration
 */
export const fonts = {
  sans: 'system-ui, -apple-system, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, serif',
  mono: 'ui-monospace, SFMono-Regular, Courier, monospace',
} as const;

/**
 * Typography utility classes for Tailwind
 * Provides predefined typography combinations
 */
export const typographyUtilities = {
  // Headings
  'heading-1': {
    fontSize: 'clamp(1.875rem, 4.5vw, 2.5rem)',
    lineHeight: '1.2',
    fontWeight: '700',
    letterSpacing: '-0.02em',
  },
  'heading-2': {
    fontSize: 'clamp(1.5rem, 4vw, 2rem)',
    lineHeight: '1.3',
    fontWeight: '600',
    letterSpacing: '-0.01em',
  },
  'heading-3': {
    fontSize: 'clamp(1.25rem, 3.5vw, 1.5rem)',
    lineHeight: '1.4',
    fontWeight: '600',
  },

  // Body text
  'body-lg': {
    fontSize: 'clamp(1rem, 2.5vw, 1.125rem)',
    lineHeight: '1.6',
    fontWeight: '400',
  },
  'body-base': {
    fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
    lineHeight: '1.6',
    fontWeight: '400',
  },
  'body-sm': {
    fontSize: 'clamp(0.8125rem, 2vw, 0.9375rem)',
    lineHeight: '1.5',
    fontWeight: '400',
  },

  // Special styles
  label: {
    fontSize: 'clamp(0.75rem, 1.75vw, 0.875rem)',
    lineHeight: '1.5',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  caption: {
    fontSize: 'clamp(0.6875rem, 1.5vw, 0.8125rem)',
    lineHeight: '1.4',
    fontWeight: '400',
    letterSpacing: '0.02em',
  },
  small: {
    fontSize: 'clamp(0.8125rem, 2vw, 0.9375rem)',
    lineHeight: '1.4',
    fontWeight: '400',
  },
  code: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: 'clamp(0.75rem, 1.75vw, 0.875rem)',
    lineHeight: '1.5',
    fontWeight: '500',
  },
} as const;
