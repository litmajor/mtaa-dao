# MtaaDAO Production Test Checklists

## A. Backend API Test Checklist

### Core Functionality
- [ ] All routes return correct HTTP status codes (200, 201, 400, 401, 403, 404, 500, etc.)
- [ ] Input validation (Zod/DTOs) rejects invalid requests
- [ ] Error responses include descriptive error messages and error codes
- [ ] Request/response schemas are properly documented
- [ ] API accepts and returns correct Content-Type (application/json)
- [ ] Request IDs are generated and included in responses
- [ ] API versioning strategy is in place (/api/v1/...)

### Authentication & Authorization
- [ ] JWT tokens are validated on protected routes
- [ ] JWT tokens contain correct claims and user information
- [ ] JWT token expiration is enforced
- [ ] Refresh token workflow works correctly
- [ ] Token revocation/blacklisting works
- [ ] Role-based access control (RBAC) is enforced
- [ ] Admin-only endpoints reject non-admin users
- [ ] API keys (if used) are validated and rate-limited per key

### Rate Limiting & Throttling
- [ ] Rate limiting kicks in after configured threshold
- [ ] Rate limit headers are present in responses (X-RateLimit-*)
- [ ] IP-based rate limiting works
- [ ] Per-user rate limiting works
- [ ] Rate limit resets occur correctly
- [ ] Excessive requests return 429 (Too Many Requests)

### Database Integration
- [ ] All database connections use connection pooling
- [ ] Drizzle migrations run cleanly on startup
- [ ] Database schema matches expected structure
- [ ] Foreign key constraints are enforced
- [ ] Unique constraints prevent duplicate entries
- [ ] Timestamps (created_at, updated_at) are properly set
- [ ] Soft deletes work (if implemented)
- [ ] Transaction handling is correct for multi-step operations

### Business Logic - Proposals
- [ ] Proposals can be created with valid data
- [ ] Proposal creation validates required fields
- [ ] Proposal creation requires authentication
- [ ] Proposal creation emits events
- [ ] Proposal status transitions are correct (Draft → Active → Closed)
- [ ] Only proposal creator can edit/delete draft proposals
- [ ] Proposal quorum calculation is correct
- [ ] Proposal voting period duration is enforced

### Business Logic - Voting
- [ ] Users can vote on active proposals only
- [ ] Each user votes only once per proposal
- [ ] Vote counting is accurate
- [ ] Quorum requirements are checked
- [ ] Voting threshold calculations are correct
- [ ] Vote results are stored correctly
- [ ] Votes cannot be cast after voting period ends
- [ ] Vote events are emitted

### Business Logic - Treasury
- [ ] Treasury balance is calculated correctly
- [ ] Treasury transactions are recorded
- [ ] Treasury withdrawals require proper authorization
- [ ] Treasury transaction history is maintained
- [ ] Budget constraints are enforced
- [ ] Treasury balance cannot go negative (or only with approval)

### Token & Blockchain Integration
- [ ] Token transfers are correctly recorded
- [ ] Token event indexing captures all events
- [ ] Smart contract interactions are logged
- [ ] Blockchain RPC calls have proper error handling
- [ ] Transaction hashes are stored
- [ ] Gas estimation is accurate
- [ ] Nonce management prevents replay attacks

### Admin Operations
- [ ] Only admin users can access admin endpoints
- [ ] Admin can moderate content
- [ ] Admin can disable/enable users
- [ ] Admin actions are logged
- [ ] Admin password changes work correctly
- [ ] Admin session management is secure

### Environment Variable Validation
- [ ] All required environment variables are validated at startup
- [ ] Missing critical env vars cause app startup to fail
- [ ] Invalid env var values are caught early
- [ ] Sensitive env vars (secrets) are not logged

---

## B. Infrastructure Test Checklist

