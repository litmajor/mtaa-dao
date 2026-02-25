# PRIORITY 1 TESTING GUIDE

**Goal**: Verify wallet requirement enforcement works correctly

---

## 🧪 Test 1: UI Wallet Gate (No Wallet Connected)

### Setup
- Open browser console
- Clear localStorage/sessionStorage to start fresh
- Navigate to `http://localhost:3000/vault`

### Expected Behavior
1. **NOT connected**: Page shows wallet connection prompt (NOT vault content)
2. Click "Connect Wallet" button
3. Select MetaMask from options
4. **AFTER connection**: See blue banner "Your wallet is connected"
5. Try to open "Create Vault" modal → **Modal should open** (wallet is now connected)

### Test Result
- [ ] Page shows connection prompt initially
- [ ] After connection, banner confirms wallet connected
- [ ] Create Vault modal opens without error
- [ ] Vault creation form renders normally

---

## 🧪 Test 2: UI Wallet Gate (Create Vault Without Wallet)

### Setup
- Disconnect wallet (click disconnect in MetaMask or clear session)
- Navigate to `/vault` page

### Expected Behavior
1. **NOT connected**: See "Connect Wallet" prompt
2. Try clicking "Create New Vault" button
3. VaultCreationWizard opens but...
4. **Should see RED error box** instead of form
5. Error says: "Wallet connection required"
6. Step-by-step instructions to connect wallet

### Test Result
- [ ] Red error card shows when wizard opens without wallet
- [ ] Error message is clear and actionable
- [ ] "Go to Wallet Page" button navigates to /wallet
- [ ] NO form inputs visible (error prevents interaction)

---

## 🧪 Test 3: UI Wallet Gate (No Balance)

### Setup
- Connect wallet with **0 balance** (use test account with no funds)
- Open VaultCreationWizard
- Check what happens

### Expected Behavior
1. Wallet IS connected (has address)
2. BUT balance is 0
3. **Should show error**: "No balance in CELO. Add funds to pay for vault deployment"
4. Cannot proceed
5. Add funds → Error disappears, form shows

### Test Result
- [ ] Error shows when wallet has 0 balance
- [ ] Error clears when balance is added
- [ ] User prevented from creating vault with no gas

---

## 🧪 Test 4: Backend Wallet Validation (Create Vault API)

### Setup
- Get auth token for test user
- User DOES NOT have wallet connected
- Call vault creation API

### Test Command
```bash
# Replace YOUR_TOKEN with actual auth token
curl -X POST http://localhost:3000/api/vaults \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Vault",
    "description": "Testing wallet requirement",
    "primaryCurrency": "cUSD",
    "vaultType": "regular"
  }'
```

### Expected Response
```json
{
  "error": "Wallet connection required. Please connect your wallet (MetaMask, WalletConnect, or Minipay) from the Wallet page before creating a vault.",
  "code": "WALLET_VALIDATION_ERROR"
}
```

### Test Result
- [ ] API returns 400 error
- [ ] Error message mentions wallet requirement
- [ ] Error is actionable (tells user to go to Wallet page)

---

## 🧪 Test 5: Backend Wallet Validation (Deposit API)

### Setup
- Get auth token for test user WITHOUT wallet
- Have vault address (or use test vault address)

### Test Command
```bash
curl -X POST http://localhost:3000/api/vaults/deposit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vaultAddress": "0x1234567890123456789012345678901234567890",
    "amount": "100",
    "currency": "cUSD"
  }'
```

### Expected Response
```json
{
  "error": "Wallet connection required",
  "code": "NO_WALLET",
  "message": "Please connect a wallet before accessing vaults. Use MetaMask, WalletConnect, or Minipay from the Wallet page.",
  "action": "Go to Wallet page and click Connect Wallet"
}
```

### Test Result
- [ ] API returns 400 (not 500)
- [ ] Error code is "NO_WALLET"
- [ ] Message is clear
- [ ] Action guidance provided

---

## 🧪 Test 6: Successful Flow (With Wallet)

### Setup
- Connect wallet with funds
- Have vault creation data ready

