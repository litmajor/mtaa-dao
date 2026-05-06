# Micro-Withdrawals Integration Checklist

## Phase 1: Backend Implementation ✅ COMPLETE

- [x] Create `micro-withdrawal-service.ts` (340 lines)
  - [x] `requestMicroWithdrawal()` - Submit withdrawal request
  - [x] `checkAndProcessBatch()` - Check thresholds
  - [x] `processBatch()` - Execute batch transaction
  - [x] `notifyBatchProcessed()` - Notify users
  - [x] `cancelMicroWithdrawal()` - Cancel request
  - [x] `getBatchDetails()` - Fetch batch info
  - [x] `getMicroWithdrawalStats()` - System stats
  - [x] `triggerManualBatchProcess()` - Admin trigger
  - [x] `getUserPendingWithdrawals()` - User's pending
  - [x] `shouldAutoProcess()` - Time-based logic

- [x] Create `micro-withdrawals.ts` routes (250 lines)
  - [x] `POST /api/micro-withdrawals/request` - Create request
  - [x] `GET /api/micro-withdrawals/pending` - User's pending
  - [x] `POST /api/micro-withdrawals/cancel` - Cancel request
  - [x] `GET /api/micro-withdrawals/batch/:batchId` - Batch details
  - [x] `GET /api/micro-withdrawals/stats` - System stats
  - [x] `POST /api/micro-withdrawals/process-batch` - Admin trigger
  - [x] `POST /api/micro-withdrawals/check-batch` - Check trigger

- [x] Add input validation (Zod schemas)
- [x] Add error handling (400, 403, 404, 500)
- [x] Add request logging
- [x] Add TypeScript types
- [x] Verify no compilation errors

## Phase 2: Route Registration ✅ COMPLETE

- [x] Import `microWithdrawalsRoutes` in routes.ts
- [x] Register route: `app.use('/api/micro-withdrawals', microWithdrawalsRoutes)`
- [x] Verify route placement (after deposits-withdrawals)
- [x] Test route registration syntax

## Phase 3: Frontend Implementation ✅ COMPLETE

- [x] Create `MicroWithdrawalWidget.tsx` component
  - [x] Create dialog with form
  - [x] Amount input field (validation: $0.50-$10)
  - [x] Currency selector
  - [x] Wallet address input
  - [x] Submit button with loading state
  - [x] Pending requests list
  - [x] Cancel buttons for pending requests
  - [x] Live statistics display
  - [x] Batch info display
  - [x] How-it-works educational section
  - [x] Empty state when no requests
  - [x] Real-time refresh (30s interval)

- [x] Add error toast notifications
- [x] Add success notifications
- [x] Add UI/UX styling
- [x] Add accessibility features

## Phase 4: Database Schema ⏳ PENDING

- [ ] Create migration file
- [ ] Create `microWithdrawals` table
  - [ ] `id` (UUID primary key)
  - [ ] `userId` (UUID foreign key to users)
  - [ ] `amount` (DECIMAL 18,2) with constraint 0.50-10.00
  - [ ] `currency` (VARCHAR) with enum constraint
  - [ ] `toAddress` (VARCHAR) with Ethereum format constraint
  - [ ] `status` (VARCHAR) with enum constraint
  - [ ] `batchId` (UUID nullable foreign key)
  - [ ] `estimatedGasFee`, `actualGasFee` (DECIMAL 18,8)
  - [ ] `transactionHash` (VARCHAR nullable)
  - [ ] `cancelledAt`, `cancelledReason` (TIMESTAMP, VARCHAR)
  - [ ] `createdAt`, `updatedAt`, `processedAt` (TIMESTAMP)
  - [ ] Indexes: userId, status, batchId, createdAt, userId+status

- [ ] Create `microWithdrawalBatches` table
  - [ ] `id` (UUID primary key)
  - [ ] `requestCount` (INT)
  - [ ] `totalAmount` (DECIMAL 18,2)
  - [ ] `currency` (VARCHAR)
  - [ ] `status` (VARCHAR)
  - [ ] `estimatedGasFee`, `actualGasFee` (DECIMAL 18,8)
  - [ ] `transactionHash` (VARCHAR nullable)
  - [ ] `failureReason` (VARCHAR nullable)
  - [ ] `triggeredBy` (VARCHAR) - count, amount, time, manual, api
  - [ ] `processedAt` (TIMESTAMP nullable)
  - [ ] `createdAt`, `updatedAt` (TIMESTAMP)
  - [ ] Indexes: status, createdAt, triggeredBy

- [ ] Run migration on dev database
- [ ] Run migration on staging database
- [ ] Backup production database before running migration

## Phase 5: Database Integration ⏳ PENDING

### Mock Implementations to Replace

In `micro-withdrawal-service.ts`, replace these mock implementations:

- [ ] `requestMicroWithdrawal()` 
  - Replace: In-memory storage mock
  - With: Database insert query
  - Location: Lines ~50-75

