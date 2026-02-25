# Phase 1 Testing Guide: Enhanced Conversation Features

## Summary
Phase 1 implementation includes:
1. ✅ Session Persistence - Browser restart-resistant conversations
2. ✅ Proactive Notifications - Alert system for DAO events
3. ✅ Swahili Enhancement - High-quality Swahili translations

---

## Feature 1: Session Persistence

### What Was Implemented
- **Client Hook**: `useMorioSessionStorage` hook with localStorage integration
- **Auto-save**: Messages saved to localStorage automatically
- **Auto-load**: Previous messages restored on page reload
- **24-hour expiry**: Sessions expire after 24 hours of inactivity
- **Cleanup**: Old sessions from other DAOs/users are automatically cleaned up

### Test Cases

#### Test 1.1: Basic Session Save
```
Steps:
1. Open Morio Hub page
2. Send message: "Check DAO balance"
3. Wait for response
4. Refresh page (F5)

Expected:
- Previous messages appear immediately
- No welcome message shown
- User can continue conversation seamlessly
```

#### Test 1.2: Multiple DAOs
```
Steps:
1. Switch to DAO 1, send messages
2. Switch to DAO 2, send different messages
3. Switch back to DAO 1

Expected:
- Each DAO has separate conversation history
- Messages are isolated per DAO
```

#### Test 1.3: Session Expiry
```
Steps:
1. Send message in Morio
2. Advance system clock 25 hours
3. Refresh page

Expected:
- Session is cleared (expired)
- Welcome message shows
- Can start fresh conversation
```

#### Test 1.4: Browser Close/Reopen
```
Steps:
1. Send messages in Morio
2. Close browser tab completely
3. Reopen MtaaDAO and go to /morio

Expected:
- All previous messages restored
- Conversation continues from last message
```

#### Test 1.5: Incognito/Private Mode
```
Steps:
1. Open Morio in private/incognito mode
2. Send messages
3. Close tab, reopen in private mode

Expected:
- On reopening private tab: localStorage is cleared (normal browser behavior)
- Welcome message shows
- No privacy breach
```

### Verification Checklist
- [ ] Messages persist across page refreshes
- [ ] Messages clear after 24 hours
- [ ] Multiple DAOs have separate sessions
- [ ] Console shows no errors
- [ ] localStorage is used (check DevTools > Application > localStorage)
- [ ] Session data is valid JSON

---

## Feature 2: Proactive Notifications

### What Was Implemented
- **Backend Manager**: `NotificationManager` class with event handling
- **Frontend Hook**: `useMorioNotifications` with 30-second polling
- **Toast Component**: `NotificationToast` with priority-based styling
- **10 Notification Types**: 
  - proposal_expiring
  - proposal_created
  - voting_started
  - voting_ended
  - treasury_milestone
  - member_joined
  - high_contribution
  - task_available
  - event_coming
  - vault_opportunity

### Test Cases

#### Test 2.1: Notification Polling
```
Steps:
1. Open Morio Hub
2. Open browser console
3. Manually trigger notification via API:
   curl -X POST http://localhost:3000/api/morio/notifications \
     -d '{"userId":"test-user","type":"high_contribution","title":"Test"}'
4. Wait 30 seconds or refresh

Expected:
- Toast appears with notification
- Auto-dismisses after 5 seconds
- Console shows no errors
```

#### Test 2.2: Priority Styling
```
Steps:
1. Trigger 3 notifications with different priorities:
   - HIGH: red background, alert icon
   - MEDIUM: blue background, info icon
   - LOW: green background, checkmark icon
2. Observe styling

Expected:
- Red notification for HIGH priority
- Blue notification for MEDIUM priority
- Green notification for LOW priority
```

#### Test 2.3: Multiple Notifications
```
Steps:
1. Trigger 5 notifications quickly
2. Observe display

Expected:
- All 5 appear in a stack
- Highest priority at top
- Each auto-dismisses after 5 seconds
```

#### Test 2.4: Manual Dismiss
```
Steps:
1. Show notification
2. Click X button

Expected:
- Notification disappears immediately
- Unread count decreases
```

#### Test 2.5: Mark as Read
```
Steps:
1. Fetch notifications via endpoint:
   GET /api/morio/notifications/user123
2. Mark one as read:
   POST /api/morio/notifications/user123/read/{notificationId}
3. Fetch again

Expected:
- Marked notification no longer appears in list
- Count decreases
```

### Notification Trigger Points (Manual Testing)
These are the methods to trigger notifications manually:

