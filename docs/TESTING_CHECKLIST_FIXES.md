# Testing Checklist - UI/UX Fixes

## Quick Summary
All 7 issues from the previous context have been addressed:

### ✅ Already Working (No Changes Needed)
1. **Database Column Error** - FIXED in previous session (auth_login.ts)
2. **Nuru Context Error** - FIXED in previous session (context_manager.ts)  
3. **Navigation Visibility** - ALREADY WORKING (conditional in App.tsx)
4. **MorioFAB Visibility** - ALREADY WORKING (conditional in App.tsx)
5. **Superuser Login Route** - ALREADY ACCESSIBLE (/superuser-login defined)

### ✅ Fixed This Session
6. **Login Form UI** - FIXED (typo, icon positioning)
7. **Remember Me** - IMPLEMENTED (localStorage + checkbox)

---

## Test Execution Guide

### Prerequisites
- Node.js and npm installed
- Backend server running (`npm run dev` in server directory)
- Frontend dev server running (`npm run dev` in client directory)
- Browser console open (F12)

---

## Test 1: Navigation & UI Visibility ⏱️ ~3 min

**Objective**: Verify Navigation and FAB only show to authenticated users

### Steps:
```
1. Open browser DevTools (F12)
2. Go to http://localhost:5173/login
3. Verify:
   ✅ No Navigation bar at top
   ✅ No Morio FAB in bottom right
   ✅ Login form displays correctly
4. Look at password field:
   ✅ Eye icon is properly positioned on right
   ✅ "Forgot Password?" link shows (not "Forgot.")
```

### Expected Result:
- Only login form visible
- No top navigation
- No Morio FAB
- Clean, uncluttered UI

---

## Test 2: Remember Me Functionality ⏱️ ~5 min

**Objective**: Verify Remember Me checkbox saves and restores email

### Prerequisites:
- Test user credentials ready (email + password)
- Browser localStorage enabled

### Steps:
```
1. Go to http://localhost:5173/login
2. Look for "Remember me" checkbox (left of "Forgot Password?")
3. Enter test email/phone in first field
4. Check the "Remember me" checkbox
5. Enter password
6. Click "Sign In"
7. Wait for redirect to dashboard (~2-3 seconds)
8. Verify login successful:
   ✅ Dashboard loads
   ✅ User data shows
   ✅ Navigation now visible
   ✅ Morio FAB visible in bottom right
9. Log out (navigate back to /login)
10. Verify email is pre-filled:
    ✅ Email/phone field has previous value
    ✅ "Remember me" checkbox is checked
```

### Expected Result:
- Email/phone pre-filled after logout
- Checkbox remembered as checked
- User doesn't need to re-enter their email

---

## Test 3: Regular User Login Flow ⏱️ ~5 min

**Objective**: Verify normal login works correctly

### Prerequisites:
- Test user with non-admin role

### Steps:
```
1. Go to http://localhost:5173/login (clear localStorage first if needed)
2. Uncheck "Remember me" if pre-filled
3. Enter test user credentials
4. Click "Sign In"
5. Monitor console for:
   ✅ "[LOGIN] Sending login request..." message
   ✅ "[LOGIN] Received response: 200" message
   ✅ "[LOGIN] Login successful, storing data..." message
   ✅ "[LOGIN] Redirecting to dashboard..." message
6. Verify redirect to dashboard:
   ✅ Page loads within 2-3 seconds
   ✅ URL shows /dashboard
   ✅ User name/avatar visible in top right
7. Check visibility:
   ✅ Navigation bar visible at top
   ✅ Morio FAB visible (bottom right corner)
   ✅ Main dashboard content loaded
```

### Expected Result:
- Smooth login flow
- Dashboard loads with user data
- All UI components visible
- No errors in console

---

## Test 4: Superuser/Admin Login ⏱️ ~5 min

**Objective**: Verify admin login redirects to admin dashboard

### Prerequisites:
- Admin/superuser account credentials
- User must have `super_admin` or `admin` role in database

### Steps:
```
1. Go to http://localhost:5173/superuser-login
2. Verify Register1 form loads (same form as regular login)
3. Enter admin credentials
4. Click "Sign In" or appropriate submit button
5. Monitor console for login messages
6. Verify redirect:
   ✅ Redirects to /superuser or /admin dashboard (not back to login)
   ✅ Admin dashboard loads
   ✅ Admin controls/features visible
   ✅ No redirect loops
7. Verify navigation:
   ✅ Admin navigation items visible
   ✅ Can access /admin/analytics, /admin/users, etc.
```

### Expected Result:
- Admin login succeeds
- Redirect to superuser/admin dashboard
- Admin features accessible
- No redirect loops back to login

---

## Test 5: Public Pages Access ⏱️ ~5 min

**Objective**: Verify components hidden on all public pages

