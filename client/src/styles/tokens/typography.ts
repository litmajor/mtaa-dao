export const typographyTokens = {
  family: {
    base: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
  },
  sizes: {
    xs: { fontSize: '12px', lineHeight: '16px', weight: 400 },
    sm: { fontSize: '14px', lineHeight: '20px', weight: 400 },
    md: { fontSize: '16px', lineHeight: '24px', weight: 400 },
    lg: { fontSize: '18px', lineHeight: '28px', weight: 600 },
    xl: { fontSize: '20px', lineHeight: '28px', weight: 700 },
    '2xl': { fontSize: '24px', lineHeight: '32px', weight: 800 },
  }
} as const;

export type TypographyTokens = typeof typographyTokens;
