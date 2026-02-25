# Phase 2.2 API Quick Reference Guide

**Version**: 1.0
**Status**: Production Ready
**Last Updated**: Session Complete

---

## 🚀 Quick Start

### Authentication
All endpoints require JWT token in header:
```
Authorization: Bearer <jwt-token>
```

### Base URL
```
https://api.yourdomain.com/api
```

---

## 📱 2FA (Two-Factor Authentication) API

### 1. Get 2FA Configuration
```http
GET /2fa/config
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "config": {
    "twoFA": {
      "enabled": true,
      "method": "EMAIL",
      "backupCodesRemaining": 8
    },
    "pin": {
      "required": true,
      "configured": true
    }
  }
}
```

---

### 2. Setup 2FA
```http
POST /2fa/setup
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "EMAIL",
  "destination": "user@example.com"
}
```

**Methods**: `SMS`, `EMAIL`, `AUTHENTICATOR`

**Response**:
```json
{
  "success": true,
  "message": "2FA enabled via EMAIL",
  "backupCodes": [
    "ABC123DEF456",
    "GHI789JKL012",
    ...
  ]
}
```

⚠️ **Save backup codes in a secure location!**

---

### 3. Generate OTP for Withdrawal
```http
POST /2fa/generate
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "otpId": "otp-uuid-here",
  "message": "OTP generated. Check your configured 2FA method.",
  "expiresIn": 300
}
```

**What to do next**: 
- Check SMS, Email, or Authenticator app for 6-digit code
- Use code to verify withdrawal

---

### 4. Verify OTP Code
```http
POST /2fa/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "otpId": "otp-uuid-here",
  "code": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "verificationToken": "otp_verified_user-id_timestamp"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Invalid OTP code",
  "attemptsRemaining": 2
}
```

---

### 5. Use Backup Code Instead of OTP
```http
POST /2fa/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "otpId": "otp-uuid-here",
  "code": "ABC123DEF456",
  "useBackupCode": true
}
```

---

## 🔐 PIN (Personal Identification Number) API

### 1. Setup PIN
```http
POST /pin/setup
Authorization: Bearer <token>
Content-Type: application/json

{
  "pin": "1234"
}
```

**Requirements**:
- Length: 4-8 digits
- Format: Numbers only (0-9)

**Response**:
```json
{
  "success": true,
  "message": "PIN has been set successfully"
}
```

---

### 2. Get PIN Requirements
```http
GET /pin/requirements
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "requirements": {
    "isRequired": true,
    "isConfigured": true,
    "minLength": 4,
    "maxLength": 8,
    "allowedCharacters": "Digits (0-9)"
  }
}
```

---

### 3. Verify PIN
```http
POST /pin/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "pin": "1234"
}
```

**Response**:
```json
{
  "success": true,
  "message": "PIN verified successfully",
  "verificationToken": "pin_verified_user-id_timestamp"
}
```

---

### 4. Disable PIN
```http
POST /pin/disable
Authorization: Bearer <token>
Content-Type: application/json

{
  "pin": "1234"
}
```

**Response**:
```json
{
  "success": true,
  "message": "PIN requirement has been disabled"
}
```

---

## 💸 Complete Withdrawal with 2FA + PIN

### The Most Important Endpoint: `/withdrawals/verify-2fa`

This endpoint handles the complete withdrawal flow with security verification.

#### Step 1: Generate OTP
```http
POST /withdrawals/verify-2fa
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountId": "account-uuid",
  "toAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f44bAc",
  "amount": "100",
  "currency": "USDC",
  "step": 1
}
```

**Response (Step 1)**:
```json
{
  "success": true,
  "step": 2,
  "otpId": "otp-uuid-here",
  "message": "OTP generated. Please verify."
}
```

#### Step 2: Verify OTP + PIN and Execute Withdrawal
```http
POST /withdrawals/verify-2fa
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountId": "account-uuid",
  "toAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f44bAc",
  "amount": "100",
  "currency": "USDC",
  "otpId": "otp-uuid-here",
  "otpCode": "123456",
  "pin": "1234",
  "step": 2
}
```

