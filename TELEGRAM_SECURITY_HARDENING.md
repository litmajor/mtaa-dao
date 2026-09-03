# Telegram Integration Security Hardening

## Overview

This document details the security improvements made to the Telegram integration routes, addressing authentication, authorization, data validation, and runtime reliability issues.

## Vulnerabilities Fixed

### 1. Unprotected Webhook Administration Endpoints

**Issue:** `/set-webhook` and `/webhook-info` had no authorization, allowing any external caller to:
- Reconfigure the webhook URL to intercept messages
- View internal bot diagnostic metadata
- Launch webhook poisoning attacks

**Fix Implemented:**
- Added `requireAdminAuth` middleware to both endpoints
- Verifies `Authorization: Bearer {token}` header against `TELEGRAM_ADMIN_TOKEN`
- Fails immediately with 403 Unauthorized if token missing or incorrect
- Only allows HTTPS webhook URLs (enforced with validation)
- Logs all unauthorized attempts

**Environment Variable Required:**
```bash
TELEGRAM_ADMIN_TOKEN=<strong-random-value>
```

**Usage Example:**
```bash
curl -X POST https://yourdomain.com/api/telegram/set-webhook \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

### 2. Loose Secret Token Validation

**Issue:** If `TELEGRAM_SECRET_TOKEN` was undefined, incoming webhook requests would fail unpredictably due to loose equality checking:
```typescript
// VULNERABLE CODE:
if (secretToken !== process.env.TELEGRAM_SECRET_TOKEN) {
  // If env var is undefined, this could be bypassed with crafted requests
}
```

**Fix Implemented:**
- **Fail-Fast on Startup:** Server throws an error if `TELEGRAM_SECRET_TOKEN` is not configured
- **Strict Validation:** Webhook endpoint now validates that BOTH the environment variable AND header are present
- **Exact Match:** Uses strict equality (`===`) after null checks

```typescript
if (!secretToken || !TELEGRAM_SECRET_TOKEN || secretToken !== TELEGRAM_SECRET_TOKEN) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**Environment Variable Required:**
```bash
TELEGRAM_SECRET_TOKEN=<strong-random-value>
```

**How to Configure:**
1. Generate a strong random token: `openssl rand -hex 32`
2. Set in BotFather: `/setWebhookSecretToken <your-token>`
3. Store in environment: `TELEGRAM_SECRET_TOKEN=...`

---

### 3. Markdown Parsing Failures

**Issue:** User input (DAO names, proposal titles) was inserted into Markdown strings unescaped:
```typescript
// VULNERABLE CODE:
message += `*${proposal.title}*\n`;  // Title could contain *, _, [, etc.
```

Telegram would reject with HTTP 400 if title contained: `_`, `*`, `[`, `` ` ``, etc.

**Fix Implemented:**
- Switched from `parse_mode: 'Markdown'` to `parse_mode: 'HTML'`
- Added `escapeHtml()` helper to escape user-supplied content:
  - `&` → `&amp;`
  - `<` → `&lt;`
  - `>` → `&gt;`
  - `"` → `&quot;`
  - `'` → `&#39;`
- All dynamic content now escaped: titles, names, values, etc.

**Example:**
```typescript
// BEFORE (fragile):
message += `*${dao.name}*`;  // Fails if name contains *

// AFTER (robust):
message += `<b>${escapeHtml(dao.name)}</b>`;  // Safe
```

---

### 4. Webhook Timeout Risks (5-Second Limit)

**Issue:** Telegram expects a `200 OK` response within 5 seconds. Heavy operations (AI calls, complex queries) would cause timeouts and repeated webhook retries:

```typescript
// VULNERABLE CODE:
if (text.startsWith('/vote')) {
  await handleVote(...);  // This could take > 5 seconds
}
res.json({ ok: true });  // Response delayed or never sent
```

This could trigger exponential webhook retry storms.

**Fix Implemented:**
- **Respond Immediately:** `res.json({ ok: true })` sent before any processing
- **Asynchronous Processing:** All command handlers execute asynchronously with `.catch()` error handling
- **No Blocking Operations:** Heavy operations never block the response

```typescript
// AFTER (safe):
res.json({ ok: true });  // Respond immediately

// Then process asynchronously
await handleVote(chatId, userId, args).catch(err =>
  console.error('Vote command error:', err)
);
```

---

### 5. Unimplemented Business Logic

#### /vote Command

**Before:** Simply echoed back user input without verification:
```typescript
await sendTelegramMessage(
  chatId,
  `✅ Vote recorded for proposal ${proposalId}: ${voteValue ? '👍 Yes' : '👎 No'}`
);
```

