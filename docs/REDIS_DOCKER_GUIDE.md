# Redis Docker Configuration & Troubleshooting Guide

## 🐳 Docker Quick Start

### Option 1: Docker Compose (Recommended)

Create `docker-compose.redis.yml`:
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: mtaa-redis
    
    # Port binding (localhost only)
    ports:
      - "127.0.0.1:6379:6379"
    
    # Config and data volumes
    volumes:
      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis-data:/data
    
    # Start Redis with config file
    command: redis-server /usr/local/etc/redis/redis.conf
    
    # Network configuration
    networks:
      - mtaa-network
    
    # Restart policy
    restart: unless-stopped
    
    # Health check - CRITICAL for detecting issues
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "yourpassword", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
    
    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    
    # Signal handling
    stop_signal: SIGTERM
    stop_grace_period: 10s

networks:
  mtaa-network:
    driver: bridge

volumes:
  redis-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./redis-data
```

Start with:
```bash
docker-compose -f docker-compose.redis.yml up -d

# View logs
docker-compose -f docker-compose.redis.yml logs -f redis

# Stop gracefully
docker-compose -f docker-compose.redis.yml down
```

### Option 2: Docker Run
```bash
# Create data directory
mkdir -p redis-data

# Run Redis with config
docker run -d \
  --name mtaa-redis \
  -p 127.0.0.1:6379:6379 \
  -v $(pwd)/redis.conf:/usr/local/etc/redis/redis.conf:ro \
  -v $(pwd)/redis-data:/data \
  redis:7-alpine \
  redis-server /usr/local/etc/redis/redis.conf

# Check logs
docker logs -f mtaa-redis
```

---

## 🔍 Docker Health Checks

### Understanding Health Status
```bash
# Check container health
docker inspect mtaa-redis --format='{{.State.Health.Status}}'

# Get full health details
docker inspect mtaa-redis --format='{{json .State.Health}}' | jq

# View health check logs
docker inspect mtaa-redis | grep -A 10 "Health"
```

### Possible Health States
- `starting` - Container is starting, health check hasn't completed yet
- `healthy` - Container passed health check
- `unhealthy` - Container failed health check
- `none` - No health check configured

### Why Containers Restart

**Common Restart Triggers:**
1. Health check fails (3 retries × 10s interval = 30s total)
2. Redis process crashes
3. Memory limit exceeded
4. Out of disk space
5. Explicit docker stop/restart

### Debugging Health Check Failures

**Check the health status:**
```bash
docker inspect mtaa-redis --format='{{.State.Health.Status}}'
```

**If unhealthy, check Redis logs:**
```bash
docker logs mtaa-redis

# Look for errors like:
# - "requirepass" password issues
# - "Can't open the log file"
# - "Out of memory"
# - "Unable to bind socket"
```

**Manually test the health check:**
```bash
# Test without password (should fail)
docker exec mtaa-redis redis-cli ping
# Response: (error) NOAUTH Authentication required

# Test with password (should work)
docker exec mtaa-redis redis-cli -a yourpassword ping
# Response: PONG
```

**Fix health check password mismatch:**

In `docker-compose.yml`, ensure the password matches:
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "-a", "yourpassword", "ping"]  # ← Match password
  interval: 10s
  timeout: 3s
  retries: 3
  start_period: 5s
```

---

## 🚨 Common Docker Issues & Fixes

### Issue 1: Container Keeps Restarting

**Symptoms:**
```
docker ps shows container exited with code 1
docker logs shows errors repeatedly
```

**Diagnosis:**
```bash
# Check exit code
docker inspect mtaa-redis --format='{{.State.ExitCode}}'

# Get detailed error
docker logs --tail 50 mtaa-redis

# Check health
docker inspect mtaa-redis --format='{{.State.Health.Status}}'
```

**Common causes and fixes:**

**A) Config File Error:**
```bash
# Validate config outside container
redis-cli --check-system redis.conf

# Or test with docker run
docker run -it --rm \
  -v $(pwd)/redis.conf:/usr/local/etc/redis/redis.conf:ro \
  redis:7-alpine \
  redis-server /usr/local/etc/redis/redis.conf --test-memory 1

# Fix syntax errors in redis.conf
# Common: requirepass with spaces, typos, invalid paths
```

**B) Port Already in Use:**
```bash
# Check what's using port 6379
netstat -an | grep 6379
# or on Windows
netstat -anbo | findstr 6379

# Fix: Change port in docker-compose or kill the process
```

**C) Health Check Failing:**
```bash
# Verify password in health check matches requirepass
grep "requirepass" redis.conf
grep "test:" docker-compose.yml

# Update if they don't match
```

**D) Permission Error:**
```bash
# Ensure redis-data directory exists and is writable
mkdir -p redis-data
chmod 755 redis-data

# On Windows, check folder permissions
# Run PowerShell as Admin if needed
```

