export const motionTokens = {
  duration: {
    xxs: '75ms',
    xs: '100ms',
    sm: '150ms',
    md: '240ms',
    lg: '400ms',
  },
  ease: {
    standard: 'cubic-bezier(.2,.8,.2,1)',
    decel: 'cubic-bezier(.0,0,.2,1)'
  }
} as const;

export type MotionTokens = typeof motionTokens;
