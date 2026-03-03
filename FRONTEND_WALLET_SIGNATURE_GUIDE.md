# Frontend Update Guide - Phase 1 Wallet Signature Integration

**Date:** March 1, 2026  
**Status:** ✅ IMPLEMENTED  
**Breaking Change:** YES - Wallet transactions now require user signature

---

## 🔐 What Changed

### Before (INSECURE)
```typescript
// Any authenticated user could send crypto from any wallet
await fetch('/api/wallets/{id}/send', {
  method: 'POST',
  body: JSON.stringify({
    toAddress: '0x...',
    amount: '100',
    tokenSymbol: 'USDC'
  })
});
// ❌ VULNERABILITY: No proof of wallet ownership
```

### After (SECURE)
```typescript
// User must sign with their wallet to prove ownership
const signer = await provider.getSigner();
const signature = await signer.signMessage(message);

await fetch('/api/wallets/{id}/send', {
  method: 'POST',
  body: JSON.stringify({
    toAddress: '0x...',
    amount: '100',
    tokenSymbol: 'USDC',
    walletAddress: '0x...',  // User's address
    signature: '0x...',        // EIP-191 signed proof
    nonce: 12345              // Replay protection
  })
});
// ✅ SECURE: Proven wallet ownership required
```

---

## 📝 Files Updated

| File | Changes | Impact |
|------|---------|--------|
| `frontend/api/index.ts` | Added ethers import, signature helpers, updated submitTransaction function | MAJOR |
| `frontend/hooks/useSendFlow.ts` | Added walletId and tokenSymbol parameters | MAJOR |

---

## 🚀 How to Use (For Frontend Developers)

### 1. Basic Transaction Flow

```typescript
import { useSendFlow } from '@/hooks/useSendFlow';

function SendPage() {
  const { submitTransaction } = useSendFlow();

  const handleSend = async () => {
    try {
      const result = await submitTransaction({
        walletId: 'wallet_123',           // From wallet connection
        recipientAddress: '0x...',        // Recipient crypto address
        amount: 100,                      // Amount to send
        tokenSymbol: 'USDC',              // Token type
        recipientName: 'Alice'            // Display name
      });

      console.log('Transaction queued:', result.queueId);
      // Show success to user
    } catch (error) {
      console.error('Transaction failed:', error.message);
      // Show error to user
    }
  };

  return (
    <button onClick={handleSend}>
      Send Crypto
    </button>
  );
}
```

### 2. What User Will See

When they click "Send Crypto":
1. **Wallet Popup** → "Sign this message with your wallet"
2. User clicks "Sign" in MetaMask / Wallet
3. **Backend verifies** the signature matches their wallet address
4. ✅ Transaction queued successfully

If they **reject** the signature:
```
Error: "You must sign the transaction with your wallet to proceed"
```

**Why we require the signature:**
- ✅ Proves they own the wallet (only they can sign)
- ✅ Prevents attackers from sending funds from their wallets
- ✅ Prevents replay attacks (nonce + timestamp in message)

---

## 🔍 Technical Details

### EIP-191 Message Format

The message signed by the user includes:
```
Send 100 USDC to 0xabcd...ef01
Wallet: 0x1234...5678
Nonce: 567890
Timestamp: 1709283456000
```

**Why these details matter:**
- **Amount & Token:** Can't be modified after signing
- **Recipient:** Can't be changed to someone else
- **Nonce:** Prevents using same signature twice (replay protection)
- **Timestamp:** Shows when the signature was created

### Signature Verification Flow

```
Frontend                          Backend
  │                                 │
  ├─ Get wallet address             │
  ├─ Generate message               │
  ├─ User signs message             │
  │     (MetaMask popup)             │
  │                                 │
  ├─ Send signature + walletAddr ───┤
  │                                 ├─ Verify signature
  │                                 ├─ Check it matches address
  │                                 ├─ Check nonce not reused
  │                                 │
  │                 Queue transaction ─┤
  │◄─ Return queueId                │
  │                                 │
```

---

## 🚨 Error Handling

### Common Errors

```typescript
try {
  await submitTransaction(data);
} catch (error) {
  if (error.message.includes('Web3 wallet not detected')) {
    // User doesn't have MetaMask installed
    showError('Please install MetaMask or other Web3 wallet');
  } else if (error.message.includes('User rejected')) {
    // User clicked "Reject" in wallet
    showError('Transaction cancelled. Please try again.');
  } else if (error.message.includes('signature')) {
    // Signature verification failed on backend
    showError('Wallet signature verification failed');
  } else {
    // Generic error
    showError(error.message);
  }
}
```

### User-Friendly Error Messages

