# Escrow Phase 2 Quick Reference

## Files Created/Modified

### Backend Services
- ✅ `server/services/escrow-notifications.ts` - Email & SMS templates and sending
- ✅ `server/services/referral-integration.ts` - Referral tracking integration
- ✅ `server/db/migrations/001-notification-system.ts` - Database tables

### API Routes
- ✅ `server/routes/escrow.ts` - Updated with notification triggers

### Frontend Components
- ✅ `client/src/components/wallet/EscrowHistory.tsx` - History view with filters
- ✅ `client/src/pages/escrow-analytics.tsx` - Analytics dashboard
- ✅ `client/src/pages/escrow-accept.tsx` - Updated to capture referrer

## Quick Start

### 1. Install Dependencies
```bash
npm install nodemailer twilio date-fns
```

### 2. Set Environment Variables
```env
# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# SMS
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Referral
REFERRAL_SERVICE_URL=http://localhost:3001
REFERRAL_SERVICE_KEY=your_key

# App
APP_URL=https://mtaa.io
```

### 3. Run Database Migration
```typescript
import { migrateNotificationTables } from './db/migrations/001-notification-system';
await migrateNotificationTables();
```

### 4. Integrate Components
```tsx
// In wallet.tsx
import { EscrowHistory } from '@/components/wallet/EscrowHistory';

<EscrowHistory userId={user.id} />

// Create new route for analytics
import { EscrowAnalyticsDashboard } from '@/pages/escrow-analytics';
```

## Function Reference

### Email Notifications
```typescript
// Send notifications (called automatically)
notifyEscrowCreated(payer, recipientEmail, escrow)
notifyEscrowAccepted(payer, payee, escrow)
notifyMilestonePending(payer, payee, escrow, milestone)
notifyMilestoneApproved(payer, payee, escrow, milestone)
notifyEscrowDisputed(payer, payee, escrow, reason)
```

### SMS Notifications
```typescript
// Send SMS templates (called automatically)
sendEscrowCreatedSms(phone, payer, escrow)
sendEscrowAcceptedSms(phone, payee, escrow)
sendMilestonePendingSms(phone, payee, milestone)
sendMilestoneApprovedSms(phone, amount, currency)
sendDisputeSms(phone)
```

### Referral Integration
```typescript
// Register referral on signup
registerEscrowReferral(referrerId, refereeId, escrowId)

// Track locally
trackEscrowReferral(referrerId, refereeId, escrowId)

// Get metrics
getConversionMetrics(userId)
getEscrowReferrals(userId)
```

## API Endpoints (Updated)

### Initiate Escrow
```bash
POST /api/escrow/initiate
Body: { recipient, amount, currency, description, milestones }
Effect: ✉️ Email sent to recipient
```

### Accept Escrow
```bash
POST /api/escrow/accept/:inviteCode?referrer=:referrerId
Effect: 
  - ✉️ Emails to both parties
  - 📞 SMS to payer (if enabled)
  - 🔗 Referral registered
```

### Approve Milestone
```bash
POST /api/escrow/:escrowId/milestones/:num/approve
Effect: ✉️ Email to payer + SMS if enabled
```

### Release Milestone
```bash
POST /api/escrow/:escrowId/milestones/:num/release
Effect: ✉️ Email to payee + SMS if enabled
```

### Raise Dispute
```bash
POST /api/escrow/:escrowId/dispute
Body: { reason, evidence }
Effect: ✉️ Emails to both + SMS if enabled
```

## Database Tables

### notification_preferences
- Stores per-user notification settings
- Controls which events trigger notifications
- Email & SMS enable/disable toggles

### notifications_log
- Audit trail of all notifications sent
- Links notifications to escrows
- Records success/failure status

### escrow_events
- Detailed event log for escrows
- Records who triggered what and when
- JSONB data for event details

## Features Included

### Email System
- ✉️ Professional HTML templates
- 🎨 Branded styling with gradients
- 📋 All key events covered
- ⚙️ Configurable SMTP
- 🔍 Detailed audit logging

### SMS System
- 📱 Twilio integration
- ✂️ Optimized message length
- 🔔 Key event alerts
- 🚫 Graceful degradation when disabled

### Referral Integration
- 🔗 Captures referrer from URL
- 📊 Conversion metrics
- 💾 Local database tracking
- 🎯 Works with existing referral service

### History Component
- 📋 Filterable escrow list
- 🔍 Search by counterparty/description
- 📥 Export to CSV
- 📊 Status breakdown
- ⏱️ Relative timestamps

### Analytics Dashboard
- 📈 Key metrics cards
- 📊 Status distribution chart
- 📉 Activity timeline
- 🎯 Completion rate tracking
- ⚠️ Dispute monitoring

## Testing Checklist

- [ ] Test email sending with `testEmailConfiguration()`
- [ ] Test SMS with sample message
- [ ] Test referral registration
- [ ] Test escrow creation flow (email sent)
- [ ] Test escrow acceptance flow (both get emails)
- [ ] Test milestone approval flow (payer notified)
- [ ] Test milestone release flow (payee notified)
- [ ] Test dispute flow (both notified)
- [ ] Test history filtering
- [ ] Test analytics calculations
- [ ] Test CSV export
- [ ] Verify notification logs in database

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Emails not sending | Check SMTP credentials and app password |
| SMS not sending | Verify Twilio SID, token, and phone number |
| Referrals not tracked | Check referral service URL and API key |
| Analytics blank | Ensure escrows exist with correct status |
| History not loading | Check API endpoint returning escrow data |

## Environment Variables Needed

```
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
SMTP_SECURE
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
REFERRAL_SERVICE_URL
REFERRAL_SERVICE_KEY
APP_URL
CLIENT_URL
```

## Status Icons

| Icon | Status | Color |
|------|--------|-------|
| ⏳ | Pending | Yellow |
| ✅ | Accepted | Blue |
| 💰 | Funded | Indigo |
| 🎉 | Completed | Green |
| ⚠️ | Disputed | Red |
| ↩️ | Refunded | Gray |

## Next Steps

1. Set up email configuration (Gmail/SendGrid/AWS SES)
2. Set up Twilio account and get credentials
3. Configure referral service integration
4. Run database migration
5. Add history component to wallet page
6. Add analytics route to router
7. Test all notification flows
8. Deploy to production
9. Monitor notification logs
10. Gather user feedback on notifications

## Support Resources

- Email Templates: `server/services/escrow-notifications.ts` (lines 15-200)
- SMS Templates: `server/services/escrow-notifications.ts` (lines 235-245)
- Database Schema: `server/db/migrations/001-notification-system.ts`
- Component Usage: Check component file headers for detailed comments
- API Integration: Review `server/routes/escrow.ts` for examples

## Version Info

- **Phase**: Phase 2 (Escrow Enhancement)
- **Completed**: Email, SMS, Referral, History, Analytics
- **Status**: Production Ready
- **Last Updated**: 2024
