# Redis Implementation Checklist & Quick Start

## ⚡ Quick Start (5 Minutes)

### 1. Basic Setup
- [ ] Copy `redis.conf` from project root
- [ ] Update `requirepass yourpassword` with strong password
- [ ] Update `.env` with same password

### 2. Start Redis
**Windows:**
```powershell
redis-server redis.conf
```

**Docker:**
```bash
docker-compose -f docker-compose.redis.yml up -d
```

### 3. Test Connection
```bash
redis-cli -a yourpassword ping
# Expected response: PONG
```

### 4. Update Application
```typescript
const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  password: process.env.REDIS_PASSWORD
});
```

**Done!** ✅

---

## 📋 Complete Implementation Checklist

### Phase 1: Configuration
- [ ] Copy `redis.conf` to project
- [ ] Review persistence settings:
  - [ ] `appendonly yes` ✓ (AOF enabled)
  - [ ] `save 60 10000` ✓ (RDB snapshots)
  - [ ] `appendfsync everysec` ✓ (Good balance)
- [ ] Set strong password:
  - [ ] Change `requirepass` from default
  - [ ] Use at least 16 characters
  - [ ] Include letters, numbers, symbols
  - [ ] Store in `.env` file (git-ignored)
- [ ] Review network settings:
  - [ ] `bind 127.0.0.1 ::1` ✓ (Localhost only)
  - [ ] `port 6379` ✓ (Standard port)

### Phase 2: Security
- [ ] Set Redis password in `redis.conf`
- [ ] Create `.env` file with password
- [ ] Add `.env` to `.gitignore`
- [ ] Configure firewall:
  - [ ] Windows: NetFirewallRule or Windows Defender
  - [ ] Linux: UFW rules
  - [ ] Docker: Port binding to 127.0.0.1 only
- [ ] (Optional) Set up ACL for granular permissions
- [ ] (Optional) Enable TLS for remote connections

### Phase 3: Application Integration
- [ ] Install Redis driver:
  ```bash
  npm install ioredis
  # or
  npm install redis
  ```
- [ ] Create Redis connection module:
  ```typescript
  // redis.ts
  import Redis from 'ioredis';
  
  const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });
  
  export default redis;
  ```
- [ ] Update `.env` with Redis credentials:
  ```
  REDIS_HOST=127.0.0.1
  REDIS_PORT=6379
  REDIS_PASSWORD=your_strong_password
  REDIS_DB=0
  ```
- [ ] Import and use in application:
  ```typescript
  import redis from './redis';
  
  // Use redis in services
  await redis.set('key', 'value');
  const value = await redis.get('key');
  ```
- [ ] Add error handling:
  ```typescript
  redis.on('error', (err) => {
    console.error('Redis error:', err);
    // Handle gracefully
  });
  ```

### Phase 4: Startup & Persistence
- [ ] Choose startup method:
  - [ ] **Manual**: `redis-server redis.conf`
  - [ ] **Docker**: `docker-compose up -d`
  - [ ] **Script**: `./start-redis.sh` or `.ps1`
- [ ] Verify AOF persistence:
  - [ ] Check `appendonly.aof` file created in data directory
  - [ ] File should contain operation logs
- [ ] Verify RDB snapshots:
  - [ ] Check `dump.rdb` file created
  - [ ] Monitor file size growth
- [ ] Test persistence:
  - [ ] Set value: `redis-cli SET test-key "test-value"`
  - [ ] Stop Redis
  - [ ] Restart Redis
  - [ ] Verify value persists: `redis-cli GET test-key`

### Phase 5: Monitoring & Observability
- [ ] Set up health checks:
  - [ ] Docker: Health check in docker-compose.yml ✓
  - [ ] Application: Redis connection verification
- [ ] Monitor connections:
  ```bash
  redis-cli -a password INFO clients
  redis-cli -a password CLIENT LIST
  ```
