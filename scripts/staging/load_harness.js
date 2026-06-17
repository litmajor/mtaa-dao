#!/usr/bin/env node
// Simple load harness for staging: DB mode (direct inserts) or HTTP mode (POST requests)
// Usage examples:
// DB mode: node load_harness.js --mode=db --count=1000 --concurrency=50 --dbUrl=postgres://user:pass@localhost:5432/db
// HTTP mode: node load_harness.js --mode=http --count=1000 --concurrency=50 --endpoint=http://localhost:3000/api/recurring/trigger

const { Pool } = require('pg');
const fetch = global.fetch || require('node-fetch');
const crypto = require('crypto');

function parseArgs() {
  const args = require('minimist')(process.argv.slice(2));
  return {
    mode: args.mode || 'db',
    count: Number(args.count || 1000),
    concurrency: Number(args.concurrency || 20),
    rate: Number(args.rate || 0), // items per second, 0 = unlimited
    dbUrl: args.dbUrl || process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING,
    endpoint: args.endpoint || process.env.STAGING_ENDPOINT,
    currency: args.currency || 'USD',
  };
}

function randAmount() {
  return (Math.random() * 100).toFixed(6);
}

function makeSagaPayload() {
  return {
    id: crypto.randomUUID(),
    status: 'pending',
    user_id: crypto.randomUUID().slice(0, 8),
    payment_id: 'pay_' + crypto.randomUUID().slice(0, 8),
    amount: randAmount(),
    currency: 'USD',
    steps_completed: [],
    current_step: 'RESERVE_FUNDS',
    attempt_count: 0,
    max_attempts: 5,
    last_error: null,
  };
}

async function runDbMode(cfg) {
  if (!cfg.dbUrl) throw new Error('dbUrl is required for db mode');
  const pool = new Pool({ connectionString: cfg.dbUrl });
  const client = await pool.connect();
  try {
    const insertSql = `INSERT INTO payment_sagas (id, status, user_id, payment_id, amount, currency, steps_completed, current_step, attempt_count, max_attempts, last_error, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now())`;

    let inFlight = 0;
    let completed = 0;

    function startOne() {
      const payload = makeSagaPayload();
      inFlight++;
      client.query(insertSql, [
        payload.id,
        payload.status,
        payload.user_id,
        payload.payment_id,
        payload.amount,
        payload.currency,
        JSON.stringify(payload.steps_completed),
        payload.current_step,
        payload.attempt_count,
        payload.max_attempts,
        payload.last_error,
      ]).then(() => {
        completed++;
        inFlight--;
        maybeStartMore();
      }).catch(err => {
        console.error('insert error', err);
        inFlight--;
        maybeStartMore();
      });
    }

    let started = 0;
    function maybeStartMore() {
      while (inFlight < cfg.concurrency && started < cfg.count) {
        started++;
        startOne();
        if (cfg.rate > 0) break; // if rate limited, start in paced loop
      }
      if (completed >= cfg.count) {
        console.log('done: inserted', completed);
        client.release();
        pool.end();
      }
    }

    if (cfg.rate > 0) {
      // paced mode
      const intervalMs = 1000 / cfg.rate;
      let sent = 0;
      const timer = setInterval(() => {
        if (sent >= cfg.count) {
          clearInterval(timer);
          return;
        }
        // send up to concurrency per tick
        for (let i = 0; i < cfg.concurrency && sent < cfg.count; i++) {
          startOne();
          sent++;
        }
      }, intervalMs);
    } else {
      maybeStartMore();
    }
  } finally {
    // pool will be closed when done
  }
}

async function runHttpMode(cfg) {
  if (!cfg.endpoint) throw new Error('endpoint is required for http mode');
  const limit = cfg.concurrency;
  const tasks = [];
  let started = 0;
  let completed = 0;

  function startOne() {
    const payload = makeSagaPayload();
    return fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(res => res.text()).then(body => {
      completed++;
    }).catch(err => {
      console.error('http error', err);
    });
  }

  while (started < cfg.count) {
    const batch = Math.min(limit, cfg.count - started);
    const promises = new Array(batch).fill(0).map(() => startOne());
    // pace if rate specified
    if (cfg.rate > 0) {
      await Promise.all(promises);
      // small sleep to approximate rate
      await new Promise(r => setTimeout(r, 1000));
    } else {
      // fire and forget up to concurrency
      await Promise.all(promises);
    }
    started += batch;
    console.log('started', started, 'completed', completed);
  }
  console.log('http mode done');
}

(async function main() {
  try {
    const cfg = parseArgs();
    console.log('config', cfg);
    if (cfg.mode === 'db') await runDbMode(cfg);
    else if (cfg.mode === 'http') await runHttpMode(cfg);
    else throw new Error('unknown mode');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
