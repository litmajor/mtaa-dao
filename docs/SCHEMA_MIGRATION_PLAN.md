# 🚀 Schema Migration Plan - Security Enhancements

## 📋 Current Situation

You have a comprehensive database with **62 existing tables** covering:
- ✅ Authentication (users, sessions)
- ✅ DAO management (daos, proposals, votes)
- ✅ Financial operations (contributions, vaults, transactions)
- ✅ Compliance (KYC, audit logs, suspicious activities)
- ✅ Gamification (achievements, tasks, reputation)
- ✅ Communication (notifications, messages)

## 🎯 New Security Tables Added

I've created **12 additional security tables** in `shared/securityEnhancedSchema.ts`:

### **Priority: HIGH** 🔴
1. **login_attempts** - Track all login attempts (success/failure)
2. **security_events** - Dedicated security event logging
3. **password_history** - Prevent password reuse
4. **email_delivery_log** - Track all email deliveries (OTP, notifications)
5. **sms_delivery_log** - Track all SMS deliveries (OTP, notifications)
6. **user_devices** - Track and manage trusted devices

### **Priority: MEDIUM/LOW** 🟡🟢
7. **two_factor_auth** - 2FA settings and backup codes
8. **oauth_connections** - Track OAuth provider connections
9. **api_keys** - User-generated API keys
10. **refresh_tokens** - Separate refresh token management
11. **account_recovery** - Password reset tracking
12. **session_audits** - Detailed session activity

## 📊 Implementation Options

### **Option 1: Migrate All Tables Now** (Recommended for Development)

**Steps:**
```bash
# 1. Set database URL
$env:DATABASE_URL="postgresql://growth_halo:devpassword@localhost:5432/mtaadao"

# 2. Push all schemas to database
npm run db:push

# 3. Confirm changes when prompted
# Press 'y' to apply changes
```

**Pros:**
- ✅ All security features ready
- ✅ Future-proof architecture
- ✅ Best practices in place

**Cons:**
- ⚠️ 12 new empty tables (minimal impact)

---

### **Option 2: Selective Migration** (Production Approach)

Add tables incrementally as you implement features:

#### **Phase 1: Immediate Value** (Week 1)
```typescript
// shared/schema.ts - Comment out tables you don't need yet
// export * from './securityEnhancedSchema'; // Comment this line

// Then manually export only what you need:
export { 
  loginAttempts, 
  securityEvents,
  emailDeliveryLog,
  smsDeliveryLog 
} from './securityEnhancedSchema';
```

Then migrate:
```bash
npm run db:push
```

#### **Phase 2: Enhanced UX** (Week 2-3)
Add when implementing device management:
```typescript
export { userDevices, passwordHistory } from './securityEnhancedSchema';
```

#### **Phase 3: Advanced Features** (Month 2+)
Add when implementing:
```typescript
export { 
  twoFactorAuth,      // When adding 2FA
  oauthConnections,   // When improving OAuth
  apiKeys,            // When adding API access
  refreshTokens,      // When improving auth
  accountRecovery,    // When adding recovery features
  sessionAudits       // When adding advanced monitoring
} from './securityEnhancedSchema';
```

---

### **Option 3: Skip for Now** (Minimal Approach)

**Current Status:**
- Your auth system is **production-ready** without these tables
- Using Redis for OTP and login tracking
- Using existing `users`, `sessions`, `audit_logs` tables

**When to Add:**
- When you need historical login data
- When implementing 2FA
- When SMS costs become significant
- When implementing API access

---

## 🚀 **My Recommendation**

For your project, I recommend **Option 1** (migrate all now) because:

1. **Development Environment**
   - You're still in development
   - No production data to worry about
   - Easy to test all features

2. **Future-Proof**
   - Tables ready when you need them
   - No migration headaches later
   - Best practices in place

3. **Minimal Cost**
   - Empty tables have negligible storage impact
   - PostgreSQL handles unused tables efficiently
   - Better than creating tables on-demand later

4. **Security First**
   - Having logging tables encourages using them
   - Better security monitoring from day 1
   - Compliance-ready architecture

---

## 📝 **Migration Steps** (Option 1 - Full Migration)

### **Step 1: Verify Database Connection**
```bash
# Check Docker containers
docker ps

# Should see: mtaadao-db (running)
```

### **Step 2: Set Database URL**
```bash
# PowerShell
$env:DATABASE_URL="postgresql://growth_halo:devpassword@localhost:5432/mtaadao"

# Bash/Linux/Mac
export DATABASE_URL="postgresql://growth_halo:devpassword@localhost:5432/mtaadao"
```

