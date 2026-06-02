# Layer 4 — Composition Patterns

Purpose
-------
Define how UI primitives combine so pages share a systemic rhythm and avoid reimplementing layout logic.

Primitives (atomic building blocks)
----------------------------------
- Container: horizontal constraint and centering (max-width, padding)
- Stack: vertical flow with gap control
- Row: horizontal flow with gap and wrap
- Grid: responsive column layout with breakpoints
- Panel / Shell: framed area with optional header/footer
- Card: self-contained surface for a single datum or action
- Toolbar: compact horizontal action strip
- Sidebar: vertical navigation / contextual tools
- Modal: overlay with focus-trap and close controls
- List / RowItem: single-line or multi-line item with leading/trailing slots
- Slot: named content insertion point for composition

Composition rules (how primitives combine)
----------------------------------------
1. Single source of layout truth: put global layout primitives in `Shell` components. Pages must plug into Shell via named slots to inherit spacing and navigation.
2. Prefer composition over deep nesting: surface-level components (Card, Panel) accept `header`, `body`, `footer` slots instead of arbitrary children structures.
3. Declarative layout APIs: expose props like `direction`, `gap`, `align`, `wrap`, and `responsive` breakpoints rather than imperative CSS in consumers.
4. Tokens and variables: use CSS variables for spacing, radii, elevation, and typographic scale so composition aligns across components.
5. One responsibility per primitive: e.g., `Toolbar` manages button layout and overflow, `Sidebar` manages collapse/expand and width behavior.
6. Accessibility-first composition: every composite exposes ARIA roles and ensures keyboard focus order follows DOM composition.

Layout primitives and examples
-----------------------------

1) Dashboard Shell
- Structure: `Shell` -> `Header` (top bar) + `Sidebar` + `Main` (flow) + `Footer`.
- Slots: `brand`, `primary-nav`, `user-actions`, `main`.
- Behavior: `Sidebar` is sticky and collapsible; `Main` is a Grid with responsive columns.

HTML-like example

```html
<Shell>
  <Header slot="brand">...</Header>
  <Sidebar slot="primary-nav" collapsed="false">...</Sidebar>
  <Main slot="main">
    <Grid columns="3" gap="lg">...</Grid>
  </Main>
</Shell>
```

2) Data Card
- Structure: `Card` with `header`, `meta`, `content`, `actions` slots.
- Rules: header contains title + optional icon; meta uses muted type scale; content is flexible and can contain `List` or `Chart` primitives.

Snippet

```html
<Card variant="elevated">
  <CardHeader>Title</CardHeader>
  <CardBody>Key metric or chart</CardBody>
  <CardFooter><Button>Action</Button></CardFooter>
</Card>
```

3) Sidebar
- Structure: `Sidebar` composed of `NavList` and optional `ContextPanel` slots.
- Behavior: supports `position` (left/right), `collapse`, `overlayOnMobile`.

4) Toolbar
- Structure: horizontal `Toolbar` with grouped `ToolGroup` elements; supports overflow menu.

5) Panel layout
- Panels are layout containers with optional `resizable` handles and `sticky` header.
- Panels inside `Main` should be placed using `Grid` or `Stack` primitives to control flow.

6) Member list row
- Structure: `List` of `ListItem` primitives where each `ListItem` exposes `leading`, `content`, `trailing` slots.
- Rules: keep rows simple; complex interactions go into a contextual `Popover` or `Drawer` not inline expansion.

7) Modal structure
- Structure: `Modal` -> `Dialog` with `header` (title + close), `body`, `footer` (actions).
- Accessibility: `role="dialog"`, `aria-modal="true"`, focus trap, return focus to trigger, ESC to close.

Systemic rhythm (spacing, alignment, and flow)
-------------------------------------------
- Spacing: define tiers `space-xs`, `space-sm`, `space-md`, `space-lg`, `space-xl` as CSS variables and use them in primitives.
- Rhythm rules: headings use vertical rhythm spacing above and below; lists get `space-sm` between items; cards get `space-md` internal padding.
- Alignment: use a 12-column grid baseline for wide layouts; center content within `Container` at breakpoint widths.

Implementation notes and APIs
---------------------------
- Component props (recommended shape):
  - `variant` (string): visual style (flat, elevated, outline)
  - `size` (string): sm/md/lg
  - `responsive` (object): breakpoints to columns/gap
  - `slots` (named children): header/body/footer/leading/trailing
  - `behavior` flags: `collapsible`, `resizable`, `sticky`

- CSS guidance:
  - Export tokens in `:root` or a theme file.
  - Implement `Stack`/`Row` as utility components that map to `display:flex` + gap via CSS variable rather than margin hacks.
  - Use CSS containment where appropriate for heavy components (charts) to reduce layout thrash.

- Accessibility checklist:
  - Ensure landmark roles on `Header`, `Main`, `Sidebar`, `Footer`.
  - Use `aria-labelledby`/`aria-describedby` for dialogs and cards when needed.
  - Ensure all interactive primitives are keyboard-focusable and have visible focus styles.

Patterns to avoid
-----------------
- Deeply nested layout logic inside pages; prefer composing well-defined primitives.
- Inline style blocks to control spacing — prefer tokens and primitive props.
- Expanding rows that change DOM order — use overlays/drawers for complex interactions.

Next steps
----------
- Apply these primitives to existing pages: refactor one canonical page (dashboard) to use `Shell` + `Grid` + `Card`.
- Incrementally replace ad-hoc layouts with primitives and keep the doc updated.

---
Generated by pairing with the repo—place this file under docs for team reference.
