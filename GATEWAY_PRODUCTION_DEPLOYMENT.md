# Gateway Agent Production Guide

Complete implementation guide for deploying the Gateway Agent to production.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Monitoring](#monitoring)
7. [Security](#security)
8. [Performance Tuning](#performance-tuning)
9. [Troubleshooting](#troubleshooting)
10. [API Reference](#api-reference)

## Overview

The Gateway Agent is a production-grade system for aggregating, normalizing, and securing external API data. It integrates with:

- **6 API Adapters**: Chainlink, Uniswap, CoinGecko, Moola, Beefyfi, Blockchain
- **Message Bus**: Coordinator pattern for inter-agent communication
- **Cache Layer**: Redis-backed with TTL strategies
- **Security Layer**: ELD-SCRY (risk) + ELD-LUMEN (ethics)
- **REST API**: 7 endpoints for data access
- **WebSocket**: Real-time streaming with subscriptions

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Client Applications                     │
│              (REST API / WebSocket / Message Bus)        │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐  ┌───▼────┐  ┌──▼──────┐
    │ REST    │  │ WS     │  │ Message │
    │ Routes  │  │Server  │  │ Bus     │
    └────┬────┘  └───┬────┘  └──┬──────┘
         │           │          │
         └───────────┼──────────┘
                     │
         ┌───────────▼───────────┐
         │  Security Wrapper     │
         │ (ELD-SCRY, ELD-LUMEN) │
         └───────────┬───────────┘
                     │
         ┌───────────▼────────────────┐
         │  Gateway Agent Service     │
         └───────────┬────────────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
   ┌──▼──┐      ┌────▼────┐   ┌────▼────┐
   │Data │      │Normaliz │   │ Circuit  │
   │Norm │      │ er      │   │ Breaker  │
   └──┬──┘      └────┬────┘   └────┬────┘
      │              │              │
      │     ┌────────┴──────────┐   │
      │     │                   │   │
   ┌──▼──┐ ┌▼────┐ ┌──────┐    │   │
   │Cache│ │Adapt│ │Adapt │    │   │
   │Mgr  │ │  1  │ │  2   │..  │   │
   └──┬──┘ └┬────┘ └──────┘    │   │
      │     │        (6 total)  │   │
      │     └────────┬─────────┘    │
      │              │              │
      └──────────────┼──────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
    ┌───▼────┐           ┌───────▼──┐
    │ Redis  │           │ External │
    │ Cache  │           │ APIs     │
    └────────┘           └──────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|-----------------|
| **REST Routes** | HTTP endpoints for data requests |
| **WebSocket Server** | Real-time subscription management |
| **Message Bus** | Inter-agent communication |
| **Security Wrapper** | ELD-SCRY + ELD-LUMEN assessment |
| **Gateway Service** | Orchestration and request routing |
| **Data Normalizer** | Format conversion and standardization |
| **Cache Manager** | Redis storage with TTL |
| **Circuit Breaker** | Adapter health monitoring |
| **Adapters** | External API integration |

## Installation

### Prerequisites

```bash
# Node.js 20+
node --version

# Redis 6.0+
redis-cli ping

# Environment
export NODE_ENV=production
```

### Package Installation

```bash
# Install dependencies
npm install

# Production build
npm run build

# Verify build
npm run test
```

### Environment Setup

Create `.env.production`:

```env
# Gateway Configuration
GATEWAY_ENABLED=true
GATEWAY_MODE=production

# API Keys
CHAINLINK_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
UNISWAP_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/...
COINGECKO_API_KEY=your-api-key
MOOLA_RPC_URL=https://...
BEEFYFI_API_URL=https://api.beefy.finance
BLOCKCHAIN_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...

# Cache Configuration
REDIS_URL=redis://localhost:6379
CACHE_ENABLED=true
CACHE_TTL_PRICE=60
CACHE_TTL_APY=3600
CACHE_TTL_RISK=7200

# Security
SECURITY_ENABLED=true
SECURITY_RISK_THRESHOLD=70
SECURITY_ETHICS_THRESHOLD=50
SECURITY_STRICT_MODE=false

# Message Bus
COORDINATOR_ENABLED=true
MESSAGE_BUS_TIMEOUT=5000

# WebSocket
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=3001
CORS_ORIGIN=https://your-frontend.com

# Monitoring
MONITORING_ENABLED=true
PROMETHEUS_PORT=9090
LOG_LEVEL=info
```

## Configuration

### Default Configuration

```typescript
// Production defaults
{
  adapters: {
    chainlink: { priority: 1, enabled: true, timeout: 5000 },
    uniswap: { priority: 2, enabled: true, timeout: 10000 },
    coingecko: { priority: 3, enabled: true, timeout: 8000 },
    moola: { priority: 4, enabled: true, timeout: 10000 },
    beefyfi: { priority: 5, enabled: true, timeout: 8000 },
    blockchain: { priority: 6, enabled: true, timeout: 15000 },
  },
  cache: {
    enabled: true,
    ttl: { price: 60, liquidity: 300, apy: 3600, risk: 7200 },
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  },
  security: {
    enableScry: true,
    enableLumen: true,
    riskThreshold: 70,
    ethicsThreshold: 50,
  },
}
```

### Runtime Configuration Update

```typescript
import { getGatewayAgentService } from './gateway/service';

const service = getGatewayAgentService();
const status = service.getStatus();

// Update security thresholds
service.updateSecurityConfig({
  riskThreshold: 60,
  ethicsThreshold: 70,
});
```

## Deployment

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000 3001 9090

CMD ["npm", "run", "start:production"]
```

```bash
# Build image
docker build -t gateway-agent:latest .

# Run container
docker run \
  --env-file .env.production \
  -p 3000:3000 \
  -p 3001:3001 \
  -p 9090:9090 \
  --link redis:redis \
  gateway-agent:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  gateway:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
      - "9090:9090"
    environment:
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs

  prometheus:
    image: prom/prometheus
    ports:
      - "9091:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin

volumes:
  redis-data:
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gateway-agent
  template:
    metadata:
      labels:
        app: gateway-agent
    spec:
      containers:
      - name: gateway-agent
        image: gateway-agent:latest
        ports:
        - containerPort: 3000
        - containerPort: 3001
        env:
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: gateway-config
              key: redis-url
        - name: NODE_ENV
          value: production
        livenessProbe:
          httpGet:
            path: /api/v1/gateway/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/v1/gateway/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

## Monitoring

### Health Checks

```bash
# REST endpoint
curl http://localhost:3000/api/v1/gateway/health

# Expected response
{
  "success": true,
  "data": {
    "healthy": true,
    "uptime": 3600,
    "timestamp": "2025-11-15T10:00:00Z"
  }
}
```

### Metrics Endpoint

```bash
# Prometheus metrics
curl http://localhost:9090/metrics

# Includes:
# - gateway_request_duration_seconds
# - gateway_adapter_failures_total
# - gateway_cache_hits_total
# - gateway_cache_misses_total
# - gateway_security_denials_total
```

### Logging

```bash
# View logs
tail -f logs/gateway.log

# Filter by level
grep ERROR logs/gateway.log
grep WARN logs/gateway.log

# Real-time monitoring
npm run logs:tail
```

### Alerting Rules

```yaml
groups:
  - name: gateway-agent
    rules:
    - alert: GatewayHighErrorRate
      expr: rate(gateway_errors_total[5m]) > 0.1
      for: 5m
      annotations:
        summary: "Gateway error rate > 10%"

    - alert: GatewayAdapterDown
      expr: gateway_adapter_health{healthy="false"} > 0
      for: 2m
      annotations:
        summary: "Adapter {{ $labels.adapter }} is down"

    - alert: GatewayCacheMissRate
      expr: rate(gateway_cache_misses_total[5m]) / rate(gateway_cache_requests_total[5m]) > 0.8
      for: 10m
      annotations:
        summary: "Cache miss rate > 80%"

    - alert: GatewaySecurityDenials
      expr: rate(gateway_security_denials_total[5m]) > 0.05
      for: 5m
      annotations:
        summary: "High security denial rate"
```

## Security

### TLS/SSL

```typescript
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('/etc/ssl/private/key.pem'),
  cert: fs.readFileSync('/etc/ssl/certs/cert.pem'),
};

https.createServer(options, app).listen(3000);
```

### Authentication

```typescript
import { authenticate } from './middleware/auth';

app.use('/api/v1/gateway', authenticate);
```

### Rate Limiting

```bash
# Default: 100 requests per minute per user
# Configure in environment
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

### Security Headers

```typescript
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('Strict-Transport-Security', 'max-age=31536000');
  next();
});
```

## Performance Tuning

### Cache Optimization

```typescript
// Adjust TTLs based on data stability
const cacheConfig = {
  ttl: {
    price: 60,        // 1 minute (volatile)
    liquidity: 300,   // 5 minutes
    apy: 3600,       // 1 hour (stable)
    risk: 7200,      // 2 hours (very stable)
  },
};
```

### Connection Pooling

```typescript
// Redis connection pooling
const redis = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 },
], {
  options: {
    maxRetriesPerRequest: 3,
    retryDelayBase: 10,
    dnsLookup: 'systemDns',
  },
});
```

### Load Balancing

```yaml
# Nginx configuration
upstream gateway_backend {
  server gateway1:3000;
  server gateway2:3000;
  server gateway3:3000;
  keepalive 32;
}