### **Step 3: Review Changes**
```bash
# See what changes will be applied
npm run db:push

# Drizzle will show you:
# - Tables to create
# - Columns to add
# - Indexes to create
```

### **Step 4: Apply Migration**
```bash
# When prompted, type 'yes' or 'y' to apply changes
# Drizzle Kit will:
# 1. Create all 12 new tables
# 2. Set up foreign keys
# 3. Create indexes where needed
```

### **Step 5: Verify Migration**
```bash
# Connect to database
docker exec -it mtaadao-db psql -U growth_halo -d mtaadao

# Check new tables
\dt

# Should see:
# - login_attempts
# - security_events
# - password_history
# - email_delivery_log
# - sms_delivery_log
# - user_devices
# - two_factor_auth
# - oauth_connections
# - api_keys
# - refresh_tokens
# - account_recovery
# - session_audits

# Exit psql
\q
```

---

## 🔄 **Updating Your Code to Use New Tables**

### **1. Track Login Attempts**

**File:** `server/api/auth_login.ts`

```typescript
import { loginAttempts, securityEvents } from '@shared/schema';

async function trackLoginAttempt(
  identifier: string, 
  userId: string | null, 
  success: boolean, 
  req: Request
) {
  await db.insert(loginAttempts).values({
    identifier,
    userId,
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'],
    attemptResult: success ? 'success' : 'failed_password',
    failureReason: success ? null : 'Invalid password',
  });

  if (!success) {
    // Also log as security event
    await db.insert(securityEvents).values({
      userId,
      eventType: 'login_failed',
      severity: 'medium',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
      details: { identifier },
    });
  }
}

// In authLoginHandler:
const success = await bcrypt.compare(password, user.password);

// Track attempt
await trackLoginAttempt(email || phone, user.id, success, req);

if (!success) {
  await trackFailedLogin(identifier); // Redis tracking
  return res.status(401).json({ error: 'Invalid credentials' });
}
```

---

### **2. Log Email Deliveries**

**File:** `server/services/otpService.ts`

```typescript
import { emailDeliveryLog } from '@shared/schema';
import { db } from '../db';

async sendEmailOTP(email: string, otp: string): Promise<void> {
  const logId = crypto.randomUUID();
  
  try {
    // Log pending
    await db.insert(emailDeliveryLog).values({
      id: logId,
      toEmail: email,
      subject: 'Your MtaaDAO Verification Code',
      template: 'otp',
      status: 'pending',
      provider: 'nodemailer',
    });

    // Send email
    await this.transporter.sendMail(mailOptions);

    // Update to sent
    await db.update(emailDeliveryLog)
      .set({ 
        status: 'sent', 
        sentAt: new Date(),
        providerMessageId: info.messageId 
      })
      .where(eq(emailDeliveryLog.id, logId));

  } catch (error) {
    // Update to failed
    await db.update(emailDeliveryLog)
      .set({ 
        status: 'failed', 
        errorMessage: error.message 
      })
      .where(eq(emailDeliveryLog.id, logId));
    
    throw error;
  }
}
```

---

### **3. Log SMS Deliveries**

**File:** `server/services/otpService.ts`

```typescript
import { smsDeliveryLog } from '@shared/schema';

async sendSMSOTP(phone: string, otp: string): Promise<void> {
  const message = `Your MtaaDAO verification code is: ${otp}. It expires in 5 minutes.`;
  const logId = crypto.randomUUID();
  
  try {
    // Log pending
    await db.insert(smsDeliveryLog).values({
      id: logId,
      toPhone: phone,
      message,
      template: 'otp',
      status: 'pending',
      provider: 'africas_talking', // or 'twilio'
    });

    // Send SMS (example with Africa's Talking)
    const result = await africastalking.SMS.send({
      to: phone,
      message,
      from: 'MtaaDAO'
    });

    // Update to sent
    await db.update(smsDeliveryLog)
      .set({ 
        status: 'sent', 
        sentAt: new Date(),
        providerMessageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost // Kenya: ~KES 0.80
      })
      .where(eq(smsDeliveryLog.id, logId));

  } catch (error) {
    // Update to failed
    await db.update(smsDeliveryLog)
      .set({ 
        status: 'failed', 
        errorMessage: error.message 
      })
      .where(eq(smsDeliveryLog.id, logId));
    
    throw error;
  }
}
```

---

### **4. Track Security Events**

**File:** `server/middleware/securityMonitor.ts` (NEW)

