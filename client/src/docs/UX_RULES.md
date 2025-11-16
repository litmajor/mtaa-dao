
# MtaaDAO UX Rules & Implementation Guide

## Core UX Principles

### 1. Users see 20%, superusers see 100%
- Default view: Simple, essential information only
- Advanced view: Behind "Advanced Settings" or "See Details"
- Technical metrics: Only in admin/developer dashboards

### 2. No Technical Terms - Ever
Replace all technical jargon with plain language:

| ❌ Technical | ✅ User-Friendly |
|-------------|-----------------|
| Vault | Savings Account / Group Fund |
| Investment Pool | Invest Together |
| DAO | Group / Community |
| Governance Proposal | Group Decision |
| Vote Delegation | Let someone vote for me |
| Quorum | Minimum voters needed |
| NAV | Current Value |
| Rebalancing | Adjusting investments |
| Gas Fees | Transaction Fee |
| Smart Contract | Secure Agreement |
| Token | Coin / Share |

### 3. One Thing Per Screen
- Each page has ONE primary action
- Secondary actions go in menus or "More" buttons
- Never overwhelm with choices

### 4. No Empty States Without Action
- Bad: "No proposals yet"
- Good: "No decisions yet. [Create the first one]"
- Always tell users what to do next

### 5. Money Always in Local Currency First
- Primary: "KES 124,700" or "$1,247"
- Secondary: "(0.5 ETH)" - optional, smaller text
- Let users pick their preferred currency in settings

### 6. Errors Explain What TO DO
- Bad: "Transaction failed: insufficient gas"
- Good: "Not enough money for fees. Add KES 200 more."
- Always provide actionable next steps

### 7. Every Number Needs Context
- Bad: "APY: 12.5%"
- Good: "Your KES 10,000 becomes KES 11,250 in one year"
- Show what it means for THEM

### 8. One Primary Action Per Screen
- One big, obvious button
- Other actions are secondary (smaller, outline style)
- Bottom of screen for mobile thumb access

### 9. Celebrate Wins, Hide Losses
- Show: "You earned KES 2,300 this week! 🎉"
- Don't show: "Market crashed -15% today"
- Keep it positive; power users can dig for details

### 10. Mobile Thumb-Friendly
- All buttons minimum 48x48px
- Primary actions at bottom of screen
- No tiny links or small text
- Test with actual thumb reach

### 11. Progressive Disclosure
- Show basics first
- "See more" / "Advanced" for details
- Don't dump all information at once

### 12. Trust Before Commitment
- Let them explore without account
- Show examples/success stories first
- Ask for money/permissions LAST

## Implementation Checklist

For EVERY screen, verify:
- [ ] Can my mom understand without my help?
- [ ] Is there exactly ONE obvious thing to do?
- [ ] Are technical terms replaced with plain language?
- [ ] If empty, is there a clear action button?
- [ ] Are amounts in local currency (KES/USD)?
- [ ] Can I tap all buttons with my thumb easily?
- [ ] Does this make the user feel smart and safe?

## Mobile-First Design Patterns

### Button Hierarchy
```tsx
// Primary action (bottom, full width)
<Button size="lg" className="w-full fixed bottom-20 left-0 right-0">
  Add Money
</Button>

// Secondary actions (smaller, outline)
<Button variant="outline" size="md">
  See History
</Button>
```

### Money Display
```tsx
// Good
<div className="text-3xl font-bold">KES 124,700</div>
<div className="text-sm text-gray-500">($1,247)</div>

// Also good (user preference)
<div className="text-3xl font-bold">$1,247</div>
<div className="text-sm text-gray-500">(KES 124,700)</div>
```

### Empty States
```tsx
// Good
<EmptyState
  icon={<Wallet className="w-16 h-16 text-gray-300" />}
  title="No groups yet"
  description="Start saving with your friends and family"
  action={
    <Button onClick={() => navigate('/create-group')}>
      Create Your First Group
    </Button>
  }
/>
```

### Error Messages
```tsx
// Good
<Alert variant="error">
  <AlertTitle>Not enough funds</AlertTitle>
  <AlertDescription>
    You need KES 200 more to complete this transaction.
    <Button onClick={() => navigate('/add-money')}>Add Money</Button>
  </AlertDescription>
</Alert>
```

## Notification Strategy

### Good Notifications
✅ "Your group earned KES 4,700 this week! 🎉"
✅ "Jane wants the group to vote on a new investment"
✅ "Your savings goal is 60% complete! 💪"
✅ "2 friends joined your group today"

### Bad Notifications
❌ "NAV updated: 1.0342 → 1.0359"
❌ "Rebalancing job completed successfully"
❌ "Gateway Agent detected price anomaly"
❌ Any technical jargon

## Trust Signals

Always show:
- ✅ Number of active users/groups
- ✅ Total money safely managed
- ✅ Real testimonials with photos
- ✅ Simple security explanation

Never show:
- ❌ Technical security details
- ❌ Blockchain addresses
- ❌ Smart contract code
- ❌ System architecture

## Accessibility

- Color contrast: 4.5:1 minimum
- Touch targets: 48x48px minimum
- Font size: 16px base minimum
- Clear focus indicators
- Screen reader support

## Performance

- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Skeleton loaders for async content
- Optimistic UI updates
- Offline support for viewing data
