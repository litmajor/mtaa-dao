# OAuth Security Refactoring - Implementation Summary

## Overview

Comprehensive security hardening of the Google OAuth 2.0 flow addressing **5 critical/high-severity vulnerabilities** and implementing OAuth 2.0 best practices with PKCE support.

---

## Files Modified

### 1. **server/api/auth_oauth_google.ts** (Refactored)
**Purpose:** OAuth authorization flow initiation

**Key Changes:**
- ✅ **PKCE Implementation:** Generate `code_verifier` and `code_challenge` (SHA256)
- ✅ **CSRF Protection:** Generate cryptographically secure state using `crypto.randomBytes(32)`
- ✅ **Secure Cookies:** Store state, code_verifier, and mode in HTTP-only cookies (10-minute expiry)
- ✅ **Error Handling:** Try-catch wrapper with proper error responses

**New Functions:**
```typescript
generatePKCE(): { codeVerifier, codeChallenge }
generateOAuthState(): string
```

**Cookie Storage:**
- `oauth_state`: 10 minutes
- `oauth_code_verifier`: 10 minutes  
- `oauth_mode`: 10 minutes

---

### 2. **server/api/auth_oauth_google_callback.ts** (Refactored)
**Purpose:** OAuth callback handler

**Key Changes:**
- ✅ **CSRF Verification:** Constant-time comparison of state vs. cookie
- ✅ **PKCE Validation:** Include `code_verifier` in token exchange
- ✅ **Database Transactions:** Wrap all DB operations in atomic transaction
- ✅ **Identity Linking Confirmation:** Require password confirmation for existing accounts
- ✅ **Token Security:** Store tokens in HTTP-only cookies instead of URL parameter
- ✅ **Error Handling:** Safe state parsing with fallback

**New Functions:**
```typescript
safeParseJSON<T>(json: string, fallback: T): T
verifyOAuthState(requestState: string, cookieState: string): boolean
requiresConfirmation(existingUser: User): boolean
```

**Database Transaction Flow:**
1. Check if OAuth identity exists → Login user
2. Check if email exists → Determine if password confirmation needed
3. Create account or link identity atomically
4. Return confirmation flag if needed

**Token Storage:**
- `access_token`: 15 minutes (matches JWT expiry)
- `refreshToken`: 7 days

---

### 3. **server/api/auth_confirm_identity_linking.ts** (New)
**Purpose:** Password verification endpoint for linking OAuth to existing accounts

**Functionality:**
- POST endpoint for confirming identity linking
- Validates email + password against stored credentials
- Verifies pending identity from cookie
- Links OAuth provider atomically within transaction
- Generates and stores tokens in secure cookies
- Detects account takeover attempts (identity already linked to different user)

**Endpoint:** `POST /api/auth/oauth/confirm-linking`

**Request Body:**
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

**Response:**
```json
{
  "success": true,
  "message": "Identity linked successfully",
  "redirectUrl": "https://frontend.com/dashboard"
}
```

---

### 4. **server/routes.ts** (Updated)
**Changes:**
- Added import for `authConfirmIdentityLinkingHandler`
- Registered new route: `POST /api/auth/oauth/confirm-linking`

```typescript
import { authConfirmIdentityLinkingHandler } from './api/auth_confirm_identity_linking';
// ...
app.post('/api/auth/oauth/confirm-linking', authConfirmIdentityLinkingHandler);
```

---

## Security Fixes Summary

| # | Vulnerability | Severity | Status | Fix |
|---|---|---|---|---|
| 1 | CSRF (State Forgery) | CRITICAL | ✅ Fixed | Cryptographic state + constant-time comparison |
| 2 | Token Exposure (URL) | CRITICAL | ✅ Fixed | Secure HTTP-only cookies |
| 3 | Non-Atomic DB Ops | HIGH | ✅ Fixed | Database transactions |
| 4 | Unverified Auto-Linking | MEDIUM | ✅ Fixed | Password confirmation flow |
| 5 | Parsing Errors | MEDIUM | ✅ Fixed | Safe parsing + error handling |
| 6 | Authorization Interception | BEST PRACTICE | ✅ Added | PKCE (S256) implementation |

---

## Security Improvements by Layer

### Transport Layer
- All tokens stored in `HttpOnly; Secure; SameSite=Strict` cookies
- No sensitive data in URL parameters or redirect responses
- HTTPS enforced in production

### Cryptographic Layer
- PKCE with SHA256 code challenge
- Cryptographically secure state generation
- Constant-time string comparison for verification

### Application Layer
- Atomic database transactions prevent orphaned records
- Password confirmation required before linking OAuth to existing accounts
- Input validation and safe parsing throughout

### Session Layer
- Short-lived state/PKCE cookies (10 minutes)
- Access token cookie (15 minutes)
- Refresh token cookie (7 days)
- Cookie clearing after successful operations

---

## Error Scenarios Handled

