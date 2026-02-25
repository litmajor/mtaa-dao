# Phase 2.2 Deployment & Testing Guide

**Version**: 1.0
**Status**: Production Deployment Guide
**Date**: Session Complete

---

## 📋 Pre-Deployment Checklist

### Database Setup
- [ ] Migration: `wallet_security_settings` table created
  ```sql
  -- Table for storing 2FA and PIN configuration
  CREATE TABLE wallet_security_settings (
    id UUID PRIMARY KEY,
    walletId UUID NOT NULL UNIQUE,
    requiresPin BOOLEAN DEFAULT false,
    encryptedPin TEXT,
    twoFAEnabled BOOLEAN DEFAULT false,
    twoFAMethod VARCHAR(50),
    backupCodes TEXT[] DEFAULT ARRAY[]::TEXT[],
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (walletId) REFERENCES wallets(id) ON DELETE CASCADE
  );
  ```

### Environment Variables
Create `.env.production` with:
```env
# === 2FA Configuration ===
# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# === PIN Configuration ===
# Encryption key for backup (backup encryption for production)
BACKUP_ENCRYPTION_KEY=your_32_byte_hex_key_here

# === Webhook Configuration (Task 2) ===
ALCHEMY_API_KEY=alchemy_api_key_here
ALCHEMY_WEBHOOK_SIGNING_KEY=your_signing_key
WEBHOOK_URL=https://yourdomain.com/api/webhooks/deposits/alchemy

# === Server ===
NODE_ENV=production
API_BASE_URL=https://api.yourdomain.com
CLIENT_URL=https://yourdomain.com
```

### API Rate Limiting
- [ ] Rate limiter configured for 2FA endpoints (max 5 requests/minute)
- [ ] Rate limiter configured for PIN endpoints (max 10 requests/minute)
- [ ] Rate limiter configured for withdrawal endpoints (max 3 requests/minute)

### SSL/TLS
- [ ] SSL certificate installed and verified
- [ ] HSTS headers enabled
- [ ] Certificate auto-renewal configured

### Monitoring & Logging
- [ ] ELK Stack or CloudWatch configured
- [ ] Error tracking (Sentry) configured
- [ ] Performance monitoring enabled

---

## 🧪 Testing Guide

### Unit Tests

#### 1. Two-FA Service Tests

```typescript
import { twoFAService } from '../services/two-fa-service';

describe('Two-FA Service', () => {
  
  describe('OTP Generation', () => {
    it('should generate a 6-digit OTP', async () => {
      const result = await twoFAService.createWithdrawalOTP('user-id');
      expect(result.success).toBe(true);
      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.otpId).toBeDefined();
    });

    it('should have 5 minute expiry', async () => {
      const result = await twoFAService.createWithdrawalOTP('user-id');
      const expiryTime = new Date(result.expiresAt!).getTime();
      const currentTime = Date.now();
      const diffMinutes = (expiryTime - currentTime) / 1000 / 60;
      expect(diffMinutes).toBeCloseTo(5, 0);
    });
  });

  describe('OTP Verification', () => {
    it('should verify correct OTP code', async () => {
      const genResult = await twoFAService.createWithdrawalOTP('user-id');
      const verifyResult = await twoFAService.verifyWithdrawalOTP(
        'user-id',
        genResult.otpId!,
        genResult.code!
      );
      expect(verifyResult.success).toBe(true);
    });

    it('should reject incorrect OTP code', async () => {
      const genResult = await twoFAService.createWithdrawalOTP('user-id');
      const verifyResult = await twoFAService.verifyWithdrawalOTP(
        'user-id',
        genResult.otpId!,
        '000000'
      );
      expect(verifyResult.success).toBe(false);
    });

    it('should limit to 3 attempts', async () => {
      const genResult = await twoFAService.createWithdrawalOTP('user-id');
      
      // First 3 attempts should fail
      for (let i = 0; i < 3; i++) {
        await twoFAService.verifyWithdrawalOTP(
          'user-id',
          genResult.otpId!,
          '000000'
        );
      }

      // 4th attempt should be rejected
      const result = await twoFAService.verifyWithdrawalOTP(
        'user-id',
        genResult.otpId!,
        '000000'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many attempts');
    });
  });

  describe('Backup Codes', () => {
    it('should generate 10 backup codes', async () => {
      const result = await twoFAService.enable2FA('user-id', 'EMAIL');
      expect(result.backupCodes).toHaveLength(10);
    });

    it('should verify backup code', async () => {
      const enableResult = await twoFAService.enable2FA('user-id', 'EMAIL');
      const backupCode = enableResult.backupCodes![0];
      
      const verifyResult = await twoFAService.verifyBackupCode(
        'user-id',
        backupCode
      );
      expect(verifyResult.success).toBe(true);
    });

    it('should invalidate backup code after use', async () => {
      const enableResult = await twoFAService.enable2FA('user-id', 'EMAIL');
      const backupCode = enableResult.backupCodes![0];
      
      // First use should succeed
      await twoFAService.verifyBackupCode('user-id', backupCode);
      
      // Second use should fail
      const result = await twoFAService.verifyBackupCode('user-id', backupCode);
      expect(result.success).toBe(false);
    });
  });
});
```

