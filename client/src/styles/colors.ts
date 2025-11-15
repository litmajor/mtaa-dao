/**
 * Color Palette - MtaaDAO Design System
 * 12 color families with 4 shades each (light, base, dark, darker)
 * Used for semantic meaning and accessibility
 */

export const colors = {
  // Primary: Orange - Main brand color, CTAs, primary actions
  orange: {
    light: '#FFE4D1',    // Background tint
    base: '#FF7F3F',     // Primary actions, main buttons
    dark: '#E56D2E',     // Hover states
    darker: '#B8531B',   // Active states, dark mode
  },

  // Secondary: Purple - Secondary actions, highlights
  purple: {
    light: '#F3E8FF',    // Background tint
    base: '#8B5FBF',     // Secondary buttons, accents
    dark: '#7343A8',     // Hover states
    darker: '#563170',   // Active states, dark mode
  },

  // Success: Emerald - Positive actions, approved states
  emerald: {
    light: '#D1FAE5',    // Success background
    base: '#10B981',     // Success badges, checkmarks
    dark: '#059669',     // Hover states
    darker: '#047857',   // Active states, dark mode
  },

  // Danger: Red - Destructive actions, errors
  red: {
    light: '#FEE2E2',    // Error background
    base: '#EF4444',     // Delete buttons, error messages
    dark: '#DC2626',     // Hover states
    darker: '#991B1B',   // Active states, dark mode
  },

  // Warning: Amber - Caution, pending states
  amber: {
    light: '#FEF3C7',    // Warning background
    base: '#F59E0B',     // Warning badges, pending status
    dark: '#D97706',     // Hover states
    darker: '#92400E',   // Active states, dark mode
  },

  // Info: Blue - Informational, links
  blue: {
    light: '#DBEAFE',    // Info background
    base: '#3B82F6',     // Links, info messages
    dark: '#1D4ED8',     // Hover states
    darker: '#1E40AF',   // Active states, dark mode
  },

  // Neutral: Gray - Text, borders, disabled states
  gray: {
    light: '#F3F4F6',    // Background light
    base: '#6B7280',     // Secondary text
    dark: '#374151',     // Primary text
    darker: '#111827',   // Dark mode text, dark borders
  },

  // Slate: Cool gray - Alternative neutral
  slate: {
    light: '#F1F5F9',    // Very light background
    base: '#64748B',     // Medium text
    dark: '#334155',     // Dark text
    darker: '#0F172A',   // Dark mode background
  },

  // Accent: Teal - Special highlights
  teal: {
    light: '#CCFBF1',    // Accent background
    base: '#14B8A6',     // Special highlights
    dark: '#0D9488',     // Hover states
    darker: '#134E4A',   // Active states, dark mode
  },

  // Accent: Cyan - Secondary highlights
  cyan: {
    light: '#CFFAFE',    // Cyan background
    base: '#06B6D4',     // Secondary highlights
    dark: '#0891B2',     // Hover states
    darker: '#164E63',   // Active states, dark mode
  },

  // Accent: Rose - Soft highlight
  rose: {
    light: '#FFE4E6',    // Rose background
    base: '#F43F5E',     // Special accent
    dark: '#E11D48',     // Hover states
    darker: '#831843',   // Active states, dark mode
  },

  // Accent: Lime - Vibrant accent
  lime: {
    light: '#ECFCCF',    // Lime background
    base: '#84CC16',     // Vibrant accent
    dark: '#65A30D',     // Hover states
    darker: '#422006',   // Active states, dark mode
  },

  // Black & White for contrast
  black: '#000000',
  white: '#FFFFFF',

  // Semantic colors (aliases)
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
  disabled: '#9CA3AF',
} as const;

/**
 * Light Mode Color Mapping
 */
export const lightModeColors = {
  background: colors.white,
  foreground: colors.slate.darker,
  card: colors.white,
  'card-foreground': colors.slate.darker,
  popover: colors.white,
  'popover-foreground': colors.slate.darker,
  primary: colors.orange.base,
  'primary-foreground': colors.white,
  secondary: colors.purple.base,
  'secondary-foreground': colors.white,
  muted: colors.gray.light,
  'muted-foreground': colors.gray.base,
  accent: colors.teal.base,
  'accent-foreground': colors.white,
  destructive: colors.red.base,
  'destructive-foreground': colors.white,
  border: colors.gray.light,
  input: colors.gray.light,
  ring: colors.orange.base,
} as const;

/**
 * Dark Mode Color Mapping
 */
export const darkModeColors = {
  background: colors.slate.darker,
  foreground: '#E2E8F0',
  card: '#1E293B',
  'card-foreground': '#E2E8F0',
  popover: '#1E293B',
  'popover-foreground': '#E2E8F0',
  primary: colors.orange.base,
  'primary-foreground': colors.white,
  secondary: colors.purple.base,
  'secondary-foreground': colors.white,
  muted: colors.slate.dark,
  'muted-foreground': '#94A3B8',
  accent: colors.teal.base,
  'accent-foreground': colors.white,
  destructive: colors.red.base,
  'destructive-foreground': colors.white,
  border: colors.slate.dark,
  input: colors.slate.dark,
  ring: colors.orange.base,
} as const;