### Issue 2: Connection Refused

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
Cannot connect from application
```

**Diagnosis:**
```bash
# Test connection from host
redis-cli -a yourpassword ping
# Should respond: PONG

# Test from within container
docker exec mtaa-redis redis-cli -a yourpassword ping

# Check if container is running
docker ps | grep mtaa-redis
```

**Fixes:**

**A) Wrong port binding:**
```bash
# Check what ports are exposed
docker port mtaa-redis

# Verify docker-compose port binding
# Should be: "127.0.0.1:6379:6379"
```

**B) Container not running:**
```bash
# Start container
docker start mtaa-redis

# Or restart
docker restart mtaa-redis
```

**C) Wrong password:**
```bash
# Try without password
redis-cli ping
# Should fail with "NOAUTH" if password is set

# Use correct password
redis-cli -a yourpassword ping
```

### Issue 3: High Memory Usage

**Symptoms:**
```
Docker container memory constantly increasing
OOMKilled (Out of Memory)
```

**Diagnosis:**
```bash
# Check memory usage
docker stats mtaa-redis

# Check Redis memory inside container
docker exec mtaa-redis redis-cli -a yourpassword INFO memory

# Look for "used_memory_human" and "used_memory_peak_human"
```

**Fixes:**

**A) Set memory limit in docker-compose.yml:**
```yaml
deploy:
  resources:
    limits:
      memory: 512M    # Hard limit
    reservations:
      memory: 256M    # Soft limit
```

**B) Set Redis maxmemory:**
```conf
# In redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru  # Evict least recently used
```

**C) Monitor and debug:**
```bash
# Check top keys
docker exec mtaa-redis redis-cli -a yourpassword --bigkeys

# Check all keys
docker exec mtaa-redis redis-cli -a yourpassword DBSIZE

# Get memory by command
docker exec mtaa-redis redis-cli -a yourpassword INFO commandstats
```

### Issue 4: AOF File Corruption

**Symptoms:**
```
Redis won't start after container crash
Logs show "AOF file is corrupted"
```

**Diagnosis:**
```bash
# Check Redis logs
docker logs mtaa-redis | grep -i "aof\|corrupt"

# Inspect AOF file
docker exec mtaa-redis redis-check-aof /data/appendonly.aof
```

**Fixes:**

**A) Automatic fix:**
```bash
# Docker will try to fix on startup if:
aof-load-truncated yes  # In redis.conf
```

**B) Manual repair:**
```bash
# Stop container
docker-compose down

# Fix the AOF file
docker run -it --rm \
  -v $(pwd)/redis-data:/data \
  redis:7-alpine \
  redis-check-aof --fix /data/appendonly.aof

# Start container
docker-compose up -d
```

**C) Restore from backup:**
```bash
# If you have dump.rdb backup
docker stop mtaa-redis
rm redis-data/appendonly.aof
docker start mtaa-redis
```

### Issue 5: Slow Performance/Timeouts

**Symptoms:**
```
Application timeouts connecting to Redis
Slow response times in logs
```

**Diagnosis:**
```bash
# Check container health
docker stats mtaa-redis

# Monitor Redis commands
docker exec mtaa-redis redis-cli -a yourpassword MONITOR

# Check slow log
docker exec mtaa-redis redis-cli -a yourpassword SLOWLOG GET 10

# Check latency
docker exec mtaa-redis redis-cli -a yourpassword LATENCY LATEST
```

**Fixes:**

**A) Increase timeout:**
```typescript
// In application connection config
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'yourpassword',
  lazyConnect: false,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10000,  // Increase to 10s
  retryStrategy: (times) => {
    return Math.min(times * 100, 3000);
  }
});
```

**B) Optimize Redis config:**
```conf
# In redis.conf
slowlog-log-slower-than 10000  # Log queries > 10ms
slowlog-max-len 128

# Check what's slow
redis-cli SLOWLOG GET
```

**C) Resource constraints:**
```yaml
# Increase container resources
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 1G
```

---

## 🔐 Docker Security Best Practices

### 1. Use Read-Only Config
```yaml
volumes:
  - ./redis.conf:/usr/local/etc/redis/redis.conf:ro  # Read-only
```

### 2. Non-Root User (Redis image already does this)
```bash
# Verify Redis runs as non-root
docker exec mtaa-redis whoami
# Output: redis (uid: 999)
```

### 3. Network Isolation
```yaml
networks:
  mtaa-network:
    driver: bridge
    internal: false  # Change to true if no external access needed
```

### 4. Port Binding
```yaml
# Only bind to localhost (most secure)
ports:
  - "127.0.0.1:6379:6379"

# If remote access needed, use VPN or specific IPs
# ports:
#   - "192.168.1.100:6379:6379"
```

### 5. Secret Management
Use Docker Secrets (in Swarm mode) or environment files:

Create `.env.redis`:
```
REDIS_PASSWORD=your_very_strong_password_here_123!@#
REDIS_PORT=6379
```

Reference in docker-compose.yml:
```yaml
environment:
  - REDIS_PASSWORD=${REDIS_PASSWORD}