```typescript
// In server code or API
const notificationManager = getNotificationManager();

// Test each notification type:
await notificationManager.notifyProposalExpiring(userId, daoId, proposalId, 'Budget Review');
await notificationManager.notifyProposalCreated(userId, daoId, proposalId, 'Alice', 'New Initiative');
await notificationManager.notifyVotingStarted(userId, daoId, proposalId, 'Fund Allocation');
await notificationManager.notifyVotingEnded(userId, daoId, proposalId, 'Fund Allocation', 'passed');
await notificationManager.notifyTreasuryMilestone(userId, daoId, '1M cUSD', '$1,000,000');
await notificationManager.notifyHighContribution(userId, daoId, 250);
await notificationManager.notifyTaskAvailable(userId, daoId, 'task123', 'Review Proposal', '100 cUSD');
await notificationManager.notifyEventComing(userId, daoId, 'Community Meetup', 5);
await notificationManager.notifyVaultOpportunity(userId, daoId, 'USDC Yield', '12%');
```

### Verification Checklist
- [ ] Notifications fetch without errors
- [ ] Toast component displays correctly
- [ ] Notifications auto-dismiss after 5 seconds
- [ ] Manual dismiss works
- [ ] Priority colors are correct
- [ ] Multiple notifications stack properly
- [ ] Mark as read works on backend
- [ ] Unread count updates correctly
- [ ] Polling happens every 30 seconds

---

## Feature 3: Enhanced Swahili Responses

### What Was Implemented
- **swahili_responses.ts**: 150+ new Swahili translations
- **Response Categories**:
  - Greetings & Welcome
  - General Responses
  - Treasury Operations
  - Proposals
  - Voting
  - Community & Members
  - Analytics & Insights
  - Onboarding
  - Error Messages
  - Help & Suggestions

### Test Cases

#### Test 3.1: Detect Swahili Input
```
Steps:
1. Set user language preference to Swahili
2. Send message: "Habari, nchi ya hazina?"
3. Check response

Expected:
- System recognizes Swahili language
- Response is in Swahili (high-quality, natural)
```

#### Test 3.2: Common Operations in Swahili
```
Trigger each command and verify Swahili response:
- "Angalia malundi" (Check balance)
- "Weka pesa" (Make deposit)
- "Tao pesa" (Withdraw funds)
- "Kamatia pendekezo" (Create proposal)
- "Piga kura" (Vote)
- "Wanajamii" (Member stats)

Expected:
- All responses use proper Swahili
- Terminology is consistent
- Grammar is correct
- Context is maintained
```

#### Test 3.3: Swahili Greetings
```
Steps:
1. Reload Morio with Swahili language
2. Check welcome message

Expected:
- Welcome is in Swahili: "Habari! 👋 I'm Morio..."
- Greeting variations are natural
```

#### Test 3.4: Swahili Error Messages
```
Steps:
1. Enter unrecognized command in Swahili
2. Send request with missing fields

Expected:
- Error messages are in Swahili
- "Samahani" (sorry) is used appropriately
```

#### Test 3.5: Code-Switching
```
Steps:
1. User sends mixed English/Swahili message
2. System should respond in Swahili

Expected:
- System detects primary language
- Response is primarily in Swahili
- English terms (like "DAO") are acceptable
```

### Swahili Quality Checklist
- [ ] Greetings are warm and welcoming
- [ ] Treasury terms are accurate (hazina, pesa, malipo)
- [ ] Governance terms are consistent (pendekezo, kura, kuchagua)
- [ ] Community terms are respectful (wanajamii, jamii)
- [ ] Emojis are culturally appropriate
- [ ] No inappropriate translations
- [ ] Proper noun capitalization (MtaaDAO stays English)
- [ ] Swahili is primary for UI, English for technical terms

---

## Integration Testing

### Test 4.1: Session + Notifications Together
```
Steps:
1. Open Morio
2. Send message, get response (saves to localStorage)
3. Trigger notification
4. Refresh page
5. Check that both session AND notification appear

Expected:
- Previous messages still there
- New notification also visible
- No conflicts between features
```

### Test 4.2: Swahili Session Persistence
```
Steps:
1. Set language to Swahili
2. Send message: "Angalia malundi"
3. Refresh page

Expected:
- Swahili message and response persist
- Language preference preserved
- No encoding issues with Swahili characters
```

### Test 4.3: Mobile Responsiveness
```
Steps:
1. Open Morio on mobile device
2. Test session persistence
3. Check notification display
4. Send Swahili message

Expected:
- All features work on mobile
- Notifications don't overflow screen
- Messages readable on small screen
```

