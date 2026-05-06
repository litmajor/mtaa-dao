# PHASE 3 DEPLOYMENT GUIDE
## Testnet → Production Deployment Runbook

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### Code Review
- [ ] All 3 smart contracts reviewed
- [ ] Logic flows tested (propose→approve→execute)
- [ ] Edge cases covered (timelock, limits, whitelist)
- [ ] No hardcoded addresses
- [ ] Gas optimized

### Testing
- [ ] Unit tests: 40/40 passing ✓
- [ ] Integration tests: All flows working
- [ ] E2E tests: Mainnet simulation passing
- [ ] Performance tests: Gas <200k, API <500ms
- [ ] Security tests: All vulnerability checks passing

### Documentation
- [ ] README.md updated
- [ ] API endpoints documented
- [ ] Database schema documented
- [ ] Deployment steps documented (this file)
- [ ] Troubleshooting guide created

### Infrastructure
- [ ] Environment variables configured
- [ ] Database migrations tested locally
- [ ] Backup strategy in place
- [ ] Monitoring dashboards created
- [ ] Alerting rules configured

---

## 🚀 DEPLOYMENT PHASES

### PHASE 1A: SEPOLIA TESTNET (Initial Deployment)

**Duration:** 30 minutes  
**Purpose:** Verify contracts work in live testnet environment

#### Step 1: Prepare Environment
```bash
# 1. Copy .env template
cp .env.example .env.sepolia

# 2. Add testnet configuration
cat >> .env.sepolia << 'EOF'
NETWORK=sepolia
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY_1=0x...  # Signer 1 private key
PRIVATE_KEY_2=0x...  # Signer 2 private key  
PRIVATE_KEY_3=0x...  # Signer 3 private key
ETHERSCAN_API_KEY=YOUR_KEY

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mtaa_dao_test

# Contract addresses to deploy
MULTISIG_SIGNERS=0x123...,0x456...,0x789...
INITIAL_WHITELIST=0xAAA...,0xBBB...
EOF

# 3. Load environment
source .env.sepolia

# 4. Get some ETH for deployment (from faucet)
# https://sepoliafaucet.com
```

#### Step 2: Compile Contracts
```bash
# Compile all contracts
npx hardhat compile

# Check for errors
echo "✓ Compilation successful"

# Check contract sizes (must be <24KB for mainnet)
npx hardhat size-contracts
# Expected output:
# MultiSigTreasury: ~15KB ✓
# AuditLog: ~12KB ✓
# GovernanceSnapshot: ~14KB ✓
```

#### Step 3: Run Local Tests
```bash
# Run test suite
npm run test:contracts

# Expected output:
# 40 passing tests
# Gas usage estimates calculated
# All conditions covered
```

#### Step 4: Deploy to Sepolia
```bash
# Deploy script: scripts/deploy-multisig-treasury.ts
npx hardhat run scripts/deploy-multisig-treasury.ts --network sepolia

# Expected output:
# Deploying MultiSigTreasury...
# ✓ MultiSigTreasury deployed to: 0x3f4aBF5948D0CF0C5BcEc6aE05b6d82cb4C3a4F2
#
# Deploying AuditLog...
# ✓ AuditLog deployed to: 0x8D6E4B0C3A521F6E9C1A5F3D7B2E6A8F4C1D9E5B
#
# Deploying GovernanceSnapshot...
# ✓ GovernanceSnapshot deployed to: 0x9E7F1A4C5B8D2E6F3A1B9C4E7D2F5A8B1C4E7F2A
#
# Total deployment cost: 0.35 ETH
# Estimated mainnet cost: 2.5 ETH

# Save addresses
cat > .env.sepolia.addresses.txt << 'EOF'
MULTISIG_TREASURY=0x3f4aBF5948D0CF0C5BcEc6aE05b6d82cb4C3a4F2
AUDIT_LOG=0x8D6E4B0C3A521F6E9C1A5F3D7B2E6A8F4C1D9E5B
GOVERNANCE_SNAPSHOT=0x9E7F1A4C5B8D2E6F3A1B9C4E7D2F5A8B1C4E7F2A
EOF
```

#### Step 5: Verify on Etherscan
```bash
# Verify each contract
npx hardhat verify --network sepolia \
  0x3f4aBF5948D0CF0C5BcEc6aE05b6d82cb4C3a4F2 \
  --constructor-args scripts/args-multisig.js

# ✓ Contract verified on Etherscan
# https://sepolia.etherscan.io/address/0x3f4aBF5948D0CF0C5BcEc6aE05b6d82cb4C3a4F2

# Repeat for other 2 contracts
```

