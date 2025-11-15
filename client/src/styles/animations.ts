/**
 * Animations - MtaaDAO Design System
 * Provides consistent animation timing and easing
 * Respects prefers-reduced-motion for accessibility
 */

export const animations = {
  // Fade animations
  fadeIn: {
    duration: '300ms',
    easing: 'ease-in-out',
    property: 'opacity',
  } as const,

  fadeOut: {
    duration: '300ms',
    easing: 'ease-in-out',
    property: 'opacity',
  } as const,

  // Slide animations
  slideUp: {
    duration: '300ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    property: 'transform, opacity',
  } as const,

  slideDown: {
    duration: '300ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    property: 'transform, opacity',
  } as const,

  slideLeft: {
    duration: '300ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    property: 'transform',
  } as const,

  slideRight: {
    duration: '300ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    property: 'transform',
  } as const,

  // Scale animations
  scaleIn: {
    duration: '200ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    property: 'transform, opacity',
  } as const,

  scaleOut: {
    duration: '200ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    property: 'transform, opacity',
  } as const,

  // Interactive animations
  hover: {
    duration: '150ms',
    easing: 'ease-in',
    property: 'all',
  } as const,

  focus: {
    duration: '150ms',
    easing: 'ease-in',
    property: 'outline',
  } as const,

  // Loading animation
  loading: {
    duration: '2000ms',
    easing: 'linear',
    property: 'transform',
  } as const,

  // Bounce animations
  bounce: {
    duration: '600ms',
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    property: 'transform',
  } as const,

  // Pulse animation (breathing effect)
  pulse: {
    duration: '2000ms',
    easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
    property: 'opacity',
  } as const,

  // Shake animation (error state)
  shake: {
    duration: '500ms',
    easing: 'ease-in-out',
    property: 'transform',
  } as const,
} as const;

/**
 * Tailwind animation configuration
 * Add these to tailwind.config.ts in keyframes
 */
export const tailwindKeyframes = {
  'fade-in': {
    from: { opacity: '0' },
    to: { opacity: '1' },
  },
  'fade-out': {
    from: { opacity: '1' },
    to: { opacity: '0' },
  },
  'slide-up': {
    from: { transform: 'translateY(10px)', opacity: '0' },
    to: { transform: 'translateY(0)', opacity: '1' },
  },
  'slide-down': {
    from: { transform: 'translateY(-10px)', opacity: '0' },
    to: { transform: 'translateY(0)', opacity: '1' },
  },
  'slide-left': {
    from: { transform: 'translateX(10px)', opacity: '0' },
    to: { transform: 'translateX(0)', opacity: '1' },
  },
  'slide-right': {
    from: { transform: 'translateX(-10px)', opacity: '0' },
    to: { transform: 'translateX(0)', opacity: '1' },
  },
  'scale-in': {
    from: { transform: 'scale(0.95)', opacity: '0' },
    to: { transform: 'scale(1)', opacity: '1' },
  },
  'scale-out': {
    from: { transform: 'scale(1)', opacity: '1' },
    to: { transform: 'scale(0.95)', opacity: '0' },
  },
  'bounce-in': {
    '0%': { transform: 'scale(0)', opacity: '0' },
    '50%': { transform: 'scale(1.05)' },
    '100%': { transform: 'scale(1)', opacity: '1' },
  },
  'pulse': {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: '0.5' },
  },
  'shake': {
    '0%, 100%': { transform: 'translateX(0)' },
    '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
    '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
  },
  'loading-spin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
} as const;

/**
 * Animation duration constants
 */
export const animationDurations = {
  shortest: '100ms',
  shorter: '150ms',
  short: '200ms',
  standard: '300ms',
  complex: '375ms',
  enteringScreen: '225ms',
  leavingScreen: '195ms',
} as const;

/**
 * Animation easing constants (cubic-bezier values)
 */
export const animationEasing = {
  easeLinear: 'linear',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',

  // Specific easings
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',

  // Standard material design easings
  material: {
    enter: 'cubic-bezier(0.4, 0, 0.2, 1)',
    exit: 'cubic-bezier(0.4, 0, 0.6, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
} as const;

/**
 * Transition utilities for common state changes
 */
export const transitions = {
  // Quick feedback
  quick: 'all 150ms ease-in',

  // Standard transitions
  standard: 'all 300ms ease-in-out',
  
  // Slower transitions for dramatic effects
  slow: 'all 500ms ease-in-out',

  // Specific transitions
  colors: 'color 300ms ease-in-out, background-color 300ms ease-in-out, border-color 300ms ease-in-out',
  background: 'background-color 300ms ease-in-out',
  border: 'border-color 300ms ease-in-out',
  shadow: 'box-shadow 300ms ease-in-out',
  transform: 'transform 300ms ease-in-out',
  opacity: 'opacity 300ms ease-in-out',

  // For form elements
  input: 'border-color 300ms ease-in-out, box-shadow 300ms ease-in-out',

  // For interactions
  hover: 'all 150ms ease-in',
  focus: 'outline 150ms ease-in, box-shadow 150ms ease-in',
} as const;

/**
 * Prefers reduced motion CSS
 * Use this to respect user's motion preferences
 */
export const prefersReducedMotion = `
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
