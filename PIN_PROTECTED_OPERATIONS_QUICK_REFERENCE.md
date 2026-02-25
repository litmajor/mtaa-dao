# PIN-Protected Wallet Operations - Quick Reference

## Implementation Summary

All wallet operations now support PIN-based security with amount-based thresholds. Users unlock their wallet with a 4-digit PIN, creating a 24-hour session for subsequent operations.

## Key Features Implemented

### 1. PIN Verification Middleware
- Location: `server/middleware/pin-verification.ts`
- Functions: `requirePINVerification`, `checkAmountThreshold`, `verifyWalletAccess`, `optionalPINVerification`

### 2. Protected Operations

#### ✅ External Operations (Require PIN for amounts > threshold)
| Route | Operation | Threshold | User Type |
|-------|-----------|-----------|-----------|
| POST /api/withdrawals/offramp | Send to payment providers (Stripe, KotaniPay, M-Pesa) | $10,000+ | External address |
| POST /api/withdrawals/external | Send to external wallets | $5,000+ | External address |
| POST /api/withdrawals/micro | Small batched withdrawals | $1,000+ | External address |
| POST /api/transfer | Cross-chain transfers to other users | $5,000+ | Other user address |
| POST /api/tron/transfer | One-step TRON transfer | $5,000+ | External TRON address |

#### ❌ Internal Operations (NO PIN Required)
| Operation | Type | Notes |
|-----------|------|-------|
| Wallet → Trading Account | Internal transfer | Own account |
| Trading → Vault Account | Internal transfer | Own account |
| Vault → Escrow Account | Internal transfer | Own account |
| Any internal balance move | Internal transfer | Own account |

### 3. 4-Account Structure UI
- Location: `client/src/components/wallet/AccountSelector.tsx`
- Features:
  - **Wallet Account** (Blue) - Deposits/withdrawals
  - **Trading Account** (Emerald) - Asset exchanges
  - **Vault Account** (Purple) - Locked savings
  - **Escrow Account** (Orange) - Secure deals

## How Users Interact

### Workflow 1: Unlock Wallet
```
1. Navigate to /wallet
2. Click "Unlock Wallet" button
3. Enter 4-digit PIN
4. Session created for 24 hours
5. Operations now protected by PIN
```

### Workflow 2: Perform Protected Operation
```
1. User unlocked wallet (session active)
2. Initiate withdrawal/transfer/swap
3. Amount < threshold → Proceed immediately
4. Amount > threshold → PIN verification required
5. Operation executed
```

### Workflow 3: Switch Accounts
```
1. Navigate to "Your Accounts" section
2. Click account type tab (Wallet/Trading/Vault/Escrow)
3. Select specific account
4. View balance and perform account-specific operations
```

## Code Examples

### Using PIN-Protected Endpoints
```javascript
// Frontend: POST request with PIN session
fetch('/api/withdrawals/external', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'x-wallet-session': sessionToken,  // Required for PIN verification
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fromAccountId: 'account-123',
    toAddress: '0x...',
    amount: '5000'
  })
});
```

### Accessing Account Data
```javascript
// Frontend: Get user accounts
fetch('/api/accounts', {
  headers: {
    'Authorization': `Bearer ${authToken}`
  }
})
.then(r => r.json())
.then(data => {
  const walletAccounts = data.filter(a => a.type === 'wallet');
  const tradingAccounts = data.filter(a => a.type === 'trading');
  // etc.
});
```

### Using AccountSelector Component
```tsx
import AccountSelector from '@/components/wallet/AccountSelector';

<AccountSelector 
  selectedAccountId={selectedAccountId}
  onAccountSelect={(account) => {
    setSelectedAccountId(account.id);
    setSelectedAccount(account);
    // Perform operations on selected account
  }}
/>
```

## Security Details

### PIN Session
- **Duration**: 24 hours
- **Storage**: sessionStorage (browser, cleared on close)
- **Token**: 32-byte random hex (unique per device)
- **Verification**: Checked on every protected operation