```typescript
import { securityEvents } from '@shared/schema';
import { db } from '../db';

export async function logSecurityEvent(
  userId: string | null,
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  req: Request,
  details?: any
) {
  await db.insert(securityEvents).values({
    userId,
    eventType,
    severity,
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'],
    details,
  });

  // For critical events, also alert admins
  if (severity === 'critical') {
    // TODO: Send alert to admins
    console.error(`🚨 CRITICAL SECURITY EVENT: ${eventType}`, details);
  }
}

// Usage examples:
// await logSecurityEvent(user.id, 'account_locked', 'high', req);
// await logSecurityEvent(user.id, 'password_changed', 'medium', req);
// await logSecurityEvent(null, 'brute_force_detected', 'critical', req, { attempts: 50 });
```

---

### **5. Password History Check**

**File:** `server/api/auth_changePassword.ts` (NEW)

```typescript
import { passwordHistory } from '@shared/schema';
import bcrypt from 'bcrypt';

async function checkPasswordHistory(userId: string, newPassword: string): Promise<boolean> {
  // Get last 5 passwords
  const history = await db.select()
    .from(passwordHistory)
    .where(eq(passwordHistory.userId, userId))
    .orderBy(desc(passwordHistory.createdAt))
    .limit(5);

  // Check if new password matches any in history
  for (const entry of history) {
    if (await bcrypt.compare(newPassword, entry.passwordHash)) {
      return false; // Password was used before
    }
  }

  return true; // Password is new
}

// When changing password:
const isNewPassword = await checkPasswordHistory(user.id, newPassword);
if (!isNewPassword) {
  return res.status(400).json({ 
    error: 'Cannot reuse any of your last 5 passwords' 
  });
}

// Store new password in history
await db.insert(passwordHistory).values({
  userId: user.id,
  passwordHash: await bcrypt.hash(newPassword, 10),
});
```

---

## 📊 **Monitoring & Analytics**

### **Security Dashboard Queries**

```typescript
// Failed login attempts by IP (last 24 hours)
const failedAttempts = await db.select({
  ipAddress: loginAttempts.ipAddress,
  count: sql<number>`count(*)`,
})
  .from(loginAttempts)
  .where(
    and(
      eq(loginAttempts.attemptResult, 'failed_password'),
      sql`${loginAttempts.createdAt} > NOW() - INTERVAL '24 hours'`
    )
  )
  .groupBy(loginAttempts.ipAddress)
  .orderBy(desc(sql`count(*)`))
  .limit(10);

// Email delivery success rate
const emailStats = await db.select({
  status: emailDeliveryLog.status,
  count: sql<number>`count(*)`,
})
  .from(emailDeliveryLog)
  .groupBy(emailDeliveryLog.status);

// SMS cost analysis (last month)
const smsCosts = await db.select({
  totalCost: sql<number>`SUM(CAST(cost AS DECIMAL))`,
  totalSent: sql<number>`count(*)`,
})
  .from(smsDeliveryLog)
  .where(sql`${smsDeliveryLog.createdAt} > NOW() - INTERVAL '30 days'`);

// Security events by severity
const securityStats = await db.select({
  severity: securityEvents.severity,
  count: sql<number>`count(*)`,
})
  .from(securityEvents)
  .where(sql`${securityEvents.createdAt} > NOW() - INTERVAL '7 days'`)
  .groupBy(securityEvents.severity);
```

---

## ✅ **Summary**

### **What I've Done:**
1. ✅ Created `shared/securityEnhancedSchema.ts` with 12 production-grade security tables
2. ✅ Exported them from `shared/schema.ts`
3. ✅ Created detailed documentation in `docs/MISSING_SCHEMAS_ANALYSIS.md`
4. ✅ Created this migration plan with code examples

### **What You Need to Do:**
1. **Decide:** Option 1 (migrate all), Option 2 (selective), or Option 3 (skip for now)
2. **Migrate:** Run `npm run db:push` (recommended: Option 1)
3. **Integrate:** Update your services to use the new tables (code examples above)
4. **Monitor:** Use the dashboard queries to track security metrics

### **Recommendation:**
✅ **Migrate all tables now** (Option 1) - Your database is development-ready and these tables provide immediate value for production monitoring and debugging.

---

## 🎯 **Next Steps**

```bash
# Ready to migrate? Run:
$env:DATABASE_URL="postgresql://growth_halo:devpassword@localhost:5432/mtaadao"
npm run db:push

# Press 'y' when prompted
# Tables will be created in 10-15 seconds
```

**Questions? Check:**
- `docs/MISSING_SCHEMAS_ANALYSIS.md` - Detailed analysis
- `shared/securityEnhancedSchema.ts` - Full schema definitions
- `docs/PRODUCTION_SETUP.md` - Production deployment guide

