# 🚀 RED TEAM AUDIT - IMPLEMENTATION ROADMAP

**Project:** MTAA-DAO Referral/Payout System Hardening  
**Timeline:** 3-5 weeks  
**Difficulty:** Medium-High  
**Estimated Effort:** 80-120 engineering hours

---

## 📋 Phase Overview

```
Week 1: EMERGENCY HARDENING (Nonce + RPC)
├─ Deploy Finding #1: Atomic nonce allocation
├─ Deploy Finding #2: Multi-fallback RPC + orphan detection
├─ Deploy Finding #3: Finality monitoring
└─ Result: Reduce data loss from 9/10 → 5/10

Week 2: ANTI-ABUSE DEPLOYMENT (Sybil Defense)
├─ Deploy Finding #5: Phone verification gate
├─ Deploy Finding #5: Account age gate
├─ Deploy Finding #5: IP diversity checks
├─ Deploy Finding #5: Anomaly detection
└─ Result: Eliminate 80% of sybil attacks

Week 3-4: SCALABILITY REFACTOR (Event-Driven)
├─ Deploy Finding #4: Event-driven payout worker
├─ Deploy Finding #4: Batch reward optimization
├─ Deploy Finding #4: Multi-address transactions
└─ Result: Support 10K→50K+ payouts/week

Week 5: MONITORING & TESTING
├─ Deploy dashboard for payout health
├─ Run load tests (simulate 10K weekly payouts)
├─ Incident response runbook
└─ Result: Production-ready (risk 3/10)
```

---

---

## 🔴 PHASE 1: EMERGENCY HARDENING (Week 1)

### Task 1.1: Implement Atomic Nonce Allocation

**File:** `server/workers/nonce-allocation.ts` (created ✅)

**Checklist:**

- [ ] **Create migration** for `nonce_allocations` table
  - [ ] Run: `npm run migrate -- 020_red_team_audit_fixes`
  - [ ] Verify table created: `SELECT * FROM nonce_allocations LIMIT 1;`

- [ ] **Update payout-worker.ts** to use new nonce allocator
  ```typescript
  // OLD (lines 113-133): Delete the old nonce logic
  // NEW: Import and use allocateNonceBatch
  import { allocateNonceBatch, verifyNonceUsage } from './nonce-allocation';
  
  const { startNonce, endNonce, allocationId, isSuccessful } = 
    await allocateNonceBatch(sender, rows.length, dryRun);
  
  if (!isSuccessful) {
    logger.error('Failed to allocate nonce batch', { error: allocationId });
    return; // Abort batch
  }
  
  let currentNonce = startNonce;
  for (const p of rows) {
    // ... tx logic ...
    const overrides = { nonce: currentNonce, ... };
    const tx = await contract.distributeReward(..., overrides);
    
    // VERIFY nonce usage immediately
    const { verified, anomaly } = await verifyNonceUsage(
      p.id, tx.hash, currentNonce, allocationId
    );
    
    if (anomaly) {
      await sendAdminAlert(`NONCE ANOMALY DETECTED: ${p.id}`);
    }
    
    currentNonce++;
  }
  ```

- [ ] **Add test cases**
  ```typescript
  // tests/payout-worker.test.ts
  describe('Nonce Allocation', () => {
    test('should allocate contiguous nonce range', async () => {
      const result = await allocateNonceBatch(senderAddr, 5);
      expect(result.endNonce - result.startNonce).toBe(5);
      expect(result.isSuccessful).toBe(true);
    });
    
    test('should prevent double-allocation', async () => {
      const first = await allocateNonceBatch(senderAddr, 5);
      const second = await allocateNonceBatch(senderAddr, 3);
      expect(second.startNonce).toBe(first.endNonce);
    });
  });
  ```

**Time Estimate:** 3-4 hours  
**Risk Level:** Medium (data structure change, requires careful testing)  
**Verification:** Deploy to staging, run 100 payout test batch, check `nonce_allocations` table

---

### Task 1.2: Multi-Fallback RPC + Orphan Detection

