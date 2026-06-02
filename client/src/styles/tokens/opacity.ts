export const opacityTokens = {
  100: 1,
  80: 0.8,
  60: 0.6,
  40: 0.4,
  20: 0.2,
  8: 0.08
} as const;

export type OpacityTokens = typeof opacityTokens;