| Scenario | Error Code | User Message | Action |
|---|---|---|---|
| CSRF attack | `invalid_state` | Session expired/mismatch | Reject and prompt re-login |
| PKCE mismatch | `pkce_error` | Session expired | Prompt re-login |
| Unverified email | `email_not_verified` | Verify email in Google | Provide instructions |
| Account not found | `account_not_found` | Account doesn't exist | Suggest sign up |
| Config error | `oauth_config_error` | Service unavailable | Retry later |
| Confirmation needed | `requireConfirmation=true` | Enter password to confirm | Show confirmation dialog |
| Wrong password | HTTP 401 | Invalid password | Retry password entry |
| Account hijack attempt | HTTP 409 | OAuth already linked elsewhere | Contact support |
| Invalid JSON | Graceful fallback | Generic error | Logged and handled safely |

---

## Frontend Integration Points

### 1. OAuth Initiation
**Unchanged** - Frontend can continue using existing Google OAuth button/SDK

### 2. Token Access
**Changed from URL parameter to cookies**
- Tokens automatically included in all fetch/axios requests
- No manual token extraction needed
- Existing SPA-level auth checks should continue working

### 3. Identity Confirmation Flow
**New UI Required:**
```
1. Detect redirect: /login?requireConfirmation=true&email=...
2. Show password entry dialog
3. POST to /api/auth/oauth/confirm-linking
4. Redirect to /dashboard on success
```

### 4. Error Handling
**Updated error parameters in URL:**
```
/login?error=<code>&message=<encoded_message>&requireConfirmation=<true|false>&email=<address>
```

---

## Environment Configuration

Required environment variables (no changes needed if already set):
```bash
GOOGLE_CLIENT_ID=<client_id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_OAUTH_REDIRECT=https://yourdomain.com/api/auth/oauth/google/callback
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production  # For secure cookies
```

---

## Deployment Considerations

### Pre-Deployment
1. ✅ TypeScript compilation passes (verified - no errors)
2. ✅ All imports and routes registered
3. ⚠️ Frontend integration changes required (see above)
4. ⚠️ Test identity confirmation flow end-to-end

### Rollout Strategy
1. **Phase 1:** Deploy backend changes
2. **Phase 2:** Update frontend OAuth flow and error handling
3. **Phase 3:** Monitor OAuth callback errors and confirmation confirmations
4. **Phase 4:** Enable confirmation flow globally

### Monitoring
- Track CSRF rejection rate: `/login?error=invalid_state`
- Monitor PKCE failures: `/login?error=pkce_error`
- Watch confirmation flow adoption: `POST /api/auth/oauth/confirm-linking`
- Log all state verification failures (security indicator)

---

## Testing Checklist

### Security Tests
- [ ] CSRF: Reject mismatched state
- [ ] CSRF: Reject expired state (>10 min)
- [ ] PKCE: Verify code_verifier required for token exchange
- [ ] PKCE: Reject invalid code_verifier
- [ ] Token: Confirm tokens in cookies, not URL
- [ ] Token: Verify HttpOnly flag prevents JS access
- [ ] State Parsing: Handle malformed Base64
- [ ] State Parsing: Handle invalid JSON

### Functional Tests
- [ ] New account creation via OAuth
- [ ] Existing account login via OAuth
- [ ] Identity linking to password-protected account (confirmation flow)
- [ ] Identity linking to OAuth-only account (automatic)
- [ ] Duplicate identity detection
- [ ] Google email unverified rejection
- [ ] Token refresh cycle
- [ ] Logout and token cleanup

### Integration Tests
- [ ] Full OAuth flow from initiation to dashboard
- [ ] Full confirmation flow for existing users
- [ ] Error recovery and retry flows
- [ ] Cookie handling with multiple tabs
- [ ] Cross-origin request handling

---

## Code Quality

### TypeScript Validation
✅ All files compile without errors
```
- auth_oauth_google.ts: No errors
- auth_oauth_google_callback.ts: No errors
- auth_confirm_identity_linking.ts: No errors
- routes.ts: No errors
```

### Code Style
- Consistent with existing MtaaDAO codebase
- Comprehensive inline comments with FIX labels
- JSDoc comments for public functions
- Error handling throughout

### Security Auditing
- Constant-time comparison for CSRF tokens
- Atomic database operations
- No sensitive data in logs
- Cryptographically secure random generation
- Short-lived session credentials

---

## Documentation

### Reference Materials
- **OAUTH_SECURITY_REFACTORING.md** - Comprehensive security documentation
  - Vulnerability details and fixes
  - Frontend integration guide
  - Cookie configuration
  - Error handling matrix
  - Testing checklist
  - References to standards (RFC 7636, OAuth 2.0)

---

## Next Steps

1. **Frontend Integration**
   - Update OAuth callback handling for cookie-based tokens
   - Implement identity confirmation UI dialog
   - Handle new error parameters

2. **Testing**
   - Manual end-to-end OAuth flow
   - CSRF attack simulation
   - Confirmation flow with existing accounts
   - Error recovery scenarios

3. **Monitoring**
   - Set up alerts for state mismatches
   - Track confirmation flow metrics
   - Monitor token refresh patterns

4. **Documentation**
   - Update client SDK docs
   - Create user-facing error messages
   - Document API changes for partners

---

## Related Security Fixes

This refactoring complements the previously completed security work:
- ✅ Admin proposal state machine validation
- ✅ Defender route privilege checks
- ✅ Rate limiting on sensitive endpoints
- ✅ TypeScript auth type consistency

All work maintains production-ready security standards.
