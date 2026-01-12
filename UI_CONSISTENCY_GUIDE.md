# UI Consistency Guide - Visualization Components

## Overview
This guide documents the unified UI styling applied across all visualization components (FearGreedGauge, MarketChangesVisualization, BtcDominanceCard) to ensure a cohesive, professional appearance.

## Design System Standards

### Color Palette

#### Light Mode
- **Background**: `white` (#ffffff)
- **Text Primary**: `gray-900` (#111827)
- **Text Secondary**: `gray-600` (#4b5563)
- **Borders**: `gray-200` (#e5e7eb)
- **Accents**: Orange (#f97316), Green (#22c55e), Red (#ef4444), Blue (#3b82f6)

#### Dark Mode
- **Background**: `slate-800` (#1e293b)
- **Text Primary**: `white` (#ffffff)
- **Text Secondary**: `gray-400` (#9ca3af)
- **Borders**: `slate-700` (#334155)
- **Accents**: Orange (#f97316), Green (#22c55e), Red (#ef4444), Blue (#3b82f6)

### Card Styling

All data cards use consistent styling:

```tsx
// Standard card
<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 shadow-sm">
  {/* content */}
</div>

// Small card (metrics)
<div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700 shadow-sm">
  {/* content */}
</div>
```

**Properties:**
- **Rounded Corners**: `rounded-lg` (8px) for standard cards, `rounded-xl` (12px) for primary containers
- **Padding**: `p-6` for main sections, `p-4` for metric cards, `p-3` for compact elements
- **Border**: `border border-gray-200 dark:border-slate-700` (1px solid)
- **Shadow**: `shadow-sm` (0 1px 2px rgba(0,0,0,0.05))
- **Hover State**: `hover:shadow-md transition-shadow` (for interactive cards)

### Typography

#### Headings
```tsx
// Page title
<h2 className="text-xl font-bold text-gray-900 dark:text-white">
  Feature Name
</h2>

// Section heading
<h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
  Section Title
</h3>

// Metric label
<div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
  LABEL
</div>
```

**Standards:**
- **Page titles**: `text-xl font-bold` (20px, 700 weight)
- **Section headings**: `text-base font-semibold` (16px, 600 weight)
- **Labels**: `text-xs font-semibold uppercase tracking-wider` (12px, 600 weight, 0.05em letter-spacing)
- **Body text**: `text-sm` to `text-base` with appropriate weight
- **Secondary text**: `text-gray-600 dark:text-gray-400`

### Spacing & Layout

#### Vertical Spacing
- **Section gap**: `space-y-6` (24px between major sections)
- **Component gap**: `gap-4` (16px between cards)
- **Compact gap**: `gap-3` (12px between smaller elements)

#### Horizontal Spacing
- **Card padding**: 
  - Large: `p-6` (24px)
  - Medium: `p-4` (16px)
  - Small: `p-3` (12px)

#### Responsive Design
```tsx
// Example responsive layout
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Mobile: 1 column, Tablet+: 2 columns */}
</div>

// Flexible layout
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  {/* Mobile: stacked, Tablet+: horizontal */}
</div>
```

### Borders & Dividers

#### Primary Borders (cards)
```tsx
border border-gray-200 dark:border-slate-700
```

#### Accent Borders (contextual)
```tsx
// Error/Warning
border-red-200 dark:border-slate-700

// Success
border-green-200 dark:border-slate-700

// Info
border-blue-200 dark:border-slate-700
```

#### Dividers
```tsx
<div className="border-t border-gray-200 dark:border-slate-700 pt-3" />
```

### Shadows

**Shadow Scale:**
- `shadow-sm` - Subtle (0 1px 2px rgba(0,0,0,0.05))
- `shadow-md` - Medium (0 4px 6px rgba(0,0,0,0.1)) - Used on hover
- Default: All cards use `shadow-sm`

**Usage:**
```tsx
// Standard card with shadow
<div className="... shadow-sm">

// Interactive card with hover
<div className="... shadow-sm hover:shadow-md transition-shadow">
```

### Color-Coded Status Indicators

#### Background Colors
```tsx
// Red (Fear, Negative)
bg-red-50 dark:bg-slate-800
text-red-900 dark:text-red-400

// Green (Greed, Positive)
bg-green-50 dark:bg-slate-800
text-green-900 dark:text-green-400

// Blue (Info)
bg-blue-50 dark:bg-slate-800
text-blue-900 dark:text-blue-400
```

### Component-Specific Styling

#### Gauge Component (FearGreedGauge)
- **Main container**: White card with border, not dark gradient
- **Interpretation cards**: Light colored backgrounds with contextual borders
- **Metric cards**: Small cards with progress bars

#### Chart Component (MarketChangesVisualization)
- **Chart containers**: Consistent white cards
- **Chart titles**: Unified heading style (`text-base font-semibold`)
- **Metric cards**: Hover effect for interactivity

#### Bitcoin Dominance Component (BtcDominanceCard)
- **Grid layout**: Pie chart + stats using consistent card styling
- **Insight cards**: Structured layout with shadow and hover states
- **All backgrounds**: Unified to white/slate (no gradients)

## Implementation Checklist

When creating or updating components, ensure:

- [ ] **Backgrounds**: `bg-white dark:bg-slate-800`
- [ ] **Borders**: `border border-gray-200 dark:border-slate-700`
- [ ] **Shadows**: `shadow-sm` (or `shadow-sm hover:shadow-md` for interactive)
- [ ] **Rounded corners**: `rounded-lg` for standard, `rounded-xl` for primary
- [ ] **Padding**: `p-6` (main), `p-4` (cards), `p-3` (compact)
- [ ] **Text colors**: `text-gray-900 dark:text-white` (primary), `text-gray-600 dark:text-gray-400` (secondary)
- [ ] **Headings**: `text-xl font-bold` (page), `text-base font-semibold` (section)
- [ ] **Labels**: `text-xs font-semibold uppercase tracking-wider`
- [ ] **Spacing**: `space-y-6` between sections, `gap-4` between cards
- [ ] **Responsive**: Flex/grid with `md:` breakpoints
- [ ] **Dark mode**: All colors have `:dark` variants

## Code Examples

### Standard Card Pattern
```tsx
<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 shadow-sm">
  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
    Card Title
  </h3>
  {/* Content */}
</div>
```

### Small Metric Card Pattern
```tsx
<div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
    Metric Label
  </div>
  <div className="text-2xl font-bold text-gray-900 dark:text-white">
    Value
  </div>
</div>
```

### Contextual Information Card Pattern
```tsx
<div className="bg-red-50 dark:bg-slate-800 border border-red-200 dark:border-slate-700 rounded-lg p-4 shadow-sm">
  <div className="text-sm font-semibold text-red-900 dark:text-red-400 mb-2">
    ⚠️ Alert Title
  </div>
  <div className="text-xs text-red-800 dark:text-red-300">
    Alert message content
  </div>
</div>
```

## Dark Mode Considerations

**Always include dark variants:**
```tsx
// Good ✓
<div className="bg-white dark:bg-slate-800">
  <p className="text-gray-900 dark:text-white">...</p>
</div>

// Bad ✗
<div className="bg-white">
  <p className="text-gray-900">...</p>
</div>
```

**Text contrast in dark mode:**
- Primary text: `dark:text-white`
- Secondary text: `dark:text-gray-400`
- Contextual: `dark:text-red-400`, `dark:text-green-400`, `dark:text-blue-400`

## Accessibility Standards

- **Color contrast**: Meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- **Typography**: Minimum 14px for body text
- **Spacing**: Adequate padding around clickable elements (min 44px height)
- **Semantic HTML**: Use proper heading hierarchy
- **Labels**: All inputs/interactive elements have accessible labels
- **Icons**: Icons with text have proper aria-labels if text alone insufficient

## Maintenance Guidelines

### When to Update These Standards
1. **Consistency issues** - When a component deviates from standards
2. **Accessibility needs** - When contrast or spacing needs adjustment
3. **Design evolution** - When stakeholders approve design updates

### How to Update
1. Update this guide first with new standard
2. Create PR with all affected component changes
3. Update any related documentation
4. Communicate changes to team

## Related Documentation
- `DATA_VISUALIZATION_REFINEMENT.md` - Data normalization and chart scaling
- Component READMEs in respective component files
- Tailwind CSS configuration: `tailwind.config.js`

## Examples in Code

**All implemented in:**
- `client/src/components/FearGreedGauge.tsx`
- `client/src/components/MarketChangesVisualization.tsx`
- `client/src/components/BtcDominanceCard.tsx`

## Version History

| Date | Change | Author |
|------|--------|--------|
| Jan 10, 2026 | Initial UI consistency implementation | System |
| | Standardized card styling, typography, spacing | |
| | Applied dark mode support across all components | |
| | Added shadow and hover effects | |