- [ ] `checkAndProcessBatch()`
  - Replace: Mock threshold checking
  - With: Database aggregation queries
  - Location: Lines ~80-120

- [ ] `processBatch()`
  - Replace: Mock transaction
  - With: Actual blockchain call
  - Location: Lines ~140-180

- [ ] `notifyBatchProcessed()`
  - Already uses `notificationService` ✓
  - Verify it's working

- [ ] `cancelMicroWithdrawal()`
  - Replace: Mock storage
  - With: Database update query
  - Location: Lines ~190-210

- [ ] `getBatchDetails()`
  - Replace: Mock retrieval
  - With: Database select + joins
  - Location: Lines ~220-250

- [ ] `getMicroWithdrawalStats()`
  - Replace: Mock aggregation
  - With: Database aggregation query
  - Location: Lines ~260-290

- [ ] `getUserPendingWithdrawals()`
  - Replace: Mock filtering
  - With: Database select with filters
  - Location: Lines ~300-320

## Phase 6: Blockchain Integration ⏳ PENDING

- [ ] Implement multi-transfer transaction builder
  - [ ] Accept array of requests (user, amount, address)
  - [ ] Build transaction payload for blockchain
  - [ ] Support all 4 currencies (USDC, USDT, cUSD, ETH)
  - [ ] Handle different contract ABIs

- [ ] Implement gas fee estimation
  - [ ] Call blockchain RPC for gas price
  - [ ] Calculate total gas for batch
  - [ ] Calculate per-user gas share
  - [ ] Store both estimated and actual

- [ ] Implement transaction submission
  - [ ] Sign transaction with system wallet
  - [ ] Submit to blockchain
  - [ ] Poll for confirmation
  - [ ] Store transaction hash on success
  - [ ] Retry logic on failure

- [ ] Implement transaction confirmation
  - [ ] Monitor blockchain for confirmations
  - [ ] Update batch status to 'processed'
  - [ ] Update all requests status to 'processed'
  - [ ] Trigger notifications
  - [ ] Log success with transaction hash

- [ ] Add error handling
  - [ ] Handle RPC timeouts
  - [ ] Handle transaction failures
  - [ ] Rollback batch on failure
  - [ ] Store failure reason in DB
  - [ ] Alert admins on critical failures

## Phase 7: Cronjob Configuration ⏳ PENDING

- [ ] Set up scheduler (node-schedule or Bull)
- [ ] Create cronjob to run every 24 hours
  - [ ] Call `checkAndProcessBatch()` or `triggerManualBatchProcess()`
  - [ ] Log execution with timestamp
  - [ ] Alert admins if fails
  - [ ] Alert admins if no pending requests

- [ ] Add metrics collection
  - [ ] Track job execution time
  - [ ] Track requests processed per job
  - [ ] Track success/failure rates

## Phase 8: Admin Dashboard ⏳ PENDING

- [ ] Create `MicroWithdrawalMonitor.tsx` component
  - [ ] Display pending requests count
  - [ ] Display total pending amount
  - [ ] Display oldest request age
  - [ ] Display next auto-process time
  - [ ] Display batch history
  - [ ] Show batch transaction hashes (clickable links)
  - [ ] Manual batch trigger button
  - [ ] Batch processing logs
  - [ ] Filter by status, date range

- [ ] Create admin endpoints (if not already present)
  - [ ] `/api/admin/micro-withdrawals/stats`
  - [ ] `/api/admin/micro-withdrawals/batches`
  - [ ] `/api/admin/micro-withdrawals/logs`

## Phase 9: Monitoring & Observability ⏳ PENDING

- [ ] Add structured logging
  - [ ] Log all request creations
  - [ ] Log all batch triggers
  - [ ] Log all cancellations
  - [ ] Log all completions
  - [ ] Log all errors

- [ ] Add metrics/observability
  - [ ] `pending_requests_count` gauge
  - [ ] `pending_amount_total` gauge
  - [ ] `batch_process_count` counter
  - [ ] `batch_processing_time_seconds` histogram
  - [ ] `gas_fee_per_user` histogram
  - [ ] `success_rate` gauge

- [ ] Add alerts
  - [ ] Alert if batch fails
  - [ ] Alert if pending > 200 requests
  - [ ] Alert if oldest request > 30 hours
  - [ ] Alert if gas price spikes > 200%

## Phase 10: Integration Testing ⏳ PENDING

### Unit Tests
- [ ] Test `requestMicroWithdrawal()`
  - [ ] Valid request creation
  - [ ] Amount validation (too low)
  - [ ] Amount validation (too high)
  - [ ] Address validation
  - [ ] Currency validation
  - [ ] Unauthorized user rejection

- [ ] Test `checkAndProcessBatch()`
  - [ ] Request count threshold trigger
  - [ ] Amount threshold trigger
  - [ ] Time threshold trigger
  - [ ] No trigger conditions
  - [ ] Correct trigger reason in response

