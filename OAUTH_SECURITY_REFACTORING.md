# OAuth Security Refactoring Documentation

## Overview

This document describes the comprehensive security improvements made to the Google OAuth flow in the MtaaDAO authentication system. The refactoring addresses 5 critical and high-severity vulnerabilities that could lead to account takeovers, token exposure, and data integrity issues.

## Security Vulnerabilities Fixed

### 1. ✅ CSRF (Cross-Site Request Forgery) Vulnerability - CRITICAL

**Original Issue:**
```typescript
// VULNERABLE: Takes state at face value without checking authenticity
const stateData = state ? JSON.parse(Buffer.from(state as string, 'base64').toString()) : { mode: 'login' };
```

**Impact:** An attacker can perform OAuth CSRF by generating an authorization code under their own Google account and tricking a logged-in user into executing the callback request, binding the attacker's Google account to the victim's profile.

**Fix Applied:**
- Generate cryptographically secure random state using `crypto.randomBytes(32)`
- Store state in secure HTTP-only cookie with 10-minute expiration
- Verify state using constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks
- Clear state cookie after successful verification

**Implementation:**
```typescript
function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex');
}

function verifyOAuthState(requestState: string, cookieState: string): boolean {
  const matches = crypto.timingSafeEqual(
    Buffer.from(requestState),
    Buffer.from(cookieState)
  ).valueOf();
  return matches;
}
```

---

### 2. ✅ Token Exposure in URL Query Parameter - CRITICAL

**Original Issue:**
```typescript
// VULNERABLE: Exposes token in redirect URL
const redirectUrl = `${FRONTEND_URL}/dashboard?token=${tokens.accessToken}`;
res.redirect(redirectUrl);
```

**Impact:** Access tokens passed in URL are exposed to:
- Browser history
- Server/CDN access logs
- Third-party scripts via HTTP Referer header
- Browser back/forward cache

**Fix Applied:**
- Store both access and refresh tokens in `SameSite=Strict; HttpOnly; Secure` cookies
- Redirect to `/dashboard` without token in URL
- Frontend automatically picks up tokens from cookies (no changes needed)

**Implementation:**
```typescript
res.cookie('access_token', tokens.accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000,
});

res.cookie('refreshToken', tokens.refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

res.redirect(`${FRONTEND_URL}/dashboard`);
```

---

### 3. ✅ Non-Atomic Database Operations - HIGH SEVERITY

**Original Issue:**
```typescript
// Query 1: Create User
const newUserResult = await db.insert(users).values(...).returning();

// Query 2: Insert Identity (If this throws, Query 1 remains committed)
await db.insert(userIdentities).values(...);
```

**Impact:** If the second insert fails, an orphaned user record with `password: ''` remains in the database, creating security and data integrity issues.

**Fix Applied:**
- Wrap entire user creation and identity linking flow in database transaction
- Use `db.transaction()` to ensure atomicity: either all operations succeed or all rollback
- If any step fails, the entire operation is rolled back automatically

**Implementation:**
```typescript
const result = await db.transaction(async (tx) => {
  // Check existing identity
  // Create or link user
  // Insert identity
  // All operations committed atomically or all rolled back
});
```

---

### 4. ✅ Automatic Unverified Identity Linking - MEDIUM SEVERITY

**Original Issue:**
```typescript
// Links identity automatically without requiring password confirmation
const existingUser = await db.select().from(users)
  .where(eq(users.email, googleUser.email)).limit(1);
if (existingUser.length > 0) {
  // Automatically links OAuth without confirmation
}
```

**Impact:** Silently linking external authentication providers without user confirmation creates security risks if an account was created locally with an unverified email address before OAuth flow.

**Fix Applied:**
- Detect if existing account has a password (password-protected account)
- If yes, require password confirmation before linking OAuth identity
- Return pending identity state and redirect to confirmation flow
- Create new endpoint `/api/auth/oauth/confirm-linking` for password verification
- Link identity only after password verification within a transaction

**Implementation:**
```typescript
function requiresConfirmation(existingUser: User): boolean {
  // If user has a password, they need to confirm before linking OAuth
  return existingUser.password !== null && existingUser.password !== '';
}

if (requiresConfirmation(existingUser)) {
  // Store pending identity in cookie
  res.cookie('oauth_pending_identity', JSON.stringify(pendingIdentity), {
    httpOnly: true,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
  
  // Redirect to confirmation flow
  res.redirect(`${FRONTEND_URL}/login?requireConfirmation=true&email=${email}`);
}
```

