import { pool } from '../db';

/** Lightweight DB client helpers to ensure clients are always released. */
export async function withClient<T>(handler: (client: any) => Promise<T>, timeoutMs = 10000): Promise<T> {
  const client = await pool.connect();
  let timer: NodeJS.Timeout | null = null;
  try {
    if (timeoutMs && timeoutMs > 0) {
      return await Promise.race([
        handler(client),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`DB operation timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    }

    return await handler(client);
  } finally {
    if (timer) clearTimeout(timer);
    try { client.release(); } catch (_) { /* ignore */ }
  }
}

export async function withTransaction<T>(handler: (client: any) => Promise<T>, timeoutMs = 30000): Promise<T> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const res = await Promise.race([
        handler(client),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`DB transaction timed out after ${timeoutMs}ms`)), timeoutMs)),
      ]);
      await client.query('COMMIT');
      return res;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    }
  }, timeoutMs + 1000);
}

export default { withClient, withTransaction };
