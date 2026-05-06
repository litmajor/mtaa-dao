---
name: State Management Audit
description: Fix messy or inefficient state
invokable: true
---

Analyze state management in this code.

Check:
- unnecessary global state
- duplicated state
- derived state not memoized
- improper async handling
- tight coupling between components

Output:
- problems
- improved state structure
- suggested pattern (local vs global vs server state)