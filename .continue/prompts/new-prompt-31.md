---
name: SQL Security Audit
description: Prevent injection and unsafe queries
invokable: true
---

Audit database interaction code for security issues.

Check:
- string interpolation in queries
- unsafe ORM raw execution
- missing parameterization
- improper escaping
- privilege misuse

Output:
- vulnerabilities
- exploit scenarios
- corrected implementation