**Files:**
- `server/workers/payout-worker.ts` (update confirmation logic)
- Create new: `server/services/rpc-fallback.ts`

**Checklist:**

- [ ] **Create RPC fallback service**
  ```typescript
  // server/services/rpc-fallback.ts
  export const createFallbackProvider = (endpoints: string[]) => {
    return new ethers.FallbackProvider(
      endpoints.map(url => ({
        provider: new ethers.JsonRpcProvider(url),
        weight: 1,
        stallTimeout: 3000,
        priority: 1
      }))
    );
  };
  ```

- [ ] **Update confirmation logic** in payout-worker.ts
  ```typescript
  // Replace old waitForTransaction logic
  const confirmTransactionWithCrossCheck = async (txHash: string) => {
    const warnings: string[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < 120_000) { // 2 minute timeout
      try {
        const receipt = await primaryProvider.getTransactionReceipt(txHash);
        if (receipt?.status === 1) {
          const currentBlock = await primaryProvider.getBlockNumber();
          const confirmations = currentBlock - receipt.blockNumber;
          
          if (confirmations >= CONFIRMATIONS) {
            // Cross-check with fallback
            const fallbackReceipt = await fallbackProvider.getTransactionReceipt(txHash);
            if (!fallbackReceipt) {
              warnings.push('Receipt on primary but not fallback - reorg risk');
            }
            return { receipt, confirmed: true, warnings };
          }
        }
      } catch (err) {
        warnings.push(`Provider error: ${err}`);
      }
      
      await sleep(Math.min(2000 * Math.random(), 10000));
    }
    
    return { receipt: null, confirmed: false, warnings };
  };
  ```

- [ ] **Deploy orphan detection** job
  ```typescript
  // Call every 5 minutes
  setInterval(detectAndRecoverOrphanedPayouts, 5 * 60 * 1000);
  ```

- [ ] **Test RPC failover**
  - [ ] Simulate RPC node crash (kill container)
  - [ ] Verify fallback activates
  - [ ] Verify payouts still complete

**Time Estimate:** 4-5 hours  
**Risk Level:** High (affects transaction confirmation, must be rock solid)  
**Verification:** Deploy to staging, kill primary RPC, monitor payout completion

---

### Task 1.3: Finality Monitoring (Reorg Protection)

**Files:** `server/workers/payout-worker.ts` (add monitoring job)

**Checklist:**

- [ ] **Implement finality check**
  ```typescript
  const waitForFinality = async (txHash: string) => {
    const receipt = await provider.getTransactionReceipt(txHash);
    const blockHeight = receipt.blockNumber;
    const currentHeight = await provider.getBlockNumber();
    const requiredDepth = 16; // Celo finality
    
    return currentHeight - blockHeight >= requiredDepth;
  };
  ```

- [ ] **Add reorg monitoring** (every 30 seconds)
  ```typescript
  setInterval(monitorForReorgs, 30 * 1000);
  ```

- [ ] **Update CONFIRMATIONS env var**
  ```bash
  PAYOUT_CONFIRMATIONS=10  # Increase from default 2
  ```

