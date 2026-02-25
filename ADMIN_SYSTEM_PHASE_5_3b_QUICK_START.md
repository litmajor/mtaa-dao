# Phase 5.3b: History & Rollback - Quick Start Guide

## Overview

Phase 5.3b adds configuration version control with a complete history timeline and one-click rollback capability. Access the history page to view all configuration changes, compare versions, and restore previous configurations.

**Time to get started**: 5 minutes

## Quick Access

**URL**: `/admin/config-history`

**Features**:
- 📋 Complete version timeline
- 🔍 Side-by-side comparison
- 🔄 One-click rollback
- 📝 Change tracking
- 👤 User attribution

## Getting Started (5 minutes)

### Step 1: Navigate to History Page
1. Go to Admin Dashboard
2. Click "Configuration" in sidebar
3. Select "History & Rollback"
4. Or directly visit: `/admin/config-history`

### Step 2: View History
1. **Select Entity Type**: Choose "Elder" or "Agent" from dropdown
2. **Enter Entity ID**: Type the entity ID (e.g., "kaizen", "morio")
3. **Click Refresh**: Load the version history
4. **View Timeline**: See all versions with timestamps and details

### Step 3: Compare Versions
1. Click **"Compare A"** on an earlier version
   - Version highlights in blue
   - Button shows checkmark
2. Click **"Compare B"** on a later version
   - Comparison panel appears automatically
   - Shows all field differences

### Step 4: Rollback (If Needed)
1. Click **"Rollback"** on the version to restore
2. Review the warning message
3. (Optional) Enter reason for rollback
4. Click **"Confirm Rollback"**
5. History refreshes automatically

## Key Sections Explained

### Entity Selection Panel
```
┌─────────────────────────────────────────┐
│ Entity Type: [Elder ▼]  ID: [kaizen ──] │
│                     [Refresh History]   │
└─────────────────────────────────────────┘
```
- **Entity Type**: Elder or Agent
- **Entity ID**: Specific entity to view
- **Refresh**: Load/reload history

### Version Timeline
```
┌─ Version 5 ──────────────────────┐
│  Feb 14, 2024 10:45:30          │
│  Changed by: admin@example.com   │
│  Reason: Security update         │
│  Fields: updateInterval, logLevel│
│  [Compare A] [Compare B] [🔄]    │
└─────────────────────────────────┘
┌─ Version 4 ──────────────────────┐
│  Feb 12, 2024 15:20:15          │
│  Changed by: super@example.com   │
│  Reason: Performance tuning      │
│  Fields: maxRetries              │
│  [Compare A] [Compare B] [🔄]    │
└─────────────────────────────────┘
```

### Comparison View
```
Version 2 → Version 4

Field: updateInterval
From: 5000    →    To: 3000

Field: logLevel
From: "info"  →    To: "debug"
```

## Common Tasks

### Task 1: View Recent Changes
```
1. Open /admin/config-history
2. Entity Type: Elder
3. Entity ID: kaizen
4. Click Refresh
5. See last 20 versions displayed
```

### Task 2: Compare Two Versions
```
1. View history (above)
2. Click "Compare A" on Version 2
3. Click "Compare B" on Version 4
4. View side-by-side differences
5. Scroll through all changed fields
```

### Task 3: Find a Specific Change
```
1. View history (above)
2. Read through timeline entries
3. Look for matching "Reason" or "Fields changed"
4. Note the version number
5. Compare with current (version 1 = current)
```

### Task 4: Restore Previous Configuration
```
1. View history (above)
2. Find the version to restore
3. Click the "Rollback" button (🔄)
4. Modal appears with warning
5. (Optional) Enter why you're rolling back
6. Click "Confirm Rollback"
7. Success! Configuration restored
```

### Task 5: Navigate Between Pages
```
1. If history has 50+ versions:
2. At bottom of timeline, see pagination
3. Click "Next →" to see more versions
4. Click "← Previous" to go back
5. Current page shown (e.g., "Page 2 of 3")
```

## Understanding the Timeline

### Visual Elements
- **Blue Circle**: Version marker with number
- **Blue Line**: Connection between versions (flow of time)
- **Timestamp**: When change was made
- **User**: Who made the change
- **Reason**: Why the change was made
- **Fields**: What was modified