server {
  listen 80;
  server_name gateway.example.com;

  location /api/v1/gateway/ {
    proxy_pass http://gateway_backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
  }
}
```

## Troubleshooting

### Adapter Failures

```bash
# Check adapter status
curl http://localhost:3000/api/v1/gateway/health

# View adapter metrics
curl http://localhost:3000/api/v1/gateway/stats

# Check logs for specific adapter
grep "ChainlinkAdapter" logs/gateway.log
```

### Cache Issues

```bash
# Check cache hit rate
curl http://localhost:3000/api/v1/gateway/stats | jq '.cacheStats'

# Clear cache if needed
POST http://localhost:3000/api/v1/gateway/invalidate-cache
{
  "type": "*"
}

# Monitor Redis
redis-cli MONITOR
```

### Security Denials

```bash
# Check security statistics
curl http://localhost:3000/api/v1/gateway/security-stats

# Review denials
grep "Access denied" logs/gateway.log

# Adjust thresholds if needed
export SECURITY_RISK_THRESHOLD=75
```

### Performance Issues

```bash
# Check adapter response times
curl http://localhost:3000/api/v1/gateway/stats | jq '.adapters'

# Monitor CPU/Memory
docker stats gateway-agent

# Check connection pool
redis-cli CLIENT LIST
```

## API Reference

### REST Endpoints

#### GET /api/v1/gateway/prices
Fetch cryptocurrency prices

```bash
curl "http://localhost:3000/api/v1/gateway/prices?symbols=ETH,BTC&chains=ethereum"
```

Response:
```json
{
  "success": true,
  "data": {
    "ETH": { "price": 2500, "currency": "USD", "timestamp": "2025-11-15T10:00:00Z" },
    "BTC": { "price": 52000, "currency": "USD", "timestamp": "2025-11-15T10:00:00Z" }
  },
  "timestamp": "2025-11-15T10:00:00Z",
  "requestId": "req-123"
}
```

#### GET /api/v1/gateway/liquidity
Fetch DEX liquidity data

```bash
curl "http://localhost:3000/api/v1/gateway/liquidity?protocols=uniswap,aave&chain=ethereum"
```

#### GET /api/v1/gateway/apy
Fetch protocol APY/yields

```bash
curl "http://localhost:3000/api/v1/gateway/apy?protocols=aave,compound"
```

#### GET /api/v1/gateway/risk
Fetch protocol risk assessments

```bash
curl "http://localhost:3000/api/v1/gateway/risk?protocols=aave,compound"
```

#### GET /api/v1/gateway/health
Service health check

```bash
curl http://localhost:3000/api/v1/gateway/health
```

#### GET /api/v1/gateway/stats
Service statistics

```bash
curl http://localhost:3000/api/v1/gateway/stats
```

#### POST /api/v1/gateway/invalidate-cache
Clear cache by pattern

```bash
curl -X POST http://localhost:3000/api/v1/gateway/invalidate-cache \
  -H "Content-Type: application/json" \
  -d '{"pattern": "price:*"}'
