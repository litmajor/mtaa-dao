export const spacingTokens = {
  base: 4,
  sp0: 0,
  sp1: 4,
  sp2: 8,
  sp3: 12,
  sp4: 16,
  sp5: 24,
  sp6: 32,
  sp7: 48,
  sp8: 64,
} as const;

export type SpacingTokens = typeof spacingTokens;
