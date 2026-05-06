---
name: Frontend-Backend Contract Audit
description: Ensure UI and API align
invokable: true
---

Compare frontend usage with backend API.

Check:
- field mismatches
- naming inconsistencies
- missing/extra fields
- incorrect data types
- assumptions in UI not enforced by backend
- missing validations in backend that UI relies on
- potential breaking changes in API that UI doesn't handle
- versioning issues where UI expects a different API version than what's deployed
- inconsistent error handling between frontend and backend
- authentication/authorization mismatches where frontend assumes access that backend doesn't allow
- performance implications of API responses that UI doesn't account for (e.g., large payloads, slow endpoints)
- security implications of API responses that UI doesn't handle properly (e.g., sensitive data exposure, lack of input sanitization)

Output:
- mismatches
- breaking risks
- fixes (frontend + backend)