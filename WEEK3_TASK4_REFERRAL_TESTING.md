# Week 3: Task 4 - Referral Integration Testing

## Overview
Test the referral tracking system that captures referrers from escrow invites and integrates with the existing referral service.

## Prerequisites
- ✅ Task 1 Complete: Environment setup
- ✅ Task 2 Complete: Email testing
- ✅ Task 3 Complete: SMS testing
- ✅ Referral service running and accessible
- ✅ REFERRAL_SERVICE_URL and REFERRAL_SERVICE_KEY in .env

## Test 1: Referral Service Connectivity

```typescript
async function testReferralServiceConnection() {
  console.log('🔍 Testing referral service connection...\n');

  const serviceUrl = process.env.REFERRAL_SERVICE_URL;
  const serviceKey = process.env.REFERRAL_SERVICE_KEY;

  if (!serviceUrl || !serviceKey) {
    console.log('❌ Missing referral service configuration');
    console.log('Required:');
    console.log('  - REFERRAL_SERVICE_URL');
    console.log('  - REFERRAL_SERVICE_KEY');
    return false;
  }

  try {
    const response = await fetch(`${serviceUrl}/api/health`, {
      headers: {
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    if (response.ok) {
      console.log('✅ Referral service is reachable');
      console.log(`   URL: ${serviceUrl}`);
      console.log(`   Status: ${response.status} OK`);
      return true;
    } else {
      console.log(`❌ Referral service returned: ${response.status}`);
      console.log(`   Check API key validity`);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Cannot reach referral service:', error.message);
    console.log('\nPossible issues:');
    console.log('  - Service not running');
    console.log('  - Wrong REFERRAL_SERVICE_URL');
    console.log('  - Network/firewall blocking');
    console.log('  - API key invalid');
    return false;
  }
}

testReferralServiceConnection().then(success => {
  process.exit(success ? 0 : 1);
});
```

### Run Test
```powershell
npx ts-node scripts/test-referral-service.ts
```

---

## Test 2: Register Escrow Referral

```typescript
import { registerEscrowReferral, trackEscrowReferral } from '../server/services/referral-integration';
import { query } from '../server/db';
import { v4 as uuidv4 } from 'uuid';

async function testRegisterReferral() {
  console.log('🔗 Testing referral registration...\n');

  // Create test IDs
  const referrerId = 'c5f7a8b9-1234-5678-90ab-cdef12345678';
  const refereeId = 'a1b2c3d4-5678-90ab-cdef-123456789012';
  const escrowId = uuidv4();

  try {
    console.log('Test data:');
    console.log(`  Referrer ID: ${referrerId}`);
    console.log(`  Referee ID:  ${refereeId}`);
    console.log(`  Escrow ID:   ${escrowId}\n`);

    // Step 1: Register with referral service
    console.log('Step 1: Registering with referral service...');
    try {
      const result = await registerEscrowReferral(
        referrerId,
        refereeId,
        escrowId
      );
      console.log('✅ Registered with referral service');
      console.log(`   Response: ${JSON.stringify(result, null, 2)}\n`);
    } catch (error: any) {
      console.log('⚠️  Referral service registration failed (may not be critical)');
      console.log(`   Error: ${error.message}\n`);
    }

    // Step 2: Track locally in database
    console.log('Step 2: Tracking locally in database...');
    const localResult = await trackEscrowReferral(
      referrerId,
      refereeId,
      escrowId
    );

    if (localResult) {
      console.log('✅ Referral tracked in database');
      console.log(`   ID: ${localResult.id}`);
      console.log(`   Created: ${localResult.created_at}\n`);
    } else {
      console.log('⚠️  Local tracking returned null (check table exists)\n');
    }

    // Step 3: Verify in database
    console.log('Step 3: Verifying in database...');
    const dbResult = await query(`
      SELECT * FROM escrow_referrals
      WHERE referrer_id = $1 AND referee_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [referrerId, refereeId]);

    if (dbResult.rows.length > 0) {
      const row = dbResult.rows[0];
      console.log('✅ Found in database:');
      console.log(`   Referrer: ${row.referrer_id}`);
      console.log(`   Referee:  ${row.referee_id}`);
      console.log(`   Escrow:   ${row.escrow_id}`);
      console.log(`   Created:  ${row.created_at}\n`);
      return true;
    } else {
      console.log('❌ Not found in database');
      console.log('   Check escrow_referrals table exists\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testRegisterReferral().then(success => {
  process.exit(success ? 0 : 1);
});
```

### Run Test
```powershell
npx ts-node scripts/test-register-referral.ts
```

### Success Criteria
- ✅ Referral service registration succeeds (or gracefully fails)
- ✅ Local database tracking succeeds
- ✅ Record found in escrow_referrals table

---

## Test 3: Check Referral Tokens

```typescript
import { checkReferralTokens } from '../server/services/referral-integration';

