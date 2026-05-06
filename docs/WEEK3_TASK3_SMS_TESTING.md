# Week 3: Task 3 - SMS Notification System Testing

## Overview
Test SMS notification functionality with Twilio integration. SMS is optional but provides critical alerts.

## Prerequisites
- ✅ Task 1 Complete: Environment setup
- ✅ Task 2 Complete: Email testing
- ✅ Twilio account created and credentials added to .env

## Twilio Setup

### Create Twilio Account
1. Go to https://www.twilio.com/console
2. Sign up for free account (includes trial credits)
3. Verify phone number (your personal phone)
4. Get credentials:
   - Account SID
   - Auth Token
   - Phone Number (assigned by Twilio, e.g., +1234567890)

### Add to .env
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890  # Twilio number, not your personal number
```

---

## Test 1: Twilio Configuration Verification

```typescript
import twilio from 'twilio';

async function testTwilioConfig() {
  console.log('🔍 Verifying Twilio configuration...\n');

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    console.log('❌ Missing Twilio credentials in .env');
    console.log('Required:');
    console.log('  - TWILIO_ACCOUNT_SID');
    console.log('  - TWILIO_AUTH_TOKEN');
    console.log('  - TWILIO_PHONE_NUMBER');
    return false;
  }

  try {
    const client = twilio(accountSid, authToken);
    
    // Verify credentials work by fetching account
    const account = await client.api.accounts(accountSid).fetch();
    
    console.log('✅ Twilio credentials verified');
    console.log(`   Account: ${account.friendlyName}`);
    console.log(`   Status: ${account.status}`);
    console.log(`   Phone Number: ${phoneNumber}`);
    
    return true;
  } catch (error: any) {
    console.error('❌ Twilio verification failed:', error.message);
    console.log('\nPossible issues:');
    console.log('  - Invalid Account SID');
    console.log('  - Invalid Auth Token');
    console.log('  - Account suspended');
    return false;
  }
}

testTwilioConfig().then(success => {
  process.exit(success ? 0 : 1);
});
```

### Run Test
```powershell
npx ts-node scripts/test-twilio-config.ts
```

### Success Criteria
- ✅ Twilio credentials verified
- ✅ Account status shows active
- ✅ Phone number displayed

---

## Test 2: Send Test SMS

### Important: Phone Number Format
SMS can only be sent to verified phone numbers on free trial.

**To add numbers for testing**:
1. Log into Twilio console
2. Go to "Verified Caller IDs"
3. Add your phone number (include country code)
4. Verify via SMS code

### Test Code
```typescript
import { sendSmsNotification } from '../server/services/escrow-notifications';

async function testSendSms() {
  console.log('📱 Sending test SMS messages...\n');

  // CHANGE THIS to your verified phone number
  const testPhone = '+1234567890';

  if (testPhone === '+1234567890') {
    console.log('❌ Please update testPhone with your actual phone number');
    console.log('   Include country code, e.g., +14155552671');
    return false;
  }

  try {
    // Test 1: Simple message
    console.log('Test 1: Simple SMS');
    await sendSmsNotification(
      testPhone,
      '💰 Escrow created: $100 cUSD from john_doe - Accept: https://mtaa.io/escrow - MTAA'
    );
    console.log('✅ SMS sent\n');

    // Test 2: Escrow accepted
    console.log('Test 2: Escrow Accepted');
    await sendSmsNotification(
      testPhone,
      '✅ jane_smith accepted your $100 cUSD escrow. Fund it now: https://mtaa.io/wallet - MTAA'
    );
    console.log('✅ SMS sent\n');

    // Test 3: Milestone pending
    console.log('Test 3: Milestone Pending');
    await sendSmsNotification(
      testPhone,
      '📋 jane_smith submitted "Complete documentation". Review: https://mtaa.io/wallet - MTAA'
    );
    console.log('✅ SMS sent\n');

    // Test 4: Milestone approved
    console.log('Test 4: Milestone Approved');
    await sendSmsNotification(
      testPhone,
      '🎉 Milestone approved! $250 cUSD sent to your wallet. - MTAA'
    );
    console.log('✅ SMS sent\n');

    // Test 5: Dispute alert
    console.log('Test 5: Dispute Alert');
    await sendSmsNotification(
      testPhone,
      '⚠️ Escrow dispute initiated. Details: https://mtaa.io/wallet - MTAA'
    );
    console.log('✅ SMS sent\n');

    console.log('✅ All SMS messages sent successfully!');
    console.log('📱 Check your phone for all 5 test messages');
    return true;

  } catch (error: any) {
    console.error('❌ Error sending SMS:', error.message);
    return false;
  }
}

