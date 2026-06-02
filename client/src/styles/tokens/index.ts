export * from './color';
export * from './spacing';
export * from './typography';
export * from './elevation';
export * from './motion';
export * from './radius';
export * from './opacity';
export * from './blur';

// helper: apply tokens as CSS variables at runtime
export function installTokens() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  try {
    const { colorTokens } = require('./color');
    const { spacingTokens } = require('./spacing');
    const { typographyTokens } = require('./typography');
    const { elevationTokens } = require('./elevation');
    const { motionTokens } = require('./motion');
    const { radiusTokens } = require('./radius');
    const { opacityTokens } = require('./opacity');
    const { blurTokens } = require('./blur');

    // Palette -> color-* vars
    const palette = (colorTokens as any).palette || {};
    Object.entries(palette).forEach(([k, v]) => {
      root.style.setProperty(`--color-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`, String(v));
    });

    // Semantic colors
    const semanticMap: Record<string, any> = {
      'semantic-background': colorTokens.background,
      'semantic-foreground': colorTokens.textPrimary,
      'semantic-card': colorTokens.surface,
      'semantic-card-foreground': colorTokens.textPrimary,
      'semantic-primary': colorTokens.interactive,
      'semantic-primary-foreground': '#ffffff',
      'semantic-secondary': colorTokens.accent,
      'semantic-secondary-foreground': '#ffffff',
      'semantic-muted': colorTokens.textSecondary,
      'semantic-muted-foreground': colorTokens.textSecondary,
      'semantic-accent': colorTokens.accent,
      'semantic-destructive': colorTokens.danger,
      'semantic-border': colorTokens.border,
      'semantic-input': colorTokens.surface,
      'semantic-ring': colorTokens.interactive,
      'sidebar-background': colorTokens.surface,
      'sidebar-foreground': colorTokens.textPrimary,
      'sidebar-primary': colorTokens.interactive,
      'sidebar-primary-foreground': '#ffffff',
      'sidebar-accent': colorTokens.accent,
      'sidebar-accent-foreground': '#ffffff',
      'sidebar-border': colorTokens.border,
      'sidebar-ring': colorTokens.interactive,
    };
    Object.entries(semanticMap).forEach(([k, v]) => root.style.setProperty(`--${k}`, String(v)));

    // spacing
    root.style.setProperty('--space-xs', `${(spacingTokens as any).sp2}px`);
    root.style.setProperty('--space-sm', `${(spacingTokens as any).sp3}px`);
    root.style.setProperty('--space-md', `${(spacingTokens as any).sp4}px`);
    root.style.setProperty('--space-lg', `${(spacingTokens as any).sp5}px`);
    root.style.setProperty('--space-xl', `${(spacingTokens as any).sp6}px`);
    root.style.setProperty('--space-2xl', `${(spacingTokens as any).sp7}px`);

    // font sizes
    const sizes = (typographyTokens as any).sizes || {};
    Object.entries(sizes).forEach(([k, v]) => {
      if (v && (v as any).fontSize) root.style.setProperty(`--font-size-${k.replace(/[^a-z0-9]/gi, '-')}`, (v as any).fontSize);
    });
    // small aliases
    root.style.setProperty('--font-size-base', (sizes as any).md?.fontSize || '16px');
    root.style.setProperty('--font-size-sm', (sizes as any).sm?.fontSize || '14px');
    root.style.setProperty('--font-size-lg', (sizes as any).lg?.fontSize || '18px');

    // radii
    Object.entries(radiusTokens as any).forEach(([k, v]) => root.style.setProperty(`--border-radius-${k}`, String(v)));

    // shadows (map elevation)
    Object.entries(elevationTokens as any).forEach(([k, v]) => {
      root.style.setProperty(`--shadow-${k}`, (v as any).shadow);
    });

    // animation/motion
    Object.entries((motionTokens as any).duration || {}).forEach(([k, v]) => {
      root.style.setProperty(`--animation-duration-${k}`, String(v));
    });
    Object.entries((motionTokens as any).ease || {}).forEach(([k, v]) => {
      root.style.setProperty(`--animation-easing-${k}`, String(v));
    });

    // opacity and blur
    Object.entries(opacityTokens as any).forEach(([k, v]) => root.style.setProperty(`--opacity-${k}`, String(v)));
    Object.entries(blurTokens as any).forEach(([k, v]) => root.style.setProperty(`--blur-${k}`, String(v)));

    // for compatibility also set old mtaa-prefixed vars
    Object.entries(colorTokens as any).forEach(([k, v]) => {
      const key = `--mtaa-color-${k.replace(/[A-Z]/g, s => `-${s.toLowerCase()}`)}`;
      root.style.setProperty(key, typeof v === 'string' ? v : String(v));
    });

    // gradients
    if ((colorTokens as any).gradients) {
      Object.entries((colorTokens as any).gradients).forEach(([k, v]) => {
        root.style.setProperty(`--gradient-${k}`, String(v));
      });
    }
  } catch (e) {
    // ignore in SSR
    // console.warn('installTokens failed', e);
  }
}
