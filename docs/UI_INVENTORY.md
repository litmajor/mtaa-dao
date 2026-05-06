# UI Inventory & Consistency Audit

Date: 2026-01-14
Author: assistant (audit)

Scope: full inventory of key UI components, color tokens, typography, spacing, bottom navigation, and routing references in the `client/` app. Includes findings, concrete inconsistencies, fixes already applied, and prioritized remediation steps.

---

## Locations scanned

- Frontend root: `client/`
- Entry: `client/src/main.tsx`, `client/src/App.tsx`
- Styles and theme variables: `client/src/index.css`, `tailwind.config.ts`, `client/src/styles/theme-variables.css` (imported)
- UI primitives: `client/src/components/ui/*` (buttons, badge, input, theme-provider)
- Shared components and navigation: `client/src/components/navigation.tsx`, `client/src/components/mobile-nav.tsx`
- Pages: `client/src/pages/*` (many pages — `daos.tsx`, `proposals.tsx`, `exchange-markets.tsx`, etc.)

---

## High-level findings

- Design tokens implemented using CSS variables (declared in `client/src/index.css`) plus Tailwind mappings in `tailwind.config.ts` that map semantic color names to the CSS variables.
- There is a centralized component library in `client/src/components/ui/` with well-structured primitives (`button.tsx`, `badge.tsx`, `input.tsx`). These components mostly use semantic tokens (e.g., `bg-primary`, `text-primary-foreground`). Good separation of concerns.
- Some parts of the app still use hard-coded brand classes (e.g., `text-mtaa-orange`, `bg-mtaa-gradient`) or direct Tailwind color classes (`text-gray-600`) instead of the semantic tokens provided by the design system. This causes inconsistencies across light/dark modes.
- Dark theme variables are defined in `.dark { ... }` overrides inside `index.css` — this is correctly used to switch themes globally.
- The mobile bottom navigation previously referenced non-existent routes (`/groups`, `/activity`) — I fixed these and added redirects. See "Patches applied" below.

---

## Component Inventory (selected)

