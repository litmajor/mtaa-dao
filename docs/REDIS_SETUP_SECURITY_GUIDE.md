# Redis Setup & Security Guide for MTAA-DAO

## 📋 Quick Start

### 1. Basic Setup
```bash
# Windows (using WSL or native Redis)
redis-server redis.conf

# Linux/Mac
redis-server /path/to/redis.conf
```

### 2. Verify Connection
```bash
redis-cli -a yourpassword INFO server
```

---

## 🔒 Security Configuration

### Step 1: Set Strong Password
Edit `redis.conf`:
```conf
requirepass your_very_strong_password_here_123!@#
```

### Step 2: Update Application Connection
In your Node.js app (assuming you use node-redis or ioredis):

#### Using ioredis:
```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  password: 'your_very_strong_password_here_123!@#',
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true; // Reconnect if READONLY error
    }
    return false;
  }
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

export default redis;
```

#### Using redis (native driver):
```typescript
import { createClient } from 'redis';

const redis = createClient({
  host: '127.0.0.1',
  port: 6379,
  password: 'your_very_strong_password_here_123!@#',
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

await redis.connect();

export default redis;
```

### Step 3: Firewall Configuration

#### Windows Defender Firewall
```powershell
# Allow Redis on localhost only (inbound rule)
New-NetFirewallRule -DisplayName "Redis Local" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 6379 `
  -RemoteAddress 127.0.0.1

# Or restrict to specific IP range
New-NetFirewallRule -DisplayName "Redis Internal" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 6379 `
  -RemoteAddress 192.168.1.0/24
```

#### Linux (UFW)
```bash
# Allow Redis only from localhost
sudo ufw allow from 127.0.0.1 to 127.0.0.1 port 6379

# Or allow from internal network
sudo ufw allow from 192.168.1.0/24 to any port 6379
```

#### Docker Network
```yaml
services:
  redis:
    image: redis:7-alpine
    networks:
      - internal
    # Only accessible to other containers in 'internal' network

networks:
  internal:
    driver: bridge
    internal: true  # No external access
```

### Step 4: ACL Configuration (Redis 6.0+)

Create `aclfile`:
```
# Default user (disable it)
user default on >your_strong_password ~* &* +@all -@admin

# Application user (limited permissions)
user app-mtaa on >app_password ~* &* +get +set +del +incr +lpush +rpush +lpop +rpop +sadd +smembers +zadd +zrange

# Admin user (for maintenance)
user admin on >admin_password ~* &* +@all

# Monitoring user (read-only)
user monitor on >monitor_password ~* &* +info +slowlog +client +config|get
```

Reference in `redis.conf`:
```conf
aclfile ./aclfile
```

---

## 📊 Monitoring Redis

### Check Server Status
```bash
# Check if Redis is running
redis-cli -a yourpassword ping
# Response: PONG

# Get server info
redis-cli -a yourpassword INFO server

# Get memory stats
redis-cli -a yourpassword INFO memory

# Get client connection info
redis-cli -a yourpassword INFO clients

# Get keyspace info
redis-cli -a yourpassword INFO keyspace

# Get persistence stats
redis-cli -a yourpassword INFO persistence
```

### Monitor Connections in Real-Time
```bash
# Watch commands as they execute
redis-cli -a yourpassword MONITOR

# Check connected clients
redis-cli -a yourpassword CLIENT LIST

# See client details
redis-cli -a yourpassword CLIENT INFO
```

### Check Slow Log
```bash
# Get slow queries
redis-cli -a yourpassword SLOWLOG GET 10

# Get slow log length
redis-cli -a yourpassword SLOWLOG LEN

# Reset slow log
redis-cli -a yourpassword SLOWLOG RESET
```

### Memory Monitoring
```bash
# Get detailed memory breakdown
redis-cli -a yourpassword INFO memory

# Check eviction policy
redis-cli -a yourpassword CONFIG GET maxmemory-policy

# Set max memory (if not in config)
redis-cli -a yourpassword CONFIG SET maxmemory 256mb
redis-cli -a yourpassword CONFIG SET maxmemory-policy allkeys-lru
```

