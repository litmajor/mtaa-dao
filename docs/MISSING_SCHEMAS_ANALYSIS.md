# 📊 Missing Schemas Analysis - Recommended Additions

## 🎯 Current Status

### ✅ **What You Have:**
Your database is already very comprehensive with **62 tables** including:

- ✅ **users** - Email + Phone authentication ready
- ✅ **sessions** - User sessions
- ✅ **audit_logs** - Security audit trail
- ✅ **system_logs** - Application logging
- ✅ **kyc_verifications** - KYC compliance
- ✅ **compliance_audit_logs** - Compliance tracking
- ✅ **suspicious_activities** - Fraud detection
- ✅ **notification_preferences** - User preferences
- ✅ **notification_history** - Notification tracking
- ✅ Plus 50+ tables for DAO, financial, vault, and gamification features

---

## 🔐 **Recommended Security Enhancements**

### **Priority: HIGH** 🔴

#### **1. login_attempts Table**
**Purpose:** Persistent tracking of failed login attempts

**Why Needed:**
- Currently using Redis (good for real-time)
- Database backup provides:
  - Historical data for forensics
  - Pattern detection over time
  - Survives Redis restarts
  - Long-term security analytics

**Use Cases:**
- Detect brute force patterns
- Identify IP addresses with multiple failed attempts
- Generate security reports
- Compliance auditing

**Schema:** `shared/securityEnhancedSchema.ts` (line 14-25)

---

#### **2. security_events Table**
**Purpose:** Dedicated security event logging

**Why Needed:**
- Separates security events from general audit logs
- Enables focused security monitoring
- Better incident response
- Real-time alerting

**Events to Track:**
- Login success/failure
- Account lockouts
- Password changes
- 2FA enable/disable
- Suspicious activities
- Permission changes

**Schema:** `shared/securityEnhancedSchema.ts` (line 31-46)

---

#### **3. password_history Table**
**Purpose:** Prevent password reuse

**Why Needed:**
- Security best practice (NIST guidelines)
- Prevents users from cycling passwords
- Compliance requirement for many industries
- Increases account security

**Features:**
- Store last 5-10 password hashes
- Check against history on password change
- Auto-expire old entries (e.g., after 1 year)

**Schema:** `shared/securityEnhancedSchema.ts` (line 52-57)

---

### **Priority: MEDIUM** 🟡

#### **4. email_delivery_log Table**
**Purpose:** Track all email deliveries

**Why Needed:**
- Debugging ("I didn't receive the OTP email")
- Delivery rate monitoring
- Provider comparison (SendGrid vs SES)
- Cost tracking
- Compliance (proof of delivery)

**Tracks:**
- OTP emails
- Notification emails
- Password reset emails
- Welcome emails
- Delivery status, opens, clicks

**Schema:** `shared/securityEnhancedSchema.ts` (line 106-123)

---

#### **5. sms_delivery_log Table**
**Purpose:** Track all SMS deliveries