- [ ] Test `cancelMicroWithdrawal()`
  - [ ] Cancel pending request
  - [ ] Cannot cancel batched request
  - [ ] Cannot cancel processed request
  - [ ] Cannot cancel already cancelled request

### Integration Tests
- [ ] Test end-to-end request → batch → completion
- [ ] Test concurrent requests from multiple users
- [ ] Test batch processing with DB
- [ ] Test batch processing with blockchain mock
- [ ] Test transaction retry logic
- [ ] Test notification sending

### Load Tests
- [ ] Test with 1,000 concurrent requests
- [ ] Test with 50,000 pending requests
- [ ] Test batch processing time at scale
- [ ] Test database query performance

## Phase 11: Documentation ✅ COMPLETE

- [x] Create [MICRO_WITHDRAWALS_SCHEMA.md](./MICRO_WITHDRAWALS_SCHEMA.md)
  - [x] Database schema with constraints
  - [x] Configuration constants
  - [x] Data flow diagrams
  - [x] Query examples
  - [x] Audit trail information

- [x] Create [MICRO_WITHDRAWALS_COMPLETE_GUIDE.md](./MICRO_WITHDRAWALS_COMPLETE_GUIDE.md)
  - [x] System overview
  - [x] Problem statement
  - [x] Solution architecture
  - [x] Feature list
  - [x] API endpoint documentation
  - [x] Configuration guide
  - [x] Testing scenarios
  - [x] Deployment checklist
  - [x] Success metrics

- [ ] Create frontend integration guide
- [ ] Create admin guide
- [ ] Create user guide with screenshots

## Phase 12: Staging Deployment ⏳ PENDING

- [ ] Deploy backend changes to staging
- [ ] Deploy frontend changes to staging
- [ ] Run smoke tests on staging
- [ ] Run integration tests on staging
- [ ] Test with staging blockchain (testnet)
- [ ] Verify database migrations on staging
- [ ] Verify cronjob works on staging
- [ ] Verify notifications on staging
- [ ] Admin review and sign-off

## Phase 13: Production Deployment ⏳ PENDING

- [ ] Backup production database
- [ ] Deploy backend to production
  - [ ] Verify no errors in logs
  - [ ] Verify routes accessible
  - [ ] Verify database queries work

- [ ] Deploy database migrations
  - [ ] Run migration script
  - [ ] Verify tables created
  - [ ] Verify indexes created

- [ ] Deploy frontend to production
  - [ ] Verify component renders
  - [ ] Verify API calls work
  - [ ] Verify notifications appear

- [ ] Start cronjob in production
- [ ] Monitor metrics closely first 24 hours
- [ ] Be ready to rollback if issues

## Phase 14: Post-Deployment ⏳ PENDING

- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Monitor user feedback
- [ ] Monitor blockchain transactions
- [ ] Check admin dashboard logs
- [ ] Verify batch processing is happening
- [ ] Verify users are receiving notifications
- [ ] Measure gas savings achieved
- [ ] Collect success metrics

## Timeline

| Phase | Status | Est. Time | Owner |
|-------|--------|-----------|-------|
| 1-3 | ✅ COMPLETE | Done | Dev |
| 4-5 | ⏳ PENDING | 4 hours | DB Engineer |
| 6 | ⏳ PENDING | 6 hours | Blockchain Dev |
| 7 | ⏳ PENDING | 2 hours | DevOps |
| 8 | ⏳ PENDING | 4 hours | Frontend Dev |
| 9 | ⏳ PENDING | 3 hours | DevOps |
| 10 | ⏳ PENDING | 8 hours | QA |
| 11 | ✅ COMPLETE | Done | Tech Writer |
| 12-14 | ⏳ PENDING | 6 hours | Ops/QA |

**Total Remaining**: ~33 hours

## Notes

- All code follows existing patterns in the codebase
- All error handling consistent with other endpoints
- All logging matches existing log format
- All validation uses existing Zod schemas
- Frontend uses existing UI component library
- Database uses existing connection pool

## Blocked By

- [ ] Database connection pool configuration
- [ ] Blockchain RPC endpoint setup
- [ ] Notification service verification
- [ ] Admin role configuration
- [ ] Cronjob scheduler setup

## Questions/Decisions

- **Gas Fee Handling**: Who absorbs the gas fee? (Currently: split among users)
- **Withdrawal Destination**: Only Ethereum addresses? Or other blockchains?
- **Auto-Batch Time**: 24 hours optimal? Or should it be shorter?
- **Max Batch Size**: Any limit to requests per batch?
- **Currency Conversion**: Allow cross-currency batching?

---

**Created**: 2024-01-15
**Last Updated**: 2024-01-15
**Status**: Phase 1-3 Complete, Phase 4+ In Queue
