---
name: ORM Audit
description: Detect inefficient ORM usage
invokable: true
---

Analyze ORM usage.

Check:
- N+1 query patterns
- eager vs lazy loading misuse
- unnecessary hydration
- redundant entity fetching
- inefficient relations

Output:
- issues
- optimized ORM usage
- raw SQL alternatives if justified