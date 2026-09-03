# Telegram Integration Implementation Guide

This document provides detailed instructions for implementing the remaining TODO items in the Telegram integration.

## 1. Telegram Link Tokens Table

### Database Schema

```sql
-- Create table for Telegram account linking tokens
CREATE TABLE telegram_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign key to users
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Unique token (cryptographically random, 256-bit)
  token TEXT NOT NULL UNIQUE,
  
  -- When token expires (set to now + 10 minutes on creation)
  expires_at TIMESTAMP NOT NULL,
  
  -- Has this token been used to link an account?
  used BOOLEAN NOT NULL DEFAULT false,
  
  -- When was this token created
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  
  -- When was this token used (NULL if not used)
  used_at TIMESTAMP,
  
  -- Telegram ID that used this token (NULL if not used)
  linked_telegram_id TEXT,
  
  -- Indexes for efficient queries
  INDEX idx_token_active (token, used, expires_at),
  INDEX idx_user_active (user_id, used, expires_at),
  INDEX idx_expires (expires_at)  -- For cleanup queries
);

-- Add columns to users table if not already present
ALTER TABLE users ADD COLUMN telegram_chat_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN telegram_username VARCHAR(32);

-- Create indexes for telegram lookups
CREATE INDEX idx_users_telegram_chat_id ON users(telegram_chat_id);
CREATE INDEX idx_users_telegram_username ON users(telegram_username);
```

### Implementation: Generate Link Token (POST /api/auth/telegram-link)

```typescript
// In server/api/auth_telegram_link.ts

export async function authTelegramLinkHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.telegramChatId) {
      return res.status(400).json({
        error: 'Account already linked',
        message: 'Unlink first before linking a different account.',
      });
    }

    // Generate link token
    const linkToken = generateTelegramLinkToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in database
    await db.insert(telegram_link_tokens).values({
      userId,
      token: linkToken,
      expiresAt,
      used: false,
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'MtaaDAO_Bot';
    const deeplink = `https://t.me/${botUsername}?start=link_${linkToken}`;

    return res.json({
      ok: true,
      linkToken,
      expiresIn: 10 * 60 * 1000,
      expiresAt: expiresAt.toISOString(),
      deeplink,
      instructions: {
        step1: `Search for @${botUsername} on Telegram`,
        step2: 'Click "Start" or send /start',
        step3: `Send: /link ${linkToken}`,
        alternative: `Or click: ${deeplink}`,
      },
    });
  } catch (error) {
    console.error('Telegram link handler error:', error);
    return res.status(500).json({ error: 'Failed to generate link token' });
  }
}
```

### Implementation: Verify & Use Link Token

```typescript
// In server/routes/telegram-integration.ts

/**
 * Verify and use a Telegram link token
 * Called when user sends /link <token> to bot
 */
async function verifyAndUseTelegramLinkToken(
  token: string,
  telegramUserId: number,
  telegramUsername?: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // Find active link token
    const linkRecord = await db.query.telegram_link_tokens.findFirst({
      where: and(
        eq(telegram_link_tokens.token, token),
        eq(telegram_link_tokens.used, false),
        gt(telegram_link_tokens.expiresAt, new Date())
      ),
    });

    if (!linkRecord) {
      return {
        success: false,
        error: 'Link token is invalid, expired, or already used',
      };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, linkRecord.userId),
    });

    if (!user) {
      return {
        success: false,
        error: 'User account not found',
      };
    }

    // Atomically mark token as used and link Telegram account
    await db.transaction(async (tx) => {
      // Update token: mark as used
      await tx.update(telegram_link_tokens)
        .set({
          used: true,
          used_at: new Date(),
          linked_telegram_id: telegramUserId.toString(),
        })
        .where(eq(telegram_link_tokens.id, linkRecord.id));

      // Update user: link Telegram account
      await tx.update(users)
        .set({
          telegramChatId: telegramUserId.toString(),
          telegramUsername: telegramUsername || null,
        })
        .where(eq(users.id, linkRecord.userId));
    });

    return {
      success: true,
      userId: linkRecord.userId,
    };
  } catch (error) {
    console.error('Link token verification error:', error);
    return {
      success: false,
      error: 'Failed to verify link token',
    };
  }
}