- UI primitives (`client/src/components/ui/`):
  - `button.tsx` — uses `buttonVariants` with semantic variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`.
  - `badge.tsx` / `badge-design.tsx` — badges available, variants supported.
  - `input.tsx`, `select.tsx`, `textarea.tsx` — form primitives using `input` semantic token.
  - `theme-provider.tsx` — theme context and dark-mode toggling is present (responsible for toggling `.dark` on root).

- Navigation & Layout:
  - `navigation.tsx` — desktop navigation (lazy loaded in App)
  - `mobile-nav.tsx` — bottom navigation (updated to new primary order and categorized More menu)
  - `components/AnnouncementsBanner.tsx`, `components/MorioProvider.tsx`, `components/WalletDashboard.tsx` — other global UI

- Pages (examples): `pages/daos.tsx`, `pages/proposals.tsx`, `pages/exchange-markets.tsx`, `pages/defi-dex.tsx`, `pages/wallet.tsx`, `pages/vault-dashboard.tsx`, etc.

---

## Color & Theme Findings

1. Tokenization exists and is good: `--primary`, `--background`, `--foreground`, `--card`, `--sidebar-*`, etc. `tailwind.config.ts` maps Tailwind tokens to CSS variables (recommended setup).

2. Non-semantic usages found (examples):
   - `text-mtaa-orange` and `bg-mtaa-gradient` utilities in `index.css` and some components: these are brand-specific utilities that bypass semantic `primary` tokens. While useful for branding, they create inconsistency in dark mode unless explicitly handled.
   - Literal Tailwind color classes used in page content, e.g. `text-gray-600`, `text-gray-900`, `bg-white/95` — these are fine when used with care, but should be audited and replaced with semantic tokens where the color conveys meaning (primary/secondary/disabled/destructive).

3. Dark mode: CSS variables include dark overrides — components that use semantic tokens adapt correctly. Components using `text-mtaa-orange` will still work, but brand-only colors may not provide appropriate contrast on dark backgrounds.

4. Accessibility: focus-visible outlines are applied in `index.css`. Touch target sizes are enforced for buttons/controls. Contrast should be re-checked for any element using brand colors directly.

---

## Typography & Spacing Findings

- `tailwind.config.ts` maps semantic font sizes to CSS variables (`--font-size-base`, `--font-size-lg`, etc.). `index.css` sets HTML base font-size and responsive scaling.
- Several components use Tailwind classes like `text-xs`, `text-lg` directly — acceptable for layout, but key semantic text (headings, content body, captions) should use the design token classes (e.g., `text-responsive-base`, `text-responsive-lg`) for consistency.
- Spacing variables are defined and mapped to tailwind spacing tokens. A small number of components still use pixel-based classes (`px-8`, `py-6`) — consider mapping these to semantic spacing tokens to keep consistent rhythm.

---

## Routing & Page Reference Findings

- Many pages exist under `client/src/pages/`. The common pages used in navigation are present: `/dashboard`, `/daos`, `/exchange-markets`, `/defi-dex`, `/wallet`.
- Missing route references found previously: `/groups` and `/activity`. These have been corrected:
  - Patch: `client/src/components/mobile-nav.tsx` updated to use `/daos` and `/proposals`.
  - Patch: `client/src/App.tsx` added redirect routes `/groups` -> `/daos` and `/activity` -> `/proposals`.

---

## Patches applied (already committed)

1. `client/src/components/mobile-nav.tsx`
   - Reordered primary nav to: `/dashboard`, `/daos`, `/exchange-markets`, `/defi-dex`, `/wallet`.
   - Expanded "More" menu into categorized sections and mapped each item to an existing route (Markets & Trading, Earn & Vaults, DAO & Governance, Tools & Analytics, Account & More).

2. `client/src/App.tsx`
   - Added redirect routes for legacy paths: `/groups` -> `/daos`, `/activity` -> `/proposals`.

These patches address immediate broken links and improve discoverability.

---

## Concrete Inconsistencies (examples & locations)

- Hard-coded brand color: `text-mtaa-orange` is used in components and utility classes (e.g., `mobile-nav.tsx` uses it for active state). Prefer using `text-primary` + `bg-primary/10` to follow semantic tokens.
- Direct Tailwind gray classes: `text-gray-600`, `bg-white/95` found in `App.tsx` and in page components; recommend replacing with `muted` or `card` tokens where the color expresses intent rather than neutral layout.
- Icon sizing inconsistent: some icons use `w-5 h-5`, some `w-6 h-6`. Standardize small/medium/large icon sizes in `ui/icon-design.tsx` or tokens.
- Button spacing: some buttons use `rounded-xl` + `px-3 py-2`, but UI primitive `Button` uses `rounded-md` and variant heights — prefer centralizing button visuals by using `Button` everywhere rather than ad-hoc classes.

---

## Recommended fixes & priority

Immediate (low effort)
- Replace active class usage `text-mtaa-orange bg-mtaa-orange/10` in `mobile-nav` with semantic tokens: `text-primary bg-primary/10` (I can do this quickly). This ensures active state uses the `--primary` token and follows dark/light rules.
- Add an ESLint/Stylelint rule (or Tailwind plugin) warning on `text-mtaa-*` usage to avoid future drift.

Short term (medium effort)
- Codemod: run a repo-wide replace for these patterns:
  - `text-mtaa-\w+` -> `text-primary` (review exceptions)
  - `bg-mtaa-gradient` -> use a `branding-gradient` utility that adapts to dark mode via tokens.
- Replace direct `text-gray-*` usages in top-level semantic elements (headers, paragraphs, card text) with `foreground`, `muted-foreground`, `card-foreground` tokens.
- Standardize icon size tokens and update `ui/icon-design.tsx` to export `IconSmall`, `IconMedium`, `IconLarge` wrappers.

Longer term (larger effort)
- Visual regression tests (Percy/Chromatic) to catch visual regressions when tokens change.
- Add Playwright/Cypress end-to-end tests that cover navigation and More menu links.
- Migrate all brand styles into semantic tokens and remove direct `mtaa-*` utilities or keep them only for brand elements where appropriate (logo, hero, marketing banners).

---

## Quick action plan I can run now (pick one)

1. Produce a codemod PR to replace active class colors in `mobile-nav.tsx` and other immediate usages with semantic tokens (I can implement and run tests). (Estimated: 0.5–1 day)
2. Run a repo-wide grep to list files using `text-mtaa-` and `bg-mtaa-` and produce a patch candidate (safe, non-destructive). (Estimated: 1–2 hours)
3. Create `ui/tests/e2e/mobile-nav.spec.ts` (Playwright) that navigates mobile nav and asserts routes exist and the More menu contains all grouped items. (Estimated: 1 day)

---

## Next steps (recommended)

1. Confirm you want me to proceed with the codemod to replace brand utilities with semantic tokens — I will produce a PR with changes in small batches for review.
2. I can also add Playwright smoke tests for the mobile nav and More menu to prevent regressions.
3. If you prefer, I will produce the repo-wide usage list of `text-mtaa-*` so you can review scope before automated replacements.

---

Files referenced in this audit:
- `client/src/components/mobile-nav.tsx` (edited)
- `client/src/App.tsx` (edited for redirects)
- `client/src/index.css` (theme variables and utilities)
- `tailwind.config.ts` (token mapping)
- `client/src/components/ui/button.tsx` and other ui primitives

---

If you approve, I will run the repo-wide scan for `text-mtaa-` and `bg-mtaa-` usages and prepare a careful PR that replaces active/semantic usages with `primary` tokens, leaving purely marketing/banner instances untouched.
