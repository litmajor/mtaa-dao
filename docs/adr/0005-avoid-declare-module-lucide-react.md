## ADR 0005 — Avoid adding an ambient `declare module 'lucide-react'`

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

The client codebase uses `lucide-react` for SVG icon components. During a strict TypeScript build the compiler reported missing type declarations for `lucide-react`. A common quick fix is to add an ambient declaration such as:

```ts
// declarations.d.ts
declare module 'lucide-react';
```

This silences the compiler by treating the module as `any`, which immediately removes the type errors.

There is a documentation file listing available icons in the repository at [docs/Lucide-rect-v0.563.0.md](docs/Lucide-rect-v0.563.0.md) which describes the correct public API and the preferred usage: `import { IconName } from 'lucide-react'`.

## Decision

We will NOT add any ambient `declare module 'lucide-react'` file to the repository. Instead we insist on using the resources provided in [docs/Lucide-rect-v0.563.0.md](docs/Lucide-rect-v0.563.0.md) and follow one of the sound, typed approaches below.

Recommended actions (in order):

1. Prefer direct named imports from `lucide-react` (e.g. `import { X } from 'lucide-react'`) for icons used in the codebase. This uses the library's intended API and improves tree-shaking.
2. Check whether the installed `lucide-react` release includes types. If it does not, open an issue or PR against the upstream package to add or improve types.
3. If upstream typing is not available and a short-term local solution is needed, create a local typed wrapper that explicitly re-exports only the icons the app uses with concrete component types (a narrow, explicit shim), rather than an ambient `declare module` that returns `any` for everything.
4. As an alternate temporary measure, add a minimal, per-icon typed file under `client/src/icons/` that re-exports the icon components with `React.FC<...>` or the appropriate typed signature — this preserves editor tooling and prevents masking unrelated type issues.

## Rationale

- Adding an ambient `declare module 'lucide-react'` effectively wipes out type information for the entire module and collapses it to `any`. That:
  - Masks real typing problems elsewhere in the codebase.
  - Prevents autocompletion and accurate editor hints for icons and their props.
  - Encourages technical debt and inhibits future safe refactors.
  - Can hide breaking changes if the package API changes (runtime mismatches may go unnoticed during compile time).
  - Defeats the purpose of a strict TypeScript configuration and the `verbatimModuleSyntax` discipline we enforced.

- A narrowly scoped, explicit typed wrapper keeps the surface area small, preserves type-safety, and keeps a clear migration path to upstream types when they become available.

## Alternatives considered

- Add `declare module 'lucide-react';` — Rejected for reasons in Rationale.
- Add `@types/lucide-react` (if available) — Acceptable if the types are maintained and match the installed runtime; prefer upstream types instead of DefinitelyTyped only if they are accurate.
- Pin the project to a different icon package that ships types — possible but disruptive and should be weighed against migration cost.

## Consequences

- Short-term developer friction: the team must either contribute types upstream or maintain a small local shim. This costs a little time now but avoids long-term type debt.
- Better long-term maintainability: code remains typed, editors provide correct completions, and the build system accurately reflects API compatibility.

## Example: small local typed re-export (recommended temporary pattern)

Create a specific file such as `client/src/icons/used-icons.tsx` with explicit named exports for only the icons you use. Example pattern (pseudo-code):

```ts
import type { FC, SVGProps } from 'react';
import { IconName as RawIconName } from 'lucide-react';

// Re-export with an explicit type that the app relies on
export const IconName: FC<SVGProps<SVGSVGElement>> = RawIconName;
```

This keeps the surface small (only icons actually used), preserves types, and avoids ambient `any`.

## Action items

- Developers: Do not add ambient declaration shims. If you encounter `lucide-react` missing types, follow the Decision steps.
- Frontend owner: Create the small typed re-export file(s) for icons used in the app as a short-term shim, or open a PR to add types upstream.
- Team: Add a short note in the repo contributing guide or TypeScript policy that forbids adding `declare module '...'` shims without a formal ADR.

## References

- Icon registry and guidance: [docs/Lucide-rect-v0.563.0.md](docs/Lucide-rect-v0.563.0.md)
- Type safety policy: prefer explicit and narrow shims over ambient `declare module` blocks.