```

### WebSocket Events

```typescript
const socket = io('http://localhost:3001', {
  auth: { token: 'jwt-token', userId: 'user-123' }
});

// Subscribe to prices
socket.emit('gateway:subscribe_prices', {
  symbols: ['ETH', 'BTC'],
  chains: ['ethereum'],
});

// Listen for updates
socket.on('gateway:prices_update', (data) => {
  console.log('Price update:', data);
});
```

## Scaling Considerations

### Horizontal Scaling

- Deploy 3+ instances behind load balancer
- Use Redis Cluster for cache
- Enable connection pooling
- Monitor adapter rate limits

### Vertical Scaling

- Increase worker threads
- Optimize cache TTLs
- Tune garbage collection
- Monitor memory usage

### Cost Optimization

- Use free tier APIs where possible (CoinGecko)
- Batch requests to reduce API calls
- Optimize cache hit rate
- Monitor bandwidth usage

## Maintenance

### Regular Tasks

- Weekly: Review error logs and metrics
- Monthly: Update dependencies
- Quarterly: Performance testing
- Annually: Security audit

### Disaster Recovery

- Backup Redis data hourly
- Document runbooks for common issues
- Test failover procedures
- Maintain incident log

---

**Last Updated**: 2025-11-15
**Version**: 1.0.0
**Status**: Production Ready ✅