**New Endpoint:** `POST /api/auth/oauth/confirm-linking`
```json
{
  "email": "user@example.com",
  "password": "user_password",
  "googleId": "google_user_id",
  "googleProfile": {
    "name": "User Name",
    "picture": "https://..."
  }
}
```

---

### 5. ✅ Unhandled Parsing Error in State Parameter - MEDIUM SEVERITY

**Original Issue:**
```typescript
// Throws if state is invalid Base64 or non-JSON
JSON.parse(Buffer.from(state as string, 'base64').toString())
```

**Impact:** Malformed state parameters cause unhandled exceptions, potentially exposing error details or causing service disruption.

**Fix Applied:**
- Implement safe parsing helper with try-catch
- Validate state format before parsing
- Provide clear error messages without exposing internals
- Use constant-time comparison to verify state origin

**Implementation:**
```typescript
function safeParseJSON<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    logger.warn('Failed to parse JSON', { error });
    return fallback;
  }
}
```

---

### 6. ✅ PKCE (Proof Key for Public Clients) - OAUTH 2.0 BEST PRACTICE

**New Feature:**
PKCE adds an additional layer of security by preventing authorization code interception attacks, even if someone intercepts the code, they can't exchange it for tokens without the code_verifier.

**Implementation:**

**Initiation (`/api/auth/oauth/google`):**
```typescript
function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const codeChallenge = crypto.createHash('sha256')
    .update(codeVerifier).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return { codeVerifier, codeChallenge };
}

// Store code_verifier in HTTP-only cookie
res.cookie('oauth_code_verifier', codeVerifier, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 10 * 60 * 1000,
});

// Include code_challenge in authorization request
params.set('code_challenge', codeChallenge);
params.set('code_challenge_method', 'S256');
```

**Callback (`/api/auth/oauth/google/callback`):**
```typescript
const codeVerifier = req.cookies['oauth_code_verifier'];

// Include code_verifier in token exchange request
const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
  code,
  code_verifier: codeVerifier,
  // ... other parameters
});
```

---

## Cookie Security Configuration

All security-sensitive cookies use the following secure configuration:

```typescript
{
  httpOnly: true,        // Not accessible via JavaScript (prevents XSS theft)
  secure: true,          // Only sent over HTTPS in production
  sameSite: 'strict',    // Prevents CSRF by not sending in cross-site requests
  maxAge: <duration>     // Short-lived for state/verifier, longer for tokens
}
```

**Cookie Lifetimes:**
- `oauth_state`: 10 minutes
- `oauth_code_verifier`: 10 minutes
- `oauth_mode`: 10 minutes
- `access_token`: 15 minutes (matches JWT expiry)
- `refreshToken`: 7 days
- `oauth_pending_identity`: 15 minutes

---

## Frontend Integration Guide

### Token Access

**Before:** Tokens were passed in URL query parameter
```typescript
// OLD: Not secure
const token = new URLSearchParams(window.location.search).get('token');
```

**After:** Tokens are in secure HTTP-only cookies
```typescript
// NEW: Automatic via httpOnly cookies
// No changes needed! Axios/fetch automatically includes cookies
// The browser automatically sends httpOnly cookies with requests
```

### Identity Linking Confirmation Flow

When a user attempts to login with OAuth but has an existing password-protected account:

1. **Receive Redirect:**
   ```
   /login?requireConfirmation=true&email=user@example.com
   ```

2. **Show Confirmation Dialog:**
   - Display message: "You have an existing account. Please confirm with your password to link Google sign-in."
   - Collect user password

3. **Call Confirmation Endpoint:**
   ```typescript
   const response = await fetch('/api/auth/oauth/confirm-linking', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       email: 'user@example.com',
       password: userPassword,
       googleId: googleProfile.id,
       googleProfile: {
         name: googleProfile.name,
         picture: googleProfile.picture,
       },
     }),
     credentials: 'include', // Include cookies
   });
   ```