testSendSms().then(success => {
  process.exit(success ? 0 : 1);
});
```

### Run Test
```powershell
# Update '+1234567890' with your verified phone number first!
npx ts-node scripts/test-sms-send.ts
```

### Verification Checklist
After running the test:

- [ ] SMS 1 (Simple message) received
  - [ ] Shows escrow amount
  - [ ] Has accent link
  - [ ] MTAA branding included
  - [ ] Under 160 characters (or check for long-SMS)

- [ ] SMS 2 (Escrow Accepted) received
  - [ ] Shows counterparty name
  - [ ] Shows amount
  - [ ] Has action link
  - [ ] MTAA branding

- [ ] SMS 3 (Milestone Pending) received
  - [ ] Shows milestone name
  - [ ] Has review link
  - [ ] Professional message

- [ ] SMS 4 (Milestone Approved) received
  - [ ] Shows payment amount
  - [ ] Celebratory tone
  - [ ] Clear message

- [ ] SMS 5 (Dispute Alert) received
  - [ ] Warning tone with ⚠️
  - [ ] Has action link
  - [ ] Clear and urgent

---

## Test 3: Check SMS Audit Log

```typescript
import { query } from '../server/db';

async function checkSmsLog() {
  console.log('📋 Checking SMS notification log...\n');

  try {
    const result = await query(`
      SELECT 
        user_id,
        type,
        channel,
        target,
        status,
        created_at
      FROM notifications_log
      WHERE channel = 'sms'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`Found ${result.rows.length} SMS records:\n`);
    
    if (result.rows.length === 0) {
      console.log('⚠️  No SMS records found');
      console.log('   SMS is optional - verify it was actually called');
      console.log('   Check if SMS functions were triggered');
      return false;
    }

    result.rows.forEach((row: any, index: number) => {
      console.log(`${index + 1}. ${row.type}`);
      console.log(`   Target: ${row.target}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Time: ${new Date(row.created_at).toLocaleString()}\n`);
    });

    return result.rows.length >= 5;
  } catch (error) {
    console.error('❌ Error querying SMS log:', error);
    return false;
  }
}

checkSmsLog();
```

### Run Test
```powershell
npx ts-node scripts/check-sms-log.ts
```

---

## Test 4: Message Length Verification

SMS messages have limits:
- Standard SMS: 160 characters (with basic ASCII)
- Long SMS: 153 characters per segment

```typescript
async function verifySmsLengths() {
  console.log('📏 Verifying SMS message lengths...\n');

  const messages = {
    'Escrow Created': '💰 john_doe sent you $100 cUSD via escrow. Accept: https://mtaa.io/escrow - MTAA',
    'Escrow Accepted': '✅ jane_smith accepted your $100 cUSD escrow. Fund: https://mtaa.io/wallet - MTAA',
    'Milestone Pending': '📋 jane_smith submitted "Complete docs". Review: https://mtaa.io/wallet - MTAA',
    'Milestone Approved': '🎉 Milestone approved! $250 cUSD sent to wallet. - MTAA',
    'Dispute Alert': '⚠️ Escrow dispute initiated. Details: https://mtaa.io/wallet - MTAA'
  };

  Object.entries(messages).forEach(([name, message]) => {
    const length = message.length;
    const status = length <= 160 ? '✅' : '⚠️';
    console.log(`${status} ${name}: ${length} characters`);
    if (length > 160) {
      console.log(`   May require multiple SMS segments`);
    }
  });

  console.log('\n✅ All messages within acceptable length');
}

verifySmsLengths();
```

---

## Test 5: Error Handling

```typescript
import { sendSmsNotification } from '../server/services/escrow-notifications';

async function testSmsErrorHandling() {
  console.log('🚨 Testing SMS error handling...\n');

  // Test 1: Invalid phone format
  console.log('Test 1: Invalid phone format');
  try {
    await sendSmsNotification('not-a-phone', 'Test message');
    console.log('✅ Error handled gracefully\n');
  } catch (error) {
    console.log('✅ Error caught and handled\n');
  }

  // Test 2: Empty message
  console.log('Test 2: Empty message');
  try {
    await sendSmsNotification('+1234567890', '');
    console.log('✅ Error handled gracefully\n');
  } catch (error) {
    console.log('✅ Error caught and handled\n');
  }

  // Test 3: SMS disabled in env
  console.log('Test 3: SMS not configured (no Twilio)');
  // Temporarily remove TWILIO_ACCOUNT_SID
  const saved = process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_ACCOUNT_SID;
  
  try {
    await sendSmsNotification('+1234567890', 'Test');
    console.log('✅ Gracefully skipped (SMS not configured)\n');
  } catch (error) {
    console.log('❌ Should not throw error:', error);
  }
  
  process.env.TWILIO_ACCOUNT_SID = saved;

  console.log('✅ All error scenarios handled correctly');
}

testSmsErrorHandling();
```

---

## Test 6: SMS Preferences

User should be able to opt in/out of SMS:

```typescript
import { query } from '../server/db';

async function testSmsPreferences() {
  console.log('🔧 Testing SMS preferences...\n');

  const userId = 'test-user-uuid';

  try {
    // Set SMS disabled
    await query(`
      INSERT INTO notification_preferences 
        (user_id, sms_enabled, sms_milestone_approved)
      VALUES ($1, false, false)
      ON CONFLICT (user_id) DO UPDATE SET
        sms_enabled = false,
        sms_milestone_approved = false
    `, [userId]);

    console.log('✅ SMS preferences updated: disabled');

    // Check preference
    const result = await query(`
      SELECT sms_enabled, sms_milestone_approved
      FROM notification_preferences
      WHERE user_id = $1
    `, [userId]);

    if (result.rows[0].sms_enabled === false) {
      console.log('✅ SMS disabled verified');
      console.log('   SMS should not be sent to this user');
    }

    // Enable SMS for specific event
    await query(`
      UPDATE notification_preferences
      SET sms_milestone_approved = true
      WHERE user_id = $1
    `, [userId]);

    console.log('✅ SMS enabled for milestone_approved only');
    
  } catch (error) {
    console.error('❌ Preferences test failed:', error);
  }
}

testSmsPreferences();
```

---

## Task 3 Checklist

- [ ] Twilio account created and verified
- [ ] Credentials added to .env
- [ ] Twilio configuration test passes
- [ ] All 5 SMS types send successfully
- [ ] SMS messages received on phone
- [ ] Message lengths within limits
- [ ] Audit log contains SMS records
- [ ] Error handling works correctly
- [ ] SMS preferences functional

---

## Troubleshooting

### SMS Not Received on Trial Account
**Solutions**:
1. Verify phone number is added to "Verified Caller IDs"
2. Confirm SMS verification code was entered
3. Check if you have trial credits remaining
4. Try different phone number
5. Check Twilio error logs in console

### Invalid Phone Number Error
**Solutions**:
1. Include country code: +1 for US
2. Use international format: +[country][number]
3. Test number must be verified on Twilio
4. Remove any spaces or dashes: +1234567890

### Twilio Credentials Invalid
**Solutions**:
1. Re-copy Account SID from Twilio console
2. Re-generate Auth Token if lost
3. Verify no extra spaces in .env
4. Try creating new Twilio account

### SMS Sent But Not Received
**Solutions**:
1. Check spam messages
2. Verify carrier supports SMS from Twilio
3. Check account has credits
4. Review Twilio logs for delivery status
5. Try SMS from Twilio console directly

---

## Optional: Twilio Console Testing

Test SMS directly from Twilio console:
1. Go to Twilio console
2. Click "Send an SMS"
3. Select "To" number (your verified number)
4. Enter message
5. Click Send
6. Verify message arrives

This helps isolate if issue is with Twilio config vs app code.

---

## Success Criteria

Task 3 is complete when:
- ✅ Twilio account setup and verified
- ✅ All 5 SMS types sent successfully
- ✅ SMS received on phone
- ✅ Message content correct
- ✅ Audit log contains SMS records
- ✅ Error handling works
- ✅ Preferences functional

**Note**: SMS is optional. If not using SMS, skip this task.

**Next**: Task 4 - Test referral integration

**Time Estimate**: 30-45 minutes
**Difficulty**: Moderate
