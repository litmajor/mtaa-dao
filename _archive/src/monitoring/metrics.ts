import client from 'prom-client';

// Create a Registry
export const register = new client.Registry();

// Collect default metrics
client.collectDefaultMetrics({ register });

// Custom metrics for MtaaDAO
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const proposalCreatedTotal = new client.Counter({
  name: 'proposals_created_total',
  help: 'Total number of proposals created',
  labelNames: ['creator'],
  registers: [register],
});

export const votesCastTotal = new client.Counter({
  name: 'votes_cast_total',
  help: 'Total number of votes cast',
  labelNames: ['proposal_id', 'vote_type'],
  registers: [register],
});

export const cacheHitTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_key'],
  registers: [register],
});

export const cacheMissTotal = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_key'],
  registers: [register],
});

export const databaseQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const tokenTransfersTotal = new client.Counter({
  name: 'token_transfers_total',
  help: 'Total number of token transfers',
  labelNames: ['from_address', 'to_address'],
  registers: [register],
});

export const treasuryBalance = new client.Gauge({
  name: 'treasury_balance_tokens',
  help: 'Current treasury balance in tokens',
  registers: [register],
});

export const activeProposals = new client.Gauge({
  name: 'active_proposals_count',
  help: 'Number of active proposals',
  registers: [register],
});

// Middleware to track HTTP requests
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode;
    
    httpRequestDuration.labels(method, route, statusCode).observe(duration);
    httpRequestTotal.labels(method, route, statusCode).inc();
  });
  
  next();
}

export async function getMetrics() {
  return register.metrics();
}
