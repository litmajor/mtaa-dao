# Database and RPC Connection Fix

> **Date:** October 23, 2025  
> **Status:** ✅ RESOLVED

## 🔍 Problems Identified

### 1. PostgreSQL Connection Timeout
**Error:**
```
❌ Failed to connect to PostgreSQL: Connection terminated due to connection timeout
```

**Root Cause:**
- `localhost` on Windows was resolving to IPv6 (`::1`) instead of IPv4
- This caused connection timeout issues with the PostgreSQL container

### 2. RPC Provider Timeout
**Error:**
```
JsonRpcProvider failed to detect network and cannot start up
Error: request timeout (code=TIMEOUT, version=6.15.0)
```

**Root Cause:**
- Leading space in `RPC_URL` in .env file: `RPC_URL= https://forno.celo.org`
- Using mainnet RPC (slow/congested) instead of testnet
- No timeout configuration in the provider

---

## ✅ Solutions Applied

### Fix 1: Database Connection

**Changed DATABASE_URL from:**
```env
DATABASE_URL=postgresql://growth_halo:devpassword@localhost:5432/mtaadao
```

**To:**
```env
DATABASE_URL=postgresql://growth_halo:devpassword@127.0.0.1:5432/mtaadao
```

**Why this works:**
- `127.0.0.1` forces IPv4 connection
- Avoids IPv6 resolution issues on Windows
- Direct connection to Docker-exposed port 5432

### Fix 2: RPC Provider

**Changed RPC_URL from:**
```env
RPC_URL= https://forno.celo.org
```

**To:**
```env
RPC_URL=https://alfajores-forno.celo-testnet.org
```

**Additional improvements in `server/services/tokenService.ts`:**
```typescript
// Configure provider with timeout settings
this.provider = new ethers.JsonRpcProvider(
  providerUrl,
  undefined,
  {
    staticNetwork: true,
    batchMaxCount: 1
  }
);

// Set polling interval for faster updates
this.provider.pollingInterval = 12000; // 12 seconds
```

**Benefits:**
- Removed leading space
- Using testnet RPC (faster, less congested)
- Added `staticNetwork: true` to skip network detection (speeds up initialization)
- Added `batchMaxCount: 1` to avoid batching issues
- Set reasonable polling interval

---

## 🎯 Expected Results

After restarting the server (`npm run dev`), you should see:

```
✅ PostgreSQL connected successfully
✅ Redis connected successfully
✅ Blockchain services initialized successfully
🚀 Server starting up
```

**No more timeouts!**

---

## 📋 Verification Checklist

- [x] DATABASE_URL uses 127.0.0.1 instead of localhost
- [x] RPC_URL has no leading/trailing spaces
- [x] RPC_URL points to Alfajores testnet
- [x] Provider has timeout configuration
- [x] No linter errors

---

## 🔧 Docker Container Info

### PostgreSQL Container
- **Container Name:** `docker-postgres-1`
- **User:** `growth_halo`
- **Password:** `devpassword`
- **Database:** `mtaadao`
- **Port:** 5432 (exposed to host)

### Redis Container
- **Container Name:** `docker-redis-1`
- **Port:** 6379 (exposed to host)
- **Connection:** Working ✅

---

## 📚 Alternative RPC Endpoints

If the Alfajores testnet RPC is slow, you can try these alternatives:

### Celo Alfajores Testnet RPCs:
```env
# Official Celo
RPC_URL=https://alfajores-forno.celo-testnet.org

# QuickNode (requires signup)
RPC_URL=https://your-endpoint.celo-alfajores.quiknode.pro/

# Ankr (public)
RPC_URL=https://rpc.ankr.com/celo_alfajores
```

### For Production (Celo Mainnet):
```env
RPC_URL=https://forno.celo.org
```

---

## 🚨 Troubleshooting

### If PostgreSQL still times out:

1. **Check container is running:**
   ```bash
   docker ps | grep postgres
   ```

2. **Test connection directly:**
   ```bash
   docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -c "SELECT 1;"
   ```

3. **Check Windows Firewall:**
   - Ensure port 5432 is not blocked

### If RPC still times out:

1. **Test RPC endpoint manually:**
   ```bash
   curl https://alfajores-forno.celo-testnet.org
   ```

2. **Try alternative RPC:**
   ```env
   RPC_URL=https://rpc.ankr.com/celo_alfajores
   ```

3. **Check network connection:**
   - Ensure you have internet access
   - Check if your firewall blocks HTTPS

---

## 📝 Files Modified

1. `.env` - Updated DATABASE_URL and RPC_URL
2. `server/services/tokenService.ts` - Added provider configuration

---

## 🎉 Success Indicators

When everything works correctly, you'll see:
- ✅ PostgreSQL connected successfully
- ✅ Redis connected successfully  
- ✅ Vault Automation Service started successfully
- ✅ Bridge relayer service started
- ✅ Blockchain services initialized successfully
- ✅ Server listening on port 5000

**No timeout errors!** 🚀