// Update /link command handler to use this:
async function handleLink(
  chatId: number | string,
  telegramUserId: number,
  args: string[]
) {
  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.telegramChatId, telegramUserId.toString()),
    });

    if (existingUser) {
      await sendTelegramMessage(
        chatId,
        '✅ Your account is already linked to MtaaDAO.'
      );
      return;
    }

    const linkToken = args[0];
    if (!linkToken) {
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'MtaaDAO_Bot';
      await sendTelegramMessage(
        chatId,
        `🔗 <b>Account Linking</b>\n\nVisit your settings to generate a link token and send it here.\n\nBot username: @${botUsername}`
      );
      return;
    }

    // Verify and use token
    const result = await verifyAndUseTelegramLinkToken(
      linkToken,
      telegramUserId,
      (args as any).from?.username
    );

    if (!result.success) {
      await sendTelegramMessage(
        chatId,
        `❌ Link failed: ${result.error}`
      );
      return;
    }

    await sendTelegramMessage(
      chatId,
      `✅ <b>Account Linked Successfully!</b>\n\nYour Telegram account is now connected to MtaaDAO.\n\nYou will now receive notifications about your DAOs and proposals.`
    );
  } catch (error) {
    console.error('Link command error:', error);
    await sendTelegramMessage(
      chatId,
      '❌ Error processing link request. Please try again.'
    );
  }
}
```

---

## 2. Vote Recording Implementation

### Database Schema

```sql
-- Create votes table if not exists
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Proposal being voted on
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  
  -- User casting vote
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Vote value (true = yes, false = no)
  vote BOOLEAN NOT NULL,
  
  -- How much voting power was used
  voting_power NUMERIC(10, 2) NOT NULL,
  
  -- Transaction/block where vote was recorded
  transaction_hash VARCHAR(256),
  
  -- When vote was cast
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  
  -- Prevent duplicate votes
  UNIQUE(proposal_id, user_id),
  
  -- Indexes
  INDEX idx_proposal_votes (proposal_id),
  INDEX idx_user_votes (user_id),
  INDEX idx_created_at (created_at)
);

-- Update proposals table to track vote counts
ALTER TABLE proposals ADD COLUMN for_votes INTEGER DEFAULT 0;
ALTER TABLE proposals ADD COLUMN against_votes INTEGER DEFAULT 0;
ALTER TABLE proposals ADD COLUMN total_votes INTEGER DEFAULT 0;
```

### Implementation: Vote Handler

```typescript
// In server/routes/telegram-integration.ts

/**
 * Calculate voting power for a user
 * TODO: Implement full voting power calculation based on:
 * - Token holdings in DAO
 * - Delegation status
 * - Vote multipliers (early participation, etc.)
 */
async function calculateVotingPower(
  userId: string,
  proposalId: string
): Promise<{ power: number; reason: string }> {
  // Placeholder: all linked users have voting power
  return {
    power: 1.0,
    reason: 'Account linked',
  };
}

/**
 * Enhanced vote handler with proper validation and recording
 */
