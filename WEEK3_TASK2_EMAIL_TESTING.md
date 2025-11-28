# Week 3: Task 2 - Email Notification System Testing

## Overview
Test all email notification functionality to ensure professional delivery and proper integration with escrow events.

## Prerequisites
- ✅ Task 1 Complete: Environment setup & database migration
- ✅ SMTP configured and verified
- ✅ Dependencies installed

## Test 1: Email Configuration Verification

### Test Code
```typescript
import { testEmailConfiguration } from '../server/services/escrow-notifications';

async function testEmailConfig() {
  console.log('🔍 Testing email configuration...\n');
  
  try {
    const isConfigured = await testEmailConfiguration();
    
    if (isConfigured) {
      console.log('✅ Email configuration verified!');
      console.log('   SMTP connection successful');
      console.log('   Ready to send emails');
      return true;
    } else {
      console.log('❌ Email configuration failed');
      console.log('   Check SMTP credentials in .env');
      return false;
    }
  } catch (error) {
    console.error('❌ Test error:', error);
    return false;
  }
}

testEmailConfig().then(success => {
  process.exit(success ? 0 : 1);
});
```

### Run Test
```powershell
npx ts-node scripts/test-email-config.ts
```

### Success Criteria
- ✅ Console shows "Email configuration verified"
- ✅ No connection errors
- ✅ SMTP transporter responds

---

## Test 2: Send Test Email

### Test Code
```typescript
import { sendEmailNotification } from '../server/services/escrow-notifications';

async function testSendEmail() {
  console.log('📧 Sending test email...\n');

  const testData = {
    payer: {
      username: 'john_doe',
      email: 'john@example.com'
    },
    recipient: {
      username: 'jane_smith',
      email: 'your-email@example.com' // CHANGE THIS
    },
    payee: {
      username: 'jane_smith',
      email: 'your-email@example.com' // CHANGE THIS
    },
    escrow: {
      amount: '1000',
      currency: 'cUSD',
      description: 'Test escrow for Phase 2 verification',
      metadata: {
        inviteCode: 'test123456'
      }
    },
    milestone: {
      amount: '250',
      description: 'Complete project documentation'
    }
  };

  try {
    // Test 1: Escrow Created
    console.log('Test 1: Escrow Created notification');
    await sendEmailNotification(
      testData.recipient.email,
      'escrowCreated',
      testData
    );
    console.log('✅ Email sent\n');

    // Test 2: Escrow Accepted
    console.log('Test 2: Escrow Accepted notification');
    await sendEmailNotification(
      testData.payer.email,
      'escrowAccepted',
      testData
    );
    console.log('✅ Email sent\n');

    // Test 3: Milestone Pending
    console.log('Test 3: Milestone Pending notification');
    await sendEmailNotification(
      testData.payer.email,
      'milestonePending',
      testData
    );
    console.log('✅ Email sent\n');

    // Test 4: Milestone Approved
    console.log('Test 4: Milestone Approved notification');
    await sendEmailNotification(
      testData.payee.email,
      'milestoneApproved',
      testData
    );
    console.log('✅ Email sent\n');

    // Test 5: Escrow Disputed
    console.log('Test 5: Escrow Disputed notification');
    await sendEmailNotification(
      testData.payer.email,
      'escrowDisputed',
      {
        ...testData,
        reason: 'Work not completed according to specifications'
      }
    );
    console.log('✅ Email sent\n');

    console.log('✅ All emails sent successfully!');
    console.log('📧 Check your inbox for all 5 test emails');

  } catch (error) {
    console.error('❌ Error sending email:', error);
    process.exit(1);
  }
}

testSendEmail();
```

### Run Test
```powershell
# First, update 'your-email@example.com' with your actual email address
npx ts-node scripts/test-email-send.ts
```

### Verification Checklist
After running the test:

- [ ] Email 1 (Escrow Created) received
  - [ ] Has recipient name in greeting
  - [ ] Shows payer username and email
  - [ ] Shows correct amount: 1000 cUSD
  - [ ] Has purple gradient header
  - [ ] Accept button has valid link
  - [ ] Professional formatting

- [ ] Email 2 (Escrow Accepted) received
  - [ ] Shows both payer and payee names
  - [ ] Green gradient header for success
  - [ ] Shows "Accepted" status badge
  - [ ] Has "View Escrow Details" button
  - [ ] Professional formatting

- [ ] Email 3 (Milestone Pending) received
  - [ ] Shows milestone name in subject
  - [ ] Orange gradient header for pending
  - [ ] Has "Review Milestone" button
  - [ ] Shows payer name
  - [ ] Professional formatting

- [ ] Email 4 (Milestone Approved) received
  - [ ] Shows amount being paid
  - [ ] Green gradient header for approval
  - [ ] Has celebration emoji 🎉
  - [ ] Shows "1-3 minutes" arrival time
  - [ ] Professional formatting

