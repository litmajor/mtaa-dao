export const colorTokens = {
  // palette (raw)
  palette: {
    slate50: 'hsl(210 40% 98%)',
    slate100: 'hsl(210 30% 96%)',
    slate200: 'hsl(210 25% 92%)',
    purple500: 'hsl(260 80% 62%)',
    orange500: 'hsl(24 95% 55%)',
    pink500: 'hsl(330 85% 60%)',
    emerald500: 'hsl(150 60% 45%)',
  },

  // semantic
  background: 'hsl(220 10% 98%)',
  surface: 'hsl(0 0% 100%)',
  textPrimary: 'hsl(220 15% 12%)',
  textSecondary: 'hsl(220 10% 40%)',
  interactive: 'hsl(250 85% 60%)',
  accent: 'hsl(330 85% 60%)',
  success: 'hsl(145 60% 40%)',
  warning: 'hsl(42 95% 55%)',
  danger: 'hsl(355 75% 55%)',
  border: 'hsl(220 10% 88%)',
  overlay: 'rgba(2,6,23,0.6)'
  ,
  // gradients (tokenized)
  gradients: {
    mtaa: 'linear-gradient(135deg, #FF7F3F 0%, #8B5FBF 100%)',
    orangePink: 'linear-gradient(90deg, #FB923C 0%, #F472B6 100%)',
    purplePink: 'linear-gradient(90deg, #7C3AED 0%, #EC4899 100%)'
  }
} as const;

export type ColorTokens = typeof colorTokens;
