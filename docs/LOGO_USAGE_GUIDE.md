# Mtaa DAO Logo Usage Guide

This guide explains how to properly use Mtaa DAO logos and branding assets throughout the application for consistent brand identity.

## Table of Contents
1. [Logo Assets Location](#logo-assets-location)
2. [Logo Component Usage](#logo-component-usage)
3. [Logo Variants](#logo-variants)
4. [Size Guidelines](#size-guidelines)
5. [Theme Support](#theme-support)
6. [Common Use Cases](#common-use-cases)
7. [Best Practices](#best-practices)

---

## Logo Assets Location

All logo assets are organized in the `mtaa_dao_logos/` folder with the following structure:

```
mtaa_dao_logos/
├── icon_dark_sm.png       # Small icon, dark theme
├── icon_dark_md.png       # Medium icon, dark theme
├── icon_dark_lg.png       # Large icon, dark theme
├── icon_dark_banner.png   # Banner icon, dark theme
├── icon_light_sm.png      # Small icon, light theme
├── icon_light_md.png      # Medium icon, light theme
├── icon_light_lg.png      # Large icon, light theme
├── icon_light_banner.png  # Banner icon, light theme
├── full_logo_dark_sm.png  # Small full logo, dark theme
├── full_logo_dark_md.png  # Medium full logo, dark theme
├── full_logo_dark_lg.png  # Large full logo, dark theme
├── full_logo_dark_banner.png # Banner full logo, dark theme
├── full_logo_light_sm.png    # Small full logo, light theme
├── full_logo_light_md.png    # Medium full logo, light theme
├── full_logo_light_lg.png    # Large full logo, light theme
└── full_logo_light_banner.png # Banner full logo, light theme
```

### Naming Convention
- **Variant**: `icon` (logo mark only) or `full_logo` (logo + text)
- **Theme**: `dark` or `light`
- **Size**: `sm`, `md`, `lg`, or `banner`
- **Format**: Both `.png` and `.jpg` versions available

---

## Logo Component Usage

We have created reusable React components for consistent logo implementation across the app.

### Import the Logo Component

```typescript
import { Logo, AnimatedLogo, HeroLogo } from '@/components/ui/logo';
```

### Basic Logo Component

The base `Logo` component provides flexible logo rendering:

```tsx
<Logo 
  variant="icon"           // 'icon' or 'full'
  size="md"                // 'sm', 'md', 'lg', or 'banner'
  className="custom-class" // Optional additional CSS classes
  forceTheme="dark"        // Optional: force specific theme
/>
```

### AnimatedLogo Component

For logos with hover animations:

```tsx
<AnimatedLogo 
  variant="full" 
  size="md"
  className="custom-class"
/>
```

### HeroLogo Component

For hero sections with glow effects:

```tsx
<HeroLogo 
  variant="icon" 
  size="lg"
  forceTheme="dark"
/>
```

---

## Logo Variants

### Icon Variant
**When to use:** App icons, favicons, navigation bars, mobile displays, avatars, small spaces

```tsx
<Logo variant="icon" size="md" />
```

**Features:**
- Displays only the logo mark (without text)
- Perfect for square spaces
- Maintains brand recognition in minimal space
- Recommended for responsive mobile layouts

### Full Logo Variant
**When to use:** Headers, landing pages, marketing materials, login/register pages, large displays

```tsx
<Logo variant="full" size="md" />
```

**Features:**
- Displays logo mark + brand name
- Better brand communication
- Ideal for first impressions
- Use when space allows

---

## Size Guidelines

### Size Options

| Size     | Icon Dimensions | Usage Context                              | Component Size |
|----------|----------------|---------------------------------------------|----------------|
| `sm`     | 24x24px        | Small UI elements, inline text, badges     | w-6 h-6        |
| `md`     | 40x40px        | Navigation bars, default usage             | w-10 h-10      |
| `lg`     | 64x64px        | Page headers, profile sections             | w-16 h-16      |
| `banner` | 80x80px        | Hero sections, landing pages, splash       | w-20 h-20      |

### Choosing the Right Size

```tsx
// Navigation bar
<AnimatedLogo variant="full" size="md" />

// Mobile nav (icon only)
<AnimatedLogo variant="icon" size="sm" />

// Landing page hero
<HeroLogo variant="icon" size="banner" />

// Page header
<Logo variant="full" size="lg" />

// Inline badge/avatar
<Logo variant="icon" size="sm" />
```

---

## Theme Support

### Automatic Theme Detection

By default, logos automatically adapt to the current theme:

```tsx
// Automatically uses light/dark variant based on theme
<Logo variant="icon" size="md" />
```

### Force Specific Theme

Override theme detection when needed:

```tsx
// Always use dark logo (e.g., on light background)
<Logo variant="icon" size="md" forceTheme="dark" />

// Always use light logo (e.g., on dark background)
<Logo variant="icon" size="md" forceTheme="light" />
```

### Best Practices for Theme Usage

- **Light Theme Logos**: Use on dark backgrounds (navigation on dark mode, dark hero sections)
- **Dark Theme Logos**: Use on light backgrounds (navigation on light mode, light hero sections)
- **Auto Detection**: Default behavior for most components that respect user theme preference

---

## Common Use Cases

### 1. Navigation Bar

```tsx
import { AnimatedLogo } from '@/components/ui/logo';

<nav>
  <Link href="/">
    {/* Desktop: Show full logo */}
    <AnimatedLogo 
      variant="full" 
      size="md"
      className="hidden sm:flex"
    />
    
    {/* Mobile: Show icon only */}
    <AnimatedLogo 
      variant="icon" 
      size="md"
      className="sm:hidden"
    />
  </Link>
</nav>
```

### 2. Landing Page Hero

```tsx
import { HeroLogo } from '@/components/ui/logo';

<div className="hero-section">
  <HeroLogo 
    variant="icon" 
    size="banner" 
    forceTheme="dark"  // Dark logo on light/gradient background
  />
  <h1>Welcome to Mtaa DAO</h1>
</div>
```

### 3. Login/Register Pages

```tsx
import { HeroLogo } from '@/components/ui/logo';

<div className="auth-container">
  <div className="relative">
    <HeroLogo variant="icon" size="lg" forceTheme="dark" />
    <div className="absolute -top-2 -right-2 badge">
      <Sparkles className="w-4 h-4" />
    </div>
  </div>
  <h1>Welcome Back</h1>
  {/* Login form */}
</div>
```

### 4. Favicon and Manifest

**HTML (client/index.html):**
```html
<link rel="icon" type="image/png" sizes="32x32" 
      href="/attached_assets/mtaa_dao_logos/icon_dark_sm.png" />
<link rel="apple-touch-icon" sizes="180x180" 
      href="/attached_assets/mtaa_dao_logos/icon_dark_md.png" />
```

**Manifest (client/public/manifest.json):**
```json
{
  "icons": [
    {
      "src": "/attached_assets/mtaa_dao_logos/icon_dark_sm.png",
      "sizes": "64x64",
      "type": "image/png"
    },
    {
      "src": "/attached_assets/mtaa_dao_logos/icon_dark_md.png",
      "sizes": "128x128",
      "type": "image/png"
    }
  ]
}
```

### 5. Email Templates / Marketing Materials

When using logos in contexts outside React components:

```html
<!-- Use appropriate size and theme for your background -->
<img 
  src="/attached_assets/mtaa_dao_logos/full_logo_dark_lg.png" 
  alt="Mtaa DAO" 
  width="256"
  height="auto"
/>
```

### 6. Loading States / Splash Screens

```tsx
<div className="loading-screen">
  <HeroLogo variant="icon" size="lg" />
  <div className="spinner" />
</div>
```

---

## Best Practices

### ✅ Do's

1. **Use the Logo Component**: Always prefer the React components over direct img tags for consistency
2. **Respect Theme**: Let logos automatically adapt to theme unless there's a specific design reason
3. **Choose Appropriate Variant**: Use icon variant for compact spaces, full logo for branding
4. **Maintain Aspect Ratio**: Never stretch or distort logos
5. **Provide Alt Text**: Always include meaningful alt text for accessibility
6. **Use Proper Sizes**: Choose the size that matches your use case from the guidelines
7. **Consistent Path**: Always use `/attached_assets/mtaa_dao_logos/` as the base path

### ❌ Don'ts

1. **Don't Create Custom Logos**: Always use official assets from `mtaa_dao_logos/`
2. **Don't Modify Colors**: Logos are pre-themed; don't apply filters or color changes
3. **Don't Use Wrong Format**: Match the format (PNG for transparency, JPG for solid backgrounds)
4. **Don't Hardcode Paths**: Use the Logo component which handles paths automatically
5. **Don't Mix Themes Improperly**: Dark logos on dark backgrounds = poor visibility
6. **Don't Scale Incorrectly**: Use the pre-sized variants rather than CSS scaling when possible
7. **Don't Use Gradient Placeholders**: Always use actual logo assets, not "M" placeholders

### Accessibility Guidelines

```tsx
// Good: Meaningful alt text
<Logo variant="icon" size="md" alt="Mtaa DAO Home" />

// Good: Descriptive for screen readers
<Logo variant="full" size="lg" alt="Mtaa DAO - Community Powered Finance" />

// Avoid: Generic alt text
<Logo variant="icon" size="md" alt="logo" /> // ❌
```

### Performance Considerations

- Use appropriately sized logos to avoid loading unnecessarily large files
- PNG format for icons needing transparency
- JPG format can be used for solid backgrounds in marketing materials
- Consider lazy loading for logos below the fold
- Pre-load critical logos (navigation, hero sections)

---

## Component API Reference

### Logo Props

| Prop           | Type                          | Default  | Description                              |
|----------------|-------------------------------|----------|------------------------------------------|
| `variant`      | `'icon' \| 'full'`           | `'icon'` | Logo variant to display                  |
| `size`         | `'sm' \| 'md' \| 'lg' \| 'banner'` | `'md'`  | Size of the logo                         |
| `className`    | `string`                      | -        | Additional CSS classes for container     |
| `iconClassName`| `string`                      | -        | Additional CSS classes for icon          |
| `textClassName`| `string`                      | -        | Additional CSS classes for text (full variant) |
| `forceTheme`   | `'light' \| 'dark'`          | -        | Override automatic theme detection       |
| `alt`          | `string`                      | `'Mtaa DAO'` | Alt text for accessibility          |

---

## Migration Guide

If you have existing hardcoded logo paths, migrate them to use the Logo component:

### Before (Old Code)
```tsx
<img 
  src={theme === "dark" 
    ? "/attached_assets/mtaa_dao_logos/icon_dark_md.png" 
    : "/attached_assets/mtaa_dao_logos/icon_light_md.png"
  }
  alt="Mtaa DAO Icon"
  className="w-10 h-10"
/>
```

### After (New Code)
```tsx
<Logo variant="icon" size="md" />
```

### Benefits
- ✅ Cleaner code
- ✅ Automatic theme detection
- ✅ Consistent sizing
- ✅ Built-in animations available
- ✅ Centralized logo management

---

## Support & Questions

For questions about logo usage or to request new logo variants, please:
- Check this documentation first
- Review the Logo component source: `client/src/components/ui/logo.tsx`
- Consult the design team for brand guideline questions
- Open an issue for missing logo variants or sizes

---

**Last Updated:** October 2025
**Component Location:** `client/src/components/ui/logo.tsx`
**Assets Location:** `mtaa_dao_logos/`
**Legacy Assets:** `MtaaDAO_Full_BrandAssets/` (deprecated, migrating to `mtaa_dao_logos/`)