- [ ] **Alert on reorg**
  ```typescript
  if (!receipt) {
    await sendAdminAlert(`🚨 REORG DETECTED: ${payoutId} reorg'd out`);
    // Mark for re-submission
  }
  ```

**Time Estimate:** 2-3 hours  
**Risk Level:** Low (read-only monitoring)  
**Verification:** Manual testing with local Celo testnet

---

### Task 1.4: Emergency Limits Deployment

**File:** `server/workers/payout-worker.ts` (environment variables)

**Checklist:**

- [ ] **Update .env for safety** (temporary until week 3)
  ```bash
  PAYOUT_BATCH_SIZE=3              # Down from 5
  PAYOUT_POLL_INTERVAL_MS=120000   # Up from 30s (2 min)
  PAYOUT_MAX_RETRIES=3             # Down from 5
  PAYOUT_CONFIRMATIONS=10          # Up from 2
  ```

- [ ] **Deploy to production** with these limits
- [ ] **Monitor processing time** - should see ~2-3 day backlog reduction

**Time Estimate:** 30 minutes  
**Verification:** Monitor payout queue depth

---

### Phase 1 Summary

| Task | Status | Hours | Risk |
|------|--------|-------|------|
| 1.1: Nonce Allocation | ⬜ TODO | 3-4 | 🟠 MED |
| 1.2: RPC Fallback | ⬜ TODO | 4-5 | 🔴 HIGH |
| 1.3: Finality Monitor | ⬜ TODO | 2-3 | 🟢 LOW |
| 1.4: Emergency Limits | ⬜ TODO | 0.5 | 🟢 LOW |
| **TOTAL** | | **10-13 hrs** | **HIGH** |

**Expected Outcome:** Reduce financial loss from 9/10 → 5/10 ✅

---

---

## 🟠 PHASE 2: ANTI-ABUSE DEPLOYMENT (Week 2)

### Task 2.1: Phone Verification Gate

**File:** `server/services/sybil-defense.ts` (created ✅)

**Checklist:**

- [ ] **Add phone verification requirement**
  ```typescript
  const phoneVerified = await enforcePhoneVerificationGate(userId);
  if (!phoneVerified.passed) {
    return { eligible: false, reason: 'Phone verification required' };
  }
  ```

- [ ] **Integrate with sign-up flow**
  - [ ] Add phone input to registration UI
  - [ ] Implement SMS OTP verification
  - [ ] Store `phoneVerified` + `phoneVerifiedAt` in users table

- [ ] **Test with real phone numbers**
  - [ ] Use test phone service (Twilio, AWS SNS)
  - [ ] Verify 100 signups with different numbers

**Time Estimate:** 4-5 hours  
**Risk Level:** Medium (affects user onboarding UX)  
**Verification:** Create 10 test accounts, verify phone requirement enforced

---

### Task 2.2: Account Age Gate

**File:** `server/services/sybil-defense.ts` (already implemented)

**Checklist:**

- [ ] **Deploy 3-day minimum age gate**
  ```typescript
  const ageResult = await enforceAccountAgeGate(userId, 72); // 3 days
  if (!ageResult.passed) {
    return { eligible: false, reason: `Account too new: ${ageResult.ageHours}h old` };
  }
  ```

- [ ] **Add to referral eligibility check**
  - [ ] Call in `validateReferralEligibility()` function
  - [ ] Return error if < 3 days

- [ ] **Monitor adoption**
  - [ ] Track "rejected due to age" metrics
  - [ ] Expected: 5-10% of new referrals rejected

**Time Estimate:** 1-2 hours  
**Risk Level:** Low (straightforward timestamp check)  
**Verification:** Try to refer with brand new account, verify rejection

---

### Task 2.3: IP Diversity + Datacenter Detection

**File:** `server/services/sybil-defense.ts` (partially implemented)

**Checklist:**

- [ ] **Implement IP reputation check**
  ```typescript
  const ipRep = await checkIPReputation(ipAddress);
  if (ipRep.isSuspicious) {
    return { eligible: false, reason: `Suspicious IP: ${ipRep.reason}` };
  }
  ```

- [ ] **Integrate IP reputation service** (choose one)
  - [ ] Option A: AbuseIPDB (free tier: 1K/day)
  - [ ] Option B: MaxMind GeoIP (enterprise)
  - [ ] Option C: Local blocklist (update via OSINT)

- [ ] **Track signup IP** for each referral
  ```typescript
  // Store in referral_signup_context table
  await db.insert(referralSignupContext).values({
    referral_id,
    signup_ip_address,
    signup_country,
    signup_device_fingerprint
  });
  ```

- [ ] **Limit referrals per IP**
  - [ ] Max 5 referrals per IP address
  - [ ] Alert if exceeded

**Time Estimate:** 3-4 hours  
**Risk Level:** Medium (external API dependency)  
**Verification:** Test with datacenter IPs, verify rejection

---

### Task 2.4: Anomaly Detection for Referrers

**File:** `server/services/sybil-defense.ts` (created ✅)

**Checklist:**

- [ ] **Deploy `detectReferrerAnomalies()` function**
  ```typescript
  const assessment = await detectReferrerAnomalies(referrerId);
  if (assessment.riskLevel === 'critical') {
    // Suspend payouts
  }
  ```

- [ ] **Add anomaly detection flags**
  - [ ] HIGH_VOLUME_RECENT (>50 refs/24h)
  - [ ] SINGLE_EMAIL_DOMAIN (all same provider)
  - [ ] LIMITED_GEOGRAPHIC_DIVERSITY (≤2 area codes)
  - [ ] SINGLE_IP_ADDRESS (all from same IP)
  - [ ] BURST_CREATION_PATTERN (all within 1 hour)

- [ ] **Create monitoring dashboard**
  - [ ] Chart: Risk score distribution
  - [ ] Table: Flagged referrers (top 20)
  - [ ] Alert: Referrers going from low→high risk

- [ ] **Implement suspension logic**
  ```typescript
  if (recommendedAction === 'suspend') {
    // Mark all pending rewards as 'pending_review'
    // Send admin alert
    // Require manual approval to resume
  }
  ```

**Time Estimate:** 3-4 hours  
**Risk Level:** Medium (impacts legitimate high-volume referrers)  
**Verification:** Monitor false positive rate (<5% target)

---

### Phase 2 Summary

| Task | Status | Hours | Impact |
|------|--------|-------|--------|
| 2.1: Phone Gate | ⬜ TODO | 4-5 | 🟠 MED |
| 2.2: Account Age | ⬜ TODO | 1-2 | 🟢 LOW |
| 2.3: IP Diversity | ⬜ TODO | 3-4 | 🟠 MED |
| 2.4: Anomaly Detection | ⬜ TODO | 3-4 | 🟠 MED |
| **TOTAL** | | **11-15 hrs** | **HIGH** |

**Expected Outcome:** Reduce sybil attacks from 8/10 → 3/10 ✅

---

---

## ⚡ PHASE 3: SCALABILITY REFACTOR (Week 3-4)

### Task 3.1: Event-Driven Payout Worker

**Files:**
- `server/workers/payout-worker.ts` (major refactor)
- Create new: `server/services/payout-queue.ts`

**Checklist:**

- [ ] **Replace polling with event-driven**
  ```typescript
  // OLD: Polling every 30s
  setInterval(() => processPendingPayouts(), 30_000);
  
  // NEW: Listen for reward distribution events
  import { PgClient } from 'pg';
  const pgListener = new PgClient(process.env.DATABASE_URL);
  
  pgListener.on('notification', async (msg) => {
    if (msg.channel === 'reward_distributed') {
      const data = JSON.parse(msg.payload);
      await queuePayoutProcessing(data);
    }
  });
  
  await pgListener.connect();
  await pgListener.query('LISTEN reward_distributed');
  ```

- [ ] **Create PG trigger** for notifications
  ```sql
  CREATE OR REPLACE FUNCTION notify_reward_created()
  RETURNS TRIGGER AS $$
  BEGIN
    PERFORM pg_notify('reward_distributed', json_build_object(
      'referral_reward_id', NEW.id,
      'referrer_id', NEW."userId",
      'total_amount', NEW."totalReward"
    )::text);
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

