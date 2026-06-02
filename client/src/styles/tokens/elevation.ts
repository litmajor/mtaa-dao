export const elevationTokens = {
  0: { shadow: 'none', z: 0 },
  1: { shadow: '0 1px 2px rgba(2,6,23,0.04)', z: 10 },
  2: { shadow: '0 4px 8px rgba(2,6,23,0.06)', z: 20 },
  3: { shadow: '0 8px 24px rgba(2,6,23,0.08)', z: 30 },
  4: { shadow: '0 16px 40px rgba(2,6,23,0.12)', z: 40 }
} as const;

export type ElevationTokens = typeof elevationTokens;