### Step 1: Create Vault via UI
1. Navigate to `/vault`
2. See blue banner: "Your wallet is connected"
3. Click "Create Vault" button
4. **Red error should NOT appear**
5. Form renders normally
6. Fill vault details:
   - Name: "Test Vault"
   - Type: "regular"
   - Currency: "cUSD"
   - Min deposit: "10"
   - Max deposit: "1000000"
7. Click through steps 1-4
8. At step 4, click "Create Vault"
9. Confirm in dialog
10. **Vault should be created successfully**

### Step 2: Verify Success
- [ ] No error messages shown
- [ ] Vault appears in list
- [ ] User can see vault address
- [ ] Can deposit to vault

---

## 🧪 Test 7: Withdraw with Wallet Gate

### Setup
- Connect wallet with funds
- Have existing vault with balance

### Test Command
```bash
curl -X POST http://localhost:3000/api/vaults/withdraw \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vaultAddress": "0x1234567890123456789012345678901234567890",
    "amount": "50",
    "currency": "cUSD",
    "destination": "0xYourAddress"
  }'
```

### Expected Behavior
1. Wallet IS connected → proceeds normally
2. Wallet NOT connected → returns "NO_WALLET" error

### Test Result
- [ ] User WITH wallet can withdraw
- [ ] User WITHOUT wallet gets clear error
- [ ] Error message guides to wallet connection

---

## 🧪 Test 8: DAO Vault (No Wallet Required)

### Setup
- Have DAO ID for test DAO
- NOT logged in as DAO member (or no wallet)

### Test Command
```bash
# Create DAO vault (uses daoId, not userId)
curl -X POST http://localhost:3000/api/vaults \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DAO Treasury",
    "description": "Community fund",
    "primaryCurrency": "cUSD",
    "vaultType": "dao_treasury",
    "daoId": "test-dao-123"
  }'
```

### Expected Behavior
- DAO vault creation works **WITHOUT wallet requirement**
- Backend allows because it's a DAO vault (daoId, not userId)

### Test Result
- [ ] DAO vault created successfully (no wallet needed)
- [ ] Personal vault requires wallet (userId only)

---

## 📋 Success Checklist

- [ ] Test 1: UI renders correctly with/without wallet
- [ ] Test 2: Wallet gate shows error when not connected
- [ ] Test 3: Balance check prevents vault creation with 0 balance
- [ ] Test 4: Create vault API rejects without wallet
- [ ] Test 5: Deposit API rejects without wallet
- [ ] Test 6: Complete flow succeeds with wallet
- [ ] Test 7: Withdraw requires wallet
- [ ] Test 8: DAO vaults don't require wallet

---

## 🐛 Debugging Tips

### If VaultCreationWizard error doesn't show:
1. Check browser console for errors
2. Verify `useEffect` hook is running:
   ```javascript
   // In browser console while modal open
   console.log(document.querySelector('[role="dialog"]')?.textContent)
   ```
3. Verify `useAccount()` returns `isConnected: false`

### If API returns 500 instead of 400:
1. Check server logs for middleware error
2. Verify import path: `import { requireConnectedWallet } from '../middleware/walletValidation'`
3. Check users table has `walletAddress` column

### If wallet validation passes incorrectly:
1. Check database: do the test users have walletAddress populated?
   ```sql
   SELECT id, wallet_address FROM users LIMIT 5;
   ```
2. If empty, connect wallet and verify walletAddress saved

### If balance check doesn't work:
1. Verify useBalance hook returns correct balance
2. Check if balance.value is 0n (bigint zero)
3. Test with actual MetaMask account (not test account)

---

## 📊 Expected Error Codes

| Scenario | Code | Status | Message |
|----------|------|--------|---------|
| No auth | NO_AUTH | 401 | "Please log in first" |
| No wallet | NO_WALLET | 400 | "Please connect a wallet..." |
| Invalid wallet | INVALID_WALLET | 400 | "Reconnect your wallet..." |
| Validation error | WALLET_VALIDATION_ERROR | 500 | "An error occurred..." |
| Create vault, no wallet | WALLET_VALIDATION_ERROR | 400 | "Wallet connection required..." |

---

## ✅ After All Tests Pass

1. Create PR with changes
2. Assign to team for review
3. Merge when approved
4. Deploy to staging for QA
5. Get sign-off from product team
6. Deploy to production

---

**Status**: Ready for testing! 🎉