#### Step 6: Initialize Signers
```bash
# Run initialization script: scripts/initialize-multisig.ts
npx hardhat run scripts/initialize-multisig.ts --network sepolia

# Expected output:
# Adding signers to MultiSigTreasury...
# ✓ Signer 1 (0x123...) added: tx hash 0xabc...
# ✓ Signer 2 (0x456...) added: tx hash 0xdef...
# ✓ Signer 3 (0x789...) added: tx hash 0x123...
#
# Setting amount limits...
# ✓ Max transfer (5%): 1000000 USDC
# ✓ Daily limit (5%): 1000000 USDC
#
# Initialization complete
```

#### Step 7: Add Initial Whitelist
```bash
# Run whitelist script: scripts/whitelist-recipients.ts
npx hardhat run scripts/whitelist-recipients.ts --network sepolia

# Expected output:
# Adding recipients to whitelist...
# ✓ DAO Treasury (0xAAA...): Added
# ✓ Team Wallet (0xBBB...): Added
# ✓ Reserve Fund (0xCCC...): Added
#
# Total whitelisted: 3 recipients
```

#### Step 8: Run Integration Tests
```bash
# Test against live Sepolia contracts
npm run test:integration:sepolia

# Expected output:
# Testing against Sepolia contracts
# ✓ Can propose transaction
# ✓ Timelock enforced (48 hours)
# ✓ Can approve with signers
# ✓ Can execute after 2 approvals
# ✓ Audit log records actions
#
# 5/5 integrations tests passing ✓
```

#### Step 9: Verify Everything Works
```bash
# Do a test transaction
npx hardhat run scripts/test-transaction.ts --network sepolia

# Expected output:
# Creating test proposal...
# ✓ Proposal created: tx 0xabc...
#
# Waiting for timelock (simulated)...
# ✓ Timelock passed
#
# Approving with signer 1...
# ✓ Approval 1/2: tx 0xdef...
#
# Approving with signer 2...
# ✓ Approval 2/2: tx 0x123...
# ✓ Transaction approved and ready to execute
#
# Executing transaction...
# ✓ Executed: tx 0x456...
# ✓ Recipient received funds
#
# Checking audit log...
# ✓ 5 entries recorded: Proposed, Approved, Approved, Executed, [details]
#
# ✅ FULL FLOW WORKING ON TESTNET
```

**Sepolia Status:** ✅ COMPLETE  
**Ready for mainnet?** YES  
**Estimated mainnet cost:** 2.5 ETH

---

### PHASE 1B: STAGING ENVIRONMENT (Backend Integration)

**Duration:** 1 hour  
**Purpose:** Test backend API with real contracts

#### Step 1: Deploy Backend Routes
```bash
# Copy route template
cp server/routes/treasury.ts server/routes/treasury-multisig.ts

# Update with contract addresses from Sepolia
# Edit server/routes/treasury-multisig.ts:
# - Replace contract addresses
# - Set RPC_URL to Sepolia
# - Set network to 'sepolia'

# Start backend in staging mode
npm run dev:staging
# Expected: Server running on :3001
```

#### Step 2: Run API Integration Tests
```bash
# Test all 4 endpoints
npm run test:api:staging

# Expected output:
# Testing API against Sepolia contracts
# ✓ POST /treasury/{daoId}/transactions/propose
# ✓ POST /treasury/{daoId}/transactions/{id}/approve
# ✓ POST /treasury/{daoId}/transactions/{id}/execute
# ✓ GET /treasury/{daoId}/audit-log
#
# 4/4 API tests passing ✓
```

#### Step 3: Deploy Frontend (Staging)
```bash
# Build with staging config
REACT_APP_API_URL=https://staging-api.example.com npm run build

# Deploy to staging environment
npm run deploy:staging
# Expected: Frontend deployed to https://staging.example.com

# Verify it loads
curl https://staging.example.com | grep "MultisigApprovals"
# ✓ Component found
```

#### Step 4: Run E2E Tests
```bash
# Full end-to-end test
npm run test:e2e:staging

# Expected: Tests create proposal, wait, approve, execute
# All steps complete in ~2 minutes (simulated timelock)
```

**Staging Status:** ✅ COMPLETE  
**Ready for production?** YES

---

### PHASE 2: PRODUCTION MAINNET DEPLOYMENT

**Duration:** 2 hours (includes verification)  
**Purpose:** Deploy to mainnet with real value

⚠️ **CRITICAL:** This step requires mainnet ETH and moves to production

