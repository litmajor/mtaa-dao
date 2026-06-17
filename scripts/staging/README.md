Staging load harness and failure injector

This folder contains simple scripts to stress-test the recurring payment/Saga system.

Prerequisites
- Node 18+ (for native `fetch` if using HTTP mode) or install `node-fetch`.
- `pg` package installed in the repo (the main project likely already depends on it).

Scripts

1) load_harness.js
- Modes:
  - `db`: inserts synthetic `payment_sagas` rows directly into the database.
  - `http`: posts synthetic payloads to a provided HTTP endpoint (e.g., a recurring-pay endpoint).

Usage examples:

DB mode (direct inserts):

```bash
node scripts/staging/load_harness.js --mode=db --count=1000 --concurrency=50 --dbUrl=postgres://user:pass@localhost:5432/mtaa
```

HTTP mode (POST to endpoint):

```bash
node scripts/staging/load_harness.js --mode=http --count=1000 --concurrency=20 --endpoint=http://localhost:3000/api/recurring/trigger
```

Options:
- `--mode` : `db` (default) or `http`
- `--count`: total number of synthetic jobs to send (default 1000)
- `--concurrency`: parallel in-flight inserts/requests (default 20)
- `--rate`: items per second (0 = unlimited)
- `--dbUrl`: Postgres connection string (or set `DATABASE_URL`)
- `--endpoint`: URL for HTTP mode (or set `STAGING_ENDPOINT`)

2) failure_injector.js
- Injects failure scenarios by updating a sample of `payment_sagas` rows.

Usage examples:

```bash
# mark ~10% of sampled sagas as failed
node scripts/staging/failure_injector.js --dbUrl=postgres://user:pass@localhost:5432/mtaa --percent=10 --action=fail

# clear failure state on ~5% of sampled sagas
node scripts/staging/failure_injector.js --dbUrl=postgres://user:pass@localhost:5432/mtaa --percent=5 --action=clear

# mark some sagas as long-running (slow)
node scripts/staging/failure_injector.js --dbUrl=postgres://user:pass@localhost:5432/mtaa --percent=5 --action=slow
```

Notes and next steps
- These scripts intentionally avoid importing the server runtime; they connect directly to Postgres so they can be run from CI or an external runner.
- For richer fault injection (network timeouts, gateway errors), run an HTTP-proxy that simulates failures and point your gateway client to it.
- Consider adding a small worker/test harness that consumes `payment_sagas` and drives your orchestrator code in a temporary branch before running in production.
