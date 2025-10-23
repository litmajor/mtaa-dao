# 🚀 Production Setup Guide

This guide covers setting up the production-ready authentication system with OTP, Redis, and rate limiting.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Redis Setup](#redis-setup)
3. [Email Configuration](#email-configuration)
4. [SMS Configuration](#sms-configuration)
5. [Rate Limiting](#rate-limiting)
6. [Environment Variables](#environment-variables)
7. [Deployment](#deployment)

---

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database
- Redis server (optional but recommended)
- SMTP email account OR email service (SendGrid, Mailgun, etc.)
- SMS provider account (Africa's Talking OR Twilio)

---

## 🔴 Redis Setup

### Option 1: Local Redis (Development)

```bash
# Install Redis
# MacOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows (via WSL or Docker)
docker run -d -p 6379:6379 redis:alpine
```

### Option 2: Cloud Redis (Production)

#### **Upstash** (Recommended - Free tier available)
1. Sign up at [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Copy the `REDIS_URL`
4. Add to `.env`: `REDIS_URL=redis://...`

#### **Redis Cloud**
1. Sign up at [redis.com/try-free](https://redis.com/try-free/)
2. Create database
3. Get connection string
4. Add to `.env`

#### **AWS ElastiCache** (For AWS deployments)
```bash
# Create ElastiCache cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id mtaadao-redis \
  --engine redis \
  --cache-node-type cache.t3.micro
```

---

## 📧 Email Configuration

### Option 1: Gmail (Development)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Generate from Google Account settings
SMTP_FROM=noreply@mtaadao.com
```

**Generate App Password:**
1. Go to [Google Account](https://myaccount.google.com/)
2. Security → 2-Step Verification → App passwords
3. Generate password for "Mail"
4. Use this password in `.env`

### Option 2: SendGrid (Production)

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@mtaadao.com
```

**Setup SendGrid:**
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Verify sender identity (email/domain)
3. Create API key
4. Add to `.env`

### Option 3: AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=noreply@mtaadao.com
```

---

## 📱 SMS Configuration

### Option 1: Africa's Talking (Recommended for Africa)

**Best for:** Kenya, Nigeria, Tanzania, Uganda, Ghana, Rwanda, etc.

```env
AFRICAS_TALKING_API_KEY=your_api_key_here
AFRICAS_TALKING_USERNAME=your_username_here
```

**Setup:**
1. Sign up at [africastalking.com](https://africastalking.com)
2. Go to Dashboard → Settings → API Key
3. Copy API Key and Username
4. Add credits to account
5. Add to `.env`

**Pricing:** ~$0.01 per SMS (very affordable for African markets)

### Option 2: Twilio (International)

**Best for:** Global coverage, USA, Europe, etc.

```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**Setup:**
1. Sign up at [twilio.com](https://twilio.com)
2. Go to Console
3. Copy Account SID and Auth Token
4. Buy a phone number
5. Add to `.env`

**Pricing:** ~$0.0075 per SMS

---

## 🚦 Rate Limiting

Rate limiting is **automatically applied** to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/register` | 5 attempts | 15 minutes |
| `/api/auth/login` | 10 attempts | 15 minutes |
| `/api/auth/verify-otp` | 10 attempts | 15 minutes |
| `/api/auth/resend-otp` | 3 attempts | 5 minutes |

### How it works:

- **With Redis:** Distributed rate limiting across multiple servers
- **Without Redis:** In-memory rate limiting (single server only)

### Customize Rate Limits:

Edit `server/middleware/rateLimiter.ts`:

```typescript
export const registerRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Change this number
  message: 'Custom error message',
});
```

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Required Variables:

```env
DATABASE_URL=postgresql://user:password@host:5432/mtaadao
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### Email (Choose ONE):

```env
# Gmail
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# OR SendGrid
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### SMS (Choose ONE):

```env
# Africa's Talking
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username

# OR Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Optional but Recommended:

```env
REDIS_URL=redis://localhost:6379
NODE_ENV=production
```

---

## 🚀 Deployment

### 1. Install Dependencies

```bash
npm install redis
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Run Migrations

```bash
npm run migrate
```

### 4. Start Server

```bash
npm start
```

### 5. Verify Setup

```bash
# Check health endpoint
curl http://localhost:5000/api/health

# Expected response:
{
  "status": "pass",
  "version": "1.0.0",
  "checks": {
    "database": "pass",
    "redis": "pass"
  }
}
```

---

## 🧪 Testing the System

### 1. Test Registration

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

Expected: OTP sent to email

### 2. Test OTP Verification

```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'
```

Expected: User created, token returned

### 3. Test Rate Limiting

```bash
# Try registering 6 times quickly
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test'$i'@example.com",
      "password": "SecurePass123!"
    }'
done
```

Expected: 6th request returns 429 (Too Many Requests)

---

## 📊 Monitoring

### Check Redis Connection

```bash
redis-cli ping
# Expected: PONG
```

### Monitor Rate Limits

```bash
# View rate limit keys in Redis
redis-cli KEYS "rate_limit:*"

# Check specific key
redis-cli GET "rate_limit:register:192.168.1.1"
```

### View OTP Storage

```bash
# List OTP keys
redis-cli KEYS "otp:*"

# Get OTP data (development only)
redis-cli GET "otp:test@example.com"
```

---

## 🔧 Troubleshooting

### Issue: "Failed to send OTP email"

**Solution:**
1. Check SMTP credentials in `.env`
2. Verify SMTP server allows connections
3. Check email logs: `tail -f logs/email.log`
4. Test SMTP connection:
   ```bash
   telnet smtp.gmail.com 587
   ```

### Issue: "Failed to send OTP SMS"

**Solution:**
1. Verify SMS provider credentials
2. Check account balance
3. Ensure phone number format is correct (+254...)
4. Check SMS logs in provider dashboard

### Issue: "Redis connection failed"

**Solution:**
1. System will automatically fallback to in-memory storage
2. Check Redis is running: `redis-cli ping`
3. Verify `REDIS_URL` in `.env`
4. Check firewall settings

### Issue: "Rate limit not working"

**Solution:**
1. Ensure Redis is connected (for multi-server setups)
2. Check rate limiter is applied to route in `routes.ts`
3. Clear Redis cache: `redis-cli FLUSHDB`

---

## 🔒 Security Best Practices

1. **Never commit `.env` to git**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Use strong JWT secrets**
   ```bash
   # Generate secure secret
   openssl rand -base64 32
   ```

3. **Enable HTTPS in production**
   ```env
   NODE_ENV=production
   ```

4. **Rotate API keys regularly**

5. **Monitor rate limit violations**

6. **Set up alerting for failed OTP attempts**

---

## 📚 Additional Resources

- [Redis Documentation](https://redis.io/docs/)
- [Africa's Talking API Docs](https://developers.africastalking.com/)
- [Twilio SMS API](https://www.twilio.com/docs/sms)
- [SendGrid Email API](https://docs.sendgrid.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 🆘 Support

For issues or questions:
- Create an issue on GitHub
- Contact support@mtaadao.com
- Check documentation at docs.mtaadao.com

---

**🎉 Congratulations! Your production-ready authentication system is now set up!**