async function testCheckTokens() {
  console.log('🎯 Checking referral tokens...\n');

  // Use a referrer ID from a completed referral
  const referrerId = 'c5f7a8b9-1234-5678-90ab-cdef12345678';

  try {
    console.log(`Checking tokens for referrer: ${referrerId}\n`);

    const tokens = await checkReferralTokens(referrerId);

    if (tokens) {
      console.log('✅ Token data retrieved:');
      console.log(`   Total tokens earned: ${tokens.totalTokens || 0}`);
      console.log(`   Successful referrals: ${tokens.successfulReferrals || 0}`);
      console.log(`   Pending referrals: ${tokens.pendingReferrals || 0}`);
      console.log(`   Token balance: ${tokens.balance || 0}\n`);
      return true;
    } else {
      console.log('⚠️  No token data returned');
      console.log('   User may not have any referrals yet\n');
      return false;
    }

  } catch (error: any) {
    console.error('❌ Error checking tokens:', error.message);
    return false;
  }
}

testCheckTokens().then(success => {
  process.exit(success ? 0 : 1);
});
```

### Run Test
```powershell
npx ts-node scripts/test-check-tokens.ts
```

---

## Test 4: Get Referral Statistics

```typescript
import { getReferralStats, getEscrowReferrals } from '../server/services/referral-integration';

async function testReferralStats() {
  console.log('📊 Getting referral statistics...\n');

  const referrerId = 'c5f7a8b9-1234-5678-90ab-cdef12345678';

  try {
    // Get stats from referral service
    console.log('Fetching referral stats...\n');
    const stats = await getReferralStats(referrerId);

    if (stats) {
      console.log('✅ Referral statistics:');
      console.log(`   Total referrals: ${stats.totalReferrals || 0}`);
      console.log(`   Successful: ${stats.successful || 0}`);
      console.log(`   Pending: ${stats.pending || 0}`);
      console.log(`   Conversion rate: ${stats.conversionRate || 0}%\n`);
    }

    // Get escrow-specific referrals
    console.log('Fetching escrow referrals from local database...\n');
    const escrowReferrals = await getEscrowReferrals(referrerId);

    if (escrowReferrals && escrowReferrals.length > 0) {
      console.log(`✅ Found ${escrowReferrals.length} escrow referrals:\n`);
      
      escrowReferrals.forEach((ref: any, index: number) => {
        console.log(`${index + 1}. ${ref.referee_username}`);
        console.log(`   Email: ${ref.referee_email}`);
        console.log(`   Escrow: ${ref.amount} ${ref.currency}`);
        console.log(`   Status: ${ref.escrow_status}`);
        console.log(`   Created: ${new Date(ref.created_at).toLocaleDateString()}\n`);
      });

      return true;
    } else {
      console.log('⚠️  No escrow referrals found yet\n');
      return false;
    }

  } catch (error: any) {
    console.error('❌ Error getting stats:', error.message);
    return false;
  }
}

testReferralStats().then(success => {
  process.exit(success ? 0 : 1);
});
```

### Run Test
```powershell
npx ts-node scripts/test-referral-stats.ts
```

---

## Test 5: Complete Escrow Referral Flow

```typescript
import { registerEscrowReferral, trackEscrowReferral, getConversionMetrics } from '../server/services/referral-integration';
import { query } from '../server/db';
import { v4 as uuidv4 } from 'uuid';