### Steps:
```
# Test 1: Landing Page
1. Clear localStorage (remove user/token)
2. Go to http://localhost:5173/
3. Verify:
   ✅ No Navigation bar
   ✅ No Morio FAB
   ✅ Landing page content visible

# Test 2: Register Page
4. Go to http://localhost:5173/register
5. Verify:
   ✅ No Navigation bar
   ✅ No Morio FAB
   ✅ Register form visible

# Test 3: Forgot Password
6. Go to http://localhost:5173/forgot-password
7. Verify:
   ✅ No Navigation bar
   ✅ No Morio FAB
   ✅ Form visible

# Test 4: Dashboard (Authenticated)
8. Login with test user
9. Go to http://localhost:5173/dashboard
10. Verify:
    ✅ Navigation bar IS visible
    ✅ Morio FAB IS visible
    ✅ Dashboard content visible

# Test 5: Back to Public
11. Logout or clear localStorage
12. Go to http://localhost:5173/login
13. Verify:
    ✅ Navigation bar hidden
    ✅ Morio FAB hidden
```

### Expected Result:
- All public pages have no navigation/FAB
- All authenticated pages show navigation/FAB
- Consistent behavior across all routes

---

## Test 6: Password Visibility Toggle ⏱️ ~2 min

**Objective**: Verify eye icon works and is properly positioned

### Steps:
```
1. Go to http://localhost:5173/login
2. Click in password field
3. Type a password (e.g., "Test123!")
4. Look for eye icon on right side of password field
5. Verify icon position:
   ✅ Icon is vertically centered in field
   ✅ Icon is not cut off or overlapping text
   ✅ Icon is clearly visible
6. Click the eye icon
7. Verify:
   ✅ Password text becomes visible
   ✅ Eye changes to EyeOff icon
8. Click again
9. Verify:
   ✅ Password is hidden again
   ✅ Icon changes back to Eye
```

### Expected Result:
- Eye icon properly positioned
- Toggle works smoothly
- No UI glitches

---

## Test 7: Error Handling ⏱️ ~3 min

**Objective**: Verify error messages display correctly

### Steps:
```
1. Go to http://localhost:5173/login
2. Enter invalid email/password
3. Click "Sign In"
4. Verify:
   ✅ Error message displays
   ✅ Message is red/orange colored
   ✅ Message is readable
5. Try with empty fields
6. Verify:
   ✅ Error message shows (required field)
7. Try with rate limit (if configured):
   ✅ "Too many failed attempts" error shows
   ✅ Lock message displays
   ✅ Retry link or time displays
```

### Expected Result:
- Clear error messages
- User can see why login failed
- Proper error styling

---

## Test 8: Database Integration ⏱️ ~5 min

**Objective**: Verify login works with real database

### Steps:
```
1. Ensure database is running
2. Go to http://localhost:5173/login
3. Enter credentials for user in database
4. Monitor console and network tab (F12 > Network)
5. Watch for:
   ✅ POST /api/auth/login request
   ✅ 200 response code
   ✅ Response includes user object
   ✅ Response includes accessToken
6. After redirect, verify:
   ✅ User data loaded from database
   ✅ Avatar/name from DB shows correctly
   ✅ All user settings loaded
```

### Expected Result:
- Database queries work
- User data correctly retrieved
- No schema errors in backend

---

## Console Error Checklist

After each test, verify console has NO errors like:

```
❌ AVOID seeing:
- "user is undefined"
- "Cannot read property 'id' of undefined"
- "Column 'enabled_beta_features' does not exist"
- "userContexts is not defined"
- Any red error messages

✅ EXPECT to see:
- "[LOGIN] Sending login request..."
- "[LOGIN] Login successful..."
- "[LOGIN] Redirecting to dashboard..."
- Normal React warnings (if any)
```

---

## Quick Test Summary Matrix

| Test # | Feature | Pass/Fail | Notes |
|--------|---------|-----------|-------|
| 1 | Navigation/FAB visibility | ⬜ | |
| 2 | Remember Me | ⬜ | |
| 3 | Regular login | ⬜ | |
| 4 | Admin login | ⬜ | |
| 5 | Public pages | ⬜ | |
| 6 | Password toggle | ⬜ | |
| 7 | Error handling | ⬜ | |
| 8 | Database | ⬜ | |

---

## If Tests Fail

### Common Issues & Solutions

**Issue**: "Remember me" doesn't work
- Check: Is localStorage enabled in browser?
- Fix: Clear cache, try again

**Issue**: Navigation still shows on public pages
- Check: Is `isAuthenticated` properly set?
- Fix: Clear localStorage, re-login

**Issue**: Password icon broken/misaligned
- Check: Browser zoom level (reset to 100%)
- Fix: Clear cache, reload page

**Issue**: Superuser login redirects to /login
- Check: Is user role set to 'super_admin' in database?
- Fix: Update database: `UPDATE users SET roles = 'super_admin' WHERE id = '...';`

**Issue**: Login timeout errors
- Check: Is backend server running?
- Fix: Start backend with `npm run dev` in server directory

**Issue**: "Column 'enabled_beta_features' does not exist"
- This was FIXED in previous session
- Check: Is backend up to date?
- Fix: Restart backend server

---

## Sign-Off

✅ All tests passed: __________ (Date/Time)
Tester: ___________________
Notes: ____________________