### AOF/RDB Status
```bash
# Check AOF status
redis-cli -a yourpassword INFO persistence

# Force rewrite AOF
redis-cli -a yourpassword BGREWRITEAOF

# Get RDB save progress
redis-cli -a yourpassword LASTSAVE
```

---

## 🚀 Startup Scripts

### Windows PowerShell Script
Create `start-redis.ps1`:
```powershell
# Redis Startup Script for Windows
param(
    [string]$ConfigPath = ".\redis.conf",
    [string]$RedisPath = "C:\Program Files\Redis\redis-server.exe"
)

# Check if config exists
if (-not (Test-Path $ConfigPath)) {
    Write-Host "Config file not found: $ConfigPath" -ForegroundColor Red
    exit 1
}

# Check if Redis executable exists
if (-not (Test-Path $RedisPath)) {
    Write-Host "Redis executable not found: $RedisPath" -ForegroundColor Red
    Write-Host "Install Redis from: https://github.com/microsoftarchive/redis/releases"
    exit 1
}

Write-Host "Starting Redis with config: $ConfigPath" -ForegroundColor Green

# Start Redis
& $RedisPath $ConfigPath

# If Redis exits, show error
if ($LASTEXITCODE -ne 0) {
    Write-Host "Redis failed to start. Check the config file." -ForegroundColor Red
    exit $LASTEXITCODE
}
```

Run it:
```powershell
.\start-redis.ps1 -ConfigPath ".\redis.conf"
```

### Linux/Mac Bash Script
Create `start-redis.sh`:
```bash
#!/bin/bash

CONFIG_PATH="${1:-.}/redis.conf"
REDIS_PORT="${2:-6379}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if config exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo -e "${RED}Config file not found: $CONFIG_PATH${NC}"
    exit 1
fi

# Check if Redis is already running
if redis-cli -p $REDIS_PORT ping > /dev/null 2>&1; then
    echo -e "${YELLOW}Redis is already running on port $REDIS_PORT${NC}"
    exit 0
fi

echo -e "${GREEN}Starting Redis on port $REDIS_PORT with config: $CONFIG_PATH${NC}"

# Start Redis
redis-server "$CONFIG_PATH"

# Check exit code
if [ $? -ne 0 ]; then
    echo -e "${RED}Redis failed to start. Check the config file.${NC}"
    exit 1
fi
```

Run it:
```bash
chmod +x start-redis.sh
./start-redis.sh ./redis.conf 6379
```

### Docker Compose
Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: mtaa-redis
    ports:
      - "127.0.0.1:6379:6379"  # Only localhost
    volumes:
      - ./redis.conf:/usr/local/etc/redis/redis.conf
      - redis-data:/data
    command: redis-server /usr/local/etc/redis/redis.conf
    networks:
      - mtaa-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "yourpassword", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
    environment:
      - REDIS_PASSWORD=yourpassword
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Example: Your Node.js app
  api:
    image: mtaa-api:latest
    depends_on:
      redis:
        condition: service_healthy
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=yourpassword
    networks:
      - mtaa-network
    restart: unless-stopped

networks:
  mtaa-network:
    driver: bridge
    internal: false

volumes:
  redis-data:
    driver: local
```

Start with:
```bash
docker-compose up -d redis
docker-compose logs -f redis
```

---

## 🔧 Persistence Setup

### AOF (Append Only File) - Recommended
```conf
appendonly yes
appendfsync everysec
appendfilename "appendonly.aof"
```

**Pros:**
- More durable (records every operation)
- Can recover from crashes with minimal data loss
- Human-readable log

**Cons:**
- Larger file size
- Slightly slower writes

### RDB (Snapshots)
```conf
save 60 10000      # Save every 60s if 10k changes
rdbcompression yes
dbfilename dump.rdb
```

**Pros:**
- Faster startup
- Smaller file size
- Better for backups

**Cons:**
- Can lose data between snapshots
- Blocking save operation (BGSAVE mitigates this)

### Both (Recommended for Production)
Use both AOF and RDB:
- AOF for durability (everysec fsync)
- RDB for backups and faster restarts

```conf
# RDB snapshots
save 60 10000

# AOF
appendonly yes
appendfsync everysec
```

---

## 🐛 Troubleshooting

### Redis Won't Start
```bash
# Check syntax errors in config
redis-server --check-system redis.conf

