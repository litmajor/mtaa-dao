# Week 2 Admin Dashboard - Quick Start Guide

## 🚀 Getting Started

### Access the Admin Dashboard
1. Login with a super_admin account
2. Navigate to `/admin` or click Admin in navigation
3. You'll see the sidebar with 6 sections

### Admin Dashboard Sections

#### 1. **Analytics** (`/admin/analytics`)
- View real revenue metrics (monthly/quarterly/annual)
- See system health status
- Monitor database, blockchain, and payment services
- View top reputation users
- Auto-refreshes every 30 seconds

**Key Metrics:**
- Monthly Revenue: Sum of premium subscriptions
- Reputation Score: Activity-based calculation
- Health Status: Green/Yellow/Red

#### 2. **Settings** (`/admin/settings`)
- Configure platform settings
- Update blockchain RPC URL
- Set rate limits
- Enable/disable features
- All changes logged to audit trail

**Settings Categories:**
- Platform (name, version, environment, maintenance)
- Blockchain (RPC, Chain ID, confirmations)
- Rate Limits (API, transactions, withdrawals)
- Feature Flags (beta, UI, analytics)

#### 3. **Users** (`/admin/users`)
- View all users with pagination
- Sort by username or creation date
- Ban users (with reason)
- Delete users (permanent)
- See reputation scores and activity counts

**User Actions:**
- Ban: Prevents login, logs reason to audit
- Delete: Removes user and all data

#### 4. **Beta Access** (`/admin/beta-access`)
- Grant features to beta testers
- Revoke features in bulk
- See current feature access per user
- Manage 7 beta features

**Available Features:**
- advanced_analytics
- ai_assistant
- investment_pools
- locked_savings
- yield_strategies
- cross_chain
- nft_marketplace

#### 5. **DAOs** (`/admin/daos`)
- View all DAOs with details
- Update DAO status (active/inactive/suspended)
- See treasury balance and member count
- Track DAO creation date and creator

**DAO Status:**
- Active: Normal operation
- Inactive: Paused operations
- Suspended: Locked down (investigations)

#### 6. **Health Monitor** (`/admin/health`)
- Real-time system health
- Database connectivity status
- Blockchain RPC health
- Payment service status
- System recommendations
- Auto-refreshes every 10 seconds

**Health Indicators:**
- 🟢 Healthy: All systems operational
- 🟡 Warning: Elevated latency or minor issues
- 🔴 Error: Service unreachable

---

## 📊 Common Tasks

### Grant Beta Features to a User
1. Go to `/admin/beta-access`
2. Click checkbox next to user(s)
3. Select features to grant
4. Click "Grant Access"
5. Success notification appears

### Ban a User
1. Go to `/admin/users`
2. Find the user
3. Click ban icon (yellow)
4. Enter ban reason
5. Confirm
6. Audit log created

### Update Platform Settings
1. Go to `/admin/settings`
2. Modify desired fields
3. Click "Save Changes"
4. Changes immediately persisted to database
5. Audit log shows who changed what

### Monitor System Health
1. Go to `/admin/health`
2. Check overall status (top card)
3. Individual service cards show details
4. Red cards indicate issues needing attention
5. Recommendations appear at bottom

### Check Analytics
1. Go to `/admin/analytics`
2. View metric cards at top
3. Health status cards in middle
4. Reputation leaderboard at bottom
5. Toggle auto-refresh on/off

---

## 🔐 Security & Compliance

### Role-Based Access
- Only `super_admin` role can access `/admin`
- All actions logged to audit trail
- Failed auth attempts blocked

### Audit Trail
Every action is logged with:
- Admin user ID
- Action type (ban, delete, update, etc.)
- Before/after values
- Timestamp
- IP address
- User agent

### Protected Actions
- Ban user: Requires reason
- Delete user: Requires confirmation
- Update settings: Creates audit entry
- Grant features: Tracked per user