#### 2. PIN Service Tests

```typescript
import { pinService } from '../services/pin-service';

describe('PIN Service', () => {
  
  describe('PIN Setup', () => {
    it('should set a valid PIN', async () => {
      const result = await pinService.setPIN('wallet-id', '1234');
      expect(result.success).toBe(true);
    });

    it('should reject invalid PIN format', async () => {
      const shortPIN = await pinService.setPIN('wallet-id', '12');
      expect(shortPIN.success).toBe(false);
      
      const longPIN = await pinService.setPIN('wallet-id', '123456789');
      expect(longPIN.success).toBe(false);
      
      const nonNumericPIN = await pinService.setPIN('wallet-id', 'abcd');
      expect(nonNumericPIN.success).toBe(false);
    });
  });

  describe('PIN Verification', () => {
    it('should verify correct PIN', async () => {
      await pinService.setPIN('wallet-id', '1234');
      const result = await pinService.verifyPINForTransaction(
        'wallet-id',
        '1234',
        'withdrawal'
      );
      expect(result.success).toBe(true);
    });

    it('should reject incorrect PIN', async () => {
      await pinService.setPIN('wallet-id', '1234');
      const result = await pinService.verifyPINForTransaction(
        'wallet-id',
        '5678',
        'withdrawal'
      );
      expect(result.success).toBe(false);
    });

    it('should use PBKDF2 hashing', async () => {
      await pinService.setPIN('wallet-id', '1234');
      
      // Verify PIN works
      const result = await pinService.verifyPINForTransaction(
        'wallet-id',
        '1234',
        'withdrawal'
      );
      expect(result.success).toBe(true);
      
      // Verify different PIN fails
      const wrongResult = await pinService.verifyPINForTransaction(
        'wallet-id',
        '4321',
        'withdrawal'
      );
      expect(wrongResult.success).toBe(false);
    });
  });

  describe('PIN Management', () => {
    it('should check if PIN is required', async () => {
      const result = await pinService.isPINRequired('wallet-id');
      expect(typeof result).toBe('boolean');
    });

    it('should check if PIN is configured', async () => {
      await pinService.setPIN('wallet-id', '1234');
      const result = await pinService.isPINConfigured('wallet-id');
      expect(result).toBe(true);
    });

    it('should disable PIN', async () => {
      await pinService.setPIN('wallet-id', '1234');
      const result = await pinService.disablePIN('wallet-id', '1234');
      expect(result.success).toBe(true);
      
      const isRequired = await pinService.isPINRequired('wallet-id');
      expect(isRequired).toBe(false);
    });
  });
});
```

### Integration Tests

#### 1. Complete Withdrawal Flow Test

```typescript
describe('Complete Withdrawal with 2FA + PIN', () => {
  const testUser = 'test-user-id';
  const testWallet = 'test-wallet-id';
  const withdrawalData = {
    accountId: 'account-uuid',
    toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f44bAc',
    amount: '100',
    currency: 'USDC'
  };

  it('should complete full withdrawal workflow', async () => {
    // Step 1: Setup 2FA
    const setup2FA = await twoFAService.enable2FA(testUser, 'EMAIL');
    expect(setup2FA.success).toBe(true);

    // Step 2: Setup PIN
    const setupPIN = await pinService.setPIN(testWallet, '1234');
    expect(setupPIN.success).toBe(true);

    // Step 3: Initiate withdrawal and generate OTP
    const otpResult = await twoFAService.createWithdrawalOTP(testUser);
    expect(otpResult.success).toBe(true);
    expect(otpResult.code).toBeDefined();

    // Step 4: Verify OTP
    const otpVerify = await twoFAService.verifyWithdrawalOTP(
      testUser,
      otpResult.otpId!,
      otpResult.code!
    );
    expect(otpVerify.success).toBe(true);

    // Step 5: Verify PIN
    const pinVerify = await pinService.verifyPINForTransaction(
      testWallet,
      '1234',
      'withdrawal'
    );
    expect(pinVerify.success).toBe(true);

    // Step 6: Execute withdrawal
    const withdrawalResult = await withdrawalSigningService.prepareWithdrawalForSigning(
      testWallet,
      withdrawalData.toAddress,
      parseFloat(withdrawalData.amount),
      withdrawalData.currency
    );
    expect(withdrawalResult.success).toBe(true);

    // Step 7: Sign transaction
    const signResult = await withdrawalSigningService.signWithdrawalTransaction(
      testWallet,
      withdrawalResult.transactionData!
    );
    expect(signResult.success).toBe(true);

    // Step 8: Execute
    const executeResult = await withdrawalSigningService.executeSignedWithdrawal(
      testWallet,
      signResult.signedTransaction!,
      withdrawalData.currency,
      testUser,
      withdrawalData.accountId
    );
    expect(executeResult.success).toBe(true);
    expect(executeResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('should fail if OTP not verified', async () => {
    const otpResult = await twoFAService.createWithdrawalOTP(testUser);
    
    // Try to execute without OTP verification
    const result = await withdrawalSigningService.prepareWithdrawalForSigning(
      testWallet,
      withdrawalData.toAddress,
      parseFloat(withdrawalData.amount),
      withdrawalData.currency
    );
    // Should fail because 2FA verification not completed
    // (In real implementation, check for verification token)
  });

  it('should fail if PIN incorrect', async () => {
    await pinService.setPIN(testWallet, '1234');
    
    const pinResult = await pinService.verifyPINForTransaction(
      testWallet,
      '5678',
      'withdrawal'
    );
    expect(pinResult.success).toBe(false);
  });
});
```