async function testCompleteReferralFlow() {
  console.log('🔄 Testing complete referral flow...\n');

  const referrerId = 'c5f7a8b9-1234-5678-90ab-cdef12345678';
  const refereeId = 'a1b2c3d4-5678-90ab-cdef-123456789012';
  const escrowId = uuidv4();

  try {
    // Step 1: Create mock escrow
    console.log('Step 1: Creating mock escrow...');
    await query(`
      INSERT INTO escrow_accounts (id, payer_id, payee_id, amount, currency, status, created_at)
      VALUES ($1, $2, $3, '1000', 'cUSD', 'accepted', NOW())
    `, [escrowId, referrerId, refereeId]);
    console.log('✅ Mock escrow created\n');

    // Step 2: Register referral
    console.log('Step 2: Registering referral...');
    await registerEscrowReferral(referrerId, refereeId, escrowId);
    await trackEscrowReferral(referrerId, refereeId, escrowId);
    console.log('✅ Referral registered and tracked\n');

    // Step 3: Update escrow status to complete
    console.log('Step 3: Completing escrow...');
    await query(`
      UPDATE escrow_accounts
      SET status = 'completed'
      WHERE id = $1
    `, [escrowId]);
    console.log('✅ Escrow marked as completed\n');

    // Step 4: Calculate conversion metrics
    console.log('Step 4: Calculating conversion metrics...');
    const metrics = await getConversionMetrics(referrerId);

    if (metrics) {
      console.log('✅ Conversion metrics:');
      console.log(`   Total referrals: ${metrics.total_referrals || 0}`);
      console.log(`   Accepted: ${metrics.accepted || 0}`);
      console.log(`   Funded: ${metrics.funded || 0}`);
      console.log(`   Completed: ${metrics.completed || 0}`);
      console.log(`   Disputed: ${metrics.disputed || 0}`);
      console.log(`   Average amount: $${parseFloat(metrics.average_escrow_amount || 0).toFixed(2)}\n`);
    }

    console.log('✅ Complete referral flow test passed');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testCompleteReferralFlow().then(success => {
  process.exit(success ? 0 : 1);
});
```

### Run Test
```powershell
npx ts-node scripts/test-complete-referral-flow.ts
```

---

## Test 6: Escrow Accept with Referrer

This is the key real-world test - accepting an escrow with referrer parameter.

```typescript
// In your integration test or manual test:
// When user accepts escrow invite with referrer parameter:

// Frontend:
const referrerId = new URLSearchParams(window.location.search).get('referrer');
const response = await fetch(`/api/escrow/accept/${inviteCode}?referrer=${referrerId}`, {
  method: 'POST'
});

// Backend (happens automatically):
// 1. Escrow status updated to "accepted"
// 2. registerEscrowReferral() called with referrer parameter
// 3. Referral registered in external service
// 4. Referral tracked in local database
// 5. Notifications sent to both parties
// 6. Response returned with updated escrow
```

### Verification Steps
```typescript
async function verifyAcceptWithReferrer() {
  console.log('🔗 Verifying escrow accept with referrer...\n');

  const inviteCode = 'test123456';
  const referrerId = 'c5f7a8b9-1234-5678-90ab-cdef12345678';
  const acceptorId = 'a1b2c3d4-5678-90ab-cdef-123456789012';

  // Make the API call
  const response = await fetch(`http://localhost:3000/api/escrow/accept/${inviteCode}?referrer=${referrerId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${acceptorToken}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (response.ok && data.success) {
    console.log('✅ Escrow accepted successfully\n');

    // Verify escrow updated
    console.log('Checking escrow status...');
    const escrow = await query(`
      SELECT status FROM escrow_accounts WHERE id = $1
    `, [data.escrow.id]);
    console.log(`   Status: ${escrow.rows[0].status}\n`);

    // Verify referral tracked
    console.log('Checking referral tracking...');
    const referral = await query(`
      SELECT * FROM escrow_referrals 
      WHERE referrer_id = $1 AND referee_id = $2
    `, [referrerId, acceptorId]);
    console.log(`   Referrals found: ${referral.rows.length}\n`);

    // Verify notifications sent
    console.log('Checking notifications...');
    const notifications = await query(`
      SELECT COUNT(*) as count FROM notifications_log 
      WHERE escrow_id = $1 AND type = 'escrow_accepted'
    `, [data.escrow.id]);
    console.log(`   Notifications: ${notifications.rows[0].count}\n`);

    return true;
  } else {
    console.log('❌ Escrow acceptance failed');
    console.log(`   Error: ${data.error}\n`);
    return false;
  }
}
```

---

## Test 7: Conversion Metrics Analysis

```typescript
import { query } from '../server/db';

async function analyzeConversionMetrics() {
  console.log('📈 Analyzing referral conversion metrics...\n');

  try {
    const metrics = await query(`
      SELECT 
        referrer_id,
        COUNT(*) as total,
        COUNT(CASE WHEN escrow_status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN escrow_status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN escrow_status = 'disputed' THEN 1 END) as disputed,
        ROUND(100.0 * COUNT(CASE WHEN escrow_status = 'completed' THEN 1 END) / COUNT(*), 1) as completion_rate
      FROM (
        SELECT 
          er.referrer_id,
          ea.status as escrow_status
        FROM escrow_referrals er
        JOIN escrow_accounts ea ON ea.id = er.escrow_id
      ) subquery
      GROUP BY referrer_id
      ORDER BY total DESC
    `);

    if (metrics.rows.length > 0) {
      console.log('✅ Referral conversion analysis:\n');
      
      metrics.rows.forEach((row: any) => {
        console.log(`Referrer: ${row.referrer_id}`);
        console.log(`  Total referrals: ${row.total}`);
        console.log(`  Accepted: ${row.accepted} (${((row.accepted/row.total)*100).toFixed(1)}%)`);
        console.log(`  Completed: ${row.completed} (${row.completion_rate}%)`);
        console.log(`  Disputed: ${row.disputed}`);
        console.log('');
      });

      return true;
    } else {
      console.log('⚠️  No referral data yet\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    return false;
  }
}

analyzeConversionMetrics();
```

---

## Task 4 Checklist

- [ ] Referral service is reachable and responsive
- [ ] Can register referral with external service
- [ ] Referral tracked in local database
- [ ] Can retrieve referral tokens
- [ ] Can get referral statistics
- [ ] Conversion metrics calculated correctly
- [ ] Complete referral flow works end-to-end
- [ ] Escrow accept with referrer parameter works
- [ ] Referrals appear in conversion analysis

---

## Troubleshooting

### Referral Service Not Reachable
**Solutions**:
1. Verify referral service is running
2. Check REFERRAL_SERVICE_URL is correct
3. Test: `curl -H "Authorization: Bearer $KEY" $URL/api/health`
4. Check firewall allows connection
5. Verify API key is valid

### Referral Registration Fails
**Solutions**:
1. Check referral service logs
2. Verify API key has correct permissions
3. Ensure referrer and referee IDs are valid UUIDs
4. Test with mock data directly
5. Check referral service API documentation

### Database Table Not Found
**Solutions**:
1. Verify escrow_referrals table exists
2. Run migration: `migrateNotificationTables()`
3. Check database connection
4. Verify permissions to create tables

### Conversion Metrics Always Zero
**Solutions**:
1. Verify test data exists in database
2. Check escrow_accounts table has status values
3. Ensure referrals linked to escrows
4. Test query directly in database

---

## Success Criteria

Task 4 is complete when:
- ✅ Can connect to referral service
- ✅ Register referrals successfully
- ✅ Track referrals in database
- ✅ Retrieve referral data
- ✅ Calculate conversion metrics
- ✅ Complete end-to-end flow works

**Next**: Task 5 - Integrate history & analytics into UI

**Time Estimate**: 45-60 minutes
**Difficulty**: Moderate to High