### Amount Thresholds
- Configurable per operation type
- Bypass PIN for small transactions
- Require PIN for high-value operations
- Logged for audit trail

### Multi-Device Support
- Each device gets independent session
- Session token device-specific
- IP tracking for security monitoring
- No cross-device session sharing

## Deployment Steps

### 1. Backend Deployment
```bash
# Ensure server files are updated:
# - server/middleware/pin-verification.ts (NEW)
# - server/routes/withdrawals.ts (UPDATED)
# - server/routes/transfers.ts (UPDATED)
# - server/routes/modules/swap-routes.ts (UPDATED)

npm run build:server
npm run deploy:server
```

### 2. Database Migration
```bash
# Update database schema if needed:
npm run migrate

# Verify walletSessions table exists:
SELECT * FROM wallet_sessions LIMIT 1;
```

### 3. Frontend Deployment
```bash
# Ensure client files are updated:
# - client/src/components/wallet/AccountSelector.tsx (NEW)
# - client/src/pages/wallet.tsx (UPDATED)

npm run build:client
npm run deploy:client
```

### 4. Verification
```bash
# Test PIN endpoint
curl -X POST http://localhost:3000/api/wallet-sessions/connect \
  -H "Content-Type: application/json" \
  -d '{"walletId":"test","pin":"1234"}'

# Test protected endpoint
curl -X POST http://localhost:3000/api/transfers \
  -H "Authorization: Bearer <token>" \
  -H "x-wallet-session: <session-token>" \
  -H "Content-Type: application/json" \
  -d '{"fromAccountId":"...","toAccountId":"...","amount":"100"}'
```

## Troubleshooting

### Session Issues
```
Problem: "Session token required"
Solution: Ensure x-wallet-session header is included in request

Problem: "Session expired"
Solution: User must unlock wallet again (navigate to wallet page)

Problem: "Invalid session token"
Solution: Clear sessionStorage and unlock wallet again
```

### Operation Issues
```
Problem: "PIN verification required" (unexpectedly)
Solution: Verify amount exceeds threshold and session is active

Problem: "Account not found"
Solution: Verify accountId is valid UUID and belongs to user

Problem: AccountSelector shows no accounts
Solution: Check /api/accounts endpoint returns user's accounts
```

## Monitoring

### Key Metrics
- PIN unlock attempts per user
- High-value operation frequency
- Session expiry rate
- Failed PIN verification rate
- Account switch frequency

### Log Events
- PIN verification attempts
- Session creation/termination
- Protected operation execution
- Amount threshold exceeding
- Session timeout warnings

## FAQ

**Q: How long does a PIN session last?**  
A: 24 hours from creation. User must unlock wallet again after expiry.

**Q: Can users bypass PIN for small transactions?**  
A: Yes, amounts below threshold are allowed without PIN. Thresholds vary by operation.

**Q: Are PIN sessions shared across devices?**  
A: No, each device has independent session token stored in sessionStorage.

**Q: What happens when user closes browser?**  
A: Session token cleared from sessionStorage. User must unlock wallet again.

**Q: Can admins see user PINs?**  
A: No, PINs are hashed with PBKDF2 (100k iterations) and never stored in plain text.

**Q: How are accounts selected for operations?**  
A: Users select account type via AccountSelector, then specific account, then operation uses that account.

**Q: What's the difference between account types?**  
A: Wallet=deposits/withdrawals, Trading=exchanges, Vault=savings, Escrow=deals.

## Quick Links

- [Full Implementation Guide](PIN_PROTECTED_OPERATIONS_COMPLETE.md)
- [Wallet Session Guide](WALLET_SESSION_COMPLETE_SUMMARY.md)
- [API Reference](API_ENDPOINTS_BOT_ENGINE_COMPLETE.md)
- [Account Architecture](WALLET_ARCHITECTURE_COMPLETE.md)

## Support

For implementation questions:
1. Check code comments in middleware and components
2. Review test scenarios in full guide
3. Check existing tests in test suite
4. Contact development team

---

**Version**: 1.0  
**Last Updated**: January 15, 2026  
**Status**: ✅ Production Ready
