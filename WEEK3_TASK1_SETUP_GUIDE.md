# Week 3: Phase 2 Deployment & Testing Guide

## Overview
Week 3 focuses on deploying Phase 2 to staging, running comprehensive tests, and preparing for Phase 3 features. This guide walks through each step.

## Task 1: Environment Setup & Database Migration

### Step 1.1: Update .env File

Add these variables to your `.env` file:

```env
# ============================================
# EMAIL CONFIGURATION (SMTP)
# ============================================
# Option A: Gmail (Recommended for testing)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@mtaa.io

# Option B: SendGrid
# SMTP_HOST=smtp.sendgrid.net
# SMTP_PORT=587
# SMTP_USER=apikey
# SMTP_PASSWORD=SG.your_sendgrid_key
# SMTP_FROM=noreply@mtaa.io

# Option C: AWS SES
# SMTP_HOST=email-smtp.region.amazonaws.com
# SMTP_PORT=587
# SMTP_USER=your_ses_username
# SMTP_PASSWORD=your_ses_password
# SMTP_FROM=noreply@mtaa.io

# ============================================
# SMS CONFIGURATION (TWILIO) - OPTIONAL
# ============================================
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# ============================================
# REFERRAL SERVICE INTEGRATION
# ============================================
REFERRAL_SERVICE_URL=http://localhost:3001
REFERRAL_SERVICE_KEY=your_referral_service_api_key

# ============================================
# APPLICATION URLs
# ============================================
APP_URL=https://api.mtaa.io
CLIENT_URL=https://app.mtaa.io

# For staging:
# APP_URL=https://api-staging.mtaa.io
# CLIENT_URL=https://app-staging.mtaa.io

# For development:
# APP_URL=http://localhost:3000
# CLIENT_URL=http://localhost:5173
```

### Step 1.2: Gmail Setup (Recommended for Testing)

If using Gmail:

1. **Enable 2-Factor Authentication** on Gmail account
2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Copy the generated 16-character password
   - Use this as `SMTP_PASSWORD` in .env

3. **Verify it's not a test account** (test accounts may have SMTP restrictions)

### Step 1.3: Install Dependencies

```powershell
# Install required packages
npm install nodemailer twilio date-fns

# Verify installation
npm list nodemailer twilio date-fns
```

### Step 1.4: Run Database Migration

Create a migration runner file:

**File**: `scripts/run-migrations.ts`

```typescript
import { migrateNotificationTables } from '../server/db/migrations/001-notification-system';

async function runMigrations() {
  try {
    console.log('🔄 Starting database migrations...');
    
    const result = await migrateNotificationTables();
    
    if (result) {
      console.log('✅ All migrations completed successfully!');
      console.log('📋 Tables created:');
      console.log('   - notification_preferences');
      console.log('   - notifications_log');
      console.log('   - escrow_events');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
```

**Run migration**:
```powershell
npx ts-node scripts/run-migrations.ts
```

**Verify tables were created**:
```sql
-- In your PostgreSQL client
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('notification_preferences', 'notifications_log', 'escrow_events');
```

Expected output: 3 rows (all tables created)

### Step 1.5: Verify Environment Configuration

Create a verification script:

**File**: `scripts/verify-env.ts`