# Start with verbose logging
redis-server redis.conf --loglevel debug

# Check specific port is available
netstat -an | grep 6379
```

### Connection Refused
```bash
# Verify Redis is running
redis-cli ping

# Check if localhost binding is correct
grep "^bind" redis.conf

# Try connecting to different host
redis-cli -h 127.0.0.1 -p 6379 ping

# Check firewall
netstat -an | grep LISTEN | grep 6379
```

### High Memory Usage
```bash
# Check memory stats
redis-cli INFO memory

# Set maxmemory limit
redis-cli CONFIG SET maxmemory 256mb

# Set eviction policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Check if memory limit is set
redis-cli CONFIG GET maxmemory
```

### Slow Performance
```bash
# Check slow log
redis-cli SLOWLOG GET 10

# Identify hot keys
redis-cli --bigkeys

# Check latency
redis-cli LATENCY LATEST

# Monitor in real-time
redis-cli MONITOR
```

### AOF Corruption
```bash
# Check AOF integrity
redis-check-aof --fix appendonly.aof

# Restore from RDB backup
rm appendonly.aof
redis-cli BGSAVE
# Then restart Redis
```

---

## 📈 Performance Tuning

### For High-Throughput Applications
```conf
# Increase buffer sizes
client-output-buffer-limit normal 0 0 0

# Tune kernel parameters (Linux)
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# Use pipelining in application
# Each operation batched reduces latency
```

### For Memory-Constrained Environments
```conf
# Set memory limit
maxmemory 128mb

# Use LRU eviction
maxmemory-policy allkeys-lru

# Compress snapshots
rdbcompression yes

# Reduce persistence frequency
save 300 10     # Save every 5 min if 10 changes
```

### For Durability
```conf
# Aggressive AOF
appendonly yes
appendfsync always    # Sync every write (safest, slowest)

# Keep multiple backups
# Implement external backup strategy
```

---

## 🔐 Security Checklist

- [ ] Set strong password (requirepass)
- [ ] Use ACL for granular permissions
- [ ] Bind to localhost or specific IPs
- [ ] Firewall rules configured
- [ ] AOF persistence enabled
- [ ] Regular backups scheduled
- [ ] Monitor slow logs
- [ ] Update Redis regularly
- [ ] Use TLS for remote connections
- [ ] Disable dangerous commands (FLUSHALL, FLUSHDB)

---

## 📝 Environment Variables

Store sensitive values in `.env`:
```
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your_very_strong_password_here_123!@#
REDIS_DB=0
REDIS_TIMEOUT=5000
```

Load in application:
```typescript
import dotenv from 'dotenv';
dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => Math.min(times * 50, 2000),
};
```

---

## 🎯 Common Commands Reference

```bash
# Connection
redis-cli -h 127.0.0.1 -p 6379 -a password
redis-cli -a password INFO

# Server
PING                      # Test connection
INFO                      # Server information
CONFIG GET *              # Get all config
CONFIG SET key value      # Change config
SHUTDOWN                  # Graceful shutdown

# Data
SET key value             # Set key
GET key                   # Get key
DEL key                   # Delete key
EXISTS key                # Check existence
FLUSHDB                   # Clear current DB (be careful!)

# Lists
LPUSH key value           # Add to head
RPUSH key value           # Add to tail
LPOP key                  # Remove from head
RPOP key                  # Remove from tail

# Monitoring
SLOWLOG GET 10            # Get slow queries
SLOWLOG LEN               # Slow log size
CLIENT LIST               # Connected clients
MONITOR                   # Watch all commands

# Persistence
SAVE                      # Synchronous save
BGSAVE                    # Background save
LASTSAVE                  # Last save time
BGREWRITEAOF              # Rewrite AOF
```

---

## 📚 Additional Resources

- [Redis Official Documentation](https://redis.io/docs/)
- [Redis Configuration Reference](https://redis.io/docs/management/config/)
- [Redis Security](https://redis.io/docs/management/security/)
- [Redis Persistence](https://redis.io/docs/management/persistence/)

---

**Last Updated:** January 2026  
**Version:** 1.0  
**Status:** Production-Ready