async function handleVote(
  chatId: number | string,
  telegramUserId: number,
  args: string[]
) {
  try {
    // Validate input
    const user = await db.query.users.findFirst({
      where: eq(users.telegramChatId, telegramUserId.toString()),
    });

    if (!user) {
      await sendTelegramMessage(chatId, '❌ Please link your account first');
      return;
    }

    if (args.length < 2) {
      await sendTelegramMessage(
        chatId,
        '❌ Usage: /vote &lt;proposal_id&gt; &lt;yes|no&gt;'
      );
      return;
    }

    const [proposalId, voteArg] = args;
    const voteValue = voteArg.toLowerCase() === 'yes';

    // Fetch and validate proposal
    const proposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
    });

    if (!proposal) {
      await sendTelegramMessage(
        chatId,
        `❌ Proposal <code>${escapeHtml(proposalId)}</code> not found.`
      );
      return;
    }

    if (proposal.status !== 'active') {
      await sendTelegramMessage(
        chatId,
        `❌ Proposal is no longer active (status: ${escapeHtml(proposal.status)})`
      );
      return;
    }

    // Calculate voting power
    const votingCalc = await calculateVotingPower(user.id, proposalId);
    if (votingCalc.power <= 0) {
      await sendTelegramMessage(
        chatId,
        `❌ You do not have voting power for this proposal. (Reason: ${votingCalc.reason})`
      );
      return;
    }

    // Check if already voted
    const existingVote = await db.query.votes.findFirst({
      where: and(
        eq(votes.proposalId, proposalId),
        eq(votes.userId, user.id)
      ),
    });

    if (existingVote) {
      await sendTelegramMessage(
        chatId,
        '❌ You have already voted on this proposal. Cannot vote twice.'
      );
      return;
    }

    // Record vote atomically
    await db.transaction(async (tx) => {
      // Insert vote record
      await tx.insert(votes).values({
        proposalId,
        userId: user.id,
        vote: voteValue,
        votingPower: votingCalc.power,
      });

      // Update proposal vote counts
      if (voteValue) {
        await tx.update(proposals)
          .set({
            forVotes: (proposal.forVotes || 0) + 1,
            totalVotes: (proposal.totalVotes || 0) + 1,
          })
          .where(eq(proposals.id, proposalId));
      } else {
        await tx.update(proposals)
          .set({
            againstVotes: (proposal.againstVotes || 0) + 1,
            totalVotes: (proposal.totalVotes || 0) + 1,
          })
          .where(eq(proposals.id, proposalId));
      }
    });

    // Confirm vote
    await sendTelegramMessage(
      chatId,
      `✅ <b>Vote Recorded</b>\n\nProposal: ${escapeHtml(proposal.title)}\n\nYour vote: ${voteValue ? '👍 Yes' : '👎 No'}\n\nVoting power used: ${votingCalc.power}`
    );
  } catch (error) {
    console.error('Vote command error:', error);
    await sendTelegramMessage(
      chatId,
      '❌ Error processing your vote. Please try again.'
    );
  }
}
```

---

## 3. Voting Power Calculation

### Architecture

Voting power should consider:

1. **Token Stake:** User's holdings in DAO treasury token
2. **Delegation:** Votes received from other users
3. **Multipliers:**
   - Early participation bonus
   - Engagement bonus
   - Role-based multiplier (founder, moderator, etc.)

### Implementation Template

```typescript
// In server/lib/voting-power.ts

export interface VotingPowerBreakdown {
  baseVotingPower: number;
  delegatedVotes: number;
  multipliers: {
    earlyParticipation: number;
    engagement: number;
    role: number;
  };
  totalVotingPower: number;
}

export async function calculateVotingPower(
  userId: string,
  daoId: string
): Promise<VotingPowerBreakdown> {
  // 1. Get user's token balance in DAO
  const userBalance = await db.query.userTokenBalances.findFirst({
    where: and(
      eq(userTokenBalances.userId, userId),
      eq(userTokenBalances.daoId, daoId)
    ),
  });

  const baseVotingPower = userBalance?.balance || 0;

  // 2. Get delegated votes
  const delegations = await db.query.voteDelegations.findMany({
    where: eq(voteDelegations.delegateTo, userId),
  });

  const delegatedVotes = delegations.reduce((sum, d) => sum + d.amount, 0);

  // 3. Calculate multipliers
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  const createdWeeksAgo = Math.floor(
    (Date.now() - (user?.createdAt?.getTime() || 0)) / (7 * 24 * 60 * 60 * 1000)
  );
  const earlyParticipationMultiplier = createdWeeksAgo <= 4 ? 1.5 : 1.0;

  const engagementMultiplier = 1.0; // TODO: Base on voting history
  const roleMultiplier = 1.0; // TODO: Check for special roles

  // 4. Calculate total
  const totalVotingPower =
    (baseVotingPower + delegatedVotes) *
    earlyParticipationMultiplier *
    engagementMultiplier *
    roleMultiplier;

  return {
    baseVotingPower,
    delegatedVotes,
    multipliers: {
      earlyParticipation: earlyParticipationMultiplier,
      engagement: engagementMultiplier,
      role: roleMultiplier,
    },
    totalVotingPower,
  };
}
```

---

## 4. Rate Limiting for Telegram Commands

### Implementation

```typescript
// In server/middleware/telegram-rate-limit.ts