```typescript
import { testEmailConfiguration } from '../server/services/escrow-notifications';

async function verifyEnvironment() {
  console.log('🔍 Verifying environment configuration...\n');

  // Check required env vars
  const required = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
    'APP_URL',
    'CLIENT_URL'
  ];

  const optional = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'REFERRAL_SERVICE_URL',
    'REFERRAL_SERVICE_KEY'
  ];

  let allGood = true;

  console.log('Required Variables:');
  required.forEach(key => {
    const value = process.env[key];
    if (value) {
      console.log(`  ✅ ${key}`);
    } else {
      console.log(`  ❌ ${key} - MISSING`);
      allGood = false;
    }
  });

  console.log('\nOptional Variables:');
  optional.forEach(key => {
    const value = process.env[key];
    if (value) {
      console.log(`  ✅ ${key}`);
    } else {
      console.log(`  ⏭️  ${key} - not configured (will skip)`);
    }
  });

  // Test SMTP configuration
  console.log('\nTesting SMTP Configuration...');
  const emailOk = await testEmailConfiguration();
  
  if (emailOk) {
    console.log('  ✅ SMTP configuration verified');
  } else {
    console.log('  ❌ SMTP configuration failed');
    allGood = false;
  }

  if (allGood) {
    console.log('\n✅ All required configurations are in place!');
    return true;
  } else {
    console.log('\n❌ Some required configurations are missing. Please fix above and try again.');
    return false;
  }
}

verifyEnvironment().then(success => {
  process.exit(success ? 0 : 1);
});
```

**Run verification**:
```powershell
npx ts-node scripts/verify-env.ts
```

### Step 1.6: Test Database Connection

```typescript
// Quick test to verify database migration worked
import { db } from '../server/storage';
import { query } from '../server/db';

async function testDatabaseSetup() {
  try {
    // Check if tables exist
    const result = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('notification_preferences', 'notifications_log', 'escrow_events')
      ORDER BY table_name
    `);

    console.log('✅ Tables found:');
    result.rows.forEach((row: any) => {
      console.log(`   - ${row.table_name}`);
    });

    return result.rows.length === 3;
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
}
```

### Checklist for Task 1

- [ ] All env variables added to `.env`
- [ ] Gmail app password generated (or alternative SMTP configured)
- [ ] Dependencies installed with `npm install`
- [ ] Database migration executed successfully
- [ ] 3 tables created and verified:
  - [ ] notification_preferences
  - [ ] notifications_log
  - [ ] escrow_events
- [ ] SMTP configuration test passes
- [ ] Database connection verified

---

## Next Steps

Once Task 1 is complete:
1. ✅ **Done**: Environment setup & database migration
2. **Next**: Test email notification system (Task 2)
3. **Then**: Test SMS notification system (Task 3)
4. **Then**: Test referral integration (Task 4)
5. **Then**: Integrate UI components (Task 5)
6. **Then**: End-to-end testing (Task 6)
7. **Then**: Performance & security review (Task 7)
8. **Then**: Staging deployment (Task 8)

---

## Troubleshooting

### SMTP Connection Failed
```
Error: connect ECONNREFUSED
```
**Solutions**:
- Verify SMTP_HOST and SMTP_PORT are correct
- Check firewall allows outbound SMTP (port 587)
- For Gmail, ensure app password is used (not regular password)
- Try `telnet smtp.gmail.com 587` to test connection

### Database Migration Failed
```
Error: relation "notification_preferences" already exists
```
**Solutions**:
- Tables may already exist (this is OK)
- Check tables in database: `\dt` (in psql)
- If needed, rollback: `await rollbackNotificationTables()`

### Missing Environment Variables
```
Error: SMTP_USER is not defined
```
**Solutions**:
- Verify .env file exists in project root
- Check variable names match exactly (case-sensitive)
- Restart application after adding variables
- Use `node -e "console.log(process.env.SMTP_USER)"` to debug

### Can't Generate Gmail App Password
**Solutions**:
- Ensure 2FA is enabled on Gmail account
- Account must be regular Google account (not @workspace)
- Visit: https://myaccount.google.com/apppasswords
- If option missing, account may not support app passwords

---

## Success Criteria

Task 1 is complete when:
- ✅ All 7 required env variables set
- ✅ Database tables created (3 tables)
- ✅ SMTP test successful
- ✅ Can connect to database
- ✅ All checklist items checked

**Ready to move to Task 2: Test email notifications**

---

**Status**: Ready to start
**Time Estimate**: 30-45 minutes
**Difficulty**: Moderate