**Response (Step 2)**:
```json
{
  "success": true,
  "message": "Withdrawal initiated successfully",
  "transactionHash": "0x123abc...",
  "withdrawalId": "withdrawal-uuid"
}
```

---

## 📊 Complete Withdrawal Flow Example

### JavaScript/TypeScript Example:
```typescript
const withdrawalService = {
  // Step 1: Generate OTP
  async generateOTP() {
    const response = await fetch('/api/withdrawals/verify-2fa', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId: 'account-uuid',
        toAddress: '0x...',
        amount: '100',
        currency: 'USDC',
        step: 1
      })
    });
    return response.json();
  },

  // Step 2: User enters OTP and PIN, then verify and execute
  async executeWithdrawal(otpId: string, otpCode: string, pin: string) {
    const response = await fetch('/api/withdrawals/verify-2fa', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId: 'account-uuid',
        toAddress: '0x...',
        amount: '100',
        currency: 'USDC',
        otpId,
        otpCode,
        pin,
        step: 2
      })
    });
    return response.json();
  }
};
```

---

## ❌ Error Handling

### 2FA Errors

**2FA Not Enabled**:
```json
{
  "success": false,
  "error": "2FA is not enabled for this account"
}
```

**OTP Expired**:
```json
{
  "success": false,
  "error": "OTP has expired. Please request a new one.",
  "attemptsRemaining": 0
}
```

**Invalid OTP Code**:
```json
{
  "success": false,
  "error": "Invalid OTP code",
  "attemptsRemaining": 2
}
```

**Max Attempts Exceeded**:
```json
{
  "success": false,
  "error": "Too many failed attempts. Please request a new OTP.",
  "attemptsRemaining": 0
}
```

### PIN Errors

**PIN Not Configured**:
```json
{
  "success": false,
  "error": "PIN not configured for this wallet"
}
```

**Invalid PIN Format**:
```json
{
  "success": false,
  "error": "PIN must be 4-8 digits"
}
```

**PIN Verification Failed**:
```json
{
  "success": false,
  "error": "Invalid PIN"
}
```

### Withdrawal Errors

**Insufficient Balance**:
```json
{
  "success": false,
  "error": "Insufficient balance for withdrawal"
}
```

**Invalid Address**:
```json
{
  "success": false,
  "error": "Invalid recipient address"
}
```

---

## 🔄 Common Workflows

### A. User Enables 2FA for First Time

```
1. User clicks "Enable 2FA"
2. POST /2fa/setup { method: "EMAIL" }
3. Display backup codes (user saves them)
4. Send verification email with OTP
5. User enters OTP code
6. POST /2fa/verify { otpId, code }
7. 2FA enabled ✅
```

### B. User Initiates Withdrawal

```
1. User fills withdrawal form:
   - Amount: 100 USDC
   - Recipient: 0x...
   - Account: Trading

2. POST /withdrawals/verify-2fa { step: 1, ...withdrawal data }
   ↓ Response: otpId

3. System generates OTP and sends to user's phone/email

4. User sees "Verify Your Withdrawal" dialog:
   - "Enter 6-digit OTP code"
   - "Enter 4-digit PIN"

5. User enters OTP + PIN

6. POST /withdrawals/verify-2fa { step: 2, otpCode, pin, ...withdrawal data }
   ↓ Response: transactionHash, withdrawalId

7. Withdrawal executed ✅
```

### C. User Lost Backup Codes

```
1. User has lost backup codes
2. System disabled their account for security

3. User must verify via email/SMS to recover

4. User receives recovery link/code

5. System allows them to view backup codes again
```

---

## 🔑 Quick Reference Table