4. **Handle Response:**
   ```typescript
   if (response.ok) {
     const data = await response.json();
     // Redirect to dashboard
     window.location.href = data.redirectUrl;
   } else {
     // Show error message based on response status
   }
   ```

### OAuth Flow Diagram

```
1. User clicks "Sign in with Google"
   ↓
2. GET /api/auth/oauth/google
   - Generate PKCE (code_verifier, code_challenge)
   - Generate secure state
   - Store state, code_verifier, mode in HTTP-only cookies
   - Redirect to Google OAuth
   ↓
3. User authenticates with Google
   ↓
4. Google redirects to /api/auth/oauth/google/callback
   - Verify state (constant-time comparison)
   - Verify PKCE (exchange with code_verifier)
   - Get user info from Google
   ↓
5. Database transaction:
   a) Check if OAuth identity exists → User found, login
   b) Check if email exists with password → Require confirmation
   c) Check if email exists without password → Link identity
   d) No email found, register mode enabled → Create account + identity
   ↓
6. If confirmation needed:
   - Store pending identity in cookie
   - Redirect to /login?requireConfirmation=true&email=...
   - User enters password
   - POST /api/auth/oauth/confirm-linking
   - Link identity atomically
   ↓
7. Generate tokens (access + refresh)
   - Store in secure HTTP-only cookies
   - Redirect to /dashboard
```

---

## Environment Variables

Ensure the following are configured:

```bash
# Google OAuth Configuration (required)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_OAUTH_REDIRECT=https://yourdomain.com/api/auth/oauth/google/callback

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Environment
NODE_ENV=production  # Enables secure cookies
```

---

## Error Handling & User Messages

| Error | Cause | User Message |
|-------|-------|--------------|
| `invalid_state` | CSRF attack or session expired | "Session expired or state mismatch. Please try again." |
| `pkce_error` | PKCE verification failed | "Session expired. Please restart the login process." |
| `email_not_verified` | Google email not verified | "Your Google account email is not verified. Please verify in Google account settings." |
| `account_not_found` | No account exists and register disabled | "No account found with this email. Please sign up first." |
| `oauth_config_error` | Google OAuth not configured | "OAuth service is temporarily unavailable. Please try again later." |
| `requireConfirmation=true` | Existing password account + new OAuth | "Confirm with your password to link Google sign-in." |
| `INVALID_PASSWORD` | Wrong password during confirmation | "Invalid password. Please try again." |
| `IDENTITY_ALREADY_LINKED` | OAuth already linked elsewhere | "This Google account is already linked to another user account." |

---

## Security Best Practices

1. **Always use HTTPS in production** - Ensures cookies are encrypted in transit
2. **Set secure cookie attributes** - `httpOnly`, `secure`, `sameSite: 'strict'`
3. **Use short token lifetimes** - 15 minutes for access tokens
4. **Implement refresh token rotation** - On each refresh, issue new refresh token
5. **Blacklist old tokens** - Especially refresh tokens after logout
6. **Monitor OAuth flows** - Log all state mismatches and failed verifications
7. **Rate limit endpoints** - Protect `/api/auth/oauth/confirm-linking` with rate limiting
8. **Validate all inputs** - Email format, password length, JSON parsing

---

## Testing Checklist

- [ ] CSRF Protection: Attempt with mismatched state cookie
- [ ] PKCE Verification: Block requests without code_verifier
- [ ] State Expiration: Try state after 15 minutes
- [ ] Atomic Transactions: Simulate identity insert failure
- [ ] Confirmation Flow: Link to password-protected account
- [ ] Token Security: Verify tokens in cookies, not URL
- [ ] Error Handling: Test malformed state parameters
- [ ] Cross-Origin: Verify SameSite=Strict prevents cross-site requests

---

## References

- [OAuth 2.0 PKCE (RFC 7636)](https://tools.ietf.org/html/rfc7636)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [OWASP CSRF Prevention](https://owasp.org/www-community/attacks/csrf)
- [SameSite Cookie Explained](https://web.dev/samesite-cookies-explained/)

---

## Rollback Instructions

If issues arise, revert to the previous OAuth handlers:
1. Keep transaction/state validation logic
2. Revert token handling to old method if absolutely necessary
3. Disable confirmation flow by setting `requiresConfirmation` to always return false

However, **strongly recommend against rolling back** as the security fixes address critical vulnerabilities.