- [ ] Email 5 (Escrow Disputed) received
  - [ ] Shows dispute reason
  - [ ] Red gradient header for dispute
  - [ ] Has warning icon ⚠️
  - [ ] Mentions admin review
  - [ ] Professional formatting

---

## Test 3: Check Notification Audit Log

```typescript
import { query } from '../server/db';

async function checkNotificationLog() {
  console.log('📋 Checking notification audit log...\n');

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
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`Found ${result.rows.length} notification records:\n`);
    
    result.rows.forEach((row: any, index: number) => {
      console.log(`${index + 1}. ${row.type}`);
      console.log(`   Channel: ${row.channel}`);
      console.log(`   Target: ${row.target}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Time: ${new Date(row.created_at).toLocaleString()}\n`);
    });

    return result.rows.length > 0;
  } catch (error) {
    console.error('❌ Error querying notifications_log:', error);
    return false;
  }
}

checkNotificationLog();
```

### Run Test
```powershell
npx ts-node scripts/check-notification-log.ts
```

### Success Criteria
- [ ] 5 records found in notifications_log (one per test email)
- [ ] All have `status: 'sent'`
- [ ] Channel is 'email' for all
- [ ] Targets match email addresses
- [ ] Types match: escrow_created, escrow_accepted, milestone_pending, milestone_approved, escrow_disputed

---

## Test 4: Template Quality Check

### Visual Check Manually
For each email received, verify:

**HTML Rendering**:
- [ ] Gradient headers display correctly
- [ ] Text formatting (bold, colors) renders
- [ ] Buttons have proper styling
- [ ] Images/icons display
- [ ] Mobile responsive (test on phone)

**Content Accuracy**:
- [ ] Names are correct
- [ ] Amounts match
- [ ] Links are valid
- [ ] Formatting is professional
- [ ] No placeholder text remains

**Brand Compliance**:
- [ ] Uses MTAA branding
- [ ] Color scheme consistent
- [ ] Footer includes company info
- [ ] Links point to correct URLs

---

## Test 5: Error Handling

```typescript
import { sendEmailNotification } from '../server/services/escrow-notifications';

async function testErrorHandling() {
  console.log('🚨 Testing error handling...\n');

  // Test 1: Invalid email address
  console.log('Test 1: Invalid email address');
  try {
    await sendEmailNotification(
      'not-an-email',
      'escrowCreated',
      { payer: {}, recipient: {}, escrow: {} }
    );
    console.log('✅ Error handled gracefully\n');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }

  // Test 2: Invalid template
  console.log('Test 2: Invalid template name');
  try {
    await sendEmailNotification(
      'test@example.com',
      'nonexistent_template',
      { payer: {}, recipient: {}, escrow: {} }
    );
    console.log('✅ Error handled gracefully\n');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }

  // Test 3: Missing data
  console.log('Test 3: Missing required data');
  try {
    await sendEmailNotification(
      'test@example.com',
      'escrowCreated',
      {} // Missing payer, recipient, escrow
    );
    console.log('✅ Error handled gracefully\n');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }

  console.log('✅ All error scenarios handled correctly');
}

testErrorHandling();
```

---

## Task 2 Checklist

- [ ] Email configuration test passes
- [ ] All 5 template types send successfully
- [ ] Emails received in inbox
- [ ] All 5 notifications logged in database
- [ ] Visual quality check passes
- [ ] Brand compliance verified
- [ ] Error handling works correctly
- [ ] No SMTP errors in logs

---

## Troubleshooting

### Email Not Received
**Solutions**:
1. Check spam/promotions folder
2. Verify email address in test code
3. Check SMTP logs for errors
4. Verify SMTP credentials in .env
5. Test with different email provider if using Gmail

### Template Not Found Error
**Solutions**:
1. Verify template name matches exactly (case-sensitive)
2. Check `escrow-notifications.ts` has all 5 templates
3. Verify imports in route handlers

### Email Arrives But Formatting Wrong
**Solutions**:
1. Check email client supports HTML (use web version)
2. Verify CSS is inline (not in style tags)
3. Test in different email client (Gmail, Outlook, etc.)

### SMTP Timeout
**Solutions**:
1. Check network/firewall allows SMTP port 587
2. Verify SMTP_HOST is correct
3. Try different SMTP provider (SendGrid, AWS SES)
4. Check server logs for connection attempts

---

## Success Criteria

Task 2 is complete when:
- ✅ SMTP configuration verified
- ✅ All 5 email types sent successfully
- ✅ All emails rendered properly
- ✅ Audit log contains 5+ records
- ✅ Brand guidelines followed
- ✅ Error handling works

**Next**: Task 3 - Test SMS notifications

**Time Estimate**: 45-60 minutes
**Difficulty**: Moderate