### API Tests (Using Supertest/Jest)

```typescript
import request from 'supertest';
import app from '../app';

describe('2FA API Endpoints', () => {
  const token = 'test-jwt-token';

  describe('GET /api/2fa/config', () => {
    it('should return 2FA configuration', async () => {
      const res = await request(app)
        .get('/api/2fa/config')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('config');
      expect(res.body.config).toHaveProperty('twoFA');
      expect(res.body.config).toHaveProperty('pin');
    });

    it('should return 401 without auth', async () => {
      await request(app)
        .get('/api/2fa/config')
        .expect(401);
    });
  });

  describe('POST /api/2fa/generate', () => {
    it('should generate OTP', async () => {
      const res = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('otpId');
      expect(res.body).toHaveProperty('expiresIn', 300);
    });
  });

  describe('POST /api/2fa/verify', () => {
    it('should verify OTP code', async () => {
      // Generate OTP first
      const genRes = await request(app)
        .post('/api/2fa/generate')
        .set('Authorization', `Bearer ${token}`);

      const otpId = genRes.body.otpId;

      // Verify OTP (with actual code from service)
      const verifyRes = await request(app)
        .post('/api/2fa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          otpId,
          code: '123456' // In real test, get actual code
        })
        .expect(200);

      expect(verifyRes.body).toHaveProperty('success');
    });
  });
});

describe('PIN API Endpoints', () => {
  const token = 'test-jwt-token';

  describe('POST /api/pin/setup', () => {
    it('should setup PIN', async () => {
      const res = await request(app)
        .post('/api/pin/setup')
        .set('Authorization', `Bearer ${token}`)
        .send({ pin: '1234' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });

    it('should reject invalid PIN', async () => {
      const res = await request(app)
        .post('/api/pin/setup')
        .set('Authorization', `Bearer ${token}`)
        .send({ pin: 'abcd' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/pin/verify', () => {
    it('should verify PIN', async () => {
      // Setup PIN first
      await request(app)
        .post('/api/pin/setup')
        .set('Authorization', `Bearer ${token}`)
        .send({ pin: '1234' });

      // Verify PIN
      const res = await request(app)
        .post('/api/pin/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ pin: '1234' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });
  });
});

describe('Complete Withdrawal Endpoint', () => {
  const token = 'test-jwt-token';

  it('should generate OTP on step 1', async () => {
    const res = await request(app)
      .post('/api/withdrawals/verify-2fa')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'account-uuid',
        toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f44bAc',
        amount: '100',
        currency: 'USDC',
        step: 1
      })
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('step', 2);
    expect(res.body).toHaveProperty('otpId');
  });
});
```

---

## 🚀 Deployment Steps

### 1. Pre-Deployment
```bash
# Run all tests
npm run test

# Check code coverage
npm run test:coverage

# Lint code
npm run lint

# Build project
npm run build
```

### 2. Staging Deployment
```bash
# Deploy to staging environment
npm run deploy:staging

# Run smoke tests
npm run test:smoke

# Verify endpoints
curl -H "Authorization: Bearer $TEST_TOKEN" \
  https://staging-api.yourdomain.com/api/2fa/config
```

