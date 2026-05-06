# DAO Switcher - Mobile-Only Issue Analysis

**Date:** January 15, 2026  
**Status:** Issue Identified  
**Severity:** High (Desktop users can't easily switch between DAOs)

---

## The Problem

The DAO Switcher component is **only visible on mobile devices** (`lg:hidden` CSS class). Desktop users have **no easy way to switch between DAOs** they've joined.

### Current State

**File:** `client/src/components/navigation.tsx` (line 132)

```tsx
{/* Mobile DAO Switcher - Shows on small screens */}
<div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-2">
  <DaoSwitcher />
</div>
```

**Key Issue:** The `lg:hidden` class means:
- ✅ Visible on mobile (small screens)
- ❌ Hidden on desktop (lg screens and above)

---

## What the DaoSwitcher Does

**File:** `client/src/components/DaoSwitcher.tsx`

### Features:
1. ✅ Fetches all user's joined DAOs from `/api/daos`
2. ✅ Shows current DAO name with member count and treasury
3. ✅ Displays dropdown list of all joined DAOs
4. ✅ Quick navigation between DAOs (`/dao/{daoId}`)
5. ✅ Shows badges (Elder role indicator)
6. ✅ Highlights current DAO with checkmark

### Perfect Design:
```
┌─────────────────────────┐
│ My Group    [count]  ▼  │  ← Mobile header button
└─────────────────────────┘

Sheet overlay:
┌──────────────────────────┐
│ My Groups                │
├──────────────────────────┤
│ ✓ DAO 1      [5] [$100K] │
│   DAO 2      [12] [$50K] │
│   DAO 3      [3] [$200K] │
└──────────────────────────┘
```

---

## Why This Matters

### Desktop User Journey (Current - BROKEN):
1. User visits `/dao/1` (DAO 1)
2. Wants to switch to their other DAO (DAO 2)
3. ❌ No switcher visible on desktop
4. **Must navigate back to `/daos` → find DAO 2 → click enter**
5. Problem: Cumbersome workflow

### Desktop User Journey (Fixed - DESIRED):
1. User visits `/dao/1` (DAO 1)
2. Wants to switch to their other DAO (DAO 2)
3. ✅ Clicks DAO switcher button/dropdown in navbar
4. ✅ Selects DAO 2
5. ✅ Instantly navigates to `/dao/2`
6. **Solution: 1-click switching**

---

## Solutions

### Option 1: Show Switcher on All Screens (Recommended)
**Impact:** Desktop and mobile both get the switcher
**Effort:** 1 minute (remove `lg:hidden`)

```tsx
// Current
<div className="lg:hidden ...">
  <DaoSwitcher />
</div>

// Fixed
<div className="...">  {/* Remove lg:hidden */}
  <DaoSwitcher />
</div>
```

**Trade-off:** Takes up space in mobile nav, but provides crucial functionality

---

### Option 2: Create Desktop Dropdown in Navbar
**Impact:** Desktop gets polished dropdown, mobile keeps current behavior
**Effort:** 30 minutes (create new component + integrate)

```
Desktop navbar:           Mobile:
┌─ [DAO Dropdown] ─┐     ┌─ [DAO Switcher] ─┐
│ DAO 1 ✓         │     │ (Full sheet)    │
│ DAO 2           │     └─────────────────┘
│ DAO 3           │
└─────────────────┘
```

---

### Option 3: Show in Sidebar or Context Menu
**Impact:** Less visual pollution, but harder to discover
**Effort:** 15 minutes (add to existing menus)

---

## Files Involved

| File | Issue | Status |
|------|-------|--------|
| `client/src/components/navigation.tsx` | DaoSwitcher hidden on desktop | Needs fix |
| `client/src/components/DaoSwitcher.tsx` | Component is perfect, just needs visibility | ✅ Ready |
| `client/src/pages/dao/[id]/overview.tsx` | Now has tab switcher for features | ✅ Just added |

---

## Testing Checklist

- [ ] Desktop: Verify switcher visible at breakpoint lg (1024px+)
- [ ] Mobile: Verify switcher still visible
- [ ] Desktop: Test clicking switcher → dropdown appears
- [ ] Desktop: Test switching between DAOs
- [ ] Mobile: Test tap switcher → sheet slides in
- [ ] Mobile: Test switching between DAOs
- [ ] All breakpoints: Verify styling looks good

---

## Recommendation

**Use Option 1** - Show DaoSwitcher on all screens. It's:
- ✅ Already built and tested
- ✅ Works perfectly on mobile
- ✅ 1-minute fix
- ✅ Provides critical functionality
- ✅ Users need DAO switching on all devices

The component is well-designed and would enhance desktop UX significantly.

---

## Next Steps

1. Remove `lg:hidden` from navigation.tsx line 132
2. Test on desktop and mobile
3. Verify styling in navbar
4. Optional: Add tooltip "Switch DAO" on hover