#### Step 1: Final Pre-Production Checks
```bash
# 1. Verify all tests still passing
npm run test:contracts
# Expected: 40/40 ✓

# 2. Verify no uncommitted changes
git status
# Expected: nothing to commit, working tree clean

# 3. Create backup of current state
git tag -a phase3-pre-mainnet-deploy-$(date +%Y%m%d) -m "Before mainnet"
git push origin --tags

# 4. Get mainnet prices
curl https://api.coinbase.com/v1/prices/ETH/USD
# Check current ETH price (to estimate final cost)

# 5. Final security check
npx slither . --json > slither-final-report.json
# Verify: zero CRITICAL findings
```

#### Step 2: Prepare Mainnet Configuration
```bash
# 1. Create mainnet env
cp .env.sepolia .env.mainnet
nano .env.mainnet
# Update:
# - NETWORK=mainnet
# - RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
# - PRIVATE_KEYs for 3 DIFFERENT signers (not testnet ones!)
# - Remove test wallets from whitelist

# 2. Verify signer wallets have enough ETH
# Recommendation: 2 ETH per signer for safety
# Example check:
# Signer 1: 2.5 ETH
# Signer 2: 2.5 ETH  
# Signer 3: 2.5 ETH
# Total: 7.5 ETH for deployment

# 3. Load configuration
source .env.mainnet
```

#### Step 3: Deploy Contracts to Mainnet
```bash
# This is the point of no return!
# Triple-check everything above is correct

echo "🚨 DEPLOYING TO MAINNET"
echo "Contracts: MultiSigTreasury, AuditLog, GovernanceSnapshot"
echo "Cost: ~2.5 ETH (at current prices)"
echo ""
read -p "Type 'MAINNET' to continue (or Ctrl+C to abort): " confirm
if [ "$confirm" != "MAINNET" ]; then
  echo "Deployment aborted ✓"
  exit 0
fi

# Deploy
npx hardhat run scripts/deploy-multisig-treasury.ts --network mainnet

# Expected output:
# 🚀 DEPLOYING TO MAINNET
# Deploying MultiSigTreasury...
# ✓ MultiSigTreasury deployed to: 0x6F4E...
# 
# Deploying AuditLog...
# ✓ AuditLog deployed to: 0x8C2A...
#
# Deploying GovernanceSnapshot...
# ✓ GovernanceSnapshot deployed to: 0xA9F3...
#
# Total cost: 2.45 ETH
# ✅ DEPLOYMENT SUCCESSFUL

# Save addresses
cat > .env.mainnet.addresses.txt << 'EOF'
MULTISIG_TREASURY=0x6F4E...
AUDIT_LOG=0x8C2A...
GOVERNANCE_SNAPSHOT=0xA9F3...
DEPLOYMENT_BLOCK=17850000
DEPLOYMENT_HASH=0x123...
EOF

# Backup this file!
cp .env.mainnet.addresses.txt .env.mainnet.addresses.txt.backup
```

#### Step 4: Verify Contracts on Etherscan
```bash
# This allows users to verify contract is real

for ADDRESS in "0x6F4E..." "0x8C2A..." "0xA9F3..."; do
  npx hardhat verify --network mainnet $ADDRESS
done

# Expected: Each contract verified on Etherscan
# https://etherscan.io/address/0x6F4E...
# https://etherscan.io/address/0x8C2A...
# https://etherscan.io/address/0xA9F3...
```

#### Step 5: Initialize Mainnet Multisig
```bash
# Initialize with REAL signers (different from testnet!)
npx hardhat run scripts/initialize-multisig.ts --network mainnet

# Expected:
# Adding signers:
# ✓ Signer 1 (Founder): Added
# ✓ Signer 2 (Protocol Lead): Added
# ✓ Signer 3 (Community): Added
#
# This is irreversible! Signers can now approve treasury transactions.
```

#### Step 6: Add Production Whitelist
```bash
# Whitelist ONLY intended recipients
npx hardhat run scripts/whitelist-recipients.ts --network mainnet

# Expected:
# ✓ DAO Treasury (multisig): Added
# ✓ Team Wallet (operational): Added
# ✓ Reserve Fund (emergency): Added
#
# Important: These are the ONLY addresses that can receive transfers
```

#### Step 7: Database Migration
```bash
# Run database migrations for production
npm run migrate -- --env production

# Expected:
# Migration 003_treasury_multisig.sql: SUCCESS ✓
# Tables created: 4
# Indices created: 12
# Rows inserted: 0
```