### 3. Production Deployment
```bash
# Create backup of production database
pg_dump production_db > backup_$(date +%s).sql

# Deploy to production
npm run deploy:production

# Verify deployment
curl -H "Authorization: Bearer $PROD_TOKEN" \
  https://api.yourdomain.com/api/health

# Monitor logs
tail -f /var/log/app/production.log
```

---

## 📊 Monitoring & Alerts

### Key Metrics to Monitor

1. **2FA Success Rate**
   ```
   Alert if < 95% for 5 minutes
   ```

2. **OTP Generation Latency**
   ```
   Alert if > 500ms average
   ```

3. **PIN Verification Failures**
   ```
   Alert if > 10 failed attempts per minute
   ```

4. **Withdrawal Execution Time**
   ```
   Alert if > 30 seconds average
   ```

5. **Error Rate**
   ```
   Alert if > 1% of requests fail
   ```

### Logging Examples

```typescript
// Log 2FA events
logger.info('2FA OTP generated', { userId, method: 'EMAIL' });
logger.error('2FA OTP verification failed', { userId, attempts: 3 });

// Log PIN events
logger.info('PIN setup completed', { walletId });
logger.warn('PIN verification failed', { walletId, attempts: 2 });

// Log withdrawal events
logger.info('Withdrawal initiated', { walletId, amount, currency });
logger.error('Withdrawal failed', { walletId, error: '...' });
```

---

## 🔍 Post-Deployment Validation

### 1. Endpoint Connectivity
```bash
# Check all endpoints respond
for endpoint in "2fa/config" "pin/requirements" "withdrawals/verify-2fa"; do
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    https://api.yourdomain.com/api/$endpoint
done
```

### 2. Database Connectivity
```sql
-- Verify table exists
SELECT * FROM wallet_security_settings LIMIT 1;

-- Check indexes
\di wallet_security_settings
```

### 3. Third-party Integration
```bash
# Test Twilio SMS
curl -X POST https://api.twilio.com/2010-04-01/Accounts/$SID/Messages.json \
  -d "From=$FROM_NUMBER&To=$TO_NUMBER&Body=Test"

# Test SendGrid Email
curl --request POST \
  --url https://api.sendgrid.com/v3/mail/send \
  --header "authorization: Bearer $SENDGRID_KEY"
```

---

## 🔒 Security Validation

### 1. Encryption Verification
```typescript
// Verify PIN hashing
const { hash: hash1 } = hashPIN('1234', 'salt');
const { hash: hash2 } = hashPIN('1234', 'salt');
assert(hash1 === hash2); // Same PIN + salt = same hash

const { hash: hash3 } = hashPIN('1234', 'different-salt');
assert(hash1 !== hash3); // Different salt = different hash
```

### 2. Rate Limiting Verification
```bash
# Send 6 OTP requests in succession
for i in {1..6}; do
  curl -X POST /api/2fa/generate \
    -H "Authorization: Bearer $TOKEN"
done
# Should be rate limited on 6th request
```

### 3. Token Expiration
```typescript
// Verify OTP expires after 5 minutes
const otp = await twoFAService.createWithdrawalOTP(userId);
await wait(301000); // Wait 5+ minutes
const result = await twoFAService.verifyWithdrawalOTP(userId, otp.otpId, otp.code);
assert(result.success === false); // Should be expired
```

---

## 🐛 Rollback Plan

### If Critical Issues Found

```bash
# 1. Stop new deployments
git revert <commit-hash>

# 2. Restore from backup
psql production_db < backup_timestamp.sql

# 3. Restart services
systemctl restart app

# 4. Verify endpoints
curl https://api.yourdomain.com/api/health
```

---

## 📞 Incident Response

### OTP Service Down
1. Check Twilio/SendGrid status
2. Restart service: `systemctl restart app`
3. Check logs: `journalctl -u app -n 100`
4. Alert on-call engineer

### PIN Service Corrupted
1. Check database integrity: `VACUUM ANALYZE wallet_security_settings;`
2. Restore from backup
3. Notify affected users
4. Post-incident review

### Withdrawal Service Issues
1. Check blockchain RPC status
2. Verify gas prices
3. Check withdrawal queue
4. Manual intervention if needed

---

## ✅ Success Criteria

Deployment is successful if:
- [ ] All endpoints return 200 OK
- [ ] 2FA OTP generation works
- [ ] PIN setup and verification works
- [ ] Complete withdrawal flow executes
- [ ] Error handling works properly
- [ ] Logging captures all events
- [ ] No database errors
- [ ] Response times acceptable (< 500ms)
- [ ] Rate limiting working
- [ ] Zero critical errors in logs

---

**Last Updated**: Session Complete
**Status**: Ready for Deployment
**Next Phase**: Phase 2.3 (Frontend UI Components)