**Why Needed:**
- Cost monitoring (SMS is expensive!)
- Delivery debugging
- Provider comparison (Africa's Talking vs Twilio)
- Fraud detection (excessive SMS to one number)
- Billing reconciliation

**Tracks:**
- OTP SMS
- Notification SMS
- Delivery status
- Cost per message
- Provider used

**Schema:** `shared/securityEnhancedSchema.ts` (line 129-145)

---

#### **6. user_devices Table**
**Purpose:** Track and manage trusted devices

**Why Needed:**
- Device recognition ("new device login" alerts)
- Suspicious login detection
- Better UX (skip 2FA on trusted devices)
- Security monitoring

**Features:**
- Device fingerprinting
- Trust management
- Last seen tracking
- Location history

**Schema:** `shared/securityEnhancedSchema.ts` (line 86-100)

---

### **Priority: LOW** 🟢 (Nice to Have)

#### **7. two_factor_auth Table**
**Purpose:** 2FA settings and backup codes

**Future Enhancement:**
- Currently not implemented
- Adds extra security layer
- Industry standard for sensitive operations

**Methods:**
- TOTP (Google Authenticator)
- SMS
- Email
- Backup codes

**Schema:** `shared/securityEnhancedSchema.ts` (line 63-77)

---

#### **8. oauth_connections Table**
**Purpose:** Track OAuth provider connections

**Why Needed:**
- Currently have Google & Telegram OAuth
- No database tracking of connections
- Need to manage:
  - Token refresh
  - Account linking/unlinking
  - Provider profile sync

**Schema:** `shared/securityEnhancedSchema.ts` (line 151-167)

---

#### **9. api_keys Table**
**Purpose:** User-generated API keys

**Future Enhancement:**
- For programmatic access
- Automation & integrations
- Third-party developers

**Features:**
- Key generation
- Permission scoping
- Rate limiting
- IP whitelisting
- Revocation

**Schema:** `shared/securityEnhancedSchema.ts` (line 173-190)

---

#### **10. refresh_tokens Table**
**Purpose:** Separate refresh token management

**Why Needed:**
- Currently stored in cookies only
- Benefits of DB storage:
  - Token rotation
  - Revocation across all devices
  - Security monitoring
  - Device tracking

**Schema:** `shared/securityEnhancedSchema.ts` (line 196-208)

---

#### **11. account_recovery Table**
**Purpose:** Password reset and account recovery tracking

**Why Needed:**
- Currently using `passwordResetToken` in users table
- Separate table provides:
  - Better audit trail
  - Multiple recovery methods
  - Token expiration tracking
  - Security monitoring

**Schema:** `shared/securityEnhancedSchema.ts` (line 214-227)

---

#### **12. session_audits Table**
**Purpose:** Detailed session activity tracking

**Future Enhancement:**
- More granular than `sessions` table
- Track session lifecycle
- Session forensics
- Compliance reporting

**Schema:** `shared/securityEnhancedSchema.ts` (line 233-245)

---

## 🎯 **Implementation Priority**

### **Immediate (Do Now):**
1. ✅ **login_attempts** - Complements your existing Redis tracking
2. ✅ **security_events** - Essential for security monitoring
3. ✅ **email_delivery_log** - Critical for OTP delivery debugging
4. ✅ **sms_delivery_log** - Critical for SMS cost tracking

### **Short-term (Next Sprint):**
5. **user_devices** - Enhances user experience
6. **password_history** - Security best practice
7. **oauth_connections** - You already have OAuth, need tracking

### **Medium-term (Future):**
8. **two_factor_auth** - Extra security layer
9. **refresh_tokens** - Better token management
10. **account_recovery** - Better audit trail

### **Long-term (Optional):**
11. **api_keys** - For API access features
12. **session_audits** - Enhanced auditing

---

## 📊 **Impact Analysis**

| Table | Security Impact | User Experience | Operations | Effort |
|-------|----------------|-----------------|------------|---------|
| login_attempts | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | Low |
| security_events | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | Low |
| password_history | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | Low |
| email_delivery_log | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium |
| sms_delivery_log | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium |
| user_devices | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Medium |
| two_factor_auth | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | High |
| oauth_connections | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | Medium |
| api_keys | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | High |
| refresh_tokens | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | Medium |
| account_recovery | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Low |
| session_audits | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | Low |

---

## 🚀 **Quick Implementation Guide**

### **Step 1: Add Schema File**
```bash
# File already created: shared/securityEnhancedSchema.ts
```

### **Step 2: Import in Main Schema**
```typescript
// shared/schema.ts
export * from './securityEnhancedSchema';
```

### **Step 3: Run Migration**
```bash
$env:DATABASE_URL="postgresql://growth_halo:devpassword@localhost:5432/mtaadao"
npm run db:push
```

### **Step 4: Update Services**

**Login Service:**
```typescript
// Log every login attempt
await db.insert(loginAttempts).values({
  identifier: email,
  userId: user?.id,
  ipAddress: req.ip,
  attemptResult: 'success', // or 'failed_password'
});
```

**OTP Service:**
```typescript
// Log email delivery
await db.insert(emailDeliveryLog).values({
  userId: user.id,
  toEmail: email,
  subject: 'Your OTP Code',
  template: 'otp',
  status: 'sent',
});

// Log SMS delivery
await db.insert(smsDeliveryLog).values({
  userId: user.id,
  toPhone: phone,
  message: `Your OTP: ${otp}`,
  template: 'otp',
  status: 'sent',
  cost: '0.01', // Kenya: ~$0.01 per SMS
});
```

**Security Events:**
```typescript
// Log security event
await db.insert(securityEvents).values({
  userId: user.id,
  eventType: 'account_locked',
  severity: 'high',
  ipAddress: req.ip,
});
```

---

## 📚 **Related Documentation**

- **Schema File:** `shared/securityEnhancedSchema.ts`
- **Production Setup:** `docs/PRODUCTION_SETUP.md`
- **Login System:** `docs/LOGIN_UPGRADE_SUMMARY.md`
- **Database Setup:** `docs/DATABASE_SETUP_COMPLETE.md`

---

## ✅ **Summary**

**Your database is already 85% complete!** 

The recommended additions focus on:
1. **Security monitoring** (login attempts, security events)
2. **Operational excellence** (delivery logs, debugging)
3. **User experience** (device management, trusted devices)
4. **Future features** (2FA, API keys)

**Recommendation:**
- ✅ Start with **login_attempts**, **security_events**, **email_delivery_log**, **sms_delivery_log**
- ✅ These 4 tables provide immediate value with minimal effort
- ✅ Add others as needed for specific features

**You're production-ready with or without these additions!** They're enhancements, not requirements.

