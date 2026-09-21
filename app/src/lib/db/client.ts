import { Pool } from "pg";

/**
 * Server-only Postgres pool, via Supabase's transaction-mode pooler
 * (DATABASE_URL). Never import this from a "use client" component —
 * every caller here is a route handler under src/app/api/.
 */
declare global {
  var __fpaPgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — paste your Supabase connection string into .env.local and restart the dev server.");
  }
  if (!global.__fpaPgPool) {
    global.__fpaPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return global.__fpaPgPool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows as T[];
}
