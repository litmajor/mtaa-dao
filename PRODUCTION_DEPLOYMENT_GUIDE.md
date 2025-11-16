# MtaaDAO Production Deployment Guide

## Table of Contents
1. [Project Structure](#project-structure)
2. [Pre-Deployment Setup](#pre-deployment-setup)
3. [Deployment Steps](#deployment-steps)
4. [Production Hardening](#production-hardening)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Troubleshooting](#troubleshooting)

---

## Project Structure

```
mtaa-dao/
├── .github/workflows/           # CI/CD workflows
│   ├── ci.yml                   # Build, lint, test workflow
│   └── deploy.yml               # Production deployment workflow
│
├── .gitignore
├── .env.production.example      # Template for production env vars
│
├── config/                      # Configuration files
│   └── redis.conf               # Redis production config
│
├── monitoring/                  # Monitoring & observability
│   ├── prometheus.yml           # Prometheus scrape config
│   ├── prometheus-rules.yml     # Alert rules
│   └── grafana/
│       ├── provisioning/
│       │   ├── dashboards/      # Dashboard definitions
│       │   └── datasources/     # Data source configs
│
├── src/
│   ├── lib/
│   │   └── redis.ts             # Redis client wrapper
│   ├── monitoring/
│   │   └── metrics.ts           # Prometheus metrics
│   ├── scripts/
│   │   ├── migrate.ts           # Database migrations
│   │   └── seed.ts              # Database seeding
│   └── ... (other source files)
│
├── tests/
│   ├── PRODUCTION_CHECKLIST.md  # Test checklist
│   ├── unit.test.template.ts    # Unit test template
│   ├── e2e.test.template.ts     # E2E test template
│   └── load-test.k6.js          # k6 load testing script
│
├── docker-compose.yml           # Multi-container setup (production)
├── DockerFile.backend.prod      # Backend Dockerfile
├── DockerFile.frontend.prod     # Frontend Dockerfile
├── nginx.conf.prod              # NGINX configuration
├── drizzle.config.ts            # Drizzle ORM config
├── package.json
└── README.md
```

---

## Pre-Deployment Setup

### 1. Infrastructure Requirements

**Minimum Production Setup:**
- 2 CPU cores
- 4GB RAM
- 50GB disk space
- Network: public-facing reverse proxy with HTTPS

**Recommended Production Setup:**
- 4+ CPU cores
- 8GB+ RAM
- 100GB+ disk space
- Load balancer
- Automated backups
- CDN for static assets

### 2. Environment Configuration

#### Create `.env.production` from template:

```bash
cp .env.production.example .env.production
```

#### Edit `.env.production` with production values:

```env
# Database
DB_NAME=mtaadao_prod
DB_USER=mtaa_prod_user
DB_PASSWORD=<generate-strong-password>
DB_HOST=db
DB_PORT=5432

# API
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

# Redis
REDIS_URL=redis://:change_me_in_production@redis:6379
REDIS_PASSWORD=<generate-strong-password>

# JWT Secrets (use strong random strings, min 32 chars)
JWT_SECRET=<generate-using-openssl-rand>
JWT_REFRESH_SECRET=<generate-using-openssl-rand>

# Monitoring
PROMETHEUS_ENABLED=true

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=<generate-strong-password>

# CORS
CORS_ORIGIN=https://yourdomain.com
```

### 3. SSL/TLS Certificates

#### Using Let's Encrypt with Certbot:

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com

# Copy certificates to project
mkdir -p certs
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem certs/key.pem
sudo chown $USER:$USER certs/*.pem
```

#### Auto-renewal cron job:

```bash
# Add to crontab (sudo crontab -e)
0 12 * * * certbot renew --quiet && systemctl reload nginx
```

### 4. Generate Secrets

```bash
# Generate JWT secret (use in .env.production)
openssl rand -base64 32

# Generate strong passwords
openssl rand -base64 16
```

---

## Deployment Steps

### 1. Prepare Server

```bash
# Login to production server
ssh user@prod-server.com

# Create application directory
mkdir -p /srv/mtaadao
cd /srv/mtaadao

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Clone Repository

```bash
# Clone repo
git clone https://github.com/litmajor/mtaa-dao.git .

# Create production environment
cp .env.production.example .env.production
# Edit .env.production with actual values
nano .env.production
```

### 3. Setup SSL Certificates

```bash
# Copy certificates (if using existing ones)
scp -r /path/to/certs user@prod-server.com:/srv/mtaadao/certs/
```

### 4. Build and Start Containers

```bash
# Build Docker images
docker compose build

# Start services
docker compose up -d

# Verify services are running
docker compose ps

# Check logs
docker compose logs -f api
```

### 5. Run Database Migrations

```bash
# Run migrations
docker compose exec api pnpm db:migrate

# Seed initial data (if needed)
docker compose exec api pnpm db:seed

# Verify database
docker compose exec db psql -U mtaa_prod_user -d mtaadao_prod -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

### 6. Verify Services

```bash
# Check API health
curl -s http://localhost:4000/health | jq

# Check Prometheus
curl -s http://localhost:9090/api/v1/targets | jq

# Check Grafana (access via browser)
# http://yourdomain.com:3000 (admin/password)
```

---

## Production Hardening

### 1. Security Best Practices

```bash
# Set proper file permissions
chmod 600 .env.production
chmod 600 certs/key.pem
chmod 644 certs/cert.pem

# Use UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Keep system updated
sudo apt-get update && sudo apt-get upgrade -y
```

### 2. Enable HTTPS Redirect

Update `nginx.conf.prod`:
```nginx
# Uncomment and configure SSL paths
ssl_certificate /etc/nginx/certs/cert.pem;
ssl_certificate_key /etc/nginx/certs/key.pem;
```

### 3. Database Hardening

```bash
# Change default PostgreSQL password
docker compose exec db psql -U postgres -c "ALTER USER mtaa_prod_user WITH PASSWORD 'new_strong_password';"

# Disable PostgreSQL password-less login
docker compose exec db psql -U postgres -c "UPDATE pg_database SET datisconnectable = false WHERE datname = 'template0';"
```

### 4. Backup Strategy

```bash
# Create backup directory
mkdir -p /backups/mtaadao

# Backup script (/backups/backup.sh)
#!/bin/bash
BACKUP_DIR="/backups/mtaadao"
DATE=$(date +%Y%m%d_%H%M%S)

docker compose exec -T db pg_dump -U mtaa_prod_user mtaadao_prod | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"
docker compose exec -T redis redis-cli BGSAVE

echo "Backup completed: $DATE"

# Add to crontab (daily at 2 AM)
# 0 2 * * * /srv/mtaadao/backup.sh
```

### 5. Log Rotation

Create `/etc/logrotate.d/mtaadao`:
```
/var/lib/docker/containers/*/*.log {
  rotate 10
  daily
  compress
  delaycompress
  missingok
  notifempty
}
```

---

## Monitoring & Maintenance

### 1. Access Dashboards

**Grafana:** `https://yourdomain.com:3000`
- Default credentials: admin / (set in .env.production)
- Import pre-built dashboards for Node.js, PostgreSQL, Redis

**Prometheus:** `https://yourdomain.com:9090`
- Query metrics directly
- View alerts status

**pgAdmin:** `https://yourdomain.com:5050` (optional)
- Database management UI

### 2. Monitor Key Metrics

```bash
# API error rate
curl "http://localhost:9090/api/v1/query?query=rate(http_requests_total%7Bstatus%3D~%225..%22%7D%5B5m%5D)"

# Database connections
curl "http://localhost:9090/api/v1/query?query=pg_stat_activity_count"

# Redis memory usage
curl "http://localhost:9090/api/v1/query?query=redis_memory_used_bytes"
```

### 3. Set Up Alerts

Configure alerts in Prometheus for:
- High error rate (> 5%)
- High API latency (> 1s)
- Low disk space (< 10%)
- Database connection pool exhaustion
- Redis memory usage (> 80%)

### 4. Regular Maintenance Tasks

**Weekly:**
- Review logs for errors
- Check disk space
- Verify backups

**Monthly:**
- Update Docker images
- Review and rotate logs
- Performance analysis

**Quarterly:**
- Security audits
- Dependency updates
- Disaster recovery testing

---

## Troubleshooting

### API Container Won't Start

```bash
# Check logs
docker compose logs api

# Common issues:
# - Database connection: verify DB_HOST, DB_USER, DB_PASSWORD
# - Missing env vars: check .env.production
# - Port already in use: check lsof -i :4000
```

### Database Connection Issues

```bash
# Test database connection
docker compose exec api psql $DATABASE_URL -c "SELECT 1;"

# Check PostgreSQL logs
docker compose logs db

# Verify container health
docker inspect mtaadao-db --format='{{.State.Health.Status}}'
```

### Redis Connection Issues

```bash
# Test Redis connection
docker compose exec redis redis-cli ping

# Check Redis memory
docker compose exec redis redis-cli info memory

# Clear Redis cache (if needed)
docker compose exec redis redis-cli FLUSHALL
```

### Performance Issues

```bash
# Check Docker resource usage
docker stats

# Check slow queries
docker compose exec db psql -U mtaa_prod_user -d mtaadao_prod -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check Redis slowlog
docker compose exec redis redis-cli SLOWLOG GET 10
```

### NGINX Not Proxying Correctly

```bash
# Test NGINX config
docker compose exec nginx nginx -t

# Check upstream connectivity
docker compose exec nginx curl -v http://api:4000/health

# Verify logs
docker compose logs nginx
```

### Certificate Issues

```bash
# Check certificate expiry
openssl x509 -in certs/cert.pem -noout -dates

# Renew certificate
sudo certbot renew --force-renewal

# Copy renewed certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem certs/key.pem
docker compose restart nginx
```

---

## Scaling & Load Balancing

### Horizontal Scaling

For multiple API instances:

```yaml
# docker-compose.yml
services:
  api:
    deploy:
      replicas: 3
      
  nginx:
    # Configure upstream with multiple API servers
    upstream api {
      server api:4000;
      server api:4001;
      server api:4002;
    }
```

### Database Replication

For PostgreSQL replication:
- Set up primary-standby replication
- Configure failover with tools like Patroni or repmgr
- Test recovery procedures regularly

---

## Support & Documentation

- **API Documentation:** `/api/v1/docs` (Swagger/OpenAPI)
- **Troubleshooting:** See logs: `docker compose logs -f`
- **Metrics Explorer:** Prometheus at port 9090
- **Dashboard:** Grafana at port 3000

---

**Last Updated:** November 2025
**Version:** 1.0.0
