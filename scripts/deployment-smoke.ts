import 'dotenv/config';

type CheckResult = {
  name: string;
  ok: boolean;
  status?: number;
  details?: string;
};

const baseUrl = (process.env.SMOKE_BASE_URL || process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

async function checkHttp(name: string, path: string): Promise<CheckResult> {
  try {
    const res = await fetch(`${baseUrl}${path}`);
    return {
      name,
      ok: res.ok,
      status: res.status,
      details: res.ok ? 'ok' : await res.text(),
    };
  } catch (error: any) {
    return { name, ok: false, details: error?.message || 'fetch failed' };
  }
}

async function run() {
  const checks: Array<Promise<CheckResult>> = [
    checkHttp('root health', '/health'),
    checkHttp('api health', '/api/health'),
    checkHttp('websocket stats', '/api/websocket/stats'),
    checkHttp('dex health', '/api/dex/health'),
  ];

  const results = await Promise.all(checks);
  const failed = results.filter((r) => !r.ok);

  console.log(`\nDeployment smoke check against: ${baseUrl}`);
  for (const result of results) {
    const status = result.ok ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${result.name}${result.status ? ` (status ${result.status})` : ''}${result.details ? ` - ${result.details}` : ''}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('Smoke test failed to execute:', error);
  process.exit(1);
});