- [ ] **Implement queue with concurrency control**
  ```typescript
  // Max 10 concurrent payout batches
  const payoutQueue = new PQueue({ concurrency: 10 });
  
  pgListener.on('notification', async (msg) => {
    await payoutQueue.add(() => processRewardBatch(rewardIds));
  });
  ```

- [ ] **Test event delivery**
  - [ ] Insert reward, verify trigger fires
  - [ ] Verify listener receives notification
  - [ ] Verify payout processes

**Time Estimate:** 6-8 hours  
**Risk Level:** High (core worker logic change)  
**Verification:** Deploy to staging, monitor event delivery

---

### Task 3.2: Batch Reward Optimization

**File:** `server/services/payout-queue.ts`

**Checklist:**

- [ ] **Implement micro-batching**
  ```typescript
  const processMicroBatch = async (
    destAddress: string,
    payouts: any[],
    maxBatchSize: number = 20
  ) => {
    const chunks = [];
    for (let i = 0; i < payouts.length; i += maxBatchSize) {
      chunks.push(payouts.slice(i, i + maxBatchSize));
    }
    
    for (const chunk of chunks) {
      await contract.batchDistributeRewards(
        chunk.map(p => p.request_id),
        chunk.map(_ => destAddress),
        chunk.map(p => ethers.parseUnits(String(p.amount), 18))
      );
    }
  };
  ```