**After:** Now validates:
- ✅ User exists and is authenticated
- ✅ Proposal exists and is active
- ✅ User has voting power (placeholder for full implementation)
- ✅ Correct error messages for each failure case
- ⚠️ TODO: Record vote in database
- ⚠️ TODO: Update proposal vote counts atomically
- ⚠️ TODO: Implement voting power calculation

**Error Scenarios Handled:**
- User not linked: "Please link your account first"
- Invalid arguments: "Usage: /vote <proposal_id> <yes|no>"
- Proposal not found: "Proposal not found"
- Proposal not active: "Proposal is no longer active"
- No voting power: "You do not have voting power for this proposal"

#### /link Command

**Before:** Echoed the code without any validation:
```typescript
await sendTelegramMessage(
  chatId,
  `🔗 *Account Linking*\n\nYour link code: \`${linkCode}\`\n\nEnter this code in the MtaaDAO app settings.`
);
```

**After:** Now:
- ✅ Checks if account already linked
- ✅ Shows linking instructions if no token provided
- ✅ Supports linking via token from OAuth flow
- ⚠️ TODO: Validate link token against database
- ⚠️ TODO: Check token expiration
- ⚠️ TODO: Atomically link accounts and mark token as used

**Database Schema Required for Link Tokens:**

```sql
CREATE TABLE telegram_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  
  INDEX idx_token_active (token, used, expires_at)
);
```

---

### 6. Database Type Safety

**Issue:** Code matched `users.telegramChatId` (string) with `telegramUserId.toString()`:

```typescript
where: eq(users.telegramChatId, telegramUserId.toString())
```

Telegram IDs can exceed 32-bit integers (some are 64+ bits). A 32-bit column could overflow.

**Fix Implemented:**
- ✅ All code uses `.toString()` for Telegram IDs
- ✅ Documentation requires `telegramChatId` to be `text` or `bigint`
- ✅ Type annotations accept `number | string` for chat IDs

**Schema Requirements:**

```sql
-- Users table
ALTER TABLE users ADD COLUMN telegram_chat_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN telegram_username VARCHAR(32) UNIQUE;

-- NOT: INTEGER or BIGINT - TEXT is required
-- Telegram IDs can exceed JavaScript's MAX_SAFE_INTEGER
```

---

## API Endpoint Changes

### POST `/api/auth/telegram/init` (New)
Initiate Telegram OAuth flow. See [auth_telegram_init.ts](../api/auth_telegram_init.ts)

### POST `/api/auth/telegram/callback` (New)
Handle Telegram OAuth callback. See [auth_telegram_callback.ts](../api/auth_telegram_callback.ts)

### POST `/api/auth/telegram-link` (Updated)
Generate link token for connecting Telegram to existing account.

**Request:** (requires authentication)
```json
{}
```

**Response:**
```json
{
  "ok": true,
  "linkToken": "abc123...",
  "expiresIn": 600000,
  "expiresAt": "2026-08-15T12:10:00Z",
  "botUsername": "MtaaDAO_Bot",
  "deeplink": "https://t.me/MtaaDAO_Bot?start=link_abc123...",
  "instructions": {
    "step1": "Open Telegram and search for @MtaaDAO_Bot",
    "step2": "Click \"Start\" or send /start command",
    "step3": "Send the link token: abc123...",
    "alternative": "Or click this link: https://t.me/..."
  }
}
```

### POST `/api/telegram/webhook` (Updated)
Receive Telegram bot updates. No changes to request format, but:
- ✅ Strict secret token validation
- ✅ Immediate 200 response (< 5 seconds)
- ✅ Asynchronous processing for all commands
- ✅ HTML-escaped all user-supplied content

### POST `/api/telegram/set-webhook` (Updated)
Configure webhook endpoint.

**Security Change:** Now requires `Authorization: Bearer {TELEGRAM_ADMIN_TOKEN}` header

**URL Validation:** Must use HTTPS (enforced)

**New Parameters:**
```json
{
  "allowed_updates": ["message", "callback_query"],
  "secret_token": "..." // Automatically set from env
}
```

### GET `/api/telegram/webhook-info` (Updated)
Get webhook diagnostic information.

**Security Change:** Now requires `Authorization: Bearer {TELEGRAM_ADMIN_TOKEN}` header

---

## Environment Variables

### Required
```bash
TELEGRAM_BOT_TOKEN=<from-BotFather>
TELEGRAM_BOT_USERNAME=<bot-username>
TELEGRAM_SECRET_TOKEN=<random-32-byte-hex>  # Set via /setWebhookSecretToken in BotFather
TELEGRAM_ADMIN_TOKEN=<random-32-byte-hex>   # For /set-webhook and /webhook-info
```

### Optional
```bash
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook
APP_URL=https://yourdomain.com
```

---

## Telegram Bot Configuration Checklist

### 1. Create Bot & Get Token
```bash
# In Telegram, message @BotFather:
/newbot
# Follow prompts, get API_TOKEN
```

### 2. Configure Webhook Secret Token
```bash
# Message @BotFather:
/setWebhookSecretToken
# Paste strong random value: openssl rand -hex 32
```

### 3. Set Bot Commands
```bash
# Message @BotFather:
/setcommands