### Containerization
- [ ] Dockerized API builds successfully
- [ ] Dockerfile uses multi-stage builds to minimize image size
- [ ] Docker image uses non-root user for security
- [ ] Image layers are optimized (no large files in intermediate layers)
- [ ] Docker healthcheck is implemented and works
- [ ] Container respects SIGTERM for graceful shutdown

### Docker Compose
- [ ] All services start without errors
- [ ] Services depend on each other correctly (depends_on with conditions)
- [ ] Volumes are mounted and persisted
- [ ] Environment variables are passed correctly
- [ ] Service networking works (services can communicate)
- [ ] Logging is configured for all services

### Reverse Proxy (NGINX)
- [ ] API is accessible through reverse proxy
- [ ] Frontend is accessible through reverse proxy
- [ ] API routes are correctly proxied (/api/*)
- [ ] Static assets are served correctly
- [ ] Proxy headers are set (X-Forwarded-For, etc.)
- [ ] Connection keeps-alive works
- [ ] Buffering is configured

### HTTPS/SSL/TLS
- [ ] HTTPS is enforced (HTTP redirects to HTTPS)
- [ ] SSL certificates are valid and not expired
- [ ] TLS 1.2+ is enforced
- [ ] Weak ciphers are disabled
- [ ] HSTS header is present
- [ ] SSL/TLS handshake is fast

### PostgreSQL
- [ ] PostgreSQL container starts and is healthy
- [ ] Database is initialized with correct name/user/password
- [ ] Migrations run on container startup
- [ ] Data persists across container restarts
- [ ] Backup strategy is in place
- [ ] Connection pooling is configured
- [ ] Query logging is enabled (for debugging)

### Redis
- [ ] Redis container starts successfully
- [ ] Redis connection from API works
- [ ] Retry logic works when Redis is unavailable
- [ ] Data persists to disk (if configured)
- [ ] Memory limits are respected
- [ ] Eviction policy is configured

### Prometheus Monitoring
- [ ] Prometheus service starts
- [ ] Configuration file is loaded correctly
- [ ] API /metrics endpoint returns valid Prometheus data
- [ ] All services are scraped by Prometheus
- [ ] Metrics are stored in TSDB
- [ ] Retention policy is configured
- [ ] Prometheus UI is accessible

### Grafana Dashboards
- [ ] Grafana service starts
- [ ] Prometheus data source is configured
- [ ] Dashboards load correctly
- [ ] Graphs display data
- [ ] Annotations are present
- [ ] Alerts are configured
- [ ] Custom MtaaDAO dashboard exists

### Health Checks
- [ ] API /health endpoint returns 200
- [ ] NGINX healthcheck passes
- [ ] Database healthcheck passes
- [ ] Redis healthcheck passes
- [ ] Unhealthy services are detected by orchestrator

---

## C. Security Test Checklist

### Rate Limiting & Throttling
- [ ] Rate limiting rejects excessive requests
- [ ] Rate limit is applied per IP
- [ ] Rate limit is applied per user/API key
- [ ] Rate limit info is returned in headers
- [ ] 429 responses are returned correctly

### JWT & Token Security
- [ ] JWT tokens are signed with a secret
- [ ] JWT expiration is enforced
- [ ] Expired tokens are rejected
- [ ] Token refresh workflow is secure
- [ ] JWT secret is stored securely (not in code)
- [ ] JWT secrets are rotated periodically
- [ ] Token revocation is supported

### Admin Secrets & Credentials
- [ ] Admin passwords are hashed (bcrypt/Argon2)
- [ ] Database passwords are not hardcoded
- [ ] API keys are stored securely
- [ ] Docker secrets are used for sensitive data
- [ ] Environment-specific secrets are different
- [ ] Secrets are not committed to git

### Sensitive Data Handling
- [ ] No sensitive data is logged (passwords, tokens, keys)
- [ ] PII (Personally Identifiable Information) is protected
- [ ] User emails are not exposed in error messages
- [ ] Error messages don't leak implementation details
- [ ] Secrets are masked in logs
- [ ] Database queries don't log parameter values

### SQL Injection Prevention
- [ ] All queries use parameterized statements
- [ ] ORM (Drizzle) is used correctly
- [ ] No raw SQL with string concatenation
- [ ] User input is validated before database queries
- [ ] Input validation uses allowlists, not denylists

### CORS & CSRF Protection
- [ ] CORS is configured correctly
- [ ] Only allowed origins can access API
- [ ] CSRF tokens are used (if using cookies)
- [ ] SameSite cookie attribute is set
- [ ] OPTIONS requests are handled
- [ ] Preflight requests are allowed

### Security Headers
- [ ] Content-Security-Policy header is set
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: SAMEORIGIN (or DENY)
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Strict-Transport-Security (HSTS) is set
- [ ] Referrer-Policy is configured
- [ ] Permissions-Policy is set

### HTTPS Enforcement
- [ ] HTTP traffic redirects to HTTPS
- [ ] HTTPS is enforced via HSTS header
- [ ] Mixed content warnings don't appear
- [ ] SSL/TLS certificate is valid
- [ ] Certificate is trusted by browsers

### Access Control
- [ ] Public endpoints don't require authentication
- [ ] Protected endpoints require valid tokens
- [ ] Role-based access control is enforced
- [ ] Users can't access other users' data
- [ ] Admin-only operations are protected
- [ ] Unauthorized requests return 401/403

---

## D. Performance Test Checklist

### Load Testing (k6)
- [ ] API handles 1,000 req/min without errors
- [ ] API handles 100 concurrent users
- [ ] Response times remain acceptable under load
- [ ] Error rate stays below 0.1% at target load
- [ ] 95th percentile latency is acceptable
- [ ] No memory leaks detected

### Caching
- [ ] Redis caching reduces database queries
- [ ] Cache hits are logged and tracked
- [ ] Cache misses trigger database queries
- [ ] Cache expiration works correctly
- [ ] Stale cache is invalidated on updates
- [ ] Cache keys are predictable and documented

### Database Query Performance
- [ ] Database queries complete within SLA (e.g., <100ms)
- [ ] N+1 queries are eliminated
- [ ] Indexes are used for WHERE clauses
- [ ] JOINs are optimized
- [ ] Slow query log is monitored
- [ ] Query execution plans are reviewed

### Connection Pooling
- [ ] Database connection pool is sized correctly
- [ ] Connections are reused
- [ ] No connection leaks
- [ ] Stale connections are recycled
- [ ] Pool statistics are monitored

### Memory Usage
- [ ] API memory usage stays within limits (e.g., <500MB)
- [ ] No memory leaks on sustained load
- [ ] Garbage collection runs efficiently
- [ ] Memory is freed after request completion
- [ ] Large responses don't cause OOM

### Container Restart Resilience
- [ ] API recovers when restarted
- [ ] Database connections reconnect
- [ ] In-flight requests are handled gracefully
- [ ] No data loss on restart
- [ ] Services restart in correct order (depends_on)

---

## E. Deployment Test Checklist

### Environment-Specific Configuration
- [ ] Production environment uses production config
- [ ] Development environment uses development config
- [ ] Environment variables are properly set
- [ ] Database URL is correct for environment
- [ ] Feature flags are correctly configured
- [ ] Debug mode is disabled in production

### Database Migrations
- [ ] Migrations run on deployment
- [ ] Migrations don't cause downtime
- [ ] Rollback procedures are tested
- [ ] Data integrity is preserved
- [ ] Migration logs are available

### Backup & Recovery
- [ ] Database backups are automated
- [ ] Backups are stored off-site (or redundantly)
- [ ] Recovery time objective (RTO) is acceptable
- [ ] Recovery point objective (RPO) is acceptable
- [ ] Backup restores are tested regularly

### Monitoring & Alerting
- [ ] Metrics are collected and stored
- [ ] Alerts are configured for critical issues
- [ ] Alerting channels are working (email, Slack, etc.)
- [ ] Dashboard displays critical metrics
- [ ] Logs are centralized and searchable

---
