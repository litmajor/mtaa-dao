# 🚀 PHASE 2 - CLIENT MIGRATION GUIDE

**Start Date:** February 28, 2026  
**Deadline:** March 31, 2026  
**Status:** Ready to begin

---

## 🎯 Phase 2 Objective
Update all client code (frontend, mobile, internal tools) to use the new consolidated API paths.

---

## 📋 Migration Checklist

### Strategy Endpoints (from /api/strategy → /api/strategies)

- [ ] **List Strategies**
  ```typescript
  // OLD: GET /api/strategy
  // NEW: GET /api/strategies
  ```

- [ ] **Create Strategy**
  ```typescript
  // OLD: POST /api/strategy/create
  // NEW: POST /api/strategies
  ```

- [ ] **Get Strategy Details**
  ```typescript
  // OLD: GET /api/strategy/:id
  // NEW: GET /api/strategies/:id
  ```

- [ ] **Update Strategy**
  ```typescript
  // OLD: PUT /api/strategy/:id (if exists)
  // NEW: PUT /api/strategies/:id
  ```

- [ ] **Delete Strategy**
  ```typescript
  // OLD: DELETE /api/strategy/:id (if exists)
  // NEW: DELETE /api/strategies/:id
  ```

- [ ] **Follow Strategy**
  ```typescript
  // OLD: POST /api/strategy/:id/follow
  // NEW: POST /api/strategies/:id/follow
  ```

- [ ] **Unfollow Strategy**
  ```typescript
  // OLD: DELETE /api/strategy/:id/unfollow or POST .../unfollow
  // NEW: DELETE /api/strategies/:id/follow
  ```

- [ ] **Get My Strategies**
  ```typescript
  // OLD: GET /api/strategy/my-strategies or /api/strategy/created
  // NEW: GET /api/strategies/my/created
  ```

- [ ] **Get Performance Metrics**
  ```typescript
  // OLD: GET /api/strategy/:id/performance
  // NEW: GET /api/strategies/:id/performance
  ```

- [ ] **Search Strategies**
  ```typescript
  // OLD: GET /api/strategy/search
  // NEW: GET /api/strategies/search
  ```

- [ ] **Get Rankings/Leaderboard**
  ```typescript
  // OLD: GET /api/strategy/leaderboard/:metric
  // NEW: GET /api/strategies/rankings/:metric
  ```

- [ ] **Backtest Strategy**
  ```typescript
  // OLD: POST /api/strategies/:id/backtest (may have been here)
  // NEW: POST /api/strategies/:id/backtest
  ```

- [ ] **Deploy Strategy**
  ```typescript
  // OLD: GET /api/strategies/:id/results or deployment endpoint
  // NEW: POST /api/strategies/:id/deploy
  ```

- [ ] **Rebalance Strategy**
  ```typescript
  // OLD: POST /api/strategy/:id/rebalance or similar
  // NEW: POST /api/strategies/:id/rebalance
  ```

### Admin Endpoints (consolidated, same paths)

- [ ] **Admin Login**
  ```typescript
  // Path: POST /api/admin/auth/login
  // No change - update only if moved from different path
  ```

- [ ] **Admin Users**
  ```typescript
  // Paths: GET/PUT/DELETE /api/admin/users*
  // No change - already at /api/admin
  ```

- [ ] **AI Metrics** 
  ```typescript
  // OLD: GET /api/admin/ai-metrics (may have been separate)
  // NEW: GET /api/admin/ai-metrics
  // Still same path but now in consolidated router
  ```

---

## 🔍 How to Find All References

### Frontend (React/Vue/Angular)
```bash
# Search for old paths in your frontend code
grep -r "/api/strategy/" src/
grep -r "strategy/create" src/
grep -r "leaderboard" src/
grep -r "my-strategies" src/
```

### API Client Library
If using an API client service:
```typescript
// Find and update the base service
find src -name "*service.ts" -o -name "*api.ts" | xargs grep strategy
```

### Types/Interfaces
```bash
# Update any hardcoded types or constants
grep -r "/api/strategy" src/types/
grep -r "/api/strategy" src/constants/
```

---

## 📝 Code Migration Examples

### Example 1: Basic Fetch

**BEFORE:**
```typescript
const response = await fetch('/api/strategy/123');
const strategy = await response.json();
```

**AFTER:**
```typescript
const response = await fetch('/api/strategies/123');
const strategy = await response.json();
```

