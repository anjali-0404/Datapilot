import { Pool } from "pg";

// A single shared connection pool for the whole server process. Next.js can
// hot-reload API route modules in dev, so we stash the pool on `globalThis`
// to avoid opening a new pool (and leaking connections) on every reload —
// the same pattern Prisma's own docs recommend for PrismaClient in dev.
declare global {
  var __dataPilotPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure a PostgreSQL connection string."
    );
  }
  // Render Postgres requires SSL (internal + external URLs). Enable it only
  // for hosted-style URLs so local `localhost` Postgres keeps working as-is.
  // Matches the heuristic in scripts/init-db.mjs.
  const needsSSL = /sslmode=require|render\.com|dpg-/i.test(connectionString);
  return new Pool({
    connectionString,
    max: 10,
    ...(needsSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

export const pool = globalThis.__dataPilotPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__dataPilotPool = pool;
}

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