---

## Performance Testing

### Test 5.1: localStorage Size
```
Steps:
1. Send 100+ messages in a session
2. Check localStorage size

Expected:
- Total size < 5MB
- Performance doesn't degrade
- No browser crashes
```

### Test 5.2: Notification Polling Overhead
```
Steps:
1. Open Morio for 1 hour
2. Monitor CPU/memory in DevTools

Expected:
- No memory leaks
- Polling doesn't spike CPU
- Battery usage is minimal
```

### Test 5.3: Message Rendering Performance
```
Steps:
1. Load session with 200 messages
2. Measure scroll and typing latency

Expected:
- Smooth scrolling
- No lag when typing
- Responsive UI
```

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

For each browser:
- [ ] Session persistence works
- [ ] Notifications display correctly
- [ ] Swahili text renders properly
- [ ] No console errors

---

## Edge Cases

### Test 6.1: Offline Mode
```
Steps:
1. Open Morio online
2. Send message
3. Go offline (DevTools Network > Offline)
4. Try to send message

Expected:
- Offline message shows
- Previous messages still visible (from cache)
- Can't send new messages
```

### Test 6.2: Storage Full
```
Steps:
1. Fill localStorage with other data (near limit)
2. Try to save new messages

Expected:
- System handles gracefully
- Error logged to console
- User gets helpful error message
```

### Test 6.3: Session Collision (Same DAO, Different Devices)
```
Steps:
1. Open Morio on Device A, send messages
2. Open Morio on Device B, same user/DAO, send different messages
3. Go back to Device A, refresh

Expected:
- Each device has its own session
- No data conflict
- Latest messages appear correctly
```

### Test 6.4: Language Change Mid-Session
```
Steps:
1. Start session in English
2. Change language to Swahili
3. Send new message

Expected:
- Previous English messages stay as-is
- New message gets Swahili response
- No corruption of previous content
```

---

## Debugging Helpers

### Check localStorage (Browser DevTools)
```
Application > Storage > localStorage > https://app.mtaodao.com

Expected keys:
- morio_session_[userId]_[daoId]
- morio_session_[userId]_default

Each contains:
{
  "userId": "user123",
  "daoId": "dao123",
  "messages": [...],
  "lastUpdated": "2026-01-15T10:30:00Z"
}
```

### Check Network Requests
```
DevTools > Network tab, filter for "morio"

Expected requests:
- POST /api/morio/chat (user sends message)
- GET /api/morio/notifications/[userId] (30s polling)
- POST /api/morio/notifications/[userId]/read/[id] (mark read)
```

### Check Console Logs
```
Filter for "[Morio]" to see:
- Session restore messages
- Notification fetch logs
- Any errors during operation
```

---

## Rollback Plan

If issues found during testing:

1. **Session Persistence Issues**:
   - Revert `useMorioSessionStorage.ts`
   - Revert changes to `MorioChat.tsx`
   - Messages will reset on reload (acceptable fallback)

2. **Notification Issues**:
   - Disable notification polling (set interval to null)
   - Remove `NotificationContainer` from App
   - Notifications won't display but won't break chat

3. **Swahili Issues**:
   - Revert to English templates only
   - Fall back to existing responses.ts
   - Users can still use English language

---

## Success Criteria

Phase 1 is successful if:
- ✅ 90%+ of test cases pass without major issues
- ✅ No critical errors in browser console
- ✅ Session persistence works across 3+ browser restarts
- ✅ Notifications appear within 30 seconds of trigger
- ✅ Swahili responses are natural and high-quality
- ✅ Mobile responsiveness is maintained
- ✅ No performance degradation vs. previous version
- ✅ All 4 edge cases handled gracefully

---

## Post-Testing Deployment

Once all tests pass:
1. Create PR with Phase 1 changes
2. Tag commit with "phase-1-complete"
3. Enable MORIO_NOTIFICATIONS feature flag
4. Monitor error logs for 24 hours
5. Gather user feedback
6. Plan Phase 2 (analytics, predictions)

---

## User Communication

Once deployed, notify users:
> **NEW: Session Persistence** 💾
> Your Morio conversations now persist across browser restarts! Pick up where you left off.
>
> **NEW: Notifications** 🔔
> Get alerts about important DAO events - proposals, voting, treasury milestones, and more.
>
> **IMPROVED: Swahili Support** 🇹🇿
> Better Swahili translations for a more natural experience.
