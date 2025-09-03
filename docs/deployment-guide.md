
# MtaaDAO Deployment Guide

## Overview

This guide covers deploying MtaaDAO on Replit, including environment setup, database migrations, monitoring, and maintenance procedures.

## Prerequisites

- Replit account with deployment capabilities
- Basic knowledge of Node.js and PostgreSQL
- Understanding of environment variables and secrets management

## Deployment Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   Database      │
│   (React/Vite)  │───▶│   (Node.js/      │───▶│  (PostgreSQL)   │
│   Port: 80      │    │   Express)       │    │   Port: 5432    │
└─────────────────┘    │   Port: 5000     │    └─────────────────┘
                       └──────────────────┘
                                │
                       ┌──────────────────┐
                       │     Redis        │
                       │   (Caching)      │
                       │   Port: 6379     │
                       └──────────────────┘
```

## Environment Setup

### 1. Environment Variables

Create the following secrets in Replit's Secrets tab:

#### Core Application
```bash
# Application
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://username:password@host:port/database
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=your-refresh-token-secret
REFRESH_TOKEN_EXPIRES_IN=7d

# Blockchain
PRIVATE_KEY=your-wallet-private-key
CELO_RPC_URL=https://alfajores-forno.celo-testnet.org
CELO_NETWORK=alfajores

# External Services
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Monitoring & Logging
LOG_LEVEL=info
METRICS_ENABLED=true

# Security
RATE_LIMIT_ENABLED=true
CORS_ORIGIN=https://your-domain.com

# Backups
BACKUPS_ENABLED=true
BACKUP_LOCATION=./backups
BACKUP_ENCRYPTION_KEY=your-backup-encryption-key
```

### 2. Database Setup

#### PostgreSQL Configuration

1. **Create Database:**
   ```sql
   CREATE DATABASE mtaadao;
   CREATE USER mtaadao_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE mtaadao TO mtaadao_user;
   ```

2. **Run Migrations:**
   ```bash
   npm run db:migrate
   ```

3. **Seed Initial Data (Optional):**
   ```bash
   npm run db:seed
   ```

### 3. Redis Setup (Optional)

If using Redis for caching and session management:

```bash
# Install Redis (if needed)
apt-get update && apt-get install redis-server

# Start Redis
redis-server --daemonize yes
```

## Deployment Steps

### 1. Prepare Application

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Run database migrations
npm run db:migrate

# Run tests (optional)
npm test
```

### 2. Configure Replit Deployment

Update `.replit` file:

```ini
[deployment]
deploymentTarget = "autoscale"
run = ["npm", "run", "start"]
build = ["npm", "run", "build"]

[[ports]]
localPort = 5000
externalPort = 80
```

### 3. Deploy

#### Manual Deployment
```bash
# From Replit console
npm run deploy
```

#### Automatic Deployment
Configure GitHub integration in Replit to automatically deploy on push to main branch.

## Post-Deployment Configuration

### 1. Health Checks

Verify deployment success:

```bash
# Basic health check
curl https://your-repl-url.replit.app/api/health

# Detailed health check
curl https://your-repl-url.replit.app/api/health/detailed
```

### 2. Database Verification

```bash
# Check database connection
npm run db:check

# Verify tables exist
npm run db:verify
```

### 3. Security Verification

- [ ] HTTPS enabled
- [ ] Rate limiting active
- [ ] CORS properly configured
- [ ] Authentication working
- [ ] Input sanitization active

## Monitoring Setup

### 1. Application Monitoring

The application includes built-in monitoring:

- **Health Checks**: `/api/health/*`
- **Metrics**: `/api/monitoring/*`
- **Alerts**: Automatic alert generation

### 2. External Monitoring (Recommended)

Set up external monitoring services:

#### Uptime Monitoring
- **UptimeRobot**: Monitor `/api/health` endpoint
- **Pingdom**: Monitor critical user flows

#### Performance Monitoring
- **New Relic**: Application performance monitoring
- **DataDog**: Infrastructure monitoring

#### Log Management
- **LogTail**: Centralized log management
- **Papertrail**: Real-time log monitoring

### 3. Monitoring Dashboard

Access the built-in monitoring dashboard:
```
https://your-repl-url.replit.app/api/monitoring/dashboard
```

## Backup and Recovery

### 1. Automated Backups

Backups are configured automatically if `BACKUPS_ENABLED=true`:

- **Schedule**: Daily at 2 AM UTC
- **Retention**: 30 days
- **Encryption**: Enabled if `BACKUP_ENCRYPTION_KEY` is set

### 2. Manual Backup

```bash
# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Application files backup
tar -czf app_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=logs \
  .
```

### 3. Recovery Procedures

#### Database Recovery
```bash
# Restore from backup
psql $DATABASE_URL < backup_file.sql

# Re-run migrations if needed
npm run db:migrate
```

#### Application Recovery
```bash
# Extract backup
tar -xzf app_backup_file.tar.gz

# Reinstall dependencies
npm install

# Rebuild application
npm run build

# Restart services
npm run start
```

## Maintenance Procedures

### 1. Regular Maintenance Tasks

#### Daily
- [ ] Check application health
- [ ] Review error logs
- [ ] Verify backup completion

#### Weekly
- [ ] Update dependencies
- [ ] Review performance metrics
- [ ] Check disk space usage

#### Monthly
- [ ] Security audit
- [ ] Database optimization
- [ ] Cleanup old logs/backups

### 2. Update Procedures

```bash
# 1. Backup current version
npm run backup

# 2. Pull latest changes
git pull origin main

# 3. Install new dependencies
npm install

# 4. Run migrations
npm run db:migrate

# 5. Build application
npm run build

# 6. Run tests
npm test

# 7. Deploy
npm run deploy

# 8. Verify deployment
curl https://your-repl-url.replit.app/api/health
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check database status
npm run db:check

# Test connection manually
psql $DATABASE_URL -c "SELECT version();"
```

#### 2. Memory Issues
```bash
# Check memory usage
free -h

# Restart application
npm run restart
```

#### 3. Performance Issues
```bash
# Check performance metrics
curl https://your-repl-url.replit.app/api/monitoring/performance

# Review slow queries
npm run db:slow-queries
```

### Log Analysis

#### Application Logs
```bash
# View recent logs
tail -f logs/app.log

# Search for errors
grep -i error logs/app.log

# Filter by timestamp
grep "2024-01-15" logs/app.log
```

#### Database Logs
```bash
# PostgreSQL logs location
tail -f /var/log/postgresql/postgresql-*.log
```

## Security Considerations

### 1. Regular Security Checks

- [ ] Keep dependencies updated
- [ ] Regular security audits
- [ ] Monitor for vulnerabilities
- [ ] Review access logs

### 2. Security Headers

Verify security headers are properly set:
```bash
curl -I https://your-repl-url.replit.app/
```

Should include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

### 3. Rate Limiting

Monitor rate limiting effectiveness:
```bash
# Check rate limit stats
curl https://your-repl-url.replit.app/api/monitoring/rate-limits
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Regular maintenance
VACUUM ANALYZE;

-- Index usage analysis
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;

-- Query performance
EXPLAIN ANALYZE SELECT * FROM your_table WHERE condition;
```

### 2. Application Optimization

- Enable gzip compression
- Implement proper caching
- Optimize database queries
- Use connection pooling
- Minimize bundle sizes

### 3. Monitoring Performance

Regular performance monitoring:
```bash
# Application metrics
curl https://your-repl-url.replit.app/api/monitoring/performance

# System metrics
htop
iostat
```

## Scaling Considerations

As your application grows, consider:

1. **Database Scaling**
   - Read replicas
   - Connection pooling
   - Query optimization

2. **Application Scaling**
   - Load balancing
   - Horizontal scaling
   - Caching layers

3. **Resource Monitoring**
   - CPU/Memory usage
   - Disk space
   - Network bandwidth

## Support and Resources

- **Documentation**: [https://docs.mtaadao.org](https://docs.mtaadao.org)
- **Replit Support**: [https://replit.com/support](https://replit.com/support)
- **Community**: [Discord](https://discord.gg/mtaadao)

## Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Tests passing
- [ ] Security review completed
- [ ] Backup procedures tested

### Deployment
- [ ] Application built successfully
- [ ] Database migrated
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] SSL certificate valid

### Post-Deployment
- [ ] Functionality verified
- [ ] Performance acceptable
- [ ] Monitoring active
- [ ] Alerts configured
- [ ] Documentation updated

This guide provides comprehensive coverage of deploying MtaaDAO on Replit. Follow these procedures carefully to ensure a successful and secure deployment.