---

## 🐛 Troubleshooting

### Analytics Not Loading
- Check network tab for API errors
- Verify `/api/admin/analytics` responds
- Check database connection
- Review server logs

### Settings Won't Save
- Check network tab for PUT request
- Verify user has super_admin role
- Check database `config` table
- Review audit logs for failed update

### Users Table Empty
- Check network tab for GET request
- Verify `/api/admin/users/list` responds
- Ensure database `users` table has data
- Check pagination (might be on page 2+)

### Health Monitor Shows Red
- Database: Check PostgreSQL service running
- Blockchain: Verify RPC endpoint accessible
- Payment: Check payment service logs
- Network: Verify internet connection

---

## 📈 Performance Tips

### Optimize Page Loading
- Pagination limits data: 20 users/page, 50 logs/page
- Lazy loading for all admin pages
- Suspense fallbacks while loading
- Memoized callbacks prevent unnecessary renders

### Monitor Efficiently
- Use tab/window focus to reduce refreshes
- Disable auto-refresh when not watching
- Sort tables to find issues quickly
- Use search/filter to narrow results

### Database Health
- Check latency in Health Monitor
- If >500ms, contact support
- If error, verify PostgreSQL running
- Check logs: `docker logs mtaa-dao-postgres`

---

## 🔄 API Endpoints Reference

### Analytics
```
GET /api/admin/analytics
Response: { monthlyRevenue, quarterlyRevenue, annualRevenue, health, ... }
```

### Settings
```
GET /api/admin/settings
PUT /api/admin/settings
Body: { platformSettings, blockchainSettings, rateLimits, featureFlags }
```

### Users
```
GET /api/admin/users/list?page=1&limit=20
PUT /api/admin/users/:id/ban
DELETE /api/admin/users/:id
```

### Beta Access
```
GET /api/admin/beta-access?page=1&limit=20
POST /api/admin/beta-access/bulk
DELETE /api/admin/beta-access/bulk
```

### DAOs
```
GET /api/admin/daos/list?page=1&limit=20
PUT /api/admin/daos/:id/status
```

### Activity Logs
```
GET /api/admin/activity-logs?page=1&limit=50
```

---

## 📝 Checklists

### Daily Admin Tasks
- [ ] Check Analytics page for anomalies
- [ ] Monitor Health Monitor
- [ ] Review recent audit logs
- [ ] Check for banned users
- [ ] Verify settings haven't been changed

### Weekly Admin Tasks
- [ ] Review all user accounts
- [ ] Check DAO activity
- [ ] Analyze beta feature adoption
- [ ] Review security audit
- [ ] Backup databases

### Monthly Admin Tasks
- [ ] Full system audit
- [ ] Performance review
- [ ] Security assessment
- [ ] Revenue analysis
- [ ] Plan upcoming features

---

## ❓ FAQs

**Q: Can I undo a user delete?**
A: No, deletes are permanent. Always confirm first.

**Q: Where are audit logs stored?**
A: PostgreSQL `audit_logs` table with full history.

**Q: How often does analytics update?**
A: Real-time on load, auto-refresh every 30 seconds.

**Q: What if a feature flag is disabled?**
A: Users can't access that feature, but data remains.

**Q: Can I edit a user's reputation?**
A: No, reputation is calculated automatically from activity.

**Q: What's the difference between Ban and Delete?**
A: Ban keeps data, Delete removes everything.

---

## 🆘 Getting Help

1. **Check Logs**: `/admin` pages log all actions
2. **Review Docs**: Read WEEK2_BUILD_COMPLETE.md
3. **Contact Dev**: Share screenshot + error message
4. **Server Logs**: `docker logs mtaa-dao-backend`
5. **Database**: Connect to PostgreSQL directly if needed

---

**Admin Dashboard Ready**: November 21, 2025  
**Status**: ✅ Production Deployed  
**Support**: 24/7 monitoring active