- [ ] Monitor memory:
  ```bash
  redis-cli -a password INFO memory
  # Set limits if needed:
  # redis-cli CONFIG SET maxmemory 256mb
  ```
- [ ] Monitor slow queries:
  ```bash
  redis-cli -a password SLOWLOG GET 10
  ```
- [ ] Set up logging:
  - [ ] Configure `loglevel notice` or `debug`
  - [ ] Redirect to file if needed
  - [ ] Monitor logs for errors

### Phase 6: Testing
- [ ] Unit tests:
  - [ ] Test cache set/get operations
  - [ ] Test error handling
  - [ ] Test connection failures
  - [ ] Test password authentication
- [ ] Integration tests:
  - [ ] Test Redis with application
  - [ ] Test persistence after restart
  - [ ] Test concurrent operations
  - [ ] Test memory limits
- [ ] Load testing:
  - [ ] Use `redis-benchmark` for performance
  - [ ] Verify under concurrent load
  - [ ] Check memory stability

### Phase 7: Backup & Recovery
- [ ] Set up automated backups:
  - [ ] Daily `dump.rdb` backup
  - [ ] Archive to external storage
  - [ ] Test recovery process
- [ ] Create backup strategy:
  - [ ] Backup frequency: Daily
  - [ ] Retention: 30 days
  - [ ] Off-site storage: Cloud storage
- [ ] Document recovery procedure:
  - [ ] Steps to restore from backup
  - [ ] Testing recovery
  - [ ] Expected recovery time

### Phase 8: Production Readiness
- [ ] Performance tuning:
  - [ ] AOF fsync: `everysec` (good balance)
  - [ ] RDB save: `60 10000` (adjust for your workload)
  - [ ] Memory limit: Set based on available RAM
  - [ ] Eviction policy: `allkeys-lru` for general use
- [ ] Documentation:
  - [ ] Document configuration choices
  - [ ] Create runbooks for operations
  - [ ] Document troubleshooting steps
  - [ ] Create disaster recovery plan
- [ ] Team training:
  - [ ] Team knows how to start/stop Redis
  - [ ] Team knows how to monitor
  - [ ] Team knows basic troubleshooting
  - [ ] Team knows backup/recovery process

### Phase 9: Deployment
- [ ] Development environment:
  - [ ] Redis configured and running
  - [ ] Application connecting successfully
  - [ ] Persistence verified
- [ ] Staging environment:
  - [ ] Same configuration as production
  - [ ] Full testing completed
  - [ ] Monitoring in place
- [ ] Production environment:
  - [ ] Backup in place
  - [ ] Monitoring and alerts set up
  - [ ] Team trained
  - [ ] Rollback plan documented
  - [ ] Go-live checklist completed

---

## 🔍 Pre-Deployment Verification

Run this before going to production:

```bash
#!/bin/bash

echo "=== Redis Pre-Deployment Verification ==="

# 1. Check Redis running
redis-cli -a password ping
if [ $? -eq 0 ]; then
  echo "✅ Redis connection OK"
else
  echo "❌ Redis connection FAILED"
  exit 1
fi

# 2. Check persistence
redis-cli -a password INFO persistence | grep "aof_enabled\|rdb"
echo "✅ Persistence configured"

# 3. Check memory
MEMORY=$(redis-cli -a password INFO memory | grep used_memory_human)
echo "Memory usage: $MEMORY"

# 4. Check keys
KEYS=$(redis-cli -a password DBSIZE | awk '{print $2}')
echo "Total keys: $KEYS"

# 5. Check connections
redis-cli -a password INFO clients | grep connected_clients
echo "✅ Connection info obtained"

# 6. Check data directory
if [ -f dump.rdb ]; then
  echo "✅ RDB snapshot exists"
fi

if [ -f appendonly.aof ]; then
  echo "✅ AOF file exists"
fi

echo ""
echo "✅ All pre-deployment checks passed!"
```