healthcheck:
  test: ["CMD", "redis-cli", "-a", "$REDIS_PASSWORD", "ping"]
```

Start with:
```bash
docker-compose --env-file .env.redis up -d
```

---

## 📊 Docker Monitoring

### Check Container Stats
```bash
# Real-time stats
docker stats mtaa-redis

# One-time snapshot
docker stats --no-stream mtaa-redis
```

### View Detailed Logs
```bash
# Last 50 lines
docker logs --tail 50 mtaa-redis

# Follow logs in real-time
docker logs -f mtaa-redis

# Timestamps
docker logs --timestamps mtaa-redis

# Since specific time
docker logs --since 2025-01-12T10:00:00 mtaa-redis
```

### Inspect Container
```bash
# Full container details
docker inspect mtaa-redis

# Just health status
docker inspect mtaa-redis --format='{{.State.Health}}'

# Just port mappings
docker inspect mtaa-redis --format='{{.PortBindings}}'

# Just volumes
docker inspect mtaa-redis --format='{{.Mounts}}'
```

---

## 🆘 Advanced Debugging

### Interactive Shell
```bash
# Access container shell
docker exec -it mtaa-redis sh

# Inside container
redis-cli -a yourpassword
> INFO
> SLOWLOG GET
> CLIENT LIST
```

### Copy Files
```bash
# Copy logs from container
docker cp mtaa-redis:/data/appendonly.aof ./

# Copy config from container
docker cp mtaa-redis:/usr/local/etc/redis/redis.conf ./redis.conf.backup
```

### Resource Testing
```bash
# Test memory limit
docker run -d \
  --name redis-test \
  -m 128m \
  redis:7-alpine \
  redis-server

# Stress test
docker exec redis-test redis-benchmark -n 100000
```

---

## ✅ Health Check Verification Script

Create `check-redis-health.sh`:
```bash
#!/bin/bash

CONTAINER_NAME="mtaa-redis"
REDIS_PASSWORD="yourpassword"

echo "=== Redis Docker Health Check ==="

# Check if container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Container '$CONTAINER_NAME' does not exist"
    exit 1
fi

# Check if running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "⚠️  Container '$CONTAINER_NAME' is not running"
    echo "Starting container..."
    docker start "$CONTAINER_NAME"
    sleep 5
fi

# Check health status
HEALTH=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}')
echo "Health Status: $HEALTH"

# Test connection
echo -n "Testing connection... "
if docker exec "$CONTAINER_NAME" redis-cli -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
    echo "✅ PONG"
else
    echo "❌ Failed"
    exit 1
fi

# Check memory
echo -n "Memory usage: "
docker exec "$CONTAINER_NAME" redis-cli -a "$REDIS_PASSWORD" INFO memory | grep used_memory_human

# Check clients
echo -n "Connected clients: "
docker exec "$CONTAINER_NAME" redis-cli -a "$REDIS_PASSWORD" INFO clients | grep connected_clients

# Check keys
echo -n "Total keys: "
docker exec "$CONTAINER_NAME" redis-cli -a "$REDIS_PASSWORD" DBSIZE | grep keys

echo "✅ All checks passed!"
```

Run it:
```bash
chmod +x check-redis-health.sh
./check-redis-health.sh
```

---

## 📈 Scaling with Docker Compose

### Multiple Redis Instances
```yaml
services:
  redis-primary:
    image: redis:7-alpine
    command: redis-server /usr/local/etc/redis/redis.conf
    volumes:
      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis-primary-data:/data
    ports:
      - "127.0.0.1:6379:6379"
    networks:
      - mtaa-network

  redis-replica:
    image: redis:7-alpine
    command: redis-server /usr/local/etc/redis/redis.conf --replicaof redis-primary 6379
    depends_on:
      - redis-primary
    volumes:
      - ./redis-replica.conf:/usr/local/etc/redis/redis.conf:ro
      - redis-replica-data:/data
    ports:
      - "127.0.0.1:6380:6379"
    networks:
      - mtaa-network

volumes:
  redis-primary-data:
  redis-replica-data:

networks:
  mtaa-network:
    driver: bridge
```

---

## 🎯 Summary

| Task | Command |
|------|---------|
| Start Redis | `docker-compose up -d redis` |
| Check status | `docker ps \| grep redis` |
| View logs | `docker logs -f mtaa-redis` |
| Test connection | `docker exec mtaa-redis redis-cli -a password ping` |
| Check health | `docker inspect mtaa-redis --format='{{.State.Health.Status}}'` |
| Stop Redis | `docker-compose down` |
| Restart Redis | `docker restart mtaa-redis` |
| Memory usage | `docker stats mtaa-redis` |
| Backup data | `docker cp mtaa-redis:/data ./redis-backup` |

---

**Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Production-Ready
