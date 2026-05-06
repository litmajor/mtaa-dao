---
name: Gas & DoS Audit
description: Performance and denial-of-service risks
invokable: true
---

Analyze this contract for gas inefficiencies and DoS risks.

Check:
- unbounded loops
- expensive storage operations
- user-controlled gas paths
- block gas limit risks

Output:
- problematic areas
- DoS scenarios
- optimized alternatives