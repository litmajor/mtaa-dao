---
name: Defer Analysis
description: Identify safe-to-delay work
invokable: true
---

Analyze what can be deferred.

Check:
- does it affect core functionality?
- does it introduce risk if delayed?
- is it a nice-to-have or a must-have for the initial release?
- does it have dependencies that would be impacted by deferral?
- what is the impact on user experience if deferred?
- are there any regulatory or compliance implications of deferral?

Output:
- safe to defer
- should not defer
- reasoning
- next steps for deferred work
- potential timeline for deferred work
- communication plan for deferred work
- impact assessment of deferral on project timeline and resources