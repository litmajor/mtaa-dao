# Redis Configuration & Operations Reference Card

## 🚀 Quick Start Commands

### Start Redis
```bash
# Native
redis-server redis.conf

# Docker (Recommended)
docker-compose -f docker-compose.redis.yml up -d

# With logging
redis-server redis.conf --loglevel debug
```

### Test Connection
```bash
redis-cli -a yourpassword ping
# Response: PONG
```

### View Status
```bash
redis-cli -a yourpassword INFO server
redis-cli -a yourpassword DBSIZE
redis-cli -a yourpassword INFO memory
```

---

## 🔐 Security Quick Reference

### Change Password
```conf
# In redis.conf
requirepass new_strong_password_here_123!@#
```

### Test with New Password
```bash
redis-cli -a new_strong_password_here_123!@# ping
```

### Create ACL User
```bash
redis-cli
> ACL SETUSER app-user on >app_password ~* &* +get +set +del
> ACL SAVE
> EXIT
```

### List ACL Users
```bash
redis-cli -a password ACL LIST
```

---

## 📊 Monitoring Commands

### Real-Time Monitoring
| Command | Purpose |
|---------|---------|
| `INFO server` | Server statistics |
| `INFO memory` | Memory usage |
| `INFO clients` | Connected clients |
| `INFO persistence` | AOF/RDB status |
| `INFO stats` | Operations/sec |
| `SLOWLOG GET 10` | Last 10 slow queries |
| `CLIENT LIST` | Connected clients |
| `MONITOR` | Watch all commands |

### Check Health
```bash
# Is Redis responsive?
redis-cli -a password ping

# Memory usage
redis-cli -a password INFO memory | grep used_memory_human

# Number of keys
redis-cli -a password DBSIZE

# Clients connected
redis-cli -a password INFO clients | grep connected_clients
```

### Performance Analysis
```bash
# Show slow queries
redis-cli -a password SLOWLOG GET

# Identify large keys
redis-cli -a password --bigkeys

# Run benchmark
redis-benchmark -a password -n 100000 -c 50

# Check latency
redis-cli -a password LATENCY LATEST
```

---

## 💾 Persistence Reference

### AOF Status
```bash
# Check if enabled
redis-cli -a password CONFIG GET appendonly

# Rewrite AOF file
redis-cli -a password BGREWRITEAOF

# Check AOF size
du -h appendonly.aof
```

### RDB Status
```bash
# Check if enabled
redis-cli -a password CONFIG GET save

# Force save
redis-cli -a password SAVE

# Background save
redis-cli -a password BGSAVE

# Last save time
redis-cli -a password LASTSAVE

# Check RDB file
du -h dump.rdb
```

### Data Directory
```bash
# List persistence files
ls -lh ./redis-data/
# Output: appendonly.aof, dump.rdb, etc.
```

---

## 🐳 Docker Quick Reference

### Docker Compose
```bash
# Start
docker-compose -f docker-compose.redis.yml up -d

# Stop
docker-compose -f docker-compose.redis.yml down

# View logs
docker-compose -f docker-compose.redis.yml logs -f redis

# Restart
docker-compose -f docker-compose.redis.yml restart redis

# Health status
docker-compose -f docker-compose.redis.yml ps
```

### Docker Direct
```bash
# Check if running
docker ps | grep redis

# View logs
docker logs -f mtaa-redis

# Execute command
docker exec mtaa-redis redis-cli -a password ping

# Health status
docker inspect mtaa-redis --format='{{.State.Health.Status}}'

# Resource usage
docker stats mtaa-redis

# Stop gracefully
docker stop mtaa-redis

# Force stop
docker kill mtaa-redis

# Remove container
docker rm mtaa-redis
```

---

## 🔧 Configuration Tweaks

### Memory Management
```bash
# Check current memory limit
redis-cli -a password CONFIG GET maxmemory

# Set memory limit to 256MB
redis-cli -a password CONFIG SET maxmemory 256mb

# Set eviction policy (LRU)
redis-cli -a password CONFIG SET maxmemory-policy allkeys-lru

# Save configuration
redis-cli -a password CONFIG REWRITE
```

### Persistence Tuning
```bash
# Enable AOF
redis-cli -a password CONFIG SET appendonly yes

# Set AOF fsync
redis-cli -a password CONFIG SET appendfsync everysec

# Set RDB save interval
redis-cli -a password CONFIG SET save "60 10000"

# Save changes
redis-cli -a password CONFIG REWRITE
```

### Logging
```bash
# Set log level (debug, verbose, notice, warning)
redis-cli -a password CONFIG SET loglevel debug

# Check log level
redis-cli -a password CONFIG GET loglevel
```

---

## 🆘 Troubleshooting Commands

### Connection Issues
```bash
# Test connection
redis-cli ping

# Test with password
redis-cli -a password ping

# Try specific host/port
redis-cli -h 127.0.0.1 -p 6379 -a password ping

# Check if port is open
netstat -an | grep 6379
```

### Performance Issues
```bash
# Get slow log
redis-cli -a password SLOWLOG GET 20

# Reset slow log
redis-cli -a password SLOWLOG RESET

# Check commandstats
redis-cli -a password INFO commandstats

# Monitor performance
watch -n 1 'redis-cli -a password INFO stats'
```

### Memory Issues
```bash
# Detailed memory info
redis-cli -a password INFO memory

# Find big keys
redis-cli -a password --bigkeys

# Check eviction rate
redis-cli -a password INFO stats | grep evicted

# Manual eviction
redis-cli -a password FLUSHDB  # Careful! Deletes all data
```

