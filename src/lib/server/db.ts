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

// Created lazily on first use rather than at import time: `next build`
// imports every API route module to collect its config, and an eager pool
// would make the build fail whenever DATABASE_URL isn't present at build time.
export function getPool(): Pool {
  if (!globalThis.__dataPilotPool) {
    globalThis.__dataPilotPool = createPool();
  }
  return globalThis.__dataPilotPool;
}

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function queryOne<T extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