### Color Coding
- **Blue (#3b82f6)**: Selected version or highlight
- **Gray (#94a3b8)**: Secondary text (timestamps, help text)
- **Light (#e2e8f0)**: Primary text
- **Red (on rollback)**: Danger action

## Comparison Panel

### What It Shows
```
Version A → Version B

For each changed field:
┌─ Field Name ─────────────┐
│ From: [old value]         │
│ To:   [new value]         │
└───────────────────────────┘
```

### Reading Differences
- **From**: Previous value before change
- **To**: New value after change
- **Complex objects**: Displayed as formatted JSON
- **Color highlighting**: Old in left column, new in right

## Rollback Modal

### What It Does
```
⚠️ This will restore the configuration to version 2.
   Current configuration will be preserved in history.

Rollback Reason (optional):
[________________________________________]

[Cancel]  [Confirm Rollback]
```

### Important Notes
- ✅ Rollback is **safe** - current config is saved as new version
- ✅ Recorded in audit log with timestamp and user
- ✅ Reason is optional but recommended
- ✅ Takes effect immediately
- ✅ New version created for rollback action

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `R` | Refresh history (if input not focused) |
| `Esc` | Close comparison or modal |
| `↓` / `↑` | Navigate timeline (mobile) |

## Tips & Tricks

### Tip 1: Use the Pagination
- History shows 20 versions per page
- Older versions on next pages
- Search through from newest first

### Tip 2: Read Change Reasons
- Well-documented changes are easier to understand
- Reasons help decide if rollback is needed
- Examples: "Security fix", "Bug fix", "Feature test"

### Tip 3: Compare Before Rollback
- Always compare versions before rolling back
- Understand what changed
- Check if other changes were made
- Prevents accidental data loss

### Tip 4: Document Your Rollback
- Always provide a rollback reason
- Examples: "Revert performance issue", "Test cleanup"
- Helps teammates understand what happened
- Required by some compliance standards

### Tip 5: Mobile Usage
- Page is fully responsive
- Timeline layout adjusts to screen size
- Comparison view stacks vertically
- Touch-friendly button sizes

## Troubleshooting

### Issue 1: "No history available for this entity"
```
✅ Solution 1: Check entity ID spelling
   - Make sure ID matches exactly (case-sensitive)
   - Try: "kaizen" not "KAIZEN"

✅ Solution 2: Entity has no changes yet
   - New entities don't have history
   - Make a configuration change first
   - History starts recording from next change

✅ Solution 3: Wrong entity type
   - Are you looking for an Elder or Agent?
   - Try the other type
```

### Issue 2: Comparison panel not showing
```
✅ Solution 1: Select both versions
   - Need to click "Compare A" on one version
   - Need to click "Compare B" on another version
   - Buttons must show checkmarks

✅ Solution 2: Versions are identical
   - No differences found between selected versions
   - "No differences found between these versions"
   - Try different version pairs

✅ Solution 3: Loading delay
   - API call in progress
   - Wait for loading spinner to finish
   - Check browser console for errors
```

### Issue 3: Rollback shows error
```
✅ Solution 1: Version not found
   - Selected version no longer exists
   - Refresh page and try again
   - Check version number

✅ Solution 2: Permission denied
   - Not logged in as admin
   - Not super-admin for this entity
   - Contact administrator

✅ Solution 3: Server error
   - Backend issue
   - Try again in a few seconds
   - Check browser console
   - Contact technical support
```

### Issue 4: Page not loading
```
✅ Solution 1: Network connection
   - Check internet connection
   - Try reloading page (Ctrl+R)
   - Check if admin page works

✅ Solution 2: Authentication expired
   - Token may have expired
   - Logout and log back in
   - Check browser console

✅ Solution 3: Admin access
   - User must be admin or super-admin
   - Check dashboard access first
   - Verify with account administrator
```

## Security Notes

### ✅ What's Protected
- Only admins can view history
- Only super-admins can see system-wide changes
- All rollbacks are logged with user ID
- Changes require authentication
- Audit trail is immutable

### ✅ What's Logged
- Every rollback recorded in audit log
- User ID of who rolled back
- Versions involved
- Rollback reason
- Exact timestamp

## Performance Notes

### Timeline Loading
- First 20 versions load immediately
- Pagination loads more on demand
- Timestamps formatted client-side
- No heavy computations

### Comparison
- Calculated server-side for accuracy
- Returns only differences (not full configs)
- Handles large configurations efficiently
- Shows change summary

### Responsiveness
- Page is responsive to all screen sizes
- Mobile optimized layout
- Touch-friendly buttons
- Fast scroll and navigation

## Related Features

### Phase 5.2 - Configuration Editing
- Make changes: `/admin/config-editors`
- Changes appear in history automatically
- Edit then view history to see changes

### Phase 5.3a - Templates & Scheduling
- Use history to create templates
- Compare versions before scheduling
- View scheduled changes alongside history

### Phase 5.3c - Search & Analytics
- Search through history entries
- Find changes by field, user, date
- Analytics dashboard shows trends

## FAQ

**Q: Can I permanently delete a version from history?**
A: No. History is immutable for audit compliance. Old versions stay forever.

**Q: Can I rollback to a rollback?**
A: Yes. Each rollback is recorded as a new version, so you can roll it back too.

**Q: Does rollback affect other entities?**
A: No. Rollback only affects the selected entity.

**Q: Is rollback instant?**
A: Yes. Configuration is restored immediately.

**Q: Can I undo a rollback?**
A: Yes. The previous configuration is saved as a new version, so you can rollback to it.

**Q: Who can see the history?**
A: Super-admins see all history. DAO admins see their DAO's history.

**Q: Is history retained forever?**
A: Yes, currently all history is kept forever. Retention policies may change in future phases.

**Q: Can I export history?**
A: Not currently. Phase 5.3c will add export capabilities.

## Support

Need help? Check:
1. This guide's Troubleshooting section
2. Full documentation: `ADMIN_SYSTEM_PHASE_5_3b_HISTORY_ROLLBACK.md`
3. API reference: `ADMIN_SYSTEM_PHASE_5_3_API_REFERENCE.md`
4. Admin dashboard help icon

---

**Phase 5.3b Complete** ✅  
**Last Updated**: January 2024