#### Step 8: Deploy Backend to Production
```bash
# 1. Update backend with mainnet contract addresses
cat >> .env.production << 'EOF'
MULTISIG_TREASURY=0x6F4E...
AUDIT_LOG=0x8C2A...
GOVERNANCE_SNAPSHOT=0xA9F3...
NETWORK=mainnet
RPC_URL=https://mainnet.infura.io/v3/...
EOF

# 2. Build backend
npm run build

# 3. Deploy (if using Docker/Kubernetes)
docker build -t mtaa-dao-backend:phase3-prod .
docker push mtaa-dao-backend:phase3-prod
kubectl set image deployment/mtaa-backend \
  mtaa-backend=mtaa-dao-backend:phase3-prod \
  --record

# 4. Verify backend is live
curl https://api.mtaa.io/health | grep phase3
# Expected: {"status": "healthy", "contracts": "mainnet"}
```

#### Step 9: Deploy Frontend to Production
```bash
# 1. Build with production config
REACT_APP_API_URL=https://api.mtaa.io npm run build

# 2. Deploy frontend
npm run deploy:production

# 3. Verify contracts are accessible
curl https://mtaa.io/api/contracts/MultisigApprovals
# Expected: Component loads with mainnet contracts
```

#### Step 10: Smoke Tests
```bash
# Final verification everything is working

# Test 1: Can retrieve contract addresses
curl https://api.mtaa.io/treasury/mainnet/info
# ✓ Returns mainnet addresses

# Test 2: Can access frontend
curl https://mtaa.io | grep MultisigApprovals
# ✓ Component loads

# Test 3: Can view audit log
curl https://api.mtaa.io/treasury/dao-123/audit-log
# ✓ Returns empty array (no transactions yet)

# Test 4: Multisig signers are set
# Check etherscan: https://etherscan.io/address/0x6F4E...#readContract
# Call: getSigners() → Should return [0xSigner1, 0xSigner2, 0xSigner3]
```

**Mainnet Status:** ✅ COMPLETE  
**Live?** YES  
**Ready for transactions?** YES

---

## 📊 POST-DEPLOYMENT

### Monitoring (First 24 Hours)

**Metrics to Watch:**
```
✓ Contract function calls (should be ~0 until first proposal)
✓ API response times (should be <500ms)
✓ Database latency (should be <100ms)
✓ No error logs in backend
✓ No failed transactions
```

**Alerting Triggers:**
```
🚨 API response time > 2 seconds
🚨 Database query time > 1 second
🚨 More than 5 failed contract calls in 1 hour
🚨 Audit log table grows by >1000 entries unexpectedly
```

### First Transaction (Test With Small Amount)

```bash
# Proposal: Transfer 100 USDC to tested recipient
# Timeline:
# Hour 0: Propose
# Hour 24: First signer can approve (12h before timeout)
# Hour 48: Second signer approves (timelock complete)
# Hour 48+: Execute

# Expected flow:
# 1. Create proposal
# 2. Wait 48 hours (or simulate in testnet)
# 3. Get 2/3 approvals
# 4. Execute
# 5. Verify funds transferred
# 6. Check audit log has 5 entries
```

### Rollback Plan (If Critical Issues Found)

```bash
# If issues arise in first 24 hours:

# 1. Pause contract
npx hardhat run scripts/pause-multisig.ts --network mainnet

# 2. Notify signers
# "MultiSig paused due to X issue. Do NOT approve transactions."

# 3. Investigate root cause

# 4. Two options:
# Option A (Recommended): Deploy v2 with fix, migrate
# Option B: Fix and unpause after verification

# 5. Unpause (only after fix verified)
npx hardhat run scripts/unpause-multisig.ts --network mainnet
```

### Success Criteria (After 1 Week)

- ✅ Zero critical errors
- ✅ At least 1 test transaction completed successfully
- ✅ Audit log has 5+ entries
- ✅ All 3 signers have approved at least once
- ✅ API uptime > 99.9%
- ✅ Database backups working
- ✅ Monitoring alerts configured

---

## 🎓 LESSONS LEARNED & NEXT STEPS

### What Worked Well
- [ ] Smart contract design is solid
- [ ] API integration is clean
- [ ] Database schema handles scale
- [ ] Frontend components are intuitive

### Areas for Improvement
- [ ] [To be filled after deployment]
- [ ] [To be filled after deployment]

### Phase 4 Planning
- [ ] Governance token integration
- [ ] Advanced voting mechanisms
- [ ] Cross-chain treasury sync
- [ ] Emergency multisig procedures

---

## 📞 EMERGENCY CONTACTS

**Issues During Deployment:**
- Smart Contract Issues: [DevOps Lead]
- Backend Issues: [Backend Lead]
- Frontend Issues: [Frontend Lead]
- Database Issues: [DBA]

**Escalation:**
- Critical (contracts paused): CTO
- Severe (API down): VP Engineering
- Medium (slow queries): DevOps

---

**Deployment Status: 🟢 READY TO DEPLOY**