### Persistence Issues
```bash
# Check AOF status
redis-cli -a password INFO persistence

# Verify AOF file
redis-check-aof /path/to/appendonly.aof

# Repair AOF if needed
redis-check-aof --fix /path/to/appendonly.aof

# Verify RDB file
redis-check-rdb /path/to/dump.rdb
```

---

## 📈 Key Metrics & Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Memory % | >70% | >90% |
| Connected Clients | >500 | >1000 |
| Commands/sec | >50k | >100k |
| Evictions/sec | >10 | >100 |
| Slow Queries | >0 | >10/min |
| Replication Lag | >1s | >5s |
| Disk Usage (data) | >80% | >95% |

---

## 🎯 Common Operations

### Backup
```bash
# Manual backup
redis-cli -a password BGSAVE
cp dump.rdb backups/dump-$(date +%Y%m%d-%H%M%S).rdb

# Backup with tar
tar czf redis-backup-$(date +%Y%m%d).tar.gz redis-data/
```

### Restore
```bash
# Stop Redis
docker-compose down

# Restore RDB file
cp backup/dump.rdb redis-data/

# Start Redis
docker-compose up -d

# Verify data
redis-cli -a password DBSIZE
```

### Cleanup
```bash
# Delete all keys in current DB
redis-cli -a password FLUSHDB

# Delete all keys across all DBs
redis-cli -a password FLUSHALL

# Rewrite AOF (compact file)
redis-cli -a password BGREWRITEAOF

# Shutdown gracefully
redis-cli -a password SHUTDOWN
```

---

## 📱 Docker Container Management

### Health Check Debugging
```bash
# Check health status
docker inspect mtaa-redis --format='{{.State.Health.Status}}'

# Get health history
docker inspect mtaa-redis --format='{{json .State.Health}}' | jq

# Restart if unhealthy
if [ "$(docker inspect mtaa-redis --format='{{.State.Health.Status}}')" = "unhealthy" ]; then
  docker restart mtaa-redis
fi
```

### Log Management
```bash
# Last 50 lines
docker logs --tail 50 mtaa-redis

# Follow in real-time
docker logs -f mtaa-redis

# With timestamps
docker logs --timestamps mtaa-redis

# Since specific time
docker logs --since 2025-01-12T10:00:00 mtaa-redis

# Until specific time
docker logs --until 2025-01-12T11:00:00 mtaa-redis
```

### Resource Monitoring
```bash
# Live stats
docker stats mtaa-redis

# One-time snapshot
docker stats --no-stream mtaa-redis

# Check limits
docker inspect mtaa-redis --format='{{json .HostConfig.Memory}}' | jq

# Check current usage
docker exec mtaa-redis redis-cli -a password INFO memory | grep used_memory
```

---

## 🔄 Failover & Recovery

### Manual Failover
```bash
# Save current data
redis-cli -a password SAVE

# Shutdown primary
redis-cli -a password SHUTDOWN

# Point replica config to new primary
# Edit redis.conf: replicaof new-host 6379

# Start new primary
redis-server redis.conf
```

### Data Recovery
```bash
# From RDB backup
redis-cli -a password SHUTDOWN
cp backups/dump-20250112.rdb redis-data/dump.rdb
redis-server redis.conf

# From AOF backup
redis-cli -a password SHUTDOWN
cp backups/appendonly-20250112.aof redis-data/appendonly.aof
redis-server redis.conf
```

### Verify Recovery
```bash
# Check key count
redis-cli -a password DBSIZE

# Sample keys
redis-cli -a password KEYS "*" | head -20

# Get specific data
redis-cli -a password GET "your-key"
```

---

## 📋 Configuration Files

### redis.conf Key Sections
```
[NETWORK]       → bind, port, timeout
[PERSISTENCE]   → save, appendonly, dir
[SECURITY]      → requirepass
[MEMORY]        → maxmemory, maxmemory-policy
[CLIENTS]       → timeout, client-output-buffer-limit
[LOGGING]       → loglevel, logfile
[SLOW LOG]      → slowlog-log-slower-than
```

### .env Template
```
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your_strong_password
REDIS_DB=0
REDIS_TIMEOUT=5000
```

### docker-compose.yml Template
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis-data:/data
    command: redis-server /usr/local/etc/redis/redis.conf
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "password", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
```

---

## 🎓 Learning Resources

| Topic | Command | Learn More |
|-------|---------|------------|
| Server Info | `INFO server` | REDIS_SETUP_SECURITY_GUIDE.md |
| Monitoring | `MONITOR` | REDIS_SETUP_SECURITY_GUIDE.md |
| Security | `ACL LIST` | REDIS_SETUP_SECURITY_GUIDE.md |
| Docker | `docker ps` | REDIS_DOCKER_GUIDE.md |
| Setup | See files | REDIS_QUICK_START.md |

---

## ✅ Health Check Shortcut

```bash
#!/bin/bash
# Quick health check

echo "🔍 Checking Redis..."

# Connection
redis-cli -a password ping > /dev/null 2>&1 && echo "✅ Connection OK" || echo "❌ Connection FAILED"

# Memory
echo -n "💾 Memory: " && redis-cli -a password INFO memory | grep used_memory_human | cut -d: -f2

# Keys
echo -n "🔑 Keys: " && redis-cli -a password DBSIZE | grep keys | cut -d: -f2

# Clients
echo -n "👥 Clients: " && redis-cli -a password INFO clients | grep connected_clients | cut -d: -f2

# Performance
echo -n "⚡ Ops/sec: " && redis-cli -a password INFO stats | grep instantaneous_ops_per_sec | cut -d: -f2

echo "✅ Redis is healthy!"
```

Save as `redis-health.sh` and run:
```bash
chmod +x redis-health.sh
./redis-health.sh
```

---

**Last Updated:** January 2026  
**Quick Reference Version:** 1.0  
**Status:** Production-Ready