- [ ] **Update contract** (if batchDistributeRewards not already supported)
  ```solidity
  function batchDistributeRewards(
    bytes32[] calldata requestIds,
    address[] calldata recipients,
    uint256[] calldata amounts
  ) external onlyOperator {
    require(requestIds.length == recipients.length && 
            recipients.length == amounts.length);
    
    for (uint i = 0; i < requestIds.length; i++) {
      _distributeReward(requestIds[i], recipients[i], amounts[i]);
    }
  }
  ```

- [ ] **Test batch execution**
  - [ ] Send batch of 20 payouts
  - [ ] Verify all execute in single tx
  - [ ] Check gas optimization

**Time Estimate:** 4-5 hours  
**Risk Level:** Medium (contract change)  
**Verification:** Compare gas before/after

---

### Task 3.3: Load Testing & Validation

**Files:** `tests/payout-worker-load.test.ts` (new)

**Checklist:**

- [ ] **Create load test**
  ```typescript
  test('should handle 10K payouts/week', async () => {
    // Create 10K referral rewards
    const rewards = Array(10000).fill(null).map(() => 
      createTestReward()
    );
    
    const startTime = Date.now();
    
    // Trigger payout processing
    for (const reward of rewards) {
      await emitRewardDistribution(reward);
    }
    
    // Wait for completion
    await waitForAllPayoutsCompleted(30 * 60_000); // 30 min max
    
    const duration = Date.now() - startTime;
    
    // Verify
    expect(duration).toBeLessThan(30 * 60_000);
    expect(failureRate).toBeLessThan(0.01); // <1% failure
  });
  ```

- [ ] **Run stress test** on staging
  - [ ] Target: 10K payouts in <30 minutes
  - [ ] Verify zero data loss
  - [ ] Monitor database CPU/memory

- [ ] **Optimize if needed**
  - [ ] Increase batch size if CPU low
  - [ ] Add connection pooling if DB limit hit
  - [ ] Profile hot spots

**Time Estimate:** 3-4 hours  
**Risk Level:** Low (staging environment only)  
**Verification:** All 10K payouts complete successfully

---

### Phase 3 Summary

| Task | Status | Hours | Complexity |
|------|--------|-------|-----------|
| 3.1: Event-Driven | ⬜ TODO | 6-8 | 🔴 HIGH |
| 3.2: Batch Optimization | ⬜ TODO | 4-5 | 🟠 MED |
| 3.3: Load Testing | ⬜ TODO | 3-4 | 🟠 MED |
| **TOTAL** | | **13-17 hrs** | **HIGH** |

**Expected Outcome:** Support 10K→50K+ payouts/week ✅

---

---

## 📊 PHASE 4: MONITORING & HARDENING (Week 5)

### Task 4.1: Production Monitoring Dashboard

**Files:**
- `server/monitoring/payout-dashboard.ts` (new)
- Frontend: Create React component

**Checklist:**

- [ ] **Create dashboard metrics**
  ```typescript
  const getPayoutMetrics = async () => ({
    total_pending_payouts: await db.count(pending),
    total_processing_payouts: await db.count(processing),
    avg_process_time_minutes: await db.avg(duration),
    success_rate: (completed / (completed + failed)) * 100,
    orphaned_payouts: await db.count(orphaned),
    nonce_allocation_health: await db.query(v_nonce_allocation_audit),
    referrer_risk_distribution: await db.query(v_referrer_risk_summary)
  });
  ```