import rateLimit from 'express-rate-limit';

/**
 * Rate limiting for Telegram commands
 * Prevents spam and abuse
 */
export const telegramCommandLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // 10 requests per minute per Telegram ID
  keyGenerator: (req) => {
    // Rate limit by Telegram user ID
    return req.body?.message?.from?.id?.toString() || req.ip || 'unknown';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please wait before sending another command',
      retryAfter: 60,
    });
  },
  skip: (req) => {
    // Don't rate limit webhook verification requests
    return req.path !== '/webhook';
  },
});

// Apply to webhook route:
// router.post('/webhook', telegramCommandLimiter, async (req, res) => {...})
```

---

## 5. Audit Logging for Admin Actions

### Database Schema

```sql
CREATE TABLE telegram_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Action type (SET_WEBHOOK, GET_INFO, etc.)
  action VARCHAR(50) NOT NULL,
  
  -- Admin user who performed action
  admin_id UUID,
  admin_ip VARCHAR(45),
  
  -- Action details
  details JSONB,
  
  -- Result (SUCCESS, FAILURE)
  result VARCHAR(20) NOT NULL,
  error_message TEXT,
  
  -- When
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  
  INDEX idx_action (action),
  INDEX idx_admin_id (admin_id),
  INDEX idx_created_at (created_at)
);
```

### Implementation

```typescript
// Update middleware in server/middleware/telegram-auth.ts

export async function requireAdminAuth(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    const adminToken = process.env.TELEGRAM_ADMIN_TOKEN;

    const logEntry = {
      action: req.path.split('/').pop() || 'unknown',
      adminIp: req.ip,
      details: {
        path: req.path,
        method: req.method,
      },
      result: 'PENDING',
    };

    if (!adminToken) {
      logEntry.result = 'FAILURE';
      logEntry.error_message = 'Admin token not configured';
      await logTelegramAudit(logEntry);
      return res.status(403).json({ error: 'Admin token not configured' });
    }

    const token = authHeader?.replace('Bearer ', '');
    if (token !== adminToken) {
      logEntry.result = 'FAILURE';
      logEntry.error_message = 'Invalid or missing token';
      await logTelegramAudit(logEntry);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Mark as successful (will be updated if handler fails)
    (req as any).auditLog = logEntry;
    (req as any).auditLog.result = 'SUCCESS';

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

async function logTelegramAudit(entry: any) {
  try {
    await db.insert(telegram_audit_log).values(entry);
  } catch (error) {
    console.error('Audit log error:', error);
  }
}
```

---

## Deployment Checklist

- [ ] Create telegram_link_tokens table
- [ ] Create votes table
- [ ] Create telegram_audit_log table
- [ ] Add telegram_chat_id and telegram_username to users
- [ ] Configure TELEGRAM_BOT_TOKEN
- [ ] Configure TELEGRAM_BOT_USERNAME
- [ ] Generate and set TELEGRAM_SECRET_TOKEN
- [ ] Generate and set TELEGRAM_ADMIN_TOKEN
- [ ] Set webhook via POST /api/telegram/set-webhook
- [ ] Test webhook with GET /api/telegram/webhook-info
- [ ] Test all commands: /start, /balance, /proposals, /vote, /link
- [ ] Test error cases and rate limiting
- [ ] Monitor audit logs for suspicious activity

---

## Testing Commands

```bash
# Verify webhook is set correctly
curl -X GET \
  -H "Authorization: Bearer $TELEGRAM_ADMIN_TOKEN" \
  https://yourdomain.com/api/telegram/webhook-info

# Generate link token (with valid JWT)
curl -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  https://yourdomain.com/api/auth/telegram-link

# View audit logs
curl -X GET \
  https://yourdomain.com/api/admin/telegram/audit-log \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