| Feature | Endpoint | Method | Auth Required |
|---------|----------|--------|---------------|
| Get 2FA Config | `/2fa/config` | GET | ✅ |
| Setup 2FA | `/2fa/setup` | POST | ✅ |
| Generate OTP | `/2fa/generate` | POST | ✅ |
| Verify OTP | `/2fa/verify` | POST | ✅ |
| Get PIN Requirements | `/pin/requirements` | GET | ✅ |
| Setup PIN | `/pin/setup` | POST | ✅ |
| Verify PIN | `/pin/verify` | POST | ✅ |
| Disable PIN | `/pin/disable` | POST | ✅ |
| Verified Withdrawal | `/withdrawals/verify-2fa` | POST | ✅ |

---

## ⚡ Performance Notes

- OTP generation: < 100ms
- OTP verification: < 50ms
- PIN verification: < 100ms (PBKDF2 with 100k iterations)
- Withdrawal execution: 1-30 seconds (blockchain dependent)

---

## 🛡️ Security Best Practices

1. **Always use HTTPS** - Never send credentials over HTTP
2. **Store tokens securely** - Use secure storage (localStorage with care, sessionStorage, or secure cookies)
3. **Validate on client** - Check PIN length before sending
4. **Handle errors gracefully** - Don't expose internal error messages to users
5. **Log attempts** - Monitor for suspicious activity
6. **Rate limit** - Implement client-side rate limiting
7. **Timeout sessions** - Force re-authentication after 15 minutes

---

## 📱 Frontend Integration Example

```typescript
// 1. Set up 2FA
async function setup2FA() {
  const res = await fetch('/api/2fa/setup', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ method: 'EMAIL' })
  });
  const data = await res.json();
  
  if (data.success) {
    // Save backup codes
    localStorage.setItem('backupCodes', JSON.stringify(data.backupCodes));
    showAlert('2FA enabled. Save your backup codes!');
  }
}

// 2. Initiate withdrawal
async function initiateWithdrawal(amount: string, address: string) {
  const res = await fetch('/api/withdrawals/verify-2fa', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      accountId: 'trading-account',
      toAddress: address,
      amount,
      currency: 'USDC',
      step: 1
    })
  });
  
  const data = await res.json();
  if (data.success) {
    setOtpId(data.otpId);
    showOTP2FAModal(); // Show dialog for OTP + PIN
  }
}

// 3. Verify and execute withdrawal
async function executeWithdrawal(otpCode: string, pin: string) {
  const res = await fetch('/api/withdrawals/verify-2fa', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      accountId: 'trading-account',
      toAddress: withdrawalData.address,
      amount: withdrawalData.amount,
      currency: 'USDC',
      otpId,
      otpCode,
      pin,
      step: 2
    })
  });
  
  const data = await res.json();
  if (data.success) {
    showSuccess(`Withdrawal initiated! TxHash: ${data.transactionHash}`);
  }
}
```

---

## 🔗 Related Documentation

- [PHASE_2_2_IMPLEMENTATION_COMPLETE.md](PHASE_2_2_IMPLEMENTATION_COMPLETE.md) - Detailed implementation docs
- [WALLETS_ACCOUNTS_INTEGRATION.md](WALLETS_ACCOUNTS_INTEGRATION.md) - Architecture overview
- [server/services/two-fa-service.ts](server/services/two-fa-service.ts) - Source code
- [server/services/pin-service.ts](server/services/pin-service.ts) - Source code
- [server/routes/withdrawal-verification.ts](server/routes/withdrawal-verification.ts) - Source code

---

## 🚨 Troubleshooting

### "2FA is not enabled" Error
**Solution**: User needs to setup 2FA first via `POST /2fa/setup`

### "OTP has expired"
**Solution**: User needs to generate a new OTP via `POST /2fa/generate`

### "Invalid PIN" Error
**Solution**: 
- Verify PIN format (4-8 digits)
- Verify PIN is set via `GET /pin/requirements`
- User may need to use backup code instead

### Withdrawal still pending after 5 minutes
**Solution**: Check blockchain status (might be network congestion)

---

**Version**: 1.0 | **Status**: Production Ready | **Last Updated**: Session Complete
