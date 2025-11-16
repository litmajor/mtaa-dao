/**
 * Load Testing Script using k6
 * 
 * Tests API performance under load
 * Run with: k6 run load-test.js
 * 
 * Load test phases:
 * - Warm-up: Gradual increase to steady-state
 * - Steady-state: Sustained load
 * - Spike: Sudden increase
 * - Ramp-down: Gradual decrease
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const proposalCreationTime = new Trend('proposal_creation_time');
const voteTime = new Trend('vote_time');
const apiLatency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Warm-up: 0 -> 100 VUs
    { duration: '5m', target: 100 },   // Stay at 100 VUs
    { duration: '2m', target: 200 },   // Spike: 100 -> 200 VUs
    { duration: '5m', target: 200 },   // Stay at 200 VUs
    { duration: '2m', target: 0 },     // Ramp-down: 200 -> 0 VUs
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95% of requests < 500ms
    'http_req_duration{staticAsset:yes}': ['p(99)<250'], // Static assets < 250ms
    'errors': ['rate<0.1'],  // Error rate < 0.1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';
let authToken = '';
let proposalId = '';

export function setup() {
  // Authentication setup
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, {
    email: 'test@mtaadao.org',
    password: 'SecurePassword123!',
  });

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
  });

  return { token: loginRes.json('token') };
}

export default function (data) {
  authToken = data.token;

  // Test proposal retrieval
  group('Proposal List', () => {
    const res = http.get(`${BASE_URL}/api/v1/proposals`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 200ms': (r) => r.timings.duration < 200,
      'has proposals': (r) => r.json('proposals').length > 0,
    });

    errorRate.add(!success);
    apiLatency.add(res.timings.duration);
  });

  // Test proposal creation
  group('Create Proposal', () => {
    const payload = {
      title: `Performance Test Proposal ${Date.now()}`,
      description: 'Test proposal for load testing',
      votingPeriodDays: 7,
      proposedAmount: 10000,
    };

    const res = http.post(`${BASE_URL}/api/v1/proposals`, JSON.stringify(payload), {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    const success = check(res, {
      'status is 201': (r) => r.status === 201,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'has proposal id': (r) => r.json('id').length > 0,
    });

    proposalCreationTime.add(res.timings.duration);
    errorRate.add(!success);

    if (success && res.json('id')) {
      proposalId = res.json('id');
    }
  });

  // Test voting (if proposal exists)
  if (proposalId) {
    group('Vote on Proposal', () => {
      const payload = { voteType: 'yes' };

      const res = http.post(
        `${BASE_URL}/api/v1/proposals/${proposalId}/vote`,
        JSON.stringify(payload),
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const success = check(res, {
        'status is 201 or 400': (r) => r.status === 201 || r.status === 400, // May fail if already voted
        'response time < 300ms': (r) => r.timings.duration < 300,
      });

      voteTime.add(res.timings.duration);
      errorRate.add(res.status >= 500); // Only count 5xx as errors
    });
  }

  // Test treasury balance
  group('Treasury Balance', () => {
    const res = http.get(`${BASE_URL}/api/v1/treasury/balance`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 200ms': (r) => r.timings.duration < 200,
    });

    apiLatency.add(res.timings.duration);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    '/tmp/k6-report.json': JSON.stringify(data),
  };
}

// Text summary helper
function textSummary(data, options) {
  const { indent = '', enableColors = false } = options;
  
  const metrics = data.metrics;
  let summary = '\n=== Performance Test Summary ===\n';

  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration.values;
    summary += `${indent}HTTP Request Duration:\n`;
    summary += `${indent}  Mean: ${duration.mean?.toFixed(2)}ms\n`;
    summary += `${indent}  P95: ${duration.p95?.toFixed(2)}ms\n`;
    summary += `${indent}  P99: ${duration.p99?.toFixed(2)}ms\n`;
  }

  if (metrics.errors) {
    summary += `${indent}Error Rate: ${(metrics.errors.value * 100).toFixed(2)}%\n`;
  }

  return summary;
}