# When prompted, send:
start - Start using the bot and see menu
balance - Check your DAO balances
proposals - View active proposals
vote - Cast a vote on a proposal
link - Link your Telegram account

/setdefaultcommands
```

### 4. Configure Privacy Settings
```bash
# Message @BotFather:
/setprivacy
# Select your bot, set to "Enabled" (to receive all messages)
```

### 5. Test Webhook Configuration
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://yourdomain.com/api/telegram/webhook-info
```

---

## Security Incident Response

### If Webhook URL Leaked
1. Immediately set `TELEGRAM_SECRET_TOKEN` to a new value
2. Update via BotFather: `/setWebhookSecretToken <new-value>`
3. Verify with `/get-webhook-info`
4. Monitor logs for unauthorized requests

### If Admin Token Leaked
1. Immediately set `TELEGRAM_ADMIN_TOKEN` to a new value
2. Deploy with new environment variable
3. Webhook setup now requires new token

### If Bot Token Leaked
1. Message @BotFather: `/revoke` to revoke token
2. Create new bot via `/newbot`
3. Update `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`
4. Reconfigure secret token and webhook
5. All previous tokens become invalid

---

## Testing Checklist

### Manual Testing
- [ ] Send `/start` to bot, verify welcome message displays correctly
- [ ] Send `/balance` without linking, verify error message
- [ ] Generate link token via `/api/auth/telegram-link`, click deeplink
- [ ] Verify Telegram account linked to user account
- [ ] Send `/balance` after linking, verify balances shown
- [ ] Send `/proposals`, verify active proposals listed
- [ ] Send `/vote <id> yes`, verify vote recorded
- [ ] Verify all messages use HTML formatting without parse errors

### Security Testing
- [ ] Attempt `/set-webhook` without auth header → 401 response
- [ ] Attempt `/set-webhook` with wrong token → 403 response
- [ ] Attempt webhook with wrong secret token → 401 response
- [ ] Attempt webhook with no secret token → 401 response
- [ ] Verify webhook responds in < 1 second (not blocked by processing)
- [ ] Verify heavy operations don't cause timeout retries

### Load Testing
- [ ] Send 100+ rapid webhook requests → verify no queue buildup
- [ ] Send message that triggers AI processing → verify 200 response within 2 seconds
- [ ] Verify error handling for Telegram API failures (rate limits, timeouts)

---

## Implementation Roadmap

### Completed ✅
- Strict secret token validation (fail-fast on startup)
- Admin authentication for webhook admin endpoints
- HTML escape helper for user-supplied content
- Immediate response to Telegram (< 5 seconds)
- Asynchronous processing for all commands
- Error handling for all command scenarios
- Database type safety for Telegram IDs
- Telegram OAuth init and callback handlers

### TODO - High Priority
- [ ] Implement telegram_link_tokens table in schema
- [ ] Implement vote recording in database with atomicity
- [ ] Implement voting power calculation
- [ ] Implement account linking with token verification
- [ ] Add rate limiting to Telegram commands
- [ ] Add audit logging for admin actions

### TODO - Medium Priority
- [ ] Telegram message signing/verification (additional security)
- [ ] Callback query handlers (for inline buttons)
- [ ] Message editing for status updates
- [ ] Inline keyboard responses
- [ ] User preferences (notification settings)

### TODO - Low Priority
- [ ] Morio AI integration for unhandled messages
- [ ] Analytics/metrics collection
- [ ] Notification queue system
- [ ] Telegram sticker packs
- [ ] Telegram mini-app integration

---

## References

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Telegram Login Widget](https://core.telegram.org/widgets/login)
- [Telegram Bot Security Best Practices](https://core.telegram.org/bots/features#privacy-mode)
- [OWASP: Injection Flaws](https://owasp.org/www-community/Injection_Flaws)
- [OWASP: Authorization Testing](https://owasp.org/www-project-web-security-testing-guide/)