| Error | Cause | User Message |
|-------|-------|--------------|
| Web3 not detected | No wallet extension | "Please install MetaMask or other Web3 wallet" |
| User rejected | They clicked reject in wallet | "Transaction cancelled. Please try again." |
| Signature verification failed | Something went wrong | "Wallet signature verification failed. Try again." |
| Invalid nonce | Signature was reused | "Transaction expired. Please create a new one." |

---

## 💻 Example: Complete Send Component

```typescript
import React, { useState } from 'react';
import { useSendFlow } from '@/hooks/useSendFlow';
import { submitTransaction } from '@/api';

export function SendCryptoFlow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form fields
  const [walletId, setWalletId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('USDC');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // PHASE 1: This will prompt user to sign with wallet
      const result = await submitTransaction(
        walletId,
        recipient,
        amount,
        tokenSymbol
      );

      setSuccess(true);
      console.log('Transaction queued:', result.queueId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="success-box">
        <h2>✅ Transaction Submitted</h2>
        <p>Please check your transaction history for status</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Wallet</label>
        <select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
          <option>Select wallet...</option>
          {/* List user's wallets */}
        </select>
      </div>

      <div>
        <label>Recipient Address</label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          required
        />
      </div>

      <div>
        <label>Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>

      <div>
        <label>Token</label>
        <select value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)}>
          <option>USDC</option>
          <option>USDT</option>
          <option>ETH</option>
          <option>CELO</option>
        </select>
      </div>

      {error && <div className="error-box">{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Signing...' : 'Send Crypto'}
      </button>
    </form>
  );
}
```

---

## 🧪 Testing Checklist

### Local Testing
- [ ] Install MetaMask or similar Web3 wallet
- [ ] Connect wallet to test network
- [ ] Try to send transaction
- [ ] Verify MetaMask signature popup appears
- [ ] Sign the transaction
- [ ] Verify backend accepts the signature
- [ ] Check transaction is queued

### Error Testing
- [ ] Close/reject the signature popup → Should show error
- [ ] Try with different wallet → Should fail (signature won't match)
- [ ] Try same signature twice → Should fail (nonce replay protection)

### Browser Console
```javascript
// You should see:
[SECURITY] Requesting wallet signature for transaction...
[SECURITY] Transaction signed by wallet
[SECURITY] Transaction queued: queue_abc123
```

---

## 📦 Dependencies

Make sure your project has these installed:

```bash
npm install ethers
```

**Note:** If using ethers v6, use the named import:
```typescript
import { BrowserProvider } from 'ethers';  // ✅ Correct for v6
// NOT: import { ethers } from 'ethers';   // ❌ Old way
```

---

## 🔄 Migration from Old Code

### If You Have Old Code Like This:

```typescript
// OLD CODE - NO LONGER WORKS
const response = await fetch('/api/wallets/123/send', {
  method: 'POST',
  body: JSON.stringify({
    toAddress: recipient,
    amount: amount
  })
});
```

### Update To This:

```typescript
// NEW CODE - REQUIRES SIGNATURE
import { submitTransaction } from '@/api';

await submitTransaction(
  walletId,        // wallet connection ID
  recipient,       // 0x... recipient address
  amount.toString(),
  'USDC',          // token symbol
  'Alice'          // optional recipient name
);
```

---

## 🆘 Troubleshooting

### Issue: "Web3 wallet not detected"
**Cause:** User doesn't have MetaMask or crypto wallet extension  
**Fix:** Ask user to install MetaMask: https://metamask.io

### Issue: User rejects signature popup
**Cause:** User clicked "Reject" in MetaMask  
**Fix:** Transaction cancelled. User can try again.

### Issue: "Wallet signature verification failed"
**Cause:** Backend couldn't verify the signature matched the wallet  
**Fix:** User should try again (might be network issue)

### Issue: "Invalid nonce"
**Cause:** Generated nonce doesn't match backend's expected nonce  
**Fix:** This shouldn't happen - contact engineering team

---

## 📚 References

- **EIP-191:** Personal Sign Message Standard
  - https://eips.ethereum.org/EIPS/eip-191
- **ethers.js:** Signature & Signer Documentation
  - https://docs.ethers.org/v6/api/providers/#Signer
- **MetaMask:** signMessage Documentation
  - https://docs.metamask.io/guide/signing-data.html

---

## ✅ Validation

All frontend changes have been implemented:
- ✅ Ethers.js imported for signature verification
- ✅ `submitTransaction` updated to use wallet signatures
- ✅ `useSendFlow` hook updated with walletId parameter
- ✅ Proper error handling for signature rejection
- ✅ Nonce-based replay attack prevention

**Status:** Ready for testing with backend Phase 1 fixes

---

**Questions?** Check the comments in:
- `frontend/api/index.ts` - API implementation
- `frontend/hooks/useSendFlow.ts` - Hook implementation