### Example 2: Create with POST

**BEFORE:**
```typescript
const response = await fetch('/api/strategy/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'My Strategy', allocations: [...] })
});
```

**AFTER:**
```typescript
const response = await fetch('/api/strategies', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'My Strategy', allocations: [...] })
});
```

### Example 3: Using Axios

**BEFORE:**
```typescript
const response = await axios.get(`/api/strategy/${strategyId}`);
```

**AFTER:**
```typescript
const response = await axios.get(`/api/strategies/${strategyId}`);
```

### Example 4: API Service Class

**BEFORE:**
```typescript
class StrategyService {
  getStrategy(id: string) {
    return fetch(`/api/strategy/${id}`);
  }
  
  createStrategy(data) {
    return fetch('/api/strategy/create', { method: 'POST', body: data });
  }
}
```

**AFTER:**
```typescript
class StrategyService {
  getStrategy(id: string) {
    return fetch(`/api/strategies/${id}`);
  }
  
  createStrategy(data) {
    return fetch('/api/strategies', { method: 'POST', body: data });
  }
}
```

---

## ✅ Testing After Migration

### 1. Manual Testing
```bash
# Test new path
curl -H "Authorization: Bearer <token>" \
  https://your-api.com/api/strategies/123

# Verify response is identical to old path
curl -H "Authorization: Bearer <token>" \
  https://your-api.com/api/strategy/123
```

### 2. Check Deprecation Headers (Optional)
```bash
curl -i -H "Authorization: Bearer <token>" \
  https://your-api.com/api/strategy/123

# Should see headers:
# Deprecation: true
# Sunset: Wed, 01 Sep 2026 00:00:00 GMT
# Warning: 299 - "This endpoint is deprecated..."
```

### 3. Automated Testing
```bash
# Update your test files
find tests -name "*.spec.ts" -o -name "*.test.ts" | \
  xargs sed -i 's|/api/strategy/|/api/strategies/|g'

# Run tests
npm test
```

### 4. Load Testing
- Ensure new endpoints handle same load as old
- Monitor response times
- Check for any performance differences

---

## 🎯 Migration Priority

### Priority 1 (ASAP)
- [ ] Frontend components using strategies
- [ ] Mobile apps
- [ ] Main user flows

### Priority 2 (This week)
- [ ] Admin dashboards
- [ ] Internal tools
- [ ] Integration endpoints

### Priority 3 (Next week)
- [ ] Documentation
- [ ] Tests
- [ ] Third-party integrations

---

## 🔗 Reference Links

- **Consolidation Guide:** `ROUTING_CONSOLIDATION_GUIDE.ts`
- **API Reference:** `CONSOLIDATED_API_REFERENCE.ts`
- **Phase 1 Report:** `PHASE_1_INTEGRATION_COMPLETE.md`
- **Phase 1 Summary:** `PROJECT_COMPLETION_SUMMARY.md`

---

## 📞 Support

### Testing the APIs
Both old and new paths work identically during transition period:
- Old path (deprecated): `/api/strategy/:id`
- New path (consolidated): `/api/strategies/:id`

### Rollback Plan
If issues occur, you can:
1. Keep using old paths temporarily
2. Revert to server/index.ts from before Phase 1
3. Focus on fixing issues before re-attempting migration

### Questions?
- Check `ROUTING_CONSOLIDATION_GUIDE.ts` FAQ section
- Review example migrations in this guide
- Test paths using curl or Postman

---

## ✅ Phase 2 Completion Criteria

- [ ] All frontend components updated
- [ ] All mobile app code updated
- [ ] Internal tools migrated
- [ ] Tests passing with new paths
- [ ] Documentation updated
- [ ] No new code uses old paths
- [ ] Team members trained on new paths
- [ ] Monitoring in place for deprecated paths

---

## 🚦 What Happens Next?

**Phase 3 (March - August 2026):** Monitor  
- Track deprecated endpoint usage
- Ensure smooth transition
- Support teams with migration

**Phase 4 (September 2026):** Decommission  
- Delete old route files
- Remove deprecation notices
- Finalize cleanup

---

**Ready to Begin Phase 2?**  
1. ✅ Phase 1 complete
2. ✅ New endpoints operational
3. ✅ Old paths still working
4. ✅ Now migrate client code!

**Start Date:** Any time  
**Deadline:** March 31, 2026  
**Status:** Ready to begin  