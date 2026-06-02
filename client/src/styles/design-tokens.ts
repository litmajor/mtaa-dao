/**
 * Design Tokens - MtaaDAO Design System
 * Central export for all design system tokens
 * Use these throughout the application for consistency
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './animations';
export * from './elevation';
export * from './radius';
export * from './visual';

// Re-export as a unified object for convenience
import * as colors from './colors';
import * as typography from './typography';
import * as spacing from './spacing';
import * as animations from './animations';
import * as elevation from './elevation';
import * as radius from './radius';
import * as visual from './visual';

export const designTokens = {
  colors,
  typography,
  spacing,
  animations,
  elevation,
  radius,
  visual,
} as const;

/**
 * Usage examples:
 *
 * // Import specific tokens
 * import { colors, spacing, typography } from '@/styles/design-tokens';
 *
 * // Use in components
 * <div style={{ color: colors.colors.primary.base, padding: spacing.spacing.lg }}>
 *   Content
 * </div>
 *
 * // Or import the unified object
 * import { designTokens } from '@/styles/design-tokens';
 * <div style={{ color: designTokens.colors.colors.primary.base }}>
 *   Content
 * </div>
 */