Save as `verify-redis.sh` and run:
```bash
chmod +x verify-redis.sh
./verify-redis.sh
```

---

## 📊 Monitoring Dashboard

### Key Metrics to Monitor

| Metric | Command | Alert Threshold |
|--------|---------|-----------------|
| Memory Usage | `INFO memory` | >80% of maxmemory |
| Connected Clients | `INFO clients` | >1000 |
| Operations/sec | `INFO stats` | >100k ops/sec |
| Evictions | `INFO stats` | >0 (if using LRU) |
| Slow Queries | `SLOWLOG GET` | Any > 10ms |
| Disk Usage | `du -sh` | >90% free |
| Replication Lag | `INFO replication` | >1 second |

### Monitoring Commands
```bash
# Every 10 seconds
watch -n 10 "redis-cli -a password INFO server,memory,stats,clients"

# With color output
redis-cli -a password MONITOR | grep "SET\|GET\|DEL"

# Real-time stats
redis-cli -a password INFO stats

# Check specific metric
redis-cli -a password INFO | grep -E "memory|clients|keys"
```

---

## 🆘 Quick Troubleshooting Guide

### Problem: Connection Refused
**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# Start Redis if not running
redis-server redis.conf

# Check port binding
netstat -an | grep 6379
```

### Problem: Authentication Failed
**Solution:**
```bash
# Verify password is correct
grep "requirepass" redis.conf

# Update application .env with correct password
echo "REDIS_PASSWORD=correct_password" >> .env

# Test connection with password
redis-cli -a correct_password ping
```

### Problem: Out of Memory
**Solution:**
```bash
# Check memory usage
redis-cli -a password INFO memory

# Set memory limit
redis-cli -a password CONFIG SET maxmemory 256mb

# Set eviction policy
redis-cli -a password CONFIG SET maxmemory-policy allkeys-lru

# Identify large keys
redis-cli -a password --bigkeys
```

### Problem: Slow Performance
**Solution:**
```bash
# Check slow log
redis-cli -a password SLOWLOG GET 10

# Identify problematic commands
redis-cli -a password INFO commandstats

# Run benchmark to baseline
redis-benchmark -a password -n 100000

# Check for AOF issues
redis-cli -a password BGREWRITEAOF
```

### Problem: Container Keeps Restarting
**Solution:**
```bash
# Check Docker logs
docker logs -f mtaa-redis

# Verify health check
docker inspect mtaa-redis --format='{{.State.Health.Status}}'

# Test health check command
docker exec mtaa-redis redis-cli -a password ping

# Check config file syntax
redis-cli --check-system redis.conf
```

---

## 📚 Documentation Files

| File | Purpose | Read Time |
|------|---------|-----------|
| `redis.conf` | Configuration file | - |
| `REDIS_SETUP_SECURITY_GUIDE.md` | Setup & security | 20 min |
| `REDIS_DOCKER_GUIDE.md` | Docker-specific | 15 min |
| `REDIS_QUICK_START.md` | This file | 10 min |

---

## 🎯 Success Criteria

Redis is production-ready when:

- [ ] ✅ Redis starts successfully with config file
- [ ] ✅ Application connects with password authentication
- [ ] ✅ Data persists after restart
- [ ] ✅ Memory usage stays stable
- [ ] ✅ Health checks pass
- [ ] ✅ Monitoring shows normal operation
- [ ] ✅ Backup & recovery tested
- [ ] ✅ Team trained on operations
- [ ] ✅ Incident response plan documented

---

## 📞 Support Resources

- [Redis Documentation](https://redis.io/docs/)
- [Redis CLI Commands](https://redis.io/commands/)
- [Troubleshooting Guide](REDIS_SETUP_SECURITY_GUIDE.md#-troubleshooting)
- [Docker Guide](REDIS_DOCKER_GUIDE.md)

---

**Last Updated:** January 2026  
**Status:** Production-Ready  
**Estimated Setup Time:** 30-60 minutes
