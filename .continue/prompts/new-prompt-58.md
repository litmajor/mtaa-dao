---
name: Feature Bundling Strategy
description: Decide what ships together
invokable: true
---

Group features into release units.

Rules:
- tightly coupled features ship together
- independent features can be split
- avoid partial flows that break UX
- consider dependencies and blockers
- balance risk and value in each release
- aim for cohesive user experiences in each release

Output:
- feature groups
- dependencies
- recommended release order