- [ ] **Set up alerting**
  - [ ] Alert if pending queue > 500
  - [ ] Alert if failure rate > 2%
  - [ ] Alert if orphan detected
  - [ ] Alert if referrer risk > 60

- [ ] **Create incident runbook**
  - [ ] "What to do if nonce sequence corrupts"
  - [ ] "What to do if RPC node fails"
  - [ ] "What to do if sybil attack detected"

**Time Estimate:** 3-4 hours  
**Risk Level:** Low (monitoring only)

---

### Task 4.2: Incident Response Runbook

**File:** `docs/PAYOUT_INCIDENT_RESPONSE.md` (new)

**Checklist:**

- [ ] **Document incident scenarios**
  1. Nonce sequence corruption
  2. RPC cascade failure
  3. Massive sybil attack
  4. Backlog explosion
  5. Reorg detected

- [ ] **For each scenario, document**
  - Detection signal
  - Immediate action
  - Root cause analysis
  - Recovery steps
  - Prevention for future

**Time Estimate:** 2-3 hours

---

### Task 4.3: Quarterly Audit Schedule

**Checklist:**

- [ ] **Set calendar for quarterly reviews**
  - [ ] 2026-09-18: First post-remediation audit
  - [ ] 2026-12-18: End of year
  - [ ] Repeat annually

- [ ] **Define audit scope**
  - [ ] Nonce sequence integrity
  - [ ] Sybil pattern trends
  - [ ] Scalability headroom
  - [ ] RPC reliability

---

### Phase 4 Summary

| Task | Status | Hours | Impact |
|------|--------|-------|--------|
| 4.1: Monitoring Dashboard | ⬜ TODO | 3-4 | 🟢 LOW |
| 4.2: Incident Runbook | ⬜ TODO | 2-3 | 🟢 LOW |
| 4.3: Audit Schedule | ⬜ TODO | 1 | 🟢 LOW |
| **TOTAL** | | **6-8 hrs** | **LOW** |

**Expected Outcome:** Production-ready system (risk 3/10) ✅

---

---

## 📈 Success Metrics

### By End of Phase 1 (Week 1)
- ✅ Zero nonce collisions detected
- ✅ Orphan detection working
- ✅ 50% reduction in "silent losses"
- ✅ Payout queue reducing

### By End of Phase 2 (Week 2)
- ✅ 80% of sybil attacks blocked
- ✅ Phone verification >90% adoption
- ✅ False positive rate <5%
- ✅ Legitimate referral conversion unaffected

### By End of Phase 3 (Week 4)
- ✅ 10K+ payouts/week sustained
- ✅ <1% failure rate
- ✅ <2 minute payout latency
- ✅ Zero data loss

### By End of Phase 4 (Week 5)
- ✅ 24/7 monitoring active
- ✅ Incident response tested
- ✅ Documentation complete
- ✅ Risk score: 3/10 (from 9/10)

---

---

## 🛠️ Deployment Checklist

Before deploying each phase to production:

- [ ] **Code review** (2+ reviewers, focus on security)
- [ ] **Staging test** (full payout batch, 24 hours)
- [ ] **Backup database** (before production deploy)
- [ ] **Rollback plan** (documented, tested)
- [ ] **Notification** (alert team, prepare support)
- [ ] **Monitor for 24h post-deploy** (watch for anomalies)

---

---

## 📞 Support & Escalation

**During Implementation:**
- Blockers: Contact lead engineer (@dev)
- Questions: Check `PAYOUT_SAGA_RED_TEAM_AUDIT.md`
- Issues: Post in #engineering Slack

**Post-Deploy (Production):**
- Critical: Page on-call engineer
- High: Post in #critical-alerts
- Medium: Create GitHub issue with `payout-incident` label

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-18  
**Next Review:** Post-Phase 1 (Week 2)
